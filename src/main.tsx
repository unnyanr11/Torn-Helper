import React,{useEffect,useState,type ComponentType} from "react";
import StartupExperience from "./components/StartupExperience";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ErrorBoundary from "./components/ErrorBoundary";
import "./styles.css";
import "./cosmic.css";
const root = createRoot(document.getElementById("root")!);
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60000, retry: 1, refetchOnWindowFocus: false },
  },
});
const appModule=import("./App");
function ApplicationBoot(){
 const [App,setApp]=useState<ComponentType|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{let alive=true;void appModule.then(module=>{if(alive)setApp(()=>module.default);}).catch(()=>{if(alive)setFailed(true);});return()=>{alive=false;};},[]);
 return <StartupExperience ready={!!App||failed}><ErrorBoundary><QueryClientProvider client={queryClient}>
  {App?<App/>:failed?<main className="card" role="alert"><h1>Application unavailable</h1><p>Reload to try opening your workspace again.</p><button className="nu-btn" onClick={()=>window.location.reload()}>Reload application</button></main>:<p className="boot-message" role="status">Opening your workspace…</p>}
 </QueryClientProvider></ErrorBoundary></StartupExperience>;
}
root.render(<React.StrictMode><ApplicationBoot/></React.StrictMode>);
