import { environment } from '../../../environments/environment';

export function isOwnApiRequest(url: string, document: Document): boolean {
  if (url.startsWith('/api/')) return true;
  try {
    const origin = document.location?.origin;
    if (!origin) return false;
    const target = new URL(url, origin);
    const apiOrigin = environment.apiUrl ? new URL(environment.apiUrl, origin).origin : origin;
    return (
      target.pathname.startsWith('/api/') &&
      (target.origin === origin || target.origin === apiOrigin)
    );
  } catch {
    return false;
  }
}
