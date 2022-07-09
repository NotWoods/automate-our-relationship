import { Temporal } from "https://cdn.skypack.dev/@js-temporal/polyfill?dts";
import { Status } from "https://deno.land/std@0.147.0/http/http_status.ts";
import { serve, ServeInit } from "https://deno.land/std@0.147.0/http/server.ts";
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

export function isErrors<T>(
  object: T | { errors: ErrorData[] },
): object is { errors: ErrorData[] } {
  return Array.isArray((object as { errors?: unknown }).errors);
}

export class GoogleCalendarClient extends ApiClient {
  constructor(
    private readonly clientId: string,
    private readonly authPort: number = 8000,
  ) {
    super(BASE_URL);
  }

  async authorize() {
    // Direct to Google's OAuth 2.0 server
    launchBrowser(
      this.getAuthorizationUrl({
        scopes: [
          "https://www.googleapis.com/auth/calendar.readonly",
        ],
      }),
    );
    // Handle the OAuth 2.0 server response
    const code = await listenForOauthRedirect(REDIRECT_PATH, undefined, {
      port: this.authPort,
    });
    // Exchange authorization code for refresh and access tokens
  }

  /**
   * https://developers.google.com/identity/protocols/oauth2/web-server#httprest_1
   */
  getAuthorizationUrl(options: { state?: string; scopes: readonly string[] }) {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set(
      "redirect_uri",
      new URL(REDIRECT_PATH, `http://localhost:${this.authPort}`).href,
    );
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", options.scopes.join(" "));
    url.searchParams.set("access_type", "offline");
    if (options.state) {
      url.searchParams.set("state", options.state);
    }
    return url;
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
