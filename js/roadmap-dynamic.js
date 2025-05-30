import { supabase } from './supabaseClient.js';

const SECTIONS = [
  { id: "phases", label: "Project Phases & Key Milestones" },
  { id: "completed", label: "✅ Core Features — Completed" },
  { id: "planned", label: "🛠️ Planned / In Progress" },
  { id: "advanced", label: "✨ Advanced Features & Competitor Ideas" },
  { id: "compliance", label: "🛡️ Compliance & Security" },
  { id: "growth", label: "📈 Business & Growth" }
];

const columnsBySection = {
  phases:   ["", "Milestone / Feature", "Priority", "Status", "Notes", ""],
  completed:["", "Feature", "Priority/Category", "Status", "Notes", ""],
  planned:  ["", "Feature", "Priority/Category", "Status", "Notes", ""],
  advanced: ["Feature", "Priority/Category", "Status", "Notes", ""],
  compliance:["Feature", "Priority/Category", "Status", "Notes", ""],
  growth:   ["Feature/Strategy", "Status", "Notes", ""],
};

const addFields = {
  phases:    ["title", "priority", "status", "notes"],
  completed: ["title", "priority", "status", "notes"],
  planned:   ["title", "priority", "status", "notes"],
  advanced:  ["title", "priority", "status", "notes"],
  compliance:["title", "priority", "status", "notes"],
  growth:    ["title", "status", "notes"]
};

const addFieldLabels = {
  title: "Title/Feature",
  priority: "Priority/Category",
  status: "Status",
  notes: "Notes"
};

document.addEventListener("DOMContentLoaded", async () => {
  renderTabs();
  await renderSections();
  setupTabSwitching();
});

function renderTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach((btn, i) => {
    btn.classList.toggle('active', i === 0);
    // Ensure a <span class="tab-count"></span> exists in the button for count updates
    if (!btn.querySelector('.tab-count')) {
      btn.insertAdjacentHTML('beforeend', ' <span class="tab-count"></span>');
    }
  });
}

function setupTabSwitching() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.roadmap-section').forEach(sec => {
        sec.classList.toggle('active', sec.id === btn.dataset.tab);
      });
    });
  });
}

async function renderSections() {
  const roadmapSections = document.getElementById("roadmap-sections");
  roadmapSections.innerHTML = '';
  // Fetch all roadmap items at once
  const { data, error } = await supabase
    .from('roadmap_items')
    .select('*')
    .order('order', { ascending: true });
  if (error) {
    roadmapSections.innerHTML = `<div style="color:red;">Error loading roadmap: ${error.message}</div>`;
    return;
  }
  SECTIONS.forEach((sec, i) => {
    const sectionDiv = document.createElement("section");
    sectionDiv.className = "roadmap-section" + (i === 0 ? " active" : "");
    sectionDiv.id = sec.id;

    // --- Add Feature Form
    let html = `<h2>${sec.label}</h2>
      <form class="add-feature-form" data-section="${sec.id}">`;
    addFields[sec.id].forEach(field => {
      html += `<input name="${field}" type="text" placeholder="${addFieldLabels[field] || field}"${field === "title" ? " required" : ""}/>`;
    });
    html += `<button type="submit">Add</button></form>`;

    // --- Table
    const cols = columnsBySection[sec.id];
    html += `<table class="card-table"><thead><tr>` +
      cols.map(col => `<th>${col}</th>`).join("") +
      `</tr></thead><tbody id="${sec.id}-tbody"></tbody></table>`;
    sectionDiv.innerHTML = html;
    roadmapSections.appendChild(sectionDiv);

    // Render rows
    renderSectionRows(sec.id, data.filter(x => x.section === sec.id));

    // Add form event
    sectionDiv.querySelector("form.add-feature-form").addEventListener("submit", async e => {
      e.preventDefault();
      const form = e.target;
      const section = sec.id;
      const obj = { section, order: Date.now(), checked: false };
      addFields[section].forEach(f => {
        obj[f] = form[f] ? form[f].value : "";
      });
      if (!obj.title) return;

      // --- VALIDATION: Only send fields that exist in your table!
      // If your Supabase 'roadmap_items' table schema is:
      // id | section | order | checked | title | priority | status | notes
      // Do NOT include extra fields, and all must be lowercase.

      const { error } = await supabase.from("roadmap_items").insert([obj]);
      if (!error) {
        addFields[section].forEach(f => { if (form[f]) form[f].value = ""; });
        await renderSections();
      } else {
        alert('Failed to add item: ' + error.message);
      }
    });
  });

  // --- Count badges for tabs ---
  updateTabCounts(data);
}

// Returns colored badge for status
function statusBadge(status) {
  if (!status) return '';
  const s = String(status).toLowerCase();
  if (s.includes("done") || s.includes("complete") || s === "✅") return '<span class="status done">✅ Complete</span>';
  if (s.includes("danger") || s.includes("high")) return '<span class="status danger">High</span>';
  if (s.includes("optional")) return '<span class="status optional">Optional</span>';
  if (s.includes("pending") || s.includes("planned")) return '<span class="status pending">Planned</span>';
  return `<span class="status">${status}</span>`;
}

function renderSectionRows(section, items) {
  const tbody = document.getElementById(section + "-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  items.forEach(item => {
    let tr = document.createElement("tr");
    let cols = [];

    // PHASES, COMPLETED, PLANNED: [checkbox] [title] [priority] [status] [notes] [buttons]
    if (section === "phases" || section === "completed" || section === "planned") {
      cols.push(`<td><input type="checkbox" ${item.checked ? "checked" : ""} data-id="${item.id}" /></td>`);
      cols.push(`<td contenteditable="true" data-id="${item.id}" data-field="title">${item.title || ""}</td>`);
      cols.push(`<td contenteditable="true" data-id="${item.id}" data-field="priority">${item.priority || ""}</td>`);
      cols.push(`<td contenteditable="true" data-id="${item.id}" data-field="status">${item.status || ""}</td>`);
      cols.push(`<td contenteditable="true" data-id="${item.id}" data-field="notes">${item.notes || ""}</td>`);
    }
    // ADVANCED, COMPLIANCE, GROWTH: [title] [priority] [status] [notes] [buttons/complete]
    else {
      cols.push(`<td contenteditable="true" data-id="${item.id}" data-field="title">${item.title || ""}</td>`);
      cols.push(`<td contenteditable="true" data-id="${item.id}" data-field="priority">${item.priority || ""}</td>`);
      cols.push(`<td contenteditable="true" data-id="${item.id}" data-field="status">${item.status || ""}</td>`);
      cols.push(`<td contenteditable="true" data-id="${item.id}" data-field="notes">${item.notes || ""}</td>`);
    }
    // Status badge column
    cols.push(`<td>${statusBadge(item.status)}</td>`);
    // Buttons
    let btns = `
      <button class="move-btn" title="Move Up" data-dir="-1">&#8593;</button>
      <button class="move-btn" title="Move Down" data-dir="1">&#8595;</button>
      <button class="del-btn" title="Delete">&#10005;</button>`;
    // Add "Mark as Completed" for advanced/compliance/growth
    if (section === "advanced" || section === "compliance" || section === "growth") {
      btns = `<button class="mark-completed-btn" title="Mark as Completed">Mark as Completed</button>` + btns;
    }
    cols.push(`<td>${btns}</td>`);
    tr.innerHTML = cols.join("");
    tbody.appendChild(tr);

    // --- Interactions

    // Checkbox (moves to completed/planned if ticked/unticked)
    if (section === "phases" || section === "completed" || section === "planned") {
      tr.querySelector('input[type="checkbox"]').addEventListener("change", async (e) => {
        const checked = e.target.checked;
        // Planned to completed, completed to planned, etc
        if (section === "planned" && checked) {
          await supabase.from("roadmap_items").update({ section: "completed", checked: true, status: "✅ Complete" }).eq("id", item.id);
        } else if (section === "completed" && !checked) {
          await supabase.from("roadmap_items").update({ section: "planned", checked: false, status: "Planned" }).eq("id", item.id);
        } else {
          await supabase.from("roadmap_items").update({ checked }).eq("id", item.id);
        }
        await renderSections();
      });
    }

    // Editable fields (inline save)
    tr.querySelectorAll('[contenteditable="true"]').forEach(cell => {
      cell.addEventListener("blur", async (e) => {
        const id = cell.dataset.id;
        const field = cell.dataset.field;
        const value = cell.innerText;
        let update = {}; update[field] = value;
        await supabase.from("roadmap_items").update(update).eq("id", id);
      });
    });

    // Move up/down
    tr.querySelectorAll(".move-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const dir = parseInt(btn.dataset.dir, 10);
        const rows = items.sort((a, b) => a.order - b.order);
        const idx = rows.findIndex(x => x.id === item.id);
        const swapIdx = idx + dir;
        if (swapIdx < 0 || swapIdx >= rows.length) return;
        const swapItem = rows[swapIdx];
        await supabase.from("roadmap_items").update({ order: swapItem.order }).eq("id", item.id);
        await supabase.from("roadmap_items").update({ order: item.order }).eq("id", swapItem.id);
        await renderSections();
      });
    });

    // Delete row
    tr.querySelector(".del-btn").addEventListener("click", async () => {
      if (!confirm("Delete this feature?")) return;
      await supabase.from("roadmap_items").delete().eq("id", item.id);
      await renderSections();
    });

    // Mark as Completed button for advanced/compliance/growth
    if (section === "advanced" || section === "compliance" || section === "growth") {
      tr.querySelector(".mark-completed-btn").addEventListener("click", async () => {
        await supabase.from("roadmap_items").update({ section: "completed", checked: true, status: "✅ Complete" }).eq("id", item.id);
        await renderSections();
      });
    }
  });
}

// --- Helper: Live counts in tab badges ---
function updateTabCounts(data) {
  const counts = {};
  SECTIONS.forEach(sec => counts[sec.id] = 0);
  data.forEach(item => {
    if (counts[item.section] !== undefined) counts[item.section]++;
  });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const tab = btn.dataset.tab;
    const span = btn.querySelector('.tab-count');
    if (span) span.textContent = `(${counts[tab] || 0})`;
  });
}
