// v6_check.js — THE authoritative post-build verification (locked 4 Sep 2026).
// Eval INSIDE a live.activepipe.com tab, after v6_build.js. Exposes window.v6Check(tag).
//
// RUN IT TWICE, refetching the property feeds between runs (Harrison: "run this check twice").
// ONE FLAT FUNCTION — never wrap it. Layered wrappers produced contradictory results on 4 Sep.
//
// It asserts CONTENT, not labels. The 4 Sep community failure survived three earlier rounds
// because the checks confirmed the heading named the right suburb and never read the body.
(function () {
  const V = window.V6;
  const API = V.API, fold = V.fold;
  const get = async id => (await fetch(API + '/communications/' + id, { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } })).json();
  const camp = async id => (await fetch(API + '/campaigns/' + id, { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } })).json();

  // ctx: {current, sold} freshly pulled. maps: {MAP, CAMP, AUD, BD}. opts: {sendISO, namePrefix, joke}
  window.v6Check = async function (tag, ctx, maps, opts) {
    const store = {}; window['__' + tag] = store; window['__' + tag + 'DONE'] = false; window['__' + tag + 'ERR'] = null;
    try {
      for (const [sub, id] of Object.entries(maps.MAP)) {
        const c = await get(id), pc = c.email.panelcontents, bd = maps.BD[sub];
        const txt = p => (((p.contents || {}).textOne || {}).blocks || []).map(b => b.text);
        const ALL = pc.filter(p => p.panel_id === 6).map(p => txt(p).join('\n')).join('\n');
        const E = [], cnt = bd.lines.length, wp = V.winPhrase(bd.label);

        // 1 NAME
        if (opts.namePrefix && c.name !== opts.namePrefix + ' ' + sub + ' update') E.push('name wrong: ' + c.name);
        // 1b SUBJECT — had NO assertion at all until 11 Sep 2026. A wrong subject is the one
        // defect every recipient sees before anything else, and nothing was checking it.
        const expSubj = V.subjectFor(sub, bd, { week: opts.week, prev: (opts.prevSubjects || {})[sub] });
        if ((c.email.subject || '') !== expSubj) E.push('subject wrong: "' + c.email.subject + '" expected "' + expSubj + '"');
        // Must not repeat LAST WEEK'S subject (failure shape 16). Checking uniqueness only
        // within this week's 34 missed 14 repeats on 12 Sep.
        const prevSubj = (opts.prevSubjects || {})[sub];
        if (prevSubj && (c.email.subject || '') === prevSubj) E.push('SUBJECT REPEATS LAST WEEK: ' + prevSubj);
        if (/\bOne .* sale and what they mean/.test(c.email.subject || '')) E.push('singular sale with plural verb');
        // 1c WEEK-OVER-WEEK FRESHNESS on every reader-visible generated block.
        // Measured 12 Sep before the variation engine existed: 21/34 intros and 10/34 preheaders
        // were byte-identical to the prior week, and the media paragraph + transition were
        // CONSTANT for all 34 every week. A repeat here is a hard fail, not a warning.
        const pv = ((opts.prevBlocks || {})[sub]) || {};
        const introNow = V.introFor(sub, bd);
        const nowBlocks = { pre: V.preheaderFor(sub, bd), subject: c.email.subject,
          opener: introNow[0], media: introNow[2], transition: introNow[4],
          t1: V.thirtyLines(sub, bd)[0], t2: V.thirtyLines(sub, bd)[1] };
        Object.keys(nowBlocks).forEach(k => {
          if (pv[k] && nowBlocks[k] === pv[k]) E.push('REPEATS LAST WEEK [' + k + ']: ' + String(nowBlocks[k]).slice(0, 44));
        });
        store.__blocks = store.__blocks || {}; store.__blocks[sub] = nowBlocks;
        if ((c.email.subject || '').indexOf(sub) < 0) E.push('subject does not name the suburb');
        if ((c.email.subject || '').length > 78) E.push('subject too long: ' + c.email.subject.length);
        if (/[–—]/.test(c.email.subject || '')) E.push('dash in subject');
        store.__subjects = store.__subjects || {};
        if (store.__subjects[c.email.subject]) E.push('DUPLICATE subject shared with ' + store.__subjects[c.email.subject]);
        store.__subjects[c.email.subject] = sub;
        // 2 PREHEADER — per suburb, accurate (failure shape 11)
        const pre = txt(pc[0]).join(' ');
        if (pre.indexOf(V.preheaderFor(sub, bd)) < 0) E.push('preheader not the generated one: ' + pre.slice(0, 50));
        if (pre.indexOf('View this email in your browser') < 0) E.push('preheader lost view-online line');
        if (pre.indexOf(sub) < 0) E.push('preheader does not name the suburb');
        // 3 INTRO — generated, per suburb, no economy, no overclaim
        const expIntro = V.introFor(sub, bd)[0];
        if (ALL.indexOf(expIntro) < 0) E.push('intro not the generated per-suburb intro');
        if (/finance|OCR|interest rate|economy/i.test(expIntro)) E.push('intro mentions the economy');
        if (/single day/.test(expIntro) && !bd.lines.some(l => /, 1 day\)/.test(l))) E.push('intro overclaims a same-day sale');
        const tm = expIntro.match(/top sale here reaching \$([\d,]+)/);
        if (tm) { const claim = +tm[1].replace(/,/g, ''); const real = Math.max(...bd.lines.map(l => { const m = l.match(/\$([\d,]+)/); return m ? +m[1].replace(/,/g, '') : 0; }));
          if (claim !== real) E.push('intro top sale figure does not match the data'); }
        if (ALL.indexOf('Here is what that looked like in ' + sub + ' this week') < 0) E.push('intro transition missing');
        // 4 FIGURES
        const st = pc.find(p => p.panel_id === 8); const dm = st ? txt(st).join(' ').match(/(\d{1,3})\s*Days/i) : null;
        if (!dm || +dm[1] !== bd.days) E.push('stat card days do not match REINZ');
        V.thirtyLines(sub, bd).forEach(t => { if (ALL.indexOf(t) < 0) E.push('30 second line missing: ' + t.slice(0, 34)); });
        bd.lines.forEach(l => { if (ALL.indexOf(l) < 0) E.push('sold line missing: ' + l.slice(0, 24)); });
        if (opts.auctionLine && ALL.indexOf(opts.auctionLine) < 0) E.push('auction figures not current');
        if (opts.staleAuction && new RegExp(opts.staleAuction).test(ALL)) E.push('STALE auction figures present');
        if (opts.ocr && (ALL.match(new RegExp(opts.ocr.replace('.', '\\.'), 'g')) || []).length < 1) E.push('economy figure missing');
        // 5 SUBURB NAMING
        if (ALL.indexOf('WHAT SOLD IN ' + sub.toUpperCase()) < 0) E.push('sold heading wrong suburb');
        if (ALL.indexOf(V.communityHeading(sub)) < 0) E.push('community heading wrong: expected ' + V.communityHeading(sub));
        if (!V.DATED.has(sub) && /AROUND [A-ZĀĒĪŌŪ ]+ THIS MONTH/.test(ALL)) E.push('undated suburb promises THIS MONTH');
        if (ALL.indexOf('WHAT YOUR HOME IS WORTH TODAY') < 0) E.push('valuation section missing');
        // 6 COMMUNITY CONTENT GENUINELY LOCAL (hard gate)
        // The LEAD item must name THIS suburb in its own text. The old gate accepted the
        // suburb's local BOARD as a fallback, which passed 21 of 34 emails that were reading
        // board-wide news under their own suburb's heading (found 11 Sep 2026, failure 13).
        const lead = (V.LOCAL[sub] || [])[0];
        if (!lead) E.push('no community content for ' + sub);
        else if (fold(lead.t + ' ' + lead.b).indexOf(fold(sub)) < 0)
          E.push('COMMUNITY LEAD DOES NOT NAME ' + sub + ': ' + lead.t.slice(0, 40));
        if (/Plan Change 120|granny flat|out of zone ballots/i.test(ALL)) E.push('generic Auckland-wide filler present');
        (V.LOCAL[sub] || []).forEach(it => { if (ALL.indexOf(it.t) < 0) E.push('community item missing: ' + it.t.slice(0, 28)); });
        // 7 CTA PAIR
        if (ALL.indexOf('WHERE ARE YOU AT WITH YOUR PLACE?') < 0) E.push('reply CTA heading missing');
        if (ALL.indexOf('current property journey') < 0) E.push('reply CTA body missing');
        if (ALL.indexOf('downsizing, upsizing, investing, holding') < 0) E.push('reply options missing');
        if (ALL.indexOf('OR JUST TELL ME WITH ONE CLICK') < 0) E.push('preferences not blended');
        if (ALL.indexOf('button below') < 0) E.push('hand-off line missing');
        if (/ONE QUESTION, ONE LINE BACK|MOVED HOME\?/.test(ALL)) E.push('old CTA copy still present');
        // 8 COPY HYGIENE
        if (/[–—]/.test(ALL)) E.push('dash in copy');
        if (/\[[^\]]{0,40}\]/.test(ALL)) E.push('placeholder left');
        if (/\? bed/.test(ALL)) E.push('unknown bedroom count');
        if (/kia ora/i.test(ALL)) E.push('Kia ora used');
        if (/this recent weeks/.test(ALL)) E.push('grammar: this recent weeks');
        if (opts.joke && ALL.indexOf(opts.joke) < 0) E.push('this week\'s joke missing');
        const wr = pc.find(p => p.panel_id === 6 && txt(p).some(t => /Hi First Name/.test(t)));
        const b0 = wr ? wr.contents.textOne.blocks[0] : null;
        if (!b0 || b0.text !== 'Hi First Name,' || JSON.stringify(b0.entityRanges || []) !== JSON.stringify([{ offset: 3, length: 10, key: 0 }])) E.push('greeting merge field broken');
        // 9 STRUCTURE — buttons directly under their sections
        const vi = pc.findIndex(p => p.panel_id === 6 && txt(p).some(t => /WHAT YOUR HOME IS WORTH/.test(t)));
        if (vi < 0 || !pc[vi + 1] || pc[vi + 1].panel_id !== 3 || (pc[vi + 1].options || {}).buttonLink !== V.APPRAISAL) E.push('valuation CTA not directly under its section');
        const pi = pc.findIndex(p => p.panel_id === 6 && txt(p).some(t => /OR JUST TELL ME WITH ONE CLICK/.test(t)));
        if (pi < 0 || !pc[pi + 1] || pc[pi + 1].panel_id !== 3 || (pc[pi + 1].options || {}).buttonLink !== V.PREFS) E.push('preferences button not directly under its section');
        const ri = pc.findIndex(p => p.panel_id === 6 && txt(p).some(t => /WHERE ARE YOU AT WITH YOUR PLACE/.test(t)));
        if (!(ri >= 0 && pi > ri)) E.push('reply CTA not above preferences');
        // 10 ALERT BAR + BREAK-OUT + CLIP
        const bb = pc.find(p => p.panel_id === 3 && (p.options || {}).buttonLink === V.SENTINEL);
        if (!bb) { if (V.estimate(pc) > 104448) E.push('email clips but has no break-out button'); }
        else {
          if ((bb.options || {}).backgroundColor === '#fbe80f') E.push('break-out button is yellow on yellow');
          const bh = pc.slice(0, pc.indexOf(bb)).reverse().find(p => p.panel_id === 5);
          if (!bh || (bh.options || {}).backgroundColor !== '#000000') E.push('alert bar not black');
          (bh ? bh.contents.textOne.blocks : []).forEach(b => {
            const s = (b.inlineStyleRanges || []).map(r => r.style).sort().join('+');
            if (s !== '#fbe80f+BOLD') E.push('alert bar text not yellow bold'); });
          if (bh && bh.contents.textOne.blocks.length > 2) E.push('alert bar more than 2 lines');
          const eb = V.estimate(pc.slice(0, pc.indexOf(bb) + 1));
          if (eb > 95000) E.push('break-out button estimated past the clip (' + eb + ')');
        }
        // 11 LISTINGS — complete, correct suburb, no empties
        const shown = [];
        pc.filter(p => [17, 19].includes(p.panel_id) && !(p.options || {}).feed)
          .forEach(p => ((p.contents || {}).propertyListings || []).forEach(r => { if (r.status === 'current') shown.push(r); }));
        const live = ctx.current.filter(r => fold(r.city) === fold(sub));
        live.forEach(r => { if (!shown.some(x => x.id === r.id)) E.push('LIVE LISTING MISSING: ' + r.displayaddress); });
        // The reverse direction was NOT asserted until 11 Sep 2026 (failure shape 15): a listing
        // that goes off market after the build stays in the email and passed every check.
        // Completeness and currency are two different properties — assert BOTH directions.
        shown.forEach(r => { if (!live.some(x => x.id === r.id)) E.push('DEAD LISTING STILL SHOWN: ' + r.displayaddress); });
        shown.forEach(r => { if (fold(r.city) !== fold(sub)) E.push('listing from another suburb: ' + r.displayaddress); });
        if (pc.filter(p => [17, 19].includes(p.panel_id) && !(p.options || {}).feed && !((p.contents || {}).propertyListings || []).length).length) E.push('EMPTY PROPERTY PANEL (renders placeholder)');
        // 12 FIELD ACCURACY against the live feed
        const byId = new Map(ctx.current.map(r => [r.id, r])), soldById = new Map(ctx.sold.map(r => [r.id, r]));
        pc.filter(p => [17, 19].includes(p.panel_id) && !(p.options || {}).feed).forEach(p => {
          const kind = ((p.contents || {}).propertyListings || []).every(r => r.status === 'sold') ? 'sold' : 'current';
          ((p.contents || {}).propertyListings || []).forEach(r => {
            const src = (kind === 'sold' ? soldById : byId).get(r.id);
            if (!src) { E.push('listing not in live feed: ' + r.displayaddress); return; }
            const rp = r.displayprice || r.priceformatted || r.price || '', sp = src.displayprice || src.priceformatted || src.price || '';
            if (kind !== 'sold' && String(rp) !== String(sp)) E.push('price drift: ' + r.displayaddress);
            ['bedrooms', 'bathrooms', 'carparks'].forEach(f => { if (String(r[f] ?? '') !== String(src[f] ?? '')) E.push(f + ' drift: ' + r.displayaddress); });
            const link = r.url || r.externallink || '';
            if (!/^https?:\/\//.test(link) || link !== (src.url || src.externallink || '')) E.push('listing link drift: ' + r.displayaddress);
            (r.images || []).forEach(im => { if (!/^https?:\/\//.test(im.src || '')) E.push('image without src: ' + r.displayaddress); });
          });
        });
        // 13 SOLD-BY-ME: Harrison's sales only, no prices rendered
        // Dynamic alert placement can SPLIT the sold tiles across two grids — union them all.
        const sgs = pc.filter(p => p.panel_id === 17 && !(p.options || {}).feed
          && ((p.contents || {}).propertyListings || []).length
          && ((p.contents || {}).propertyListings || []).every(r => r.status === 'sold'));
        if (!sgs.length) E.push('JUST SOLD grid missing');
        else {
          const shownSold = [];
          sgs.forEach(sg => {
            if (JSON.stringify((sg.options || {}).detailsLayout) !== JSON.stringify(['amenities', 'address'])) E.push('JUST SOLD layout shows price or button');
            ((sg.contents || {}).propertyListings || []).forEach(r => {
              shownSold.push(r);
              if (!JSON.stringify(r.extendeddata || '').includes(V.AGID)) E.push('JUST SOLD contains a sale that is not Harrison\'s');
            });
          });
          ctx.sold.forEach(r => { if (!shownSold.some(x => fold(x.displayaddress) === fold(r.displayaddress))) E.push('MY SALE MISSING: ' + r.displayaddress); });
        }
        // 14 CAMPAIGN WIRING
        if (maps.CAMP && maps.CAMP[sub]) {
          const cc = await camp(maps.CAMP[sub].id);
          const trg = (cc.triggers || [])[0] || {}, act = (trg.actions || [])[0] || {}, aud = (cc.campaign_audiences || [])[0];
          if (cc.status !== 'running') E.push('campaign not running (' + cc.status + ') — a draft never sends');
          if (String(act.value) !== String(id)) E.push('campaign points at the wrong email');
          if (opts.sendISO && !new RegExp(opts.sendISO).test(String(trg.identifier))) E.push('trigger not ' + opts.sendISO);
          if (!aud) E.push('no audience bound');
          else if (maps.AUD && aud.ruleset_id !== maps.AUD[sub]) E.push('wrong audience bound');
          if (cc.firstsent_at) E.push('ALREADY SENT');
        }
        store[sub] = { pass: E.length === 0, errors: E, listings: shown.length };
      }
    } catch (e) { window['__' + tag + 'ERR'] = String(e && e.stack || e).slice(0, 300); }
    window['__' + tag + 'DONE'] = true;
    return store;
  };
})();
