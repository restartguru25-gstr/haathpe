import { useState } from "react";
import { Download, Share, MoreVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/contexts/PWAInstallContext";

/** On iOS, only Safari supports Add to Home Screen. Chrome/Firefox cannot install PWA. */
function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as { MSStream?: boolean }).MSStream;
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua);
  return !!(isIOS && isSafari);
}

export default function PWAInstallPrompt() {
  const { isInstallable, isIOS, isAndroid, installPrompt, triggerInstall, dismiss } = usePWAInstall();
  const [installing, setInstalling] = useState(false);
  const iosSafari = isIOSSafari();

  if (!isInstallable) return null;

  const handleInstall = async () => {
    if (isIOS) return; // iOS: no programmatic install; user must use Share → Add to Home Screen
    setInstalling(true);
    try {
      await triggerInstall();
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div
      className="fixed left-4 right-4 z-40 mx-auto max-w-sm rounded-xl border border-border bg-card shadow-lg p-4 md:bottom-6 md:left-auto md:right-6 md:max-w-xs"
      style={{ bottom: "calc(6rem + env(safe-area-inset-bottom, 0px))" }}
      role="banner"
      aria-label="Install app"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Download className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Install haathpe</p>
          {isIOS ? (
            <>
              <p className="text-xs text-muted-foreground mt-0.5">
                {iosSafari
                  ? "Tap the Share button (□↑) below, then tap “Add to Home Screen”. The orange “h” will appear as the app icon."
                  : "To install: open this page in Safari, then tap Share (□↑) → Add to Home Screen."}
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-primary font-medium">
                <Share className="h-3.5 w-3.5 shrink-0" />
                <span>{iosSafari ? "Share → Add to Home Screen" : "Use Safari to add to home screen"}</span>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isAndroid && !installPrompt
                  ? "Tap menu (⋮) → Install app or Add to Home screen"
                  : "Add to home screen for quick access. App icon: orange “h”."}
              </p>
              <div className="mt-3 flex items-center gap-2">
                {isAndroid && !installPrompt ? (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MoreVertical className="h-3.5 w-3.5" />
                    <span>Menu → Install app</span>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="h-9"
                    onClick={handleInstall}
                    disabled={installing}
                  >
                    {installing ? "Installing…" : "Install"}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
