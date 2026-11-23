// Usage: node runCore.js <html> <inputFile> [outSvg]
// Pulls the CORE block out of the page and runs it, so the parser is tested without a browser.
const fs = require('fs'), vm = require('vm');
const [html, input, outSvg] = process.argv.slice(2);
const page = fs.readFileSync(html, 'utf8');
const core = page.split('// ==CORE-START==')[1].split('// ==CORE-END==')[0];
const ctx = {};
vm.createContext(ctx);
vm.runInContext(core + ';this.A={parse,renderSVG,edgeList,EXAMPLE}', ctx);
const src = input === '-' ? ctx.A.EXAMPLE : fs.readFileSync(input, 'utf8');
const model = ctx.A.parse(src);
console.log('title:', model.title);
console.log('edges:\n  ' + ctx.A.edgeList(model).join('\n  '));
console.log('errors:', model.errors, 'warnings:', model.warnings);
if (outSvg) fs.writeFileSync(outSvg, ctx.A.renderSVG(model));
