export function errorRecovery(message: string, status?: number) {
  if (status === 429 || /rate.limit|too many|request limit/i.test(message))
    return 'Wait for the request cooldown, then retry this section.';
  if (status === 401 || /jwt|session|sign.?in|unauthorized/i.test(message))
    return 'Sign in again to renew your session, then retry.';
  if (status === 403 || /permission|access level|restricted|api key|code (2|5|13)\b/i.test(message))
    return 'Check the key permissions in Torn and reconnect it in Settings. Faction and company tools may also require an in-game role.';
  if (status === 503 || /database|decrypt|encryption|backend|service unavailable/i.test(message))
    return 'The backend could not complete this request. Retry shortly. If it continues, contact the site administrator.';
  if (/torn.*unavailable|upstream|torn.*timeout/i.test(message))
    return 'Torn could not return this section. Wait briefly and retry.';
  if (/network|fetch|offline|connection|load failed/i.test(message))
    return 'Check your internet connection, then retry. Saved observations remain available.';
  return 'Retry this section. If it continues, check your Torn connection in Settings.';
}
