import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const baseline=JSON.parse(await fs.readFile(path.join(root,'docs/verification/previous-all-review-base-20261106.json'),'utf8'));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function files(dir){return(await Promise.all((await fs.readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?files(path.join(dir,e.name)):path.join(dir,e.name)))).flat().sort()}
const current={};for(const file of await files(path.join(root,'src')))if(/\.(ts|css|js)$/.test(file))current[path.relative(root,file).replaceAll('\\','/')]=sha(await fs.readFile(file));
const changed=Object.keys(current).filter(p=>baseline.sourceSha256[p]!==current[p]).map(p=>({path:p,before:baseline.sourceSha256[p]??null,after:current[p]}));
const removed=Object.keys(baseline.sourceSha256).filter(p=>!current[p]);
const report={generatedAt:new Date().toISOString(),baseline:'previous-all-review-base-20261106.json',changed,removed,unchanged:Object.keys(current).length-changed.length,scope:'Exact source hashes relative to SsFpYqVD. Earlier visual/test reports retain their own build identity.'};
await fs.writeFile(path.join(root,'docs/verification/all-review-source-delta.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({changed:changed.length,removed:removed.length,unchanged:report.unchanged}));
