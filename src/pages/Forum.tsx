import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { MessageCircle, ArrowLeft, Send, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/hooks/useProfile";
import { useSession } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

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
    if (error) return;
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
      supabase.removeChannel(channel);
    };
  }, [loadTopics, loadReplies, selectedTopic]);

  useEffect(() => {
    if (selectedTopic) loadReplies(selectedTopic.id);
  }, [selectedTopic, loadReplies]);

  const handlePostTopic = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed || !user?.id || posting) return;
    setPosting(true);
    const { error } = await supabase.from("forum_topics").insert({
      user_id: user.id,
      author_name: profile.name,
      title: trimmed,
    });
    setPosting(false);
    if (!error) {
      setNewTitle("");
      loadTopics();
    }
  };

  const handlePostReply = async () => {
    const trimmed = replyBody.trim();
    if (!trimmed || !user?.id || !selectedTopic || postingReply) return;
    setPostingReply(true);
    const { error } = await supabase.from("forum_replies").insert({
      topic_id: selectedTopic.id,
      user_id: user.id,
      author_name: profile.name,
      body: trimmed,
    });
    setPostingReply(false);
    if (!error) {
      setReplyBody("");
      loadReplies(selectedTopic.id);
      loadTopics();
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
              onKeyDown={(e) => e.key === "Enter" && handlePostReply()}
              className="flex-1"
            />
            <Button onClick={handlePostReply} disabled={!replyBody.trim() || postingReply} size="icon">
              <Send size={18} />
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

        <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm">
          <label className="mb-2 block text-sm font-medium">Start a discussion</label>
          <div className="flex gap-2">
            <Input
              placeholder="What do you want to ask?"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePostTopic()}
              className="flex-1"
            />
            <Button onClick={handlePostTopic} disabled={!newTitle.trim() || posting} size="icon">
              <Send size={18} />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
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
