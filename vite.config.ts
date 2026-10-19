import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { validateClientConfig } from './src/lib/config';
export default defineConfig(({command,mode})=>{
 if(command==='build'){
  const env=loadEnv(mode,process.cwd(),'VITE_');
  validateClientConfig(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY,true);
 }
 return {plugins:[react()],base:'/'};
});
