import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { AuthService } from './auth.service';

/**
 * Tiny CRUD wrapper around the Firebase Realtime Database REST endpoint.
 *
 * Routes are <dbRoot>/<table>.json. Auth is attached as ?auth=<idToken>.
 *
 * Why hand-rolled and not the modular SDK?
 *   - Same pattern as firemenu_v2, which keeps the dependency surface small.
 *   - Avoids pulling in @angular/fire for what's effectively three endpoints.
 *   - Easy to unit-test by stubbing HttpClient.
 */
@Injectable({ providedIn: 'root' })
export class DbService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  async list<T>(table: string): Promise<T[]> {
    const data = await this.request<T | Record<string, T>>('GET', table);
    if (!data) return [];
    return this.normalize<T>(data);
  }

  async get<T>(table: string, id: string): Promise<T | null> {
    const data = await this.request<T>('GET', `${table}/${id}`);
    return data ?? null;
  }

  async create<T>(table: string, id: string, value: T): Promise<void> {
    await this.request('PUT', `${table}/${id}`, value);
  }

  async update<T>(table: string, id: string, value: Partial<T>): Promise<void> {
    await this.request('PATCH', `${table}/${id}`, value);
  }

  async remove(table: string, id: string): Promise<void> {
    await this.request('DELETE', `${table}/${id}`);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    // Make sure we have a non-expired token before issuing the request.
    const token = await this.auth.ensureFreshToken();
    const url = `${this.auth.databaseUrl}/${path}.json`;
    let params = new HttpParams();
    if (token) {
      params = params.set('auth', token);
    }

    const opts = { params, responseType: 'json' as const };

    switch (method) {
      case 'GET':
        return firstValueFrom(this.http.get<T>(url, opts)) as Promise<T>;
      case 'PUT':
        return firstValueFrom(this.http.put<T>(url, body, opts)) as Promise<T>;
      case 'PATCH':
        return firstValueFrom(this.http.patch<T>(url, body, opts)) as Promise<T>;
      case 'DELETE':
        return firstValueFrom(this.http.delete<T>(url, opts)) as Promise<T>;
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
  }

  /** Turn a Record<id, T> from RTDB into a T[]. Handles array responses too. */
  private normalize<T>(data: unknown): T[] {
    if (Array.isArray(data)) return data.filter(Boolean) as T[];
    if (data && typeof data === 'object') {
      return Object.entries(data as Record<string, T>).map(([id, value]) => ({
        ...(value as object),
        // Keep the firebase key under a generic _id field; specific models keep
        // their own typed id, so we don't override that here.
        ...(this.looksLikeIdOnly(value) ? { _id: id } : {}),
      })) as T[];
    }
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private looksLikeIdOnly(value: any): boolean {
    if (!value || typeof value !== 'object') return false;
    const keys = Object.keys(value);
    return keys.every((k) => k === 'id' || k === '_id');
  }
}
