import { Temporal } from "https://cdn.skypack.dev/@js-temporal/polyfill?dts";
import { ApiClient } from "./api-client.ts";

const BASE_URL = "https://www.googleapis.com/";

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
  constructor() {
    super(BASE_URL);
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
