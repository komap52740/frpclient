import { brandConfig } from "../../shared/config/brandConfig";

export function hasWholesalePortalAccess(user) {
  if (!user || user.role !== "client") {
    return false;
  }
  return Boolean(
    user.is_service_center || (user.wholesale_status && user.wholesale_status !== "none")
  );
}

export function buildMenu(role, user) {
  if (role === "client") {
    const baseMenu = [
      { label: "Главная", to: "/client/home" },
      { label: "Новая заявка", to: "/client/create" },
      { label: "Мои заявки", to: "/client/my" },
      { label: "Профиль", to: "/client/profile" },
    ];
    if (hasWholesalePortalAccess(user)) {
      return [
        ...baseMenu,
        { label: "B2B обзор", to: "/wholesale" },
        { label: "B2B очередь", to: "/wholesale/orders" },
        { label: "B2B профиль", to: "/wholesale/profile" },
      ];
    }
    return [...baseMenu, { label: "B2B", to: "/wholesale" }];
  }

  if (role === "master") {
    return [
      { label: "Новые заявки", to: "/master/new" },
      { label: "Активные", to: "/master/active" },
      { label: "Клиенты", to: "/master/clients" },
      { label: "Быстрые ответы", to: "/master/quick-replies" },
      { label: "Отзывы", to: "/master/reviews" },
      { label: "Профиль", to: "/master/profile" },
    ];
  }

  if (role === "admin") {
    return [
      { label: "Система", to: "/admin/system" },
      { label: "Профиль", to: "/admin/profile" },
      { label: "Заявки", to: "/admin/appointments" },
      { label: "Правила", to: "/admin/rules" },
      { label: "Отзывы", to: "/admin/reviews" },
      { label: "Пользователи", to: "/admin/users" },
      { label: "Клиенты", to: "/admin/clients" },
      { label: "Мастера", to: "/admin/masters" },
    ];
  }

  return [];
}

export function getRoleLabel(role) {
  if (role === "client") return "Клиент";
  if (role === "master") return "Мастер";
  if (role === "admin") return "Админ";
  return "Пользователь";
}

export function buildWholesaleBadge(user) {
  if (!user || user.role !== "client") {
    return null;
  }

  const status = user.wholesale_status || "none";
  if (status === "approved") {
    return {
      label: "B2B PRO",
      color: "primary",
      variant: "filled",
    };
  }
  if (status === "pending") {
    return {
      label: "B2B на проверке",
      color: "warning",
      variant: "outlined",
    };
  }
  if (status === "rejected") {
    return {
      label: "B2B отклонён",
      color: "error",
      variant: "outlined",
    };
  }
  return null;
}

export function buildB2BPanel(user) {
  if (!hasWholesalePortalAccess(user)) {
    return null;
  }

  const status = user.wholesale_status || "none";
  const supportTelegram = brandConfig.supportTelegram || "@frpnnow";
  const supportUrl = supportTelegram.startsWith("@")
    ? `https://t.me/${supportTelegram.slice(1)}`
    : `https://t.me/${supportTelegram}`;

  if (status === "approved") {
    return {
      title: "B2B-линия активна",
      description:
        "Очередь партнёрских заказов, карточка компании и живая поддержка должны быть под рукой прямо из shell.",
      links: [
        { label: "Обзор", to: "/wholesale" },
        { label: "Очередь", to: "/wholesale/orders" },
        { label: "Профиль", to: "/wholesale/profile" },
      ],
      supportTelegram,
      supportUrl,
    };
  }

  if (status === "pending") {
    return {
      title: "B2B на модерации",
      description:
        "Проверка ещё идёт. Держите реквизиты и материалы точки в актуальном состоянии, чтобы не затягивать решение.",
      links: [
        { label: "Обзор", to: "/wholesale" },
        { label: "Профиль", to: "/wholesale/profile" },
        { label: "Реквизиты", to: "/client/profile" },
      ],
      supportTelegram,
      supportUrl,
    };
  }

  if (status === "rejected") {
    return {
      title: "Нужна корректировка",
      description:
        "Обновите реквизиты и повторно подайте заявку. После этого партнёрский контур вернётся в рабочий поток.",
      links: [
        { label: "Исправить профиль", to: "/client/profile" },
        { label: "B2B обзор", to: "/wholesale" },
        { label: "Карточка компании", to: "/wholesale/profile" },
      ],
      supportTelegram,
      supportUrl,
    };
  }

  return {
    title: "B2B-модуль доступен",
    description:
      "Откройте обзор партнёрского контура и завершите настройку карточки компании в основном профиле.",
    links: [
      { label: "B2B обзор", to: "/wholesale" },
      { label: "Реквизиты", to: "/client/profile" },
    ],
    supportTelegram,
    supportUrl,
  };
}

export function resolveRouteContext(role, pathname) {
  if (pathname.startsWith("/appointments/")) {
    return {
      title: "Карточка заявки",
      subtitle: "Статус, чат, оплата и история действий в одном окне",
    };
  }

  if (pathname.startsWith("/wholesale")) {
    return {
      title: "Партнёрский кабинет",
      subtitle: "Операционный контур для сервисных центров, дилеров и партнёрских команд",
    };
  }

  if (role === "client") {
    if (pathname.startsWith("/client/home")) {
      return { title: "Главная", subtitle: "Быстрые действия и текущие статусы без лишнего шума" };
    }
    if (pathname.startsWith("/client/create")) {
      return { title: "Новая заявка", subtitle: "Минимум полей, максимум скорости" };
    }
    if (pathname.startsWith("/client/my")) {
      return { title: "Мои заявки", subtitle: "Контроль заказов, оплаты и чата" };
    }
    if (pathname.startsWith("/client/profile")) {
      return { title: "Профиль", subtitle: "Настройки аккаунта, сервисного центра и безопасности" };
    }
  }

  if (role === "master") {
    if (pathname.startsWith("/master/new")) {
      return {
        title: "Новые заявки",
        subtitle: "Очередь входящих кейсов и быстрый захват в работу",
      };
    }
    if (pathname.startsWith("/master/active")) {
      return { title: "Активные заявки", subtitle: "Текущая работа, SLA и bulk-операции" };
    }
    if (pathname.startsWith("/master/clients")) {
      return { title: "Клиенты", subtitle: "Профили клиентов и B2B-пометки" };
    }
    if (pathname.startsWith("/master/quick-replies")) {
      return { title: "Быстрые ответы", subtitle: "Личные шаблоны для типовых коммуникаций" };
    }
    if (pathname.startsWith("/master/reviews")) {
      return { title: "Отзывы", subtitle: "Качество сервиса и история оценок" };
    }
    if (pathname.startsWith("/master/profile")) {
      return { title: "Профиль", subtitle: "Публичные данные мастера и статус допуска" };
    }
  }

  if (role === "admin") {
    if (pathname.startsWith("/admin/system")) {
      return {
        title: "Система",
        subtitle: "Состояние платформы, деньги, SLA и операционные сигналы",
      };
    }
    if (pathname.startsWith("/admin/profile")) {
      return { title: "Профиль", subtitle: "Публичные данные администратора" };
    }
    if (pathname.startsWith("/admin/appointments")) {
      return { title: "Заявки", subtitle: "Операционный контроль заказов" };
    }
    if (pathname.startsWith("/admin/users")) {
      return { title: "Пользователи", subtitle: "Роли, доступы и ограничения" };
    }
    if (pathname.startsWith("/admin/rules")) {
      return { title: "Правила", subtitle: "Автоматизация событий, тегов и уведомлений" };
    }
    if (pathname.startsWith("/admin/reviews")) {
      return { title: "Отзывы", subtitle: "Контроль качества сервиса" };
    }
    if (pathname.startsWith("/admin/masters")) {
      return { title: "Мастера", subtitle: "Уровень, качество и доступ к очереди" };
    }
    if (pathname.startsWith("/admin/clients")) {
      return { title: "Клиенты", subtitle: "Клиентские профили и B2B PRO" };
    }
  }

  return { title: "FRP Client", subtitle: "Рабочее пространство платформы" };
}

export function resolveQuickAction(role, pathname, user) {
  if (role === "client") {
    if (pathname.startsWith("/wholesale/orders")) {
      return { label: "Карточка компании", to: "/wholesale/profile" };
    }
    if (pathname.startsWith("/wholesale/profile")) {
      return { label: "B2B обзор", to: "/wholesale" };
    }
    if (pathname === "/wholesale" || pathname === "/wholesale/") {
      return { label: "Очередь B2B", to: "/wholesale/orders" };
    }
    if (hasWholesalePortalAccess(user) && pathname.startsWith("/client/profile")) {
      return { label: "B2B кабинет", to: "/wholesale" };
    }
    if (!pathname.startsWith("/client/create")) {
      return { label: "Новая заявка", to: "/client/create" };
    }
  }
  if (role === "master" && !pathname.startsWith("/master/new")) {
    return { label: "Новые заявки", to: "/master/new" };
  }
  if (role === "admin" && !pathname.startsWith("/admin/system")) {
    return { label: "Система", to: "/admin/system" };
  }
  return null;
}
