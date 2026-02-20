// ---------- Data & config ----------
const STORAGE_KEY = "qualifications_form_v1";

const LEVEL_OPTIONS = {
  gcse: ["GCSE", "Functional Skills Level 2", "O Level"],
  l3: ["A Level", "T Level", "BTEC Level 3", "Level 3 Apprenticeship", "Applied General"],
  higher: ["Level 4 Certificate", "Level 5 Diploma", "Level 6 Degree", "Foundation Degree", "Bachelor's Degree", "Master's Degree"]
};

/** @type {{gcse:any[], l3:any[], higher:any[], extenuating:string}} */
let state = {
  gcse: [],
  l3: [],
  higher: [],
  extenuating: ""
};

// ---------- Helpers ----------
const $ = (sel) => document.querySelector(sel);

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 1800);
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      state = {
        gcse: Array.isArray(parsed.gcse) ? parsed.gcse : [],
        l3: Array.isArray(parsed.l3) ? parsed.l3 : [],
        higher: Array.isArray(parsed.higher) ? parsed.higher : [],
        extenuating: typeof parsed.extenuating === "string" ? parsed.extenuating : ""
      };
    }
  } catch {
    // ignore
  }
}

function calcProgress() {
  let score = 0;

  const gcse = state.gcse;
  const hasGcse = gcse.length > 0;
  const subj = gcse.map((x) => (x.subject || "").toLowerCase());
  const hasMaths = subj.some((s) => s.includes("math"));
  const hasEnglish = subj.some((s) => s.includes("english"));

  if (hasGcse) score += 20;
  if (hasMaths) score += 10;
  if (hasEnglish) score += 10;

  if (state.l3.length > 0) score += 30;
  if (state.higher.length > 0) score += 20;

  if ((state.extenuating || "").trim().length >= 20) score += 10;

  return Math.min(100, Math.max(0, score));
}

function setProgressUI() {
  const pct = calcProgress();
  $("#pct").textContent = pct + "%";
  $("#barFill").style.width = pct + "%";
}

function renderSection(key) {
  const items = state[key];
  const empty = $("#" + key + "Empty");
  const wrap = $("#" + key + "TableWrap");
  const tbody = $("#" + key + "Tbody");

  if (items.length === 0) {
    empty.classList.remove("hidden");
    wrap.classList.add("hidden");
    tbody.innerHTML = "";
  } else {
    empty.classList.add("hidden");
    wrap.classList.remove("hidden");
    tbody.innerHTML = items.map((q, idx) => `
      <tr>
        <td>${escapeHtml(q.subject)}</td>
        <td>${escapeHtml(q.level)}</td>
        <td>${escapeHtml(q.grade)}</td>
        <td>${escapeHtml(q.year || "")}</td>
        <td>
          <button data-del="${key}:${idx}" type="button">
            <svg class="icon" aria-hidden="true"><use href="#i-trash"></use></svg>
            Delete
          </button>
        </td>
      </tr>
    `).join("");
  }
}

function renderAll() {
  renderSection("gcse");
  renderSection("l3");
  renderSection("higher");
  setProgressUI();
}

// ---------- Modal + Custom Dropdown ----------
let modalSection = "gcse";

function ddClose() {
  const dd = $("#qLevelDD");
  const btn = $("#qLevelBtn");
  if (!dd || !btn) return;
  dd.classList.remove("open");
  btn.setAttribute("aria-expanded", "false");
}

function ddOpen() {
  const dd = $("#qLevelDD");
  const btn = $("#qLevelBtn");
  if (!dd || !btn) return;
  dd.classList.add("open");
  btn.setAttribute("aria-expanded", "true");
}

function ddSetValue(val) {
  $("#qLevel").value = val;
  $("#qLevelValue").textContent = val || "Select Level";
  const dd = $("#qLevelDD");
  dd.classList.toggle("has-value", !!val);

  // mark selected
  $("#qLevelMenu").querySelectorAll(".dd-item").forEach((b) => {
    b.classList.toggle("selected", b.getAttribute("data-level") === val);
  });
}

function openModal(sectionKey) {
  modalSection = sectionKey;

  $("#modalTitle").textContent =
    sectionKey === "gcse" ? "Add GCSE" :
    sectionKey === "l3" ? "Add Level 3 Qualification" :
    "Add Higher Level Qualification";

  // reset fields
  $("#qSubject").value = "";
  $("#qGrade").value = "";
  $("#qYear").value = "";

  // build dropdown menu
  const menu = $("#qLevelMenu");
  menu.innerHTML = LEVEL_OPTIONS[sectionKey].map((opt) => `
    <button type="button" class="dd-item" role="option" data-level="${escapeHtml(opt)}">
      <span>${escapeHtml(opt)}</span>
      <span class="dd-check">✓</span>
    </button>
  `).join("");

  // reset dropdown value
  ddSetValue("");
  ddClose();

  $("#modalErr").classList.remove("show");
  $("#modalErr").textContent = "";

  $("#backdrop").classList.add("open");
  setTimeout(() => $("#qSubject").focus(), 50);
}

function closeModal() {
  $("#backdrop").classList.remove("open");
  ddClose();
}

function showModalError(msg) {
  const el = $("#modalErr");
  el.textContent = msg;
  el.classList.add("show");
}

function addFromModal() {
  const subject = $("#qSubject").value.trim();
  const level = $("#qLevel").value.trim();   // hidden input
  const grade = $("#qGrade").value.trim();
  const yearRaw = $("#qYear").value.trim();

  if (!subject) return showModalError("Subject is required (e.g., Mathematics).");
  if (!level) return showModalError("Level/Type is required.");
  if (!grade) return showModalError("Grade is required (e.g., A*, 9, Distinction).");

  let year = "";
  if (yearRaw) {
    if (!/^\d{4}$/.test(yearRaw)) return showModalError("Year must be 4 digits (e.g., 2024) or left blank.");
    year = yearRaw;
  }

  state[modalSection].push({ subject, level, grade, year });
  saveToStorage();
  renderAll();
  closeModal();
  toast("Added.");
}

// ---------- Submit / Draft ----------
function validateBeforeSubmit() {
  const subj = state.gcse.map((x) => (x.subject || "").toLowerCase());
  const hasMaths = subj.some((s) => s.includes("math"));
  const hasEnglish = subj.some((s) => s.includes("english"));

  const problems = [];
  if (state.gcse.length === 0) problems.push("Please add at least one GCSE or equivalent.");
  if (!hasMaths) problems.push("GCSE section should include Maths (subject containing “Math”).");
  if (!hasEnglish) problems.push("GCSE section should include English (subject containing “English”).");
  return problems;
}

function doSubmit() {
  const issues = validateBeforeSubmit();
  if (issues.length) {
    alert("Please fix the following before submitting:\n\n- " + issues.join("\n- "));
    return;
  }

  const payload = {
    gcse: state.gcse,
    level3: state.l3,
    higher: state.higher,
    extenuating: (state.extenuating || "").trim() || null,
    submittedAt: new Date().toISOString()
  };

  $("#submitOut").classList.remove("hidden");
  $("#payloadPre").textContent = JSON.stringify(payload, null, 2);
  toast("Submitted (demo).");
}

function doSaveDraft() {
  // only extenuating is editable on page
  const textArea = $("#extenuating");
  state.extenuating = textArea ? textArea.value : state.extenuating;
  saveToStorage();
  setProgressUI();
  toast("Saved as draft.");
}

// ---------- Events ----------
document.addEventListener("click", (e) => {
  const openBtn = e.target.closest("[data-open-modal]");
  if (openBtn) {
    openModal(openBtn.getAttribute("data-open-modal"));
    return;
  }

  const delBtn = e.target.closest("[data-del]");
  if (delBtn) {
    const [key, idxStr] = delBtn.getAttribute("data-del").split(":");
    const idx = Number(idxStr);
    if (Number.isFinite(idx)) {
      state[key].splice(idx, 1);
      saveToStorage();
      renderAll();
      toast("Deleted.");
    }
    return;
  }

  // dropdown open/close outside click
  const dd = $("#qLevelDD");
  if (dd?.classList.contains("open")) {
    if (!dd.contains(e.target)) ddClose();
  }
});

// Modal buttons
$("#closeModal").addEventListener("click", closeModal);
$("#cancelModal").addEventListener("click", closeModal);
$("#addBtn").addEventListener("click", addFromModal);

// Backdrop click to close modal (but not when clicking inside modal)
$("#backdrop").addEventListener("click", (e) => {
  if (e.target === $("#backdrop")) closeModal();
});

// Custom dropdown interactions
$("#qLevelBtn").addEventListener("click", () => {
  const dd = $("#qLevelDD");
  if (!dd) return;
  dd.classList.contains("open") ? ddClose() : ddOpen();
});

$("#qLevelMenu").addEventListener("click", (e) => {
  const item = e.target.closest(".dd-item");
  if (!item) return;
  const val = item.getAttribute("data-level") || "";
  ddSetValue(val);
  ddClose();
  $("#qGrade").focus();
});

// Keyboard
document.addEventListener("keydown", (e) => {
  const modalOpen = $("#backdrop").classList.contains("open");

  if (e.key === "Escape" && modalOpen) {
    closeModal();
    return;
  }

  // Enter submits modal (unless dropdown is open)
  if (e.key === "Enter" && modalOpen) {
    if ($("#qLevelDD")?.classList.contains("open")) return;
    const tag = (document.activeElement?.tagName || "").toLowerCase();
    if (tag !== "textarea") addFromModal();
  }
});

// Save + Submit
$("#saveDraft").addEventListener("click", doSaveDraft);

$("#submit").addEventListener("click", () => {
  const textArea = $("#extenuating");
  state.extenuating = textArea ? textArea.value : state.extenuating;
  saveToStorage();
  doSubmit();
  setProgressUI();
});

// Extenuating Circumstances accordion
(() => {
  const extCard = document.getElementById("extCard");
  const extToggle = document.getElementById("extToggle");
  const textArea = document.getElementById("extenuating");

  if (!extCard || !extToggle) return;

  // load saved text
  if (textArea) {
    textArea.value = state.extenuating || "";
    textArea.addEventListener("input", () => {
      state.extenuating = textArea.value;
      saveToStorage();
      setProgressUI();
    });
  }

  extToggle.addEventListener("click", () => {
    const isOpen = extCard.classList.toggle("open");
    extToggle.setAttribute("aria-expanded", String(isOpen));
  });
})();

// ---------- Init ----------
loadFromStorage();
renderAll();