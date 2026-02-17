import { useState } from "react";
import { Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/contexts/AppContext";
import { toast } from "sonner";

interface ReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  vendorName?: string;
  onSubmit: (rating: number, reviewText: string) => Promise<{ ok: boolean; error?: string }>;
  onSuccess: () => void;
}

export default function ReviewModal({
  open,
  onOpenChange,
  orderId,
  vendorName,
  onSubmit,
  onSuccess,
}: ReviewModalProps) {
  const { t } = useApp();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating < 1) return;
    setSubmitting(true);
    try {
      const result = await onSubmit(rating, reviewText.trim() || "");
      if (result.ok) {
        onSuccess();
        onOpenChange(false);
        setRating(0);
        setReviewText("");
        toast.success("Review submitted!");
      } else {
        toast.error(result.error ?? "Failed to submit");
      }
    } catch {
      toast.error("Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("reviewModalTitle")}</DialogTitle>
        </DialogHeader>
        {vendorName && (
          <p className="text-sm text-muted-foreground">{vendorName}</p>
        )}
        <div className="space-y-4 py-2">
          <div className="flex gap-1 justify-center">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setRating(i)}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(0)}
                className="p-1 transition-transform hover:scale-110"
                aria-label={`${i} ${t("reviewStars")}`}
              >
                <Star
                  className={`h-10 w-10 ${
                    i <= (hover || rating)
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            ))}
          </div>
          <Textarea
            placeholder={t("reviewModalPlaceholder")}
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            rows={3}
            className="resize-none"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("reviewModalCancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={rating < 1 || submitting}
          >
            {submitting ? t("reviewModalSubmitting") : t("reviewModalSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
