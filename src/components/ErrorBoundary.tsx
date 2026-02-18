import React from "react";

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("App error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      const err = this.state.error;
      const isLocalhost = typeof window !== "undefined" && /localhost|127\.0\.0\.1/.test(window.location?.host ?? "");
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
            background: "#f8fafc",
            maxWidth: 480,
            margin: "0 auto",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>Something went wrong</h1>
          {err?.message && (
            <p style={{ color: "#dc2626", fontSize: "0.875rem", marginBottom: 12, wordBreak: "break-word" }}>
              {err.message}
            </p>
          )}
          <div style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: 16, textAlign: "left" }}>
            {isLocalhost ? (
              <>
                <p style={{ marginBottom: 8 }}><strong>Local dev checklist:</strong></p>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>Create <code>.env</code> in project root with <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (from Supabase → Project Settings → API).</li>
                  <li>Restart dev server after changing <code>.env</code> (<code>npm run dev</code>).</li>
                  <li>In Supabase: Authentication → URL Configuration → add <strong>Site URL</strong> and <strong>Redirect URLs</strong>: <code>http://localhost:8080</code> and <code>http://localhost:8080/**</code>.</li>
                </ul>
              </>
            ) : (
              <>
                <p style={{ marginBottom: 8 }}>If you just deployed to Vercel, add <strong>VITE_SUPABASE_URL</strong> and <strong>VITE_SUPABASE_ANON_KEY</strong> in Project Settings → Environment Variables, then redeploy.</p>
                <p style={{ margin: 0 }}>In Supabase add your live URL (e.g. https://haathpe.com) under Authentication → URL Configuration → Redirect URLs.</p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 16px",
              background: "#1e40af",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
