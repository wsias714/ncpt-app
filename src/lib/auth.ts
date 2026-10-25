// Google Identity Services token client. Browser-only, no secret, no server.
// The access token lives in memory only (never localStorage/IndexedDB).
export const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
].join(" ");

export const CLIENT_ID: string = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "";

export function clientIdConfigured(id: string = CLIENT_ID): boolean {
  return !!id && !id.startsWith("REPLACE_WITH");
}

interface TokenResponse { access_token?: string; expires_in?: number; error?: string }
interface TokenClient { requestAccessToken(o?: { prompt?: string }): void }
interface GoogleAccounts {
  accounts: { oauth2: {
    initTokenClient(c: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: () => void }): TokenClient;
    revoke(token: string, done?: () => void): void;
  } };
}
declare global { interface Window { google?: GoogleAccounts } }

let token: string | null = null;
let expiresAt = 0;

export const getToken = (): string | null => (token && Date.now() < expiresAt ? token : null);

function loadScript(): Promise<void> {
  if (window.google) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Google sign-in"));
    document.head.appendChild(s);
  });
}

// Must be called from a tap (popup rules).
export async function signIn(): Promise<void> {
  if (!clientIdConfigured()) throw new Error("VITE_GOOGLE_CLIENT_ID is not set");
  await loadScript();
  await new Promise<void>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (r) => {
        if (r.error || !r.access_token) return reject(new Error(r.error ?? "Sign-in failed"));
        token = r.access_token;
        expiresAt = Date.now() + (r.expires_in ?? 3600) * 1000 - 60_000;
        resolve();
      },
      error_callback: () => reject(new Error("Sign-in was cancelled")),
    });
    client.requestAccessToken({ prompt: token ? "" : "select_account" });
  });
}

export function signOut(): void {
  const t = token;
  token = null;
  expiresAt = 0;
  if (t && window.google) window.google.accounts.oauth2.revoke(t);
}
