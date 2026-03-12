import dayjs from "dayjs";
import { useDeferredValue, useMemo, useState } from "react";

const RISK_WEIGHT = { critical: 4, high: 3, medium: 2, low: 1 };

function getRiskWeight(level) {
  return RISK_WEIGHT[level] || 0;
}

function isUrgentItem(item) {
  const unread = item.unread_count || 0;
  if (item.sla_breached || unread > 0) {
    return true;
  }

  const deadline = item.completion_deadline_at || item.response_deadline_at;
  if (!deadline) {
    return false;
  }

  return dayjs(deadline).diff(dayjs(), "minute") <= 60;
}

function buildHaystack(item) {
  return [
    item.brand,
    item.model,
    item.description,
    item.client_username,
    item.status,
    item.latest_message_text,
    item.latest_message_sender_username,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function sortItems(items, sortBy) {
  const copy = [...items];

  if (sortBy === "updated") {
    return copy.sort((a, b) => dayjs(b.updated_at).valueOf() - dayjs(a.updated_at).valueOf());
  }

  if (sortBy === "risk") {
    return copy.sort((a, b) => {
      const riskDiff = getRiskWeight(b.client_risk_level) - getRiskWeight(a.client_risk_level);
      if (riskDiff !== 0) {
        return riskDiff;
      }
      return dayjs(b.updated_at).valueOf() - dayjs(a.updated_at).valueOf();
    });
  }

  return copy.sort((a, b) => {
    const unreadDiff = (b.unread_count || 0) - (a.unread_count || 0);
    if (unreadDiff !== 0) {
      return unreadDiff;
    }
    const urgentDiff = Number(isUrgentItem(b)) - Number(isUrgentItem(a));
    if (urgentDiff !== 0) {
      return urgentDiff;
    }
    const riskDiff = getRiskWeight(b.client_risk_level) - getRiskWeight(a.client_risk_level);
    if (riskDiff !== 0) {
      return riskDiff;
    }
    if (Boolean(b.is_wholesale_request) !== Boolean(a.is_wholesale_request)) {
      return b.is_wholesale_request ? 1 : -1;
    }
    return dayjs(b.updated_at).valueOf() - dayjs(a.updated_at).valueOf();
  });
}

export function useInboxFilters({ defaultSortBy = "priority" } = {}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [riskLevel, setRiskLevel] = useState("all");
  const [sortBy, setSortBy] = useState(defaultSortBy);
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [wholesaleOnly, setWholesaleOnly] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filterMeta = useMemo(
    () => ({
      searchQuery,
      riskLevel,
      sortBy,
      urgentOnly,
      wholesaleOnly,
      unreadOnly,
    }),
    [riskLevel, searchQuery, sortBy, unreadOnly, urgentOnly, wholesaleOnly]
  );

  const applyItems = (items) => {
    const query = deferredSearchQuery.trim().toLowerCase();

    const filtered = items.filter((item) => {
      if (riskLevel !== "all" && item.client_risk_level !== riskLevel) {
        return false;
      }
      if (urgentOnly && !isUrgentItem(item)) {
        return false;
      }
      if (wholesaleOnly && !item.is_wholesale_request) {
        return false;
      }
      if (unreadOnly && !(item.unread_count > 0)) {
        return false;
      }
      if (query && !buildHaystack(item).includes(query)) {
        return false;
      }
      return true;
    });

    return sortItems(filtered, sortBy);
  };

  return {
    searchQuery,
    setSearchQuery,
    riskLevel,
    setRiskLevel,
    sortBy,
    setSortBy,
    urgentOnly,
    setUrgentOnly,
    wholesaleOnly,
    setWholesaleOnly,
    unreadOnly,
    setUnreadOnly,
    filterMeta,
    applyItems,
  };
}

export function getUrgentItemCount(items = []) {
  return items.filter(isUrgentItem).length;
}
