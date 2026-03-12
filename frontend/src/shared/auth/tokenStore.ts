import { useSyncExternalStore } from "react";

let accessToken = "";
const bus = new EventTarget();

const subscribe = (callback: () => void) => {
  const handler: EventListener = () => callback();
  bus.addEventListener("change", handler);
  return () => bus.removeEventListener("change", handler);
};

const getSnapshot = () => accessToken;

export const tokenStore = {
  get: (): string => accessToken,
  set: (token: string | null | undefined): void => {
    accessToken = token || "";
    bus.dispatchEvent(new Event("change"));
  },
  clear: (): void => {
    accessToken = "";
    bus.dispatchEvent(new Event("change"));
  },
};

export function useAccessToken(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
