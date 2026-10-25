"""Check real downloaded DOCX files using only Python's standard library.

From repo root: python3 scripts/check-word-documents.py [ooo|ip|ip-glazyrin|long]
DOCX structure checks are not a substitute for rendering it in an office editor.
"""
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path("artifacts/word-docx")
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
SCENARIOS = {
    "ooo": ("rtstandard.docx", "RTPDF01", "Марков Д.Е.", "НДС22%", "Тестоваяоплата30дней", 2),
    "ip": ("zakharov.docx", "ZKPDF02", "Захаров М.С.", "НДС5%", "Тестовыйсрок14дней", 2),
    "ip-glazyrin": ("glazyrin.docx", "GLPDF03", "Глазырин А.А.", "НДСнеоблагается", "Тестовыйсрок14дней", 2),
    "long": ("rtstandard-multipage.docx", "RTPDF04", "Марков Д.Е.", "НДС22%", "Тестоваяоплата30дней", 20),
}


def compact(s):
    return re.sub(r"\s+", "", s or "")


def text_content(element):
    return "".join(part.text or "" for part in element.iter(W + "t"))


def read_document(path):
    if not path.is_file():
        raise AssertionError(f"Word export not found: {path}")
    if not zipfile.is_zipfile(path):
        raise AssertionError(f"{path.name} is not a valid ZIP/DOCX")

    with zipfile.ZipFile(path) as archive:
        bad = archive.testzip()
        if bad:
            raise AssertionError(f"{path.name}: corrupt ZIP member {bad}")
        required = {"word/document.xml", "[Content_Types].xml"}
        if not required.issubset(archive.namelist()):
            raise AssertionError(f"{path.name}: missing core OOXML entries")
        document = ET.fromstring(archive.read("word/document.xml"))
        footers = [
            ET.fromstring(archive.read(name))
            for name in archive.namelist()
            if re.fullmatch(r"word/footer\d+\.xml", name)
        ]
    return document, footers


def check(key):
    filename, marker, signer, tax, condition, min_rows = SCENARIOS[key]
    document, footers = read_document(ROOT / filename)
    doc_text = compact(text_content(document))

    expected_total = "42000,00" if key == "long" else "24000,00"
    for term in (marker, "Тестовыйзаказчик", signer, tax, condition, expected_total):
        if compact(term) not in doc_text:
            raise AssertionError(f"{filename}: missing printed text {term!r}")

    # Verify the actual specification: seven physical columns and enough table rows.
    spec_tables = [
        table for table in document.iter(W + "tbl")
        if len(table.findall("./" + W + "tblGrid/" + W + "gridCol")) == 7
    ]
    if len(spec_tables) != 1:
        raise AssertionError(f"{filename}: expected exactly one seven-column specification")
    spec_rows = spec_tables[0].findall("./" + W + "tr")
    if len(spec_rows) < min_rows:
        raise AssertionError(f"{filename}: expected at least {min_rows} specification rows")
    row_text = compact(text_content(spec_tables[0]))
    if marker not in row_text or expected_total not in row_text:
        raise AssertionError(f"{filename}: specification does not contain marker and total")

    # Word stores page dimensions/margins in twips. A4 = approximately 11906 x 16838 twips.
    page_size = document.find(".//" + W + "sectPr/" + W + "pgSz")
    margins = document.find(".//" + W + "sectPr/" + W + "pgMar")
    if page_size is None or margins is None:
        raise AssertionError(f"{filename}: missing page size or margins")
    get = lambda element, attr: int(element.get(W + attr, "0"))
    if abs(get(page_size, "w") - 11906) > 3 or abs(get(page_size, "h") - 16838) > 3:
        raise AssertionError(f"{filename}: page is not A4")
    expected_margins = (
        {"top": 680, "bottom": 850, "left": 794, "right": 794}
        if key == "ip-glazyrin"
        else {"top": 720, "bottom": 720, "left": 850, "right": 850}
    )
    for name, expected in expected_margins.items():
        if get(margins, name) != expected:
            raise AssertionError(f"{filename}: incorrect {name} margin")

    if not footers or not any("Страница" in text_content(f) for f in footers):
        raise AssertionError(f"{filename}: missing page-number footer")
    if "Втораястрокасдополнительнымихарактеристиками" not in doc_text:
        raise AssertionError(f"{filename}: multiline equipment description lost")
    print(f"OK {filename}: DOCX XML, A4, margins, {len(spec_rows)} spec rows, total and signer")


def main():
    selected = sys.argv[1:] or list(SCENARIOS)
    for key in selected:
        if key not in SCENARIOS:
            raise ValueError("Select ooo, ip, ip-glazyrin, long (or omit for all)")
    for key in dict.fromkeys(selected):
        check(key)
    print("DOCX structure verified. Open or render files for visual pagination checks.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Word export check failed: {exc}", file=sys.stderr)
        sys.exit(1)
