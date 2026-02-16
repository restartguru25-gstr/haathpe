import { supabase } from "./supabase";

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getPushPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  return Notification.requestPermission();
}

export async function subscribePush(): Promise<PushSubscription | null> {
  if (!isPushSupported() || !VAPID_PUBLIC) return null;
  try {
    const reg =
      navigator.serviceWorker.controller
        ? await navigator.serviceWorker.ready
        : await navigator.serviceWorker.register("/sw.js").then((r) => r.ready);
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
    return sub;
  } catch (e) {
    console.warn("Push subscribe failed:", e);
    return null;
  }
}

export async function savePushSubscription(
  userId: string,
  subscription: PushSubscription
): Promise<boolean> {
  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) return false;
  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: userId,
    endpoint,
    p256dh,
    auth,
  });
  if (error) {
    if (error.code === "23505") return true;
    console.warn("Save push subscription error:", error.message);
    return false;
  }
  return true;
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

export async function getPushSubscriptions(userId: string): Promise<{ endpoint: string }[]> {
  const { data } = await supabase
    .from("push_subscriptions")
    .select("endpoint")
    .eq("user_id", userId);
  return (data ?? []) as { endpoint: string }[];
}
