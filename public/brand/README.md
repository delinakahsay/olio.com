# Olio brand

Two assets, because they do different jobs and one cannot become the other.

## The field  `olio-field.svg`

Ribbons, not single lines. Nine arms of 64 near-parallel strands each, plus a
second pass of five arms that wrap further and stay close to the counter. The
moire comes from sheets crossing sheets; single chords only ever looked spiky.

Each strand is a spiral that flares wide at the tip and eases in until it hugs
the O. Within an arm the start angle, the turn and the tip radius all drift,
so the strands fan into a sheet. The tip radius peaks mid-ribbon rather than
varying linearly, which is what tapers each arm to a point instead of cutting
it off flat.

Incongruent things arriving from every direction, one form in the middle,
which is what olio means.

Weight: 274KB raw, 72KB gzipped. Heavy for an SVG, cheap for a hero image,
and it caches. Do not inline it.

It opens an empty conversation at 152px, 112px on phones, and the About page
at 190px. It needs about 140px before the coil resolves; smaller than that it
reads as a blob.

The header is plain text. A mark up there competed with the one on the chat
and neither won.

It holds down to roughly 100px. Below that the arms merge and the counter
closes; the glyph or the drawn O takes over.

## The mark  `olio-o.svg`

The O the field creates, drawn clean: upright, vertical stress, thick sides and
thin top, same rx/ry/weight as the field's counter. It is the same letter at a
resolution that survives 16px.

Favicon and app icon only. Nothing woven survives at 16px.

## Colour

The field uses `currentColor` and is masked in CSS, so it takes whatever the
page sets. On the chat and About it is drawn in the accent, which means it
follows whichever palette the viewer picked. Favicon and touch icon ship with
fixed ink since no CSS reaches them.

## Regenerating

`o2.py` holds the construction, `final2.py` writes these files. The field is
seeded (seed=4). A different seed gives a different but equally valid medley,
so keep it fixed unless a new mark is intended.
