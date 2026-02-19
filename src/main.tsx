import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Suppress AbortError from Supabase (auth, realtime subscriptions, etc.) so console stays clean.
// Happens when: adding menu items (realtime channel), navigating away, React Strict Mode unmount.
function isAbortError(r: unknown): boolean {
  if (!r) return false;
  if (typeof r === "string") return /aborted|signal is aborted/i.test(r);
  const msg = typeof r === "object" && r !== null && "message" in r ? String((r as { message?: unknown }).message) : "";
  return (r as { name?: string }).name === "AbortError" || /aborted|signal is aborted/i.test(msg);
}
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    if (isAbortError(event.reason)) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
  window.addEventListener("error", (event) => {
    if (isAbortError(event.error) || isAbortError(event.message)) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }
  });
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
