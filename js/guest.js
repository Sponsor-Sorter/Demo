// Interactive, local-only product tour. No auth client, tracking, payments or API calls.
const $ = (id) => document.getElementById(id);
const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const currency = (value) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value,
  );
const futureDate = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
const stages = ["pending", "accepted", "in_progress", "live", "completed"];
const stageNames = [
  "Offer received",
  "Offer accepted",
  "Creating content",
  "Content live",
  "Completed",
];
let role = null;
let filter = "all";
let offers = [];
let publicOffers = [];
let activity = [];
const dialog = $("preview-dialog");
function announce(text) {
  $("preview-status").textContent = text;
}
function showDialog(title, content) {
  $("preview-dialog-title").textContent = title;
  $("preview-dialog-content").replaceChildren(content);
  dialog.showModal();
}
function textBlock(text) {
  const p = document.createElement("p");
  p.textContent = text;
  return p;
}
function accountPrompt(feature) {
  const content = document.createElement("div");
  content.append(
    textBlock(
      `${feature} is available with an account. This preview uses fictional data and cannot change accounts or move money.`,
    ),
  );
  const link = document.createElement("a");
  link.href = "./signup.html";
  link.className = "preview-primary";
  link.textContent = "Create an account";
  content.append(link);
  showDialog(feature, content);
}
function resetData() {
  offers = [
    {
      id: "campaign-1",
      title: "A fresh take on everyday essentials",
      amount: 350,
      stage: 0,
      platform: "YouTube",
      deadline: futureDate(21),
      description:
        "Create a 60-second product introduction with your honest perspective. Include a clear sponsorship disclosure and a link to the brand.",
      comments: [],
    },
    {
      id: "campaign-2",
      title: "Weekend discovery series",
      amount: 240,
      stage: 2,
      platform: "Instagram",
      deadline: futureDate(14),
      description:
        "Create one reel and two stories introducing a favourite local experience. Agree on the final brief with your partner before filming.",
      comments: ["Looking forward to seeing your ideas."],
    },
  ];
  publicOffers = [
    {
      id: "opportunity-1",
      title: "Your next everyday favourite",
      amount: 180,
      platform: "TikTok",
      deadline: futureDate(28),
      description:
        "Show how this fictional product fits into your day. Deliver one short video with an appropriate sponsorship disclosure.",
      applied: false,
    },
  ];
  activity = [
    "Sample campaign brief received.",
    "Weekend discovery series moved into content creation.",
  ];
  filter = "all";
  $("preview-create-form").reset();
  $("preview-create-form").hidden = true;
  $("preview-create-form").elements.deadline.value = futureDate(21);
  $("preview-create-form").elements.deadline.min = futureDate(0);
}
function setRole(next, updateUrl = true) {
  role = ["sponsor", "sponsee"].includes(next) ? next : null;
  $("preview-picker").hidden = Boolean(role);
  $("preview-workspace").hidden = !role;
  document
    .querySelectorAll("[data-role]")
    .forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.role === role)),
    );
  if (updateUrl) {
    const url = new URL(location.href);
    role ? url.searchParams.set("role", role) : url.searchParams.delete("role");
    history.replaceState(null, "", url);
  }
  if (!role) return;
  $("workspace-title").textContent =
    role === "sponsor"
      ? "Welcome to your sponsor workspace"
      : "Welcome to your creator workspace";
  $("preview-create-toggle").hidden = role !== "sponsor";
  $("preview-create-form").hidden = true;
  render();
  announce(
    `${role === "sponsor" ? "Sponsor" : "Creator"} preview ready. All data is fictional.`,
  );
}
function cardActions(offer) {
  return `<div class="preview-actions"><button data-action="details" data-id="${offer.id}">View details</button><button data-action="comments" data-id="${offer.id}">Comments (${offer.comments.length})</button><button data-action="images" data-id="${offer.id}">Offer images</button>${offer.stage < 4 ? `<button class="preview-primary" data-action="advance" data-id="${offer.id}">${offer.stage === 0 ? (role === "sponsor" ? "Simulate acceptance" : "Accept sample offer") : ["", "", "Mark content live", "Complete sample campaign"][offer.stage] || "Start creating"}</button>` : '<span class="preview-pill">Campaign completed</span>'}</div>`;
}
function render() {
  const completed = offers.filter((offer) => offer.stage === 4).length;
  const metrics =
    role === "sponsor"
      ? [
          ["Active offers", offers.length - completed],
          ["Completed campaigns", completed + 1],
          [
            "Sample campaign budget",
            currency(offers.reduce((sum, offer) => sum + offer.amount, 0)),
          ],
          ["Public opportunities", publicOffers.length],
        ]
      : [
          ["Active partnerships", offers.length - completed],
          ["Completed campaigns", completed],
          ["Sample followers", "18,500"],
          [
            "Completed campaign value",
            currency(
              offers
                .filter((offer) => offer.stage === 4)
                .reduce((sum, offer) => sum + offer.amount, 300),
            ),
          ],
        ];
  $("preview-overview").innerHTML = metrics
    .map(
      ([label, value]) =>
        `<article class="preview-metric"><h3>${label}</h3><p>${value}</p></article>`,
    )
    .join("");
  document
    .querySelectorAll("[data-filter]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.filter === filter),
      ),
    );
  const visible = offers.filter(
    (offer) => filter === "all" || stages[offer.stage] === filter,
  );
  $("preview-offers").innerHTML = visible.length
    ? visible
        .map(
          (offer) =>
            `<article class="preview-offer"><div class="preview-offer-heading"><div class="preview-partner"><img src="./logos.png" width="48" height="48" alt=""><div><strong>${role === "sponsor" ? "Sample creator" : "Example brand"}</strong><span>${escapeHtml(offer.platform)} · Fictional partner</span></div></div><span class="preview-pill">${stageNames[offer.stage]}</span></div><h3>${escapeHtml(offer.title)}</h3><progress max="5" value="${offer.stage + 1}" aria-label="Campaign stage ${offer.stage + 1} of 5"></progress><dl><div><dt>Campaign amount</dt><dd>${currency(offer.amount)}</dd></div><div><dt>Deadline</dt><dd>${escapeHtml(offer.deadline)}</dd></div><div><dt>Payment schedule</dt><dd>On completion</dd></div><div><dt>Deliverable</dt><dd>One short video</dd></div></dl>${cardActions(offer)}</article>`,
        )
        .join("")
    : '<p class="preview-empty">No sample campaigns at this stage. Choose All to see every campaign, or move a campaign forward.</p>';
  $("preview-public-offers").innerHTML = publicOffers
    .map(
      (offer) =>
        `<article class="preview-offer"><div class="preview-offer-heading"><h3>${escapeHtml(offer.title)}</h3><strong>${currency(offer.amount)}</strong></div><p>${escapeHtml(offer.description)}</p><p class="preview-note">${escapeHtml(offer.platform)} · Deadline ${escapeHtml(offer.deadline)} · Sample opportunity</p><div class="preview-actions"><button data-public-action="details" data-id="${offer.id}">View brief</button>${role === "sponsor" ? `<button data-public-action="applicants" data-id="${offer.id}">Review sample applicant</button>` : `<button data-public-action="apply" data-id="${offer.id}">${offer.applied ? "Withdraw sample application" : "Try applying"}</button>`}</div></article>`,
    )
    .join("");
  $("preview-profile-content").innerHTML =
    `<div class="preview-partner"><img src="./logos.png" width="64" height="64" alt=""><div><h3>${role === "sponsor" ? "Example brand" : "Sample creator"}</h3><p>${role === "sponsor" ? "A brand building thoughtful partnerships." : "Lifestyle, discovery and everyday creativity."}</p></div></div><p><span class="preview-rating" aria-label="Sample rating: four out of five stars">★★★★☆</span> Illustrative review rating</p><dl><div><dt>Location</dt><dd>Australia (sample)</dd></div><div><dt>Connected platforms</dt><dd>YouTube · Instagram</dd></div></dl>`;
  $("preview-activity").replaceChildren(
    ...activity.slice(0, 5).map((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      return item;
    }),
  );
  $("preview-insights").innerHTML = [
    ["YouTube", 60],
    ["Instagram", 25],
    ["TikTok", 15],
  ]
    .map(
      ([name, value]) =>
        `<div><span>${name} · ${value}% of sample campaign mix</span><progress max="100" value="${value}" aria-label="${name} ${value}%"></progress></div>`,
    )
    .join("");
  $("preview-history-rows").innerHTML =
    `<tr><td>Product discovery story</td><td>${role === "sponsor" ? "Sample creator" : "Example brand"}</td><td>$300.00</td><td>Completed (sample)</td><td>4 / 5</td></tr>` +
    offers
      .filter((offer) => offer.stage === 4)
      .map(
        (offer) =>
          `<tr><td>${escapeHtml(offer.title)}</td><td>Fictional partner</td><td>${currency(offer.amount)}</td><td>Completed (sample)</td><td>Awaiting review</td></tr>`,
      )
      .join("");
}
function showDetails(offer) {
  const content = document.createElement("div");
  content.append(
    textBlock(offer.description),
    textBlock(
      `${offer.platform} · ${currency(offer.amount)} · Deadline ${offer.deadline}`,
    ),
    textBlock(
      "Sample terms: one short video, payment on completion, and an appropriate sponsorship disclosure. Real campaign terms must be agreed with your partner.",
    ),
  );
  showDialog(offer.title, content);
}
document
  .querySelectorAll("[data-role]")
  .forEach((button) =>
    button.addEventListener("click", () => setRole(button.dataset.role)),
  );
document.querySelectorAll("[data-filter]").forEach((button) =>
  button.addEventListener("click", () => {
    filter = button.dataset.filter;
    render();
  }),
);
$("preview-reset").addEventListener("click", () => {
  resetData();
  render();
  announce("Demo reset. All sample changes cleared.");
});
$("preview-account").addEventListener("click", () =>
  accountPrompt("Profile & settings"),
);
$("preview-wallet").addEventListener("click", () =>
  accountPrompt("Wallet & withdrawals"),
);
document
  .querySelectorAll("[data-account-action]")
  .forEach((button) =>
    button.addEventListener("click", () =>
      accountPrompt(button.dataset.accountAction),
    ),
  );
$("preview-dialog-close").addEventListener("click", () => dialog.close());
$("preview-create-toggle").addEventListener("click", () => {
  $("preview-create-form").hidden = !$("preview-create-form").hidden;
  if (!$("preview-create-form").hidden)
    $("preview-create-form").elements.title.focus();
});
$("preview-create-cancel").addEventListener("click", () => {
  $("preview-create-form").hidden = true;
  $("preview-create-toggle").focus();
});
$("preview-create-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const offer = {
    id: crypto.randomUUID(),
    title: form.elements.title.value.trim(),
    amount: Number(form.elements.amount.value),
    platform: form.elements.platform.value,
    deadline: form.elements.deadline.value,
    description: form.elements.description.value.trim(),
    applied: false,
  };
  if (
    !offer.title ||
    !offer.description ||
    !Number.isFinite(offer.amount) ||
    offer.amount < 1 ||
    offer.amount > 100000
  )
    return;
  publicOffers.unshift(offer);
  activity.unshift(`Created sample public offer: ${offer.title}`);
  form.reset();
  form.elements.deadline.value = futureDate(21);
  form.hidden = true;
  render();
  announce(
    "Sample offer created. Review its sample applicant to try the next step.",
  );
  $("preview-public-offers").scrollIntoView({ block: "start" });
});
$("preview-offers").addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const offer = offers.find((item) => item.id === button.dataset.id);
  if (!offer) return;
  if (button.dataset.action === "details") showDetails(offer);
  if (button.dataset.action === "advance") {
    offer.stage = Math.min(4, offer.stage + 1);
    activity.unshift(`${offer.title}: ${stageNames[offer.stage]}.`);
    render();
    announce(
      `Sample campaign updated: ${stageNames[offer.stage]}. No payment was made.`,
    );
  }
  if (button.dataset.action === "images") {
    const content = document.createElement("div");
    content.append(
      textBlock(
        "Illustrative campaign assets. Real offers can include their own uploaded images.",
      ),
    );
    for (const file of ["logos.png", "youtubelogo.png", "instagramlogo.png"]) {
      const img = document.createElement("img");
      img.src = "./" + file;
      img.alt = "Sample campaign reference asset";
      img.className = "preview-attachment";
      content.append(img);
    }
    showDialog("Sample offer images", content);
  }
  if (button.dataset.action === "comments") {
    const content = document.createElement("div"),
      list = document.createElement("ul");
    offer.comments.forEach((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      list.append(li);
    });
    const form = document.createElement("form");
    const label = document.createElement("label");
    label.textContent = "Add a sample comment";
    const input = document.createElement("textarea");
    input.required = true;
    input.maxLength = 1000;
    label.append(input);
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "Add comment";
    form.append(label, submit);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const value = input.value.trim();
      if (!value) return;
      offer.comments.push(value);
      const li = document.createElement("li");
      li.textContent = value;
      list.append(li);
      input.value = "";
      render();
      announce("Sample comment added locally.");
    });
    content.append(
      textBlock("Comments stay in this demo and are not sent to anyone."),
      list,
      form,
    );
    showDialog("Campaign conversation", content);
  }
});
$("preview-public-offers").addEventListener("click", (event) => {
  const button = event.target.closest("[data-public-action]");
  if (!button) return;
  const offer = publicOffers.find((item) => item.id === button.dataset.id);
  if (!offer) return;
  if (button.dataset.publicAction === "details") showDetails(offer);
  if (button.dataset.publicAction === "apply") {
    offer.applied = !offer.applied;
    activity.unshift(
      `${offer.applied ? "Submitted" : "Withdrew"} a sample application: ${offer.title}.`,
    );
    render();
    announce(
      offer.applied
        ? "Sample application submitted locally. No real application was sent."
        : "Sample application withdrawn.",
    );
  }
  if (button.dataset.publicAction === "applicants") {
    const content = document.createElement("div");
    content.append(
      textBlock("Sample creator · YouTube & Instagram"),
      textBlock(
        "“I would love to bring a fresh perspective to this campaign.” This is a fictional application.",
      ),
    );
    const accept = document.createElement("button");
    accept.textContent = offers.some((item) => item.id === offer.id)
      ? "Sample applicant already accepted"
      : "Accept sample applicant";
    accept.disabled = offers.some((item) => item.id === offer.id);
    accept.addEventListener("click", () => {
      offers.unshift({ ...offer, stage: 1, comments: [] });
      filter = "all";
      activity.unshift(`Accepted a sample applicant for ${offer.title}.`);
      dialog.close();
      render();
      announce(
        "Sample applicant accepted. The campaign is now in Active campaigns.",
      );
    });
    content.append(accept);
    showDialog("Review sample applicant", content);
  }
});
resetData();
setRole(new URLSearchParams(location.search).get("role"), false);
window.addEventListener("popstate", () =>
  setRole(new URLSearchParams(location.search).get("role"), false),
);
