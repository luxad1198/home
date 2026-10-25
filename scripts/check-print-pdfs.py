"""Verify printed PDFs: A4, page count, company, VAT, amount and equipment.

Run from repo root: python3 scripts/check-print-pdfs.py [ooo|ip|ip-glazyrin|long]
"""
from pathlib import Path
import re
import sys

from pypdf import PdfReader

ROOT = Path("artifacts/print-pdf")
SCENARIOS = {
    "ooo": ("rtstandard.pdf", "RTPDF01", 1, "24000,00", "НДС22%", "МарковД.Е."),
    "ip": ("zakharov.pdf", "ZKPDF02", 1, "24000,00", "НДС5%", "ЗахаровМ.С."),
    "ip-glazyrin": ("glazyrin.pdf", "GLPDF03", 1, "24000,00", "НДСнеоблагается", "ГлазыринА.А."),
    "long": ("rtstandard-multipage.pdf", "RTPDF04", 2, "42000,00", "НДС22%", "МарковД.Е."),
    "conditions-ooo": ("rtstandard-conditions.pdf", "RTCOND05", 1, "24000,00", "НДС22%", "МарковД.Е."),
    "conditions-ip": ("zakharov-conditions.pdf", "ZKCOND06", 1, "24000,00", "НДС5%", "ЗахаровМ.С."),
    "conditions-ip-glazyrin": ("glazyrin-conditions.pdf", "GLCOND07", 1, "24000,00", "НДСнеоблагается", "ГлазыринА.А."),
}
CUSTOM_TERMS = {
    "conditions-ooo": (
        "Приёмка", "Проверка серийных номеров и комплектности.",
        "При расхождениях оформляется акт.", "Уведомление",
        "Уведомить заказчика не позднее двух рабочих дней.",
    ),
    "conditions-ip": (
        "Документы:УПД", "УПД и счёт передаются по электронной почте.",
        "Оригиналы направляются отдельным письмом.",
        "Срок ответа", "На обращение отвечают в течение трёх рабочих дней.",
    ),
    "conditions-ip-glazyrin": (
        "2.4.Разгрузка", "Разгрузка оборудования по согласованному графику.",
        "Ответственное лицо встречает транспорт.",
        "3.4.Поддержка", "Консультации по оборудованию в течение трёх рабочих дней.",
    ),
}
A4_WIDTH_PT, A4_HEIGHT_PT = 595.28, 841.89


def main():
    selected = sys.argv[1:] or list(SCENARIOS)[:4]
    if any(key not in SCENARIOS for key in selected):
        raise ValueError("Select ooo, ip, ip-glazyrin, long (or omit for all)")

    for key in dict.fromkeys(selected):
        filename, marker, min_pages, total, tax, signer = SCENARIOS[key]
        filepath = ROOT / filename
        if not filepath.is_file():
            raise AssertionError(f"PDF not generated: {filepath}")
        reader = PdfReader(filepath, strict=True)
        if len(reader.pages) < min_pages:
            raise AssertionError(f"{filename}: expected at least {min_pages} page(s)")

        text = ""
        for i, page in enumerate(reader.pages, start=1):
            width, height = float(page.mediabox.width), float(page.mediabox.height)
            if abs(width - A4_WIDTH_PT) > 3 or abs(height - A4_HEIGHT_PT) > 3:
                raise AssertionError(
                    f"{filename}: page {i} not A4 ({width:.1f}x{height:.1f} pt)"
                )
            text += page.extract_text() or ""

        flat = re.sub(r"\s+", "", text)
        # Match only the NUMERIC 'ИТОГО: 24 000,00' from the actual table.
        # 'ИТОГО: 24 000 (прописью)' is a separate paragraph and must not qualify.
        table_totals = re.findall(r"ИТОГО:\s*(\d[\d\s\u00a0]*,\d{2})", text)
        if len(table_totals) != 1:
            raise AssertionError(
                f"{filename}: expected one numeric table total, got {table_totals!r}"
            )
        actual_total = re.sub(r"\s+", "", table_totals[0])
        if actual_total != total:
            raise AssertionError(
                f"{filename}: printed table total {actual_total!r}, expected {total!r}"
            )

        for expected in (marker, "TEST-DOCX" if key == "ooo" else "Q7", tax, signer, "Тестовыйзаказчик"):
            if expected not in flat:
                raise AssertionError(f"{filename}: missing printed value {expected!r}")

        condition = "Тестоваяоплата30дней" if key in ("ooo", "long") else "Тестовыйсрок14дней"
        if condition not in flat:
            raise AssertionError(f"{filename}: missing modified delivery/payment condition")

        # For the long scenario all 19 equipment items must survive page breaks.
        # A digit boundary prevents "оборудование 1" from matching "оборудование 11".
        if key == "long":
            for number in range(1, 19):
                pattern = r"Дополнительное\s+оборудование\s+" + str(number) + r"(?!\d)"
                if not re.search(pattern, text):
                    raise AssertionError(
                        f"{filename}: missing equipment line 'Дополнительное оборудование {number}'"
                    )

        if key in CUSTOM_TERMS:
            for term in CUSTOM_TERMS[key]:
                if re.sub(r"\s+", "", term) not in flat:
                    raise AssertionError(
                        f"{filename}: missing printed custom-condition text {term!r}"
                    )
            for forbidden in ("Удалённый пункт", "Этого текста не должно быть"):
                if re.sub(r"\s+", "", forbidden) in flat:
                    raise AssertionError(f"{filename}: removed custom condition printed")
            if key == "conditions-ip" and "Документы::" in flat:
                raise AssertionError(f"{filename}: double colon in printed condition")
            if key == "conditions-ip-glazyrin" and re.sub(
                r"\s+", "", "Сервисное обслуживание и поддержка"
            ) in flat:
                raise AssertionError(f"{filename}: removed standard condition printed")

        print(f"OK {filename}: {len(reader.pages)} A4 pages, exact table total, equipment, client, condition, VAT and signer")

    print("PDF content checks passed; visual layout still requires inspecting the PDF.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"PDF check failed: {error}", file=sys.stderr)
        sys.exit(1)
