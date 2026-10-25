// Real DOCX export test: click the application's "Download Word" button in Chromium.
// Run from repo root: node scripts/generate-word-documents.cjs [ooo|ip|ip-glazyrin|long]
// Install test-only packages first: npm install --no-save --package-lock=false
//   playwright@1.56.1 docx@8.5.0 jszip@3.10.1 file-saver@2.0.5
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'artifacts', 'word-docx');
const VENDORS = [
  { url: /cdn\.jsdelivr\.net\/npm\/docx@8\.5\.0\/build\/index\.umd\.js/, file: 'node_modules/docx/build/index.umd.js' },
  { url: /cdnjs\.cloudflare\.com\/ajax\/libs\/FileSaver\.js\/2\.0\.5\/FileSaver\.min\.js/, file: 'node_modules/file-saver/dist/FileSaver.min.js' },
  { url: /cdn\.jsdelivr\.net\/npm\/jszip@3\.10\.1\/dist\/jszip\.min\.js/, file: 'node_modules/jszip/dist/jszip.min.js' }
];
const SCENARIOS = [
  { key: 'ooo', company: 'ooo', filename: 'rtstandard.docx', marker: 'RTPDF01' },
  { key: 'ip', company: 'ip', filename: 'zakharov.docx', marker: 'ZKPDF02' },
  { key: 'ip-glazyrin', company: 'ip-glazyrin', filename: 'glazyrin.docx', marker: 'GLPDF03' },
  { key: 'long', company: 'ooo', filename: 'rtstandard-multipage.docx', marker: 'RTPDF04', extraRows: 18 }
];

function serverFactory() {
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.webp': 'image/webp' };
  return http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const file = decodeURIComponent(url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
    // Serve only repository root assets; no access to test files or node_modules over HTTP.
    if (!/^(?:index\.html|app\.js|style\.css|[\w-]+\.webp)$/.test(file)) {
      res.writeHead(404).end('Not found');
      return;
    }
    fs.readFile(path.join(ROOT, file), (error, bytes) => {
      if (error) return res.writeHead(404).end('Not found');
      res.writeHead(200, { 'content-type': mime[path.extname(file)] });
      res.end(bytes);
    });
  });
}

async function generateWord(browser, url, scenario) {
  const context = await browser.newContext({ locale: 'ru-RU', acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  const alerts = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => {
    alerts.push(dialog.message());
    void dialog.dismiss();
  });

  // Serve pinned, locally installed UMD builds, avoiding external CDN dependency.
  await page.route('https://**/*', async route => {
    const entry = VENDORS.find(item => item.url.test(route.request().url()));
    if (!entry) return route.abort();
    await route.fulfill({ path: path.join(ROOT, entry.file), contentType: 'application/javascript' });
  });

  try {
    const response = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    assert(response && response.ok(), 'Cannot load the proposal application');
    assert(await page.evaluate(() => !!window.docx?.Document && !!window.saveAs),
      'Word export dependencies were not loaded');

    await page.locator('#companySelect').selectOption(scenario.company);
    const isIp = scenario.company !== 'ooo';
    await page.locator(isIp ? '#clientBoxIp' : '#clientBox').fill('Тестовый заказчик');
    await page.locator(isIp ? '#kpNumInputIp' : '#kpNumInput').fill('Q7');
    if (!isIp) {
      await page.locator('#condOooPay').fill('Тестовая оплата 30 дней');
    } else if (scenario.company === 'ip') {
      // IP Zakharov edits the value through the visible contenteditable proxy.
      // The underlying #ipDeliveryTime input is deliberately hidden in screen CSS.
      await page.locator('#ipDeliveryTime + .ip-standard-value-editor')
        .fill('Тестовый срок 14 дней');
    } else {
      await page.locator('#ipDeliveryTime').fill('Тестовый срок 14 дней');
    }

    const first = page.locator('#tableBody tr').first();
    await first.locator('.col-name').fill(scenario.marker + ' Тестовое оборудование');
    await first.locator('.col-desc').fill('Процессор и память\nВторая строка с дополнительными характеристиками');
    await first.locator('.col-country').fill('Китай');
    await first.locator('.col-qty').fill('2');
    await first.locator('.col-price').fill('12000');

    for (let i = 1; i <= (scenario.extraRows || 0); i++) {
      await page.locator('#btnAddRow').click();
      const row = page.locator('#tableBody tr').last();
      await row.locator('.col-name').fill('Дополнительное оборудование ' + i);
      await row.locator('.col-desc').fill(
        'Описание технических параметров, комплектации и гарантийных условий. '.repeat(3)
      );
      await row.locator('.col-country').fill('Россия');
      await row.locator('.col-qty').fill('1');
      await row.locator('.col-price').fill('1000');
    }

    const total = Number((await page.locator('#grandTotal').innerText())
      .replace(/\s/g, '').replace(',', '.'));
    assert.equal(total, 24000 + (scenario.extraRows || 0) * 1000,
      'Incorrect proposal total before DOCX export');

    const downloadEvent = page.waitForEvent('download', { timeout: 60000 });
    await page.locator('#btnExportWord').click();
    const download = await downloadEvent;
    assert(download.suggestedFilename().toLowerCase().endsWith('.docx'),
      'Unexpected downloaded file: ' + download.suggestedFilename());
    const failure = await download.failure();
    assert.equal(failure, null, 'DOCX download failed: ' + failure);

    const output = path.join(OUTPUT, scenario.filename);
    await download.saveAs(output);
    const buffer = fs.readFileSync(output);
    assert.equal(buffer.subarray(0, 2).toString('ascii'), 'PK', 'DOCX is not a ZIP');
    assert(buffer.length > 4000, 'DOCX too small: ' + scenario.filename);
    assert.deepEqual(errors, [], 'Browser errors: ' + errors.join('; '));
    assert.deepEqual(alerts, [], 'Export warnings: ' + alerts.join('; '));
    console.log('Created ' + output + ' (' + buffer.length + ' bytes)');
  } finally {
    await context.close();
  }
}

async function main() {
  const keys = process.argv.slice(2);
  if (keys.some(key => !SCENARIOS.some(s => s.key === key))) {
    throw new Error('Choose: ooo, ip, ip-glazyrin, long (or omit for all)');
  }
  const chosen = keys.length ? SCENARIOS.filter(s => keys.includes(s.key)) : SCENARIOS;
  for (const vendor of VENDORS) {
    const file = path.join(ROOT, vendor.file);
    assert(fs.existsSync(file), 'Missing ' + vendor.file + '. Install pinned test dependencies.');
  }
  fs.mkdirSync(OUTPUT, { recursive: true });
  const server = serverFactory();
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    browser = await chromium.launch({ headless: true });
    for (const scenario of chosen) await generateWord(browser, url, scenario);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
