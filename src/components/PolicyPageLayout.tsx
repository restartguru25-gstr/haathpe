import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const LEGAL_ENTITY = "DOCILE ONLINE MART PRIVATE LIMITED";

interface PolicyPageLayoutProps {
  title: string;
  children: React.ReactNode;
}

export default function PolicyPageLayout({ title, children }: PolicyPageLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <div className="container max-w-3xl px-4 py-8 flex-1">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft size={18} /> Back to home
        </Link>
        <article className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border bg-muted/30">
            <h1 className="text-xl font-bold tracking-tight">{title}</h1>
            <p className="text-xs text-muted-foreground mt-1">{LEGAL_ENTITY}</p>
          </div>
          <div className="p-6 prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
            {children}
          </div>
        </article>
      </div>
    </div>
  );
}
