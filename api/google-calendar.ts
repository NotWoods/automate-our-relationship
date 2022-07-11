import { Temporal } from "https://cdn.skypack.dev/@js-temporal/polyfill?dts";
import { ApiClient } from "./api-client.ts";
import { jsonStorage, launchBrowser, listenForOauthRedirect } from "./oauth.ts";

const BASE_URL = "https://www.googleapis.com/";
const REDIRECT_PATH = "/auth";

/** Convert any Instants in an object to strings, recursively */
export type InstantsToStrings<T> = {
  // Instant -> string
  [K in keyof T]: T[K] extends Temporal.Instant ? string
    // objects -> recursion
    // deno-lint-ignore ban-types
    : T[K] extends object ? InstantsToStrings<T[K]>
      // fallback to same type
    : T[K];
};

interface CalendarListItem {
  id: string;
  summary: string;
  description?: string;
  summaryOverride?: string;
  timeZone: string;
  colorId: string;
  backgroundColor: string;
  foregroundColor: string;
  selected?: boolean;
  accessRole: string;
}

interface FreeBusyRequest {
  timeMin: Temporal.Instant;
  timeMax: Temporal.Instant;
  timeZone?: string;
  groupExpansionMax?: number;
  calendarExpansionMax?: number;
  items?: { id: string }[];
}

interface ErrorData {
  domain: string;
  reason: string;
}

export interface FreeBusyInterval {
  start: Temporal.Instant;
  end: Temporal.Instant;
}

interface FreeBusyResponse {
  kind: "calendar#freeBusy";
  timeMin: Temporal.Instant;
  timeMax: Temporal.Instant;
  groups?: Record<string, { errors: ErrorData[] } | { calendars: string[] }>;
  calendars: Record<
    string,
    { errors: ErrorData[] } | { busy: FreeBusyInterval[] }
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

export function temporalIntervals(
  intervals: readonly InstantsToStrings<FreeBusyInterval>[],
): FreeBusyInterval[] {
  return intervals.map((interval) => ({
    start: Temporal.Instant.from(interval.start),
    end: Temporal.Instant.from(interval.end),
  }));
}

export function isErrors<T>(
  object: T | { errors: ErrorData[] },
): object is { errors: ErrorData[] } {
  return Array.isArray((object as { errors?: unknown }).errors);
}

function tokenExpired(expiresInEpochSeconds: number) {
  let expiresIn: Temporal.Instant;
  try {
    expiresIn = Temporal.Instant.fromEpochSeconds(expiresInEpochSeconds);
  } catch {
    // If Temporal fails to parse the expiration time, it's probably not valid
    return true;
  }

  const now = Temporal.Now.instant();
  return Temporal.Instant.compare(expiresIn, now) <= 0;
}

export class GoogleCalendarClient extends ApiClient {
  private savedTokens = jsonStorage<TokenResponse>("google_tokens");

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly authPort: number = 8000,
  ) {
    super(BASE_URL);
  }

  /**
   * Authenticate with Google's OAuth 2.0 server. May prompt the user for login.
   */
  async authorize() {
    const tokens = this.savedTokens.get();
    const refresh = tokens?.refresh_token;

    if (tokens && !tokenExpired(tokens.expires_in)) {
      // Token hasn't expired yet
      return;
    }

    const newTokens = refresh
      ? await this.authorizeOffline(refresh)
      : await this.authorizeWithPrompt();

    const secondsNow = Temporal.Now.instant().epochSeconds;
    this.savedTokens.set({
      ...newTokens,
      expires_in: newTokens.expires_in + secondsNow,
    });
  }

  private get redirectUri() {
    return new URL(REDIRECT_PATH, `http://localhost:${this.authPort}`);
  }

  private get savedAccessToken() {
    const tokens = this.savedTokens.get();
    if (!tokens) {
      throw new Error("Must authenticate first");
    }
    return tokens.access_token;
  }

  private async authorizeWithPrompt() {
    const state = crypto.randomUUID();

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
    return this.requestAccessToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.redirectUri.href,
    });
  }

  private authorizeOffline(refresh_token: string) {
    return this.requestAccessToken({
      grant_type: "refresh_token",
      refresh_token,
    });
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

  private async requestAccessToken(
    request: TokenRequest,
  ): Promise<TokenResponse> {
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
   * https://developers.google.com/calendar/api/v3/reference/calendarList/list
   */
  async listCalendars(): Promise<CalendarListItem[]> {
    const response = await this.fetch(`/calendar/v3/users/me/calendarList`, {
      headers: {
        Authorization: `Bearer ${this.savedAccessToken}`,
      },
    });
    const { items } = await response.json();
    return items;
  }

  /**
   * https://developers.google.com/calendar/api/v3/reference/freebusy/query
   */
  async freeBusy(
    request: FreeBusyRequest,
    signal?: AbortSignal,
  ): Promise<FreeBusyResponse> {
    const toStringOptions: Temporal.InstantToStringOptions = {
      fractionalSecondDigits: 0,
    };

    const response = await this.fetch(`/calendar/v3/freeBusy`, {
      method: "post",
      signal,
      headers: {
        Authorization: `Bearer ${this.savedAccessToken}`,
      },
      body: JSON.stringify({
        ...request,
        timeMin: request.timeMin.toString(toStringOptions),
        timeMax: request.timeMax.toString(toStringOptions),
      }),
    });

    const freeBusyData: InstantsToStrings<FreeBusyResponse> = await response
      .json();
    return {
      ...freeBusyData,
      timeMin: Temporal.Instant.from(freeBusyData.timeMin),
      timeMax: Temporal.Instant.from(freeBusyData.timeMax),
      calendars: Object.fromEntries(
        Object.entries(freeBusyData.calendars).map(([id, calendar]) => {
          if (isErrors(calendar)) {
            return [id, calendar];
          }

          return [id, { busy: temporalIntervals(calendar.busy) }];
        }),
      ),
    };
  }
}
