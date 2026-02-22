import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import MakeInIndiaFooter from "@/components/MakeInIndiaFooter";
import { Button } from "@/components/ui/button";
import BackButton from "@/components/BackButton";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-muted">
      <header className="sticky top-0 z-50 flex h-14 items-center border-b border-border/50 bg-background/95 backdrop-blur-md px-4">
        <BackButton fallbackTo="/" />
      </header>
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-4">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="text-xl text-muted-foreground">Oops! Page not found</p>
        <Link to="/">
          <Button variant="default">Return to Home</Button>
        </Link>
      </div>
      <MakeInIndiaFooter />
    </div>
  );
};

export default NotFound;
