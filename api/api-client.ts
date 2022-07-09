interface Source {
  entries(): IterableIterator<[string, string]>;
}

/**
 * Helper to assign new values to `URLSearchParams` and `Headers`.
 * All values in `source` will be copied to `target`, appending to any existing values.
 *
 * @param target The target object to mutate.
 * @param source The values to assign to `target`. Read-only.
 */
function assign(
  target: {
    append(name: string, value: string): void;
  },
  source: Source,
) {
  for (const [name, value] of source.entries()) {
    target.append(name, value);
  }
}

/**
 * Helper to assign default values to `URLSearchParams` and `Headers`.
 * If a value in `target` is not set, then it will be set to the value in `defaults`.
 *
 * @param target The target object to mutate.
 * @param defaults The default values to assign to `target`. Read-only.
 */
function assignDefaults(
  target: {
    has(name: string): boolean;
    set(name: string, value: string): void;
  },
  defaults: Source,
) {
  for (const [name, value] of defaults.entries()) {
    if (!target.has(name)) {
      target.set(name, value);
    }
  }
}

type URLSearchParamsInit = NonNullable<
  ConstructorParameters<typeof URLSearchParams>[0]
>;

export interface RequestParameters extends RequestInit {
  query?: URLSearchParams;
}

/**
 * API client that wraps `fetch` and sets default values for `URL`, `URLSearchParams` and `Headers`.
 */
export abstract class ApiClient {
  readonly baseUrl: URL;
  private readonly queryDefaults: URLSearchParams;
  private readonly headerDefaults: Headers;

  /**
   * @param baseUrl The base URL of the API. All requests will be relative to this URL.
   * @param queryDefaults The default values to assign to `URLSearchParams` in every request.
   * @param headerDefaults The default values to assign to `Headers` in every request.
   */
  constructor(
    baseUrl: string,
    queryDefaults?: URLSearchParamsInit,
    headerDefaults: HeadersInit = { "Content-Type": "application/json" },
  ) {
    this.baseUrl = new URL(baseUrl);
    this.queryDefaults = new URLSearchParams(queryDefaults);
    this.headerDefaults = new Headers(headerDefaults);
  }

  /**
   * Make a fetch request to the API.
   *
   * @param path Relative path of the API endpoint.
   * @param requestInit The request init object to pass to `fetch`.
   * @param requestInit.query Query parameters to assign to the URL. Overrides any defaults from the constructor.
   * @param requestInit.headers Headers to assign to the request. Overrides any defaults from the constructor.
   *
   * @throws {HttpError} If the response returns a non-2xx status code.
   */
  protected async fetch(path: string, {
    query = new URLSearchParams(),
    ...requestInit
  }: RequestParameters = {}): Promise<Response> {
    const url = new URL(path, this.baseUrl);
    assign(url.searchParams, query);
    assignDefaults(url.searchParams, this.queryDefaults);

    const headers = new Headers(requestInit.headers);
    assignDefaults(headers, this.headerDefaults);

    const response = await fetch(url.toString(), {
      ...requestInit,
      headers,
    });

    if (response.ok) {
      return response;
    } else {
      throw new HttpError(`${response.status}: ${await response.text()}`);
    }
  }
}

export class HttpError extends Error {
  name = "HttpError";
}
