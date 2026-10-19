export function publicApiPath(pathname: string): string {
  const route = pathname.replace(/^\/(?:functions\/v1\/)?public-api(?=\/|$)/, '');
  return route.replace(/\/$/, '') || '/';
}
