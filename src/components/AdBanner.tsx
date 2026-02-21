import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getRandomAd, recordAdImpression, getSessionId, type Ad } from "@/lib/ads";
import { toast } from "sonner";

interface AdBannerProps {
  vendorId?: string | null;
  vendorZone?: string | null;
  page?: string | null;
  variant?: "sidebar" | "banner" | "compact";
}

export function AdBanner({ vendorId, vendorZone, page, variant = "banner" }: AdBannerProps) {
  const [ad, setAd] = useState<Ad | null>(null);

  useEffect(() => {
    getRandomAd(vendorZone).then((a) => {
      setAd(a);
      if (a) {
        recordAdImpression(a.id, "view", {
          vendorId,
          page: page ?? undefined,
          sessionId: getSessionId(),
        });
      }
    });
  }, [vendorId, vendorZone, page]);

  const handleClick = () => {
    if (ad) {
      recordAdImpression(ad.id, "click", {
        vendorId,
        page: page ?? undefined,
        sessionId: getSessionId(),
      });
      toast.success("Thanks for supporting local!");
    }
  };

  if (!ad) return null;

  const href = ad.link_url ?? "#";
  const isExternal = href.startsWith("http");

  const isCompact = variant === "compact";
  const content = (
    <div
      className={`flex items-center gap-2 overflow-hidden rounded-lg border border-border bg-card transition hover:bg-muted/50 cursor-pointer ${
        variant === "sidebar" ? "flex-col w-full max-w-[200px] p-3 gap-3" : variant === "compact" ? "p-2 gap-2" : "p-3 gap-3 w-full"
      }`}
      role={href ? "button" : undefined}
      onClick={href ? handleClick : undefined}
    >
      <img
        src={ad.image_url}
        alt={ad.brand_name}
        className={`object-cover rounded shrink-0 ${
          variant === "sidebar" ? "h-16 w-full" : variant === "compact" ? "h-10 w-14" : "h-16 w-28"
        }`}
      />
      <div className="min-w-0 flex-1">
        <p className={`uppercase tracking-wider text-muted-foreground ${isCompact ? "text-[9px]" : "text-[10px]"}`}>Sponsored</p>
        <p className={`font-semibold truncate ${isCompact ? "text-xs" : "text-sm"}`}>{ad.title || ad.brand_name}</p>
        {ad.link_url && !isCompact && (
          <p className="text-xs text-primary truncate">
            {ad.link_url.startsWith("/") ? "View products" : "Learn more →"}
          </p>
        )}
      </div>
    </div>
  );

  if (href && href !== "#") {
    return isExternal ? (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={handleClick} className="block">
        {content}
      </a>
    ) : (
      <Link to={href} onClick={handleClick} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
