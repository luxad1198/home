const STORAGE_KEY = 'rtstandard_calc_full_state_v2';
const BG_VISIBILITY_KEY = 'rtstandard_bg_hidden';
let currentMarginMode = 'rub';
let currentFinMode = 'days';

const DEFAULT_DELIVERY_TIME_OOO = '5-10 (пять-десять) рабочих дней';
const DEFAULT_PAY_OOO = '100% постоплата';
const DEFAULT_DELIVERY_TYPE_OOO = 'Доставка товара до адреса заказчика включена';
const DEFAULT_WARRANTY_OOO = '12 месяцев с возможностью расширения до 5 лет. Выезд инженера в рамках гарантийного ремонта по адресу Заказчика – опционально. Обслуживание On-site (на месте) / Keep Your Drive (KYD) ремонт с сохранением жестких дисков у клиента – опционально.';

function parseNumberToWord(numStr, isFem = false) {
  const n = parseInt(numStr, 10);
  if (isNaN(n) || n < 0) return numStr;
  return num2words(n, isFem);
}

function generateDeliveryPhrase(rangeStr, unitKey) {
  if (!rangeStr || !rangeStr.trim()) return '';
  const clean = rangeStr.trim().replace(/\s+/g, '');
  const isFem = unitKey === 'weeks';

  let wordsPart = '';
  let lastNumber = 0;

  if (clean.includes('-')) {
    const parts = clean.split('-').filter(Boolean);
    if (parts.length >= 2) {
      const w1 = parseNumberToWord(parts[0], isFem);
      const w2 = parseNumberToWord(parts[1], isFem);
      wordsPart = `(${w1}-${w2})`;
      lastNumber = parseInt(parts[1], 10);
    } else {
      wordsPart = `(${parseNumberToWord(parts[0], isFem)})`;
      lastNumber = parseInt(parts[0], 10);
    }
  } else {
    wordsPart = `(${parseNumberToWord(clean, isFem)})`;
    lastNumber = parseInt(clean, 10);
  }

  const nForDecl = isNaN(lastNumber) ? 5 : lastNumber;
  let unitStr = '';
  if (unitKey === 'work_days') {
    unitStr = decl(nForDecl, ['рабочий день', 'рабочих дня', 'рабочих дней']);
  } else if (unitKey === 'cal_days') {
    unitStr = decl(nForDecl, ['календарный день', 'календарных дня', 'календарных дней']);
  } else if (unitKey === 'weeks') {
    unitStr = decl(nForDecl, ['неделя', 'недели', 'недель']);
  }

  return `${clean} ${wordsPart} ${unitStr}`;
}

function onDeliveryBuilderChange() {
  const val = document.getElementById('deliveryDaysInput').value;
  const unit = document.getElementById('deliveryUnitSelect').value;
  const res = generateDeliveryPhrase(val, unit);
  if (!res) return;

  const isIp = document.getElementById('companySelect').value === 'ip';
  if (isIp) {
    const inpIp = document.getElementById('ipDeliveryTime');
    if (inpIp) inpIp.value = res;
  } else {
    const taOoo = document.getElementById('condOooDeliveryTime');
    if (taOoo) {
      taOoo.value = res;
      autoResizeTextarea(taOoo);
    }
  }
  saveState();
}

function addCondRowForActiveCompany() {
  const isIp = document.getElementById('companySelect').value === 'ip';
  if (isIp) {
    addCondRowIp('Документы', 'УПД, Счет');
  } else {
    addCondRowOoo('Дополнительно', '');
  }
}

function addCondRowOoo(title = 'Дополнительно', val = '') {
  const tbody = document.getElementById('condOooTbody');
  const tr = document.createElement('tr');
  tr.className = 'custom-cond-row';
  tr.innerHTML = `
    <td class="cond-lbl"><input type="text" class="cond-lbl-input" value="${escapeHtml(title)}" oninput="saveState()"></td>
    <td>
      <textarea class="auto-grow cond-val" placeholder="впишите условия" oninput="saveState()">${escapeHtml(val)}</textarea>
      <div class="print-text-mirror"></div>
    </td>
    <td class="no-print" style="width:25px; border:none; background:#fff; text-align:center;">
      <button type="button" class="btn-del" onclick="deleteCondRow(this)">✕</button>
    </td>
  `;
  tbody.appendChild(tr);
  initAutoResize();
  saveState();
}

function adjustInputWidth(input) {
  if (!input) return;
  const length = (input.value || '').length || 1;
  input.style.width = Math.max(30, length * 8.5 + 4) + 'px';
}

function addCondRowIp(title = 'Документы', val = 'УПД, Счет') {
  const container = document.getElementById('condIpCustomList');
  const div = document.createElement('div');
  div.className = 'ip-custom-cond-row';
  div.innerHTML = `
    <b><input type="text" class="ip-cond-lbl-input" value="${escapeHtml(title)}" oninput="adjustInputWidth(this); saveState();">:</b>&nbsp;
    <input type="text" class="meta-input ip-cond-val-input" value="${escapeHtml(val)}" placeholder="значение" style="width: 320px;" oninput="saveState()">&nbsp;
    <button type="button" class="btn-del no-print" onclick="deleteIpCondRow(this)">✕</button>
  `;
  container.appendChild(div);
  const inp = div.querySelector('.ip-cond-lbl-input');
  adjustInputWidth(inp);
  saveState();
}

function deleteCondRow(btn) {
  btn.closest('tr').remove();
  saveState();
}

function deleteIpCondRow(btn) {
  btn.closest('.ip-custom-cond-row').remove();
  saveState();
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toggleBackgroundImages() {
  const isHidden = document.body.classList.toggle('hide-bg-sidebar');
  localStorage.setItem(BG_VISIBILITY_KEY, isHidden ? 'true' : 'false');
  updateBgButtonText(isHidden);
}

function updateBgButtonText(isHidden) {
  const btn = document.getElementById('btnToggleBg');
  if (btn) {
    btn.textContent = isHidden ? '🖼️ Показать картинки' : '🖼️ Скрыть картинки';
  }
}

function initBackgroundVisibility() {
  const isHidden = localStorage.getItem(BG_VISIBILITY_KEY) === 'true';
  if (isHidden) {
    document.body.classList.add('hide-bg-sidebar');
  } else {
    document.body.classList.remove('hide-bg-sidebar');
  }
  updateBgButtonText(isHidden);
}

function toggleCalcPanel() {
  const panel = document.getElementById('calcSidebar');
  panel.classList.toggle('collapsed');
}

function setFinMode(mode) {
  currentFinMode = mode;
  document.getElementById('btnFinDays').classList.toggle('active', mode === 'days');
  document.getElementById('btnFinWeeks').classList.toggle('active', mode === 'weeks');

  const isWeeks = mode === 'weeks';
  document.getElementById('btnWeekMinus').style.display = isWeeks ? 'inline-block' : 'none';
  document.getElementById('btnWeekPlus').style.display = isWeeks ? 'inline-block' : 'none';
  calculateMargin();
  saveState();
}

function stepFinWeeks(delta) {
  const input = document.getElementById('calcFinDaysInput');
  let days = parseInt(input.value) || 0;
  let weeks = Math.round(days / 7);
  weeks = Math.max(0, weeks + delta);
  input.value = weeks * 7;
  calculateMargin();
  saveState();
}

function setMarginMode(mode) {
  currentMarginMode = mode;
  document.getElementById('btnModeRub').classList.toggle('active', mode === 'rub');
  document.getElementById('btnModePct').classList.toggle('active', mode === 'pct');
  
  const input = document.getElementById('calcProfitTarget');
  input.placeholder = mode === 'rub' ? '15 000' : '15';
  calculateMargin();
  saveState();
}

function onCompanyChange() {
  const comp = document.getElementById('companySelect').value;
  const isIp = comp === 'ip';

  document.body.classList.toggle('is-ip', isIp);

  document.getElementById('headOoo').style.display = isIp ? 'none' : 'table';
  document.getElementById('headIp').style.display = isIp ? 'block' : 'none';

  document.getElementById('condOooTable').style.display = isIp ? 'none' : 'table';
  document.getElementById('condIpBox').style.display = isIp ? 'block' : 'none';

  document.getElementById('contactsOoo').style.display = isIp ? 'none' : 'block';
  document.getElementById('contactsIp').style.display = isIp ? 'block' : 'none';

  const stampImg = document.getElementById('stampImg');
  const delTitle = document.getElementById('lblDeliveryTitle');

  if (isIp) {
    document.getElementById('docIntro').textContent = 
      'Индивидуальный предприниматель Захаров Михаил Сергеевич, действующий на основании свидетельства о государственной регистрации, предлагает рассмотреть возможность поставки следующего оборудования:';
    document.getElementById('thPriceCol').textContent = 'Цена за ед. руб., с НДС 5%';
    document.getElementById('thTotalCol').textContent = 'Сумма руб., с НДС 5%';
    document.getElementById('signTitleBlock').textContent = 'Индивидуальный предприниматель';
    document.getElementById('signPersonName').textContent = 'Захаров М.С.';
    document.getElementById('lblTaxType').textContent = 'УСН (6%+1%):';
    document.getElementById('lblVatType').textContent = 'НДС (5%):';
    if (delTitle) delTitle.textContent = 'Доставка до клиента с НДС 5%, ₽';

    if (stampImg) {
      stampImg.src = 'stamp-ip.png';
      stampImg.style.display = 'block';
    }
  } else {
    document.getElementById('docIntro').textContent = 
      'Общество с ограниченной ответственностью «РТСтандарт», в лице генерального директора Маркова Дмитрия Евгеньевича, действующего на основании Устава, предлагает рассмотреть возможность поставки следующего оборудования:';
    document.getElementById('thPriceCol').textContent = 'Цена за ед. руб., включая НДС 22%';
    document.getElementById('thTotalCol').textContent = 'Сумма руб., включая НДС 22%';
    document.getElementById('signTitleBlock').innerHTML = 'Генеральный директор<br>ООО «РТСтандарт»';
    document.getElementById('signPersonName').textContent = 'Марков Д.Е.';
    document.getElementById('lblTaxType').textContent = 'Налог на прибыль (25%):';
    document.getElementById('lblVatType').textContent = 'НДС к доплате (22%):';
    if (delTitle) delTitle.textContent = 'Доставка до клиента с НДС 22%, ₽';

    if (stampImg) {
      stampImg.src = 'stamp.png';
      stampImg.style.display = 'block';
    }
  }

  calculateMargin();
  recalc();
  updateDocumentTitle();
  saveState();
}

function parseNum(val) {
  if (val === null || val === undefined) return 0;
  let clean = String(val).replace(/\s+/g, '').replace(',', '.');
  clean = clean.replace(/[^0-9.]/g, '');
  const parts = clean.split('.');
  if (parts.length > 2) clean = parts[0] + '.' + parts.slice(1).join('');
  return parseFloat(clean) || 0;
}

function fmt(n) {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtInt(n) {
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
}

function calculateMargin() {
  const isIp = document.getElementById('companySelect').value === 'ip';
  const cVat = parseNum(document.getElementById('calcCostVat').value);
  const targetVal = parseNum(document.getElementById('calcProfitTarget').value);
  const days = parseInt(document.getElementById('calcFinDaysInput').value) || 0;
  
  const finCost = cVat * (0.28 / 365) * days;
  document.getElementById('calcFinCostVal').textContent = `Стоимость денег: ${fmt(finCost)} ₽ (${days} дн.)`;

  const activeDelSelect = isIp ? document.getElementById('deliverySelectIp') : document.getElementById('deliverySelectOoo');
  const isPickup = activeDelSelect && activeDelSelect.value.toLowerCase().includes('самовывоз');
  
  const delInputEl = document.getElementById('calcDeliveryCost');
  const pickupNoteEl = document.getElementById('calcDeliveryPickupNote');
  if (delInputEl) delInputEl.disabled = isPickup;
  if (pickupNoteEl) pickupNoteEl.style.display = isPickup ? 'block' : 'none';

  const delCost = isPickup ? 0 : parseNum(delInputEl?.value);
  const totalCostBase = cVat + finCost + delCost;

  if (totalCostBase <= 0) {
    document.getElementById('resCostNet').textContent = '0,00 ₽';
    document.getElementById('resNetProfit').textContent = '0,00 ₽';
    document.getElementById('resProfitTax').textContent = '0,00 ₽';
    document.getElementById('resVatPayable').textContent = '0,00 ₽';
    document.getElementById('resSaleVat').textContent = '0,00 ₽';
    document.getElementById('resSaleVat').removeAttribute('data-val');
    return;
  }

  let netProfit = currentMarginMode === 'rub' ? targetVal : (totalCostBase * targetVal / 100);
  let saleVat = 0, profitTax = 0, vatPayable = 0, costNet = 0;

  if (!isIp) {
    costNet = totalCostBase / 1.22;
    const vatIn = totalCostBase - costNet;
    const ebt = netProfit / 0.75;
    profitTax = ebt * 0.25;
    const saleNet = costNet + ebt;
    const vatOut = saleNet * 0.22;
    vatPayable = vatOut - vatIn;
    saleVat = saleNet * 1.22;
  } else {
    costNet = totalCostBase;
    const taxFactor = 1 - (5 / 105) - 0.07;
    saleVat = (costNet + netProfit) / taxFactor;
    profitTax = saleVat * 0.07;
    vatPayable = saleVat * 5 / 105;
  }

  document.getElementById('resCostNet').textContent = fmt(costNet) + ' ₽';
  document.getElementById('resNetProfit').textContent = fmt(netProfit) + ' ₽';
  document.getElementById('resProfitTax').textContent = fmt(profitTax) + ' ₽';
  document.getElementById('resVatPayable').textContent = fmt(vatPayable) + ' ₽';
  document.getElementById('resSaleVat').textContent = fmt(saleVat) + ' ₽';
  document.getElementById('resSaleVat').setAttribute('data-val', saleVat.toFixed(2));
}

function copyCalcPrice() {
  const val = document.getElementById('resSaleVat').getAttribute('data-val');
  if (!val) {
    alert('Сначала введите данные для расчета в калькулятор.');
    return;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(val)
      .then(() => alert('Итоговая сумма скопирована в буфер!'))
      .catch(() => fallbackCopyText(val));
  } else {
    fallbackCopyText(val);
  }
}

function fallbackCopyText(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    alert('Итоговая сумма скопирована в буфер!');
  } catch (e) {
    alert('Не удалось скопировать автоматически. Сумма: ' + text);
  }
  document.body.removeChild(ta);
}

function autoResizeTextarea(el) {
  if (el && el.classList.contains('auto-grow')) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }
}

function initAutoResize() {
  document.querySelectorAll('textarea.auto-grow').forEach(el => {
    autoResizeTextarea(el);
    el.removeEventListener('input', onTextareaInput);
    el.addEventListener('input', onTextareaInput);
  });
}

function onTextareaInput() { autoResizeTextarea(this); }
