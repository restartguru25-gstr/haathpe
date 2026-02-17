import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Bell, ArrowLeft, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";
import {
  fetchNotifications,
  markAllNotificationsRead,
  type AppNotification,
} from "@/lib/notifications";

export default function Notifications() {
  const { user } = useSession();
  const { t } = useApp();
  const [list, setList] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      const data = await fetchNotifications(user.id);
      setList(data);
      setLoading(false);
    };
    load();
  }, [user?.id]);

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    await markAllNotificationsRead(user.id);
    setList((prev) => prev.map((n) => ({ ...n, read: true })));
    window.dispatchEvent(new Event("haathpe:notifications-updated"));
  };

  const unreadCount = list.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-muted/20 pb-6">
      <div className="container max-w-2xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/profile">
              <Button variant="ghost" size="icon">
                <ArrowLeft size={18} />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">Notifications</h1>
              <p className="text-xs text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="gap-1.5">
              <CheckCheck size={14} /> {t("markAllRead")}
            </Button>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center">
            <Bell size={48} className="mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium text-muted-foreground">{t("noNotifications")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Order updates and draw results will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((n) => (
              <motion.article
                key={n.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl border border-border bg-card p-4 ${!n.read ? "border-primary/30 bg-primary/5" : ""}`}
              >
                <p className="font-semibold">{n.title}</p>
                {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
