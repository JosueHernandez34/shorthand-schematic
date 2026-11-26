// node testV7.js [outDir] -> explicit GND (no implied return wire) and the circuit validity checks (shorthandSchematicV9.html)
const fs = require('fs'), vm = require('vm'), path = require('path');
const page = fs.readFileSync(path.join(__dirname, '..', process.env.APP_FILE || 'shorthandSchematicV9.html'), 'utf8');
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
ok('words that take no value still move on: TRI, GND; DIODE now takes one', en(H + '*A\\ TRI') === H + '*A\\ TRI\n*' && en(H + '*A\\ GND') === H + '*A\\ GND\n*' && en(H + '*A\\ DIODE') === H + '*A\\ DIODE = ', [en(H + '*A\\ TRI'), en(H + '*A\\ DIODE')].map(x => JSON.stringify(x)).join(' '));

// DIODE = [FWD_VOLT, REV_VOLT] (Josue, 11/25): constant drop, 0.7 V unless given, no breakdown unless REV is given
const dv = (val, q, src) => { const t = P(`*G1, V1, R1, D1\\ GND, VOLT_SRC = ${src || 9}, RES = 1k, ${val}; NULL, NULL, ${q === 'I' ? 'MEAS I' : 'NULL'}, ${q === 'V' ? 'MEAS V' : 'NULL'}`); return t; };
m = dv('DIODE', 'V');
ok('a plain DIODE drops exactly 0.7 V', near(byLabel(m, 'D1').measNum, 0.7, 1e-6) && !m.errors.length && !m.warnings.length, show(m) + byLabel(m, 'D1').measNum);
ok('and the rest of the loop follows by hand: (9 − 0.7) / 1k = 8.3 mA', near(byLabel(dv('DIODE', 'I'), 'R1').measNum, 8.3e-3, 1e-6));
ok('DIODE = 0.3 sets FWD_VOLT (a Schottky)', near(byLabel(dv('DIODE = 0.3', 'V'), 'D1').measNum, 0.3, 1e-6));
ok('a reversed diode with no REV_VOLT blocks: all 9 V across it, no current', near(byLabel(dv('DIODE REV', 'V'), 'D1').measNum, -9, 1e-6) && byLabel(dv('DIODE REV', 'I'), 'R1').measNum === 0);
m = dv('DIODE REV = [0.7, 5.1]', 'V');
ok('a reversed diode with REV_VOLT 5.1 breaks down and holds −5.1 V (a Zener)', near(byLabel(m, 'D1').measNum, -5.1, 1e-6) && near(byLabel(dv('DIODE REV = [0.7, 5.1]', 'I'), 'R1').measNum, 3.9e-3, 1e-6), show(m) + byLabel(m, 'D1').measNum);
ok('below its REV_VOLT a Zener still blocks', near(byLabel(dv('DIODE REV = [, 12]', 'V'), 'D1').measNum, -9, 1e-6));
ok('[, 12] keeps the 0.7 V default forward', near(byLabel(dv('DIODE = [, 12]', 'V'), 'D1').measNum, 0.7, 1e-6));
ok('a source too small to reach FWD_VOLT leaves the diode off', near(byLabel(dv('DIODE', 'V', 0.5), 'D1').measNum, 0.5, 1e-6) && byLabel(dv('DIODE', 'I', 0.5), 'R1').measNum === 0);
m = dv('DIODE = [0.7, -3]', 'V');
ok('a REV_VOLT that is not above 0 stops the solve with the form', has(m.warnings, /D1 needs DIODE = FWD_VOLT or \[FWD_VOLT, REV_VOLT\]/), show(m));
ok('the drawing shows the voltages under the diode', byLabel(dv('DIODE = [0.7, 5.1]', 'V'), 'D1').value === '0.7 V / 5.1 V' && byLabel(dv('DIODE = 0.3', 'V'), 'D1').value === '0.3 V');
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

// partial words are capitals as typed and a prefix with one possible word autofills (Josue, 11/25)
vm.runInContext('this.A.caps = capsAtCaret', ctx);
const cp = t => A.caps(t, t.length) || t;
ok('letters of a specifier word turn to capitals as they are typed', cp('*A\\ pr') === '*A\\ PR' && cp('*A\\ tri, ye') === '*A\\ tri, YE' && cp('*A\\ [bl') === '*A\\ [BL' && cp('*A\\ me') === '*A\\ ME');
ok('a single letter, a non-word, a value and a name are left alone', cp('*A\\ p') === '*A\\ p' && cp('*A\\ qz') === '*A\\ qz' && cp('*A\\ proc = re') === '*A\\ proc = re' && cp('*pr') === '*pr' && cp('*A\\ RES = [2*Vx') === '*A\\ RES = [2*Vx');
ok('a prefix with one word autofills on space, comma or Enter', ex('*A\\ PRO ') === '*A\\ PROC ' && ex('*A\\ yel,') === '*A\\ YELLOW,' && ex('*A\\ vol_') === '*A\\ vol_' && ex('*A\\ volt_s ') === '*A\\ VOLT_SRC ' && ex('*A\\ dep_c ') === '*A\\ DEP_CURR_SRC ');
ok('a prefix that fits several words does not autofill, only capitals', ex('*A\\ re ') === '*A\\ re ' && ex('*A\\ gr ') === '*A\\ gr ' && ex('*A\\ RE ') === '*A\\ RE ');
ok('Enter autofills the word at the end of the line', en(H + '*A\\ YEL') === H + '*A\\ YELLOW\n*');

vm.runInContext('this.A.cr = convertReturnDigits', ctx);
const crt = (t) => A.cr(t, t.length).text;
ok('a number typed right after RETURN gets a caret, in capitals', crt('*A\\ BRANCH, RETURN2') === '*A\\ BRANCH, RETURN^2' && crt('*A\\ return2') === '*A\\ RETURN^2' && crt('*A\\ RETURN^2') === '*A\\ RETURN^2' && crt('*RETURN2\\ ') === '*RETURN2\\ ');

// ---- V8: several designs, references, and ends for branches that do not return (Josue, 11/25-26) ----
vm.runInContext('this.A.sheet = parseSheet; this.A.render = renderSheet; this.A.split = splitDesigns; this.A.startsDesign = startsDesign', ctx);
const Q = '@'.replace('@', String.fromCharCode(92));
const SH = t => A.sheet(t.replace(/@/g, Q));
let sh = SH('*One@\n*A, B@ PROC, PROC\n*@\n*Two@\n*X, Y@ PROC, PROC\n*@\n');
ok('a name line after a closing *\\ starts a second design', sh.designs.length === 2 && !sh.errors.length && sh.designs[1].title === 'Two' && sh.designs[1].nodes[0].ln === 5, JSON.stringify(sh.errors));
ok('line numbers in a later design are those of the whole text', sh.designs[1].nodes.filter(n => n.type === 'el').map(n => n.ln).join() === '5,5');
ok('a design that is still open at the end is the last one', SH('*One@\n*A@ PROC\n*@\n*Two@\n*X@ PROC').designs.length === 2);
ok('blank lines between designs do not matter', SH('*One@\n*A@ PROC\n*@\n\n\n*Two@\n*X@ PROC\n*@').designs.length === 2);
ok('errors in a later design name its own line', (() => { const q = SH('*One@\n*A@ PROC\n*@\n*Two@\n*X, Y@ PROC, DEC\n*@'); return q.errors.some(e => /^Line 5: Y is a decision/.test(e)); })());
// references
sh = SH('*One@\n*A, B@ PROC, PROC; REF = Two.Y\n*@\n*Two@\n*X, Y@ PROC, PROC\n*@');
ok('REF = Design.name links to an element in another design', !sh.errors.length && sh.refs.length === 1 && sh.refs[0].from.label === 'A' && sh.refs[0].to.label === 'Y' && sh.refs[0].toDesign === 1, JSON.stringify(sh.errors));
sh = SH('*One@\n*A, B@ PROC, PROC; , REF = A\n*@\n*Two@\n*X, A@ PROC, PROC\n*@');
ok('an unqualified name looks in the same design first', !sh.errors.length && sh.refs.length === 1 && sh.refs[0].toDesign === 0, JSON.stringify(sh.errors));
sh = SH('*One@\n*A@ PROC; REF = Y\n*@\n*Two@\n*X, Y@ PROC, PROC\n*@');
ok('an unqualified name found only in another design links there', !sh.errors.length && sh.refs[0] && sh.refs[0].toDesign === 1);
sh = SH('*One@\n*A@ PROC; REF = Y\n*@\n*Two@\n*Y@ PROC\n*@\n*Three@\n*Y@ PROC\n*@');
ok('a name in two other designs is ambiguous and asks for Design.name', sh.errors.length === 1 && /fits 2 elements.*Two\.Y/.test(sh.errors[0]), JSON.stringify(sh.errors));
sh = SH('*One@\n*A@ PROC; REF = Nope\n*@');
ok('a name that matches nothing is an error', /no element is named Nope/.test(sh.errors[0] || ''));
sh = SH('*One@\n*A@ PROC; REF = Bad.A\n*@');
ok('a design that does not exist is an error', /no design named Bad/.test(sh.errors[0] || ''));
sh = SH('*One@\n*A, B@ [PROC, REF = [B, Two.X]], PROC\n*@\n*Two@\n*X@ PROC\n*@');
ok('brackets hold several references for one element', !sh.errors.length && sh.refs.map(r => r.to.label).join() === 'B,X', JSON.stringify(sh.errors));
sh = SH('*One@\n*A@ PROC; REF\n*@');
ok('REF with no name warns', sh.warnings.some(w => /REF on A needs a name/.test(w)));
ok('REF does not give the block a value', (() => { const q = SH('*One@\n*A, B@ PROC, PROC; REF = B\n*@'); return q.designs[0].nodes[0].value === undefined; })());
ok('Enter after REF types " = "', en(H + '*A@ PROC, REF'.replace(/@/g, Q)) === H + '*A@ PROC, REF = '.replace(/@/g, Q));
// drawing
sh = SH('*One@\n*A, B, C@ PROC, PROC, PROC; REF = Two.Y\n*@\n*Two@\n*X, Y, Z@ PROC, PROC, PROC\n*@');
const svg = A.render(sh);
ok('each design is in its own bordered frame, stacked downward', (svg.match(/class="frame"/g) || []).length === 2 && (() => { const ys = [...svg.matchAll(/class="frame" data-design="\d+" x="\d+" y="(\d+)"/g)].map(m => +m[1]); return ys[1] > ys[0]; })());
ok('a reference is a grey dotted line with a chain in the middle', /class="ref"[^>]*stroke="#868e96"[^>]*stroke-dasharray/.test(svg) && /class="chain"/.test(svg));
// the route keeps out of every element's box
const inside = (p, b) => p[0] > b[0] && p[0] < b[2] && p[1] > b[1] && p[1] < b[3];
ok('a route never passes through an element', (() => {
  const dense = SH('*One@\n*A, B, C, D@ PROC, PROC, PROC, PROC; REF = Two.Z\n*@\n*Two@\n*W, X, Y, Z@ PROC, PROC, PROC, PROC\n*@');
  A.render(dense);
  const route = dense.routes[0].pts;
  // sample along every segment
  const samples = []; for (let k = 1; k < route.length; k++) for (let t = 0; t <= 20; t++) samples.push([route[k - 1][0] + (route[k][0] - route[k - 1][0]) * t / 20, route[k - 1][1] + (route[k][1] - route[k - 1][1]) * t / 20]);
  const boxes = []; let oy = 24 + 14, ox = 24 + 14;
  dense.designs.forEach(m => { for (const n of m.nodes) if (n.type === 'el') boxes.push([n.x - n.w / 2 + ox + 2, n.y - 22 + oy + 2, n.x + n.w / 2 + ox - 2, n.y + 22 + oy - 2]); oy += m.height + 28 + 30; });
  return route.length >= 2 && !samples.some(p => boxes.some(b => inside(p, b)));
})());
ok('every route is made of straight horizontal and vertical runs', sh.routes.every(r => r.pts.every((p, k) => k === 0 || p[0] === r.pts[k - 1][0] || p[1] === r.pts[k - 1][1])));
// typing: a name line after the closing *\ is a design start, and Enter gets there
ok('Enter on the closing *\\ opens the next design\'s name line', en('*One@\n*A@ PROC\n*@'.replace(/@/g, Q)) === '*One@\n*A@ PROC\n*@\n*'.replace(/@/g, Q));
ok('Enter after a new design\'s name closes it and starts its first line', en('*One@\n*A@ PROC\n*@\n*Two'.replace(/@/g, Q)) === '*One@\n*A@ PROC\n*@\n*Two@\n*'.replace(/@/g, Q));
ok('startsDesign: first line, and a line right after a closing *\\', A.startsDesign(['*One\\'], 1) && !A.startsDesign(['*One\\', '*A\\ PROC'], 2) && A.startsDesign(['*One\\', '*A\\ PROC', '*\\', '*Two\\'], 4));
// a branch that does not return needs an END (Josue, 11/26)
const EE_ = t => { const q = A.parse('*T@\n'.replace('@', Q) + t.replace(/@/g, Q) + '\n*@'.replace('@', Q)); return q; };
let q = EE_('*A, B@ PROC, PROC\n*C@ BRANCH');
ok('a plain branch with no END is an error that names the branch', q.errors.some(e => /^Line 3: this branch does not return, so it needs an END/.test(e) && /C/.test(e)), JSON.stringify(q.errors));
q = EE_('*A, B@ PROC, PROC\n*C@ BRANCH END');
ok('END on the branch\'s last element satisfies it', !q.errors.length, JSON.stringify(q.errors));
q = EE_('*A, B@ PROC, PROC\n*C, D@ BRANCH, END'.replace('BRANCH, END', 'PROC, PROC; BRANCH; NULL, END'));
ok('END on the last of several elements of the branch line counts', !q.errors.some(e => /needs an END/.test(e)), JSON.stringify(q.errors));
q = EE_('*A@ PROC\n*B@ BRANCH RETURN\n*C@ PROC');
ok('a branch that returns needs no END', !q.errors.some(e => /needs an END/.test(e)), JSON.stringify(q.errors));
q = EE_('*A@ PROC\n*B@ BRANCH WAIT\n*C@ PROC\n*D@ RETURN\n*E@ PROC');
ok('a branch that waits and returns later needs no END', !q.errors.some(e => /needs an END/.test(e)), JSON.stringify(q.errors));
q = A.parse('*T@\n*V1, R1, R2@ VS = 5, RES = 1k, RES = 1k\n*R3@ BRANCH\n*@'.replace(/@/g, Q));
ok('a circuit branch is not asked for an END', !q.errors.some(e => /needs an END/.test(e)), JSON.stringify(q.errors));
q = A.parse('*T@\n*A@ PROC\n*B@ BRANCH'.replace(/@/g, Q), { partial: true });
ok('the branch line still being typed is given time to get its END', !q.errors.some(e => /needs an END/.test(e)));
ok('the example script still has no errors', !A.parse(A.EXAMPLE).errors.length);

// ---- V9: floating elements, the bank, designs that move (Josue, 11/26) ----
vm.runInContext('this.A.bank = { searchBank, addFloating, connectFloating, disconnectFloating, deleteFloating, wrapDesign, BANK }; this.A.SET = SETTINGS', ctx);
const K = A.bank;
let fx = K.addFloating('', 'RES');
ok('the bank puts a floating line in the script, with no design name above it', fx.text === '*R_1\\ RES\n' || fx.text === '*R_1\\ RES', JSON.stringify(fx.text));
fx = K.addFloating(fx.text, 'RES'); fx = K.addFloating(fx.text, 'CAP');
ok('names count up per kind and never repeat', fx.text.split('\n').slice(0, 3).join('|') === '*R_1\\ RES|*R_2\\ RES|*C_1\\ CAP', fx.text);
let shf = A.sheet(fx.text);
ok('floating lines are read as floating chains, not designs, and draw without errors', shf.floating.length === 3 && shf.designs.length === 0 && !shf.errors.length && !shf.warnings.length, JSON.stringify(shf.errors));
ok('a floating element is drawn in the Floating zone', (() => { const sv = A.render(shf); return /class="zone"/.test(sv) && (sv.match(/<svg x=/g) || []).length === 3; })());
shf = A.sheet('*One@\n*A@ PROC\n*@\n*R_1@ RES\n'.replace(/@/g, Q));
ok('a floating line after a closed design is its own chain, and the design is untouched', shf.designs.length === 1 && shf.floating.length === 1 && shf.designs[0].nodes.filter(n => n.type === 'el').length === 1);
ok('a bank item added while a design is still open goes in front of it, not into it', (() => { const t = '*One@\n*A@ PROC\n'.replace(/@/g, Q); const r = K.addFloating(t, 'IO'); return r.text.split('\n')[0] === '*IO_1\\ IO' && A.sheet(r.text).designs[0].nodes.some(n => n.label === 'A'); })());
ok('BRANCH on a floating element is an error that says to group it first', A.sheet('*A@ PROC, BRANCH'.replace(/@/g, Q)).errors.some(e => /floating element is only a chain/.test(e)));
ok('a floating decision is not asked for two paths', !A.sheet('*D_1@ DEC'.replace(/@/g, Q)).errors.length);
ok('REF on a floating element is ignored with a warning', A.sheet('*A@ PROC; REF = B'.replace(/@/g, Q)).warnings.some(w => /floating element is not in a design yet/.test(w)));
// searching
ok('search finds by name, word or keyword, and all words must fit', K.searchBank('resistor')[0].word === 'RES' && K.searchBank('ohm').map(b => b.word).join() === 'RES' && K.searchBank('volt src').map(b => b.word).join() === 'VOLT_SRC,DEP_VOLT_SRC,AC_VOLT_SRC' && K.searchBank('zzz').length === 0 && K.searchBank('').length === K.BANK.length);
ok('every bank word is one the parser reads', K.BANK.every(b => { const q = A.sheet('*X_1@ '.replace('@', Q) + b.word); return !q.errors.length && q.nodes.some(n => n.type === 'el'); }));
// connecting
let cn = K.connectFloating('*R_1@ RES\n*C_1@ CAP\n*L_1@ IND\n'.replace(/@/g, Q), { ln: 1, idx: 0 }, { ln: 2, idx: 0 });
ok('tapping one then another joins their lines into a chain', cn.text === '*R_1, C_1\\ RES, CAP\n*L_1\\ IND\n', JSON.stringify(cn));
cn = K.connectFloating(cn.text, { ln: 1, idx: 1 }, { ln: 2, idx: 0 });
ok('a chain can be extended from its end', cn.text === '*R_1, C_1, L_1\\ RES, CAP, IND\n', JSON.stringify(cn));
cn = K.connectFloating('*R_1@ RES\n*C_1@ CAP\n'.replace(/@/g, Q), { ln: 2, idx: 0 }, { ln: 1, idx: 0 });
ok('the order of the taps does not matter when only one way fits', cn.text === '*C_1, R_1\\ CAP, RES\n' || cn.text === '*R_1, C_1\\ RES, CAP\n', JSON.stringify(cn));
ok('the values and colors stay with their elements when joined', K.connectFloating('*R_1@ RES = 1k\n*C_1@ [CAP = 10u, BLUE]\n'.replace(/@/g, Q), { ln: 1, idx: 0 }, { ln: 2, idx: 0 }).text === '*R_1, C_1\\ RES = 1k, [CAP = 10u, BLUE]\n');
ok('the joined line still reads back with each value on its own element', (() => { const q = A.sheet('*R_1, C_1@ RES = 1k, [CAP = 10u, BLUE]'.replace(/@/g, Q)); const e = q.floating[0].nodes.filter(n => n.type === 'el'); return !q.errors.length && e[0].value && e[1].color === 'blue'; })());
ok('connecting the middle of a chain is refused with a hint', /end of one chain to the start of another/.test(K.connectFloating('*A, B, C@ RES, RES, RES\n*D@ CAP\n'.replace(/@/g, Q), { ln: 1, idx: 1 }, { ln: 2, idx: 0 }).error || ''));
ok('two elements of one chain cannot be joined again', /already in one chain/.test(K.connectFloating('*A, B@ RES, RES\n'.replace(/@/g, Q), { ln: 1, idx: 0 }, { ln: 1, idx: 1 }).error || ''));
ok('lines inside a design are not floating, so they are not joined', /Only floating elements/.test(K.connectFloating('*One@\n*A@ PROC\n*B@ PROC\n*@\n'.replace(/@/g, Q), { ln: 2, idx: 0 }, { ln: 3, idx: 0 }).error || ''));
ok('a hand-written line with groups is left for the person', /groups or commands/.test(K.connectFloating('*A, B@ RES, RES; RED, BLUE\n*C@ CAP\n'.replace(/@/g, Q), { ln: 1, idx: 1 }, { ln: 2, idx: 0 }).error || ''));
ok('disconnect splits a chain into one line per element', K.disconnectFloating('*R_1, C_1@ RES = 1k, CAP\n'.replace(/@/g, Q), 1).text === '*R_1\\ RES = 1k\n*C_1\\ CAP\n');
ok('delete removes floating lines and nothing else', K.deleteFloating('*One@\n*A@ PROC\n*@\n*R_1@ RES\n*C_1@ CAP\n'.replace(/@/g, Q), [4, 2]).split('\n').join('|') === '*One\\|*A\\ PROC|*\\|*C_1\\ CAP|');
// wrapping in a design
let wr = K.wrapDesign('*R_1, C_1@ RES, CAP\n*X_1@ PROC\n*L_1@ IND\n'.replace(/@/g, Q), [1, 3], 'Filter');
ok('naming a selection wraps its lines in a design at the first one\'s place', wr.text === '*Filter\\\n*R_1, C_1\\ RES, CAP\n*L_1\\ IND\n*\\\n*X_1\\ PROC\n', JSON.stringify(wr));
shf = A.sheet(wr.text);
ok('the wrapped design reads as a design and the rest still floats', shf.designs.length === 1 && shf.designs[0].title === 'Filter' && shf.floating.length === 1 && !shf.errors.length, JSON.stringify(shf.errors));
ok('a design name must be fresh and plain', K.wrapDesign('*A@ RES\n'.replace(/@/g, Q), [1], '').error && K.wrapDesign('*A@ RES\n'.replace(/@/g, Q), [1], 'a,b').error && /already named/.test(K.wrapDesign('*One@\n*B@ PROC\n*@\n*A@ RES\n'.replace(/@/g, Q), [4], 'one').error || ''));
ok('wrapping nothing is refused', /at least one floating/.test(K.wrapDesign('*One@\n*B@ PROC\n*@\n'.replace(/@/g, Q), [2], 'Z').error || ''));
// Enter after a floating line starts a new line
ok('Enter after a floating line with its value starts the next line with *', en('*R_1' + Q + ' RES = 1k') === '*R_1' + Q + ' RES = 1k' + String.fromCharCode(10) + '*');
// designs run to the right when the diagrams run top to bottom, and below otherwise
const frames = t => [...A.render(A.sheet(t.replace(/@/g, Q))).matchAll(/class="frame" data-design="\d+" x="(\d+)" y="(\d+)"/g)].map(m => [+m[1], +m[2]]);
const TWO = '*One@\n*A@ PROC\n*@\n*Two@\n*X@ PROC\n*@';
let fr = frames(TWO);
ok('left to right: a new design opens below the one above', fr.length === 2 && fr[1][0] === fr[0][0] && fr[1][1] > fr[0][1], JSON.stringify(fr));
A.SET.direction = 'td';
fr = frames(TWO);
ok('top to bottom: a new design opens to the right instead', fr.length === 2 && fr[1][1] === fr[0][1] && fr[1][0] > fr[0][0], JSON.stringify(fr));
A.SET.direction = 'lr';
// designs that were dragged keep their places
shf = A.sheet(TWO.replace(/@/g, Q));
const dragged = A.render(shf, { designPos: { Two: { x: 500, y: 40 } } });
ok('a design with a stored place is drawn there, the others stay put', (() => { const m = [...dragged.matchAll(/class="frame" data-design="(\d+)" x="(\d+)" y="(\d+)"/g)].map(x => [+x[2], +x[3]]); return m[1][0] === 500 && m[1][1] === 40 && m[0][0] === 24; })());
ok('the sheet reports every frame and floating chain for dragging', shf.frameBoxes.length === 2 && shf.frameBoxes[1].title === 'Two' && Array.isArray(shf.floatBoxes));
ok('floating chains are drawn at their stored place, anywhere on the canvas', (() => { const t = '*R_1' + Q + ' RES' + String.fromCharCode(10) + '*C_1' + Q + ' CAP'; const a = A.sheet(t); A.render(a, { floatPos: { C_1: { x: 320, y: 90 } } }); const b = a.floatBoxes.find(x => x.key === 'C_1'); return b.x === 320 && b.y === 90; })());
ok('a dropped chain keeps clear of the canvas edge, with room for the zone label', (() => { const a = A.sheet('*R_1' + Q + ' RES'); A.render(a, { floatPos: { R_1: { x: -50, y: -50 } } }); const b = a.floatBoxes[0]; return b.x === 14 && b.y === 36; })());
// the AC sources: minus, squiggle and plus along the wire; an arrow with a squiggle across its midpoint
const acSvg = kind => A.render(A.sheet('*S_1' + Q + ' ' + kind));
ok('the AC voltage source is a circle with a minus, a plus and a squiggle across the wire, as in the current source', (() => { const sv = acSvg('AC_VOLT_SRC'); return /<circle[^>]*r="17"/.test(sv) && (sv.match(/q3\.5 1\.75 0 3\.5 t0 3\.5 t0 3\.5 t0 3\.5/g) || []).length === 1 && /v5"/.test(sv); })());
ok('the AC current source is an arrow with a squiggle crossing its midpoint', (() => { const sv = acSvg('AC_CURR_SRC'); return /L[\d.]+ [\d.]+ L[\d.]+ [\d.]+/.test(sv) && /q4 2\.25 0 4\.5 t0 4\.5 t0 4\.5 t0 4\.5/.test(sv); })());
// the chain of a reference sits in the middle of the longest straight run of its route
ok('the chain is in the middle of the longest straight run of the line', (() => {
  const t = '*One@\n*A, B, C@ PROC, PROC, PROC; REF = Two.Y\n*@\n*Two@\n*X, Y, Z@ PROC, PROC, PROC\n*@'.replace(/@/g, Q);
  const a = A.sheet(t), sv = A.render(a), pts = a.routes[0].pts;
  const runs = pts.slice(1).map((p, k) => ({ a: pts[k], b: p, len: Math.hypot(p[0] - pts[k][0], p[1] - pts[k][1]) }));
  const longest = runs.reduce((m, r) => r.len > m.len ? r : m);
  const m = sv.match(/class="chain"[^>]*>/), tr = sv.match(/translate\((\d+) (\d+)\)" class="chain"/);
  const cx = +tr[1], cy = +tr[2];
  const onRun = r => Math.abs((r.b[0] - r.a[0]) * (cy - r.a[1]) - (r.b[1] - r.a[1]) * (cx - r.a[0])) < 1.5 && cx >= Math.min(r.a[0], r.b[0]) - 1 && cx <= Math.max(r.a[0], r.b[0]) + 1 && cy >= Math.min(r.a[1], r.b[1]) - 1 && cy <= Math.max(r.a[1], r.b[1]) + 1;
  const mid = [(longest.a[0] + longest.b[0]) / 2, (longest.a[1] + longest.b[1]) / 2];
  return onRun(longest) && Math.hypot(cx - mid[0], cy - mid[1]) <= longest.len / 2;
})());

console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
