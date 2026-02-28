const ACCESS_TOKEN_KEY = "frp_access_token";

let accessToken = localStorage.getItem(ACCESS_TOKEN_KEY) || "";

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token || "";
  if (accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

export function clearTokens() {
  setAccessToken("");
}
