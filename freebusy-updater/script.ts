import { Temporal } from "https://cdn.skypack.dev/@js-temporal/polyfill?dts";
import { delay } from "https://deno.land/std@0.147.0/async/delay.ts";
import { config } from "https://deno.land/std@0.147.0/dotenv/mod.ts";
import { GoogleCalendarClient, isErrors } from "../api/google-calendar.ts";
import { HomeAssistantClient } from "../api/home-assistant.ts";
import { isRejected } from "../notion-recipe-randomizer/utils.ts";
import { mergeOverlappingIntervals } from "./merge.ts";

const configData = await config({ safe: true, defaults: undefined });
const googleCalendarApi = new GoogleCalendarClient(
  configData["GOOGLE_CALENDAR_CLIENT_ID"],
  configData["GOOGLE_CALENDAR_CLIENT_SECRET"],
);
const homeAssistantApi = new HomeAssistantClient(
  configData["HOME_ASSISTANT_URL"],
  configData["HOME_ASSISTANT_TOKEN"],
);

/**
 * Resolves after the given time is reached.
 * @returns True if the time was reached, false if the time was in the past.
 */
async function waitUntil(time: Temporal.Instant, signal?: AbortSignal) {
  const now = Temporal.Now.instant();
  if (Temporal.Instant.compare(time, now) < 0) {
    // This is in the past, so we can just return immediately
    return false;
  }

  const timeDifference = time.epochMilliseconds - now.epochMilliseconds;
  await delay(timeDifference, { signal });
  return true;
}

async function watchBusyTimes(
  calendarIds: readonly string[],
  switchEntityId: string,
  start: Temporal.Instant,
  end: Temporal.Instant,
  signal?: AbortSignal,
) {
  const busyTimes = await googleCalendarApi.freeBusy({
    timeMin: start,
    timeMax: end,
    items: calendarIds.map((id) => ({ id })),
  }, signal);

  const busyTimesLists = Object.entries(busyTimes.calendars).map(
    ([id, data]) => {
      if (isErrors(data)) {
        console.warn(`Error fetching calendar ${id}`, data.errors);
        return [];
      }
      return data.busy;
    },
  );
  const mergedTimes = mergeOverlappingIntervals(busyTimesLists);

  console.log(mergedTimes);

  for (const { start, end } of mergedTimes) {
    const homeAssistantJobs: Promise<unknown>[] = [];

    console.log("Waiting until start", start.toLocaleString());
    if (await waitUntil(start, signal)) {
      const onJob = homeAssistantApi.setState(switchEntityId, {
        state: "on",
        attributes: {
          calendar_event_start: start.toString(),
          calendar_event_end: end.toString(),
        },
      });
      homeAssistantJobs.push(onJob);
    }

    console.log("Waiting until end", start.toLocaleString());
    if (await waitUntil(end, signal)) {
      const offJob = homeAssistantApi.setState(switchEntityId, {
        state: "off",
        attributes: {
          calendar_event_start: "",
          calendar_event_end: end.toString(),
        },
      });
      homeAssistantJobs.push(offJob);
    }

    Promise.allSettled(homeAssistantJobs).then((results) => {
      const rejected = results.filter(isRejected).map(({ reason }) => reason);
      if (rejected.length > 0) {
        console.warn(rejected);
      }
    });
  }
}

await googleCalendarApi.authorize();

const calendars = await googleCalendarApi.listCalendars();

await watchBusyTimes(
  calendars
    .filter((calendar) =>
      calendar.selected &&
      !calendar.id.endsWith("#holiday@group.v.calendar.google.com")
    )
    .map((calendar) => calendar.id),
  configData["HOME_ASSISTANT_SWITCH_ENTITY_ID"],
  Temporal.Now.instant(),
  Temporal.Now.zonedDateTimeISO().add({ days: 1 }).toInstant(),
);
