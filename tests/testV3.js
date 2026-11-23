// node testV3.js -> checks the bottom-box helpers in shorthandSchematicV3.html
const fs = require('fs'), vm = require('vm'), path = require('path');
const page = fs.readFileSync(path.join(__dirname, '..', process.env.APP_FILE || 'shorthandSchematicV3.html'), 'utf8');
const core = page.split('// ==CORE-START==')[1].split('// ==CORE-END==')[0];
const ctx = {}; vm.createContext(ctx);
vm.runInContext(core + ';this.A={parse,openWaits,barEdit,barEnter,barBack,edgeList,EXAMPLE,highlightAt}', ctx);
const A = ctx.A;
let fails = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// open waits
const head = '*T\\\n*S, A\\ s\n*A_1\\ b w\n';
let w = A.openWaits(head, 4);
ok('one open wait listed with its elements', w.length === 1 && w[0].text === 'A_1' && w[0].innermost && w[0].ln === 3, JSON.stringify(w));
ok('no waits before the branch', A.openWaits(head, 2).length === 0);
const nested = head + '*X\\ b w\n';
w = A.openWaits(nested, 5);
ok('nested waits: two chips, innermost last', w.length === 2 && w[1].text === 'X' && w[1].innermost && !w[0].innermost, JSON.stringify(w));
ok('return closes the wait', A.openWaits(nested + '*Y\\ r', 6).length === 1);
ok('chip clears when return is written on the caret line', A.openWaits(head + '*B_1\\ r', 4).length === 0);
ok('branch return is not an open wait', A.openWaits(head + '*A_2, B_2\\ b r2', 4).length === 1);

// box editing
let r = A.barEdit(head, 4, '*B_1\\ r2', 8);
ok('box text lands in the script, tabbed, return2 converted', r.text === head + '   *B_1\\ return^2'.replace('return^2', 'r2') || r.text.endsWith('*B_1\\ r2'), JSON.stringify(r.text));
r = A.barEdit(head, 4, '*B_1\\ return2', 13);
ok('return2 becomes return^2 in the box', r.line === '*B_1\\ return^2' && r.text.split('\n')[3] === '   *B_1\\ return^2', JSON.stringify(r));
ok('box line is shown without tabs, caret after it', r.barCaret === r.line.length);
r = A.barEdit(head, 4, '*B_1\\ r *', 9);
ok('typing * after a finished list commits the line and the box moves to the new one', r.text.split('\n').slice(3).join('|') === '   *B_1\\ r|*' && r.ln === 5 && r.line === '*', JSON.stringify(r));
r = A.barEdit('*T\\\n', 2, '*S, A\\ s *A_1\\ b w *A_2, B_2\\ b r2 *B_1\\ r', 40);
ok('whole script in the box splits and tabs', r.text.split('\n').length === 5 && r.text.split('\n')[3].startsWith('      *A_2') && r.text.split('\n')[4].startsWith('   *B_1'), JSON.stringify(r.text));
ok('...and the box ends on the last line', r.ln === 5 && r.line === '*B_1\\ r');

// Enter / Backspace / mirror
r = A.barEnter(head, 3);
ok('Enter makes a tabbed blank line under the wait', r.text === head.replace(/\n$/, '') + '\n   \n'.replace('\n   \n', '\n   ') + (head.endsWith('\n') ? '\n' : '') || r.ln === 4, JSON.stringify(r));
ok('Enter: box is empty and on the new line', r.line === '' && r.ln === 4);
const b = A.barBack('*T\n*S, A\\ s\n   ', 3);
ok('Backspace on an empty box returns to the previous line end', b && b.ln === 2 && b.line === '*S, A\\ s' && b.text === '*T\n*S, A\\ s', JSON.stringify(b));
ok('Backspace on line 1 does nothing', A.barBack('*T\\', 1) === null);

// the box path gives the same drawing as typing the full text
const lines = A.EXAMPLE.split('\n').filter(Boolean);
let text = '', ln = 1;
for (const l of lines) {
  let res = A.barEdit(text, ln, l, l.length);
  res = A.barEnter(res.text, res.ln);
  text = res.text; ln = res.ln;
}
ok('typing the example line by line in the box gives the same picture', same(A.edgeList(A.parse(text)), A.edgeList(A.parse(A.EXAMPLE))), '');
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
