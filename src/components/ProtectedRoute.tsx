import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Protects vendor routes (Dashboard, Profile, Sales, etc.).
 * - If not signed in → redirect to /auth with state.next = current path (so after login they return here).
 * - Same behavior in dev and production so UX is never "logged out but still on Profile".
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useSession();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-32" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ next: location.pathname }} replace />;
  }

  return <>{children}</>;
}
