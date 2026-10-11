// Local calendar snapshot. No account connections or background sharing.
function dateOnly(value) {
  const raw = String(value || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(raw + "T00:00:00Z");
    return Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === raw
      ? raw
      : null;
  }
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(raw)) return null;
  if (!dateOnly(raw.slice(0, 10))) return null;
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return null;
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
function text(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}
function fold(line) {
  let result = "",
    width = 0;
  const encoder = new TextEncoder();
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (width + size > 75) {
      result += "\r\n ";
      width = 1;
    }
    result += character;
    width += size;
  }
  return result;
}
export function campaignCalendar(offers, now = new Date()) {
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const seen = new Set();
  const events = [];
  for (const offer of offers) {
    const stage = Number(offer.stage),
      date = dateOnly(offer.deadline),
      id = String(offer.id || "");
    if (
      !id ||
      seen.has(id) ||
      offer.archived ||
      ![2, 3, 4].includes(stage) ||
      /completed|rejected|cancelled|canceled/i.test(offer.status || "") ||
      !date ||
      date < today
    )
      continue;
    seen.add(id);
    events.push({ offer, date, id });
  }
  events.sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sponsor Sorter//Campaign deadlines//EN",
    "CALSCALE:GREGORIAN",
  ];
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  for (const { offer, date, id } of events) {
    const end = new Date(date + "T00:00:00Z");
    end.setUTCDate(end.getUTCDate() + 1);
    lines.push(
      "BEGIN:VEVENT",
      "UID:campaign-" + encodeURIComponent(id) + "@sponsorsorter.com",
      "DTSTAMP:" + stamp,
      "DTSTART;VALUE=DATE:" + date.replace(/-/g, ""),
      "DTEND;VALUE=DATE:" + end.toISOString().slice(0, 10).replace(/-/g, ""),
      "SUMMARY:" + text(offer.offer_title || "Campaign deadline"),
      "DESCRIPTION:Agreed campaign deadline. Check Sponsor Sorter for the latest details. This exported snapshot does not update automatically.",
      "CLASS:PRIVATE",
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return {
    count: events.length,
    content: lines.map(fold).join("\r\n") + "\r\n",
  };
}
export function downloadCampaignCalendar(calendar) {
  const url = URL.createObjectURL(
    new Blob([calendar.content], { type: "text/calendar;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "sponsor-sorter-deadlines.ics";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
