import { Temporal } from "https://cdn.skypack.dev/@js-temporal/polyfill?dts";
import { delay } from "https://deno.land/std@0.147.0/async/delay.ts";
import { config } from "https://deno.land/std@0.147.0/dotenv/mod.ts";
import { GoogleCalendarClient, isErrors } from "../api/google-calendar.ts";
import { HomeAssistantClient } from "../api/home-assistant.ts";
import { isRejected } from "../notion-recipe-randomizer/utils.ts";

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
async function waitUntil(time: Temporal.ZonedDateTime, signal?: AbortSignal) {
  const now = Temporal.Now.zonedDateTimeISO();
  if (Temporal.ZonedDateTime.compare(time, now) < 0) {
    // This is in the past, so we can just return immediately
    return false;
  }

  const timeDifference = time.epochMilliseconds - now.epochMilliseconds;
  await delay(timeDifference, { signal });
  return true;
}

async function watchBusyTimes(
  calendarId: string,
  switchEntityId: string,
  start: Temporal.ZonedDateTime,
  duration: Temporal.DurationLike,
  signal?: AbortSignal,
) {
  const busyTimes = await googleCalendarApi.freeBusy({
    timeMin: start,
    timeMax: start.add(duration),
    items: [{ id: calendarId }],
  }, signal);

  const busyTimesList = busyTimes.calendars[calendarId];
  if (isErrors(busyTimesList)) {
    throw new AggregateError(busyTimesList.errors);
  }

  console.log(busyTimesList.busy);
  for (const { start, end } of busyTimesList.busy) {
    const homeAssistantJobs: Promise<unknown>[] = [];

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
await watchBusyTimes(
  configData["GOOGLE_CALENDAR_ID"],
  configData["HOME_ASSISTANT_SWITCH_ENTITY_ID"],
  Temporal.Now.zonedDateTimeISO(),
  { days: 1 },
);
