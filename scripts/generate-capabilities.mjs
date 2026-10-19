import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
const specUrl = "https://www.torn.com/swagger/openapi.json";
const input = process.argv[2];
const spec = input
  ? JSON.parse(readFileSync(input, "utf8"))
  : await (
      await fetch(specUrl, {
        headers: { "User-Agent": "TornCommandCenter/1.0 capability-registry" },
      })
    ).json();
const resolve = (p) =>
  p.$ref
    ? p.$ref
        .split("/")
        .slice(1)
        .reduce((node, key) => node[key], spec)
    : p;
const levels = {
  public: "Public Only",
  minimal: "Minimal Access",
  limited: "Limited Access",
  full: "Full Access",
  custom: "Custom",
};
const features = {
  user: ["overview", "planner", "targets"],
  faction: ["faction", "war-room"],
  market: ["markets"],
  torn: ["reference"],
  company: ["company"],
  racing: ["racing"],
  property: ["properties"],
  key: ["settings"],
  forum: ["community"],
};
const capabilities = [];
for (const [path, methods] of Object.entries(spec.paths ?? {}))
  for (const [method, op] of Object.entries(methods)) {
    if (method !== "get") continue;
    const parameters = [
      ...(methods.parameters ?? []),
      ...(op.parameters ?? []),
    ].map(resolve);
    const queryParams = parameters
      .filter((p) => p.in === "query")
      .map((p) => p.name)
      .filter((n) => n !== "key");
    const access = op.description
      ?.match(
        /requires (public|minimal|limited|full|custom)(?: access)? key/i,
      )?.[1]
      ?.toLowerCase();
    const group = path.split("/")[1],
      requiredAccess = levels[access] ?? "Unknown";
    let privacy = "unknown";
    if (["torn", "market", "forum", "racing"].includes(group))
      privacy = "public";
    else if (group === "user")
      privacy = path.includes("{id}") ? "public" : "own";
    else if (group === "faction")
      privacy = requiredAccess === "Public Only" ? "public" : "faction";
    else if (group === "key") privacy = "own";
    else if (group === "company")
      privacy = requiredAccess === "Public Only" ? "public" : "company";
    capabilities.push({
      id: `v2-${path.replaceAll("/", "-").replace(/^-|-$/g, "")}`,
      version: "v2",
      method: "GET",
      path,
      group,
      summary: op.summary ?? "",
      queryParams,
      parameters: parameters
        .filter((p) => p.name !== "key")
        .map((p) => ({
          name: p.name,
          location: p.in,
          required: p.required ?? false,
          description: p.description ?? "",
          schema: p.schema ?? {},
        })),
      requiredAccess,
      privacy,
      pagination:
        queryParams.includes("from") || queryParams.includes("to")
          ? "from-to"
          : queryParams.includes("offset")
            ? "limit-offset"
            : queryParams.includes("limit")
              ? "cursor"
              : "none",
      cacheSeconds: 0,
      upstreamCache: op.description?.includes("Globally cached")
        ? "Documented global cache; inspect endpoint description"
        : "Unspecified; no app caching assumed",
      refresh: "manual",
      features: features[group] ?? [],
      source: "official API",
      verified: !!access,
      verificationNote:
        "Endpoint, parameters and required key level read from official OpenAPI " +
        spec.info.version +
        ". Privacy is a conservative app classification; permission and cache policy require runtime checks.",
      description: op.description ?? "",
    });
  }
const output = {
  generatedAt: new Date().toISOString(),
  specUrl,
  specVersion: spec.info.version,
  count: capabilities.length,
  capabilities,
};
mkdirSync("src/api", { recursive: true });
mkdirSync("supabase/functions/_shared", { recursive: true });
for (const file of [
  "src/api/generated-capabilities.json",
  "supabase/functions/_shared/generated-capabilities.json",
])
  writeFileSync(file, JSON.stringify(output, null, 2) + "\n");
console.log(
  `${capabilities.length} documented read endpoints across ${new Set(capabilities.map((c) => c.group)).size} groups`,
);

// Count actual numeric leaf fields from the official full personal-stat response.
const metricMap=new Map();
function walkStats(node,path=[]){
 if(node.$ref){walkStats(resolve(node),path);return;}
 for(const kind of ['allOf','oneOf','anyOf'])for(const child of node[kind]??[])walkStats(child,path);
 for(const [name,child] of Object.entries(node.properties??{}))walkStats(child,[...path,name]);
 if(['number','integer'].includes(node.type)&&path.length&&!['id','timestamp','version'].includes(path.at(-1))){
  const id=path.join('.'),label=value=>value.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
  metricMap.set(id,{id,name:path.slice(1).map(label).join(' / '),category:label(path[1]??'Personal'),unit:'as documented',description:node.description??'Official numeric field; interpretation depends on the endpoint category.',source:'official-api',sourceField:id});
 }
}
walkStats(spec.components.schemas.UserPersonalStatsFull);
writeFileSync('src/data/verified-stats.json',JSON.stringify({specVersion:spec.info.version,sourceUrl:specUrl,metrics:[...metricMap.values()]},null,2)+'\n');
console.log(`${metricMap.size} distinct documented numeric personal-stat fields`);
