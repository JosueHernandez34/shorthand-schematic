// node testV4.js -> shape commands, click-to-shape editing and shape drawing in shorthandSchematicV4.html
const fs = require('fs'), vm = require('vm'), path = require('path');
const page = fs.readFileSync(path.join(__dirname, '..', 'shorthandSchematicV4.html'), 'utf8');
const core = page.split('// ==CORE-START==')[1].split('// ==CORE-END==')[0];
const ctx = {}; vm.createContext(ctx);
vm.runInContext(core + ';this.A={parse,renderSVG,edgeList,setShape,nextShape,splitShapes,EXAMPLE}', ctx);
const A = ctx.A;
let fails = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const els = m => m.nodes.filter(n => n.type === 'el');
const byLabel = (m, l) => els(m).find(n => n.label === l);

// parsing: shapes first, then location commands
let m = A.parse('*T\\\n*A, B\\ tri, rect\n*C\\ series\n*\\');
ok('tri, rect: A triangle, B rectangle', byLabel(m, 'A').shape === 'tri' && byLabel(m, 'B').shape === 'rect', JSON.stringify(els(m).map(n => n.shape)));
ok('elements without a written shape stay default', byLabel(m, 'C').shape === undefined);
m = A.parse('*T\\\n*S, A\\ s\n*X, Y\\ tri, rect, branch wait\n*Z\\ r\n*B\\ s\n*\\');
ok('shapes then branch wait: one waiting branch, shapes read', byLabel(m, 'X').shape === 'tri' && byLabel(m, 'Y').shape === 'rect' && m.branches.length === 1);
ok('...and the return still closes it (no warnings or errors)', m.warnings.length === 0 && m.errors.length === 0, JSON.stringify(m.warnings));
const plain = A.parse('*T\\\n*S, A\\ s\n*X, Y\\ branch wait\n*Z\\ r\n*B\\ s\n*\\');
ok('shapes do not change the wiring', same(A.edgeList(m), A.edgeList(plain)));
m = A.parse('*T\\\n*A, B\\ t, x\n*\\');
ok('letters t and x work', byLabel(m, 'A').shape === 'tri' && byLabel(m, 'B').shape === 'rect');
m = A.parse('*T\\\n*A, B\\ Triangle, Circle\n*\\');
ok('full words, any case', byLabel(m, 'A').shape === 'tri' && byLabel(m, 'B').shape === 'circ');
m = A.parse('*T\\\n*A, B\\ circ\n*\\');
ok('fewer shapes than elements: the rest default', byLabel(m, 'A').shape === 'circ' && byLabel(m, 'B').shape === undefined);
m = A.parse('*T\\\n*A\\ tri, dia\n*\\');
ok('more shapes than elements: the extra word is left over, no error', byLabel(m, 'A').shape === 'tri' && !m.errors.length);
m = A.parse('*T\\\n*A, B\\ auto, dia\n*\\');
ok('auto keeps the default look', byLabel(m, 'A').shape === undefined && byLabel(m, 'B').shape === 'dia' && byLabel(m, 'A').role === 'start');
m = A.parse('*T\\\n*S\\ s\n*A, B\\ branch, tri\n*\\');
ok('a shape word after a command is not a shape', byLabel(m, 'A').shape === undefined && byLabel(m, 'B').shape === undefined);

// drawing
const svg = A.renderSVG(A.parse('*T\\\n*A, B, C, D\\ tri, circ, dia, rect\n*\\'));
const polys = [...svg.matchAll(/<polygon points="([^"]*)"/g)].map(x => x[1].split(' ').length);
ok('triangle (3 points) and diamond (4 points) drawn as polygons', polys.includes(3) && polys.includes(4), JSON.stringify(polys));
ok('circle drawn as an ellipse', svg.includes('<ellipse'));
ok('explicit rect overrides the start pill', !A.renderSVG(A.parse('*T\\\n*A\\ rect\n*\\')).includes('rx="22"'));
ok('plain start still a pill', A.renderSVG(A.parse('*T\\\n*A\\ s\n*\\')).includes('rx="22"'));
ok('downloads carry no click targets, screen copy does', !svg.includes('class="blk"') && A.renderSVG(A.parse('*T\\\n*A\\ s\n*\\'), undefined, true).includes('class="blk"'));
ok('click targets carry line and element index', A.renderSVG(A.parse('*T\\\n*A, B\\ s\n*\\'), undefined, true).includes('data-ln="2" data-idx="1"'));
const w1 = A.parse('*T\\\n*AA\\ rect\n*\\').nodes[0].w, w2 = A.parse('*T\\\n*AA\\ dia\n*\\').nodes[0].w;
ok('diamond is wider than a box so the label fits', w2 > w1, w1 + ' vs ' + w2);

// cycling and writing into the script
const nodeOf = (t, l) => byLabel(A.parse(t), l);
const t = '*T\\\n*A, B\\ series';
ok('plain element cycles rect -> tri', A.nextShape(nodeOf(t, 'B')) === 'tri');
ok('start element begins at auto -> tri', A.nextShape(nodeOf(t, 'A')) === 'tri');
let s2 = A.setShape(t, 2, 0, 'tri', ['auto', 'rect']);
ok('first click writes the word before the commands', s2 === '*T\\\n*A, B\\ tri, series', JSON.stringify(s2));
s2 = A.setShape(s2, 2, 1, 'tri', ['auto', 'rect']);
ok('second element click extends the list', s2 === '*T\\\n*A, B\\ tri, tri, series', JSON.stringify(s2));
s2 = A.setShape(t, 2, 1, 'circ', ['auto', 'rect']);
ok('clicking B first fills A with its filler (auto, since A is the start)', s2 === '*T\\\n*A, B\\ auto, circ, series', JSON.stringify(s2));
s2 = A.setShape('*T\\\n*S\\\n*A, B\\ branch wait', 3, 1, 'tri', ['rect', 'rect']);
ok('non-start filler is rect, branch wait kept after the shapes', s2.endsWith('*A, B\\ rect, tri, branch wait'), JSON.stringify(s2));
s2 = A.setShape('*T\\\n*A, B\\ tri, rect, branch wait', 2, 0, 'rect', ['auto', 'rect']);
ok('setting back to rect keeps the list', s2 === '*T\\\n*A, B\\ rect, rect, branch wait', JSON.stringify(s2));
s2 = A.setShape('*T\\\n*A, B\\ tri', 2, 0, 'auto', ['auto', 'rect']);
ok('auto on the only written shape clears the list', s2 === '*T\\\n*A, B\\', JSON.stringify(s2));
s2 = A.setShape('*T\\\n*A, B\\', 2, 0, 'tri', ['auto', 'rect']);
ok('line with no specifier gets one', s2 === '*T\\\n*A, B\\ tri', JSON.stringify(s2));
ok('round trip: written text parses back to the same shape', nodeOf(A.setShape(t, 2, 1, 'dia', ['auto', 'rect']), 'B').shape === 'dia');
let txt = t, seen = [];
for (let i = 0; i < 5; i++) { const nx = A.nextShape(nodeOf(txt, 'B')); seen.push(nx); txt = A.setShape(txt, 2, 1, nx, ['auto', 'rect']); }
ok('five clicks on a plain element cycle tri, circ, dia, rect, tri', same(seen, ['tri', 'circ', 'dia', 'rect', 'tri']), JSON.stringify(seen));
txt = t; seen = [];
for (let i = 0; i < 6; i++) { const nx = A.nextShape(nodeOf(txt, 'A')); seen.push(nx); txt = A.setShape(txt, 2, 0, nx, ['auto', 'rect']); }
ok('start element cycles tri, circ, dia, rect, auto, tri', same(seen, ['tri', 'circ', 'dia', 'rect', 'auto', 'tri']), JSON.stringify(seen));
ok('example edges unchanged', A.edgeList(A.parse(A.EXAMPLE)).length === 15);
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
