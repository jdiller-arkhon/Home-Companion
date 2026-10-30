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
        return None  # scanned PDF; OCR of rasterised pages is not implemented yet
    if mime.startswith("image/"):
        try:
            import pytesseract
            from PIL import Image
        except ImportError:
            return None
        return pytesseract.image_to_string(Image.open(io.BytesIO(data))).strip()
    return None
