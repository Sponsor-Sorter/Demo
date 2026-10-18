import { pendingOfferAvailability } from './pendingOfferExpiry.mjs?v=20261018-expiry1';
import {
  campaignCalendar,
  downloadCampaignCalendar,
} from "./campaignCalendar.js?v=20261011-calendar1";
// Read-only attention summary from the dashboard's already authorised records.
export function attentionItems(offers, role, now = Date.now()) {
  return offers
    .filter(
      (o) =>
        !o.archived &&
        !/completed|rejected|cancelled|canceled/i.test(o.status || "") &&
        Number(o.stage) < 5,
    )
    .map((offer) => {
      const stage = Number(offer.stage),
        raw = offer.deadline;
      const due = raw
        ? Date.parse(
            /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw + "T23:59:59.999" : raw,
          )
        : NaN;
      const pending = stage === 1 ? pendingOfferAvailability(offer, now) : null;
      const overdue = pending?.reason === 'deadline_passed' || (stage >= 2 && Number.isFinite(due) && due < now);
      const soon =
        stage >= 2 &&
        Number.isFinite(due) &&
        due >= now &&
        due <= now + 7 * 86400000;
      const action =
        pending && !pending.canAccept ? pending.message :
        role === "sponsor"
          ? {
              1: "Awaiting creator response",
              2: "Check the agreed production schedule",
              3: "Check content and review any submitted drafts",
              4: "Review published links and confirm delivery",
            }[stage]
          : {
              1: "Review the sponsorship request",
              2: "Agree your production schedule",
              3: "Prepare content and submit drafts or publication links",
              4: "Check delivery confirmation with your sponsor",
            }[stage];
      return {
        offer,
        overdue,
        soon,
        due,
        action,
        priority: overdue
          ? 0
          : stage === 1 && role !== "sponsor"
            ? 1
            : stage === 4 && role === "sponsor"
              ? 1
              : soon
                ? 2
                : 3,
      };
    })
    .filter((item) => item.action)
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        (Number.isFinite(a.due) ? a.due : Infinity) -
          (Number.isFinite(b.due) ? b.due : Infinity) ||
        String(a.offer.id).localeCompare(String(b.offer.id)),
    );
}
export function renderCampaignToday(host, offers, role, onOpen) {
  if (!host) return;
  let section = document.getElementById("campaign-today");
  if (!section) {
    section = document.createElement("section");
    section.id = "campaign-today";
    section.className = "campaign-today";
    section.setAttribute("aria-label", "Your campaign priorities");
    host.before(section);
  }
  section.replaceChildren();
  const items = attentionItems(offers, role);
  const heading = document.createElement("h2");
  heading.textContent = "Your next steps";
  const summary = document.createElement("p");
  summary.className = "today-summary";
  summary.textContent = items.length
    ? items.length +
      " open campaigns · " +
      items.filter((i) => i.overdue).length +
      " overdue · " +
      items.filter((i) => i.soon).length +
      " due in 7 days"
    : "No active campaigns need attention. Explore Finder for your next partnership.";
  section.append(heading, summary);
  const calendar = campaignCalendar(offers);
  if (calendar.count) {
    const exportBar = document.createElement("div");
    exportBar.className = "today-calendar";
    const download = document.createElement("button");
    download.type = "button";
    download.textContent = "Export " + calendar.count + " upcoming deadlines";
    download.addEventListener("click", () =>
      downloadCampaignCalendar(calendar),
    );
    const description = document.createElement("p");
    description.textContent =
      "Download a calendar file. It includes campaign titles and dates, and does not update automatically.";
    exportBar.append(download, description);
    section.append(exportBar);
  }
  if (!items.length) {
    const link = document.createElement("a");
    link.href = "finder.html";
    link.textContent = "Find a partnership";
    section.append(link);
    return;
  }
  const list = document.createElement("div");
  list.className = "today-items";
  for (const item of items.slice(0, 4)) {
    const row = document.createElement("article");
    row.className = "today-item";
    const title = document.createElement("h3");
    title.textContent = item.offer.offer_title || "Untitled campaign";
    const status = document.createElement("span");
    status.className = "today-status" + (item.overdue ? " is-overdue" : "");
    status.textContent = item.overdue
      ? "Past agreed deadline"
      : item.soon
        ? "Due this week"
        : Number(item.offer.stage) === 1
          ? "Offer pending"
          : "In progress";
    const action = document.createElement("p");
    action.textContent = item.action;
    const date = document.createElement("p");
    date.className = "today-date";
    date.textContent = Number.isFinite(item.due)
      ? "Deadline: " + new Date(item.due).toLocaleDateString()
      : "No deadline set";
    const open = document.createElement("button");
    open.type = "button";
    open.textContent = "Open campaign";
    open.addEventListener("click", () => onOpen(item.offer.id));
    row.append(status, title, action, date, open);
    list.append(row);
  }
  section.append(list);
  const note = document.createElement("p");
  note.className = "today-summary";
  note.textContent =
    "Showing up to four priorities from your loaded private campaigns. Open a campaign to check its latest details. Pending offer acceptance uses Australia/Sydney time. Other date-only campaign deadlines use your local day.";
  section.append(note);
}
