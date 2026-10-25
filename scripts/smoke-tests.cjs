// Базовые функциональные проверки КП. Запуск: node --test scripts/smoke-tests.cjs
// Зависимость: npm install --no-save --package-lock=false playwright@1.56.1
//             npx playwright install chromium
'use strict';

const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp'
};

let server;
let browser;
let baseURL;

function amount(text) {
  const value = Number(String(text).replace(/[\s\u00a0\u202f₽]/g, '').replace(',', '.'));
  assert(Number.isFinite(value), 'Некорректная сумма: ' + text);
  return value;
}

async function money(page, selector) {
  return amount(await page.locator(selector).innerText());
}

async function withCleanPage(check) {
  // Каждая проверка получает новый профиль браузера и пустой localStorage.
  const context = await browser.newContext({ locale: 'ru-RU' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Проверки основных функций не должны зависеть от доступности CDN для Word.
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => {
    window.__printCalls = 0;
    window.print = () => { window.__printCalls += 1; };
  });

  try {
    const response = await page.goto(baseURL, { waitUntil: 'load' });
    assert(response && response.ok(), 'Не загрузилась локальная версия сайта');
    assert.equal(await page.locator('#companySelect').count(), 1, 'Основной интерфейс не инициализирован');
    await check(page);
    assert.deepEqual(errors, [], 'Ошибки JavaScript: ' + errors.join('; '));
  } finally {
    await context.close();
  }
}

before(async () => {
  // Небольшой локальный HTTP-сервер вместо публикации тестового сайта.
  server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const name = decodeURIComponent(url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
    if (!/^(index\.html|app\.js|style\.css|[a-zA-Z0-9_-]+\.webp)$/.test(name)) {
      res.writeHead(404).end('Not found');
      return;
    }
    fs.readFile(path.join(ROOT, name), (error, bytes) => {
      if (error) {
        res.writeHead(404).end('Not found');
        return;
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(name)] });
      res.end(bytes);
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseURL = 'http://127.0.0.1:' + server.address().port + '/';
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

test('ui: Приложение открывается: ООО, одна позиция, нулевой итог', async () => {
  await withCleanPage(async page => {
    assert.equal(await page.locator('#companySelect').inputValue(), 'ooo');
    assert.equal(await page.locator('#tableBody tr').count(), 1);
    assert.equal(await money(page, '#grandTotal'), 0);
    assert(await page.locator('#btnPrint').isVisible());
  });
});

test('ui: Переключение трёх компаний меняет шапку, подпись и налоговые надписи', async () => {
  await withCleanPage(async page => {
    const cases = [
      { id: 'ooo', person: 'Марков Д.Е.', price: 'НДС 22%', vat: '22%', isIp: false },
      { id: 'ip', person: 'Захаров М.С.', price: 'НДС 5%', vat: '5%', isIp: true },
      { id: 'ip-glazyrin', person: 'Глазырин А.А.', price: 'без НДС', vat: 'не начисляется', isIp: true }
    ];
    for (const item of cases) {
      await page.locator('#companySelect').selectOption(item.id);
      assert.equal((await page.locator('#signPersonName').innerText()).trim(), item.person);
      assert((await page.locator('#thPriceCol').innerText()).includes(item.price));
      assert((await page.locator('#lblVatType').innerText()).includes(item.vat));
      assert.equal(await page.locator('#headIp').isVisible(), item.isIp);
      assert.equal(await page.locator('#headOoo').isVisible(), !item.isIp);
    }
  });
});

for (const company of [
  { id: 'ooo', vat: 'НДС 22%' },
  { id: 'ip', vat: 'НДС 5%' },
  { id: 'ip-glazyrin', vat: 'НДС не облагается' }
]) {
  test('spec: Спецификация и сумма прописью: ' + company.id, async () => {
    await withCleanPage(async page => {
      await page.locator('#companySelect').selectOption(company.id);
      const first = page.locator('#tableBody tr').first();
      await first.locator('.col-name').fill('Тестовое оборудование');
      await first.locator('.col-qty').fill('3');
      await first.locator('.col-price').fill('1250,50');
      assert.equal(await money(page, '#tableBody tr:first-child .col-total'), 3751.5);

      await page.locator('#btnAddRow').click();
      const second = page.locator('#tableBody tr').last();
      await second.locator('.col-name').fill('Дополнительная позиция');
      await second.locator('.col-qty').fill('2');
      await second.locator('.col-price').fill('100,25');
      assert.equal(await money(page, '#tableBody tr:last-child .col-total'), 200.5);
      assert.equal(await money(page, '#grandTotal'), 3952);
      assert((await page.locator('#textTotalBlock').innerText()).includes(company.vat));
    });
  });
}

test('equipment: Добавление и удаление позиций: перенумерация и сохранение последней строки', async () => {
  await withCleanPage(async page => {
    const rows = page.locator('#tableBody tr');
    await rows.first().locator('.col-name').fill('Первая позиция');
    await page.locator('#btnAddRow').click();
    await rows.last().locator('.col-name').fill('Вторая позиция');
    assert.equal(await rows.count(), 2);
    await rows.first().locator('.btn-del').click();
    assert.equal(await rows.count(), 1);
    assert.equal((await rows.first().locator('.row-idx').innerText()).trim(), '1');
    assert.equal(await rows.first().locator('.col-name').inputValue(), 'Вторая позиция');

    await rows.first().locator('.btn-del').click();
    assert.equal(await rows.count(), 1, 'Последняя строка должна очищаться, а не удаляться');
    assert.equal(await rows.first().locator('.col-name').inputValue(), '');
    assert.equal(await money(page, '#grandTotal'), 0);
  });
});

test('validation: Неверные количество/цена блокируют печать, исправление разрешает её', async () => {
  await withCleanPage(async page => {
    const row = page.locator('#tableBody tr').first();
    await row.locator('.col-name').fill('Проверка печатного зеркала');
    await row.locator('.col-qty').fill('0');
    assert.equal(await row.locator('.col-qty').getAttribute('aria-invalid'), 'true');
    assert.equal((await page.locator('#grandTotal').innerText()).trim(), '—');
    await page.locator('#btnPrint').click();
    assert.equal(await page.evaluate(() => window.__printCalls), 0);

    await row.locator('.col-qty').fill('2');
    await row.locator('.col-price').fill('12,345');
    assert.equal(await row.locator('.col-price').getAttribute('aria-invalid'), 'true');
    await page.locator('#btnPrint').click();
    assert.equal(await page.evaluate(() => window.__printCalls), 0);

    await row.locator('.col-price').fill('12,30');
    assert.equal(await money(page, '#grandTotal'), 24.6);
    await page.locator('#btnPrint').click();
    assert.equal(await page.evaluate(() => window.__printCalls), 1);
    assert.equal(
      await row.locator('.print-text-mirror').first().textContent(),
      'Проверка печатного зеркала'
    );
  });
});

test('storage: localStorage восстанавливает компанию, клиента, позиции и итог после обновления', async () => {
  await withCleanPage(async page => {
    await page.locator('#companySelect').selectOption('ip-glazyrin');
    await page.locator('#clientBoxIp').fill('Тестовый заказчик');
    const row = page.locator('#tableBody tr').first();
    await row.locator('.col-name').fill('Сервер для сохранения');
    await row.locator('.col-qty').fill('4');
    await row.locator('.col-price').fill('42,50');
    assert.equal(await money(page, '#grandTotal'), 170);
    await page.reload({ waitUntil: 'load' });

    assert.equal(await page.locator('#companySelect').inputValue(), 'ip-glazyrin');
    assert.equal(await page.locator('#clientBoxIp').inputValue(), 'Тестовый заказчик');
    assert.equal(await page.locator('#tableBody tr').count(), 1);
    assert.equal(await page.locator('#tableBody .col-name').inputValue(), 'Сервер для сохранения');
    assert.equal(await page.locator('#tableBody .col-qty').inputValue(), '4');
    assert.equal(await money(page, '#grandTotal'), 170);
  });
});

for (const company of ['ooo', 'ip', 'ip-glazyrin']) {
  test('calculator: Калькулятор: финансовый итог для ' + company, async () => {
    await withCleanPage(async page => {
      await page.locator('#companySelect').selectOption(company);
      await page.locator('#calcCostVat').fill('12200');
      await page.locator('#calcProfitTarget').fill('1500');
      const expected = company === 'ooo'
        ? 14640
        : company === 'ip'
          ? 13700 / (1 - 5 / 105 - 0.07)
          : 13700 / 0.95;
      const actual = Number(await page.locator('#resSaleVat').getAttribute('data-val'));
      assert(Number.isFinite(actual), 'Калькулятор не вернул числовой результат');
      assert(Math.abs(actual - expected) < 0.02,
        'Неверная цена для ' + company + ': ' + actual + ' вместо ' + expected);
      assert.equal(await money(page, '#resNetProfit'), 1500);
    });
  });
}

test('calculator: Калькулятор сообщает о некорректных финансовых данных', async () => {
  await withCleanPage(async page => {
    await page.locator('#calcCostVat').fill('-100');
    assert.equal(await page.locator('#calcCostVat').getAttribute('aria-invalid'), 'true');
    assert.equal((await page.locator('#resSaleVat').innerText()).trim(), '—');
    await page.locator('#calcCostVat').fill('100');
    assert.notEqual((await page.locator('#resSaleVat').innerText()).trim(), '—');
  });
});
