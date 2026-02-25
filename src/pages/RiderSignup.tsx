import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sendRiderOtp, verifyRiderOtp, upsertRiderAfterSignup, RIDER_VEHICLE_TYPES, type RiderVehicleType } from "@/lib/riders";
import { useRiderAuth } from "@/contexts/RiderAuthContext";
import MakeInIndiaFooter from "@/components/MakeInIndiaFooter";
import { toast } from "sonner";
import { Loader2, Bike, Shield } from "lucide-react";
import BackButton from "@/components/BackButton";

const PHONE_PREFIX = "+91";

export default function RiderSignup() {
  const navigate = useNavigate();
  const { rider, isLoading: authLoading, refreshRider } = useRiderAuth();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [vehicleType, setVehicleType] = useState<RiderVehicleType | "">("");
  const [step, setStep] = useState<"phone" | "otp" | "details">("phone");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (rider) {
      navigate("/rider/dashboard", { replace: true });
    }
  }, [rider, authLoading, navigate]);

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
    if (!isValidPhone) {
      toast.error("Enter a valid 10-digit phone number");
      return;
    }
    setLoading(true);
    try {
      const result = await sendRiderOtp(fullPhone);
      if (result.ok) {
        toast.success("OTP sent to your phone");
        setStep("otp");
      } else {
        toast.error(result.error ?? "Failed to send OTP");
      }
    } catch {
      toast.error("Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim() || !fullPhone) return;
    setLoading(true);
    try {
      const result = await verifyRiderOtp(fullPhone, otp.trim());
      if (result.ok) {
        toast.success("Verified");
        setStep("details");
      } else {
        toast.error(result.error ?? "Invalid OTP");
      }
    } catch {
      toast.error("Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDetails = async () => {
    if (!vehicleType) {
      toast.error("Select vehicle type");
      return;
    }
    setLoading(true);
    try {
      const result = await upsertRiderAfterSignup(fullPhone, vehicleType as RiderVehicleType);
      if (result.ok) {
        toast.success("You're all set! Welcome, rider.");
        await refreshRider();
        navigate("/rider/dashboard", { replace: true });
      } else {
        toast.error(result.error ?? "Signup failed");
      }
    } catch {
      toast.error("Signup failed");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-muted/20 flex flex-col">
        <header className="sticky top-0 z-50 flex h-14 items-center border-b border-border/50 bg-background/95 backdrop-blur-md px-4">
          <BackButton fallbackTo="/" />
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
        <MakeInIndiaFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col pb-24">
      <header className="sticky top-0 z-50 flex h-14 items-center border-b border-border/50 bg-background/95 backdrop-blur-md px-4">
        <BackButton fallbackTo="/" />
        <h1 className="text-lg font-semibold mx-4">Rider signup</h1>
      </header>

      <div className="flex-1 container max-w-sm mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3 text-primary">
          <Bike className="h-10 w-10" />
          <div>
            <p className="font-semibold">Join as a rider</p>
            <p className="text-sm text-muted-foreground">2/3/4-wheelers — earn monthly rental + bonus</p>
          </div>
        </div>

        {step === "phone" && (
          <div className="space-y-4">
            <Label>Phone number</Label>
            <Input
              type="tel"
              placeholder="10-digit mobile"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              maxLength={10}
            />
            <Button className="w-full" onClick={handleSendOtp} disabled={!isValidPhone || loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send OTP"}
            </Button>
          </div>
        )}

        {step === "otp" && (
          <div className="space-y-4">
            <Label>Enter OTP sent to {phoneDigits.slice(0, 5)}*****</Label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
            />
            <Button className="w-full" onClick={handleVerifyOtp} disabled={otp.length < 4 || loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setStep("phone")} className="w-full">
              Change number
            </Button>
          </div>
        )}

        {step === "details" && (
          <div className="space-y-4">
            <Label>Vehicle type</Label>
            <Select value={vehicleType} onValueChange={(v) => setVehicleType(v as RiderVehicleType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {RIDER_VEHICLE_TYPES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-start gap-2">
              <Shield className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Aadhaar/PAN (optional)</p>
                <p>Link Cashfree Secure ID for verification later from your dashboard.</p>
              </div>
            </div>
            <Button className="w-full" onClick={handleSubmitDetails} disabled={!vehicleType || loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Complete signup"}
            </Button>
          </div>
        )}
      </div>

      <MakeInIndiaFooter />
    </div>
  );
}
