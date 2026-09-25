// browser/rw_listing_detail.js
// Run on a Ray White LISTING page. Returns beds, baths, cars, land, building and method.
//
// WHY A BROWSER AND NOT urllib (verified 25 Sep 2026)
// The listing page ships NO structured data in its server HTML. There is no JSON-LD block,
// no "bedrooms": key, no data attribute. Fetching the page with urllib and regexing for
// bedrooms matches prose in the marketing description and returns nonsense: on 46B Bassett
// Road it read beds=1 off the phrase "a second double bedroom". Everything is injected
// client side, so the page must be HYDRATED before reading. Give it ~3s after load.
//
// Also note raywhite.com redirects to raywhite.co.nz for NZ listings. Follow it; the .co.nz
// URL is the one worth putting in an email.
//
// Structure:
//   .property-meta__item            one per count, identified by its icon class
//     .icon-solid-bed|bath|car      which count it is. The NUMBER has no label of its own,
//                                   so reading them positionally would silently swap beds
//                                   and baths on any listing with no car spaces.
//     .property-meta__item__count   the number
//   .property-detail__banner__specs__item
//     __label / __value             Property Type, Building, Land. The value carries a <sup>2</sup>
//                                   and a wall of whitespace, so collapse before use.
//   .property-detail__banner__side__price   the method of sale line

function extractListingDetail() {
  function txt(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }

  var meta = {};
  [].slice.call(document.querySelectorAll('.property-meta__item')).forEach(function (item) {
    var icon = item.querySelector('[class*="icon-solid-"]');
    var count = item.querySelector('.property-meta__item__count');
    if (!icon || !count) return;
    var m = String(icon.className).match(/icon-solid-(bed|bath|car)/);
    if (m) meta[m[1]] = txt(count);
  });

  var specs = {};
  [].slice.call(document.querySelectorAll('.property-detail__banner__specs__item'))
    .forEach(function (it) {
      var l = txt(it.querySelector('.property-detail__banner__specs__item__label'));
      var v = txt(it.querySelector('.property-detail__banner__specs__item__value'));
      if (l) specs[l.toLowerCase()] = v.replace(/\s*m\s*2\s*$/i, ' m2');
    });

  return {
    beds: meta.bed || '', baths: meta.bath || '', cars: meta.car || '',
    land: specs.land || '', building: specs.building || '',
    type: specs['property type'] || '',
    method: txt(document.querySelector('.property-detail__banner__side__price')),
    hydrated: !!document.querySelector('.property-meta__item')
  };
}

extractListingDetail();
