# Olio brand

Two assets, because they do different jobs and one cannot become the other.

## The field  `olio-field.svg`

160 long curves. Each is tangent to the same upright O and sweeps past it on
both sides, so the curves overlap everywhere and the counter is the only space
nothing touches. Incongruent lines arriving from every direction, one form in
the middle, which is what olio means.

Hero, about page, print, section breaks, loading states. **80px and up.**

It does not shrink. The lines are densest exactly at the O, because that is
where they all converge, so cropping in lands on the blackest part of the
drawing. Do not make an icon out of it.

## The mark  `olio-o.svg`

The O the field creates, drawn clean: upright, vertical stress, thick sides and
thin top, same rx/ry/weight as the field's counter. It is the same letter at a
resolution that survives 16px.

It doubles as the capital O at the head of the wordmark, so the header reads
`[mark]lio`. Favicon, app icon, avatar, header, anywhere under 80px.

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
