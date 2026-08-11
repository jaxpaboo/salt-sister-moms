import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

// Email / password auth against Firebase Identity Toolkit, matching the same
// pattern used in firemenu_v2. We store { idToken, refreshToken, expiry } in
// localStorage so the user stays logged in across reloads; we proactively
// refresh when expiry is within a minute of now.
//
// API key is loaded from `src/environments/firebase.env.ts` (gitignored) with
// `firebase.env.example.ts` as a tracked fallback.

// Allow optional runtime `require` so a missing local env file doesn't break
// the build. Matches firemenu_v2's pattern.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const require: any;

interface PersistedAuth {
  idToken: string;
  refreshToken: string;
  tokenExpiry: number;
}

interface PasswordCheckResponse {
  idToken: string;
  email: string;
  refreshToken: string;
  expiresIn: string; // seconds, as a string
}

interface RefreshResponse {
  id_token: string;
  refresh_token: string;
  expires_in: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Signals so templates can react without a manual subscribe plumbing.
  readonly isAuthenticated = signal(false);
  readonly email = signal<string>('');
  readonly error = signal<string>('');

  private readonly apiKey: string;
  private readonly dbUrl: string;

  // Same keys used in firemenu_v2 — bumped per-project to avoid collisions.
  private readonly storageKey = 'saltSisterMoms_auth_v1';

  // In-memory cache so concurrent requests don't all hit localStorage.
  private idToken = '';
  private refreshToken = '';
  private tokenExpiry = 0;

  constructor(private http: HttpClient) {
    const env = this.loadEnv();
    this.apiKey = env.apiKey;
    this.dbUrl = env.dbUrl;
    this.tryRestoreSession();
  }

  /** Database root used by the rest of the app (e.g. DbService). */
  get databaseUrl(): string {
    return this.dbUrl;
  }

  /** Current idToken, or '' if not authenticated. */
  get token(): string {
    return this.idToken;
  }

  /** Sign in with email + password. Returns a promise so the form can await. */
  async signIn(email: string, password: string): Promise<void> {
    this.error.set('');

    if (!this.apiKey || this.apiKey === 'REPLACE_WITH_YOUR_FIREBASE_API_KEY2') {
      this.error.set('Firebase API key missing in src/environments/firebase.env.ts');
      return;
    }

    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${this.apiKey}`;
    const body = { email, password, returnSecureToken: true };

    try {
      const res = await firstValueFrom(this.http.post<PasswordCheckResponse>(url, body));
      this.setSession(res.idToken, res.refreshToken, Number(res.expiresIn));
      this.email.set(res.email ?? email);
    } catch (err) {
      this.error.set(this.toMessage(err));
    }
  }

  /** Forget everything — local session and in-memory state. */
  signOut(): void {
    this.idToken = '';
    this.refreshToken = '';
    this.tokenExpiry = 0;
    this.email.set('');
    this.isAuthenticated.set(false);
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // ignore storage failures (private mode, quota, etc.)
    }
  }

  /**
   * Returns a fresh bearer token, refreshing if expiry is within a minute.
   * Returns '' when not authenticated — callers should check `isAuthenticated`.
   */
  async ensureFreshToken(): Promise<string> {
    if (!this.idToken) {
      return '';
    }

    if (this.tokenExpiry > Date.now() + 60_000) {
      return this.idToken;
    }

    if (!this.refreshToken) {
      this.signOut();
      return '';
    }

    try {
      await this.refreshIdToken(this.refreshToken);
    } catch {
      this.signOut();
      return '';
    }

    return this.idToken;
  }

  private setSession(idToken: string, refreshToken: string, expiresInSeconds: number): void {
    this.idToken = idToken;
    this.refreshToken = refreshToken;
    this.tokenExpiry = Date.now() + expiresInSeconds * 1000;
    this.isAuthenticated.set(true);

    const payload: PersistedAuth = {
      idToken,
      refreshToken,
      tokenExpiry: this.tokenExpiry,
    };
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }

  private tryRestoreSession(): void {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(this.storageKey);
    } catch {
      return;
    }
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as PersistedAuth;
      if (parsed?.idToken && parsed.tokenExpiry && parsed.tokenExpiry > Date.now() + 60_000) {
        this.idToken = parsed.idToken;
        this.refreshToken = parsed.refreshToken ?? '';
        this.tokenExpiry = parsed.tokenExpiry;
        this.isAuthenticated.set(true);
        return;
      }

      if (parsed?.refreshToken) {
        // Fire and forget — the app stays in `isAuthenticated=false` until
        // the refresh resolves. We don't await here because Angular services
        // can be created outside of an injection context.
        void this.refreshIdToken(parsed.refreshToken);
      }
    } catch {
      // Malformed storage — ignore.
    }
  }

  private async refreshIdToken(oldRefreshToken: string): Promise<void> {
    const url = `https://securetoken.googleapis.com/v1/token?key=${this.apiKey}`;
    const body = `grant_type=refresh_token&refresh_token=${encodeURIComponent(oldRefreshToken)}`;
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

    const res = await firstValueFrom(
      this.http.post<RefreshResponse>(url, body, { headers }),
    );
    this.setSession(res.id_token, res.refresh_token, Number(res.expires_in));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private loadEnv(): { apiKey: string; dbUrl: string } {
    const fallback = {
      apiKey: 'REPLACE_WITH_YOUR_FIREBASE_API_KEY2',
      dbUrl: 'https://salt-sister-moms-default-rtdb.firebaseio.com',
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const env = require('../../environments/firebase.env') as any;
      if (env && env.FIREBASE_API_KEY && env.FIREBASE_DB_URL) {
        return { apiKey: String(env.FIREBASE_API_KEY), dbUrl: String(env.FIREBASE_DB_URL) };
      }
    } catch {
      // no env file — use tracked example placeholder
    }
    return fallback;
  }

  private toMessage(err: unknown): string {
    const e = err as HttpErrorResponse;
    return e?.error?.error?.message ?? 'Login failed — please check your credentials.';
  }
}
