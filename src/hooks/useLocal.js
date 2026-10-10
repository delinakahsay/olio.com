import { useCallback, useState } from "react";
export function readLocal(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}
// Keep each account's device-only data separate, including during account changes.
export function useLocal(key, fallback) {
  const [slot, setSlot] = useState(() => ({
    key,
    value: readLocal(key, fallback),
  }));
  const value = slot.key === key ? slot.value : readLocal(key, fallback);
  // Synchronize the slot on account changes before exposing its setter.
  // Reading storage inside an updater could apply a toggle twice in StrictMode.
  if (slot.key !== key) setSlot({ key, value });
  const setValue = useCallback(
    (next) => {
      setSlot((previous) => {
        const current =
          previous.key === key ? previous.value : value;
        const value = typeof next === "function" ? next(current) : next;
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch {
          /* Private browsing/storage limits: retain in memory. */
        }
        return { key, value };
      });
    },
    [key, value],
  );
  return [value, setValue];
}
