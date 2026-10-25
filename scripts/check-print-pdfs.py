"""Проверка PDF-артефактов: читаемость, A4, содержимое и многостраничность."""
from pathlib import Path
import re
import sys

from pypdf import PdfReader

ROOT = Path("artifacts/print-pdf")
SCENARIOS = {
    "rtstandard.pdf": ("RTPDF01", 1),
    "zakharov.pdf": ("ZKPDF02", 1),
    "glazyrin.pdf": ("GLPDF03", 1),
    "rtstandard-multipage.pdf": ("RTPDF04", 2),
}
A4_WIDTH_PT, A4_HEIGHT_PT = 595.28, 841.89


def main():
    for filename, (marker, min_pages) in SCENARIOS.items():
        filepath = ROOT / filename
        if not filepath.is_file():
            raise AssertionError(f"Не создан PDF: {filepath}")
        reader = PdfReader(filepath, strict=True)
        if len(reader.pages) < min_pages:
            raise AssertionError(f"{filename}: ожидалось минимум {min_pages} стр.")

        text = ""
        for i, page in enumerate(reader.pages, start=1):
            width, height = float(page.mediabox.width), float(page.mediabox.height)
            if abs(width - A4_WIDTH_PT) > 3 or abs(height - A4_HEIGHT_PT) > 3:
                raise AssertionError(f"{filename}: страница {i} не A4 ({width:.1f}×{height:.1f} pt)")
            text += page.extract_text() or ""

        if marker not in re.sub(r"\s+", "", text):
            raise AssertionError(f"{filename}: тестовое оборудование {marker} отсутствует в печатном тексте")
        print(f"OK {filename}: {len(reader.pages)} стр., A4, маркер {marker}")

    print("Все тестовые PDF прошли базовые проверки. Визуальную вёрстку нужно смотреть в самих PDF.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"PDF check failed: {error}", file=sys.stderr)
        sys.exit(1)
