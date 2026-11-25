// node testV7.js [outDir] -> explicit GND (no implied return wire) and the circuit validity checks (shorthandSchematicV7.html)
const fs = require('fs'), vm = require('vm'), path = require('path');
const page = fs.readFileSync(path.join(__dirname, '..', process.env.APP_FILE || 'shorthandSchematicV7.html'), 'utf8');
const core = page.split('// ==CORE-START==')[1].split('// ==CORE-END==')[0];
const ctx = {}; vm.createContext(ctx);
vm.runInContext(core + ';this.A={parse,renderSVG,SETTINGS}', ctx);
const A = ctx.A;
let fails = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) fails++; };
const byLabel = (m, l) => m.nodes.find(n => n.type === 'el' && n.label === l);
const P = s => A.parse('*T\\\n' + s + '\n*\\');
const near = (a, b, tol) => typeof a === 'number' && Math.abs(a - b) <= (tol || 1e-6) * Math.max(1, Math.abs(b));
const has = (list, re) => list.some(x => re.test(x));
const show = m => JSON.stringify({ e: m.errors, w: m.warnings });

// a closed loop is written with GND at each end: nothing is grounded unless it is written
let m = P('*G1, V1, R1, G2\\ GND, VS = 5, RES = 1k, GND; , , MEAS I,');
ok('GND at both ends: 5 mA through R1, no notes', near(byLabel(m, 'R1').measNum, 5e-3) && !m.errors.length && !m.warnings.length, show(m));
m = P('*G1, V1, R1, G2\\ GND, VS = 5, RES = 1k, GND; , , MEAS V,');
ok('GND at both ends: 5 V across R1', near(byLabel(m, 'R1').measNum, 5), show(m));
ok('the drawing has no implied ground return wire', !/class="gnd"/.test(A.renderSVG(m)) && (A.renderSVG(m).match(/ground|M[\d. ]+ L/g) || []).length > 0);
ok('the Settings no longer hold a ground position', !('groundPos' in A.SETTINGS) && A.SETTINGS.direction === 'lr');

// errors
m = P('*V1, R1\\ VS = 5, RES = 1k; , MEAS V,');
ok('no GND with a MEAS is an error naming the line', has(m.errors, /^Line 2: no GND/) && m.sim === undefined, show(m));
ok('no GND and no MEAS stays silent', (() => { const q = P('*V1, R1\\ VS = 5, RES = 1k'); return !q.errors.length && !q.warnings.length; })());
m = P('*G1, V1, G2\\ GND, VS = 5, GND; , MEAS I,');
ok('a source with ground at both ends is a loop with the wire: error', has(m.errors, /form a loop|both ends on the same node/), show(m));
m = P('*G1, V1, V2, G2\\ GND, VS = 5, VS = 3, GND; , , MEAS I,');
ok('two sources from ground to ground: loop error names both', has(m.errors, /V1, V2 form a loop of only voltage sources and inductors/) && byLabel(m, 'V1').badEnd && byLabel(m, 'V2').badEnd, show(m));
ok('the loop error stops the solve', m.sim === undefined);
m = P('*G1, I1, I2, G2\\ GND, CURR_SRC = 1m, CURR_SRC = 2m, GND; , , MEAS V,');
ok('two current sources in series: current-source cut', has(m.errors, /node that touches only current sources/), show(m));
m = P('*G1, R1, R1, G2\\ GND, RES = 1k, RES = 2k, GND; MEAS V,');
ok('duplicate names: line of the second one', has(m.errors, /^Line 2: R1 is already used on line 2/) || has(m.errors, /R1 is already used/), show(m));
m = P('*G1, V1, R1, G2\\ GND, VS = 5, RES = 1k, GND\n*R2, R3\\ RES = 1k, RES = 1k; BRANCH; , MEAS V,');
ok('a measured part on a dead-end branch is an error', has(m.errors, /R3 is not on a closed path to GND/) && byLabel(m, 'R3').badEnd, show(m));
ok('one GND closes the loop: it ties both ends of the main path', (() => { const q = P('*G1, V1, R1\\ GND, VS = 5, RES = 1k; , MEAS I,'); return !q.errors.length && !q.warnings.length && near(byLabel(q, 'V1').measNum, 5e-3); })(), show(P('*G1, V1, R1\\ GND, VS = 5, RES = 1k; , MEAS I,')));
ok('one GND last ties the start: the same loop', (() => { const q = P('*V1, R1, G1\\ VS = 5, RES = 1k, GND; MEAS I, ,'); return !q.errors.length && !q.warnings.length && near(byLabel(q, 'V1').measNum, 5e-3); })(), show(P('*V1, R1, G1\\ VS = 5, RES = 1k, GND; MEAS I, ,')));
ok('one GND in the middle ties nothing: its open ends are warned about', (() => { const q = P('*V1, G1, R1\\ VS = 5, GND, RES = 1k'); return !q.errors.length && has(q.warnings, /left end of V1 is open/) && has(q.warnings, /right end of R1 is open/); })(), show(P('*V1, G1, R1\\ VS = 5, GND, RES = 1k')));
ok('a branch that never reaches ground still cannot be measured with one GND', (() => { const q = P('*G1, V1, R1\\ GND, VS = 5, RES = 1k\n*R2, R3\\ RES = 1k, RES = 1k; BRANCH; , MEAS V,'); return /R3 is not on a closed path/.test(q.errors.join()); })());

// entries and elements pair up one to one inside a group
m = P('*A, B\\ tri, dia, circ');
ok('more entries than elements is an error naming the extra entry', has(m.errors, /Line 2: 3 entries for 2 elements in "tri, dia, circ": nothing to apply "circ" to/), show(m));
m = P('*A, B, C\\ tri, dia');
ok('fewer entries than elements is a warning naming who gets none', has(m.warnings, /2 entries for 3 elements in "tri, dia": C gets none/) && !m.errors.length, show(m));
ok('a trailing bare comma skips an element on purpose, no note', (() => { const q = P('*A, B, C\\ tri, dia,'); return !q.errors.length && !q.warnings.length; })());
ok('a group that is only a command is left alone', (() => { const q = P('*A, B, C\\ branch wait'); return !has(q.errors, /entr/) && !has(q.warnings, /entr/); })());
m = P('*V1, R1\\ VS = 5, RES = 1k, RES = 2k');
ok('an extra value entry is an error too', has(m.errors, /3 entries for 2 elements/), show(m));
m = P('*A, B\\ red; blue; green');
ok('each group is counted on its own', has(m.warnings, /1 entry for 2 elements in "red"/) && has(m.warnings, /"blue"/) && has(m.warnings, /"green"/), show(m));

m = P('*V1, R1, C1, I1, G1\\ AC_VOLT_SRC = 10 cos(1000t), RES = 1k, CAP = 1u, CURR_SRC = 2m, GND; , MEAS V, , , ');
ok('a DC current source that reaches a node only through a capacitor is an error', has(m.errors, /C1, I1 meet at a node where a DC current source sees only capacitors/) && m.sim === undefined, show(m));
m = P('*V1, R1, C1, I1, G1\\ AC_VOLT_SRC = 10 cos(1000t), RES = 1k, CAP = 1u, AC_CURR_SRC = [2m, 1000, 0], GND; , MEAS V, , , ');
ok('an AC current source next to a capacitor is fine', !m.errors.length && m.sim && m.sim.ok, show(m));

vm.runInContext('this.A.fmtEng = fmtEng', ctx);
ok('a reading just under a prefix step reads 1 V, not 1000 mV', A.fmtEng(0.99996, 'V') === '1 V' && A.fmtEng(-0.99996, 'V') === '−1 V' && A.fmtEng(0.5, 'V') === '500 mV', A.fmtEng(0.99996, 'V'));

// warnings: the circuit still solves
m = P('*G1, V1, R1, G2\\ GND, VS = 5, RES = 1k, GND; , , MEAS I\n*C1\\ CAP = 1u; BRANCH');
ok('open end warns and the rest still solves', has(m.warnings, /right end of C1 is open/) && !m.errors.length && m.sim && m.sim.ok && near(byLabel(m, 'R1').measNum, 5e-3), show(m));
m = P('*V1, G1, R1, G2\\ VS = 5, GND, RES = 1k, GND; , , MEAS I,');
ok('a part with both ends on ground warns that it reads 0', has(m.warnings, /both ends of R1 are the same node/) && !m.errors.length && m.sim && m.sim.ok, show(m));
m = P('*G1, R1, G2, G3\\ GND, RES = 1k, GND, GND; , MEAS V,');
ok('more than two GND points is a warning', has(m.warnings, /GND appears 3 times/), show(m));
m = P('*G1, V1, R1, G2\\ GND, VS = 5, RES = 1k, GND; , , MEAS V,');
ok('the normal two-GND loop gets no notes at all', !m.warnings.length && !m.errors.length, show(m));


// the solver itself is unchanged from V6; these confirm it still gives the same numbers once ground is written
const rd = (s, l) => { const q = P(s), n = byLabel(q, l); return n && n.measNum; };
const W = (parts, vals, meas) => `*G1, ${parts}, G2\\ GND, ${vals}, GND; ${meas},`;
ok('divider: 10 V over two 1k gives 5 mA and 5 V', near(rd(W('V1, R1, R2', 'VS = 10, RES = 1k, RES = 1k', ', , MEAS I,'), 'R1'), 5e-3) && near(rd(W('V1, R1, R2', 'VS = 10, RES = 1k, RES = 1k', ', , , MEAS V'), 'R2'), 5));
ok('capacitor is open in DC', rd(W('V1, R1, C1', 'VS = 5, RES = 1k, CAP = 1u', ', , MEAS I,'), 'R1') === 0 && near(rd(W('V1, R1, C1', 'VS = 5, RES = 1k, CAP = 1u', ', , , MEAS V'), 'C1'), 5));
const vd = rd(W('V1, R1, D1', 'VS = 5, RES = 1k, DIODE', ', , , MEAS V,'), 'D1');
ok('forward diode drops about 0.69 V', vd > 0.6 && vd < 0.75, String(vd));
ok('dependent voltage source [2*V(Rx)]', near(rd(W('V1, R1, Rx, E1, R2', 'VS = 1, RES = 1k, RES = 1k, DEP_VOLT_SRC = [2*V(Rx)], RES = 1k', ', , , , , MEAS V,'), 'R2'), 1));
m = P('*G1, V1, R1, C1, G2\\ GND, AC_VOLT_SRC = 10 cos(1000t), RES = 1k, CAP = 1u, GND; , , , MEAS V,');
ok('RC: V_C = 7.07 V ∠ −45°', byLabel(m, 'C1').measValue === '7.07 V ∠ −45°' && !m.errors.length && !m.warnings.length, show(m) + byLabel(m, 'C1').measValue);

m = P('*G1, V1, R1, G2\\ GND, VS = 5, RES = 1k, GND; , , , MEAS I,');
ok('MEAS on a GND is a warning and draws no marker', has(m.warnings, /GND has nothing to measure/) && !byLabel(m, 'G2').meas && !/class="meas"/.test(A.renderSVG(m)), show(m));

// the location words are capitals, typed in full or as a letter (Josue, 11/25)
vm.runInContext('this.A.expand = expandAtCaret; this.A.EXAMPLE = EXAMPLE', ctx);
const ex = (text) => (A.expand(text, text.length) || { text }).text;
ok('series, branch, return, wait and end typed in full become capitals', ex('*A\\ series ') === '*A\\ SERIES ' && ex('*A\\ branch ') === '*A\\ BRANCH ' && ex('*A\\ return,') === '*A\\ RETURN,' && ex('*A\\ wait ') === '*A\\ WAIT ' && ex('*A\\ end ') === '*A\\ END ');
ok('return with a number too, and a letter still works', ex('*A\\ return^2 ') === '*A\\ RETURN^2 ' && ex('*A\\ r2 ') === '*A\\ RETURN^2 ' && ex('*A\\ b ') === '*A\\ BRANCH ');
ok('one letter and a space writes each word out: s b w r e', ex('*A\\ s ') === '*A\\ SERIES ' && ex('*A\\ b ') === '*A\\ BRANCH ' && ex('*A\\ w ') === '*A\\ WAIT ' && ex('*A\\ r ') === '*A\\ RETURN ' && ex('*A\\ e ') === '*A\\ END ' && ex('*A\\ RES = 1e3 ') === '*A\\ RES = 1e3 ');
// colors are spelled out: full words become capitals, no single letter writes one, and they still draw
const colorNames = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'gray', 'grey', 'black'];
ok('every color typed in full becomes capitals', colorNames.every(c => ex('*A\\ ' + c + ' ') === '*A\\ ' + c.toUpperCase() + ' ' && ex('*A\\ tri, ' + c + ',') === '*A\\ tri, ' + c.toUpperCase() + ','), colorNames.map(c => ex('*A\\ ' + c + ' ')).join(' '));
ok('a color typed in capitals or mixed case is left or fixed', ex('*A\\ RED ') === '*A\\ RED ' && ex('*A\\ Red ') === '*A\\ RED ');
ok('no color has a letter: o, y, g, k and u do nothing; b and r stay BRANCH and RETURN', ['o', 'y', 'g', 'k', 'u'].every(l => ex('*A\\ ' + l + ' ') === '*A\\ ' + l + ' ') && ex('*A\\ b ') === '*A\\ BRANCH ' && ex('*A\\ r ') === '*A\\ RETURN ');
ok('a color inside a value or an element name is left alone', ex('*A\\ proc = red ') === '*A\\ proc = red ' && ex('*red\\ ') === '*red\\ ');
ok('capital colors still paint the element', (() => { const q = P('*A, B\\ proc, proc; RED, BLUE'); return !q.errors.length && !q.warnings.length && byLabel(q, 'A').color === 'red' && byLabel(q, 'B').color === 'blue'; })(), show(P('*A, B\\ proc, proc; RED, BLUE')));
ok('a circuit part takes a capital color too', (() => { const q = P('*G1, V1, R1, G2\\ GND, VS = 5, RES = 1k, GND; , , GREEN, '); return !q.errors.length && byLabel(q, 'R1').color === 'green'; })(), show(P('*G1, V1, R1, G2\\ GND, VS = 5, RES = 1k, GND; , , GREEN, ')));
ok('Backspace takes a written-out color whole', (() => { const t = '*A\\ RED'; const r = (vm.runInContext('backspaceWord', ctx))(t, t.length, false); return !!r && r.from === 4 && r.to === t.length; })());
// every specifier word is capitals, shapes and part words and MEAS included
const specWords = ['proc', 'dec', 'io', 'tri', 'circ', 'dia', 'auto', 'process', 'decision', 'triangle', 'circle', 'diamond', 'res', 'cap', 'ind', 'diode', 'volt_src', 'curr_src', 'dep_volt_src', 'dep_curr_src', 'ac_volt_src', 'ac_curr_src', 'gnd', 'meas', 'rev', 'pole', 'sine', 'rect'];
ok('every specifier word typed in full becomes capitals', specWords.every(w => ex('*A\\ ' + w + ' ') === '*A\\ ' + w.toUpperCase() + ' ' && ex('*A\\ x, ' + w + ',') === '*A\\ x, ' + w.toUpperCase() + ','), specWords.filter(w => ex('*A\\ ' + w + ' ') !== '*A\\ ' + w.toUpperCase() + ' ').join(' '));
ok('the shape letters write out as capital words', ex('*A\\ p ') === '*A\\ PROC ' && ex('*A\\ d ') === '*A\\ DEC ' && ex('*A\\ i ') === '*A\\ IO ' && ex('*A\\ t ') === '*A\\ TRI ' && ex('*A\\ c ') === '*A\\ CIRC ' && ex('*A\\ m ') === '*A\\ MEAS ');
ok('a script in all capitals parses the same as lower case', (() => {
  const lo = P('*A, B, C\\ proc, dec red, io; branch wait'), up = P('*A, B, C\\ PROC, DEC RED, IO; BRANCH WAIT');
  return JSON.stringify(lo.nodes.map(n => [n.label, n.shape, n.color])) === JSON.stringify(up.nodes.map(n => [n.label, n.shape, n.color])) && up.errors.length === lo.errors.length;
})());
ok('already capitals, a value and an element name are left alone', ex('*A\\ BRANCH ') === '*A\\ BRANCH ' && ex('*A\\ proc = end ') === '*A\\ proc = end ' && ex('*end\\ ') === '*end\\ ');
ok('the example script is in capitals and still parses clean', /SERIES/.test(A.EXAMPLE) && !/ (series|branch|wait|return|end)\b/.test(A.EXAMPLE) && (m = A.parse(A.EXAMPLE), !m.errors.length));

// RETURN^N: floor 1, ceiling = how far the path is from the main path (Josue, 11/25)
const deep = r => P('*A\\ SERIES\n*B\\ BRANCH WAIT\n*C\\ BRANCH WAIT\n*D\\ ' + r + '\n*E\\ RETURN\n*F\\ SERIES');
ok('RETURN^2 from two levels down is fine', !deep('RETURN^2').errors.length, show(deep('RETURN^2')));
ok('RETURN^3 from two levels down is past the main path', has(deep('RETURN^3').errors, /Line 5: RETURN\^3 goes past the main path: this path is 2 levels from it, so the most is RETURN\^2/), show(deep('RETURN^3')));
ok('RETURN^0 is below the floor', has(deep('RETURN^0').errors, /Line 5: RETURN\^0 is below the floor; the least is RETURN\^1/), show(deep('RETURN^0')));
m = P('*A\\ SERIES\n*B\\ BRANCH RETURN^2\n*C\\ SERIES');
ok('a branch that returns on its own line counts its own level: one level, so RETURN^2 is too far', has(m.errors, /RETURN\^2 goes past the main path: this path is 1 level from it, so the most is RETURN\^1/), show(m));
ok('the example with RETURN^2 still parses clean', !A.parse(A.EXAMPLE).errors.length);

// a value belongs to the word right before = (Josue, 11/25)
m = P('*A, B\\ PROC BLUE = cool down, PROC');
ok('PROC BLUE = x is an error that shows the fix', has(m.errors, /in "PROC BLUE = cool down" the value follows BLUE, but only a shape or a part takes a value\. Write it right after the shape: BLUE PROC = cool down\./), show(m));
m = P('*A, B\\ BLUE PROC = cool down, PROC');
ok('BLUE PROC = x is fine and paints and fills the block', !m.errors.length && byLabel(m, 'A').color === 'blue' && byLabel(m, 'A').value === 'cool down', show(m));
m = P('*G1, V1, R1\\ GND, VS = 5, RES RED = 1k');
ok('the same for parts: RES RED = 1k is an error, RED RES = 1k is not', has(m.errors, /Write it right after the shape: RED RES = 1k/) && !P('*G1, V1, R1\\ GND, VS = 5, RED RES = 1k').errors.length, show(m));
m = P('*A\\ RED = x');
ok('a value with no shape at all says to add one', has(m.errors, /value follows RED.*Add one before =, like PROC = \.\.\./), show(m));

// a decision needs two outputs, yes and no (Josue, 11/25)
m = P('*A, CHECK, B\\ PROC, DEC = [x > 1], PROC');
ok('a decision with one path out is an error and gets the red X', has(m.errors, /CHECK is a decision, so it needs two paths out of it, yes and no; it has one/) && byLabel(m, 'CHECK').badEnd, show(m));
m = P('*A, CHECK\\ PROC, DEC = [x > 1]');
ok('a decision at the end of a path has none', has(m.errors, /it has none/), show(m));
m = P('*A, CHECK\\ PROC, DEC = [x > 1]\n*NO\\ PROC; BRANCH\n*YES\\ PROC');
ok('a decision with a BRANCH after it has yes and no', !has(m.errors, /decision/), show(m));

// END is element-wise, NULL skips a place, and brackets hold several specifiers for one element (Josue, 11/25)
m = P('*A\\ SERIES\n*DONE, OFF\\ PINK, BLACK; END');
ok('"PINK, BLACK; END" ends the first element, which is refused, and says OFF gets none', has(m.errors, /DONE is marked end, but the path continues/) && has(m.warnings, /1 entry for 2 elements in "END": OFF gets none/), show(m));
m = P('*A\\ SERIES\n*DONE, OFF\\ PINK, BLACK; NULL, END');
ok('"NULL, END" skips DONE and ends OFF', !m.errors.length && !m.warnings.length && byLabel(m, 'OFF').role === 'end' && byLabel(m, 'DONE').color === 'pink', show(m));
m = P('*A\\ SERIES\n*DONE, OFF\\ PINK, BLACK END');
ok('END can share an entry with other specifiers', !m.errors.length && byLabel(m, 'OFF').role === 'end' && byLabel(m, 'OFF').color === 'black', show(m));
ok('a plain one-element END line still ends', (() => { const q = P('*A\\ SERIES\n*E\\ END'); return !q.errors.length && byLabel(q, 'E').role === 'end'; })());
m = P('*A, B, C\\ PROC, RED, MEAS V');
ok('entries in one group can be different kinds: shape, color, marker', byLabel(m, 'A').shape === 'proc' && byLabel(m, 'B').color === 'red' && has(m.warnings, /MEAS only measures circuit parts; ignored on C/), show(m));
m = P('*A, B\\ [BLUE, PROC = cool down], DIA');
ok('brackets hold several specifiers for one element; the next entry is the next element', !m.errors.length && byLabel(m, 'A').color === 'blue' && byLabel(m, 'A').shape === 'proc' && byLabel(m, 'A').value === 'cool down' && byLabel(m, 'B').shape === 'dia', show(m));
m = P('*A, B\\ [PROC, TRI], DIA');
ok('two shapes for one element in brackets is an error', has(m.errors, /\[PROC, TRI\] gives one element two shapes/), show(m));
m = P('*G1, V1, R1\\ GND, [VOLT_SRC = 5, MEAS I], [RED RES = 1k, MEAS V POLE]');
ok('brackets on circuit parts: value, color and MEAS for each in one group', !m.errors.length && byLabel(m, 'V1').meas === 'I' && byLabel(m, 'R1').meas === 'V' && byLabel(m, 'R1').color === 'red' && near(byLabel(m, 'R1').measNum, 5), show(m));
m = P('*A, B\\ DEC = [x > 1, y < 2], PROC\n*N\\ PROC; BRANCH');
ok('a bracket after = is still a value', byLabel(m, 'A').value === 'x > 1, y < 2' && !has(m.errors, /entr/), show(m));
m = P('*A, B\\ [PROC, BRANCH], DIA');
ok('a command inside brackets is an error', has(m.errors, /"BRANCH" in \[PROC, BRANCH\] is not a specifier for one element/), show(m));
ok('NULL and END type out in capitals', ex('*A\\ null ') === '*A\\ NULL ' && ex('*A\\ x, end,') === '*A\\ x, END,');

// typing aids (Josue, 11/25): a space in an element list types ", "; Enter in the specifier opens and closes brackets
vm.runInContext('this.A.enterAt = enterAt', ctx);
const H = '*T\\\n';
const sp = t => { const x = A.expand(t, t.length); return x ? x.text : t; };
const en = t => { const r = A.enterAt(t, t.length); return r ? r.text : null; };
ok('a space after a name in a list types a comma and a space', sp(H + '*A ') === H + '*A, ' && sp(H + '*A, R_1 ') === H + '*A, R_1, ');
ok('not on the name line, not after a comma, not in the specifier', sp('*My ') === '*My ' && sp(H + '*A, ') === H + '*A, ' && sp(H + '*A\\ PROC ') === H + '*A\\ PROC ');
ok('the bottom box passes which line it is on', (A.expand('*A ', 3, true) || {}).text === '*A, ' && !A.expand('*A ', 3, false));
ok('Enter after a list that ends in the typed comma drops it and opens the specifier', en(H + '*A, B, ') === H + '*A, B\\ ', JSON.stringify(en(H + '*A, B, ')));
ok('Enter right after the backslash opens a bracket', en(H + '*A, B\\ ') === H + '*A, B\\ [', JSON.stringify(en(H + '*A, B\\ ')));
ok('Enter inside a bracket closes it with "], "', en(H + '*A, B\\ [BLUE, PROC = cool down') === H + '*A, B\\ [BLUE, PROC = cool down], ', JSON.stringify(en(H + '*A, B\\ [BLUE, PROC = cool down')));
ok('Enter right after "], " drops the comma and starts the next line', en(H + '*A, B\\ [BLUE, PROC = cool down], ') === H + '*A, B\\ [BLUE, PROC = cool down]\n*', JSON.stringify(en(H + '*A, B\\ [BLUE, PROC = cool down], ')));
ok('Enter after a plain comma opens the next element\'s bracket', en(H + '*A, B\\ PROC, ') === H + '*A, B\\ PROC, [', JSON.stringify(en(H + '*A, B\\ PROC, ')));
ok('Enter after a word still starts the next line', en(H + '*A, B\\ PROC, DIA') === H + '*A, B\\ PROC, DIA\n*', JSON.stringify(en(H + '*A, B\\ PROC, DIA')));
ok('words inside an element bracket are written out in capitals too', ex('*A\\ [blue,') === '*A\\ [BLUE,' && ex('*A\\ [BLUE, proc ') === '*A\\ [BLUE, PROC ' && ex('*A\\ x, [res ') === '*A\\ x, [RES ');
ok('but not inside a value, bracketed or not', ex('*A\\ [PROC = red ') === '*A\\ [PROC = red ' && ex('*A\\ DEC = [x, end ') === '*A\\ DEC = [x, end ' && ex('*A\\ [DEC = [x, blue ') === '*A\\ [DEC = [x, blue ');
// Enter after a word that takes a value types " = ", and waits there until something is typed (Josue, 11/25)
ok('Enter after PROC, DEC, IO and the parts types " = "', ['PROC', 'DEC', 'IO', 'RES', 'CAP', 'IND', 'VOLT_SRC', 'CURR_SRC', 'DEP_VOLT_SRC', 'DEP_CURR_SRC', 'AC_VOLT_SRC', 'AC_CURR_SRC'].every(w => en(H + '*A\\ ' + w) === H + '*A\\ ' + w + ' = '), ['PROC', 'RES', 'AC_VOLT_SRC'].map(w => JSON.stringify(en(H + '*A\\ ' + w))).join(' '));
ok('inside a bracket and after a color too', en(H + '*A, B\\ [BLUE PROC') === H + '*A, B\\ [BLUE PROC = ' && en(H + '*A, B\\ PROC, RED RES') === H + '*A, B\\ PROC, RED RES = ');
ok('a letter is written out first: r then Enter gives RES = ', en(H + '*A\\ R') === H + '*A\\ RES = ', JSON.stringify(en(H + '*A\\ R')));
ok('words that take no value still move on: TRI, DIODE, GND', en(H + '*A\\ TRI') === H + '*A\\ TRI\n*' && en(H + '*A\\ DIODE') === H + '*A\\ DIODE\n*' && en(H + '*A\\ GND') === H + '*A\\ GND\n*', [en(H + '*A\\ TRI'), en(H + '*A\\ DIODE')].map(x => JSON.stringify(x)).join(' '));
ok('Enter right after = does nothing', en(H + '*A\\ PROC = ') === H + '*A\\ PROC = ' && en(H + '*A, B\\ [RES =') === H + '*A, B\\ [RES =');
ok('anything after = lets Enter go on, even a value that is not valid', en(H + '*A\\ RES = ?') === H + '*A\\ RES = ?\n*' && en(H + '*A, B\\ [RES = x') === H + '*A, B\\ [RES = x], ');
ok('a value word inside a value is just text', en(H + '*A\\ IO = read proc') === H + '*A\\ IO = read proc\n*');
m = P('*A, B\\ PROC = , RES =');
ok('a word left with = and nothing after it warns', has(m.warnings, /PROC on A has = but nothing after it/) && has(m.warnings, /RES on B has = but nothing after it/), show(m));
ok('a whole line typed with the aids parses clean', (() => { const q = A.parse(H + '*A, B\\ [BLUE, PROC = cool down], DIA\n*\\'); return !q.errors.length && !q.warnings.length && byLabel(q, 'A').color === 'blue'; })());

// diagrams that are not circuits are left alone
m = P('*A, B\\ proc, io');
ok('a flow diagram has no circuit notes', !m.errors.length && !m.warnings.length && !m.circuit, show(m));
m = P('*A, R1\\ proc, RES = 1k; , MEAS V,');
ok('a flow block among parts is named by the solver, not the checks', !m.errors.length && has(m.warnings, /flow block/), show(m));

console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
