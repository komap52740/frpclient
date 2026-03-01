import { useEffect, useRef } from "react";

export default function useAutoRefresh(callback, options = {}) {
  const {
    enabled = true,
    intervalMs = 6000,
    runOnVisible = true,
  } = options;

  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let isRunning = false;

    const run = async () => {
      const isVisible =
        typeof document.visibilityState !== "string" || document.visibilityState === "visible";
      if (isRunning || !isVisible) {
        return;
      }
      isRunning = true;
      try {
        await callbackRef.current?.();
      } finally {
        isRunning = false;
      }
    };

    const timer = setInterval(run, intervalMs);

    let onVisible;
    if (runOnVisible) {
      onVisible = () => {
        if (document.visibilityState === "visible") {
          run();
        }
      };
      document.addEventListener("visibilitychange", onVisible);
    }

    return () => {
      clearInterval(timer);
      if (onVisible) {
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
  }, [enabled, intervalMs, runOnVisible]);
}
