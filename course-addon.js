/**
 * ═══════════════════════════════════════════════════════════════
 *  COURSE ADDON  —  Drop-in enhancement for lecture HTML pages
 * ═══════════════════════════════════════════════════════════════
 *
 *  FEATURES
 *  ────────
 *  1. Auto-save  : Every textarea (code examples + exercises) saved
 *                   to localStorage on keystroke (debounced 400ms).
 *  2. Save/Reset : Per-exercise  💾 Save  and  ↺ Reset  buttons.
 *  3. Anti-cheat : keystrokeCounts & pasteAttempts persist across
 *                  page refreshes so the submission system stays valid.
 *  4. Form fields: Student ID / Name / Email / Class Code preserved.
 *  5. Example Nav: Stylish left sidebar listing every numbered
 *                  Figure in the page with click-to-scroll.
 *
 *  USAGE
 *  ─────
 *  Add this line before </body> (AFTER your existing <script> block):
 *
 *      <script src="course-addon.js"></script>
 *
 *  That's it. Works on any week's HTML that follows the same structure.
 * ═══════════════════════════════════════════════════════════════
 */

(function () {
  "use strict";

  /* ───── page identifier (used as localStorage namespace) ───── */
  const PAGE_ID = (() => {
    // Try pathname first  →  "Week_01"
    const path = location.pathname.split("/").pop().replace(/\.html?$/i, "");
    if (path) return path;
    // Fallback: first meaningful words from <title>
    return document.title.replace(/[^a-zA-Z0-9]+/g, "_").substring(0, 40);
  })();

  const LS_PREFIX = `cs_${PAGE_ID}_`;

  /* ───── helpers ───── */
  function lsGet(key)          { try { return localStorage.getItem(LS_PREFIX + key); } catch { return null; } }
  function lsSet(key, val)     { try { localStorage.setItem(LS_PREFIX + key, val); } catch {} }
  function lsRemove(key)       { try { localStorage.removeItem(LS_PREFIX + key); } catch {} }
  function lsGetJSON(key, def) { const v = lsGet(key); if (v == null) return def; try { return JSON.parse(v); } catch { return def; } }
  function lsSetJSON(key, obj) { lsSet(key, JSON.stringify(obj)); }

  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  /* ══════════════════════════════════════════════════════════
     1.  INJECT  CSS
     ══════════════════════════════════════════════════════════ */
  const CSS = `
/* ── Overflow fix for exercise panels ── */
.exercise-info-panel{overflow-x:hidden}
.expected-output pre{white-space:pre-wrap;word-wrap:break-word;overflow-wrap:break-word}

/* ── Save / Reset button bar ── */
.ca-btn-bar{display:flex;gap:6px;align-items:center;margin-left:auto;padding-left:12px}
.ca-btn{font-family:system-ui,sans-serif;font-size:0.7rem;font-weight:600;padding:3px 10px;border-radius:5px;border:none;cursor:pointer;opacity:0.7;transition:all .2s;letter-spacing:.02em;white-space:nowrap}
.ca-btn:hover{opacity:1;transform:translateY(-1px)}
.ca-btn-save{background:rgba(5,150,105,.25);color:#6ee7b7}
.ca-btn-save.saved{background:rgba(5,150,105,.45);color:#a7f3d0}
.ca-btn-reset{background:rgba(220,38,38,.2);color:#fca5a5}
.ca-btn-reset:hover{background:rgba(220,38,38,.35)}
.ca-saved-dot{width:6px;height:6px;border-radius:50%;background:#059669;opacity:0;transition:opacity .3s}
.ca-saved-dot.visible{opacity:1}

/* ── Example Navigator Sidebar ── */
.ca-nav-toggle{
  position:fixed;left:0;top:50%;transform:translateY(-50%);z-index:200;
  width:38px;height:38px;border-radius:0 10px 10px 0;border:none;
  background:linear-gradient(135deg,#1a1a2e 60%,#2d1b69);color:#a78bfa;
  cursor:pointer;display:flex;align-items:center;justify-content:center;
  font-size:1rem;box-shadow:2px 2px 16px rgba(0,0,0,.25);
  transition:all .25s cubic-bezier(.4,0,.2,1);
  font-family:system-ui,sans-serif;
}
.ca-nav-toggle:hover{width:44px;background:linear-gradient(135deg,#1a1a2e 40%,#3b2388);color:#c4b5fd}
.ca-nav-toggle.open{left:290px;border-radius:0 10px 10px 0}

.ca-nav-sidebar{
  position:fixed;left:-300px;top:0;bottom:0;width:290px;z-index:199;
  background:#111127;border-right:1px solid rgba(167,139,250,.12);
  transition:left .3s cubic-bezier(.4,0,.2,1);
  display:flex;flex-direction:column;
  box-shadow:4px 0 30px rgba(0,0,0,.4);
}
.ca-nav-sidebar.open{left:0}

.ca-nav-header{
  padding:16px 18px 12px;border-bottom:1px solid rgba(255,255,255,.06);
  display:flex;align-items:center;gap:10px;flex-shrink:0;
}
.ca-nav-header-icon{
  width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;
  background:linear-gradient(135deg,#7c3aed,#a78bfa);font-size:0.85rem;
}
.ca-nav-header-text{font-family:system-ui,sans-serif;font-size:.82rem;font-weight:700;color:rgba(255,255,255,.88);letter-spacing:.03em}

.ca-nav-search{
  margin:0 12px 8px;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.08);
  background:rgba(255,255,255,.04);color:#e0e0e0;font-family:system-ui,sans-serif;font-size:.78rem;
  outline:none;transition:border-color .2s;
}
.ca-nav-search::placeholder{color:rgba(255,255,255,.25)}
.ca-nav-search:focus{border-color:rgba(167,139,250,.4)}

.ca-nav-list{
  flex:1;overflow-y:auto;padding:6px 0 20px;
  scrollbar-width:thin;scrollbar-color:rgba(167,139,250,.2) transparent;
}
.ca-nav-list::-webkit-scrollbar{width:5px}
.ca-nav-list::-webkit-scrollbar-thumb{background:rgba(167,139,250,.2);border-radius:4px}

.ca-nav-group-label{
  padding:14px 18px 6px;font-family:system-ui,sans-serif;font-size:.65rem;font-weight:700;
  text-transform:uppercase;letter-spacing:.1em;color:rgba(167,139,250,.5);
  display:flex;align-items:center;gap:8px;
}
.ca-nav-group-label::after{content:'';flex:1;height:1px;background:rgba(167,139,250,.1)}

.ca-nav-item{
  display:flex;align-items:flex-start;gap:10px;padding:7px 18px;cursor:pointer;
  transition:all .15s;text-decoration:none;border-left:2px solid transparent;
}
.ca-nav-item:hover{background:rgba(167,139,250,.08);border-left-color:rgba(167,139,250,.3)}
.ca-nav-item.active{background:rgba(167,139,250,.12);border-left-color:#a78bfa}

.ca-nav-num{
  flex-shrink:0;width:28px;height:22px;border-radius:5px;display:flex;align-items:center;justify-content:center;
  font-family:'JetBrains Mono',monospace;font-size:.65rem;font-weight:600;
  background:rgba(167,139,250,.12);color:#a78bfa;margin-top:1px;
}
.ca-nav-item.is-exercise .ca-nav-num{background:rgba(5,150,105,.15);color:#6ee7b7}

.ca-nav-title{
  font-family:system-ui,sans-serif;font-size:.76rem;color:rgba(255,255,255,.65);
  line-height:1.45;transition:color .15s;
}
.ca-nav-item:hover .ca-nav-title{color:rgba(255,255,255,.9)}
.ca-nav-item.active .ca-nav-title{color:#e0e0e0}

/* Exercises separator in sidebar */
.ca-nav-exercises-sep{
  margin:10px 18px 4px;padding:10px 0 6px;border-top:1px solid rgba(255,255,255,.06);
}

/* hide on small screens */
@media(max-width:768px){
  .ca-nav-toggle{top:auto;bottom:16px;transform:none;border-radius:0 10px 10px 0;height:42px;width:42px;box-shadow:2px 2px 20px rgba(0,0,0,.5)}
  .ca-nav-toggle.open{left:260px}
  .ca-nav-sidebar{width:260px}
  .ca-nav-sidebar.open{left:0}
}

/* Auto-save indicator (toast) */
.ca-toast{
  position:fixed;bottom:20px;right:20px;z-index:300;
  padding:8px 16px;border-radius:8px;
  background:rgba(5,150,105,.9);color:white;
  font-family:system-ui,sans-serif;font-size:.78rem;font-weight:600;
  opacity:0;transform:translateY(8px);
  transition:all .3s;pointer-events:none;
}
.ca-toast.show{opacity:1;transform:translateY(0)}
`;

  const styleEl = document.createElement("style");
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);


  /* ══════════════════════════════════════════════════════════
     2.  DEFAULTS SNAPSHOT  (before localStorage restore)
     ══════════════════════════════════════════════════════════ */
  const DEFAULTS = {};   // id → original HTML value
  const ALL_EDITORS = []; // all textarea.code-editor on the page

  function snapshotDefaults() {
    document.querySelectorAll("textarea.code-editor").forEach((ta) => {
      if (ta.id) {
        DEFAULTS[ta.id] = ta.value;
        ALL_EDITORS.push(ta);
      }
    });
  }


  /* ══════════════════════════════════════════════════════════
     3.  RESTORE  saved state
     ══════════════════════════════════════════════════════════ */
  function restoreState() {
    /* 3a. textarea values */
    ALL_EDITORS.forEach((ta) => {
      const saved = lsGet("ta_" + ta.id);
      if (saved !== null && saved !== DEFAULTS[ta.id]) {
        ta.value = saved;
        // Fire input event so auto-size mirrors update
        ta.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    /* 3b. anti-cheat counters */
    if (window.keystrokeCounts) {
      const ks = lsGetJSON("keystrokeCounts", {});
      Object.keys(ks).forEach((k) => { if (window.keystrokeCounts[k] !== undefined) window.keystrokeCounts[k] = ks[k]; });
    }
    if (window.pasteAttempts) {
      const pa = lsGetJSON("pasteAttempts", {});
      Object.keys(pa).forEach((k) => { if (window.pasteAttempts[k] !== undefined) window.pasteAttempts[k] = pa[k]; });
    }

    /* 3c. form fields */
    ["studentId", "studentName", "studentEmail", "classCode"].forEach((fid) => {
      const el = document.getElementById(fid);
      const saved = lsGet("form_" + fid);
      if (el && saved !== null) el.value = saved;
    });
  }


  /* ══════════════════════════════════════════════════════════
     4.  AUTO-SAVE  (debounced)
     ══════════════════════════════════════════════════════════ */
  let toastTimer;
  function showToast(msg) {
    let t = document.getElementById("caToast");
    if (!t) { t = document.createElement("div"); t.id = "caToast"; t.className = "ca-toast"; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1400);
  }

  function saveTextarea(ta) {
    if (!ta.id) return;
    lsSet("ta_" + ta.id, ta.value);
  }

  function saveAntiCheat() {
    if (window.keystrokeCounts) lsSetJSON("keystrokeCounts", window.keystrokeCounts);
    if (window.pasteAttempts)   lsSetJSON("pasteAttempts", window.pasteAttempts);
  }

  const debouncedSave = debounce((ta) => {
    saveTextarea(ta);
    saveAntiCheat();
    // Update the save-dot next to this editor
    const dot = ta.closest(".code-figure")?.querySelector(".ca-saved-dot");
    if (dot) { dot.classList.add("visible"); setTimeout(() => dot.classList.remove("visible"), 1500); }
  }, 400);

  function wireAutoSave() {
    ALL_EDITORS.forEach((ta) => {
      ta.addEventListener("input", () => debouncedSave(ta));
      // Also persist anti-cheat on keydown (the original listener counts keystrokes)
      ta.addEventListener("keydown", () => { setTimeout(saveAntiCheat, 50); });
    });

    /* form fields */
    ["studentId", "studentName", "studentEmail", "classCode"].forEach((fid) => {
      const el = document.getElementById(fid);
      if (el) el.addEventListener("input", debounce(() => lsSet("form_" + fid, el.value), 300));
    });
  }


  /* ══════════════════════════════════════════════════════════
     5.  SAVE / RESET  buttons  (per exercise)
     ══════════════════════════════════════════════════════════ */
  function addExerciseButtons() {
    document.querySelectorAll('.code-editor[id^="ex"]').forEach((ta) => {
      const header = ta.closest(".code-figure")?.querySelector(".code-figure-header");
      if (!header) return;

      const bar = document.createElement("span");
      bar.className = "ca-btn-bar";

      // Saved indicator dot
      const dot = document.createElement("span");
      dot.className = "ca-saved-dot";
      if (lsGet("ta_" + ta.id) !== null) { dot.classList.add("visible"); setTimeout(() => dot.classList.remove("visible"), 2000); }

      // Save button
      const saveBtn = document.createElement("button");
      saveBtn.className = "ca-btn ca-btn-save";
      saveBtn.textContent = "💾 Save";
      saveBtn.title = "Save your code to browser storage";
      saveBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        saveTextarea(ta);
        saveAntiCheat();
        saveBtn.classList.add("saved");
        saveBtn.textContent = "✓ Saved";
        showToast("💾 Saved — " + ta.id);
        setTimeout(() => { saveBtn.classList.remove("saved"); saveBtn.textContent = "💾 Save"; }, 1800);
      });

      // Reset button
      const resetBtn = document.createElement("button");
      resetBtn.className = "ca-btn ca-btn-reset";
      resetBtn.textContent = "↺ Reset";
      resetBtn.title = "Reset to original starter code";
      resetBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!confirm("Reset this exercise to starter code? Your changes will be lost.")) return;
        ta.value = DEFAULTS[ta.id] || "";
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        lsRemove("ta_" + ta.id);
        // Reset anti-cheat for this exercise
        if (window.keystrokeCounts && window.keystrokeCounts[ta.id] !== undefined) window.keystrokeCounts[ta.id] = 0;
        if (window.pasteAttempts && window.pasteAttempts[ta.id] !== undefined) window.pasteAttempts[ta.id] = 0;
        saveAntiCheat();
        showToast("↺ Reset — " + ta.id);
      });

      bar.appendChild(dot);
      bar.appendChild(saveBtn);
      bar.appendChild(resetBtn);
      header.appendChild(bar);
    });
  }


  /* ══════════════════════════════════════════════════════════
     6.  EXAMPLE  NAVIGATOR  SIDEBAR
     ══════════════════════════════════════════════════════════ */
  function buildNav() {
    /* ─ Collect all figures ─ */
    const figures = [];
    document.querySelectorAll(".code-figure-label").forEach((label) => {
      const text = label.textContent.trim();
      // Match "Figure X.Y: Title" pattern
      const m = text.match(/^Figure\s+(\d+)\.(\d+)\s*:\s*(.+)$/i);
      if (!m) return;
      const section = parseInt(m[1], 10);
      const sub     = parseInt(m[2], 10);
      const title   = m[3].trim();
      const figEl   = label.closest(".code-figure") || label;
      figures.push({ section, sub, title, el: figEl, num: `${section}.${sub}` });
    });

    /* ─ Collect exercises ─ */
    const exercises = [];
    document.querySelectorAll(".exercise-card").forEach((card) => {
      const numEl   = card.querySelector(".exercise-number");
      const titleEl = card.querySelector(".exercise-title");
      if (!numEl) return;
      const num   = numEl.textContent.trim();
      const title = titleEl ? titleEl.textContent.replace(/^\d+\s*/, "").trim() : "Exercise " + num;
      exercises.push({ num, title, el: card });
    });

    if (figures.length === 0 && exercises.length === 0) return;

    /* ─ Toggle button ─ */
    const toggle = document.createElement("button");
    toggle.className = "ca-nav-toggle";
    toggle.innerHTML = "☰";
    toggle.title = "Code Examples Navigator";
    document.body.appendChild(toggle);

    /* ─ Sidebar ─ */
    const sidebar = document.createElement("div");
    sidebar.className = "ca-nav-sidebar";

    // Header
    const header = document.createElement("div");
    header.className = "ca-nav-header";
    header.innerHTML = `<div class="ca-nav-header-icon">📖</div><div class="ca-nav-header-text">Code Navigator</div>`;
    sidebar.appendChild(header);

    // Search box
    const searchBox = document.createElement("input");
    searchBox.type = "text";
    searchBox.className = "ca-nav-search";
    searchBox.placeholder = "Search examples…";
    sidebar.appendChild(searchBox);

    // Scrollable list
    const list = document.createElement("div");
    list.className = "ca-nav-list";

    /* Group figures by section */
    const sectionMap = new Map();
    figures.forEach((f) => {
      if (!sectionMap.has(f.section)) sectionMap.set(f.section, []);
      sectionMap.get(f.section).push(f);
    });

    /* Try to find section titles from page's own section list */
    const sectionTitles = {};
    // Parse from the `sections` array if available globally
    if (window.sections && Array.isArray(window.sections)) {
      window.sections.forEach((s, i) => { sectionTitles[i + 1] = s.label; });
    }

    /* Render figure groups */
    sectionMap.forEach((figs, secNum) => {
      const groupLabel = document.createElement("div");
      groupLabel.className = "ca-nav-group-label";
      groupLabel.textContent = sectionTitles[secNum] ? `§${secNum} ${sectionTitles[secNum]}` : `Section ${secNum}`;
      list.appendChild(groupLabel);

      figs.forEach((f) => {
        const item = document.createElement("a");
        item.className = "ca-nav-item";
        item.dataset.search = f.title.toLowerCase();
        item.innerHTML = `<span class="ca-nav-num">${f.num}</span><span class="ca-nav-title">${f.title}</span>`;
        item.addEventListener("click", () => {
          f.el.scrollIntoView({ behavior: "smooth", block: "center" });
          // Brief highlight
          f.el.style.outline = "2px solid #a78bfa";
          f.el.style.outlineOffset = "4px";
          setTimeout(() => { f.el.style.outline = "none"; }, 2500);
          highlightActive(item);
        });
        list.appendChild(item);
      });
    });

    /* Render exercises */
    if (exercises.length > 0) {
      const sep = document.createElement("div");
      sep.className = "ca-nav-exercises-sep";
      list.appendChild(sep);

      const exLabel = document.createElement("div");
      exLabel.className = "ca-nav-group-label";
      exLabel.textContent = "Practice Exercises";
      list.appendChild(exLabel);

      exercises.forEach((ex) => {
        const item = document.createElement("a");
        item.className = "ca-nav-item is-exercise";
        item.dataset.search = ex.title.toLowerCase();
        item.innerHTML = `<span class="ca-nav-num">Ex${ex.num}</span><span class="ca-nav-title">${ex.title}</span>`;
        item.addEventListener("click", () => {
          ex.el.scrollIntoView({ behavior: "smooth", block: "center" });
          ex.el.style.outline = "2px solid #059669";
          ex.el.style.outlineOffset = "4px";
          setTimeout(() => { ex.el.style.outline = "none"; }, 2500);
          highlightActive(item);
        });
        list.appendChild(item);
      });
    }

    sidebar.appendChild(list);
    document.body.appendChild(sidebar);

    /* ─ Highlight active ─ */
    function highlightActive(activeItem) {
      list.querySelectorAll(".ca-nav-item").forEach((i) => i.classList.remove("active"));
      if (activeItem) activeItem.classList.add("active");
    }

    /* ─ Toggle open/close ─ */
    let navOpen = false;
    toggle.addEventListener("click", () => {
      navOpen = !navOpen;
      sidebar.classList.toggle("open", navOpen);
      toggle.classList.toggle("open", navOpen);
      toggle.innerHTML = navOpen ? "✕" : "☰";
    });

    /* Close when clicking outside on mobile */
    document.addEventListener("click", (e) => {
      if (navOpen && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
        navOpen = false;
        sidebar.classList.remove("open");
        toggle.classList.remove("open");
        toggle.innerHTML = "☰";
      }
    });

    /* ─ Search / filter ─ */
    searchBox.addEventListener("input", () => {
      const q = searchBox.value.toLowerCase().trim();
      list.querySelectorAll(".ca-nav-item").forEach((item) => {
        const match = !q || item.dataset.search.includes(q) || item.querySelector(".ca-nav-num").textContent.toLowerCase().includes(q);
        item.style.display = match ? "" : "none";
      });
      // Hide empty group labels
      list.querySelectorAll(".ca-nav-group-label").forEach((gl) => {
        let next = gl.nextElementSibling;
        let anyVisible = false;
        while (next && !next.classList.contains("ca-nav-group-label") && !next.classList.contains("ca-nav-exercises-sep")) {
          if (next.classList.contains("ca-nav-item") && next.style.display !== "none") anyVisible = true;
          next = next.nextElementSibling;
        }
        gl.style.display = anyVisible ? "" : "none";
      });
    });

    /* ─ Track scroll position → highlight current figure ─ */
    const allNavItems = list.querySelectorAll(".ca-nav-item");
    const allTargets  = [...figures.map((f, i) => ({ el: f.el, navItem: allNavItems[i] }))];
    // Add exercises after figures
    const figCount = figures.length;
    exercises.forEach((ex, i) => {
      const idx = figCount + i;
      if (allNavItems[idx]) allTargets.push({ el: ex.el, navItem: allNavItems[idx] });
    });

    const navObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const match = allTargets.find((t) => t.el === entry.target);
          if (match) highlightActive(match.navItem);
        }
      });
    }, { rootMargin: "-20% 0px -60% 0px" });

    allTargets.forEach((t) => navObserver.observe(t.el));
  }


  /* ══════════════════════════════════════════════════════════
     7.  PATCH  originalExerciseCode
     ══════════════════════════════════════════════════════════
     The page's own DOMContentLoaded sets originalExerciseCode
     from the CURRENT textarea value. But if we've already
     restored from localStorage, those are no longer the true
     originals. We need to overwrite with our DEFAULTS snapshot.
  */
  function patchOriginals() {
    if (!window.originalExerciseCode) return;
    Object.keys(DEFAULTS).forEach((id) => {
      if (id.startsWith("ex")) {
        window.originalExerciseCode[id] = DEFAULTS[id];
      }
    });
  }


  /* ══════════════════════════════════════════════════════════
     BOOT
     ══════════════════════════════════════════════════════════ */
  function boot() {
    snapshotDefaults();     // 1. Capture original HTML values
    restoreState();         // 2. Overwrite with saved values
    wireAutoSave();         // 3. Start listening
    addExerciseButtons();   // 4. Add Save/Reset buttons
    buildNav();             // 5. Build sidebar navigator

    // Patch originals AFTER the page's own DOMContentLoaded has run
    // Use a short delay to ensure it fires after the page's listeners
    setTimeout(patchOriginals, 200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

})();
