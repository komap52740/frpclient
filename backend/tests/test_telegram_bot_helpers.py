from __future__ import annotations

import pytest

from apps.accounts.telegram_bot import (
    parse_lock_type_input,
    parse_signal_code,
    parse_yes_no,
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("да", True),
        ("YES", True),
        ("1", True),
        ("нет", False),
        ("0", False),
        ("No", False),
        ("maybe", None),
    ],
)
def test_parse_yes_no(raw, expected):
    assert parse_yes_no(raw) == expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("1", "PIN"),
        ("pin", "PIN"),
        ("2", "GOOGLE"),
        ("google", "GOOGLE"),
        ("3", "APPLE_ID"),
        ("apple", "APPLE_ID"),
        ("4", "OTHER"),
        ("другое", "OTHER"),
        ("unknown", None),
    ],
)
def test_parse_lock_type_input(raw, expected):
    assert parse_lock_type_input(raw) == expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("ready", "ready_for_session"),
        ("help", "need_help"),
        ("payment", "payment_issue"),
        ("reschedule", "need_reschedule"),
        ("need_help", "need_help"),
        ("wrong", None),
    ],
)
def test_parse_signal_code(raw, expected):
    assert parse_signal_code(raw) == expected

