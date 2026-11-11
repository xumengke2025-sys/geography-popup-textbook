async page => {
 const base=page.__reviewBase??'http://127.0.0.1:4175',checks=[],failures=[],errors=[],states=[],screenshots=[];
 const check=(ok,label)=>(ok?checks:failures).push(label);
 page.on('pageerror',e=>errors.push(e.message));
 const ready=id=>page.waitForFunction(id=>{const d=window.textbookDiagnostics;return d?.ready&&d.active===id&&!d.turning&&!d.figureBusy&&(d.twoD||d.render?.modelState==='live')},id,{timeout:60000});
 const settle=async()=>{let prev,stable=0;for(let i=0;i<85;i++){const p=await page.evaluate(()=>window.textbookDebug?.camera.position.toArray()??[0]);stable=prev&&p.every((v,j)=>Math.abs(v-prev[j])<.0002)?stable+1:0;if(stable>=3)return;prev=p;await page.waitForTimeout(75)}throw Error('Camera has not settled')};
 const phase=async v=>{await page.locator('#phase').evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))},v);await settle()};
 const open=async id=>{await page.goto(`${base}/?figure=${id}&3d&inspect`);await ready(id);if(await page.evaluate(()=>window.textbookDiagnostics.playing))await page.locator('#cPause').click();await phase(620)};
 const capture=async name=>{const s=await page.evaluate(()=>{const d=window.textbookDiagnostics,b=window.textbookDebug;return {id:d.active,state:d.state,geometry:d.render?.geometry,labels:d.render?.labels,bounds:b?.processBounds,controlInset:b?.controlInset,dockTop:document.querySelector('.capsule').getBoundingClientRect().top,width:innerWidth,height:innerHeight}});states.push({name,...s});const path=`output/playwright/reading-framing-${name}.png`;await page.screenshot({path});screenshots.push(path);if(page.__writeReviewCheckpoint)await page.__writeReviewCheckpoint({checks,failures,errors,states,screenshots});return s};
 for(const size of [{width:1366,height:768},{width:1024,height:768}]){
  await page.setViewportSize(size);
  for(const id of size.width===1366?['breeze','vegetation','urban-waterlogging','remote','soil-factors','typhoon']:['breeze','vegetation','urban-waterlogging']){
   await open(id);
   if(id==='vegetation'){
    for(const n of [4,5,6]){await page.locator(`#selections [data-selection="${n}"]`).click();await settle();const s=await capture(`${size.width}-${id}-${n}`);
     check(s.bounds.top>=65&&s.bounds.bottom<s.dockTop,`${size.width}/${id}/${n}: lower plants fit between header and toolbar`);
    }
   }else{const s=await capture(`${size.width}-${id}`);check(s.bounds.top>=65&&s.bounds.bottom<s.dockTop,`${size.width}/${id}: model fits between header and toolbar`)}
  }
 }
 await page.setViewportSize({width:1366,height:900});await open('urban-waterlogging');await phase(1000);
 const before=await page.evaluate(()=>window.textbookDiagnostics.state);
 // Sample visible triangle interiors, then use real mouse input. Never invoke
 // the product's observation event handler to make an acceptance test pass.
 const point=await page.evaluate(()=>{const b=window.textbookDebug;b.scene.updateMatrixWorld(true);
  for(const mesh of b.entry.art.geometry.meshes.filter(m=>m.visible&&m.userData.urbanRole==='water-packet'&&m.userData.modelInput?.kind==='inspect')){
   const pos=mesh.geometry.attributes.position,idx=mesh.geometry.index,n=(idx?.count??pos.count)/3;
   for(let i=0;i<n;i++){const p=b.camera.position.clone().set(0,0,0);for(let k=0;k<3;k++)p.add(b.camera.position.clone().fromBufferAttribute(pos,idx?idx.getX(i*3+k):i*3+k));p.multiplyScalar(1/3).applyMatrix4(mesh.matrixWorld).project(b.camera);
    const x=(p.x+1)*innerWidth/2,y=(1-p.y)*innerHeight/2;if(y<80||y>innerHeight-190||document.elementFromPoint(x,y)!==b.renderer.domElement)continue;
    const hit=b.pickModel(x,y);if(hit?.input?.target===mesh.userData.modelInput.target)return{x,y,target:hit.input.target};}
  }return null;});
 check(!!point,'A retained water marker is physically clickable');
 if(point){await page.mouse.move(point.x,point.y);await page.waitForTimeout(150);
  check(await page.locator('.model-touch-cue').isVisible(),'Pointing at a small object reveals a local action cue');
  await capture('water-hover');await page.mouse.down();await page.waitForTimeout(100);
  check(await page.locator('.model-touch-cue').getAttribute('data-pressed')==='true','Holding a real object shows press feedback');await page.mouse.up();await settle();
  const after=await page.evaluate(()=>window.textbookDiagnostics);
  check(after.state.phase===before.phase&&after.state.selection===before.selection&&!after.playing,'Close observation changes neither scientific phase nor condition');
  check(after.render.geometry.inspection===point.target,'Real water-marker click enters its own close observation');await capture('water-close');
 }
 for(const target of ['collected','drain','overview']){await page.locator('#model-inspect').click();await page.locator(`#model-inspections [data-inspection="${target}"]`).click();await page.keyboard.press('Escape');await settle();await capture(`water-${target}`)}
 // Reader: adaptive fit, source correspondence, keyboard and stable zoom anchor.
 for(const size of [{width:1366,height:768},{width:390,height:844},{width:320,height:740}]){
  await page.setViewportSize(size);await page.locator('#cRead').click();await page.locator('#reader-image').evaluate(img=>img.decode());await page.waitForTimeout(150);
  await page.keyboard.press('0');
  let r=await page.evaluate(()=>{const img=document.querySelector('#reader-image'),s=document.querySelector('#reader-scroll');return {image:img.getBoundingClientRect().width,viewport:s.clientWidth,scroll:s.scrollWidth,title:document.querySelector('#reader-title').textContent}});
  check(r.image<=r.viewport&&r.scroll<=r.viewport+1,`${size.width}: original page initially fits viewport width`);
  const boxes=await page.locator('.reader-toolbar button:not([hidden]),#reader-title,#reader-scale').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {id:el.id,x:r.x,y:r.y,right:r.right,bottom:r.bottom}}));
  const overlap=boxes.some((a,i)=>boxes.slice(i+1).some(b=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1));
  check(!overlap&&boxes.every(b=>b.x>=0&&b.right<=size.width),`${size.width}: original-page controls remain separate and on screen`);
  await page.locator('#reader-fit').click();let pageHeight=await page.locator('#reader-image').evaluate(el=>el.getBoundingClientRect().height),viewHeight=await page.locator('#reader-scroll').evaluate(el=>el.clientHeight);
  check(pageHeight<=viewHeight,`${size.width}: whole-page fit shows the page without vertical cropping`);
  await page.keyboard.press('+');const zoom1=await page.locator('#reader-scale').innerText();await page.keyboard.press('+');const zoom2=await page.locator('#reader-scale').innerText();check(parseInt(zoom2)>parseInt(zoom1),`${size.width}: keyboard zoom works`);
  await page.locator('#reader-locate').click();await page.waitForTimeout(450);check(await page.locator('#reader-anchor').isVisible(),`${size.width}: source location is highlighted on the actual textbook image`);
  const f=`output/playwright/reading-framing-reader-${size.width}.png`;await page.screenshot({path:f});screenshots.push(f);
  await page.locator('#reader-close').click();check(await page.evaluate(()=>!window.textbookDiagnostics.playing),`${size.width}: returning from the reader remains paused`);
 }
 return {base,checks,failures,errors,states,screenshots,scope:'Current 3-D framing and lower-plant views at desktop/tablet, real small-object hover/press/observation, retained endpoints, and original-page fit/zoom/source location at desktop/390/320. Simulated viewports, not physical hardware.'};
}
