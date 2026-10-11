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

Hero and print, 100px and up. The About page carries it at 190px.

It holds down to roughly 100px. Below that the arms merge and the counter
closes; the glyph or the drawn O takes over.

## The mark  `olio-o.svg`

The O the field creates, drawn clean: upright, vertical stress, thick sides and
thin top, same rx/ry/weight as the field's counter. It is the same letter at a
resolution that survives 16px.

Favicon, app icon, avatar, and anywhere under 40px. It is NOT the header
lockup: a plain serif O beside "lio" reads as a differently shaped letter, not
as a logo.

## The glyph  `olio-glyph.svg`

The mark standing in for the first o of the wordmark. Same ribbon
construction, far fewer strands (11 arms of 14, plus a 5-arm core) and much
shorter arms, so the halo stays tight enough around the counter to set as a
letter. 56KB raw, 14KB gzipped.

Seating it: 1.62em with negative margins pulling the neighbouring letters back
in under the halo. That overlap is what makes it read as a letter rather than
a logo with a word after it. Mobile drops to 1.52em in a 26px wordmark; at the
desktop ratio it clips against the 80px header.

Adding a few of the field's chords to it was tried and rejected: at every size
it reads as a struck-through O rather than a swept one.

## Colour

Neither asset carries the brand accent. Users choose their accent in
Appearance, so a wine mark would fight a Midnight theme on every page. Both use
`currentColor`; the header uses a CSS mask rather than an `img` so it actually
inherits. Favicon and touch icon ship with fixed ink since no CSS reaches them.

## Regenerating

`o2.py` holds the construction, `final2.py` writes these files. The field is
seeded (seed=4). A different seed gives a different but equally valid medley,
so keep it fixed unless a new mark is intended.
