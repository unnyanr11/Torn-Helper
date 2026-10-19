import registry from "./verified-stats.json";
export interface StatMetric {id:string;name:string;category:string;unit:string;description:string;source:string;sourceField:string}
export const STATS_CATALOG:StatMetric[]=registry.metrics;
export const STAT_CATEGORIES=[...new Set(STATS_CATALOG.map(m=>m.category))];
export const VERIFIED_METRIC_COUNT=STATS_CATALOG.length;
