// PR #16: one-time real Chromium appearance and actions, not permanent CI.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const dest=path.join(root,'artifacts','ui-controls-pr16');
fs.mkdirSync(dest,{recursive:true});
const BG={blue:'rgb(37, 99, 235)',neutral:'rgb(248, 250, 252)',danger:'rgb(255, 241, 242)'};
const server=http.createServer((req,res)=>{
  const name=new URL(req.url||'/','http://127.0.0.1').pathname.slice(1)||'index.html';
  if(!/^(index\.html|app\.js|style\.css|[\w-]+\.webp)$/.test(name)){res.writeHead(404).end();return;}
  fs.readFile(path.join(root,name),(err,bytes)=>{
    if(err){res.writeHead(404).end();return;}
    const ext=path.extname(name);
    res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp'}[ext]});
    res.end(bytes);
  });
});
async function inspect(page,selector,background,expectedHeight=36){
  const el=page.locator(selector);
  assert(await el.isVisible(),selector+' is hidden');
  const s=await el.evaluate(node=>{
    const c=getComputedStyle(node);
    return {color:c.backgroundColor,radius:c.borderRadius,height:node.getBoundingClientRect().height,font:c.fontFamily,border:c.borderTopColor};
  });
  assert.equal(s.color,background,selector+' background '+JSON.stringify(s));
  assert.equal(s.radius,'6px',selector+' radius '+JSON.stringify(s));
  assert(Math.abs(s.height-expectedHeight)<=1,selector+' height '+JSON.stringify(s));
  assert(/Segoe UI|Arial|Roboto/.test(s.font),selector+' unexpected font '+s.font);
}
(async()=>{
  await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});
  const browser=await chromium.launch({headless:true});
  try{
    const url='http://127.0.0.1:'+server.address().port+'/';
    for(const company of ['ooo','ip','ip-glazyrin']){
      const context=await browser.newContext({locale:'ru-RU',viewport:{width:1530,height:950}});
      const page=await context.newPage(),errors=[];
      page.setDefaultTimeout(18000);
      page.on('pageerror',e=>errors.push(e.message));
      await page.route('https://**/*',r=>r.abort());
      await page.addInitScript(()=>{window.__printCount=0;window.print=()=>window.__printCount++;});
      const response=await page.goto(url,{waitUntil:'load'});
      assert(response?.ok(),'App unavailable');
      await page.locator('#companySelect').selectOption(company);
      await inspect(page,'#btnPrint',BG.blue);
      await inspect(page,'#btnExportWord','rgb(255, 255, 255)');
      await inspect(page,'#btnAddRow',BG.neutral);
      await inspect(page,'#btnToggleBg',BG.neutral);
      await inspect(page,'#btnClearForm',BG.danger);
      await inspect(page,'#btnImportEquipment',BG.neutral);
      await inspect(page,'#btnPreviewPages','rgb(255, 255, 255)');
      assert(await page.locator('#btnUndoEquipmentImport').isHidden(),'Hidden undo incorrectly visible');
      assert(await page.locator('#equipmentImportApply').isDisabled(),'Import confirmation should be disabled');
      assert.equal(await page.locator('#btnExportWord').evaluate(el=>getComputedStyle(el).borderTopColor),
        'rgb(147, 197, 253)','Word border must be blue');
      assert.equal(await page.locator('#equipmentImportApply').evaluate(el=>getComputedStyle(el).backgroundColor),
        BG.blue,'Import confirmation is still green');
      const type=await page.locator('#tableBody .col-name').first().evaluate(el=>getComputedStyle(el).fontFamily);
      assert(type.includes('Times New Roman'),'Printed document typography was modified');
      await page.locator('.panel').screenshot({path:path.join(dest,company+'-toolbar.png')});
      await page.locator('.editor-tools').screenshot({path:path.join(dest,company+'-tools.png')});
      const row=page.locator('#tableBody tr').first();
      await row.locator('.col-name').fill('Тестовый компьютер');
      await row.locator('.col-qty').fill('1');
      await row.locator('.col-price').fill('1000');
      await page.locator('#btnPrint').click();
      assert.equal(await page.evaluate(()=>window.__printCount),1,'Print click did not work');
      const count=await page.locator('#tableBody tr').count();
      await page.locator('#btnAddRow').click();
      assert.equal(await page.locator('#tableBody tr').count(),count+1,'Add row failed');
      await page.locator('#btnToggleBg').click();
      assert(await page.locator('body').evaluate(el=>el.classList.contains('hide-bg-sidebar')),'Hide images failed');
      if(company==='ip-glazyrin'){
        await inspect(page,'#btnAddCondIp2',BG.neutral);
        await page.locator('#btnAddCondIp2').click();
        assert.equal(await page.locator('#condIpCustomList2 .ip-custom-cond-row').count(),1);
      }else{
        await inspect(page,'#btnAddCondRow',BG.neutral);
        await page.locator('#btnAddCondRow').click();
        assert.equal(await page.locator(company==='ooo'?'#condOooTbody tr.custom-cond-row':'#condIpCustomList .ip-custom-cond-row').count(),1);
      }
      const choose=page.waitForEvent('filechooser');
      await page.locator('#btnImportEquipment').click();
      assert(!(await choose).isMultiple(),'Import selector changed');
      await inspect(page,'#btnCopyCalc',BG.blue);
      for (const selector of ['.calc-title', '.calc-label', '.calc-res-row', '.calc-highlight-val']) {
        const font=await page.locator(selector).first().evaluate(el=>getComputedStyle(el).fontFamily);
        assert(/Segoe UI|Arial|Roboto/.test(font), selector + ' still uses document serif font');
      }
      assert.equal(await page.locator('#btnCloseCalc').evaluate(el=>el.tagName),'BUTTON');
      await page.locator('#calcSidebar').screenshot({path:path.join(dest,company+'-calculator.png')});
      await page.locator('#btnFinWeeks').click();
      await inspect(page,'#btnWeekPlus',BG.neutral,30);
      await inspect(page,'#btnWeekMinus',BG.neutral,30);
      await page.locator('#btnModePct').click();
      assert(await page.locator('#btnModePct').evaluate(el=>el.classList.contains('active')));
      await page.locator('#btnCloseCalc').click();
      assert(await page.locator('#calcSidebar').evaluate(el=>el.classList.contains('collapsed')),'Calculator close failed');
      await page.locator('#btnToggleCalc').click();
      assert(!(await page.locator('#calcSidebar').evaluate(el=>el.classList.contains('collapsed'))),'Calculator open failed');
      await page.locator('#equipmentImportDialog').evaluate(d=>d.showModal());
      await page.locator('#equipmentImportDialog').screenshot({path:path.join(dest,company+'-import-dialog.png')});
      await page.locator('#equipmentImportCancel').click();
      assert.equal(await page.locator('#equipmentImportDialog').evaluate(d=>d.open),false);
      assert.deepEqual(errors,[],'Browser JS errors '+company);
      console.log('OK '+company+' toolbar/calculator/dialog styles and primary actions');
      await context.close();
    }
    const context=await browser.newContext({locale:'ru-RU',viewport:{width:600,height:850}});
    const page=await context.newPage();
    await page.route('https://**/*',r=>r.abort());
    await page.goto(url,{waitUntil:'load'});
    await page.locator('.panel').screenshot({path:path.join(dest,'mobile-toolbar.png')});
    await page.locator('.editor-tools').screenshot({path:path.join(dest,'mobile-tools.png')});
    const sizes=await page.evaluate(()=>{
      const a=document.querySelector('.panel'),b=document.querySelector('.editor-tools');
      return {panel:[a.clientWidth,a.scrollWidth],tools:[b.clientWidth,b.scrollWidth]};
    });
    assert(sizes.panel[1]<=sizes.panel[0]+2,'Toolbar overflow '+JSON.stringify(sizes));
    assert(sizes.tools[1]<=sizes.tools[0]+2,'Editor tools overflow '+JSON.stringify(sizes));
    await context.close();
    console.log('OK narrow width layout: '+JSON.stringify(sizes));
    console.log('UI CONTROLS ACCEPTANCE PASSED');
  }finally{
    await browser.close();
    await new Promise(ok=>server.close(ok));
  }
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
