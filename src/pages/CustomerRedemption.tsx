import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, LogOut, Check, Gift, Banknote, Tag, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useApp } from "@/contexts/AppContext";
import { getWalletBalance, createRedemption } from "@/lib/wallet";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const MIN_CASH = 100;
const REDEMPTION_TYPES = [
  { id: "cash" as const, label: "Cash", desc: "Min ₹100", icon: Banknote },
  { id: "coupon" as const, label: "Coupon", desc: "Supplies discount", icon: Tag },
  { id: "cashback" as const, label: "Cashback to UPI", desc: "Transfer to bank", icon: Smartphone },
];

export default function CustomerRedemption() {
  const { t } = useApp();
  const navigate = useNavigate();
  const { customer, isLoading: authLoading, isCustomer, signOutCustomer } = useCustomerAuth();
  const [balance, setBalance] = useState(0);
  const [step, setStep] = useState<"select" | "amount" | "confirm" | "success">("select");
  const [selectedType, setSelectedType] = useState<"cash" | "coupon" | "cashback">("cash");
  const [amount, setAmount] = useState("");
  const [sliderVal, setSliderVal] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!customer?.id) return;
    getWalletBalance(customer.id).then(setBalance);
  }, [customer?.id]);

  useEffect(() => {
    if (!authLoading && !isCustomer) {
      navigate("/customer-login?returnTo=/customer/redemption", { replace: true });
    }
  }, [authLoading, isCustomer, navigate]);

  const handleLogout = async () => {
    await signOutCustomer();
    navigate("/", { replace: true });
  };

  const minAmount = selectedType === "cash" ? MIN_CASH : 10;
  const maxAmount = Math.max(minAmount, Math.floor(balance));
  const amountNum = Math.max(0, parseFloat(amount.replace(/[^\d.]/g, "")) || 0);
  const effectiveAmount = amount ? Math.min(maxAmount, amountNum) : Math.min(maxAmount, Math.max(minAmount, sliderVal));
  const canRedeem = effectiveAmount >= minAmount && effectiveAmount <= balance;

  const handleSubmit = async () => {
    if (!customer?.id || !canRedeem) return;
    setSubmitting(true);
    try {
      const result = await createRedemption(customer.id, selectedType, effectiveAmount);
      if (result.ok) {
        setStep("success");
        toast.success(t("redemptionRequested"));
      } else {
        toast.error(result.error ?? "Failed");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !isCustomer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-64 w-80 rounded-2xl" />
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1E40AF]/10 via-background to-[#F97316]/10 flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="rounded-full h-28 w-28 bg-gradient-to-br from-[#FFD700]/30 to-[#B8860B]/40 border-2 border-[#FFD700]/60 flex items-center justify-center mb-6 shadow-lg"
        >
          <motion.div
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <Check size={56} className="text-[#B8860B] dark:text-[#FFD700]" strokeWidth={2.5} />
          </motion.div>
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold text-center mb-2 text-[#B8860B] dark:text-[#FFD700]"
        >
          Redeemed Successfully!
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-muted-foreground text-center mb-8"
        >
          {t("redemptionPendingNote")}
        </motion.p>
        <Link to="/customer/wallet">
          <Button className="bg-[#FFD700]/20 text-[#B8860B] border-[#FFD700]/50 hover:bg-[#FFD700]/30">{t("backToWallet")}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E40AF]/5 via-background to-[#F97316]/5">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/95 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/customer/wallet">
            <Button variant="ghost" size="icon"><ArrowLeft size={20} /></Button>
          </Link>
          <h1 className="font-semibold">{t("redeemNow")}</h1>
          <Button variant="ghost" size="icon" onClick={handleLogout} title={t("customerLogout")}>
            <LogOut size={20} />
          </Button>
        </div>
      </header>

      <div className="container max-w-lg mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-to-br from-[#1E40AF]/10 to-[#F97316]/10 border border-[#FFD700]/20 bg-card/50 backdrop-blur-sm p-4 mb-6"
        >
          <p className="text-sm text-muted-foreground">{t("walletBalance")}</p>
          <p className="text-2xl font-bold text-primary">₹{balance.toFixed(0)}</p>
        </motion.div>

        {step === "select" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            <p className="font-medium mb-4">{t("selectRedemptionType")}</p>
            {REDEMPTION_TYPES.map((type) => (
              <motion.button
                key={type.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => {
                  setSelectedType(type.id);
                  const min = type.id === "cash" ? MIN_CASH : 10;
                  setSliderVal(Math.min(maxAmount, Math.max(min, Math.floor(balance / 2))));
                  setAmount("");
                  setStep("amount");
                }}
                className="w-full flex items-center gap-4 rounded-2xl border-2 border-border bg-card/80 backdrop-blur-sm p-4 text-left hover:border-[#FFD700]/40 transition-colors"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <type.icon size={24} className="text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{type.label}</p>
                  <p className="text-sm text-muted-foreground">{type.desc}</p>
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}

        {(step === "amount" || step === "confirm") && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <Button variant="ghost" size="sm" onClick={() => setStep("select")}>
              ← {t("back")}
            </Button>
            <div>
              <label className="text-sm font-medium mb-2 block">{t("amountToRedeem")}</label>
              <div className="rounded-xl border-2 border-input bg-background/80 backdrop-blur-sm px-4 py-3">
                <Slider
                  min={minAmount}
                  max={maxAmount}
                  step={selectedType === "cash" ? 50 : 10}
                  value={[amount ? Math.min(maxAmount, Math.max(minAmount, amountNum)) : sliderVal]}
                  onValueChange={(v) => {
                    setSliderVal(v[0] ?? minAmount);
                    setAmount("");
                  }}
                  className="mb-2"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={selectedType === "cash" ? "Min 100" : "Min 10"}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value.replace(/[^\d.]/g, ""));
                    setSliderVal(0);
                  }}
                  className="w-full text-xl font-semibold focus:outline-none bg-transparent"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {t("availableBalance")}: ₹{balance.toFixed(0)} · {selectedType === "cash" ? t("minCash100") : t("minRedeem10")}
              </p>
            </div>
            <Button
              className="w-full h-12 text-base bg-gradient-to-r from-[#1E40AF] to-[#F97316] text-white border-0"
              disabled={!canRedeem || submitting}
              onClick={handleSubmit}
            >
              <Gift size={18} className="mr-2" />
              {submitting ? "..." : t("submitRedemption")}
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
