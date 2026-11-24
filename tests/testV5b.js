// node testV5b.js [outDir] -> EE parts on the wire, automatic units, case-sensitive letters (shorthandSchematicV5b.html)
const fs = require('fs'), vm = require('vm'), path = require('path');
const page = fs.readFileSync(path.join(__dirname, '..', process.env.APP_FILE || 'shorthandSchematicV5b.html'), 'utf8');
const core = page.split('// ==CORE-START==')[1].split('// ==CORE-END==')[0];
const ctx = {}; vm.createContext(ctx);
vm.runInContext(core + ';this.A={parse,renderSVG,edgeList,setShape,nextShape,readSpecifier,readCommands,eeValue,highlightAt,expandAtCaret,backspaceWord}', ctx);
const A = ctx.A;
let fails = 0;
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) fails++; };
const byLabel = (m, l) => m.nodes.find(n => n.type === 'el' && n.label === l);
const P = s => A.parse('*T\\\n' + s + '\n*\\');
const val = (kind, v) => A.eeValue(kind, v);

// letters pick the part
let m = P('*A, B, C, D, E\\ R, C, L, VS, D');
ok('R C L VS D give five parts', ['A', 'B', 'C', 'D', 'E'].map(l => byLabel(m, l).shape).join('') === 'RCLVSD');
m = P('*A, B, C, D, E\\ resistor, Capacitor, INDUCTOR, vsource, diode');
ok('the words match in any case', ['A', 'B', 'C', 'D', 'E'].map(l => byLabel(m, l).shape).join('') === 'RCLVSD');

// collision pairs: capital is the part, small letter is the shape or command
m = P('*A, B\\ C, c');
ok('C is a capacitor, c a circle', byLabel(m, 'A').shape === 'C' && byLabel(m, 'B').shape === 'circ');
m = P('*A, B\\ D, d');
ok('D is a diode, d a decision', byLabel(m, 'A').shape === 'D' && byLabel(m, 'B').shape === 'dec');
m = P('*S\\\n*A\\ b w\n*B\\ R');
ok('R is a resistor, not a return', byLabel(m, 'B').shape === 'R' && m.branches[0].state === 'waiting');
m = P('*S\\\n*A\\ b w\n*B\\ r');
ok('r is still return', m.branches[0].state !== 'waiting' && byLabel(m, 'B').shape === undefined);
ok('B, W and R2 are not shorthand', !A.readCommands('B W').branch && !A.readCommands('B W').wait && !A.readCommands('R2').ret);
ok('b, w and r2 still are', A.readCommands('b w').branch && A.readCommands('b w').wait && A.readCommands('r2').retN === 2);
ok('words still match in any case', A.readCommands('Branch WAIT').branch && A.readCommands('Branch WAIT').wait && A.readCommands('Return^2').retN === 2);
m = P('*A, B\\ T, X');
ok('T and X are not shapes any more (t and x are)', byLabel(m, 'A').shape === undefined && byLabel(P('*A\\ t'), 'A').shape === 'tri');

// automatic units
ok('R = 4.7k shows 4.7 kΩ', val('R', '4.7k') === '4.7 kΩ', val('R', '4.7k'));
ok('C = 10u shows 10 µF', val('C', '10u') === '10 µF', val('C', '10u'));
ok('µ works like u', val('C', '10µ') === '10 µF');
ok('m is milli, M is mega', val('L', '100m') === '100 mH' && val('R', '1M') === '1 MΩ');
ok('p n G prefixes', val('C', '22p') === '22 pF' && val('C', '1n') === '1 nF' && val('R', '2G') === '2 GΩ');
ok('no prefix', val('VS', '5') === '5 V' && val('R', '470') === '470 Ω');
ok('typed unit: 4.7kΩ', val('R', '4.7kΩ') === '4.7 kΩ');
ok('typed unit: 4.7k ohm and ohms', val('R', '4.7k ohm') === '4.7 kΩ' && val('R', '220 ohms') === '220 Ω');
ok('typed unit: 10uF, 10 µF, 5V, 2mH', val('C', '10uF') === '10 µF' && val('C', '10 µF') === '10 µF' && val('VS', '5V') === '5 V' && val('L', '2mH') === '2 mH');
ok('ohm sign accepted too', val('R', '1kΩ') === '1 kΩ');
ok('a power is rewritten in engineering form', val('R', '4.7e3') === '4.7 kΩ' && val('C', '1e-6') === '1 µF' && val('R', '47e2') === '4.7 kΩ', [val('R', '4.7e3'), val('C', '1e-6'), val('R', '47e2')].join(' '));
ok('diode value shown as typed', val('D', '1N4148') === '1N4148');
ok('not a number: shown as typed', val('R', 'big') === 'big' && val('R', '4.7k cats') === '4.7k cats');
ok('a unit for another part stays as typed', val('R', '10kH') === '10kH');
m = P('*R1, C1\\ R = 4.7k, C = 10u; red, blue');
ok('values per entry with colors', byLabel(m, 'R1').value === '4.7 kΩ' && byLabel(m, 'C1').value === '10 µF' && byLabel(m, 'C1').color === 'blue');
m = P('*R1\\ R');
ok('no = : no value', byLabel(m, 'R1').value === undefined && !m.errors.length);
m = P('*P1\\ proc = 4.7k');
ok('a flow block value stays free text', byLabel(m, 'P1').value === '4.7k');

// drawing
let svg = A.renderSVG(P('*R1, C1, L1, V1, D1\\ R = 4.7k, C = 10u, L, VS = 5, D = 1N4148'));
ok('values drawn with real symbols', svg.includes('4.7 kΩ') && svg.includes('10 µF') && svg.includes('5 V') && svg.includes('1N4148'));
ok('no box is drawn around a part', !/<rect x="[\d.]+" y="[\d.]+" width="\d+" height="44" rx="5"/.test(svg));
ok('names drawn above the parts', svg.includes('>R1<') && svg.includes('>L1<'));
svg = A.renderSVG(P('*R1\\ R red = 1k'));
ok('a color tints the part', svg.includes('#c92a2a'));
m = P('*S, A\\\n*R1\\ R; branch wait\n*C1\\ C; return\n*B\\');
ok('parts take part in branches', !m.errors.length && A.edgeList(m).some(e => /R1 -> C1/.test(e)), A.edgeList(m).join(' | '));
svg = A.renderSVG(m, A.highlightAt('*T\\\n*S, A\\\n*R1\\ R; branch wait\n*C1\\ C', 4).lanes, true);
ok('a highlighted part gets the patch behind it', svg.includes('#ffe8d9') || svg.includes('#fff4e0'));
ok('interactive parts have a click slot', /fill-opacity="0"/.test(A.renderSVG(P('*R1\\ R'), undefined, true)));
m = P('*S\\\n*R1\\ R; end');
ok('end on a part works', byLabel(m, 'R1').role === 'end' && !m.errors.length);

// click to change part
ok('a click steps R to C, and D back to R', A.nextShape({ shape: 'R' }) === 'C' && A.nextShape({ shape: 'D' }) === 'R');
let t = A.setShape('*T\\\n*R1\\ R = 4.7k\n*\\', 2, 0, 'C', ['auto']);
ok('setShape swaps the part, writes its word and keeps the value', t.split('\n')[1] === '*R1\\ CAP = 4.7k', t.split('\n')[1]);
ok('a block still steps through the block shapes', A.nextShape({ shape: 'circ' }) === 'dia');

// sources (Josue, 11/24): VS replaced V; IS, DVS, DIS added; codes longer than one letter match in any case
m = P('*A, B, C, D\\ VS, IS, DVS, DIS');
ok('VS IS DVS DIS give the four sources', ['A', 'B', 'C', 'D'].map(l => byLabel(m, l).shape).join(' ') === 'VS IS DVS DIS');
m = P('*A, B, C, D\\ vs, Is, dvs, DiS');
ok('source codes match in any case', ['A', 'B', 'C', 'D'].map(l => byLabel(m, l).shape).join(' ') === 'VS IS DVS DIS');
m = P('*A\\ V');
ok('V alone is no longer a part', byLabel(m, 'A').shape === undefined);
ok('IS reads amps', val('IS', '2m') === '2 mA' && val('IS', '1.5 A') === '1.5 A' && val('IS', '3 amps') === '3 A');
ok('DVS and DIS: a number gets its unit, an expression is shown as typed', val('DVS', '10') === '10 V' && val('DVS', '2*Vx') === '2*Vx' && val('DIS', '0.5*Ix') === '0.5*Ix');
svg = A.renderSVG(P('*A, B, C, D\\ VS, IS, DVS, DIS'));
ok('independent sources are circles, dependent ones diamonds', (svg.match(/<circle cx/g) || []).length === 2 && (svg.match(/<polygon/g) || []).length === 2);
ok('a click steps through the sources and on to the diode', A.nextShape({ shape: 'L' }) === 'VS' && A.nextShape({ shape: 'DIS' }) === 'D');

// letters written out as capital words (Josue, 11/24)
const X = (t, c) => A.expandAtCaret(t, c === undefined ? t.length : c);
let x = X('*A\\ s ');
ok('s then space becomes SERIES', x && x.text === '*A\\ SERIES ' && x.caret === 11 && x.undoable, x && x.text);
x = X('*A, B\\ t,');
ok('t then comma becomes TRI', x && x.text === '*A, B\\ TRI,');
ok('every lower-case letter has its word', ['b', 'w', 'r', 'x', 'c', 'd', 'p', 'i'].map(k => X('*A\\ ' + k + ' ').text.slice(4, -1)).join(' ') === 'BRANCH WAIT RETURN RECT CIRC DEC PROC IO');
x = X('*A\\ r2 ');
ok('r2 becomes RETURN^2', x && x.text === '*A\\ RETURN^2 ');
x = X('*A\\ b w;');
ok('a semicolon triggers too', x && x.text === '*A\\ b WAIT;');
x = X('*A\\ b w\n');
ok('Enter triggers, and cannot be undone by the word Backspace', x && x.text === '*A\\ b WAIT\n' && !x.undoable);
x = X('*A\\ b w*');
ok('the hotkey starting the next list triggers', x && x.text === '*A\\ b WAIT*');
ok('part codes are written out (R RES, C CAP, L IND, D DIODE)', ['R', 'C', 'L', 'D'].map(k => X('*A\\ ' + k + ' ').text.slice(4, -1)).join(' ') === 'RES CAP IND DIODE');
ok('source codes are written out in any case', ['VS', 'is', 'Dvs', 'DIS'].map(k => X('*A\\ ' + k + ' ').text.slice(4, -1)).join(' ') === 'VOLT_SRC CURR_SRC DEP_VOLT_SRC DEP_CURR_SRC');
ok('m becomes MEAS; V and I after it stay', X('*A\\ RES = 1k; m ').text === '*A\\ RES = 1k; MEAS ' && X('*A\\ MEAS V ') === null && X('*A\\ MEAS I ') === null);
ok('other short words are not codes (red, rev, end, io)', ['red', 'rev', 'end', 'io'].every(k => X('*A\\ ' + k + ' ') === null || k === 'io' && X('*A\\ io ') === null));
ok('Backspace takes a written-out part word whole', A.backspaceWord('*A\\ VOLT_SRC', 12, false).from === 4 && A.backspaceWord('*A\\ RES ', 8, true).from === 4);
m = P('*A, B, C, D\\ RES, CAP, VOLT_SRC, dep_curr_src');
ok('the written-out words parse', ['A', 'B', 'C', 'D'].map(l => byLabel(m, l).shape).join(' ') === 'R C VS DIS');
ok('letters in element names are left alone', X('*s ') === null && X('*A, b,') === null);
ok('letters in a value are left alone', X('*A\\ proc = b ') === null && X('*A\\ dec = [x, b ') === null);
ok('after a value ends, letters expand again', X('*A\\ proc = go, d,').text === '*A\\ proc = go, DEC,');
ok('a letter inside a word is left alone', X('*A\\ abs ') === null && X('*A\\ s1 ') === null);
const parsed = P('*S\\\n*A, B\\ TRI, RECT; RED; BRANCH WAIT\n*C\\ RETURN');
ok('the capital words parse as before', byLabel(parsed, 'A').shape === 'tri' && byLabel(parsed, 'A').color === 'red' && byLabel(parsed, 'B').shape === 'rect' && parsed.branches[0].state !== 'waiting' && !parsed.errors.length, JSON.stringify(parsed.errors));
let bk = A.backspaceWord('*A\\ SERIES ', 11, true);
ok('Backspace right after the rewrite takes the word and its space', bk && bk.from === 4 && bk.to === 11);
bk = A.backspaceWord('*A\\ TRI,', 8, true);
ok('...or the word and its comma', bk && bk.from === 4);
bk = A.backspaceWord('*A\\ BRANCH WAIT', 15, false);
ok('Backspace at the end of a capital word deletes the word', bk && bk.from === 11 && bk.to === 15);
ok('...RETURN^2 goes whole', A.backspaceWord('*A\\ RETURN^2', 12, false).from === 4);
ok('a space after a word, not just typed, deletes only the space', A.backspaceWord('*A\\ SERIES ', 11, false) === null);
ok('a lower-case word deletes letter by letter', A.backspaceWord('*A\\ branch', 10, false) === null);
ok('a capital word in a name or value is not taken whole', A.backspaceWord('*SERIES', 7, false) === null && A.backspaceWord('*A\\ proc = WAIT', 15, false) === null);
let tt = A.setShape('*T\\\n*A\\ TRI\n*\\', 2, 0, 'circ', ['rect']);
ok('a click keeps capital style', tt.split('\n')[1] === '*A\\ CIRC', tt.split('\n')[1]);

// direction (Josue, 11/24): negative to positive by default, REV reverses
m = P('*V1, I1, D1\\ VS REV = 5, IS, D rev');
ok('REV is read per entry, in any case', byLabel(m, 'V1').rev === true && byLabel(m, 'I1').rev === false && byLabel(m, 'D1').rev === true);
ok('REV keeps the value', byLabel(m, 'V1').value === '5 V' && !m.warnings.length, JSON.stringify(m.warnings));
m = P('*V1, V2\\ VS, VS; REV');
ok('REV works as its own group entry', byLabel(m, 'V1').rev === true && byLabel(m, 'V2').rev === false);
m = P('*R1\\ R REV = 1k');
ok('REV on a resistor: ignored with a warning', byLabel(m, 'R1').rev === false && /REV only reverses/.test(m.warnings[0]) && !m.errors.length && byLabel(m, 'R1').value === '1 kΩ');
const vsDefault = A.renderSVG(P('*V1\\ VS = 5')), vsRev = A.renderSVG(P('*V1\\ VS REV = 5'));
ok('default voltage source has + on the right (its vertical bar is right of center)', (() => {
  const mv = P('*V1\\ VS = 5'); A.renderSVG(mv); // rendering runs the layout, which places the node
  const n = byLabel(mv, 'V1'), mm = vsDefault.match(/M([\d.]+) [\d.]+ v7/);
  return mm && +mm[1] > n.x;
})());
ok('REV mirrors the symbol about its center', /class="rev"/.test(vsRev) && !/class="rev"/.test(vsDefault));
ok('REV mirrors only the symbol, not the value text', /<\/g>\s*<text[^>]*>5 V</.test(vsRev) || vsRev.indexOf('5 V') > vsRev.indexOf('class="rev"'));
svg = A.renderSVG(P('*S, A\\'));
ok('black by default', svg.includes('#111111') && !svg.includes('#1b3a8a') && !svg.includes('#eaf0ff'));
let ts = A.setShape('*T\\\n*V1\\ VS REV = 5\n*\\', 2, 0, 'IS', ['auto']);
ok('a click keeps REV and the value, writing the part word', ts.split('\n')[1] === '*V1\\ CURR_SRC REV = 5', ts.split('\n')[1]);

// MEAS (Josue, 11/24): a marker for V across or I through a part, never a source's own quantity
m = P('*R_1\\ RES = 4.7k; MEAS V');
ok('Josue example: value and V marker', byLabel(m, 'R_1').value === '4.7 kΩ' && byLabel(m, 'R_1').meas === 'V' && !m.errors.length && !m.warnings.length, JSON.stringify([m.errors, m.warnings]));
m = P('*R1, R2, R3\\ RES MEAS I, RES meas current, RES MEAS');
ok('MEAS I, words in any case, MEAS alone is V', byLabel(m, 'R1').meas === 'I' && byLabel(m, 'R2').meas === 'I' && byLabel(m, 'R3').meas === 'V');
m = P('*R1, R2\\ RES, RES; MEAS V, MEAS I');
ok('MEAS as its own group, one entry per part', byLabel(m, 'R1').meas === 'V' && byLabel(m, 'R2').meas === 'I');
m = P('*R1\\ RES MEAS i');
ok('a small i is not a quantity (letters are exact)', byLabel(m, 'R1').meas === 'V');
m = P('*V1, I1\\ VOLT_SRC = 5, CURR_SRC = 2m; MEAS V, MEAS I');
ok('a source cannot measure its own quantity: errors, no marker', byLabel(m, 'V1').meas === undefined && byLabel(m, 'I1').meas === undefined && m.errors.length === 2 && /read back its own value/.test(m.errors[0]), JSON.stringify(m.errors));
m = P('*V1, I1\\ VOLT_SRC = 5, CURR_SRC = 2m; MEAS I, MEAS V');
ok('a source can measure the other quantity', byLabel(m, 'V1').meas === 'I' && byLabel(m, 'I1').meas === 'V' && !m.errors.length);
m = P('*P1\\ PROC = go; MEAS V');
ok('MEAS on a flow block: ignored with a warning', byLabel(m, 'P1').meas === undefined && /only measures circuit parts/.test(m.warnings[0]) && !m.errors.length);
svg = A.renderSVG(P('*R_1\\ RES = 4.7k; MEAS V'));
const measPart = svg.split('class="meas"')[1] || '';
ok('V marker drawn: + left, V, − right', /class="meas"/.test(svg) && measPart.indexOf('>+<') < measPart.indexOf('>V<') && measPart.indexOf('>V<') < measPart.indexOf('>−<'));
svg = A.renderSVG(P('*D1\\ DIODE REV; MEAS V'));
const measRev = svg.split('class="meas"')[1] || '';
ok('on a reversed part the marker flips: − left, + right', measRev.indexOf('>−<') < measRev.indexOf('>+<'));
ok('the marker is not mirrored with the symbol', !/class="rev"[^]*class="meas"[^]*<\/g>\s*<\/g>/.test(svg) && svg.indexOf('class="meas"') > svg.lastIndexOf('class="rev"'));
svg = A.renderSVG(P('*R1\\ RES; MEAS I'));
ok('I marker drawn as an arrow and I', /class="meas"><path/.test(svg) && />I</.test(svg));
const mTop = P('*R1\\ RES; MEAS V'), mNo = P('*R1\\ RES');
A.renderSVG(mTop); A.renderSVG(mNo);
ok('a marker on the top row moves the row down, clear of the title', byLabel(mTop, 'R1').y === byLabel(mNo, 'R1').y + 16);
ok('a click keeps MEAS and writes the part word in capitals', A.setShape('*T\\\n*R1\\ RES = 1k; MEAS V\n*\\', 2, 0, 'C', ['auto']).split('\n')[1] === '*R1\\ CAP = 1k; MEAS V');

// The checks above load only the core, so a syntax slip in the browser-only part (the legend) would pass them
// and still leave the page blank; parsing the whole script catches that.
ok('the whole page script parses', (() => { try { new Function(page.split('<script>')[1].split('</script>')[0]); return true; } catch (e) { console.log('   ' + e.message); return false; } })());

// old scripts
ok('v1 example unchanged', A.edgeList(A.parse('*Schematic\\\n*S, A\\ series\n*A_1\\ branch wait\n*A_2, B_2\\ branch return^2\n*B_1\\ return\n*B\\ series\n*C, D\\ series\n*E\\ end\n*\\')).length === 15);

const out = process.argv[2];
if (out) {
  const rc = `*RC filter\\
*Vin, R1\\ VS = 5, R = 4.7k
*C1, Gnd\\ C = 10u; branch
*L1, D1\\ L = 2.2mH, D = 1N4148
*Out\\ end
*\\`;
  const mix = `*Mixed\\
*Begin\\
*Check\\ dec = [V > 5, rising]
*R2, C2\\ R = 47e2, C = 100n; orange, blue; branch return
*Idle\\ proc = wait
*Stop\\ end
*\\`;
  fs.writeFileSync(path.join(out, 'v5bCircuit.svg'), A.renderSVG(A.parse(rc)));
  fs.writeFileSync(path.join(out, 'v5bMixed.svg'), A.renderSVG(A.parse(mix)));
  for (const [n, s] of [['circuit', rc], ['mixed', mix]]) {
    const mm = A.parse(s);
    console.log(n + ' edges:\n  ' + A.edgeList(mm).join('\n  ') + '\n' + n + ' errors/warnings: ' + JSON.stringify([mm.errors, mm.warnings]));
  }
}
console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
