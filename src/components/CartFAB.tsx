import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { useCartStore, selectCartCount } from "@/store/cartStore";
import { motion } from "framer-motion";

export default function CartFAB() {
  const cartCount = useCartStore(selectCartCount);

  return (
    <Link
      to="/cart"
      className="fixed bottom-24 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95 md:hidden"
      style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))" }}
      aria-label={`Cart${cartCount > 0 ? `, ${cartCount} items` : ""}`}
    >
      <ShoppingCart size={24} strokeWidth={2.2} />
      {cartCount > 0 && (
        <motion.span
          key={cartCount}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
          className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-accent-foreground shadow-md"
        >
          {cartCount > 99 ? "99+" : cartCount}
        </motion.span>
      )}
    </Link>
  );
}
