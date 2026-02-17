import { Check } from "lucide-react";
import { useApp } from "@/contexts/AppContext";

const STEPS: { key: string; status: string }[] = [
  { key: "statusPending", status: "pending" },
  { key: "statusPrepared", status: "prepared" },
  { key: "statusReady", status: "ready" },
  { key: "statusDelivered", status: "delivered" },
];

export default function OrderStatusTimeline({ status }: { status: string }) {
  const { t } = useApp();
  const statusOrder = ["pending", "prepared", "ready", "delivered", "paid"];
  const currentIdx = statusOrder.indexOf(status);
  const resolvedIdx = status === "paid" ? statusOrder.indexOf("delivered") : currentIdx;

  return (
    <div className="space-y-2">
      {STEPS.map((step, i) => {
        const stepIdx = statusOrder.indexOf(step.status);
        const done = resolvedIdx >= stepIdx;
        return (
          <div key={step.key} className="flex items-center gap-3">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                done
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/30 text-muted-foreground"
              }`}
            >
              {done ? <Check className="h-4 w-4" /> : <span className="text-xs">{i + 1}</span>}
            </div>
            <span className={done ? "font-medium text-foreground" : "text-muted-foreground text-sm"}>
              {t(step.key as keyof typeof import("@/lib/data").translations.en)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
