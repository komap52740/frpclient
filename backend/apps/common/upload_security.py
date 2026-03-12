from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image, ImageOps, UnidentifiedImageError


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
JPEG_SIGNATURE = b"\xff\xd8\xff"
WEBM_SIGNATURE = b"\x1a\x45\xdf\xa3"
PDF_SIGNATURE = b"%PDF-"
ZIP_SIGNATURES = (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08")
ISO_BMFF_VIDEO_BRANDS = {
    b"isom",
    b"iso2",
    b"mp41",
    b"mp42",
    b"avc1",
    b"dash",
    b"M4V ",
    b"M4A ",
    b"qt  ",
}
ISO_BMFF_HEIC_BRANDS = {
    b"heic",
    b"heix",
    b"hevc",
    b"hevx",
}
ISO_BMFF_HEIF_BRANDS = {
    b"heif",
    b"heis",
    b"heim",
    b"hevm",
    b"mif1",
    b"msf1",
}
TEXT_PRINTABLE_BYTES = set(range(32, 127)) | {9, 10, 13}


@dataclass(frozen=True)
class UploadPolicy:
    label: str
    max_bytes: int
    allowed_mimes: frozenset[str]
    allowed_extensions: frozenset[str]
    reencode_raster_images: bool = False


@dataclass(frozen=True)
class DetectedUpload:
    mime: str
    extension: str
    is_raster_image: bool = False


def _reset_file_pointer(file_obj, position: int | None) -> None:
    if hasattr(file_obj, "seek"):
        try:
            file_obj.seek(0 if position is None else position)
        except (OSError, ValueError):
            pass


def _read_file_head(file_obj, size: int = 8192) -> bytes:
    current_pos = None
    if hasattr(file_obj, "tell"):
        try:
            current_pos = file_obj.tell()
        except (OSError, ValueError):
            current_pos = None
    if hasattr(file_obj, "seek"):
        try:
            file_obj.seek(0)
        except (OSError, ValueError):
            pass
    chunk = file_obj.read(size) or b""
    _reset_file_pointer(file_obj, current_pos)
    return chunk


def _read_file_bytes(file_obj) -> bytes:
    current_pos = None
    if hasattr(file_obj, "tell"):
        try:
            current_pos = file_obj.tell()
        except (OSError, ValueError):
            current_pos = None
    if hasattr(file_obj, "seek"):
        try:
            file_obj.seek(0)
        except (OSError, ValueError):
            pass
    payload = file_obj.read() or b""
    _reset_file_pointer(file_obj, current_pos)
    return payload


def _detect_iso_bmff(header: bytes) -> DetectedUpload | None:
    if len(header) < 12 or header[4:8] != b"ftyp":
        return None

    brand = header[8:12]
    if brand in ISO_BMFF_HEIC_BRANDS:
        return DetectedUpload("image/heic", ".heic")
    if brand in ISO_BMFF_HEIF_BRANDS:
        return DetectedUpload("image/heif", ".heif")
    if brand == b"qt  ":
        return DetectedUpload("video/quicktime", ".mov")
    if brand in ISO_BMFF_VIDEO_BRANDS:
        return DetectedUpload("video/mp4", ".mp4")
    return None


def _looks_like_text(header: bytes) -> bool:
    if not header or b"\x00" in header:
        return False
    if all(byte in TEXT_PRINTABLE_BYTES for byte in header):
        return True
    try:
        header.decode("utf-8")
    except UnicodeDecodeError:
        return False
    return True


def sniff_upload_type(file_obj) -> DetectedUpload:
    header = _read_file_head(file_obj)
    if header.startswith(JPEG_SIGNATURE):
        return DetectedUpload("image/jpeg", ".jpg", is_raster_image=True)
    if header.startswith(PNG_SIGNATURE):
        return DetectedUpload("image/png", ".png", is_raster_image=True)
    if len(header) >= 12 and header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return DetectedUpload("image/webp", ".webp", is_raster_image=True)
    if header.startswith(PDF_SIGNATURE):
        return DetectedUpload("application/pdf", ".pdf")
    if header.startswith(ZIP_SIGNATURES):
        return DetectedUpload("application/zip", ".zip")
    if header.startswith(WEBM_SIGNATURE) and b"webm" in header[:256].lower():
        return DetectedUpload("video/webm", ".webm")

    iso_bmff_detected = _detect_iso_bmff(header)
    if iso_bmff_detected is not None:
        return iso_bmff_detected

    if _looks_like_text(header[:4096]):
        return DetectedUpload("text/plain", ".txt")

    raise ValidationError("Не удалось безопасно определить тип файла по содержимому.")


def validate_upload(file_obj, policy: UploadPolicy) -> DetectedUpload:
    if not file_obj:
        raise ValidationError("Файл не передан.")

    file_size = int(getattr(file_obj, "size", 0) or 0)
    if file_size <= 0:
        raise ValidationError("Файл пустой.")
    if file_size > policy.max_bytes:
        raise ValidationError(f"{policy.label}: максимальный размер файла {policy.max_bytes // (1024 * 1024)}MB")

    detected = sniff_upload_type(file_obj)
    if detected.mime not in policy.allowed_mimes:
        raise ValidationError(f"{policy.label}: недопустимый тип файла ({detected.mime})")

    original_extension = Path(getattr(file_obj, "name", "")).suffix.lower().strip()
    if original_extension and original_extension not in policy.allowed_extensions:
        raise ValidationError(f"{policy.label}: недопустимое расширение файла ({original_extension})")

    if original_extension and detected.extension and original_extension != detected.extension:
        if not (
            {original_extension, detected.extension} <= {".jpg", ".jpeg"}
            or {original_extension, detected.extension} <= {".heic", ".heif"}
            or {original_extension, detected.extension} <= {".mp4", ".m4v"}
            or {original_extension, detected.extension} <= {".txt", ".log"}
        ):
            raise ValidationError("Расширение файла не совпадает с фактическим содержимым.")

    return detected


def _normalized_output_name(original_name: str, detected: DetectedUpload) -> str:
    path = Path(original_name or "upload")
    stem = path.stem or "upload"
    current_extension = path.suffix.lower()
    if current_extension:
        return f"{stem}{current_extension}"
    return f"{stem}{detected.extension}"


def sanitize_upload(file_obj, policy: UploadPolicy):
    detected = validate_upload(file_obj, policy)
    if not policy.reencode_raster_images or not detected.is_raster_image:
        return file_obj

    payload = _read_file_bytes(file_obj)
    try:
        with Image.open(BytesIO(payload)) as image:
            image = ImageOps.exif_transpose(image)
            output = BytesIO()
            save_kwargs: dict[str, object] = {}
            image_format = "JPEG"
            output_content_type = "image/jpeg"
            output_extension = ".jpg"

            if detected.mime == "image/png":
                image_format = "PNG"
                output_content_type = "image/png"
                output_extension = ".png"
            elif detected.mime == "image/webp":
                image_format = "WEBP"
                output_content_type = "image/webp"
                output_extension = ".webp"

            if image_format == "JPEG":
                if image.mode not in {"RGB", "L"}:
                    image = image.convert("RGB")
                save_kwargs.update({"quality": 90, "optimize": True})
            elif image_format == "PNG":
                if image.mode not in {"RGB", "RGBA", "L", "LA"}:
                    image = image.convert("RGBA")
                save_kwargs.update({"optimize": True})
            else:
                if image.mode not in {"RGB", "RGBA"}:
                    image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
                save_kwargs.update({"quality": 90, "method": 6})

            image.save(output, format=image_format, **save_kwargs)
    except (UnidentifiedImageError, OSError) as exc:
        raise ValidationError("Файл изображения повреждён или не может быть обработан безопасно.") from exc

    sanitized_bytes = output.getvalue()
    if len(sanitized_bytes) > policy.max_bytes:
        raise ValidationError(f"{policy.label}: файл слишком большой после обработки.")

    return SimpleUploadedFile(
        name=_normalized_output_name(getattr(file_obj, "name", "upload"), DetectedUpload(detected.mime, output_extension, True)),
        content=sanitized_bytes,
        content_type=output_content_type,
    )


def image_upload_policy(max_bytes: int) -> UploadPolicy:
    return UploadPolicy(
        label="Изображение",
        max_bytes=max_bytes,
        allowed_mimes=frozenset({"image/jpeg", "image/png"}),
        allowed_extensions=frozenset({".jpg", ".jpeg", ".png"}),
        reencode_raster_images=True,
    )


def payment_proof_upload_policy(max_bytes: int) -> UploadPolicy:
    return UploadPolicy(
        label="Чек",
        max_bytes=max_bytes,
        allowed_mimes=frozenset(
            {
                "image/jpeg",
                "image/png",
                "image/webp",
                "image/heic",
                "image/heif",
                "application/pdf",
            }
        ),
        allowed_extensions=frozenset({".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".pdf"}),
        reencode_raster_images=True,
    )


def chat_file_upload_policy(max_bytes: int) -> UploadPolicy:
    return UploadPolicy(
        label="Файл чата",
        max_bytes=max_bytes,
        allowed_mimes=frozenset(
            {
                "image/jpeg",
                "image/png",
                "image/webp",
                "application/pdf",
                "text/plain",
                "application/zip",
                "video/mp4",
                "video/quicktime",
                "video/webm",
            }
        ),
        allowed_extensions=frozenset(
            {".jpg", ".jpeg", ".png", ".webp", ".pdf", ".txt", ".log", ".zip", ".mp4", ".mov", ".webm", ".m4v"}
        ),
        reencode_raster_images=True,
    )


def quick_reply_media_upload_policy(max_bytes: int) -> UploadPolicy:
    return UploadPolicy(
        label="Медиа шаблона",
        max_bytes=max_bytes,
        allowed_mimes=frozenset(
            {
                "image/jpeg",
                "image/png",
                "image/webp",
                "video/mp4",
                "video/quicktime",
                "video/webm",
            }
        ),
        allowed_extensions=frozenset({".jpg", ".jpeg", ".png", ".webp", ".mp4", ".mov", ".webm", ".m4v"}),
        reencode_raster_images=True,
    )
