import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, ArrowLeft, CheckCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/contexts/AuthContext";
import { COURSES } from "@/lib/courses";
import { getCompletedSections } from "@/lib/courseProgress";

export default function Courses() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [progress, setProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      const next: Record<string, number> = {};
      for (const c of COURSES) {
        const completed = await getCompletedSections(user.id, c.id);
        next[c.id] = completed.length;
      }
      setProgress(next);
    };
    load();
  }, [user?.id]);

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
            <h1 className="text-xl font-extrabold tracking-tight">Upskill courses</h1>
            <p className="text-xs text-muted-foreground">Free courses for vendors</p>
          </div>
        </div>

        <div className="space-y-4">
          {COURSES.map((course, i) => {
            const completed = progress[course.id] ?? 0;
            const total = course.sections.length;
            const isComplete = total > 0 && completed === total;
            return (
              <motion.article
                key={course.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-2xl">
                    {course.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-bold">{course.title}</h2>
                    <p className="text-sm text-muted-foreground">{course.desc}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {course.duration} · {completed}/{total} sections
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={isComplete ? "secondary" : "default"}
                    className="shrink-0 gap-1.5"
                    onClick={() => navigate(`/courses/${course.id}`)}
                  >
                    {isComplete ? (
                      <>
                        <CheckCircle size={14} /> Done
                      </>
                    ) : (
                      <>
                        Open <ChevronRight size={14} />
                      </>
                    )}
                  </Button>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
