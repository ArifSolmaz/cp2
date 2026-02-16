/* global loadPyodide */

// ===================== CONFIG =====================
// 1) Paste your Google Apps Script WebApp URL (or any endpoint) here:
const SUBMIT_URL = "https://script.google.com/macros/s/AKfycbxu_JAL7pMXz_7bSGC7kIYvs76UGJji8ubbmr6h7rnLY-M2deKSubTxTiekeKecMclC/exec";

// 2) If your endpoint blocks CORS, you can later switch fetch() to mode:"no-cors" (see submitPayload).
const PYODIDE_JS = "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/pyodide.js";
// ==================================================

function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }

function storageKey(week){ return `phonelab_${week}_draft`; }
function statusKey(week){ return `phonelab_${week}_status`; } // draft/submitted/none

async function ensurePyodideLoaded(){
  if (window.__pyodideReady) return window.__pyodideReady;

  const already = qsa("script").find(s => (s.src || "").includes("pyodide.js"));
  if (!already) {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = PYODIDE_JS;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  window.__pyodideReady = (async () => {
    const pyodide = await loadPyodide();
    window.__pyodide = pyodide;
    return pyodide;
  })();

  return window.__pyodideReady;
}

function indentPython(code){
  return code.split("\n").map(line => "    " + line).join("\n");
}

async function runPythonCapture(code){
  const pyodide = await ensurePyodideLoaded();

  const wrapped = `
import sys, io, traceback
_buf = io.StringIO()
_oldout, _olderr = sys.stdout, sys.stderr
sys.stdout = _buf
sys.stderr = _buf
try:
${indentPython(code)}
except Exception:
    traceback.print_exc()
finally:
    sys.stdout, sys.stderr = _oldout, _olderr
_buf.getvalue()
`;
  try { await pyodide.loadPackagesFromImports(code); } catch (_) {}
  const out = await pyodide.runPythonAsync(wrapped);
  return String(out ?? "");
}

function saveDraft(week, obj){
  localStorage.setItem(storageKey(week), JSON.stringify(obj));
  localStorage.setItem(statusKey(week), "draft");
}

function loadDraft(week){
  const raw = localStorage.getItem(storageKey(week));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function setStatus(week, status){
  localStorage.setItem(statusKey(week), status);
}

function getStatus(week){
  return localStorage.getItem(statusKey(week)) || "none";
}

function updateChip(el, status){
  el.classList.remove("ok","warn");
  if (status === "submitted"){
    el.textContent = "Submitted";
    el.classList.add("ok");
  } else if (status === "draft"){
    el.textContent = "Draft saved";
    el.classList.add("warn");
  } else {
    el.textContent = "Not started";
  }
}

function updateHubChips(){
  qsa("[data-chip]").forEach(chip => {
    const week = chip.getAttribute("data-chip");
    updateChip(chip, getStatus(week));
  });
}

async function submitPayload(payload){
  if (!SUBMIT_URL || SUBMIT_URL.includes("PASTE_YOUR_ENDPOINT_HERE")) {
    throw new Error("SUBMIT_URL is not configured in apps/phonelab/assets/app.js");
  }

  const res = await fetch(SUBMIT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return res;
}

window.PhoneLabUI = {
  updateHubChips,
  ensurePyodideLoaded,
  runPythonCapture,
  saveDraft,
  loadDraft,
  setStatus,
  getStatus,
  submitPayload
};