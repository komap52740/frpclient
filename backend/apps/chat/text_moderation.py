from __future__ import annotations

import re


class ChatMessageRejected(ValueError):
    """Raised when a client chat message does not pass moderation rules."""


PROFANITY_STEMS = (
    "хуй",
    "пизд",
    "бляд",
    "блят",
    "еба",
    "ебан",
    "пидор",
    "гандон",
)

SPAM_REPEAT_RE = re.compile(r"(.)\1{7,}", re.IGNORECASE)


def normalize_chat_text(text: str) -> str:
    return (text or "").strip()


def _contains_profanity(text: str) -> bool:
    words = re.findall(r"[a-zA-Zа-яА-ЯёЁ0-9_]+", (text or "").lower())
    return any(any(word.startswith(stem) for stem in PROFANITY_STEMS) for word in words)


def validate_client_chat_text(text: str) -> str:
    normalized = normalize_chat_text(text)
    if not normalized:
        return normalized

    if SPAM_REPEAT_RE.search(normalized):
        raise ChatMessageRejected("Сообщение похоже на спам. Опишите вопрос коротко и по делу.")

    if _contains_profanity(normalized):
        raise ChatMessageRejected("Сообщение содержит недопустимую лексику. Переформулируйте, пожалуйста.")

    alnum_count = sum(ch.isalnum() for ch in normalized)
    if alnum_count < 2 and len(normalized) < 4:
        raise ChatMessageRejected("Сообщение слишком короткое. Добавьте немного деталей.")

    return normalized
