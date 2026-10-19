import { useState } from 'react';

export default function RoiCalculator() {
  const [cost, setCost] = useState('');
  const [returnValue, setReturnValue] = useState('');
  const [days, setDays] = useState('');
  const [result, setResult] = useState<{ roi: number; annualized: number; profit: number } | null>(null);
  const [error, setError] = useState('');

  function calculate() {
    setError('');
    const c = parseFloat(cost);
    const r = parseFloat(returnValue);
    const d = parseFloat(days);
    if (isNaN(c) || isNaN(r) || isNaN(d) || c <= 0 || d <= 0) {
      setError('Enter valid positive numbers for cost, return, and duration (days)');
      setResult(null);
      return;
    }
    const profit = r - c;
    const roi = (profit / c) * 100;
    const annualized = ((1 + profit / c) ** (365 / d) - 1) * 100;
    setResult({ roi, annualized, profit });
  }

  return (
    <section>
      <h2>ROI Calculator</h2>
      <p className="muted">Calculate return on investment for any purchase (stocks, property, company upgrades, items). Enter total cost, expected total return, and holding duration in days.</p>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset">
        <h3>Inputs</h3>
        <label>Total cost ($)<input className="nu-input" type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} /></label>
        <label>Expected total return ($)<input className="nu-input" type="number" min="0" value={returnValue} onChange={(e) => setReturnValue(e.target.value)} /></label>
        <label>Duration (days)<input className="nu-input" type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} /></label>
        <button className="nu-btn" onClick={calculate}>Calculate</button>
      </article>
      {result && (
        <article className="card nu-raised">
          <h3>Result</h3>
          <p>Profit: <strong>${result.profit.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></p>
          <p>ROI: <strong>{result.roi.toFixed(2)}%</strong></p>
          <p>Annualized ROI: <strong>{result.annualized.toFixed(2)}%</strong></p>
          <p className="muted">Break-even occurs when total return equals total cost (${parseFloat(cost).toLocaleString()}).</p>
        </article>
      )}
    </section>
  );
}
