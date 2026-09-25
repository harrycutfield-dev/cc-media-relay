// browser/rw_luxury_nz.js
// Open https://www.raywhite.com/luxury-homes/ then run extractNZLuxury().
//
// Ray White's national Luxury Homes page. Every region's listings are SERVER RENDERED into
// the DOM and merely tab-switched, so there is no XHR to intercept and no API to call:
// reading the DOM is the supported path here, not a fallback.
//
// Structure (verified 17 Aug 2026):
//   section.luxury-homes-listing
//     button.luxury-homes-listing__tab      x9   region names, in DOM order
//     div.luxury-homes-listing__list        x9   one per region, SAME order as the tabs
//       article.card.property-min-card      the listing cards
//
// New Zealand is list index 2. Do not hardcode blindly: match the tab text to the index,
// because a region added upstream would silently shift it and you would publish Australian
// property in a New Zealand email.
//
// The href carries the categorisation for free:
//   /auckland/north-shore-city/takapuna/RMU45900
//    region  /district        /suburb  /listingId
//
// Photos are on cdn6.ep.dynamics.net (the same Ray White CDN the website skill uses) and sit
// in `datasrcset` because the cards lazy load; `src` is populated only once scrolled into view.
//
// GOTCHA: returning these rows straight out of javascript_tool trips the Chrome extension's
// "Cookie/query string data" filter. Keep them on `window.__nz` and return counts, or return
// the payload base64 encoded.

function extractNZLuxury() {
  var root = document.querySelector('.luxury-homes-listing');
  if (!root) throw new Error('luxury-homes-listing section missing');

  var tabs = [].slice.call(root.querySelectorAll('.luxury-homes-listing__tab'));
  var lists = [].slice.call(root.querySelectorAll('.luxury-homes-listing__list'));
  var idx = tabs.findIndex(function (t) { return /new zealand/i.test(t.textContent || ''); });
  if (idx < 0) throw new Error('no New Zealand tab');
  if (!lists[idx]) throw new Error('no list for the New Zealand tab');

  var cards = [].slice.call(lists[idx].querySelectorAll('.property-min-card'));

  var rows = cards.map(function (c) {
    var a = c.querySelector('a[href]');
    var href = a ? a.getAttribute('href') : '';
    var seg = href.split('/').filter(Boolean);
    var img = c.querySelector('img.lazy__image');
    var src = img ? String(img.getAttribute('datasrcset') || img.getAttribute('src') || '')
      .split(' ')[0] : '';
    var t = ((c.querySelector('.card__title') || {}).textContent || '')
      .replace(/\s+/g, ' ').trim();
    var parts = t.split(',').map(function (s) { return s.trim(); });
    return {
      region: seg[0] || '', district: seg[1] || '', suburb: seg[2] || '', id: seg[3] || '',
      address: parts[0] || '', locality: parts.slice(1, -1).join(', '),
      href: 'https://www.raywhite.com' + href, img: src
    };
  });

  window.__nz = rows;
  var byRegion = {};
  rows.forEach(function (r) { byRegion[r.region] = (byRegion[r.region] || 0) + 1; });
  return {
    tabMatched: tabs[idx].textContent.trim(),
    total: rows.length,
    withImage: rows.filter(function (r) { return /cdn6\.ep\.dynamics\.net/.test(r.img); }).length,
    byRegion: byRegion
  };
}

extractNZLuxury();
