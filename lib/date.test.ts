import test from "node:test";
import assert from "node:assert/strict";
import { formatDateID, toDateKey, toMonthKey, todayKey } from "./date.ts";

test("toDateKey keeps the local calendar day", () => {
  // A local midnight date must not slide back a day in UTC+ timezones
  // (e.g. Asia/Jakarta), which is what toISOString() used to do.
  assert.equal(toDateKey(new Date(2026, 10, 16)), "2026-11-16");
  assert.equal(toDateKey(new Date(2026, 0, 1)), "2026-01-01");
  assert.equal(toDateKey(new Date(2026, 11, 31, 23, 59)), "2026-12-31");
});

test("todayKey matches local date components", () => {
  const now = new Date();
  const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  assert.equal(todayKey(), expected);
});

test("toMonthKey uses local year and month", () => {
  assert.equal(toMonthKey(new Date(2026, 10, 16)), "2026-11");
  assert.equal(toMonthKey(new Date(2026, 0, 1)), "2026-01");
});

test("formatDateID renders an Indonesian date without shifting", () => {
  assert.equal(formatDateID("2026-11-16"), "16 November 2026");
});
