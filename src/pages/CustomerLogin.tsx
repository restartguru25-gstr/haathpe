import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MPINInput } from "@/components/ui/mpin-input";
import { sendCustomerOtp, verifyCustomerOtp } from "@/lib/customer";
import { setMpinAfterOtp, signInWithMpin } from "@/lib/mpin";
import { useApp } from "@/contexts/AppContext";
import MakeInIndiaFooter from "@/components/MakeInIndiaFooter";
import { toast } from "sonner";
import { Loader2, Smartphone, KeyRound } from "lucide-react";

const PHONE_PREFIX = "+91";

export default function CustomerLogin() {
  const { t } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/";

  const [phone, setPhone] = useState("");

  useEffect(() => {
    setPhone("");
  }, [location.pathname, location.key]);
  const [otp, setOtp] = useState("");
  const [mpin, setMpin] = useState("");
  const [mpinConfirm, setMpinConfirm] = useState("");
  const [step, setStep] = useState<"choice" | "phone" | "otp" | "mpin-create" | "mpin-signin">("choice");
  const [loading, setLoading] = useState(false);

  const handlePhoneChange = (value: string) => {
    let v = value.replace(/\D/g, "");
    if (v.startsWith("91")) v = v.slice(2);
    if (v.startsWith("0")) v = v.slice(1);
    setPhone(v.slice(0, 10));
  };
  const phoneDigits = phone.replace(/\D/g, "").slice(0, 10);
  const fullPhone = phoneDigits.length === 10 ? `${PHONE_PREFIX}${phoneDigits}` : "";
  const isValidPhone = phoneDigits.length === 10;

  const handleSendOtp = async () => {
    const digits = phone.replace(/\D/g, "").slice(0, 10);
    if (digits.length !== 10) {
      toast.error(t("customerLoginInvalidPhone"));
      return;
    }
    const full = `${PHONE_PREFIX}${digits}`;
    setLoading(true);
    try {
      const result = await sendCustomerOtp(full);
      if (result.ok) {
        toast.success(t("customerLoginOtpSent"));
        setStep("otp");
      } else {
        toast.error(result.error ?? t("customerLoginError"));
      }
    } catch {
      toast.error(t("customerLoginError"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim() || fullPhone.length < 10) return;
    setLoading(true);
    try {
      const result = await verifyCustomerOtp(fullPhone, otp.trim());
      if (result.ok) {
        toast.success(t("customerLoginSuccess"));
        setStep("mpin-create");
      } else {
        toast.error(result.error ?? t("customerLoginError"));
      }
    } catch {
      toast.error(t("customerLoginError"));
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
      const result = await setMpinAfterOtp(digits, phone);
      if (result.ok) {
        toast.success(t("mpinSetSuccess"));
        navigate(returnTo, { replace: true });
      } else {
        toast.error(result.error ?? t("customerLoginError"));
      }
    } catch {
      toast.error(t("customerLoginError"));
    } finally {
      setLoading(false);
    }
  };

  const handleMpinSignIn = async () => {
    const digits = phone.replace(/\D/g, "").slice(0, 10);
    if (digits.length !== 10) {
      toast.error(t("customerLoginInvalidPhone"));
      return;
    }
    const mpinDigits = mpin.replace(/\D/g, "").slice(0, 4);
    if (mpinDigits.length !== 4) {
      toast.error("Enter your 4-digit MPIN");
      return;
    }
    const full = `${PHONE_PREFIX}${digits}`;
    setLoading(true);
    try {
      const result = await signInWithMpin(full, mpinDigits);
      if (result.ok) {
        toast.success(t("customerLoginSuccess"));
        navigate(returnTo, { replace: true });
      } else {
        toast.error(t("mpinInvalid"));
      }
    } catch {
      toast.error(t("mpinInvalid"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col items-center p-4">
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Smartphone size={28} className="text-primary" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-center mb-1">{t("customerLoginTitle")}</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">{t("customerLoginSubtitle")}</p>

        {step === "choice" && (
          <div className="space-y-3">
            <Button
              className="w-full"
              onClick={() => setStep("phone")}
            >
              <Smartphone size={18} className="mr-2" />
              {t("customerLoginSendOtp")} (first time / forgot MPIN)
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setStep("mpin-signin")}
            >
              <KeyRound size={18} className="mr-2" />
              {t("mpinSignIn")} (returning)
            </Button>
          </div>
        )}

        {step === "phone" && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="phone">{t("customerLoginPhone")}</Label>
              <div className="flex mt-1.5 rounded-md border border-input bg-background overflow-hidden">
                <span className="flex items-center px-3 text-sm text-muted-foreground bg-muted/50 border-r border-input">
                  {PHONE_PREFIX}
                </span>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="9876543210"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  className="border-0 rounded-none focus-visible:ring-0"
                />
              </div>
            </div>
            <Button
              className="w-full"
              onClick={handleSendOtp}
              disabled={loading || !isValidPhone}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {loading ? " " : ""}{t("customerLoginSendOtp")}
            </Button>
            <button
              type="button"
              onClick={() => { setStep("choice"); setPhone(""); }}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              Back
            </button>
          </div>
        )}

        {step === "otp" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("customerLoginOtpSentTo")} {fullPhone}
            </p>
            <div>
              <Label htmlFor="otp">{t("customerLoginOtpCode")}</Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                placeholder="000000"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="mt-1.5"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleVerifyOtp}
              disabled={loading || otp.length < 4}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {loading ? " " : ""}{t("customerLoginVerify")}
            </Button>
            <button
              type="button"
              onClick={() => { setStep("phone"); setOtp(""); }}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              {t("customerLoginChangeNumber")}
            </button>
          </div>
        )}

        {step === "mpin-create" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("mpinCreateTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("mpinCreateSubtitle")}</p>
            <div>
              <Label>{t("mpinPlaceholder")}</Label>
              <MPINInput
                value={mpin}
                onChange={setMpin}
                placeholder={t("mpinPlaceholder")}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>{t("mpinConfirmPlaceholder")}</Label>
              <MPINInput
                value={mpinConfirm}
                onChange={setMpinConfirm}
                placeholder={t("mpinConfirmPlaceholder")}
                className="mt-1.5"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate(returnTo, { replace: true })}
              >
                Skip
              </Button>
              <Button
                className="flex-1"
                onClick={handleMpinCreate}
                disabled={loading || mpin.replace(/\D/g, "").length !== 4 || mpinConfirm.replace(/\D/g, "").length !== 4}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                {loading ? " " : ""}Set MPIN
              </Button>
            </div>
          </div>
        )}

        {step === "mpin-signin" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("mpinSignInSubtitle")}</p>
            <div>
              <Label>{t("customerLoginPhone")}</Label>
              <div className="flex mt-1.5 rounded-md border border-input bg-background overflow-hidden">
                <span className="flex items-center px-3 text-sm text-muted-foreground bg-muted/50 border-r border-input">
                  {PHONE_PREFIX}
                </span>
                <Input
                  type="tel"
                  inputMode="numeric"
                  placeholder="9876543210"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  className="border-0 rounded-none focus-visible:ring-0"
                />
              </div>
            </div>
            <div>
              <Label>{t("mpinEnter")}</Label>
              <MPINInput
                value={mpin}
                onChange={setMpin}
                placeholder={t("mpinPlaceholder")}
                className="mt-1.5"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleMpinSignIn}
              disabled={loading || !isValidPhone || mpin.replace(/\D/g, "").length !== 4}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {loading ? " " : ""}{t("mpinSignIn")}
            </Button>
            <button
              type="button"
              onClick={() => { setStep("choice"); setMpin(""); setPhone(""); }}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              Back
            </button>
          </div>
        )}

        {(step === "choice" || step === "phone" || step === "otp" || step === "mpin-signin") && (
          <div className="mt-6 pt-4 border-t border-border">
            <Link to={returnTo} className="block">
              <Button variant="ghost" className="w-full">{t("customerLoginContinueGuest")}</Button>
            </Link>
          </div>
        )}
      </div>
      </div>
      <MakeInIndiaFooter />
    </div>
  );
}
