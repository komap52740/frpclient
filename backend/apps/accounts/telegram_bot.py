from __future__ import annotations

import json
import logging
import time
from urllib import error as url_error
from urllib import request as url_request

from apps.appointments.client_actions import (
    CLIENT_SIGNAL_META,
    can_client_signal,
    create_client_signal,
    repeat_client_appointment,
)
from apps.appointments.models import Appointment
from apps.appointments.services import initialize_response_deadline
from apps.chat.models import Message
from apps.platform.services import create_notification, emit_event

from .models import RoleChoices, User
from .notifications import notify_masters_about_new_appointment

logger = logging.getLogger(__name__)

STATUS_LABELS = {
    "NEW": "Новая",
    "IN_REVIEW": "На проверке",
    "AWAITING_PAYMENT": "Ожидает оплату",
    "PAYMENT_PROOF_UPLOADED": "Чек загружен",
    "PAID": "Оплачено",
    "IN_PROGRESS": "В работе",
    "COMPLETED": "Завершена",
    "DECLINED_BY_MASTER": "Отклонена мастером",
    "CANCELLED": "Отменена",
}

LOCK_TYPE_LABELS = {
    "PIN": "PIN/пароль",
    "GOOGLE": "Google",
    "APPLE_ID": "Apple ID",
    "OTHER": "Другое",
}

SIGNAL_ALIASES = {
    "ready": "ready_for_session",
    "ready_for_session": "ready_for_session",
    "help": "need_help",
    "need_help": "need_help",
    "payment": "payment_issue",
    "payment_issue": "payment_issue",
    "reschedule": "need_reschedule",
    "need_reschedule": "need_reschedule",
}


def parse_yes_no(value: str) -> bool | None:
    normalized = (value or "").strip().lower()
    if normalized in {"да", "y", "yes", "1", "true"}:
        return True
    if normalized in {"нет", "n", "no", "0", "false"}:
        return False
    return None


def parse_lock_type_input(value: str) -> str | None:
    normalized = (value or "").strip().lower()
    if normalized in {"1", "pin", "пароль", "пин"}:
        return "PIN"
    if normalized in {"2", "google", "гугл"}:
        return "GOOGLE"
    if normalized in {"3", "apple", "apple_id", "appleid"}:
        return "APPLE_ID"
    if normalized in {"4", "other", "другое"}:
        return "OTHER"
    return None


def parse_signal_code(value: str) -> str | None:
    normalized = (value or "").strip().lower()
    return SIGNAL_ALIASES.get(normalized)


class ClientTelegramBot:
    def __init__(self, token: str, frontend_url: str = ""):
        self.token = token
        self.frontend_url = (frontend_url or "").rstrip("/")
        self.create_states: dict[int, dict] = {}
        self.active_appointments: dict[int, int] = {}

    @property
    def api_base(self) -> str:
        return f"https://api.telegram.org/bot{self.token}"

    def _request(self, method: str, payload: dict | None = None) -> dict:
        url = f"{self.api_base}/{method}"
        body = json.dumps(payload or {}).encode("utf-8")
        req = url_request.Request(
            url,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with url_request.urlopen(req, timeout=40) as response:
            raw = response.read().decode("utf-8")
        parsed = json.loads(raw)
        if not parsed.get("ok"):
            raise RuntimeError(f"Telegram API error for {method}: {parsed}")
        return parsed.get("result", {})

    def get_updates(self, *, offset: int = 0, timeout: int = 25) -> list[dict]:
        try:
            result = self._request(
                "getUpdates",
                {
                    "offset": offset,
                    "timeout": timeout,
                    "allowed_updates": ["message", "callback_query"],
                },
            )
            return result if isinstance(result, list) else []
        except (url_error.URLError, TimeoutError, OSError, RuntimeError) as exc:
            logger.warning("getUpdates failed: %s", exc)
            return []

    def send_message(self, chat_id: int, text: str, *, reply_markup: dict | None = None) -> None:
        payload = {
            "chat_id": int(chat_id),
            "text": text,
            "disable_web_page_preview": True,
        }
        if reply_markup:
            payload["reply_markup"] = reply_markup
        try:
            self._request("sendMessage", payload)
        except (url_error.URLError, TimeoutError, OSError, RuntimeError) as exc:
            logger.warning("sendMessage failed for chat_id=%s: %s", chat_id, exc)

    def answer_callback(self, callback_query_id: str, text: str = "") -> None:
        payload = {"callback_query_id": callback_query_id}
        if text:
            payload["text"] = text[:180]
        try:
            self._request("answerCallbackQuery", payload)
        except (url_error.URLError, TimeoutError, OSError, RuntimeError) as exc:
            logger.warning("answerCallbackQuery failed: %s", exc)

    def run_forever(self, *, drop_pending_updates: bool = True) -> None:
        offset = 0
        if drop_pending_updates:
            pending = self.get_updates(offset=0, timeout=0)
            if pending:
                offset = pending[-1]["update_id"] + 1

        while True:
            try:
                updates = self.get_updates(offset=offset, timeout=25)
                if not updates:
                    continue
                for update in updates:
                    offset = max(offset, int(update.get("update_id", 0)) + 1)
                    self.process_update(update)
            except KeyboardInterrupt:
                raise
            except Exception as exc:  # noqa: BLE001
                logger.exception("Unhandled bot loop error: %s", exc)
                time.sleep(1.0)

    def process_update(self, update: dict) -> None:
        if "callback_query" in update:
            self._handle_callback_query(update["callback_query"])
            return
        message = update.get("message") or {}
        if not message:
            return
        self._handle_message(message)

    def _linked_client(self, chat_id: int) -> User | None:
        user = User.objects.filter(telegram_id=chat_id).first()
        if not user:
            return None
        if user.role != RoleChoices.CLIENT:
            return None
        return user

    def _ensure_client(self, chat_id: int) -> User | None:
        user = self._linked_client(chat_id)
        if user:
            return user

        help_text = "Аккаунт не найден. Сначала войдите на сайт через Telegram и привяжите профиль."
        if self.frontend_url:
            help_text += f"\nВход: {self.frontend_url}/login"
        self.send_message(chat_id, help_text)
        return None

    def _main_menu_markup(self) -> dict:
        return {
            "inline_keyboard": [
                [
                    {"text": "👤 Профиль", "callback_data": "menu:profile"},
                    {"text": "📋 Мои заявки", "callback_data": "menu:my"},
                ],
                [
                    {"text": "➕ Новая заявка", "callback_data": "menu:new"},
                    {"text": "ℹ️ Помощь", "callback_data": "menu:help"},
                ],
            ]
        }

    def _signal_markup(self, appointment_id: int) -> dict:
        return {
            "inline_keyboard": [
                [
                    {"text": "✅ Готов к подключению", "callback_data": f"sig:{appointment_id}:ready_for_session"},
                ],
                [
                    {"text": "🆘 Нужна помощь", "callback_data": f"sig:{appointment_id}:need_help"},
                    {"text": "💳 Проблема с оплатой", "callback_data": f"sig:{appointment_id}:payment_issue"},
                ],
                [
                    {"text": "🕒 Перенести сессию", "callback_data": f"sig:{appointment_id}:need_reschedule"},
                ],
            ]
        }

    def _format_profile(self, user: User) -> str:
        return (
            "Профиль клиента\n"
            f"Ник: {user.username}\n"
            f"Telegram: @{user.telegram_username or '-'}\n"
            f"Заблокирован: {'Да' if user.is_banned else 'Нет'}"
        )

    def _format_appointment_short(self, appointment: Appointment) -> str:
        status = STATUS_LABELS.get(appointment.status, appointment.status)
        unread = appointment.messages.exclude(sender_id=appointment.client_id).filter(is_deleted=False).count()
        return f"#{appointment.id} • {appointment.brand} {appointment.model} • {status} • новых: {unread}"

    def _format_appointment_detail(self, appointment: Appointment) -> str:
        status = STATUS_LABELS.get(appointment.status, appointment.status)
        master_name = appointment.assigned_master.username if appointment.assigned_master else "-"
        lines = [
            f"Заявка #{appointment.id}",
            f"Статус: {status}",
            f"Устройство: {appointment.brand} {appointment.model}",
            f"Тип: {LOCK_TYPE_LABELS.get(appointment.lock_type, appointment.lock_type)}",
            f"Есть ПК: {'Да' if appointment.has_pc else 'Нет'}",
            f"Мастер: {master_name}",
            f"Цена: {appointment.total_price or 'не выставлена'}",
            f"Описание: {appointment.description or '-'}",
        ]
        if self.frontend_url:
            lines.append(f"Открыть на сайте: {self.frontend_url}/appointments/{appointment.id}")
        return "\n".join(lines)

    def _appointment_actions_markup(self, appointment: Appointment) -> dict:
        rows = [
            [
                {"text": "🔄 Обновить", "callback_data": f"app:{appointment.id}"},
                {"text": "💬 Сделать активной", "callback_data": f"chatset:{appointment.id}"},
            ],
            [{"text": "📣 Сигнал мастеру", "callback_data": f"signalmenu:{appointment.id}"}],
        ]
        if appointment.status in {"COMPLETED", "DECLINED_BY_MASTER", "CANCELLED"}:
            rows.append([{"text": "♻️ Повторить заявку", "callback_data": f"repeat:{appointment.id}"}])
        return {"inline_keyboard": rows}

    def _help_text(self) -> str:
        return (
            "Команды бота:\n"
            "/menu — главное меню\n"
            "/profile — профиль клиента\n"
            "/my — список заявок\n"
            "/open <id> — открыть заявку\n"
            "/new — создать новую заявку (пошагово)\n"
            "/cancel — отменить текущее действие\n"
            "/active <id> — выбрать активную заявку для чата\n"
            "/chat <id> <текст> — отправить в чат заявки\n"
            "/signal <id> <ready|help|payment|reschedule> [комментарий]\n"
            "/repeat <id> — создать похожую заявку\n\n"
            "Если активная заявка выбрана, обычное текстовое сообщение уйдет в чат этой заявки."
        )

    def _show_menu(self, chat_id: int) -> None:
        self.send_message(chat_id, "Главное меню клиента", reply_markup=self._main_menu_markup())

    def _show_my_appointments(self, chat_id: int, user: User) -> None:
        items = list(
            Appointment.objects.filter(client=user)
            .select_related("assigned_master")
            .order_by("-updated_at")[:8]
        )
        if not items:
            self.send_message(chat_id, "У вас пока нет заявок. Используйте /new для создания.")
            return

        lines = ["Ваши заявки:"]
        keyboard = []
        for appointment in items:
            lines.append(self._format_appointment_short(appointment))
            keyboard.append(
                [
                    {
                        "text": f"Открыть #{appointment.id}",
                        "callback_data": f"app:{appointment.id}",
                    }
                ]
            )
        keyboard.append([{"text": "➕ Создать заявку", "callback_data": "menu:new"}])
        self.send_message(chat_id, "\n".join(lines), reply_markup={"inline_keyboard": keyboard})

    def _resolve_client_appointment(self, user: User, appointment_id: int) -> Appointment | None:
        return Appointment.objects.filter(id=appointment_id, client=user).select_related("assigned_master").first()

    def _show_appointment(self, chat_id: int, user: User, appointment_id: int) -> None:
        appointment = self._resolve_client_appointment(user, appointment_id)
        if not appointment:
            self.send_message(chat_id, "Заявка не найдена или нет доступа.")
            return
        self.send_message(
            chat_id,
            self._format_appointment_detail(appointment),
            reply_markup=self._appointment_actions_markup(appointment),
        )

    def _start_create_flow(self, chat_id: int, user: User) -> None:
        if user.is_banned:
            self.send_message(chat_id, "Ваш аккаунт ограничен. Создание заявок недоступно.")
            return
        self.create_states[chat_id] = {"step": "brand", "payload": {}}
        self.send_message(chat_id, "Шаг 1/5. Введите бренд устройства (например, Samsung).")

    def _cancel_state(self, chat_id: int) -> None:
        self.create_states.pop(chat_id, None)
        self.send_message(chat_id, "Текущее действие отменено.")

    def _process_create_flow(self, chat_id: int, user: User, text: str) -> bool:
        state = self.create_states.get(chat_id)
        if not state:
            return False

        step = state["step"]
        payload = state["payload"]
        value = (text or "").strip()
        if not value:
            self.send_message(chat_id, "Введите значение, поле не может быть пустым.")
            return True

        if step == "brand":
            payload["brand"] = value[:255]
            state["step"] = "model"
            self.send_message(chat_id, "Шаг 2/5. Введите модель устройства.")
            return True

        if step == "model":
            payload["model"] = value[:255]
            state["step"] = "lock_type"
            self.send_message(
                chat_id,
                "Шаг 3/5. Тип блокировки:\n1) PIN\n2) GOOGLE\n3) APPLE_ID\n4) OTHER",
            )
            return True

        if step == "lock_type":
            lock_type = parse_lock_type_input(value)
            if not lock_type:
                self.send_message(chat_id, "Не понял тип блокировки. Введите 1/2/3/4 или название.")
                return True
            payload["lock_type"] = lock_type
            state["step"] = "has_pc"
            self.send_message(chat_id, "Шаг 4/5. Есть ПК? (да/нет)")
            return True

        if step == "has_pc":
            has_pc = parse_yes_no(value)
            if has_pc is None:
                self.send_message(chat_id, "Ответьте: да или нет.")
                return True
            payload["has_pc"] = has_pc
            state["step"] = "description"
            self.send_message(chat_id, "Шаг 5/5. Кратко опишите проблему.")
            return True

        if step == "description":
            payload["description"] = value[:4000]
            appointment = Appointment.objects.create(client=user, **payload)
            initialize_response_deadline(appointment)
            emit_event(
                "appointment.created",
                appointment,
                actor=user,
                payload={"status": appointment.status, "created_via": "telegram_bot"},
            )
            notify_masters_about_new_appointment(appointment)
            self.create_states.pop(chat_id, None)
            self.active_appointments[chat_id] = appointment.id
            self.send_message(
                chat_id,
                f"Заявка создана: #{appointment.id}\n"
                "Я сделал ее активной для чата. Просто отправьте текст, и он уйдет в чат этой заявки.",
                reply_markup=self._appointment_actions_markup(appointment),
            )
            return True

        return False

    def _send_chat_message(self, *, chat_id: int, user: User, appointment_id: int, text: str) -> None:
        appointment = self._resolve_client_appointment(user, appointment_id)
        if not appointment:
            self.send_message(chat_id, "Заявка не найдена или нет доступа.")
            return

        normalized = (text or "").strip()
        if not normalized:
            self.send_message(chat_id, "Пустое сообщение не отправлено.")
            return

        message = Message.objects.create(appointment=appointment, sender=user, text=normalized)
        emit_event(
            "chat.message_sent",
            message,
            actor=user,
            payload={"appointment_id": appointment.id, "source": "telegram_bot"},
        )
        if appointment.assigned_master_id:
            create_notification(
                user=appointment.assigned_master,
                type="appointment",
                title=f"Новое сообщение в заявке #{appointment.id}",
                message="Клиент отправил сообщение через Telegram-бот.",
                payload={"appointment_id": appointment.id},
            )
        self.send_message(chat_id, f"Сообщение отправлено в заявку #{appointment.id}.")

    def _process_signal(self, *, chat_id: int, user: User, appointment_id: int, signal_code: str, comment: str = "") -> None:
        appointment = self._resolve_client_appointment(user, appointment_id)
        if not appointment:
            self.send_message(chat_id, "Заявка не найдена или нет доступа.")
            return
        if not can_client_signal(appointment):
            self.send_message(chat_id, "Для текущего статуса сигнал недоступен.")
            return
        create_client_signal(
            appointment=appointment,
            client_user=user,
            signal_code=signal_code,
            comment=comment,
        )
        title = CLIENT_SIGNAL_META[signal_code]["title"]
        self.send_message(chat_id, f"Сигнал отправлен: {title}")

    def _process_repeat(self, *, chat_id: int, user: User, appointment_id: int) -> None:
        source = self._resolve_client_appointment(user, appointment_id)
        if not source:
            self.send_message(chat_id, "Заявка не найдена или нет доступа.")
            return
        if user.is_banned:
            self.send_message(chat_id, "Ваш аккаунт ограничен. Создание заявок недоступно.")
            return
        repeated = repeat_client_appointment(source=source, client_user=user)
        self.active_appointments[chat_id] = repeated.id
        self.send_message(
            chat_id,
            f"Создана новая заявка #{repeated.id} на основе #{source.id}.",
            reply_markup=self._appointment_actions_markup(repeated),
        )

    def _handle_callback_query(self, callback: dict) -> None:
        callback_id = callback.get("id", "")
        data = callback.get("data", "")
        message = callback.get("message") or {}
        chat = message.get("chat") or {}
        chat_id = int(chat.get("id", 0))
        if not chat_id:
            self.answer_callback(callback_id)
            return

        user = self._ensure_client(chat_id)
        if not user:
            self.answer_callback(callback_id, "Нужна привязка аккаунта")
            return

        if data == "menu:profile":
            self.send_message(chat_id, self._format_profile(user), reply_markup=self._main_menu_markup())
        elif data == "menu:my":
            self._show_my_appointments(chat_id, user)
        elif data == "menu:new":
            self._start_create_flow(chat_id, user)
        elif data == "menu:help":
            self.send_message(chat_id, self._help_text(), reply_markup=self._main_menu_markup())
        elif data.startswith("app:"):
            appointment_id = int(data.split(":")[1])
            self._show_appointment(chat_id, user, appointment_id)
        elif data.startswith("chatset:"):
            appointment_id = int(data.split(":")[1])
            if self._resolve_client_appointment(user, appointment_id):
                self.active_appointments[chat_id] = appointment_id
                self.send_message(
                    chat_id,
                    f"Активная заявка для чата: #{appointment_id}. Теперь обычный текст уйдет в ее чат.",
                )
            else:
                self.send_message(chat_id, "Заявка не найдена или нет доступа.")
        elif data.startswith("signalmenu:"):
            appointment_id = int(data.split(":")[1])
            self.send_message(chat_id, "Выберите быстрый сигнал:", reply_markup=self._signal_markup(appointment_id))
        elif data.startswith("sig:"):
            _, appointment_id_raw, signal_code = data.split(":", maxsplit=2)
            self._process_signal(
                chat_id=chat_id,
                user=user,
                appointment_id=int(appointment_id_raw),
                signal_code=signal_code,
            )
        elif data.startswith("repeat:"):
            appointment_id = int(data.split(":")[1])
            self._process_repeat(chat_id=chat_id, user=user, appointment_id=appointment_id)

        self.answer_callback(callback_id)

    def _handle_message(self, message: dict) -> None:
        chat = message.get("chat") or {}
        chat_id = int(chat.get("id", 0))
        if not chat_id:
            return

        text = (message.get("text") or "").strip()
        if not text:
            return

        user = self._ensure_client(chat_id)
        if not user:
            return

        if text.lower() == "/cancel":
            self._cancel_state(chat_id)
            return

        if self._process_create_flow(chat_id, user, text):
            return

        if text.startswith("/"):
            self._handle_command(chat_id, user, text)
            return

        active_appointment_id = self.active_appointments.get(chat_id)
        if active_appointment_id:
            self._send_chat_message(
                chat_id=chat_id,
                user=user,
                appointment_id=active_appointment_id,
                text=text,
            )
            return

        self.send_message(
            chat_id,
            "Выберите заявку через /my или /open <id>, чтобы писать в чат. Либо используйте /new для создания заявки.",
            reply_markup=self._main_menu_markup(),
        )

    def _handle_command(self, chat_id: int, user: User, text: str) -> None:
        parts = text.split(" ", maxsplit=2)
        command = parts[0].lower()

        if command in {"/start", "/menu"}:
            self._show_menu(chat_id)
            return
        if command == "/help":
            self.send_message(chat_id, self._help_text(), reply_markup=self._main_menu_markup())
            return
        if command == "/profile":
            self.send_message(chat_id, self._format_profile(user), reply_markup=self._main_menu_markup())
            return
        if command == "/my":
            self._show_my_appointments(chat_id, user)
            return
        if command == "/new":
            self._start_create_flow(chat_id, user)
            return
        if command == "/open":
            if len(parts) < 2 or not parts[1].isdigit():
                self.send_message(chat_id, "Формат: /open <id>")
                return
            self._show_appointment(chat_id, user, int(parts[1]))
            return
        if command == "/active":
            if len(parts) < 2 or not parts[1].isdigit():
                self.send_message(chat_id, "Формат: /active <id>")
                return
            appointment_id = int(parts[1])
            if not self._resolve_client_appointment(user, appointment_id):
                self.send_message(chat_id, "Заявка не найдена или нет доступа.")
                return
            self.active_appointments[chat_id] = appointment_id
            self.send_message(chat_id, f"Активная заявка: #{appointment_id}.")
            return
        if command == "/chat":
            if len(parts) < 3:
                self.send_message(chat_id, "Формат: /chat <id> <сообщение>")
                return
            if not parts[1].isdigit():
                self.send_message(chat_id, "ID заявки должен быть числом.")
                return
            self._send_chat_message(
                chat_id=chat_id,
                user=user,
                appointment_id=int(parts[1]),
                text=parts[2],
            )
            return
        if command == "/signal":
            chunks = text.split(" ", maxsplit=3)
            if len(chunks) < 3:
                self.send_message(chat_id, "Формат: /signal <id> <ready|help|payment|reschedule> [комментарий]")
                return
            appointment_id_raw = chunks[1]
            signal_raw = chunks[2]
            comment = chunks[3] if len(chunks) > 3 else ""
            if not appointment_id_raw.isdigit():
                self.send_message(chat_id, "ID заявки должен быть числом.")
                return
            signal_code = parse_signal_code(signal_raw)
            if not signal_code:
                self.send_message(chat_id, "Сигнал не распознан. Доступно: ready, help, payment, reschedule.")
                return
            self._process_signal(
                chat_id=chat_id,
                user=user,
                appointment_id=int(appointment_id_raw),
                signal_code=signal_code,
                comment=comment,
            )
            return
        if command == "/repeat":
            if len(parts) < 2 or not parts[1].isdigit():
                self.send_message(chat_id, "Формат: /repeat <id>")
                return
            self._process_repeat(chat_id=chat_id, user=user, appointment_id=int(parts[1]))
            return

        self.send_message(chat_id, "Неизвестная команда. Используйте /help.")

