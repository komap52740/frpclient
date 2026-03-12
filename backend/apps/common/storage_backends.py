from __future__ import annotations

import mimetypes
from io import BytesIO

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from django.conf import settings
from django.core.files.base import File
from django.core.files.storage import Storage
from django.utils.functional import cached_property


def media_storage_is_remote() -> bool:
    return (getattr(settings, "MEDIA_STORAGE_PROVIDER", "filesystem") or "filesystem").strip().lower() in {"r2", "s3"}


class PrivateR2MediaStorage(Storage):
    file_overwrite = False

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.bucket_name = (getattr(settings, "MEDIA_STORAGE_BUCKET_NAME", "") or "").strip()
        self.endpoint_url = (getattr(settings, "MEDIA_STORAGE_ENDPOINT_URL", "") or "").strip() or None
        self.region_name = (getattr(settings, "MEDIA_STORAGE_REGION_NAME", "auto") or "auto").strip()
        self.access_key_id = (getattr(settings, "MEDIA_STORAGE_ACCESS_KEY_ID", "") or "").strip()
        self.secret_access_key = (getattr(settings, "MEDIA_STORAGE_SECRET_ACCESS_KEY", "") or "").strip()
        self.location = (getattr(settings, "MEDIA_STORAGE_PREFIX", "media") or "media").strip().strip("/")
        self.signature_version = (getattr(settings, "MEDIA_STORAGE_SIGNATURE_VERSION", "s3v4") or "s3v4").strip()
        self.addressing_style = (getattr(settings, "MEDIA_STORAGE_ADDRESSING_STYLE", "virtual") or "virtual").strip()
        self.querystring_expire = int(getattr(settings, "MEDIA_STORAGE_QUERYSTRING_EXPIRE", 1800))

    @cached_property
    def client(self):
        config = Config(signature_version=self.signature_version, s3={"addressing_style": self.addressing_style})
        return boto3.client(
            "s3",
            endpoint_url=self.endpoint_url,
            region_name=self.region_name,
            aws_access_key_id=self.access_key_id,
            aws_secret_access_key=self.secret_access_key,
            config=config,
        )

    def _normalize_name(self, name: str) -> str:
        return str(name or "").lstrip("/").replace("\\", "/")

    def _full_key(self, name: str) -> str:
        normalized = self._normalize_name(name)
        if not self.location:
            return normalized
        if not normalized:
            return self.location
        return f"{self.location}/{normalized}"

    def _relative_name(self, key: str) -> str:
        normalized = self._normalize_name(key)
        if self.location and normalized.startswith(f"{self.location}/"):
            return normalized[len(self.location) + 1 :]
        return normalized

    def _open(self, name: str, mode: str = "rb"):
        buffer = BytesIO()
        self.client.download_fileobj(self.bucket_name, self._full_key(name), buffer)
        buffer.seek(0)
        return File(buffer, name=self._normalize_name(name))

    def _save(self, name: str, content) -> str:
        normalized = self.get_available_name(self._normalize_name(name), max_length=getattr(content, "max_length", None))
        extra_args = {"CacheControl": "private, no-store"}
        content_type = getattr(content, "content_type", "") or mimetypes.guess_type(normalized)[0]
        if content_type:
            extra_args["ContentType"] = content_type
        if hasattr(content, "seek"):
            content.seek(0)
        self.client.upload_fileobj(content, self.bucket_name, self._full_key(normalized), ExtraArgs=extra_args)
        return normalized

    def delete(self, name: str) -> None:
        normalized = self._normalize_name(name)
        if not normalized:
            return
        self.client.delete_object(Bucket=self.bucket_name, Key=self._full_key(normalized))

    def exists(self, name: str) -> bool:
        normalized = self._normalize_name(name)
        if not normalized:
            return False
        try:
            self.client.head_object(Bucket=self.bucket_name, Key=self._full_key(normalized))
            return True
        except ClientError as exc:
            error_code = str(exc.response.get("Error", {}).get("Code", ""))
            if error_code in {"404", "NoSuchKey", "NotFound"}:
                return False
            raise

    def size(self, name: str) -> int:
        response = self.client.head_object(Bucket=self.bucket_name, Key=self._full_key(name))
        return int(response["ContentLength"])

    def url(self, name: str, parameters: dict | None = None, expire: int | None = None, http_method: str | None = None) -> str:
        normalized = self._normalize_name(name)
        params = {
            "Bucket": self.bucket_name,
            "Key": self._full_key(normalized),
        }
        if parameters:
            params.update(parameters)
        return self.client.generate_presigned_url(
            "get_object",
            Params=params,
            ExpiresIn=int(expire or self.querystring_expire),
            HttpMethod=http_method,
        )

    def listdir(self, path: str):
        normalized_path = self._normalize_name(path)
        prefix = self._full_key(normalized_path).rstrip("/")
        if prefix:
            prefix = f"{prefix}/"
        paginator = self.client.get_paginator("list_objects_v2")
        directories: set[str] = set()
        files: list[str] = []
        for page in paginator.paginate(Bucket=self.bucket_name, Prefix=prefix):
            for item in page.get("Contents", []):
                relative = self._relative_name(item["Key"])
                remainder = relative[len(normalized_path.strip("/") + "/") :] if normalized_path else relative
                if "/" in remainder:
                    directories.add(remainder.split("/", 1)[0])
                elif remainder:
                    files.append(remainder)
        return sorted(directories), sorted(files)
