import { brandConfig } from "../../../shared/config/brandConfig";

function hasValue(value) {
  return Boolean(String(value || "").trim());
}

function countPhotos(wholesale = {}) {
  return [wholesale.wholesale_service_photo_1_url, wholesale.wholesale_service_photo_2_url].filter(
    Boolean
  ).length;
}

export function getWholesaleSupportLink() {
  const supportTelegram = brandConfig.supportTelegram || "@frpnnow";
  return supportTelegram.startsWith("@")
    ? `https://t.me/${supportTelegram.slice(1)}`
    : `https://t.me/${supportTelegram}`;
}

export function buildWholesaleReadiness(wholesale = {}) {
  const status = wholesale.wholesale_status || "none";
  const company = String(wholesale.wholesale_company_name || "").trim();
  const city = String(wholesale.wholesale_city || "").trim();
  const address = String(wholesale.wholesale_address || "").trim();
  const photoCount = countPhotos(wholesale);
  const reviewComment = String(wholesale.wholesale_review_comment || "").trim();
  const supportTelegram = brandConfig.supportTelegram || "@frpnnow";
  const supportUrl = getWholesaleSupportLink();

  const checklist = [
    {
      key: "company",
      label: "Компания",
      done: hasValue(company),
      hint: company || "Укажите название сервисного центра или партнёрской точки.",
    },
    {
      key: "location",
      label: "Город и адрес",
      done: hasValue(city) && hasValue(address),
      hint:
        hasValue(city) && hasValue(address)
          ? `${city} • ${address}`
          : "Добавьте город и точный адрес сервисной точки.",
    },
    {
      key: "photos",
      label: "Фото сервисной зоны",
      done: photoCount > 0,
      hint:
        photoCount > 0
          ? `Загружено фото: ${photoCount}`
          : "Нужно хотя бы одно фото сервисной зоны или стойки.",
    },
  ];

  if (status === "approved") {
    return {
      status,
      isOperational: true,
      title: "Партнёрская линия активна",
      description:
        "Карточка компании подтверждена. В B2B-очереди видны только партнёрские кейсы с отдельной маршрутизацией и SLA.",
      queueHint:
        "Отдельной B2B-формы нет: новая заявка создаётся через общий сценарий, а для approved-клиента автоматически входит в B2B-маршрут.",
      primaryAction: { label: "Открыть очередь", to: "/wholesale/orders" },
      secondaryAction: { label: "Карточка компании", to: "/wholesale/profile" },
      supportTelegram,
      supportUrl,
      checklist,
      note: reviewComment ? `Комментарий модерации: ${reviewComment}` : "",
    };
  }

  if (status === "pending") {
    return {
      status,
      isOperational: false,
      title: "Заявка на проверке",
      description:
        "Модерация уже идёт. Держите карточку компании в актуальном состоянии, чтобы B2B-активация не зависла на ручной проверке.",
      queueHint:
        "После одобрения новые заявки, созданные через общий сценарий, начнут автоматически попадать в B2B-очередь.",
      primaryAction: { label: "Проверить профиль", to: "/wholesale/profile" },
      secondaryAction: { label: "Редактировать реквизиты", to: "/client/profile" },
      supportTelegram,
      supportUrl,
      checklist,
      note: reviewComment
        ? `Комментарий модерации: ${reviewComment}`
        : "Если проверка затянулась, уточните статус через партнёрскую поддержку.",
    };
  }

  if (status === "rejected") {
    return {
      status,
      isOperational: false,
      title: "Нужна повторная подача",
      description: reviewComment
        ? "Модерация вернула карточку на доработку. Исправьте реквизиты и отправьте заявку повторно, чтобы вернуть B2B-линию в рабочий режим."
        : "Карточка не прошла модерацию. Исправьте реквизиты, загрузите актуальные материалы точки и отправьте заявку повторно.",
      queueHint:
        "Пока карточка не исправлена, новые заявки, созданные через общий сценарий, не будут входить в B2B-маршрут.",
      primaryAction: { label: "Исправить реквизиты", to: "/client/profile" },
      secondaryAction: { label: "Открыть профиль B2B", to: "/wholesale/profile" },
      supportTelegram,
      supportUrl,
      checklist,
      note: reviewComment ? `Причина отклонения: ${reviewComment}` : "",
    };
  }

  return {
    status: "none",
    isOperational: false,
    title: "B2B-контур ещё не активирован",
    description:
      "Заполните карточку компании и отправьте заявку на подключение. После подтверждения сюда начнут попадать только партнёрские кейсы.",
    queueHint:
      "Пока B2B не активирован, отдельной B2B-очереди нет: заявки создаются общим способом и остаются в обычном клиентском потоке.",
    primaryAction: { label: "Заполнить профиль", to: "/client/profile" },
    secondaryAction: { label: "Открыть B2B-профиль", to: "/wholesale/profile" },
    supportTelegram,
    supportUrl,
    checklist,
    note: "Для активации нужен минимум один снимок сервисной точки и заполненные реквизиты компании.",
  };
}
