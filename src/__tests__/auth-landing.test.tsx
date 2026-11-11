import {describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import AuthLanding from '../components/AuthLanding';
import Settings from '../pages/Settings';
import App from '../App';
vi.mock('../lib/supabase',()=>({supabase:{}}));
function render(children:React.ReactNode){const client=new QueryClient();try{return renderToStaticMarkup(<QueryClientProvider client={client}>{children}</QueryClientProvider>);}finally{client.clear();}}
describe('account access after startup',()=>{
 it('shows email login, signup access and Torn login without workspace navigation',()=>{
  const html=render(<AuthLanding><Settings entry/></AuthLanding>);
  expect(html).toContain('Log in or create an account');
  expect(html).toContain('Sign in with email');
  expect(html).toContain('Create account');
  expect(html).toContain('Continue with Torn');
  expect(html).toContain('autoComplete="current-password"');
  expect(html).not.toContain('Account &amp; privacy settings');
  expect(html).not.toContain('aria-label="Main"');
  expect(html).not.toContain('Find a tool');
 });
 it('keeps the dashboard shell unmounted until the session check completes',()=>{
  const html=render(<App/>);
  expect(html).toContain('auth-landing');
  expect(html).toContain('Checking session');
  expect(html).not.toContain('simple-navigation');
  expect(html).not.toContain('Find a tool');
 });
});
