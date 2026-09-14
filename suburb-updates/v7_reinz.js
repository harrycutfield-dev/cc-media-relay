// v7_reinz.js — THE REINZ SOURCE LAYER (13 Sep 2026). Eval inside a statistics.reinz.co.nz tab.
// Exposes window.RZ = { resolveIds, pullSales, pullStats, pullAll }
//
// WHY THIS FILE REPLACES THE OLD PULL
// -----------------------------------
// The old code resolved suburbs through POST /api/locations/search/. **That endpoint does not
// search.** Whatever you pass — q, search, name, label, keyword, querystring or body, with or
// without paging — it returns the SAME 1000 national rows, starting "Shag Point, Palmerston".
// Mairangi Bay is not in them. Any "match" picked from that response is effectively arbitrary:
// searching for Mairangi Bay returned Torbay. That is the true root cause of the "Milford Sound"
// and "Long Bay, Akaroa" failures, which were previously patched at the matcher instead of here.
//
// The endpoint the REINZ UI itself uses, captured from its own network traffic:
//     GET /api/locations/typeahead/sales/<query>        <-- this one really filters
// and the sold search needs   mode: "sales"   (its absence returned 4860 national hits).
//
// Every figure this file returns carries `pulled_at`. The builder must refuse to run on any
// dataset whose `pulled_at` predates the last send.

(function () {
  const TOKEN = () => localStorage.getItem('reinz-app-token');
  const H = () => ({ 'Authorization': 'JWT ' + TOKEN(), 'Content-Type': 'application/json', Accept: 'application/json' });
  const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const norm = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/[.,]/g, '');

  const CATEGORY = ['Residence', 'Unit', 'Apartment', 'Townhouse', 'Home and Income',
    'Residential - Other', 'Residential Section', 'Residential Investment Block'];

  function tokenValid() {
    try { const p = JSON.parse(atob(TOKEN().split('.')[1])); return p.exp * 1000 > Date.now(); }
    catch (e) { return false; }
  }

  // ---- 1. RESOLVE SUBURB -> location_id -------------------------------------
  // Fail closed. A suburb that cannot be resolved to an Auckland suburb whose label STARTS with
  // its name is returned as an error, never guessed. Macrons are folded for the query because
  // "Pāremoremo" returns nothing while "paremoremo" resolves correctly.
  async function resolveIds(suburbs) {
    if (!tokenValid()) throw new Error('REINZ token missing or expired - ask Harrison to log in');
    const ids = {}, failed = [];
    for (const sub of suburbs) {
      const q = fold(sub);
      const r = await fetch('/api/locations/typeahead/sales/' + encodeURIComponent(q), { headers: H() });
      const j = await r.json();
      const arr = Array.isArray(j.result) ? j.result : (Array.isArray(j) ? j : []);
      const subs = arr.filter(l => /suburb/i.test(String(l.location_type || '')) || l.location_type_id === 5);
      // label must START with the suburb name (folded) AND be in Auckland
      const exact = subs.filter(l => fold(l.label).indexOf(q) === 0);
      const akl = exact.filter(l => /auckland/i.test(l.label || ''));
      const pick = akl[0] || (exact.length === 1 ? exact[0] : null);
      if (pick && Number.isFinite(+pick.location_id)) ids[sub] = { id: +pick.location_id, label: pick.label };
      else failed.push({ suburb: sub, candidates: arr.slice(0, 4).map(l => l.label) });
    }
    return { ids, failed, pulled_at: new Date().toISOString() };
  }

  // ---- 2. SOLD SALES ---------------------------------------------------------
  // `mode:"sales"` is mandatory. Returns UNCONDITIONAL sales (Harrison, 13 Sep 2026) keyed for
  // the ledger. `sale_date` is the unconditional date and is what novelty is judged on;
  // `agreement_date` and `settlement_date` are carried for audit.
  async function pullSales(loc, fromMonth, toMonth) {
    const body = {
      commit: true, mode: 'sales',
      locations: [{ label: loc.label, location_type_id: 5, location_id: loc.id }],
      category: CATEGORY, date: { from: fromMonth, to: toMonth },
      random_seed: 'v7' + Math.floor(Date.now() / 86400000)
    };
    const r = await fetch('/api/search/properties', { method: 'POST', headers: H(), body: JSON.stringify(body) });
    if (!r.ok) throw new Error('sales search ' + r.status);
    const j = await r.json();
    const feats = ((j.result || {}).features) || [];
    const out = [];
    feats.forEach(f => ((f.properties || {}).records || []).forEach(rec => {
      const addr = ((rec.unit ? rec.unit + '/' : '') + (rec.street_number || '') + ' ' + (rec.street || '')).replace(/\s+/g, ' ').trim();
      out.push({
        key: norm(addr) + '|' + (rec.sale_price || 0),
        address: addr, suburb: rec.suburb || '', price: rec.sale_price || 0,
        beds: rec.bedrooms, days: rec.days_to_sell,
        sale_date: rec.sale_date || '', agreement_date: rec.agreement_date || '',
        settlement_date: rec.settlement_date || '', method: rec.sale_method || '',
        category: rec.category || '', sale_id: rec.sale_id
      });
    }));
    // de-dupe by sale_id then key
    const seen = new Set();
    return out.filter(s => { const k = s.sale_id || s.key; if (seen.has(k)) return false; seen.add(k); return true; });
  }

  // ---- 3. SUBURB STATS -------------------------------------------------------
  async function pullStats(loc) {
    const r = await fetch('/api/locations/salesstats/', { method: 'POST', headers: H(),
      body: JSON.stringify({ location_type_id: 5, location_id: loc.id }) });
    if (!r.ok) throw new Error('salesstats ' + r.status);
    const j = await r.json();
    return j.result || j;
  }

  // ---- 4. THE WHOLE PULL -----------------------------------------------------
  // ledger: {suburb:{sales:{key:{first_sent}}}}. cutoffISO: nothing older may EVER surface
  // (Harrison: 5 weeks = current week + last month).
  // Returns per suburb: fresh (never sent), recent (sent before, inside cutoff), stats, stamps.
  async function pullAll(suburbs, ledger, opts) {
    opts = opts || {};
    const cutoff = opts.cutoffISO || new Date(Date.now() - 35 * 864e5).toISOString().slice(0, 10);
    const from = opts.fromMonth || 'Jun 2026', to = opts.toMonth || 'Sep 2026';
    const res = await resolveIds(suburbs);
    if (res.failed.length) throw new Error('UNRESOLVED SUBURBS (fail closed): ' +
      res.failed.map(f => f.suburb).join(', '));
    const pulled_at = new Date().toISOString();
    const data = {};
    for (const sub of suburbs) {
      const loc = res.ids[sub];
      const all = await pullSales(loc, from, to);
      // suburb attribution guard: REINZ's own suburb field must agree (2C Tiri View Place was
      // sent as Waiake on 13 Sep when REINZ records it as Browns Bay)
      const mine = all.filter(s => !s.suburb || fold(s.suburb).indexOf(fold(sub)) === 0);
      const foreign = all.filter(s => s.suburb && fold(s.suburb).indexOf(fold(sub)) !== 0);
      const inWindow = mine.filter(s => s.sale_date && s.sale_date >= cutoff);
      const led = (ledger && ledger[sub] && ledger[sub].sales) || {};
      data[sub] = {
        location: loc, pulled_at, cutoff,
        fresh: inWindow.filter(s => !led[s.key]),
        recent: inWindow.filter(s => !!led[s.key]),
        rejected_wrong_suburb: foreign.map(s => s.address + ' -> ' + s.suburb),
        stats: await pullStats(loc)
      };
    }
    return { pulled_at, cutoff, window: from + ' to ' + to, data };
  }

  window.RZ = { resolveIds, pullSales, pullStats, pullAll, tokenValid, fold, norm, CATEGORY };
})();
