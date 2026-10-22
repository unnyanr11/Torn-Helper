import { recordChoices } from "../lib/entry-options";
import DataEntry from "../components/DataEntry";
import SelectEntry from "../components/SelectEntry";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface WatchItem {
  id: string;
  item_id: string;
  item_name: string | null;
  threshold_price: string | null;
}

export default function Markets() {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [itemId, setItemId] = useState("");
  const [itemName, setItemName] = useState("");
  const [threshold, setThreshold] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("watchlists")
      .select("*")
      .order("created_at");
    if (error) setError(error.message);
    else setItems(data ?? []);
  }

  async function addItem() {
    if (!itemId.trim()) {
      setError("Enter an item ID");
      return;
    }
    const { error } = await supabase.from("watchlists").insert({
      item_id: itemId.trim(),
      item_name: itemName.trim() || null,
      threshold_price: threshold || null,
    });
    if (error) setError(error.message);
    else {
      setItemId("");
      setItemName("");
      setThreshold("");
      load();
    }
  }

  async function removeItem(id: string) {
    const { error } = await supabase.from("watchlists").delete().eq("id", id);
    if (error) setError(error.message);
    else load();
  }

  return (
    <section>
      <h2>Markets</h2>
      <p className="muted">
        Watchlist with manual price thresholds. Use the official Torn data link
        above for market listings and prices. Historical price charts require
        collected observations.
      </p>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>Add watchlist item</h3>
        <DataEntry options={recordChoices(items,'item_id','item_name',false)} source="item" onNameChange={setItemName} type="number" min="1" step="1"
          className="nu-input"
          placeholder="Torn item ID"
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
        />
        <DataEntry options={recordChoices(items,'item_id','item_name',true)} source="itemName"
          className="nu-input"
          placeholder="Item name (optional)"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
        />
        <SelectEntry kind="money" type="number" step="any"
          className="nu-input"
          placeholder="Alert threshold price (optional)"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
        />
        <button className="nu-btn" onClick={addItem}>
          Add to watchlist
        </button>
      </article>
      <div className="grid">
        {items.map((i) => (
          <article key={i.id} className="card nu-raised">
            <h3>{i.item_name ?? `Item ${i.item_id}`}</h3>
            <p className="muted">ID: {i.item_id}</p>
            {i.threshold_price && (
              <p className="muted">Threshold: {i.threshold_price}</p>
            )}
            <button className="nu-btn" onClick={() => removeItem(i.id)}>
              Remove
            </button>
          </article>
        ))}
        {items.length === 0 && <p className="muted">Watchlist is empty.</p>}
      </div>
    </section>
  );
}
