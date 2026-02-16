import { supabase } from "./supabase";

/** Optionally send via push/SMS/WhatsApp (Edge Function). No-op if function not deployed or fails. */
export async function deliverNotificationChannels(
  userId: string,
  title: string,
  body: string | null,
  type: NotificationType
): Promise<void> {
  try {
    await supabase.functions.invoke("send-notification-channels", {
      body: { user_id: userId, title, body, type },
    });
  } catch {
    // ignore
  }
}

export type NotificationType = "order_update" | "promotion" | "draw_result";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body?: string
): Promise<void> {
  await supabase.from("notifications").insert({
    user_id: userId,
    type,
    title,
    body: body ?? null,
  });
  deliverNotificationChannels(userId, title, body ?? null, type).catch(() => {});
}

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return (data ?? []) as AppNotification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  await supabase.from("notifications").update({ read: true }).eq("id", id);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await supabase.from("notifications").update({ read: true }).eq("user_id", userId);
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);
  if (error) return 0;
  return count ?? 0;
}
