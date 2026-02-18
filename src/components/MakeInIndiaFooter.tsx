/**
 * Make in India footer badge - static image for trust, no external link.
 * Proudly Made in India branding only.
 */

const LOGO_SRC = "/make-in-india-logo.svg";

export default function MakeInIndiaFooter() {
  return (
    <div className="border-t border-border/60 bg-muted/30 w-full">
      <div className="mx-auto max-w-5xl px-4">
        <div
          className="flex flex-col items-center justify-center gap-1 py-4 md:py-5 opacity-70"
          title="Make in India - Proudly Developed in Hyderabad, India"
          role="img"
          aria-label="Make in India - Proudly Developed in Hyderabad, India"
        >
          <img
            src={LOGO_SRC}
            alt=""
            className="h-10 w-auto md:h-12 object-contain pointer-events-none"
          />
          <div className="flex flex-col items-center gap-0.5 text-[10px] md:text-xs text-muted-foreground">
            <span>Proudly Made in India</span>
            <span className="text-[9px] md:text-[10px] opacity-90">हाथ से भारत में बनाया गया</span>
          </div>
        </div>
      </div>
    </div>
  );
}
