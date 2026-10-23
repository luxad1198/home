async function exportToWord() {
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

    const isIp = document.getElementById('companySelect').value === 'ip';
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
      top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "000000" }
    };

    const docElements = [];

    // 1. Шапка документа
    if (!isIp) {
      const logoEl = document.getElementById('logoImgOoo');
      const logoBuffer = await getImageBufferFromElement(logoEl, 'logo.png');

      const row1Runs = [];
      if (logoBuffer) {
        row1Runs.push(new ImageRun({
          data: logoBuffer,
          transformation: { width: 195, height: 45 }
        }));
      } else {
        row1Runs.push(new TextRun({ text: "ООО \"РТСТАНДАРТ\"", bold: true, size: 24, font: "Times New Roman" }));
      }

      row1Runs.push(
        new TextRun({ text: "\tООО \"РТСТАНДАРТ\"", bold: true, size: 23, font: "Times New Roman" })
      );

      docElements.push(new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: 9600 }],
        spacing: { line: 240 },
        children: row1Runs
      }));

      docElements.push(new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { line: 240 },
        children: [
          new TextRun({ text: "г. Санкт-Петербург, наб. Обводного канала, д. 23, лит. Г", size: 21, font: "Times New Roman" }),
          new TextRun({ text: "ИНН 7842228552", break: 1, size: 21, font: "Times New Roman" }),
          new TextRun({ text: "+7 (812) 983-44-33", break: 1, size: 21, font: "Times New Roman" })
        ]
      }));

      const clientFirstLine = clientVal.trim() ? `Заказчику: ${clientVal.split('\n')[0]}` : "";
      docElements.push(new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: 9600 }],
        spacing: { before: 140, line: 240 },
        children: [
          new TextRun({ text: `КП № ${fullNum}`, bold: true, size: 22, font: "Times New Roman" }),
          ...(clientFirstLine ? [new TextRun({ text: `\t${clientFirstLine}`, size: 22, font: "Times New Roman" })] : [])
        ]
      }));

      const clientOtherLines = clientVal.trim() ? clientVal.split('\n').slice(1).join(' ') : "";
      docElements.push(new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: 9600 }],
        spacing: { line: 240 },
        children: [
          new TextRun({ text: `От ${dateVal}`, size: 22, font: "Times New Roman" }),
          ...(clientOtherLines ? [new TextRun({ text: `\t${clientOtherLines}`, size: 22, font: "Times New Roman" })] : [])
        ]
      }));

    } else {
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
      alignment: AlignmentType.CENTER,
      spacing: { before: 180, after: 120 },
      children: [new TextRun({ text: "КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ", bold: true, size: 24, font: "Times New Roman" })]
    }));

    const introText = isIp
      ? "Индивидуальный предприниматель Захаров Михаил Сергеевич, действующий на основании свидетельства о государственной регистрации, предлагает рассмотреть возможность поставки следующего оборудования:"
      : "Общество с ограниченной ответственностью «РТСтандарт», в лице генерального директора Маркова Дмитрия Евгеньевича, действующего на основании Устава, предлагает рассмотреть возможность поставки следующего оборудования:";

    docElements.push(new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      indent: { firstLine: 567 },
      spacing: { after: 140, line: 260 },
      children: [new TextRun({ text: introText, size: 22, font: "Times New Roman" })]
    }));

    // 3. Таблица спецификации
    const headerBgColor = isIp ? "FFFFFF" : "ACB9CA";
    const priceColTitle = isIp ? "Цена за ед. руб., с НДС 5%" : "Цена за ед. руб., с НДС 22%";
    const sumColTitle = isIp ? "Сумма руб., с НДС 5%" : "Сумма руб., с НДС 22%";

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
        children: [new TextRun({ text, bold: true, size: 19, font: "Times New Roman" })]
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
          shading: { fill: headerBgColor, type: ShadingType.CLEAR },
          verticalAlign: VerticalAlign.TOP,
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "ИТОГО:", size: 19, font: "Times New Roman" })]
          })]
        }),
        new TableCell({
          borders: tableBorders,
          shading: { fill: headerBgColor, type: ShadingType.CLEAR },
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
      rows: tableRows
    }));

    // 4. Сумма прописью
    const textTotalBlock = cleanTextForXml(document.getElementById('textTotalBlock')?.innerText || '');
    docElements.push(new Paragraph({
      spacing: { before: 140, after: 160, line: 260 },
      children: [new TextRun({ text: textTotalBlock, bold: true, size: 22, font: "Times New Roman" })]
    }));

    // 5. Условия сделки
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
              children: [new Paragraph({ children: [new TextRun({ text: item.lbl, bold: true, size: 20, font: "Times New Roman" })] })]
            }),
            new TableCell({
              width: { size: 7400, type: WidthType.DXA },
              borders: tableBorders,
              verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ spacing: { line: 240 }, children: valRuns })]
            })
          ]
        });
      });
      docElements.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        rows: condRows
      }));
    } else {
      const ipTime = cleanTextForXml(document.getElementById('ipDeliveryTime')?.value || '');
      const ipDel = cleanTextForXml(document.getElementById('deliverySelectIp')?.value || '');
      docElements.push(new Paragraph({
        spacing: { after: 50, line: 240 },
        children: [
          new TextRun({ text: "Срок поставки: ", bold: true, size: 22, font: "Times New Roman" }),
          new TextRun({ text: ipTime, size: 22, font: "Times New Roman" })
        ]
      }));
      docElements.push(new Paragraph({
        spacing: { after: 50, line: 240 },
        children: [
          new TextRun({ text: "Доставка: ", bold: true, size: 22, font: "Times New Roman" }),
          new TextRun({ text: ipDel, size: 22, font: "Times New Roman" })
        ]
      }));

      document.querySelectorAll('#condIpCustomList .ip-custom-cond-row').forEach(row => {
        const cLbl = cleanTextForXml(row.querySelector('.ip-cond-lbl-input')?.value || '');
        const cVal = cleanTextForXml(row.querySelector('.ip-cond-val-input')?.value || '');
        if (cLbl || cVal) {
          docElements.push(new Paragraph({
            spacing: { after: 50, line: 240 },
            children: [
              new TextRun({ text: `${cLbl}: `, bold: true, size: 22, font: "Times New Roman" }),
              new TextRun({ text: cVal, size: 22, font: "Times New Roman" })
            ]
          }));
        }
      });
    }

    // 6. Подписи и контакты
    const signTitle = isIp ? "Индивидуальный предприниматель" : "Генеральный директор ООО «РТСтандарт»";
    const signPerson = isIp ? "Захаров М.С." : "Марков Д.Е.";

    docElements.push(new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: 9600 }],
      spacing: { before: 180, line: 240 },
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
          new TextRun({ text: "Захаров Михаил Сергеевич", size: 21, font: "Times New Roman" }),
          new TextRun({ text: "Телефон: +7 981 208-62-36", break: 1, size: 21, font: "Times New Roman" }),
          new TextRun({ text: "Email: m.zakharov0811@gmail.com", break: 1, size: 21, font: "Times New Roman" })
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
            margin: { top: 720, bottom: 720, left: 850, right: 850 }
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
