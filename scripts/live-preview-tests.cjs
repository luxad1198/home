// Opt-in visual/layout regression for live A4 editing vs Chromium PDF.
// Run: node scripts/live-preview-tests.cjs
// Checks all three companies, each with a short and long proposal.
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'artifacts', 'live-preview');
const companies = ['ooo', 'ip', 'ip-glazyrin'];
const cases = companies.flatMap(company => [false, true].map(long => ({ company, long })));
const events = [];
const sleepFrame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() =>
  requestAnimationFrame(resolve))));

function serve() {
  return http.createServer((req, res) => {
    const name = new URL(req.url || '/', 'http://localhost').pathname.slice(1) || 'index.html';
    if (!/^(?:index\.html|app\.js|style\.css|[\w-]+\.webp)$/.test(name)) {
      res.writeHead(404).end(); return;
    }
    fs.readFile(path.join(ROOT, name), (error, data) => {
      if (error) return res.writeHead(404).end();
      const type = name.endsWith('.html') ? 'text/html' :
        name.endsWith('.css') ? 'text/css' :
        name.endsWith('.js') ? 'text/javascript' : 'image/webp';
      res.writeHead(200, { 'content-type': type }); res.end(data);
    });
  });
}
async function box(page, selector) {
  return page.locator(selector).evaluate(el => {
    const r = el.getBoundingClientRect();
    // Use DOCUMENT coordinates: focusing a field in a long A4 document
    // scrolls the viewport but must not count as a layout shift.
    return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height };
  });
}
function equalGeometry(a, b, label, tolerance = 1.5) {
  for (const k of ['x', 'y', 'width', 'height']) {
    assert(Math.abs(a[k] - b[k]) <= tolerance,
      label + ' shifted ' + k + ': ' + a[k] + ' -> ' + b[k]);
  }
}
async function verifyLiveMirror(page, source, mirror) {
  await page.waitForFunction(([a,b]) => {
    const input = document.querySelector(a), reflected = document.querySelector(b);
    return input && reflected && reflected.textContent === input.value &&
      getComputedStyle(reflected).display !== 'none';
  }, [source,mirror]);
}
async function runCase(browser, url, scenario) {
  const context = await browser.newContext({
    locale: 'ru-RU', viewport: { width: 1200, height: 1150 }, deviceScaleFactor: 1
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.setDefaultTimeout(20000);
  await page.route('https://**/*', r => r.abort());
  await page.addInitScript(() => { window.print = () => {}; });
  const slug = scenario.company + (scenario.long ? '-long' : '-short');
  try {
    const response = await page.goto(url, { waitUntil: 'load' });
    assert(response?.ok(), 'Local editor unavailable');
    await page.locator('#companySelect').selectOption(scenario.company);
    const isIp = scenario.company !== 'ooo';
    const clientSelector = isIp ? '#clientBoxIp' : '#clientBox';
    const clientText = 'Тестовый заказчик с длинным названием оборудования и организации\n' +
      'Вторая строка для проверки сохранения ручного переноса';
    await page.locator(clientSelector).fill(clientText);
    await verifyLiveMirror(page, clientSelector,
      isIp ? '#clientContainerIp .client-print-value' : '#clientContainerOoo .client-print-value');
    const numberSelector = isIp ? '#kpNumInputIp' : '#kpNumInput';
    await page.locator(numberSelector).fill('PREVIEW-VERY-LONG-2026-001');

    const first = page.locator('#tableBody tr').first();
    await first.locator('.col-name').fill('Тестовый сервер ' + scenario.company);
    await first.locator('.col-desc').fill('Характеристики и комплектация\n' +
      'Ручной перенос, который должен оставаться видимым в редакторе');
    await first.locator('.col-country').fill('Россия');
    await first.locator('.col-qty').fill('2');
    await first.locator('.col-price').fill('12000');
    await verifyLiveMirror(page, '#tableBody tr:first-child .col-desc',
      '#tableBody tr:first-child .col-text-cell:nth-child(3) .print-text-mirror');

    if (scenario.company === 'ooo') {
      await page.locator('#condOooWarranty').fill('Гарантия на оборудование\nВторая строка условий');
      await verifyLiveMirror(page, '#condOooWarranty', '#condOooWarranty + .print-text-mirror');
    } else if (scenario.company === 'ip') {
      await page.locator('#ipDeliveryTime + .ip-standard-value-editor')
        .fill('Поставка по согласованию\nВторая строка условий');
    } else {
      await page.locator('#ipPaymentTerms').fill('Оплата по согласованию');
      await page.locator('#btnAddCondIp2').click();
      const row = page.locator('#condIpCustomList2 .ip-custom-cond-row').last();
      await row.locator('.ip-cond-lbl-input').fill('Разгрузка');
      await row.locator('.ip-cond-val-input').fill(
        'Разгрузка оборудования по согласованному графику.\nОтветственное лицо встречает транспорт.');
      await page.waitForFunction(() => {
        const row = document.querySelector('#condIpCustomList2 .ip-custom-cond-row');
        return row && row.querySelector('.ip-cond-value-print').textContent ===
          row.querySelector('.ip-cond-val-input').value;
      });
      const align = await row.evaluate(el => ({
        control: getComputedStyle(el.querySelector('.ip-cond-val-input')).textAlign,
        mirror: getComputedStyle(el.querySelector('.ip-cond-value-print')).textAlign
      }));
      assert.equal(align.control, align.mirror, 'Glazyrin editor value alignment differs from print');
    }

    // The live-view sync must never fill in an empty quantity or country.
    await first.locator('.col-country').fill('');
    await first.locator('.col-qty').fill('');
    await sleepFrame(page);
    assert.equal(await first.locator('.col-country').inputValue(), '');
    assert.equal(await first.locator('.col-qty').inputValue(), '');
    await first.locator('.col-country').fill('Россия');
    await first.locator('.col-qty').fill('2');

    if (scenario.long) {
      for (let index = 1; index <= 18; index++) {
        await page.locator('#btnAddRow').click();
        const row = page.locator('#tableBody tr').last();
        await row.locator('.col-name').fill('Дополнительное оборудование ' + index);
        await row.locator('.col-desc').fill('Описание технических параметров. '.repeat(8));
        await row.locator('.col-country').fill('Китай');
        await row.locator('.col-qty').fill('1');
        await row.locator('.col-price').fill('1000');
      }
      assert.equal(await page.locator('#tableBody tr').count(), 19);
    }

    // Finishing an edit, focusing it again or blurring it must not shift the
    // surrounding printable blocks when the actual value is unchanged.
    const desc = first.locator('.col-desc');
    await desc.blur();
    await sleepFrame(page);
    const before = await box(page, '#textTotalBlock');
    const tableBefore = await box(page, '#itemsTable');
    await desc.focus();
    await sleepFrame(page);
    equalGeometry(before, await box(page, '#textTotalBlock'), slug + ' focus total');
    equalGeometry(tableBefore, await box(page, '#itemsTable'), slug + ' focus table');
    await desc.blur();
    await sleepFrame(page);
    equalGeometry(before, await box(page, '#textTotalBlock'), slug + ' blur total');
    equalGeometry(tableBefore, await box(page, '#itemsTable'), slug + ' blur table');

    // Full-page screenshot: compare visually against the PDF with the SAME data.
    await page.locator('.page').screenshot({ path: path.join(OUTPUT, slug + '-web.png') });
    // A print click populates only the existing print defaults / output mirrors.
    await page.locator('#btnPrint').click();
    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: path.join(OUTPUT, slug + '-pdf.pdf'),
      format: 'A4', printBackground: true, preferCSSPageSize: true
    });
    assert.deepEqual(errors, [], slug + ' browser errors');
    events.push({ name: slug, rows: scenario.long ? 19 : 1, stable: true });
    console.log('OK ' + slug + ': live text, focus stability, PDF');
  } finally {
    await context.close();
  }
}
(async () => {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const server = serve();
  await new Promise((resolve,reject) => {
    server.once('error', reject); server.listen(0, '127.0.0.1', resolve);
  });
  const browser = await chromium.launch({headless:true});
  try {
    const url = 'http://127.0.0.1:' + server.address().port;
    for (const scenario of cases) await runCase(browser, url, scenario);
    assert.equal(events.length, 6);
    fs.writeFileSync(path.join(OUTPUT, 'result.json'), JSON.stringify(events,null,2));
    console.log('Live preview checks passed: 6 companies/cases.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
