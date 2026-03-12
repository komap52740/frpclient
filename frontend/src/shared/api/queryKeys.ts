type QueryParamValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryParamValue>;
type SanitizedQueryParams = Record<string, string | number | boolean>;

function sanitizeParams(params: QueryParams = {}): SanitizedQueryParams {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== ""
    )
  ) as SanitizedQueryParams;
}

export const queryKeys = {
  auth: {
    all: ["auth"] as const,
    me: () => ["auth", "me"] as const,
    dashboardRoot: () => ["auth", "dashboard"] as const,
    dashboard: () => ["auth", "dashboard", "summary"] as const,
  },
  appointments: {
    all: ["appointments"] as const,
    myRoot: () => ["appointments", "my"] as const,
    my: () => ["appointments", "my", "list"] as const,
    newRoot: () => ["appointments", "new"] as const,
    newList: () => ["appointments", "new", "list"] as const,
    activeRoot: () => ["appointments", "active"] as const,
    activeList: () => ["appointments", "active", "list"] as const,
    detail: (appointmentId: string | number) =>
      ["appointments", "detail", Number(appointmentId)] as const,
    events: (appointmentId: string | number, params: QueryParams = {}) =>
      ["appointments", "events", Number(appointmentId), sanitizeParams(params)] as const,
  },
  chat: {
    all: ["chat"] as const,
    messagesRoot: (appointmentId: string | number) =>
      ["chat", "messages", Number(appointmentId)] as const,
    messages: (appointmentId: string | number, params: QueryParams = {}) =>
      ["chat", "messages", Number(appointmentId), sanitizeParams(params)] as const,
  },
  admin: {
    all: ["admin"] as const,
    appointmentsRoot: () => ["admin", "appointments"] as const,
    appointments: (filters: QueryParams = {}) =>
      ["admin", "appointments", sanitizeParams(filters)] as const,
    financeRoot: () => ["admin", "finance"] as const,
    financeSummary: (params: QueryParams = {}) =>
      ["admin", "finance", "summary", sanitizeParams(params)] as const,
    weeklyRoot: () => ["admin", "reports", "weekly"] as const,
    weeklyReport: (params: QueryParams = {}) =>
      ["admin", "reports", "weekly", sanitizeParams(params)] as const,
  },
  reviews: {
    all: ["reviews"] as const,
    myRoot: () => ["reviews", "my"] as const,
    my: () => ["reviews", "my", "list"] as const,
    adminRoot: () => ["reviews", "admin"] as const,
    admin: (filters: QueryParams = {}) => ["reviews", "admin", sanitizeParams(filters)] as const,
  },
} as const;

export function cleanQueryParams(params: QueryParams = {}): SanitizedQueryParams {
  return sanitizeParams(params);
}
