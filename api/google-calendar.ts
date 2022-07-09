import { Temporal } from "https://cdn.skypack.dev/@js-temporal/polyfill?dts";
import { ApiClient } from "./api-client.ts";
import { launchBrowser, listenForOauthRedirect } from "./oauth.ts";

const BASE_URL = "https://www.googleapis.com/";
const REDIRECT_PATH = "/auth";

/** Convert any ZonedDateTimes in an object to strings, recursively */
export type MapDateTimes<T> = {
  // ZonedDateTime -> string
  [K in keyof T]: T[K] extends Temporal.ZonedDateTime ? string
    // objects -> recursion
    // deno-lint-ignore ban-types
    : T[K] extends object ? MapDateTimes<T[K]>
      // fallback to same type
    : T[K];
};

interface FreeBusyRequest {
  timeMin: Temporal.ZonedDateTime;
  timeMax: Temporal.ZonedDateTime;
  timeZone?: string;
  groupExpansionMax?: number;
  calendarExpansionMax?: number;
  items?: { id: string }[];
}

interface ErrorData {
  domain: string;
  reason: string;
}

interface FreeBusyTimes {
  start: Temporal.ZonedDateTime;
  end: Temporal.ZonedDateTime;
}

interface FreeBusyResponse {
  kind: "calendar#freeBusy";
  timeMin: Temporal.ZonedDateTime;
  timeMax: Temporal.ZonedDateTime;
  groups?: Record<string, { errors: ErrorData[] } | { calendars: string[] }>;
  calendars: Record<
    string,
    { errors: ErrorData[] } | { busy: FreeBusyTimes[] }
  >;
}

type TokenRequest = {
  grant_type: "authorization_code";
  code: string;
  redirect_uri: string;
} | {
  grant_type: "refresh_token";
  refresh_token: string;
};

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: "Bearer";
}

export function isErrors<T>(
  object: T | { errors: ErrorData[] },
): object is { errors: ErrorData[] } {
  return Array.isArray((object as { errors?: unknown }).errors);
}

export class GoogleCalendarClient extends ApiClient {
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly authPort: number = 8000,
  ) {
    super(BASE_URL);
  }

  async authorize() {
    const tokens = this.savedTokens;
    const refresh = tokens?.refresh_token;

    const newTokens = refresh
      ? await this.authorizeOffline(refresh)
      : await this.authorizeWithPrompt();
    this.savedTokens = newTokens;
  }

  private get savedTokens(): TokenResponse | undefined {
    try {
      return JSON.parse(localStorage.getItem("google_tokens")!);
    } catch {
      return undefined;
    }
  }

  private set savedTokens(tokens: TokenResponse | undefined) {
    if (tokens === undefined) {
      localStorage.removeItem("google_tokens");
    } else {
      localStorage.setItem("google_tokens", JSON.stringify(tokens));
    }
  }

  private async authorizeWithPrompt() {
    const state = (Math.random() * 10000).toString(16);

    // Direct to Google's OAuth 2.0 server
    launchBrowser(
      this.getAuthorizationUrl({
        state,
        scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
      }),
    );
    // Handle the OAuth 2.0 server response
    const code = await listenForOauthRedirect(REDIRECT_PATH, state, {
      port: this.authPort,
    });
    // Exchange authorization code for refresh and access tokens
    const tokens = await this.getAccessToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.redirectUri.href,
    });

    localStorage.setItem("google_tokens", JSON.stringify(tokens));
    return tokens;
  }

  private async authorizeOffline(refresh_token: string) {
    const tokens = await this.getAccessToken({
      grant_type: "refresh_token",
      refresh_token,
    });

    localStorage.setItem("google_tokens", JSON.stringify(tokens));
    return tokens;
  }

  private get redirectUri() {
    return new URL(REDIRECT_PATH, `http://localhost:${this.authPort}`);
  }

  /**
   * https://developers.google.com/identity/protocols/oauth2/web-server#httprest_1
   */
  private getAuthorizationUrl(
    options: { state?: string; scopes: readonly string[] },
  ) {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set(
      "redirect_uri",
      this.redirectUri.href,
    );
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", options.scopes.join(" "));
    url.searchParams.set("access_type", "offline");
    if (options.state) {
      url.searchParams.set("state", options.state);
    }
    return url;
  }

  private async getAccessToken(request: TokenRequest): Promise<TokenResponse> {
    const response = await fetch(`https://oauth2.googleapis.com/token`, {
      method: "post",
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        ...request,
      }),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    return await response.json();
  }

  /**
   * https://developers.google.com/calendar/api/v3/reference/freebusy/query
   */
  async freeBusy(
    request: FreeBusyRequest,
    signal?: AbortSignal,
  ): Promise<FreeBusyResponse> {
    const toStringOptions: Temporal.ZonedDateTimeToStringOptions = {
      timeZoneName: "never",
      calendarName: "never",
      fractionalSecondDigits: 0,
    };

    const response = await this.fetch(`/calendar/v3/freeBusy`, {
      method: "post",
      signal,
      body: JSON.stringify({
        ...request,
        timeMin: request.timeMin.toString(toStringOptions),
        timeMax: request.timeMax.toString(toStringOptions),
      }),
    });

    const freeBusyData: MapDateTimes<FreeBusyResponse> = await response.json();
    return {
      ...freeBusyData,
      timeMin: Temporal.ZonedDateTime.from(freeBusyData.timeMin),
      timeMax: Temporal.ZonedDateTime.from(freeBusyData.timeMax),
      calendars: Object.fromEntries(
        Object.entries(freeBusyData.calendars).map(([id, calendar]) => {
          if (isErrors(calendar)) {
            return [id, calendar];
          }

          const busy = calendar.busy.map((busyTime) => ({
            start: Temporal.ZonedDateTime.from(busyTime.start),
            end: Temporal.ZonedDateTime.from(busyTime.end),
          }));
          return [id, { busy }];
        }),
      ),
    };
  }
}
