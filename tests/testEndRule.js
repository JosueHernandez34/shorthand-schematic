// node testEndRule.js -> "end" is refused while a branch waits on its return (shorthandSchematicV4.html)
const fs = require('fs'), vm = require('vm'), path = require('path');
const page = fs.readFileSync(path.join(__dirname, '..', 'shorthandSchematicV4.html'), 'utf8');
const core = page.split('// ==CORE-START==')[1].split('// ==CORE-END==')[0];
const ctx = {}; vm.createContext(ctx);
vm.runInContext(core + ';this.A={parse,renderSVG,edgeList,endWordRange,EXAMPLE}', ctx);
const A = ctx.A;
let fails = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) fails++; };
const byLabel = (m, l) => m.nodes.find(n => n.type === 'el' && n.label === l);

// The v1 example ends only after every branch has returned, so it stays clean.
let m = A.parse(A.EXAMPLE);
ok('v1 example: no errors, E is the end', !m.errors.length && byLabel(m, 'E').role === 'end' && !m.badEnds.length);

// end on the main path while A_1 waits
m = A.parse('*T\\\n*S, A\\\n*A_1\\ branch wait\n*E\\ end\n*\\');
ok('end while one branch waits: error', m.errors.length === 1 && /line 3/.test(m.errors[0]), JSON.stringify(m.errors));
ok('...the block is marked, not given the end look', byLabel(m, 'E').badEnd === true && byLabel(m, 'E').role === undefined);
ok('...the line is listed for the editor', JSON.stringify(m.badEnds) === '[4]');
const svg = A.renderSVG(m);
ok('...the drawing has the red X', /class="badx"/.test(svg) && svg.includes('#e5383b'));

// the shorthand letter is refused the same way
m = A.parse('*T\\\n*S, A\\\n*A_1\\ b w\n*E\\ e\n*\\');
ok('letter e is refused too', m.badEnds.length === 1 && byLabel(m, 'E').badEnd);

// two waiting branches, both named
m = A.parse('*T\\\n*S, A\\\n*A_1\\ branch wait\n*A_2\\ branch wait\n*X\\ end\n*\\');
ok('two waiting branches: both lines named', /2 branches/.test(m.errors[0]) && /line 3, line 4/.test(m.errors[0]), m.errors[0]);

// a return that closes the last waiting branch may end on the same line
m = A.parse('*T\\\n*S, A\\\n*A_1\\ branch wait\n*B_1\\ return end\n*\\');
ok('return closing the last waiting branch may end', !m.badEnds.length && !m.errors.length, JSON.stringify(m.errors));

// once returned, a later end is fine
m = A.parse('*T\\\n*S, A\\\n*A_1\\ branch wait\n*B_1\\ return\n*B\\\n*E\\ end\n*\\');
ok('end after the return: allowed', !m.badEnds.length && byLabel(m, 'E').role === 'end');

// a closed branch (branch return) is not waiting, so end stays allowed
m = A.parse('*T\\\n*S, A\\\n*A_1\\ branch return\n*B\\\n*E\\ end\n*\\');
ok('pending branch return does not block end', !m.badEnds.length);

// while typing: the error shows as soon as the word is there
m = A.parse('*T\\\n*S, A\\\n*A_1\\ branch wait\n*E\\ e', { partial: true });
ok('partial text: refused while typing', m.badEnds.length === 1);

// editor range for the red mark
const line = '   *E\\ tri, end';
const r = A.endWordRange(line);
ok('end word range', r && line.slice(r.from, r.to) === 'end', JSON.stringify(r));
const r2 = A.endWordRange('*Elephant\\ e');
ok('letter e range, element names ignored', r2 && r2.from === 11 && r2.to === 12, JSON.stringify(r2));

console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
