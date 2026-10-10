import { supabase } from "./supabaseClient.js";

const BUCKET = "offer-submissions";
const MAX_BYTES = 50 * 1024 * 1024;
const TYPES = new Map([
  ["video/mp4", "mp4"],
  ["video/webm", "webm"],
  ["video/quicktime", "mov"],
]);

export function validateDraftFile(file) {
  if (!file || !TYPES.has(file.type))
    throw new Error("Choose an MP4, WebM or MOV video.");
  if (
    !Number.isSafeInteger(file.size) ||
    file.size < 1 ||
    file.size > MAX_BYTES
  )
    throw new Error("Video drafts must be between 1 byte and 50 MB.");
  return TYPES.get(file.type);
}

export function safeCommentElement(comment) {
  const row = document.createElement("p");
  const author = document.createElement("strong");
  author.textContent = (comment.sender || "Member") + ": ";
  const message = document.createElement("span");
  message.textContent = comment.comment_text || "";
  const time = document.createElement("em");
  time.textContent =
    " (" + new Date(comment.created_at).toLocaleString() + ") ";
  const report = document.createElement("button");
  report.type = "button";
  report.className = "report-btn";
  report.textContent = "🚩";
  report.setAttribute("aria-label", "Report comment");
  report.addEventListener("click", () =>
    window.openReportModal?.("comment", comment.id),
  );
  row.append(author, message, time, report);
  return row;
}

function element(tag, text, parent) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  parent?.appendChild(node);
  return node;
}

async function uploadDraft(file, path, progress) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token)
    throw new Error("Sign in again before uploading.");
  // Pinned TUS implementation; 6 MB chunks follow Supabase's upload contract.
  const { Upload } = await import("https://esm.sh/tus-js-client@4.3.1");
  await new Promise((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint:
        "https://mqixtrnhotqqybaghgny.storage.supabase.co/storage/v1/upload/resumable",
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${session.access_token}` },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName: BUCKET,
        objectName: path,
        contentType: file.type,
        cacheControl: "3600",
      },
      onProgress: (bytes, total) => {
        progress.value = Math.round((bytes / total) * 100);
      },
      onError: () =>
        reject(
          new Error("Upload interrupted. Check your connection and try again."),
        ),
      onSuccess: resolve,
    });
    upload.start();
  });
}

export async function mountOfferSubmissions(comments, offer, role) {
  if (!offer?.id) return;
  let host = comments.querySelector(".offer-drafts");
  if (host) return;
  if (!document.getElementById("offer-drafts-css")) {
    const link = document.createElement("link");
    link.id = "offer-drafts-css";
    link.rel = "stylesheet";
    link.href = new URL("../offer-drafts.css", import.meta.url).href;
    document.head.appendChild(link);
  }
  host = element("section", "", comments);
  host.className = "offer-drafts";
  element("h4", "Content drafts & approval", host);
  element(
    "p",
    "Share a private video draft here before publishing. Approval confirms the draft; it does not release payment or confirm that the content is live.",
    host,
  );
  const status = element("p", "", host);
  status.setAttribute("role", "status");
  const refresh = element("button", "Refresh drafts", host);
  refresh.type = "button";
  const history = element("div", "", host);
  let loading = false;
  const render = async () => {
    if (loading) return;
    loading = true;
    refresh.disabled = true;
    status.textContent = "Loading drafts…";
    try {
      const { data, error } = await supabase
        .from("offer_submissions")
        .select(
          "id,object_path,original_name,version,notes,status,feedback,created_at,reviewed_at",
        )
        .eq("offer_id", offer.id)
        .order("version", { ascending: false });
      if (error) throw new Error("Drafts could not be loaded. Please retry.");
      history.replaceChildren();
      status.textContent = data?.length ? "" : "No video drafts submitted yet.";
      for (const [index, draft] of (data || []).entries()) {
        const card = element("article", "", history);
        element(
          "h5",
          `Version ${draft.version} · ${draft.status.replaceAll("_", " ")}`,
          card,
        );
        element(
          "p",
          draft.original_name +
            " · " +
            new Date(draft.created_at).toLocaleString(),
          card,
        );
        if (draft.notes) element("p", draft.notes, card);
        if (draft.feedback)
          element("p", "Sponsor feedback: " + draft.feedback, card);
        if (draft.reviewed_at)
          element(
            "p",
            "Reviewed: " + new Date(draft.reviewed_at).toLocaleString(),
            card,
          );
        const player = element("video", "", card);
        player.controls = true;
        player.preload = "none";
        player.playsInline = true;
        const watch = element("button", "Load / renew private video", card);
        watch.type = "button";
        watch.addEventListener("click", async () => {
          watch.disabled = true;
          try {
            const { data, error } = await supabase.storage
              .from(BUCKET)
              .createSignedUrl(draft.object_path, 3600);
            if (error || !data?.signedUrl)
              throw new Error("Video is unavailable. Try renewing access.");
            const url = new URL(data.signedUrl);
            if (
              url.protocol !== "https:" ||
              ![
                "mqixtrnhotqqybaghgny.supabase.co",
                "mqixtrnhotqqybaghgny.storage.supabase.co",
              ].includes(url.hostname)
            )
              throw new Error("Invalid private video URL.");
            player.src = url.href;
            status.textContent =
              "Private video access lasts one hour. Renew it here if needed.";
          } catch (error) {
            status.textContent = error.message;
          } finally {
            watch.disabled = false;
          }
        });
        if (
          role === "sponsor" &&
          index === 0 &&
          draft.status === "pending" &&
          [2, 3].includes(Number(offer.stage))
        ) {
          const label = element("label", "Feedback for this version", card);
          const feedback = element("textarea", "", label);
          feedback.maxLength = 4000;
          for (const [decision, title] of [
            ["approved", "Approve draft"],
            ["changes_requested", "Request changes"],
          ]) {
            const button = element("button", title, card);
            button.type = "button";
            button.addEventListener("click", async () => {
              if (decision === "changes_requested" && !feedback.value.trim()) {
                status.textContent =
                  "Describe the changes the creator should make.";
                feedback.focus();
                return;
              }
              const buttons = card.querySelectorAll("button");
              buttons.forEach((b) => (b.disabled = true));
              try {
                const { error } = await supabase.rpc("review_offer_video", {
                  p_submission_id: draft.id,
                  p_decision: decision,
                  p_feedback: feedback.value.trim(),
                });
                if (error) throw new Error(error.message);
                await render();
                status.textContent =
                  decision === "approved"
                    ? "Draft approved. The creator can now publish the agreed content."
                    : "Changes requested. The creator can send a new version.";
              } catch (error) {
                status.textContent = error.message;
              } finally {
                buttons.forEach((b) => (b.disabled = false));
              }
            });
          }
        }
      }
    } catch (error) {
      status.textContent = error.message;
    } finally {
      loading = false;
      refresh.disabled = false;
    }
  };
  refresh.addEventListener("click", render);
  if (
    role === "creator" &&
    [2, 3].includes(Number(offer.stage)) &&
    !offer.archived
  ) {
    const form = element("form", "", host);
    const fileLabel = element(
      "label",
      "Video draft (MP4, WebM or MOV; up to 50 MB)",
      form,
    );
    const input = element("input", "", fileLabel);
    input.type = "file";
    input.accept = [...TYPES.keys()].join(",");
    input.required = true;
    const notesLabel = element("label", "Notes for the sponsor", form);
    const notes = element("textarea", "", notesLabel);
    notes.maxLength = 4000;
    const progress = element("progress", "", form);
    progress.max = 100;
    progress.value = 0;
    const submit = element("button", "Send video for approval", form);
    submit.type = "submit";
    let pending = null;
    input.addEventListener("change", () => {
      pending = null;
      progress.value = 0;
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      submit.disabled = true;
      input.disabled = true;
      try {
        const file = input.files[0];
        const extension = validateDraftFile(file);
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user?.id)
          throw new Error("Sign in again before uploading.");
        pending ||= {
          path: `${offer.id}/${session.user.id}/${crypto.randomUUID()}.${extension}`,
          uploaded: false,
        };
        status.textContent = "Uploading private draft… Keep this page open.";
        if (!pending.uploaded) {
          await uploadDraft(file, pending.path, progress);
          pending.uploaded = true;
        }
        const { error } = await supabase.rpc("submit_offer_video", {
          p_offer_id: offer.id,
          p_object_path: pending.path,
          p_original_name: file.name.slice(0, 180),
          p_notes: notes.value.trim(),
        });
        if (error) throw new Error(error.message);
        pending = null;
        form.reset();
        progress.value = 0;
        await render();
        status.textContent =
          "Draft sent. Wait for sponsor approval before publishing.";
      } catch (error) {
        status.textContent = error.message;
      } finally {
        submit.disabled = false;
        input.disabled = false;
      }
    });
  }
  await render();
}
