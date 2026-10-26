// Temporary real-browser PR #16 acceptance for LIScorp Graphite.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts', 'liscorp-graphite');
fs.mkdirSync(output, {recursive:true});
const color = {
  accent:'rgb(8, 127, 140)', dark:'rgb(23, 28, 36)',
  panelNeutral:'rgb(48, 57, 70)', panelDanger:'rgb(70, 42, 52)',
  light:'rgb(243, 245, 246)', white:'rgb(255, 255, 255)'
};
const server=http.createServer((req,res)=>{
  const filename = new URL(req.url||'/', 'http://127.0.0.1').pathname.slice(1) || 'index.html';
  if (!/^(index\.html|app\.js|style\.css|[\w-]+\.webp)$/.test(filename)) {
    res.writeHead(404).end();return;
  }
  fs.readFile(path.join(root,filename),(err,data)=>{
    if(err){res.writeHead(404).end();return;}
    res.setHeader('Content-Type', {'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp'}[path.extname(filename)]);
    res.end(data);
  });
});
async function bg(page,selector){
  return page.locator(selector).evaluate(el=>getComputedStyle(el).backgroundColor);
}
async function checkButton(page,selector,expected,height=36){
  const el=page.locator(selector);
  assert(await el.isVisible(),selector+' must be visible');
  const got=await el.evaluate(el=>({
    bg:getComputedStyle(el).backgroundColor,
    height:el.getBoundingClientRect().height,
    radius:getComputedStyle(el).borderRadius
  }));
  assert.equal(got.bg,expected,selector+' background mismatch');
  assert.equal(got.radius,'6px',selector+' radius mismatch');
  assert(Math.abs(got.height-height)<=1,selector+' height mismatch '+got.height);
}
(async()=>{
  await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
  const browser=await chromium.launch({headless:true});
  try{
    const url='http://127.0.0.1:'+server.address().port+'/';
    for(const company of ['ooo','ip','ip-glazyrin']){
      const context=await browser.newContext({locale:'ru-RU',viewport:{width:1530,height:950}});
      const page=await context.newPage();
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.setDefaultTimeout(18000);
      await page.route('https://**/*',r=>r.abort());
      await page.addInitScript(()=>{window.__printCalls=0;window.print=()=>window.__printCalls++});
      await page.goto(url,{waitUntil:'load'});
      await page.locator('#companySelect').selectOption(company);
      assert.equal(await bg(page,'body'),color.light,'Body must be light');
      assert.equal(await bg(page,'.panel'),color.dark,'Only top toolbar is graphite');
      for(const selector of ['.editor-tools','.page','.calc-sidebar']){
        assert.equal(await bg(page,selector),color.white,selector+' must remain white');
      }
      assert(await page.locator('.panel-brand').isVisible(),'LIScorp brand missing');
      assert.equal(await page.locator('.panel-brand-name').textContent(),'LIScorp');
      await checkButton(page,'#btnPrint',color.accent);
      await checkButton(page,'#btnExportWord','rgba(0, 0, 0, 0)');
      await checkButton(page,'#btnAddRow',color.panelNeutral);
      await checkButton(page,'#btnToggleBg',color.panelNeutral);
      await checkButton(page,'#btnClearForm',color.panelDanger);
      await checkButton(page,'#btnImportEquipment',color.light);
      await checkButton(page,'#btnPreviewPages',color.white);
      await checkButton(page,'#btnToggleCalc',color.accent,30);
      assert.equal(await page.locator('#btnExportWord').evaluate(el=>getComputedStyle(el).borderTopColor),
                   'rgb(43, 164, 174)','Word outline color');
      assert(await page.locator('#btnUndoEquipmentImport').isHidden());
      assert(await page.locator('#equipmentImportApply').isDisabled());
      assert.equal(await bg(page,'#equipmentImportApply'),color.accent,'Import confirmation');
      assert((await page.locator('#tableBody .col-name').first().evaluate(el=>getComputedStyle(el).fontFamily))
             .includes('Times New Roman'),'Proposal font changed');
      await page.screenshot({path:path.join(output,company+'-workspace.png')});
      await page.locator('.panel').screenshot({path:path.join(output,company+'-toolbar.png')});
      await page.locator('.editor-tools').screenshot({path:path.join(output,company+'-tools.png')});
      await page.locator('#calcSidebar').screenshot({path:path.join(output,company+'-calculator.png')});
      const before=await page.locator('#tableBody tr').count();
      await page.locator('#btnAddRow').click();
      assert.equal(await page.locator('#tableBody tr').count(),before+1,'Add row failed');
      await page.locator('#btnToggleBg').click();
      assert(await page.locator('body').evaluate(el=>el.classList.contains('hide-bg-sidebar')),'Hide images failed');
      await page.locator('#btnPrint').click();
      assert.equal(await page.evaluate(()=>window.__printCalls),1,'Print failed');
      if(company==='ip-glazyrin'){
        await page.locator('#btnAddCondIp2').click();
        assert.equal(await page.locator('#condIpCustomList2 .ip-custom-cond-row').count(),1);
      }else{
        await page.locator('#btnAddCondRow').click();
        assert.equal(await page.locator(company==='ooo'?'#condOooTbody tr.custom-cond-row':'#condIpCustomList .ip-custom-cond-row').count(),1);
      }
      await page.locator('#btnFinWeeks').click();
      await checkButton(page,'#btnWeekMinus',color.light,30);
      await checkButton(page,'#btnWeekPlus',color.light,30);
      await page.locator('#btnModePct').click();
      assert(await page.locator('#btnModePct').evaluate(el=>el.classList.contains('active')));
      await page.locator('#btnCloseCalc').click();
      assert(await page.locator('#calcSidebar').evaluate(el=>el.classList.contains('collapsed')));
      await page.locator('#btnToggleCalc').click();
      assert(!(await page.locator('#calcSidebar').evaluate(el=>el.classList.contains('collapsed'))));
      await page.locator('#equipmentImportDialog').evaluate(d=>d.showModal());
      await page.locator('#equipmentImportDialog').screenshot({path:path.join(output,company+'-dialog.png')});
      await page.locator('#equipmentImportCancel').click();
      assert(!(await page.locator('#equipmentImportDialog').evaluate(el=>el.open)));
      await page.emulateMedia({media:'print'});
      assert(await page.locator('.panel').isHidden(),'Toolbar must not enter PDF print');
      assert.equal(await bg(page,'body'),color.white,'Print background must stay white');
      assert.deepEqual(errors,[],'Browser errors in '+company);
      console.log('PASS',company);
      await context.close();
    }
    const ctx=await browser.newContext({viewport:{width:600,height:850},locale:'ru-RU'});
    const page=await ctx.newPage();
    await page.route('https://**/*',r=>r.abort());
    await page.goto(url,{waitUntil:'load'});
    await page.locator('#btnCloseCalc').click();
    await page.waitForFunction(()=>getComputedStyle(document.getElementById('calcSidebar')).opacity==='0');
    const layout=await page.evaluate(()=>{
      const toggle=document.querySelector('#btnToggleCalc').getBoundingClientRect();
      const panel=document.querySelector('.panel').getBoundingClientRect();
      return {
        enoughGap:panel.top>=toggle.bottom+6,
        panelOverflow:document.querySelector('.panel').scrollWidth-document.querySelector('.panel').clientWidth,
        editorOverflow:document.querySelector('.editor-tools').scrollWidth-document.querySelector('.editor-tools').clientWidth
      };
    });
    assert(layout.enoughGap,'Calculator button overlaps mobile toolbar');
    assert(layout.panelOverflow<=2,'Mobile toolbar overflows '+JSON.stringify(layout));
    assert(layout.editorOverflow<=2,'Mobile editor tools overflow '+JSON.stringify(layout));
    await page.screenshot({path:path.join(output,'mobile-workspace.png')});
    console.log('PASS mobile',layout);
    await ctx.close();
    console.log('LISCORP GRAPHITE ACCEPTANCE PASSED');
  }finally{
    await browser.close();
    await new Promise(ok=>server.close(ok));
  }
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
