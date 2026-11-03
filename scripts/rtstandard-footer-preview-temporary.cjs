// One-time Chromium screenshot of the same RTStandard fixture as Word/PDF.
'use strict';
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const ROOT=path.resolve(__dirname,'..');
const OUT=path.join(ROOT,'artifacts','rtstandard-footer-visual');
fs.mkdirSync(OUT,{recursive:true});

const server=http.createServer((req,res)=>{
  const name=new URL(req.url||'/','http://127.0.0.1').pathname.slice(1)||'index.html';
  if(!/^(index\.html|app\.js|style\.css|[\w-]+\.webp)$/.test(name)){res.writeHead(404).end();return;}
  fs.readFile(path.join(ROOT,name),(error,body)=>{
    if(error){res.writeHead(404).end();return;}
    res.setHeader('Content-Type', {'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp'}[path.extname(name)]);
    res.end(body);
  });
});
(async()=>{
  await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok)});
  const browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext({viewport:{width:1490,height:1150},locale:'ru-RU',deviceScaleFactor:1});
    const page=await ctx.newPage();
    const errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    await page.route('https://**/*', r=>r.abort());
    await page.addInitScript(()=>window.print=()=>{window.__printRequested=true});
    await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
    await page.locator('#companySelect').selectOption('ooo');
    await page.locator('#clientBox').fill('Тестовый заказчик');
    await page.locator('#kpNumInput').fill('TEST-DOCX');
    await page.locator('#condOooPay').fill('Тестовая оплата 30 дней');
    const row=page.locator('#tableBody tr').first();
    await row.locator('.col-name').fill('RTPDF01 Тестовое оборудование');
    await row.locator('.col-desc').fill('Процессор и память\nВторая строка с дополнительными характеристиками');
    await row.locator('.col-country').fill('Китай');
    await row.locator('.col-qty').fill('2');
    await row.locator('.col-price').fill('12000');
    await row.locator('.col-price').press('Tab');
    await page.locator('#btnPrint').click();
    assert.equal(await page.evaluate(()=>window.__printRequested),true);
    const footer=await page.locator('#contactsOoo').innerText();
    assert(!footer.includes('+7 (981) 040-10-70'),'Removed mobile is still in website footer');
    assert(footer.includes('+7 (812) 983-44-33'),'City contact removed unexpectedly');
    assert(footer.includes('info@liscorp.ru'),'Email removed unexpectedly');
    assert(footer.includes('https://liscorp.ru/'),'Website removed unexpectedly');
    await page.addStyleTag({content:'.calc-sidebar,.calc-toggle-panel-btn,.bg-sidebar{visibility:hidden!important}'});
    await page.locator('.page').screenshot({path:path.join(OUT,'rtstandard-web-page.png')});
    await page.locator('#contactsOoo').screenshot({path:path.join(OUT,'rtstandard-web-contacts.png')});
    // Print DOM must also reflect the edited footer, without extra line breaks.
    await page.emulateMedia({media:'print'});
    assert(await page.locator('#contactsOoo').isVisible());
    assert.equal(await page.locator('#contactsOoo').innerText(),footer);
    await page.locator('.page').screenshot({path:path.join(OUT,'rtstandard-print-preview.png')});
    for(const company of ['ip','ip-glazyrin']){
      await page.emulateMedia({media:'screen'});
      await page.locator('#companySelect').selectOption(company);
      assert(await page.locator('#contactsIp').isVisible(),'IP contacts disappeared: '+company);
      assert(await page.locator('#contactsOoo').isHidden(),'RTStandard footer appears in '+company);
    }
    assert.deepEqual(errors,[]);
    console.log('PASS real Chromium: ООО footer without removed phone, other contacts preserved, IPs unchanged');
    await ctx.close();
  } finally {
    await browser.close();
    await new Promise(ok=>server.close(ok));
  }
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
