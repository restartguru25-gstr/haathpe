/**
 * Compliance footer for CCAvenue / RBI: legal links, contact, and entity name.
 * Two rows only; compact, accessible, responsive.
 */
import { Link } from "react-router-dom";

const LEGAL_ENTITY = "DOCILE ONLINE MART PRIVATE LIMITED";

const linkClass =
  "text-[11px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:underline focus:ring-0 whitespace-nowrap";

export default function SiteFooter() {
  return (
    <footer
      className="mt-auto border-t border-border bg-muted/40"
      role="contentinfo"
      aria-label="Site footer and legal links"
    >
      <div className="mx-auto max-w-5xl px-3 py-3 sm:px-4 sm:py-4">
        {/* Row 1: all links in one line, wrap on small screens */}
        <nav
          className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 sm:gap-x-2.5"
          aria-label="Footer navigation"
        >
          <Link to="/about-us" className={linkClass}>About Us</Link>
          <span className="text-muted-foreground/60 text-[10px] sm:text-xs select-none" aria-hidden>·</span>
          <Link to="/contact" className={linkClass}>Contact Us</Link>
          <span className="text-muted-foreground/60 text-[10px] sm:text-xs select-none" aria-hidden>·</span>
          <Link to="/terms-and-conditions" className={linkClass}>Terms &amp; Conditions</Link>
          <span className="text-muted-foreground/60 text-[10px] sm:text-xs select-none" aria-hidden>·</span>
          <Link to="/privacy-policy" className={linkClass}>Privacy Policy</Link>
          <span className="text-muted-foreground/60 text-[10px] sm:text-xs select-none" aria-hidden>·</span>
          <Link to="/refund-policy" className={linkClass}>Refund &amp; Cancellation</Link>
          <span className="text-muted-foreground/60 text-[10px] sm:text-xs select-none" aria-hidden>·</span>
          <Link to="/shipping-policy" className={linkClass}>Shipping &amp; Delivery</Link>
        </nav>
        {/* Row 2: copyright + Make in India inline */}
        <div className="mt-2.5 pt-2.5 border-t border-border/70 flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-4 text-center">
          <p className="text-[10px] sm:text-xs text-muted-foreground order-2 sm:order-1">
            © {new Date().getFullYear()} {LEGAL_ENTITY}. All rights reserved.
          </p>
          <div className="order-1 sm:order-2 flex items-center gap-1.5 opacity-70" role="img" aria-label="Make in India">
            <img src="/make-in-india-logo.svg" alt="" className="h-5 w-auto sm:h-6 object-contain pointer-events-none" />
            <span className="text-[9px] sm:text-[10px] text-muted-foreground">Made in India</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
