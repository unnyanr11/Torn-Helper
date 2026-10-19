import { useEffect, useState } from "react";

export default function PublicApi() {
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    setBaseUrl(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api`);
  }, []);

  return (
    <section>
      <h2>Public API</h2>
      <p className="muted">
        Read-only, keyless JSON API served by the public-api Edge Function.
        CORS-enabled for any origin.
      </p>
      <article className="card nu-inset">
        <h3>Base URL</h3>
        <code>
          {baseUrl || "Deploy the public-api function to get the base URL"}
        </code>
      </article>
      <article className="card nu-inset">
        <h3>Endpoints</h3>
        <ul>
          <li>
            <code>GET /glossary</code> — returns the Tornipedia glossary as
            JSON.
          </li>
          <li>
            <code>GET /capabilities</code> — returns the list of app
            capabilities.
          </li>
          <li>
            <code>GET /</code> — API info and endpoint list.
          </li>
        </ul>
      </article>
      <article className="card nu-inset">
        <h3>Example</h3>
        <code>curl {baseUrl}/glossary</code>
      </article>
    </section>
  );
}
