// v7_listings.js — LISTINGS SOURCE LAYER (13 Sep 2026). Eval inside a live.activepipe.com tab.
// Exposes window.LS = { pull, splitForSuburb }
//
// HARRISON'S LAYOUT (13 Sep 2026):
//   1. NEW TO THE MARKET THIS WEEK IN <SUBURB>   <- genuinely new, proven against the ledger
//   2. OUR LISTINGS IN <SUBURB>                  <- the rest of the office stock
//   HIS OWN LISTINGS ARE ALWAYS PRESENTED FIRST inside BOTH blocks.
//
// "New this week" is a LEDGER question, never a date-field guess: a listing is new if this
// suburb's readers have not been shown it before. Same principle that closed the 65% sold-line
// repeat — novelty is proven against what was sent, not inferred from a window.

(function () {
  const API = 'https://api.activepipe.com';
  const AGID = '87959016-136a-469e-8f59-6cf12307bd75';   // Harrison in listingagent extendeddata
  const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const normImgs = r => { (r.images || []).forEach(im => { if (!im.src) im.src = im.cdn_url || im.url; }); return r; };
  const J = o => JSON.parse(JSON.stringify(o));

  async function page(status) {
    let out = [], p = 1, got = 100;
    while (got === 100 && p <= 30) {
      const r = await fetch(API + '/properties?status=' + status + '&page=' + p,
        { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } });
      const j = await r.json(); const items = j.data || j;
      got = (items || []).length; out = out.concat(items || []); p++;
    }
    // an exact multiple of 100 is the silent-cap signature - refuse rather than under-report
    if (out.length && out.length % 100 === 0) throw new Error('property feed returned exactly ' +
      out.length + ' - suspect a silent cap, refusing');
    return out;
  }

  const isMine = r => JSON.stringify(r.extendeddata || '').includes(AGID);

  async function pull() {
    const current = (await page('current')).map(normImgs);
    let sold = (await page('sold')).filter(isMine).map(normImgs);
    const seen = new Set();
    sold = sold.filter(s => { const k = fold(s.displayaddress) + '|' + fold(s.city); return !seen.has(k) && seen.add(k); });
    sold.sort((a, b) => (b.solddate || '').localeCompare(a.solddate || ''));
    return { pulled_at: new Date().toISOString(), current, sold };
  }

  // ledger: {suburb:{listings:{id:{first_sent}}}}
  // Returns the two blocks in Harrison's order, his listings first within each.
  function splitForSuburb(sub, ctx, ledger) {
    const live = ctx.current.filter(r => fold(r.city) === fold(sub)).map(r => J(r));
    const led = (ledger && ledger[sub] && ledger[sub].listings) || {};
    const order = arr => {
      const mine = arr.filter(isMine), rest = arr.filter(r => !isMine(r));
      const byAddr = (a, b) => String(a.displayaddress || '').localeCompare(String(b.displayaddress || ''));
      return mine.sort(byAddr).concat(rest.sort(byAddr));       // HIS LISTINGS ALWAYS FIRST
    };
    const fresh = order(live.filter(r => !led[r.id]));
    const rest = order(live.filter(r => !!led[r.id]));
    return {
      newThisWeek: fresh, ours: rest, liveCount: live.length,
      mineCount: live.filter(isMine).length,
      headings: {
        fresh: 'NEW TO THE MARKET THIS WEEK IN ' + String(sub).toUpperCase(),
        rest: 'OUR LISTINGS IN ' + String(sub).toUpperCase()
      }
    };
  }

  window.LS = { pull, splitForSuburb, isMine, AGID };
})();
