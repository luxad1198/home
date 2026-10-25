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
}
A4_WIDTH_PT, A4_HEIGHT_PT = 595.28, 841.89


def main():
    selected = sys.argv[1:] or list(SCENARIOS)
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
        for expected in (marker, "Q7", total, tax, signer):
            if expected not in flat:
                raise AssertionError(f"{filename}: missing printed value {expected!r}")
        print(f"OK {filename}: {len(reader.pages)} A4 pages, item, amount, VAT and signer")

    print("PDF content checks passed; visual layout still requires inspecting the PDF.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"PDF check failed: {error}", file=sys.stderr)
        sys.exit(1)
