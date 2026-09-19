// Check every theme's text colours against the surface they sit on.
//
//   node cards/tools/contrast.mjs
//
// Themes were being judged by eye, which is how neon ended up with an accent
// at 13:1 - as bright as the body text - while its small print sat at 3.7.
// Run this after touching a palette: the accent should read as emphasis, not
// as a light source, and nothing should fall under about 4.5.
import { readFileSync } from 'node:fs';
const src = readFileSync('cards/tools/infographic.mjs', 'utf8');
const block = src.slice(src.indexOf('const THEMES = {'), src.indexOf('const MIME = {'));

const hex = (h) => {
  const m = h.replace('#','');
  const n = m.length===3 ? m.split('').map(c=>c+c).join('') : m;
  return [0,2,4].map(i=>parseInt(n.slice(i,i+2),16));
};
const lum = (rgb) => {
  const [r,g,b] = rgb.map(v=>{const s=v/255; return s<=0.03928? s/12.92 : ((s+0.055)/1.055)**2.4;});
  return 0.2126*r + 0.7152*g + 0.0722*b;
};
const ratio = (a,b) => { const l1=lum(hex(a)), l2=lum(hex(b)); const [hi,lo]=l1>l2?[l1,l2]:[l2,l1]; return (hi+0.05)/(lo+0.05); };

// crude parse: theme name -> token map
const themes = {};
for (const m of block.matchAll(/^  (\w+): \{([\s\S]*?)^  \},/gm)) {
  const t = {};
  for (const kv of m[2].matchAll(/(\w+):\s*'([^']*)'/g)) t[kv[1]] = kv[2];
  themes[m[1]] = t;
}
// approximate each theme's page background by the last colour in its gradient
const bgOf = (t) => (t.bg.match(/#[0-9a-fA-F]{6}/g) || ['#ffffff']).slice(-1)[0];
// row cards are translucent on dark themes; approximate against the page bg
const cardOf = (t) => t.card.startsWith('#') ? t.card : bgOf(t);

console.log('theme   token     colour    vs card   verdict');
for (const [name, t] of Object.entries(themes)) {
  const card = cardOf(t);
  for (const k of ['ink','muted','faint','accent']) {
    const r = ratio(t[k], card);
    const need = k === 'accent' ? 3 : k === 'ink' ? 4.5 : 4.5;
    const tag = r >= need ? 'ok' : r >= need*0.75 ? 'thin' : 'FAIL';
    console.log(`${name.padEnd(7)} ${k.padEnd(9)} ${t[k].padEnd(9)} ${r.toFixed(2).padStart(6)}    ${tag}`);
  }
  console.log('');
}
