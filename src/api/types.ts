export type ApiVersion = 'v1' | 'v2';
export type DataSource = 'official API' | 'derived calculation' | 'manual input' | 'future work';
export type AccessLevel = 'Public Only' | 'Minimal Access' | 'Limited Access' | 'Full Access' | 'Custom';

export interface Capability {
  id: string;
  version: ApiVersion;
  method: 'GET';
  path: string;
  group: string;
  summary: string;
  queryParams: string[];
  requiredAccess: AccessLevel;
  privacy: 'public' | 'own' | 'faction' | 'company';
  pagination: 'none' | 'limit-offset' | 'from-to' | 'cursor';
  cacheSeconds: number;
  refresh: 'manual' | 'active-session' | 'background';
  features: string[];
  source: DataSource;
  verified: boolean;
  verificationNote: string;
}
