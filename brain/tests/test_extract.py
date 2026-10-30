import io
import shutil

import pytest

from brain.extract import extract_text


def make_scanned_pdf() -> bytes:
    """A PDF containing only an image of text (no text layer), like a phone scan."""
    from PIL import Image, ImageDraw, ImageFont

    img = Image.new("RGB", (1600, 400), "white")
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 64)
    except OSError:
        font = ImageFont.load_default(size=64)
    d.text((40, 150), "WARRANTY EXPIRES 2027", fill="black", font=font)
    buf = io.BytesIO()
    img.save(buf, format="PDF", resolution=200)
    return buf.getvalue()


@pytest.mark.skipif(shutil.which("tesseract") is None, reason="tesseract not installed")
def test_scanned_pdf_is_ocrd():
    text = extract_text(make_scanned_pdf(), "application/pdf")
    assert text and "WARRANTY" in text.upper()


def test_unknown_type_returns_none():
    assert extract_text(b"xyz", "application/zip") is None
