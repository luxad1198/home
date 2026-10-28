// Focused Chromium checks for editing start position, non-scrolling add, and row counter.
'use strict';
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DEST = path.join(ROOT, 'artifacts', 'editor-viewport');
fs.mkdirSync(DEST, { recursive: true });
let server, browser, url;

async function pageFor(viewport) {
  const context = await browser.newContext({ viewport, locale: 'ru-RU' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(12000);
  // DOCX CDN libraries are irrelevant for these screen-only interactions.
  await page.route('https://**/*', route => route.abort());
  await page.goto(url, {waitUntil:'load'});
  await page.waitForFunction(() =>
    Math.abs(document.querySelector('.page').getBoundingClientRect().top - 8) <= 3);
  return { page, context, errors };
}

before(async () => {
  server = http.createServer((req, res) => {
    const name = new URL(req.url || '/', 'http://127.0.0.1').pathname.slice(1) || 'index.html';
    if (!/^(index\.html|app\.js|style\.css|[\w-]+\.webp)$/.test(name)) {
      res.writeHead(404).end(); return;
    }
    fs.readFile(path.join(ROOT, name), (error, content) => {
      if (error) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': {
        '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
        '.webp':'image/webp'
      }[path.extname(name)] });
      res.end(content);
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  url = 'http://127.0.0.1:' + server.address().port + '/';
  browser = await chromium.launch({ headless:true });
});
after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

for (const company of ['ooo','ip','ip-glazyrin']) {
  test('editor: opens at A4 and add does not scroll (' + company + ')', async () => {
    const {page, context, errors} = await pageFor({ width:1530, height:950 });
    try {
      assert.equal(await page.locator('#positionCount').innerText(), 'Позиций: 1');
      const top = await page.locator('.panel').evaluate(el=>el.getBoundingClientRect().top);
      assert(top < 0, 'Toolbar must start above the visible sheet');
      await page.locator('#companySelect').selectOption(company);
      await page.locator('#tableBody .col-desc').first().fill(('Длинное описание оборудования\n').repeat(90));
      await page.locator('#btnAddRow').scrollIntoViewIfNeeded();
      const add = page.locator('#btnAddRow');
      const initialY = await page.evaluate(() => window.scrollY);
      for(let i=2; i<=8; i++){
        await add.click();
        assert.equal(await page.locator('#tableBody tr').count(), i);
        assert.equal(await page.locator('#positionCount').innerText(), 'Позиций: '+i);
        const currentY = await page.evaluate(() => window.scrollY);
        assert(Math.abs(currentY - initialY) < 3,
          'Clicking Add caused unexpected scroll to new row: '+initialY+' -> '+currentY);
        const activeNew = await page.evaluate(() =>
          document.activeElement === document.querySelector('#tableBody tr:last-child .col-name'));
        assert.equal(activeNew, false, 'Add focused a far-away text field');
      }
      await page.screenshot({path:path.join(DEST, company+'-long-description-toolbar.png')});
      await page.locator('#tableBody tr').last().locator('.btn-del').click();
      assert.equal(await page.locator('#positionCount').innerText(), 'Позиций: 7');
      await page.reload({waitUntil:'load'});
      await page.waitForFunction(() =>
        Math.abs(document.querySelector('.page').getBoundingClientRect().top - 8) <= 3);
      assert.equal(await page.locator('#positionCount').innerText(), 'Позиций: 7',
        'Restored rows must update toolbar count');
      // Clear is permitted only after confirmation; remaining blank row still counts as one.
      page.once('dialog', d => d.accept());
      await page.locator('#btnClearForm').click();
      assert.equal(await page.locator('#positionCount').innerText(), 'Позиций: 1');
      assert.deepEqual(errors, [], 'Browser script errors');
    } finally {
      await context.close();
    }
  });
}

test('editor: narrow viewport starts at A4 and toolbar/counter remain usable', async () => {
  const {page, context, errors} = await pageFor({width:600,height:850});
  try{
    assert.equal(await page.locator('#positionCount').innerText(), 'Позиций: 1');
    assert(await page.locator('.panel').evaluate(el => el.getBoundingClientRect().bottom < 0),
      'Toolbar should be initially outside visible viewport on mobile');
    // The calculator is floating. Close it to expose the toolbar for clicking.
    await page.locator('#btnCloseCalc').click();
    await page.locator('#btnAddRow').click();
    assert.equal(await page.locator('#positionCount').innerText(), 'Позиций: 2');
    await page.screenshot({path:path.join(DEST,'mobile-after-add.png')});
    assert.deepEqual(errors, [], 'Browser script errors');
  } finally {
    await context.close();
  }
});
