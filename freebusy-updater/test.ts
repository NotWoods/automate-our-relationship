import { config } from "https://deno.land/std@0.147.0/dotenv/mod.ts";
import { GoogleCalendarClient } from "../api/google-calendar.ts";

const configData = await config({ safe: true, defaults: undefined });
const googleCalendarApi = new GoogleCalendarClient(
  configData["GOOGLE_CALENDAR_CLIENT_ID"],
  configData["GOOGLE_CALENDAR_CLIENT_SECRET"],
);

await googleCalendarApi.authorize();
console.log(await googleCalendarApi.listCalendars());
