import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Truck,
  TrendingUp,
  Gift,
  MapPin,
  Star,
  ShoppingBag,
  ShoppingCart,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { useApp } from "@/contexts/AppContext";
import { useSession } from "@/contexts/AuthContext";
import { Language } from "@/lib/data";

const PREFERRED_MODE_KEY = "preferred_mode";
type PreferredMode = "purchases" | "sales";

const langOptions: { value: Language; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "hi", label: "हि" },
  { value: "te", label: "తె" },
];

const features = [
  {
    icon: Truck,
    title: "Easy Supplies",
    desc: "Paper plates, cups, matchboxes — delivered to your stall in hours across Hyderabad.",
    emoji: "📦",
  },
  {
    icon: TrendingUp,
    title: "Unlock Credit",
    desc: "Order 20/30 days straight and unlock credit lines so you never run out of stock.",
    emoji: "🔥",
  },
  {
    icon: Gift,
    title: "Earn & Redeem",
    desc: "Earn loyalty points on every order. Redeem for family trips, cash prizes & supplies.",
    emoji: "🎁",
  },
];

const steps = [
  { step: 1, title: "Sign up", body: "Create your vendor account with phone or email in under a minute." },
  { step: 2, title: "Order supplies", body: "Browse the catalog, add to cart, and place orders. Same-day delivery in Hyderabad." },
  { step: 3, title: "Build streak & credit", body: "Order regularly to build your streak and unlock credit lines for your stall." },
  { step: 4, title: "Earn rewards", body: "Collect points, enter daily draws, and redeem for vouchers and prizes." },
];

const testimonials = [
  {
    name: "Raju",
    stall: "Tea stall near Charminar",
    quote: "Credit line helped me stock up before Ramadan. No more running to the wholesaler every day.",
    avatar: "☕",
  },
  {
    name: "Lakshmi",
    stall: "Snacks stall, Secunderabad",
    quote: "Points got my family a trip to Tirupati. This app is like a bonus for doing what I already do.",
    avatar: "🍿",
  },
  {
    name: "Suresh",
    stall: "Beverage stall, Gachibowli",
    quote: "Delivery is fast. I order in the morning and get supplies by afternoon. Game changer.",
    avatar: "🥤",
  },
];

const stats = [
  { value: "1000+", label: "Vendors" },
  { value: "50K+", label: "Orders delivered" },
  { value: "Hyderabad", label: "Serving now" },
];

const buyBullets = [
  "Wholesale matchboxes, plates, rice, etc.",
  "Unlock credit on streaks",
  "Earn loyalty points & trips",
  "Fast Hyderabad delivery",
];

const sellBullets = [
  "Ready default menu for your sector",
  "Quick POS at stall (cash/UPI)",
  "Online orders via QR code",
  "Track sales, profits & re-order suggestions",
];

export default function Landing() {
  const { t, lang, setLang } = useApp();
  const { isAuthenticated } = useSession();
  const navigate = useNavigate();

  const setPreferredMode = (mode: PreferredMode) => {
    try {
      localStorage.setItem(PREFERRED_MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  };

  const handleGoToPurchases = () => {
    setPreferredMode("purchases");
    if (isAuthenticated) navigate("/dashboard", { replace: true });
    else navigate("/auth", { replace: true, state: { next: "/dashboard" } });
  };

  const handleGoToSales = () => {
    setPreferredMode("sales");
    if (isAuthenticated) navigate("/sales", { replace: true });
    else navigate("/auth", { replace: true, state: { next: "/sales" } });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-md">
              V
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground">VendorHub</span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#testimonials" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Vendors
            </a>
            <Link to="/catalog" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Catalog
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            {!isAuthenticated && (
              <div className="flex items-center gap-2">
                <Link to="/auth">
                  <Button variant="outline" size="sm" className="font-semibold">
                    {t("signIn")}
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button size="sm" className="font-semibold bg-accent text-accent-foreground hover:bg-accent/90">
                    {t("signUp")}
                  </Button>
                </Link>
              </div>
            )}
            {isAuthenticated && (
              <>
                <Link to="/dashboard">
                  <Button variant="outline" size="sm" className="font-semibold hidden sm:inline-flex">
                    Dashboard
                  </Button>
                </Link>
                <Link to="/sales">
                  <Button size="sm" className="font-semibold bg-accent text-accent-foreground hover:bg-accent/90">
                    {t("myShop")}
                  </Button>
                </Link>
              </>
            )}
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/30 p-0.5">
              {langOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setLang(opt.value)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    lang === opt.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden gradient-hero px-4 pt-16 pb-24 text-center md:pt-24 md:pb-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,255,255,0.15),transparent)]" />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative mx-auto max-w-3xl"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-1.5 text-sm font-medium text-primary-foreground">
            <MapPin size={14} className="shrink-0" />
            Serving roadside vendors in Hyderabad
          </div>
          <h1 className="mb-5 text-4xl font-extrabold leading-[1.15] text-primary-foreground md:text-5xl lg:text-6xl">
            {t("heroHeadline")}
          </h1>
          <p className="mb-10 text-base text-primary-foreground/90 md:text-lg max-w-2xl mx-auto">
            {t("heroSubtitle")}
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link to="/catalog">
              <Button
                size="lg"
                className="h-12 bg-accent px-8 text-base font-bold text-accent-foreground shadow-lg transition-all hover:bg-accent/90 hover:shadow-xl"
              >
                Get started <ArrowRight className="ml-2 size-5" />
              </Button>
            </Link>
            <Link to="/catalog">
              <Button
                size="lg"
                variant="outline"
                className="h-12 border-2 border-primary-foreground/30 bg-transparent px-8 text-base font-semibold text-primary-foreground hover:bg-primary-foreground/10"
              >
                Browse catalog
              </Button>
            </Link>
          </div>
          <div className="mt-14 flex flex-wrap items-center justify-center gap-8 md:gap-12">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="text-center"
              >
                <div className="text-2xl font-bold text-primary-foreground md:text-3xl">{s.value}</div>
                <div className="text-xs font-medium uppercase tracking-wider text-primary-foreground/70">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Dual mode: Purchases vs Sales */}
      <section className="border-b border-border bg-muted/20 px-4 py-12 md:py-16">
        <div className="mx-auto max-w-5xl grid grid-cols-1 gap-6 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card className="h-full border-2 border-primary/20 bg-card shadow-md transition-all hover:shadow-lg hover:border-primary/30">
              <CardHeader className="pb-3">
                <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <ShoppingCart className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-xl font-bold md:text-2xl">{t("tileBuyHeadline")}</h2>
              </CardHeader>
              <CardContent className="space-y-2 pb-4">
                {buyBullets.map((bullet, i) => (
                  <p key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                    {bullet}
                  </p>
                ))}
              </CardContent>
              <CardFooter className="flex flex-col items-stretch gap-2 pt-0">
                <Button
                  size="lg"
                  className="w-full bg-primary hover:bg-primary/90"
                  onClick={handleGoToPurchases}
                >
                  {isAuthenticated ? t("tileBuyCtaLoggedIn") : t("tileBuyCta")}
                  <ArrowRight className="ml-2 size-4" />
                </Button>
                <p className="text-center text-xs text-muted-foreground">{t("tileBuyFooter")}</p>
              </CardFooter>
            </Card>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card className="h-full border-2 border-accent/20 bg-card shadow-md transition-all hover:shadow-lg hover:border-accent/30">
              <CardHeader className="pb-3">
                <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
                  <Store className="h-7 w-7 text-accent" />
                </div>
                <h2 className="text-xl font-bold md:text-2xl">{t("tileSellHeadline")}</h2>
              </CardHeader>
              <CardContent className="space-y-2 pb-4">
                {sellBullets.map((bullet, i) => (
                  <p key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
                    {bullet}
                  </p>
                ))}
              </CardContent>
              <CardFooter className="flex flex-col items-stretch gap-2 pt-0">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full border-2 border-accent bg-accent text-accent-foreground hover:bg-accent/90 hover:text-accent-foreground"
                  onClick={handleGoToSales}
                >
                  {isAuthenticated ? t("tileSellCtaLoggedIn") : t("tileSellCta")}
                  <ArrowRight className="ml-2 size-4" />
                </Button>
                <p className="text-center text-xs text-muted-foreground">{t("tileSellFooter")}</p>
              </CardFooter>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 border-b border-border bg-muted/30 px-4 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <h2 className="mb-3 text-3xl font-bold md:text-4xl">
              Why vendors <span className="text-gradient">love us</span>
            </h2>
            <p className="mx-auto max-w-xl text-muted-foreground">
              Built for the daily grind. Order supplies, build credit, and earn rewards — all from your phone.
            </p>
          </motion.div>
          <div className="grid gap-8 md:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md md:p-8"
              >
                <div className="mb-4 text-4xl md:text-5xl">{f.emoji}</div>
                <h3 className="mb-2 text-lg font-bold md:text-xl">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 px-4 py-16 md:py-24">
        <div className="mx-auto max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <h2 className="mb-3 text-3xl font-bold md:text-4xl">How it works</h2>
            <p className="text-muted-foreground">Four steps to supplies, credit, and rewards.</p>
          </motion.div>
          <div className="space-y-8">
            {steps.map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex gap-4 rounded-xl border border-border bg-card p-5 shadow-sm md:p-6"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {s.step}
                </div>
                <div>
                  <h3 className="mb-1 font-bold">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="scroll-mt-20 border-t border-border bg-muted/30 px-4 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <h2 className="mb-3 text-3xl font-bold md:text-4xl">Vendors like you</h2>
            <p className="mx-auto max-w-xl text-muted-foreground">
              Real stories from Hyderabad’s chai wallahs, snack sellers, and street food heroes.
            </p>
          </motion.div>
          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.stall}</div>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-3 flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="size-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Product teaser */}
      <section className="border-t border-border px-4 py-16 md:py-20">
        <div className="mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-10 text-center"
          >
            <h2 className="mb-3 text-3xl font-bold md:text-4xl">What you can order</h2>
            <p className="text-muted-foreground">
              Disposables, essentials, and ready-to-use kits for your stall.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-wrap justify-center gap-4"
          >
            {["🍽️ Paper plates & cups", "🔥 Matchboxes & napkins", "🍵 Tea, sugar & essentials", "🎪 Panipuri & eco kits"].map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm"
              >
                {item}
              </span>
            ))}
          </motion.div>
          <div className="mt-8 text-center">
            <Link to="/catalog">
              <Button variant="outline" size="lg" className="gap-2">
                <ShoppingBag className="size-4" /> View full catalog
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border bg-primary px-4 py-16 text-center md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-2xl"
        >
          <h2 className="mb-3 text-2xl font-bold text-primary-foreground md:text-3xl">
            Ready to grow your stall?
          </h2>
          <p className="mb-8 text-primary-foreground/90">
            Join 1000+ vendors in Hyderabad. Get supplies delivered, build credit, and earn rewards.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link to="/dashboard">
              <Button size="lg" className="h-12 bg-accent px-8 font-bold text-accent-foreground hover:bg-accent/90">
                Start now <ArrowRight className="ml-2 size-5" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="h-12 border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
                {t("signInSignUp")}
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/50 px-4 py-12 md:py-14">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col items-center gap-8 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                V
              </div>
              <span className="font-bold text-foreground">VendorHub</span>
            </div>
            <div className="flex flex-wrap justify-center gap-6 md:gap-8">
              <Link to="/catalog" className="text-sm text-muted-foreground hover:text-foreground">Catalog</Link>
              <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">Dashboard</Link>
              <Link to="/sales" className="text-sm text-muted-foreground hover:text-foreground">{t("myShop")}</Link>
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground">Features</a>
              <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground">How it works</a>
              <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">{t("signInSignUp")}</Link>
            </div>
          </div>
          <div className="mt-8 flex flex-col items-center gap-2 border-t border-border pt-8 text-center text-sm text-muted-foreground md:flex-row md:justify-between">
            <p>© 2026 VendorHub. Made with ❤️ for street vendors in Hyderabad.</p>
            <p className="flex items-center gap-1">
              <MapPin className="size-3.5" /> Hyderabad, India
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
