import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Suppress uncaught AbortError from Supabase auth (navigator lock, etc.) so console stays clean
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const r = event.reason;
    if (r?.name === "AbortError" || (r?.message && String(r.message).includes("aborted"))) {
      event.preventDefault();
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
