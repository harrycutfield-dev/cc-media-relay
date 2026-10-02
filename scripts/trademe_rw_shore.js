// browser/trademe_rw_shore.js
// Open https://www.trademe.co.nz/a/property/residential/sale/auckland/north-shore-city
// then run extractRayWhiteAbove(3000000).
//
// WHY THE SSR STATE AND NOT THE DOM:
// Trade Me's property search is an Angular app rendered client side. A plain fetch returns
// the shell only. But the server ships a full state-transfer payload in
// <script id="frend-state">, so once the page is open in a real browser every listing is
// available as structured JSON. No DOM scraping, no fragile selectors.
//
// This exists because the ActivePipe office feed carries only Milford | Mairangi Bay stock,
// which yields about 4 listings at $3m+. Ray White has several Shore offices. Holding the
// $3m bracket means widening the SOURCE, which is what this does.
//
// STATE PATHS ARE EXACT. Do not "simplify" them.

function extractRayWhiteAbove(floor) {
  var FLOOR = floor || 3000000;

  var el = document.getElementById('frend-state');
  if (!el) throw new Error('frend-state missing - page not fully rendered');
  var st = JSON.parse(el.textContent).NGRX_STATE;

  var cached = (((st.listing || {}).cachedSearchResults || {}).entities) || {};

  var money = function (v) {
    var d = String(v == null ? '' : v).replace(/[^0-9]/g, '');
    return d ? parseInt(d, 10) : 0;
  };

  var out = [];
  Object.keys(cached).forEach(function (id) {
    var item = (cached[id] || {}).item;
    if (!item) return;

    var agency = String(item.agencyName || (item.agency && item.agency.name) || '');
    if (!/ray\s*white/i.test(agency)) return;

    var price = money(item.priceDisplay || item.startPrice || item.price);
    if (price < FLOOR) return;

    var photos = (item.photoUrls || (item.pictureHref ? [item.pictureHref] : []) || [])
      .map(function (u) { return String(u).replace(/thumb|list/gi, 'full'); });

    out.push({
      id: item.listingId || id,
      address: item.address || item.title || '',
      suburb: item.suburb || '',
      price: price,
      priceDisplay: item.priceDisplay || '',
      bedrooms: item.bedrooms || null,
      bathrooms: item.bathrooms || null,
      agency: agency,
      photos: photos
    });
  });

  out.sort(function (a, b) { return b.price - a.price; });
  return { count: out.length, listings: out };
}

extractRayWhiteAbove(3000000);
