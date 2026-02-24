import { Link } from "react-router-dom";
import { Mail, Phone, MapPin, Building2, ArrowLeft } from "lucide-react";

const LEGAL_ENTITY = "DOCILE ONLINE MART PRIVATE LIMITED";
const COMPANY = {
  name: LEGAL_ENTITY,
  address: "Flat 505, Balaji Homes, Opposite Shivams Banquet Halls, Near New Bus Stand, Siddipet, Telangana - 502103",
  mobile: "7330333743",
  email: "haathpe@gmail.com",
};

export default function Contact() {
  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <div className="container max-w-2xl px-4 py-8 flex-1">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft size={18} /> Back to home
        </Link>

        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border bg-primary/5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Building2 size={24} className="text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Contact us</h1>
                <p className="text-sm text-muted-foreground">haathpe · {LEGAL_ENTITY}</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Registered company
              </h2>
              <p className="font-medium text-foreground">{COMPANY.name}</p>
            </div>

            <div className="flex items-start gap-3">
              <MapPin size={20} className="shrink-0 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Registered address</p>
                <p className="text-foreground">{COMPANY.address}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Phone size={20} className="shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Mobile</p>
                <a href={`tel:+91${COMPANY.mobile}`} className="text-foreground font-medium hover:underline">
                  +91 {COMPANY.mobile}
                </a>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Mail size={20} className="shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Email</p>
                <a href={`mailto:${COMPANY.email}`} className="text-foreground font-medium hover:underline">
                  {COMPANY.email}
                </a>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          For support, orders, or partnerships, reach us at the details above.
        </p>
      </div>
    </div>
  );
}
