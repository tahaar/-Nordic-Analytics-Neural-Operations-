import { getAccessToken, redirectToLogin } from "../auth/authService";

/**
 * fetch() wrapper that automatically adds the Bearer token to every request.
 * If the token is missing the user is redirected to login.
 * On 401 from the server (token expired) the user is also redirected.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();

  if (!token) {
    redirectToLogin();
    // Return a never-resolving promise; the redirect will take over.
    return new Promise(() => undefined);
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(input, { ...init, headers });

  if (response.status === 401) {
    // Token expired — redirect to login
    redirectToLogin();
    return new Promise(() => undefined);
  }

  return response;
}
