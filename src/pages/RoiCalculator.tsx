import { useState } from "react";
import SavedPresets from "../components/SavedPresets";
import { analyzeCashFlows, CashFlow } from "../lib/finance";
import { toCsv, downloadBlob } from "../lib/export";
const today = new Date().toISOString().slice(0, 10);
interface Row {
  date: string;
  asset: string;
  amount: string;
}
export default function RoiCalculator() {
  const [flows, setFlows] = useState<Row[]>([
    { date: today, asset: "", amount: "" },
    { date: today, asset: "", amount: "" },
  ]);
  const [discount, setDiscount] = useState("0");
  const [error, setError] = useState("");
  const parsed: CashFlow[] = flows.map((f) => ({
    ...f,
    amount: Number(f.amount),
  }));
  let result: ReturnType<typeof analyzeCashFlows> | null = null,
    validation = "";
  try {
    if (!discount.trim() || flows.some((f) => !f.amount.trim()))
      throw new Error("Enter each amount and a discount rate.");
    result = analyzeCashFlows(parsed, Number(discount));
  } catch (e) {
    validation = (e as Error).message;
  }
  function update(i: number, key: keyof Row, value: string) {
    setFlows((rows) =>
      rows.map((f, n) => (n === i ? { ...f, [key]: value } : f)),
    );
    setError("");
  }
  return (
    <section>
      <h2>ROI and Cash Flows</h2>
      <p>
        Compare stocks, property, companies and items in one scenario. Record
        investments, fees and ongoing costs as negative flows; income, sale
        proceeds or an explicitly estimated terminal value as positive flows.
        All amounts use whole Torn dollars. Saved scenarios preserve your
        assumptions.
      </p>
      <SavedPresets
        kind="roi"
        config={{ version: 1, flows, discount }}
        onLoad={(c) => {
          if (
            c?.version !== 1 ||
            !Array.isArray(c.flows) ||
            c.flows.length < 2 ||
            c.flows.length > 500 ||
            c.flows.some(
              (f: any) =>
                typeof f?.date !== "string" ||
                typeof f?.asset !== "string" ||
                typeof f?.amount !== "string",
            ) ||
            typeof c.discount !== "string"
          )
            throw new Error("Invalid ROI scenario");
          setFlows(c.flows);
          setDiscount(c.discount);
          setError("");
        }}
      />
      <label>
        Annual discount rate for NPV (%)
        <input
          className="nu-input"
          type="number"
          min="-99.99"
          max="10000"
          step="0.01"
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
        />
      </label>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Asset / investment</th>
              <th>Cash flow ($, signed)</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {flows.map((f, i) => (
              <tr key={i}>
                <td>
                  <input
                    aria-label={`Date ${i + 1}`}
                    className="nu-input"
                    type="date"
                    value={f.date}
                    onChange={(e) => update(i, "date", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    aria-label={`Asset ${i + 1}`}
                    className="nu-input"
                    maxLength={80}
                    value={f.asset}
                    onChange={(e) => update(i, "asset", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    aria-label={`Amount ${i + 1}`}
                    className="nu-input"
                    type="number"
                    step="1"
                    value={f.amount}
                    onChange={(e) => update(i, "amount", e.target.value)}
                  />
                </td>
                <td>
                  <button
                    className="nu-btn"
                    disabled={flows.length <= 2}
                    onClick={() =>
                      setFlows((rows) => rows.filter((_, n) => i !== n))
                    }
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        className="nu-btn"
        disabled={flows.length >= 500}
        onClick={() =>
          setFlows((rows) => [...rows, { date: today, asset: "", amount: "" }])
        }
      >
        Add cash flow
      </button>
      <button
        className="nu-btn"
        disabled={!result}
        onClick={() => {
          try {
            downloadBlob(
              new Blob([toCsv(parsed.map((f) => ({ ...f })))], {
                type: "text/csv",
              }),
              "roi-cash-flows.csv",
            );
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Export cash flows CSV
      </button>
      {(error || validation) && <p role="alert">{error || validation}</p>}
      {result && (
        <article className="card nu-raised">
          <h3>Scenario results</h3>
          <p>
            Total outflows ${result.invested.toLocaleString()} · total receipts
            / valuation ${result.returned.toLocaleString()} · net profit $
            {result.profit.toLocaleString()}
          </p>
          <p>
            Simple ROI {result.roi.toFixed(2)}% · NPV at {discount}%: $
            {result.npv.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          <p>
            {result.xirr === null
              ? result.xirrReason
              : `Dated annual return (XIRR): ${result.xirr.toFixed(2)}%`}
          </p>
          <p>
            First cash recovery:{" "}
            {result.recoveryDate ?? "Not reached in supplied flows"}. Later
            costs can reduce the balance again.
          </p>
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Outflows</th>
                <th>Receipts / valuation</th>
                <th>Profit</th>
              </tr>
            </thead>
            <tbody>
              {result.assets.map((a) => (
                <tr key={a.asset}>
                  <td>{a.asset}</td>
                  <td>${a.invested.toLocaleString()}</td>
                  <td>${a.returned.toLocaleString()}</td>
                  <td>${a.profit.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      )}
    </section>
  );
}
