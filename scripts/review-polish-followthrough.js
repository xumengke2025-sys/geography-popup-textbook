async page => {
  const base=page.__reviewBase??'http://127.0.0.1:4180',checks=[],failures=[],errors=[],states=[];
  const check=(ok,name)=>(ok?checks:failures).push(name);
  page.on('pageerror',e=>errors.push(e.message));
  const ready=id=>page.waitForFunction(id=>{const d=window.textbookDiagnostics;return d?.ready&&!d.turning&&!d.figureBusy&&d.active===id&&(d.twoD||d.render?.modelState==='live')},id,{timeout:90000});
  const settle=async()=>{
    let previous,stable=0;
    for(let i=0;i<70;i++){
      const p=await page.evaluate(()=>window.textbookDebug?.camera.position.toArray()??[0]);
      stable=previous&&Math.max(...p.map((v,i)=>Math.abs(v-previous[i])))<.0001?stable+1:0;
      if(stable>=4)return;previous=p;await page.waitForTimeout(90);
    }
  };
  const open=async(id,twoD=false)=>{await page.goto(`${base}/?figure=${id}&${twoD?'2d':'3d'}&inspect`);await ready(id);await page.evaluate(()=>document.fonts.ready);await settle()};
  const phase=async value=>{await page.locator('#phase').evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))},value);await settle()};
  const read=()=>page.evaluate(()=>window.textbookDiagnostics);
  const capture=async name=>{const d=await read();states.push({name,viewport:page.viewportSize(),state:d.state,geometry:d.render?.geometry,labels:d.render?.labels});await page.screenshot({path:`output/playwright/polish-final-${name}.png`})};
  const choose=async selection=>{await page.locator(`#selections [data-selection="${selection}"]`).click();};
  const inspect=async target=>{
    if(await page.locator('#model-inspections').isHidden())await page.locator('#model-inspect').click();
    const before=await read();await page.locator(`#model-inspections [data-inspection="${target}"]`).click();await settle();
    const after=await read();
    check(after.state.phase===before.state.phase&&after.state.selection===before.state.selection&&!after.playing,`${after.active}/${target}: observation does not change condition or phase`);
    check(await page.locator(`#model-inspections [data-inspection="${target}"]`).getAttribute('aria-pressed')==='true',`${after.active}/${target}: selected part feedback`);
    if(after.twoD)check(await page.locator(`.flat-concept [data-inspection="${target}"]`).count()>0,`${after.active}/${target}: native SVG feedback`);
    else check(after.render.geometry.inspection===target,`${after.active}/${target}: actual scene observes selected part`);
    await page.locator('#model-inspect').click();
  };
  await page.setViewportSize({width:1366,height:900});
  await open('vegetation');
  for(const target of ['overview','vine','buttress','layers']){await inspect(target);await capture(`vegetation-${target}`)}
  // A real pointer hit uses the same scene raycaster as the app, rather than
  // calling its interaction handler. Start from the overall scene again.
  await inspect('overview');
  const point=await page.evaluate(()=>{
    const b=window.textbookDebug;b.scene.updateMatrixWorld(true);b.camera.updateMatrixWorld(true);
    for(const mesh of b.entry.art.geometry.meshes.filter(m=>m.userData.modelInput?.kind==='inspect'&&m.userData.modelInput.target==='buttress')){
      let visible=true;for(let n=mesh;n;n=n.parent)if(!n.visible)visible=false;if(!visible)continue;
      const positions=mesh.geometry.attributes.position,index=mesh.geometry.index,count=(index?.count??positions.count)/3;
      for(let i=0;i<count;i+=Math.max(1,Math.floor(count/150))){
        const q=b.camera.position.clone().set(0,0,0);
        for(let k=0;k<3;k++)q.add(b.camera.position.clone().fromBufferAttribute(positions,index?index.getX(i*3+k):i*3+k));
        q.multiplyScalar(1/3).applyMatrix4(mesh.matrixWorld).project(b.camera);const x=(q.x+1)*innerWidth/2,y=(1-q.y)*innerHeight/2;
        if(x<8||y<80||y>innerHeight-170||x>innerWidth-8||document.elementFromPoint(x,y)!==b.renderer.domElement)continue;
        if(b.pickModel(x,y)?.input?.target==='buttress')return{x,y};
      }
    }return null;
  });
  check(!!point,'Rainforest has a visible clickable physical buttress');
  if(point){const before=await read();await page.mouse.click(point.x,point.y);await settle();const after=await read();states.push({name:'physical-buttress',point,before:before.render.geometry,after:after.render.geometry});check(after.render.geometry.inspection==='buttress'&&before.state.phase===after.state.phase,'Physical buttress click observes the same plant');}
  for(const id of ['gis','urban-waterlogging']){
    await open(id);await phase(930);
    for(const target of id==='gis'?['region-1','overview']:['packet-0','drain','collected','overview']){await inspect(target);await capture(`${id}-${target}`)}
  }
  for(const [id,selection] of [['mars-base',1],['mars-base',2],['greenhouse',1],['soil-factors',0],['soil-factors',1],['soil-factors',2],['remote',0],['typhoon',0]]){
    await open(id);if(await page.locator(`#selections [data-selection="${selection}"]`).count())await choose(selection);
    for(const p of [150,650,1000]){await phase(p);await capture(`${id}-${selection}-${p}`)}
  }
  await page.setViewportSize({width:1024,height:768});
  for(const id of ['vegetation','gis','urban-waterlogging','typhoon']){await open(id);await phase(850);if(id==='vegetation')await inspect('buttress');await capture(`${id}-tablet`);check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${id}: tablet no horizontal overflow`)}
  await page.setViewportSize({width:390,height:844});
  for(const [id,target] of [['vegetation','vine'],['gis','region-1'],['urban-waterlogging','drain']]){
    await open(id,true);if(id!=='vegetation')await phase(900);await inspect(target);
    await page.locator('#model-inspect').focus();await page.keyboard.press('Enter');
    await page.locator('#model-inspections button').first().focus();await page.keyboard.press('Enter');
    check(await page.evaluate(()=>document.activeElement?.getAttribute('data-inspection')==='overview'),`${id}: keyboard focus survives observation update`);
    await page.locator('#model-inspect').click();await inspect(target);await capture(`${id}-phone`);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${id}: phone no horizontal overflow`);
    const rect=await page.locator('#model-inspect').boundingBox();check(rect.width>=44&&rect.height>=44,`${id}: part control touch size`);
  }
  check(!errors.length,'No runtime exceptions');
  return{checks,failures,errors,states,scope:'Targeted actual pointer/keyboard operation, three viewports and native SVG; physical devices not verified'};
}
