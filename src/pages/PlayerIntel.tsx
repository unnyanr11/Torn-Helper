import ChoiceInput from "../components/ChoiceInput";
import { useTornChoices } from "../hooks/useTornChoices";
import { observedChoices } from "../lib/entry-options";
import { functionError } from "../lib/function-error";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
export default function PlayerIntel() {
  const choices = useTornChoices();
  const preset =
    new URLSearchParams(location.hash.split("?")[1] ?? "").get("player") ?? "";
  const [input, setInput] = useState(preset),
    [player, setPlayer] = useState(/^[1-9]\d*$/.test(preset) ? preset : "");
  const query = useQuery({
    queryKey: ["player", player],
    enabled: !!player,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("player-intel", {
        body: { player_id: Number(player) },
      });
      if (error || data?.error) throw await functionError(data, error);
      return data;
    },
  });
  const p = query.data?.profile;
  return (
    <section>
      <h2>Player Intel</h2>
      <p>
        Public profiles from Torn. Private battle stats are unknown unless you
        have authorized evidence.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (/^[1-9]\d*$/.test(input)) setPlayer(input);
        }}
      >
        <ChoiceInput label="Player" value={input} onChange={setInput} options={observedChoices(choices.data??[],"player")} inputMode="numeric" required/>
        <button className="nu-btn">Look up player</button>
      </form>
      {query.isFetching && <p>Loading profile…</p>}
      {query.error && <p role="alert">{query.error.message}</p>}
      {p && (
        <article className="card">
          <h3>
            {p.name} [{p.id}]
          </h3>
          <p>
            Level {p.level} · {p.status?.state} · Faction{" "}
            {p.faction_id ?? "none"}
          </p>
          <p>Last action: {p.last_action?.status ?? "unknown"}</p>
          <p>
            Source: {query.data.source} · Updated:{" "}
            {new Date(query.data.observed_at).toLocaleString()} · Needs: Public
            Only ·{" "}
            {Date.now() - Date.parse(query.data.observed_at) > 60000
              ? "Stale"
              : "Recent observation"}
          </p>

          <button
            className="nu-btn"
            disabled={query.isFetching}
            onClick={() => query.refetch()}
          >
            Refresh observation
          </button>
        </article>
      )}
    </section>
  );
}
