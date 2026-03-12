import { accessibleFocusRingInsetSx, accessibleFocusRingSx } from "../../../shared/ui/focusStyles";

export const authInputSx = {
  "& .MuiInputLabel-root": {
    color: "rgba(188, 207, 232, 0.82)",
    fontWeight: 600,
  },
  "& .MuiInputLabel-root.Mui-focused": {
    color: "#bfe0ff",
  },
  "& .MuiOutlinedInput-root": {
    borderRadius: 1.9,
    fontWeight: 600,
    color: "#f1f7ff",
    background: "rgba(9, 20, 39, 0.76)",
    transition: "all .22s ease",
    "& fieldset": {
      borderColor: "rgba(132, 169, 224, 0.36)",
      borderWidth: 1.1,
    },
    "&:hover fieldset": {
      borderColor: "rgba(148, 193, 255, 0.62)",
    },
    "&.Mui-focused fieldset": {
      borderColor: "rgba(150, 204, 255, 0.95)",
      boxShadow: "0 0 0 3px rgba(86, 157, 255, 0.14)",
    },
    ...accessibleFocusRingInsetSx,
  },
  "& .MuiInputBase-input": {
    py: 1.32,
  },
};

export const authPrimaryButtonSx = {
  minHeight: 52,
  borderRadius: 3,
  py: 1.15,
  px: 1.7,
  textTransform: "none",
  fontWeight: 800,
  letterSpacing: 0.1,
  fontSize: 18,
  fontFamily: "'Manrope', 'Segoe UI', sans-serif",
  background: "linear-gradient(135deg, #7fbeff 0%, #4f8dff 45%, #386de2 100%)",
  color: "#f7fcff",
  border: "1.2px solid rgba(160, 204, 255, 0.58)",
  boxShadow: "0 16px 30px rgba(45, 111, 226, 0.34), inset 0 1px 0 rgba(255,255,255,0.22)",
  transition: "all .2s ease",
  "&:hover": {
    background: "linear-gradient(135deg, #8bc4ff 0%, #5b97ff 45%, #477eef 100%)",
    boxShadow: "0 18px 36px rgba(52, 123, 241, 0.42), inset 0 1px 0 rgba(255,255,255,0.26)",
    transform: "translateY(-1px)",
  },
  "&:active": {
    transform: "translateY(0)",
    boxShadow: "0 8px 22px rgba(45, 111, 226, 0.28), inset 0 1px 0 rgba(255,255,255,0.18)",
  },
  "&.Mui-disabled": {
    color: "rgba(213,230,255,0.72)",
    background: "linear-gradient(135deg, rgba(91,145,222,0.62) 0%, rgba(69,116,199,0.6) 100%)",
    borderColor: "rgba(152,188,236,0.38)",
  },
  ...accessibleFocusRingSx,
};

export const AUTH_PROVIDER_BUTTON_HEIGHT = 56;

const oauthButtonBaseSx = {
  minHeight: AUTH_PROVIDER_BUTTON_HEIGHT,
  borderRadius: 2.8,
  px: 1.9,
  textTransform: "none",
  fontWeight: 800,
  letterSpacing: 0.12,
  fontSize: { xs: 16, sm: 17 },
  fontFamily: "'Manrope', 'Segoe UI', sans-serif",
  lineHeight: 1.2,
  borderWidth: 1.3,
  justifyContent: "center",
  transition: "all .18s ease",
  boxShadow: "0 12px 24px rgba(5,12,28,0.35), inset 0 1px 0 rgba(255,255,255,0.12)",
  "& .MuiButton-startIcon": {
    mr: 1,
  },
  "&:active": {
    transform: "translateY(0)",
  },
  ...accessibleFocusRingSx,
};

export const oauthServiceButtonSx = {
  ...oauthButtonBaseSx,
  color: "#e9f4ff",
  borderColor: "rgba(139,188,248,0.62)",
  background: "linear-gradient(145deg, rgba(28,53,96,0.9) 0%, rgba(17,34,67,0.92) 100%)",
  "&:hover": {
    borderColor: "rgba(159,208,255,0.92)",
    background: "linear-gradient(145deg, rgba(36,66,116,0.95) 0%, rgba(23,45,86,0.95) 100%)",
    boxShadow: "0 16px 30px rgba(19,59,122,0.34)",
    transform: "translateY(-1px)",
  },
  "&.Mui-disabled": {
    color: "rgba(220,236,255,0.64)",
    background: "linear-gradient(145deg, rgba(27,47,83,0.72) 0%, rgba(18,33,62,0.72) 100%)",
    borderColor: "rgba(130,175,230,0.38)",
  },
};

export const oauthTelegramShellSx = {
  borderRadius: 2.8,
  border: "1.3px solid rgba(139,188,248,0.62)",
  background: "linear-gradient(145deg, rgba(28,53,96,0.9) 0%, rgba(17,34,67,0.92) 100%)",
  minHeight: AUTH_PROVIDER_BUTTON_HEIGHT,
  px: 1.2,
  py: 0.8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 12px 24px rgba(5,12,28,0.35), inset 0 1px 0 rgba(255,255,255,0.12)",
  transition: "all .18s ease",
  "&:hover": {
    borderColor: "rgba(159,208,255,0.92)",
    background: "linear-gradient(145deg, rgba(36,66,116,0.95) 0%, rgba(23,45,86,0.95) 100%)",
    boxShadow: "0 16px 30px rgba(19,59,122,0.34)",
    transform: "translateY(-1px)",
  },
  ...accessibleFocusRingSx,
};

export const oauthTelegramFallbackButtonSx = {
  ...oauthServiceButtonSx,
  minHeight: AUTH_PROVIDER_BUTTON_HEIGHT - 8,
  borderRadius: 2.5,
  fontSize: { xs: 15, sm: 16 },
  px: 1.5,
};

export const providerBadgeSx = {
  width: 27,
  height: 27,
  borderRadius: "50%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  fontWeight: 900,
  flexShrink: 0,
  color: "#d9ecff",
  border: "1px solid rgba(169,208,255,0.42)",
  background: "rgba(16,36,70,0.72)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.24), 0 6px 14px rgba(0,0,0,0.28)",
};

export const LOGIN_FAQ_ITEMS = [
  {
    question: "Можно ли работать полностью удаленно?",
    answer: "Да. Все этапы ведутся онлайн: заявка, чат, оплата и сопровождение мастером.",
  },
  {
    question: "Когда давать RuDesktop-данные?",
    answer:
      "Можно сразу при создании заявки или позже в карточке, когда мастер запросит подключение.",
  },
  {
    question: "Как контролировать процесс?",
    answer: "В карточке заявки видны статусы и сообщения. Никаких скрытых этапов.",
  },
];

export const LANDING_PRICE_ITEMS = [
  {
    title: "Базовая разблокировка",
    price: "от 1 500 ₽",
    eta: "10-30 минут",
    note: "Типовые кейсы после сброса/аккаунта.",
  },
  {
    title: "Сложный кейс",
    price: "от 3 500 ₽",
    eta: "30-90 минут",
    note: "Редкие модели и нестандартные ограничения.",
  },
  {
    title: "B2B-партнёр",
    price: "индивидуально",
    eta: "SLA и приоритет",
    note: "Потоковые заявки и приоритетная обработка.",
  },
];

export const LANDING_CASE_ITEMS = [
  {
    device: "Samsung A54",
    issue: "FRP после сброса",
    result: "Разблокировано за 18 минут",
    finalPrice: "2 000 ₽",
  },
  {
    device: "Xiaomi Redmi Note",
    issue: "Google-аккаунт + блокировка входа",
    result: "Решено в чате за 42 минуты",
    finalPrice: "3 200 ₽",
  },
  {
    device: "Honor / Huawei",
    issue: "Сложный вход после обновления",
    result: "Сессия с мастером, статус «Готово»",
    finalPrice: "4 500 ₽",
  },
];
