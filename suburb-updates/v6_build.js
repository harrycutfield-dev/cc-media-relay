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
  // REINZ location resolution — see failure shape 12. Suburb type AND ", Auckland" AND prefix;
  // bare single candidates (Dairy Flat) accepted only when they are the ONLY suburb match.
  function pickReinzLocation(candidates, query) {
    const cands = (candidates || []).filter(l => l.location_type === 'suburb');
    const q = fold(query.normalize('NFD').replace(/[̀-ͯ]/g, ''));
    const akl = cands.filter(l => /,\s*Auckland/i.test(l.label) && fold(l.label).startsWith(q));
    return akl[0] || (cands.length === 1 ? cands[0] : null);   // null => FAIL, never guess
  }

  const winPhrase = label => { const w = (label || '').replace('past ', ''); return w === 'recent weeks' ? 'over recent weeks' : 'this ' + w; };

  // ---- VARIATION ENGINE (12 Sep 2026) ----
  // EVERY reader-visible generated block rotates a phrasing bank and is asserted against last
  // week's stored value. Measured before this existed: 21 of 34 intros byte-identical to the
  // prior week, 10 of 34 preheaders, and the media paragraph + transition were CONSTANT for all
  // 34 suburbs every single week. A deterministic generator over slow-moving inputs always
  // converges on repetition. `prev` is last week's actual string for THIS suburb and block.
  function pick(bank, opts) {
    opts = opts || {};
    const seed = (opts.week || 0) + String(opts.seed || '').length;
    const start = ((seed % bank.length) + bank.length) % bank.length;
    for (let k = 0; k < bank.length; k++) {
      const c = bank[(start + k) % bank.length];
      if (c !== opts.prev) return c;
    }
    return bank[start];
  }
  const PREVOF = (sub, key) => (((window.__VARY || {}).prev || {})[sub] || {})[key];
  const VOPTS = (sub, key) => ({ week: (window.__VARY || {}).week, seed: sub, prev: PREVOF(sub, key) });

  // Preheader: was a pure function of count + window, so it repeated whenever the market was
  // quiet. Same facts, four phrasings.
  function preheaderFor(sub, bd) {
    const c = bd.lines.length, wp = winPhrase(bd.label), h = c + ' home' + (c === 1 ? '' : 's');
    return pick([
      h + ' sold in ' + sub + ' ' + wp + ', plus what the latest numbers mean for your value.',
      'The ' + sub + ' results ' + wp + ', and what they mean for your value.',
      h + ' sold in ' + sub + ' ' + wp + '. Here is what that says about your place.',
      'What sold in ' + sub + ' ' + wp + ', and what it means for your home.'],
      VOPTS(sub, 'pre'));
  }

  // The 30 second block: same two facts, rotated phrasing. v6_check calls THIS function rather
  // than matching a hard-coded string.
  function thirtyLines(sub, bd) {
    const c = bd.lines.length, wp = winPhrase(bd.label), d = bd.days;
    const h = c + ' home' + (c === 1 ? '' : 's');
    const l1 = pick([
      'Sold ' + wp + ': ' + h + '.',
      h + ' sold ' + wp + '.',
      'Homes sold ' + wp + ': ' + c + '.',
      'Sales ' + wp + ': ' + h + '.'], VOPTS(sub, 't1'));
    const l2 = pick([
      'Median time to sell in ' + sub + ': ' + d + ' days.',
      sub + ' is taking a median of ' + d + ' days to sell.',
      'Median days to sell in ' + sub + ': ' + d + '.',
      'Homes in ' + sub + ' are selling in a median of ' + d + ' days.'], VOPTS(sub, 't2'));
    return [l1, l2];
  }

  // ---- ECONOMY: region-wide, so it rotates by WEEK ONLY (all 34 read the same thing in a
  // given week, which is correct for an office-wide figure). It was identical to the prior week
  // because the OCR had not moved since 2 September; the facts are the same, the wording is not.
  // *** WHEN THE OCR OR ANY FIGURE CHANGES, REWRITE THIS BANK WITH THE NEW FACTS. ***
  // Every variant must state the SAME verified numbers. Never let a variant drift from the data.
  const ECON_FACTS = { ocr: '2.75%', date: '2 September', bp: '25 basis point' };
  const ECON_BANK = [
    ['The Reserve Bank lifted the OCR to 2.75% on 2 September.',
     'A 25 basis point rise, with a hold signalled for October. Rates are moving because the economy is growing, and well priced homes are still meeting confident buyers.'],
    ['The OCR moved to 2.75% at the Reserve Bank review on 2 September.',
     'That is a 25 basis point lift, and the Reserve Bank has signalled a hold in October. Rates move when the economy is growing, and well presented homes keep finding confident buyers.'],
    ['On 2 September the Reserve Bank took the OCR to 2.75%.',
     'A 25 basis point increase, with October signalled as a hold. Rate movement of this kind reflects a growing economy, and buyers at our open homes are still committing.'],
    ['The Reserve Bank set the OCR at 2.75% on 2 September.',
     'Up 25 basis points, and a hold is signalled for October. That shift reflects an economy that is growing, and well priced homes are still meeting confident buyers.']];
  function econLines() {
    const v = window.__VARY || {};
    const prev = v.prevEcon;
    const start = (((v.week || 0) % ECON_BANK.length) + ECON_BANK.length) % ECON_BANK.length;
    for (let k = 0; k < ECON_BANK.length; k++) {
      const c = ECON_BANK[(start + k) % ECON_BANK.length];
      if (!prev || c[0] !== prev) return [{ t: c[0] }, { t: c[1], i: true }];
    }
    const c = ECON_BANK[start]; return [{ t: c[0] }, { t: c[1], i: true }];
  }

  // ---- INTRO: season -> activity + THIS suburb's own standout -> reframe media -> transition.
  // Variant-guarded: never claims a pace the sold data does not show. NEVER mentions the economy.
  // Every component now rotates; the perf clause stays data-driven and factual.
  function introFor(sub, bd) {
    const fast = bd.lines.some(l => /, 1 day\)/.test(l));
    const quick = bd.lines.filter(l => { const m = l.match(/(\d+) days?\)/); return m && +m[1] <= 30; }).length;
    const top = Math.max(...bd.lines.map(l => { const m = l.match(/\$([\d,]+)/); return m ? +m[1].replace(/,/g, '') : 0; }), 0);
    const fmt = n => '$' + n.toLocaleString('en-NZ');
    const m = new Date().getMonth();
    const SEASONS = (m >= 8 && m <= 10) ? [
      'Spring has arrived and you can feel it in the market.',
      'Spring is well underway and the market has lifted with it.',
      'The spring market is in full swing now.',
      'Spring stock is coming through and buyers have followed it.']
      : (m === 11 || m <= 1) ? [
      'The summer stretch is here and the market has real energy about it.',
      'Summer is here and the market has not eased off.',
      'The market carries real momentum through summer.',
      'Summer buying is brisk this year.']
      : (m >= 2 && m <= 4) ? [
      'Autumn is settling in and the market is holding its momentum.',
      'Autumn has arrived and the market is still moving well.',
      'The autumn market is holding its pace.',
      'Autumn has not taken the heat out of things.']
      : [
      'Winter has not slowed things down the way people expect.',
      'The winter market is busier than most people assume.',
      'Winter is quieter on paper, not at our open homes.',
      'Winter has held up better than the usual story suggests.'];
    const season = pick(SEASONS, VOPTS(sub, 'season'));
    const bridge = pick([
      'Open homes are busier, more buyers are coming through the door, and ',
      'Buyer numbers through open homes are up, and ',
      'There is more competition at open homes, and ',
      'Open home attendance keeps building, and '], VOPTS(sub, 'bridge'));
    // SUBURB-SPECIFIC, POSITIVE, AND NON-CONTRADICTORY (Harrison, 12 Sep 2026).
    // The old clause asserted "performing extremely well" no matter what the data said, which
    // contradicted the suburb's own figures printed directly below it — Dairy Flat's median is
    // 130 days. Every claim here is now drawn from THIS suburb's own sold lines, and the pace
    // sentence is chosen to AGREE with that suburb's median rather than fight it.
    // Positive framing means finding the true positive angle, never overstating a quiet week.
    const cnt0 = bd.lines.length, wpL = winPhrase(bd.label);
    const rows = bd.lines.map(l => {
      const addr = (l.split(/\s{2,}/)[0] || '').trim();
      const pm = l.match(/\$([\d,]+)/), dm = l.match(/(\d+) days?\)/);
      return { addr: addr, price: pm ? +pm[1].replace(/,/g, '') : 0, days: dm ? +dm[1] : null };
    }).filter(r => r.addr);
    const byDays = rows.filter(r => r.days !== null).sort((a, b) => a.days - b.days);
    const byPrice = rows.slice().sort((a, b) => b.price - a.price);
    const quickest = byDays[0], dearest = byPrice[0];
    const dayWord = n => n === 1 ? 'a single day' : n + ' days';
    let lead;
    if (quickest && quickest.days <= 7)
      lead = quickest.addr + ' sold in ' + dayWord(quickest.days) + ', which is the clearest sign of what a well presented home can do in ' + sub + ' right now';
    else if (cnt0 > 1 && dearest && dearest.price > 0)
      lead = cnt0 + ' homes sold in ' + sub + ' ' + wpL + ', led by ' + dearest.addr + ' at ' + fmt(dearest.price);
    else if (cnt0 === 1 && dearest && dearest.price > 0)
      lead = dearest.addr + ' sold for ' + fmt(dearest.price) + (dearest.days !== null ? ' after ' + dayWord(dearest.days) + ' on the market' : '');
    else
      lead = sub + ' was quiet on settled sales ' + wpL + ', and the homes on the market here are getting steady buyer attention';
    // The pace sentence must AGREE with the median, never contradict it.
    const md = bd.days;
    const pace = !cnt0 ? ''
      : md <= 35 ? ' Homes here are selling in a median of ' + md + ' days, which is quick by any measure.'
      : md <= 60 ? ' The median time to sell in ' + sub + ' is ' + md + ' days, so well presented homes are moving at a healthy pace.'
      : ' The median here sits at ' + md + ' days, which rewards the sellers who come to market properly presented and priced.';
    const greet = pick([
      'I hope you have had a good week. ',
      'I hope your week has gone well. ',
      'Hope you have had a good week. ',
      'I hope the week has treated you well. '], VOPTS(sub, 'greet'));
    const media = pick([
      'You may see the odd gloomy headline about property at the moment. What we are seeing on the ground tells a different story, and our own results below back that up.',
      'The headlines about property can be gloomy. What is actually happening at our open homes and auctions looks quite different, and the results below show it.',
      'Property headlines and property reality are two different things right now. The results below are what we are actually seeing week to week.',
      'Set the doom in the property headlines aside for a moment. The numbers we are getting on the ground, set out below, tell their own story.'],
      VOPTS(sub, 'media'));
    const transition = pick([
      'Here is what that looked like in ' + sub + ' this week.',
      'Here is how that played out in ' + sub + '.',
      'This is what it looked like in ' + sub + '.',
      'Here are the ' + sub + ' numbers behind that.'], VOPTS(sub, 'transition'));
    // The bridge claims busier open homes, so it is dropped on a zero-sale week where it would
    // sit oddly against "quiet on settled sales".
    const opener = greet + season + ' ' + (cnt0 ? bridge : '') + lead + '.' + pace;
    return [opener, '', media, '', transition];
  }

  // ---- SUBJECT ----
  // Generated per suburb. Lived here unasserted until 11 Sep 2026: v6_check had no subject
  // group at all, so a wrong subject would have shipped silently. Pulled out so the checker
  // can call the SAME function rather than re-deriving the rule (see failure shape 11).
  // A PHRASING BANK, not a pure function of sale count (failure shape 16, 12 Sep 2026).
  // The old one-line formula made the subject a pure function of the sale count, so a suburb with
  // the same count two weeks running got a BYTE-IDENTICAL subject: 14 of 34 repeated on 12 Sep.
  // It also read "One X sale and what THEY MEAN for you" — plural verb on a singular sale.
  // opts.prev = the subject actually sent last week. The bank rotates by week and then walks
  // forward until it finds one that is not last week's, so a repeat is structurally impossible.
  function subjectFor(sub, bd, opts) {
    opts = opts || {};
    const cnt = bd.lines.length;
    const fast = bd.lines.some(l => /, 1 day\)/.test(l));
    const word = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'][cnt] || String(cnt);
    const wp = winPhrase(bd.label);          // never "this recent weeks"
    const days = bd.days;
    // TONE (Harrison, 12 Sep 2026): "entice the client to open and read the email without being
    // too salesy." So: concrete and specific, a real curiosity gap, personal relevance. NEVER
    // hype words, urgency, exclamation marks, ALL CAPS, or a pitch. The subject states what is
    // inside; it does not sell it. Always print the suburb->subject list for Harrison to review.
    let bank;
    if (fast) bank = [
      'A ' + sub + ' home sold in a single day',
      'One day on the market in ' + sub,
      'Sold in one day in ' + sub + '. Here is what that took',
      'What a one day sale says about ' + sub + ' right now'];
    else if (cnt === 0) bank = [                               // zero-sale week: was a latent bug
      'What is on the market in ' + sub + ' right now',        // (empty word -> leading space)
      'Your ' + sub + ' market update',
      'The ' + sub + ' update ' + wp,
      sub + ': what buyers are looking at right now'];
    else if (cnt === 1) bank = [
      'One ' + sub + ' sale ' + wp + ', and what it sold for',
      'One ' + sub + ' sale, and a median of ' + days + ' days',
      'What the latest ' + sub + ' sale tells us',
      'The ' + sub + ' result ' + wp];
    else bank = [
      word + ' homes sold in ' + sub + ' ' + wp,
      'What ' + word.toLowerCase() + ' ' + sub + ' sales say about your street',
      'The ' + sub + ' numbers ' + wp,
      word + ' ' + sub + ' sales, and a median of ' + days + ' days'];
    const start = ((opts.week || 0) + sub.length) % bank.length;
    for (let k = 0; k < bank.length; k++) {
      const c = bank[(start + k) % bank.length];
      if (c !== opts.prev) return c;
    }
    return bank[start];
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
  // ---- SUBURB-OWN ITEMS (sourced and verified 11 Sep 2026) ----
  // Every suburb LEADS with an item that names IT. Board items only ever fill slots 2 and 3,
  // and only ever that suburb's OWN board. Never another board's news (Castor Bay led with a
  // Campbells Bay item until 11 Sep — wrong suburb AND wrong board).
  // DATED marks suburbs whose lead item is current news; only those say "THIS MONTH".
  // Small suburbs do not generate monthly news — do not promise a cadence the sources cannot
  // sustain, and NEVER invent an item to fill the slot. See failure shape 13 in SKILL.md.
  const SUB = {
    belmont: { t: 'Auckland Transport has put its Lake Road upgrade at the Belmont shops out for feedback', b: 'The plan adds a weekday morning clearway, longer merge lanes and rebuilt pedestrian crossings at the Belmont shops intersection. Consultation ran from 25 May to 21 June and the feedback report now goes to the local board before a final decision.' },
    sunnynookScouts: { t: 'The Sunnynook Scout Group has been granted a new long term lease', b: 'The group has been part of Sunnynook since 1979, and the new lease gives it long term certainty in the hall.' },
    sunnynookPark: { t: 'Sunnynook Park is back in full use after three years of work', b: 'Healthy Waters increased floodwater storage across the park, which also fixed the drainage problems at the Sunnynook Community Centre and along Tonkin Drive.' },
    sunnynookCivic: { t: 'A new civic space beside the Sunnynook Community Centre is in detailed design', b: 'It is part of the longer term plan for how the Sunnynook centre grows.' },
    hobsonville: { t: 'The Upper Waitematā Marine Centre is finished and the Hobsonville Yacht Club has a permanent home again', b: 'The new base gives the club and local sailors a proper facility on the harbour.' },
    albanyHeights: { t: 'Lucas Creek Falls sits right on the Albany Heights doorstep', b: 'The Lucas Creek Scenic Reserve is a pocket of coastal broadleaf forest, taraire and puriri with nikau palms, and the tracks through it lead down to the waterfall.' },
    bayswater: { t: 'Bayswater Marina and the twelve minute ferry are the suburb’s front door', b: 'The marina runs 419 berths and the ferry reaches the city in about twelve minutes, which is a large part of why buyers look here.' },
    bayview: { t: 'Pest Free Kaipātiki volunteers are working right through the Bayview reserves', b: 'Glendhu Scenic, Bonito, Spinella, Lynn, Leigh and Mānuka reserves together make one of the best urban wildlife corridors on the North Shore.' },
    castorBay: { t: 'Castor Bay Beach Reserve is the quiet end of the Milford coastal walk', b: 'The reserve has a playground, picnic tables and seating, reached from the beach end of The Esplanade or the walkway between 75 and 77a Beach Road.' },
    chatswood: { t: 'The Chatswood Reserve tracks have been upgraded', b: 'New bridges, boardwalks and box steps went in to help stop kauri dieback, and the Kauri Point Domain path from the end of Balmain Road still runs down to Fitzpatrick Bay.' },
    dairyFlat: { t: 'Dairy Flat School is planning new learning spaces', b: 'The school takes Years 1 to 6, and the community hall next door remains the meeting point for the district.' },
    forrestHill: { t: 'Forrest Hill School has been at the centre of the suburb since 1959', b: 'Around 450 children from Years 1 to 6 go through it, and it anchors the streets around it.' },
    hauraki: { t: 'Hauraki School has served the suburb since 1954', b: 'About 500 children from a wide range of backgrounds attend the school at 82 Jutland Road.' },
    murraysBay: { t: 'Murrays Bay Sailing Club still teaches local kids to sail off the beach', b: 'The club runs learn to sail courses for children straight off the reserve, and Murrays Bay School and Intermediate sit just up the hill.' },
    northcross: { t: 'Northcross Intermediate is one of the largest intermediates in the country', b: 'Close to 1,500 students attend, and the school is again offering Year 7 students a place in its sports class.' },
    oteha: { t: 'Hooton Reserve and the Oteha Valley Reserve follow the stream through the suburb', b: 'Hooton Reserve at 259 Oteha Valley Road has fitness stations along the path, and the Oteha Valley Reserve bridge opens up the bush walk along the water.' },
    paremoremo: { t: 'Sanders Reserve in Pāremoremo is one of the biggest outdoor spaces on this side of the harbour', b: 'Sixteen and a half hectares above the Waitematā with 22km of mountain bike trails, a 500m loop for under tens, and separate horse riding and dog walking areas.' },
    rosedale: { t: 'Rosedale Park is the largest open space on the North Shore', b: 'At 2 Jack Hinton Drive it holds artificial turf fields, a playground, fitness equipment and a free nine hole disc golf course, and it is home to North Harbour Softball and North Harbour Hockey.' },
    rothesayBay: { t: 'Rothesay Bay Beach Reserve is the heart of the suburb', b: 'A small open reserve at the bottom of Rothesay Bay Road with a playground, picnic spots and straight through access to the beach.' },
    torbay: { t: 'Torbay Sailing Club hosted Oceanbridge Sail Auckland again this year', b: 'The regatta brings the national fleet onto the water off Torbay, and the village behind it stays the centre of the suburb.' },
    totaraVale: { t: 'Target Road School has been part of Tōtara Vale since 1967', b: 'The school takes Years 1 to 6, and the Rewi Alley and Tōtaravale reserves give the suburb its green edge.' },
    waiake: { t: 'Waiake Beach Reserve looks straight out over the bay', b: 'Large open lawn, toilets, picnic tables, barbecues, drinking fountains, mobility parking and a boat and dinghy ramp.' },
    windsorPark: { t: 'Windsor Park is home to East Coast Bays cricket and rugby', b: 'Both clubs are based at the park, touch rugby runs there through summer, and Windsor Park Baptist on East Coast Road is the other anchor of the suburb.' } };

  const DATED = new Set(['Belmont', 'Sunnynook', 'Hobsonville', 'Long Bay', 'Browns Bay',
    'Devonport', 'Takapuna', 'Milford', 'Mairangi Bay', 'Campbells Bay', 'Northcote',
    'Glenfield', 'Greenhithe', 'Hillcrest']);
  const communityHeading = sub => 'AROUND ' + sub.toUpperCase() + (DATED.has(sub) ? ' THIS MONTH' : '');

  const LOCAL = {
    'Torbay': [SUB.torbay, HB.market, HB.grants], 'Long Bay': [HB.market, HB.park, HB.grants],
    'Waiake': [SUB.waiake, HB.market, HB.grants], 'Browns Bay': [HB.centre, HB.freyberg, HB.grants],
    'Rothesay Bay': [SUB.rothesayBay, HB.centre, HB.grants], 'Murrays Bay': [SUB.murraysBay, HB.mairangi, HB.grants],
    'Mairangi Bay': [HB.mairangi, HB.centre, HB.grants], 'Campbells Bay': [HB.sanctuary, HB.centre, HB.grants],
    'Castor Bay': [SUB.castorBay, DT.plan, DT.parks], 'Northcross': [SUB.northcross, HB.centre, HB.grants],
    'Windsor Park': [SUB.windsorPark, HB.centre, HB.grants],
    'Takapuna': [DT.plan, DT.skate, DT.parks], 'Milford': [DT.plan, DT.skate, DT.parks],
    'Devonport': [DT.skate, DT.plan, DT.parks], 'Belmont': [SUB.belmont, DT.plan, DT.parks],
    'Bayswater': [SUB.bayswater, DT.skate, DT.plan], 'Hauraki': [SUB.hauraki, DT.plan, DT.parks],
    'Forrest Hill': [SUB.forrestHill, DT.plan, DT.parks],
    'Sunnynook': [SUB.sunnynookScouts, SUB.sunnynookPark, SUB.sunnynookCivic],
    'Glenfield': [KP.glenfield, KP.grants, KP.houses], 'Birkdale': [KP.houses, KP.grants, KP.rugby],
    'Beach Haven': [KP.houses, KP.grants, KP.rugby], 'Bayview': [SUB.bayview, KP.grants, KP.glenfield],
    'Chatswood': [SUB.chatswood, KP.rugby, KP.grants], 'Northcote': [KP.northcote, KP.rugby, KP.grants],
    'Hillcrest': [KP.grants, KP.glenfield, KP.rugby], 'Tōtara Vale': [SUB.totaraVale, KP.glenfield, KP.grants],
    'Albany Heights': [SUB.albanyHeights, UH.library, UH.invest], 'Oteha': [SUB.oteha, UH.library, UH.invest],
    'Rosedale': [SUB.rosedale, UH.invest, UH.library], 'Greenhithe': [UH.scouts, UH.invest, UH.library],
    'Hobsonville': [SUB.hobsonville, UH.invest, UH.library], 'Pāremoremo': [SUB.paremoremo, UH.invest, UH.library],
    'Dairy Flat': [SUB.dairyFlat, UH.library, UH.invest] };

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

  // ---- PARTS: build every panel for one suburb from the master ----
  function parts(master, sub, bd, ctx, joke, auctionLines) {
    const mpc = master.panelcontents;
    const txt = p => (((p.contents || {}).textOne || {}).blocks || []).map(b => b.text);
    const find = pred => mpc.find(pred);
    const brkBtn = find(p => p.panel_id === 3 && (p.options || {}).buttonLink === SENTINEL);
    const brkHead = mpc.slice(0, mpc.indexOf(brkBtn)).reverse().find(p => p.panel_id === 5);
    const appr = mpc.filter(p => p.panel_id === 3 && (p.options || {}).buttonLink === APPRAISAL);
    const M = {
      pre: mpc[0], banner: mpc.find(p => p.panel_id === 9), div: mpc.find(p => p.panel_id === 2),
      stat: mpc.find(p => p.panel_id === 8), appr, brkHead, brkBtn,
      prefBtn: find(p => p.panel_id === 3 && (p.options || {}).buttonLink === PREFS),
      headSub: find(p => p.panel_id === 5 && /PROPERTIES FOR SALE/i.test(txt(p).join(' '))),
      headSold: find(p => p.panel_id === 5 && /JUST SOLD/i.test(txt(p).join(' '))),
      headFeed: find(p => p.panel_id === 5 && /MORE OF MY RECENT/i.test(txt(p).join(' '))),
      feature: mpc.find(p => p.panel_id === 19) || window.__FEATREF,
      gridSub: mpc.find(p => p.panel_id === 17 && !(p.options || {}).feed && ((p.contents || {}).propertyListings || []).some(r => r.status === 'current')),
      gridSold: mpc.find(p => p.panel_id === 17 && !(p.options || {}).feed && ((p.contents || {}).propertyListings || []).length && ((p.contents || {}).propertyListings || []).every(r => r.status === 'sold')),
      gridFeed: mpc.find(p => p.panel_id === 17 && (p.options || {}).feed),
      written: find(p => p.panel_id === 6 && txt(p).some(t => /Hi First Name/.test(t))),
      textPanel: find(p => p.panel_id === 6 && txt(p).some(t => /WHAT YOUR HOME IS WORTH/.test(t))),
      closing: find(p => p.panel_id === 6 && txt(p).some(t => /dad joke/i.test(t))),
      footImg: mpc.filter(p => p.panel_id === 9).slice(-1)[0],
      chrome: mpc.filter(p => [16, 28].includes(p.panel_id)).concat([mpc[mpc.length - 1]]) };
    const live = ctx.current.filter(r => fold(r.city) === fold(sub)).map(r => normImgs(J(r)));
    const cnt = bd.lines.length, wp = winPhrase(bd.label);
    // written A: greeting + intro + 30 second + what sold
    const g = blk('Hi First Name,', { h: true, italic: true, er: [{ offset: 3, length: 10, key: 0 }] });
    const A = [g, blk('')];
    introFor(sub, bd).forEach(t => A.push(blk(t)));
    A.push(blk(''), blk('THE 30 SECOND VERSION', { h: true, bold: true }));
    thirtyLines(sub, bd).forEach(t => A.push(blk(t)));
    auctionLines.forEach(l => A.push(blk(l)));
    A.push(blk(''), blk('WHAT SOLD IN ' + sub.toUpperCase(), { h: true, bold: true }));
    bd.lines.forEach(l => A.push(blk(l)));
    if (cnt > 1) A.push(blk(''), blk('Same suburb, same window, very different results. Presentation, pricing and campaign choice are what separate them.'));
    const writtenA = clone(M.written);
    writtenA.contents = { textOne: { blocks: A, entityMap: { '0': { type: 'PLACEHOLDER', mutability: 'IMMUTABLE', data: { placeholder: 'contact.firstname' } } } } };
    const mk = arr => { const p = clone(M.textPanel); p.contents = { textOne: { blocks: arr, entityMap: {} } }; return p; };
    const writtenB = mk([blk('WHAT YOUR HOME IS WORTH TODAY', { h: true, bold: true }),
      blk('If selling is on your radar, even for next year, a no obligation valuation and strategy session gives you the number, the likely timeframe and a plan built for your home. I come to you, and it takes about 45 minutes.')]);
    const C = [blk('THE WEEK IN THE ECONOMY', { h: true, bold: true })];
    // econLines() rotates the wording weekly; window.__ECON overrides only when the FACTS change.
    ((window.__ECON && window.__ECON.length) ? window.__ECON : econLines())
      .forEach(l => C.push(blk(l.t, { italic: !!l.i })));
    C.push(blk(''), blk(communityHeading(sub), { h: true, bold: true }));
    (LOCAL[sub] || []).forEach(it => { C.push(blk(it.t + '.', { italic: true })); C.push(blk(it.b)); C.push(blk('')); });
    if (C[C.length - 1].text === '') C.pop();
    const writtenC = mk(C);
    const replyP = mk(REPLY_BLOCKS()), prefsP = mk(PREFS_BLOCKS());
    const stat = clone(M.stat);
    stat.contents.textOne.blocks = stat.contents.textOne.blocks.map((b, i) => {
      const nb = J(b); nb.text = i === 0 ? 'MEDIAN TIME TO SELL' : bd.days + ' Days';
      nb.inlineStyleRanges = (b.inlineStyleRanges || []).map(r => ({ ...r, offset: 0, length: nb.text.length })); return nb; });
    const pre = clone(M.pre);
    const vl = pre.contents.textOne.blocks.slice(-1)[0];
    const hook = preheaderFor(sub, bd);
    pre.contents.textOne.blocks = [{ key: rk(), text: hook, type: vl.type, depth: 0,
      inlineStyleRanges: [{ offset: 0, length: hook.length, style: '#595959' }], entityRanges: [], data: vl.data || {} }, vl];
    const headSub = clone(M.headSub);
    const hb = headSub.contents.textOne.blocks[0];
    hb.text = 'LATEST ' + sub.toUpperCase() + ' PROPERTIES FOR SALE';
    hb.inlineStyleRanges = hb.inlineStyleRanges.map(r => ({ ...r, offset: 0, length: hb.text.length }));
    const gridSold = clone(M.gridSold); gridSold.contents = { propertyListings: ctx.sold.map(r => normImgs(J(r))) };
    const closing = clone(M.closing);
    const jb = closing.contents.textOne.blocks.find(b => b.inlineStyleRanges.some(r => r.style === 'BOLD') && b.inlineStyleRanges.some(r => r.style === 'ITALIC'));
    jb.text = joke; jb.inlineStyleRanges = jb.inlineStyleRanges.map(r => ({ ...r, offset: 0, length: joke.length }));
    // Subject options ride on window.__SUBJ = {week, prevSubjects} so a REBUILD reproduces the
    // same subject instead of silently re-rolling the bank (and risking a last-week repeat).
    // Set it before any build: window.__SUBJ = {week: <n>, prevSubjects: <prev subjects.json>}.
    const _v = window.__VARY || {};
    const subject = subjectFor(sub, bd, { week: _v.week, prev: PREVOF(sub, 'subject') });
    return { M, live, pre, writtenA, writtenB, writtenC, replyP, prefsP, stat, headSub, gridSold, closing, subject };
  }

  // ---- ASSEMBLE: order the panels, place the alert block dynamically ----
  function assemble(master, sub, bd, ctx, joke, auctionLines) {
    const P = parts(master, sub, bd, ctx, joke, auctionLines), M = P.M, live = P.live, n = live.length;
    const head = [clone(M.pre), clone(M.banner), clone(M.div), P.writtenA, P.stat,
      P.writtenB, clone(M.appr[0]), P.writtenC, P.replyP, P.prefsP, clone(M.prefBtn)];
    head[0] = P.pre;                                  // per-suburb preheader (failure shape 11)
    const tail = []; let featureP = null, tiles = [];
    if (n > 0) {
      const sorted = live.slice().sort((a, b) => (parseFloat(String(b.price || 0).replace(/[^\d.]/g, '')) || 0) - (parseFloat(String(a.price || 0).replace(/[^\d.]/g, '')) || 0));
      if (n === 1) { featureP = clone(M.feature); featureP.contents = { propertyListings: [live[0]] }; }
      else if (n % 2 === 1) { featureP = clone(M.feature); featureP.contents = { propertyListings: [sorted[0]] }; tiles = live.filter(r => r.id !== sorted[0].id); }
      else tiles = live;
      tail.push(P.headSub, clone(M.div));
      if (featureP) tail.push(featureP);
    }
    const stream = [];
    tiles.forEach(r => stream.push({ t: 'tile', kind: 'sub', rec: r }));
    if (n > 0) stream.push({ t: 'panel', p: clone(M.appr[1] || M.appr[0]) });
    stream.push({ t: 'panel', p: clone(M.headSold) });
    (P.gridSold.contents.propertyListings || []).forEach(r => stream.push({ t: 'tile', kind: 'sold', rec: r }));
    stream.push({ t: 'panel', p: clone(M.appr[2] || M.appr[0]) }, { t: 'panel', p: clone(M.headFeed) },
      { t: 'panel', p: clone(M.gridFeed) }, { t: 'panel', p: clone(M.appr[3] || M.appr[0]) });
    const mkGrid = (buf, kind) => { if (!buf.length) return null; const g = clone(kind === 'sold' ? P.gridSold : M.gridSub); g.contents = { propertyListings: buf.slice() }; return g; };
    let out = head.concat(tail), buf = [], bufKind = null, placed = false;
    let cost = estimate(out);
    const alertCost = COST.heading + COST.button + COST.divider;
    const pushBuf = () => { const g = mkGrid(buf, bufKind); if (g) out.push(g); buf = []; };
    for (let i = 0; i < stream.length; i++) {
      const it = stream[i];
      const itCost = it.t === 'tile' ? COST.tile : (it.p.panel_id === 17 ? 4 * COST.tile : COST.button);
      if (!placed && (cost + alertCost) <= TARGET && (cost + alertCost + itCost) > TARGET) {
        pushBuf(); out.push(clone(M.brkHead), clone(M.brkBtn), clone(M.div)); cost += alertCost; placed = true;
      }
      if (it.t === 'tile') { if (bufKind && bufKind !== it.kind) pushBuf(); bufKind = it.kind; buf.push(it.rec); }
      else { pushBuf(); out.push(it.p); }
      cost += itCost;
    }
    pushBuf();
    if (!placed && estimate(out) > 104448) {
      const si = out.findIndex(p => p.panel_id === 5 && /JUST SOLD/i.test((((p.contents || {}).textOne || {}).blocks || []).map(b => b.text).join('')));
      if (si > 0) { out.splice(si, 0, clone(M.brkHead), clone(M.brkBtn), clone(M.div)); placed = true; }
    }
    out.push(P.closing, clone(M.footImg));
    M.chrome.forEach(p => out.push(clone(p)));
    out.forEach((p, i) => p.position = i);
    return { panelcontents: out, subject: P.subject, alertPlaced: placed };
  }

  window.V6 = { API, AGID, APPRAISAL, SENTINEL, PREFS, MASTER, fold, J, normImgs, clone, blk,
    winPhrase, introFor, LOCAL, SUB, DATED, communityHeading, subjectFor, preheaderFor,
    thirtyLines, pick, pickReinzLocation, parts, assemble, COST, TARGET, estimate,
    REPLY_BLOCKS, PREFS_BLOCKS };
})();
