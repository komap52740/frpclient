export function getApiErrorMessage(error, fallback) {
  const data = error?.response?.data;
  if (typeof data?.detail === "string" && data.detail) {
    return data.detail;
  }
  if (Array.isArray(data?.non_field_errors) && typeof data.non_field_errors[0] === "string") {
    return data.non_field_errors[0];
  }
  if (data && typeof data === "object") {
    for (const key of Object.keys(data)) {
      const value = data[key];
      if (typeof value === "string" && value) {
        return value;
      }
      if (Array.isArray(value) && typeof value[0] === "string" && value[0]) {
        return value[0];
      }
    }
  }
  if (typeof data === "string" && data) {
    return data;
  }
  return fallback;
}
