import { useSession } from "@/contexts/AuthContext";

export function useAdmin(): { isAdmin: boolean; isLoading: boolean } {
  const { profile, isLoading } = useSession();
  const isAdmin = (profile as { role?: string } | null)?.role === "admin";
  return { isAdmin, isLoading };
}
