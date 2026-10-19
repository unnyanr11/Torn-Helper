export interface MatrixRow {
  feature: string;
  competitor: string;
  sourceUrl: string;
  dateChecked: string;
  freemium: string;
  acceptanceTest: string;
  blockerVisibility: string;
  screen: string;
  dataSource: string;
  permissions: string;
  externalDependency: string;
  phase: string;
  status: string;
  verification: string;
  testEvidence: string;
}
export const COMPETITOR_MATRIX: MatrixRow[] = [
  {
    feature: "Main list 1",
    competitor: "Baldr's Levelling List",
    sourceUrl: "https://oran.pw/baldrstargets/",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete main list 1 workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Targets",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency:
      "Licensed list import or redistribution permission required",
    phase: "Scope acceptance",
    status: "blocked",
    verification: "User-required scope; competitor behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Main list 2",
    competitor: "Baldr's Levelling List",
    sourceUrl: "https://oran.pw/baldrstargets/",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete main list 2 workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Targets",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency:
      "Licensed list import or redistribution permission required",
    phase: "Scope acceptance",
    status: "blocked",
    verification: "User-required scope; competitor behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Main list 3",
    competitor: "Baldr's Levelling List",
    sourceUrl: "https://oran.pw/baldrstargets/",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete main list 3 workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Targets",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency:
      "Licensed list import or redistribution permission required",
    phase: "Scope acceptance",
    status: "blocked",
    verification: "User-required scope; competitor behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Extra list 1",
    competitor: "Baldr's Levelling List",
    sourceUrl: "https://oran.pw/baldrstargets/",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete extra list 1 workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Targets",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency:
      "Licensed list import or redistribution permission required",
    phase: "Scope acceptance",
    status: "blocked",
    verification: "User-required scope; competitor behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Extra list 2",
    competitor: "Baldr's Levelling List",
    sourceUrl: "https://oran.pw/baldrstargets/",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete extra list 2 workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Targets",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency:
      "Licensed list import or redistribution permission required",
    phase: "Scope acceptance",
    status: "blocked",
    verification: "User-required scope; competitor behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Extra list 3",
    competitor: "Baldr's Levelling List",
    sourceUrl: "https://oran.pw/baldrstargets/",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete extra list 3 workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Targets",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency:
      "Licensed list import or redistribution permission required",
    phase: "Scope acceptance",
    status: "blocked",
    verification: "User-required scope; competitor behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "DOMINO list",
    competitor: "Baldr's Levelling List",
    sourceUrl: "https://oran.pw/baldrstargets/",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete domino list workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Targets",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency:
      "Licensed list import or redistribution permission required",
    phase: "Scope acceptance",
    status: "blocked",
    verification: "User-required scope; competitor behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "API key setup",
    competitor: "Baldr's Levelling List",
    sourceUrl: "https://oran.pw/baldrstargets/",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete api key setup workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Targets",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "",
    phase: "Scope acceptance",
    status: "partial",
    verification: "User-required scope; competitor behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "List selection",
    competitor: "Baldr's Levelling List",
    sourceUrl: "https://oran.pw/baldrstargets/",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete list selection workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Targets",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "",
    phase: "Scope acceptance",
    status: "partial",
    verification: "User-required scope; competitor behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Observed status refresh",
    competitor: "Baldr's Levelling List",
    sourceUrl: "https://oran.pw/baldrstargets/",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete observed status refresh workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Targets",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "",
    phase: "Scope acceptance",
    status: "partial",
    verification: "User-required scope; competitor behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Levelling guidance",
    competitor: "Baldr's Levelling List",
    sourceUrl: "https://oran.pw/baldrstargets/",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete levelling guidance workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Targets",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "",
    phase: "Scope acceptance",
    status: "partial",
    verification: "User-required scope; competitor behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Target presets",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/guides/selling-losses",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete target presets workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Targets",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Permitted target catalogue",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Player lookup",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/guides/selling-losses",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete player lookup workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Player Intel",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "",
    phase: "Scope acceptance",
    status: "partial",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Compare players",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/guides/selling-losses",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete compare players workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Compare Players",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "",
    phase: "Scope acceptance",
    status: "partial",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Factions hub",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/guides/selling-losses",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete factions hub workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Faction",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Roster synchronization and scoped permissions",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Faction comparison",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/guides/selling-losses",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete faction comparison workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Faction",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Authorized per-member evidence",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Active ranked wars",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/guides/selling-losses",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete active ranked wars workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "War Room",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Official war synchronization",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "War coordination",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/guides/selling-losses",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete war coordination workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "War Room",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Faction sharing and authoritative roles",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Investment ROI",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/guides/selling-losses",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete investment roi workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "ROI Calculator",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Current reference valuations",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "PI financing",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/guides/selling-losses",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete pi financing workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "PI Mortgages",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Lenders and reviewed operating policy",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Buy losses",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/guides/selling-losses",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete buy losses workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Losses",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "",
    phase: "Scope acceptance",
    status: "partial",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Sell losses",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/guides/selling-losses",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete sell losses workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Losses",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "",
    phase: "Scope acceptance",
    status: "partial",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Loss claim reconciliation",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/guides/selling-losses",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete loss claim reconciliation workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Losses",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "",
    phase: "Scope acceptance",
    status: "partial",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Loss suitability threshold",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/guides/selling-losses",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete loss suitability threshold workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Losses",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Comparable permitted target total-stat data",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Prepaid custody and refunds",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/guides/selling-losses",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete prepaid custody and refunds workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Operator Dashboard",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency:
      "Actual custodian, deposit verification and operating policy",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Bounty placement and claims",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/guides/selling-losses",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete bounty placement and claims workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Bounties",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Dedicated verified contract and settlement workflow",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Account/data removal",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/guides/selling-losses",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete account/data removal workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Settings",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "",
    phase: "Scope acceptance",
    status: "partial",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Stat estimate history",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/premium",
    dateChecked: "2026-10-19",
    freemium: "paid",
    acceptanceTest:
      "Exercise the complete stat estimate history workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Player Intel",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Permitted historical data",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Premium prediction sources",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/premium",
    dateChecked: "2026-10-19",
    freemium: "paid",
    acceptanceTest:
      "Exercise the complete premium prediction sources workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Player Intel",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Proprietary datasets or permitted integration",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Stat distribution evidence",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/premium",
    dateChecked: "2026-10-19",
    freemium: "paid",
    acceptanceTest:
      "Exercise the complete stat distribution evidence workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Player Intel",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Authorized distribution evidence",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Flight coverage",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/premium",
    dateChecked: "2026-10-19",
    freemium: "paid",
    acceptanceTest:
      "Exercise the complete flight coverage workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Player Intel",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Independent observations or permitted feed",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Activity coverage",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/premium",
    dateChecked: "2026-10-19",
    freemium: "paid",
    acceptanceTest:
      "Exercise the complete activity coverage workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Player Intel",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Opted-in continuous collection",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Faction premium management",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/premium",
    dateChecked: "2026-10-19",
    freemium: "paid",
    acceptanceTest:
      "Exercise the complete faction premium management workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Player Intel",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency:
      "Publicly listed; our core offering has no user paywall",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Public estimate API",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/api-docs",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete public estimate api workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "API Usage",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Verified integration credentials and terms",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Companion badges and filters",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/api-docs",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete companion badges and filters workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "API Usage",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency:
      "Short-lived app token integration; quick links only today",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Companion appearance controls",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/api-docs",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete companion appearance controls workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "API Usage",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Only hide and URL settings are implemented",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Beginner guide",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/guides/selling-losses",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete beginner guide workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Tornipedia",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Original guide writing and verified mechanics",
    phase: "Scope acceptance",
    status: "blocked",
    verification: "User-required scope; competitor behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Battle-stat guide",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/guides/selling-losses",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete battle-stat guide workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Tornipedia",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Original guide writing and verified mechanics",
    phase: "Scope acceptance",
    status: "blocked",
    verification: "User-required scope; competitor behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "War/chaining guide",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/guides/selling-losses",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete war/chaining guide workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Tornipedia",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Original guide writing and verified mechanics",
    phase: "Scope acceptance",
    status: "blocked",
    verification: "User-required scope; competitor behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Happy-jump guide",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/guides/selling-losses",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete happy-jump guide workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Tornipedia",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Original guide writing and verified mechanics",
    phase: "Scope acceptance",
    status: "blocked",
    verification: "User-required scope; competitor behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Level 15 guide",
    competitor: "FFScouter",
    sourceUrl: "https://ffscouter.com/guides/selling-losses",
    dateChecked: "2026-10-19",
    freemium: "unknown",
    acceptanceTest:
      "Exercise the complete level 15 guide workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Tornipedia",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Original guide writing and verified mechanics",
    phase: "Scope acceptance",
    status: "blocked",
    verification: "User-required scope; competitor behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Observed activity history",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/free-torn-tools",
    dateChecked: "2026-10-19",
    freemium: "free",
    acceptanceTest:
      "Exercise the complete observed activity history workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Activity",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Collection history and polling budgets",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Player/faction/alliance profiles",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/free-torn-tools",
    dateChecked: "2026-10-19",
    freemium: "free",
    acceptanceTest:
      "Exercise the complete player/faction/alliance profiles workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Faction",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Authoritative rosters and sharing",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Personal-stat periods",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/free-torn-tools",
    dateChecked: "2026-10-19",
    freemium: "free",
    acceptanceTest:
      "Exercise the complete personal-stat periods workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Stats Catalog",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Verified meaningful metric definitions and history",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Chain reports",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/free-torn-tools",
    dateChecked: "2026-10-19",
    freemium: "free",
    acceptanceTest:
      "Exercise the complete chain reports workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Reports",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Authorized official reports",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Foreign stock",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/free-torn-tools",
    dateChecked: "2026-10-19",
    freemium: "free",
    acceptanceTest:
      "Exercise the complete foreign stock workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Travel",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Permitted feed or opted-in contributor network",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Departure/day planning",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/free-torn-tools",
    dateChecked: "2026-10-19",
    freemium: "free",
    acceptanceTest:
      "Exercise the complete departure/day planning workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Travel Optimizer",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Reference travel mechanics and current observations",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Restock/arrival alerts",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/free-torn-tools",
    dateChecked: "2026-10-19",
    freemium: "free",
    acceptanceTest:
      "Exercise the complete restock/arrival alerts workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Alerts",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Permitted feeds and forecast calibration",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Stocks and holdings",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/free-torn-tools",
    dateChecked: "2026-10-19",
    freemium: "free",
    acceptanceTest:
      "Exercise the complete stocks and holdings workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Stocks",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Benefit valuation and historical snapshots",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Company recap and staff tools",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/free-torn-tools",
    dateChecked: "2026-10-19",
    freemium: "free",
    acceptanceTest:
      "Exercise the complete company recap and staff tools workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Company",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Director authorization and data",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Company pricing and star forecasts",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/free-torn-tools",
    dateChecked: "2026-10-19",
    freemium: "free",
    acceptanceTest:
      "Exercise the complete company pricing and star forecasts workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Company",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Validated forecast model",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Faction bank",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/free-torn-tools",
    dateChecked: "2026-10-19",
    freemium: "free",
    acceptanceTest:
      "Exercise the complete faction bank workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Faction Finance",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Authoritative roles and reconciled ledger",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Armory history",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/free-torn-tools",
    dateChecked: "2026-10-19",
    freemium: "free",
    acceptanceTest:
      "Exercise the complete armory history workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Armory History",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Authorized logs",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Levelling imports/sharing",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/free-torn-tools",
    dateChecked: "2026-10-19",
    freemium: "free",
    acceptanceTest:
      "Exercise the complete levelling imports/sharing workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Targets",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Redistribution rights and scoped sharing",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Faction transfers",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/free-torn-tools",
    dateChecked: "2026-10-19",
    freemium: "free",
    acceptanceTest:
      "Exercise the complete faction transfers workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Retention Trends",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Collected membership history",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Raids and territory",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/free-torn-tools",
    dateChecked: "2026-10-19",
    freemium: "free",
    acceptanceTest:
      "Exercise the complete raids and territory workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Faction",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Official synchronization",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Upgrade simulation",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/free-torn-tools",
    dateChecked: "2026-10-19",
    freemium: "free",
    acceptanceTest:
      "Exercise the complete upgrade simulation workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Faction Upgrades",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Versioned official costs",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Alliance/family views",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/free-torn-tools",
    dateChecked: "2026-10-19",
    freemium: "free",
    acceptanceTest:
      "Exercise the complete alliance/family views workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Alliances",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Verified administrators and explicit grants",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Chat, threads and mentions",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/free-torn-tools",
    dateChecked: "2026-10-19",
    freemium: "free",
    acceptanceTest:
      "Exercise the complete chat, threads and mentions workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Community",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Threaded messaging and moderation",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Faction applications",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/free-torn-tools",
    dateChecked: "2026-10-19",
    freemium: "free",
    acceptanceTest:
      "Exercise the complete faction applications workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Recruitment",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Authoritative application access",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Halloween workflows",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/free-torn-tools",
    dateChecked: "2026-10-19",
    freemium: "free",
    acceptanceTest:
      "Exercise the complete halloween workflows workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Halloween",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Verified seasonal mechanics",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "PWA and push",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/free-torn-tools",
    dateChecked: "2026-10-19",
    freemium: "free",
    acceptanceTest:
      "Exercise the complete pwa and push workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Notifications",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Push provider, VAPID setup and delivery checks",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Discord commands and routing",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/free-torn-tools",
    dateChecked: "2026-10-19",
    freemium: "free",
    acceptanceTest:
      "Exercise the complete discord commands and routing workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Discord",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Verified Discord app and channel roles",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Contextual assistant",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/free-torn-tools",
    dateChecked: "2026-10-19",
    freemium: "free",
    acceptanceTest:
      "Exercise the complete contextual assistant workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Assistant",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Authorized retrieval and traceable evidence",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Full statistics library and date ranges",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/torn-faction-tracker-pro",
    dateChecked: "2026-10-19",
    freemium: "paid",
    acceptanceTest:
      "Exercise the complete full statistics library and date ranges workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Stats Catalog",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Verified metric count and collected snapshots",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Ranked-war contribution tracker",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/torn-faction-tracker-pro",
    dateChecked: "2026-10-19",
    freemium: "paid",
    acceptanceTest:
      "Exercise the complete ranked-war contribution tracker workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "War Room",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Authorized attack synchronization",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Audited payouts and share links",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/torn-faction-tracker-pro",
    dateChecked: "2026-10-19",
    freemium: "paid",
    acceptanceTest:
      "Exercise the complete audited payouts and share links workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Payouts",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency:
      "Full evidence classifications and public-link revocation tests",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Faction medians and distributions",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/torn-faction-tracker-pro",
    dateChecked: "2026-10-19",
    freemium: "paid",
    acceptanceTest:
      "Exercise the complete faction medians and distributions workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Faction",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Authorized member stats and coverage",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Tracked spies and players",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/torn-faction-tracker-pro",
    dateChecked: "2026-10-19",
    freemium: "paid",
    acceptanceTest:
      "Exercise the complete tracked spies and players workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Spy Reports",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Permitted report import and provenance",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "30 watched factions",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/torn-faction-tracker-pro",
    dateChecked: "2026-10-19",
    freemium: "paid",
    acceptanceTest:
      "Exercise the complete 30 watched factions workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Watched Factions",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Budgeted scheduler and permission verification",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Dibs and enemy-loadout history",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/torn-faction-tracker-pro",
    dateChecked: "2026-10-19",
    freemium: "paid",
    acceptanceTest:
      "Exercise the complete dibs and enemy-loadout history workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Dibs",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency:
      "Transactional cross-user coordination and permitted loadout reports",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "War and chain alerts",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/torn-faction-tracker-pro",
    dateChecked: "2026-10-19",
    freemium: "paid",
    acceptanceTest:
      "Exercise the complete war and chain alerts workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Alerts",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "War synchronization and push delivery",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Activity heatmaps",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/torn-faction-tracker-pro",
    dateChecked: "2026-10-19",
    freemium: "paid",
    acceptanceTest:
      "Exercise the complete activity heatmaps workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Activity",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Observed history and gap accounting",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "PvP comparisons",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/torn-faction-tracker-pro",
    dateChecked: "2026-10-19",
    freemium: "paid",
    acceptanceTest:
      "Exercise the complete pvp comparisons workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Compare Players",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Authorized combat evidence",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Recruitment scanning",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/torn-faction-tracker-pro",
    dateChecked: "2026-10-19",
    freemium: "paid",
    acceptanceTest:
      "Exercise the complete recruitment scanning workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Recruitment",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency:
      "Authorized candidate population; no invented global search",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Gym scenarios",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/torn-faction-tracker-pro",
    dateChecked: "2026-10-19",
    freemium: "paid",
    acceptanceTest:
      "Exercise the complete gym scenarios workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Gym",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Verified mechanics and recorded training events",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Applicant stat evidence",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/torn-faction-tracker-pro",
    dateChecked: "2026-10-19",
    freemium: "paid",
    acceptanceTest:
      "Exercise the complete applicant stat evidence workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Recruitment",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Applicant consent and legitimate data source",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Alliance/family aggregates",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/torn-faction-tracker-pro",
    dateChecked: "2026-10-19",
    freemium: "paid",
    acceptanceTest:
      "Exercise the complete alliance/family aggregates workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Alliances",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Verified roles and scoped grants",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Column presets",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/torn-faction-tracker-pro",
    dateChecked: "2026-10-19",
    freemium: "paid",
    acceptanceTest:
      "Exercise the complete column presets workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Custom Stats",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Persisted table layout preferences",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "TornStats adapter",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/torn-faction-tracker-pro",
    dateChecked: "2026-10-19",
    freemium: "paid",
    acceptanceTest:
      "Exercise the complete tornstats adapter workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "TornStats",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency:
      "Per-user credentials and verified sharing/caching terms",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "CSV/XLSX and share reports",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/torn-faction-tracker-pro",
    dateChecked: "2026-10-19",
    freemium: "paid",
    acceptanceTest:
      "Exercise the complete csv/xlsx and share reports workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Reports",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency:
      "Export utilities work; report-sharing acceptance remains",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Collaborative graffiti",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/torn-faction-tracker-pro",
    dateChecked: "2026-10-19",
    freemium: "paid",
    acceptanceTest:
      "Exercise the complete collaborative graffiti workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Graffiti",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Storage quotas, moderation and upload tests",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "Discord extras",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/torn-faction-tracker-pro",
    dateChecked: "2026-10-19",
    freemium: "paid",
    acceptanceTest:
      "Exercise the complete discord extras workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "Discord",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "Registered bot, account linking and private channels",
    phase: "Scope acceptance",
    status: "blocked",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
  {
    feature: "AI war summary/payout planning",
    competitor: "Torn Intel",
    sourceUrl: "https://torn-intel.com/torn-faction-tracker-pro",
    dateChecked: "2026-10-19",
    freemium: "paid",
    acceptanceTest:
      "Exercise the complete ai war summary/payout planning workflow with authorized data, missing data, errors and access checks.",
    blockerVisibility: "public",
    screen: "AI War Analyzer",
    dataSource: "official API / authorized imports / manual input",
    permissions:
      "Per-user read permissions; explicit private-data grants where applicable",
    externalDependency: "",
    phase: "Scope acceptance",
    status: "partial",
    verification:
      "Public description checked; authenticated behavior unverified",
    testEvidence: "Not accepted as complete; see docs/IMPLEMENTATION_AUDIT.md",
  },
];
