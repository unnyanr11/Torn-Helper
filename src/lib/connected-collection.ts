import { mergeRequests, relatedRequests, type ConnectedRequest } from './connected-data';
import { observationKey, type TornObservation } from './personal-data';
export type SectionResult = { observation?: TornObservation; error?: string; status?: number };
export async function collectConnected(options: {
  requests: ConnectedRequest[]; areas: string[]; signal: AbortSignal;
  fetch: (row: ConnectedRequest) => Promise<SectionResult>;
  pause: (ms: number, signal: AbortSignal) => Promise<void>;
  onResult: (row: ConnectedRequest, result: SectionResult) => void;
  onDiscover: (rows: ConnectedRequest[]) => void;
  onProgress: (done: number, total: number, message: string) => void;
}) {
  const queue = mergeRequests(options.requests), seen = new Set(queue.map(r => observationKey(r.capability.id, r.parameters)));
  let done = 0, expanded = 0;
  for (let index = 0; index < queue.length && !options.signal.aborted; index++) {
    const row = queue[index];
    options.onProgress(done, queue.length, `Loading ${row.label}…`);
    let result = await options.fetch(row);
    if (options.signal.aborted) break;
    if (result.status === 429) {
      options.onProgress(done, queue.length, 'Request limit reached. Resuming after a 65-second cooldown…');
      await options.pause(65000, options.signal);
      if (options.signal.aborted) break;
      result = await options.fetch(row);
      if (options.signal.aborted) break;
    }
    options.onResult(row, result);
    if (result.error && ([401,409,429,503].includes(result.status ?? 0) || /no key|encryption|identity|sign.?in|tracking is paused/i.test(result.error))) throw new Error(result.error);
    if (result.observation) {
      const related = relatedRequests(row, result.observation.payload).filter(r => r.areas.some(a => options.areas.includes(a)));
      options.onDiscover(related);
      // Bound automatic expansion. Every related record remains available through UI links.
      for (const child of related.slice(0, row.capability.path === '/torn/crimes' ? 100 : 20)) {
        const id = observationKey(child.capability.id, child.parameters);
        if (seen.has(id) || expanded >= 120) continue;
        seen.add(id); queue.push(child); expanded++;
      }
    }
    done++;
    options.onProgress(done, queue.length, `${done} of ${queue.length} queued sections checked.`);
    if (index + 1 < queue.length) await options.pause(3400, options.signal);
  }
  return { done, total: queue.length, stopped: options.signal.aborted };
}
