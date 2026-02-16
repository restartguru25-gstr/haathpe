import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSession } from "@/contexts/AuthContext";
import { COURSES } from "@/lib/courses";
import { getCompletedSections, markSectionComplete } from "@/lib/courseProgress";

export default function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useSession();
  const course = COURSES.find((c) => c.id === courseId);
  const [completed, setCompleted] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !courseId) return;
    getCompletedSections(user.id, courseId).then(setCompleted).finally(() => setLoading(false));
  }, [user?.id, courseId]);

  const handleComplete = async (sectionId: string) => {
    if (!user?.id || !courseId) return;
    await markSectionComplete(user.id, courseId, sectionId);
    setCompleted((prev) => (prev.includes(sectionId) ? prev : [...prev, sectionId]));
  };

  if (!course) {
    return (
      <div className="container max-w-2xl px-4 py-6">
        <p>Course not found.</p>
        <Link to="/courses">
          <Button variant="outline" className="mt-4">Back to courses</Button>
        </Link>
      </div>
    );
  }

  const progressPercent =
    course.sections.length > 0
      ? Math.round((completed.length / course.sections.length) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-muted/20 pb-6">
      <div className="container max-w-2xl px-4 py-6">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/courses">
            <Button variant="ghost" size="icon">
              <ArrowLeft size={18} />
            </Button>
          </Link>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-2xl">
            {course.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold tracking-tight">{course.title}</h1>
            <p className="text-sm text-muted-foreground">{course.duration}</p>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-medium">Your progress</span>
            <span className="text-muted-foreground">{completed.length}/{course.sections.length} sections</span>
          </div>
          <Progress value={progressPercent} className="h-2.5" />
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {course.sections.map((section, i) => {
              const isComplete = completed.includes(section.id);
              return (
                <motion.article
                  key={section.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => handleComplete(section.id)}
                      className="mt-0.5 shrink-0"
                      aria-label={isComplete ? "Mark incomplete" : "Mark complete"}
                    >
                      {isComplete ? (
                        <CheckCircle size={24} className="text-success" />
                      ) : (
                        <Circle size={24} className="text-muted-foreground" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-bold">{section.title}</h2>
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                        {section.content}
                      </p>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
