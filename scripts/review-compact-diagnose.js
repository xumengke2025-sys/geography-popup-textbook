async page=>{
 await page.setViewportSize({width:320,height:740});await page.goto(`${page.__reviewBase??'http://127.0.0.1:5173'}/?figure=urban-waterlogging&2d`);
 await page.waitForFunction(()=>window.textbookDiagnostics?.active==='urban-waterlogging'&&!window.textbookDiagnostics.figureBusy);
 await page.waitForTimeout(500);await page.screenshot({path:'output/playwright/compact-320-diagnose.png'});
 const states=await page.locator('.capsule,.capsule>*,.mid>*,#figure-controls>*,.figure-timeline>*').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect(),c=getComputedStyle(el);return {id:el.id,cl:el.className,w:r.width,h:r.height,display:c.display,grid:c.gridTemplateRows,visibility:el.checkVisibility(),lineHeight:c.lineHeight,minHeight:c.minHeight}}));
 return {checks:[],failures:[],errors:[],states};
}
