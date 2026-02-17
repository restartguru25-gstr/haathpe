import { Link } from "react-router-dom";
import { Bell, ShoppingCart } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { Button } from "@/components/ui/button";

export default function MobileHeader() {
  const { cartCount } = useApp();
  const { unreadCount } = useUnreadNotifications();

  return (
    <header
      className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur-md md:hidden"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <Link to="/dashboard" className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground font-brand tracking-widest">
          h
        </div>
        <span className="brand-haathpe text-lg">haathpe</span>
      </Link>
      <div className="flex items-center gap-1">
        <Link to="/notifications" className="relative">
          <Button variant="ghost" size="icon">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        </Link>
        <Link to="/cart" className="relative">
          <Button variant="ghost" size="icon">
            <ShoppingCart size={20} />
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </Button>
        </Link>
      </div>
    </header>
  );
}
