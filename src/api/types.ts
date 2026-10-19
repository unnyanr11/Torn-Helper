export type ApiVersion = "v1" | "v2";
export type DataSource =
  "official API" | "derived calculation" | "manual input" | "future work";
export type AccessLevel =
  | "Public Only"
  | "Minimal Access"
  | "Limited Access"
  | "Full Access"
  | "Custom"
  | "Unknown";

export interface Capability {
  id: string;
  version: ApiVersion;
  method: "GET";
  path: string;
  group: string;
  summary: string;
  queryParams: string[];
  parameters: {
    name: string;
    location: string;
    required: boolean;
    description: string;
    schema: any;
  }[];
  description: string;
  requiredAccess: AccessLevel;
  privacy: "public" | "own" | "faction" | "company" | "unknown";
  pagination: "none" | "limit-offset" | "from-to" | "cursor";
  cacheSeconds: number;
  refresh: "manual" | "active-session" | "background";
  features: string[];
  source: DataSource;
  verified: boolean;
  verificationNote: string;
}
