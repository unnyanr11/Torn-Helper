import { functionError } from "../lib/function-error";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
export default function SharedReport({ token }: { token: string }) {
  const query = useQuery({
    queryKey: ["shared-report", token],
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 30000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("shared-report", {
        body: { token },
      });
      if (error || data?.error)
        throw await functionError(data, error, "Report unavailable or expired");
      return data;
    },
  });
  if (query.error)
    return (
      <section>
        <h2>Shared report unavailable</h2>
        <p role="alert">{query.error.message}</p>
      </section>
    );
  if (!query.data) return <p>Loading shared snapshot…</p>;
  return (
    <section>
      <h2>{query.data.title}</h2>
      <p>
        Source: {query.data.source} · Created:{" "}
        {new Date(query.data.created_at).toLocaleString()} · Link expiry:{" "}
        {new Date(query.data.expires_at).toLocaleString()}
      </p>
      <p>This is a saved snapshot, not live game data.</p>
      <pre>{JSON.stringify(query.data.data, null, 2)}</pre>
    </section>
  );
}
