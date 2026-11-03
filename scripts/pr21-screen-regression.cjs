// Temporary real-browser layout verification for the Zakharov/RTStandard print change.
'use strict';
const {before, after, test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'artifacts', 'pr21-compare');
fs.mkdirSync(OUT, {recursive: true});
let browser, server, url;

before(async () => {
  server = http.createServer((request, response) => {
    const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
    const file = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!/^(index\.html|app\.js|style\.css|[\w-]+\.webp)$/.test(file)) {
      response.writeHead(404).end(); return;
    }
    fs.readFile(path.join(ROOT, file), (error, content) => {
      if (error) { response.writeHead(404).end(); return; }
      const types = {'.html':'text/html', '.js':'application/javascript',
        '.css':'text/css', '.webp':'image/webp'};
      response.writeHead(200, {'content-type':types[path.extname(file)]});
      response.end(content);
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  url = 'http://127.0.0.1:' + server.address().port + '/';
  browser = await chromium.launch({headless:true});
});
after(async () => {
  if(browser) await browser.close();
  if(server) await new Promise(ok => server.close(ok));
});
async function withPage(cb) {
  const context = await browser.newContext({
    locale:'ru-RU', viewport:{width:1510,height:1210}
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e=>errors.push(e.message));
  await page.route('https://**/*', r=>r.abort());
  page.setDefaultTimeout(12000);
  try {
    await page.goto(url,{waitUntil:'load'});
    await cb(page);
    assert.deepEqual(errors,[], 'Browser script exceptions');
  } finally {
    await context.close();
  }
}
async function appearance(page, expectedCenter, expectedGap) {
  const actual = await page.evaluate(() => {
    const title = document.querySelector('.title').getBoundingClientRect();
    const intro = document.querySelector('.intro').getBoundingClientRect();
    const css = el=>getComputedStyle(document.querySelector(el)).textAlign;
    return {
      price:css('#tableBody .col-price'),
      sum:css('#tableBody .col-total'),
      total:css('#grandTotal'),
      gap:intro.top-title.bottom
    };
  });
  const align = expectedCenter ? 'center' : 'right';
  assert.equal(actual.price,align, 'Price is not '+align);
  assert.equal(actual.sum,align, 'Line total is not '+align);
  assert.equal(actual.total,align, 'Grand total is not '+align);
  assert(actual.gap >= expectedGap && actual.gap <= expectedGap+8,
    'Unexpected title spacing '+JSON.stringify(actual));
}
for (const entry of [
  {company:'ooo',marker:'RTPDF01',num:'TEST-DOCX'},
  {company:'ip',marker:'ZKPDF02',num:'Q7'},
  {company:'ip-glazyrin',marker:'GLPDF03',num:'Q7'}
]) {
  test('editor and PDF styles for '+entry.company, async () => {
    await withPage(async page => {
      await page.locator('#companySelect').selectOption(entry.company);
      const isIp = entry.company !== 'ooo';
      await page.locator(isIp?'#clientBoxIp':'#clientBox').fill('Тестовый заказчик');
      await page.locator(isIp?'#kpNumInputIp':'#kpNumInput').fill(entry.num);
      if(!isIp) await page.locator('#condOooPay').fill('Тестовая оплата 30 дней');
      else if(entry.company==='ip'){
        await page.locator('#ipDeliveryTime + .ip-standard-value-editor')
          .fill('Тестовый срок 14 дней\nДополнительная строка условия');
      } else await page.locator('#ipDeliveryTime').fill('Тестовый срок 14 дней');
      const row=page.locator('#tableBody tr').first();
      await row.locator('.col-name').fill(entry.marker+' Тестовое оборудование');
      await row.locator('.col-desc').fill('Процессор и память\nВторая строка с дополнительными характеристиками');
      await row.locator('.col-country').fill('Китай');
      await row.locator('.col-qty').fill('2');
      await row.locator('.col-price').fill('12000');
      // Capture the ordinary, unfocused document: price is formatted just as
      // it is before exporting Word/PDF, not as a raw edit-in-progress value.
      await row.locator('.col-price').press('Tab');
      await appearance(page,entry.company==='ip',entry.company==='ip-glazyrin'?0:20);
      if(entry.company==='ip'){
        const date = await page.locator('#docDateIp').inputValue();
        assert.match(date,/^«\d{2}» [а-яё]+ \d{4} года$/i);
        assert.equal(await page.locator('#ipDateLabel').innerText(),'от');
        const distance = await page.evaluate(() => {
          const a=document.querySelector('.kp-ip-wrapper').getBoundingClientRect();
          const b=document.querySelector('.head-ip-meta-left > div:nth-child(2)').getBoundingClientRect();
          return b.left-a.right;
        });
        assert(distance>=0 && distance<=7, 'Date too far from number: '+distance);
      }
      await page.locator('.page').screenshot({path:path.join(OUT,entry.company+'-web.png')});
      await page.emulateMedia({media:'print'});
      await appearance(page,entry.company==='ip',entry.company==='ip-glazyrin'?0:20);
    });
  });
}
test('Zakharov quotes are normalized after editing; Glazyrin date remains unquoted', async () => {
  await withPage(async page => {
    await page.locator('#companySelect').selectOption('ip');
    await page.locator('#docDateIp').fill('4 декабря 2026 года');
    await page.locator('#docDateIp').press('Tab');
    assert.equal(await page.locator('#docDateIp').inputValue(),'«04» декабря 2026 года');
    assert.equal(await page.locator('#docDate').inputValue(),'04 декабря 2026 года');
    await page.locator('#companySelect').selectOption('ip-glazyrin');
    assert.equal(await page.locator('#docDateIp').inputValue(),'04 декабря 2026 года');
    assert.equal(await page.locator('#ipDateLabel').innerText(),'От');
    await page.locator('#companySelect').selectOption('ip');
    assert.equal(await page.locator('#docDateIp').inputValue(),'«04» декабря 2026 года');
  });
});
