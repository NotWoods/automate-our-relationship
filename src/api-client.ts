export interface RequestParameters {
  path: string;
  method: 'get' | 'post';
  headers?: HeadersInit;
  query?: URLSearchParams;
  body?: unknown;
}

export class HttpError extends Error {
  name = 'HttpError';
}

export abstract class ApiClient {
  readonly baseUrl: URL;
  private readonly baseQuery: URLSearchParams;

  constructor(
    baseUrl: string,
    baseQuery?: string[][] | Record<string, string> | string | URLSearchParams,
  ) {
    this.baseUrl = new URL(baseUrl);
    this.baseQuery = new URLSearchParams(baseQuery);
  }

  protected async request({
    path,
    method,
    headers: headersInit,
    query = new URLSearchParams(),
    body,
  }: RequestParameters): Promise<Response> {
    const url = new URL(path, this.baseUrl);
    for (const searchParams of [this.baseQuery, query]) {
      for (const [key, value] of searchParams) {
        url.searchParams.append(key, value);
      }
    }

    const headers = new Headers(headersInit);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: method !== 'get' ? JSON.stringify(body) : undefined,
    });

    if (response.ok) {
      return response;
    } else {
      throw new HttpError(`${response.status}: ${await response.text()}`);
    }
  }
}
