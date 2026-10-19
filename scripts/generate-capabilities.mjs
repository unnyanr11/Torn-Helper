// Generates src/api/generated-capabilities.json from Torn's official OpenAPI spec.
// Run: node scripts/generate-capabilities.mjs
// The official spec URL is https://www.torn.com/swagger/openapi.json
import { writeFileSync, mkdirSync } from 'node:fs';

const SPEC_URL = 'https://www.torn.com/swagger/openapi.json';
const OUT = 'src/api/generated-capabilities.json';

const res = await fetch(SPEC_URL, { headers: { 'User-Agent': 'TornCommandCenter/0.1 (capability registry generator)' } });
if (!res.ok) throw new Error(`Failed to fetch spec: ${res.status} ${res.statusText}`);
const spec = await res.json();

const entries = [];
for (const [path, methods] of Object.entries(spec.paths ?? {})) {
  for (const [method, op] of Object.entries(methods)) {
    if (method !== 'get') continue;
    const params = (op.parameters ?? []).map((p) => p.name).filter(Boolean);
    const tag = (op.tags ?? ['other'])[0];
    entries.push({
      id: `v2-${path.replaceAll('/', '-').replace(/^-|-$/g, '')}`,
      version: 'v2',
      method: 'GET',
      path,
      group: tag,
      summary: op.summary ?? op.description ?? '',
      queryParams: params,
      requiredAccess: 'verify-in-ui',
      privacy: 'verify-in-ui',
      pagination: params.includes('from') || params.includes('to') ? 'from-to' : params.includes('limit') ? 'limit-offset' : 'none',
      cacheSeconds: 0,
      refresh: 'manual',
      features: [],
      source: 'official API',
      verified: false,
      verificationNote: 'Generated from official OpenAPI spec; access level, privacy scope, cache and feature mapping require review before enabling.'
    });
  }
}

mkdirSync('src/api', { recursive: true });
writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), specUrl: SPEC_URL, count: entries.length, capabilities: entries }, null, 2));
console.log(`Wrote ${entries.length} capabilities to ${OUT}`);
