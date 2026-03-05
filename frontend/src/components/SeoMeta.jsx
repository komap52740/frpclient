import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE_NAME = "FRP Client";
const SITE_ORIGIN = (import.meta.env.VITE_SITE_URL || "").replace(/\/+$/, "");
const DEFAULT_TITLE = "FRP Client — удаленная разблокировка устройств";
const DEFAULT_DESCRIPTION =
  "FRP Client — сервис удаленной разблокировки устройств: онлайн-заявка, чат с мастером и прозрачные статусы всех этапов.";
const SEO_JSONLD_ID = "seo-jsonld-main";
const FAQ_ITEMS = [
  {
    question: "Сколько времени занимает разблокировка?",
    answer:
      "Среднее время зависит от модели и текущего этапа. Все шаги отображаются в карточке заявки: проверка, оплата, работа, завершение.",
  },
  {
    question: "Нужно ли ехать в сервисный центр?",
    answer:
      "Нет. Работа проходит удаленно через RuDesktop, а статус и чат с мастером доступны в личном кабинете.",
  },
  {
    question: "Что нужно для старта работы?",
    answer:
      "Достаточно указать модель устройства, описать проблему, передать логин/ID и пароль RuDesktop и подтвердить оплату в заявке.",
  },
];

const LANDING_STEPS = [
  "Оставьте заявку: модель устройства и краткое описание проблемы.",
  "Передайте данные RuDesktop и согласуйте работу с мастером в чате.",
  "Оплатите услугу, загрузите чек и дождитесь завершения работ.",
];

function upsertMetaByName(name, content) {
  if (!name) return;
  let node = document.head.querySelector(`meta[name="${name}"]`);
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute("name", name);
    document.head.appendChild(node);
  }
  node.setAttribute("content", content || "");
}

function upsertMetaByProperty(property, content) {
  if (!property) return;
  let node = document.head.querySelector(`meta[property="${property}"]`);
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute("property", property);
    document.head.appendChild(node);
  }
  node.setAttribute("content", content || "");
}

function upsertCanonical(url) {
  let node = document.head.querySelector('link[rel="canonical"]');
  if (!node) {
    node = document.createElement("link");
    node.setAttribute("rel", "canonical");
    document.head.appendChild(node);
  }
  node.setAttribute("href", url);
}

function upsertAlternateLink(hreflang, href) {
  if (!hreflang) return;
  let node = document.head.querySelector(`link[rel="alternate"][hreflang="${hreflang}"]`);
  if (!node) {
    node = document.createElement("link");
    node.setAttribute("rel", "alternate");
    node.setAttribute("hreflang", hreflang);
    document.head.appendChild(node);
  }
  node.setAttribute("href", href);
}

function upsertJsonLd(payload) {
  let node = document.head.querySelector(`script#${SEO_JSONLD_ID}`);
  if (!payload) {
    if (node) node.remove();
    return;
  }

  if (!node) {
    node = document.createElement("script");
    node.setAttribute("id", SEO_JSONLD_ID);
    node.setAttribute("type", "application/ld+json");
    document.head.appendChild(node);
  }

  node.textContent = JSON.stringify(payload);
}

function buildPublicJsonLd(origin, pathname) {
  const normalized = pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
  const isLanding = normalized === "/remote-unlock";
  const pageUrl = `${origin}${normalized}`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: SITE_NAME,
        url: `${origin}/`,
        inLanguage: "ru-RU",
      },
      {
        "@type": "WebPage",
        name: isLanding ? "Удаленная разблокировка устройств" : "Вход в FRP Client",
        url: pageUrl,
        inLanguage: "ru-RU",
        description: isLanding
          ? "Удаленная разблокировка устройств: онлайн-заявка, чат с мастером и прозрачные этапы выполнения работ."
          : DEFAULT_DESCRIPTION,
      },
      {
        "@type": "ProfessionalService",
        name: SITE_NAME,
        serviceType: "Удаленная разблокировка устройств",
        areaServed: "RU",
        url: `${origin}/`,
        description: DEFAULT_DESCRIPTION,
      },
      ...(isLanding
        ? [
            {
              "@type": "HowTo",
              name: "Как проходит удаленная разблокировка",
              step: LANDING_STEPS.map((text) => ({
                "@type": "HowToStep",
                text,
              })),
            },
          ]
        : []),
      {
        "@type": "FAQPage",
        mainEntity: FAQ_ITEMS.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  };
}

function getRouteMeta(pathname) {
  const normalized = pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
  const isPublic = normalized === "/" || normalized === "/login" || normalized === "/remote-unlock";

  if (isPublic) {
    const isLanding = normalized === "/remote-unlock";
    return {
      title: isLanding ? "Удаленная разблокировка устройств — FRP Client" : normalized === "/login" ? "Вход в FRP Client" : DEFAULT_TITLE,
      description: isLanding
        ? "Подача заявки онлайн, чат с мастером и прозрачные статусы работы. Подключение через RuDesktop без визита в сервис."
        : DEFAULT_DESCRIPTION,
      robots: "index,follow",
      isPublic,
    };
  }

  return {
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    robots: "noindex,nofollow",
    isPublic,
  };
}

export default function SeoMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const origin = SITE_ORIGIN || window.location.origin;
    const path = pathname || "/";
    const canonical = `${origin}${path}`;
    const routeMeta = getRouteMeta(path);
    const ogImage = `${origin}/og-image.svg`;

    document.title = routeMeta.title;
    upsertCanonical(canonical);
    upsertAlternateLink("ru-RU", canonical);
    upsertAlternateLink("x-default", canonical);

    upsertMetaByName("description", routeMeta.description);
    upsertMetaByName("robots", routeMeta.robots);
    upsertMetaByName("twitter:card", "summary");
    upsertMetaByName("twitter:title", routeMeta.title);
    upsertMetaByName("twitter:description", routeMeta.description);
    upsertMetaByName("twitter:image", ogImage);
    upsertMetaByName("twitter:image:alt", "FRP Client — удаленная разблокировка устройств");

    upsertMetaByProperty("og:type", "website");
    upsertMetaByProperty("og:site_name", SITE_NAME);
    upsertMetaByProperty("og:title", routeMeta.title);
    upsertMetaByProperty("og:description", routeMeta.description);
    upsertMetaByProperty("og:url", canonical);
    upsertMetaByProperty("og:image", ogImage);
    upsertMetaByProperty("og:image:alt", "FRP Client — удаленная разблокировка устройств");
    upsertMetaByProperty("og:locale", "ru_RU");

    upsertJsonLd(routeMeta.isPublic ? buildPublicJsonLd(origin, path) : null);
  }, [pathname]);

  return null;
}
