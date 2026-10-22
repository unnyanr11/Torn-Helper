import ChoiceInput from "../components/ChoiceInput";
import { useTornChoices } from "../hooks/useTornChoices";
import { catalogueChoices } from "../lib/torn-choices";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface Observation {
  id: string;
  destination: string;
  item_name: string | null;
  price: string | null;
  observed_at: string;
}

const DESTINATIONS = [
  "Mexico",
  "Cayman Islands",
  "Canada",
  "Hawaii",
  "United Kingdom",
  "Argentina",
  "Switzerland",
  "Japan",
  "China",
  "UAE",
  "South Africa",
];

export default function Travel() {
  const choices = useTornChoices();
  const [obs, setObs] = useState<Observation[]>([]);
  const [destination, setDestination] = useState(DESTINATIONS[0]);
  const [itemName, setItemName] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("travel_observations")
      .select("*")
      .order("observed_at", { ascending: false })
      .limit(50);
    if (error) setError(error.message);
    else setObs(data ?? []);
  }

  async function addObservation() {
    if (!itemName.trim() || !price) {
      setError("Enter item and price");
      return;
    }
    const { error } = await supabase
      .from("travel_observations")
      .insert({ destination, item_name: itemName.trim(), price });
    if (error) setError(error.message);
    else {
      setItemName("");
      setPrice("");
      load();
    }
  }

  return (
    <section>
      <h2>Travel</h2>
      <p className="muted">
        Manual price observations. Your current travel information is available
        through the official Torn data link above. Foreign-stock forecasts
        require an additional verified data source.
      </p>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>Log a price observation</h3>
        <select
          className="nu-input"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
        >
          {DESTINATIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <ChoiceInput label="Item" value={itemName} onChange={setItemName} options={catalogueChoices(choices.data??[],"/torn/items","items",true)} required/>
        <input
          className="nu-input"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <button className="nu-btn" onClick={addObservation}>
          Log observation
        </button>
      </article>
      <article className="card nu-raised">
        <h3>Recent observations</h3>
        <table>
          <thead>
            <tr>
              <th>Destination</th>
              <th>Item</th>
              <th>Price</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {obs.map((o) => (
              <tr key={o.id}>
                <td>{o.destination}</td>
                <td>{o.item_name ?? "—"}</td>
                <td>{o.price ?? "—"}</td>
                <td>{new Date(o.observed_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {obs.length === 0 && <p className="muted">No observations yet.</p>}
      </article>
    </section>
  );
}
