async page => {
  const base=page.__reviewBase??'http://127.0.0.1:4180',checks=[],failures=[],errors=[],labelIssues=[],states=[];
  const check=(ok,name)=>(ok?checks:failures).push(name);
  page.on('pageerror',e=>errors.push(e.message));
  const ready=id=>page.waitForFunction(id=>{const d=window.textbookDiagnostics;return d?.ready&&!d.turning&&!d.figureBusy&&d.active===id&&d.render?.modelState==='live'},id,{timeout:45000});
  for(const viewport of [{width:1366,height:900},{width:1366,height:768},{width:1024,height:768}]){
    await page.setViewportSize(viewport);
    for(const id of ['solar','wind-forces','karst-cave','flood','warehouse']){
      await page.goto(`${base}/?3d&inspect&figure=${id}`);await ready(id);
      if((await page.evaluate(()=>window.textbookDiagnostics)).playing)await page.locator('#cPause').click();
      const selections=id==='wind-forces'?[0,1,2,3]:id==='solar'?[0,1,3,8]:id==='karst-cave'?[1]:id==='flood'?[1]:[0,1,2];
      for(const selection of selections){
        const button=page.locator(`#selections [data-selection="${selection}"]`);
        if(await button.count())await button.click();
        else if(id==='solar'){
          const target=await page.evaluate(selection=>{
            const b=window.textbookDebug,meshes=b.entry.art.geometry.meshes;
            const mesh=meshes.find(m=>selection?m.userData.planetIndex===selection-1:m.userData.body==='sun');
            mesh.geometry.computeBoundingSphere();const q=mesh.geometry.boundingSphere.center.clone().applyMatrix4(mesh.matrixWorld).project(b.camera);
            const x=(q.x+1)*innerWidth/2,y=(1-q.y)*innerHeight/2;
            for(const dx of [0,-6,6,-12,12])for(const dy of [0,-6,6,-12,12])if(b.pickModel(x+dx,y+dy)?.input?.selection===selection)return{x:x+dx,y:y+dy};return null;
          },selection);
          check(!!target,`${viewport.width}x${viewport.height}/solar/${selection}: reachable physical planet`);
          if(target)await page.mouse.click(target.x,target.y);
        }
        await page.locator('#phase').evaluate(el=>{el.value='600';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))});
        await page.waitForTimeout(1600);
        const d=await page.evaluate(()=>window.textbookDiagnostics),labels=d.render.labels;
        const small=labels.filter(l=>l.fontPx<17.9),outside=labels.filter(l=>l.left<0||l.right>viewport.width||l.top<70||l.bottom>viewport.height-135);
        const overlap=labels.flatMap((a,i)=>labels.slice(i+1).filter(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2).map(b=>[a.text,b.text]));
        if(small.length||outside.length||overlap.length)labelIssues.push({id,viewport,selection,small,outside,overlap});
        check(d.active===id&&d.render.geometry.solids>0&&d.state.selection===selection,`${viewport.width}x${viewport.height}/${id}/${selection}: elevated solid model and requested condition`);
        if(id==='wind-forces')check(await page.locator('#cPause').isHidden(),`Wind condition ${selection} has no fictitious playback`);
        states.push({id,viewport,selection,labels,model:d.render.model});
        if(viewport.height===900||id==='karst-cave')await page.screenshot({path:`output/playwright/experience-layout-${id}-${viewport.width}x${viewport.height}-${selection}.png`});
      }
    }
  }
  check(!errors.length,'No runtime exceptions');return{checks,failures,errors,labelIssues,states,scope:'Five adjusted models, three desktop/tablet viewports, conditions; physical devices not tested'};
}
