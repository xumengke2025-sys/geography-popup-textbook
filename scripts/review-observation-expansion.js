async page => {
 const base=page.__reviewBase??'http://127.0.0.1:4180',checks=[],failures=[],errors=[],states=[];
 const check=(ok,label)=>(ok?checks:failures).push(label);
 page.on('pageerror',e=>errors.push(e.message));
 const ready=id=>page.waitForFunction(id=>{const d=window.textbookDiagnostics;return d?.ready&&d.active===id&&!d.turning&&!d.figureBusy&&(d.twoD||d.render?.modelState==='live')},id,{timeout:90000});
 const settle=async()=>{let previous,stable=0;for(let i=0;i<70;i++){const p=await page.evaluate(()=>window.textbookDebug?.camera.position.toArray()??[0]);stable=previous&&Math.max(...p.map((v,i)=>Math.abs(v-previous[i])))<.0001?stable+1:0;if(stable>=4)return;previous=p;await page.waitForTimeout(90)}};
 const read=()=>page.evaluate(()=>window.textbookDiagnostics);
 const open=async(id,mode)=>{await page.goto(`${base}/?figure=${id}&${mode}&inspect`);await ready(id);await page.evaluate(()=>document.fonts.ready);await settle();if(await page.locator('#phase').isVisible())await page.locator('#phase').evaluate(el=>{el.value='620';el.dispatchEvent(new Event('input',{bubbles:true}))});await settle()};
 const capture=async name=>{states.push({name,state:await read()});await page.screenshot({path:`output/playwright/observation-${name}.png`})};
 const definitions=[['soil','section'],['waves','displacement'],['waves','depth-pair'],['temperature','surface-compare'],['earth','closed'],['gnss','sat-0']];
 for(const mode of ['3d','2d']){
  await page.setViewportSize({width:mode==='3d'?1366:390,height:mode==='3d'?900:844});
  for(const [id,target] of definitions){
   await open(id,mode);const before=await read();
   if(mode==='3d'){
    const point=await page.evaluate(target=>{
     const b=window.textbookDebug;b.scene.updateMatrixWorld(true);b.camera.updateMatrixWorld(true);
     for(const mesh of b.entry.art.geometry.meshes.filter(m=>m.userData.modelInput?.kind==='inspect'&&m.userData.modelInput.target===target)){
      let visible=true;for(let n=mesh;n;n=n.parent)if(!n.visible)visible=false;if(!visible)continue;
      const positions=mesh.geometry.attributes.position,index=mesh.geometry.index,count=(index?.count??positions.count)/3;
      for(let i=0;i<count;i+=Math.max(1,Math.floor(count/350))){const q=b.camera.position.clone().set(0,0,0);for(let k=0;k<3;k++)q.add(b.camera.position.clone().fromBufferAttribute(positions,index?index.getX(i*3+k):i*3+k));q.multiplyScalar(1/3).applyMatrix4(mesh.matrixWorld).project(b.camera);const x=(q.x+1)*innerWidth/2,y=(1-q.y)*innerHeight/2;if(x<8||y<80||y>innerHeight-185||x>innerWidth-8||document.elementFromPoint(x,y)!==b.renderer.domElement)continue;if(b.pickModel(x,y)?.input?.target===target)return{x,y};}
     }return null;
    },target);
    check(!!point,`${id}/${target}: actual visible mesh has a ray-hit observation target`);
    if(point)await page.mouse.click(point.x,point.y);
   }else{
    const object=page.locator(`.flat-concept [data-model-inspection="${target}"]`).first();
    check(await object.count()>0,`${id}/${target}: native SVG has the corresponding physical control`);
    if(await object.count()){await object.focus();await page.keyboard.press('Enter');check(await page.evaluate(target=>document.activeElement?.getAttribute('data-model-inspection')===target,target),`${id}/${target}: native object keeps keyboard focus`)}
   }
   await settle();const after=await read();
   check(after.state.phase===before.state.phase&&after.state.selection===before.state.selection&&!after.playing,`${mode}/${id}/${target}: observing preserves scientific inputs and pauses`);
   check(await page.locator(`#model-inspections [data-inspection="${target}"]`).getAttribute('aria-pressed')==='true',`${mode}/${id}/${target}: real observation state selected`);
   await capture(`${mode}-${id}-${target}`);
   await page.locator('#model-inspect').click();await page.locator('#model-inspections [data-inspection="overview"]').click();await page.keyboard.press('Escape');await settle();
   check((await read()).state.phase===before.state.phase,`${mode}/${id}: returning to overview preserves progress`);
  }
 }
 return{checks,failures,errors,states,scope:'Six physical observations in five models, real mesh pointer and native SVG keyboard operation. Observation must not be a disguised phase/condition change.'};
}
