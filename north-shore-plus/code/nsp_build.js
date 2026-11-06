// nsp_build.js — NORTH SHORE PLUS panel assembler. Dual export: window.NSP in the AP tab for the
// real write, module.exports in node for the review pack (same code, same words, see hw_build.js
// for why a review pack rendered by a second copy of the wording is not a review).
//
// INPUTS  dataset.json (nsp_dataset.js) + editorial.json (human sourced, gated) + the Weekly
//         Buyers email 3981357 as the STYLE reference (yellow banded header-one headings, btn2
//         buttons, #fbe80f bar, black Gmail bar). Nothing reader visible is typed here that is not
//         computed from the dataset or read from editorial.json.
//
// STYLE CONTRACT (Harrison, 27 Oct 2026): "punchy and powerful but short and snappy", relevant
// wherever you live on the Shore. So: one line per fact, numbers lead, area blocks of 3 to 10
// rows, suburbs under MIN_N print count and top sale only. No paragraph longer than two lines
// except the intro. No dashes anywhere (CLAUDE.md), ranges use "to".
(function () {
  const BOOK = 'https://harrisoncutfield.co.nz/book.html';
  const PREFS = 'activepipe-property-preferences';
  const VIEWONLINE = 'activepipe-view-online';
  const ME = 'harrison.cutfield@raywhite.com';
  const YEL = '#fbe80f', BLK = '#000000';

  const J = o => JSON.parse(JSON.stringify(o));
  const rk = () => Math.random().toString(36).slice(2, 10);
  const clone = p => { const c = J(p); delete c.id; delete c.email_id; return c; };
  const nodash = s => String(s).replace(/\s+[‐-―\-]\s+/g, ' to ').replace(/(\d)\s*[‐-―\-]\s*(\d)/g, '$1 to $2').replace(/[‐-―]/g, ' ');

  // Draft.js block with ranges rebuilt from the final text. `color` is a hex style string.
  const blk = (t, o) => {
    o = o || {}; t = nodash(t || ''); const r = [];
    if (t) {
      r.push({ offset: 0, length: t.length, style: o.color || BLK });
      if (o.bold) r.push({ offset: 0, length: t.length, style: 'BOLD' });
      if (o.italic) r.push({ offset: 0, length: t.length, style: 'ITALIC' });
    }
    return { key: rk(), text: t, type: o.type || 'unstyled', depth: 0, inlineStyleRanges: r, entityRanges: o.er || [], data: {} };
  };

  // ---- formatting: every number that prints goes through here ----
  // $1,128,000 -> $1.13m ; $1,000,000 -> $1m (never "$1.0m") ; $853,000 -> $853k
  const $m = v => v == null ? null : (v >= 1e6 ? '$' + (v / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'm' : '$' + Math.round(v / 1000) + 'k');
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const $full = v => v == null ? null : '$' + Math.round(v).toLocaleString('en-NZ');
  const sgn = v => v == null ? null : (v > 0 ? 'up ' + Math.abs(v) : v < 0 ? 'down ' + Math.abs(v) : 'flat');
  const pctw = v => v == null ? null : (v > 0 ? 'up ' + v + '%' : v < 0 ? 'down ' + Math.abs(v) + '%' : 'flat');
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dmy = iso => { const d = new Date(iso + 'T12:00:00+13:00'); return d.getDate() + ' ' + MON[d.getMonth()]; };
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

  // ---- reference panels from the Weekly Buyers email ----
  function refs(wb) {
    const pc = ((wb.email || {}).panelcontents || []).slice().sort((a, b) => a.position - b.position);
    const blocks = p => (((p.contents || {}).textOne || {}).blocks || []);
    const r = {
      pre: pc.find(p => p.panel_id === 30),
      hero: pc.find(p => p.panel_id === 9),
      greet: pc.find(p => p.panel_id === 6 && blocks(p).some(b => /Hi First Name/.test(b.text))),
      band: pc.find(p => p.panel_id === 6 && (p.options || {}).backgroundColor === YEL),
      body: pc.find(p => p.panel_id === 6 && !(p.options || {}).backgroundColor && !blocks(p).some(b => /Hi First Name/.test(b.text)) && blocks(p).length),
      btn: pc.find(p => p.panel_id === 3 && (p.options || {}).buttonStyle === 'btn2'),
      bar: pc.find(p => p.panel_id === 2 && (p.options || {}).thickness),
      gbar: pc.find(p => p.panel_id === 5 && /Gmail/i.test(JSON.stringify(p.contents || {}))),
      sys: pc.filter(p => [33, 16, 28].indexOf(p.panel_id) >= 0),
      footImg: pc.filter(p => p.panel_id === 9).slice(-1)[0],
      lastPre: pc.filter(p => p.panel_id === 30).slice(-1)[0],
      grid: pc.find(p => p.panel_id === 17 && p.query && (p.options || {}).feed) || null
    };
    r.gbtn = r.gbar ? pc[pc.indexOf(r.gbar) + 1] : null;
    const miss = Object.keys(r).filter(k => k !== 'grid' && (!r[k] || (Array.isArray(r[k]) && !r[k].length)));
    if (miss.length) throw new Error('reference panel missing from 3981357: ' + miss.join(','));
    return r;
  }

  const mkText = (ref, lines, opts) => { const c = clone(ref); c.options = Object.assign({}, c.options, opts || {}); c.contents = { textOne: { blocks: lines.map(l => blk(l.t, l)), entityMap: {} } }; return c; };
  const mkBand = (ref, head, sub) => { const c = clone(ref); c.options = Object.assign({}, c.options, { backgroundColor: YEL }); c.contents = { textOne: { blocks: [blk(head, { type: 'header-one', bold: true })].concat(sub ? [blk(sub, { type: 'header-three' })] : []), entityMap: {} } }; return c; };
  const mkBtn = (ref, text, link) => { const c = clone(ref); c.options = Object.assign({}, c.options, { buttonText: nodash(text), buttonLink: link, buttonStyle: 'btn2' }); return c; };
  // VISUAL EDITION (Harrison, 6 Nov 2026: "more visual... with graphs and images"). A chart tile
  // is a pid 9 image panel cloned from the hero: contents.imageOne is the AP image object returned
  // by POST /images (id, src, key, secret, width, height), the link is the appraisal page. Tiles
  // are rendered by tools/nsp_viz.js from the SAME dataset.json the text panels read, so a tile
  // and its text fallback can never disagree. `opts.viz` = { scoreboard, trend, areas, area_<key>,
  // method } -> image objects; any missing tile falls back to the text version of that section.
  const mkImg = (ref, img, link) => { const c = clone(ref); c.options = Object.assign({}, c.options, { feed: false, backgroundColor: '#ffffff', imageOneLink: link || BOOK }); c.contents = { imageOne: J(img) }; return c; };
  // Live SOLD photo grid: the Buyers listings grid re-pointed at the group's sold feed, newest
  // first. detailsLayout drops price on purpose (office feed never carries prices, 27 Oct rule).
  const mkSoldGrid = (ref, n) => {
    const g = clone(ref);
    g.query = Object.assign({}, g.query, { size: n, status: ['sold'], sort: 'solddate-desc', behaviouralSort: false });
    g.options = Object.assign({}, g.options, { itemCount: n, feedStatus: ['sold'], feedSort: 'solddate-desc', feedBehaviouralSort: false, detailsLayout: ['amenities', 'address'] });
    g.contents = { propertyListings: [] };
    return g;
  };
  function greeting(ref, lines) {
    const c = clone(ref);
    const g = blk('Hi First Name,', { italic: true }); g.entityRanges = [{ offset: 3, length: 10, key: 0 }];
    const em = (((ref.contents || {}).textOne || {}).entityMap) || { 0: { type: 'PLACEHOLDER', mutability: 'IMMUTABLE', data: { placeholder: 'contact.firstname' } } };
    const out = [g];
    lines.forEach(t => { out.push(blk('')); out.push(blk(t)); });   // blank block between paragraphs or they run together
    c.contents = { textOne: { blocks: out, entityMap: em } };
    return c;
  }
  function preheader(ref, text) {
    const c = clone(ref); const src = ((ref.contents || {}).textOne || {});
    const keep = (src.blocks || []).filter(b => /View this email/i.test(b.text));
    if (!keep.length) throw new Error('reference panel 0 has no view online block');
    c.contents = { textOne: { blocks: [blk(text)].concat(keep), entityMap: src.entityMap || {} } }; return c;
  }

  // ---- the suburb board: one line per suburb, numbers first ----
  // Under MIN_N: count + top sale only. The absence of a median IS the information.
  // COMPACT (Harrison, 3 Nov 2026: "very full on with the amount of reading... more impactful").
  // A suburb line is now THREE numbers: count, median, days. The quarter on quarter read moves up
  // to ONE line per area, so a reader gets the trend without thirty comparison clauses. Under
  // MIN_N: count and top sale only.
  function suburbLine(r) {
    const n = r.now.n;
    if (!n) return r.suburb + ': no settled sales.';
    if (r.now.median == null) return r.suburb + ': ' + plural(n, 'sale') + (r.now.top ? ', top ' + $m(r.now.top.price) : '') + '.';
    return r.suburb + ': ' + plural(n, 'sale') + ', median ' + $m(r.now.median) + ', ' + r.now.days + ' days.';
  }
  // The one line read for an area: who carried volume and price, then the area median and speed
  // against the prior 90 days. All computed.
  function areaRead(a) {
    const p = [];
    if (a.busiest) p.push(a.busiest + ' carried the volume');
    if (a.priciest && a.priciest !== a.busiest) p.push(a.priciest + ' the price');
    const s = p.length ? p.join(', ') + '.' : 'A quiet quarter on settled sales.';
    const A = a.area;
    const m = A.now.median != null ? ' Median ' + $m(A.now.median) + (A.dMedianPct == null || A.dMedianPct === 0 ? '' : ', ' + pctw(A.dMedianPct) + ' on the prior quarter') + '.' : '';
    const d = A.now.days != null ? ' ' + A.now.days + ' days to sell' + (A.dDays == null || A.dDays === 0 ? '' : A.dDays < 0 ? ', ' + Math.abs(A.dDays) + ' faster' : ', ' + A.dDays + ' slower') + '.' : '';
    return s + m + d;
  }

  // ---- assemble ----
  function assemble(wb, ds, ed, opts) {
    opts = opts || {};
    const R = refs(wb);
    ['opener', 'preheader', 'subject'].forEach(k => { if (!ed || !ed[k] || (Array.isArray(ed[k]) ? !ed[k].length : !String(ed[k]).trim())) throw new Error('editorial.json missing: ' + k); });
    const S = ds.shore, out = [], push = p => { out.push(p); return p; };

    // Hero and footer images belong to the TARGET email once its own banners are loaded (3 Nov
    // 2026: hero 135193810, footer 135193813). Cloning the Buyers hero here would silently put
    // "New to Market on the North Shore" back on every rebuild.
    const tpcEarly = opts.target ? ((opts.target.email || {}).panelcontents || []).slice().sort((a, b) => a.position - b.position) : null;
    const tImgs = tpcEarly ? tpcEarly.filter(p => p.panel_id === 9) : [];
    const heroP = tImgs.length ? J(tImgs[0]) : clone(R.hero);
    const footP = tImgs.length > 1 ? J(tImgs[tImgs.length - 1]) : clone(R.footImg);
    push(preheader(R.pre, ed.preheader));
    push(heroP);
    push(greeting(R.greet, ed.opener));

    const V = opts.viz || {};
    const vimg = (name, link) => V[name] ? push(mkImg(R.hero, V[name], link)) : null;

    // THE SHORE THIS WEEK: four facts, one line each, every one computed. Visual edition: the
    // scoreboard, the monthly trend and the area bars as image tiles; text only as fallback.
    push(mkBand(R.band, 'THE SHORE THIS WEEK', 'Last 90 days against the 90 before, settled sales only.'));
    const tiles = [];
    if (V.scoreboard) {
      vimg('scoreboard'); vimg('trend'); vimg('areas');
      if (ds.clearance && ds.clearance.available) push(mkText(R.body, [{ t: 'Auction clearance: Ray White CR Group ' + ds.clearance.rw + '%, North Shore ' + ds.clearance.shore + '%, four week average to ' + dmy(ds.clearance.as_at) + '.' }]));
    } else {
    tiles.push({ t: plural(S.now.n, 'home') + ' settled.' + (S.dN == null ? '' : ' ' + cap(sgn(S.dN)) + ' on the prior 90 days.'), bold: true });
    if (S.now.median != null) tiles.push({ t: 'Median ' + $full(S.now.median) + (S.dMedianPct == null ? '.' : ', ' + pctw(S.dMedianPct) + '.') });
    if (S.now.days != null) tiles.push({ t: 'Median ' + S.now.days + ' days to sell' + (S.dDays == null ? '.' : S.dDays === 0 ? ', unchanged.' : ', ' + (S.dDays < 0 ? Math.abs(S.dDays) + ' days faster.' : S.dDays + ' days slower.')) });
    if (S.n30 != null && S.n30prev != null) tiles.push({ t: plural(S.n30, 'settlement') + ' in the last 30 days against ' + S.n30prev + ' the month before.' });
    if (ds.clearance && ds.clearance.available) tiles.push({ t: 'Auction clearance: Ray White CR Group ' + ds.clearance.rw + '%, North Shore ' + ds.clearance.shore + '%, four week average to ' + dmy(ds.clearance.as_at) + '.' });
    if (S.topSale) tiles.push({ t: 'Top settled result: ' + S.topSale.address + ', ' + S.topSale.suburb + ', ' + $full(S.topSale.price) + '.' });
    push(mkText(R.body, tiles));
    }

    // SOLD THIS WEEK ACROSS THE GROUP: office feed, addresses and method, never prices.
    if (ds.office && ds.office.available && ds.office.week.length) {
      // The window is read from the feed file, never assumed: a thin week can be widened to 14
      // days (first edition, 5 Nov 2026) and the heading must say so.
      const od = ds.office.days || 7;
      if (V.scoreboard && R.grid) {
        // Visual edition: live photo grid of the group's latest sold results, newest first.
        push(mkBand(R.band, 'JUST SOLD ACROSS THE GROUP', 'Ray White CR Group results, newest first. Settled figures follow in later editions.'));
        push(mkSoldGrid(R.grid, Math.min(6, Math.max(2, ds.office.week.length - (ds.office.week.length % 2)))));
        push(mkText(R.body, [{ t: 'Want the sale price on any of these once it settles? Reply with the address.' }]));
      } else {
      push(mkBand(R.band, od > 7 ? 'SOLD RECENTLY ACROSS THE GROUP' : 'SOLD THIS WEEK ACROSS THE GROUP',
        'Ray White CR Group results from the last ' + (od === 7 ? 'seven days' : od === 14 ? 'fortnight' : od + ' days') + '. Settled figures follow in later editions.'));
      const lines = ds.office.week.map(x => ({ t: x.address + ', ' + x.suburb + (x.method ? ', ' + x.method : '') + (x.mine ? '. My sale.' : '.') }));
      lines.push({ t: 'Want the sale price on any of these once it settles? Reply with the address.' });
      push(mkText(R.body, lines));
      }
    }

    // YOUR SUBURB: five area blocks. Every suburb appears once.
    push(mkBand(R.band, 'YOUR SUBURB, LAST 90 DAYS', 'Find your area. Every Shore suburb, medians need five or more sales.'));
    ds.areas.forEach((a, i) => {
      // Visual edition: the area's suburb bar tile carries the name, the medians, the counts and
      // the days; only the two "Just settled" homes stay as text so image blocked readers and
      // search still get real addresses.
      const tile = V['area_' + a.key];
      if (tile) push(mkImg(R.hero, tile));
      const lines = tile ? [] : [{ t: a.name.toUpperCase(), bold: true }, { t: areaRead(a) }];
      if (!tile) a.rows.forEach(r => lines.push({ t: suburbLine(r) }));
      // WHAT IS SELLING AROUND YOU (Harrison, 3 Nov 2026): the three most recent settled sales in
      // the area, with price and beds, so a reader sees actual homes, not only a board. From
      // rows[].recent (REINZ settled, newest first). Capped at 3 per area to stay snappy.
      const rec = a.rows.flatMap(r => (r.recent || []).map(x => Object.assign({ suburb: r.suburb }, x)))
        .filter(x => Number.isFinite(x.price)).sort((x, y) => String(y.date).localeCompare(String(x.date))).slice(0, 2);
      if (rec.length) {
        lines.push({ t: 'Just settled', bold: true });
        rec.forEach(x => lines.push({ t: x.address + ', ' + x.suburb + ', ' + $full(x.price) + (x.beds ? ', ' + x.beds + ' bed.' : '.') }));
      }
      if (lines.length) push(mkText(R.body, lines));
      if (i < ds.areas.length - 1) push(clone(R.bar));
    });

    // Visual edition: the street question sits right under the suburb boards, where the reader
    // has just looked for their own suburb. The bottom of the email keeps appraisal + preferences.
    if (V.scoreboard) {
      push(mkText(R.body, [{ t: 'WHAT DID YOUR STREET DO', bold: true }, { t: 'Reply with your street and I will send you every settled sale on it this year, with the numbers behind each one.' }]));
      push(mkBtn(R.btn, 'WHAT DID MY STREET DO', 'mailto:' + ME + '?subject=' + encodeURIComponent('What did my street do')));
    }

    // THE NUMBER THAT MATTERS: one computed trend. Auction share and speed is the default; the
    // editorial may override with a sourced line (ed.insight), gated like everything else.
    push(mkBand(R.band, 'THE NUMBER THAT MATTERS', 'One trend from the data, no opinion attached.'));
    const ins = [];
    if (ed.insight && ed.insight.length) ed.insight.forEach(t => ins.push({ t }));
    else if (V.method) vimg('method');
    else if (S.now.auctionShare != null && S.now.daysAuction != null && S.now.daysNeg != null) {
      ins.push({ t: S.now.auctionShare + '% of settled Shore sales in the last 90 days went under the hammer.', bold: true });
      const gap = S.now.daysNeg - S.now.daysAuction;
      ins.push({ t: 'Auction sales took a median ' + S.now.daysAuction + ' days, negotiated sales ' + S.now.daysNeg + '. ' + (gap > 0 ? 'That is ' + gap + ' days quicker by auction.' : gap < 0 ? 'That is ' + Math.abs(gap) + ' days quicker by negotiation.' : 'No difference in speed this quarter.') });
    }
    if (ins.length) push(mkText(R.body, ins));

    // USEFUL THIS WEEK (Harrison, 3 Nov 2026: "general information that they would find really
    // useful"). Human sourced in editorial.json `useful`, gated like everything else: src, dated,
    // status_until. Skipped entirely when empty rather than padded.
    if (ed.useful && ed.useful.length) {
      push(mkBand(R.band, 'USEFUL THIS WEEK', 'Dates and rules that touch your home, checked on the source page.'));
      push(mkText(R.body, ed.useful.map(u => ({ t: u.text, bold: !!u.bold }))));
    }

    // ON THE MARKET NOW (Harrison, 3 Nov 2026: "display listings at the bottom"). A LIVE feed grid
    // cloned from the Buyers email: CR Group current listings, behavioural sort so each reader sees
    // the six closest to their own preferences, newest first. `query` is a TOP LEVEL panel field
    // and must travel with the clone. detailsLayout stays amenities/price/address: NEVER
    // `dynamic-link` ("View Digital Brochure", Harrison's hard rule 21 Oct). The enquire button
    // goes to Harrison's own /enquire page so the lead lands with him.
    if (R.grid) {
      push(mkBand(R.band, 'ON THE MARKET NOW', 'Six homes for sale across the group, picked for you, newest first.'));
      const grid = clone(R.grid);
      grid.query = Object.assign({}, grid.query, { size: 6 });
      grid.options = Object.assign({}, grid.options, { itemCount: 6, detailsLayout: ['amenities', 'price', 'address'] });
      grid.contents = { propertyListings: [] };
      push(grid);
      push(mkBtn(R.btn, 'ENQUIRE ON A HOME', 'https://harrisoncutfield.co.nz/enquire?src=north-shore-plus'));
    }

    // CTAs: street question first (conversation starter), appraisal second. In the visual
    // edition the street question already sits under the suburb boards.
    if (!V.scoreboard) {
      push(mkText(R.body, [{ t: 'WHAT DID YOUR STREET DO', bold: true }, { t: 'Reply with your street and I will send you every settled sale on it this year, with the numbers behind each one.' }]));
      push(mkBtn(R.btn, 'WHAT DID MY STREET DO', 'mailto:' + ME + '?subject=' + encodeURIComponent('What did my street do')));
    }
    push(mkText(R.body, [{ t: 'WHAT YOUR HOME IS WORTH TODAY', bold: true }, { t: 'If the numbers above have you wondering, I will come and tell you straight. No obligation.' }]));
    push(mkBtn(R.btn, 'BOOK MY FREE APPRAISAL', BOOK));
    push(mkText(R.body, [{ t: 'Moved, bought or sold? Update your preferences so this stays useful.' }]));
    push(mkBtn(R.btn, 'UPDATE MY PROPERTY PREFERENCES', PREFS));

    // THE LOCKED TAIL (found 30 Oct 2026, five controlled PUTs on a disposable clone).
    // ActivePipe refuses a full object PUT that REMOVES the system footer panels the email
    // inherited from its TEMPLATE: 422 "Panel at the position N in the email (<template id>) has
    // moved or been removed which shouldn't have." Replacing the body wholesale is fine, adding
    // id-less panels is fine, dropping panels mid body is fine; the tail (pid 33 social, 16
    // signature, 28 office footer, 30 fine print) must come back WITH ITS OWN IDS. So when the
    // target email is supplied (`opts.target` = fresh GET of the email being written), its system
    // tail is reused by id and only the footer image is ours. Without a target (node review) the
    // Weekly Buyers clones stand in; they carry no ids and would 422 if ever PUT.
    const tpc = opts.target ? ((opts.target.email || {}).panelcontents || []).slice().sort((a, b) => a.position - b.position) : null;
    const sysOf = pid => tpc ? tpc.filter(p => p.id && p.panel_id === pid).slice(-1)[0] : null;
    const tail = [sysOf(33) || clone(R.sys.find(p => p.panel_id === 33)), sysOf(16) || clone(R.sys.find(p => p.panel_id === 16)),
      footP, sysOf(28) || clone(R.sys.find(p => p.panel_id === 28)), sysOf(30) || clone(R.lastPre)].filter(Boolean);
    tail.forEach(p => push(tpc ? J(p) : p));
    out.forEach((p, i) => { p.position = i; });
    return { panels: out, lockedTailIds: tail.filter(p => p.id).map(p => p.id) };
  }

  // Byte estimate against the Gmail clip. Floor, not measurement (text length blind).
  const COST = { base: 14000, text: 900, band: 1100, btn: 2300, bar: 300, img: 2600, sys: 1800 };
  const estimate = panels => panels.reduce((n, p) => n + (p.panel_id === 6 ? ((p.options || {}).backgroundColor ? COST.band : COST.text + ((((p.contents || {}).textOne || {}).blocks || []).length * 90)) : p.panel_id === 3 ? COST.btn : p.panel_id === 2 ? COST.bar : p.panel_id === 9 ? COST.img : p.panel_id === 17 ? 6 * 3200 : COST.sys), COST.base);

  const NSP = { assemble, estimate, refs, suburbLine, areaRead, blk, nodash, $m, $full, BOOK, ME };
  if (typeof window !== 'undefined') window.NSP = NSP;
  if (typeof module !== 'undefined' && module.exports) module.exports = NSP;
})();
