(function () {
  'use strict';

  const STORAGE_KEY = 'rtstandard_calc_full_state_v2';
  const BG_VISIBILITY_KEY = 'rtstandard_bg_hidden';
  let currentMarginMode = 'rub';
  let currentFinMode = 'days';

  const DEFAULT_DELIVERY_TIME_OOO = '5-10 (пять-десять) рабочих дней';
  const DEFAULT_PAY_OOO = '100% постоплата';
  const DEFAULT_DELIVERY_TYPE_OOO = 'Доставка товара до адреса заказчика включена';
  const DEFAULT_WARRANTY_OOO = '12 месяцев с возможностью расширения до 5 лет. Выезд инженера в рамках гарантийного ремонта по адресу Заказчика – опционально. Обслуживание On-site (на месте) / Keep Your Drive (KYD) ремонт с сохранением жестких дисков у клиента – опционально.';
  const MONTHS_GENITIVE = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];

  const COMPANY_CONFIG = {
    ooo: {
      kind: 'company', name: 'РТСтандарт', intro: 'Общество с ограниченной ответственностью «РТСтандарт», в лице генерального директора Маркова Дмитрия Евгеньевича, действующего на основании Устава, предлагает рассмотреть возможность поставки следующего оборудования:',
      priceTitle: 'Цена за ед. руб., включая НДС 22%', sumTitle: 'Сумма руб., включая НДС 22%', vatRate: 22, vatDivisor: 122,
      signTitle: 'Генеральный директор ООО «РТСтандарт»', signPerson: 'Марков Д.Е.'
    },
    ip: {
      kind: 'ip', name: 'ИП Захаров', intro: 'Индивидуальный предприниматель Захаров Михаил Сергеевич, действующий на основании свидетельства о государственной регистрации, предлагает рассмотреть возможность поставки следующего оборудования:',
      priceTitle: 'Цена за ед. руб., с НДС 5%', sumTitle: 'Сумма руб., с НДС 5%', vatRate: 5, vatDivisor: 105,
      signTitle: 'Индивидуальный предприниматель', signPerson: 'Захаров М.С.', taxLabel: 'УСН (6%+1%):', vatLabel: 'НДС (5%):', stamp: 'stamp-ip.webp'
    },
    'ip-glazyrin': {
      kind: 'ip', name: 'ИП Глазырин', intro: 'Предлагаю поставить оборудование по спецификации и условиям ниже.', documentTitle: 'ПРЕДЛОЖЕНИЕ НА ПОСТАВКУ ОБОРУДОВАНИЯ',
      priceTitle: 'Цена за ед. руб., без НДС', sumTitle: 'Сумма, руб. (без НДС)', vatRate: 0, vatDivisor: 100,
      signTitle: 'Индивидуальный предприниматель', signPerson: 'Глазырин А.А.', taxLabel: 'УСН (4% + 1%):', vatLabel: 'НДС не начисляется:', taxRate: 0.05,
      headerHtml: '<div class="ip-gla-entity">Индивидуальный предприниматель</div><div class="ip-gla-name">Глазырин Алексей Алексеевич</div><div class="ip-gla-details">ИНН: 143533463817<br>ОГРНИП: 326140000064939</div><div class="ip-gla-contact">Тел.: +7 966 871-88-61<br>Почта: a.glazyrin1198@mail.ru</div>',
      contactsHtml: 'Глазырин Алексей Алексеевич<br>Телефон: +7 966 871-88-61<br>Email: a.glazyrin1198@mail.ru', stamp: null
    }
  };

  function activeCompany() {
    return COMPANY_CONFIG[document.getElementById('companySelect')?.value] || COMPANY_CONFIG.ooo;
  }
  function isSoleProprietor() { return activeCompany().kind === 'ip'; }

  function decl(n, forms) {
    n = Math.abs(n) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return forms[2];
    if (n1 > 1 && n1 < 5) return forms[1];
    if (n1 === 1) return forms[0];
    return forms[2];
  }

  function num2words(n, baseFem = false) {
    n = Math.floor(Math.abs(Number(n) || 0));
    if (n === 0) return 'ноль';

    const o = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
    const of = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
    const te = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
    const t = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
    const h = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

    const grps = [
      { u: 1e12, f: ['триллион', 'триллиона', 'триллионов'], fem: false },
      { u: 1e9,  f: ['миллиард', 'миллиарда', 'миллиардов'], fem: false },
      { u: 1e6,  f: ['миллион', 'миллиона', 'миллионов'], fem: false },
      { u: 1e3,  f: ['тысяча', 'тысячи', 'тысяч'], fem: true },
      { u: 1,    f: ['', '', ''], fem: baseFem }
    ];

    let res = [];
    let rem = n;

    for (let g of grps) {
      let c = Math.floor(rem / g.u);
      rem %= g.u;
      if (c === 0) continue;

      let ch = Math.floor(c / 100);
      let rem100 = c % 100;
      let ct = Math.floor(rem100 / 10);
      let co = rem100 % 10;

      if (ch > 0) res.push(h[ch]);

      if (ct === 1) {
        res.push(te[co]);
      } else {
        if (ct > 1) res.push(t[ct]);
        if (co > 0) {
          res.push(g.fem ? of[co] : o[co]);
        }
      }

      if (g.f[0]) {
        res.push(decl(c, g.f));
      }
    }

    return res.join(' ');
  }

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

    const isIp = isSoleProprietor();
    if (isIp) {
      const inpIp = document.getElementById('ipDeliveryTime');
      if (inpIp) inpIp.value = res;
      syncInlineConditionEditors();
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
    const isIp = isSoleProprietor();
    const isGlazyrin = document.getElementById('companySelect')?.value === 'ip-glazyrin';
    if (isGlazyrin) {
      addCondRowIp('Дополнительное условие', '', '3');
    } else if (isIp) {
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
      <td class="cond-lbl"><input type="text" class="cond-lbl-input" value="${escapeHtml(title)}"></td>
      <td>
        <textarea class="auto-grow cond-val" placeholder="впишите условия">${escapeHtml(val)}</textarea>
        <div class="print-text-mirror"></div>
      </td>
      <td class="no-print" style="width:25px; border:none; background:#fff; text-align:center;">
        <button type="button" class="btn-del btn-del-cond">✕</button>
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

  function updateIpConditionSeparator(row) {
    const label = row?.querySelector('.ip-cond-lbl-input');
    const separator = row?.querySelector('.ip-cond-label-separator');
    if (label && separator) separator.textContent = /[:：]\s*$/.test(label.value) ? '' : ':';
  }

  function syncInlineConditionEditors() {
    const field = document.getElementById('ipDeliveryTime');
    const editor = document.querySelector('.ip-standard-value-editor');
    if (field && editor && editor !== document.activeElement) editor.textContent = field.value;
  }

  function readInlineConditionEditor(editor) {
    // A plaintext-only contenteditable may encode Enter as <div>, <p> or
    // <br>. innerText on an INLINE editor can silently concatenate block
    // boundaries; preserve explicit line breaks before saving/printing.
    const readChildren = parent => {
      let output = '';
      for (const node of parent.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          output += node.nodeValue || '';
        } else if (node.nodeName === 'BR') {
          output += '\n';
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const block = node.nodeName === 'DIV' || node.nodeName === 'P';
          if (block && output && !output.endsWith('\n')) output += '\n';
          output += readChildren(node);
          if (block && node.nextSibling && !output.endsWith('\n')) output += '\n';
        }
      }
      return output;
    };
    return readChildren(editor).replace(/\r/g, '').replace(/\n+$/, '');
  }

  function addCondRowIp(title = 'Документы', val = 'УПД, Счет', section = null) {
    const isGlazyrin = document.getElementById('companySelect')?.value === 'ip-glazyrin';
    const itemSection = isGlazyrin ? String(section || '3') : '';
    const containerId = itemSection === '2' ? 'condIpCustomList2' : 'condIpCustomList';
    const container = document.getElementById(containerId);
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'ip-custom-cond-row';
    if (itemSection) div.dataset.section = itemSection;
    div.innerHTML = `
      <b><span class="ip-cond-number"></span><input type="text" class="ip-cond-lbl-input" value="${escapeHtml(title)}"><span class="ip-cond-label-print"></span><span class="ip-cond-label-separator">:</span></b>
      <textarea class="auto-grow meta-input ip-cond-val-input" rows="1" placeholder="значение">${escapeHtml(val)}</textarea><span class="ip-cond-value-editor" contenteditable="plaintext-only" role="textbox" aria-label="Значение условия" data-placeholder="значение"></span><span class="ip-cond-value-print"></span>
      <button type="button" class="btn-del btn-del-ip-cond no-print">✕</button>
    `;
    container.appendChild(div);
    div.querySelector('.ip-cond-value-editor').textContent = val;
    updateIpConditionSeparator(div);
    const inp = div.querySelector('.ip-cond-lbl-input');
    adjustInputWidth(inp);
    autoResizeTextarea(div.querySelector('.ip-cond-val-input'));
    renumberGlazyrinConditions();
    saveState();
  }

  function renumberGlazyrinConditions() {
    const counters = { '2': 0, '3': 0 };
    document.querySelectorAll('#condIpBox .ip-term-row[data-section], #condIpCustomList2 .ip-custom-cond-row, #condIpCustomList .ip-custom-cond-row')
      .forEach(row => {
        if (row.classList.contains('is-deleted')) return;
        const section = row.dataset.section;
        if (!Object.hasOwn(counters, section)) return;
        counters[section] += 1;
        const number = row.querySelector('.ip-standard-number, .ip-cond-number');
        if (number) number.textContent = `${section}.${counters[section]}. `;
      });
  }

  function applyDeletedStandardConditions(ids = []) {
    const deleted = new Set(ids);
    document.querySelectorAll('#condIpBox .ip-term-row[data-section]').forEach(row => {
      const input = row.querySelector('input, select');
      row.classList.toggle('is-deleted', document.body.classList.contains('is-ip-glazyrin') && !!input && deleted.has(input.id));
    });
    renumberGlazyrinConditions();
  }

  function storedGlazyrinDeletions() {
    try {
      const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return state.deletedStandardConditionsByCompany?.['ip-glazyrin'] || state.deletedStandardConditions || [];
    } catch (e) {
      return [];
    }
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
    let days = parseInt(input.value, 10) || 0;
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

  let restoringState = false;
  let renderedCompany = null;
  let ipConditionsByCompany = {};
  const ipFieldIds = ['ipDeliveryTime', 'deliverySelectIp', 'ipPaymentTerms', 'ipWarrantyTerms', 'ipServiceTerms', 'ipValidityTerms', 'ipAppendixTerms'];
  const defaultIpTerms = ['1-2 недели', 'Доставка включена в стоимость', 'По согласованию', 'Согласно документации производителя', 'По отдельному согласованию', 'До согласования заказа', 'Спецификация и техническое описание предоставляются по запросу'];
  function captureIpConditions() {
    return {
      values: ipFieldIds.map(id => document.getElementById(id).value),
      custom: [...document.querySelectorAll('#condIpBox .ip-custom-cond-row')].map(row => ({
        lbl: row.querySelector('.ip-cond-lbl-input').value,
        val: row.querySelector('.ip-cond-val-input').value,
        section: row.dataset.section || ''
      })),
      deleted: [...document.querySelectorAll('#condIpBox .ip-term-row.is-deleted .meta-input[id]')].map(el => el.id)
    };
  }
  function restoreIpConditions(company) {
    const data = ipConditionsByCompany[company] || { values: defaultIpTerms, custom: [], deleted: [] };
    const wasRestoring = restoringState;
    restoringState = true;
    try {
      document.getElementById('condIpCustomList').replaceChildren();
      document.getElementById('condIpCustomList2').replaceChildren();
      ipFieldIds.forEach((id, i) => { document.getElementById(id).value = data.values?.[i] ?? defaultIpTerms[i]; });
      syncInlineConditionEditors();
      (data.custom || []).forEach(c => addCondRowIp(c.lbl, c.val, company === 'ip-glazyrin' ? (c.section || '3') : null));
      applyDeletedStandardConditions(data.deleted || []);
    } finally { restoringState = wasRestoring; }
  }

  function onCompanyChange() {
    const comp = document.getElementById('companySelect').value;
    if (renderedCompany && renderedCompany !== 'ooo') ipConditionsByCompany[renderedCompany] = captureIpConditions();
    const company = activeCompany();
    const isIp = company.kind === 'ip';
    const isGlazyrin = comp === 'ip-glazyrin';
    const documentHeading = document.querySelector('.title');
    if (documentHeading) documentHeading.textContent = company.documentTitle || 'КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ';

    document.body.classList.toggle('is-ip', isIp);
    document.body.classList.toggle('is-ip-glazyrin', isGlazyrin);
    if (isIp) restoreIpConditions(comp);
    else applyDeletedStandardConditions([]);
    syncInlineConditionEditors();
    const deliveryLabel = document.querySelector('#deliverySelectIp')?.closest('.ip-term-row')?.querySelector('.ip-term-label');
    if (deliveryLabel) deliveryLabel.textContent = isGlazyrin ? 'Место и способ поставки' : 'Доставка';
    renderedCompany = comp;

    document.getElementById('headOoo').style.display = isIp ? 'none' : 'table';
    document.getElementById('headIp').style.display = isIp ? (isGlazyrin ? 'grid' : 'block') : 'none';

    document.getElementById('condOooTable').style.display = isIp ? 'none' : 'table';
    document.getElementById('condIpBox').style.display = isIp ? 'block' : 'none';

    document.getElementById('contactsOoo').style.display = isIp ? 'none' : 'block';
    document.getElementById('contactsIp').style.display = isIp ? 'block' : 'none';

    const stampImg = document.getElementById('stampImg');
    const delTitle = document.getElementById('lblDeliveryTitle');

    if (isIp) {
      document.getElementById('docIntro').textContent = company.intro;
      document.getElementById('thPriceCol').textContent = company.priceTitle;
      document.getElementById('thTotalCol').textContent = company.sumTitle;
      document.getElementById('signTitleBlock').textContent = company.signTitle;
      document.getElementById('signPersonName').textContent = company.signPerson;
      document.getElementById('lblTaxType').textContent = company.taxLabel;
      document.getElementById('lblVatType').textContent = company.vatLabel;
      if (delTitle) delTitle.textContent = isGlazyrin ? 'Доставка до клиента, ₽' : 'Доставка до клиента с НДС 5%, ₽';
      const kpLabel = document.getElementById('kpNumLabel');
      if (kpLabel) kpLabel.textContent = isGlazyrin ? 'КП №' : 'Исх. №';
      document.getElementById('headIpTop').innerHTML = company.headerHtml || '<b>Индивидуальный предприниматель Захаров Михаил Сергеевич</b><br><b>ОГРНИП: 325110000002538</b> / <b>ИНН: 110214010407</b><br>Тел.: +7 (981) 208-62-36<br>e-mail: m.zakharov0811@gmail.com';
      document.getElementById('contactsIp').innerHTML = company.contactsHtml || 'Захаров Михаил Сергеевич<br>Телефон: +7 981 208-62-36<br>Email: m.zakharov0811@gmail.com';

      if (stampImg) {
        stampImg.src = company.stamp || '';
        stampImg.style.display = company.stamp ? 'block' : 'none';
      }
    } else {
      document.getElementById('docIntro').textContent = company.intro;
      document.getElementById('thPriceCol').textContent = company.priceTitle;
      document.getElementById('thTotalCol').textContent = company.sumTitle;
      document.getElementById('signTitleBlock').innerHTML = 'Генеральный директор<br>ООО «РТСтандарт»';
      document.getElementById('signPersonName').textContent = company.signPerson;
      document.getElementById('lblTaxType').textContent = 'Налог на прибыль (25%):';
      document.getElementById('lblVatType').textContent = 'НДС к доплате (22%):';
      if (delTitle) delTitle.textContent = 'Доставка до клиента с НДС 22%, ₽';

      if (stampImg) {
        stampImg.src = 'stamp.webp';
        stampImg.style.display = 'block';
      }
    }

    calculateMargin();
    recalc();
    initAutoResize();
    updateDocumentTitle();
    saveState();
  }

  function readNumber(val) {
    const text = String(val ?? '').replace(/\s/g, '').replace(',', '.');
    if (!text) return 0;
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return NaN;
    const number = Number(text);
    return Number.isFinite(number) && number <= 1e12 ? number : NaN;
  }
  function parseNum(val) {
    const number = readNumber(val);
    return Number.isFinite(number) ? number : 0;
  }
  function setNumberValidity(input, message) {
    input.setCustomValidity(message);
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    input.title = message;
  }
  function validateEquipment(showError = false) {
    let firstInvalid = null;
    document.querySelectorAll('#tableBody tr').forEach(row => {
      const qty = row.querySelector('.col-qty');
      const price = row.querySelector('.col-price');
      const q = qty.value === '' ? 1 : Number(qty.value);
      const p = readNumber(price.dataset.raw ?? price.value);
      setNumberValidity(qty, !qty.validity.badInput && Number.isSafeInteger(q) && q >= 1 && q <= 1000000 ? '' : 'Количество: целое число от 1 до 1 000 000.');
      setNumberValidity(price, Number.isFinite(p) ? '' : 'Цена: неотрицательное число, не более двух знаков после запятой.');
      firstInvalid ||= [qty, price].find(el => el.getAttribute('aria-invalid') === 'true');
    });
    if (firstInvalid && showError) { firstInvalid.focus(); firstInvalid.reportValidity(); }
    return !firstInvalid;
  }

  function fmt(n) {
    return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtInt(n) {
    return n.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
  }

  function calculateMargin() {
    const company = activeCompany();
    const isIp = company.kind === 'ip';
    const isGlazyrin = document.getElementById('companySelect').value === 'ip-glazyrin';
    let invalidCalc = false;
    ['calcCostVat', 'calcProfitTarget', 'calcFinDaysInput', 'calcDeliveryCost'].forEach(id => {
      const el = document.getElementById(id);
      const value = readNumber(el.value);
      const valid = !el.validity.badInput && Number.isFinite(value) && (id !== 'calcFinDaysInput' || Number.isSafeInteger(value));
      setNumberValidity(el, valid ? '' : 'Введите неотрицательное число' + (id === 'calcFinDaysInput' ? ' целых дней.' : ', до двух знаков после запятой.'));
      invalidCalc ||= !valid;
    });
    if (invalidCalc) {
      ['resCostNet', 'resNetProfit', 'resProfitTax', 'resVatPayable', 'resSaleVat'].forEach(id => { document.getElementById(id).textContent = '—'; });
      document.getElementById('calcFinCostVal').textContent = 'Проверьте выделенные поля';
      document.getElementById('resSaleVat').removeAttribute('data-val');
      return;
    }
    const cVat = parseNum(document.getElementById('calcCostVat').value);
    const targetVal = parseNum(document.getElementById('calcProfitTarget').value);
    const days = parseInt(document.getElementById('calcFinDaysInput').value, 10) || 0;
    
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
    } else if (isGlazyrin) {
      costNet = totalCostBase;
      saleVat = (costNet + netProfit) / (1 - company.taxRate);
      profitTax = saleVat * company.taxRate;
      vatPayable = 0;
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
    document.querySelectorAll('textarea.auto-grow').forEach(el => autoResizeTextarea(el));
  }

  // Pure view synchronization. It never changes form fields or saved values;
  // edit/restore/import/company switch may all call it safely.
  function syncDocumentPresentation() {
    // An input may show only part of a long proposal number in Chromium PDF.
    // Print the complete text without altering the editable number field.
    const kpNumberPrint = document.getElementById('kpNumPrint');
    if (kpNumberPrint) kpNumberPrint.textContent = document.getElementById('kpNumInput')?.value || '';

    document.querySelectorAll('#tableBody tr').forEach(row => {
      const textCells = row.querySelectorAll('td.col-text-cell');
      textCells.forEach(cell => {
        const ta = cell.querySelector('textarea.auto-grow');
        const mirror = cell.querySelector('.print-text-mirror');
        if (ta && mirror) mirror.textContent = ta.value;
      });

    });

    document.querySelectorAll('#condOooTbody tr').forEach(row => {
      const ta = row.querySelector('textarea.auto-grow');
      const mirror = row.querySelector('.print-text-mirror');
      if (ta && mirror) mirror.textContent = ta.value;
    });

    const standardLabel = document.querySelector('#condIpBox .ip-term-row:not(.is-deleted) > b');
    const standardValue = document.querySelector('#condIpBox .ip-term-row:not(.is-deleted) .meta-input');
    const labelStyle = standardLabel ? getComputedStyle(standardLabel) : null;
    const valueStyle = standardValue ? getComputedStyle(standardValue) : null;
    const copyTextStyle = (target, source) => {
      if (!target || !source) return;
      target.style.font = source.font;
      target.style.color = source.color;
      target.style.lineHeight = source.lineHeight;
      target.style.letterSpacing = source.letterSpacing;
    };
    document.querySelectorAll('#condIpBox .ip-term-row').forEach(row => {
      const field = row.querySelector('.meta-input');
      const mirror = row.querySelector('.ip-standard-value-print');
      if (!field || !mirror) return;
      mirror.textContent = field.tagName === 'SELECT'
        ? (field.selectedOptions[0]?.textContent || field.value)
        : (field.value || '');
      copyTextStyle(mirror, getComputedStyle(field));
    });
    document.querySelectorAll('#condIpBox .ip-custom-cond-row').forEach(row => {
      const label = row.querySelector('.ip-cond-lbl-input');
      const value = row.querySelector('.ip-cond-val-input');
      const labelMirror = row.querySelector('.ip-cond-label-print');
      const valueMirror = row.querySelector('.ip-cond-value-print');
      if (labelMirror) {
        // The screen editor suppresses an extra colon for labels that already end with ':'.
        // Preserve the user's own punctuation in the live/printed mirror.
        labelMirror.textContent = label?.value || '';
        copyTextStyle(labelMirror, document.body.classList.contains('is-ip-glazyrin') ? labelStyle : getComputedStyle(label));
      }
      if (valueMirror) {
        valueMirror.textContent = value?.value || '';
        copyTextStyle(valueMirror, document.body.classList.contains('is-ip-glazyrin') ? valueStyle : getComputedStyle(value));
      }
    });

    const isIp = isSoleProprietor();
    const clientText = isIp ? document.getElementById('clientBoxIp')?.value : document.getElementById('clientBox')?.value;
    const clientBoxOoo = document.getElementById('clientContainerOoo');
    const clientBoxIp = document.getElementById('clientContainerIp');

    const isEmpty = !clientText || !clientText.trim();
    // Plain text occupies the same line box as "Заказчику:" in printed ООО/Захаров.
    // Keep the editable textarea untouched on screen and preserve line breaks.
    if (clientBoxOoo) {
      const mirror = clientBoxOoo.querySelector('.client-print-value');
      if (mirror) mirror.textContent = document.getElementById('clientBox')?.value || '';
      clientBoxOoo.classList.toggle('print-hide-client', isEmpty);
    }
    if (clientBoxIp) {
      const mirror = clientBoxIp.querySelector('.client-print-value');
      if (mirror) mirror.textContent = document.getElementById('clientBoxIp')?.value || '';
      clientBoxIp.classList.toggle('print-hide-client', isEmpty);
    }
  }

  let presentationSyncFrame = 0;
  function queueDocumentPresentationSync() {
    if (presentationSyncFrame) return;
    presentationSyncFrame = requestAnimationFrame(() => {
      presentationSyncFrame = 0;
      syncDocumentPresentation();
    });
  }

  function prepareForPrint() {
    syncDocumentPresentation();
    // Preserve established print defaults without ever changing form data in
    // the live preview sync above. Validation and export still happen normally.
    document.querySelectorAll('#tableBody tr').forEach(row => {
      const countryInp = row.querySelector('.col-country');
      if (countryInp && !countryInp.value.trim()) countryInp.value = 'Китай';
      const qtyInp = row.querySelector('.col-qty');
      if (qtyInp && !qtyInp.value.trim()) qtyInp.value = '1';
    });
  }

  function updatePrefixFromDateString(str) {
    if (!str) return;
    let monthIndex = -1;
    const lower = str.toLowerCase();
    for (let i = 0; i < MONTHS_GENITIVE.length; i++) {
      if (lower.indexOf(MONTHS_GENITIVE[i]) !== -1) {
        monthIndex = i;
        break;
      }
    }

    const dayMatch = str.match(/\b([0-3]?[0-9])\b/);
    if (monthIndex !== -1 && dayMatch) {
      const mStr = String(monthIndex + 1).padStart(2, '0');
      const dStr = String(dayMatch[1]).padStart(2, '0');
      const pfx = `${mStr}-${dStr}/`;
      const prefixEl = document.getElementById('kpPrefix');
      if (prefixEl) prefixEl.textContent = pfx;
    }
  }

  function onDateInput(input) {
    const isIp = isSoleProprietor();
    if (!isIp) {
      updatePrefixFromDateString(input.value);
    }
    const other = isIp ? document.getElementById('docDate') : document.getElementById('docDateIp');
    if (other) other.value = input.value;
    updateDocumentTitle();
    saveState();
  }

  function setDateAndPrefixes() {
    const now = new Date();
    const monthNum = String(now.getMonth() + 1).padStart(2, '0');
    const dayNum = String(now.getDate()).padStart(2, '0');
    
    const pfx = `${monthNum}-${dayNum}/`;
    const kpPrefix = document.getElementById('kpPrefix');
    if (kpPrefix) kpPrefix.textContent = pfx;

    const dStr = `${dayNum} ${MONTHS_GENITIVE[now.getMonth()]} ${now.getFullYear()} года`;
    
    const dOoo = document.getElementById('docDate');
    if (dOoo) dOoo.value = dStr;
    const dIp = document.getElementById('docDateIp');
    if (dIp) dIp.value = dStr;
  }

  // DOCX import: read only the main document, never comments, styling or HTML.
  function parseEquipmentXml(xml) {
    const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length || !doc.getElementsByTagNameNS(ns, 'body').length) throw new Error('Не удалось прочитать структуру Word.');
    const all = (node, name) => Array.from(node.getElementsByTagNameNS(ns, name));
    const children = (node, name) => Array.from(node.children).filter(el => el.namespaceURI === ns && el.localName === name);
    const cellText = cell => {
      const walk = node => {
        if (node.namespaceURI === ns) {
          if (['del', 'moveFrom', 'drawing', 'pict'].includes(node.localName)) return '';
          if (node.localName === 't') return node.textContent;
          if (['br', 'cr'].includes(node.localName)) return '\n';
          if (node.localName === 'tab') return '\t';
        }
        const text = Array.from(node.childNodes).map(walk).join('');
        return text + (node.namespaceURI === ns && node.localName === 'p' ? '\n' : '');
      };
      return walk(cell).replace(/\u00a0/g, ' ').trim();
    };
    const normalize = text => text.toLowerCase().replace(/ё/g, 'е').replace(/[^а-яa-z0-9]/g, '');
    const columns = cells => {
      const names = cells.map(normalize);
      return {
        name: names.findIndex(s => /наименование|названиетовара|оборудование/.test(s)),
        desc: names.findIndex(s => /характеристик|описание|параметры/.test(s)),
        country: names.findIndex(s => /страна|происхождение/.test(s)),
        qty: names.findIndex(s => /количество|колво/.test(s)),
        price: names.findIndex(s => /цена|стоимостьзаед/.test(s) && !/сумма|общая/.test(s))
      };
    };
    const number = text => {
      const clean = text.replace(/\s/g, '').replace(/(?:руб\.?|₽|шт\.?|штук[аи]?|ед\.?)$/i, '').replace(',', '.');
      return /^\d+(?:\.\d+)?$/.test(clean) ? Number(clean) : NaN;
    };
    const rows = [], warnings = [];
    for (const table of all(doc, 'tbl')) {
      // Nested tables are part of the enclosing description, not extra equipment.
      let parent = table.parentElement, nested = false;
      while (parent) { if (parent.localName === 'tbl') nested = true; parent = parent.parentElement; }
      if (nested) continue;
      let map = null;
      for (const tr of children(table, 'tr')) {
        const cells = [];
        for (const tc of children(tr, 'tc')) {
          cells.push(cellText(tc));
          const span = Number(all(tc, 'gridSpan')[0]?.getAttributeNS(ns, 'val') || 1);
          for (let i = 1; i < Math.min(span, 100); i++) cells.push('');
        }
        const header = columns(cells);
        if (header.name >= 0 && header.qty >= 0) { map = header; continue; }
        if (!map || !cells.some(Boolean) || /^(итого|всего|общая стоимость)(?:\s|:|$)/i.test(cells.find(Boolean) || '')) continue;
        // Word forms often repeat a technical row numbering the columns 1…N.
        // Match the complete sequence, never just a numeric product name.
        const isColumnNumbering = cells.length >= 3 && cells.every((text, index) =>
          text.trim() === String(index + 1));
        if (isColumnNumbering) continue;
        const name = cells[map.name]?.trim();
        if (!name) { warnings.push('Пропущена строка без наименования.'); continue; }
        const qty = number(cells[map.qty] || '');
        if (!Number.isSafeInteger(qty) || qty < 1 || qty > 1000000) throw new Error(`Проверьте количество у «${name.slice(0, 70)}»: требуется целое число от 1 до 1 000 000.`);
        let price = map.price < 0 || !cells[map.price]?.trim() ? 0 : number(cells[map.price]);
        if (!Number.isFinite(price) || price < 0 || price > 1e12) throw new Error(`Не удалось распознать цену у «${name.slice(0, 70)}».`);
        rows.push({name, desc: cells[map.desc] || '', country: cells[map.country] || '', qty, price});
        if (rows.length > 300) throw new Error('За один раз можно импортировать не более 300 позиций.');
      }
    }
    if (!rows.length) throw new Error('Таблица оборудования не найдена. Нужны столбцы «Наименование» и «Количество».');
    return {rows, warnings};
  }

  function initEquipmentImport() {
    const picker = document.getElementById('equipmentFile');
    const dialog = document.getElementById('equipmentImportDialog');
    const status = document.getElementById('equipmentImportStatus');
    const apply = document.getElementById('equipmentImportApply');
    const preview = document.getElementById('equipmentImportPreview');
    let pending = null, undo = null, generation = 0;
    document.addEventListener('equipment-import-reset', () => {
      undo = null; pending = null; generation++;
      if (dialog.open) dialog.close();
      document.getElementById('btnUndoEquipmentImport').hidden = true;
      document.getElementById('equipmentImportNotice').textContent = '';
    });
    const readRows = () => Array.from(document.querySelectorAll('#tableBody tr'), row => ({
      name: row.querySelector('.col-name').value, desc: row.querySelector('.col-desc').value,
      country: row.querySelector('.col-country').value, qty: row.querySelector('.col-qty').value,
      price: row.querySelector('.col-price').getAttribute('data-raw') || 0
    }));
    const writeRows = rows => {
      const tbody = document.getElementById('tableBody');
      const template = tbody.firstElementChild.cloneNode(true);
      const fragment = document.createDocumentFragment();
      rows.forEach((data, i) => {
        const row = template.cloneNode(true);
        row.querySelector('.row-idx').textContent = i + 1;
        for (const field of ['name', 'desc', 'country', 'qty']) row.querySelector('.col-' + field).value = data[field];
        row.querySelectorAll('.print-text-mirror').forEach(el => el.textContent = '');
        const price = row.querySelector('.col-price');
        price.dataset.raw = data.price;
        price.value = Number(data.price) ? fmt(Number(data.price)) : '';
        fragment.appendChild(row);
      });
      tbody.replaceChildren(fragment);
      initAutoResize(); recalc(); saveState();
    };
    document.getElementById('btnImportEquipment').addEventListener('click', () => picker.click());
    document.getElementById('equipmentImportCancel').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { pending = null; generation++; });
    picker.addEventListener('change', async () => {
      const file = picker.files[0]; picker.value = '';
      if (!file) return;
      const ticket = ++generation;
      pending = null; apply.disabled = true; preview.replaceChildren();
      status.textContent = 'Чтение файла…';
      document.getElementById('equipmentImportFileName').textContent = file.name;
      document.getElementById('equipmentImportMode').value = 'append';
      dialog.showModal();
      try {
        if (!/\.docx$/i.test(file.name)) throw new Error('Выберите файл .docx. Старый формат .doc, PDF и Excel пока не поддерживаются.');
        if (file.size > 10 * 1024 * 1024) throw new Error('Файл слишком большой. Максимум — 10 МБ.');
        if (!window.JSZip) throw new Error('Модуль чтения Word не загрузился. Обновите страницу и повторите попытку.');
        const zip = await JSZip.loadAsync(await file.arrayBuffer());
        const entry = zip.file('word/document.xml');
        if (!entry) throw new Error('В файле нет документа Word. Проверьте формат файла.');
        // Stream with a hard decompressed limit instead of materializing an unbounded XML string.
        const xml = await new Promise((resolve, reject) => {
          let text = '', size = 0;
          const stream = entry.internalStream('string');
          stream.on('data', chunk => {
            size += chunk.length;
            if (size > 8 * 1024 * 1024) { stream.pause(); reject(new Error('Документ содержит слишком много текста (более 8 МБ).')); return; }
            text += chunk;
          }).on('error', reject).on('end', () => resolve(text)).resume();
        });
        if (!dialog.open || ticket !== generation) return;
        const result = parseEquipmentXml(xml);
        pending = result.rows;
        const noPrice = pending.filter(row => !row.price).length;
        status.textContent = `Найдено позиций: ${pending.length}.` + (noPrice ? ` Без цены: ${noPrice} — укажите цены после импорта.` : '') + (result.warnings.length ? ` Предупреждения: ${result.warnings.join(' ')}` : '');
        pending.forEach((row, index) => {
          const tr = document.createElement('tr');
          [index + 1, row.name, row.desc, row.country, row.qty, fmt(row.price)].forEach(value => {
            const td = document.createElement('td'); td.textContent = value; tr.appendChild(td);
          });
          preview.appendChild(tr);
        });
        apply.disabled = false;
      } catch (error) {
        if (dialog.open && ticket === generation) status.textContent = error.message && !/zip|signature|end of data/i.test(error.message) ? error.message : 'Не удалось открыть файл. Возможно, он повреждён или защищён паролем.';
      }
    });
    apply.addEventListener('click', () => {
      if (!pending) return;
      const old = readRows();
      const existing = old.filter(row => row.name.trim() || row.desc.trim() || Number(row.price));
      const rows = document.getElementById('equipmentImportMode').value === 'replace' ? pending : existing.concat(pending);
      if (rows.length > 300) { status.textContent = 'Всего получится более 300 позиций. Выберите замену таблицы.'; return; }
      undo = old;
      writeRows(rows);
      document.getElementById('equipmentImportNotice').textContent = `Импортировано позиций: ${pending.length}. Проверьте цены перед отправкой КП.`;
      document.getElementById('btnUndoEquipmentImport').hidden = false;
      dialog.close();
    });
    document.getElementById('btnUndoEquipmentImport').addEventListener('click', () => {
      if (!undo) return;
      if (!confirm('Вернуть таблицу к состоянию до последнего импорта? Последующие изменения таблицы будут отменены.')) return;
      writeRows(undo); undo = null;
      document.getElementById('btnUndoEquipmentImport').hidden = true;
      document.getElementById('equipmentImportNotice').textContent = 'Импорт отменён.';
    });
  }

  function addRow(focusNew = false) {
    const tbody = document.getElementById('tableBody');
    const idx = tbody.children.length + 1;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="c col-num-cell row-idx">${idx}</td>
      <td class="col-text-cell">
        <textarea class="auto-grow col-name" placeholder="Впиши наименование"></textarea>
        <div class="print-text-mirror"></div>
      </td>
      <td class="col-text-cell">
        <textarea class="auto-grow col-desc" placeholder="впиши характеристики"></textarea>
        <div class="print-text-mirror"></div>
      </td>
      <td class="c col-num-cell"><input type="text" class="inp-text c col-country" placeholder="Китай" value="Китай"></td>
      <td class="c col-num-cell"><input type="number" class="inp-qty col-qty" min="1" step="1" placeholder="1"></td>
      <td class="c col-num-cell">
        <input type="text" class="inp-text r col-price" placeholder="500,00" data-raw="0" value="">
      </td>
      <td class="r col-num-cell col-total">0,00</td>
      <td class="no-print c" style="border:none;"><button type="button" class="btn-del">✕</button></td>
    `;
    tbody.appendChild(tr);
    initAutoResize();
    recalc();
    saveState();
    if (focusNew) tr.querySelector('.col-name').focus();
  }

  function deleteRow(btn) {
    const tbody = document.getElementById('tableBody');
    if (tbody.children.length > 1) {
      btn.closest('tr').remove();
    } else {
      const row = tbody.children[0];
      row.querySelectorAll('textarea, input').forEach(input => input.value = '');
      row.querySelector('.col-country').value = 'Китай';
      row.querySelector('.col-price').setAttribute('data-raw', 0);
    }
    document.querySelectorAll('#tableBody tr').forEach((row, i) => {
      row.querySelector('.row-idx').textContent = i + 1;
    });
    recalc();
    saveState();
  }

  function splitRubKop(amount) {
    const totalKop = Math.round((amount + Number.EPSILON) * 100);
    const rub = Math.floor(totalKop / 100);
    const kop = totalKop % 100;
    return { rub, kop };
  }

  function recalc() {
    const company = activeCompany();
    const isGlazyrin = document.getElementById('companySelect').value === 'ip-glazyrin';
    const valid = validateEquipment();
    let grandTotal = 0;
    document.querySelectorAll('#tableBody tr').forEach(row => {
      const qVal = row.querySelector('.col-qty').value;
      const q = qVal === '' ? 1 : Number(qVal);
      const priceInput = row.querySelector('.col-price');
      const p = parseNum(priceInput.getAttribute('data-raw') || priceInput.value);
      if (row.querySelector('[aria-invalid="true"]')) { row.querySelector('.col-total').textContent = '—'; return; }
      const tot = Math.round((q * p + Number.EPSILON) * 100) / 100;
      row.querySelector('.col-total').textContent = fmt(tot);
      grandTotal += tot;
    });

    if (!valid) {
      document.getElementById('grandTotal').textContent = '—';
      document.getElementById('textTotalBlock').textContent = 'Проверьте выделенные количество и цену. Экспорт недоступен до исправления.';
      return;
    }
    document.getElementById('grandTotal').textContent = fmt(grandTotal);

    const vat = grandTotal > 0 && company.vatRate ? (grandTotal * company.vatRate / company.vatDivisor) : 0;

    const t = splitRubKop(grandTotal);
    const v = splitRubKop(vat);

    const tRubW = num2words(t.rub, false);
    const tRubDecl = decl(t.rub, ['рубль', 'рубля', 'рублей']);
    const tKopDecl = decl(t.kop, ['копейка', 'копейки', 'копеек']);

    const vRubW = num2words(v.rub, false);
    const vRubDecl = decl(v.rub, ['рубль', 'рубля', 'рублей']);
    const vKopDecl = decl(v.kop, ['копейка', 'копейки', 'копеек']);

    const vatPhrase = isGlazyrin
      ? '<b>НДС не облагается</b>'
      : `<b>в том числе НДС ${company.vatRate}% — ${fmtInt(v.rub)} (${vRubW}) ${vRubDecl} ${String(v.kop).padStart(2, '0')} ${vKopDecl}</b>`;

    document.getElementById('textTotalBlock').innerHTML =
      `<b>ИТОГО: ${fmtInt(t.rub)} (${tRubW}) ${tRubDecl} ${String(t.kop).padStart(2, '0')} ${tKopDecl}</b>, ${vatPhrase}.`;
  }

  function updateDocumentTitle() {
    const company = activeCompany();
    const isIp = company.kind === 'ip';
    const clientVal = isIp ? document.getElementById('clientBoxIp').value : document.getElementById('clientBox').value;
    let org = company.name;
    if (clientVal) {
      const first = clientVal.split('\n')[0].replace(/["'«»\\/:*?<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (first) org = first;
    }
    
    let fullNum = '';
    if (isIp) {
      const numInputIp = document.getElementById('kpNumInputIp');
      fullNum = (numInputIp?.value || '').trim().replace(/[\/\\]/g, '-');
    } else {
      const prefixEl = document.getElementById('kpPrefix');
      const prefix = prefixEl ? prefixEl.textContent.replace(/[\/\\]/g, '-').trim() : '';
      const numInput = document.getElementById('kpNumInput');
      const numVal = (numInput?.value || '1').trim().replace(/[\/\\]/g, '-');
      fullNum = (prefix + numVal).replace(/-+/g, '-');
    }
    
    document.title = `КП-${org}-${fullNum || '1'}`;
  }

  function clearForm() {
    if (!confirm('Вы уверены, что хотите полностью очистить бланк?')) return;
    localStorage.removeItem(STORAGE_KEY);
    ipConditionsByCompany = {};
    applyDeletedStandardConditions([]);
    document.dispatchEvent(new Event('equipment-import-reset'));
    
    document.getElementById('clientBox').value = '';
    document.getElementById('clientBoxIp').value = '';
    document.getElementById('kpNumInput').value = '1';
    document.getElementById('kpNumInputIp').value = '';
    setDateAndPrefixes();

    document.getElementById('deliveryDaysInput').value = '5-10';
    document.getElementById('deliveryUnitSelect').value = 'work_days';
    document.getElementById('condOooDeliveryTime').value = DEFAULT_DELIVERY_TIME_OOO;
    document.getElementById('condOooPay').value = DEFAULT_PAY_OOO;
    document.getElementById('deliverySelectOoo').value = DEFAULT_DELIVERY_TYPE_OOO;
    document.getElementById('condOooWarranty').value = DEFAULT_WARRANTY_OOO;

    document.querySelectorAll('#condOooTbody tr.custom-cond-row').forEach(tr => tr.remove());
    document.getElementById('condIpCustomList').innerHTML = '';
    document.getElementById('condIpCustomList2').innerHTML = '';

    document.getElementById('ipDeliveryTime').value = '1-2 недели';
    document.getElementById('deliverySelectIp').value = 'Доставка включена в стоимость';
    document.getElementById('ipPaymentTerms').value = 'По согласованию';
    document.getElementById('ipWarrantyTerms').value = 'Согласно документации производителя';
    document.getElementById('ipServiceTerms').value = 'По отдельному согласованию';
    document.getElementById('ipValidityTerms').value = 'До согласования заказа';
    document.getElementById('ipAppendixTerms').value = 'Спецификация и техническое описание предоставляются по запросу';

    document.getElementById('calcCostVat').value = '';
    document.getElementById('calcFinDaysInput').value = '0';
    document.getElementById('calcDeliveryCost').value = '';
    document.getElementById('calcProfitTarget').value = '';

    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = `
      <tr>
        <td class="c col-num-cell row-idx">${1}</td>
        <td class="col-text-cell">
          <textarea class="auto-grow col-name" placeholder="Впиши наименование"></textarea>
          <div class="print-text-mirror"></div>
        </td>
        <td class="col-text-cell">
          <textarea class="auto-grow col-desc" placeholder="впиши характеристики"></textarea>
          <div class="print-text-mirror"></div>
        </td>
        <td class="c col-num-cell"><input type="text" class="inp-text c col-country" placeholder="Китай" value="Китай"></td>
        <td class="c col-num-cell"><input type="number" class="inp-qty col-qty" min="1" step="1" placeholder="1"></td>
        <td class="c col-num-cell">
          <input type="text" class="inp-text r col-price" placeholder="500,00" data-raw="0" value="">
        </td>
        <td class="r col-num-cell col-total">0,00</td>
        <td class="no-print c" style="border:none;"><button type="button" class="btn-del">✕</button></td>
      </tr>
    `;

    initAutoResize();
    calculateMargin();
    recalc();
    updateDocumentTitle();
    saveState();
  }

  function saveState() {
    if (restoringState) return;
    queueDocumentPresentationSync();
    try {
      const rows = [];
      document.querySelectorAll('#tableBody tr').forEach(row => {
        rows.push({
          name: row.querySelector('.col-name').value,
          desc: row.querySelector('.col-desc').value,
          country: row.querySelector('.col-country').value,
          qty: row.querySelector('.col-qty').value,
          price: row.querySelector('.col-price').getAttribute('data-raw') || 0,
          priceText: row.querySelector('.col-price').value
        });
      });

      const customConds = [];
      document.querySelectorAll('#condOooTbody tr.custom-cond-row').forEach(row => {
        customConds.push({
          lbl: row.querySelector('.cond-lbl-input').value,
          val: row.querySelector('.cond-val').value
        });
      });

      const customCondsIp = [];
      document.querySelectorAll('#condIpBox .ip-custom-cond-row').forEach(row => {
        customCondsIp.push({
          lbl: row.querySelector('.ip-cond-lbl-input').value,
          val: row.querySelector('.ip-cond-val-input').value,
          section: row.dataset.section || ''
        });
      });

      let savedState = {};
      try { savedState = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) {}
      const deletedStandardConditionsByCompany = { ...(savedState.deletedStandardConditionsByCompany || {}) };
      const currentCompany = document.getElementById('companySelect').value;
      if (currentCompany === 'ip-glazyrin') {
        deletedStandardConditionsByCompany[currentCompany] = [...document.querySelectorAll('#condIpBox .ip-term-row.is-deleted input[id]')].map(input => input.id);
      }
      if (currentCompany !== 'ooo') ipConditionsByCompany[currentCompany] = captureIpConditions();
      const state = {
        ipConditionsByCompany,
        company: currentCompany,
        kpNumOoo: document.getElementById('kpNumInput').value,
        kpNumIp: document.getElementById('kpNumInputIp').value,
        docDateOoo: document.getElementById('docDate').value,
        docDateIp: document.getElementById('docDateIp').value,
        clientOoo: document.getElementById('clientBox').value,
        clientIp: document.getElementById('clientBoxIp').value,
        condOoo: [
          document.getElementById('condOooDeliveryTime').value,
          document.getElementById('condOooPay').value,
          document.getElementById('deliverySelectOoo').value,
          document.getElementById('condOooWarranty').value
        ],
        deliveryDaysInput: document.getElementById('deliveryDaysInput')?.value || '5-10',
        deliveryUnitSelect: document.getElementById('deliveryUnitSelect')?.value || 'work_days',
        customConds: customConds,
        customCondsIp: customCondsIp,
        deletedStandardConditionsByCompany,
        condIp: [
          document.getElementById('ipDeliveryTime').value,
          document.getElementById('deliverySelectIp').value,
          document.getElementById('ipPaymentTerms').value,
          document.getElementById('ipWarrantyTerms').value,
          document.getElementById('ipServiceTerms').value,
          document.getElementById('ipValidityTerms').value,
          document.getElementById('ipAppendixTerms').value
        ],
        calcCostVat: document.getElementById('calcCostVat').value,
        calcFinDays: document.getElementById('calcFinDaysInput').value,
        calcDeliveryCost: document.getElementById('calcDeliveryCost').value,
        calcProfitTarget: document.getElementById('calcProfitTarget').value,
        calcMarginMode: currentMarginMode,
        calcFinMode: currentFinMode,
        rows: rows
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { console.warn(e); }
  }

  function loadState() {
    restoringState = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        document.getElementById('condOooDeliveryTime').value = DEFAULT_DELIVERY_TIME_OOO;
        document.getElementById('condOooPay').value = DEFAULT_PAY_OOO;
        document.getElementById('deliverySelectOoo').value = DEFAULT_DELIVERY_TYPE_OOO;
        document.getElementById('condOooWarranty').value = DEFAULT_WARRANTY_OOO;
        return false;
      }
      const state = JSON.parse(raw);
      ipConditionsByCompany = state.ipConditionsByCompany || {};
      if (!state.ipConditionsByCompany) {
        // Legacy shared terms belong to the last selected IP only; do not duplicate them.
        const owner = state.company === 'ip-glazyrin' ? 'ip-glazyrin' : 'ip';
        ipConditionsByCompany[owner] = { values: state.condIp || defaultIpTerms, custom: state.customCondsIp || [], deleted: owner === 'ip-glazyrin' ? (state.deletedStandardConditionsByCompany?.[owner] || state.deletedStandardConditions || []) : [] };
      }

      if (state.company) {
        document.getElementById('companySelect').value = state.company;
      }
      if (state.kpNumOoo) document.getElementById('kpNumInput').value = state.kpNumOoo;
      if (state.kpNumIp !== undefined) document.getElementById('kpNumInputIp').value = state.kpNumIp;
      if (state.docDateOoo) document.getElementById('docDate').value = state.docDateOoo;
      if (state.docDateIp) document.getElementById('docDateIp').value = state.docDateIp;
      if (state.clientOoo) document.getElementById('clientBox').value = state.clientOoo;
      if (state.clientIp) document.getElementById('clientBoxIp').value = state.clientIp;

      if (state.condOoo && Array.isArray(state.condOoo)) {
        document.getElementById('condOooDeliveryTime').value = (state.condOoo[0] && state.condOoo[0].trim()) ? state.condOoo[0] : DEFAULT_DELIVERY_TIME_OOO;
        document.getElementById('condOooPay').value = (state.condOoo[1] && state.condOoo[1].trim()) ? state.condOoo[1] : DEFAULT_PAY_OOO;
        document.getElementById('deliverySelectOoo').value = (state.condOoo[2] && state.condOoo[2].trim()) ? state.condOoo[2] : DEFAULT_DELIVERY_TYPE_OOO;
        document.getElementById('condOooWarranty').value = (state.condOoo[3] && state.condOoo[3].trim()) ? state.condOoo[3] : DEFAULT_WARRANTY_OOO;
      } else {
        document.getElementById('condOooDeliveryTime').value = DEFAULT_DELIVERY_TIME_OOO;
        document.getElementById('condOooPay').value = DEFAULT_PAY_OOO;
        document.getElementById('deliverySelectOoo').value = DEFAULT_DELIVERY_TYPE_OOO;
        document.getElementById('condOooWarranty').value = DEFAULT_WARRANTY_OOO;
      }

      if (state.deliveryDaysInput) document.getElementById('deliveryDaysInput').value = state.deliveryDaysInput;
      if (state.deliveryUnitSelect) document.getElementById('deliveryUnitSelect').value = state.deliveryUnitSelect;

      document.querySelectorAll('#condOooTbody tr.custom-cond-row').forEach(tr => tr.remove());
      if (state.customConds && state.customConds.length > 0) {
        state.customConds.forEach(c => addCondRowOoo(c.lbl, c.val));
      }

      document.getElementById('condIpCustomList').innerHTML = '';
      document.getElementById('condIpCustomList2').innerHTML = '';
      if (state.customCondsIp && state.customCondsIp.length > 0) {
        state.customCondsIp.forEach(c => addCondRowIp(c.lbl, c.val, c.section || undefined));
      }
      renumberGlazyrinConditions();

      if (state.condIp && Array.isArray(state.condIp)) {
        document.getElementById('ipDeliveryTime').value = (state.condIp[0] && state.condIp[0].trim()) ? state.condIp[0] : '1-2 недели';
        document.getElementById('deliverySelectIp').value = (state.condIp[1] && state.condIp[1].trim()) ? state.condIp[1] : 'Доставка включена в стоимость';
        document.getElementById('ipPaymentTerms').value = state.condIp[2] || 'По согласованию';
        document.getElementById('ipWarrantyTerms').value = state.condIp[3] || 'Согласно документации производителя';
        document.getElementById('ipServiceTerms').value = state.condIp[4] || 'По отдельному согласованию';
        document.getElementById('ipValidityTerms').value = state.condIp[5] || 'До согласования заказа';
        document.getElementById('ipAppendixTerms').value = state.condIp[6] || 'Спецификация и техническое описание предоставляются по запросу';
      }

      if (state.calcCostVat) document.getElementById('calcCostVat').value = state.calcCostVat;
      if (state.calcFinDays) document.getElementById('calcFinDaysInput').value = state.calcFinDays;
      if (state.calcDeliveryCost) document.getElementById('calcDeliveryCost').value = state.calcDeliveryCost;
      if (state.calcProfitTarget) document.getElementById('calcProfitTarget').value = state.calcProfitTarget;
      if (state.calcMarginMode) setMarginMode(state.calcMarginMode);
      if (state.calcFinMode) setFinMode(state.calcFinMode);

      if (state.rows && state.rows.length > 0) {
        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = '';
        state.rows.forEach((rData, i) => {
          const tr = document.createElement('tr');
          const pNum = parseNum(rData.price);
          tr.innerHTML = `
            <td class="c col-num-cell row-idx">${i + 1}</td>
            <td class="col-text-cell">
              <textarea class="auto-grow col-name" placeholder="Впиши наименование">${escapeHtml(rData.name || '')}</textarea>
              <div class="print-text-mirror"></div>
            </td>
            <td class="col-text-cell">
              <textarea class="auto-grow col-desc" placeholder="впиши характеристики">${escapeHtml(rData.desc || '')}</textarea>
              <div class="print-text-mirror"></div>
            </td>
            <td class="c col-num-cell"><input type="text" class="inp-text c col-country" placeholder="Китай" value="${escapeHtml(rData.country || 'Китай')}"></td>
            <td class="c col-num-cell"><input type="number" class="inp-qty col-qty" min="1" step="1" placeholder="1" value="${escapeHtml(rData.qty || '')}"></td>
            <td class="c col-num-cell">
              <input type="text" class="inp-text r col-price" placeholder="500,00" data-raw="${escapeHtml(String(rData.price ?? 0))}" value="${escapeHtml(rData.priceText ?? (pNum > 0 ? fmt(pNum) : ''))}">
            </td>
            <td class="r col-num-cell col-total">0,00</td>
            <td class="no-print c" style="border:none;"><button type="button" class="btn-del">✕</button></td>
          `;
          tbody.appendChild(tr);
        });
      }
      return true;
    } catch (e) { return false; } finally { restoringState = false; }
  }

  function prepareAndPrint() {
    if (!validateEquipment(true)) return;
    initAutoResize();
    recalc();
    prepareForPrint();
    updateDocumentTitle();
    window.print();
  }

  // ==========================================
  // ВЫГРУЗКА В WORD (.DOCX)
  // ==========================================
  function cleanTextForXml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  function downloadBlobSafe(blob, filename) {
    if (typeof window.saveAs === 'function') {
      window.saveAs(blob, filename);
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
  }

  async function getImageBufferFromElement(imgElement, fallbackSrc) {
    if (imgElement && imgElement.complete && imgElement.naturalWidth > 0) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = imgElement.naturalWidth;
        canvas.height = imgElement.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgElement, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
      } catch (e) {
        console.warn('Canvas export failed, trying fetch:', e);
      }
    }

    try {
      const response = await fetch(fallbackSrc);
      if (response.ok) {
        const blob = await response.blob();
        return await blob.arrayBuffer();
      }
    } catch (err) {
      console.warn('Fetch fallback failed:', fallbackSrc, err);
    }
    return null;
  }

  async function exportToWord() {
    if (!validateEquipment(true)) return;
    const docxLib = window.docx;
    if (!docxLib || !docxLib.Document) {
      alert('Библиотека Word не загрузилась. Попробуйте сохранить через кнопку PDF / Печать.');
      return;
    }

    initAutoResize();
    recalc();
    updateDocumentTitle();

    const {
      Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
      WidthType, AlignmentType, VerticalAlign, BorderStyle, ShadingType, 
      ImageRun, TabStopType, Footer, PageNumber
    } = docxLib;

    const company = activeCompany();
    const isIp = company.kind === 'ip';
    const isGlazyrin = document.getElementById('companySelect').value === 'ip-glazyrin';
    const clientVal = cleanTextForXml((isIp ? document.getElementById('clientBoxIp')?.value : document.getElementById('clientBox')?.value) || '');
    const dateVal = cleanTextForXml((isIp ? document.getElementById('docDateIp')?.value : document.getElementById('docDate')?.value) || '');
    
    let fullNum = '';
    if (isIp) {
      fullNum = cleanTextForXml((document.getElementById('kpNumInputIp')?.value || '').trim());
    } else {
      const pfx = document.getElementById('kpPrefix')?.textContent || '';
      const num = document.getElementById('kpNumInput')?.value || '1';
      fullNum = cleanTextForXml(pfx + num);
    }

    const tableBorders = {
      top: { style: BorderStyle.SINGLE, size: 4, color: isGlazyrin ? "9AA2AA" : "000000" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: isGlazyrin ? "9AA2AA" : "000000" },
      left: { style: BorderStyle.SINGLE, size: 4, color: isGlazyrin ? "9AA2AA" : "000000" },
      right: { style: BorderStyle.SINGLE, size: 4, color: isGlazyrin ? "9AA2AA" : "000000" }
    };

    const noBorder = () => ({ style: BorderStyle.NONE, size: 0, color: "FFFFFF" });
    const transparentCellBorders = {
      top: noBorder(),
      bottom: noBorder(),
      left: noBorder(),
      right: noBorder()
    };
    const transparentBorders = {
      ...transparentCellBorders,
      insideHorizontal: noBorder(),
      insideVertical: noBorder()
    };

    const docElements = [];

    // 1. Шапка документа
    if (!isIp) {
      const logoEl = document.getElementById('logoImgOoo');
      const logoBuffer = await getImageBufferFromElement(logoEl, 'logo.webp');

      const leftCellChildren = [];
      if (logoBuffer) {
        leftCellChildren.push(new Paragraph({
          spacing: { after: 120 },
          children: [
            new ImageRun({
              data: logoBuffer,
              transformation: { width: 300, height: 81 }
            })
          ]
        }));
      } else {
        leftCellChildren.push(new Paragraph({
          children: [new TextRun({ text: "РТСТАНДАРТ", bold: true, size: 28, font: "Times New Roman" })]
        }));
      }

      leftCellChildren.push(
        new Paragraph({
          spacing: { line: 240 },
          children: [
            new TextRun({ text: `КП № ${fullNum}`, bold: true, size: 22, font: "Times New Roman" })
          ]
        }),
        new Paragraph({
          spacing: { line: 240 },
          children: [
            new TextRun({ text: `От ${dateVal}`, size: 22, font: "Times New Roman" })
          ]
        })
      );

      const rightCellChildren = [
        new Paragraph({
          spacing: { before: 100, line: 240 },
          children: [
            new TextRun({ text: "ООО \"РТСТАНДАРТ\"", bold: true, size: 23, font: "Times New Roman" }),
            new TextRun({ text: "г. Санкт-Петербург, наб. Обводного канала, д. 23, лит. Г", break: 1, size: 21, font: "Times New Roman" }),
            new TextRun({ text: "ИНН 7842228552", break: 1, size: 21, font: "Times New Roman" }),
            new TextRun({ text: "+7 (812) 983-44-33", break: 1, size: 21, font: "Times New Roman" })
          ]
        })
      ];

      if (clientVal.trim()) {
        const clientLines = clientVal.split('\n');
        rightCellChildren.push(new Paragraph({
          // Align with the left metadata row while keeping the customer on one line.
          spacing: { before: 220, line: 240 },
          children: [
            new TextRun({ text: "Заказчику: ", size: 21, font: "Times New Roman" }),
            ...clientLines.map((line, index) => new TextRun({
              text: line,
              break: index > 0 ? 1 : 0,
              size: 21,
              font: "Times New Roman"
            }))
          ]
        }));
      }

      docElements.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: transparentBorders,
        rows: [
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: { size: 4800, type: WidthType.DXA },
                borders: transparentCellBorders,
                verticalAlign: VerticalAlign.TOP,
                children: leftCellChildren
              }),
              new TableCell({
                width: { size: 4800, type: WidthType.DXA },
                borders: transparentCellBorders,
                verticalAlign: VerticalAlign.TOP,
                children: rightCellChildren
              })
            ]
          })
        ]
      }));

    } else if (isGlazyrin) {
      const leftHeader = [
        new Paragraph({
          spacing: { after: 40, line: 240 },
          children: [new TextRun({ text: "ИНДИВИДУАЛЬНЫЙ ПРЕДПРИНИМАТЕЛЬ", size: 19, color: "2F5D50", font: "Times New Roman" })]
        }),
        new Paragraph({
          spacing: { after: 80, line: 260 },
          children: [new TextRun({ text: "Глазырин Алексей Алексеевич", bold: true, size: 30, font: "Times New Roman" })]
        }),
        new Paragraph({
          spacing: { line: 240 },
          children: [
            new TextRun({ text: "ИНН: 143533463817", size: 20, font: "Times New Roman" }),
            new TextRun({ text: "ОГРНИП: 326140000064939", break: 1, size: 20, font: "Times New Roman" }),
            new TextRun({ text: "Тел.: +7 966 871-88-61", break: 1, size: 20, font: "Times New Roman" }),
            new TextRun({ text: "Почта: a.glazyrin1198@mail.ru", break: 1, size: 20, font: "Times New Roman" })
          ]
        })
      ];
      const rightHeader = [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 100, line: 240 },
          children: [new TextRun({ text: `КП № ${fullNum}`, bold: true, size: 22, font: "Times New Roman" })]
        }),
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 160, line: 240 },
          children: [new TextRun({ text: `От ${dateVal}`, size: 21, font: "Times New Roman" })]
        })
      ];
      if (clientVal.trim()) {
        rightHeader.push(new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 100, line: 240 },
          children: [
            new TextRun({ text: "Заказчику:", bold: true, size: 21, font: "Times New Roman" }),
            ...clientVal.split('\n').map(line => new TextRun({ text: line, break: 1, size: 21, font: "Times New Roman" }))
          ]
        }));
      }
      docElements.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: transparentBorders,
        rows: [
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: { size: 4800, type: WidthType.DXA },
                borders: { ...transparentCellBorders, bottom: { style: BorderStyle.SINGLE, size: 12, color: '2F5D50' } },
                margins: { top: 0, bottom: 140, left: 0, right: 0 },
                verticalAlign: VerticalAlign.TOP,
                children: leftHeader
              }),
              new TableCell({
                width: { size: 4800, type: WidthType.DXA },
                borders: { ...transparentCellBorders, bottom: { style: BorderStyle.SINGLE, size: 12, color: '2F5D50' } },
                margins: { top: 0, bottom: 140, left: 0, right: 0 },
                verticalAlign: VerticalAlign.TOP,
                children: rightHeader
              })
            ]
          })
        ]
      }));
    } else {
      // Шапка ИП
      docElements.push(new Paragraph({
        spacing: { line: 240, after: 60 },
        children: [
          new TextRun({ text: "Индивидуальный предприниматель Захаров Михаил Сергеевич", bold: true, size: 22, font: "Times New Roman" }),
          new TextRun({ text: "ОГРНИП: 325110000002538", bold: true, break: 1, size: 22, font: "Times New Roman" }),
          new TextRun({ text: " / ", size: 22, font: "Times New Roman" }),
          new TextRun({ text: "ИНН: 110214010407", bold: true, size: 22, font: "Times New Roman" }),
          new TextRun({ text: "Тел.: +7 (981) 208-62-36", break: 1, size: 22, font: "Times New Roman" }),
          new TextRun({ text: "e-mail: m.zakharov0811@gmail.com", break: 1, size: 22, font: "Times New Roman" })
        ],
        border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: "000000", space: 4 } }
      }));

      const ipMetaChildren = [
        new TextRun({ text: `Исх. № ${fullNum}        От ${dateVal}`, size: 22, font: "Times New Roman" })
      ];

      if (clientVal.trim()) {
        ipMetaChildren.push(
          new TextRun({ text: `\tЗаказчику: ${clientVal.replace(/\n/g, ' ')}`, size: 22, font: "Times New Roman" })
        );
      }

      docElements.push(new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: 9600 }],
        spacing: { before: 120, after: 80, line: 240 },
        children: ipMetaChildren
      }));
    }

    // 2. Заголовок
    docElements.push(new Paragraph({
      alignment: isGlazyrin ? AlignmentType.LEFT : AlignmentType.CENTER,
      spacing: { before: 180, after: 120 },
      children: [new TextRun({ text: company.documentTitle || "КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ", bold: true, size: isGlazyrin ? 25 : 24, color: isGlazyrin ? "1F2937" : "000000", font: isGlazyrin ? "Arial" : "Times New Roman" })]
    }));

    const introText = company.intro;

    docElements.push(new Paragraph({
      alignment: isGlazyrin ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
      indent: isGlazyrin ? undefined : { firstLine: 567 },
      spacing: { after: 140, line: 260 },
      children: [new TextRun({ text: introText, size: isGlazyrin ? 21 : 22, font: isGlazyrin ? "Arial" : "Times New Roman", color: isGlazyrin ? "374151" : "000000" })]
    }));

    const addSectionHeading = (text) => docElements.push(new Paragraph({
      keepNext: true,
      spacing: { before: 140, after: 80 },
      border: isGlazyrin && /^[23]\./.test(text) ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: "A8B9B0", space: 4 } } : undefined,
      children: [new TextRun({ text, bold: true, size: 20, font: isGlazyrin ? "Arial" : "Times New Roman", color: isGlazyrin ? "243B53" : undefined })]
    }));
    if (isGlazyrin) addSectionHeading("1. Перечень предлагаемого оборудования");

    // 3. Таблица спецификации
    const headerBgColor = isGlazyrin ? "F1F3F5" : (isIp ? "FFFFFF" : "ACB9CA");
    const totalBgColor = isGlazyrin ? "F7F8F9" : headerBgColor;
    const priceColTitle = company.priceTitle;
    const sumColTitle = company.sumTitle;

    const colWidths = [
      { dxa: 400 },
      { dxa: 2400 },
      { dxa: 2900 },
      { dxa: 800 },
      { dxa: 700 },
      { dxa: 1100 },
      { dxa: 1300 }
    ];

    const makeHeaderCell = (text, idx) => new TableCell({
      width: { size: colWidths[idx].dxa, type: WidthType.DXA },
      borders: tableBorders,
      shading: { fill: headerBgColor, type: ShadingType.CLEAR },
      verticalAlign: VerticalAlign.TOP,
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, size: 19, color: "1F2937", font: "Times New Roman" })]
      })]
    });

    const tableRows = [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: [
          makeHeaderCell("№", 0),
          makeHeaderCell("Наименование товара", 1),
          makeHeaderCell("Основные характеристики предложенного товара", 2),
          makeHeaderCell("Страна", 3),
          makeHeaderCell("Кол-во", 4),
          makeHeaderCell(priceColTitle, 5),
          makeHeaderCell(sumColTitle, 6)
        ]
      })
    ];

    const htmlRows = document.querySelectorAll('#tableBody tr');
    htmlRows.forEach((tr, i) => {
      const name = cleanTextForXml(tr.querySelector('.col-name')?.value || '');
      const desc = cleanTextForXml(tr.querySelector('.col-desc')?.value || '');
      const country = cleanTextForXml(tr.querySelector('.col-country')?.value || 'Китай');
      const qty = cleanTextForXml(tr.querySelector('.col-qty')?.value || '1');
      const price = cleanTextForXml(tr.querySelector('.col-price')?.value || '0,00');
      const total = cleanTextForXml(tr.querySelector('.col-total')?.textContent || '0,00');

      const makeDataCell = (content, align = AlignmentType.LEFT, idx = 0) => {
        const lines = cleanTextForXml(content).split('\n');
        const runs = lines.map((line, lineIdx) => new TextRun({
          text: line,
          break: lineIdx > 0 ? 1 : 0,
          size: 19,
          font: "Times New Roman"
        }));

        return new TableCell({
          width: { size: colWidths[idx].dxa, type: WidthType.DXA },
          borders: tableBorders,
          verticalAlign: VerticalAlign.TOP,
          children: [new Paragraph({
            alignment: align,
            spacing: { line: 230 },
            children: runs
          })]
        });
      };

      tableRows.push(new TableRow({
        cantSplit: false,
        children: [
          makeDataCell(i + 1, AlignmentType.CENTER, 0),
          makeDataCell(name, AlignmentType.LEFT, 1),
          makeDataCell(desc, AlignmentType.LEFT, 2),
          makeDataCell(country, AlignmentType.CENTER, 3),
          makeDataCell(qty, AlignmentType.CENTER, 4),
          makeDataCell(price, AlignmentType.RIGHT, 5),
          makeDataCell(total, AlignmentType.RIGHT, 6)
        ]
      }));
    });

    const grandTotalVal = cleanTextForXml(document.getElementById('grandTotal')?.textContent || '0,00');
    tableRows.push(new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          columnSpan: 6,
          borders: tableBorders,
          shading: { fill: totalBgColor, type: ShadingType.CLEAR },
          verticalAlign: VerticalAlign.TOP,
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "ИТОГО:", size: 19, font: "Times New Roman" })]
          })]
        }),
        new TableCell({
          borders: tableBorders,
          shading: { fill: totalBgColor, type: ShadingType.CLEAR },
          verticalAlign: VerticalAlign.TOP,
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: grandTotalVal, size: 19, font: "Times New Roman" })]
          })]
        })
      ]
    }));

    docElements.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBorders,
      layout: docxLib.TableLayoutType.FIXED,
      columnWidths: colWidths.map(col => col.dxa),
      rows: tableRows
    }));

    // 4. Сумма прописью
    const textTotalBlock = cleanTextForXml(document.getElementById('textTotalBlock')?.innerText || '');
    docElements.push(new Paragraph({
      spacing: { before: 140, after: 160, line: 260 },
      children: [new TextRun({ text: textTotalBlock, bold: true, size: 22, font: "Times New Roman" })]
    }));

    // 5. Условия сделки
    if (isGlazyrin) addSectionHeading("2. Условия поставки и оплаты");
    if (!isIp) {
      const condFields = [
        { lbl: "Срок поставки", val: cleanTextForXml(document.getElementById('condOooDeliveryTime')?.value || '') },
        { lbl: "Условия оплаты", val: cleanTextForXml(document.getElementById('condOooPay')?.value || '') },
        { lbl: "Доставка", val: cleanTextForXml(document.getElementById('deliverySelectOoo')?.value || '') },
        { lbl: "Гарантия", val: cleanTextForXml(document.getElementById('condOooWarranty')?.value || '') }
      ];

      document.querySelectorAll('#condOooTbody tr.custom-cond-row').forEach(row => {
        condFields.push({
          lbl: cleanTextForXml(row.querySelector('.cond-lbl-input')?.value || 'Дополнительно'),
          val: cleanTextForXml(row.querySelector('.cond-val')?.value || '')
        });
      });

      const condRows = condFields.map(item => {
        const valLines = item.val.split('\n');
        const valRuns = valLines.map((line, lIdx) => new TextRun({
          text: line,
          break: lIdx > 0 ? 1 : 0,
          size: 20,
          font: "Times New Roman"
        }));

        return new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: 2200, type: WidthType.DXA },
              borders: tableBorders,
              shading: { fill: "ACB9CA", type: ShadingType.CLEAR },
              verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ keepNext: true, children: [new TextRun({ text: item.lbl, bold: true, size: 20, font: "Times New Roman" })] })]
            }),
            new TableCell({
              width: { size: 7400, type: WidthType.DXA },
              borders: tableBorders,
              verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ keepNext: true, spacing: { line: 240 }, children: valRuns })]
            })
          ]
        });
      });
      docElements.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        rows: condRows
      }));
    } else if (isGlazyrin) {
      let termRows = [];
      const flushTerms = () => {
        if (!termRows.length) return;
        docElements.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: docxLib.TableLayoutType.FIXED,
          columnWidths: [3264, 6336],
          borders: transparentBorders,
          rows: termRows
        }));
        termRows = [];
      };
      const addTerm = (label, value, keepNext = false) => {
        const borders = { ...transparentCellBorders, bottom: { style: BorderStyle.SINGLE, size: 6, color: "D8E3DD" } };
        const cell = (text, title) => new TableCell({
          width: { size: title ? 3264 : 6336, type: WidthType.DXA },
          borders,
          margins: { top: 60, bottom: 60, left: 0, right: title ? 100 : 0 },
          verticalAlign: VerticalAlign.TOP,
          children: [new Paragraph({
            keepNext,
            alignment: title ? AlignmentType.LEFT : AlignmentType.RIGHT,
            spacing: { before: 0, after: 0, line: 260 },
            children: cleanTextForXml(text).split('\n').map((line, i) => new TextRun({
              text: line, break: i ? 1 : 0, bold: title,
              size: 19, font: "Times New Roman", color: title ? "243B53" : "374151"
            }))
          })]
        });
        termRows.push(new TableRow({ cantSplit: true, children: [cell(label.replace(/[:：]\s*$/, '') + ':', true), cell(value, false)] }));
      };
      const addCustomTerms = (selector) => document.querySelectorAll(selector).forEach((row, index, rows) => {
        const cLbl = cleanTextForXml(row.querySelector('.ip-cond-lbl-input')?.value || '').replace(/[:：]\s*$/, '');
        const cVal = cleanTextForXml(row.querySelector('.ip-cond-val-input')?.value || '');
        const cNum = cleanTextForXml(row.querySelector('.ip-cond-number')?.textContent || '').trim();
        if (cLbl || cVal) addTerm(cNum ? `${cNum} ${cLbl}` : cLbl, cVal, selector.includes('#condIpCustomList ') && index >= rows.length - 2);
      });
      const addStandardTerm = (inputId) => {
        const input = document.getElementById(inputId);
        const row = input?.closest('.ip-term-row');
        if (!input || !row || row.classList.contains('is-deleted')) return;
        const number = cleanTextForXml(row.querySelector('.ip-standard-number')?.textContent || '').trim();
        const label = cleanTextForXml(row.querySelector('.ip-term-label')?.textContent || '');
        addTerm(`${number} ${label}`.trim(), cleanTextForXml(input.value || ''));
      };
      addStandardTerm('ipDeliveryTime');
      addStandardTerm('ipPaymentTerms');
      addStandardTerm('deliverySelectIp');
      addCustomTerms('#condIpCustomList2 .ip-custom-cond-row');
      flushTerms();
      addSectionHeading("3. Дополнительные условия");
      addStandardTerm('ipWarrantyTerms');
      addStandardTerm('ipServiceTerms');
      addStandardTerm('ipValidityTerms');
      addStandardTerm('ipAppendixTerms');
      addCustomTerms('#condIpCustomList .ip-custom-cond-row');
      flushTerms();
      docElements.push(new Paragraph({
        keepNext: true,
        spacing: { before: 100, after: 100, line: 260 },
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: "AAB2BA", space: 5 } },
        children: [new TextRun({ text: "Предложение предназначено для предварительного согласования условий поставки.", italics: true, size: 19, font: "Arial", color: "4B5563" })]
      }));
    } else {
      const ipTime = cleanTextForXml(document.getElementById('ipDeliveryTime')?.value || '');
      const ipDel = cleanTextForXml(document.getElementById('deliverySelectIp')?.value || '');
      docElements.push(new Paragraph({
        indent: { right: 4800 },
        spacing: { after: 50, line: 240 },
        children: [
          new TextRun({ text: "Срок поставки: ", bold: true, size: 22, font: "Times New Roman" }),
          new TextRun({ text: ipTime, size: 22, font: "Times New Roman" })
        ]
      }));
      docElements.push(new Paragraph({
        indent: { right: 4800 },
        spacing: { after: 50, line: 240 },
        children: [
          new TextRun({ text: "Доставка: ", bold: true, size: 22, font: "Times New Roman" }),
          new TextRun({ text: ipDel, size: 22, font: "Times New Roman" })
        ]
      }));
      document.querySelectorAll('#condIpBox .ip-custom-cond-row').forEach(row => {
        const cLbl = cleanTextForXml(row.querySelector('.ip-cond-lbl-input')?.value || '').replace(/[:：]\s*$/, '');
        const cVal = cleanTextForXml(row.querySelector('.ip-cond-val-input')?.value || '');
        if (cLbl || cVal) {
          docElements.push(new Paragraph({
            indent: { right: 4800 },
            spacing: { after: 50, line: 240 },
            children: [
              new TextRun({ text: `${cLbl}: `, bold: true, size: 22, font: "Times New Roman" }),
              ...cVal.split('\n').map((line, i) => new TextRun({ text: line, break: i ? 1 : 0, size: 22, font: "Times New Roman" }))
            ]
          }));
        }
      });
    }

    // 6. Подписи и контакты
    const signTitle = company.signTitle;
    const signPerson = company.signPerson;

    docElements.push(new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: 9600 }],
      keepNext: true,
      spacing: { before: 180, line: 240 },
      border: isGlazyrin ? { top: { style: BorderStyle.SINGLE, size: 6, color: "D8E3DD", space: 7 } } : undefined,
      children: [
        new TextRun({ text: signTitle, size: 22, font: "Times New Roman" }),
        new TextRun({ text: `\t_________________ / ${signPerson}`, size: 22, font: "Times New Roman" })
      ]
    }));

    if (!isIp) {
      docElements.push(new Paragraph({
        spacing: { before: 100, line: 240 },
        children: [
          new TextRun({ text: "Исп.", size: 20, font: "Times New Roman" }),
          new TextRun({ text: "Коммерческий департамент", break: 1, size: 20, font: "Times New Roman" }),
          new TextRun({ text: "ООО «РТСтандарт»", break: 1, size: 20, font: "Times New Roman" }),
          new TextRun({ text: "E-mail: info@liscorp.ru", break: 1, size: 20, font: "Times New Roman" }),
          new TextRun({ text: "+7 (981) 040-10-70", break: 1, size: 20, font: "Times New Roman" }),
          new TextRun({ text: "+7 (812) 983-44-33", break: 1, size: 20, font: "Times New Roman" }),
          new TextRun({ text: "https://liscorp.ru/", break: 1, size: 20, font: "Times New Roman" })
        ]
      }));
    } else {
      docElements.push(new Paragraph({
        spacing: { before: 40, line: 240 },
        children: [
          new TextRun({ text: isGlazyrin ? "Глазырин Алексей Алексеевич" : "Захаров Михаил Сергеевич", size: 21, font: "Times New Roman" }),
          new TextRun({ text: isGlazyrin ? "Телефон: +7 966 871-88-61" : "Телефон: +7 981 208-62-36", break: 1, size: 21, font: "Times New Roman" }),
          new TextRun({ text: isGlazyrin ? "Email: a.glazyrin1198@mail.ru" : "Email: m.zakharov0811@gmail.com", break: 1, size: 21, font: "Times New Roman" })
        ]
      }));
    }

    // 7. Нижний колонтитул Word с динамической нумерацией «Страница X из Y»
    const docFooter = new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: "Страница ", size: 18, font: "Times New Roman", color: "666666" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Times New Roman", color: "666666" }),
            new TextRun({ text: " из ", size: 18, font: "Times New Roman", color: "666666" }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Times New Roman", color: "666666" })
          ]
        })
      ]
    });

    // Сборка документа с прикрепленным колонтитулом
    const wordDoc = new Document({
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: isGlazyrin ? { top: 680, bottom: 850, left: 794, right: 794 } : { top: 720, bottom: 720, left: 850, right: 850 }
          }
        },
        footers: {
          default: docFooter
        },
        children: docElements
      }]
    });

    Packer.toBlob(wordDoc).then(blob => {
      const titleText = document.title || 'КП';
      downloadBlobSafe(blob, `${titleText}.docx`);
    }).catch(err => {
      console.error('Ошибка сборки Word:', err);
      alert('Ошибка при экспорте в Word. Подробности в консоли браузера.');
    });
  }

  // ==========================================
  // НАЗНАЧЕНИЕ ЕДИНЫХ СЛУШАТЕЛЕЙ (EVENT LISTENERS)
  // ==========================================
  function bindEvents() {
    // Верхняя панель и кнопки
    document.getElementById('btnToggleCalc')?.addEventListener('click', toggleCalcPanel);
    document.getElementById('btnCloseCalc')?.addEventListener('click', toggleCalcPanel);
    document.getElementById('companySelect')?.addEventListener('change', onCompanyChange);
    initEquipmentImport();
    document.getElementById('btnAddRow')?.addEventListener('click', () => addRow(true));
    document.getElementById('btnToggleBg')?.addEventListener('click', toggleBackgroundImages);
    document.getElementById('btnClearForm')?.addEventListener('click', clearForm);
    document.getElementById('btnExportWord')?.addEventListener('click', exportToWord);
    document.getElementById('btnPrint')?.addEventListener('click', prepareAndPrint);
    document.getElementById('btnCopyCalc')?.addEventListener('click', copyCalcPrice);

    // Переключатели калькулятора
    document.getElementById('btnFinDays')?.addEventListener('click', () => setFinMode('days'));
    document.getElementById('btnFinWeeks')?.addEventListener('click', () => setFinMode('weeks'));
    document.getElementById('btnWeekMinus')?.addEventListener('click', () => stepFinWeeks(-1));
    document.getElementById('btnWeekPlus')?.addEventListener('click', () => stepFinWeeks(1));
    document.getElementById('btnModeRub')?.addEventListener('click', () => setMarginMode('rub'));
    document.getElementById('btnModePct')?.addEventListener('click', () => setMarginMode('pct'));

    // Поля калькулятора
    ['calcCostVat', 'calcFinDaysInput', 'calcDeliveryCost', 'calcProfitTarget'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => {
        calculateMargin();
        saveState();
      });
    });

    // Мета-поля шапок
    document.getElementById('kpNumInput')?.addEventListener('input', () => {
      saveState();
      updateDocumentTitle();
    });
    document.getElementById('kpNumInputIp')?.addEventListener('input', () => {
      saveState();
      updateDocumentTitle();
    });
    document.getElementById('docDate')?.addEventListener('input', (e) => onDateInput(e.target));
    document.getElementById('docDateIp')?.addEventListener('input', (e) => onDateInput(e.target));
    document.getElementById('clientBox')?.addEventListener('input', () => {
      saveState();
      updateDocumentTitle();
    });
    document.getElementById('clientBoxIp')?.addEventListener('input', () => {
      saveState();
      updateDocumentTitle();
    });

    // Конструктор срока поставки
    document.getElementById('deliveryDaysInput')?.addEventListener('input', onDeliveryBuilderChange);
    document.getElementById('deliveryUnitSelect')?.addEventListener('change', onDeliveryBuilderChange);

    // Условия ООО
    ['condOooDeliveryTime', 'condOooPay', 'condOooWarranty'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', saveState);
    });
    document.getElementById('deliverySelectOoo')?.addEventListener('change', () => {
      calculateMargin();
      saveState();
    });

    // Условия ИП
    ['ipDeliveryTime', 'ipPaymentTerms', 'ipWarrantyTerms', 'ipServiceTerms', 'ipValidityTerms', 'ipAppendixTerms'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', saveState);
    });
    document.getElementById('deliverySelectIp')?.addEventListener('change', () => {
      calculateMargin();
      saveState();
    });
    document.getElementById('btnAddCondRow')?.addEventListener('click', addCondRowForActiveCompany);
    document.getElementById('btnAddCondIp2')?.addEventListener('click', () => addCondRowIp('Дополнительное условие', '', '2'));
    document.getElementById('btnAddCondIp3')?.addEventListener('click', () => addCondRowIp('Дополнительное условие', '', '3'));

    // Synchronize the printed text with what is being typed BEFORE the
    // next browser paint. Do not call prepareForPrint() on edit: it contains
    // legacy print defaults that can alter fields with blank quantities.
    document.addEventListener('input', (e) => {
      if (e.target.closest('.page')) queueDocumentPresentationSync();
    });
    document.addEventListener('change', (e) => {
      if (e.target.closest('.page')) queueDocumentPresentationSync();
    });

    // Авто-растягивание текстовых областей
    document.addEventListener('input', (e) => {
      if (e.target.matches('textarea.auto-grow')) {
        autoResizeTextarea(e.target);
      }
    });

    // Делегирование событий в таблице товаров
    const itemsTable = document.getElementById('itemsTable');
    if (itemsTable) {
      itemsTable.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-del');
        if (btn) deleteRow(btn);
      });

      itemsTable.addEventListener('input', (e) => {
        const target = e.target;
        if (target.classList.contains('col-qty')) {
          recalc();
          saveState();
        } else if (target.classList.contains('col-price')) {
          target.setAttribute('data-raw', target.value);
          recalc();
          saveState();
        } else if (target.matches('.col-name, .col-desc, .col-country')) {
          saveState();
        }
      });

      itemsTable.addEventListener('focusin', (e) => {
        const target = e.target;
        if (target.classList.contains('col-price')) {
          const raw = target.getAttribute('data-raw');
          if (raw && Number.isFinite(readNumber(raw)) && readNumber(raw) > 0) target.value = String(raw).replace('.', ',');
        }
      });

      itemsTable.addEventListener('focusout', (e) => {
        const target = e.target;
        if (target.classList.contains('col-price')) {
          const num = readNumber(target.value);
          target.setAttribute('data-raw', target.value);
          if (Number.isFinite(num)) { target.dataset.raw = String(num); target.value = num > 0 ? fmt(num) : ''; }
          recalc();
          saveState();
        }
      });
    }

    // Делегирование для дополнительных условий ООО
    const condOooTable = document.getElementById('condOooTable');
    if (condOooTable) {
      condOooTable.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-del-cond');
        if (btn) {
          btn.closest('tr').remove();
          saveState();
        }
      });
      condOooTable.addEventListener('input', (e) => {
        if (e.target.matches('.cond-lbl-input, .cond-val')) saveState();
      });
    }

    // Удаление стандартных условий ИП
    const condIpBox = document.getElementById('condIpBox');
    condIpBox?.addEventListener('input', (e) => {
      if (!e.target.matches('.ip-standard-value-editor')) return;
      document.getElementById('ipDeliveryTime').value = readInlineConditionEditor(e.target);
      saveState();
    });
    condIpBox?.addEventListener('click', (e) => {
      const btn = e.target.closest('.ip-standard-delete');
      if (!btn) return;
      const row = btn.closest('.ip-term-row');
      if (!row) return;
      row.classList.add('is-deleted');
      renumberGlazyrinConditions();
      saveState();
    });

    // Делегирование для дополнительных условий ИП
    document.querySelectorAll('#condIpCustomList, #condIpCustomList2').forEach(container => {
      container.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-del-ip-cond');
        if (btn) {
          btn.closest('.ip-custom-cond-row').remove();
          renumberGlazyrinConditions();
          saveState();
        }
      });
      container.addEventListener('input', (e) => {
        if (e.target.matches('.ip-cond-lbl-input')) {
          updateIpConditionSeparator(e.target.closest('.ip-custom-cond-row'));
          adjustInputWidth(e.target);
          saveState();
        } else if (e.target.matches('.ip-cond-val-input')) {
          saveState();
        } else if (e.target.matches('.ip-cond-value-editor')) {
          e.target.closest('.ip-custom-cond-row').querySelector('.ip-cond-val-input').value = readInlineConditionEditor(e.target);
          saveState();
        }
      });
    });
  }

  window.addEventListener('beforeprint', prepareForPrint);

  window.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    initBackgroundVisibility();
    loadState();
    
    const curDateStr = document.getElementById('docDate')?.value;
    if (curDateStr) {
      updatePrefixFromDateString(curDateStr);
    } else {
      setDateAndPrefixes();
    }

    onCompanyChange();
    initAutoResize();
    recalc();
    updateDocumentTitle();
    syncDocumentPresentation();
  });

  window.addEventListener('load', () => {
    initAutoResize();
    syncDocumentPresentation();
  });

})();
