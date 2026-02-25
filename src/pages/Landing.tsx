import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
  ChevronDown,
  HelpCircle,
  Banknote,
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

const featureKeys = [
  { icon: Truck, keyTitle: "featureEasySupplies" as const, keyDesc: "featureEasySuppliesDesc" as const, emoji: "📦" },
  { icon: TrendingUp, keyTitle: "featureUnlockCredit" as const, keyDesc: "featureUnlockCreditDesc" as const, emoji: "🔥" },
  { icon: Gift, keyTitle: "featureEarnRedeem" as const, keyDesc: "featureEarnRedeemDesc" as const, emoji: "🎁" },
  { icon: Banknote, keyTitle: "featureRentalIncome" as const, keyDesc: "featureRentalIncomeDesc" as const, emoji: "💰" },
];

const stepKeys = [
  { step: 1, keyTitle: "step1Title" as const, keyBody: "step1Body" as const },
  { step: 2, keyTitle: "step2Title" as const, keyBody: "step2Body" as const },
  { step: 3, keyTitle: "step3Title" as const, keyBody: "step3Body" as const },
  { step: 4, keyTitle: "step4Title" as const, keyBody: "step4Body" as const },
];

const faqKeys = [
  { keyQ: "faqWhoCanJoin" as const, keyA: "faqWhoCanJoinA" as const },
  { keyQ: "faqHowFastDelivery" as const, keyA: "faqHowFastDeliveryA" as const },
  { keyQ: "faqRedeemPoints" as const, keyA: "faqRedeemPointsA" as const },
];

const testimonialKeys = [
  { keyName: "testimonial1Name" as const, keyStall: "testimonial1Stall" as const, keyQuote: "testimonial1Quote" as const, avatar: "☕" },
  { keyName: "testimonial2Name" as const, keyStall: "testimonial2Stall" as const, keyQuote: "testimonial2Quote" as const, avatar: "🍿" },
  { keyName: "testimonial3Name" as const, keyStall: "testimonial3Stall" as const, keyQuote: "testimonial3Quote" as const, avatar: "🥤" },
];

const statKeys = [
  { value: "1000+", keyLabel: "statsDukaanwaale" as const },
  { value: "50K+", keyLabel: "statsOrdersDelivered" as const },
  { value: "Hyderabad", keyLabel: "statsServingNow" as const },
];

const buyBulletKeys = ["buyBullet1", "buyBullet2", "buyBullet3", "buyBullet4"] as const;
const sellBulletKeys = ["sellBullet1", "sellBullet2", "sellBullet3", "sellBullet4"] as const;
const productTeaserKeys = ["productTeaser1", "productTeaser2", "productTeaser3", "productTeaser4"] as const;

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      layout
      className="overflow-hidden rounded-xl border border-border bg-card"
      initial={false}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left font-medium transition-colors hover:bg-muted/50"
      >
        <span>{question}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 text-muted-foreground"
        >
          <ChevronDown className="size-5" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="border-t border-border"
          >
            <p className="px-4 py-3 text-sm text-muted-foreground">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Landing() {
  const { t, lang, setLang } = useApp();
  const { isAuthenticated, user, signOut } = useSession();
  const signedInAs = user?.email ?? user?.phone ?? null;
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-md font-brand tracking-widest">
              h
            </div>
            <span className="brand-haathpe text-xl">haathpe</span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              {t("landingFeaturesNav")}
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              {t("landingHowItWorksNav")}
            </a>
            <a href="#testimonials" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              {t("landingDukaanwaaleNav")}
            </a>
            <Link to="/catalog" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              {t("catalog")}
            </Link>
            <Link to="/search" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              {t("searchFindVendors")}
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
                {signedInAs && (
                  <span className="hidden sm:inline text-xs text-muted-foreground border-r border-border pr-3 mr-2">
                    {t("signedInAs")} {signedInAs}
                  </span>
                )}
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={async () => {
                    await signOut();
                    window.location.replace("/");
                  }}
                >
                  {t("logOut")}
                </Button>
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
        <div className="absolute right-0 top-1/4 h-64 w-64 rounded-full bg-accent/10 blur-3xl" aria-hidden />
        <div className="absolute bottom-1/4 left-0 h-48 w-48 rounded-full bg-primary-foreground/5 blur-3xl" aria-hidden />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative mx-auto max-w-3xl"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-1.5 text-sm font-medium text-primary-foreground">
            <MapPin size={14} className="shrink-0" />
            {t("landingHeroPin")}
          </div>
          <p className="mb-2 font-accent text-4xl leading-tight text-primary-foreground/95 md:text-5xl lg:text-[4.5rem]" style={{ fontFamily: "var(--font-accent)" }}>
            {t("landingHeroTagline")}
          </p>
          <h1 className="mb-5 font-heading text-3xl font-bold leading-[1.15] text-primary-foreground md:text-4xl lg:text-5xl">
            {t("heroHeadline")}
          </h1>
          <p className="mb-10 text-base text-primary-foreground/90 md:text-lg max-w-2xl mx-auto">
            {t("heroSubtitle")}
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <Link to="/search">
              <Button
                size="lg"
                className="h-12 bg-accent px-8 text-base font-bold text-accent-foreground shadow-lg transition-all hover:bg-accent/90 hover:shadow-xl"
              >
                {t("searchFindVendors")} <ArrowRight className="ml-2 size-5" />
              </Button>
            </Link>
            <Link to="/customer-login">
              <Button
                size="lg"
                className="h-12 px-8 text-base font-bold border-2 border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
              >
                {t("customerSignIn")}
              </Button>
            </Link>
            <Link to="/catalog">
              <Button
                size="lg"
                variant="outline"
                className="h-12 border-2 border-primary-foreground/30 bg-transparent px-8 text-base font-semibold text-primary-foreground hover:bg-primary-foreground/10"
              >
                {t("browseSuppliesForDukaan")}
              </Button>
            </Link>
          </div>
          <div className="mt-14 flex flex-wrap items-center justify-center gap-8 md:gap-12">
            {statKeys.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="text-center"
              >
                <div className="text-2xl font-bold text-primary-foreground md:text-3xl">{s.value}</div>
                <div className="text-xs font-medium uppercase tracking-wider text-primary-foreground/70">{t(s.keyLabel)}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Category chips */}
      <section className="border-b border-border bg-background px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <p className="mb-4 text-center text-sm font-medium text-muted-foreground">
            {t("landingForEveryDukaan")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              { key: "chipKirana" as const, emoji: "🏪" },
              { key: "chipGeneral" as const, emoji: "🏬" },
              { key: "chipTeaStall" as const, emoji: "☕" },
              { key: "chipPaniPuri" as const, emoji: "🎪" },
              { key: "chipHardware" as const, emoji: "🔧" },
              { key: "chipSaloon" as const, emoji: "💇" },
              { key: "disposables" as const, emoji: "🥤" },
              { key: "electricals" as const, emoji: "⚡" },
            ].map(({ key, emoji }) => (
              <Link
                key={key}
                to="/search"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-4 py-2 text-sm font-medium transition-colors hover:bg-muted hover:border-primary/30"
              >
                <span>{emoji}</span>
                <span>{t(key)}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Dual mode: Buy supplies vs My Shop (sell) */}
      <section className="border-b border-border bg-muted/20 px-4 py-12 md:py-16">
        <div className="mx-auto max-w-5xl grid grid-cols-1 gap-6 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card className="h-full border-2 border-primary/20 bg-card shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-primary/30">
              <CardHeader className="pb-3">
                <span className="mb-2 inline-block rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  {t("tileBuyBadge")}
                </span>
                <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <ShoppingCart className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-xl font-bold md:text-2xl">{t("tileBuyHeadline")}</h2>
              </CardHeader>
              <CardContent className="space-y-2 pb-4">
                {buyBulletKeys.map((key, i) => (
                  <p key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                    {t(key)}
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
            <Card className="h-full border-2 border-accent/20 bg-card shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-accent/30">
              <CardHeader className="pb-3">
                <span className="mb-2 inline-block rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-foreground">
                  {t("tileSellBadge")}
                </span>
                <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
                  <Store className="h-7 w-7 text-accent" />
                </div>
                <h2 className="text-xl font-bold md:text-2xl">{t("tileSellHeadline")}</h2>
              </CardHeader>
              <CardContent className="space-y-2 pb-4">
                {sellBulletKeys.map((key, i) => (
                  <p key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
                    {t(key)}
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
        <div className="mx-auto mt-8 flex justify-center">
          <Link to="/search">
            <Button variant="secondary" size="lg" className="gap-2">
              <MapPin className="h-4 w-4" />
              {t("searchFindVendors")}
            </Button>
          </Link>
        </div>
      </section>

      {/* Features — Why dukaanwaale love us (dynamic with animations) */}
      <section id="features" className="scroll-mt-20 border-b border-border bg-muted/30 px-4 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <h2 className="mb-3 text-3xl font-bold md:text-4xl">
              {t("landingWhyLoveUs")}
            </h2>
            <p className="mx-auto max-w-xl text-muted-foreground">
              {t("landingWhyLoveUsDesc")}
            </p>
          </motion.div>
          <div className="grid gap-8 sm:grid-cols-2">
            {featureKeys.map((f, i) => (
              <motion.div
                key={f.keyTitle}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.12, type: "spring", stiffness: 120, damping: 20 }}
                whileHover={{ scale: 1.03, y: -6 }}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8 transition-shadow hover:shadow-xl hover:border-primary/20"
              >
                <motion.div
                  className="mb-4 text-4xl md:text-5xl"
                  whileHover={{ scale: 1.2 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                >
                  {f.emoji}
                </motion.div>
                <motion.h3
                  className="mb-2 text-lg font-bold md:text-xl"
                  whileHover={{ x: 4 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  {t(f.keyTitle)}
                </motion.h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{t(f.keyDesc)}</p>
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
            <h2 className="mb-3 text-3xl font-bold md:text-4xl">{t("landingHowItWorksTitle")}</h2>
            <p className="text-muted-foreground">{t("landingHowItWorksSub")}</p>
          </motion.div>
          <div className="space-y-8">
            {stepKeys.map((s, i) => (
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
                  <h3 className="mb-1 font-bold">{t(s.keyTitle)}</h3>
                  <p className="text-sm text-muted-foreground">{t(s.keyBody)}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Common questions (FAQ) — extends How it works scope */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-14"
          >
            <h3 className="mb-6 flex items-center gap-2 text-xl font-bold">
              <HelpCircle className="size-5 text-primary" />
              {t("faqCommonQuestions")}
            </h3>
            <div className="space-y-3">
              {faqKeys.map((faq, idx) => (
                <FaqItem key={idx} question={t(faq.keyQ)} answer={t(faq.keyA)} />
              ))}
            </div>
          </motion.div>
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
            <h2 className="mb-3 text-3xl font-bold md:text-4xl">{t("landingDukaanwaaleLikeYou")}</h2>
            <p className="mx-auto max-w-xl text-muted-foreground">
              {t("landingDukaanwaaleDesc")}
            </p>
          </motion.div>
          <div className="grid gap-6 md:grid-cols-3">
            {testimonialKeys.map((tc, i) => (
              <motion.div
                key={tc.keyName}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">
                    {tc.avatar}
                  </div>
                  <div>
                    <div className="font-semibold">{t(tc.keyName)}</div>
                    <div className="text-xs text-muted-foreground">{t(tc.keyStall)}</div>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">&ldquo;{t(tc.keyQuote)}&rdquo;</p>
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
            <h2 className="mb-3 text-3xl font-bold md:text-4xl">{t("landingWhatYouCanOrder")}</h2>
            <p className="text-muted-foreground">
              {t("landingWhatYouCanOrderDesc")}
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-wrap justify-center gap-4"
          >
            {productTeaserKeys.map((key) => (
              <span
                key={key}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm"
              >
                {t(key)}
              </span>
            ))}
          </motion.div>
          <div className="mt-8 text-center">
            <Link to="/catalog">
              <Button variant="outline" size="lg" className="gap-2">
                <ShoppingBag className="size-4" /> {t("viewFullProducts")}
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
            {t("landingReadyToGrow")}
          </h2>
          <p className="mb-8 text-primary-foreground/90">
            {t("landingJoinCta")}
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link to="/dashboard">
              <Button size="lg" className="h-12 bg-accent px-8 font-bold text-accent-foreground hover:bg-accent/90">
                {t("landingStartNow")} <ArrowRight className="ml-2 size-5" />
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

    </div>
  );
}
