import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type QueryParams = Record<string, string | readonly string[]>;
export interface ApiRequestOptions {
  params?: QueryParams;
  headers?: HttpHeaders | Record<string, string | string[]>;
  context?: HttpContext;
  withCredentials?: boolean;
}

type ParamsOrOptions = QueryParams | ApiRequestOptions;
interface HttpClientOptions {
  params?: HttpParams;
  headers?: HttpHeaders | Record<string, string | string[]>;
  context?: HttpContext;
  withCredentials?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  get<T>(path: string, paramsOrOptions?: ParamsOrOptions): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${path}`, this.toHttpOptions(paramsOrOptions));
  }

  post<T>(path: string, body: unknown, paramsOrOptions?: ParamsOrOptions): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${path}`, body, this.toHttpOptions(paramsOrOptions));
  }

  put<T>(path: string, body: unknown, paramsOrOptions?: ParamsOrOptions): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${path}`, body, this.toHttpOptions(paramsOrOptions));
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body);
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${path}`);
  }

  private toHttpOptions(paramsOrOptions?: ParamsOrOptions): HttpClientOptions {
    if (!paramsOrOptions) {
      return {};
    }
    if (this.isRequestOptions(paramsOrOptions)) {
      return {
        ...paramsOrOptions,
        params: paramsOrOptions.params
          ? new HttpParams({ fromObject: paramsOrOptions.params })
          : undefined,
      };
    }
    return { params: new HttpParams({ fromObject: paramsOrOptions }) };
  }

  private isRequestOptions(value: ParamsOrOptions): value is ApiRequestOptions {
    return (
      'params' in value || 'headers' in value || 'context' in value || 'withCredentials' in value
    );
  }
}
