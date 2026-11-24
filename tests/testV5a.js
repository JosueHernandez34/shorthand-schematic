// node testV5a.js [outDir] -> specifier groups, flow blocks, values, colors, yes/no, end guard, hotkey (shorthandSchematicV5a.html)
const fs = require('fs'), vm = require('vm'), path = require('path');
const page = fs.readFileSync(path.join(__dirname, '..', 'shorthandSchematicV5a.html'), 'utf8');
const core = page.split('// ==CORE-START==')[1].split('// ==CORE-END==')[0];
// HOTKEY and hotkeyText sit just after CORE-END, outside the browser-only block
const hk = page.split('// ==CORE-END==')[1].split("if (typeof document !== 'undefined')")[0];
const ctx = {}; vm.createContext(ctx);
vm.runInContext(core + hk + ';this.A={parse,renderSVG,edgeList,setShape,readSpecifier,splitSequences,endWordRange,hotkeyText,HOTKEY,EXAMPLE}', ctx);
const A = ctx.A;
let fails = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const byLabel = (m, l) => m.nodes.find(n => n.type === 'el' && n.label === l);
const P = s => A.parse('*T\\\n' + s + '\n*\\');

// groups: one property type per group, one entry per element, any order
let m = P('*A, B\\ R, C; red, blue');
ok('two groups: colors read per element', byLabel(m, 'A').color === 'red' && byLabel(m, 'B').color === 'blue');
m = P('*A, B\\ red, blue; proc, dec');
ok('group order does not matter', byLabel(m, 'A').shape === 'proc' && byLabel(m, 'B').shape === 'dec' && byLabel(m, 'B').color === 'blue');
m = P('*A, B\\ proc, dec;');
ok('a trailing semicolon is harmless', byLabel(m, 'B').shape === 'dec' && !m.errors.length);
m = P('*S\\\n*A, B\\ tri, rect, branch wait');
ok('v4 form still works (shapes, then behavior)', byLabel(m, 'A').shape === 'tri' && m.branches.length === 1 && m.branches[0].state === 'waiting');
m = P('*S\\\n*A, B\\ branch, tri');
ok('a shape word after a command is still not a shape', byLabel(m, 'B').shape === undefined);
m = P('*A, B\\ , red');
ok('an empty entry skips an element', byLabel(m, 'A').color === undefined && byLabel(m, 'B').color === 'red');
m = P('*A\\ dec red = x > 10');
ok('shape, color and value in one entry', byLabel(m, 'A').shape === 'dec' && byLabel(m, 'A').color === 'red' && byLabel(m, 'A').value === 'x > 10');

// values
m = P('*P1\\ proc = load data');
ok('value kept as typed', byLabel(m, 'P1').value === 'load data');
m = P('*A, B\\ proc = read, dec = x > 10; red, blue');
ok('values attach to each entry', byLabel(m, 'A').value === 'read' && byLabel(m, 'B').value === 'x > 10' && byLabel(m, 'B').color === 'blue');
m = P('*D1\\ dec = [x > 10, y < 3; z]; green');
ok('bracketed value holds commas and semicolons', byLabel(m, 'D1').value === 'x > 10, y < 3; z' && byLabel(m, 'D1').color === 'green', byLabel(m, 'D1').value);
m = P('*R1\\ = 4.7k');
ok('a period types into a value (4.7k)', byLabel(m, 'R1').value === '4.7k');
m = P('*S\\\n*X\\ proc = b');
ok('a value is never read as a command (b stays b)', byLabel(m, 'X').value === 'b' && !m.branches.length);
ok('a value widens its block', byLabel(P('*A\\ proc = a much longer value'), 'A').w > byLabel(P('*A\\ proc'), 'A').w);

// flow words and letters
m = P('*A, B, C\\ p, d, i');
ok('letters p, d, i give proc, dec, io', same([byLabel(m, 'A').shape, byLabel(m, 'B').shape, byLabel(m, 'C').shape], ['proc', 'dec', 'io']));
m = P('*A, B\\ dia, dec');
ok('dia and dec both remain', byLabel(m, 'A').shape === 'dia' && byLabel(m, 'B').shape === 'dec');
m = P('*A, B\\ Proc RED');
ok('words match in any case', byLabel(m, 'A').shape === 'proc' && byLabel(m, 'A').color === 'red');
m = P('*S, A\\');
ok('the first element is the start', byLabel(m, 'S').role === 'start');
let svg = A.renderSVG(P('*A, B, C\\ proc, dec = ok?, io'));
ok('io is drawn as a 4-point polygon, dec as a diamond', (svg.match(/<polygon/g) || []).length === 2 && svg.includes('ok?'));

// e is free, end is spelled out
m = P('*S\\\n*E\\ e');
ok('e is not end any more', byLabel(m, 'E').role === undefined && !m.errors.length);
m = P('*S\\\n*E\\ end');
ok('end still ends', byLabel(m, 'E').role === 'end');
ok('endWordRange finds only the word end', A.endWordRange('*E\\ e') === null && A.endWordRange('*E\\ end') !== null);

// end guard: an end with anything after it
m = P('*S, A\\ end\n*B\\');
ok('end in the middle of the main path: error and X', byLabel(m, 'A').badEnd && byLabel(m, 'A').role === undefined && /continues after it/.test(m.errors[0]), JSON.stringify(m.errors));
ok('...the line is marked for the editor', same(m.badEnds, [2]));
m = P('*S, A\\\n*X, Y\\ branch end\n*B\\');
ok('end on a terminating branch: allowed', byLabel(m, 'Y').role === 'end' && !m.errors.length, JSON.stringify(m.errors));
m = P('*S, A\\\n*X\\ branch wait\n*Y\\ return end\n*B\\');
ok('end on a return line (the path rejoins after it): X', byLabel(m, 'Y').badEnd && !byLabel(m, 'Y').role, JSON.stringify(m.errors));
m = P('*S, A\\\n*X\\ branch wait\n*E\\ end');
ok('end while a branch waits: still refused', byLabel(m, 'E').badEnd && /waiting on a return/.test(m.errors.join(' ')));
m = A.parse(A.EXAMPLE);
ok('v1 example: E is the end, no errors', byLabel(m, 'E').role === 'end' && !m.errors.length);
ok('the X is drawn', /class="badx"/.test(A.renderSVG(P('*S, A\\ end\n*B\\'))));

// yes and no
const thermo = `*Thermostat\\
*Begin, Read\\ io = read temp
*Check\\ dec = temp > 30
*Fan\\ proc = fan on; branch return
*Idle\\ proc = wait 1 s
*Stop\\ end
*\\`;
m = A.parse(thermo);
ok('thermostat: no errors or warnings', !m.errors.length && !m.warnings.length, JSON.stringify([m.errors, m.warnings]));
const e = A.edgeList(m);
ok('thermostat: no path through Fan rejoins after Idle', e.includes('Check -> J3') && e.some(x => /^J3 -> Fan$/.test(x)) && e.includes('J3 -> Idle') && e.some(x => /Fan -> J\d+/.test(x)), e.join(' | '));
svg = A.renderSVG(m);
ok('yes and no labels drawn once each', (svg.match(/>yes</g) || []).length === 1 && (svg.match(/>no</g) || []).length === 1);
ok('no labels without a decision', !/>yes<|>no</.test(A.renderSVG(A.parse(A.EXAMPLE))));

// colors in the drawing
svg = A.renderSVG(P('*A, B\\ red, blue'));
ok('colors: fill and outline used', svg.includes('#ffe3e3') && svg.includes('#c92a2a') && svg.includes('#d0ebff'));

// click to change shape keeps color and value
let t = A.setShape('*T\\\n*A, B\\ proc red = go, dec = x\n*\\', 2, 1, 'circ', ['auto', 'rect']);
ok('setShape swaps the shape word, keeps color and value', t.split('\n')[1] === '*A, B\\ proc red = go, circ = x', t.split('\n')[1]);
t = A.setShape('*T\\\n*A, B\\ red, blue; branch wait\n*\\', 2, 0, 'tri', ['auto', 'rect']);
ok('setShape adds a shape in front of a color', t.split('\n')[1] === '*A, B\\ tri red, blue; branch wait', t.split('\n')[1]);
t = A.setShape('*T\\\n*A, B\\ branch wait\n*\\', 2, 1, 'tri', ['auto', 'rect']);
ok('setShape on a line with no entries: v4 form', t.split('\n')[1] === '*A, B\\ auto, tri, branch wait', t.split('\n')[1]);

// typing: hotkey and brackets
ok('hotkey is the apostrophe', A.HOTKEY === "'");
ok('hotkey closes an open list', A.hotkeyText('*A, B') === '\\');
ok('hotkey opens a list after a finished one', A.hotkeyText('*A\\ proc') === '*');
ok('hotkey types itself inside an open [ ] value', A.hotkeyText('*A\\ dec = [don') === "'");
const sq = A.splitSequences('*A\\ dec = [a*b] *B\\', 0);
ok('a * inside brackets does not start a new line, one after does', sq.text === '*A\\ dec = [a*b]\n*B\\', JSON.stringify(sq.text));

const out = process.argv[2];
if (out) {
  fs.writeFileSync(path.join(out, 'v5aThermostat.svg'), A.renderSVG(A.parse(thermo)));
  const mixed = `*Mixed\\
*Begin, Read\\ io = read sensor; blue
*Check\\ dec red = [temp > 30, rising]
*Fan, Log\\ proc = fan on, io = log it; orange, gray; branch wait
*Wait\\ proc = 2.5 s; green
*Done\\ return
*Idle\\ proc = sleep
*Stop\\ end
*\\`;
  fs.writeFileSync(path.join(out, 'v5aMixed.svg'), A.renderSVG(A.parse(mixed)));
  fs.writeFileSync(path.join(out, 'v5aBadEnd.svg'), A.renderSVG(P('*S, A\\ end\n*B, C\\')));
  console.log('thermostat edges:\n  ' + A.edgeList(A.parse(thermo)).join('\n  '));
  const mm = A.parse(mixed);
  console.log('mixed edges:\n  ' + A.edgeList(mm).join('\n  ') + '\nmixed errors/warnings: ' + JSON.stringify([mm.errors, mm.warnings]));
}
console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
