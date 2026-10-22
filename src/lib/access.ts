export function canAccessPage(page: string, signedIn: boolean, role: string) {
  if (["Discord", "TornStats", "Competitor Matrix", "AI Settings", "AI War Analyzer", "Assistant"].includes(page)) return false;
  if (!signedIn) return page === "Settings";
  if (page === "Admin Cost Dashboard") return role === "admin";
  if (page === "Operator Dashboard")
    return role === "admin" || role === "payment_operator";
  return true;
}
