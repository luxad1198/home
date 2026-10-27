// Focused real-browser DOCX equipment import regressions.
// node scripts/import-docx-tests.cjs append replace cancel invalid undo roundtrip
// With no args: append, replace, cancel, invalid, undo. "roundtrip" is opt-in.
'use strict';

const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const JSZip = require('jszip');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_CASES = ['append', 'replace', 'cancel', 'invalid', 'undo', 'technical'];
const CASES = [...DEFAULT_CASES, 'roundtrip'];
const args = process.argv.slice(2);
if (args.some(k => !CASES.includes(k))) {
  throw new Error('Choose: ' + CASES.join(', ') + ' (no argument: basic import only)');
}
const selected = args.length ? [...new Set(args)] : DEFAULT_CASES;
const vendors = [
  { match: /cdn\.jsdelivr\.net\/npm\/docx@8\.5\.0\/build\/index\.umd\.js/, file: 'node_modules/docx/build/index.umd.js' },
  { match: /cdnjs\.cloudflare\.com\/ajax\/libs\/FileSaver\.js\/2\.0\.5\/FileSaver\.min\.js/, file: 'node_modules/file-saver/dist/FileSaver.min.js' },
  { match: /cdn\.jsdelivr\.net\/npm\/jszip@3\.10\.1\/dist\/jszip\.min\.js/, file: 'node_modules/jszip/dist/jszip.min.js' }
];
let server, browser, url;

function xmlEscape(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function cell(value) {
  const body = String(value).split('\n').map((part, i) =>
    (i ? '<w:br/>' : '') + '<w:t xml:space="preserve">' + xmlEscape(part) + '</w:t>'
  ).join('');
  return '<w:tc><w:p><w:r>' + body + '</w:r></w:p></w:tc>';
}
function row(values) {
  return '<w:tr>' + values.map(cell).join('') + '</w:tr>';
}
async function fixtureDocx({ badQty, badPrice, noTable, technicalDetails } = {}) {
  const zip = new JSZip();
  const productRows = [
    ['1', 'Импортный сервер', 'Процессор и ОЗУ\nДве строки описания', 'Россия',
      '2', '1 250,50', '2 501,00'],
    // Deliberately make the SECOND position invalid: the parser must not
    // commit any rows after successfully reading the first valid position.
    ['2', 'Импортный коммутатор', 'Порты Ethernet', 'Китай',
      badQty ? '0' : '1', badPrice ? 'Н/Д' : '200,00', '200,00']
  ];
  // Five-column Word tables may include «Количество» and «оборудованием»
  // inside LONG characteristic cells. Those must never become a new header.
  const technicalRows = [
    ['1', 'МФУ Pantum BM4311ADW', 'Возможность печати: Да\nКоличество картриджей: 2 шт\nКомплект поставляется с оборудованием: Да', 'Китай', '4'],
    ['2', 'Принтер Kyocera ECOSYS PA4000x', 'Количество страниц в месяц: 80000 шт\nКабель поставляется с оборудованием: Да', 'Вьетнам', '3'],
    ['3', 'МФУ Canon i-SENSYS MF752Cdw', 'Количество картриджей, поставляемых с оборудованием: 2 шт\nВозможность сканирования: Да', 'Вьетнам', '2'],
    ['4', 'Сканер Avision AD340GFN', 'Тип сканирования: Протяжный и планшетный\nИнтерфейс подключения: USB', 'Китай', '2']
  ];
  const table = noTable ? '<w:p><w:r><w:t>Произвольный документ без оборудования</w:t></w:r></w:p>'
    : technicalDetails ? '<w:tbl>' +
      row(['№', 'Наименование товара', 'Основные характеристики предложенного товара и прочие условия', 'Страна', 'Количество, шт.']) +
      technicalRows.map(row).join('') + '</w:tbl>'
    : '<w:tbl>' + row(['№', 'Наименование', 'Характеристики', 'Страна', 'Количество', 'Цена за ед.', 'Сумма']) +
      productRows.map(row).join('') +
      row(['ИТОГО:', '', '', '', '', '', '2 701,00']) + '</w:tbl>';
  const document = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:body>' + table + '<w:sectPr/></w:body></w:document>';
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>');
  zip.file('word/document.xml', document);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

async function withPage(check) {
  const context = await browser.newContext({ locale: 'ru-RU', acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://**/*', route => {
    const vendor = vendors.find(v => v.match.test(route.request().url()));
    return vendor
      ? route.fulfill({ path: path.join(ROOT, vendor.file), contentType: 'application/javascript' })
      : route.abort();
  });
  try {
    const response = await page.goto(url, { waitUntil: 'load' });
    assert(response?.ok(), 'Unable to load local app');
    assert(await page.evaluate(() => !!window.JSZip?.loadAsync), 'Word reader JSZip is unavailable');
    await check(page);
    assert.deepEqual(errors, [], 'Browser JS errors: ' + errors.join('; '));
  } finally {
    await context.close();
  }
}

async function startingEquipment(page) {
  const row = page.locator('#tableBody tr').first();
  await row.locator('.col-name').fill('Существующий сервер');
  await row.locator('.col-desc').fill('Исходная комплектация');
  await row.locator('.col-country').fill('Россия');
  await row.locator('.col-qty').fill('3');
  await row.locator('.col-price').fill('100');
  assert.equal(await row.locator('.col-price').getAttribute('data-raw'), '100');
  await checkTable(page, [
    { name: 'Существующий сервер', desc: 'Исходная комплектация',
      country: 'Россия', qty: 3, price: 100 }
  ], 300);
}
function numeric(s) {
  return Number(String(s).replace(/[\s\u00a0\u202f₽]/g, '').replace(',', '.'));
}
async function checkTable(page, expectedRows, expectedTotal) {
  const rows = page.locator('#tableBody tr');
  assert.equal(await rows.count(), expectedRows.length, 'Equipment row count changed');
  for (let i = 0; i < expectedRows.length; i++) {
    const row = rows.nth(i);
    const expected = expectedRows[i];
    assert.equal(await row.locator('.col-name').inputValue(), expected.name);
    assert.equal(await row.locator('.col-desc').inputValue(), expected.desc,
      'Description changed in equipment row ' + (i + 1));
    assert.equal(await row.locator('.col-country').inputValue(), expected.country,
      'Country changed in equipment row ' + (i + 1));
    assert.equal(Number(await row.locator('.col-qty').inputValue()), expected.qty);
    assert.equal(numeric(await row.locator('.col-price').getAttribute('data-raw')), expected.price);
    assert.equal(numeric(await row.locator('.col-total').innerText()),
      Number((expected.qty * expected.price).toFixed(2)),
      'Wrong row total in equipment row ' + (i + 1));
    assert.equal((await row.locator('.row-idx').innerText()).trim(), String(i + 1));
  }
  assert.equal(numeric(await page.locator('#grandTotal').innerText()), expectedTotal);
}
const original = { name: 'Существующий сервер', desc: 'Исходная комплектация',
  country: 'Россия', qty: 3, price: 100 };
const imported = [
  { name: 'Импортный сервер', desc: 'Процессор и ОЗУ\nДве строки описания',
    country: 'Россия', qty: 2, price: 1250.5 },
  { name: 'Импортный коммутатор', desc: 'Порты Ethernet',
    country: 'Китай', qty: 1, price: 200 }
];

async function selectDocx(page, buffer, name = 'equipment.docx') {
  await page.locator('#equipmentFile').setInputFiles({
    name, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer
  });
  await page.waitForFunction(() => document.getElementById('equipmentImportDialog').open);
}
async function loaded(page) {
  await page.waitForFunction(() =>
    document.getElementById('equipmentImportStatus').textContent.includes('Найдено позиций: 2')
  );
  assert.equal(await page.locator('#equipmentImportPreview tr').count(), 2);
  assert(await page.locator('#equipmentImportApply').isEnabled());
  assert.equal(await page.locator('#equipmentImportMode').inputValue(), 'append');
}
async function chooseAndApply(page, mode = 'append') {
  await page.locator('#equipmentImportMode').selectOption(mode);
  await page.locator('#equipmentImportApply').click();
  assert.equal(await page.locator('#equipmentImportDialog').evaluate(el => el.open), false);
}

before(async () => {
  for (const vendor of vendors) {
    assert(fs.existsSync(path.join(ROOT, vendor.file)), 'Test dependency missing: ' + vendor.file);
  }
  server = http.createServer((request, response) => {
    const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
    const file = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!/^(index\.html|app\.js|style\.css|[\w-]+\.webp)$/.test(file)) {
      response.writeHead(404).end('Not found'); return;
    }
    fs.readFile(path.join(ROOT, file), (err, content) => {
      if (err) return response.writeHead(404).end('Not found');
      const mime = file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript'
        : file.endsWith('.html') ? 'text/html' : 'image/webp';
      response.writeHead(200, { 'content-type': mime + '; charset=utf-8' });
      response.end(content);
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  url = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true });
});
after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

if (selected.includes('append')) test('import: append keeps existing row and sums imported rows', async () => {
  await withPage(async page => {
    await startingEquipment(page);
    await selectDocx(page, await fixtureDocx());
    await loaded(page);
    await chooseAndApply(page, 'append');
    await checkTable(page, [original, ...imported], 3001);
    assert.equal(await page.locator('#tableBody tr').nth(1).locator('.col-desc').inputValue(),
      'Процессор и ОЗУ\nДве строки описания');
    await page.reload({ waitUntil: 'load' });
    await checkTable(page, [original, ...imported], 3001);
  });
});
if (selected.includes('replace')) test('import: replace removes old row, persists imported table', async () => {
  await withPage(async page => {
    await startingEquipment(page);
    await selectDocx(page, await fixtureDocx());
    await loaded(page);
    await chooseAndApply(page, 'replace');
    await checkTable(page, imported, 2701);
    await page.reload({ waitUntil: 'load' });
    await checkTable(page, imported, 2701);
  });
});
if (selected.includes('cancel')) test('import: cancel preview does not alter existing table', async () => {
  await withPage(async page => {
    await startingEquipment(page);
    await selectDocx(page, await fixtureDocx());
    await loaded(page);
    await page.locator('#equipmentImportCancel').click();
    assert.equal(await page.locator('#equipmentImportDialog').evaluate(el => el.open), false);
    await checkTable(page, [original], 300);
    await page.reload({ waitUntil: 'load' });
    await checkTable(page, [original], 300);
  });
});
if (selected.includes('invalid')) test('import: reject corrupt, unrelated and invalid-quantity documents without changing data', async () => {
  await withPage(async page => {
    await startingEquipment(page);
    const badFiles = [
      { name: 'corrupt.docx', bytes: Buffer.from('not a ZIP file'), message: 'Не удалось открыть файл' },
      { name: 'no-equipment.docx', bytes: await fixtureDocx({ noTable: true }), message: 'Таблица оборудования не найдена' },
      { name: 'bad-quantity.docx', bytes: await fixtureDocx({ badQty: true }), message: 'Проверьте количество' },
      { name: 'bad-price.docx', bytes: await fixtureDocx({ badPrice: true }), message: 'Не удалось распознать цену' }
    ];
    for (const failure of badFiles) {
      await selectDocx(page, failure.bytes, failure.name);
      await page.waitForFunction(msg =>
        document.getElementById('equipmentImportStatus').textContent.includes(msg),
        failure.message
      );
      assert(await page.locator('#equipmentImportApply').isDisabled());
      assert.equal(await page.locator('#equipmentImportPreview tr').count(), 0);
      await page.locator('#equipmentImportCancel').click();
      await checkTable(page, [original], 300);
      // Catch silent corruption of localStorage even when the visible table
      // looks unchanged immediately after the rejected file.
      await page.reload({ waitUntil: 'load' });
      await checkTable(page, [original], 300);
    }
  });
});
if (selected.includes('undo')) test('import: undo confirmation restores previous data, refusal keeps imported data', async () => {
  await withPage(async page => {
    await startingEquipment(page);
    await selectDocx(page, await fixtureDocx());
    await loaded(page);
    await chooseAndApply(page, 'replace');
    await checkTable(page, imported, 2701);
    assert(await page.locator('#btnUndoEquipmentImport').isVisible());
    page.once('dialog', d => void d.dismiss());
    await page.locator('#btnUndoEquipmentImport').click();
    await checkTable(page, imported, 2701);
    page.once('dialog', d => void d.accept());
    await page.locator('#btnUndoEquipmentImport').click();
    await checkTable(page, [original], 300);
    assert(await page.locator('#btnUndoEquipmentImport').isHidden());
    await page.reload({ waitUntil: 'load' });
    await checkTable(page, [original], 300);
  });
});
if (selected.includes('technical')) test('import: long characteristics do not override 5-column Word header', async () => {
  await withPage(async page => {
    await startingEquipment(page);
    await selectDocx(page, await fixtureDocx({ technicalDetails: true }), 'technical-5-columns.docx');
    await page.waitForFunction(() =>
      document.getElementById('equipmentImportStatus').textContent.includes('Найдено позиций: 4.'));
    assert.match(await page.locator('#equipmentImportStatus').innerText(), /Без цены: 4/);
    assert.equal(await page.locator('#equipmentImportPreview tr').count(), 4);
    const data = [
      { name: 'МФУ Pantum BM4311ADW',
        desc: 'Возможность печати: Да\nКоличество картриджей: 2 шт\nКомплект поставляется с оборудованием: Да',
        country: 'Китай', qty: 4, price: 0 },
      { name: 'Принтер Kyocera ECOSYS PA4000x',
        desc: 'Количество страниц в месяц: 80000 шт\nКабель поставляется с оборудованием: Да',
        country: 'Вьетнам', qty: 3, price: 0 },
      { name: 'МФУ Canon i-SENSYS MF752Cdw',
        desc: 'Количество картриджей, поставляемых с оборудованием: 2 шт\nВозможность сканирования: Да',
        country: 'Вьетнам', qty: 2, price: 0 },
      { name: 'Сканер Avision AD340GFN',
        desc: 'Тип сканирования: Протяжный и планшетный\nИнтерфейс подключения: USB',
        country: 'Китай', qty: 2, price: 0 }
    ];
    await chooseAndApply(page, 'replace');
    await checkTable(page, data, 0);
    await page.reload({ waitUntil: 'load' });
    await checkTable(page, data, 0);
    assert(await page.locator('#btnUndoEquipmentImport').isHidden(),
      'A page reload must not unexpectedly restore an old undo action');
  });
});

if (selected.includes('roundtrip')) test('import: reads real DOCX exported by the proposal app', async () => {
  await withPage(async page => {
    const row = page.locator('#tableBody tr').first();
    await row.locator('.col-name').fill('Экспортированный сервер');
    await row.locator('.col-desc').fill('Описание на двух\nстроках');
    await row.locator('.col-country').fill('Россия');
    await row.locator('.col-qty').fill('2');
    await row.locator('.col-price').fill('1250,50');
    await page.locator('#clientBox').fill('Тестовый заказчик');
    const downloadEvent = page.waitForEvent('download', { timeout: 60000 });
    await page.locator('#btnExportWord').click();
    const download = await downloadEvent;
    assert.equal(await download.failure(), null, 'The export failed');
    const bytes = fs.readFileSync(await download.path());

    // Replace a deliberately different current table with the DOCX's actual data.
    await row.locator('.col-name').fill('Перед импортом');
    await row.locator('.col-qty').fill('1');
    await row.locator('.col-price').fill('50');
    await selectDocx(page, bytes, 'own-export.docx');
    await page.waitForFunction(() =>
      document.getElementById('equipmentImportStatus').textContent.includes('Найдено позиций: 1'));
    await chooseAndApply(page, 'replace');
    await checkTable(page, [{ name: 'Экспортированный сервер',
      desc: 'Описание на двух\nстроках', country: 'Россия', qty: 2, price: 1250.5 }], 2501);
    assert.equal(await page.locator('#tableBody tr').first().locator('.col-desc').inputValue(),
      'Описание на двух\nстроках');
  });
});
