"""Text extraction for the document vault: PDF text layer, then OCR via Tesseract if installed."""
from __future__ import annotations

import io


def extract_text(data: bytes, mime: str) -> str | None:
    if mime == "application/pdf":
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        text = "\n".join((p.extract_text() or "") for p in reader.pages[:200]).strip()
        if len(text) > 40:
            return text
        return _ocr_pdf(data)  # scanned PDF: no text layer, so rasterise and OCR
    if mime.startswith("image/"):
        try:
            import pytesseract
            from PIL import Image
        except ImportError:
            return None
        return pytesseract.image_to_string(Image.open(io.BytesIO(data))).strip()
    return None


def _ocr_pdf(data: bytes, max_pages: int = 20) -> str | None:
    """Renders each page at ~200 DPI with pdfium and OCRs it with Tesseract."""
    try:
        import pypdfium2 as pdfium
        import pytesseract
    except ImportError:
        return None
    pdf = pdfium.PdfDocument(data)
    pages = []
    for i in range(min(len(pdf), max_pages)):
        img = pdf[i].render(scale=200 / 72).to_pil().convert("L")
        pages.append(pytesseract.image_to_string(img).strip())
    text = "\n\n".join(p for p in pages if p).strip()
    return text or None
