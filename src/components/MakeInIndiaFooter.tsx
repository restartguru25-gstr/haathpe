/**
 * Make in India footer badge - appears at bottom of all pages.
 * Uses official Make in India branding. Replace logo src with official lion
 * image when available: https://www.makeinindia.com/assets/images/make-in-india-logo.png
 */

const MAKE_IN_INDIA_URL = "https://www.makeinindia.com/";
const LOGO_SRC = "/make-in-india-logo.svg";

export default function MakeInIndiaFooter() {
  const content = (
    <div className="flex flex-col items-center justify-center gap-1 py-4 md:py-5 opacity-70 hover:opacity-90 transition-opacity">
      <img
        src={LOGO_SRC}
        alt="Make in India - Proudly Developed in Hyderabad, India"
        className="h-10 w-auto md:h-12 object-contain"
      />
      <div className="flex flex-col items-center gap-0.5 text-[10px] md:text-xs text-muted-foreground">
        <span>Proudly Made in India</span>
        <span className="text-[9px] md:text-[10px] opacity-90">हाथ से भारत में बनाया गया</span>
      </div>
    </div>
  );

  return (
    <div className="border-t border-border/60 bg-muted/30 w-full">
      <div className="mx-auto max-w-5xl px-4">
        <a
          href={MAKE_IN_INDIA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
          title="Make in India - Proudly Developed in Hyderabad, India"
        >
          {content}
        </a>
      </div>
    </div>
  );
}
