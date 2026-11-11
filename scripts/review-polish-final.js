async page => {
 const base=page.__reviewBase??'http://127.0.0.1:4180',checks=[],failures=[],errors=[],states=[];
 const check=(ok,label)=>(ok?checks:failures).push(label);
 page.on('pageerror',e=>errors.push(e.message));
 const ready=id=>page.waitForFunction(id=>{const d=window.textbookDiagnostics;return d?.ready&&d.active===id&&!d.figureBusy&&!d.turning&&(d.twoD||d.render?.modelState==='live')},id,{timeout:90000});
 const setPhase=async p=>{await page.locator('#phase').evaluate((el,p)=>{el.value=String(p);el.dispatchEvent(new Event('input',{bubbles:true}))},p);await page.waitForTimeout(1400)};
 const capture=async name=>{const state=await page.evaluate(()=>window.textbookDiagnostics);states.push({name,state});await page.screenshot({path:`output/playwright/polish-delivery-${name}.png`})};
 await page.setViewportSize({width:1366,height:900});
 await page.goto(`${base}/?figure=soil-factors&3d&inspect`);await ready('soil-factors');
 await page.locator('#selections [data-selection="2"]').click();await setPhase(1000);await capture('soil-climate');
 check((await page.locator('#cSpeed').textContent())==='2×','Fresh session defaults to 2×');
 for(const viewport of [{width:1366,height:768},{width:1024,height:768}]){await page.setViewportSize(viewport);await page.waitForTimeout(1500);await capture(`soil-climate-${viewport.width}`)}
 await page.setViewportSize({width:1366,height:900});
 await page.goto(`${base}/?figure=vegetation&3d&inspect`);await ready('vegetation');await page.waitForTimeout(1500);
 await page.locator('#model-inspect').click();await page.locator('[data-inspection="buttress"]').click();await page.waitForTimeout(1500);
 check(await page.evaluate(()=>window.textbookDiagnostics.render.geometry.inspection==='buttress'),'Final build opens physical plant inspection');
 await page.keyboard.press('Escape');
 check(await page.locator('#model-inspections').isHidden()&&await page.evaluate(()=>document.activeElement?.id==='model-inspect'&&window.textbookDiagnostics.active==='vegetation'),'Escape closes part menu, retains model and returns focus');
 await page.locator('#model-inspect').click();await page.mouse.click(400,130);
 check(await page.locator('#model-inspections').isHidden(),'Outside click closes part menu');
 await page.locator('#cContents').click();await page.locator('#contents-models').click();await page.locator('#contents [data-figure="gis"]').click();await ready('gis');
 check(await page.evaluate(()=>window.textbookDiagnostics.render.geometry.inspection==='overview'),'Navigating starts the next model in its own overview');
 await setPhase(930);await page.locator('#model-inspect').click();await page.locator('[data-inspection="region-1"]').click();
 const phase=await page.evaluate(()=>window.textbookDiagnostics.state.phase);
 check(await page.evaluate(()=>window.textbookDiagnostics.render.geometry.inspection==='region-1'&&!window.textbookDiagnostics.playing),'GIS inspection changes the actual scene and pauses playback');
 check(phase===.93,'GIS observation preserves progress');
 await page.keyboard.press('Escape');await capture('gis-menu');
 await page.setViewportSize({width:390,height:844});await page.goto(`${base}/?figure=vegetation&2d&inspect`);await ready('vegetation');
 await page.locator('#model-inspect').focus();await page.keyboard.press('Enter');await page.locator('[data-inspection="vine"]').focus();await page.keyboard.press('Enter');
 check(await page.locator('.flat-concept [data-inspection="vine"]').count()===1,'Final native SVG exposes selected plant part');
 check(await page.evaluate(()=>document.activeElement?.getAttribute('data-inspection')==='vine'),'Final keyboard focus retained');
 await page.keyboard.press('Escape');await capture('phone-vine');
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Phone has no document horizontal overflow');
 check(!errors.length,'No runtime exceptions');
 return{checks,failures,errors,states,scope:'Final label adjustment at three viewports; menu/focus/navigation/reset regression and native phone fallback. Previous BGFlw9RG detailed test results remain separately fingerprinted.'};
}
