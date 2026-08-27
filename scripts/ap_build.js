// browser/ap_build.js
// Run in a logged-in live.activepipe.com tab. Exposes window.SC.
//
// RECYCLING MODEL (Harrison's instruction, 17 Aug 2026)
// There is exactly ONE Signature Collection email in ActivePipe and every fortnightly run
// UPDATES IT IN PLACE. The run never creates a new communication. The id stays stable, the
// name stays stable, and only the subject and the panel contents change per issue.
// Same pattern as the enquiry-response-update skill.
//
// MEASURED FACTS. Do not "improve" these, they were expensive to find:
//  - PUT /communications/{id} needs the FULL object from GET plus communicationcategory_id
//    restated. A partial body returns 403 Forbidden, which reads like a permissions problem
//    and is not. GET returns communicationcategory as an OBJECT, not an id, so the id has
//    to be added back or you get 422 "Category not defined".
//  - PATCH is rejected at CORS preflight. So are custom headers. Content-Type and Accept only.
//  - Pagination is page=, not offset=. offset is silently ignored and re-serves page 1.
//  - Property photos already carry the six keys an image panel needs
//    (id, src, key, secret, width, height), so a listing photo needs no upload.
//  - Sold grids: SET detailsLayout to suppress REQUEST AN INSPECTION.
//    For-sale grids: DELETE it so the button appears.
//  - *** A COMMUNICATION HAS NO SEND STATE. *** `firstsent_at` does not exist on
//    /communications at all, so the old check `!c.firstsent_at` was `!undefined`, i.e.
//    always true, and guaranteed nothing. Send state lives on /campaigns, which carry
//    status ("draft" | "finished"), activated_at, firstsent_at, and a nested
//    communication:{id}. sendState() below is the real check.
//
// CONTRACT WITH tools/build_run.py: when run.json has an empty `collection`, the caller must
// SKIP the collection heading and grid together, never leave a heading over nothing.

window.SC = (function () {
  var B = 'https://api.activepipe.com';

  function G(path) {
    return fetch(B + path, { credentials: 'include', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); });
  }

  function PUT(path, body) {
    return fetch(B + path, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().then(function (j) { return { status: r.status, body: j }; });
    });
  }

  function properties(status) {
    return G('/properties?limit=1000&status=' + status);
  }

  function uploadFromRelay(rawBase, name) {
    return fetch(rawBase + '/' + encodeURIComponent(name))
      .then(function (r) { return r.blob(); })
      .then(function (blob) {
        var fd = new FormData();
        fd.append('file', blob, name);
        return fetch(B + '/images', { method: 'POST', credentials: 'include', body: fd });
      })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        return { id: j.id, src: j.url || j.src, key: j.key, secret: j.secret,
                 width: j.width, height: j.height };
      });
  }

  // ---- the recycled email -------------------------------------------------
  // Resolve by NAME so the pipeline cannot silently start writing to the wrong record if
  // an id is ever stale. Refuses on 0 matches and on more than 1, because guessing which
  // of two same-named emails is "the" one is exactly how you overwrite the wrong thing.
  function resolveIssueEmail(name) {
    return G('/communications?limit=500').then(function (list) {
      var rows = Array.isArray(list) ? list : (list.data || []);
      var hits = rows.filter(function (c) {
        return String(c.name || '').trim() === name && !c.archived;
      });
      if (hits.length === 0) {
        throw new Error('no communication named "' + name + '". This run updates an ' +
          'existing email and will not create one. Create it once by hand, or restore it.');
      }
      if (hits.length > 1) {
        throw new Error(hits.length + ' communications named "' + name + '" (ids ' +
          hits.map(function (h) { return h.id; }).join(', ') +
          '). Refusing to guess which one to overwrite.');
      }
      return hits[0].id;
    });
  }

  // Update in place. Never creates. `mutate(panels, communication)` edits the array.
  function save(id, categoryId, mutate, subject) {
    return G('/communications/' + id).then(function (c) {
      var panels = c.email.panelcontents.map(function (p) {
        return JSON.parse(JSON.stringify(p));
      });
      mutate(panels, c);
      panels.forEach(function (p, i) { p.position = i; });
      var email = Object.assign({}, c.email, { panelcontents: panels });
      if (subject) email.subject = subject;
      var body = Object.assign({}, c, {
        communicationcategory_id: categoryId,
        email: email
      });
      return PUT('/communications/' + id, body);
    });
  }

  // ---- real send state ----------------------------------------------------
  // A communication carries no send flag: `firstsent_at` is not even a key on
  // /communications. Verified 17 Aug 2026 against the 34 suburb emails that demonstrably
  // sent on 15 Aug - hasOwnProperty('firstsent_at') is false on every one of them.
  //
  // Send truth lives on the campaign DETAIL, and so does the link back to the email:
  //   /campaigns            list  -> no `communication`, and firstsent_at reads null
  //   /campaigns/{id}       detail-> status, activated_at, firstsent_at, finished_at, AND
  //                                  triggers[].actions[].communication.id
  // There is no server-side filter by communication (communication_id, filter[...] and
  // friends are all ignored and return the full list), so the index has to be built by
  // fetching every campaign detail. 228 campaigns, batched 8 at a time, takes a few seconds.
  function _commIdsOf(c) {
    var out = {};
    ['triggers', 'delegates'].forEach(function (bucket) {
      (c[bucket] || []).forEach(function (t) {
        (t.actions || []).forEach(function (a) {
          if (a.communication && a.communication.id) out[a.communication.id] = true;
        });
      });
    });
    return Object.keys(out).map(Number);
  }

  function campaignIndex() {
    return G('/campaigns?limit=500').then(function (list) {
      var rows = Array.isArray(list) ? list : (list.data || []);
      var index = {};
      var i = 0;
      function step() {
        if (i >= rows.length) return index;
        var batch = rows.slice(i, i + 8);
        i += 8;
        return Promise.all(batch.map(function (c) { return G('/campaigns/' + c.id); }))
          .then(function (dets) {
            dets.forEach(function (d) {
              if (!d) return;
              _commIdsOf(d).forEach(function (cid) {
                (index[cid] = index[cid] || []).push({
                  id: d.id, name: d.name, status: d.status,
                  activated_at: d.activated_at || null,
                  firstsent_at: d.firstsent_at || null,
                  finished_at: d.finished_at || null
                });
              });
            });
            return step();
          });
      }
      return Promise.resolve().then(step);
    });
  }

  function sendState(commId) {
    return campaignIndex().then(function (index) {
      var mine = index[commId] || [];
      return {
        campaigns: mine,
        everSent: mine.some(function (c) {
          return c.status === 'finished' || !!c.firstsent_at;
        }),
        // A campaign that is activated but not yet finished is mid-flight. Editing the
        // email now is the one way this model reaches recipients with half-built content.
        activeNow: mine.some(function (c) {
          return !!c.activated_at && c.status !== 'finished';
        })
      };
    });
  }

  // run.json contract. An empty collection removes the section rather than stranding a
  // heading above nothing. Same for an empty sold set.
  function sectionsToRender(run) {
    return {
      collection: (run.collection || []).length > 0,
      sold: run.sold_mode === 'addresses'
        ? (run.sold || []).length > 0
        : !!(run.aggregate && run.aggregate.count),
      stats: !!(run.aggregate && run.aggregate.count)
    };
  }

  // ---- the gate -----------------------------------------------------------
  // `expected` carries run.json facts so a failed photo screen is visible in the same place
  // as everything else rather than sitting unread in the artefact.
  function verify(id, expected) {
    expected = expected || {};
    return Promise.all([G('/communications/' + id), sendState(id)])
      .then(function (both) {
        var c = both[0], send = both[1];
        var P = c.email.panelcontents;
        var flat = JSON.stringify(P);
        var imgs = P.filter(function (p) { return p.panel_id === 9; });
        var grids = P.filter(function (p) { return p.panel_id === 17; });
        var okImg = function (io) {
          return !!(io && io.id && io.key && io.secret && io.src);
        };
        return {
          id: id,
          name: c.name,
          subject: c.email.subject,
          positionsContiguous: P.every(function (p, i) { return p.position === i; }),
          imagesOk: imgs.every(function (p) { return okImg(p.contents.imageOne); }),
          gridsOk: grids.every(function (g) {
            var ls = g.contents.propertyListings || [];
            return g.options.feed === false &&
                   g.options.itemCount === ls.length &&
                   ls.length > 0 &&
                   ls.length % 2 === 0 &&
                   ls.every(function (l) {
                     return (l.images || []).length && l.images.every(okImg);
                   });
          }),
          noEmptyGrid: grids.every(function (g) {
            return (g.contents.propertyListings || []).length > 0;
          }),
          // Harrison, 20 Aug 2026: NO dashes at all, in any section. The old check
          // tested typographic dashes over the WHOLE payload, which was wrong twice:
          // it missed every ASCII hyphen (so "north-facing" in a listing description
          // passed), and it would now fire on the button URLs, which legitimately
          // contain "signature-collection" and "north-shore-city". Scope it to VISIBLE
          // COPY and widen the character class.
          noDash: (function () {
            var D = /[-\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u2043\ufe58\ufe63\uff0d]/;
            var bad = [];
            P.forEach(function (p, i) {
              var blocks = ((p.contents || {}).textOne || {}).blocks || [];
              blocks.forEach(function (b) {
                if (D.test(b.text)) bad.push(i + ':text');
              });
              if ((p.options || {}).buttonText && D.test(p.options.buttonText)) {
                bad.push(i + ':button');
              }
              ((p.contents || {}).propertyListings || []).forEach(function (l) {
                ['plaintextdescription', 'headline', 'displayprice', 'streetname', 'city']
                  .forEach(function (f) {
                    if (l[f] && D.test(String(l[f]))) bad.push(i + ':' + f);
                  });
              });
            });
            return bad.length === 0;
          })(),
          noSampleLabel: !/SAMPLE FIGURES/i.test(flat),
          // Exclude panel_id 17: an AP property grid legitimately carries
          // placeholderAddress, placeholderPrice and a property-panel-placeholder
          // image URL in editor-only fields, so a blanket test fails a good grid.
          noTemplateLeak: !/Anytown|Stapleford|Suburb Update/i.test(
            JSON.stringify(P.filter(function (p) { return p.panel_id !== 17; }))),
          // Each area must read label, then N times (image, button). If a button
          // loses its card, or two labels collide, this is what catches it.
          cardsOk: (function () {
            var seq = P.map(function (p) {
              if (p.panel_id === 6) {
                var t;
                try {
                  t = (p.contents.textOne.blocks || []).map(function (b) { return b.text; })
                        .join(' ').trim();
                } catch (e) { t = ''; }
                if (AREA_ORDER.some(function (g) { return AREA_LABELS[g] === t; })) return 'L';
              }
              return p.panel_id === 9 ? 'I' : (p.panel_id === 3 ? 'B' : '.');
            }).join('');
            var first = seq.indexOf('L');
            if (first < 0) return false;
            var last = seq.lastIndexOf('L');
            // walk to the end of the final area block
            var end = last;
            while (end + 1 < seq.length && (seq[end + 1] === 'I' || seq[end + 1] === 'B')) end++;
            // the whole span must be labels followed by image/button PAIRS, nothing else
            return /^(L(IB)+)+$/.test(seq.slice(first, end + 1));
          })(),
          // Every enquiry button must point somewhere distinct. Two cards sharing a
          // link means one property silently enquires about another.
          buttonsOk: (function () {
            var links = P.filter(function (p) {
              return p.panel_id === 3 &&
                     p.options.buttonText === 'REQUEST MORE INFORMATION';
            }).map(function (p) { return p.options.buttonLink || ''; });
            var uniq = {};
            links.forEach(function (l) { uniq[l] = 1; });
            return links.length > 0 &&
                   Object.keys(uniq).length === links.length &&
                   links.every(function (l) {
                     return l.indexOf(BOOK_BASE + '?intent=info') === 0 &&
                            /[?&]addr=[^&]+/.test(l) &&
                            l.indexOf('src=signature-collection') > -1;
                   });
          })(),
          // Exactly one "What I am seeing" panel, carrying THIS issue's paragraphs.
          // Two would mean a splice inserted instead of replacing; zero means the section
          // silently dropped; stale text means the note is last fortnight's read of the
          // market wearing this fortnight's date, which is the recycling risk in one panel.
          marketCommentOk: (function () {
            var hits = P.filter(isMarketComment);
            if (hits.length !== 1) return false;
            var blocks = (hits[0].contents.textOne || {}).blocks || [];
            if (blocks.length < 3) return false;
            var want = expected.marketComment;
            if (!want) return true;
            var got = blocks.map(function (b) { return b.text; }).join(' ');
            return (want.paragraphs || []).every(function (p) {
              return got.indexOf(p) > -1;
            });
          })(),
          category: c.communicationcategory.id,
          // Real send state, from campaigns. Not the old tautology.
          campaigns: send.campaigns,
          noActiveCampaign: !send.activeNow,
          previouslySent: send.everSent,
          coverScreened: expected.coverScreened === undefined ? null : expected.coverScreened,
          screenError: expected.screenError === undefined ? null : expected.screenError
        };
      });
  }


  // ---- Ray White New Zealand section: one card + one button per property ---
  // Added 18 Aug 2026. Before this, the card/button panels were built by hand in the console
  // each run, which meant the layout was not reproducible and the first attempt silently
  // deleted ten panels (see run-checklist). Everything below is the committed version.

  var BOOK_BASE = 'https://harrisoncutfield.co.nz/book.html';
  var AREA_LABELS = { shore: 'THE SHORE', auckland: 'ACROSS AUCKLAND',
                      beyond: 'THE REST OF NEW ZEALAND' };
  var AREA_ORDER = ['shore', 'auckland', 'beyond'];

  // The reader lands on book.html in intent=info mode: address prefilled and locked, no
  // timeframe, no time picker. Harrison gets an email naming the property. No calendar event.
  function enquiryUrl(card) {
    return BOOK_BASE +
      '?intent=info' +
      '&addr=' + encodeURIComponent(card.address + ', ' + card.suburb) +
      '&l=' + encodeURIComponent(card.href) +
      '&src=signature-collection' +
      '&s=' + encodeURIComponent(card.suburb);
  }

  function _key() {
    return 'sc' + Math.random().toString(36).slice(2, 10);
  }

  function _block(text, type, colour) {
    return {
      key: _key(), text: text, type: type || 'unstyled', depth: 0,
      inlineStyleRanges: colour
        ? [{ offset: 0, length: text.length, style: colour }] : [],
      entityRanges: [], data: {}
    };
  }

  // AP image panels need the SIX keys. The raw /properties endpoint returns a much richer
  // image object carrying url and cdn_url but NO src, and a panel built from it saves 200,
  // passes every structural check, and renders BLANK. Sort by position or the hero is
  // whatever order the API happened to return.
  function sixKeyImages(listing) {
    return (listing.images || [])
      .slice()
      .sort(function (a, b) { return (a.position || 0) - (b.position || 0); })
      .map(function (im) {
        return {
          id: im.id, src: im.cdn_url || im.url || im.src,
          key: im.key, secret: im.secret, width: im.width, height: im.height
        };
      });
  }

  // Harrison's own stock stays a NATIVE property grid, because AP renders beds, baths, cars,
  // price and REQUEST AN INSPECTION for our own listings and the flat cards cannot.
  // `template` is any existing panel_id 17 lifted from another communication.
  function collectionGrid(template, listings) {
    var opts = JSON.parse(JSON.stringify(template.options));
    opts.itemCount = listings.length;
    opts.feed = false;
    opts.backgroundColor = '#ffffff';
    opts.insetColor = '#ffffff';
    delete opts.detailsLayout;          // for-sale grid: DELETE so the button appears
    var contents = JSON.parse(JSON.stringify(template.contents));
    contents.propertyListings = listings.map(function (l) {
      var copy = JSON.parse(JSON.stringify(l));
      copy.images = sixKeyImages(l);
      return copy;
    });
    return { panel_id: 17, position: 0, groupkey: null, query: null,
             options: opts, contents: contents, restrictions: [] };
  }

  // cards: [{group, address, suburb, href, image}] in issue order, where `image` is the
  // uploaded AP image object for that property's composite card. Emits, per area:
  //   label, then N times (image panel, button panel)
  // Templates are lifted from panels already in the email so typography stays identical.
  function luxurySection(cards, tpl) {
    var panels = [];
    AREA_ORDER.forEach(function (group) {
      var mine = cards.filter(function (c) { return c.group === group; });
      if (!mine.length) return;         // an empty area drops whole, label and all
      panels.push({
        panel_id: 6, position: 0, groupkey: null, query: null,
        options: Object.assign({}, tpl.text.options, { backgroundColor: '#ffffff', padding: 26 }),
        contents: {
          textOne: { blocks: [_block(AREA_LABELS[group], 'unstyled', '#000000')], entityMap: {} },
          textTwo: null, textThree: null
        },
        restrictions: null
      });
      mine.forEach(function (card) {
        panels.push({
          panel_id: 9, position: 0, groupkey: null, query: null,
          options: Object.assign({}, tpl.image.options, { padding: 0, edgeBleed: false }),
          contents: { imageOne: card.image, imageTwo: null, imageThree: null, imageFour: null },
          restrictions: null
        });
        panels.push({
          panel_id: 3, position: 0, groupkey: null, query: null,
          options: Object.assign({}, tpl.button.options, {
            buttonText: 'REQUEST MORE INFORMATION',
            buttonLink: enquiryUrl(card),
            backgroundColor: '#ffffff', alignment: 'left', padding: 12
          }),
          contents: {}, restrictions: null
        });
      });
    });
    return panels;
  }

  // ---- "What I am seeing": Harrison's note -------------------------------
  // Added 27 Aug 2026 on Harrison's instruction. The copy is generated in
  // tools/market_comment.py, which is positive by SELECTION and raises rather than
  // hedging, so by the time it reaches here it is already true, already warm and already
  // dash free. This layer only lays it out.
  var COMMENT_HEADING = 'What I am seeing';

  function _firstBlockText(p) {
    try {
      var b = ((p.contents.textOne || {}).blocks || [])[0];
      return String((b || {}).text || '').trim();
    } catch (e) { return ''; }
  }

  function isMarketComment(p) {
    return p.panel_id === 6 && _firstBlockText(p) === COMMENT_HEADING;
  }

  // `note` is run.market_comment: {heading, paragraphs, signoff}.
  function marketComment(note, tpl) {
    var blocks = [_block(note.heading, 'header-two', '#000000')];
    (note.paragraphs || []).forEach(function (para) {
      blocks.push(_block(para, 'unstyled'));
    });
    if (note.signoff) blocks.push(_block(note.signoff, 'unstyled', '#595959'));
    return {
      panel_id: 6, position: 0, groupkey: null, query: null,
      options: Object.assign({}, tpl.text.options,
                             { backgroundColor: '#EBEBEC', padding: 26 }),
      contents: { textOne: { blocks: blocks, entityMap: {} },
                  textTwo: null, textThree: null },
      restrictions: null
    };
  }

  // Replace the note if it is already there, otherwise insert it at an index the CALLER
  // supplies. It never guesses where to put a new section, for the same reason
  // spliceLuxurySection does not: an email that quietly grows a second copy of Harrison's
  // comment every fortnight is worse than a run that stops and asks.
  //
  // Being replace-first is what makes this safe in a RECYCLED email. From issue 03 onward
  // the heading is already in the email, the anchor is exact, and `at` is never needed.
  function spliceMarketComment(P, built, at) {
    var hits = [];
    P.forEach(function (p, i) { if (isMarketComment(p)) hits.push(i); });
    if (hits.length > 1) {
      throw new Error(hits.length + ' market comment panels found (positions ' +
        hits.join(', ') + '). Refusing to guess which one is current: delete the extras.');
    }
    var out, action;
    if (hits.length === 1) {
      out = P.slice(); out[hits[0]] = built;
      action = 'replaced'; at = hits[0];
    } else {
      if (at === undefined || at === null) {
        throw new Error('no existing market comment panel and no insert index given. ' +
          'Read the panel list, decide where it goes, and pass the index.');
      }
      out = P.slice(0, at).concat([built], P.slice(at));
      action = 'inserted';
    }
    return { panels: out.map(function (p, i) {
      var c = Object.assign({}, p); c.position = i; return c;
    }), action: action, at: at };
  }

  // Replace the existing luxury section in `P` with freshly built panels.
  //
  // NEVER splice by regex on body text. The first attempt anchored on /THE SHORE/i, which
  // also matches the prose "Ray White homes above three million on the Shore". It swallowed
  // the cover note, The Collection heading and The Collection grid: ten panels gone, and
  // every structural gate still passed because the result was valid and simply wrong.
  // Anchor on an EXACT trimmed label match, and assert the panel-count delta you expect.
  function spliceLuxurySection(P, built) {
    var labelText = function (p) {
      try {
        return (p.contents.textOne.blocks || []).map(function (b) { return b.text; })
                 .join(' ').trim();
      } catch (e) { return ''; }
    };
    var isLabel = function (p) {
      if (p.panel_id !== 6) return false;
      var t = labelText(p);
      return AREA_ORDER.some(function (g) { return AREA_LABELS[g] === t; });
    };
    var first = -1, last = -1;
    P.forEach(function (p, i) {
      if (isLabel(p)) { if (first < 0) first = i; last = i; }
    });
    if (first < 0) throw new Error('no area label found: refusing to guess where the section starts');
    // the section runs to the last panel that is still part of the last area block
    var end = last;
    for (var i = last + 1; i < P.length; i++) {
      if (P[i].panel_id === 9 || P[i].panel_id === 3) { end = i; } else { break; }
    }
    var removed = end - first + 1;
    var out = P.slice(0, first).concat(built, P.slice(end + 1));
    return { panels: out.map(function (p, i) {
      var c = Object.assign({}, p); c.position = i; return c;
    }), removed: removed, added: built.length, at: first };
  }

  return { G: G, PUT: PUT, properties: properties, uploadFromRelay: uploadFromRelay,
           resolveIssueEmail: resolveIssueEmail, save: save, sendState: sendState,
           sectionsToRender: sectionsToRender, verify: verify,
           enquiryUrl: enquiryUrl, sixKeyImages: sixKeyImages,
           collectionGrid: collectionGrid, luxurySection: luxurySection,
           spliceLuxurySection: spliceLuxurySection,
           marketComment: marketComment, spliceMarketComment: spliceMarketComment,
           isMarketComment: isMarketComment, COMMENT_HEADING: COMMENT_HEADING };
})();
'SC ready';
