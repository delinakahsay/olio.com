# Olio mark

Generated, not drawn. Strands enter from the rim at irregular angles, radii and
curvature; every one resolves tangent to the same inner ellipse, which is
rotated onto a stress axis so the counter reads as an O rather than a circle.
Irregular arriving, one letter in the middle.

The mark is deliberately NOT in the brand accent. Users choose their accent in
Appearance, so a wine mark would clash with a Midnight theme. All tiers use
`currentColor` and inherit the page ink.

Sizes. Each is the same construction at a strand count and weight that survives
that size; a single file scaled down turns to mush below about 40px.

| File | Use | Strands | Weight | Crop |
|---|---|---|---|---|
| olio-mark.svg | 80px and up, hero, print | 132 | 0.55 | full |
| olio-mark-64.svg | 40 to 79px | 30 | 1.25 | 17 17 66 66 |
| olio-mark-32.svg | 24 to 39px | 24 | 1.6 | 17 17 66 66 |
| olio-mark-16.svg | under 24px, inline | 18 | 2.0 | 17 17 66 66 |
| favicon.svg | browser tab | 18 | 2.0 | fixed ink |
| apple-touch-icon.svg | home screen | 30 | 1.25 | fixed ink |

Regenerate with the scripts in the design scratch (`o.py`, `final.py`). The
hero is seeded (seed=5); changing the seed gives a different but equally valid
medley, so keep the seed fixed unless you intend a new mark.
