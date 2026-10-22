import type { QueryClient } from '@tanstack/react-query';
export type TornResult={data:any;error:any};
export type PendingRequest={controller:AbortController;promise:Promise<TornResult>;users:number};
export const pendingTornRequests=new WeakMap<QueryClient,Map<string,PendingRequest>>();
/** Lightweight auth cleanup; importing this must not load the endpoint catalogue. */
export function cancelTornRequests(client:QueryClient){
 const jobs=pendingTornRequests.get(client);for(const job of jobs?.values()??[])job.controller.abort();jobs?.clear();
}
