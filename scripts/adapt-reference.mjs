// Reproducible extraction of the original Every Joule engine. No visual reimplementation.
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const original=resolve(root,'research/every-joule-lesson1-48591ddc5f0a22e6eb2a5a41c424a426599061ca/assets');
const dest=resolve(root,'src/reference');mkdirSync(dest,{recursive:true});
for(const name of ['three-DMk7AhfD.js','post-CiGSGJXB.js','numbers-D7lU_RWT.js','index-Bb-Nc_xU.js','sourcelist-ugshuCEn.js','sound-vOpPkm07.js'])copyFileSync(resolve(original,name),resolve(dest,name));
let engine=readFileSync(resolve(root,'research/reading/main.js'),'utf8');
engine=engine.slice(0,engine.indexOf('const qo = {'));
engine=engine.replace('"Source Serif 4 Variable", "Source Serif 4", Georgia, serif','FieldSerif, "Noto Serif SC", serif')
 .replace('text: "Every Joule"','text: "人教版地理必修一"').replace('text: "A physics book about energy"','text: ""')
 .replace('base: 63, size: 22.5','base: 63, size: 14')
 .replace('o.fillText("EVERY JOULE"','o.fillText("人教版地理必修一"')
 .replace('d.fillText("EJ"','d.fillText("地"');
// Keep the original physical thickness for a full textbook and retain its
// bounded high-resolution page cache. These optional parameters leave the
// original 14-leaf defaults unchanged for the earlier three-lesson build.
engine=engine.replace('nSpreads: n = 14,\n  light:', 'nSpreads: n = 14,\n  leaf = .55,\n  hiPx = 6,\n  loPx = 1.6,\n  light:')
 .replace('const a = Vs({ nSpreads: n }),','const a = Vs({ nSpreads: n, leaf }),')
 .replace('nSpreads: l,\n      paperNormal:', 'nSpreads: l,\n      hiPx,\n      loPx,\n      paperNormal:');
engine+='\nexport { fs as THREE, Bs as createRenderer, Hs as createStage, ni as createLight, wr as createBook, Uo as Popout, Wa as pageFrame, gi as createFlap, Us as createPost, kr as PaperTone, Mr as LiquidGlass, Sl as paperMaterial, Tr as createCapsule, xr as capsuleCSS };\n';
writeFileSync(resolve(dest,'engine.js'),'// Adapted from Techartist / Every Joule, commit 48591dd. See docs/原作代码研究.md.\n'+engine);
let stores=readFileSync(resolve(root,'research/reading/stores.js'),'utf8');
stores+='\nexport { R as InkLines, ks as PenSchedule, U as inkBox, te as TurnedShape, m as point, te, te as Profile, zs as addSphere, Wt as seeded };\n';
writeFileSync(resolve(dest,'stores-BwMXNqO6.js'),stores);
