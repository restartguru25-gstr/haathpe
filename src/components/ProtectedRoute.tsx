import { Link, Navigate, useLocation } from "react-router-dom";
import { useSession } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const isDev = import.meta.env.DEV;

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

  // In production, require sign-in
  if (!isDev && !isAuthenticated) {
    return <Navigate to="/auth" state={{ next: location.pathname }} replace />;
  }

  // In development: allow viewing without sign-in (mock data will be used)
  return (
    <>
      {isDev && !isAuthenticated && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-500/90 px-3 py-1.5 text-center text-xs font-medium text-black">
          Viewing as guest (dev only). <Link to="/auth" className="underline">Sign in / Sign up</Link> for real data.
        </div>
      )}
      {children}
    </>
  );
}
