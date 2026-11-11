import type { ReactNode } from 'react';
import './auth-landing.css';

export default function AuthLanding({children}:{children:ReactNode}) {
 return <div className="auth-landing">
  <div className="auth-glow" aria-hidden="true"/>
  <header className="auth-brand"><span className="galaxy-mark" aria-hidden="true">T<span>.</span></span><span>Torn Helper<small>YOUR PERSONAL COMMAND CENTER</small></span></header>
  <main className="auth-content" id="account-access" tabIndex={-1}>{children}</main>
  <footer className="auth-footer">Your Torn tools. One account.</footer>
 </div>;
}
