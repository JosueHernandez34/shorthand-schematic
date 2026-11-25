// node testV6.js [outDir] -> ground return, GND, DC solver for MEAS, settings (shorthandSchematicV6.html)
const fs = require('fs'), vm = require('vm'), path = require('path');
const page = fs.readFileSync(path.join(__dirname, '..', process.env.APP_FILE || 'shorthandSchematicV6.html'), 'utf8');
const core = page.split('// ==CORE-START==')[1].split('// ==CORE-END==')[0];
const ctx = {}; vm.createContext(ctx);
vm.runInContext(core + ';this.A={parse,renderSVG,edgeList,expandAtCaret,enterAt,nextShape,eeNumber,fmtEng,formatPhasor,readControl,readAC,SETTINGS}', ctx);
const A = ctx.A;
let fails = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) fails++; };
const byLabel = (m, l) => m.nodes.find(n => n.type === 'el' && n.label === l);
const P = s => A.parse('*T\\\n' + s + '\n*\\');
const read = (s, l) => { const m = P(s), n = byLabel(m, l); return n && n.measNum; };
const near = (a, b, tol) => typeof a === 'number' && Math.abs(a - b) <= (tol || 1e-6) * Math.max(1, Math.abs(b));

// numbers and formats
ok('eeNumber reads prefixes, units and powers', A.eeNumber('R', '4.7k') === 4700 && near(A.eeNumber('C', '10u'), 1e-5) && A.eeNumber('R', '4.7e3') === 4700 && A.eeNumber('VS', '5V') === 5 && isNaN(A.eeNumber('R', 'big')));
ok('fmtEng: three figures and a prefix', A.fmtEng(0.00106, 'A') === '1.06 mA' && A.fmtEng(5, 'V') === '5 V' && A.fmtEng(-1.5, 'V') === '−1.5 V' && A.fmtEng(0, 'A') === '0 A');
ok('formatPhasor polar', A.formatPhasor(4.33, 2.5, 'V', 'polar', 60) === '5 V ∠ 30°', A.formatPhasor(4.33, 2.5, 'V', 'polar', 60));
ok('formatPhasor rectangular', A.formatPhasor(4.33, -2.5, 'V', 'rectangular', 60) === '4.33 − j2.5 V', A.formatPhasor(4.33, -2.5, 'V', 'rectangular', 60));
// sinusoidal uses omega, the way Josue writes a source (11/24)
ok('formatPhasor sinusoidal', A.formatPhasor(4.33, 2.5, 'V', 'sinusoidal', 377) === '5 cos(377t + 30°) V', A.formatPhasor(4.33, 2.5, 'V', 'sinusoidal', 377));
ok('formatPhasor: a negative angle has a real minus; a zero angle is left out', A.formatPhasor(5, -5, 'V', 'polar') === '7.07 V ∠ −45°' && A.formatPhasor(2e-3, 0, 'A', 'sinusoidal', 1000) === '2 cos(1000t) mA', A.formatPhasor(5, -5, 'V', 'polar') + ' | ' + A.formatPhasor(2e-3, 0, 'A', 'sinusoidal', 1000));
ok('readControl forms', JSON.stringify(A.readControl('[2*V(R1)]', 'DVS')) === '{"gain":2,"q":"V","ref":"R1"}' && A.readControl('I(R_2)*0.5', 'DIS').gain === 0.5 && A.readControl('3', 'DVS').gain === 3 && A.readControl('x+y', 'DVS') === null);

// Josue example: the reading over R_1 in a loop with a 5 V source
let m = P('*V1, R_1\\ VOLT_SRC = 5, RES = 4.7k; , MEAS V');
ok('Josue example: + 5 V − over R_1', byLabel(m, 'R_1').measValue === '5 V' && !m.warnings.length && !m.errors.length, JSON.stringify([byLabel(m, 'R_1').measValue, m.warnings]));
ok('the marker shows the reading', /class="meas"[^]*>5 V</.test(A.renderSVG(m)));
ok('current through R_1: 1.06 mA', byLabel(P('*V1, R_1\\ VOLT_SRC = 5, RES = 4.7k; , MEAS I'), 'R_1').measValue === '1.06 mA');

// circuit laws
ok('divider: 10 V over two 1k, 5 mA and 5 V', near(read('*V1, R1, R2\\ VOLT_SRC = 10, RES = 1k, RES = 1k; , MEAS I', 'R1'), 5e-3) && near(read('*V1, R1, R2\\ VOLT_SRC = 10, RES = 1k, RES = 1k; , , MEAS V', 'R2'), 5));
ok('current source: 2 mA through 1k is 2 V', near(read('*I1, R1\\ CURR_SRC = 2m, RES = 1k; , MEAS V', 'R1'), 2));
ok('parallel branch: 1k + (1k || 1k) from 5 V', near(read('*V1, R1\\ VOLT_SRC = 5, RES = 1k\n*R2\\ RES = 1k; BRANCH RETURN; MEAS I\n*R3\\ RES = 1k; MEAS V', 'R2'), 5 / 3e3, 1e-6));
ok('capacitor is open in DC: 0 A, full voltage across it', read('*V1, R1, C1\\ VOLT_SRC = 5, RES = 1k, CAP = 1u; , MEAS I', 'R1') === 0 && near(read('*V1, R1, C1\\ VOLT_SRC = 5, RES = 1k, CAP = 1u; , , MEAS V', 'C1'), 5));
ok('inductor is a short in DC: 0 V across, 5 mA through', near(read('*V1, R1, L1\\ VOLT_SRC = 5, RES = 1k, IND = 1m; , , MEAS V', 'L1'), 0, 1e-9) && near(read('*V1, R1, L1\\ VOLT_SRC = 5, RES = 1k, IND = 1m; , , MEAS I', 'L1'), 5e-3));
ok('a reversed source flips the sign', near(read('*V1, R1\\ VOLT_SRC REV = 5, RES = 1k; , MEAS V', 'R1'), -5));
ok('two sources add along the loop', near(read('*V1, V2, R1\\ VOLT_SRC = 5, VOLT_SRC = 3, RES = 1k; , , MEAS V', 'R1'), 8));
ok('MEAS I on a voltage source: current along its arrow', near(read('*V1, R1\\ VOLT_SRC = 5, RES = 1k; MEAS I', 'V1'), 5e-3));
ok('MEAS V on a current source', near(read('*I1, R1\\ CURR_SRC = 2m, RES = 1k; MEAS V', 'I1'), -2));
const vd = read('*V1, R1, D1\\ VOLT_SRC = 5, RES = 1k, DIODE; , , MEAS V', 'D1');
ok('forward diode drops about 0.69 V', vd > 0.6 && vd < 0.75, String(vd));
ok('reversed diode blocks: 0 A, full voltage', read('*V1, R1, D1\\ VOLT_SRC = 5, RES = 1k, DIODE REV; , MEAS I', 'R1') === 0 && near(read('*V1, R1, D1\\ VOLT_SRC = 5, RES = 1k, DIODE REV; , , MEAS V', 'D1'), -5, 1e-6));
ok('dependent voltage source [2*V(Rx)]', near(read('*V1, R1, Rx, E1, R2\\ VOLT_SRC = 1, RES = 1k, RES = 1k, DEP_VOLT_SRC = [2*V(Rx)], RES = 1k; , , , , MEAS V', 'R2'), 1));
// the branch leaves at the main path's end, which is ground, so G1 pushes 0.5 * 2 mA through R2 to ground: 1 V
ok('dependent current source [0.5*I(R1)]', near(read('*V1, R1\\ VOLT_SRC = 2, RES = 1k\n*G1, R2, Z\\ DEP_CURR_SRC = [0.5*I(R1)], RES = 1k, GND; BRANCH; , MEAS V', 'R2'), 1));

// ground and open branches
m = P('*V1, R1\\ VOLT_SRC = 5, RES = 1k\n*C1\\ CAP = 1u; BRANCH; MEAS V');
ok('an open branch dangles (no current, the voltage of where it leaves)', near(byLabel(m, 'C1').measNum, 0, 1e-9) && !m.warnings.length, JSON.stringify(m.warnings));
// the branch leaves between R1 and R2 (the next plain line carries the main path on)
m = P('*V1, R1\\ VOLT_SRC = 6, RES = 1k; , MEAS V\n*R3, G1\\ RES = 1k, GND; BRANCH; MEAS V\n*R2\\ RES = 1k');
ok('GND in a branch from a midpoint: 6 V over 1k + (1k || 1k)', near(byLabel(m, 'R1').measNum, 4) && near(byLabel(m, 'R3').measNum, 2), JSON.stringify([byLabel(m, 'R1').measNum, byLabel(m, 'R3').measNum]));
ok('GND words and typing', byLabel(P('*G\\ ground'), 'G').shape === 'GND' && (A.expandAtCaret('*A\\ gnd ', 8) || {}).text === '*A\\ GND ');
ok('GND is left out of the click cycle', A.nextShape({ shape: 'IAC' }) === 'R' && A.nextShape({ shape: 'D' }) === 'VAC');

// AC sources (Josue, 11/24): amplitude, omega and angle, as the sinusoid or as [amp, omega, angle]
const ac = (k, v) => JSON.stringify(A.readAC(k, v));
ok('readAC: the sinusoid', ac('VAC', '5 cos(377t + 30)') === '{"amp":5,"w":377,"ph":30,"typedPh":30,"fn":"cos"}', ac('VAC', '5 cos(377t + 30)'));
ok('readAC: the three numbers', ac('VAC', '5, 377, 30') === ac('VAC', '5 cos(377t + 30)') && A.readAC('VAC', '[5, 377]').ph === 0);
ok('readAC: sin is cos − 90°, prefixes, units, ° and negative angles', A.readAC('VAC', 'sin(1000t)').ph === -90 && A.readAC('VAC', 'sin(1000t)').amp === 1
  && near(A.readAC('IAC', '2m cos(1000t - 45°)').amp, 2e-3) && A.readAC('IAC', '2m cos(1000t - 45°)').ph === -45 && near(A.readAC('IAC', '2mA cos(1e3t)').w, 1000)
  && A.readAC('VAC', '5 cos(377t) V').amp === 5 && A.readAC('VAC', '5 cos(377t) A') === null && A.readAC('VAC', '5 cos(377)') === null && A.readAC('VAC', 'big') === null);
ok('AC source words and typing', byLabel(P('*V1\\ vac'), 'V1').shape === 'VAC' && byLabel(P('*I1\\ AC_CURR_SRC'), 'I1').shape === 'IAC' && (A.expandAtCaret('*A\\ vac ', 8) || {}).text === '*A\\ AC_VOLT_SRC ');
ok('the source shows its sinusoid', byLabel(P('*V1\\ AC_VOLT_SRC = 5 cos(377t + 30)'), 'V1').value === '5 cos(377t + 30°) V' && byLabel(P('*V1\\ AC_VOLT_SRC = [5, 377, 30]'), 'V1').value === '5 cos(377t + 30°) V'
  && byLabel(P('*I1\\ AC_CURR_SRC = 2m sin(1000t)'), 'I1').value === '2 sin(1000t) mA', byLabel(P('*I1\\ AC_CURR_SRC = 2m sin(1000t)'), 'I1').value);
ok('an AC source cannot measure its own quantity', P('*V1, R1\\ AC_VOLT_SRC = [1, 1, 0], RES = 1k; MEAS V').errors.length === 1 && P('*I1, R1\\ AC_CURR_SRC = [1, 1, 0], RES = 1k; MEAS I').errors.length === 1);
// RC at omega 1000: Xc = 1/(1000·1µ) = 1 kΩ, so I = 10/(1k − j1k) = 5 + j5 mA; V_R = 5 + j5 V, V_C = 5 − j5 V
const rc = '*V1, R1, C1\\ AC_VOLT_SRC = 10 cos(1000t), RES = 1k, CAP = 1u; , MEAS V, MEAS V';
m = P(rc);
ok('RC: V_R = 7.07 V ∠ 45°, V_C = 7.07 V ∠ −45°', byLabel(m, 'R1').measValue === '7.07 V ∠ 45°' && byLabel(m, 'C1').measValue === '7.07 V ∠ −45°', JSON.stringify([byLabel(m, 'R1').measValue, byLabel(m, 'C1').measValue, m.warnings]));
ok('RC: the phasor numbers', near(byLabel(m, 'C1').measAC[0].re, 5) && near(byLabel(m, 'C1').measAC[0].im, -5) && byLabel(m, 'C1').measNum === 0);
// the form is written after MEAS (Josue, 11/24): POLE, RECT or SINE, each marker its own, polar when none is given
const rcForm = f => byLabel(P(`*V1, R1, C1\\ AC_VOLT_SRC = 10 cos(1000t), RES = 1k, CAP = 1u; , , MEAS V ${f}`), 'C1').measValue;
ok('MEAS V RECT', rcForm('RECT') === '5 − j5 V', rcForm('RECT'));
ok('MEAS V SINE', rcForm('SINE') === '7.07 cos(1000t − 45°) V', rcForm('SINE'));
ok('MEAS V POLE', rcForm('POLE') === '7.07 V ∠ −45°', rcForm('POLE'));
ok('the form words match in any case and may come before the quantity', rcForm('rect') === '5 − j5 V' && byLabel(P('*V1, R1, C1\\ AC_VOLT_SRC = 10 cos(1000t), RES = 1k, CAP = 1u; , , MEAS SINE V'), 'C1').measValue === '7.07 cos(1000t − 45°) V');
m = P('*V1, R1, C1\\ AC_VOLT_SRC = 10 cos(1000t), RES = 1k, CAP = 1u; , MEAS I RECT, MEAS SINE');
ok('each marker keeps its own form; MEAS SINE alone is V', byLabel(m, 'R1').measValue === '5 + j5 mA' && byLabel(m, 'C1').meas === 'V' && byLabel(m, 'C1').measValue === '7.07 cos(1000t − 45°) V', JSON.stringify([byLabel(m, 'R1').measValue, byLabel(m, 'C1').measValue]));
ok('a form does not change a DC reading', read('*V1, R1\\ VOLT_SRC = 5, RES = 4.7k; , MEAS V RECT', 'R1') === 5 && byLabel(P('*V1, R1\\ VOLT_SRC = 5, RES = 4.7k; , MEAS V RECT'), 'R1').measValue === '5 V');
ok('the Settings page no longer holds an AC form', !('acForm' in A.SETTINGS));
// the rect shape word is gone: a box is the default, so an old script still draws a box and warns
m = P('*A, B, C\\ tri, rect, x');
ok('rect and x are no longer shapes: a box, with a warning each', !byLabel(m, 'B').shape && !byLabel(m, 'C').shape && m.warnings.filter(w => /no longer a shape/.test(w)).length === 2, JSON.stringify(m.warnings));
ok('the v4 form with rect keeps its behavior', P('*S, A\\ series\n*B, C\\ tri, rect, branch wait\n*D\\ return').branches.length === 1 && byLabel(P('*S, A\\ series\n*B, C\\ tri, rect, branch wait\n*D\\ return'), 'B').shape === 'tri');
ok('a click cycles back to the plain box, not rect', A.nextShape({ shape: 'io' }) === 'auto' && A.nextShape({ shape: 'io', role: 'start' }) === 'proc' && A.nextShape({}) === 'tri');
// RL with the three-number form: XL = 1000·1 H = 1 kΩ, so V_L = 10·j1k/(1k + j1k) = 5 + j5 V and I = 5 − j5 mA
m = P('*V1, R1, L1\\ AC_VOLT_SRC = [10, 1000, 0], RES = 1k, IND = 1; , , MEAS V\n*\\');
ok('RL: V_L = 7.07 V ∠ 45°', byLabel(m, 'L1').measValue === '7.07 V ∠ 45°', byLabel(m, 'L1').measValue);
ok('RL: I_L = 7.07 mA ∠ −45°', byLabel(P('*V1, R1, L1\\ AC_VOLT_SRC = [10, 1000, 0], RES = 1k, IND = 1; , , MEAS I'), 'L1').measValue === '7.07 mA ∠ −45°');
ok('the source angle carries through: 5 mA ∠ 30°', byLabel(P('*V1, R1\\ AC_VOLT_SRC = 5 cos(377t + 30), RES = 1k; , MEAS I'), 'R1').measValue === '5 mA ∠ 30°');
ok('sin is −90°: 5 mA ∠ −90°', byLabel(P('*V1, R1\\ AC_VOLT_SRC = 5 sin(377t), RES = 1k; , MEAS I'), 'R1').measValue === '5 mA ∠ −90°');
ok('AC current source: 2 mA through 1k is 2 V ∠ 0°', byLabel(P('*I1, R1\\ AC_CURR_SRC = 2m cos(1000t), RES = 1k; , MEAS V'), 'R1').measValue === '2 V ∠ 0°');
ok('a reversed AC source flips the phase', byLabel(P('*V1, R1\\ AC_VOLT_SRC REV = 5 cos(377t), RES = 1k; , MEAS V'), 'R1').measValue === '5 V ∠ 180°', byLabel(P('*V1, R1\\ AC_VOLT_SRC REV = 5 cos(377t), RES = 1k; , MEAS V'), 'R1').measValue);
ok('a dependent source follows an AC reading', byLabel(P('*V1, R1, Rx, E1, R2\\ AC_VOLT_SRC = cos(1000t), RES = 1k, RES = 1k, DEP_VOLT_SRC = [2*V(Rx)], RES = 1k; , , , , MEAS V'), 'R2').measValue === '1 V ∠ 0°');
// superposition: DC and AC in one loop add; each omega is its own term
m = P('*V1, V2, R1\\ VOLT_SRC = 2, AC_VOLT_SRC = 3 cos(1000t), RES = 1k; , , MEAS V');
ok('DC plus AC: both terms, the phasor names its omega', byLabel(m, 'R1').measValue === '2 V + 3 V ∠ 0° @ 1000 rad/s' && near(byLabel(m, 'R1').measNum, 2), byLabel(m, 'R1').measValue);
ok('DC plus AC, RECT: the phasor is bracketed', byLabel(P('*V1, V2, R1\\ VOLT_SRC = 2, AC_VOLT_SRC = 3 cos(1000t + 90), RES = 1k; , , MEAS V RECT'), 'R1').measValue === '2 V + (0 + j3 V) @ 1000 rad/s', byLabel(P('*V1, V2, R1\\ VOLT_SRC = 2, AC_VOLT_SRC = 3 cos(1000t + 90), RES = 1k; , , MEAS V RECT'), 'R1').measValue);
ok('DC plus AC, SINE', byLabel(P('*V1, V2, R1\\ VOLT_SRC = 2, AC_VOLT_SRC = 3 cos(1000t), RES = 1k; , , MEAS V SINE'), 'R1').measValue === '2 V + 3 cos(1000t) V');
m = P('*V1, V2, R1, C1\\ AC_VOLT_SRC = cos(1000t), AC_VOLT_SRC = cos(2000t), RES = 1k, CAP = 1u; , , , MEAS V');
const cterms = byLabel(m, 'C1').measAC;
// at 1000 the RC is the 45° case above (0.707 ∠ −45°); at 2000 Xc is 500 Ω, so V_C = 1·(−j500)/(1k − j500) = 0.2 − j0.4
ok('two omegas: one phasor each, solved apart', cterms.length === 2 && near(cterms[0].re, 0.5) && near(cterms[0].im, -0.5) && near(cterms[1].re, 0.2) && near(cterms[1].im, -0.4), JSON.stringify(cterms));
ok('two omegas: written as a sum', byLabel(m, 'C1').measValue === '707 mV ∠ −45° @ 1000 rad/s + 447 mV ∠ −63.4° @ 2000 rad/s', byLabel(m, 'C1').measValue);
ok('a capacitor in a DC-only circuit still needs no value', near(read('*V1, R1, C1\\ VOLT_SRC = 5, RES = 1k, CAP; , , MEAS V', 'C1'), 5));

// what is not simulated, and why
const why = s => (P(s).warnings.find(w => /^Not simulated/.test(w)) || '');
ok('missing value', /R1 needs a number/.test(why('*V1, R1\\ VOLT_SRC = 5, RES; , MEAS V')));
ok('flow block in a circuit', /flow block/.test(why('*V1, P1, R1\\ VOLT_SRC = 5, PROC, RES = 1k; , , MEAS V')));
ok('two voltage sources fighting', /cannot be solved/.test(why('*V1, V2\\ VOLT_SRC = 5, VOLT_SRC = 3; MEAS I\n*V3\\ VOLT_SRC = 2; BRANCH RETURN')), why('*V1, V2\\ VOLT_SRC = 5, VOLT_SRC = 3; MEAS I\n*V3\\ VOLT_SRC = 2; BRANCH RETURN'));
ok('AC value not understood', /V1 needs an AC value/.test(why('*V1, R1\\ AC_VOLT_SRC = 5, RES = 1k; , MEAS V')));
ok('AC: a capacitor needs its value', /C1 needs a number/.test(why('*V1, C1\\ AC_VOLT_SRC = cos(1000t), CAP; , MEAS V')));
ok('AC with a diode waits for a time simulation', /D1 is a diode in a circuit with AC sources/.test(why('*V1, R1, D1\\ AC_VOLT_SRC = 5 cos(377t), RES = 1k, DIODE; , MEAS V')));
ok('unknown control name',/not a part/.test(why('*V1, E1, R1\\ VOLT_SRC = 1, DEP_VOLT_SRC = [2*V(Q9)], RES = 1k; , , MEAS V')));
ok('no MEAS: no solving and no notes', !P('*V1, R1\\ VOLT_SRC = 5, RES').warnings.length);
m = P('*V1, R1\\ VOLT_SRC = 5, RES; , MEAS V');
ok('unsolved: the marker keeps its quantity only', byLabel(m, 'R1').measValue === undefined && /class="meas"[^]*>V</.test(A.renderSVG(m)));

// drawing the ground return
let svg = A.renderSVG(P('*V1, R1\\ VOLT_SRC = 5, RES = 1k'));
ok('a circuit draws the ground return', /class="gnd"/.test(svg));
ok('a flow diagram does not', !/class="gnd"/.test(A.renderSVG(P('*A, B\\ PROC, DEC'))));
m = P('*V1, R1\\ VOLT_SRC = 5, RES = 1k\n*R2\\ RES = 1k; BRANCH RETURN');
A.renderSVG(m);
ok('bottom: the return runs below the lowest row', m.groundY > byLabel(m, 'R2').y + 40);
A.SETTINGS.groundPos = 'top';
A.renderSVG(m);
ok('top: the return runs above the top row', m.groundY < byLabel(m, 'V1').y - 40);
A.SETTINGS.groundPos = 'bottom';

// top-down view (Josue, 11/24): the same plan turned, blocks upright, parts turned to run down the page
const lr = P('*V1, R1\\ VOLT_SRC = 5, RES = 1k; , MEAS V\n*R2, G1\\ RES = 2k, GND; BRANCH; MEAS I');
const lrSvg = A.renderSVG(lr), lrPos = lr.nodes.map(n => [n.x, n.y]);
A.SETTINGS.direction = 'td';
const tdm = P('*V1, R1\\ VOLT_SRC = 5, RES = 1k; , MEAS V\n*R2, G1\\ RES = 2k, GND; BRANCH; MEAS I');
const tdSvg = A.renderSVG(tdm), [v1, r1, r2] = ['V1', 'R1', 'R2'].map(l => byLabel(tdm, l));
ok('top-down: the main path runs down the page in one column', v1.x === r1.x && r1.y > v1.y, JSON.stringify([v1.x, v1.y, r1.x, r1.y]));
ok('top-down: a branch is a column to the right, its first part lower down', r2.x > r1.x && r2.y > r1.y);
ok('top-down: parts are turned a quarter, labels sit beside them', /rotate\(90 /.test(tdSvg) && tdSvg.includes(`x="${r1.x + 20}"`));
ok('top-down: the ground return runs right of the last column', tdm.groundQ > r2.x + 40 && /class="gnd"/.test(tdSvg) && /rotate\(-90 /.test(tdSvg));
ok('top-down: the readings are the same', byLabel(tdm, 'R1').measValue === byLabel(lr, 'R1').measValue && byLabel(tdm, 'R2').measValue === byLabel(lr, 'R2').measValue, byLabel(tdm, 'R1').measValue);
ok('top-down: the page size is whole pixels (the zoom reads it as an integer)', /<svg[^>]* width="\d+" height="\d+"/.test(tdSvg), (tdSvg.match(/<svg[^>]*>/) || [''])[0]);
ok('top-down: the page is taller than it is wide for a long path', (() => { const t = P('*A, B, C, D, E, F\\'); A.renderSVG(t); return t.height > t.width; })());
const fl = P('*S, A\\ series\n*B\\ BRANCH WAIT\n*C\\ RETURN\n*D\\ end');
const flSvg = A.renderSVG(fl);
ok('top-down: blocks stay upright (no turn) and wires meet their top and bottom', !/rotate/.test(flSvg) && flSvg.includes(`${byLabel(fl, 'S').y + 22} L`) || flSvg.includes(` ${byLabel(fl, 'S').y + 22}`));
A.SETTINGS.groundPos = 'top';
A.renderSVG(tdm);
ok('top-down with the ground on top: the return runs left of the first column', tdm.groundQ < v1.x - 40);
A.SETTINGS.groundPos = 'bottom';
A.SETTINGS.direction = 'lr';
A.renderSVG(lr);
ok('left to right is unchanged by the flow coordinates', A.renderSVG(lr) === lrSvg && JSON.stringify(lr.nodes.map(n => [n.x, n.y])) === JSON.stringify(lrPos));

// Enter (Josue, 11/24): closes an open list, or starts the next line with its * typed
const type = keys => {
  let t = '', c = 0;
  for (const k of keys) {
    if (k === '\n') { const r = A.enterAt(t, c); if (r) { t = r.text; c = r.caret; } else { t = t.slice(0, c) + '\n' + t.slice(c); c++; } }
    else { t = t.slice(0, c) + k + t.slice(c); c += k.length; }
  }
  return t;
};
ok('Enter on an empty script types the opening *', type(['\n']) === '*');
ok('Enter on the name line closes it and opens the next line', type(['\n', 'Schematic', '\n']) === '*Schematic\\\n*');
ok('Enter on an element list closes it, ready for the specifier', type(['\n', 'T', '\n', 'A, B', '\n']) === '*T\\\n*A, B\\ ');
ok('Enter on a closed line starts the next with *', type(['\n', 'T', '\n', 'A', '\n', 'RES = 1k', '\n']) === '*T\\\n*A\\ RES = 1k\n*');
ok('Enter right after closing (no specifier) goes on to the next line', type(['\n', 'T', '\n', 'A', '\n', '\n']) === '*T\\\n*A\\\n*');
ok('Enter writes out a last shorthand letter first', type(['\n', 'T', '\n', 'A', '\n', 's', '\n']) === '*T\\\n*A\\ SERIES\n*');
ok('Enter on a bare * closes the diagram; after that it is a plain line break', type(['\n', 'T', '\n', 'A', '\n', '\n', '\n', '\n']) === '*T\\\n*A\\\n*\\\n');
ok('Enter inside an open [ ] value is a plain line break', type(['\n', 'T', '\n', 'A', '\n', 'proc = [x, ', '\n']) === '*T\\\n*A\\ proc = [x, \n');
ok('Enter in the middle of a line is a plain line break', A.enterAt('*T\\\n*A, B\\', 6) === null);
ok('Enter keeps the tabbing: a line inside a waiting branch', type(['\n', 'T', '\n', 'A', '\n', '\n', 'B', '\n', 'BRANCH WAIT', '\n', 'C', '\n']) === '*T\\\n*A\\\n   *B\\ BRANCH WAIT\n   *C\\ ');
ok('the typed script draws', (() => { const m = A.parse(type(['\n', 'T', '\n', 'V1, R1', '\n', 'VOLT_SRC = 5, RES = 1k; , MEAS V', '\n', '\n'])); return !m.errors.length && byLabel(m, 'R1').measValue === '5 V'; })());

ok('the whole page script parses', (() => { try { new Function(page.split('<script>')[1].split('</script>')[0]); return true; } catch (e) { console.log('   ' + e.message); return false; } })());

const out = process.argv[2];
if (out) {
  const demo = `*Divider\\
*V1, R1\\ VOLT_SRC = 10, RES = 1k; , MEAS V
*R2, G1\\ RES = 1k, GND; BRANCH; MEAS V
*D1, R3\\ DIODE, RES = 2k; MEAS V, MEAS I
*\\`;
  fs.writeFileSync(path.join(out, 'v6Divider.svg'), A.renderSVG(A.parse(demo)));
  const dm = A.parse(demo);
  console.log('demo readings: ' + dm.nodes.filter(n => n.measValue).map(n => n.label + ' ' + n.meas + ' = ' + n.measValue).join(', ') + '\ndemo notes: ' + JSON.stringify([dm.errors, dm.warnings]));
}
console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
