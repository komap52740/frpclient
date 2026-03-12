from __future__ import annotations

from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image


def make_test_image_upload(
    name: str,
    *,
    image_format: str = "JPEG",
    size: tuple[int, int] = (8, 8),
    color: tuple[int, int, int] = (24, 96, 180),
    trailing_bytes: bytes = b"",
) -> SimpleUploadedFile:
    output = BytesIO()
    image = Image.new("RGB", size, color)
    image.save(output, format=image_format)
    payload = output.getvalue() + trailing_bytes

    if image_format.upper() == "PNG":
        content_type = "image/png"
    elif image_format.upper() == "WEBP":
        content_type = "image/webp"
    else:
        content_type = "image/jpeg"

    return SimpleUploadedFile(name, payload, content_type=content_type)


def make_test_pdf_upload(name: str = "proof.pdf") -> SimpleUploadedFile:
    payload = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF\n"
    return SimpleUploadedFile(name, payload, content_type="application/pdf")


def make_test_heic_upload(name: str = "IMG_0001.HEIC") -> SimpleUploadedFile:
    payload = (
        b"\x00\x00\x00\x18ftypheic"
        b"\x00\x00\x00\x00"
        b"mif1heic"
        b"\x00\x00\x00\x08free"
    )
    return SimpleUploadedFile(name, payload, content_type="image/heic")


def make_test_mp4_upload(name: str = "guide.mp4") -> SimpleUploadedFile:
    payload = (
        b"\x00\x00\x00\x20ftypisom"
        b"\x00\x00\x02\x00"
        b"isomiso2mp41"
        b"\x00\x00\x00\x08free"
    )
    return SimpleUploadedFile(name, payload, content_type="video/mp4")
