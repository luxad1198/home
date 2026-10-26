// One-off reproducible visual experiment; no production code is changed.
// Web screenshot, DOCX and PDF are exported from the SAME filled browser page.
// Run on PR #14 branch (not main): node scripts/experiment-rtstandard-zsd.cjs
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'artifacts', 'experiment-zsd');
fs.mkdirSync(OUT, { recursive: true });

const vendors = [
 { re: /cdn\.jsdelivr\.net\/npm\/docx@8\.5\.0\/build\/index\.umd\.js/, file:'node_modules/docx/build/index.umd.js' },
 { re: /cdnjs\.cloudflare\.com\/ajax\/libs\/FileSaver\.js\/2\.0\.5\/FileSaver\.min\.js/, file:'node_modules/file-saver/dist/FileSaver.min.js' },
 { re: /cdn\.jsdelivr\.net\/npm\/jszip@3\.10\.1\/dist\/jszip\.min\.js/, file:'node_modules/jszip/dist/jszip.min.js' }
];
const fixture = Object.freeze({
    company: 'ooo',
    client: 'АО ЗСД',
    number: 'TEST-001',
    date: '26 октября 2026 года',
    product: 'Тестовый сервер RTD-S1000',
    specs: 'Серверное оборудование,\nпроцессор, память, накопители\nи гарантия производителя',
    country: 'Китай',
    qty: '2',
    unitPrice: '120000',
    payment: '100% постоплата',
    delivery: '5-10 (пять-десять) рабочих дней',
    warranty: '12 месяцев с возможностью расширения до 5 лет.\nВыезд инженера по согласованию.'
});

function server() {
  return http.createServer((req, res) => {
    const name = new URL(req.url || '/', 'http://127.0.0.1').pathname.slice(1) || 'index.html';
    if (!/^(index\.html|app\.js|style\.css|[\w-]+\.webp)$/.test(name)) {
      res.writeHead(404).end('Not found'); return;
    }
    fs.readFile(path.join(ROOT, name), (err, bytes) => {
      if (err) return res.writeHead(404).end('Not found');
      const mime = name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':
        name.endsWith('.js')?'application/javascript':'image/webp';
      res.writeHead(200, {'Content-Type': mime});res.end(bytes);
    });
  });
}
(async () => {
  const srv=server();
  await new Promise((resolve,reject)=>{srv.once('error',reject);srv.listen(0,'127.0.0.1',resolve)});
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({locale:'ru-RU',viewport:{width:1400,height:1200},deviceScaleFactor:1,acceptDownloads:true});
  const page=await context.newPage();
  const errors=[], alerts=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>{alerts.push(dialog.message());void dialog.dismiss()});
  page.setDefaultTimeout(25000);
  await page.route('https://**/*',async route=>{
    const lib=vendors.find(x=>x.re.test(route.request().url()));
    if(lib)await route.fulfill({path:path.join(ROOT,lib.file),contentType:'text/javascript'});
    else await route.abort();
  });
  await page.addInitScript(()=>{
    window.__experimentPrint = false;
    window.print = ()=>{window.__experimentPrint=true};
  });
  try {
    const url='http://127.0.0.1:'+srv.address().port+'/';
    const result=await page.goto(url,{waitUntil:'load'});
    assert(result?.ok(),'Application did not load');
    assert(await page.evaluate(()=>!!window.docx?.Document && !!window.saveAs),
      'Real Word export libraries did not load');
    await page.locator('#companySelect').selectOption('ooo');
    await page.locator('#kpNumInput').fill(fixture.number);
    await page.locator('#docDate').fill(fixture.date);
    await page.locator('#clientBox').fill(fixture.client);

    const r=page.locator('#tableBody tr').first();
    await r.locator('.col-name').fill(fixture.product);
    await r.locator('.col-desc').fill(fixture.specs);
    await r.locator('.col-country').fill(fixture.country);
    await r.locator('.col-qty').fill(fixture.qty);
    await r.locator('.col-price').fill(fixture.unitPrice);
    await page.locator('#condOooDeliveryTime').fill(fixture.delivery);
    await page.locator('#condOooPay').fill(fixture.payment);
    await page.locator('#condOooWarranty').fill(fixture.warranty);

    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await page.locator('#clientBox').inputValue(),fixture.client);
    const customer=await page.locator('#clientContainerOoo .client-print-value').textContent();
    assert.equal(customer,fixture.client,'Customer did not update in web print mirror');

    const total=(await page.locator('#grandTotal').innerText()).replace(/\s/g,'');
    assert.equal(total,'240000,00','Wrong total: '+total);
    assert.deepEqual(errors,[],'Page JavaScript error');

    // Save the *actual* editable page before running export/print.
    await page.locator('.page').screenshot({path:path.join(OUT,'web-rtstandard-zsd.png')});
    console.log('OK real web screenshot, customer '+customer+', total '+total);

    const pendingDownload=page.waitForEvent('download',{timeout:60000});
    await page.locator('#btnExportWord').click();
    const docx=await pendingDownload;
    assert.equal(await docx.failure(),null,'Word export failed');
    assert(docx.suggestedFilename().endsWith('.docx'),'Not a Word export');
    await docx.saveAs(path.join(OUT,'rtstandard-zsd.docx'));
    assert.equal(fs.readFileSync(path.join(OUT,'rtstandard-zsd.docx')).subarray(0,2).toString(),'PK');
    console.log('OK real Word export');

    await page.locator('#btnPrint').click();
    assert(await page.evaluate(()=>window.__experimentPrint),'Real print handler did not run');
    assert.deepEqual(alerts,[],'Unexpected validation dialogs: '+alerts.join(' | '));
    await page.evaluate(()=>document.fonts.ready);
    await page.emulateMedia({media:'print'});
    await page.pdf({path:path.join(OUT,'rtstandard-zsd-chromium.pdf'),preferCSSPageSize:true,printBackground:true});
    assert.equal(fs.readFileSync(path.join(OUT,'rtstandard-zsd-chromium.pdf')).subarray(0,5).toString(),'%PDF-');
    assert.deepEqual(errors,[],'Browser errors during export');
    fs.writeFileSync(path.join(OUT,'test-data.json'),JSON.stringify(fixture,null,2)+'\n');
    console.log('OK real Chromium PDF from the same DOM; saved fixture data');
  }finally{
    await context.close();await browser.close();
    await new Promise(resolve=>srv.close(resolve));
  }
})().catch(e=>{console.error(e);process.exitCode=1});
