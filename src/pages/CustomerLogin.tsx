import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendCustomerOtp, verifyCustomerOtp } from "@/lib/customer";
import { useApp } from "@/contexts/AppContext";
import MakeInIndiaFooter from "@/components/MakeInIndiaFooter";
import { toast } from "sonner";
import { Loader2, Smartphone } from "lucide-react";

const PHONE_PREFIX = "+91";

export default function CustomerLogin() {
  const { t } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/";

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);

  const fullPhone = phone.trim() ? `${PHONE_PREFIX}${phone.trim().replace(/^\d+/, "").replace(/\D/g, "")}` : "";
  const isValidPhone = /^\d{10}$/.test(phone.replace(/\D/g, ""));

  const handleSendOtp = async () => {
    const digits = phone.replace(/\D/g, "");
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

        {step === "phone" ? (
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
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
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
          </div>
        ) : (
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

        <div className="mt-6 pt-4 border-t border-border">
          <Link to={returnTo} className="block">
            <Button variant="ghost" className="w-full">{t("customerLoginContinueGuest")}</Button>
          </Link>
        </div>
      </div>
      </div>
      <MakeInIndiaFooter />
    </div>
  );
}
