import { useState } from 'react';

export default function PiMortgages() {
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [years, setYears] = useState('');
  const [result, setResult] = useState<{ monthly: number; totalInterest: number; totalPaid: number } | null>(null);
  const [error, setError] = useState('');

  function calculate() {
    setError('');
    const p = parseFloat(principal);
    const annualRate = parseFloat(rate);
    const n = parseFloat(years) * 12;
    if (isNaN(p) || isNaN(annualRate) || isNaN(n) || p <= 0 || n <= 0 || annualRate < 0) {
      setError('Enter valid loan amount, interest rate, and term (years)');
      setResult(null);
      return;
    }
    const monthlyRate = annualRate / 100 / 12;
    const monthly = monthlyRate === 0 ? p / n : (p * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
    const totalPaid = monthly * n;
    setResult({ monthly, totalInterest: totalPaid - p, totalPaid });
  }

  return (
    <section>
      <h2>PI Mortgages</h2>
      <p className="muted">Calculate mortgage payments for property investments. Enter loan amount, annual interest rate, and term in years.</p>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>Inputs</h3>
        <label>Loan amount ($)<input className="nu-input" type="number" min="0" value={principal} onChange={(e) => setPrincipal(e.target.value)} /></label>
        <label>Annual interest rate (%)<input className="nu-input" type="number" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} /></label>
        <label>Term (years)<input className="nu-input" type="number" min="1" value={years} onChange={(e) => setYears(e.target.value)} /></label>
        <button className="nu-btn" onClick={calculate}>Calculate</button>
      </article>
      {result && (
        <article className="card nu-raised">
          <h3>Result</h3>
          <p>Monthly payment: <strong>${result.monthly.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></p>
          <p>Total interest: <strong>${result.totalInterest.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></p>
          <p>Total paid: <strong>${result.totalPaid.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></p>
        </article>
      )}
    </section>
  );
}
