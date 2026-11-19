// Leonida Legend — offline GTA VI trophy guide and tracker.
// Loads app/data/trophies.json (same-origin, works with the network off),
// renders the checklist, and keeps earned trophies in localStorage.
// No network request is ever made: source links are plain anchors the
// reader may follow, and every file the page loads lives under app/.

const DATA_URL = "data/trophies.json";
const STORAGE_KEY = "gta6-trophy-tracker-v1";
const PLATINUM_HOURS = "about 200 hours";

const KIND_LABELS = {
  story: "Story",
  missable: "Missable",
  collectibles: "Collectibles",
  activities: "Activities",
  online: "Online",
};

const FILTERS = [
  { id: "all", label: "All 55" },
  { id: "story", label: "Story" },
  { id: "missable", label: "Missable" },
  { id: "collectibles", label: "Collectibles" },
  { id: "activities", label: "Activities" },
  { id: "online", label: "Online" },
  { id: "earned", label: "Earned" },
  { id: "remaining", label: "Still to earn" },
];

const GRADE_ORDER = { platinum: 0, gold: 1, silver: 2, bronze: 3 };

const ROADMAP_STAGES = [
  {
    title: "Stage 1 — Play the story",
    hours: "60–80 hours",
    text: "Finish all five chapters with Jason and Lucia. Do the Chapter 1 balcony meditation the morning after Down to Earth, take optional missions as they appear, scan every new vehicle with WAiNK and study every new animal through the binoculars — all of it counts later.",
    trophies: "Story trophies, the Chapter 1 meditation, and the early activity trophies.",
  },
  {
    title: "Stage 2 — 100% completion and the open world",
    hours: "About 100 hours",
    text: "After the story the 100% checklist opens under Progress, then Stats. Clear its robberies, collectibles, races, shooting ranges, drone trials, stunts and challenges — most side trophies land on this road, including the gold for A Long Road.",
    trophies: "A Long Road, the collectibles, the robberies, the races and the miscellaneous trophies.",
  },
  {
    title: "Stage 3 — Strangers & Freaks and cleanup",
    hours: "10–20 hours",
    text: "Finish the eight qualifying stranger strands, the final missions for Andy, Kenton, Billy, Randy and Tyrone, and anything left on the checklist. The platinum pops when the last trophy does.",
    trophies: "Strangers & Freaks, the five character strands, and Vice Got a Price!",
  },
];

const CHECKLIST_ROWS = [
  ["Main story", "All chapters"],
  ["Optional missions", "Any 100"],
  ["Gang operations", "39 of 39"],
  ["Bank jobs", "22 of 22"],
  ["Payday loan jobs", "7 of 7"],
  ["Bank vaults", "8 of 8"],
  ["Smash 'N' Grabs", "34 of 35"],
  ["Stick Ups", "50 of 91"],
  ["Narcotics fenced", "$100,000"],
  ["Jewelry fenced", "$100,000"],
  ["Marked bills fenced", "$250,000"],
  ["Vehicles fenced", "$200,000"],
  ["Kenton's treasure sets", "5 of 7"],
  ["Collectible card sets", "15 of 18"],
  ["WAiNK locations", "100 scans"],
  ["Underwater discoveries", "33 of 33"],
  ["Magazines, books and comics", "30 of 34"],
  ["Meditations", "15 of 18"],
  ["Cocaine Flamingos", "100 of 125"],
  ["Unique playlists", "2 of 2"],
  ["Discovered styles", "70 of 79"],
  ["Base-model vehicles", "200 of 277"],
  ["Standard issue weapons", "50 of 66"],
  ["Animals studied", "100 of 255"],
  ["Unique races won", "30 of 40"],
  ["Race challenge gold medals", "10 of 13"],
  ["Shooting range gold medals", "42 of 42"],
  ["Video games played", "All 4"],
  ["Pool opponents beaten", "5 of 7"],
  ["Mini golf", "2 of 3 locations"],
  ["Basketball hoops", "90 of 100"],
  ["Drone time trials", "42 of 42"],
  ["Stunts", "300 of 397"],
  ["Challenges", "70 of 80"],
  ["Bret's target decks", "15 of 15"],
];

const state = {
  trophies: [],
  earned: new Set(),
  spoiler: false,
  filter: "all",
  search: "",
  sort: "default",
  collapsedGuides: new Set(),
};

const els = {
  factStrip: document.getElementById("factStrip"),
  progressCount: document.getElementById("progressCount"),
  progressBar: document.getElementById("progressBar"),
  progressFill: document.getElementById("progressFill"),
  progressNote: document.getElementById("progressNote"),
  gradeCounts: document.getElementById("gradeCounts"),
  exportBtn: document.getElementById("exportBtn"),
  importBtn: document.getElementById("importBtn"),
  importFile: document.getElementById("importFile"),
  resetBtn: document.getElementById("resetBtn"),
  spoilerToggle: document.getElementById("spoilerToggle"),
  roadmapList: document.getElementById("roadmapList"),
  checklistTable: document.getElementById("checklistTable").querySelector("tbody"),
  listHeading: document.getElementById("listHeading"),
  searchInput: document.getElementById("searchInput"),
  sortSelect: document.getElementById("sortSelect"),
  filterBar: document.getElementById("filterBar"),
  listStatus: document.getElementById("listStatus"),
  trophyList: document.getElementById("trophyList"),
  emptyNote: document.getElementById("emptyNote"),
};

function gradeLabel(grade) {
  return grade.charAt(0).toUpperCase() + grade.slice(1);
}

function formatCount(trophy) {
  if (trophy.count === null || trophy.count === undefined) return null;
  if (trophy.count >= 1000) return trophy.count.toLocaleString("en-US");
  return String(trophy.count);
}

function stageText(stage) {
  return stage === 1
    ? "Roadmap stage 1 — play the story"
    : stage === 2
      ? "Roadmap stage 2 — 100% cleanup"
      : "Roadmap stage 3 — final cleanup";
}

function trophyMatchesFilter(trophy) {
  if (state.filter === "earned") return state.earned.has(trophy.id);
  if (state.filter === "remaining") return !state.earned.has(trophy.id);
  if (state.filter === "missable") return trophy.missable === true;
  if (state.filter === "online") return trophy.kind === "online";
  if (state.filter === "all") return true;
  return trophy.kind === state.filter;
}

function trophyMatchesSearch(trophy) {
  if (!state.search) return true;
  const haystack = [trophy.name, trophy.description, trophy.guide, KIND_LABELS[trophy.kind] || ""]
    .join(" ")
    .toLowerCase();
  return haystack.includes(state.search);
}

function visibleTrophies() {
  const list = state.trophies.filter((t) => trophyMatchesFilter(t) && trophyMatchesSearch(t));
  if (state.sort === "grade") {
    list.sort((a, b) => GRADE_ORDER[a.grade] - GRADE_ORDER[b.grade] || a.id - b.id);
  } else if (state.sort === "name") {
    list.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    list.sort((a, b) => a.id - b.id);
  }
  return list;
}

function saveProgress() {
  const payload = {
    version: 1,
    earned: [...state.earned].sort((a, b) => a - b),
    spoiler: state.spoiler,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    // Private browsing or a full store: the checklist still works in memory.
  }
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const payload = JSON.parse(raw);
    if (Array.isArray(payload.earned)) {
      state.earned = new Set(payload.earned.filter((id) => Number.isInteger(id)));
    }
    state.spoiler = payload.spoiler === true;
  } catch (error) {
    // A damaged save is ignored rather than wiping the page.
  }
}

function renderFacts() {
  const counts = { platinum: 0, gold: 0, silver: 0, bronze: 0, hidden: 0 };
  for (const trophy of state.trophies) {
    counts[trophy.grade] += 1;
    if (trophy.hidden) counts.hidden += 1;
  }
  const facts = [
    `<strong>${state.trophies.length}</strong> trophies`,
    `<strong>${counts.platinum}</strong> platinum`,
    `<strong>${counts.gold}</strong> gold`,
    `<strong>${counts.silver}</strong> silver`,
    `<strong>${counts.bronze}</strong> bronze`,
    `<strong>${counts.hidden}</strong> hidden`,
    `<strong>0</strong> online`,
    `<strong>${PLATINUM_HOURS}</strong> to platinum`,
  ];
  els.factStrip.innerHTML = facts.map((fact) => `<li>${fact}</li>`).join("");
}

function renderProgress() {
  const total = state.trophies.length;
  const earned = state.earned.size;
  const percent = total ? Math.round((earned / total) * 100) : 0;
  els.progressCount.textContent = `${earned} of ${total} earned — ${percent}%`;
  els.progressBar.setAttribute("aria-valuenow", String(earned));
  els.progressFill.style.width = `${percent}%`;
  const byGrade = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  const totals = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  for (const trophy of state.trophies) {
    totals[trophy.grade] += 1;
    if (state.earned.has(trophy.id)) byGrade[trophy.grade] += 1;
  }
  els.gradeCounts.innerHTML = ["platinum", "gold", "silver", "bronze"]
    .map((grade) => `<span><b>${byGrade[grade]}/${totals[grade]}</b> ${gradeLabel(grade)}</span>`)
    .join("");
  els.progressNote.textContent =
    earned === total && total > 0
      ? "Platinum complete — you are a Leonida Legend."
      : earned === 0
        ? "Tick a trophy when you earn it in-game. Your checklist is saved in this browser."
        : `${total - earned} to go. The missable trophy is Positive Mental Attitude — do the Chapter 1 meditation.`;
}

function renderRoadmap() {
  els.roadmapList.innerHTML = ROADMAP_STAGES.map((stage, index) => {
    const stageTrophies = state.trophies.filter((t) => t.stage === index + 1).length;
    return `<li class="roadmap-stage">
      <span class="stage-num" aria-hidden="true">${index + 1}</span>
      <div>
        <h3>${stage.title} <span class="stage-hours">· ${stage.hours}</span></h3>
        <p>${stage.text}</p>
        <p class="stage-trophies"><strong>${stageTrophies} trophies</strong> — ${stage.trophies}</p>
      </div>
    </li>`;
  }).join("");
  els.checklistTable.innerHTML = CHECKLIST_ROWS.map(
    ([what, needed]) => `<tr><td>${what}</td><td>${needed}</td></tr>`,
  ).join("");
}

function countForFilter(id) {
  if (id === "all") return state.trophies.length;
  if (id === "earned") return state.earned.size;
  if (id === "remaining") return state.trophies.length - state.earned.size;
  if (id === "missable") return state.trophies.filter((t) => t.missable === true).length;
  if (id === "online") return 0;
  return state.trophies.filter((t) => t.kind === id).length;
}

function renderFilters() {
  els.filterBar.innerHTML = FILTERS.map((filter) => {
    return `<button type="button" class="filter-chip" data-filter="${filter.id}" aria-pressed="${state.filter === filter.id}">${filter.label} (${countForFilter(filter.id)})</button>`;
  }).join("");
  for (const chip of els.filterBar.querySelectorAll(".filter-chip")) {
    chip.addEventListener("click", () => {
      state.filter = chip.dataset.filter;
      renderFilters();
      renderList();
    });
  }
}

function sourceLinks(trophy) {
  return trophy.sources
    .map((source) => {
      const anchor = document.createElement("a");
      anchor.href = source.url;
      anchor.textContent = source.name;
      anchor.target = "_blank";
      anchor.rel = "noopener";
      return anchor.outerHTML;
    })
    .join(" · ");
}

function buildTrophyCard(trophy) {
  const earned = state.earned.has(trophy.id);
  const spoilerMasked = state.spoiler && trophy.kind === "story" && !earned;
  const collapsed = state.collapsedGuides.has(trophy.id);

  const item = document.createElement("li");
  item.className = `trophy-card${earned ? " earned" : ""}${spoilerMasked ? " spoiler-hidden" : ""}`;
  item.id = `trophy-${trophy.id}`;

  const tags = [];
  tags.push(`<li class="tag-kind-${trophy.kind}">${KIND_LABELS[trophy.kind] || trophy.kind}</li>`);
  if (trophy.hidden) tags.push(`<li class="tag-hidden">Hidden on PSN</li>`);
  if (trophy.missable) tags.push(`<li class="tag-missable">⚠ Missable</li>`);
  const count = formatCount(trophy);
  if (count !== null) tags.push(`<li>Target: ${count}</li>`);
  tags.push(`<li>${stageText(trophy.stage)}</li>`);

  const name = spoilerMasked ? "Hidden story trophy — earn it to reveal" : trophy.name;
  const description = spoilerMasked
    ? "Its name and description stay hidden while spoiler mode is on."
    : trophy.description;
  const guide = spoilerMasked
    ? "This guide is hidden too — it names the mission. Earn the trophy in-game (or switch spoiler mode off) to read it."
    : trophy.guide;

  item.innerHTML = `<div class="trophy-main">
    <label class="earn-check">
      <span class="visually-hidden">Mark ${name} as earned</span>
      <input type="checkbox" data-trophy-id="${trophy.id}" ${earned ? "checked" : ""}>
    </label>
    <div class="trophy-body">
      <h3><span class="grade-dot ${trophy.grade}" aria-hidden="true"></span>${name} <span class="grade-label">${gradeLabel(trophy.grade)}</span></h3>
      <p class="trophy-desc">${description}</p>
      <ul class="trophy-tags">${tags.join("")}</ul>
      <div class="trophy-guide-wrap" ${collapsed ? "hidden" : ""}>
        <p class="trophy-guide"><strong>How to earn it:</strong> ${guide}</p>
        <p class="trophy-sources">Sources: ${sourceLinks(trophy)}</p>
      </div>
    </div>
  </div>
  <div class="trophy-detail">
    <button type="button" data-guide-toggle="${trophy.id}">${collapsed ? "Show guide" : "Hide guide"}</button>
    <p class="trophy-when">${spoilerMasked ? "Story trophy — hidden by spoiler mode." : stageText(trophy.stage) + (trophy.missable ? " · Do the Chapter 1 meditation before the chapter ends." : "")}</p>
  </div>`;

  const checkbox = item.querySelector("input[type=checkbox]");
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) state.earned.add(trophy.id);
    else state.earned.delete(trophy.id);
    saveProgress();
    renderProgress();
    renderFilters();
    renderList();
  });

  const toggle = item.querySelector("[data-guide-toggle]");
  toggle.addEventListener("click", () => {
    if (state.collapsedGuides.has(trophy.id)) state.collapsedGuides.delete(trophy.id);
    else state.collapsedGuides.add(trophy.id);
    renderList();
  });

  return item;
}

function renderList() {
  const visible = visibleTrophies();
  els.trophyList.replaceChildren(...visible.map(buildTrophyCard));
  els.emptyNote.hidden = visible.length > 0;
  const shown = visible.length;
  const total = state.trophies.length;
  const earnedShown = visible.filter((t) => state.earned.has(t.id)).length;
  els.listStatus.textContent =
    state.filter === "online"
      ? "No online trophies: all 55 are earned in single-player. This filter is empty on purpose."
      : `Showing ${shown} of ${total} trophies · ${earnedShown} earned in this view.`;
  els.listHeading.textContent =
    state.filter === "all" ? "All 55 trophies" : `${FILTERS.find((f) => f.id === state.filter).label} trophies`;
}

function exportProgress() {
  const payload = {
    app: "Leonida Legend — GTA VI trophy tracker",
    version: 1,
    exportedAt: new Date().toISOString(),
    earned: [...state.earned].sort((a, b) => a - b),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "gta6-trophy-progress.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function importProgressFile(file) {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const payload = JSON.parse(String(reader.result));
      const earned = Array.isArray(payload.earned) ? payload.earned : payload;
      if (!Array.isArray(earned)) throw new Error("not a progress file");
      const valid = new Set(state.trophies.map((t) => t.id));
      const next = new Set();
      for (const id of earned) if (valid.has(id)) next.add(id);
      state.earned = next;
      saveProgress();
      renderProgress();
      renderFilters();
      renderList();
      els.listStatus.textContent = `Imported ${next.size} earned trophies from ${file.name}.`;
    } catch (error) {
      els.listStatus.textContent = `Could not import ${file.name}: it is not a progress file from this tracker.`;
    }
  });
  reader.readAsText(file);
}

function applyHashState() {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const filter = hash.get("filter");
  if (filter && FILTERS.some((f) => f.id === filter)) state.filter = filter;
  if (hash.get("spoiler") === "on") state.spoiler = true;
  if (hash.get("spoiler") === "off") state.spoiler = false;
  const openId = Number.parseInt(hash.get("trophy") || "", 10);
  if (Number.isInteger(openId)) {
    state.collapsedGuides.clear();
    requestAnimationFrame(() => {
      const card = document.getElementById(`trophy-${openId}`);
      if (card) card.scrollIntoView({ block: "center" });
    });
  }
}

async function boot() {
  loadProgress();
  applyHashState();
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`Could not load ${DATA_URL}: ${response.status}`);
  const data = await response.json();
  state.trophies = data.trophies;

  els.spoilerToggle.checked = state.spoiler;
  els.spoilerToggle.addEventListener("change", () => {
    state.spoiler = els.spoilerToggle.checked;
    saveProgress();
    renderList();
  });
  els.searchInput.addEventListener("input", () => {
    state.search = els.searchInput.value.trim().toLowerCase();
    renderList();
  });
  els.sortSelect.addEventListener("change", () => {
    state.sort = els.sortSelect.value;
    renderList();
  });
  els.exportBtn.addEventListener("click", exportProgress);
  els.importBtn.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", () => {
    const file = els.importFile.files && els.importFile.files[0];
    if (file) importProgressFile(file);
    els.importFile.value = "";
  });
  els.resetBtn.addEventListener("click", () => {
    if (window.confirm("Clear every tick on this checklist?")) {
      state.earned.clear();
      saveProgress();
      renderProgress();
      renderFilters();
      renderList();
    }
  });

  renderFacts();
  renderProgress();
  renderRoadmap();
  renderFilters();
  renderList();
}

boot().catch((error) => {
  els.listStatus.textContent = `The trophy list could not load: ${error.message}`;
});
