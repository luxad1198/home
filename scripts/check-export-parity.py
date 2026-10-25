"""Optional semantic parity of Word DOCX export and browser-printed PDF.

Requires both exports generated from the shared fixtures and pypdf.
Run: python3 scripts/check-export-parity.py [ooo|ip|ip-glazyrin|long]
This compares key document contents, NOT fonts, exact line breaks, stamps or layout.
"""
from pathlib import Path
from xml.etree import ElementTree as ET
import re
import sys
import zipfile

from pypdf import PdfReader

ROOT = Path("artifacts")
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
EXTRA_TERMS = {
    "conditions-ooo": ("Приёмка", "При расхождениях оформляется акт.", "Уведомление"),
    "conditions-ip": ("Документы:УПД", "Оригиналы направляются отдельным письмом.", "Срок ответа"),
    "conditions-ip-glazyrin": ("2.4.Разгрузка", "Ответственное лицо встречает транспорт.",
                                "3.4.Поддержка", "Консультации по оборудованию"),
}

SCENARIOS = {
    "ooo": ("rtstandard", "RTPDF01", "МарковД.Е.", "НДС22%", "Тестоваяоплата30дней", "24000,00"),
    "ip": ("zakharov", "ZKPDF02", "ЗахаровМ.С.", "НДС5%", "Тестовыйсрок14дней", "24000,00"),
    "ip-glazyrin": ("glazyrin", "GLPDF03", "ГлазыринА.А.", "НДСнеоблагается", "Тестовыйсрок14дней", "24000,00"),
    "long": ("rtstandard-multipage", "RTPDF04", "МарковД.Е.", "НДС22%", "Тестоваяоплата30дней", "42000,00"),
    "conditions-ooo": ("rtstandard-conditions", "RTCOND05", "МарковД.Е.", "НДС22%", "Тестоваяоплата30дней", "24000,00"),
    "conditions-ip": ("zakharov-conditions", "ZKCOND06", "ЗахаровМ.С.", "НДС5%", "Тестовыйсрок14дней", "24000,00"),
    "conditions-ip-glazyrin": ("glazyrin-conditions", "GLCOND07", "ГлазыринА.А.", "НДСнеоблагается", "Тестовыйсрок14дней", "24000,00"),
}


def flatten(text):
    return re.sub(r"\s+", "", text or "")


def word_text(path):
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    return flatten("".join(item.text or "" for item in root.iter(W + "t")))


def pdf_text(path):
    reader = PdfReader(path, strict=True)
    return flatten("".join(page.extract_text() or "" for page in reader.pages))


def main():
    selected = sys.argv[1:] or list(SCENARIOS)[:4]
    if any(key not in SCENARIOS for key in selected):
        raise ValueError("Select ooo, ip, ip-glazyrin, long (or omit for all)")
    for key in dict.fromkeys(selected):
        basename, marker, signer, vat, condition, amount = SCENARIOS[key]
        docx = ROOT / "word-docx" / (basename + ".docx")
        pdf = ROOT / "print-pdf" / (basename + ".pdf")
        if not docx.is_file() or not pdf.is_file():
            raise AssertionError(f"{key}: both DOCX and print PDF are required")
        a, b = word_text(docx), pdf_text(pdf)
        for item in (marker, signer, vat, condition, amount, "Тестовыйзаказчик", "TEST-DOCX" if key == "ooo" else "Q7"):
            if flatten(item) not in a or flatten(item) not in b:
                raise AssertionError(f"{key}: {item!r} missing from Word or print PDF")
        for item in EXTRA_TERMS.get(key, ()):
            if flatten(item) not in a or flatten(item) not in b:
                raise AssertionError(f"{key}: custom condition {item!r} missing from Word or PDF")
        if key in EXTRA_TERMS:
            for forbidden in ("Удалённый пункт", "Этого текста не должно быть"):
                if flatten(forbidden) in a or flatten(forbidden) in b:
                    raise AssertionError(f"{key}: deleted condition present in an export")
        print(f"OK {key}: matching key data in DOCX and printed PDF")
    print("Semantic comparison passed. Fonts, pagination and visuals are NOT compared.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Export parity check failed: {error}", file=sys.stderr)
        sys.exit(1)
