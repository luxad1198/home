// Генерация тестовых PDF через Chromium без системного окна печати.
// Запуск: npm install --no-save --package-lock=false playwright@1.56.1
//        python3 -m http.server 8765 --bind 127.0.0.1
//        node scripts/generate-print-pdfs.cjs [ooo|ip|ip-glazyrin|long]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE_URL = process.env.PRINT_TEST_URL || 'http://127.0.0.1:8765/';
const OUTPUT_DIR = path.join(process.cwd(), 'artifacts', 'print-pdf');
const CASES = [
  { key: 'ooo', company: 'ooo', filename: 'rtstandard.pdf', marker: 'RTPDF01' },
  { key: 'ip', company: 'ip', filename: 'zakharov.pdf', marker: 'ZKPDF02' },
  { key: 'ip-glazyrin', company: 'ip-glazyrin', filename: 'glazyrin.pdf', marker: 'GLPDF03' },
  { key: 'long', company: 'ooo', filename: 'rtstandard-multipage.pdf', marker: 'RTPDF04', extraRows: 18 }
];

async function generatePdf(browser, scenario) {
  // Отдельный контекст: тесты не используют и не изменяют пользовательский localStorage.
  const context = await browser.newContext({ locale: 'ru-RU' });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  const scriptErrors = [];
  page.on('pageerror', error => scriptErrors.push(error.message));

  // Для формирования печатной версии внешние библиотеки Word/импорта не нужны.
  // Это исключает зависимость PDF-теста от доступности сторонних CDN.
  await page.route('https://**/*', route => route.abort());

  // Реальный обработчик btnPrint выполнит валидацию и подготовку DOM,
  // но системный диалог не откроется.
  await page.addInitScript(() => {
    window.__pdfPrintRequested = false;
    window.print = () => { window.__pdfPrintRequested = true; };
  });

  try {
    const response = await page.goto(BASE_URL, { waitUntil: 'load', timeout: 30000 });
    assert(response && response.ok(), 'Сайт не загрузился: ' + BASE_URL);
    await page.locator('#companySelect').selectOption(scenario.company);
    // Use the same fixture data as the Word-export scenario for fair comparison.
    const isIp = scenario.company !== 'ooo';
    await page.locator(isIp ? '#clientBoxIp' : '#clientBox').fill('Тестовый заказчик');
    await page.locator(isIp ? '#kpNumInputIp' : '#kpNumInput').fill(scenario.key === 'ooo' ? 'TEST-DOCX' : 'Q7');
    if (!isIp) {
      await page.locator('#condOooPay').fill('Тестовая оплата 30 дней');
    } else if (scenario.company === 'ip') {
      await page.locator('#ipDeliveryTime + .ip-standard-value-editor')
        .fill('Тестовый срок 14 дней');
    } else {
      await page.locator('#ipDeliveryTime').fill('Тестовый срок 14 дней');
    }

    const firstRow = page.locator('#tableBody tr').first();
    await firstRow.locator('.col-name').fill(scenario.marker + ' Тестовое оборудование');
    await firstRow.locator('.col-desc').fill('Процессор и память\nВторая строка с дополнительными характеристиками');
    await firstRow.locator('.col-country').fill('Китай');
    await firstRow.locator('.col-qty').fill('2');
    await firstRow.locator('.col-price').fill('12000');

    const extraRows = scenario.extraRows || 0;
    for (let i = 1; i <= extraRows; i++) {
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

    // Проверяем реальный итог до печати, а не только факт создания файла.
    const actualTotal = await page.locator('#grandTotal').innerText();
    const amount = Number(actualTotal.replace(/\s/g, '').replace(',', '.'));
    assert.equal(amount, 24000 + extraRows * 1000, 'Неверный итог в сценарии ' + scenario.filename);

    // Имитируем пользовательское нажатие, чтобы выполнился prepareAndPrint().
    await page.locator('#btnPrint').click();
    assert.equal(
      await page.evaluate(() => window.__pdfPrintRequested),
      true,
      'Приложение не вызвало window.print(): ' + scenario.filename
    );
    assert.deepEqual(scriptErrors, [], 'Ошибки JavaScript: ' + scriptErrors.join('; '));

    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: 'print' });
    if (scenario.key === 'ooo') {
      const number = await page.locator('#kpNumPrint').evaluate(element => ({
        content: element.textContent,
        visible: getComputedStyle(element).display !== 'none'
      }));
      assert(number.visible && number.content === 'TEST-DOCX',
        'The full customer-facing proposal number must be present in print: ' +
          JSON.stringify(number));
    }
    if (scenario.company === 'ooo' || scenario.company === 'ip') {
      const selector = scenario.company === 'ooo' ? '#clientContainerOoo' : '#clientContainerIp';
      const layout = await page.locator(selector).evaluate(container => {
        const label = container.querySelector('.client-label');
        const mirror = container.querySelector('.client-print-value');
        const textarea = container.querySelector('.client-textarea');
        const a = label.getBoundingClientRect(), b = mirror.getBoundingClientRect();
        const maxHeight = Number.parseFloat(getComputedStyle(mirror).lineHeight) || 18;
        return {
          labelBottom: a.bottom, valueBottom: b.bottom,
          labelRight: a.right, valueLeft: b.left,
          height: b.height, maxHeight,
          value: mirror.textContent,
          mirrorVisible: getComputedStyle(mirror).display !== 'none',
          editorHidden: getComputedStyle(textarea).display === 'none'
        };
      });
      assert.equal(layout.value, 'Тестовый заказчик', 'Customer name not mirrored for PDF');
      assert(layout.mirrorVisible && layout.editorHidden, 'Wrong print representation of customer');
      assert(Math.abs(layout.labelBottom - layout.valueBottom) <= 2,
        'Customer label/name are on different baselines: ' + JSON.stringify(layout));
      assert(layout.valueLeft >= layout.labelRight, 'Customer name overlaps label');
      assert(layout.height <= layout.maxHeight + 2,
        'Short customer name wrapped onto another line: ' + JSON.stringify(layout));
    }
    const dest = path.join(OUTPUT_DIR, scenario.filename);
    const pdf = await page.pdf({
      path: dest,
      preferCSSPageSize: true,
      printBackground: true
    });
    assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-', 'Неверный формат PDF');
    assert(pdf.length > 4000, 'Слишком маленький PDF: ' + dest);
    console.log('Created ' + dest + ' (' + pdf.length + ' bytes)');
  } finally {
    await context.close();
  }
}

async function main() {
  const keys = process.argv.slice(2);
  if (keys.some(key => !CASES.some(scenario => scenario.key === key))) {
    throw new Error('Choose: ooo, ip, ip-glazyrin, long (or omit for all)');
  }
  const selected = keys.length ? CASES.filter(scenario => keys.includes(scenario.key)) : CASES;
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  // A failed run must never leave an older PDF looking freshly verified.
  for (const scenario of selected) {
    fs.rmSync(path.join(OUTPUT_DIR, scenario.filename), { force: true });
  }
  const browser = await chromium.launch({ headless: true });
  try {
    for (const scenario of selected) await generatePdf(browser, scenario);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
