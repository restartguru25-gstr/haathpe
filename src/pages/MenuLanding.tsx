import { Link } from "react-router-dom";
import { QrCode, Search } from "lucide-react";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import MakeInIndiaFooter from "@/components/MakeInIndiaFooter";

export default function MenuLanding() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-primary/5 to-background">
      <header className="sticky top-0 z-50 flex h-14 items-center border-b border-border/50 bg-background/95 backdrop-blur-md px-4">
        <BackButton fallbackTo="/" />
      </header>
      <div className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mx-auto mb-6">
          <QrCode size={32} className="text-primary" />
        </div>
        <h1 className="text-xl font-bold mb-2">Scan a vendor QR code</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Open your camera and scan the QR code at your dukaan to view the menu and pay.
        </p>
        <Link to="/search">
          <Button className="gap-2">
            <Search size={18} /> Find dukaan near you
          </Button>
        </Link>
        <p className="mt-6 text-sm text-muted-foreground">
          <Link to="/" className="text-primary hover:underline">Back to home</Link>
        </p>
      </div>
      </div>
      <MakeInIndiaFooter />
    </div>
  );
}
