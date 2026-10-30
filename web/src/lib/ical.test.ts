import { describe, expect, it } from "vitest";
import { expand, parseCalendar, writeCalendar } from "./ical";

const utc = (w: number) => w;

describe("ical", () => {
  it("round-trips events with escaping and all-day dates", () => {
    const ics = writeCalendar("Hearth", [
      { uid: "a", title: "Dinner, with Sam; 7pm", start: Date.UTC(2026, 10, 3, 2), allDay: false, location: "Home" },
      { uid: "b", title: "Mom's birthday", start: Date.UTC(2026, 10, 9), allDay: true, rrule: "FREQ=YEARLY" },
    ]);
    expect(ics).toContain("SUMMARY:Dinner\\, with Sam\; 7pm");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261109");
    const back = parseCalendar(ics, utc);
    expect(back.map((e) => e.title)).toEqual(["Dinner, with Sam; 7pm", "Mom's birthday"]);
    expect(back[1]).toMatchObject({ allDay: true, rrule: "FREQ=YEARLY" });
  });

  it("parses TZID times, skips cancelled, and expands weekly BYDAY", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:x
SUMMARY:Yoga
DTSTART;TZID=America/Los_Angeles:20261102T180000
DTEND;TZID=America/Los_Angeles:20261102T190000
RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4
END:VEVENT
BEGIN:VEVENT
UID:y
STATUS:CANCELLED
SUMMARY:Gone
DTSTART:20261105T100000Z
END:VEVENT
END:VCALENDAR`;
    const ev = parseCalendar(ics, (wall) => wall + 8 * 3600_000);
    expect(ev).toHaveLength(1);
    const occ = expand(ev, Date.UTC(2026, 10, 1), Date.UTC(2026, 11, 1), (wall) => wall + 8 * 3600_000);
    expect(occ.map((o) => new Date(o.start).toISOString().slice(0, 10))).toEqual(["2026-11-03", "2026-11-05", "2026-11-10", "2026-11-12"]);
  });
});
