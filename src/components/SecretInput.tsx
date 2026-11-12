import { useId, useState, type InputHTMLAttributes } from 'react';
import './secret-input.css';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string };

export default function SecretInput({ label, id, value, ...props }: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  // Clearing a submitted secret also resets visibility before another is entered.
  const hasValue = Boolean(value);
  const [hadValue, setHadValue] = useState(hasValue);
  if (hasValue !== hadValue) {
    setHadValue(hasValue);
    if (!hasValue) setVisible(false);
  }
  const action = `${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`;
  return <div className="secret-field">
    <label htmlFor={inputId}>{label}</label>
    <span className="secret-input">
      <input {...props} id={inputId} value={value} type={visible ? 'text' : 'password'} />
      <button className="secret-toggle" type="button" aria-label={action}
        aria-controls={inputId} aria-pressed={visible} title={action}
        disabled={props.disabled} onClick={() => setVisible(current => !current)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="m3 3 18 18" />}
        </svg>
      </button>
    </span>
  </div>;
}
