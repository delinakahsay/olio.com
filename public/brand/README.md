# Olio brand

Two assets, because they do different jobs and one cannot become the other.

## The field  `olio-field.svg`

160 long curves. Each is tangent to the same upright O and sweeps past it on
both sides, so the curves overlap everywhere and the counter is the only space
nothing touches. Incongruent lines arriving from every direction, one form in
the middle, which is what olio means.

Hero and print at full density, 150px and up. The About page carries it at
190px, which is the smallest size the full 160 lines still read as lines
rather than a halo.

It does not CROP. The lines are densest exactly at the O, so cropping in lands
on the blackest part of the drawing. But it does scale: reduce the line count
instead of the frame and it survives to about 40px. `olio-mark.svg` (16 lines)
is the header tier, `olio-mark-mid.svg` (24 lines) covers 56 to 96px. Below
roughly 40px nothing survives and the drawn O takes over.

## The mark  `olio-o.svg`

The O the field creates, drawn clean: upright, vertical stress, thick sides and
thin top, same rx/ry/weight as the field's counter. It is the same letter at a
resolution that survives 16px.

Favicon, app icon, avatar, and anywhere under 40px. It is NOT the header
lockup: a plain serif O beside "lio" reads as a differently shaped letter, not
as a logo. The header uses the field.

It can still stand in for a capital O where a letterform is wanted.

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
