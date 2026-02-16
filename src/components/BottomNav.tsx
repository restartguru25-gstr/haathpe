import { useLocation, Link } from "react-router-dom";
import { Home, ShoppingBag, Store, Receipt, Star, User, Shield } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useAdmin } from "@/hooks/useAdmin";
import { motion } from "framer-motion";

const baseTabs = [
  { path: "/dashboard", icon: Home, labelKey: "dashboard" as const },
  { path: "/catalog", icon: ShoppingBag, labelKey: "catalog" as const },
  { path: "/sales", icon: Store, labelKey: "sales" as const },
  { path: "/orders", icon: Receipt, labelKey: "orders" as const },
  { path: "/loyalty", icon: Star, labelKey: "loyalty" as const },
  { path: "/profile", icon: User, labelKey: "profile" as const },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const { t, cartCount } = useApp();
  const { isAdmin } = useAdmin();

  const tabs = isAdmin
    ? [...baseTabs, { path: "/admin", icon: Shield, labelKey: "admin" as const }]
    : baseTabs;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center justify-around py-2">
        {tabs.map(({ path, icon: Icon, labelKey }) => {
          const active = pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className="relative flex min-w-0 flex-col items-center gap-0.5 px-2 py-1.5 text-center"
            >
              {active && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute -top-1.5 h-0.5 w-8 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <Icon
                size={22}
                className={`shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}
              />
              <span
                className={`truncate text-[10px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                {t(labelKey)}
              </span>
              {labelKey === "catalog" && cartCount > 0 && (
                <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-foreground">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-2 border-t border-border/60 bg-muted/30 px-4 py-1.5">
        <span className="text-[10px] font-semibold text-foreground/80">VendorHub</span>
        <span className="text-muted-foreground">·</span>
        <a href="/#terms" className="text-[10px] text-muted-foreground hover:underline">
          Terms
        </a>
        <span className="text-muted-foreground">·</span>
        <a href="/#privacy" className="text-[10px] text-muted-foreground hover:underline">
          Privacy
        </a>
      </div>
    </nav>
  );
}
