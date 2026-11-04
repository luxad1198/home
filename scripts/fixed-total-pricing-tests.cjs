// npm install --no-save --package-lock=false jsdom@26
// node scripts/fixed-total-pricing-tests.cjs
// Tests use isolated localStorage and the actual app.
const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const storageKey = 'rtstandard_calc_full_state_v2';

async function open(state) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
    url: 'http://localhost', runScripts: 'outside-only', pretendToBeVisual: true
  });
  const w = dom.window;
  const errors = []; w.addEventListener('error', event => errors.push(event.error));
  await new Promise(resolve => w.addEventListener('load', resolve));
  w.scrollTo = () => {}; w.alert = () => {}; w.confirm = () => true;
  if (state) w.localStorage.setItem(storageKey, state);
  w.eval(fs.readFileSync(path.join(root, 'app.js'), 'utf8'));
  w.dispatchEvent(new w.Event('DOMContentLoaded'));
  const d = w.document;
  const input = (el, value) => { el.value = value; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
  const rows = () => [...d.querySelectorAll('#tableBody tr')];
  const edit = (i, value) => {
    const el = rows()[i].querySelector('.col-price');
    el.dispatchEvent(new w.FocusEvent('focusin', { bubbles: true })); input(el, value);
    el.dispatchEvent(new w.FocusEvent('focusout', { bubbles: true }));
  };
  const close = async () => { await new Promise(resolve => setTimeout(resolve, 20)); assert.deepEqual(errors, []); dom.window.close(); };
  return { dom, w, d, input, rows, edit, close };
}

(async () => {
  for (const company of ['ooo', 'ip', 'ip-glazyrin']) {
    const a = await open(); const { d, w, input, rows, edit } = a;
    assert.equal(d.getElementById('pricingModeTools').hidden, true);
    d.getElementById('companySelect').value = company;
    d.getElementById('companySelect').dispatchEvent(new w.Event('change', { bubbles: true }));
    d.getElementById('btnAddRow').click();
    input(rows()[0].querySelector('.col-qty'), '2'); edit(0, '40000'); edit(1, '20000');
    d.getElementById('btnPricingMode').click();
    const target = d.querySelector('[data-pricing-index="0"]'); target.checked = true;
    target.dispatchEvent(new w.Event('change', { bubbles: true }));
    d.getElementById('btnFixPricingTotal').click();
    edit(1, '10000');
    assert.equal(rows()[0].querySelector('.col-price').dataset.raw, '45000');
    assert.equal(rows()[1].querySelector('.col-price').dataset.raw, '10000');
    assert.equal(d.querySelector('[data-pricing-index="1"]').disabled, true);
    assert.equal(rows()[1].querySelector('.col-price').readOnly, true);
    edit(1, '11000');
    assert.equal(rows()[1].querySelector('.col-price').dataset.raw, '10000');
    assert.match(d.getElementById('grandTotal').textContent.replace(/\s/g, ''), /^100000,00$/);
    edit(1, 'bad');
    assert.equal(rows()[1].querySelector('.col-price').dataset.raw, '10000');
    edit(0, 'bad');
    assert.equal(rows()[0].querySelector('.col-price').dataset.raw, '45000');
    const saved = w.localStorage.getItem(storageKey); await a.close();
    const restored = await open(saved);
    assert.equal(restored.d.getElementById('pricingModeTools').hidden, true);
    restored.d.getElementById('btnPricingMode').click();
    assert.match(restored.d.getElementById('fixedPricingStatus').textContent.replace(/\s/g, ''), /100000,00/);
    assert.equal(restored.d.querySelector('[data-pricing-index="1"]').disabled, true);
    assert.equal(restored.rows()[1].querySelector('.col-price').readOnly, true);
    restored.d.querySelector('[data-unlock-pricing="1"]').click();
    assert.equal(restored.rows()[1].querySelector('.col-price').readOnly, false);
    restored.edit(1, '11000');
    assert.equal(restored.rows()[1].querySelector('.col-price').dataset.raw, '11000');
    await restored.close();
    console.log('PASS fixed total, manual pin, invalid rollback, restore:', company);
  }
  const a = await open(); const { d, w, rows, edit, input } = a;
  d.getElementById('btnAddRow').click();
  input(rows()[0].querySelector('.col-qty'), '3'); edit(0, '30000'); edit(1, '10000');
  d.getElementById('btnPricingMode').click();
  const target = d.querySelector('[data-pricing-index="0"]'); target.checked = true;
  target.dispatchEvent(new w.Event('change', { bubbles: true }));
  d.getElementById('btnFixPricingTotal').click(); edit(1, '10000,01');
  assert.equal(rows()[1].querySelector('.col-price').dataset.raw, '10000');
  assert.equal(d.getElementById('btnAcceptPricingTotal').hidden, false);
  d.getElementById('btnCancelPricingTotal').click();
  assert.equal(rows()[1].querySelector('.col-price').dataset.raw, '10000');
  edit(1, '10000,01'); d.getElementById('btnAcceptPricingTotal').click();
  assert.equal(rows()[1].querySelector('.col-price').dataset.raw, '10000.01');
  assert.equal(d.getElementById('grandTotal').textContent.replace(/\s/g, ''), '100000,01');
  input(rows()[0].querySelector('.col-qty'), '4');
  assert.match(d.getElementById('fixedPricingStatus').textContent, /Зафиксируйте итог заново/);
  await a.close();
  console.log('PASS alternative total, cancel, accept, quantity reset');
  const multi = await open();
  multi.d.getElementById('btnAddRow').click(); multi.d.getElementById('btnAddRow').click();
  multi.input(multi.rows()[0].querySelector('.col-qty'), '2');
  multi.input(multi.rows()[1].querySelector('.col-qty'), '3');
  multi.edit(0, '40000'); multi.edit(1, '20000'); multi.edit(2, '10000');
  multi.d.getElementById('btnPricingMode').click();
  for (const i of [0, 1]) {
    const checkbox = multi.d.querySelector(`[data-pricing-index="${i}"]`); checkbox.checked = true;
    checkbox.dispatchEvent(new multi.w.Event('change', { bubbles: true }));
  }
  multi.d.getElementById('btnFixPricingTotal').click(); multi.edit(2, '9999,99');
  assert.equal(multi.d.getElementById('btnAcceptPricingTotal').hidden, true);
  assert.equal(multi.d.getElementById('grandTotal').textContent.replace(/\s/g, ''), '150000,00');
  assert.equal(multi.rows()[2].querySelector('.col-price').dataset.raw, '9999.99');
  multi.d.getElementById('btnPricingMode').click(); multi.edit(2, '9000');
  assert.equal(multi.d.getElementById('pricingModeTools').hidden, true);
  const saved = JSON.parse(multi.w.localStorage.getItem(storageKey));
  assert.equal(saved.fixedPricing, null);
  await multi.close(); console.log('PASS multiple balancing quantities, exact cents, edit outside mode');
  const repeat = await open();
  repeat.d.getElementById('btnAddRow').click();
  repeat.input(repeat.d.getElementById('priceColumnInput'), '40000\n10000');
  repeat.d.getElementById('btnApplyPrices').click();
  repeat.input(repeat.d.getElementById('calcCostVat'), '50000');
  repeat.input(repeat.d.getElementById('calcProfitTarget'), '15000');
  repeat.d.getElementById('btnPricingMode').click(); repeat.d.getElementById('btnMarkupPrices').click();
  const original = repeat.rows().map(row => row.querySelector('.col-price').dataset.raw);
  assert.equal(repeat.d.getElementById('btnMarkupPrices').disabled, true);
  repeat.d.getElementById('btnMarkupPrices').dispatchEvent(new repeat.w.Event('click'));
  assert.deepEqual(repeat.rows().map(row => row.querySelector('.col-price').dataset.raw), original);
  const selection = repeat.d.querySelector('[data-pricing-index="0"]'); selection.checked = true;
  selection.dispatchEvent(new repeat.w.Event('change', { bubbles: true }));
  repeat.d.getElementById('btnFixPricingTotal').click(); repeat.edit(1, '10000');
  const distributed = repeat.rows().map(row => row.querySelector('.col-price').dataset.raw);
  repeat.d.getElementById('btnFixPricingTotal').click();
  assert.equal(repeat.d.getElementById('btnMarkupPrices').disabled, true);
  repeat.d.getElementById('btnMarkupPrices').dispatchEvent(new repeat.w.Event('click'));
  assert.deepEqual(repeat.rows().map(row => row.querySelector('.col-price').dataset.raw), distributed);
  const repeatState = JSON.parse(repeat.w.localStorage.getItem(storageKey));
  delete repeatState.pricingBasis.coefficient; // Earlier versions saved only base/output.
  await repeat.close();
  const reload = await open(JSON.stringify(repeatState)); reload.d.getElementById('btnPricingMode').click();
  assert.equal(reload.d.getElementById('btnMarkupPrices').disabled, true);
  reload.input(reload.d.getElementById('calcProfitTarget'), '25000');
  const coefficient = Number(reload.d.getElementById('resSaleVat').getAttribute('data-val')) / 50000;
  reload.d.getElementById('btnMarkupPrices').click();
  assert.deepEqual(reload.rows().map(row => Number(row.querySelector('.col-price').dataset.raw)), [40000, 10000].map(price => Math.round(price * coefficient / 10) * 10));
  assert.equal(reload.d.getElementById('btnMarkupPrices').disabled, true);
  assert.notDeepEqual(original, distributed);
  reload.d.getElementById('btnAddRow').click(); reload.edit(2, '1000');
  assert.equal(reload.d.getElementById('btnMarkupPrices').disabled, true);
  assert.match(reload.d.getElementById('priceMarkupStatus').textContent, /Перенесите закупочные цены заново/);
  await reload.close(); console.log('PASS repeated pricing after distribution, reload, new coefficient from original costs');
})().catch(error => { console.error(error); process.exitCode = 1; });
