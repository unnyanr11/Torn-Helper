import { useMemo } from 'react';
import { useItemCatalogue } from './useItemCatalogue';
import { useCurrentObservations } from './useSavedObservations';
import type { CachedChoiceRow } from '../lib/torn-choices';
export function useTornChoices() {
 const permanent=useItemCatalogue(),recent=useCurrentObservations();
 const rows=useMemo(():CachedChoiceRow[]=>Object.values(recent.data??{}).flatMap(entry=>entry.observation?[{endpoint_id:entry.observation.endpoint_id,payload:entry.observation.payload,fetched_at:entry.observation.fetched_at}]:[]).sort((a,b)=>Date.parse(b.fetched_at!)-Date.parse(a.fetched_at!)),[recent.data]);
 const data=useMemo(()=>permanent.data?.items.length?[{endpoint_id:'v2-torn-items',payload:{items:permanent.data.items},fetched_at:permanent.data.fetched_at??undefined},...rows]:rows,[permanent.data,rows]);
 return {...recent,entries:recent.data??{},data,isError:recent.isError&&!permanent.data?.items.length||permanent.isError&&!rows.length};
}
