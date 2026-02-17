import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/contexts/AuthContext";
import { getUnreadCount } from "@/lib/notifications";

export function useUnreadNotifications(): { unreadCount: number; refresh: () => void } {
  const { user } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }
    const count = await getUnreadCount(user.id);
    setUnreadCount(count);
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onUpdate = () => refresh();
    window.addEventListener("haathpe:notifications-updated", onUpdate);
    return () => window.removeEventListener("haathpe:notifications-updated", onUpdate);
  }, [refresh]);

  return { unreadCount, refresh };
}
