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
    "ooo": ("rtstandard.docx", "RTPDF01", "Марков Д.Е.", "НДС22%", "Тестоваяоплата30дней", 3),
    "ip": ("zakharov.docx", "ZKPDF02", "Захаров М.С.", "НДС5%", "Тестовыйсрок14дней", 3),
    "ip-glazyrin": ("glazyrin.docx", "GLPDF03", "Глазырин А.А.", "НДСнеоблагается", "Тестовыйсрок14дней", 2),
    "long": ("rtstandard-multipage.docx", "RTPDF04", "Марков Д.Е.", "НДС22%", "Тестоваяоплата30дней", 21),
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
    filename, marker, signer, tax, condition, expected_rows = SCENARIOS[key]
    document, footers = read_document(ROOT / filename)
    doc_text = compact(text_content(document))

    expected_total = "42000,00" if key == "long" else "24000,00"
    for term in (marker, "Тестовыйзаказчик", "Q7", signer, tax, condition, expected_total):
        if compact(term) not in doc_text:
            raise AssertionError(f"{filename}: missing printed text {term!r}")

    # ООО: the first customer name must follow "Заказчику:" on the SAME line.
    # Check explicit OOXML breaks, not just total text (which hides line breaks).
    if key in ("ooo", "long"):
        paragraphs = [
            paragraph for paragraph in document.iter(W + "p")
            if "Заказчику:" in text_content(paragraph)
        ]
        if len(paragraphs) != 1:
            raise AssertionError(f"{filename}: expected one customer paragraph")
        first_line = ""
        for node in paragraphs[0].iter():
            if node.tag in (W + "br", W + "cr"):
                break
            if node.tag == W + "t":
                first_line += node.text or ""
        if "Заказчику:Тестовыйзаказчик" not in compact(first_line):
            raise AssertionError(f"{filename}: customer moved below caption in DOCX")

    # Verify the actual specification: seven physical columns and enough table rows.
    spec_tables = [
        table for table in document.iter(W + "tbl")
        if len(table.findall("./" + W + "tblGrid/" + W + "gridCol")) == 7
    ]
    if len(spec_tables) != 1:
        raise AssertionError(f"{filename}: expected exactly one seven-column specification")
    spec_rows = spec_tables[0].findall("./" + W + "tr")
    if len(spec_rows) != expected_rows:
        raise AssertionError(
            f"{filename}: expected exactly {expected_rows} specification rows, got {len(spec_rows)}"
        )

    # Check data rows, not an incidental occurrence in a header, description or footer.
    # Long fixture: 1 base row + 18 additional products + header + total = 21 rows.
    equipment_rows = spec_rows[1:-1]
    if len(equipment_rows) != expected_rows - 2:
        raise AssertionError(f"{filename}: equipment row count mismatch")
    for index, row in enumerate(equipment_rows):
        cells = row.findall("./" + W + "tc")
        if len(cells) != 7:
            raise AssertionError(f"{filename}: equipment row {index + 1} lost a cell")
        name = compact(text_content(cells[1]))
        expected_name = (
            compact(marker + " Тестовое оборудование") if index == 0
            else compact(f"Дополнительное оборудование {index}")
        )
        if name != expected_name:
            raise AssertionError(
                f"{filename}: equipment row {index + 1} is {name!r}, expected {expected_name!r}"
            )

    # The sum must be in the last cell of the actual total row.
    # Merely finding '24 000,00' anywhere also matches the first equipment position.
    total_cells = spec_rows[-1].findall("./" + W + "tc")
    if len(total_cells) != 2 or compact(text_content(total_cells[0])).upper() != "ИТОГО:":
        raise AssertionError(f"{filename}: malformed total row")
    actual_total = compact(text_content(total_cells[1]))
    if actual_total != expected_total:
        raise AssertionError(
            f"{filename}: table total is {actual_total!r}, expected {expected_total!r}"
        )

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
    print(f"OK {filename}: DOCX XML, A4, margins, {len(spec_rows)} exact rows, total cell, all products and signer")


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
