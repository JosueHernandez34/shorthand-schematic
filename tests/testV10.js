// node testV10.js -> flow checks: per-block status ok / unused / bad (shorthandSchematicV10.html)
const fs = require('fs'), vm = require('vm'), path = require('path');
const page = fs.readFileSync(path.join(__dirname, '..', 'shorthandSchematicV10.html'), 'utf8');
const core = page.split('// ==CORE-START==')[1].split('// ==CORE-END==')[0];
const ctx = {}; vm.createContext(ctx);
vm.runInContext(core + ';this.A={parse,renderSVG,flowStatus,runOptions,explorePaths,runForced}', ctx);
const A = ctx.A;
let fails = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) fails++; };
const show = m => JSON.stringify({ e: m.errors, w: m.warnings });
const BS = '\\';
// a script is written with a backslash after each element list; build it from lines so the escapes stay readable
const S = (...lines) => lines.join('\n').replace(/\\/g, BS);
const label = m => m.nodes.filter(n => n.type === 'el').map(n => n.label + ':' + n.status).join(' ');

// the shipped example: every block is reached and can finish
let m = A.parse(S('*Schematic\\', '*S, A\\ SERIES', '   *A_1\\ BRANCH WAIT', '      *A_2, B_2\\ BRANCH RETURN^2', '   *B_1\\ RETURN', '*B\\ SERIES', '*C, D\\ SERIES', '*E\\ END', '*\\', ''));
ok('valid tree: no errors, no warnings', !m.errors.length && !m.warnings.length, show(m));
ok('valid tree: every block is ok', m.nodes.filter(n => n.type === 'el').every(n => n.status === 'ok'), label(m));
ok('a green check is drawn for ok blocks', /class="status ok"/.test(A.renderSVG(m, undefined, true)));
ok('downloads carry no status marks', !/class="status/.test(A.renderSVG(m)));

// a branch that stops with no END is the existing error, and its block is bad
m = A.parse(S('*T\\', '*A, B\\ PROC, DEC', '   *C\\ BRANCH PROC', '*D\\ PROC', '*E\\ END', '*\\', ''));
ok('branch with no END: an error and a bad block', m.errors.length >= 1 && m.nodes.some(n => n.status === 'bad'), show(m) + ' ' + label(m));
ok('the open end is reported once', m.errors.filter(e => /END/.test(e)).length <= 1, show(m));
ok('a bad block draws the red mark', /class="status bad"/.test(A.renderSVG(m, undefined, true)));

// circuits are not flow diagrams: no status
m = A.parse(S('*T\\', '*G1, V1, R1, G2\\ GND, VS = 5, RES = 1k, GND', '*\\'));
ok('circuit blocks have no flow status', m.nodes.every(n => n.status === undefined), show(m));

// the script cannot yet write an unreachable block or a loop with no exit, so those two cases run on a built model
const el = (id, extra) => Object.assign({ id, type: 'el', label: 'N' + id, ln: id + 1 }, extra);
const fake = (nodes, edges, mainEnd) => ({ nodes, edges, errors: [], warnings: [], mainStart: 0, mainEnd });
m = fake([el(0), el(1), el(2, { role: 'end' }), el(3)], [[0, 1], [1, 2]], 2); A.flowStatus(m, -1);
ok('a block no run reaches is unused, with a warning and no error', m.nodes[3].status === 'unused' && m.warnings.length === 1 && !m.errors.length, show(m));
m = fake([el(0), el(1), el(2), el(3, { role: 'end' })], [[0, 1], [1, 2], [2, 1]], 3); A.flowStatus(m, -1);
ok('a loop with no way out is an error and its blocks are bad', m.nodes[1].status === 'bad' && m.nodes[2].status === 'bad' && m.errors.length === 1, show(m));
m = fake([el(0), el(1), el(2), el(3, { role: 'end' })], [[0, 1], [1, 2], [2, 1], [2, 3]], 3); A.flowStatus(m, -1);
ok('a loop with an exit is fine', m.nodes.every(n => n.status === 'ok') && !m.errors.length, show(m));

// stepped run: a decision offers yes then no, a plain block offers one step, END offers none
m = A.parse(S('*T\\', '*A, B\\ PROC, DEC', '   *C\\ BRANCH PROC, END', '*D\\ PROC', '*E\\ END', '*\\', ''));
const id = l => m.nodes.find(n => n.type === 'el' && n.label === l).id;
ok('a decision offers yes, then no', JSON.stringify(A.runOptions(m, id('B')).map(o => o.label)) === '["yes","no"]', JSON.stringify(A.runOptions(m, id('B')).map(o => o.label)));
ok('yes goes on along the path, no goes to the branch', A.runOptions(m, id('B'))[0].to === id('D') && A.runOptions(m, id('B'))[1].to === id('C'));
ok('a plain block offers its one next block', A.runOptions(m, id('A')).length === 1 && A.runOptions(m, id('A'))[0].to === id('B'));
ok('END offers nothing', A.runOptions(m, id('E')).length === 0);

// only a decision is a choice: a plain block and a BRANCH fork both go on without asking
ok('a decision is a choice (no forced step)', A.runForced(m, id('B')) === null);
ok('a plain block is forced to its next block', A.runForced(m, id('A')).to === id('B'));
const wb = A.parse(S('*Schematic\\', '*S, A\\ SERIES', '   *A_1\\ BRANCH WAIT', '      *A_2, B_2\\ BRANCH RETURN^2', '   *B_1\\ RETURN', '*B\\ SERIES', '*C, D\\ SERIES', '*E\\ END', '*\\', ''));
const wid = l => wb.nodes.find(n => n.type === 'el' && n.label === l).id;
let walk = wid('S'), steps = 0;
for (let f = A.runForced(wb, walk); f && steps < 50; f = A.runForced(wb, walk)) { walk = f.to; steps++; }
ok('a run with no decision goes all the way to the END, through the BRANCH fork', wb.nodes[walk].role === 'end', wb.nodes[walk].label);

// explore all paths: two paths through the decision, both finish, every block reached
let ex = A.explorePaths(m);
ok('explore finds both paths and both end', ex.paths.length === 2 && ex.paths.every(p => p.end === 'end'), JSON.stringify(ex.paths));
ok('explore reaches every block', ex.unreached.length === 0 && ex.reached.size >= 5);
// a block nothing leads to is reported as not reached
m = fake([el(0), el(1, { role: 'end' }), el(2)], [[0, 1]], 1);
ex = A.explorePaths(m);
ok('a block no path reaches is listed as not reached', ex.unreached.length === 1 && ex.unreached[0].id === 2);
// a loop with no exit ends its path as a loop, not forever
m = fake([el(0), el(1), el(2, { role: 'end' })], [[0, 1], [1, 0]], 2);
ex = A.explorePaths(m);
ok('a loop with no exit ends its path as a loop', ex.paths.length === 1 && ex.paths[0].end === 'loop', JSON.stringify(ex.paths));

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
