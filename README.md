# Shorthand to Schematic

Type a short script and get a schematic. Each version is a single self-contained HTML file with no
build step and no network calls: download it and open it in a browser.

## Versions

A new version is made only for a significant change: a new capability that changes how the app is used or what the
script can say. Smaller changes (interaction polish, layout tweaks, new rules or error messages) are made in the
current version. The git history keeps every step in between.

| File | Significant change it marks |
|---|---|
| `shorthandSchematicV5a.html` | Current. Flow blocks and values: specifier groups (semicolons split property types, commas give one entry per element), `proc` `dec` `io` (letters `p d i`), values after `=` shown in the block (`[ ]` for values with commas), color words, yes/no on decisions, apostrophe hotkey, an end must be the last element of its path. |
| `shorthandSchematicV4.html` | Visual editing: shape commands (`tri`, `rect`, `circ`, `dia`), click a block to change its shape, an endless white canvas with free pan and wheel zoom, a draggable and collapsible script panel, the schematic must be named first. |
| `shorthandSchematicV3.html` | Working without the script panel: half-width collapsible panel, bottom current-line box, open-wait chips. |
| `shorthandSchematicV2.html` | Fast typing and live feedback: period hotkey, auto-tabbing, one-line typing, shorthand, highlights, Help legend. |
| `shorthandSchematicV1.html` | The original spec build (indentation and `meet` decide the picture). Frozen. |

## Script format

```
*Schematic\
*S, A\ series
*A_1\ branch wait
*A_2, B_2\ branch return^2
*B_1\ return
*B\ series
*C, D\ series
*E\ end
*\
```

In V5a the apostrophe key types `*` and `\` (V2 to V4 use the period); you can type them yourself. The Help button in the app has the full legend.
Shapes go first in the specifier (the text after the backslash), one per element: `*A, B\ tri, rect, branch wait` (also `circ`, `dia`, letters `t x c d`).
Click a block in the diagram to step its shape; the word is written into the script.
Shorthand (tentative): `s` series, `b` branch, `w` wait, `r` return, `r2` return^2 (V2 to V4 also `e` end; in V5a end is spelled out).

V5a specifier: `*A, B\ proc = read, dec red = [x > 10, y < 3]; branch wait`. Colors: red orange yellow green blue purple pink gray black.

## Tests

The parser sits between `CORE-START` and `CORE-END` comments in each page and is tested under Node
(no packages needed):

```
APP_FILE=shorthandSchematicV4.html node tests/testV2.js
APP_FILE=shorthandSchematicV4.html node tests/testV3.js
node tests/testV4.js
node tests/testNameFirst.js
node tests/testEndRule.js
node tests/testV5a.js
```

`testV2.js` and `testV3.js` also run against the earlier versions by changing `APP_FILE`.
