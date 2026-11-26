# Shorthand to Schematic

Type a short script and get a schematic. Each version is a single self-contained HTML file with no
build step and no network calls: download it and open it in a browser.

## Versions

A new version is made only for a significant change: a new capability that changes how the app is used or what the
script can say. Smaller changes (interaction polish, layout tweaks, new rules or error messages) are made in the
current version. The git history keeps every step in between.

| File | Significant change it marks |
|---|---|
| `shorthandSchematicV8.html` | Current. Several designs on one canvas: a name line after a closing `*\` starts the next design, drawn directly below the one above in its own border (Enter on a closing `*\` types the new `*`). References: `REF = X2` on an element links it to another element, looked up in its own design first and then in the others; `REF = Design.X2` names the design (like a member in C), and several go in brackets, `REF = [X2, Other.Y]`. A link is a grey dotted line with a chain in the middle, routed around every element and kept off wires where it can; an unknown, ambiguous or missing name is an error naming the line. A branch of a flow diagram that does not return must finish with `END` so a simulation has an endpoint; circuits are exempt. Saved scripts are kept apart from V7's. |
| `shorthandSchematicV7.html` |  Ground is only where `GND` is written and always drawn, facing down in both views; the implied ground return and its Setting are gone. One `GND` first or last on the path joins both ends of the circuit (`*V1, R1, GND\ VOLT_SRC = 5, RES = 1k, GND; MEAS I, ,`); a `GND` in the middle is only a reference. Circuits are checked before solving, with the line named. Errors (red X, no readings): `MEAS` with no `GND`, a loop of only voltage sources and inductors, a node touching only current sources (or, in DC, only current sources and capacitors), a repeated part name, a measured part on a dead-end branch. Warnings (amber, still solved): an open end, a part with both ends on one node, a group not connected to `GND`, more than two `GND` points, `MEAS` on a `GND`. Script rules: a group needs one entry per element (more is an error, fewer a warning; `NULL` or a bare comma skips one), and the entries need not be the same kind (`PROC, RED, MEAS V`); `END` is element-wise like the rest (`*DONE, OFF\ PINK, BLACK; NULL, END` ends OFF); brackets hold several specifiers for one element (`[BLUE, PROC = cool down]`, `[RED RES = 1k, MEAS V]`), while a bracket after `=` is still a value; a value belongs to the shape or part right before `=` (`BLUE PROC = cool down`, not `PROC BLUE = cool down`); a `DEC` needs two paths out, yes and no; `RETURN^N` has a floor of 1 and a ceiling of the path's depth below the main path. Every specifier word is written in capitals as you type it: the letters turn to capitals as soon as they can only be a specifier word (`pr` shows `PR`), a prefix with only one possible word autofills on space, comma or Enter (`pro` becomes `PROC`, `yel` becomes `YELLOW`), and `b` becomes `BRANCH`, `e` becomes `END`; colors have no letter and are spelled out. Typing aids: a space after a name in an element list types `, `; Enter right after the backslash (or after a comma in the specifier) opens `[` for that element, Enter inside the bracket closes it with `], `, and Enter right after that drops the comma and starts the next line with `*`. Enter after a word that takes a value (`PROC`, `DEC`, `IO` and every part but `DIODE` and `GND`) types ` = `, and Enter does nothing until something is typed after the `=`; a word left with `=` and no value warns. The diode is the textbook constant-drop model, `DIODE = [FWD_VOLT, REV_VOLT]`: on, it holds exactly FWD_VOLT (0.7 V unless given); off, it is open; past REV_VOLT backwards it breaks down and holds that voltage (a Zener, `REV DIODE = [0.7, 5.1]`). With no REV_VOLT it never breaks down. A current reading sits above its arrow. Saved scripts are kept apart from V6's. |
| `shorthandSchematicV6.html` | Circuits close through a ground return drawn along the bottom (Settings can move it to the top); `GND` ties a point to ground (a branch with no return is left open); `MEAS` markers show DC readings from a built-in solver (modified nodal analysis: RES, CAP open, IND short, sources, Shockley diode, dependent sources `[2*V(R1)]` and `[0.5*I(R1)]`). AC sources `VAC` and `IAC` (`AC_VOLT_SRC = 5 cos(377t + 30)` or `[5, 377, 30]`) solved in phasors, one solve per omega, added by superposition. A reading is written in the form named after `MEAS`: `POLE`, `RECT` or `SINE` (`MEAS V RECT`). `RECT` is no longer a shape word, since a plain box is the default. Enter closes an open list with `\` or starts the next line with `*` typed, so it can replace the hotkey. A top-down view (arrow button by the zoom buttons, or Settings). A Settings page holds configurations: the ground position and the direction. |
| `shorthandSchematicV5b.html` | Circuit parts in the same diagram as the blocks: `R` `C` `L` `D` and the sources `VS` `IS` `DVS` `DIS` (dependent ones as diamonds) drawn as symbols on the wire, values read in their unit with SI prefixes (`R = 4.7k` shows 4.7 kΩ, `C = 10u` shows 10 µF; `4.7kΩ`, `4.7k ohm`, `4.7e3` also work), single letters case-sensitive (`C` capacitor, `c` circle), small shorthand letters written out as capital words as you type (`s` then a space becomes `SERIES`; Backspace takes the whole word), click a part to step through the parts. |
| `shorthandSchematicV5a.html` | Flow blocks and values: specifier groups (semicolons split property types, commas give one entry per element), `proc` `dec` `io` (letters `p d i`), values after `=` shown in the block (`[ ]` for values with commas), color words, yes/no on decisions, apostrophe hotkey, an end must be the last element of its path. |
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

V5b circuit parts: `*R1, C1\ R = 4.7k, C = 10u; red, blue`. Sources: `VS` volts, `IS` amps, `DVS` and `DIS` dependent (an expression with `*` goes in brackets: `DVS = [2*Vx]`).
Directional parts (`VS IS DVS DIS D`) are drawn negative to positive along the path; `REV` in the entry reverses one: `*V1\ VS REV = 5`. Everything is drawn in black unless a color word is given.
Part codes are written out as you type: `R` RES, `C` CAP, `L` IND, `D` DIODE, `VS` VOLT_SRC, `IS` CURR_SRC, `DVS` DEP_VOLT_SRC, `DIS` DEP_CURR_SRC.
`MEAS V` (shorthand `m`) marks the voltage across a part and `MEAS I` the current through it: `*R_1\ RES = 4.7k; MEAS V` draws `+ V −` over the resistor. The number comes later, with a circuit solver; a source cannot measure its own quantity. Prefixes `p n u µ m k M G` (`m` milli, `M` mega). A diode's value is shown as typed.
V6 AC sources: `*V1, R1, C1\ AC_VOLT_SRC = 10 cos(1000t), RES = 1k, CAP = 1u; , , MEAS V` reads `7.07 V ∠ −45°` over the capacitor. The value is amplitude, omega in rad/s and angle in degrees, written as the sinusoid (`sin` also works, a prefix goes on the amplitude: `2m cos(1000t)`) or as `[amp, omega, angle]`. Codes `VAC` `IAC`, written out as `AC_VOLT_SRC` `AC_CURR_SRC`. Each source keeps its own omega; readings with several terms are written as a sum (`2 V + 3 V ∠ 0° @ 1000 rad/s`). The form goes after `MEAS`, per marker: `POLE` `7.07 V ∠ −45°` (the default), `RECT` `5 − j5 V`, `SINE` `7.07 cos(1000t − 45°) V`. From V6 `rect`, `rectangle` and `x` are no longer shapes: a box is the default, and an old script that uses them still draws a box, with a warning. A diode with AC sources is not solved yet (it needs a time simulation).

From V5b, single letters are case-sensitive (capitals are parts, small letters are shapes and commands); full words match in any case.

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
node tests/testV5b.js
node tests/testV6.js
node tests/testV7.js
node tests/testV8.js
```

`testV2.js` to `testV5a.js` also run against other versions by changing `APP_FILE`.
