// Shared export fixture: custom conditions must survive editing, deletion,
// company-specific numbering and page reload before any Word/PDF export.
'use strict';

const assert = require('node:assert/strict');

const CONDITIONS = {
  ooo: [
    { label: 'Приёмка', value: 'Проверка серийных номеров и комплектности.\nПри расхождениях оформляется акт.' },
    { label: 'Уведомление', value: 'Уведомить заказчика не позднее двух рабочих дней.' }
  ],
  ip: [
    { label: 'Документы:', value: 'УПД и счёт передаются по электронной почте.\nОригиналы направляются отдельным письмом.' },
    { label: 'Срок ответа', value: 'На обращение отвечают в течение трёх рабочих дней.' }
  ],
  'ip-glazyrin': [
    { section: '2', label: 'Разгрузка', value: 'Разгрузка оборудования по согласованному графику.\nОтветственное лицо встречает транспорт.' },
    { section: '3', label: 'Поддержка', value: 'Консультации по оборудованию в течение трёх рабочих дней.' }
  ]
};

function listSelector(company, item) {
  if (company === 'ooo') return '#condOooTbody tr.custom-cond-row';
  if (company === 'ip-glazyrin' && item?.section === '2') {
    return '#condIpCustomList2 .ip-custom-cond-row';
  }
  return '#condIpCustomList .ip-custom-cond-row';
}

async function addCondition(page, company, item) {
  const button = company === 'ip-glazyrin'
    ? (item.section === '2' ? '#btnAddCondIp2' : '#btnAddCondIp3')
    : '#btnAddCondRow';
  await page.locator(button).click();
  const row = page.locator(listSelector(company, item)).last();
  if (company === 'ooo') {
    await row.locator('.cond-lbl-input').fill(item.label);
    await row.locator('.cond-val').fill(item.value);
  } else {
    await row.locator('.ip-cond-lbl-input').fill(item.label);
    if (company === 'ip') {
      // Zakharov edits a visible contenteditable, not the hidden textarea.
      await row.locator('.ip-cond-value-editor').fill(item.value);
    } else {
      await row.locator('.ip-cond-val-input').fill(item.value);
    }
  }
}

async function assertConditions(page, company) {
  for (const item of CONDITIONS[company]) {
    const selector = listSelector(company, item);
    const rows = page.locator(selector);
    assert.equal(await rows.count(),
      CONDITIONS[company].filter(x => listSelector(company, x) === selector).length,
      'Unexpected number of saved conditions in ' + selector);
    // Find by value rather than assuming order between the two sections.
    const labels = await rows.locator(
      company === 'ooo' ? '.cond-lbl-input' : '.ip-cond-lbl-input'
    ).evaluateAll(elements => elements.map(el => el.value));
    const idx = labels.indexOf(item.label);
    assert(idx >= 0, 'Lost condition label ' + item.label);
    const conditionRow = rows.nth(idx);
    const value = await conditionRow.locator(company === 'ooo' ? '.cond-val' : '.ip-cond-val-input').inputValue();
    assert.equal(value, item.value, 'Lost multi-line condition content for ' + item.label);
    if (company === 'ip') {
      assert.equal((await conditionRow.locator('.ip-cond-label-separator').innerText()).trim(),
        item.label.endsWith(':') ? '' : ':',
        'Extra colon after custom condition label');
    }
  }
  if (company === 'ip-glazyrin') {
    const second = page.locator('#condIpCustomList2 .ip-custom-cond-row .ip-cond-number');
    const third = page.locator('#condIpCustomList .ip-custom-cond-row .ip-cond-number');
    assert.equal((await second.innerText()).trim(), '2.4.');
    // One standard section 3 item was deleted; numbers must reflow.
    assert.equal((await third.innerText()).trim(), '3.4.');
    assert(await page.locator('#ipServiceTerms').evaluate(el =>
      el.closest('.ip-term-row').classList.contains('is-deleted')));
  }
}

async function prepareCustomConditions(page, company) {
  const fixture = CONDITIONS[company];
  if (!fixture) throw new Error('Unknown company ' + company);
  for (const item of fixture) await addCondition(page, company, item);

  // Remove a condition that must NOT return after a reload or export.
  await addCondition(page, company, {
    section: '3', label: 'Удалённый пункт', value: 'Этого текста не должно быть'
  });
  await page.locator(listSelector(company, { section: '3' })).last()
    .locator(company === 'ooo' ? '.btn-del-cond' : '.btn-del-ip-cond').click();

  if (company === 'ip-glazyrin') {
    await page.locator('#ipServiceTerms').locator('..').locator('.ip-standard-delete').click();
  }

  await page.reload({ waitUntil: 'load' });
  assert.equal(await page.locator('#companySelect').inputValue(), company);
  await assertConditions(page, company);
}

module.exports = { CONDITIONS, prepareCustomConditions };
