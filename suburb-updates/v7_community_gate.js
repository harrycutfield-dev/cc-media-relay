// v7_community_gate.js — THE COMMUNITY GATE (18 Sep 2026).
// Runs in node (`node v7_community_gate.js <community.json>`) and in-browser (window.CG).
//
// WHY THIS FILE EXISTS
// --------------------
// On 18 Sep the community layer passed every prose rule in SKILL.md and was still wrong in ten
// places. Two of them were new classes of defect:
//
//   1. WRONG COUNTRY. "Torbay Community Champion Awards at The Imperial, 21 Nov" was sourced from
//      Torbay in DEVON, ENGLAND. The Imperial is a Torquay hotel. It was the LEAD item for Torbay,
//      Waiake and Long Bay. Harrison's patch is full of suburb names with UK/AU twins, so a plain
//      web search for "<suburb> community events" is a coin flip on hemisphere.
//
//   2. STATUS ROT. Every single factual error was a live-status claim: "is open for feedback"
//      (consultation had closed), "feedback is open now" (the cycleway was already being built),
//      "Winter Fun is running now" (it was spring). Fixed facts - dollar figures, dates, names -
//      verified clean at 100%. Status claims decay between research and send; nothing measured it.
//
// Prose in SKILL.md does not bite (failure shape 14). This file bites.

(function (root) {
  const TWIN = {
    // suburb -> the foreign place that poisons a naive search
    'Torbay': 'Torbay, Devon UK', 'Devonport': 'Devonport, Plymouth UK / Tasmania AU',
    'Greenhithe': 'Greenhithe, Kent UK', 'Birkenhead': 'Birkenhead, Merseyside UK',
    'Northcote': 'Northcote, Melbourne AU', 'Bayswater': 'Bayswater, London UK / Melbourne AU',
    'Chatswood': 'Chatswood, Sydney AU', 'Albany': 'Albany, New York US',
    'Beach Haven': 'Beach Haven, New Jersey US', 'Milford': 'Milford Haven UK / Milford CT US',
    'Belmont': 'Belmont, Massachusetts US', 'Hillcrest': 'Hillcrest, Durban ZA',
    'Rosedale': 'Rosedale, Toronto CA',
    'Long Bay': 'Long Bay, Cornwall UK', 'Windsor Park': 'Windsor, Berkshire UK'
  };

  // Phrases that assert a LIVE STATUS. Anything matching must carry `status_until` - the date the
  // claim stops being safe to send - and that date must not have passed.
  const STATUS = [
    /\bis open\b/i, /\bopen for feedback\b/i, /\bfeedback is open\b/i, /\bopen now\b/i,
    /\bis consulting\b/i, /\bconsultation\b/i, /\bhave your say\b/i,
    /\brunning now\b/i, /\bis running\b/i, /\bunderway\b/i, /\bcurrently\b/i,
    /\bhas opened\b/i, /\bis out\b/i, /\bnow on\b/i, /\bthis week\b/i, /\bcoming weeks\b/i
  ];

  // NZ season boundaries - a "winter"/"summer" programme claimed out of season is a red flag.
  const SEASON = { winter: [6, 8], spring: [9, 11], summer: [12, 2], autumn: [3, 5] };

  function inSeason(name, month) {
    const s = SEASON[name]; if (!s) return true;
    const [a, b] = s;
    return a <= b ? (month >= a && month <= b) : (month >= a || month <= b);
  }

  function check(data, opts) {
    opts = opts || {};
    const today = opts.today || new Date().toISOString().slice(0, 10);
    const month = +today.slice(5, 7);
    const subs = opts.suburbs || Object.keys(data).filter(k => !k.startsWith('_'));
    const fail = [], warn = [];
    const leads = new Map();

    subs.forEach(sub => {
      const arr = data[sub];
      if (!Array.isArray(arr) || !arr.length) { fail.push(`[${sub}] EMPTY or not an array`); return; }

      arr.forEach((it, i) => {
        const tag = `[${sub}#${i}] ${String(it.t || '??').slice(0, 44)}`;
        const txt = `${it.t || ''} ${it.b || ''}`;

        if (!it.t) fail.push(`${tag} no title`);
        if (!it.b) fail.push(`${tag} no body`);

        // --- GEOGRAPHY GATE (defect class 1) ---------------------------------
        // Every item must name the source it came from, and that source must be NZ.
        if (!it.src) {
          fail.push(`${tag} NO src - cannot prove country. Fail closed.`);
        } else {
          const nz = /(^|\.)([a-z0-9-]+\.)?nz(\/|$)/i.test(it.src) ||
                     /aucklandcouncil|ourauckland|at\.govt\.nz|eventfinda\.co\.nz/i.test(it.src);
          if (!nz) fail.push(`${tag} NON-NZ SOURCE: ${it.src}`);
          if (/\.co\.uk|\.org\.uk|\.com\.au|\.gov\.uk/i.test(it.src))
            fail.push(`${tag} FOREIGN TLD: ${it.src}`);
        }
        if (TWIN[sub] && !it.geo_ok)
          fail.push(`${tag} suburb has a foreign twin (${TWIN[sub]}) and item has no geo_ok confirmation`);

        // --- STATUS ROT GATE (defect class 2) --------------------------------
        const hit = STATUS.find(r => r.test(txt));
        if (hit) {
          if (!it.status_until)
            fail.push(`${tag} LIVE-STATUS claim (${hit.source}) with no status_until`);
          else if (it.status_until < today)
            fail.push(`${tag} STATUS EXPIRED ${it.status_until} - claim is now false`);
        }

        // seasonal sanity: "winter programme ... running now" in spring
        ['winter', 'summer', 'spring', 'autumn'].forEach(s => {
          if (new RegExp('\\b' + s + '\\b', 'i').test(txt) && /running|now|on\b/i.test(txt)
              && !inSeason(s, month))
            fail.push(`${tag} claims a ${s} programme is running, but ${today} is not ${s}`);
        });

        // --- INTERNAL DATE CONTRADICTION -------------------------------------
        // "the latest newsletter is out ... the 21 September issue" where 21 Sep is the future.
        const dm = txt.match(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b/i);
        if (dm && /\bis out\b|\bhas opened\b|\bis available\b|\blatest\b/i.test(txt)) {
          const MON = ['january','february','march','april','may','june','july','august','september','october','november','december'];
          const mi = MON.indexOf(dm[2].toLowerCase()) + 1;
          const iso = `${today.slice(0, 4)}-${String(mi).padStart(2, '0')}-${String(+dm[1]).padStart(2, '0')}`;
          if (iso > today) fail.push(`${tag} says it is already out but cites ${iso}, which is after ${today}`);
        }

        // --- FRESHNESS -------------------------------------------------------
        if (!it.verified_on) fail.push(`${tag} no verified_on`);
        else if ((new Date(today) - new Date(it.verified_on)) / 864e5 > 42)
          fail.push(`${tag} verified_on is stale`);

        // --- EVENTS ----------------------------------------------------------
        if (it.on && it.on < today) fail.push(`${tag} PAST EVENT ${it.on}`);

        // --- HOUSE STYLE -----------------------------------------------------
        const d = txt.match(/[^\s]*[-–—][^\s]*/);
        if (d) fail.push(`${tag} DASH in copy: ${d[0]}`);
      });

      // events before news, soonest first
      const ev = arr.filter(x => x.on).map(x => x.on);
      if (JSON.stringify(ev) !== JSON.stringify([...ev].sort()))
        fail.push(`[${sub}] events out of order: ${ev.join(', ')}`);
      const firstNews = arr.findIndex(x => !x.on), lastEv = arr.map(x => !!x.on).lastIndexOf(true);
      if (firstNews > -1 && lastEv > firstNews) fail.push(`[${sub}] news appears before an event`);

      // --- LEAD NAMES THE SUBURB (failure shape 13, asserted on the LEAD only) ---
      // FOLD MACRONS. Copy writes "Paremoremo" and "Totara Vale" while the suburb keys carry
      // macrons, so a literal compare failed both on 18 Sep. Same defect class as the REINZ
      // typeahead, which returned nothing for "Pāremoremo" until the query was folded.
      const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const lead = arr[0], head = fold(sub).split(' ')[0];
      if (!fold(`${lead.t || ''} ${lead.b || ''}`).includes(head))
        fail.push(`[${sub}] LEAD does not name the suburb: "${String(lead.t).slice(0, 50)}"`);
      const k = String(lead.t || '').toLowerCase().trim();
      if (!leads.has(k)) leads.set(k, []);
      leads.get(k).push(sub);
    });

    // --- UNIFORMITY DETECTOR (failure shape 13 lesson b) ---------------------
    // A pass/fail gate never surfaces "34 suburbs share 14 leads". Count distinct.
    const distinct = leads.size, ratio = distinct / subs.length;
    [...leads.entries()].filter(([, v]) => v.length > 1).forEach(([k, v]) =>
      fail.push(`SHARED LEAD across ${v.length} suburbs (${v.join(', ')}): "${k.slice(0, 44)}"`));
    if (ratio < 0.9) warn.push(`LOW LEAD DIVERSITY: ${distinct} distinct leads across ${subs.length} suburbs`);

    return { ok: fail.length === 0, fail, warn, distinctLeads: distinct, suburbs: subs.length };
  }

  const API = { check, TWIN, STATUS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.CG = API;

  // CLI
  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    const fs = require('fs');
    const f = process.argv[2];
    const today = process.argv[3];
    const data = JSON.parse(fs.readFileSync(f, 'utf8'));
    const r = check(data, { today });
    console.log(`suburbs ${r.suburbs} · distinct leads ${r.distinctLeads}`);
    console.log(`\n=== FAIL (${r.fail.length}) ===`);
    r.fail.forEach(x => console.log('  ' + x));
    if (r.warn.length) { console.log(`\n=== WARN (${r.warn.length}) ===`); r.warn.forEach(x => console.log('  ' + x)); }
    console.log(r.ok ? '\nGATE PASS' : '\nGATE FAIL');
    process.exit(r.ok ? 0 : 1);
  }
})(typeof window !== 'undefined' ? window : null);
