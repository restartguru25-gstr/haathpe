import { Link, useLocation } from "react-router-dom";
import { Home, ShoppingBag, Store, Receipt, Star, User, ShoppingCart, Bell, Shield } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useCartStore, selectCartCount } from "@/store/cartStore";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Language } from "@/lib/data";

const navLinks = [
  { path: "/dashboard", icon: Home, labelKey: "dashboard" as const },
  { path: "/catalog", icon: ShoppingBag, labelKey: "catalog" as const },
  { path: "/sales", icon: Store, labelKey: "sales" as const },
  { path: "/orders", icon: Receipt, labelKey: "orders" as const },
  { path: "/loyalty", icon: Star, labelKey: "loyalty" as const },
  { path: "/profile", icon: User, labelKey: "profile" as const },
];

const langOptions: { value: Language; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "hi", label: "हि" },
  { value: "te", label: "తె" },
];

export default function TopNav() {
  const { pathname } = useLocation();
  const { t, lang, setLang } = useApp();
  const cartCount = useCartStore(selectCartCount);
  const { unreadCount } = useUnreadNotifications();
  const { isAdmin } = useAdmin();

  return (
    <header className="sticky top-0 z-50 hidden border-b border-border bg-card/95 backdrop-blur-md md:block">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground font-brand tracking-widest">
            h
          </div>
          <span className="brand-haathpe text-xl">haathpe</span>
        </Link>

        <nav className="flex items-center gap-1">
          {navLinks.map(({ path, icon: Icon, labelKey }) => {
            const active = pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon size={16} />
                {t(labelKey)}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              to="/admin"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                pathname === "/admin"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Shield size={16} />
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/notifications" className="relative">
            <Button variant="outline" size="icon">
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </Link>
          <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
            {langOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setLang(opt.value)}
                className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                  lang === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <Link to="/cart" className="relative">
            <Button variant="outline" size="icon" className="relative">
              <ShoppingCart size={18} />
              {cartCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                  {cartCount}
                </span>
              )}
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
