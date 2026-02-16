import { useState } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Mail, ArrowLeft, TestTube, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useSession } from "@/contexts/AuthContext";
import { setMyReferrer } from "@/lib/incentives";

// Dummy credentials for testing (dev only)
const TEST_EMAIL = "test@vendorhub.in";
const TEST_PASSWORD = "Test123!";

type AuthStep = "method" | "phone" | "otp" | "magic" | "sent" | "password";

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const refId = searchParams.get("ref");
  const { isAuthenticated } = useSession();
  const [step, setStep] = useState<AuthStep>("method");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const state = location.state as { next?: string; from?: { pathname?: string } } | null;
  const nextPath = state?.next ?? state?.from?.pathname ?? "/";

  if (isAuthenticated) {
    navigate(nextPath, { replace: true });
    return null;
  }

  const formatPhone = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 10);
    if (digits.length === 0) return "";
    if (digits.length <= 5) return `+91 ${digits}`;
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  };

  const handlePhoneSubmit = async () => {
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
      toast.success("Signed in!");
      navigate(nextPath, { replace: true });
    } catch (e) {
      toast.error("Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleTestLogin = async () => {
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      toast.error("Supabase not configured.");
      return;
    }
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });
      if (!signInError) {
        if (refId) await setMyReferrer(refId);
        toast.success("Signed in with test account!");
        navigate(nextPath, { replace: true });
        return;
      }
      if (signInError.message.includes("Invalid login")) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (!signUpError) {
          if (refId) await setMyReferrer(refId);
          toast.success("Test account created! Signed in.");
          navigate(nextPath, { replace: true });
          return;
        }
        if (signUpError.message.includes("already been registered")) {
          toast.error("Test user exists but password may differ. Use: " + TEST_PASSWORD);
          return;
        }
      }
      toast.error(signInError.message);
    } catch (e) {
      toast.error("Test login failed. Try Magic Link.");
    } finally {
      setLoading(false);
    }
  };

  const handleMagicSubmit = async () => {
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
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailPasswordSubmit = async () => {
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
      if (signInError.message.includes("Invalid login") || signInError.message.includes("invalid")) {
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
          toast.success("Account created! Check your email to confirm. Then sign in with your password.");
          return;
        }
        if (signUpError.message?.includes("already been registered")) {
          toast.error("Email already registered. Use the correct password or try Magic Link.");
          return;
        }
        toast.error(signUpError.message || "Sign up failed.");
        return;
      }
      toast.error(signInError.message);
    } catch (e) {
      toast.error("Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} /> Back to home
        </Link>

        <div className="mb-8 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
            V
          </div>
          <span className="text-xl font-bold">VendorHub</span>
        </div>

        <h1 className="mb-2 text-2xl font-extrabold">Sign in / Sign up</h1>
        <p className="mb-6 text-muted-foreground text-sm">
          New users: create an account. Existing: sign in. Phone OTP, magic link, or email &amp; password.
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
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-12"
                onClick={() => setStep("phone")}
              >
                <Phone size={18} /> Phone OTP (India +91)
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-12"
                onClick={() => setStep("magic")}
              >
                <Mail size={18} /> Magic Link (email)
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-12"
                onClick={() => setStep("password")}
              >
                <Lock size={18} /> Email &amp; password (sign in or sign up)
              </Button>
              {import.meta.env.DEV && (
                <Button
                  variant="secondary"
                  className="w-full justify-start gap-3 h-12 border-dashed"
                  onClick={handleTestLogin}
                  disabled={loading}
                >
                  <TestTube size={18} /> Test login (test@vendorhub.in / Test123!)
                </Button>
              )}
            </motion.div>
          )}

          {step === "phone" && (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-3"
            >
              <div>
                <label className="text-sm font-medium text-muted-foreground">Phone (+91)</label>
                <Input
                  placeholder="98765 43210"
                  value={formatPhone(phone)}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1"
                  maxLength={16}
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("method")}>
                  Back
                </Button>
                <Button className="flex-1" onClick={handlePhoneSubmit} disabled={loading}>
                  {loading ? "Sending..." : "Send OTP"}
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
              className="space-y-3"
            >
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit OTP sent to {phone}
              </p>
              <div className="flex justify-center py-4">
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup className="gap-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("phone")}>
                  Change number
                </Button>
                <Button className="flex-1" onClick={handleOtpVerify} disabled={loading || otp.length !== 6}>
                  {loading ? "Verifying..." : "Verify"}
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
              className="space-y-3"
            >
              <div>
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("method")}>
                  Back
                </Button>
                <Button className="flex-1" onClick={handleMagicSubmit} disabled={loading}>
                  {loading ? "Sending..." : "Send Magic Link"}
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
              className="space-y-3"
            >
              <p className="text-xs text-muted-foreground">
                New? Enter email + password to create an account. Existing? Same form signs you in.
              </p>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <Input
                  type="email"
                  placeholder="admin@street.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1"
                  autoComplete="current-password"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setStep("method"); setPassword(""); }}>
                  Back
                </Button>
                <Button className="flex-1" onClick={handleEmailPasswordSubmit} disabled={loading}>
                  {loading ? "Signing in..." : "Sign in / Sign up"}
                </Button>
              </div>
            </motion.div>
          )}

          {step === "sent" && (
            <motion.div
              key="sent"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-3 rounded-lg border border-border bg-muted/50 p-4"
            >
              <p className="text-sm font-medium">Check your inbox</p>
              <p className="text-xs text-muted-foreground">
                We sent a magic link to {email}. Click it to sign in. You can close this tab.
              </p>
              <Button variant="outline" onClick={() => setStep("method")}>
                Use different method
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          By signing in, you agree to our terms and privacy policy.
        </p>
      </motion.div>
    </div>
  );
}
