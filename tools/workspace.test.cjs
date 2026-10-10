const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(
  path.join(__dirname, "../js/campaignSummary.js"),
  "utf8",
);
const summarize = vm.runInNewContext(
  source.replace("export function", "function") + "; summarizeCampaigns",
);
test("only completed campaigns contribute to completed value", () => {
  const summary = summarize([
    { status: "pending", offer_amount: 1000 },
    { status: "accepted", offer_amount: 500 },
    { status: "completed", offer_amount: "200.50" },
    { status: "review_completed", offer_amount: 100 },
    { status: "rejected", offer_amount: 999 },
    { status: "Offer Cancelled", offer_amount: 999 },
  ]);
  assert.equal(summary.completedValue, 300.5);
  assert.equal(summary.completed, 2);
  assert.equal(summary.active, 2);
  assert.equal(summary.accepted, 3);
});
test("invalid monetary values cannot poison dashboard totals", () => {
  const summary = summarize(
    [NaN, Infinity, -1, "invalid"].map((offer_amount) => ({
      status: "completed",
      offer_amount,
    })),
  );
  assert.equal(summary.completedValue, 0);
  assert.equal(summarize().total, 0);
});
test("preview is independent of accounts and outbound analytics", () => {
  const demo = fs.readFileSync(path.join(__dirname, "../js/guest.js"), "utf8");
  assert.doesNotMatch(
    demo,
    /\bfetch\s*\(|supabaseClient|ipapi|XMLHttpRequest|sendBeacon/,
  );
  const html = fs.readFileSync(path.join(__dirname, "../guest.html"), "utf8");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, "preview IDs must be unique");
});
