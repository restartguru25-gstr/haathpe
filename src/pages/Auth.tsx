import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Mail, ArrowLeft, Lock, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordInput } from "@/components/ui/password-input";
import { MPINInput } from "@/components/ui/mpin-input";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useSession } from "@/contexts/AuthContext";
import MakeInIndiaFooter from "@/components/MakeInIndiaFooter";
import { useApp } from "@/contexts/AppContext";
import { setMyReferrer } from "@/lib/incentives";
import { setMpinAfterOtp, signInWithMpin } from "@/lib/mpin";

type AuthStep = "method" | "phone" | "otp" | "magic" | "sent" | "password" | "mpin-create" | "mpin-signin";
type EmailPasswordMode = "signin" | "signup";

export default function Auth() {
  const { t } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const refId = searchParams.get("ref");
  const { isAuthenticated } = useSession();
  const [step, setStep] = useState<AuthStep>("method");
  const [emailPasswordMode, setEmailPasswordMode] = useState<EmailPasswordMode>("signin");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mpin, setMpin] = useState("");
  const [mpinConfirm, setMpinConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const state = location.state as { next?: string; from?: { pathname?: string } } | null;
  const nextPath = state?.next ?? state?.from?.pathname ?? "/";

  useEffect(() => {
    if (isAuthenticated) navigate(nextPath, { replace: true });
  }, [isAuthenticated, nextPath, navigate]);

  if (isAuthenticated) return null;

  const formatPhone = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 10);
    if (digits.length === 0) return "";
    if (digits.length <= 5) return `+91 ${digits}`;
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  };

  const handlePhoneSubmit = async () => {
    if (!termsAccepted) {
      toast.error("Please accept the Terms & Conditions and Privacy Policy to continue.");
      return;
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) {
      toast.error("Enter a valid 10-digit Indian phone number");
      return;
    }
    const fullPhone = `+91${digits}`;
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      toast.error("Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
        options: { channel: "sms" },
      });
      if (error) {
        if (error.message.includes("Twilio") || error.message.includes("provider")) {
          toast.error(
            "Phone OTP is not configured yet. Please use Magic Link (email) or ask admin to enable Twilio in Supabase."
          );
          setStep("method");
        } else {
          toast.error(error.message);
        }
        return;
      }
      setPhone(fullPhone);
      setStep("otp");
      toast.success("OTP sent! Check your phone.");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      toast.error("Something went wrong. Try Magic Link instead.");
      setStep("method");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async () => {
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit OTP");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: "sms",
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Signed in! Create MPIN for next time.");
      setStep("mpin-create");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      toast.error("Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleMpinCreate = async () => {
    const digits = mpin.replace(/\D/g, "").slice(0, 4);
    const confirmDigits = mpinConfirm.replace(/\D/g, "").slice(0, 4);
    if (digits.length !== 4) {
      toast.error("Enter a 4-digit MPIN");
      return;
    }
    if (digits !== confirmDigits) {
      toast.error(t("mpinMismatch"));
      return;
    }
    setLoading(true);
    try {
      const result = await setMpinAfterOtp(digits);
      if (result.ok) {
        toast.success(t("mpinSetSuccess"));
        navigate(nextPath, { replace: true });
      } else {
        toast.error(result.error ?? "Failed to set MPIN");
      }
    } catch (e) {
      toast.error("Failed to set MPIN. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleMpinSkip = () => {
    navigate(nextPath, { replace: true });
  };

  const handleMpinSignIn = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) {
      toast.error("Enter a valid 10-digit phone number");
      return;
    }
    const mpinDigits = mpin.replace(/\D/g, "").slice(0, 4);
    if (mpinDigits.length !== 4) {
      toast.error("Enter your 4-digit MPIN");
      return;
    }
    const fullPhone = `+91${digits}`;
    setLoading(true);
    try {
      const result = await signInWithMpin(fullPhone, mpinDigits);
      if (result.ok) {
        if (refId) await setMyReferrer(refId);
        toast.success("Signed in!");
        navigate(nextPath, { replace: true });
      } else {
        toast.error(t("mpinInvalid"));
      }
    } catch (e) {
      toast.error(t("mpinInvalid"));
    } finally {
      setLoading(false);
    }
  };

  const handleMagicSubmit = async () => {
    if (!termsAccepted) {
      toast.error("Please accept the Terms & Conditions and Privacy Policy to continue.");
      return;
    }
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      toast.error("Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env");
      return;
    }
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Enter your email");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Enter a valid email");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setStep("sent");
      toast.success("Check your email for the magic link!");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailPasswordSubmit = async () => {
    if (!termsAccepted) {
      toast.error("Please accept the Terms & Conditions and Privacy Policy to continue.");
      return;
    }
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      toast.error("Supabase not configured.");
      return;
    }
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error("Enter your email");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Enter a valid email");
      return;
    }
    if (!password) {
      toast.error("Enter your password");
      return;
    }
    setLoading(true);
    try {
      if (emailPasswordMode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (!signInError) {
          if (refId) await setMyReferrer(refId);
          toast.success("Signed in!");
          navigate(nextPath, { replace: true });
          return;
        }
        toast.error("Wrong email or password. Try again or sign up if you don’t have an account.");
        return;
      }

      // Sign up only
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (!signUpError) {
        if (signUpData?.session) {
          if (refId) await setMyReferrer(refId);
          toast.success("Account created! Signed in.");
          navigate(nextPath, { replace: true });
          return;
        }
        toast.success("Account created. Sign in with your email and password above.");
        return;
      }
      if (signUpError.message?.includes("already been registered")) {
        toast.error("Email already registered. Sign in with your password or use Magic Link.");
        return;
      }
      toast.error(signUpError.message || "Sign up failed.");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      toast.error(emailPasswordMode === "signin" ? "Sign in failed. Please try again." : "Sign up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-primary/5">
      {/* Decorative top gradient strip */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" aria-hidden />
      <div className="flex-1 flex flex-col items-center justify-center w-full px-4 py-10 sm:py-14 relative">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-md"
        >
          <div className="rounded-2xl border-2 border-border/80 bg-card/95 shadow-xl shadow-primary/5 p-6 sm:p-8">
            <Link
              to="/"
              className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={18} /> Back to home
            </Link>

            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground font-brand tracking-widest shadow-lg shadow-primary/25">
                h
              </div>
              <div>
                <span className="brand-haathpe text-2xl block leading-tight">haathpe</span>
                <p className="text-xs text-muted-foreground mt-0.5">{t("tagline")}</p>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mb-1">
              {step === "mpin-create"
                ? t("mpinCreateTitle")
                : step === "mpin-signin"
                  ? t("mpinSignInTitle")
                  : step === "password"
                    ? emailPasswordMode === "signup"
                      ? "Sign up"
                      : "Sign in"
                    : "Sign in / Sign up"}
            </h1>
            <p className="mb-6 text-muted-foreground text-sm">
              {step === "mpin-create"
                ? t("mpinCreateSubtitle")
                : step === "mpin-signin"
                  ? t("mpinSignInSubtitle")
                  : step === "password"
                ? emailPasswordMode === "signup"
                  ? "Create an account with your email and password."
                  : "Enter your email and password to sign in."
                : "Choose how you’d like to sign in or create an account."}
            </p>

        <AnimatePresence mode="wait">
          {step === "method" && (
            <motion.div
              key="method"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-3"
            >
              <button
                type="button"
                onClick={() => setStep("phone")}
                className="w-full flex items-center gap-4 rounded-xl border-2 border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-md hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Phone size={22} className="text-primary" />
                </div>
                <div>
                  <span className="font-semibold text-foreground block">Phone OTP</span>
                  <span className="text-xs text-muted-foreground">India +91 · Get a code on your phone</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setStep("magic")}
                className="w-full flex items-center gap-4 rounded-xl border-2 border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-md hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Mail size={22} className="text-primary" />
                </div>
                <div>
                  <span className="font-semibold text-foreground block">Magic Link</span>
                  <span className="text-xs text-muted-foreground">We’ll email you a one-click sign-in link</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setStep("mpin-signin")}
                className="w-full flex items-center gap-4 rounded-xl border-2 border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-md hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <KeyRound size={22} className="text-primary" />
                </div>
                <div>
                  <span className="font-semibold text-foreground block">{t("mpinSignIn")}</span>
                  <span className="text-xs text-muted-foreground">{t("mpinSignInSubtitle")}</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setStep("password")}
                className="w-full flex items-center gap-4 rounded-xl border-2 border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-md hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Lock size={22} className="text-primary" />
                </div>
                <div>
                  <span className="font-semibold text-foreground block">Email &amp; password</span>
                  <span className="text-xs text-muted-foreground">Sign in or create an account with email</span>
                </div>
              </button>
            </motion.div>
          )}

          {step === "phone" && (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-4"
            >
              <div>
                <label className="text-sm font-semibold text-foreground">Phone number</label>
                <p className="text-xs text-muted-foreground mb-2">We’ll send a 6-digit code to this number (+91)</p>
                <Input
                  placeholder="98765 43210"
                  value={formatPhone(phone)}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="h-11 rounded-lg border-2 focus-visible:ring-2 focus-visible:ring-primary/30"
                  maxLength={16}
                  autoFocus
                />
              </div>
              <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/50">
                <Checkbox
                  checked={termsAccepted}
                  onCheckedChange={(c) => setTermsAccepted(!!c)}
                  className="mt-0.5"
                />
                <span className="text-sm text-muted-foreground">
                  I agree to the{" "}
                  <Link to="/#terms" className="text-primary font-medium underline hover:no-underline">Terms &amp; Conditions</Link>
                  {" "}and{" "}
                  <Link to="/#privacy" className="text-primary font-medium underline hover:no-underline">Privacy Policy</Link>.
                </span>
              </label>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={() => setStep("method")} className="rounded-lg">
                  Back
                </Button>
                <Button className="flex-1 rounded-lg h-11 font-semibold" onClick={handlePhoneSubmit} disabled={loading || !termsAccepted}>
                  {loading ? "Sending…" : "Send OTP"}
                </Button>
              </div>
            </motion.div>
          )}

          {step === "otp" && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-5"
            >
              <p className="text-sm text-muted-foreground">
                Code sent to <span className="font-medium text-foreground">{phone}</span>
              </p>
              <div className="flex justify-center py-2">
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup className="gap-2 sm:gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <InputOTPSlot key={i} index={i} className="h-12 w-10 sm:h-14 sm:w-12 rounded-lg border-2 text-lg font-semibold" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={() => setStep("phone")} className="rounded-lg">
                  Change number
                </Button>
                <Button className="flex-1 rounded-lg h-11 font-semibold" onClick={handleOtpVerify} disabled={loading || otp.length !== 6}>
                  {loading ? "Verifying…" : "Verify"}
                </Button>
              </div>
            </motion.div>
          )}

          {step === "magic" && (
            <motion.div
              key="magic"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-4"
            >
              <div>
                <label className="text-sm font-semibold text-foreground">Email address</label>
                <p className="text-xs text-muted-foreground mb-2">We’ll send a sign-in link to your inbox</p>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-lg border-2 focus-visible:ring-2 focus-visible:ring-primary/30 mt-1"
                  autoFocus
                />
              </div>
              <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/50">
                <Checkbox
                  checked={termsAccepted}
                  onCheckedChange={(c) => setTermsAccepted(!!c)}
                  className="mt-0.5"
                />
                <span className="text-sm text-muted-foreground">
                  I agree to the{" "}
                  <Link to="/#terms" className="text-primary font-medium underline hover:no-underline">Terms &amp; Conditions</Link>
                  {" "}and{" "}
                  <Link to="/#privacy" className="text-primary font-medium underline hover:no-underline">Privacy Policy</Link>.
                </span>
              </label>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={() => setStep("method")} className="rounded-lg">
                  Back
                </Button>
                <Button className="flex-1 rounded-lg h-11 font-semibold" onClick={handleMagicSubmit} disabled={loading || !termsAccepted}>
                  {loading ? "Sending…" : "Send Magic Link"}
                </Button>
              </div>
            </motion.div>
          )}

          {step === "password" && (
            <motion.div
              key="password"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-center gap-2 py-1">
                <button
                  type="button"
                  onClick={() => setEmailPasswordMode("signin")}
                  className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${emailPasswordMode === "signin" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => setEmailPasswordMode("signup")}
                  className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${emailPasswordMode === "signup" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Sign up
                </button>
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground">Email</label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-lg border-2 focus-visible:ring-2 focus-visible:ring-primary/30 mt-1"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground">Password</label>
                <PasswordInput
                  placeholder={emailPasswordMode === "signup" ? "Min 6 characters" : "••••••••"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-lg border-2 focus-visible:ring-2 focus-visible:ring-primary/30 mt-1"
                  autoComplete={emailPasswordMode === "signup" ? "new-password" : "current-password"}
                />
              </div>
              <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/50">
                <Checkbox
                  checked={termsAccepted}
                  onCheckedChange={(c) => setTermsAccepted(!!c)}
                  className="mt-0.5"
                />
                <span className="text-sm text-muted-foreground">
                  I agree to the{" "}
                  <Link to="/#terms" className="text-primary font-medium underline hover:no-underline">Terms &amp; Conditions</Link>
                  {" "}and{" "}
                  <Link to="/#privacy" className="text-primary font-medium underline hover:no-underline">Privacy Policy</Link>.
                </span>
              </label>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={() => { setStep("method"); setPassword(""); }} className="rounded-lg">
                  Back
                </Button>
                <Button className="flex-1 rounded-lg h-11 font-semibold" onClick={handleEmailPasswordSubmit} disabled={loading || !termsAccepted}>
                  {loading ? (emailPasswordMode === "signup" ? "Creating…" : "Signing in…") : emailPasswordMode === "signup" ? "Sign up" : "Sign in"}
                </Button>
              </div>
            </motion.div>
          )}

          {step === "mpin-create" && (
            <motion.div
              key="mpin-create"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-4"
            >
              <p className="text-sm text-muted-foreground">{t("mpinCreateTitle")}</p>
              <p className="text-xs text-muted-foreground mb-2">{t("mpinCreateSubtitle")}</p>
              <div>
                <label className="text-sm font-semibold text-foreground">{t("mpinPlaceholder")}</label>
                <MPINInput
                  value={mpin}
                  onChange={setMpin}
                  placeholder={t("mpinPlaceholder")}
                  className="mt-1.5 rounded-lg border-2 focus-visible:ring-2 focus-visible:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground">{t("mpinConfirmPlaceholder")}</label>
                <MPINInput
                  value={mpinConfirm}
                  onChange={setMpinConfirm}
                  placeholder={t("mpinConfirmPlaceholder")}
                  className="mt-1.5 rounded-lg border-2 focus-visible:ring-2 focus-visible:ring-primary/30"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={handleMpinSkip} className="rounded-lg">
                  Skip for now
                </Button>
                <Button
                  className="flex-1 rounded-lg h-11 font-semibold"
                  onClick={handleMpinCreate}
                  disabled={loading || mpin.replace(/\D/g, "").length !== 4 || mpinConfirm.replace(/\D/g, "").length !== 4}
                >
                  {loading ? "Setting…" : "Set MPIN"}
                </Button>
              </div>
            </motion.div>
          )}

          {step === "mpin-signin" && (
            <motion.div
              key="mpin-signin"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-4"
            >
              <p className="text-sm text-muted-foreground">{t("mpinSignInSubtitle")}</p>
              <div>
                <label className="text-sm font-semibold text-foreground">Phone number</label>
                <Input
                  placeholder="98765 43210"
                  value={formatPhone(phone)}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="h-11 rounded-lg border-2 focus-visible:ring-2 focus-visible:ring-primary/30 mt-1"
                  maxLength={16}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground">{t("mpinEnter")}</label>
                <MPINInput
                  value={mpin}
                  onChange={setMpin}
                  placeholder={t("mpinPlaceholder")}
                  className="mt-1.5 rounded-lg border-2 focus-visible:ring-2 focus-visible:ring-primary/30"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={() => { setStep("method"); setMpin(""); }} className="rounded-lg">
                  Back
                </Button>
                <Button
                  className="flex-1 rounded-lg h-11 font-semibold"
                  onClick={handleMpinSignIn}
                  disabled={loading || phone.replace(/\D/g, "").length !== 10 || mpin.replace(/\D/g, "").length !== 4}
                >
                  {loading ? "Signing in…" : t("mpinSignIn")}
                </Button>
              </div>
            </motion.div>
          )}

          {step === "sent" && (
            <motion.div
              key="sent"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4 rounded-xl border-2 border-primary/20 bg-primary/5 p-5"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15">
                  <Mail size={24} className="text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Check your inbox</p>
                  <p className="text-xs text-muted-foreground">We sent a magic link to {email}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Click the link in the email to sign in. You can close this tab.
              </p>
              <Button variant="outline" onClick={() => setStep("method")} className="rounded-lg w-full sm:w-auto">
                Use a different method
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              By signing in, you agree to our terms and privacy policy.
            </p>
          </div>
        </motion.div>
      </div>
      <div className="w-full mt-auto pt-6">
        <MakeInIndiaFooter />
      </div>
    </div>
  );
}
