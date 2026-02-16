import { supabase } from "./supabase";

export async function getCompletedSections(
  userId: string,
  courseId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("course_progress")
    .select("section_id")
    .eq("user_id", userId)
    .eq("course_id", courseId);
  if (error) return [];
  return (data ?? []).map((r) => r.section_id);
}

export async function markSectionComplete(
  userId: string,
  courseId: string,
  sectionId: string
): Promise<void> {
  const { error } = await supabase.from("course_progress").insert({
    user_id: userId,
    course_id: courseId,
    section_id: sectionId,
  });
  if (error && error.code !== "23505") {
    console.warn("course_progress insert:", error.message);
  }
}
