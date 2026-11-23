# Shorthand to Schematic

Type a short script and get a schematic. Each version is a single self-contained HTML file with no
build step and no network calls: download it and open it in a browser.

| File | What it is |
|---|---|
| `shorthandSchematicV3.html` | Current. Half-width collapsible script panel, bottom current-line box, open-wait chips. |
| `shorthandSchematicV2.html` | Period hotkey, auto-tabbing, one-line typing, shorthand, highlights, Help legend. |
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

Press the period key to type `*` and `\` (or type them yourself). The Help button in the app has the full legend.
Shorthand (tentative): `s` series, `b` branch, `w` wait, `r` return, `r2` return^2, `e` end.

## Tests

The parser sits between `CORE-START` and `CORE-END` comments in each page and is tested under Node
(no packages needed):

```
node tests/testV2.js
node tests/testV3.js
APP_FILE=shorthandSchematicV3.html node tests/testV2.js
```
