"""Optional visual check: render generated Word DOCX through LibreOffice to PDF.

Run (with LibreOffice and pypdf installed):
  python3 scripts/render-word-documents.py [ooo|ip|ip-glazyrin|long]
The resulting PDFs can be inspected visually. LibreOffice layout can differ from MS Word.
"""
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from pypdf import PdfReader

ROOT = Path("artifacts/word-docx")
OUTPUT = Path("artifacts/word-rendered")
SCENARIOS = {
    "ooo": ("rtstandard.docx", "RTPDF01", 1),
    "ip": ("zakharov.docx", "ZKPDF02", 1),
    "ip-glazyrin": ("glazyrin.docx", "GLPDF03", 1),
    "long": ("rtstandard-multipage.docx", "RTPDF04", 2),
}


def main():
    office = shutil.which("libreoffice") or shutil.which("soffice")
    if not office:
        raise RuntimeError("LibreOffice not installed; skip optional visual Word rendering")
    selected = sys.argv[1:] or list(SCENARIOS)
    if any(key not in SCENARIOS for key in selected):
        raise ValueError("Select ooo, ip, ip-glazyrin, long (or omit for all)")

    OUTPUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="word-render-profile-") as tmp:
        for key in dict.fromkeys(selected):
            name, marker, pages = SCENARIOS[key]
            word = ROOT / name
            if not word.is_file():
                raise AssertionError(f"Missing Word file: {word}")
            pdf = OUTPUT / (word.stem + ".pdf")
            if pdf.exists():
                pdf.unlink()  # avoid validating a stale render on conversion failure

            profile = (Path(tmp) / ("office-" + key)).resolve().as_uri()
            command = [
                office, f"-env:UserInstallation={profile}", "--headless",
                "--convert-to", "pdf:writer_pdf_Export",
                "--outdir", str(OUTPUT), str(word)
            ]
            completed = subprocess.run(command, capture_output=True, text=True, timeout=120)
            if completed.returncode or not pdf.exists():
                raise RuntimeError(
                    f"Failed to render {name}: {completed.stdout} {completed.stderr}"
                )

            document = PdfReader(pdf, strict=True)
            if len(document.pages) < pages:
                raise AssertionError(f"{name}: expected at least {pages} rendered pages")
            text = ""
            for i, page in enumerate(document.pages, 1):
                w, h = float(page.mediabox.width), float(page.mediabox.height)
                if abs(w - 595.28) > 3 or abs(h - 841.89) > 3:
                    raise AssertionError(f"{name}: page {i} not A4")
                text += page.extract_text() or ""
            if marker not in re.sub(r"\s+", "", text):
                raise AssertionError(f"{name}: marker missing in rendered PDF")
            print(f"OK {name}: rendered {len(document.pages)} A4 pages to {pdf}")

    print("Rendered DOCX files checked. Inspect PDFs visually; LibreOffice is not MS Word.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Word render check failed: {error}", file=sys.stderr)
        sys.exit(1)
