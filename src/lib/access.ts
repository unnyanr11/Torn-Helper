export function canAccessPage(page: string, signedIn: boolean, role: string) {
  if (!signedIn) return page === "Settings";
  if (page === "Admin Cost Dashboard") return role === "admin";
  if (page === "Operator Dashboard")
    return role === "admin" || role === "payment_operator";
  return true;
}
