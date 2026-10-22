import DataEntry from "../components/DataEntry";
import SelectEntry from "../components/SelectEntry";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { amortize, MortgageTerms } from "../lib/finance";
import { toCsv, downloadBlob } from "../lib/export";
function exportCSV(rows: Record<string, unknown>[], name: string) {
  downloadBlob(new Blob([toCsv(rows)], { type: "text/csv" }), name + ".csv");
}
const money = (n: number) => "$" + Number(n).toLocaleString();
export default function PiMortgages() {
  const client = useQueryClient();
  const [principal, setPrincipal] = useState(""),
    [rate, setRate] = useState(""),
    [months, setMonths] = useState(""),
    [firstDue, setFirstDue] = useState(new Date().toISOString().slice(0, 10));
  const [borrower, setBorrower] = useState(""),
    [tornId, setTornId] = useState(""),
    [notes, setNotes] = useState(""),
    [selected, setSelected] = useState("");
  const [amount, setAmount] = useState(""),
    [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10)),
    [reference, setReference] = useState(""),
    [reason, setReason] = useState("");
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const terms: MortgageTerms = {
    principal: Number(principal),
    annualBps: Math.round(Number(rate) * 100),
    months: Number(months),
    firstDue,
  };
  let preview: ReturnType<typeof amortize> = [],
    previewError = "";
  try {
    if (
      !rate.trim() ||
      !principal.trim() ||
      !months.trim() ||
      !Number.isFinite(Number(rate)) ||
      Math.abs(Number(rate) * 100 - terms.annualBps) > 0.00001
    )
      throw new Error("Enter a rate with at most two decimals.");
    preview = amortize(terms);
  } catch (e) {
    previewError =
      !principal.trim() && !rate.trim() && !months.trim()
        ? "Enter your principal, annual rate and term to preview repayments."
        : (e as Error).message;
  }
  const agreements = useQuery({
    queryKey: ["mortgages"],
    queryFn: async () => {
      const r = await supabase
        .from("mortgage_agreements")
        .select("*")
        .order("created_at", { ascending: false });
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const detail = useQuery({
    queryKey: ["mortgage-detail", selected],
    enabled: !!selected,
    queryFn: async () => {
      const responses = await Promise.all([
        supabase
          .from("mortgage_installments")
          .select("*")
          .eq("agreement_id", selected)
          .order("installment_number"),
        supabase
          .from("mortgage_payments")
          .select("*")
          .eq("agreement_id", selected)
          .order("recorded_at", { ascending: false }),
        supabase
          .from("mortgage_events")
          .select("*")
          .eq("agreement_id", selected)
          .order("created_at", { ascending: false }),
      ]);
      for (const r of responses) if (r.error) throw r.error;
      return {
        schedule: responses[0].data!,
        payments: responses[1].data!,
        events: responses[2].data!,
      };
    },
  });
  async function action(
    name: string,
    params: Record<string, unknown>,
    after?: () => void,
  ) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await supabase.rpc(name, params);
      if (r.error) throw r.error;
      if (name === "apply_mortgage") setSelected(r.data);
      after?.();
      await Promise.all([
        client.invalidateQueries({ queryKey: ["mortgages"] }),
        client.invalidateQueries({ queryKey: ["mortgage-detail"] }),
      ]);
      setNotice("Saved.");
    } catch (e) {
      setError((e as any).message ?? "Request failed");
    } finally {
      setBusy(false);
    }
  }
  const current = agreements.data?.find((m) => m.id === selected),
    schedule = detail.data?.schedule ?? [],
    today = new Date().toISOString().slice(0, 10);
  const total = schedule.reduce((s, r) => s + Number(r.amount), 0),
    paid = schedule.reduce((s, r) => s + Number(r.paid), 0),
    arrears = schedule
      .filter((r) => r.due_date < today)
      .reduce((s, r) => s + Number(r.amount) - Number(r.paid), 0);
  const visibleError =
    error ||
    (agreements.error as any)?.message ||
    (detail.error as any)?.message;
  return (
    <section>
      <h2>PI Mortgages</h2>
      <p>
        Private application and agreement records for your own bookkeeping.
        Activating an agreement records your review; counterparty acceptance and
        Torn transfers are not verified. Fixed monthly interest is rounded to
        whole dollars. Payments cover the fixed schedule in order; there are no
        prepayment discounts or late fees.
      </p>
      {visibleError && <p role="alert">{visibleError}</p>}
      {notice && <p role="status">{notice}</p>}
      <article className="card nu-inset">
        <h3>Application and repayment preview</h3>
        <label>
          Borrower name
          <DataEntry source="playerName" label="Borrower"
            className="nu-input"
            value={borrower}
            maxLength={80}
            onChange={(e) => setBorrower(e.target.value)}
          />
        </label>
        <label>
          Borrower Torn ID (optional)
          <DataEntry source="player" label="Borrower Torn ID" onNameChange={setBorrower}
            className="nu-input"
            type="number"
            min="1"
            value={tornId}
            onChange={(e) => setTornId(e.target.value)}
          />
        </label>
        <label>
          Principal ($)
          <SelectEntry kind="money" label="Principal ($)"
            className="nu-input"
            type="number"
            min="1"
            max="1000000000000"
            step="1"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
          />
        </label>
        <label>
          Annual rate (%)
          <SelectEntry kind="percent" label="Annual interest rate (%)"
            className="nu-input"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </label>
        <label>
          Term (months)
          <SelectEntry kind="months" label="Term (months)"
            className="nu-input"
            type="number"
            min="1"
            max="600"
            value={months}
            onChange={(e) => setMonths(e.target.value)}
          />
        </label>
        <label>
          First payment due
          <input
            className="nu-input"
            type="date"
            value={firstDue}
            onChange={(e) => setFirstDue(e.target.value)}
          />
        </label>
        <label>
          Agreement notes
          <textarea
            className="nu-input"
            maxLength={4000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        {previewError ? (
          <p>{previewError}</p>
        ) : (
          <p>
            First installment {money(preview[0].amount)} · total interest{" "}
            {money(preview.reduce((s, r) => s + r.interest, 0))} · total
            repayable {money(preview.reduce((s, r) => s + r.amount, 0))}. Final
            installment adjusts rounding.
          </p>
        )}
        <button
          className="nu-btn"
          disabled={
            busy ||
            !!previewError ||
            !borrower.trim() ||
            (!!tornId &&
              (!Number.isSafeInteger(Number(tornId)) || Number(tornId) <= 0))
          }
          onClick={() =>
            action("apply_mortgage", {
              borrower: borrower.trim(),
              torn_id: tornId ? Number(tornId) : null,
              requested_principal: terms.principal,
              rate_bps: terms.annualBps,
              term_months: terms.months,
              first_payment: firstDue,
              memo: notes,
            })
          }
        >
          Save application
        </button>
        <details>
          <summary>Preview installments ({preview.length})</summary>
          <Schedule
            rows={preview.map((r) => ({
              installment_number: r.number,
              due_date: r.due,
              principal: r.principal,
              interest: r.interest,
              amount: r.amount,
              balance: r.balance,
              paid: 0,
            }))}
          />
        </details>
      </article>
      <article className="card nu-raised">
        <h3>Applications and agreements</h3>
        {agreements.isLoading ? (
          <p>Loading…</p>
        ) : !agreements.data?.length ? (
          <p>No applications yet.</p>
        ) : (
          <label>
            Agreement
            <select
              className="nu-input"
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setError("");
                setNotice("");
              }}
            >
              <option value="">Select an agreement</option>
              {agreements.data.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.borrower_name} · {money(m.principal)} · {m.status} ·{" "}
                  {m.created_at.slice(0, 10)}
                </option>
              ))}
            </select>
          </label>
        )}
        {current && (
          <>
            <p>
              {current.borrower_name}{" "}
              {current.borrower_torn_id && `[${current.borrower_torn_id}]`} ·{" "}
              {current.annual_bps / 100}% · {current.months} months ·{" "}
              {current.status}
            </p>
            <p>{current.notes}</p>
            {current.status === "application" && (
              <>
                <p>
                  Review these terms before activation. The server then freezes
                  the repayment schedule.
                </p>
                {["active", "declined", "cancelled"].map((decision) => (
                  <button
                    className="nu-btn"
                    key={decision}
                    disabled={busy}
                    onClick={() =>
                      action("decide_mortgage", {
                        agreement: current.id,
                        decision,
                      })
                    }
                  >
                    {decision === "active"
                      ? "Activate reviewed agreement"
                      : decision === "declined"
                        ? "Decline application"
                        : "Cancel application"}
                  </button>
                ))}
              </>
            )}
            {detail.isLoading && <p>Loading schedule…</p>}
            {schedule.length > 0 && (
              <>
                <p>
                  Total scheduled {money(total)} · recorded paid {money(paid)} ·
                  outstanding {money(total - paid)} · overdue before today{" "}
                  {money(arrears)}
                </p>
                <button
                  className="nu-btn"
                  onClick={() =>
                    exportCSV(
                      schedule.map((r) => ({
                        installment: r.installment_number,
                        due: r.due_date,
                        principal: r.principal,
                        interest: r.interest,
                        amount: r.amount,
                        paid: r.paid,
                        outstanding: Number(r.amount) - Number(r.paid),
                      })),
                      "mortgage-schedule",
                    )
                  }
                >
                  Export schedule CSV
                </button>
                <Schedule rows={schedule} />
              </>
            )}
            {current.status === "active" && (
              <fieldset>
                <legend>Record a payment manually</legend>
                <label>
                  Amount ($)
                  <SelectEntry kind="money" label="Payment amount ($)"
                    className="nu-input"
                    type="number"
                    min="1"
                    max={total - paid}
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <label>
                  Payment date
                  <input
                    className="nu-input"
                    type="date"
                    value={paidOn}
                    onChange={(e) => setPaidOn(e.target.value)}
                  />
                </label>
                <label>
                  Unique receipt/reference
                  <input
                    className="nu-input"
                    maxLength={120}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </label>
                <button
                  className="nu-btn"
                  disabled={
                    busy ||
                    !Number.isSafeInteger(Number(amount)) ||
                    Number(amount) <= 0 ||
                    !reference.trim() ||
                    !paidOn
                  }
                  onClick={() =>
                    action(
                      "record_mortgage_payment",
                      {
                        agreement: current.id,
                        payment_amount: Number(amount),
                        payment_date: paidOn,
                        payment_reference: reference.trim(),
                      },
                      () => {
                        setAmount("");
                        setReference("");
                      },
                    )
                  }
                >
                  Record payment
                </button>
              </fieldset>
            )}
            {!!detail.data?.payments.length && (
              <>
                <h4>Payment history</h4>
                <label>
                  Correction reason (required to void)
                  <input
                    className="nu-input"
                    value={reason}
                    maxLength={1000}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                {detail.data.payments.map((p) => (
                  <p key={p.id}>
                    {p.paid_on} · {money(p.amount)} · {p.reference} ·{" "}
                    {p.voided_at ? (
                      `Voided: ${p.void_reason}`
                    ) : (
                      <button
                        className="nu-btn"
                        disabled={busy || !reason.trim()}
                        onClick={() =>
                          action(
                            "void_mortgage_payment",
                            { payment: p.id, reason: reason.trim() },
                            () => setReason(""),
                          )
                        }
                      >
                        Void and retain audit record
                      </button>
                    )}
                  </p>
                ))}
              </>
            )}
            <details>
              <summary>Audit trail</summary>
              {detail.data?.events.map((e) => (
                <p key={e.id}>
                  {new Date(e.created_at).toLocaleString()} · {e.action} ·{" "}
                  {JSON.stringify(e.details)}
                </p>
              ))}
            </details>
          </>
        )}
      </article>
    </section>
  );
}
function Schedule({ rows }: { rows: any[] }) {
  return (
    <div style={{ overflowX: "auto", maxHeight: 420 }}>
      <table>
        <thead>
          <tr>
            {[
              "#",
              "Due",
              "Principal",
              "Interest",
              "Payment",
              "Recorded paid",
              "Outstanding",
              "Principal balance",
            ].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.installment_number}>
              <td>{r.installment_number}</td>
              <td>{r.due_date}</td>
              <td>{money(r.principal)}</td>
              <td>{money(r.interest)}</td>
              <td>{money(r.amount)}</td>
              <td>{money(r.paid)}</td>
              <td>{money(Number(r.amount) - Number(r.paid))}</td>
              <td>{money(r.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
