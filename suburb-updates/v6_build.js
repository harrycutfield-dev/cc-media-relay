// v6_build.js — TEMPLATE v6 builder (locked 4 Sep 2026).
// Eval INSIDE a live.activepipe.com tab. Requires session cookies.
// Exposes: V6.introFor, V6.winPhrase, V6.LOCAL, V6.parts, V6.assemble, V6.estimate
//
// CONTRACT (why this file exists): every value the builder computes must end up in the shipped
// email, and v6_check.js asserts exactly that. If you add a computed value here, add its
// assertion there in the same sitting. See failure shape 11 in SKILL.md.
(function () {
  const API = 'https://api.activepipe.com';
  const AGID = '87959016-136a-469e-8f59-6cf12307bd75';   // Harrison in listingagent extendeddata
  const APPRAISAL = 'https://harrisoncutfield.co.nz/book.html';
  const SENTINEL = 'activepipe-view-online';
  const PREFS = 'activepipe-property-preferences';
  const MASTER = 3909145;                                 // v6 master, never send/delete
  const fold = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const J = o => JSON.parse(JSON.stringify(o));
  const normImgs = r => { (r.images || []).forEach(im => { if (!im.src) im.src = im.cdn_url || im.url; }); return r; };
  const rk = () => Math.random().toString(36).slice(2, 10);
  const clone = p => { const c = J(p); delete c.id; delete c.email_id; return c; };
  const blk = (t, o) => {
    o = o || {}; const r = [];
    if (t) {
      r.push({ offset: 0, length: t.length, style: '#000000' });
      if (o.bold) r.push({ offset: 0, length: t.length, style: 'BOLD' });
      if (o.italic) r.push({ offset: 0, length: t.length, style: 'ITALIC' });
    }
    return { key: rk(), text: t || '', type: o.h ? 'header-three' : 'unstyled', depth: 0,
      inlineStyleRanges: r, entityRanges: o.er || [], data: {} };
  };

  // ---- window phrasing: never "this recent weeks" ----
  const winPhrase = label => { const w = (label || '').replace('past ', ''); return w === 'recent weeks' ? 'over recent weeks' : 'this ' + w; };

  // ---- INTRO: season -> activity + THIS suburb's own standout -> reframe media -> transition.
  // Variant-guarded: never claims a pace the sold data does not show. NEVER mentions the economy.
  function introFor(sub, bd) {
    const fast = bd.lines.some(l => /, 1 day\)/.test(l));
    const quick = bd.lines.filter(l => { const m = l.match(/(\d+) days?\)/); return m && +m[1] <= 30; }).length;
    const top = Math.max(...bd.lines.map(l => { const m = l.match(/\$([\d,]+)/); return m ? +m[1].replace(/,/g, '') : 0; }), 0);
    const fmt = n => '$' + n.toLocaleString('en-NZ');
    const m = new Date().getMonth();
    const season = (m >= 8 && m <= 10) ? 'Spring has arrived and you can feel it in the market.'
      : (m === 11 || m <= 1) ? 'The summer stretch is here and the market has real energy about it.'
      : (m >= 2 && m <= 4) ? 'Autumn is settling in and the market is holding its momentum.'
      : 'Winter has not slowed things down the way people expect.';
    let perf;
    if (fast) perf = 'the homes that are presented and priced well are performing extremely well, with one selling in a single day this week';
    else if (quick >= 2) perf = 'the homes that are presented and priced well are performing extremely well, several going under contract inside a month';
    else if (quick === 1) perf = 'the homes that are presented and priced well are performing extremely well, one of them under contract inside a month';
    else if (top > 0) perf = 'the homes that are presented and priced well are performing extremely well, with the top sale here reaching ' + fmt(top);
    else perf = 'the homes that are presented and priced well are still finding their buyer';
    return [
      'I hope you have had a good week. ' + season + ' Open homes are busier, more buyers are coming through the door, and ' + perf + '.',
      '',
      'You may see the odd gloomy headline about property at the moment. What we are seeing on the ground tells a different story, and our own results below back that up.',
      '',
      'Here is what that looked like in ' + sub + ' this week.'];
  }

  // ---- LOCAL COMMUNITY CONTENT ----
  // REBUILD THIS EVERY RUN from: OurAuckland local board feeds, aucklandcouncil.govt.nz board
  // pages, Eventfinda suburb venue pages, local board Facebook. Dated + verifiable only.
  // Rule: suburb-named items first, then that suburb's OWN board. Never another board's news,
  // never Auckland-wide filler. Items below were verified 4 Sep 2026 — re-verify before reuse.
  const HB = {
    grants: { t: '$450,000 in local grants is open for community groups', b: 'The Hibiscus and Bays Local Board is backing local events, sports clubs and volunteer programmes as part of $40 million allocated across the area this year.' },
    centre: { t: 'The East Coast Bays Community Centre in Browns Bay gets a $7.7 million rebuild', b: 'The hub our community groups rely on is being strengthened, modernised and made fully accessible.' },
    park: { t: 'Awaruaika Youth Park is coming to Long Bay', b: 'A $1.8 million project bringing a permanent pump track, and a new weekend destination for local families.' },
    market: { t: 'The Long Bay Village Market returns Sunday 27 September', b: 'From 9am to 2pm in the village piazza: local makers, artisan food and live music. Free entry and family friendly.' },
    freyberg: { t: 'Freyberg Park in Browns Bay is being upgraded', b: 'Part of the board’s parks programme this year, alongside the Victor Eaves Park cricket ground and the Stanmore Bay skatepark.' },
    mairangi: { t: 'The Mairangi Bay Reserves Management Plan has been adopted', b: 'It sets the guide for how the Mairangi Bay beach reserves are managed and protected in the years ahead.' },
    sanctuary: { t: 'The Campbells Bay Urban Sanctuary keeps growing', b: 'Volunteers from the Centennial Park Bush Society are restoring native bush and birdlife right in the heart of the suburb.' } };
  const DT = {
    skate: { t: 'Ngātaringa Skate Park is moving to Woodall Park', b: 'The Devonport-Takapuna Local Board has committed $945,000 to the relocation, with physical work under way this year.' },
    plan: { t: 'The Devonport-Takapuna Local Board Plan for 2026 has been through community consultation', b: 'It sets the board’s priorities for parks, town centres and community facilities across Takapuna, Milford, Devonport and the surrounding suburbs.' },
    parks: { t: 'Local parks and community facilities are the board’s focus this year', b: 'Investment continues across the Devonport-Takapuna area in playgrounds, sports fields and town centre improvements.' } };
  const KP = {
    grants: { t: '$323,398 has gone to Kaipātiki community groups', b: 'The board’s latest funding round backs local arts, sport and wellbeing projects across Glenfield, Birkdale, Beach Haven, Northcote and Hillcrest.' },
    rugby: { t: '$62,004 for new changing rooms at Northcote Birkenhead Rugby Club', b: 'New changing rooms, showers and toilets for women and girls, part of the board’s focus on improving local facilities.' },
    glenfield: { t: 'A 30 year plan is being written for the Glenfield town centre', b: 'The board is shaping how the centre grows as a place to visit, work and live over the coming decades.' },
    northcote: { t: 'The Unlock Northcote regeneration is reshaping the town centre', b: 'A social, vibrant and connected new centre is taking shape for Northcote and the surrounding suburbs.' },
    houses: { t: 'Birkdale and Beach Haven Community Houses are running local classes and groups', b: 'Board funded programmes, tutors and venue costs keep these close to home community spaces going.' } };
  const UH = {
    invest: { t: '$32.7 million is being invested across Upper Harbour this year', b: '$23.6 million for local services and programmes, plus $9.1 million for parks, sports fields, community spaces and pathways.' },
    library: { t: 'A bigger Albany Village Library is being planned', b: 'One of Auckland’s busiest libraries, with the board progressing planning and funding options for a larger facility.' },
    scouts: { t: '$67,465 for a new boatshed for the Tauhinu Sea Scouts in Greenhithe', b: 'A local facilities grant helping one of the area’s long standing community groups.' } };
  const LOCAL = {
    'Torbay': [HB.market, HB.park, HB.grants], 'Long Bay': [HB.market, HB.park, HB.grants],
    'Waiake': [HB.market, HB.park, HB.grants], 'Browns Bay': [HB.centre, HB.freyberg, HB.grants],
    'Rothesay Bay': [HB.centre, HB.freyberg, HB.grants], 'Murrays Bay': [HB.mairangi, HB.centre, HB.grants],
    'Mairangi Bay': [HB.mairangi, HB.centre, HB.grants], 'Campbells Bay': [HB.sanctuary, HB.centre, HB.grants],
    'Castor Bay': [HB.sanctuary, DT.plan, DT.parks], 'Northcross': [HB.centre, HB.park, HB.grants],
    'Windsor Park': [HB.centre, HB.park, HB.grants],
    'Takapuna': [DT.plan, DT.skate, DT.parks], 'Milford': [DT.plan, DT.skate, DT.parks],
    'Devonport': [DT.skate, DT.plan, DT.parks], 'Belmont': [DT.skate, DT.plan, DT.parks],
    'Bayswater': [DT.skate, DT.plan, DT.parks], 'Hauraki': [DT.plan, DT.skate, DT.parks],
    'Forrest Hill': [DT.plan, DT.parks, DT.skate], 'Sunnynook': [DT.plan, DT.parks, DT.skate],
    'Glenfield': [KP.glenfield, KP.grants, KP.houses], 'Birkdale': [KP.houses, KP.grants, KP.rugby],
    'Beach Haven': [KP.houses, KP.grants, KP.rugby], 'Bayview': [KP.grants, KP.glenfield, KP.houses],
    'Chatswood': [KP.rugby, KP.grants, KP.northcote], 'Northcote': [KP.northcote, KP.rugby, KP.grants],
    'Hillcrest': [KP.grants, KP.glenfield, KP.rugby], 'Tōtara Vale': [KP.glenfield, KP.grants, KP.houses],
    'Albany Heights': [UH.library, UH.invest, UH.scouts], 'Oteha': [UH.library, UH.invest, UH.scouts],
    'Rosedale': [UH.library, UH.invest, UH.scouts], 'Greenhithe': [UH.scouts, UH.invest, UH.library],
    'Hobsonville': [UH.invest, UH.library, UH.scouts], 'Pāremoremo': [UH.invest, UH.library, UH.scouts],
    'Dairy Flat': [UH.library, UH.invest, UH.scouts] };

  // ---- raw-byte cost model for clip-aware placement (see failure shape 8) ----
  const COST = { tile: 9000, feature: 17000, text: 1500, heading: 1200, button: 2000, divider: 300, banner: 2000, stat: 1500 };
  const TARGET = 92000;               // break-out button must land at or before this (raw bytes)
  function estimate(panels) {
    let n = 0;
    panels.forEach(p => {
      if (p.panel_id === 17 || p.panel_id === 19) {
        const c = ((p.contents || {}).propertyListings || []).length;
        n += p.panel_id === 19 ? COST.feature : c * COST.tile;
      } else if (p.panel_id === 3) n += COST.button;
      else if (p.panel_id === 5) n += COST.heading;
      else if (p.panel_id === 6) n += COST.text + (((p.contents.textOne || {}).blocks || []).length * 90);
      else if (p.panel_id === 9) n += COST.banner;
      else if (p.panel_id === 8) n += COST.stat;
      else if (p.panel_id === 2) n += COST.divider;
      else n += 400;
    });
    return n + 9650;                  // MIME header before the HTML part
  }

  // ---- THE FIXED CTA PAIR (locked copy) ----
  const REPLY_BLOCKS = () => [
    blk('WHERE ARE YOU AT WITH YOUR PLACE?', { h: true, bold: true }),
    blk('Not "are you selling", just where your head is at.'), blk(''),
    blk('Hit reply and update me on your current property journey and what your next move looks like. Would you be downsizing, upsizing, investing, holding, or is it genuinely nothing right now?'), blk(''),
    blk('There is no wrong answer and it does not commit you to a thing. It comes straight to me, and I answer every one myself.'), blk(''),
    blk('If replying is not your thing, you can tell me the same in about twenty seconds with the button below.')];
  const PREFS_BLOCKS = () => [
    blk('OR JUST TELL ME WITH ONE CLICK', { h: true, bold: true }),
    blk('Moved home, bought, sold, or simply changed what you are watching for? Update your preferences and I will send you the right suburb, the right price range and the right updates.'), blk(''),
    blk('About twenty seconds, and it means these emails stay useful instead of arriving about a street you no longer live on.')];

  window.V6 = { API, AGID, APPRAISAL, SENTINEL, PREFS, MASTER, fold, J, normImgs, clone, blk,
    winPhrase, introFor, LOCAL, COST, TARGET, estimate, REPLY_BLOCKS, PREFS_BLOCKS };
})();
