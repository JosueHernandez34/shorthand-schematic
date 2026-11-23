// node testV2.js -> checks the CORE block of shorthandSchematicV2.html (star and backslash text)
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
function load(file) {
  const page = fs.readFileSync(path.join(root, file), 'utf8');
  const core = page.split('// ==CORE-START==')[1].split('// ==CORE-END==')[0];
  const ctx = {}; vm.createContext(ctx);
  const names = ['parse', 'renderSVG', 'edgeList', 'highlightAt', 'convertReturnDigits', 'reindentWithCaret', 'splitSequences', 'EXAMPLE'];
  vm.runInContext(core + ';this.A={' + names.map(n => `${n}:typeof ${n}==='undefined'?undefined:${n}`).join(',') + '}', ctx);
  return ctx.A;
}
const V1 = load('shorthandSchematicV1.html'), V2 = load(process.env.APP_FILE || 'shorthandSchematicV2.html');
let fails = 0;
const ok = (name, cond, extra) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!cond) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Tests are written with the period hotkey form (.X. and ..) and turned into the real * and \ text here.
const S = t => t.split('\n').map(l => l === '..' ? '*\\' : l.replace(/^(\s*)\.([^.]*)\./, (m, a, b) => a + '*' + b + '\\')).join('\n');

// (c) the old v1 example (indented, with meet) read by the single V2 reading: same picture as V1
const old1 = V1.parse(V1.EXAMPLE), old2 = V2.parse(V1.EXAMPLE);
ok('c: old example edges identical to V1', same(V1.edgeList(old1), V2.edgeList(old2)));
ok('c: old example SVG identical to V1', V1.renderSVG(old1) === V2.renderSVG(old2));
fs.writeFileSync(path.join(__dirname, 'caseC.svg'), V2.renderSVG(old2));

// (a) whiteboard example in the page's own EXAMPLE text
const a = V2.parse(V2.EXAMPLE);
ok('a: EXAMPLE uses * and \\', V2.EXAMPLE.startsWith('*Schematic\\') && !/^\./m.test(V2.EXAMPLE));
ok('a: edges identical to V1 build', same(V1.edgeList(old1), V2.edgeList(a)), 'warnings=' + a.warnings.length + ' errors=' + a.errors.length);
fs.writeFileSync(path.join(__dirname, 'caseA.svg'), V2.renderSVG(a));

// (b) continue-in-series example
const srcB = S(`.Schematic.
.S, A. series
.A_1. branch wait
.A_2, B_2. branch return^2 wait
.B_1, C_1.
.C_2, D_2. branch return
.D_1. return
.B. series
.C, D. series
.E. end
..
`);
const b = V2.parse(srcB);
console.log('b: errors', b.errors, 'warnings', b.warnings);
console.log('  edges:', V2.edgeList(b).join(', '));
fs.writeFileSync(path.join(__dirname, 'caseB.svg'), V2.renderSVG(b));

const messy = V2.EXAMPLE.split('\n').map((l, i) => ' '.repeat((i * 7) % 11) + l).join('\n');
ok('indent ignored', same(V2.edgeList(a), V2.edgeList(V2.parse(messy))));
ok('periods no longer read as delimiters', V2.parse('.T.\n.A, B.\n..').nodes.length === 0);
ok('closing line *\\ stops reading', V2.parse(S('.T.\n.A, B.\n..\n.C.')).nodes.length === 2);

let r = V2.convertReturnDigits(S('.A_2. branch return2'), 21);
ok('return2 -> return^2, caret moves', r.text === S('.A_2. branch return^2') && r.caret === 22, JSON.stringify(r));
r = V2.convertReturnDigits(S('.A_2. branch return^2'), 22);
ok('return^2 typed by hand untouched', r.text === S('.A_2. branch return^2'));
r = V2.convertReturnDigits(S('.R2D2, return2. x'), 5);
ok('return2 inside the element list untouched', r.text === S('.R2D2, return2. x'));

// auto-tab
r = V2.reindentWithCaret(V2.EXAMPLE, V2.EXAMPLE.length);
ok('reindent: A_2 line at level 2', r.text.split('\n')[3].startsWith('      *A_2'));
ok('reindent: B_1 return at level 1', r.text.split('\n')[4].startsWith('   *B_1'));
ok('reindent: idempotent', V2.reindentWithCaret(r.text, 0).text === r.text);
const t2 = S('.S, A.\n.X. branch wait\n.Y. branch|');
const cpos = t2.indexOf('|'); r = V2.reindentWithCaret(t2.replace('|', ''), cpos);
ok('caret keeps place after indent change', r.text.slice(r.caret - 6, r.caret) === 'branch', JSON.stringify(r));
const blank = S('.T.\n.S, A.\n.X. branch wait\n'); r = V2.reindentWithCaret(blank, blank.length);
ok('blank line after wait gets level 1', r.text.endsWith('\n   ') && r.caret === r.text.length);

// highlight; ex[] is the example, head the first three lines
const ex = V2.EXAMPLE.split('\n'), head = ex.slice(0, 3).join('\n');
const H = (t, ln) => V2.highlightAt(t, ln);
const lanes = h => JSON.stringify([...h.lanes]);
console.log('line 4 branch return^2:', lanes(H(V2.EXAMPLE, 4)));
console.log('line 6 (B) caret:      ', lanes(H(V2.EXAMPLE, 6)));
console.log('line 7 (C, D) caret:   ', lanes(H(V2.EXAMPLE, 7)));
console.log('line 8 (E) caret:      ', lanes(H(V2.EXAMPLE, 8)));
let h = H(head + '\n' + S('.A_2, B_2.'), 4);
ok('open A_1 branch strong before any command', h.lanes.get(1) === 'strong');
h = H(V2.EXAMPLE, 5);
ok('return line: its branch strong, A_2 branch weak', h.lanes.get(1) === 'strong' && h.lanes.get(2) === 'weak', lanes(h));
// creation order: B resolves the first-created branch (A_1 branch, lane 1) before A_2 (lane 2)
h = H(V2.EXAMPLE, 6);
ok('main line B resolves the first-created branch (lane 1 strong, lane 2 weak)', h.lanes.get(1) === 'strong' && h.lanes.get(2) === 'weak', lanes(h));
h = H(V2.EXAMPLE, 7);
ok('main line C, D resolves the next one (lane 2 strong, lane 1 gone)', h.lanes.get(2) === 'strong' && !h.lanes.has(1), lanes(h));
ok('after both rejoins nothing highlighted', H(V2.EXAMPLE, 8).lanes.size === 0);
h = H(S(`.Schematic.
.S, A.
.P. branch return
.Q. branch return
.B.
`), 5);
ok('two returns to main: B resolves the earlier one (lane 1)', h.lanes.get(1) === 'strong' && h.lanes.get(2) === 'weak', lanes(h));
ok('a branch line resolves nothing (no strong on pending)', (() => { const x = H(S(`.Schematic.\n.S, A.\n.P. branch return\n.Q. branch`), 4); return x.lanes.get(1) !== 'strong'; })());
fs.writeFileSync(path.join(__dirname, 'caseHl.svg'), V2.renderSVG(V2.parse(ex.slice(0, 5).join('\n')), H(V2.EXAMPLE, 5).lanes));

// red wait bubble
const w = (t, ln) => V2.highlightAt(t, ln).wait;
ok('bubble: blank line after wait -> on the wait word', JSON.stringify(w(head + '\n', 4)) === '{"ln":3,"from":13,"to":17}', JSON.stringify(w(head + '\n', 4)));
ok('bubble: plain series line at the wait level shows it', !!w(head + '\n' + S('.B_1, C_1.'), 4));
ok('bubble: caret on the wait line itself shows nothing', w(head, 3) === null);
ok('bubble: branching off from inside shows nothing', w(head + '\n' + S('.A_2, B_2. branch'), 4) === null && w(head + '\n' + S('.A_2, B_2. branch return^2'), 4) === null);
ok('bubble: clears when return is written', w(head + '\n' + S('.B_1. return'), 4) === null);
ok('bubble: gone after the return line', w(V2.EXAMPLE, 6) === null);
ok('bubble: continues after an interrupting branch returned', !!w(srcB.split('\n').slice(0, 4).join('\n') + '\n', 5));
ok('bubble: inner wait only', (() => { const r2 = w(head + '\n' + S('.X. branch wait') + '\n', 5); return r2 && r2.ln === 4; })());
// one-line typing: the whole example on one line splits into the same picture as the multi-line text
const oneLine = V2.EXAMPLE.split('\n').filter(Boolean).join(' ');
let sp = V2.splitSequences(oneLine, oneLine.length);
ok('one line splits at every opening asterisk', sp.text.split('\n').length === V2.EXAMPLE.split('\n').filter(Boolean).length, sp.text.split('\n').length + ' lines');
ok('split text parses to the same edges', same(V2.edgeList(V2.parse(sp.text)), V2.edgeList(a)));
ok('caret stays at the end after splitting', sp.caret === sp.text.length);
sp = V2.splitSequences('*T\\ *S, A\\ series *', 19);
ok('typing an asterisk after a comment breaks the line, caret after it', sp.text === '*T\\\n*S, A\\ series\n*' && sp.caret === sp.text.length, JSON.stringify(sp));
sp = V2.splitSequences('*S, A\\ series', 5);
ok('single sequence untouched', sp.text === '*S, A\\ series' && sp.caret === 5);
sp = V2.splitSequences('*a * b\\ x', 3);
ok('asterisk inside an open list untouched', sp.text === '*a * b\\ x');
const full = V2.reindentWithCaret(V2.splitSequences(oneLine, oneLine.length).text, oneLine.length);
ok('split then reindent gives the tabbed example', full.text.split('\n')[3].startsWith('      *A_2') && full.text.split('\n')[4].startsWith('   *B_1'));
const star = V2.reindentWithCaret('*T\\\n*S, A\\ series\n*', 19);
ok('a lone * line is indented at its level', star.text.endsWith('\n*') && star.text.length === 19);
// shorthand: the whole example in letters gives the same edges as the full words
const short = `*Schematic\\
*S, A\\ s
*A_1\\ b w
*A_2, B_2\\ b r2
*B_1\\ r
*B\\ s
*C, D\\ s
*E\\ e
*\\
`;
const sm = V2.parse(short);
ok('shorthand example gives the same edges as full words', same(V2.edgeList(sm), V2.edgeList(a)) && !sm.errors.length && !sm.warnings.length);
ok('shorthand end marks the last element', sm.nodes.find(n => n.label === 'E').role === 'end');
ok('shorthand mixed with full words and r^2', same(V2.edgeList(V2.parse(short.replace('b r2', 'branch r^2').replace('b w', 'branch w'))), V2.edgeList(a)));
ok('shorthand wait bubble lands on the w', (() => { const x = V2.highlightAt('*T\\\n*S, A\\ s\n*A_1\\ b w\n', 4).wait; return x && x.ln === 3 && 'x'.length && ('*A_1\\ b w').slice(x.from, x.to) === 'w'; })());
ok('letters inside words are not shorthand', !V2.parse('*T\\\n*S, A\\ series\n*B\\ bw\n').errors.length);
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
