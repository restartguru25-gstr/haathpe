import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Package,
  MapPin,
  Star,
  Send,
  Plus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import {
  getApprovedSwaps,
  getSwapById,
  createSwap,
  getRatingsForSwap,
  addSwapRating,
  type VendorSwap,
  type SwapRating,
} from "@/lib/swaps";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

function StarRating({
  value,
  onChange,
  readonly,
}: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange?.(i)}
          className="p-0.5 focus:outline-none disabled:pointer-events-none"
        >
          <Star
            size={20}
            className={
              i <= value
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/40"
            }
          />
        </button>
      ))}
    </div>
  );
}

export default function Swap() {
  const { user } = useSession();
  const { profile } = useProfile();
  const [swaps, setSwaps] = useState<VendorSwap[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSwap, setSelectedSwap] = useState<VendorSwap | null>(null);
  const [ratings, setRatings] = useState<SwapRating[]>([]);
  const [postOpen, setPostOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postForm, setPostForm] = useState({
    title: "",
    description: "",
    price_notes: "",
    location: "",
  });
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadSwaps = useCallback(async () => {
    try {
      const list = await getApprovedSwaps();
      setSwaps(list ?? []);
    } catch {
      setSwaps([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSwaps();
  }, [loadSwaps]);

  useEffect(() => {
    if (!selectedSwap) return;
    getRatingsForSwap(selectedSwap.id).then(setRatings);
  }, [selectedSwap]);

  const handlePost = async () => {
    if (!user?.id) {
      toast.error("Sign in to post a listing");
      return;
    }
    if (!postForm.title.trim() || !postForm.price_notes.trim()) {
      toast.error("Title and price are required");
      return;
    }
    setPosting(true);
    const timeoutMs = 15000;
    try {
      const result = await Promise.race([
        createSwap({
          vendor_id: user.id,
          title: postForm.title.trim(),
          description: postForm.description.trim() || null,
          price_notes: postForm.price_notes.trim(),
          location: postForm.location.trim() || null,
        }),
        new Promise<{ ok: false; error: string }>((_, reject) =>
          setTimeout(() => reject(new Error("Request timed out")), timeoutMs)
        ),
      ]);
      if (result.ok) {
        toast.success("Listed! It will appear in Vendor Swap after admin approval.");
        setPostForm({ title: "", description: "", price_notes: "", location: "" });
        setPostOpen(false);
        loadSwaps();
      } else {
        const hint = result.error?.includes("does not exist")
          ? " Run vendor_swaps SQL in Supabase (e.g. part7 community)."
          : result.error?.includes("row-level security") || result.error?.includes("policy")
            ? " Make sure you're signed in."
            : "";
        toast.error((result.error ?? "Failed to post") + hint);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      const isTimeout = msg.includes("timed out");
      toast.error(
        isTimeout
          ? "Request took too long. Check your connection and try again."
          : msg + " Check your connection or try again."
      );
    } finally {
      setPosting(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!user?.id || !selectedSwap) return;
    setSubmittingReview(true);
    const result = await addSwapRating({
      swap_id: selectedSwap.id,
      reviewer_id: user.id,
      rating: reviewRating,
      review_text: reviewText.trim() || null,
    });
    setSubmittingReview(false);
    if (result.ok) {
      toast.success("Review submitted");
      setReviewText("");
      getRatingsForSwap(selectedSwap.id).then(setRatings);
    } else {
      toast.error(result.error ?? "Failed");
    }
  };

  const avgRating =
    ratings.length > 0
      ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length
      : null;

  if (selectedSwap) {
    return (
      <div className="min-h-screen bg-muted/20 pb-6">
        <div className="container max-w-2xl px-4 py-6">
          <div className="mb-4 flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedSwap(null)}
            >
              <ArrowLeft size={18} />
            </Button>
            <h1 className="text-lg font-bold line-clamp-1">{selectedSwap.title}</h1>
          </div>
          <div className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="font-semibold text-primary">{selectedSwap.price_notes}</p>
            {selectedSwap.location && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin size={14} /> {selectedSwap.location}
              </p>
            )}
            {selectedSwap.description && (
              <p className="mt-3 text-sm">{selectedSwap.description}</p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              {selectedSwap.vendor_name ?? "Vendor"} ·{" "}
              {new Date(selectedSwap.created_at).toLocaleDateString()}
            </p>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Reviews</h2>
            {avgRating != null && (
              <span className="flex items-center gap-1 text-sm">
                <Star size={14} className="fill-amber-400 text-amber-400" />
                {avgRating.toFixed(1)} ({ratings.length})
              </span>
            )}
          </div>
          <div className="mb-6 space-y-3">
            {ratings.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-center justify-between">
                  <StarRating value={r.rating} readonly />
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                {r.review_text && (
                  <p className="mt-2 text-sm">{r.review_text}</p>
                )}
              </div>
            ))}
            {ratings.length === 0 && (
              <p className="rounded-xl border border-dashed border-border bg-muted/20 py-6 text-center text-sm text-muted-foreground">
                No reviews yet. Be the first!
              </p>
            )}
          </div>

          {user && (
            <div className="rounded-xl border border-border bg-card p-4">
              <Label className="mb-2 block">Add your review</Label>
              <StarRating value={reviewRating} onChange={setReviewRating} />
              <Textarea
                placeholder="Optional comment..."
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                className="mt-2 min-h-[80px]"
              />
              <Button
                className="mt-2 w-full gap-2"
                onClick={handleSubmitReview}
                disabled={submittingReview}
              >
                {submittingReview ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                Submit review
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 pb-28 md:pb-6">
      <div className="container max-w-2xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon" aria-label="Back to dashboard">
                <ArrowLeft size={18} />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">
                Vendor Swap
              </h1>
              <p className="text-xs text-muted-foreground">
                Post or buy excess stock — peer-to-peer, no fees
              </p>
            </div>
          </div>
          {user && (
            <Button
              size="sm"
              className="gap-2"
              onClick={() => setPostOpen(true)}
            >
              <Plus size={16} /> Post
            </Button>
          )}
        </div>

        {postOpen && (
          <div className="mb-6 rounded-xl border-2 border-primary/20 bg-card p-5">
            <h2 className="mb-4 font-semibold">Post excess stock</h2>
            <p className="mb-4 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Your listing will appear here after admin approval. You’ll see it in the list once approved.
            </p>
            <div className="space-y-3">
              <div>
                <Label htmlFor="swap-title">Title</Label>
                <Input
                  id="swap-title"
                  placeholder="e.g. Extra rice packs from my tiffin centre"
                  value={postForm.title}
                  onChange={(e) =>
                    setPostForm((f) => ({ ...f, title: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="swap-price">Price / notes</Label>
                <Input
                  id="swap-price"
                  placeholder="e.g. ₹50/kg"
                  value={postForm.price_notes}
                  onChange={(e) =>
                    setPostForm((f) => ({ ...f, price_notes: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="swap-location">Location (area)</Label>
                <Input
                  id="swap-location"
                  placeholder="e.g. Near Secunderabad"
                  value={postForm.location}
                  onChange={(e) =>
                    setPostForm((f) => ({ ...f, location: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="swap-desc">Description (optional)</Label>
                <Textarea
                  id="swap-desc"
                  placeholder="Condition, quantity, contact preference..."
                  value={postForm.description}
                  onChange={(e) =>
                    setPostForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className="min-h-[80px]"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setPostOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={handlePost}
                  disabled={
                    posting ||
                    !postForm.title.trim() ||
                    !postForm.price_notes.trim()
                  }
                >
                  {posting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                  Submit
                </Button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : swaps.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center">
            <Package size={48} className="mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium text-muted-foreground">
              No listings yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Post your excess stock — free, no fees. Builds local vendor networks.
            </p>
            {user && (
              <Button
                className="mt-4 gap-2"
                onClick={() => setPostOpen(true)}
              >
                <Plus size={18} /> Post first listing
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {swaps.map((swap) => (
              <motion.button
                key={swap.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex w-full items-start gap-4 rounded-xl border border-border bg-card p-4 text-left shadow-sm hover:bg-muted/50"
                onClick={() => setSelectedSwap(swap)}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Package size={20} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight">{swap.title}</p>
                  <p className="text-sm text-primary">{swap.price_notes}</p>
                  {swap.location && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin size={12} /> {swap.location}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {swap.vendor_name ?? "Vendor"} ·{" "}
                    {new Date(swap.created_at).toLocaleDateString()}
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
