import { authConfig } from "../authConfig";

/**
 * Returns the stored access token, or null if not logged in.
 */
export function getAccessToken(): string | null {
  return sessionStorage.getItem("access_token");
}

/**
 * Redirects the browser to the Entra ID authorization endpoint.
 * Uses the implicit flow to return id_token + access_token in the URL fragment.
 */
export function redirectToLogin(): void {
  // Generate a random state and nonce to protect against CSRF / replay attacks.
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();

  sessionStorage.setItem("auth_state", state);
  sessionStorage.setItem("auth_nonce", nonce);

  const params = new URLSearchParams({
    client_id: authConfig.clientId,
    response_type: "id_token token",
    redirect_uri: authConfig.redirectUri,
    response_mode: "fragment",
    scope: "openid profile email",
    state,
    nonce,
  });

  window.location.href = `${authConfig.authority}/oauth2/v2.0/authorize?${params.toString()}`;
}

/**
 * Processes the URL fragment after Entra ID redirects back.
 * Validates state, stores tokens, returns true on success.
 */
export function handleAuthCallback(): boolean {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);

  const accessToken = params.get("access_token");
  const idToken = params.get("id_token");
  const returnedState = params.get("state");

  const expectedState = sessionStorage.getItem("auth_state");

  if (!accessToken) return false;

  // Validate state to prevent CSRF
  if (returnedState !== expectedState) {
    console.error("Auth state mismatch — possible CSRF attack");
    return false;
  }

  sessionStorage.setItem("access_token", accessToken);
  sessionStorage.setItem("id_token", idToken ?? "");
  sessionStorage.removeItem("auth_state");
  sessionStorage.removeItem("auth_nonce");

  return true;
}

/**
 * Clears tokens and redirects to Entra ID logout.
 */
export function logout(): void {
  sessionStorage.removeItem("access_token");
  sessionStorage.removeItem("id_token");

  const params = new URLSearchParams({
    post_logout_redirect_uri: authConfig.logoutRedirectUri,
  });

  window.location.href = `${authConfig.authority}/oauth2/v2.0/logout?${params.toString()}`;
}
