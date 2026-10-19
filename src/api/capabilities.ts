import { Capability } from './types';

// Seed entries are limited to endpoints verified against Torn's official API
// documentation and the official OpenAPI specification references found during
// implementation. The generator extends this registry from the live spec.
export const CAPABILITIES: Capability[] = [
  {
    id: 'v2-user-basic',
    version: 'v2',
    method: 'GET',
    path: '/user',
    group: 'user',
    summary: 'Authenticated player basic data',
    queryParams: [],
    requiredAccess: 'Minimal Access',
    privacy: 'own',
    pagination: 'none',
    cacheSeconds: 30,
    refresh: 'active-session',
    features: ['overview', 'planner'],
    source: 'official API',
    verified: true,
    verificationNote: 'Official OpenAPI exposes /user as getMyBasic; verified via official docs/spec references.'
  },
  {
    id: 'v2-user-bars',
    version: 'v2',
    method: 'GET',
    path: '/user/bars',
    group: 'user',
    summary: 'Energy, nerve, happy, life and chain bars',
    queryParams: [],
    requiredAccess: 'Minimal Access',
    privacy: 'own',
    pagination: 'none',
    cacheSeconds: 30,
    refresh: 'active-session',
    features: ['overview', 'planner', 'alerts'],
    source: 'official API',
    verified: true,
    verificationNote: 'Official OpenAPI exposes /user/bars as getMyBars.'
  },
  {
    id: 'v2-user-cooldowns',
    version: 'v2',
    method: 'GET',
    path: '/user/cooldowns',
    group: 'user',
    summary: 'Drug, medical and booster cooldowns',
    queryParams: [],
    requiredAccess: 'Minimal Access',
    privacy: 'own',
    pagination: 'none',
    cacheSeconds: 60,
    refresh: 'active-session',
    features: ['overview', 'planner'],
    source: 'official API',
    verified: true,
    verificationNote: 'Official OpenAPI exposes /user/cooldowns as getMyCooldowns.'
  },
  {
    id: 'v2-user-log',
    version: 'v2',
    method: 'GET',
    path: '/user/log',
    group: 'user',
    summary: 'Authenticated player log events',
    queryParams: ['log', 'cat', 'target', 'limit', 'from', 'to'],
    requiredAccess: 'Full Access',
    privacy: 'own',
    pagination: 'from-to',
    cacheSeconds: 0,
    refresh: 'background',
    features: ['history', 'gym', 'alerts'],
    source: 'official API',
    verified: true,
    verificationNote: 'Official OpenAPI exposes /user/log as getMyLogs; requires full access and supports log, cat, target, limit, from, to.'
  },
  {
    id: 'v2-torn-logcategories',
    version: 'v2',
    method: 'GET',
    path: '/torn/logcategories',
    group: 'torn',
    summary: 'Public log category metadata',
    queryParams: [],
    requiredAccess: 'Public Only',
    privacy: 'public',
    pagination: 'none',
    cacheSeconds: 86400,
    refresh: 'manual',
    features: ['history', 'gym'],
    source: 'official API',
    verified: true,
    verificationNote: 'Official OpenAPI exposes /torn/logcategories as public log metadata.'
  },
  {
    id: 'v2-torn-logtypes',
    version: 'v2',
    method: 'GET',
    path: '/torn/logtypes',
    group: 'torn',
    summary: 'Public log type metadata',
    queryParams: [],
    requiredAccess: 'Public Only',
    privacy: 'public',
    pagination: 'none',
    cacheSeconds: 86400,
    refresh: 'manual',
    features: ['history', 'gym'],
    source: 'official API',
    verified: true,
    verificationNote: 'Official OpenAPI exposes /torn/logtypes as public log metadata.'
  }
];

export function getCapability(id: string): Capability | undefined {
  return CAPABILITIES.find((c) => c.id === id);
}

export function capabilitiesForFeature(feature: string): Capability[] {
  return CAPABILITIES.filter((c) => c.features.includes(feature));
}
