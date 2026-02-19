import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { MessageCircle, ArrowLeft, Send, Package, PlusCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/hooks/useProfile";
import { useSession } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface ForumTopic {
  id: string;
  author_name: string;
  title: string;
  created_at: string;
  reply_count?: number;
}

interface ForumReply {
  id: string;
  author_name: string;
  body: string;
  created_at: string;
}

export default function Forum() {
  const { profile } = useProfile();
  const { user } = useSession();
  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [posting, setPosting] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<ForumTopic | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [replyBody, setReplyBody] = useState("");
  const [postingReply, setPostingReply] = useState(false);

  const loadTopics = useCallback(async () => {
    const { data, error } = await supabase
      .from("forum_topics")
      .select("id, author_name, title, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      setTopics([]);
      return;
    }
    const withCount = await Promise.all(
      (data ?? []).map(async (t) => {
        const { count } = await supabase
          .from("forum_replies")
          .select("id", { count: "exact", head: true })
          .eq("topic_id", t.id);
        return { ...t, reply_count: count ?? 0 };
      })
    );
    setTopics(withCount);
  }, []);

  const loadReplies = useCallback(async (topicId: string) => {
    const { data } = await supabase
      .from("forum_replies")
      .select("id, author_name, body, created_at")
      .eq("topic_id", topicId)
      .order("created_at", { ascending: true });
    setReplies((data ?? []) as ForumReply[]);
  }, []);

  useEffect(() => {
    loadTopics().finally(() => setLoading(false));
  }, [loadTopics]);

  useEffect(() => {
    const channel = supabase
      .channel("forum")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "forum_topics" },
        () => loadTopics()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "forum_replies" },
        () => {
          loadTopics();
          if (selectedTopic) loadReplies(selectedTopic.id);
        }
      )
      .subscribe();
    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") throw e;
      }
    };
  }, [loadTopics, loadReplies, selectedTopic]);

  useEffect(() => {
    if (selectedTopic) loadReplies(selectedTopic.id);
  }, [selectedTopic, loadReplies]);

  const handlePostTopic = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed || posting) return;
    if (!user?.id) {
      toast.error("Sign in to start a discussion", { description: "Use the menu to sign in, then try again." });
      return;
    }
    setPosting(true);
    try {
      const { error } = await supabase.from("forum_topics").insert({
        user_id: user.id,
        author_name: profile.name || "Vendor",
        title: trimmed,
      });
      if (error) {
        const msg = error.message || "Could not post.";
        const hint = msg.includes("row-level security") || msg.includes("policy")
          ? " You must be signed in."
          : msg.includes("does not exist")
            ? " Run forum SQL in Supabase (part2 or migrations)."
            : "";
        toast.error(msg + hint);
        return;
      }
      setNewTitle("");
      await loadTopics();
      toast.success("Discussion started!");
    } catch (e) {
      const err = e as Error;
      if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
        toast.error("Request was cancelled. Please try again.");
      } else {
        toast.error(err?.message || "Could not post. Please try again.");
      }
    } finally {
      setPosting(false);
    }
  };

  const handlePostReply = async () => {
    const trimmed = replyBody.trim();
    if (!trimmed || !selectedTopic || postingReply) return;
    if (!user?.id) {
      toast.error("Sign in to reply");
      return;
    }
    setPostingReply(true);
    try {
      const { error } = await supabase.from("forum_replies").insert({
        topic_id: selectedTopic.id,
        user_id: user.id,
        author_name: profile.name || "Vendor",
        body: trimmed,
      });
      if (error) {
        toast.error(error.message || "Could not post reply.");
        return;
      }
      setReplyBody("");
      loadReplies(selectedTopic.id);
      loadTopics();
      toast.success("Reply posted!");
    } catch (e) {
      const err = e as Error;
      if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
        toast.error("Request was cancelled. Please try again.");
      } else {
        toast.error(err?.message || "Could not post reply. Please try again.");
      }
    } finally {
      setPostingReply(false);
    }
  };

  if (selectedTopic) {
    return (
      <div className="min-h-screen bg-muted/20 pb-6">
        <div className="container max-w-2xl px-4 py-6">
          <div className="mb-4 flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setSelectedTopic(null)}>
              <ArrowLeft size={18} />
            </Button>
            <h1 className="text-lg font-bold line-clamp-1">{selectedTopic.title}</h1>
          </div>
          <div className="mb-4 rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              {selectedTopic.author_name} · {new Date(selectedTopic.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="mb-4 space-y-3">
            {replies.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-border bg-card p-4"
              >
                <p className="font-medium">{r.author_name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Write a reply..."
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handlePostReply();
                }
              }}
              className="flex-1"
            />
            <Button onClick={handlePostReply} disabled={!replyBody.trim() || postingReply} size="icon" aria-busy={postingReply}>
              {postingReply ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 pb-6">
      <div className="container max-w-2xl px-4 py-6">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/profile">
            <Button variant="ghost" size="icon">
              <ArrowLeft size={18} />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Vendor forum</h1>
            <p className="text-xs text-muted-foreground">Discuss with other vendors</p>
          </div>
          <Link to="/swap">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Package size={16} /> Vendor Swap
            </Button>
          </Link>
        </div>

        <div className="mb-6 rounded-xl border-2 border-primary/20 bg-card p-4 shadow-sm">
          <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <PlusCircle size={18} className="text-primary" />
            Start a discussion
          </label>
          {!user?.id ? (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2.5 mb-3">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Sign in to post</p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">You must be signed in to start a discussion.</p>
              <Link to="/auth" className="inline-block mt-2">
                <Button size="sm" variant="outline" className="border-amber-500/50 text-amber-800 dark:text-amber-200">Sign in</Button>
              </Link>
            </div>
          ) : null}
          <p className="mb-3 text-xs text-muted-foreground">
            Type a question or topic below and press Send.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. How to get more orders? Best practices for QR menu?"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handlePostTopic();
                }
              }}
              className="flex-1"
              disabled={!user?.id}
              aria-label="Topic title"
            />
            <Button
              onClick={handlePostTopic}
              disabled={!user?.id || !newTitle.trim() || posting}
              size="icon"
              title="Post topic"
              aria-busy={posting}
            >
              {posting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : topics.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
            <MessageCircle size={48} className="mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium text-foreground">No discussions yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Be the first to start one. Use the box above to post a question or topic.
            </p>
            <Link to="/auth">
              <Button variant="outline" size="sm" className="mt-4">
                Sign in to post
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {topics.map((topic) => (
              <motion.button
                key={topic.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left shadow-sm hover:bg-muted/50"
                onClick={() => setSelectedTopic(topic)}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <MessageCircle size={20} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight">{topic.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {topic.author_name} · {new Date(topic.created_at).toLocaleDateString()} · {topic.reply_count ?? 0} replies
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
