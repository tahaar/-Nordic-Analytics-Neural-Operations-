export const authConfig = {
  tenantId: import.meta.env.VITE_AZURE_TENANT_ID as string,
  clientId: import.meta.env.VITE_AZURE_CLIENT_ID as string,
  get redirectUri() {
    return window.location.origin + "/auth/callback";
  },
  get logoutRedirectUri() {
    return window.location.origin + "/auth/logout-complete";
  },
  get authority() {
    return `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID as string}/v2.0`;
  },
};
