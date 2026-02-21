import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getRandomAd, recordAdImpression, getSessionId, type Ad } from "@/lib/ads";
import { toast } from "sonner";

interface AdBannerProps {
  vendorId?: string | null;
  vendorZone?: string | null;
  page?: string | null;
  variant?: "sidebar" | "banner";
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

  const content = (
    <div
      className={`flex items-center gap-3 overflow-hidden rounded-lg border border-border bg-card p-3 transition hover:bg-muted/50 cursor-pointer ${
        variant === "sidebar" ? "flex-col w-full max-w-[200px]" : "w-full"
      }`}
      role={href ? "button" : undefined}
      onClick={href ? handleClick : undefined}
    >
      <img
        src={ad.image_url}
        alt={ad.brand_name}
        className={`object-cover rounded ${variant === "sidebar" ? "h-16 w-full" : "h-16 w-28 shrink-0"}`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sponsored</p>
        <p className="text-sm font-semibold truncate">{ad.title || ad.brand_name}</p>
        {ad.link_url && (
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
