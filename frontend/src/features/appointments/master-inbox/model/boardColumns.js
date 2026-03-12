export const MASTER_NEW_BOARD_COLUMNS = [
  {
    id: "new",
    title: "Новые",
    description:
      "Очередь доступных заявок. Перетащите карточку в соседнюю колонку, чтобы сразу взять ее в работу.",
  },
  {
    id: "in_review",
    title: "В работе сейчас",
    description:
      "Ваши заявки в статусе IN_REVIEW. Это быстрая зона контроля перед выставлением цены.",
  },
];

export const MASTER_ACTIVE_BOARD_COLUMNS = [
  {
    id: "IN_REVIEW",
    title: "На ревью",
    description: "Уточнение деталей, первичный чат и выставление цены.",
  },
  {
    id: "AWAITING_PAYMENT",
    title: "Ждет оплату",
    description: "Клиенту уже выставлена цена. Контролируем оплату и вопросы по реквизитам.",
  },
  {
    id: "PAYMENT_PROOF_UPLOADED",
    title: "Чек на проверке",
    description: "Чек уже загружен. Здесь важны скорость ответа и подтверждение оплаты.",
  },
  {
    id: "PAID",
    title: "Оплачено",
    description: "Можно запускать работу и переводить заявку в IN_PROGRESS.",
  },
  {
    id: "IN_PROGRESS",
    title: "В работе",
    description: "Активные сессии и задачи, которые нужно довести до COMPLETED.",
  },
];
