import { assertEquals } from "https://deno.land/std@0.147.0/testing/asserts.ts";
import { temporalIntervals } from "../api/google-calendar.ts";
import { mergeOverlappingIntervals } from "./merge.ts";

Deno.test("merge overlapping interval in between other event", () => {
  const calendar1 = temporalIntervals([
    { start: "2022-07-12T22:00:00Z", end: "2022-07-12T22:30:00Z" },
    { start: "2022-07-13T02:00:00Z", end: "2022-07-13T03:00:00Z" },
  ]);
  const calendar2 = temporalIntervals([
    { start: "2022-07-12T22:15:00Z", end: "2022-07-12T22:20:00Z" },
  ]);

  assertEquals(
    mergeOverlappingIntervals([calendar1, calendar2]),
    temporalIntervals([
      { start: "2022-07-12T22:00:00Z", end: "2022-07-12T22:30:00Z" },
      { start: "2022-07-13T02:00:00Z", end: "2022-07-13T03:00:00Z" },
    ]),
  );
});

Deno.test("merge overlapping intervals that has earlier start", () => {
  const calendar1 = temporalIntervals([
    { start: "2022-07-12T22:00:00Z", end: "2022-07-12T22:30:00Z" },
    { start: "2022-07-13T02:00:00Z", end: "2022-07-13T03:00:00Z" },
  ]);
  const calendar2 = temporalIntervals([
    { start: "2022-07-12T21:20:00Z", end: "2022-07-12T22:20:00Z" },
  ]);

  assertEquals(
    mergeOverlappingIntervals([calendar1, calendar2]),
    temporalIntervals([
      { start: "2022-07-12T21:30:00Z", end: "2022-07-12T22:30:00Z" },
      { start: "2022-07-13T02:00:00Z", end: "2022-07-13T03:00:00Z" },
    ]),
  );
});

Deno.test("merge overlapping intervals with same starts", () => {
  const calendar1 = temporalIntervals([
    { start: "2022-07-12T22:00:00Z", end: "2022-07-12T22:30:00Z" },
    { start: "2022-07-13T02:00:00Z", end: "2022-07-13T03:00:00Z" },
  ]);
  const calendar2 = temporalIntervals([
    { start: "2022-07-12T22:00:00Z", end: "2022-07-12T22:20:00Z" },
  ]);

  assertEquals(
    mergeOverlappingIntervals([calendar1, calendar2]),
    temporalIntervals([
      { start: "2022-07-12T22:00:00Z", end: "2022-07-12T22:30:00Z" },
      { start: "2022-07-13T02:00:00Z", end: "2022-07-13T03:00:00Z" },
    ]),
  );
});

Deno.test("merge overlapping intervals with same ends", () => {
  const calendar1 = temporalIntervals([
    { start: "2022-07-12T22:00:00Z", end: "2022-07-12T22:30:00Z" },
    { start: "2022-07-13T02:00:00Z", end: "2022-07-13T03:00:00Z" },
  ]);
  const calendar2 = temporalIntervals([
    { start: "2022-07-12T22:15:00Z", end: "2022-07-12T22:30:00Z" },
  ]);

  assertEquals(
    mergeOverlappingIntervals([calendar1, calendar2]),
    temporalIntervals([
      { start: "2022-07-12T22:00:00Z", end: "2022-07-12T22:30:00Z" },
      { start: "2022-07-13T02:00:00Z", end: "2022-07-13T03:00:00Z" },
    ]),
  );
});
