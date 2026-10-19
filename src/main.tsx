import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ErrorBoundary from "./components/ErrorBoundary";
import "./styles.css";
const root = createRoot(document.getElementById("root")!);
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60000, retry: 1, refetchOnWindowFocus: false },
  },
});
root.render(<p role="status">Loading application…</p>);
void import("./App")
  .then(({ default: App }) =>
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </ErrorBoundary>
      </React.StrictMode>,
    ),
  )
  .catch(() =>
    root.render(
      <main className="card" role="alert">
        <h1>Application unavailable</h1>
        <p>
          Reload the page. If this continues, verify the Supabase URL and
          publishable key in the hosting environment, then redeploy.
        </p>
        <button className="nu-btn" onClick={() => window.location.reload()}>
          Reload
        </button>
      </main>,
    ),
  );
