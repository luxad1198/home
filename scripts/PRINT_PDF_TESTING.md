# Проверка печатных PDF без диалога печати

Сайт не развёртывается отдельно: проверка использует **код текущего Pull Request**, поднятый временно на `127.0.0.1` внутри GitHub Actions.

## В GitHub

При PR, меняющем `index.html`, `app.js`, `style.css` или тестовые сценарии, запускается workflow **Verify print PDF**.

1. Открой Pull Request → **Checks** → **Verify print PDF** → запуск.
2. В разделе **Artifacts** скачай архив **print-pdf**.
3. Проверь PDF вручную: поля, таблицы, переносы, суммы, подписи, разрывы страниц.
4. Замечания исправляй в той же рабочей ветке; новая проверка создаст обновлённые PDF.

Архив содержит четыре тестовых документа: `rtstandard.pdf`, `zakharov.pdf`, `glazyrin.pdf` и `rtstandard-multipage.pdf` (последний проверяет перенос на несколько страниц). Данные вымышленные. Артефакты хранятся 14 дней.

## Локальный запуск (при наличии Node.js, Python 3 и Chromium Playwright)

```bash
npm install --no-save --package-lock=false playwright@1.56.1
npx playwright install chromium
python3 -m http.server 8765 --bind 127.0.0.1
```

В другом терминале:

```bash
node scripts/generate-print-pdfs.cjs
python3 -m venv .pdf-test-venv
.pdf-test-venv/bin/pip install pypdf==6.1.1
.pdf-test-venv/bin/python scripts/check-print-pdfs.py
```

PDF сохраняются в `artifacts/print-pdf/`. На Windows путь к Python виртуального окружения — `.pdf-test-venv/Scripts/python.exe`.

### Что проверяет автоматизация

- Реальную кнопку **PDF / Печать**: валидацию, подготовку DOM и CSS `@media print`/`@page`; системное `window.print()` перехватывается.
- Наличие PDF для трёх компаний и многостраничного случая.
- Читаемость PDF, формат A4, количество страниц и наличие тестовых данных в тексте.
- Корректность сумм на заполненной форме до печати.

Точные шрифты и переносы могут отличаться от браузера на компьютере пользователя. Автоматическая проверка **не гарантирует визуальное совпадение с Word**; для этого нужно открывать PDF из артефактов.

Workflow намеренно запускается только при изменениях, которые могут влиять на печатный документ, или вручную через **Actions → Verify print PDF → Run workflow** (после появления workflow в `main`).
