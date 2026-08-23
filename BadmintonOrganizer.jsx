import React, { useState, useEffect, useMemo, useRef } from "react";
import { User, Search, Camera, Plus, Trash2, Check, X, Shuffle, Play, RotateCcw, Minus, ChevronDown, Clock, Lock, Unlock, Calendar, ChevronRight, History, ClipboardList, Undo2, Info, QrCode, Maximize2, Wallet, Trophy, Upload, Share2, LogOut, Download } from "lucide-react";

const APP_VERSION = "1.11.6";

const LEVELS = ["R", "BG1", "BG2", "BG3", "S-", "S", "N-", "N", "P-", "P", "C"];
const WEIGHT = { R: 1, BG1: 2, BG2: 3, BG3: 4, "S-": 5, S: 6, "N-": 7, N: 8, "P-": 9, P: 10, C: 11 };
const LEVEL_COLOR = {
  R: "#64748b", BG1: "#0284c7", BG2: "#0891b2", BG3: "#0d9488", "S-": "#16a34a",
  S: "#65a30d", "N-": "#ca8a04", N: "#d97706", "P-": "#ea580c", P: "#dc2626", C: "#b91c1c",
};

/* ============ LEVEL PRESET SYSTEM ============
   Canonical source of truth for matchmaking is the numeric skillIndex (1–11), stored per player.
   A "preset" only controls the DISPLAY label shown for each skillIndex — swapping presets never
   changes skillIndex, so matchmaking / fairness / queue priority are unaffected. */
const LEVEL_COLORS_BY_INDEX = ["#64748b", "#0284c7", "#0891b2", "#0d9488", "#16a34a", "#65a30d", "#ca8a04", "#d97706", "#ea580c", "#dc2626", "#b91c1c"];
function levelColor(skillIndex) { return LEVEL_COLORS_BY_INDEX[Math.max(1, Math.min(11, skillIndex || 1)) - 1]; }
const SKILL_DESC = {
  1: "เริ่มต้น — เพิ่งเริ่มจับไม้ ยังไม่คุ้นการตีโต้",
  2: "เริ่มตี — เริ่มตีโต้ได้บ้าง ยังไม่นิ่ง",
  3: "พื้นฐาน — ตีโต้ได้พอสมควร เริ่มคุมลูก และเล่นเกมได้ในระดับพื้นฐาน",
  4: "เล่นเป็นเกม — เริ่มเข้าใจแทคติก เล่นเป็นเกมได้",
  5: "กลางล่าง — ตีได้หลากหลายลูก คุมเกมได้ระดับหนึ่ง",
  6: "กลาง — เล่นได้คล่อง มีจังหวะ คุมเกมได้ดี",
  7: "กลางสูง — ตีแม่นขึ้น มีกลยุทธ์ชัดเจน",
  8: "มือดี — ควบคุมเกมได้ดี ตีได้หลากหลายจังหวะ",
  9: "มือแข็ง — ฝีมือสูง แข่งขันได้ในระดับก๊วน",
  10: "แข่งขัน — ระดับแข่งขันจริงจัง",
  11: "ระดับสูง — ฝีมือสูงสุด เล่นแข่งขันระดับสูง",
};
const LEVEL_PRESETS = [
  { id: "isan", name: "อีสาน", description: "ใช้ลำดับ: R → BG1 → BG2 → BG3 → S- → S → N- → N → P- → P → C", levels: ["R", "BG1", "BG2", "BG3", "S-", "S", "N-", "N", "P-", "P", "C"] },
  { id: "badweb-central", name: "Bad Web / กลาง", description: "ใช้ลำดับ: BG → BG+ → NB → N- → N → NS → S → P- → P → P+ → C", levels: ["BG", "BG+", "NB", "N-", "N", "NS", "S", "P-", "P", "P+", "C"] },
  { id: "north", name: "เหนือ / เชียงใหม่", description: "ใช้ลำดับ: มือหัดตี → Beginner → ตีโต้ → N → N+ → S → S+ → P- → P → Open → Open+", levels: ["มือหัดตี", "Beginner", "ตีโต้", "N", "N+", "S", "S+", "P-", "P", "Open", "Open+"] },
];
function getPresetMeta(id) {
  if (id === "custom") return { id: "custom", name: "กำหนดเอง", description: "Organizer กำหนดระดับฝีมือเองได้ โดย map เข้ากับ Skill Index 1–11" };
  return LEVEL_PRESETS.find((p) => p.id === id) || LEVEL_PRESETS[0];
}
// display label for a given skillIndex, resolved against whichever preset is currently active (incl. custom)
function displayLevelFor(skillIndex, settings) {
  const idx = Math.max(1, Math.min(11, skillIndex || 1));
  const presetId = (settings && settings.levelPresetId) || "isan";
  if (presetId === "custom") {
    const found = ((settings && settings.customLevels) || []).find((l) => l.skillIndex === idx);
    return found ? found.name : ("Skill " + idx);
  }
  const preset = LEVEL_PRESETS.find((p) => p.id === presetId) || LEVEL_PRESETS[0];
  return preset.levels[idx - 1] || ("Skill " + idx);
}
// { skillIndex, label } options for level <select> dropdowns, reflecting the active preset
function activeLevelOptions(settings) {
  const presetId = (settings && settings.levelPresetId) || "isan";
  if (presetId === "custom") {
    return ((settings && settings.customLevels) || []).slice().sort((a, b) => a.skillIndex - b.skillIndex).map((l) => ({ skillIndex: l.skillIndex, label: l.name }));
  }
  const preset = LEVEL_PRESETS.find((p) => p.id === presetId) || LEVEL_PRESETS[0];
  return preset.levels.map((label, i) => ({ skillIndex: i + 1, label }));
}
const T = {
  bg: "#f3f6f4", surface: "#ffffff", surface2: "#eef2f0", border: "#dde5e1",
  text: "#16241d", muted: "#6b7d74", accent: "#ef5a44", green: "#12986a", blue: "#2563eb", amber: "#d97706",
};
const STATUS = {
  next: { label: "เกมต่อไป", color: "#2563eb", bg: "#e7effd" },
  playing: { label: "ระหว่างเกม", color: "#12986a", bg: "#e2f5ec" },
  done: { label: "เกมจบ", color: "#6b7d74", bg: "#eef2f0" },
};
// player attendance status (playing = derived from active match, not stored)
// v1.9.17: "registered" (ลงทะเบียน) sits between "absent" and "ready" — means "said they're coming, not
// here/eligible yet". It is NOT matchmaking-eligible: every eligibility filter in this file checks
// `status === "ready"` specifically, so simply not being "ready" already keeps "registered" out of Auto
// Matchmaking with zero further changes there. It IS session-scoped exactly like every other status here
// (endSession()/resetAllToAbsent() already reset ALL statuses back to "absent" uniformly).
const PSTATUS = {
  absent: { label: "ไม่ได้มา", color: "#6b7d74", bg: "#eef2f0" },
  registered: { label: "ลงทะเบียน", color: "#4f46e5", bg: "#eef0fd" },
  ready: { label: "พร้อมเล่น", color: "#12986a", bg: "#e2f5ec" },
  playing: { label: "กำลังเล่น", color: "#2563eb", bg: "#e7effd" },
  resting: { label: "พัก", color: "#d97706", bg: "#fef3ec" },
  left: { label: "กลับแล้ว", color: "#9333ea", bg: "#f1eafd" },
};
const PSTATUS_OPTS = ["absent", "registered", "ready", "resting", "left"];
// v1.9.17: handedness badge on the Player Card — a violet distinct from every skill-level color
// (LEVEL_COLORS_BY_INDEX has no purple), every PSTATUS color, T.blue, and T.accent, as specified.
// v1.11.1: ขวา (right) and ซ้าย (left) now get their own distinct colors (previously both purple,
// making them indistinguishable at a glance in the player list) — right keeps the original violet,
// left gets a magenta/pink that isn't used anywhere else in the badge system.
const HAND_BADGE = {
  right: { color: "#7c3aed", bg: "#efe7fc" },
  left: { color: "#db2777", bg: "#fce7f3" },
};
const HAND_LABEL = { left: "ซ้าย", right: "ขวา" };
// v1.11.5: Member/Guest badge — informational only (see spec: must never affect matchmaking/skill/
// attendance/tournament logic). Gold for Member (visually distinct from every skill-level color, every
// PSTATUS color, and HAND_BADGE's violet/magenta), neutral gray for Guest.
const MEMBER_TYPE_META = {
  member: { label: "Member", color: "#92650a", bg: "#fdf1d9", border: "#e8c374" },
  guest: { label: "Guest", color: "#5b6672", bg: "#eceff2", border: "#c7cdd4" },
};
const LEVEL_HELP = "เรียงจากเริ่มต้น → เก่งสุด: R (มือใหม่) · BG1-3 (มือบ้าน) · S-/S · N-/N · P-/P · C (เก่งสุด)";
// backward-compatible: old data used `present` boolean; old data also has no skillIndex yet — derive it
// from the (isan-based) label so matchmaking strength is 100% preserved across the upgrade.
// v1.9.17: `handedness` ("left"|"right") is PERMANENT player data (unlike `status`, which is
// session-scoped) — old players/backups have no such field at all, so default/migrate them to "right"
// here, same as a brand-new player (see addPlayer). `handPref` ("preferLeft"|"avoidLeft"|null) is the
// optional SOFT matchmaking preference "อยากคู่/ไม่อยากคู่กับมือซ้าย" — set via the existing lock-pair
// editor (see setHandPref/LockPairEditor), never a value the UI writes directly onto a fresh player.
// v1.11.5: phone/lineId/memberType are PERMANENT player data, same category as handedness above — old
// players/backups have none of these fields, so default them here exactly like every other back-compat
// field: memberType defaults to "member" (never silently "guest"), phone/lineId default to "" (never
// null, so controlled <input> elements never warn about switching from uncontrolled).
const normPlayer = (p) => ({ ...p, status: p.status || (p.present ? "ready" : "absent"), waitTotal: p.waitTotal || 0, waitCount: p.waitCount || 0, waitMax: p.waitMax || 0, paid: p.paid || false, discount: p.discount || 0, wheelDiscount: p.wheelDiscount || 0, pendingDiscount: p.pendingDiscount || 0, carriedInDiscount: p.carriedInDiscount || 0, spun: p.spun || false, wheelResult: p.wheelResult || null, skillIndex: p.skillIndex || WEIGHT[p.level] || 1, handedness: p.handedness === "left" ? "left" : "right", handPref: p.handPref === "preferLeft" || p.handPref === "avoidLeft" ? p.handPref : null, memberType: p.memberType === "guest" ? "guest" : "member", phone: p.phone || "", lineId: p.lineId || "", archived: p.archived === true, archivedAt: p.archivedAt || null });

// true once the viewport is wide enough to benefit from a landscape/tablet layout (multi-column court
// cards, wider content column) — re-evaluated live on rotate/resize, no page reload needed.
function useIsWide() {
  const [isWide, setIsWide] = useState(() => (typeof window !== "undefined" ? window.matchMedia("(min-width: 700px)").matches : false));
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 700px)");
    const onChange = () => setIsWide(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange); else mq.addListener(onChange);
    return () => { if (mq.removeEventListener) mq.removeEventListener("change", onChange); else mq.removeListener(onChange); };
  }, []);
  return isWide;
}
const uid = () => Math.random().toString(36).slice(2, 9);
// v1.9.17: weight for the SOFT "อยากคู่/ไม่อยากคู่กับมือซ้าย" preference inside buildMatch's doubles
// scoring (see handPrefNudge) — small relative to balance(*2)/partner-repeat(*3)/opponent-repeat(*1.2)
// terms, so it nudges which otherwise-similar split gets picked without ever overriding real match
// quality or blocking a match from forming (that's what makes it a soft, not hard, constraint).
const HAND_PREF_WEIGHT = 1;
const keyOf = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
// pair-rule types: "lock" (force as partners, doubles only), "avoidPartner" (never on the same team),
// "avoidOpponent" (never on opposing teams / never face each other), "avoidBoth" (never in the same
// match at all). Backward-compat: old backups store lockPairs as plain [a,b] 2-element arrays, which
// always meant "lock" — migrate those into the new {id,a,b,type} shape without losing any data.
function migrateLockPairs(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((lp) => {
    if (Array.isArray(lp)) return lp[0] && lp[1] ? { id: uid(), a: lp[0], b: lp[1], type: "lock" } : null;
    if (lp && typeof lp === "object" && lp.a != null && lp.b != null) return { id: lp.id || uid(), a: lp.a, b: lp.b, type: lp.type || "lock" };
    return null;
  }).filter(Boolean);
}
// find the (at most one) active rule between two specific players, order-independent
function ruleBetween(lockPairs, a, b) { return (lockPairs || []).find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a)) || null; }

// court/field DISPLAY labels — decoupled from the internal court INDEX (1..courtCount) that all
// match/slot logic (occupied-sets, tapSlot, tStartMatch, etc.) still keys off unchanged. A venue may
// number its physical courts non-sequentially (e.g. 1, 3, 5); courtLabels just maps index -> shown text.
// Always returns a fresh array of exactly `count` entries, keeping any existing edited labels and
// defaulting new/missing slots to sequential numbers.
function syncCourtLabels(labels, count) {
  const arr = Array.isArray(labels) ? labels.slice(0, count) : [];
  while (arr.length < count) arr.push(String(arr.length + 1));
  return arr;
}
function courtLabelFor(labels, idx) {
  const v = Array.isArray(labels) ? labels[idx - 1] : null;
  return v != null && String(v).trim() !== "" ? String(v) : String(idx);
}
// backward-compat for Tournament objects saved before per-court labels existed (or missing/short arrays)
// v1.10.0: renamed from ensureTournamentCourtLabels (kept doing exactly what it did, court-label sync,
// plus now also backfills every field added by the Tournament Profile/Finance upgrade) so old saved
// tournaments — from before logo/venue/description/registration/finance existed — load with safe
// defaults instead of `undefined`, without ever touching any of their existing data.
function normTournament(t) {
  if (!t || typeof t !== "object") return t;
  return {
    ...t,
    courtLabels: syncCourtLabels(t.courtLabels, t.courtCount || 2),
    logo: t.logo || null,
    venue: t.venue || "",
    description: t.description || "",
    registration: t.registration && typeof t.registration === "object"
      ? { feeMode: "none", feeAmount: 0, paidTeamIds: [], ...t.registration }
      : { feeMode: "none", feeAmount: 0, paidTeamIds: [] },
    finance: t.finance && typeof t.finance === "object"
      ? { income: Array.isArray(t.finance.income) ? t.finance.income : [], expense: Array.isArray(t.finance.expense) ? t.finance.expense : [] }
      : { income: [], expense: [] },
  };
}
const kcomb = (arr, k) => {
  const res = [];
  const rec = (start, cur) => {
    if (cur.length === k) { res.push([...cur]); return; }
    for (let i = start; i < arr.length; i++) { cur.push(arr[i]); rec(i + 1, cur); cur.pop(); }
  };
  rec(0, []);
  return res;
};

function counts(matches) {
  const partner = {}, opp = {};
  for (const m of matches) {
    const A = (m.teamA || []).filter(Boolean), B = (m.teamB || []).filter(Boolean);
    for (const t of [A, B]) for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) { const k = keyOf(t[i], t[j]); partner[k] = (partner[k] || 0) + 1; }
    for (const x of A) for (const y of B) { const k = keyOf(x, y); opp[k] = (opp[k] || 0) + 1; }
  }
  return { partner, opp };
}

function buildMatch(pool, mode, lockPairs, players, stats) {
  const need = mode === "doubles" ? 4 : 2;
  if (pool.length < need) return null;
  const w = (id) => players.find((p) => p.id === id)?.skillIndex || 0;
  const anchor = pool[0].id;
  const win = pool.slice(0, Math.min(pool.length, mode === "doubles" ? 8 : 6)).map((p) => p.id);
  const idxOf = (id) => win.indexOf(id);
  const pc = (a, b) => stats.partner[keyOf(a, b)] || 0;
  const oc = (a, b) => stats.opp[keyOf(a, b)] || 0;

  if (mode === "singles") {
    let best = null;
    for (const o of win) {
      if (o === anchor) continue;
      const r = ruleBetween(lockPairs, anchor, o);
      if (r && (r.type === "avoidOpponent" || r.type === "avoidBoth")) continue; // hard filter: never face / never meet
      const score = Math.abs(w(anchor) - w(o)) * 2 + oc(anchor, o) * 3 + idxOf(o) * 0.6;
      if (!best || score < best.score) best = { score, teamA: [anchor], teamB: [o] };
    }
    return best;
  }

  const others = win.filter((id) => id !== anchor);
  let forced = null;
  for (const r of lockPairs) {
    if (r.type !== "lock") continue;
    if (r.a === anchor && others.includes(r.b)) forced = r.b;
    if (r.b === anchor && others.includes(r.a)) forced = r.a;
  }
  const lockOk = (A, B) => {
    for (const r of lockPairs) {
      const inFour = [...A, ...B];
      if (!inFour.includes(r.a) || !inFour.includes(r.b)) continue;
      const sameA = A.includes(r.a) && A.includes(r.b), sameB = B.includes(r.a) && B.includes(r.b);
      if (r.type === "lock") { if (!sameA && !sameB) return false; } // must be partnered together
      else if (r.type === "avoidPartner") { if (sameA || sameB) return false; } // must not be partnered
      else if (r.type === "avoidOpponent") { if (!sameA && !sameB) return false; } // must not face each other
      else if (r.type === "avoidBoth") { return false; } // must not appear in the same match at all
    }
    return true;
  };
  // v1.9.17: "อยากคู่/ไม่อยากคู่กับมือถนัดซ้าย" — a SOFT preference, never a hard filter (unlike lockOk
  // above). Nudges the score for a candidate partnership x+y up/down; if NO split satisfies anyone's
  // preference the match still forms normally, just picking whichever split scores lowest overall.
  const handPrefNudge = (x, y) => {
    const px = players.find((pp) => pp.id === x), py = players.find((pp) => pp.id === y);
    if (!px || !py) return 0;
    const of = (pref, partner) => (pref === "preferLeft" ? (partner.handedness === "left" ? -HAND_PREF_WEIGHT : 0) : pref === "avoidLeft" ? (partner.handedness === "left" ? HAND_PREF_WEIGHT : 0) : 0);
    return of(px.handPref, py) + of(py.handPref, px);
  };
  let best = null;
  for (const trio of kcomb(others, 3)) {
    const four = [anchor, ...trio];
    if (forced && !four.includes(forced)) continue;
    const splits = [
      [[four[0], four[1]], [four[2], four[3]]],
      [[four[0], four[2]], [four[1], four[3]]],
      [[four[0], four[3]], [four[1], four[2]]],
    ];
    for (const [A, B] of splits) {
      if (forced && !(A.includes(anchor) && A.includes(forced))) continue;
      if (!lockOk(A, B)) continue;
      const bal = Math.abs(w(A[0]) + w(A[1]) - w(B[0]) - w(B[1]));
      const pRep = pc(A[0], A[1]) + pc(B[0], B[1]);
      const oRep = oc(A[0], B[0]) + oc(A[0], B[1]) + oc(A[1], B[0]) + oc(A[1], B[1]);
      const waitPen = idxOf(trio[0]) + idxOf(trio[1]) + idxOf(trio[2]);
      const handPen = handPrefNudge(A[0], A[1]) + handPrefNudge(B[0], B[1]);
      const score = bal * 2 + pRep * 3 + oRep * 1.2 + waitPen * 0.4 + handPen;
      if (!best || score < best.score) best = { score, teamA: A, teamB: B };
    }
  }
  return best;
}

function genRound(localPlayers, mode, courtCount, lockPairs, stats, roundIndex, reserved) {
  const rs = reserved || new Set();
  const order = localPlayers.filter((p) => p.status === "ready" && !rs.has(p.id)).sort(SORT); // fairness-weighted (see SORT below)
  const used = new Set(rs);
  const matches = [];
  for (let i = 0; i < courtCount; i++) {
    const pool = order.filter((p) => !used.has(p.id));
    const m = buildMatch(pool, mode, lockPairs, localPlayers, stats);
    if (!m) break;
    [...m.teamA, ...m.teamB].filter(Boolean).forEach((id) => {
      used.add(id);
      const lp = localPlayers.find((p) => p.id === id);
      if (lp) lp.lastPlayedRound = roundIndex;
    });
    matches.push({ id: uid(), mode, source: "casual", teamA: m.teamA, teamB: m.teamB, status: "next", round: roundIndex, court: i + 1, locked: false });
  }
  return matches;
}

// ===================== NEXT-MATCH QUEUE / RESERVATION (v1.9.4) =====================
// A court's live match can carry a PREPARED "queued" next match (m.queued = {teamA, teamB} | null),
// set up ahead of time via "+ จัดเกมถัดไป" — see App()'s setQueuedSlot/autoQueueNext/clearQueuedNext and
// SessionTab's QueueNextSheet. This is the ONLY new persisted field the feature needs (per IMPLEMENTATION
// PRINCIPLE: no duplicate sources of truth) — reservation status is derived live from it every render via
// reservedIdsFromCurrent, never stored separately, so cancelling/editing a queued match instantly and
// correctly frees/re-reserves its players with zero extra bookkeeping.
//
// Every player seated ANYWHERE right now — in a live match's teamA/teamB (any status) OR prepared into
// some court's queued next match — is "reserved" and must never be auto-assigned to a DIFFERENT court's
// next match at the same time (requirement: Court 2's queued player is off-limits to Court 3's auto-fill).
function reservedIdsFromCurrent(matches) {
  const out = new Set();
  for (const m of matches || []) {
    [...(m.teamA || []), ...(m.teamB || [])].filter(Boolean).forEach((id) => out.add(id));
    if (m.queued) [...(m.queued.teamA || []), ...(m.queued.teamB || [])].filter(Boolean).forEach((id) => out.add(id));
  }
  return out;
}
// promotes a court's prepared queued match into the live "next" slot (paired, awaiting manual เริ่มเกม —
// same status/flow as an auto-paired match) instead of running fresh auto-pairing — used by both
// nextCourt() and finishAndAdvance() so a prepared match is always honored no matter which finish path the
// organizer takes ("Current match ends but prepared next match exists → preserve prepared match").
function promoteQueued(m, seq, court) {
  if (!m.queued) return null;
  return { id: uid(), mode: m.mode, source: "casual", teamA: m.queued.teamA, teamB: m.queued.teamB, status: "next", round: seq, court, locked: false };
}
// compact one-line summary for the "เกมถัดไป" mini-row, e.g. "Sun + Best vs Game + James"
function queuedSummary(q, getP) {
  const nm = (id) => (id ? (getP(id)?.name || "-") : "ว่าง");
  const line = (arr) => (arr || []).map(nm).join(" + ");
  return `${line(q.teamA)} vs ${line(q.teamB)}`;
}

// fairness: 0-100, higher = more balanced. Uses existing team strength (weight sums).
function fairnessPct(sA, sB) {
  const hi = Math.max(sA, sB), lo = Math.min(sA, sB);
  if (hi <= 0) return 100;
  return Math.round((lo / hi) * 100);
}
function fairnessTag(pct) {
  if (pct >= 90) return { emoji: "👍", label: "สูสี", color: "#12986a" };
  if (pct >= 75) return { emoji: "⚖️", label: "พอสูสี", color: "#d97706" };
  return { emoji: "⚠️", label: "ห่างกัน", color: "#ef5a44" };
}

// ---- scoring / stats (win/loss from matches that have a score OR an explicit win/lose pick) ----
// a round counts as "scored" if it has a numeric a/b OR a manually-picked win side (no numbers needed).
function hasScore(m) { return !!(m && m.scores && m.scores.some((r) => r && (r.a != null || r.b != null || r.win != null))); }
// per-round winner: numeric a/b (when both present) always wins out and auto-decides the round;
// only falls back to the organizer's manual win/lose pick when no numeric score was entered.
function roundWinner(r) {
  if (!r) return null;
  if (r.a != null && r.b != null) {
    const a = Number(r.a) || 0, b = Number(r.b) || 0;
    if (a === b) return null;
    return a > b ? "A" : "B";
  }
  return r.win || null;
}
function matchWinner(m) {
  if (!hasScore(m)) return null;
  let ca = 0, cb = 0;
  for (const r of m.scores) {
    const w = roundWinner(r);
    if (w === "A") ca++; else if (w === "B") cb++;
  }
  if (ca > cb) return "A";
  if (cb > ca) return "B";
  return null; // draw / undecided
}
// "rounds" (the จำนวนเซต setting) means "sets needed to win", matching real badminton scoring:
// 1 = single set decides it, 2 = best-of-3 (win 2 of 3), 3 = best-of-5 (win 3 of 5). maxSetsFor() is
// the hard cap on sets a match could ever need; visibleSetCount() is how many set rows ScoreEditor
// should show right now — a new set is revealed only once the previous one is decided, and revealing
// stops the moment either side has already clinched the needed wins (so a 2-0 match never shows a
// pointless 3rd set, but a 1-1 match does).
function maxSetsFor(neededWins) { return Math.max(1, (neededWins || 1) * 2 - 1); }
function visibleSetCount(m, neededWins) {
  const need = neededWins || 1;
  const maxSets = maxSetsFor(need);
  let wa = 0, wb = 0, visible = 1;
  for (let i = 0; i < maxSets; i++) {
    visible = i + 1;
    const w = roundWinner(m && m.scores && m.scores[i]);
    if (w === "A") wa++; else if (w === "B") wb++;
    if (wa >= need || wb >= need) break;
    if (!w) break; // this set isn't decided yet — don't reveal the next one early
  }
  return visible;
}
function roundsLabel(rounds) {
  const r = rounds || 1;
  return r <= 1 ? "1 เซต" : `${r} ใน ${maxSetsFor(r)} เซต`;
}
function playerStats(pid, matches) {
  let win = 0, loss = 0, draw = 0, noScore = 0; const partners = {}, opps = {};
  for (const m of matches) {
    const A = (m.teamA || []).filter(Boolean), B = (m.teamB || []).filter(Boolean);
    const inA = A.includes(pid), inB = B.includes(pid);
    if (!inA && !inB) continue;
    (inA ? A : B).filter((id) => id !== pid).forEach((id) => (partners[id] = (partners[id] || 0) + 1));
    (inA ? B : A).forEach((id) => (opps[id] = (opps[id] || 0) + 1));
    if (!hasScore(m)) { noScore++; continue; }
    const w = matchWinner(m);
    if (w) { if (w === (inA ? "A" : "B")) win++; else loss++; }
    else draw++; // hasScore true but no winner => genuine draw/tie, distinct from noScore
  }
  const decided = win + loss;
  return { win, loss, draw, noScore, winRate: decided ? Math.round((win / decided) * 100) : null, partners, opps };
}
// aggregates one player's Tournament record across tournamentHistory (archived Tournaments only —
// kept fully separate from Casual playerStats(), though the two can be shown side by side).
function tournamentStatsForPlayer(pid, tournamentHistory) {
  let tournaments = 0, matches = 0, wins = 0, losses = 0, championships = 0, runnerUps = 0, thirds = 0;
  (tournamentHistory || []).forEach((t) => {
    const teamIds = new Set((t.teams || []).filter((tm) => (tm.playerIds || []).includes(pid)).map((tm) => tm.id));
    if (teamIds.size === 0) return;
    tournaments++;
    const ps = (t.playerStats || []).find((s) => s.playerId === pid);
    if (ps) { matches += (ps.wins || 0) + (ps.losses || 0); wins += ps.wins || 0; losses += ps.losses || 0; }
    (t.divisions || []).forEach((d) => {
      if (d.champion && teamIds.has(d.champion)) championships++;
      else if (d.runnerUp && teamIds.has(d.runnerUp)) runnerUps++;
      // v1.11.5: third place — prefer the newer d.thirdIds array (supports joint/shared 3rd, set by
      // tCompleteTournament since the Podium redesign) and fall back to the legacy single d.third for
      // tournaments archived before that field existed. Purely additive — championships/runnerUps above
      // are untouched.
      else if (Array.isArray(d.thirdIds) ? d.thirdIds.some((id) => teamIds.has(id)) : (d.third && teamIds.has(d.third))) thirds++;
    });
  });
  return { tournaments, matches, wins, losses, championships, runnerUps, thirds };
}
// ===================== CURRENCY (v1.9.1) =====================
// single source of truth for every money display in the app (Finance/Payment/Historical/Discount Credits)
// — thousands-separated, ฿ symbol, minus sign BEFORE the symbol (-฿1,250), decimals only when present.
// `opts.showPlus` prefixes a "+" on positive amounts (used in transaction-style lists).
function formatCurrency(amount, opts) {
  const showPlus = !!(opts && opts.showPlus);
  const n = Number(amount) || 0;
  const abs = Math.round(Math.abs(n) * 100) / 100; // 2dp max, trimmed below
  const [intPart, decPart] = abs.toString().split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const dec = decPart ? "." + decPart.padEnd(2, "0").slice(0, 2) : "";
  const sign = n < 0 ? "-" : (showPlus && n > 0 ? "+" : "");
  return `${sign}฿${withCommas}${dec}`;
}
// expense: reuse existing court+shuttle logic; split "other" equally among attendees
function computeBill(players, settings) {
  // v1.9.17: "registered" (said they're coming, not arrived/eligible yet) is excluded from billing same
  // as "absent" — only players who actually attended in some capacity (ready/resting/left) are payers.
  const payers = players.filter((p) => p.status && p.status !== "absent" && p.status !== "registered");
  const n = payers.length || 1;
  const otherShare = (settings.other || 0) / n;
  // model D (รายคน) is the ONLY cost model that changes REVENUE — it overrides the flat per-person court
  // charge with settings.perPersonRate and drops the per-game shuttle charge (shuttlecock cost is assumed
  // baked into the flat rate). Every other model (simple/perCourt/hourly/custom) leaves billing byte-for-byte
  // unchanged and instead feeds an auto-suggested EXPENSE line via computeCostModelExpenses() at endSession().
  const perPerson = settings.costModel === "perPerson";
  return payers.map((p) => {
    const court = perPerson ? (settings.perPersonRate || 0) : (settings.court || 0);
    const shuttle = perPerson ? 0 : (p.games || 0) * (settings.shuttle || 0);
    const other = otherShare;
    const discount = p.discount || 0; // per-person discount, entered manually in the player's summary detail
    const wheelDiscount = p.wheelDiscount || 0; // locked discount won from the spin wheel (not manually editable)
    const carriedInDiscount = Math.min(p.carriedInDiscount || 0, wheelDiscount); // portion of wheelDiscount carried over from last session's "ครั้งหน้า" prize
    const total = Math.max(0, Math.round(court + shuttle + other - discount - wheelDiscount));
    return { ...p, eCourt: court, eShuttle: shuttle, eOther: other, eDiscount: discount, eWheelDiscount: wheelDiscount, eCarriedInDiscount: carriedInDiscount, total };
  });
}
// ===================== FLEXIBLE COST MODEL — AUTO EXPENSE LINES (v1.9.4) =====================
// Returns ready-to-file session expense items ({id, category, description, amount, date, auto:true}) for
// the organizer's REAL out-of-pocket cost, per active costModel — feeds the EXISTING session.expenses list
// (same pipeline sessionExpenseTotal/sessionProfit/P&L already read), never a parallel accounting system.
// "simple"/"perPerson" return [] (unchanged — simple stays revenue-only as today; perPerson is a revenue
// override handled entirely inside computeBill above, no expense line needed).
function computeCostModelExpenses(settings, courtCount, courtLabels, dateStr) {
  const model = settings.costModel || "simple";
  const out = [];
  const shuttleLine = () => {
    const { qty, pricePerUnit } = settings.shuttleCalc || {};
    if (qty > 0 && pricePerUnit > 0) out.push({ id: uid(), category: "ค่าลูกแบด", description: `ค่าลูก ${qty} ลูก × ฿${pricePerUnit}`, amount: qty * pricePerUnit, date: dateStr, auto: true });
  };
  if (model === "perCourt") {
    const rates = settings.perCourtRates || [];
    let sum = 0;
    for (let c = 1; c <= courtCount; c++) {
      const r = rates.find((x) => x.court === c);
      if (r && r.amount > 0) sum += Number(r.amount) || 0;
    }
    if (sum > 0) out.push({ id: uid(), category: "ค่าคอร์ท", description: `ค่าคอร์ท ${courtCount} สนาม (แยกราคา)`, amount: sum, date: dateStr, auto: true });
    shuttleLine();
  } else if (model === "hourly") {
    const { courts, rate, hours } = settings.hourly || {};
    if (courts > 0 && rate > 0 && hours > 0) out.push({ id: uid(), category: "ค่าคอร์ท", description: `ค่าคอร์ท ${courts} สนาม × ${hours} ชม. × ฿${rate}`, amount: courts * rate * hours, date: dateStr, auto: true });
    shuttleLine();
  } else if (model === "custom") {
    (settings.customCostRows || []).forEach((r) => { if ((Number(r.amount) || 0) > 0) out.push({ id: uid(), category: r.category || "อื่น ๆ", description: r.description || r.category || "รายการ", amount: Number(r.amount) || 0, date: dateStr, auto: true }); });
  }
  return out; // "simple" | "perPerson" -> []
}
// ===================== FINANCE (v1.8.4) =====================
// Accounting model kept deliberately simple:
//   รายได้ (Revenue)   = sum of what's billed to players this session (computeBill's `total`, regardless of payment status)
//   รับแล้ว (Collected) = sum of `total` for players actually marked paid
//   ค้างรับ (Receivable)= Revenue - Collected (money still owed — NOT an expense)
//   ค่าใช้จ่าย (Expense) = organizer's real out-of-pocket costs, an editable line-item list per session.
//                         "now"/"next" wheel-prize discounts are NOT counted here — they already reduce
//                         Revenue directly via computeBill, so counting them again here would double-count.
//   กำไร/ขาดทุน (Profit) = Revenue - Expense
const EXPENSE_CATEGORIES = ["ค่าคอร์ท", "ค่าลูกแบด", "รางวัล", "อาหาร/น้ำ", "ค่าเดินทาง", "อื่น ๆ"];
// Expense is ONLY what the organizer actually records — never auto-guessed from the ค่าสนาม/ค่าลูก billing
// rate settings (those set what's CHARGED to players, i.e. Revenue — not what the organizer actually paid
// out). A session with no recorded expense items shows ฿0 expense until the organizer adds real ones here.
function sessionExpenseList(s) { return s.expenses || []; }
function sessionRevenue(s) { return (s.bill || []).reduce((sum, b) => sum + (b.total || 0), 0); }
function sessionCollected(s) { return (s.bill || []).filter((b) => b.paid).reduce((sum, b) => sum + (b.total || 0), 0); }
function sessionReceivable(s) { return sessionRevenue(s) - sessionCollected(s); }
function sessionExpenseTotal(s) { return sessionExpenseList(s).reduce((sum, e) => sum + (Number(e.amount) || 0), 0); }
function sessionProfit(s) { return sessionRevenue(s) - sessionExpenseTotal(s); }
// period filter — dates are plain "YYYY-MM-DD" strings throughout the app, so string range comparison is safe
function periodRange(period, custom) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (period === "today") { const t = iso(now); return { from: t, to: t }; }
  if (period === "month") return { from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, to: iso(now) };
  if (period === "lastMonth") {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: iso(lm), to: iso(lastDay) };
  }
  if (period === "year") return { from: `${now.getFullYear()}-01-01`, to: iso(now) };
  if (period === "custom" && custom && custom.from && custom.to) return custom;
  return { from: "0000-01-01", to: "9999-12-31" }; // "all"
}
function inPeriod(dateStr, range) { return !!dateStr && dateStr >= range.from && dateStr <= range.to; }
function lastDayOfMonth(ym) { const [y, m] = ym.split("-").map(Number); return new Date(y, m, 0).getDate(); }
function todayYm() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

// ===================== FINANCE PERIOD AGGREGATION (v1.9.6) =====================
// Single financial calculation source for the whole Finance page — รายวัน/รายเดือน/ภาพรวม all read through
// these instead of each computing its own totals, per the redesign's IMPLEMENTATION PRINCIPLE. Every function
// here reuses the EXISTING sessionRevenue/sessionExpenseTotal/etc — no parallel accounting, no duplicated data.
// v1.11.1: added `tournamentHistory` as a trailing optional param throughout this whole aggregation
// chain (defaults to [] everywhere so any not-yet-updated caller can't crash) — completed Tournaments
// now feed into the SAME overall financial reports as ก๊วน sessions, per organizer request. Only
// ARCHIVED tournaments (tournamentHistory) count, keyed by the Tournament's own `.date` — mirrors how
// the live `session` isn't counted until it's ended into sessionHistory; an in-progress Tournament's
// finances aren't final (registration/expenses can still change) so it stays out of these totals until
// completed, exactly like an ongoing ก๊วน session's revenue doesn't count until it's archived.
function computeFinanceForRange(range, sessionHistory, generalExpenses, otherIncome, tournamentHistory = []) {
  const sessionsInRange = (sessionHistory || []).filter((s) => inPeriod(s.date, range)).sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));
  const genExpInRange = (generalExpenses || []).filter((e) => inPeriod(e.date, range));
  const otherIncInRange = (otherIncome || []).filter((e) => inPeriod(e.date, range));
  const tournamentsInRange = (tournamentHistory || []).filter((t) => inPeriod(t.date, range));
  const sessionRevenueTotal = sessionsInRange.reduce((sum, s) => sum + sessionRevenue(s), 0);
  const sessionCollectedTotal = sessionsInRange.reduce((sum, s) => sum + sessionCollected(s), 0);
  const sessionExpenseSum = sessionsInRange.reduce((sum, s) => sum + sessionExpenseTotal(s), 0);
  const otherIncomeTotal = otherIncInRange.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const genExpenseTotal = genExpInRange.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  // entryFee only ever counts PAID teams and manual finance.income is logged when actually received (no
  // separate paid/unpaid tracking like session bills have) — so, unlike session revenue, ALL Tournament
  // income here is already "collected", not merely billed.
  const tournamentFinances = tournamentsInRange.map((t) => tournamentFinanceTotals(t));
  const tournamentIncomeTotal = tournamentFinances.reduce((s, f) => s + f.income, 0);
  const tournamentExpenseTotal = tournamentFinances.reduce((s, f) => s + f.expense, 0);
  const revenue = sessionRevenueTotal + otherIncomeTotal + tournamentIncomeTotal; // รายได้ = ยอดเรียกเก็บ + รายได้อื่น + รายได้ Tournament
  const collected = sessionCollectedTotal + otherIncomeTotal + tournamentIncomeTotal;
  const expense = sessionExpenseSum + genExpenseTotal + tournamentExpenseTotal;
  const profit = revenue - expense; // กำไร/ขาดทุน = รายได้ - ค่าใช้จ่าย เสมอ (ไม่ใช่ รับแล้ว - ค่าใช้จ่าย)
  const catTotals = {};
  sessionsInRange.forEach((s) => sessionExpenseList(s).forEach((e) => { catTotals[e.category] = (catTotals[e.category] || 0) + (Number(e.amount) || 0); }));
  genExpInRange.forEach((e) => { catTotals[e.category] = (catTotals[e.category] || 0) + (Number(e.amount) || 0); });
  // Tournament expense categories use their own key namespace (see TOURNAMENT_EXPENSE_CATEGORIES) —
  // translated to Thai and prefixed with 🏆 so they read clearly alongside ก๊วน expense categories
  // without colliding with (or being confused for) them in the breakdown.
  tournamentsInRange.forEach((t) => (t.finance?.expense || []).forEach((e) => {
    const key = `🏆 ${TOURNAMENT_EXPENSE_CAT_LABEL[e.category] || e.category}`;
    catTotals[key] = (catTotals[key] || 0) + (Number(e.amount) || 0);
  }));
  return { range, sessionsInRange, genExpInRange, otherIncInRange, tournamentsInRange, sessionRevenueTotal, sessionCollectedTotal, otherIncomeTotal, genExpenseTotal, tournamentIncomeTotal, tournamentExpenseTotal, revenue, collected, expense, profit, catTotals };
}
function getFinanceForDate(dateStr, sessionHistory, generalExpenses, otherIncome, tournamentHistory = []) {
  return computeFinanceForRange({ from: dateStr, to: dateStr }, sessionHistory, generalExpenses, otherIncome, tournamentHistory);
}
function getFinanceForMonth(ym, sessionHistory, generalExpenses, otherIncome, tournamentHistory = []) {
  return computeFinanceForRange({ from: `${ym}-01`, to: `${ym}-${String(lastDayOfMonth(ym)).padStart(2, "0")}` }, sessionHistory, generalExpenses, otherIncome, tournamentHistory);
}
function getFinanceForYear(year, sessionHistory, generalExpenses, otherIncome, tournamentHistory = []) {
  return computeFinanceForRange({ from: `${year}-01-01`, to: `${year}-12-31` }, sessionHistory, generalExpenses, otherIncome, tournamentHistory);
}
function getFinanceAllTime(sessionHistory, generalExpenses, otherIncome, tournamentHistory = []) {
  return computeFinanceForRange({ from: "0000-01-01", to: "9999-12-31" }, sessionHistory, generalExpenses, otherIncome, tournamentHistory);
}
// every "YYYY-MM-DD" with ANY financial activity — a ก๊วน session OR a standalone general-expense/other-income
// entry, OR a completed Tournament's date. A standalone expense with no group still needs to be reachable in
// รายวัน (Requirement 16), so this is NOT just sessionHistory's dates.
function activeDateSet(sessionHistory, generalExpenses, otherIncome, tournamentHistory = []) {
  const set = new Set();
  (sessionHistory || []).forEach((s) => { if (s.date) set.add(s.date); });
  (generalExpenses || []).forEach((e) => { if (e.date) set.add(e.date); });
  (otherIncome || []).forEach((e) => { if (e.date) set.add(e.date); });
  (tournamentHistory || []).forEach((t) => { if (t.date) set.add(t.date); });
  return set;
}
function getActiveDates(ym, sessionHistory, generalExpenses, otherIncome, tournamentHistory = []) {
  const set = activeDateSet(sessionHistory, generalExpenses, otherIncome, tournamentHistory);
  return [...set].filter((d) => d.slice(0, 7) === ym).sort().reverse(); // newest -> oldest
}
// every "YYYY-MM" with activity, across ALL years, newest first — the single list that powers both รายวัน's
// and รายเดือน's month-nav arrows, so "previous" can skip straight over an empty month (or empty year).
function getActiveMonths(sessionHistory, generalExpenses, otherIncome, tournamentHistory = []) {
  const set = activeDateSet(sessionHistory, generalExpenses, otherIncome, tournamentHistory);
  const months = new Set([...set].map((d) => d.slice(0, 7)));
  return [...months].sort().reverse();
}
function getActiveYears(sessionHistory, generalExpenses, otherIncome, tournamentHistory = []) {
  const months = getActiveMonths(sessionHistory, generalExpenses, otherIncome, tournamentHistory);
  const years = new Set(months.map((m) => m.slice(0, 4)));
  return [...years].sort().reverse();
}
// nearest active month strictly before ("prev") or after ("next") ym, from a pre-sorted-descending list —
// works whether or not `ym` itself has data, so month-nav never gets stuck on an empty "current month".
function adjacentActiveMonth(ym, dir, months) {
  if (dir === "prev") { const hit = months.find((m) => m < ym); return hit || null; }
  const greater = months.filter((m) => m > ym);
  return greater.length ? greater[greater.length - 1] : null;
}
// per-day breakdown for one month — powers รายเดือน's "ผลประกอบการรายวัน" drill-down list
function financeByDay(ym, sessionHistory, generalExpenses, otherIncome, tournamentHistory = []) {
  return getActiveDates(ym, sessionHistory, generalExpenses, otherIncome, tournamentHistory).map((d) => {
    const f = getFinanceForDate(d, sessionHistory, generalExpenses, otherIncome, tournamentHistory);
    return { date: d, sessionCount: f.sessionsInRange.length, revenue: f.revenue, expense: f.expense, profit: f.profit };
  });
}
// per-month breakdown for one year (or "all" for lifetime) — powers ภาพรวม's "ผลประกอบการรายเดือน" list
function financeByMonthForYear(year, sessionHistory, generalExpenses, otherIncome, tournamentHistory = []) {
  const months = getActiveMonths(sessionHistory, generalExpenses, otherIncome, tournamentHistory).filter((m) => year === "all" || m.slice(0, 4) === String(year));
  return months.map((ym) => {
    const f = getFinanceForMonth(ym, sessionHistory, generalExpenses, otherIncome, tournamentHistory);
    return { ym, sessionCount: f.sessionsInRange.length, revenue: f.revenue, expense: f.expense, profit: f.profit };
  });
}
function fmtThaiMonthFull(ym) {
  if (!ym) return "-";
  const MO = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return `${MO[m - 1]} ${y + 543}`;
}
function fmtThaiDateFull(iso) {
  if (!iso) return "-";
  const MO = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MO[d.getMonth()]} ${d.getFullYear() + 543}`;
}
function fmtThaiMonthDay(iso) {
  if (!iso) return "-";
  const MO = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MO[d.getMonth()]}`;
}

// ===================== DISCOUNT CREDITS (v1.9.1) =====================
// A reward-wheel "ส่วนลดครั้งหน้า" (next-time discount) win is no longer silently auto-applied to whatever
// session the player next shows up at — it's recorded as an explicit, auditable ledger entry the organizer
// applies (or cancels) by hand. Shape:
//   { id, playerId, playerNameSnapshot, amount, sourceSessionId, sourceRewardId, createdAt,
//     status: "available"|"used"|"cancelled", usedAt, usedSessionId, cancelledAt, note }
// Applying a credit adds its amount onto the player's ordinary manual `discount` field (the same field
// computeBill already reads) — so Revenue/Receivable/P&L all update through the EXISTING accounting logic
// with no separate bookkeeping. An "available" credit therefore has ZERO effect on Revenue/Expense until
// applied; a "cancelled" credit has zero effect ever (it's just a revoked right, not a real transaction).
// Old backups/local saves predate this field entirely — always default to [], never invented from thin air.
function normDiscountCredit(c) {
  return {
    id: c.id || uid(), playerId: c.playerId || null, playerNameSnapshot: c.playerNameSnapshot || "ผู้เล่น",
    amount: Number(c.amount) || 0, sourceSessionId: c.sourceSessionId || null, sourceRewardId: c.sourceRewardId || null,
    createdAt: c.createdAt || Date.now(), status: ["available", "used", "cancelled"].includes(c.status) ? c.status : "available",
    usedAt: c.usedAt || null, usedSessionId: c.usedSessionId || null, cancelledAt: c.cancelledAt || null, note: c.note || null,
  };
}
// resolves a credit's sourceSessionId/usedSessionId to a display label ("ก๊วน AAA · 19 ส.ค. 2569") —
// checks archived sessionHistory first, falls back to the live (not-yet-archived) session if it matches,
// else a generic placeholder (e.g. the session it came from was later deleted from history).
function resolveSessionLabel(sessId, session, sessionHistory) {
  if (!sessId) return null;
  const hist = (sessionHistory || []).find((s) => s.id === sessId);
  if (hist) return `${hist.name || "ก๊วนไม่มีชื่อ"} · ${fmtThaiDate(hist.date)}`;
  if (session && session.id === sessId) return `${session.name || "ก๊วนไม่มีชื่อ"} · ${fmtThaiDate(session.date)}`;
  return "ก๊วนที่ผ่านมา";
}

// ===================== FINANCIAL REPORT EXPORT (v1.9.14) =====================
// Single normalized report builder — reused byTXT/PDF-print/XLSX exporters so every export format shows
// EXACTLY the same numbers as the Finance page (no parallel accounting, per the task's #3/#4 requirements).
// `period` describes what range is being exported (see financePeriodMeta below); `ctx` bundles the raw
// state the report is built from. This function only READS state — never mutates anything (Requirement #19).
function fmtGeneratedAt(ts) {
  const d = new Date(ts);
  const MO = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getDate()} ${MO[d.getMonth()]} ${d.getFullYear() + 543} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// describes which period is currently selected on the Finance page (or a custom override chosen inside the
// export sheet itself) — one shared shape consumed by buildFinancialReport() AND the filename builder, so
// the exported data and the exported filename can never disagree about what range they cover.
function financePeriodMeta(mode, effectiveDate, monthYm, year, custom) {
  if (custom && custom.from && custom.to) {
    const from = custom.from <= custom.to ? custom.from : custom.to;
    const to = custom.from <= custom.to ? custom.to : custom.from;
    return { kind: "custom", range: { from, to }, label: `${fmtThaiDateFull(from)} – ${fmtThaiDateFull(to)}`, filenameStub: `${from}_to_${to}` };
  }
  if (mode === "day") {
    if (!effectiveDate) return null;
    return { kind: "day", range: { from: effectiveDate, to: effectiveDate }, label: fmtThaiDateFull(effectiveDate), filenameStub: effectiveDate };
  }
  if (mode === "month") {
    if (!monthYm) return null;
    return { kind: "month", range: { from: `${monthYm}-01`, to: `${monthYm}-${String(lastDayOfMonth(monthYm)).padStart(2, "0")}` }, label: fmtThaiMonthFull(monthYm), filenameStub: monthYm };
  }
  // mode === "overview" -> follows the ภาพรวม tab's year selector ("YYYY" | "all")
  if (year === "all") return { kind: "all", range: { from: "0000-01-01", to: "9999-12-31" }, label: "ทั้งหมด", filenameStub: "All" };
  return { kind: "year", range: { from: `${year}-01-01`, to: `${year}-12-31` }, label: `ปี ${Number(year) + 543}`, filenameStub: String(year) };
}
// every outstanding (not fully paid) player row across the sessions in range — Requirement #10
function outstandingPaymentsForSessions(sessionsInRange) {
  const rows = [];
  sessionsInRange.forEach((s) => {
    (s.bill || []).forEach((b) => {
      const due = Number(b.total) || 0;
      const collected = b.paid ? due : 0;
      const outstanding = due - collected;
      if (outstanding > 0) rows.push({ date: s.date, sessionName: s.name || "ก๊วนไม่มีชื่อ", playerName: b.name || "ผู้เล่น", due, collected, outstanding });
    });
  });
  return rows;
}
// per-session + per-line-item transaction detail — DISPLAY ONLY (Requirement #9): totals in `summary`/`pnl`
// always come from computeFinanceForRange, never re-summed from this list, so detail and totals can't drift.
function buildTransactionDetail(f) {
  const rows = [];
  f.sessionsInRange.forEach((s) => {
    const rev = sessionRevenue(s);
    if (rev > 0) rows.push({ date: s.date, type: "revenue", category: "ค่าก๊วน", description: s.name || "ก๊วนไม่มีชื่อ", session: s.name || "-", amount: rev });
    sessionExpenseList(s).forEach((e) => rows.push({ date: e.date || s.date, type: "expense", category: e.category || "อื่น ๆ", description: e.description || e.category || "รายการ", session: s.name || "-", amount: Number(e.amount) || 0 }));
  });
  f.otherIncInRange.forEach((e) => rows.push({ date: e.date, type: "revenue", category: "รายได้อื่น", description: e.description || "รายได้อื่น", session: "-", amount: Number(e.amount) || 0 }));
  f.genExpInRange.forEach((e) => rows.push({ date: e.date, type: "expense", category: e.category || "อื่น ๆ", description: e.description || e.category || "รายการ", session: "-", amount: Number(e.amount) || 0 }));
  // v1.11.1: completed Tournaments' own transactions (entry-fee income, sponsor/other income, expenses)
  // shown at line-item level too, same as ก๊วน sessions above — keeps the export/print detail table
  // consistent with the totals in computeFinanceForRange, which already fold these in.
  (f.tournamentsInRange || []).forEach((t) => {
    const entryFee = tournamentEntryFeeTotal(t);
    if (entryFee > 0) rows.push({ date: t.date, type: "revenue", category: "🏆 ค่าสมัคร", description: t.name || "Tournament", session: t.name || "-", amount: entryFee });
    (t.finance?.income || []).forEach((e) => rows.push({ date: t.date, type: "revenue", category: `🏆 ${TOURNAMENT_INCOME_CAT_LABEL[e.category] || e.category}`, description: e.label || t.name || "Tournament", session: t.name || "-", amount: Number(e.amount) || 0 }));
    (t.finance?.expense || []).forEach((e) => rows.push({ date: t.date, type: "expense", category: `🏆 ${TOURNAMENT_EXPENSE_CAT_LABEL[e.category] || e.category}`, description: e.label || e.category || "รายการ", session: t.name || "-", amount: Number(e.amount) || 0 }));
  });
  rows.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  return rows;
}
// THE single normalized report object — TXT/PDF/XLSX all render straight from this, never recompute totals themselves.
function buildFinancialReport(period, ctx) {
  const { sessionHistory, generalExpenses, otherIncome, discountCredits, tournamentHistory = [] } = ctx;
  const f = computeFinanceForRange(period.range, sessionHistory, generalExpenses, otherIncome, tournamentHistory);
  const sessions = f.sessionsInRange.map((s) => ({
    date: s.date,
    name: s.name || "ก๊วนไม่มีชื่อ",
    playerCount: (s.players || []).length,
    matchCount: s.stats && typeof s.stats.totalMatches === "number" ? s.stats.totalMatches : (s.matches || []).length,
    courtCount: s.courtCount || 0,
    revenue: sessionRevenue(s),
    collected: sessionCollected(s),
    receivable: sessionReceivable(s),
    expense: sessionExpenseTotal(s),
    profit: sessionProfit(s),
  }));
  // ส่วนลดคงเหลือ (Requirement #11) — only "available" credits by default; a player who no longer exists
  // in the live roster still shows via the frozen playerNameSnapshot, never dropped/crashed on.
  const discountCreditRows = (discountCredits || []).filter((c) => c.status === "available").map((c) => ({
    playerName: c.playerNameSnapshot || "ผู้เล่น",
    amount: Number(c.amount) || 0,
    sourceSession: resolveSessionLabel(c.sourceSessionId, null, sessionHistory) || "-",
    createdAt: c.createdAt || null,
    status: c.status,
  }));
  return {
    period,
    generatedAt: Date.now(),
    summary: { revenue: f.revenue, collected: f.collected, receivable: f.revenue - f.collected, expense: f.expense, profit: f.profit },
    pnl: { groupRevenue: f.sessionRevenueTotal, otherIncome: f.otherIncomeTotal, tournamentIncome: f.tournamentIncomeTotal, tournamentExpense: f.tournamentExpenseTotal, totalRevenue: f.revenue, expenseByCategory: f.catTotals, totalExpense: f.expense, netProfit: f.profit },
    sessions,
    transactions: buildTransactionDetail(f),
    outstandingPayments: outstandingPaymentsForSessions(f.sessionsInRange),
    discountCredits: discountCreditRows,
  };
}
// filename per Requirement #17 — always the Gregorian year, even though the UI displays พ.ศ. everywhere else
function financeExportFilename(periodMeta, ext) {
  return `BadQ_Finance_${periodMeta.filenameStub}.${ext}`;
}
// shared save/share path for every export format (Requirement #18) — same Web Share API (files) + direct-
// download fallback already proven by the JSON backup export; never throws, always resolves with an outcome.
async function shareOrDownloadBlob(blob, filename, mimeType) {
  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return "done";
      }
    } catch (e) {
      if (e && e.name === "AbortError") return "cancelled";
      // any other share failure: fall through to the direct-download fallback below
    }
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return "done";
  } catch (e) {
    try {
      window.open(URL.createObjectURL(blob), "_blank");
      return "done";
    } catch (e2) {
      return "failed";
    }
  }
}

// ===================== TXT EXPORT (Requirement #12) =====================
// Plain readable text, UTF-8. Deliberately NOT fixed-width-column aligned (Thai glyph widths vary by font/
// app, so exact alignment breaks) — just consistent left-label/right-value spacing, good enough to scan.
function padTxtRow(label, value) {
  const width = 22;
  const gap = Math.max(1, width - label.length);
  return label + " ".repeat(gap) + value;
}
function buildFinancialReportTxt(report) {
  const L = [];
  const sep = "==============================";
  L.push("BadQ — รายงานการเงิน");
  L.push(report.period.label);
  L.push(`สร้างเมื่อ ${fmtGeneratedAt(report.generatedAt)}`);
  L.push(""); L.push(sep); L.push("");
  L.push("สรุป"); L.push("");
  L.push(padTxtRow("รายได้", formatCurrency(report.summary.revenue)));
  L.push(padTxtRow("รับแล้ว", formatCurrency(report.summary.collected)));
  L.push(padTxtRow("ค้างรับ", formatCurrency(report.summary.receivable)));
  L.push(padTxtRow("ค่าใช้จ่าย", formatCurrency(report.summary.expense)));
  L.push(padTxtRow(report.summary.profit < 0 ? "ขาดทุนสุทธิ" : "กำไรสุทธิ", formatCurrency(Math.abs(report.summary.profit))));
  L.push(""); L.push(sep); L.push("");
  L.push("กำไรขาดทุน"); L.push("");
  L.push(padTxtRow("รายได้ค่าก๊วน", formatCurrency(report.pnl.groupRevenue)));
  L.push(padTxtRow("รายได้อื่น", formatCurrency(report.pnl.otherIncome)));
  if (report.pnl.tournamentIncome > 0) L.push(padTxtRow("รายได้ Tournament", formatCurrency(report.pnl.tournamentIncome)));
  L.push(padTxtRow("รายได้รวม", formatCurrency(report.pnl.totalRevenue)));
  L.push(""); L.push("ค่าใช้จ่าย");
  Object.entries(report.pnl.expenseByCategory).filter(([, amt]) => amt > 0).forEach(([cat, amt]) => { L.push(padTxtRow(cat, formatCurrency(amt))); });
  L.push(""); L.push(padTxtRow("ค่าใช้จ่ายรวม", formatCurrency(report.pnl.totalExpense)));
  L.push(""); L.push(padTxtRow(report.pnl.netProfit < 0 ? "ขาดทุนสุทธิ" : "กำไรสุทธิ", formatCurrency(Math.abs(report.pnl.netProfit))));
  L.push(""); L.push(sep); L.push("");
  L.push("รายก๊วน"); L.push("");
  if (report.sessions.length === 0) {
    L.push("ไม่มีก๊วนในช่วงเวลานี้");
  } else {
    report.sessions.forEach((s) => {
      L.push(`${fmtThaiDateFull(s.date)} | ${s.name}`);
      L.push(`ผู้เล่น ${s.playerCount} คน · ${s.matchCount} แมตช์ · ${s.courtCount} สนาม`);
      L.push(`รายได้ ${formatCurrency(s.revenue)}`);
      L.push(`ค่าใช้จ่าย ${formatCurrency(s.expense)}`);
      L.push(`กำไร ${formatCurrency(s.profit)}`);
      L.push("");
    });
  }
  L.push(sep); L.push("");
  L.push("รายรับรายจ่าย"); L.push("");
  if (report.transactions.length === 0) {
    L.push("ไม่มีรายการ");
  } else {
    report.transactions.forEach((t) => {
      L.push(`${fmtThaiDateFull(t.date)} | ${t.type === "revenue" ? "รายได้" : "ค่าใช้จ่าย"} | ${t.category} | ${t.description} | ${t.session} | ${formatCurrency(t.amount)}`);
    });
  }
  L.push(""); L.push(sep); L.push("");
  L.push("ค้างชำระ"); L.push("");
  if (report.outstandingPayments.length === 0) {
    L.push("ไม่มีรายการค้างชำระ");
  } else {
    report.outstandingPayments.forEach((o) => {
      L.push(`${fmtThaiDateFull(o.date)} | ${o.sessionName} | ${o.playerName} | ต้องชำระ ${formatCurrency(o.due)} | รับแล้ว ${formatCurrency(o.collected)} | ค้าง ${formatCurrency(o.outstanding)}`);
    });
  }
  L.push(""); L.push(sep); L.push("");
  L.push("ส่วนลดคงเหลือ"); L.push("");
  if (report.discountCredits.length === 0) {
    L.push("ไม่มีส่วนลดคงเหลือ");
  } else {
    report.discountCredits.forEach((c) => { L.push(`${c.playerName} | ${formatCurrency(c.amount)} | จาก ${c.sourceSession} | ${c.status}`); });
  }
  L.push(""); L.push(sep); L.push("");
  L.push("สร้างจาก BadQ");
  return L.join("\n");
}
function downloadFinancialReportTxt(report) {
  const text = buildFinancialReportTxt(report);
  const blob = new Blob(["﻿" + text], { type: "text/plain;charset=utf-8" });
  return shareOrDownloadBlob(blob, financeExportFilename(report.period, "txt"), "text/plain");
}

// ===================== MINIMAL ZIP WRITER (Requirement #13 — real .xlsx, no external library) =====================
// A .xlsx IS a zip archive of XML parts. This app is one self-contained HTML file with no build step and no
// external script loading (that's what makes offline PWA caching work), so a real xlsx needs its own tiny
// zip writer rather than vendoring a library. STORE (uncompressed) entries are fully valid zip/xlsx — every
// spreadsheet app accepts them — so no compression algorithm is needed either.
function crc32Bytes(bytes) {
  if (!crc32Bytes.table) {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    crc32Bytes.table = t;
  }
  const table = crc32Bytes.table;
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function strToBytes(str) {
  return new TextEncoder().encode(str);
}
function dosDateTimeNow() {
  const d = new Date();
  const dosTime = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() >> 1) & 0x1f);
  const dosDate = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0xf) << 5) | (d.getDate() & 0x1f);
  return { dosTime, dosDate };
}
// files: [{ name, data: Uint8Array }] -> a complete, valid .zip as Uint8Array
function buildZipArchive(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosTime, dosDate } = dosDateTimeNow();
  files.forEach((f) => {
    const nameBytes = encoder.encode(f.name);
    const data = f.data;
    const crc = crc32Bytes(data);
    const size = data.length;
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    localParts.push(local, data);
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);
    offset += local.length + data.length;
  });
  const centralStart = offset;
  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralStart, true);
  ev.setUint16(20, 0, true);
  const allParts = [...localParts, ...centralParts, eocd];
  const total = allParts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  allParts.forEach((p) => { out.set(p, pos); pos += p.length; });
  return out;
}

// ===================== XLSX EXPORT (Requirement #13/#14) =====================
function xmlEscape(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function xlsxColLetter(n) {
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
// "YYYY-MM-DD" -> Excel's day-count serial (days since the fake epoch 1899-12-30) — a REAL date value
// (Requirement #14 "Recommended"), not just display text, so it sorts/filters like a date in Excel.
function excelSerialDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split("-").map(Number);
  if (!y || !m || !d) return null;
  const utcMs = Date.UTC(y, m - 1, d);
  const epochMs = Date.UTC(1899, 11, 30);
  return Math.round((utcMs - epochMs) / 86400000);
}
// cellXfs indices — defined once in buildFinancialXlsxStylesXml() below, referenced by index everywhere else
const XLSX_STYLE = { normal: 0, headerBold: 1, money: 2, boldText: 3, boldMoney: 4, date: 5 };
function xlsxCell(ref, value, styleIdx, kind) {
  if (kind === "text") return `<c r="${ref}" s="${styleIdx}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
  const n = Number(value);
  return `<c r="${ref}" s="${styleIdx}"><v>${isFinite(n) ? n : 0}</v></c>`;
}
// generic data-table worksheet — used by all 4 detail sheets (รายก๊วน / รายรับรายจ่าย / ค้างชำระ / ส่วนลดคงเหลือ).
// colTypes[i]: "text" | "int" | "money" | "date". Money cells are REAL numbers with a currency numFmt
// (Requirement #14 — never a formatted string like "฿13,235") so SUM/sort/filter/pivot all work in Excel.
function buildFinancialXlsxTableSheet(headers, colTypes, rows, opts) {
  const o = opts || {};
  const lines = [`<row r="1">${headers.map((h, i) => xlsxCell(`${xlsxColLetter(i + 1)}1`, h, XLSX_STYLE.headerBold, "text")).join("")}</row>`];
  rows.forEach((r, ri) => {
    const rn = ri + 2;
    const cells = r.map((val, ci) => {
      const ref = `${xlsxColLetter(ci + 1)}${rn}`;
      const type = colTypes[ci];
      if (type === "money") return xlsxCell(ref, val, XLSX_STYLE.money, "number");
      if (type === "int") return xlsxCell(ref, val, XLSX_STYLE.normal, "number");
      if (type === "date") {
        const serial = excelSerialDate(val);
        return serial == null ? xlsxCell(ref, val || "", XLSX_STYLE.normal, "text") : xlsxCell(ref, serial, XLSX_STYLE.date, "number");
      }
      return xlsxCell(ref, val, XLSX_STYLE.normal, "text");
    }).join("");
    lines.push(`<row r="${rn}">${cells}</row>`);
  });
  let lastRow = rows.length + 1;
  if (rows.length === 0 && o.emptyMessage) {
    lines.push(`<row r="2">${xlsxCell("A2", o.emptyMessage, XLSX_STYLE.normal, "text")}</row>`);
    lastRow = 2;
  }
  const lastCol = xlsxColLetter(headers.length);
  const dim = `A1:${lastCol}${lastRow}`;
  const cols = `<cols>${headers.map((h, i) => `<col min="${i + 1}" max="${i + 1}" width="${(o.widths && o.widths[i]) || 14}" customWidth="1"/>`).join("")}</cols>`;
  const sheetView = `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>`;
  const autoFilter = rows.length > 0 ? `<autoFilter ref="${dim}"/>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${dim}"/>${sheetView}${cols}<sheetData>${lines.join("")}</sheetData>${autoFilter}</worksheet>`;
}
// สรุป sheet — a key/value summary + P&L breakdown (not a filterable table, so it's built by hand rather than
// through buildFinancialXlsxTableSheet).
function buildFinancialXlsxSummarySheet(report) {
  const rows = [];
  let r = 1;
  const pushRow = (a, b, styleA, styleB) => {
    let cells = "";
    const bIsText = typeof b === "string";
    if (a != null) cells += xlsxCell(`A${r}`, a, styleA != null ? styleA : XLSX_STYLE.normal, "text");
    if (b != null) cells += xlsxCell(`B${r}`, b, styleB != null ? styleB : bIsText ? XLSX_STYLE.normal : XLSX_STYLE.money, bIsText ? "text" : "number");
    rows.push(`<row r="${r}">${cells}</row>`);
    r++;
  };
  pushRow("BadQ — รายงานการเงิน", null, XLSX_STYLE.boldText);
  pushRow("ช่วงเวลา", report.period.label);
  pushRow("วันที่สร้างรายงาน", fmtGeneratedAt(report.generatedAt));
  r++;
  pushRow("สรุป", null, XLSX_STYLE.boldText);
  pushRow("รายได้", report.summary.revenue);
  pushRow("รับแล้ว", report.summary.collected);
  pushRow("ค้างรับ", report.summary.receivable);
  pushRow("ค่าใช้จ่าย", report.summary.expense);
  pushRow(report.summary.profit < 0 ? "ขาดทุนสุทธิ" : "กำไรสุทธิ", Math.abs(report.summary.profit), XLSX_STYLE.boldText, XLSX_STYLE.boldMoney);
  r++;
  pushRow("สรุปกำไรขาดทุน", null, XLSX_STYLE.boldText);
  pushRow("รายได้ค่าก๊วน", report.pnl.groupRevenue);
  pushRow("รายได้อื่น", report.pnl.otherIncome);
  if (report.pnl.tournamentIncome > 0) pushRow("รายได้ Tournament", report.pnl.tournamentIncome);
  pushRow("รายได้รวม", report.pnl.totalRevenue, XLSX_STYLE.boldText, XLSX_STYLE.boldMoney);
  Object.entries(report.pnl.expenseByCategory).filter(([, amt]) => amt > 0).forEach(([cat, amt]) => pushRow(cat, amt));
  pushRow("ค่าใช้จ่ายรวม", report.pnl.totalExpense, XLSX_STYLE.boldText, XLSX_STYLE.boldMoney);
  pushRow(report.pnl.netProfit < 0 ? "ขาดทุนสุทธิ" : "กำไรสุทธิ", Math.abs(report.pnl.netProfit), XLSX_STYLE.boldText, XLSX_STYLE.boldMoney);
  const lastRow = r - 1;
  const dim = `A1:B${lastRow}`;
  const cols = `<cols><col min="1" max="1" width="26" customWidth="1"/><col min="2" max="2" width="18" customWidth="1"/></cols>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${dim}"/>${cols}<sheetData>${rows.join("")}</sheetData></worksheet>`;
}
function buildFinancialXlsxStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;฿&quot;#,##0"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF2F0"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}
function buildFinancialReportXlsxBytes(report) {
  const sheets = [
    { name: "สรุป", xml: buildFinancialXlsxSummarySheet(report) },
    { name: "รายก๊วน", xml: buildFinancialXlsxTableSheet(["วันที่", "ชื่อก๊วน", "จำนวนผู้เล่น", "จำนวนแมตช์", "จำนวนสนาม", "รายได้", "รับแล้ว", "ค้างรับ", "ค่าใช้จ่าย", "กำไร/ขาดทุน"], ["date", "text", "int", "int", "int", "money", "money", "money", "money", "money"], report.sessions.map((s) => [s.date, s.name, s.playerCount, s.matchCount, s.courtCount, s.revenue, s.collected, s.receivable, s.expense, s.profit]), { widths: [12, 20, 10, 8, 8, 12, 12, 12, 12, 12], emptyMessage: "ไม่มีก๊วนในช่วงเวลานี้" }) },
    { name: "รายรับรายจ่าย", xml: buildFinancialXlsxTableSheet(["วันที่", "ประเภท", "หมวด", "รายละเอียด", "ก๊วน", "จำนวนเงิน"], ["date", "text", "text", "text", "text", "money"], report.transactions.map((t) => [t.date, t.type === "revenue" ? "รายได้" : "ค่าใช้จ่าย", t.category, t.description, t.session, t.amount]), { widths: [12, 10, 14, 28, 18, 12], emptyMessage: "ไม่มีรายการ" }) },
    { name: "ค้างชำระ", xml: buildFinancialXlsxTableSheet(["วันที่", "ก๊วน", "ผู้เล่น", "ยอดที่ต้องชำระ", "รับแล้ว", "ค้างชำระ"], ["date", "text", "text", "money", "money", "money"], report.outstandingPayments.map((o) => [o.date, o.sessionName, o.playerName, o.due, o.collected, o.outstanding]), { widths: [12, 18, 16, 14, 12, 12], emptyMessage: "ไม่มีรายการค้างชำระ" }) },
    { name: "ส่วนลดคงเหลือ", xml: buildFinancialXlsxTableSheet(["ผู้เล่น", "จำนวนเงิน", "ก๊วนต้นทาง", "วันที่ได้รับ", "สถานะ"], ["text", "money", "text", "date", "text"], report.discountCredits.map((c) => [c.playerName, c.amount, c.sourceSession, c.createdAt ? new Date(c.createdAt).toISOString().slice(0, 10) : "", c.status === "available" ? "พร้อมใช้" : c.status]), { widths: [18, 12, 22, 14, 12], emptyMessage: "ไม่มีส่วนลดคงเหลือ" }) },
  ];
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`;
  const files = [
    { name: "[Content_Types].xml", data: strToBytes(contentTypes) },
    { name: "_rels/.rels", data: strToBytes(rootRels) },
    { name: "xl/workbook.xml", data: strToBytes(workbookXml) },
    { name: "xl/_rels/workbook.xml.rels", data: strToBytes(workbookRels) },
    { name: "xl/styles.xml", data: strToBytes(buildFinancialXlsxStylesXml()) },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: strToBytes(s.xml) })),
  ];
  return buildZipArchive(files);
}
function downloadFinancialReportXlsx(report) {
  const bytes = buildFinancialReportXlsxBytes(report);
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  return shareOrDownloadBlob(blob, financeExportFilename(report.period, "xlsx"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

// build the plain-text summary used by the Web Share API (with clipboard/alert fallback)
function buildShareText({ name, date, playerCount, totalMatches, maxGames, totalExpense }) {
  return `BadQ — ${name || "ก๊วนแบดมินตัน"}\n${date || ""}\nผู้เล่น ${playerCount} คน\n${totalMatches} แมตช์\nเกมมากสุด ${maxGames} เกม\nค่าใช้จ่ายรวม ${formatCurrency(totalExpense)}`;
}
// v1.11.4: single Tournament share-text generator — built from the SAME buildTournamentResultReport
// object that feeds the Podium/Bracket/PDF, so the shared text can never separately calculate or drift
// from what's actually on screen. Includes medals + the final score line; ends with a small BadQ credit.
function buildTournamentShareText(report, teamsById, peopleById) {
  const { t, totals, podium, finalMatch, isCompleted } = report;
  const lines = [`🏆 BadQ Tournament — ${t.name || "Tournament ไม่มีชื่อ"}`, `${fmtThaiDate(t.date)} · ${totals.teamCount} ทีม · ${totals.completedMatches} แมตช์`];
  if (podium && podium.champion) {
    lines.push("");
    lines.push(`🥇 แชมป์: ${tTeamName(teamsById[podium.champion], peopleById)}`);
    if (podium.runnerUp) lines.push(`🥈 รองแชมป์: ${tTeamName(teamsById[podium.runnerUp], peopleById)}`);
    if (podium.thirdIds && podium.thirdIds.length) lines.push(`🥉 อันดับ 3: ${podium.thirdIds.map((id) => tTeamName(teamsById[id], peopleById)).join(" / ")}`);
    if (finalMatch && matchScoreText(finalMatch)) {
      const lbl = tMatchLabel(finalMatch, teamsById, peopleById);
      lines.push(`ชิงชนะเลิศ: ${lbl.a} ${matchScoreText(finalMatch)} ${lbl.b}`);
    }
  } else if (!isCompleted) {
    lines.push("");
    lines.push("สถานะ: กำลังแข่งขัน — ยังไม่ทราบผู้ชนะ");
  }
  lines.push("");
  lines.push("สร้างโดย BadQ 🏸");
  return lines.join("\n");
}
async function shareSummary(text) {
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
  } catch (e) { return; }
  try { await navigator.clipboard.writeText(text); alert("อุปกรณ์นี้แชร์ตรงไม่ได้ — คัดลอกข้อความสรุปก๊วนแล้ว"); }
  catch (e) { alert(text); }
}
// read an image WITHOUT cropping (for QR — must stay scannable)
function fileToDataURL(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error("read")); r.readAsDataURL(file); });
}
function loadImg(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("img")); i.src = src; });
}
// QR: keep full (no crop). Downscale if possible, else use raw data URL so it always shows.
async function readImageFull(file) {
  let dataUrl;
  try { dataUrl = await fileToDataURL(file); } catch (e) { return null; }
  try {
    const img = await loadImg(dataUrl);
    const max = 720; const sc = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * sc)), h = Math.max(1, Math.round(img.height * sc));
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    cv.getContext("2d").drawImage(img, 0, 0, w, h);
    return cv.toDataURL("image/jpeg", 0.92);
  } catch (e) { return dataUrl; }
}
function fmtMode(settings, mode) {
  return `🏸 ${mode === "doubles" ? "ตีคู่" : "ตีเดี่ยว"} · ${settings.winScore || 21} แต้ม · ${settings.deuce ? "มีดิว" : "ไม่มีดิว"} · ${roundsLabel(settings.rounds)}`;
}
// one-line summary shown on the Today tab's "⚙️ ตั้งค่าก๊วน" entry point — reflects the real current
// session config so organizers don't have to open the sheet just to check it.
function quanSettingsSummary(settings, mode, courtCount) {
  const modeLabel = mode === "singles" ? "1v1" : "2v2";
  const levelLabel = getPresetMeta(settings.levelPresetId || "isan").name;
  return `${modeLabel} · ${courtCount} สนาม · ${settings.winScore || 21} แต้ม · ${levelLabel}`;
}
// dynamic subtitle for the "ตั้งค่าค่าก๊วนและรางวัล" compact entry point on the ชำระเงิน tab
const COST_MODEL_LABEL = { simple: "แบบง่าย", perCourt: "แยกรายสนาม", hourly: "รายชั่วโมง", perPerson: "รายคน", custom: "กำหนดเอง" };
function financeSettingsSummary(settings) {
  const model = settings.costModel || "simple";
  const parts = model === "simple"
    ? [`ค่าสนาม ${formatCurrency(settings.court || 0)}/คน`, `ค่าลูก ${formatCurrency(settings.shuttle || 0)}/เกม`]
    : [`รูปแบบ: ${COST_MODEL_LABEL[model] || model}`];
  if (settings.other) parts.push(`อื่นๆ ${formatCurrency(settings.other)}`);
  parts.push(settings.wheelEnabled !== false ? "รางวัลเปิด" : "ไม่มีรางวัล");
  return parts.join(" · ");
}
// FAIRNESS SCORING (v1.9.4) — combines real elapsed wait time with games-played into one weighted
// priority number, instead of the old strict lexicographic sort (lastPlayedRound tier, then games tier,
// then waitingSince tier) which let "games played" fully dominate even when a rival had waited far
// longer within the same games-tier. Higher score = should play sooner. Derived entirely from existing
// player fields (waitingSince/games/lastPlayedRound) — no new duplicated counters (see IMPLEMENTATION
// PRINCIPLE). Weights: 1 minute of extra real wait is worth a bit less than a whole game not yet played,
// so a long-waiting player can still outrank someone who's only played slightly fewer games, while a
// player who just finished (waitingSince resets to "now" the instant a match starts/ends) naturally drops
// to the bottom of the queue even if their games count is low — satisfying "avoid picking the same player
// for too many consecutive games when other suitable waiting players exist" without extra bookkeeping.
function fairnessScore(p, now) {
  const waitMin = Math.max(0, (now - (p.waitingSince || now)) / 60000);
  return waitMin - (p.games || 0) * 1.5;
}
// selection priority: fairness score (wait time + games played, weighted) first, lastPlayedRound/order as
// tiebreaks. Downstream, buildMatch() still takes the top of THIS ordering as a shortlist and picks the
// best-BALANCED valid combination from within it — fairness decides WHO is eligible/likely to play next,
// balance decides HOW they're paired, exactly as requirement 1 asks ("prioritize fairness, but the final
// 4-player combination should still be reasonably balanced").
const SORT = (a, b) => {
  const now = Date.now();
  return fairnessScore(b, now) - fairnessScore(a, now) || (a.lastPlayedRound ?? -1) - (b.lastPlayedRound ?? -1) || a.order - b.order;
};
function matchScoreText(m) {
  if (!hasScore(m)) return null;
  return m.scores.filter((r) => r && (r.a != null || r.b != null || r.win != null)).map((r) => {
    if (r.a != null || r.b != null) return `${r.a ?? "-"}–${r.b ?? "-"}`;
    return r.win === "A" ? "A ชนะ" : r.win === "B" ? "B ชนะ" : "-";
  }).join(" · ");
}

async function resizePhoto(file) {
  let dataUrl;
  try { dataUrl = await fileToDataURL(file); } catch (e) { return null; }
  try {
    const img = await loadImg(dataUrl);
    const s = 180, cv = document.createElement("canvas");
    cv.width = s; cv.height = s;
    const ctx = cv.getContext("2d");
    const sc = Math.max(s / img.width, s / img.height);
    const w = img.width * sc, h = img.height * sc;
    ctx.drawImage(img, (s - w) / 2, (s - h) / 2, w, h);
    return cv.toDataURL("image/jpeg", 0.8);
  } catch (e) { return dataUrl; }
}

// v1.9.13: interactive "move & scale" crop step, shared by every photo-upload flow (player profile photo,
// ก๊วน photo, QR code) — lets the organizer drag to pan and pinch/slide to zoom a fixed square frame over
// the picked image before it's saved, instead of always auto-centering. Always exports a SQUARE image (the
// existing Avatar component already applies its own border-radius for circular display, so no shape-specific
// output is needed) — circleGuide only changes the on-screen preview mask, not the underlying crop math or
// the exported result. Pure presentation/input step: does not touch how/where the result is ultimately saved
// (each caller's onConfirm decides that, exactly as before this existed).
function ImageCropper({ src, circleGuide, title, onCancel, onConfirm }) {
  const FRAME = 300;
  const MAX_ZOOM = 4;
  const [natSize, setNatSize] = useState(null); // { w, h } once the picked image has loaded
  const [baseScale, setBaseScale] = useState(1); // scale at which the image just covers the frame (zoom=1)
  const [zoom, setZoom] = useState(1); // multiplier on top of baseScale, 1..MAX_ZOOM
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // top-left of the displayed image, relative to the frame
  const imgElRef = useRef(null); // the actual loaded Image object, used for the final canvas draw
  const dragRef = useRef(null); // { sx, sy, ox, oy } while a mouse/single-touch drag is active
  const pinchRef = useRef(null); // { startDist, startZoom } while a two-finger pinch is active

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const w = img.naturalWidth || 1, h = img.naturalHeight || 1;
      const bs = FRAME / Math.min(w, h);
      setNatSize({ w, h });
      setBaseScale(bs);
      setZoom(1);
      setOffset({ x: (FRAME - w * bs) / 2, y: (FRAME - h * bs) / 2 });
    };
    img.src = src;
    imgElRef.current = img;
    return () => { cancelled = true; };
  }, [src]);

  const scale = baseScale * zoom;
  const dispW = natSize ? natSize.w * scale : 0;
  const dispH = natSize ? natSize.h * scale : 0;
  const clampOffset = (off, dw, dh) => {
    const minX = Math.min(0, FRAME - dw), minY = Math.min(0, FRAME - dh);
    return { x: Math.min(0, Math.max(minX, off.x)), y: Math.min(0, Math.max(minY, off.y)) };
  };
  const setZoomClamped = (z) => {
    if (!natSize) return;
    const nz = Math.min(MAX_ZOOM, Math.max(1, z));
    const ndw = natSize.w * baseScale * nz, ndh = natSize.h * baseScale * nz;
    setZoom(nz);
    setOffset((o) => clampOffset(o, ndw, ndh));
  };

  const onMouseDown = (e) => { dragRef.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y }; };
  const onMouseMove = (e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.sx, dy = e.clientY - dragRef.current.sy;
    setOffset(clampOffset({ x: dragRef.current.ox + dx, y: dragRef.current.oy + dy }, dispW, dispH));
  };
  const onMouseUp = () => { dragRef.current = null; };

  const touchDist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const onTouchStart = (e) => {
    if (e.touches.length === 1) { dragRef.current = { sx: e.touches[0].clientX, sy: e.touches[0].clientY, ox: offset.x, oy: offset.y }; pinchRef.current = null; }
    else if (e.touches.length === 2) { pinchRef.current = { startDist: touchDist(e.touches), startZoom: zoom }; dragRef.current = null; }
  };
  const onTouchMove = (e) => {
    e.preventDefault();
    if (e.touches.length === 1 && dragRef.current) {
      const dx = e.touches[0].clientX - dragRef.current.sx, dy = e.touches[0].clientY - dragRef.current.sy;
      setOffset(clampOffset({ x: dragRef.current.ox + dx, y: dragRef.current.oy + dy }, dispW, dispH));
    } else if (e.touches.length === 2 && pinchRef.current) {
      setZoomClamped(pinchRef.current.startZoom * (touchDist(e.touches) / pinchRef.current.startDist));
    }
  };
  const onTouchEnd = (e) => { if (e.touches.length === 0) { dragRef.current = null; pinchRef.current = null; } };

  const confirm = () => {
    if (!natSize || !imgElRef.current) return;
    const OUT = 640;
    const sx = -offset.x / scale, sy = -offset.y / scale, sw = FRAME / scale, sh = FRAME / scale;
    const cv = document.createElement("canvas"); cv.width = OUT; cv.height = OUT;
    cv.getContext("2d").drawImage(imgElRef.current, sx, sy, sw, sh, 0, 0, OUT, OUT);
    onConfirm(cv.toDataURL("image/jpeg", 0.88));
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 90, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
        <button onClick={onCancel} style={{ width: 34, height: 34, borderRadius: 17, background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={18} /></button>
        <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>{title || "จัดตำแหน่งรูป"}</span>
        <button onClick={confirm} style={{ width: 34, height: 34, borderRadius: 17, background: T.accent, border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={18} /></button>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
        <div
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          style={{ position: "relative", width: FRAME, height: FRAME, overflow: "hidden", borderRadius: circleGuide ? "50%" : 14, touchAction: "none", background: "#151515", cursor: "grab", boxShadow: "0 0 0 2000px rgba(0,0,0,0.55)" }}
        >
          {natSize && (
            <img src={src} draggable={false} alt="" style={{ position: "absolute", left: offset.x, top: offset.y, width: dispW, height: dispH, maxWidth: "none", userSelect: "none", pointerEvents: "none" }} />
          )}
        </div>
      </div>
      <div style={{ padding: "10px 24px calc(20px + env(safe-area-inset-bottom))", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 13 }}>🔍</span>
        <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={zoom} onChange={(e) => setZoomClamped(Number(e.target.value))} style={{ flex: 1 }} disabled={!natSize} />
      </div>
      <div style={{ textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: 11, paddingBottom: 10 }}>ลากเพื่อเลื่อน · บีบนิ้ว/เลื่อนแถบเพื่อซูม</div>
    </div>
  );
}

// fresh defaults for `settings` — pulled out into a function (instead of an inline useState() object
// literal) so the exact same shape can be reused both on first load AND as the fallback base when
// migrating an old/partial backup file on import. Called fresh each time so nobody accidentally shares
// (and mutates) the same wheelPrizes array reference.
function getDefaultSettings() {
  return {
    court: 65, shuttle: 25, other: 0, rounds: 1, winScore: 21, deuce: true, qr: null, bank: "", pairingMode: "auto",
    levelPresetId: "isan",
    customLevels: [],
    // ===== FLEXIBLE COST MODEL (v1.9.4) — "รูปแบบคิดค่าใช้จ่าย" =====
    // "simple" is the untouched original ค่าคอร์ท/ค่าลูก/ค่าใช้จ่ายอื่น model above (default — zero behavior
    // change for existing groups). The other 4 modes are OPTIONAL alternates the organizer opts into; see
    // computeCostModelExpenses() for how each one feeds the existing รายรับ/ค่าใช้จ่าย/กำไรสุทธิ pipeline.
    costModel: "simple", // "simple" | "perCourt" | "hourly" | "perPerson" | "custom"
    perCourtRates: [], // [{ court: 1, amount: 500 }, ...] — model B: แยกรายสนาม
    hourly: { courts: 0, rate: 0, hours: 0 }, // model C: รายชั่วโมง (จำนวนสนาม × ราคา/ชั่วโมง × ชั่วโมง)
    shuttleCalc: { qty: 0, pricePerUnit: 0 }, // optional shared ค่าลูกแบด line, usable alongside perCourt/hourly
    perPersonRate: 0, // model D: รายคน — overrides computeBill's per-person court charge directly (revenue-side)
    customCostRows: [], // model E: กำหนดเอง — [{ id, category, description, amount }, ...], reuses ExpenseListEditor
    wheelEnabled: true,
    wheelEnabled: true,
    // v1.9.19: when true, prizes that have run out (qty 0) still appear on the wheel — grayed out, purely
    // visual, never actually landable — instead of disappearing. Default false = unchanged prior behavior
    // (sold-out prizes simply vanish from the wheel).
    wheelShowSoldOut: false,
    wheelPrizes: [
      { id: uid(), label: "ส่วนลด 20฿ (ใช้ทันที)", type: "now", amount: 20, qty: 5, totalQty: 5 },
      { id: uid(), label: "ส่วนลด 10฿ (ครั้งหน้า)", type: "next", amount: 10, qty: 5, totalQty: 5 },
      { id: uid(), label: "ฟรีค่าสนาม! ส่วนลด 65฿ (ทันที)", type: "now", amount: 65, qty: 2, totalQty: 2 },
      { id: uid(), label: "เสียใจด้วย ไม่ได้รางวัล", type: "none", amount: 0, qty: 40 },
    ],
    lastBackupAt: null,
  };
}

/* ============ BACKUP / RESTORE ============
   Local-file backup: the exported JSON is a thin envelope (app/backupVersion/schemaVersion/appVersion/
   exportedAt) around a `data` object that is exactly the same shape already persisted to localStorage
   under "bg-v11" — so building a backup is just "wrap the current state", and importing is "validate,
   migrate to the current schema, then feed it through the same setters the app uses on normal load". */
const BACKUP_APP_ID = "BadQ";
const BACKUP_VERSION = 1; // outer envelope format — bump only if this wrapper shape itself changes
const SCHEMA_VERSION = 1; // inner `data` shape — bump whenever the persisted state shape changes, and
                           // add a migration step in migrateBackupData() so OLD backups keep importing
                           // into NEWER app versions (import is tied to schemaVersion, never APP_VERSION)
// Auto-backup checkpoints (v1.9.16) — a silent, in-app safety net for organizers who never remember to
// tap "สำรองข้อมูล" themselves. Every time a ก๊วน or Tournament finishes, a full snapshot (same envelope
// shape as a manual backup file) is stashed into localStorage under this key — no dialog, no download,
// nothing that could interrupt the "จบก๊วน" flow. Kept as a short rotating list so it can't grow without
// bound; each entry restores through the exact same preview/confirm UI as importing a backup FILE.
const AUTO_BACKUP_KEY = "bg-v11-autobackups";
const AUTO_BACKUP_MAX = 8; // last 8 checkpoints — a few weeks of ก๊วนs for most groups, negligible storage cost
// v1.9.18: a tiny forensic ring buffer for diagnosing the "data reverted after updating" class of bug —
// records every boot (loaded savedAt + player/session counts) and every time the safety guard actually
// pulls in newer data from storage ("heal"), so a reported regression can be traced after the fact
// instead of guessed at. Read-only from the UI (ตั้งค่า → ข้อมูลและการสำรอง); never affects app behavior.
const BOOT_LOG_KEY = "bg-v11-bootlog";
const BOOT_LOG_MAX = 20;
// v1.11.0 PERSISTENCE REWRITE — Last Known Good snapshot: a copy of the most recent state that
// successfully passed boot (or was just saved during a normal, non-recovering session). Sits between
// the live primary/mirror pair and the Auto-Backup list in the recovery hierarchy: cheaper/fresher than
// digging through Auto-Backup (which only updates when a ก๊วน/Tournament archives), but still a
// completely separate key from "bg-v11" so a corrupted primary can never take this down with it. Goes
// through the exact same window.storage (IndexedDB-primary + localStorage-mirror) plumbing as every
// other key here — see BOOT SEQUENCE below for how/when it's read and (re)written.
const LKG_KEY = "bg-v11-lkg";

function pad2(n) { return String(n).padStart(2, "0"); }
function fmtBackupStamp(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}`; }
function fmtBytes(n) {
  if (!n && n !== 0) return "-";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
}
// Builds a standalone JSON export of one Tournament (active or archived) — Tournament/Participants/
// Teams/Matches/Results/Standings/Champion — and triggers a download. Completely separate from the
// main Backup system (buildBackupPayload/exportBackup) so it never affects that pipeline.
function exportTournamentJSON(t, playersById) {
  if (!t) return;
  const teamsById = Object.fromEntries((t.teams || []).map((tm) => [tm.id, tm]));
  const peopleById = { ...playersById, ...Object.fromEntries((t.guestPlayers || []).map((g) => [g.id, g])) };
  const participants = (t.teams || []).flatMap((tm) => tm.playerIds || []).filter((id, i, arr) => arr.indexOf(id) === i)
    .map((id) => ({ id, name: peopleById[id]?.name || "?", level: peopleById[id]?.level || "-", skillIndex: peopleById[id]?.skillIndex ?? null }));
  const divisions = (t.divisions || []).map((d) => {
    const divTeams = (d.teamIds || []).map((id) => teamsById[id]).filter(Boolean);
    let standings = null;
    if (d.groups && d.groups.length) {
      standings = d.groups.map((g) => ({ group: g.name, standings: computeStandings(g.teamIds.map((id) => teamsById[id]), g.matches, t.pointsConfig) }));
    } else if (d.matches?.length || d.swissMatches?.length) {
      standings = computeStandings(divTeams, d.matches?.length ? d.matches : d.swissMatches, t.pointsConfig);
    }
    return {
      id: d.id, name: d.name,
      teams: divTeams.map((tm) => ({ id: tm.id, name: tTeamName(tm, peopleById), seed: tm.seed, playerIds: tm.playerIds })),
      bracket: d.bracket || null,
      groups: d.groups || null,
      matches: d.matches || null,
      swissMatches: d.swissMatches?.length ? d.swissMatches : null,
      standings,
      champion: d.champion ? { teamId: d.champion, name: tTeamName(teamsById[d.champion], peopleById) } : null,
      runnerUp: d.runnerUp ? { teamId: d.runnerUp, name: tTeamName(teamsById[d.runnerUp], peopleById) } : null,
      third: d.third ? { teamId: d.third, name: tTeamName(teamsById[d.third], peopleById) } : null,
    };
  });
  const payload = {
    exportedFrom: "BadQ", exportedAt: new Date().toISOString(),
    tournament: { id: t.id, name: t.name, format: t.format, matchMode: t.matchMode, courtCount: t.courtCount, status: t.status, createdAt: t.createdAt || null, completedAt: t.completedAt || null },
    participants,
    teams: (t.teams || []).map((tm) => ({ id: tm.id, name: tTeamName(tm, peopleById), seed: tm.seed, playerIds: tm.playerIds })),
    divisions,
  };
  const json = JSON.stringify(payload, null, 2);
  const filename = `BadQ_Tournament_${(t.name || "export").replace(/[^a-zA-Z0-9ก-๙_-]+/g, "_")}_${fmtBackupStamp(new Date())}.json`;
  try {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (e) {
    try { window.open(URL.createObjectURL(new Blob([json], { type: "application/json" })), "_blank"); } catch (e2) {}
  }
}
function fmtThaiDateTime(iso) {
  if (!iso) return "-";
  const MO = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MO[d.getMonth()]} ${d.getFullYear() + 543} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
// simple deterministic string hash (djb2) — used only to mint a STABLE id for legacy session-history
// entries that predate stable IDs, so re-importing the same old backup twice still dedups correctly.
function stableHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
function ensureSessionId(s) {
  if (s && s.id) return s;
  return { ...s, id: "legacy-" + stableHash(`${s?.name || ""}|${s?.date || ""}|${s?.endedAt || ""}`) };
}
// backward-compat for sessionHistory entries saved before per-session expense tracking existed
function ensureSessionExpenses(s) { return { ...s, expenses: Array.isArray(s.expenses) ? s.expenses : [] }; }

// wraps the currently-persisted state shape into the exportable envelope
function buildBackupPayload(state) {
  return {
    app: BACKUP_APP_ID,
    backupVersion: BACKUP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      players: state.players, history: state.history, current: state.current, future: state.future,
      roundNo: state.roundNo, courtCount: state.courtCount, courtLabels: state.courtLabels, mode: state.mode, settings: state.settings,
      session: state.session, lockPairs: state.lockPairs, sessionHistory: state.sessionHistory,
      generalExpenses: state.generalExpenses || [], otherIncome: state.otherIncome || [],
      activeTournament: state.activeTournament || null, tournamentHistory: state.tournamentHistory || [],
      discountCredits: state.discountCredits || [],
    },
  };
}
// stats shown both on the post-export success banner and the pre-import preview
function backupStats(data) {
  return {
    playerCount: (data.players || []).length,
    sessionHistoryCount: (data.sessionHistory || []).length,
    matchCount: (data.history?.length || 0) + (data.current?.length || 0) + (data.future?.length || 0),
    hasCurrentSession: (data.current?.length || 0) > 0 || !!(data.session && data.session.name),
    hasPayment: (data.players || []).some((p) => p.paid) || (data.sessionHistory || []).some((s) => (s.bill || []).some((b) => b.paid)),
    hasQR: !!(data.settings && data.settings.qr),
    tournamentHistoryCount: (data.tournamentHistory || []).length,
    hasActiveTournament: !!data.activeTournament,
    hasFinanceData: (data.generalExpenses || []).length > 0 || (data.otherIncome || []).length > 0 || (data.sessionHistory || []).some((s) => (s.expenses || []).length > 0),
    discountCreditCount: (data.discountCredits || []).length,
  };
}
// cheap structural check — catches "this isn't even a BadQ backup" before we try to migrate/use it
function validateBackupStructure(parsed) {
  if (!parsed || typeof parsed !== "object") return { ok: false, reason: "โครงสร้างไฟล์ไม่ถูกต้อง" };
  if (parsed.app !== BACKUP_APP_ID) return { ok: false, reason: "ไฟล์นี้ไม่ใช่ไฟล์สำรอง BadQ ที่รองรับ" };
  if (typeof parsed.backupVersion !== "number" || typeof parsed.schemaVersion !== "number") return { ok: false, reason: "ไฟล์นี้ไม่ใช่ไฟล์สำรอง BadQ ที่รองรับ" };
  if (!parsed.data || typeof parsed.data !== "object" || !Array.isArray(parsed.data.players)) return { ok: false, reason: "โครงสร้างข้อมูลในไฟล์สำรองไม่ถูกต้อง" };
  return { ok: true };
}
// forward-migrates `data` up to SCHEMA_VERSION, then fills in backward-compatible defaults for any
// field that predates this export — never reject a backup just because a newer field is missing.
function migrateBackupData(parsed) {
  let { schemaVersion, data } = parsed;
  data = { ...data };
  // while (schemaVersion < SCHEMA_VERSION) { data = MIGRATIONS[schemaVersion](data); schemaVersion++; }
  // (no steps needed yet — SCHEMA_VERSION is still 1; this is the extension point for future bumps)
  data.players = Array.isArray(data.players) ? data.players.map(normPlayer) : [];
  data.history = Array.isArray(data.history) ? data.history : [];
  data.current = Array.isArray(data.current) ? data.current : [];
  data.future = Array.isArray(data.future) ? data.future : [];
  data.roundNo = typeof data.roundNo === "number" ? data.roundNo : 0;
  data.courtCount = data.courtCount || 2;
  data.courtLabels = syncCourtLabels(data.courtLabels, data.courtCount);
  data.mode = data.mode || "doubles";
  data.settings = { ...getDefaultSettings(), ...(data.settings || {}) };
  if (!data.settings.levelPresetId) data.settings.levelPresetId = "isan"; // e.g. no levelPresetId -> isan
  if (!Array.isArray(data.settings.customLevels)) data.settings.customLevels = [];
  if (!Array.isArray(data.settings.wheelPrizes) || data.settings.wheelPrizes.length === 0) data.settings.wheelPrizes = getDefaultSettings().wheelPrizes;
  data.session = data.session && typeof data.session === "object" ? data.session : { name: "", date: new Date().toISOString().slice(0, 10) };
  if (!data.session.id) data.session.id = uid(); // backfill — pre-discount-credit sessions had no stable id
  data.lockPairs = migrateLockPairs(data.lockPairs);
  data.sessionHistory = (Array.isArray(data.sessionHistory) ? data.sessionHistory : []).map(ensureSessionId).map(ensureSessionExpenses); // e.g. no sessionHistory -> []
  data.generalExpenses = Array.isArray(data.generalExpenses) ? data.generalExpenses : []; // no field at all (old backup) -> []
  data.otherIncome = Array.isArray(data.otherIncome) ? data.otherIncome : [];
  data.activeTournament = normTournament(data.activeTournament && typeof data.activeTournament === "object" ? data.activeTournament : null); // no field at all (old backup) -> no active Tournament
  data.tournamentHistory = (Array.isArray(data.tournamentHistory) ? data.tournamentHistory : []).map(normTournament);
  data.discountCredits = (Array.isArray(data.discountCredits) ? data.discountCredits : []).map(normDiscountCredit); // no field at all (old backup) -> []
  return { ...parsed, schemaVersion: SCHEMA_VERSION, data };
}
// deeper integrity check AFTER migration — corrupted core structure rejects the whole restore;
// broken/invalid sub-fields fall back to a safe default instead of failing the whole import.
function validateBackupIntegrity(data) {
  if (!Array.isArray(data.players)) return { ok: false, reason: "ข้อมูลผู้เล่นเสียหาย" };
  const seenP = new Set();
  for (const p of data.players) {
    if (!p || !p.id) return { ok: false, reason: "พบผู้เล่นที่ไม่มีรหัส (id)" };
    if (seenP.has(p.id)) return { ok: false, reason: "พบรหัสผู้เล่นซ้ำกัน" };
    seenP.add(p.id);
    p.skillIndex = Math.max(1, Math.min(11, Number(p.skillIndex) || 1)); // clamp to valid 1–11 range
    p.discount = Number(p.discount) || 0;
  }
  const allMatches = [...data.history, ...data.current, ...data.future, ...data.sessionHistory.flatMap((s) => s.matches || [])];
  const seenM = new Set();
  for (const m of allMatches) {
    if (!m || !m.id) return { ok: false, reason: "พบแมตช์ที่ไม่มีรหัส (id)" };
    if (seenM.has(m.id)) return { ok: false, reason: "พบรหัสแมตช์ซ้ำกัน" };
    seenM.add(m.id);
  }
  const seenS = new Set();
  for (const s of data.sessionHistory) {
    if (seenS.has(s.id)) return { ok: false, reason: "พบรหัสประวัติก๊วนซ้ำกัน" };
    seenS.add(s.id);
    (s.bill || []).forEach((b) => { b.total = Number(b.total) || 0; }); // payment amounts must be numeric
  }
  if (!Array.isArray(data.settings.customLevels) || data.settings.customLevels.some((l) => !l || typeof l.skillIndex !== "number")) {
    data.settings.customLevels = []; // not core-critical — fall back safely instead of rejecting the backup
  }
  // Tournament IDs must stay globally unique after restore — dedup by stable id across
  // activeTournament + tournamentHistory (never by array index).
  const seenT = new Set();
  const allT = [...(data.tournamentHistory || []), ...(data.activeTournament ? [data.activeTournament] : [])];
  for (const t of allT) {
    if (!t || !t.id) continue;
    if (seenT.has(t.id)) return { ok: false, reason: "พบรหัส Tournament ซ้ำกัน" };
    seenT.add(t.id);
  }
  // discount credit IDs must stay globally unique after restore too — same dedup-by-stable-id rule.
  const seenDC = new Set();
  for (const c of data.discountCredits || []) {
    if (!c || !c.id) continue;
    if (seenDC.has(c.id)) return { ok: false, reason: "พบรหัสส่วนลดซ้ำกัน" };
    seenDC.add(c.id);
  }
  return { ok: true, data };
}
// v1.11.0 PERSISTENCE REWRITE — recovery helpers shared by the boot-sequence waterfall (primary /
// mirror / Last-Known-Good / Auto-Backup). Both funnel through the EXACT SAME migrate+validate pipeline
// already used for manual backup-file restores above (migrateBackupData/validateBackupIntegrity),
// rather than inventing new ad hoc validity rules — a structural check (well-formed ids, no dupes),
// never an "is this empty?" check, so a legitimately empty new install still validates as ok (see
// validateBackupIntegrity: an empty `players` array is a valid array, not a validation failure).
//
// tryRecoverFlatState: for "bg-v11" / mirror / Last-Known-Good, which are all stored as a FLAT state
// object (the exact shape applyPersistedState expects), not the {app,backupVersion,...,data} envelope
// used by backup FILES and Auto-Backup entries. Returns the recovered+normalized flat state object, or
// null if the raw string is missing/unparseable/structurally invalid.
function tryRecoverFlatState(rawJsonString) {
  if (!rawJsonString) return null;
  try {
    const parsed = JSON.parse(rawJsonString);
    if (!parsed || typeof parsed !== "object") return null;
    const migrated = migrateBackupData({ schemaVersion: SCHEMA_VERSION, data: parsed });
    const check = validateBackupIntegrity(migrated.data);
    if (!check.ok) return null;
    return { ...check.data, savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : null };
  } catch (e) {
    return null;
  }
}
// tryRecoverFromAutoBackupEntry: for one entry off the AUTO_BACKUP_KEY list, which — unlike the flat
// keys above — DOES carry the full backup envelope in `entry.payload` (see saveAutoBackup/buildBackupPayload).
function tryRecoverFromAutoBackupEntry(entry) {
  if (!entry || !entry.payload || typeof entry.payload !== "object") return null;
  try {
    const migrated = migrateBackupData(entry.payload);
    const check = validateBackupIntegrity(migrated.data);
    if (!check.ok) return null;
    return { ...check.data, savedAt: typeof entry.savedAt === "number" ? entry.savedAt : null };
  } catch (e) {
    return null;
  }
}

/* ============ TOURNAMENT ENGINE ============
   Tournament state lives in `activeTournament` (the Tournament currently being run, one at a time) and
   `tournamentHistory` (archived/completed Tournaments) — siblings of `session`/`sessionHistory`, never
   mixed into the Casual `current`/`history` match arrays (see DATA ARCHITECTURE note on App()'s state).
   Every Tournament entity references existing BadQ players by id — there is no separate player DB — and
   every Division/Seeding/Balance computation uses ONLY `skillIndex` (1–11), never a preset display label
   (อีสาน R/BG.../Bad Web N/S/P...), so the algorithms below are correct under any active level preset.
   session.mode ("casual"|"tournament") only toggles what the Today tab SHOWS; Casual state keeps working
   identically underneath no matter which mode is displayed. */
const GAME_MODES = ["casual", "tournament"];
const TOURNAMENT_FORMATS = ["knockout", "roundRobin", "group", "swiss", "league"];
const TOURNAMENT_FORMAT_LABELS = { knockout: "Knockout", roundRobin: "Round Robin", group: "Group Stage", swiss: "Swiss", league: "League" };
const TEAM_ENTRY_MODES = ["individual", "fixedTeam"]; // how players sign up
const TEAM_BUILD_MODES = ["fixed", "random", "balancedRandom", "advancedBalanced"]; // how teams get formed
const SEED_MODES = ["random", "skill", "manual", "advanced"];
const TOURNAMENT_STATUSES = ["draft", "ready", "active", "paused", "completed", "archived"];
// default tie-break order for standings when points are level: tournament points -> match win/loss
// difference -> point diff -> points scored -> head-to-head. Shown read-only in Tournament Settings;
// reordering is a future enhancement, not required this version.
const TIE_BREAK_ORDER = ["points", "wins", "diff", "for", "h2h"];

function makeTournament(overrides) {
  return {
    id: uid(), name: "", date: new Date().toISOString().slice(0, 10), courtCount: 2, courtLabels: ["1", "2"],
    format: "knockout", teamEntryMode: "individual", teamBuildMode: "fixed", seedMode: "skill",
    status: "draft", // draft -> ready -> active -> (paused <-> active) -> completed -> archived
    guestPlayers: [], // { id, name, skillIndex } — NOT written into the permanent players[] roster unless the organizer opts in during Step 2
    teams: [], // makeTournamentTeam[]
    divisions: [], // makeDivision[] — always >=1; a single "ทั้งหมด" division when the organizer skips division split
    pointsConfig: { win: 3, draw: 1, loss: 0 },
    handicap: { mode: "off" }, // "off" | "manual" | "skill" — skill mode is only ever a Recommendation the organizer must confirm per match
    doubleRound: false, // League: single vs double round robin
    createdAt: null, startedAt: null, completedAt: null, // stamped by the caller (Date.now()), never inside this factory
    // v1.10.0 Tournament Profile + Finance additions — see normTournament() for the load-time migration
    // that backfills these same defaults onto tournaments saved before this version existed.
    logo: null, // data URL string, or null — same pattern as player photos (see openPhoto/photo)
    venue: "", // free-text venue name
    description: "", // optional short description
    registration: { feeMode: "none", feeAmount: 0, paidTeamIds: [] }, // feeMode: "none" | "perPlayer" | "perTeam"
    finance: { income: [], expense: [] }, // { id, category, label, amount }[] each — see TOURNAMENT_FINANCE_CATEGORIES
    ...overrides,
  };
}
function makeTournamentTeam(playerIds, overrides) { return { id: uid(), playerIds, name: "", seed: null, divisionId: null, groupId: null, ...overrides }; }
function makeDivision(overrides) {
  return {
    id: uid(), name: "", skillMin: 1, skillMax: 11, teamIds: [],
    groups: [], bracket: null, swissMatches: [], swissRound: 0, swissRounds: null,
    matches: [], // used directly by roundRobin/league divisions (no groups/bracket layer)
    champion: null, runnerUp: null, third: null,
    ...overrides,
  };
}
function makeGroup(overrides) { return { id: uid(), name: "", teamIds: [], matches: [], ...overrides }; }
function makeTournamentMatch(overrides) {
  return {
    id: uid(), source: "tournament", divisionId: null, groupId: null, roundIndex: 0, roundLabel: "",
    court: null, teamAId: null, teamBId: null, nextMatchId: null, nextSlot: null,
    status: "waiting", // waiting (dependency not ready) | ready | playing | completed | bye
    scores: [], winnerTeamId: null, handicapA: 0, handicapB: 0, startedAt: null, endedAt: null,
    ...overrides,
  };
}

/* ---- strength / team building (Fixed / Random / Balanced Random / Advanced Balanced) ---- */
function teamStrength(team, playersById) { return (team.playerIds || []).reduce((s, pid) => s + ((playersById[pid] && playersById[pid].skillIndex) || 0), 0); }
function shuffleArr(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function fixedTeams(pairs) { return pairs.map((p) => makeTournamentTeam(p)); } // organizer-specified [[a,b],[c,d],...] ; singles: [[a],[b],...]
function randomTeams(playerIds, teamSize) {
  const s = shuffleArr(playerIds);
  const teams = [];
  for (let i = 0; i < s.length; i += teamSize) teams.push(makeTournamentTeam(s.slice(i, i + teamSize)));
  return teams;
}
// greedy high+low (snake) pairing, then a bounded local-swap pass to shrink max-min spread — O(n) work
// per pass, never brute-force/exhaustive, so it stays smooth even at the ~32-player performance target.
function balancedRandomTeams(playerIds, playersById, teamSize) {
  if (teamSize === 1) return shuffleArr(playerIds).map((pid) => makeTournamentTeam([pid]));
  const sorted = shuffleArr(playerIds).sort((a, b) => (playersById[b]?.skillIndex || 0) - (playersById[a]?.skillIndex || 0));
  let lo = 0, hi = sorted.length - 1;
  const pairs = [];
  while (lo < hi) { pairs.push([sorted[lo], sorted[hi]]); lo++; hi--; }
  if (lo === hi) pairs.push([sorted[lo]]);
  let teams = pairs.map((p) => makeTournamentTeam(p));
  for (let pass = 0; pass < 4; pass++) {
    teams.forEach((t) => (t._s = teamStrength(t, playersById)));
    teams.sort((a, b) => a._s - b._s);
    let improved = false;
    for (let i = 0; i < teams.length - 1 && !improved; i++) {
      const weak = teams[i], strong = teams[teams.length - 1];
      if (weak.id === strong.id || weak.playerIds.length < 2 || strong.playerIds.length < 2) continue;
      for (const wp of weak.playerIds) {
        for (const sp of strong.playerIds) {
          const wSkill = playersById[wp]?.skillIndex || 0, sSkill = playersById[sp]?.skillIndex || 0;
          const before = strong._s - weak._s, after = Math.abs((strong._s - sSkill + wSkill) - (weak._s - wSkill + sSkill));
          if (after < before - 0.001) {
            weak.playerIds = weak.playerIds.map((id) => (id === wp ? sp : id));
            strong.playerIds = strong.playerIds.map((id) => (id === sp ? wp : id));
            improved = true; break;
          }
        }
        if (improved) break;
      }
    }
    if (!improved) break;
  }
  return teams.map(({ _s, ...t }) => t);
}
// same balance goal as balancedRandomTeams, but among similarly-balanced options prefers pairings that
// haven't partnered before (partnerCounts: Map "idA|idB"(sorted) -> times teamed together previously)
function advancedBalancedTeams(playerIds, playersById, partnerCounts) {
  const pairKey = (a, b) => [a, b].sort().join("|");
  const sorted = shuffleArr(playerIds).sort((a, b) => (playersById[b]?.skillIndex || 0) - (playersById[a]?.skillIndex || 0));
  const used = new Set(); const teams = [];
  for (const pid of sorted) {
    if (used.has(pid)) continue;
    used.add(pid);
    const target = 999 - (playersById[pid]?.skillIndex || 0);
    let best = null, bestScore = Infinity;
    for (const cand of sorted) {
      if (used.has(cand)) continue;
      const balanceCost = Math.abs((playersById[cand]?.skillIndex || 0) - target);
      const repeatCost = (partnerCounts.get(pairKey(pid, cand)) || 0) * 3; // weight avoiding repeats over small skill diffs
      const score = balanceCost + repeatCost;
      if (score < bestScore) { bestScore = score; best = cand; }
    }
    if (best != null) { used.add(best); teams.push(makeTournamentTeam([pid, best])); } else teams.push(makeTournamentTeam([pid]));
  }
  return teams;
}
// scans tournamentHistory + the in-progress teams list for how many times each pair has partnered
function computePartnerCounts(tournamentHistory, currentTeams) {
  const counts = new Map();
  const bump = (ids) => { if (ids.length !== 2) return; const k = [...ids].sort().join("|"); counts.set(k, (counts.get(k) || 0) + 1); };
  (tournamentHistory || []).forEach((th) => (th.teams || []).forEach((t) => bump(t.playerIds || [])));
  (currentTeams || []).forEach((t) => bump(t.playerIds || []));
  return counts;
}

/* ---- seeding (Random / Skill / Manual handled by the caller reordering `seed` / Advanced) ---- */
function seedRandom(teams) { return shuffleArr(teams).map((t, i) => ({ ...t, seed: i + 1 })); }
function seedBySkill(teams, playersById) { return [...teams].sort((a, b) => teamStrength(b, playersById) - teamStrength(a, playersById)).map((t, i) => ({ ...t, seed: i + 1 })); }
// Tournament Performance Seed: uses ONLY real recorded history (win rate across tournamentHistory);
// a team with no history on record falls back to Skill Seed automatically — never a guessed rating.
function seedByPerformance(teams, playersById, tournamentHistory) {
  const perf = {};
  (tournamentHistory || []).forEach((th) => (th.playerStats || []).forEach((ps) => { const c = perf[ps.playerId] || { w: 0, l: 0 }; c.w += ps.wins || 0; c.l += ps.losses || 0; perf[ps.playerId] = c; }));
  const score = (team) => { let w = 0, l = 0, any = false; (team.playerIds || []).forEach((id) => { const p = perf[id]; if (p) { w += p.w; l += p.l; any = true; } }); return any && w + l > 0 ? w / (w + l) : null; };
  return [...teams].sort((a, b) => { const pa = score(a), pb = score(b); if (pa == null && pb == null) return teamStrength(b, playersById) - teamStrength(a, playersById); if (pa == null) return 1; if (pb == null) return -1; return pb - pa; }).map((t, i) => ({ ...t, seed: i + 1 }));
}
function seedHybrid(teams, playersById, tournamentHistory) {
  const skillOrder = seedBySkill(teams, playersById);
  const skillRank = {}; skillOrder.forEach((t, i) => (skillRank[t.id] = i + 1));
  const perfOrder = seedByPerformance(teams, playersById, tournamentHistory);
  const perfRank = {}; perfOrder.forEach((t, i) => (perfRank[t.id] = i + 1));
  return [...teams].sort((a, b) => (skillRank[a.id] * 0.5 + perfRank[a.id] * 0.5) - (skillRank[b.id] * 0.5 + perfRank[b.id] * 0.5)).map((t, i) => ({ ...t, seed: i + 1 }));
}

/* ---- knockout bracket ---- */
function nextPow2(n) { let p = 1; while (p < n) p *= 2; return p; }
// standard seeded bracket slot order for a bracket of size `size` (power of 2) — seed 1 & 2 land as far
// apart as possible, e.g. size=8 -> [1,8,4,5,2,7,3,6]
function standardBracketOrder(size) {
  let order = [1, 2];
  while (order.length < size) { const sum = order.length * 2 + 1; const next = []; order.forEach((s) => { next.push(s); next.push(sum - s); }); order = next; }
  return order;
}
// v1.11.4 fix: any round size other than 2/4/8 (16, 32, ...) used to fall through to `รอบ ${Math.log2(n)}`
// (e.g. "รอบ 4" for a 16-team round, "รอบ 5" for a 32-team round) — nonsensical and confusing. Now every
// larger round is labeled by its actual team count, matching how Thai badminton brackets are normally read.
function roundLabelFor(teamsInRound) { return teamsInRound === 2 ? "รอบชิงชนะเลิศ" : teamsInRound === 4 ? "รอบรองชนะเลิศ" : teamsInRound === 8 ? "รอบก่อนรองชนะเลิศ" : `รอบ ${teamsInRound} ทีม`; }
// teams: seeded (seed 1..n, 1 = strongest). Builds every round's matches up front, wiring
// nextMatchId/nextSlot so a finished match auto-feeds its winner forward. A first-round match with only
// one real team (uneven team count) is resolved immediately as status:"bye" (never counted as played)
// and that team is advanced into round 2 right away — top seeds receive byes first per standard seeding.
function generateKnockoutBracket(teams) {
  const size = nextPow2(Math.max(2, teams.length));
  const order = standardBracketOrder(size);
  const bySeed = {}; teams.forEach((t) => (bySeed[t.seed] = t));
  let roundSlots = order.map((seed) => bySeed[seed] || null);
  const allMatches = []; const rounds = [];
  let roundIndex = 0, prevRoundMatches = null;
  while (roundSlots.length > 1) {
    const label = roundLabelFor(roundSlots.length);
    const roundMatches = [];
    for (let i = 0; i < roundSlots.length; i += 2) {
      const a = roundSlots[i], b = roundSlots[i + 1];
      const isBye = roundIndex === 0 && (!a || !b);
      const m = makeTournamentMatch({ roundIndex, roundLabel: label, teamAId: a ? a.id : null, teamBId: b ? b.id : null, status: isBye ? "bye" : (a && b ? "ready" : "waiting") });
      if (isBye) m.winnerTeamId = a ? a.id : b ? b.id : null;
      roundMatches.push(m); allMatches.push(m);
    }
    rounds.push({ index: roundIndex, label, matchIds: roundMatches.map((m) => m.id) });
    if (prevRoundMatches) prevRoundMatches.forEach((pm, i) => { pm.nextMatchId = roundMatches[Math.floor(i / 2)].id; pm.nextSlot = i % 2 === 0 ? "A" : "B"; });
    prevRoundMatches = roundMatches;
    roundSlots = roundMatches.map((m) => (m.status === "bye" ? teams.find((t) => t.id === m.winnerTeamId) || null : null));
    roundIndex++;
  }
  return { matches: allMatches, rounds };
}
// call after a match completes: pushes the winner into nextMatchId/nextSlot and flips that match from
// waiting->ready once both slots are filled.
function advanceWinner(matches, finishedMatch) {
  if (!finishedMatch.nextMatchId) return matches;
  return matches.map((m) => {
    if (m.id !== finishedMatch.nextMatchId) return m;
    const upd = { ...m };
    if (finishedMatch.nextSlot === "A") upd.teamAId = finishedMatch.winnerTeamId; else upd.teamBId = finishedMatch.winnerTeamId;
    if (upd.teamAId && upd.teamBId && upd.status === "waiting") upd.status = "ready";
    return upd;
  });
}
// reverse of advanceWinner — used when a completed match's result is edited/undone: strips the winner
// back out of the downstream match and, if that match had already started, the caller must warn first.
function retractWinner(matches, finishedMatch) {
  if (!finishedMatch.nextMatchId) return matches;
  return matches.map((m) => {
    if (m.id !== finishedMatch.nextMatchId) return m;
    const upd = { ...m };
    if (finishedMatch.nextSlot === "A") upd.teamAId = null; else upd.teamBId = null;
    if (upd.status === "ready") upd.status = "waiting";
    return upd;
  });
}

/* ---- round robin (also powers League's single/double round robin) ---- */
// circle method; an odd team count gets a rotating bye (null) each round, tracked as status:"bye" and
// never counted in standings' `played`.
function generateRoundRobinFixture(teams, doubleRound) {
  let list = teams.map((t) => t.id);
  if (list.length % 2 === 1) list = [...list, null];
  const n = list.length, roundsCount = n - 1, half = n / 2;
  const rounds = []; let arr = [...list];
  for (let r = 0; r < roundsCount; r++) {
    const roundMatches = [];
    for (let i = 0; i < half; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (a == null || b == null) roundMatches.push(makeTournamentMatch({ roundIndex: r, roundLabel: `นัดที่ ${r + 1}`, teamAId: a, teamBId: b, status: "bye" }));
      else roundMatches.push(makeTournamentMatch({ roundIndex: r, roundLabel: `นัดที่ ${r + 1}`, teamAId: a, teamBId: b, status: "ready" }));
    }
    rounds.push(roundMatches);
    arr = [arr[0], arr[n - 1], ...arr.slice(1, -1)];
  }
  let allMatches = rounds.flat();
  if (doubleRound) {
    const second = allMatches.filter((m) => m.status !== "bye").map((m) => makeTournamentMatch({ roundIndex: m.roundIndex + roundsCount, roundLabel: `นัดที่ ${m.roundIndex + roundsCount + 1}`, teamAId: m.teamBId, teamBId: m.teamAId, status: "ready" }));
    allMatches = [...allMatches, ...second];
  }
  return { matches: allMatches, roundsCount: doubleRound ? roundsCount * 2 : roundsCount };
}
function computeStandings(teams, matches, pointsConfig) {
  const rows = {};
  teams.forEach((t) => (rows[t.id] = { teamId: t.id, played: 0, win: 0, loss: 0, draw: 0, points: 0, for: 0, against: 0, diff: 0 }));
  matches.filter((m) => m.status === "completed").forEach((m) => {
    const a = rows[m.teamAId], b = rows[m.teamBId];
    if (!a || !b) return;
    const sa = (m.scores || []).reduce((s, r) => s + (r?.a || 0), 0), sb = (m.scores || []).reduce((s, r) => s + (r?.b || 0), 0);
    a.played++; b.played++; a.for += sa; a.against += sb; b.for += sb; b.against += sa;
    if (m.winnerTeamId === m.teamAId) { a.win++; b.loss++; a.points += pointsConfig.win; b.points += pointsConfig.loss; }
    else if (m.winnerTeamId === m.teamBId) { b.win++; a.loss++; b.points += pointsConfig.win; a.points += pointsConfig.loss; }
    else { a.draw++; b.draw++; a.points += pointsConfig.draw; b.points += pointsConfig.draw; }
  });
  Object.values(rows).forEach((r) => (r.diff = r.for - r.against));
  const h2h = (idA, idB) => { const m = matches.find((mm) => mm.status === "completed" && ((mm.teamAId === idA && mm.teamBId === idB) || (mm.teamAId === idB && mm.teamBId === idA))); if (!m) return 0; return m.winnerTeamId === idA ? 1 : m.winnerTeamId === idB ? -1 : 0; };
  return Object.values(rows).sort((x, y) => y.points - x.points || (y.win - y.loss) - (x.win - x.loss) || y.diff - x.diff || y.for - x.for || h2h(x.teamId, y.teamId));
}

/* ---- group stage ---- */
// snake-distributes seeded teams across groups so strong teams spread out (seed1->G1,seed2->G2,...,
// wraps back seedN->G1) instead of clustering into one group.
function assignGroups(teams, groupCount) {
  const groups = Array.from({ length: groupCount }, (_, i) => makeGroup({ name: String.fromCharCode(65 + i) }));
  const sorted = [...teams].sort((a, b) => (a.seed || 999) - (b.seed || 999));
  let dir = 1, gi = 0;
  sorted.forEach((t) => { groups[gi].teamIds.push(t.id); if (dir === 1 && gi === groupCount - 1) dir = -1; else if (dir === -1 && gi === 0) dir = 1; else gi += dir; });
  return groups;
}
// builds the bracket-seed list from each group's qualifiers, keeping same-group teams as far apart as
// possible: bucket by group-rank (all group winners first, then all runners-up, ...), snake-reversing
// alternate buckets so e.g. Group A's winner doesn't land next to Group A's runner-up.
function seedGroupKnockout(qualifiers) {
  // Standard bracket seeding always pairs round-1 seed i against seed (N+1-i). Bucketing by rank in a
  // CONSISTENT group order (never reversed) and numbering seeds straight through — rank1's group1..G as
  // seeds 1..G, rank2's group1..G as seeds G+1..2G, etc — means seed i and seed (N+1-i) always land in
  // different ranks AND different groups whenever the group count is even (the common case, e.g. 4
  // groups/top 2 -> seeds 1-4 vs 5-8 pairs 1v8/2v7/3v6/4v5, none of which share a group). This is what
  // keeps a group's own winner from meeting its own runner-up in round 1.
  const byRank = {};
  qualifiers.forEach((q) => (byRank[q.groupRank] = byRank[q.groupRank] || []).push(q));
  const ranks = Object.keys(byRank).map(Number).sort((a, b) => a - b);
  const ordered = [];
  ranks.forEach((r) => ordered.push(...byRank[r]));
  return ordered.map((q, i) => ({ ...q, seed: i + 1 }));
}

/* ---- swiss ---- */
function swissRound1Pairing(teams, seedMode, playersById) {
  const ordered = seedMode === "random" ? shuffleArr(teams) : seedBySkill(teams, playersById);
  const half = Math.ceil(ordered.length / 2);
  const top = ordered.slice(0, half), bottom = ordered.slice(half);
  const matches = [];
  top.forEach((a, i) => { const b = bottom[i]; if (!b) matches.push(makeTournamentMatch({ roundIndex: 0, roundLabel: "Swiss รอบ 1", teamAId: a.id, teamBId: null, status: "bye", winnerTeamId: a.id })); else matches.push(makeTournamentMatch({ roundIndex: 0, roundLabel: "Swiss รอบ 1", teamAId: a.id, teamBId: b.id, status: "ready" })); });
  return matches;
}
// pairs teams with the closest record, avoiding rematches when an alternative exists; the bye goes to
// the lowest-standing team that hasn't had one yet (falls back to lowest overall once everyone has).
function swissNextRoundPairing(teams, standings, allMatches, roundIndex) {
  const played = new Set();
  allMatches.filter((m) => (m.status === "completed" || m.status === "bye") && m.teamAId && m.teamBId).forEach((m) => played.add([m.teamAId, m.teamBId].sort().join("|")));
  const byeCount = {}; teams.forEach((t) => (byeCount[t.id] = 0));
  allMatches.filter((m) => m.status === "bye").forEach((m) => { const id = m.teamAId || m.teamBId; if (id) byeCount[id] = (byeCount[id] || 0) + 1; });
  const standingRank = {}; standings.forEach((s, i) => (standingRank[s.teamId] = i));
  let pool = [...teams].sort((a, b) => (standingRank[a.id] ?? 999) - (standingRank[b.id] ?? 999));
  const matches = []; let byeTeam = null;
  if (pool.length % 2 === 1) {
    const byWorstFirst = [...pool].sort((a, b) => (standingRank[b.id] ?? -1) - (standingRank[a.id] ?? -1) || byeCount[a.id] - byeCount[b.id]);
    byeTeam = byWorstFirst[0];
    pool = pool.filter((t) => t.id !== byeTeam.id);
  }
  const used = new Set();
  for (let i = 0; i < pool.length; i++) {
    const a = pool[i]; if (used.has(a.id)) continue; used.add(a.id);
    let opp = null;
    for (let j = i + 1; j < pool.length; j++) { const b = pool[j]; if (used.has(b.id)) continue; if (!played.has([a.id, b.id].sort().join("|"))) { opp = b; break; } }
    if (!opp) for (let j = i + 1; j < pool.length; j++) { if (!used.has(pool[j].id)) { opp = pool[j]; break; } } // no rematch-free option left — allow rematch
    if (opp) { used.add(opp.id); matches.push(makeTournamentMatch({ roundIndex, roundLabel: `Swiss รอบ ${roundIndex + 1}`, teamAId: a.id, teamBId: opp.id, status: "ready" })); }
  }
  if (byeTeam) matches.push(makeTournamentMatch({ roundIndex, roundLabel: `Swiss รอบ ${roundIndex + 1}`, teamAId: byeTeam.id, teamBId: null, status: "bye", winnerTeamId: byeTeam.id }));
  return matches;
}

/* ---- handicap (BadQ internal configurable recommendation — NEVER presented as an official formula) ---- */
function handicapRecommendation(teamA, teamB, playersById) {
  const diff = teamStrength(teamA, playersById) - teamStrength(teamB, playersById);
  if (diff === 0) return { a: 0, b: 0 };
  const points = Math.min(5, Math.round(Math.abs(diff) * 0.8));
  return diff > 0 ? { a: 0, b: points } : { a: points, b: 0 };
}

/* ---- misc helpers ---- */
function isPlayerBusyInTournament(tournament, playerId, excludeMatchId) {
  const allMatches = tournamentAllMatches(tournament);
  const teamsOfPlayer = new Set((tournament.teams || []).filter((t) => (t.playerIds || []).includes(playerId)).map((t) => t.id));
  return allMatches.some((m) => m.id !== excludeMatchId && m.status === "playing" && (teamsOfPlayer.has(m.teamAId) || teamsOfPlayer.has(m.teamBId)));
}
// flattens every match across every division/group/bracket/swiss/league layer of a Tournament
function tournamentAllMatches(tournament) {
  if (!tournament) return [];
  const out = [];
  (tournament.divisions || []).forEach((d) => {
    out.push(...(d.matches || [])); // roundRobin / league matches live directly on the division
    out.push(...(d.swissMatches || [])); // swiss matches live in a separate array on the division
    (d.groups || []).forEach((g) => out.push(...(g.matches || [])));
    if (d.bracket) out.push(...(d.bracket.matches || []));
  });
  return out;
}
function totalTournamentMatchCount(tournament) {
  const all = tournamentAllMatches(tournament).filter((m) => m.status !== "bye");
  return { done: all.filter((m) => m.status === "completed").length, total: all.length };
}
// v1.10.0: registration-fee progress. Fee income from PAID teams is what feeds tournamentFinanceTotals()
// below as "entry fee" revenue — unpaid teams contribute nothing until toggled paid (tToggleTeamPaid).
const TOURNAMENT_EXPENSE_CATEGORIES = [["court", "สนาม/สถานที่"], ["shuttle", "ลูกขนไก่"], ["prize", "รางวัล/ถ้วย"], ["other", "อื่นๆ"]];
// v1.11.1: Thai label lookup for the keys above — used when a completed Tournament's expense entries
// get merged into the overall financial report's catTotals breakdown (see computeFinanceForRange), so
// they render as readable Thai text ("🏆 สนาม/สถานที่") instead of the raw storage key ("court").
const TOURNAMENT_EXPENSE_CAT_LABEL = Object.fromEntries(TOURNAMENT_EXPENSE_CATEGORIES);
// "entry" (ค่าสมัคร) is deliberately NOT a selectable manual category here — it's shown as a read-only
// auto-computed row in TournamentFinancePanel (tournamentEntryFeeTotal) instead, so there is exactly one
// way entry-fee income can enter the totals and no way for an organizer to accidentally double-log it.
const TOURNAMENT_INCOME_CATEGORIES = [["sponsor", "สปอนเซอร์"], ["other", "รายได้อื่นๆ"]];
const TOURNAMENT_INCOME_CAT_LABEL = Object.fromEntries(TOURNAMENT_INCOME_CATEGORIES);
function registrationProgress(t) {
  if (!t) return { paid: 0, total: 0 };
  const total = (t.teams || []).length;
  const paid = (t.registration?.paidTeamIds || []).filter((id) => (t.teams || []).some((tm) => tm.id === id)).length;
  return { paid, total };
}
function registrationFeeAmountFor(t, team) {
  const reg = t.registration || { feeMode: "none", feeAmount: 0 };
  if (reg.feeMode === "perTeam") return Number(reg.feeAmount) || 0;
  if (reg.feeMode === "perPlayer") return (Number(reg.feeAmount) || 0) * ((team.playerIds || []).length || 1);
  return 0;
}
// Entry-fee income is DERIVED from registration (paid teams × their fee) rather than requiring the
// organizer to also manually log it as a finance "income" row — this is what section 16 means by
// "must not double-count": the manual finance.income list is for sponsor/other income ONLY, entry fees
// are computed once here and never also re-enterable as a manual income row (see TOURNAMENT_INCOME_CATEGORIES
// excludes "entry" from the manual-add form in TournamentFinancePanel).
function tournamentEntryFeeTotal(t) {
  if (!t || !t.registration || t.registration.feeMode === "none") return 0;
  return (t.teams || []).filter((tm) => (t.registration.paidTeamIds || []).includes(tm.id)).reduce((s, tm) => s + registrationFeeAmountFor(t, tm), 0);
}
function tournamentFinanceTotals(t) {
  if (!t) return { income: 0, expense: 0, profit: 0, entryFee: 0, otherIncome: 0 };
  const entryFee = tournamentEntryFeeTotal(t);
  const otherIncome = (t.finance?.income || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const expense = (t.finance?.expense || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const income = entryFee + otherIncome;
  return { income, expense, profit: income - expense, entryFee, otherIncome };
}
// locates a match anywhere inside the nested division/group/bracket/swiss structure
function findTMatch(t, matchId) {
  for (const d of t?.divisions || []) {
    for (const m of d.matches || []) if (m.id === matchId) return { match: m, divisionId: d.id, scope: "division" };
    for (const g of d.groups || []) for (const m of g.matches || []) if (m.id === matchId) return { match: m, divisionId: d.id, groupId: g.id, scope: "group" };
    if (d.bracket) for (const m of d.bracket.matches || []) if (m.id === matchId) return { match: m, divisionId: d.id, scope: "bracket" };
    for (const m of d.swissMatches || []) if (m.id === matchId) return { match: m, divisionId: d.id, scope: "swiss" };
  }
  return null;
}
function replaceTMatchInDivision(d, found, matchId, newMatch) {
  if (found.scope === "bracket") return { ...d, bracket: { ...d.bracket, matches: d.bracket.matches.map((m) => (m.id === matchId ? newMatch : m)) } };
  if (found.scope === "group") return { ...d, groups: d.groups.map((g) => (g.id === found.groupId ? { ...g, matches: g.matches.map((m) => (m.id === matchId ? newMatch : m)) } : g)) };
  if (found.scope === "swiss") return { ...d, swissMatches: d.swissMatches.map((m) => (m.id === matchId ? newMatch : m)) };
  return { ...d, matches: d.matches.map((m) => (m.id === matchId ? newMatch : m)) };
}
// immutable update of one match anywhere in the tournament; updaterFn(match, found) -> new match object
function updateTournamentMatch(t, matchId, updaterFn) {
  const found = findTMatch(t, matchId);
  if (!found) return t;
  const newMatch = updaterFn(found.match, found);
  if (!newMatch) return t;
  return { ...t, divisions: t.divisions.map((d) => (d.id === found.divisionId ? replaceTMatchInDivision(d, found, matchId, newMatch) : d)) };
}
// which players are currently mid-match anywhere in the tournament (used to block double-court-booking)
function tournamentBusyPlayers(t) {
  const set = new Set();
  if (!t) return set;
  const teamsById = Object.fromEntries((t.teams || []).map((tm) => [tm.id, tm]));
  tournamentAllMatches(t).filter((m) => m.status === "playing").forEach((m) => [m.teamAId, m.teamBId].forEach((tid) => (teamsById[tid]?.playerIds || []).forEach((pid) => set.add(pid))));
  return set;
}
function tournamentBusyCourts(t) { return new Set(tournamentAllMatches(t).filter((m) => m.status === "playing").map((m) => m.court)); }

/* ---- v1.11.4: normalized Tournament result/report model ----
   Single source of truth for champion/runnerUp/third + player win-loss stats, shared by:
   tCompleteTournament (freezes these into the archived snapshot), the live in-progress dashboard,
   the completed-tournament Summary page, the Share text, and the PDF export. Never compute these
   independently in a UI component — always go through buildTournamentResultReport so an edited
   result (before or after archiving) is reflected everywhere at once. */

// champion/runnerUp/third for one division, from its CURRENT bracket or standings — works identically
// whether the tournament is still active or already archived. Returns nulls (not guesses) when the
// division hasn't produced a result yet, and supports a shared/joint third place (thirdIds: []).
function computeDivisionPodium(d, teamsById, pointsConfig) {
  if (!d) return { champion: null, runnerUp: null, thirdIds: [] };
  if (d.bracket) {
    const finalMatch = d.bracket.matches.find((m) => !m.nextMatchId && m.status === "completed");
    if (!finalMatch) return { champion: null, runnerUp: null, thirdIds: [] };
    const champion = finalMatch.winnerTeamId;
    const runnerUp = finalMatch.teamAId === champion ? finalMatch.teamBId : finalMatch.teamAId;
    // both semifinal losers share 3rd place — the bracket structure doesn't play a 3rd-place match,
    // so we surface both losers rather than arbitrarily picking one (matches current Tournament rules).
    const semis = d.bracket.matches.filter((m) => m.nextMatchId === finalMatch.id && m.status === "completed");
    const thirdIds = semis.flatMap((m) => [m.teamAId, m.teamBId]).filter((id) => id && id !== champion && id !== runnerUp);
    return { champion, runnerUp, thirdIds };
  }
  const divTeams = (d.teamIds || []).map((id) => teamsById[id]).filter(Boolean);
  const matches = d.matches && d.matches.length ? d.matches : (d.swissMatches || []);
  if (!matches.length) return { champion: null, runnerUp: null, thirdIds: [] };
  const standings = computeStandings(divTeams, matches, pointsConfig);
  if (!standings.some((r) => r.played > 0)) return { champion: null, runnerUp: null, thirdIds: [] };
  return { champion: standings[0]?.teamId || null, runnerUp: standings[1]?.teamId || null, thirdIds: standings[2] ? [standings[2].teamId] : [] };
}
// per-player wins/losses across the WHOLE tournament (all divisions/groups/bracket/swiss combined),
// derived purely from t.teams + completed matches — safe to call for an in-progress tournament too.
function computeTournamentPlayerStats(t) {
  const teamsById = Object.fromEntries((t.teams || []).map((tm) => [tm.id, tm]));
  const allMatches = tournamentAllMatches(t).filter((m) => m.status === "completed");
  const byPlayer = {};
  (t.teams || []).forEach((tm) => (tm.playerIds || []).forEach((pid) => { byPlayer[pid] = byPlayer[pid] || { playerId: pid, wins: 0, losses: 0 }; }));
  allMatches.forEach((m) => {
    [m.teamAId, m.teamBId].forEach((tid) => {
      if (!tid) return;
      const tm = teamsById[tid]; if (!tm) return;
      (tm.playerIds || []).forEach((pid) => {
        const s = byPlayer[pid]; if (!s) return;
        if (m.winnerTeamId === tid) s.wins++; else if (m.winnerTeamId) s.losses++;
      });
    });
  });
  return Object.values(byPlayer).filter((s) => s.wins + s.losses > 0).sort((a, b) => b.wins - a.wins || a.losses - b.losses);
}
// headline counts used by the Summary header — teams/players/matches + which stage path this
// tournament actually ran (so the report never assumes a bracket or groups that don't exist).
function tournamentResultTotals(t) {
  const allMatches = tournamentAllMatches(t).filter((m) => m.status !== "bye");
  const teamCount = (t.teams || []).length;
  const playerCount = new Set((t.teams || []).flatMap((tm) => tm.playerIds || [])).size;
  const hasGroups = (t.divisions || []).some((d) => d.groups && d.groups.length > 0);
  const hasBracket = (t.divisions || []).some((d) => d.bracket);
  const stagePath = hasGroups && hasBracket ? "Group Stage → Knockout" : (TOURNAMENT_FORMAT_LABELS[t.format] || t.format);
  return { totalMatches: allMatches.length, completedMatches: allMatches.filter((m) => m.status === "completed").length, teamCount, playerCount, hasGroups, hasBracket, stagePath };
}
// THE single entry point every result-facing view (live dashboard, historical Summary, share text,
// PDF export) should call. Never trust a division's frozen d.champion/runnerUp/third as primary —
// those are only a snapshot taken once at archive time and go stale the moment a result is edited.
function buildTournamentResultReport(t, peopleById) {
  if (!t) return null;
  const teamsById = Object.fromEntries((t.teams || []).map((tm) => [tm.id, tm]));
  const totals = tournamentResultTotals(t);
  const divisions = (t.divisions || []).map((d) => ({ ...d, podium: computeDivisionPodium(d, teamsById, t.pointsConfig) }));
  const mainDivision = divisions.length === 1 ? divisions[0] : null;
  const playerStats = (t.status === "completed" || t.status === "archived") && t.playerStats ? t.playerStats : computeTournamentPlayerStats(t);
  const finalMatch = mainDivision?.bracket ? mainDivision.bracket.matches.find((m) => !m.nextMatchId) || null : null;
  return {
    t, teamsById, peopleById, divisions, mainDivision, totals, playerStats,
    podium: mainDivision ? mainDivision.podium : null,
    finalMatch,
    isCompleted: t.status === "completed" || t.status === "archived",
  };
}

// suggests the best next match to fill an empty court: dependency-ready first, then no player already
// busy elsewhere, then longest-waiting (oldest ready match), then earlier round/group before later ones
function suggestNextTMatch(t) {
  if (!t) return null;
  const busy = tournamentBusyPlayers(t);
  const teamsById = Object.fromEntries((t.teams || []).map((tm) => [tm.id, tm]));
  const ready = tournamentAllMatches(t).filter((m) => m.status === "ready");
  const playable = ready.filter((m) => { const ps = [...(teamsById[m.teamAId]?.playerIds || []), ...(teamsById[m.teamBId]?.playerIds || [])]; return !ps.some((pid) => busy.has(pid)); });
  const pool = playable.length ? playable : ready; // fall back to any ready match if every ready match currently has a busy player
  if (!pool.length) return null;
  return [...pool].sort((a, b) => a.roundIndex - b.roundIndex || (a.startedAt || 0) - (b.startedAt || 0))[0];
}

export default function App() {
  const isWide = useIsWide(); // landscape phone / tablet — widen the shell so it doesn't look squeezed into a narrow column
  const [tab, setTab] = useState("members");
  const [players, setPlayers] = useState([]);
  const [history, setHistory] = useState([]);
  const [current, setCurrent] = useState([]);
  const [future, setFuture] = useState([]);
  const [roundNo, setRoundNo] = useState(0);
  const [courtCount, setCourtCountRaw] = useState(2);
  // reducing court count must release any reserved players sitting on the now-removed court(s) —
  // playing/next/done matches AND queued next-matches alike, since inPlay/reservedIdsFromCurrent/waitQueue
  // all derive from `current`; simply dropping those court's match entries here is enough (no separate
  // "reservation" state exists to clean up — Requirement 9 edge case "court removed → release reserved players").
  const setCourtCount = (n) => { setCourtCountRaw(n); setCurrent((prev) => prev.filter((m) => m.court <= n)); };
  const [courtLabels, setCourtLabelsRaw] = useState(["1", "2"]); // display numbers for each court/สนาม slot — index-aligned with courtCount, edited via setCourtLabel
  useEffect(() => { setCourtLabelsRaw((prev) => syncCourtLabels(prev, courtCount)); }, [courtCount]);
  const setCourtLabel = (i, value) => setCourtLabelsRaw((prev) => { const next = syncCourtLabels(prev, courtCount); next[i] = value; return next; });
  const [mode, setMode] = useState("doubles");
  const [settings, setSettings] = useState(getDefaultSettings);
  const [session, setSession] = useState({ id: uid(), name: "", date: new Date().toISOString().slice(0, 10), mode: "casual" }); // session.mode: "casual" (only mode in use today) | "tournament" (future) — see GAME MODE / TOURNAMENT block above; session.id (v1.9.1): stable id so live discountCredits can reference "this session" before it's archived
  const [lockPairs, setLockPairs] = useState([]);
  const [sel, setSel] = useState(null);
  const [sessionHistory, setSessionHistory] = useState([]); // archived (ended) sessions — see endSession()
  // Finance (v1.8.4): costs/income NOT tied to any one ก๊วน session — "ค่าใช้จ่ายทั่วไป"/"รายได้อื่น" on the
  // การเงิน tab (e.g. buying a box of shuttles, sponsor money). Per-session expenses instead live on each
  // sessionHistory entry's own `expenses` field (added lazily — see addHistExpense below).
  const [generalExpenses, setGeneralExpenses] = useState([]);
  const [otherIncome, setOtherIncome] = useState([]);
  const [discountCredits, setDiscountCredits] = useState([]); // "ส่วนลดครั้งหน้า" ledger (v1.9.1) — see DISCOUNT CREDITS block
  const [activeTournament, setActiveTournament] = useState(null); // the one Tournament being run right now (or null) — see TOURNAMENT ENGINE block
  const [tournamentHistory, setTournamentHistory] = useState([]); // archived/completed Tournaments — separate from sessionHistory
  const [now, setNow] = useState(Date.now());
  const [loaded, setLoaded] = useState(false);
  const [hasPreRestoreBackup, setHasPreRestoreBackup] = useState(false); // safety snapshot exists -> show "undo last restore"
  const fileRef = useRef();
  const qrRef = useRef();
  const photoTarget = useRef(null);
  const sessionPhotoFileRef = useRef(); // dedicated file input for the current ก๊วน's own photo (separate from per-player photos)
  const histPhotoTarget = useRef(null); // sessionHistory id currently being (re)photographed via HistoricalDetail
  const tLogoFileRef = useRef(); // v1.10.0: dedicated file input for the Tournament Profile logo (section 1)
  // v1.9.13: interactive crop/position step before ANY photo (player profile, ก๊วน photo, QR) is actually
  // saved — { src (raw picked image), circleGuide, title, onDone(croppedDataUrl) } | null. The file input's
  // onChange now only reads the raw file and opens this; the actual state write happens in onDone once the
  // user confirms the crop, so no existing save logic/shape changes — only WHEN the save happens moves later.
  const [cropJob, setCropJob] = useState(null);
  // Financial Report Export (v1.9.14) — PDF path is a full-screen print-optimized view that REPLACES the
  // entire app render (see the early return right after this component's other hooks) so bottom nav / tabs /
  // edit buttons are simply never mounted while printing, instead of being CSS-hidden. `null` = not open.
  const [financePrintReport, setFinancePrintReport] = useState(null);
  // v1.11.4: same early-return print-view pattern as financePrintReport, for the dedicated Tournament
  // PDF export — holds the buildTournamentResultReport object to render (not raw tournament data), so
  // the print view is always fed the exact same source of truth as the on-screen Summary/Podium/Bracket.
  const [tournamentPrintReport, setTournamentPrintReport] = useState(null);

  // ===== PERSISTENCE SAFETY GUARD (v1.9.15) =====
  // Bug this fixes: the app saves its ENTIRE state as one localStorage blob on every change. If two
  // instances are open at once (e.g. the Home Screen icon + a separate Safari tab — iOS keeps these as
  // two completely separate in-memory contexts even though they share the same localStorage), and one
  // instance finishes a ก๊วน/Tournament while the other still has an older, history-less state sitting in
  // memory, then merely touching that stale instance used to silently overwrite the newer data with the
  // old data (unrelated fields like `players` looked unaffected, but `sessionHistory`/`tournamentHistory`
  // vanished — exactly the symptom reported).
  //
  // Fix: every save now carries a `savedAt` timestamp, and `lastKnownSavedAtRef` tracks the `savedAt` of
  // whatever THIS instance's in-memory state currently reflects. Before every write we re-check storage;
  // if someone else has saved something newer than what we last loaded/saved, we pull THEIR data in
  // instead of clobbering it, and skip our own write. We also proactively re-check the moment the app
  // becomes active again (tab focus/visibility, iOS bfcache restore) so a stale instance heals itself
  // before the user can even touch anything.
  const lastKnownSavedAtRef = useRef(0);
  const latestStateJsonRef = useRef(null); // most recently computed save payload — read synchronously by the pagehide/visibility flush below (section 14)
  const [staleSyncNotice, setStaleSyncNotice] = useState(null); // brief banner text, or null when hidden
  // v1.9.23: mobile browsers (iOS Safari standalone "Add to Home Screen" apps especially) can and do
  // clear a site's localStorage under storage pressure or after enough time unvisited — there is no way
  // for the app itself to prevent this (see navigator.storage.persist() attempt in index.html's <head>,
  // which is a best-effort mitigation, not a guarantee). The ONLY real protection is an export the user
  // holds outside the browser's storage — so nudge them to take one periodically. Dismissal is
  // session-only (not persisted) so a still-overdue reminder resurfaces on the next full app open instead
  // of being silenced forever by one tap.
  const [backupNoticeDismissed, setBackupNoticeDismissed] = useState(false);
  // v1.9.26: true only when the boot load found a "bg-v11" value that existed but failed to JSON.parse
  // (real corruption — not "first ever launch, nothing saved yet"). While true, the save effect below
  // refuses to write anything, so the app can never silently paper over corrupted-but-still-technically-
  // present data with a fresh empty save. Cleared once the user restores from a checkpoint/backup, or
  // explicitly acknowledges starting fresh (see the recovery banner near the top of the render).
  const [loadCorrupted, setLoadCorrupted] = useState(false);
  // v1.11.0 PERSISTENCE REWRITE — explicit boot state machine (replaces relying on `loaded` alone,
  // since "storage returned nothing" is NOT equivalent to "a valid empty database loaded"). One of:
  // "loading" (boot sequence still running), "restored" (a valid state was found/recovered from some
  // layer), "new-install" (genuinely no evidence of prior data anywhere), "recovery-required" (evidence
  // of prior data exists but nothing recoverable could be validated — kept in sync with the legacy
  // `loadCorrupted` flag above so the existing recovery banner/tests keep working unchanged), "error"
  // (the boot sequence itself hit an unexpected exception). The save effect below refuses to write
  // ANYTHING except while bootStatus is "restored" or "new-install" — this is the boot barrier that
  // makes "primary missing -> defaults to [] -> saves [] over recoverable data" structurally impossible.
  const [bootStatus, setBootStatus] = useState("loading");
  // Small non-blocking toast shown after an automatic recovery from Last-Known-Good or Auto-Backup (an
  // actual "your data was restored for you" event, distinct from the ordinary same-tab boot case) — per
  // spec, this must never force the user into the manual restore screen. Auto-dismisses; purely informational.
  const [autoRecoveryToast, setAutoRecoveryToast] = useState(null);
  // v1.9.25: the head script's update-check no longer force-reloads on its own (see index.html's <head>
  // comment) — it just records a newer version exists. This picks that up (either via the event, if
  // React was already mounted when the check resolved, or via the window.__badqNewVersion flag directly,
  // in case the fetch resolved before this effect had a chance to attach its listener) and shows a small
  // banner the user taps to actually reload. The reload itself is unchanged (?_v= cache-busted
  // navigation) — only WHEN it happens changed, from automatic to explicitly user-initiated. Removed
  // rather than re-tuned again because it's the one clear structural difference between BadQ and Sun's
  // other similarly-built standalone PWA (Werewolf Party) — which has no auto-reload code at all and has
  // never shown the "data wiped after swipe-away + reopen" symptom, even on a day it was redeployed just
  // as rapidly as BadQ was.
  const [updateAvailable, setUpdateAvailable] = useState(null); // new version string, or null when none
  useEffect(() => {
    if (window.__badqNewVersion) setUpdateAvailable(window.__badqNewVersion);
    const onUpdate = (e) => setUpdateAvailable((e && e.detail && e.detail.version) || "ใหม่");
    window.addEventListener("badq:update-available", onUpdate);
    return () => window.removeEventListener("badq:update-available", onUpdate);
  }, []);
  const applyUpdateNow = () => {
    try { location.replace(location.pathname + "?_v=" + Date.now()); } catch (e) {}
  };
  // Applies a parsed "bg-v11" blob to React state. Shared by the initial load AND the staleness guard
  // below so the two can never silently drift apart on which fields they read/default.
  const applyPersistedState = (s) => {
    if (!s) return;
    s.players && setPlayers(s.players.map(normPlayer));
    s.history && setHistory(s.history);
    s.current && setCurrent(s.current);
    s.future && setFuture(s.future);
    typeof s.roundNo === "number" && setRoundNo(s.roundNo);
    s.courtCount && setCourtCount(s.courtCount);
    setCourtLabelsRaw(syncCourtLabels(s.courtLabels, s.courtCount || 2)); // absent on old saves -> sequential default, backward-compatible
    s.mode && setMode(s.mode);
    s.settings && setSettings((d) => ({ ...d, ...s.settings }));
    s.session && setSession({ ...s.session, mode: s.session.mode || "casual", id: s.session.id || uid() }); // old saves have no `mode`/`id` — default them, backward-compatible
    s.lockPairs && setLockPairs(migrateLockPairs(s.lockPairs));
    setSessionHistory((Array.isArray(s.sessionHistory) ? s.sessionHistory : []).map(ensureSessionExpenses)); // new field: default [] if absent (backward-compatible)
    setGeneralExpenses(Array.isArray(s.generalExpenses) ? s.generalExpenses : []);
    setOtherIncome(Array.isArray(s.otherIncome) ? s.otherIncome : []);
    setDiscountCredits((Array.isArray(s.discountCredits) ? s.discountCredits : []).map(normDiscountCredit));
    setActiveTournament(normTournament(s.activeTournament) || null); // new field: absent on old saves -> no active Tournament, Casual unaffected
    setTournamentHistory((Array.isArray(s.tournamentHistory) ? s.tournamentHistory : []).map(normTournament));
    // old saves (pre-v1.9.15) have no `savedAt` — treat them as "current as of right now" rather than 0,
    // so upgrading doesn't itself trigger a false "newer data elsewhere" flag on the very next save.
    lastKnownSavedAtRef.current = typeof s.savedAt === "number" ? s.savedAt : Date.now();
    // keep the auto-backup growth-watcher's baseline in sync with whatever we just loaded — otherwise a
    // load/heal that brings in existing history would look like "history just grew" and fire a spurious
    // extra checkpoint (see the sessionHistory/tournamentHistory effect below).
    prevHistLenRef.current = {
      session: Array.isArray(s.sessionHistory) ? s.sessionHistory.length : 0,
      tournament: Array.isArray(s.tournamentHistory) ? s.tournamentHistory.length : 0
    };
  };
  // ===== AUTO-BACKUP CHECKPOINTS (v1.9.16) =====
  // A silent, in-app safety net layered on top of the guard above — for the organizer who never
  // remembers to tap "สำรองข้อมูล" manually. Every time sessionHistory/tournamentHistory GROWS (i.e. a
  // ก๊วน or Tournament just got archived), a full snapshot is stashed into localStorage — no dialog, no
  // download, nothing that interrupts "จบก๊วน". Restoring one reuses the exact same preview/confirm flow
  // as importing a backup file (see BackupSettingsEditor) — see "สำรองข้อมูลอัตโนมัติ" in ตั้งค่า.
  const [autoBackups, setAutoBackups] = useState([]); // newest first, capped at AUTO_BACKUP_MAX
  const prevHistLenRef = useRef({ session: 0, tournament: 0 }); // baseline to detect "history grew" vs. any other edit
  // v1.9.18: forensic boot/heal log — see BOOT_LOG_KEY above. Pure diagnostics: read-only in the UI,
  // never influences load/save behavior.
  const [bootLog, setBootLog] = useState([]); // newest first, capped at BOOT_LOG_MAX
  const pushBootLog = (entry) => {
    try {
      setBootLog((prev) => {
        const next = [{ t: Date.now(), ...entry }, ...prev].slice(0, BOOT_LOG_MAX);
        window.storage.set(BOOT_LOG_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    } catch (e) {}
  };
  const saveAutoBackup = async (reason) => {
    try {
      const payload = buildBackupPayload({ players, history, current, future, roundNo, courtCount, courtLabels, mode, settings, session, lockPairs, sessionHistory, activeTournament, tournamentHistory, generalExpenses, otherIncome, discountCredits });
      const entry = { savedAt: Date.now(), reason: reason || "auto", stats: backupStats(payload.data), payload };
      const next = [entry, ...autoBackups].slice(0, AUTO_BACKUP_MAX);
      setAutoBackups(next);
      await window.storage.set(AUTO_BACKUP_KEY, JSON.stringify(next));
    } catch (e) {}
  };
  // Re-reads "bg-v11"; if its `savedAt` is newer than what THIS instance's memory reflects, pulls it in
  // (instead of letting this instance later write stale data over it) and, optionally, tells the user.
  // Returns true iff a newer save was found and applied.
  const refreshFromStorageIfNewer = async (announce) => {
    try {
      const r = await window.storage.get("bg-v11");
      if (!r?.value) return false;
      const s = JSON.parse(r.value);
      const storedSavedAt = typeof s.savedAt === "number" ? s.savedAt : 0;
      if (storedSavedAt > lastKnownSavedAtRef.current) {
        const prevKnownSavedAt = lastKnownSavedAtRef.current;
        applyPersistedState(s);
        pushBootLog({ event: "heal", fromSavedAt: prevKnownSavedAt, toSavedAt: storedSavedAt, playerCount: Array.isArray(s.players) ? s.players.length : 0, sessionHistoryCount: Array.isArray(s.sessionHistory) ? s.sessionHistory.length : 0 });
        if (announce) {
          setStaleSyncNotice("มีข้อมูลใหม่กว่าจากอุปกรณ์/แท็บอื่น — รีเฟรชให้แล้ว");
          setTimeout(() => setStaleSyncNotice(null), 4000);
        }
        return true;
      }
    } catch (e) {}
    return false;
  };

  useEffect(() => {
    // v1.11.0 PERSISTENCE REWRITE — startup recovery waterfall (replaces the v1.9.26 "read bg-v11,
    // parse-or-flag-corrupted" boot effect). Order: primary (IndexedDB) -> mirror (localStorage) ->
    // Last-Known-Good -> newest valid Auto-Backup entry -> only THEN "new install", and only after
    // checking the boot log for evidence this device previously had real data. See tryRecoverFlatState/
    // tryRecoverFromAutoBackupEntry above for the shared validate-don't-guess recovery logic, and the
    // save effect below for the matching boot barrier that makes this waterfall actually matter (a
    // recovered/created state here is worthless if something can still save an empty one over it).
    (async () => {
      const storageErrors = [];
      let primaryFound = false, primaryValid = false, mirrorFound = false, lastKnownGoodFound = false, autoBackupFound = false;
      let finalState = null, recoverySource = "new-install", recoveryAction = "none";
      let corrupted = false; // legacy flag — kept in sync so the existing recovery banner/tests (which key off `loadCorrupted`) keep working unchanged; true exactly when bootStatus lands on "recovery-required"

      try {
        // Steps 1-2: primary then mirror. getBothRaw (unlike the self-healing get()) reports each
        // backend independently, so a corrupted PRIMARY doesn't stop us from checking whether the
        // MIRROR independently still holds something valid (and vice versa) — see TEST F.
        let bothRaw = { primary: null, mirror: null };
        try { bothRaw = await window.storage.getBothRaw("bg-v11"); } catch (e) { storageErrors.push("bg-v11 read: " + (e?.message || e)); }
        primaryFound = !!bothRaw.primary;
        mirrorFound = !!bothRaw.mirror;
        for (const candidate of [bothRaw.primary, bothRaw.mirror]) {
          if (!candidate) continue;
          const recovered = tryRecoverFlatState(candidate);
          if (recovered) {
            finalState = recovered;
            recoverySource = candidate === bothRaw.primary ? "primary" : "mirror";
            primaryValid = recoverySource === "primary";
            break;
          }
          storageErrors.push((candidate === bothRaw.primary ? "primary" : "mirror") + " present but failed validation/parse");
        }

        // Step 3: Last Known Good
        if (!finalState) {
          try {
            const lkgR = await window.storage.get(LKG_KEY);
            if (lkgR?.value) {
              lastKnownGoodFound = true;
              const recovered = tryRecoverFlatState(lkgR.value);
              if (recovered) { finalState = recovered; recoverySource = "last-known-good"; recoveryAction = "restored-from-last-known-good"; }
              else storageErrors.push("last-known-good present but failed validation/parse");
            }
          } catch (e) { storageErrors.push("last-known-good read: " + (e?.message || e)); }
        }

        // Step 4: newest valid Auto-Backup entry (list is already newest-first)
        if (!finalState) {
          try {
            const abR = await window.storage.get(AUTO_BACKUP_KEY);
            const list = abR?.value ? JSON.parse(abR.value) : [];
            if (Array.isArray(list) && list.length) {
              autoBackupFound = true;
              for (const entry of list) {
                const recovered = tryRecoverFromAutoBackupEntry(entry);
                if (recovered) { finalState = recovered; recoverySource = "auto-backup"; recoveryAction = "restored-from-auto-backup"; break; }
              }
              if (!finalState) storageErrors.push("auto-backup list present but no entry validated");
            }
          } catch (e) { storageErrors.push("auto-backup read: " + (e?.message || e)); }
        }
      } catch (e) { storageErrors.push("waterfall: " + (e?.message || e)); }

      let bootStatusResult, recoveredPlayerCount = 0, recoveredHistoryCount = 0, loadedSavedAt = null;

      if (finalState) {
        applyPersistedState(finalState);
        recoveredPlayerCount = Array.isArray(finalState.players) ? finalState.players.length : 0;
        recoveredHistoryCount = Array.isArray(finalState.sessionHistory) ? finalState.sessionHistory.length : 0;
        loadedSavedAt = typeof finalState.savedAt === "number" ? finalState.savedAt : null;
        bootStatusResult = "restored";
        if (recoverySource !== "primary") {
          // Close the gap immediately: rebuild primary + mirror + Last-Known-Good from whatever layer
          // actually had the good data, so the NEXT boot reads a clean primary instead of limping along.
          recoveryAction = recoveryAction === "none" ? ("rebuilt-from-" + recoverySource) : recoveryAction;
          try {
            const rebuiltAt = Date.now();
            const rebuiltJson = JSON.stringify({ ...finalState, savedAt: rebuiltAt });
            await window.storage.set("bg-v11", rebuiltJson);
            await window.storage.set(LKG_KEY, rebuiltJson);
            lastKnownSavedAtRef.current = rebuiltAt;
          } catch (e) { storageErrors.push("rebuild-after-recovery: " + (e?.message || e)); }
          if (recoverySource === "last-known-good" || recoverySource === "auto-backup") {
            // A genuine "this would have been gone" automatic recovery — a small non-blocking heads-up,
            // never a forced trip to the manual restore screen (spec: automatic recovery, no modal spam).
            setAutoRecoveryToast("♻️ กู้คืนข้อมูลล่าสุดให้อัตโนมัติแล้ว");
            setTimeout(() => setAutoRecoveryToast(null), 5000);
          }
        }
      } else {
        // Nothing recoverable anywhere. Do NOT assume "new install" just because bg-v11 is missing —
        // check for evidence this device previously had real data first (section 8): a present-but-
        // unreadable primary/mirror/LKG/auto-backup IS such evidence on its own, and so is a boot log
        // showing this device previously booted with actual players/history.
        let priorBootEvidence = false;
        try {
          const bl = await window.storage.get(BOOT_LOG_KEY);
          const list = bl?.value ? JSON.parse(bl.value) : [];
          priorBootEvidence = Array.isArray(list) && list.some((e) => (e.recoveredPlayerCount || e.playerCount || 0) > 0 || (e.recoveredHistoryCount || e.sessionHistoryCount || 0) > 0);
        } catch (e) {}
        const hadUnreadableEvidence = primaryFound || mirrorFound || lastKnownGoodFound || autoBackupFound;
        if (hadUnreadableEvidence || priorBootEvidence) {
          bootStatusResult = "recovery-required";
          corrupted = true;
        } else {
          bootStatusResult = "new-install";
        }
      }

      setBootStatus(bootStatusResult);
      setLoadCorrupted(corrupted);
      try {
        const pr = await window.storage.get("bg-v11-prerestore");
        setHasPreRestoreBackup(!!pr?.value);
      } catch (e) {}
      try {
        const ab = await window.storage.get(AUTO_BACKUP_KEY);
        const list = ab?.value ? JSON.parse(ab.value) : [];
        setAutoBackups(Array.isArray(list) ? list : []);
      } catch (e) {}
      try {
        const bl = await window.storage.get(BOOT_LOG_KEY);
        const list = bl?.value ? JSON.parse(bl.value) : [];
        setBootLog(Array.isArray(list) ? list : []);
      } catch (e) {}
      pushBootLog({
        event: "boot", appVersion: APP_VERSION, bootStatus: bootStatusResult, recoverySource, recoveryAction,
        primaryFound, primaryValid, mirrorFound, lastKnownGoodFound, autoBackupFound,
        recoveredPlayerCount, recoveredHistoryCount, loadedSavedAt,
        playerCount: recoveredPlayerCount, sessionHistoryCount: recoveredHistoryCount, corrupted, // legacy field names, kept so older boot-log entries/consumers read consistently
        saveBlockedDuringBoot: bootStatusResult === "recovery-required",
        storageErrors: storageErrors.length ? storageErrors : undefined,
        viaUpdateReload: !!new URLSearchParams(location.search).get("_v"),
      });
      setLoaded(true);
    })().catch(() => {
      // The boot sequence itself threw somewhere unexpected (outside an inner try/catch) — land in a
      // safe, save-blocked state rather than getting stuck on "loading" forever, or falling through to
      // an unguarded default-empty state that something downstream could then save.
      setBootStatus("error");
      setLoadCorrupted(true);
      setLoaded(true);
    });
  }, []);
  // Proactively re-check freshness the moment this instance becomes active again — catches a stale
  // instance BEFORE the user touches anything, not just reactively at the next save.
  useEffect(() => {
    if (!loaded) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshFromStorageIfNewer(true);
    };
    const onPageShow = (e) => {
      if (e.persisted) refreshFromStorageIfNewer(true); // bfcache restore (common on iOS Safari)
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onVisible);
    };
  }, [loaded]);
  // Fire an auto-backup checkpoint whenever sessionHistory or tournamentHistory GROWS — i.e. a ก๊วน or
  // Tournament was just archived (via endSession()/tCompleteTournament(), or history merged in from a
  // restore). Watching the array lengths (rather than calling saveAutoBackup() from inside each of those
  // functions individually) means every present AND future "something just got archived" path is covered
  // automatically, and a delete (length going DOWN) never triggers a checkpoint.
  useEffect(() => {
    if (!loaded) return;
    const grew = sessionHistory.length > prevHistLenRef.current.session || tournamentHistory.length > prevHistLenRef.current.tournament;
    const reason = tournamentHistory.length > prevHistLenRef.current.tournament ? "tournament" : "session";
    prevHistLenRef.current = { session: sessionHistory.length, tournament: tournamentHistory.length };
    if (grew) saveAutoBackup(reason);
  }, [sessionHistory, tournamentHistory, loaded]);
  useEffect(() => {
    // v1.11.0 BOOT BARRIER (CRITICAL): saves are blocked for any bootStatus other than "restored" or
    // "new-install" — i.e. while the recovery waterfall is still running ("loading") or concluded that
    // nothing safe to save exists yet ("recovery-required"/"error"). This is what makes "primary missing
    // -> defaults to [] -> save [] over recoverable data" structurally impossible: there is no path from
    // boot to a save without bootStatus first resolving to one of the two states that mean "this
    // in-memory state is trustworthy, however it got here." (loadCorrupted is kept as a legacy alias of
    // "recovery-required" for the existing banner/tests — both are checked as belt-and-suspenders.)
    if (!loaded || loadCorrupted || (bootStatus !== "restored" && bootStatus !== "new-install")) return;
    (async () => {
      try {
        // Guard: never write this instance's in-memory state over a newer save made elsewhere — pull
        // that newer data in instead (see refreshFromStorageIfNewer above) and skip this write. The
        // effect re-fires naturally (its deps just changed) and saves cleanly once state has settled.
        if (await refreshFromStorageIfNewer(true)) return;
        const savedAt = Date.now();
        const json = JSON.stringify({ players, history, current, future, roundNo, courtCount, courtLabels, mode, settings, session, lockPairs, sessionHistory, generalExpenses, otherIncome, discountCredits, activeTournament, tournamentHistory, savedAt });
        latestStateJsonRef.current = json; // kept fresh for the pagehide/visibility synchronous flush below
        const result = await window.storage.set("bg-v11", json);
        lastKnownSavedAtRef.current = savedAt;
        // Last Known Good: only ever updated from HERE, i.e. only once bootStatus has already resolved
        // to a trustworthy state — so a failed/interrupted boot can never overwrite a good LKG with an
        // empty or corrupted one (section 9's explicit warning). A normal save landing safely on the
        // primary is exactly the "existing valid current state" this snapshot is meant to capture.
        if (result?.primaryOk !== false) {
          try { await window.storage.set(LKG_KEY, json); } catch (e) {}
        }
      } catch (e) {}
    })();
  }, [players, history, current, future, roundNo, courtCount, courtLabels, mode, settings, session, lockPairs, sessionHistory, generalExpenses, otherIncome, discountCredits, activeTournament, tournamentHistory, loaded, loadCorrupted, bootStatus]);
  // v1.11.0 iOS LIFECYCLE SAFEGUARD (section 14): a best-effort SYNCHRONOUS localStorage flush of the
  // most recently computed save payload when the app backgrounds — insurance for the narrow window
  // where the async IndexedDB-primary write above might still be in flight the instant iOS terminates
  // the process. This is NOT the primary durability guarantee (that's the save effect firing on every
  // state change, above) — it's a secondary net, since pagehide/visibilitychange handlers get no
  // reliable time for further async work on iOS. Plain synchronous localStorage.setItem is used
  // directly here (bypassing window.storage's async IndexedDB-first path) specifically because it's the
  // one storage write iOS is most likely to let finish before teardown.
  useEffect(() => {
    if (!loaded) return;
    const flush = () => {
      if (bootStatus !== "restored" && bootStatus !== "new-install") return; // never flush during/after a blocked boot
      if (!latestStateJsonRef.current) return;
      try {
        // Defensive guard: never let this instance's own (possibly stale) in-memory snapshot
        // clobber something newer that already landed in the mirror by some other path (e.g. the
        // async save effect's own mirror write completing a moment earlier, or — in principle — a
        // separate write reaching the same origin). Compare savedAt and skip if what's already
        // there is not older than what we're about to write.
        let mineSavedAt = 0;
        try { mineSavedAt = JSON.parse(latestStateJsonRef.current)?.savedAt || 0; } catch (e) {}
        let existingSavedAt = -1;
        try {
          const existingRaw = localStorage.getItem("bg:bg-v11");
          if (existingRaw) existingSavedAt = JSON.parse(existingRaw)?.savedAt ?? -1;
        } catch (e) {}
        if (mineSavedAt < existingSavedAt) return;
        localStorage.setItem("bg:bg-v11", latestStateJsonRef.current);
      } catch (e) {}
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [loaded, bootStatus]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(t); }, []);

  const getP = (id) => players.find((p) => p.id === id);
  const playersById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);
  // v1.11.6: active/archived split. playersById/getP above stay fed by the FULL roster (players) so
  // historical match/tournament/finance displays keep resolving an archived player's name/photo exactly
  // as before (see spec section 6 — archiving/deleting must never make old records unreadable). Every
  // "pick someone for new work" surface (main member list, wait queue, matchmaking pool, tournament
  // wizard, lock-pair/hand-pref editor) instead reads from activePlayers so an archived member simply
  // stops being selectable, without ever being removed from the underlying `players` state array.
  const activePlayers = useMemo(() => players.filter((p) => !p.archived), [players]);
  const archivedPlayers = useMemo(() => players.filter((p) => p.archived), [players]);
  // ANY current-match slot (next/playing/done) — used only to keep waitQueue (the truly-free "รอเล่น"
  // pool) from double-listing someone who's already seated on a court, whatever that court's status.
  const inPlay = useMemo(() => new Set(current.flatMap((m) => [...m.teamA, ...m.teamB].filter(Boolean))), [current]);
  // players actually mid-game right now — used for the Members-tab badge, which should read "พร้อมเล่น"
  // (still editable) for anyone sitting in a paired-but-not-started "next" court, not just free players.
  const playingIds = useMemo(() => new Set(current.filter((m) => m.status === "playing").flatMap((m) => [...m.teamA, ...m.teamB].filter(Boolean))), [current]);
  const waitQueue = useMemo(
    () => activePlayers.filter((p) => p.status === "ready" && !inPlay.has(p.id)).sort((a, b) => (a.waitingSince || 0) - (b.waitingSince || 0) || a.order - b.order),
    [activePlayers, inPlay]
  );

  // members
  const addPlayer = (name, skillIndex, photo) => {
    const n = name.trim(); if (!n) return;
    const si = Math.max(1, Math.min(11, Number(skillIndex) || 1));
    setPlayers((prev) => [...prev, { id: uid(), name: n, level: displayLevelFor(si, settings), skillIndex: si, status: "absent", games: 0, order: prev.length, photo: photo || null, waitingSince: Date.now(), lastPlayedRound: -1, waitTotal: 0, waitCount: 0, waitMax: 0, paid: false, discount: 0, wheelDiscount: 0, pendingDiscount: 0, carriedInDiscount: 0, spun: false, wheelResult: null, handedness: "right", handPref: null, memberType: "member", phone: "", lineId: "", archived: false, archivedAt: null }]);
  };
  // reset every player's attendance status back to "absent" — a single-tap "start a new day" action,
  // distinct from endSession() (which archives + clears the whole session/history); this only touches
  // status, leaving games/stats/paid/discount untouched so it's safe to use mid-session too.
  const resetAllToAbsent = () => setPlayers((prev) => prev.map((p) => ({ ...p, status: "absent" })));
  const setPDiscount = (id, v) => setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, discount: Math.max(0, Number(v) || 0) } : p)));
  // apply a spin-wheel prize to a player: "now" discounts this session's bill immediately (locked, not manually editable),
  // "next" (v1.9.1) creates an explicit discountCredit ledger entry INSTEAD of auto-queuing into pendingDiscount —
  // the organizer applies/cancels it by hand later (see DISCOUNT CREDIT CRUD below). Pre-existing nonzero
  // pendingDiscount balances earned BEFORE this update are left completely untouched for backward compatibility.
  const applyWheelPrize = (id, prize) => {
    const rewardId = uid();
    setPlayers((prev) => prev.map((p) => {
      if (p.id !== id || p.spun) return p;
      let wheelDiscount = p.wheelDiscount || 0;
      if (prize.type === "now") wheelDiscount += Number(prize.amount) || 0;
      // "item" (non-discount prize, e.g. racket/shoes/water) and "next" (now a ledger credit, below) touch neither field here
      return { ...p, spun: true, wheelResult: prize.label, wheelDiscount };
    }));
    if (prize.type === "next") addDiscountCredit(id, Number(prize.amount) || 0, session.id, rewardId);
    // consume one unit of stock for real prizes; "none" (no-prize slice) is unlimited and never decremented
    if (prize.type !== "none") {
      setSettings((s) => ({
        ...s,
        wheelPrizes: (s.wheelPrizes || []).map((wp) => (wp.id === prize.id ? { ...wp, qty: Math.max(0, prizeQty(wp) - 1) } : wp)),
      }));
    }
  };
  // ===================== DISCOUNT CREDIT CRUD (v1.9.1) =====================
  const addDiscountCredit = (playerId, amount, sourceSessionId, sourceRewardId) => {
    const p = players.find((pl) => pl.id === playerId);
    setDiscountCredits((prev) => [...prev, normDiscountCredit({
      playerId, playerNameSnapshot: p?.name || "ผู้เล่น", amount, sourceSessionId, sourceRewardId, createdAt: Date.now(), status: "available",
    })]);
  };
  // applies one or more "available" credits onto the player's ordinary `discount` field (the same field
  // computeBill already reads) — so Revenue/Receivable/P&L all flow through the EXISTING accounting logic
  // with zero separate bookkeeping. Only ever touches credits still "available", so an already-used credit
  // can never be double-applied even if this is called twice with the same id.
  const applyDiscountCredits = (creditIds) => {
    const ids = Array.isArray(creditIds) ? creditIds : [creditIds];
    const targets = discountCredits.filter((c) => ids.includes(c.id) && c.status === "available");
    if (!targets.length) return;
    const byPlayer = {};
    targets.forEach((c) => { if (c.playerId) byPlayer[c.playerId] = (byPlayer[c.playerId] || 0) + (Number(c.amount) || 0); });
    if (Object.keys(byPlayer).length) {
      setPlayers((prev) => prev.map((p) => (byPlayer[p.id] ? { ...p, discount: (Number(p.discount) || 0) + byPlayer[p.id] } : p)));
    }
    setDiscountCredits((prev) => prev.map((c) => (ids.includes(c.id) && c.status === "available" ? { ...c, status: "used", usedAt: Date.now(), usedSessionId: session.id } : c)));
  };
  // revokes a credit WITHOUT touching Reward History / Wheel History or any historical session — it only
  // flips this ledger entry to "cancelled" so it can never be applied later; no Finance effect either way.
  const cancelDiscountCredit = (creditId, note) => {
    setDiscountCredits((prev) => prev.map((c) => (c.id === creditId && c.status === "available" ? { ...c, status: "cancelled", cancelledAt: Date.now(), note: note || c.note } : c)));
  };
  const setStatus = (id, st) => setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, status: st, waitingSince: st === "ready" && p.status !== "ready" ? Date.now() : p.waitingSince } : p)));
  const setPLevel = (id, skillIndex) => {
    const si = Math.max(1, Math.min(11, Number(skillIndex) || 1));
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, skillIndex: si, level: displayLevelFor(si, settings) } : p)));
  };
  // v1.9.17: backs the new "แก้ไขสมาชิก" modal — patch is { name?, skillIndex?, handedness? }. Recomputes
  // the cached `level` label whenever skillIndex is part of the patch, same as setPLevel above, so the two
  // never drift out of sync. Deliberately does NOT touch status/photo (status has its own quick-dropdown;
  // photo keeps using the existing openPhoto()+crop flow) — those interactions stay exactly as they were.
  const updatePlayer = (id, patch) => {
    setPlayers((prev) => prev.map((p) => {
      if (p.id !== id) return p;
      const next = { ...p, ...patch };
      if (patch.skillIndex != null) next.level = displayLevelFor(next.skillIndex, settings);
      return next;
    }));
  };
  // switch the active level-preset: skillIndex (matchmaking) never changes, only the cached display label
  // is recomputed for every player so their level badge reflects the new preset immediately.
  const changeLevelPreset = (newPresetId) => {
    // first time switching to "กำหนดเอง" with no custom levels defined yet: seed a sensible starter
    // set so the "at least 2 levels" invariant holds immediately instead of leaving an empty editor.
    const needsSeed = newPresetId === "custom" && (!settings.customLevels || settings.customLevels.length === 0);
    const nextCustom = needsSeed ? [
      { id: uid(), name: "มือใหม่", skillIndex: 2, description: "เริ่มเล่น" },
      { id: uid(), name: "กลาง", skillIndex: 6, description: "เล่นได้คล่อง" },
      { id: uid(), name: "กลาง+", skillIndex: 7, description: "มือกลางสูง" },
      { id: uid(), name: "มือแข่ง", skillIndex: 10, description: "แข่งขัน" },
    ] : settings.customLevels;
    setSettings((s) => ({ ...s, levelPresetId: newPresetId, customLevels: nextCustom }));
    const mergedSettings = { levelPresetId: newPresetId, customLevels: nextCustom };
    setPlayers((prev) => prev.map((p) => ({ ...p, level: displayLevelFor(p.skillIndex, mergedSettings) })));
  };
  // update the "กำหนดเอง" (custom) level definitions; if custom is the active preset, resync every
  // player's cached display label so edits (rename / re-map skillIndex) show immediately.
  const setCustomLevels = (updater) => {
    const nextCustom = typeof updater === "function" ? updater(settings.customLevels || []) : updater;
    setSettings((s) => ({ ...s, customLevels: nextCustom }));
    if (settings.levelPresetId === "custom") {
      const mergedSettings = { levelPresetId: "custom", customLevels: nextCustom };
      setPlayers((prev) => prev.map((p) => ({ ...p, level: displayLevelFor(p.skillIndex, mergedSettings) })));
    }
  };
  const delPlayer = (id) => {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
    setLockPairs((prev) => prev.filter((r) => r.a !== id && r.b !== id));
    // a departing player must not linger in anyone's prepared "เกมถัดไป" queue
    setCurrent((prev) => prev.map((m) => (m.queued && [...m.queued.teamA, ...m.queued.teamB].includes(id)
      ? { ...m, queued: { teamA: m.queued.teamA.map((x) => (x === id ? null : x)), teamB: m.queued.teamB.map((x) => (x === id ? null : x)) } }
      : m)));
  };
  // v1.11.6: "เก็บสมาชิก" (Archive) — soft-removal, no confirmation needed (fully reversible). Only ever
  // flips archived/archivedAt on the SAME player object; id/name/photo/skill/handedness/memberType/
  // phone/lineId/games/stats caches are all left completely untouched, and playersById/getP (fed by the
  // full `players` array, see above) still resolve this id afterward — every historical match/tournament/
  // finance display keeps showing their name/photo exactly as before. Scrubbed from lockPairs + any
  // queued "เกมถัดไป" slot for the same reason delPlayer already does above — an archived player must not
  // linger half-selected in a future match the moment they're archived.
  const archivePlayer = (id) => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, archived: true, archivedAt: Date.now() } : p)));
    setLockPairs((prev) => prev.filter((r) => r.a !== id && r.b !== id));
    setCurrent((prev) => prev.map((m) => (m.queued && [...m.queued.teamA, ...m.queued.teamB].includes(id)
      ? { ...m, queued: { teamA: m.queued.teamA.map((x) => (x === id ? null : x)), teamB: m.queued.teamB.map((x) => (x === id ? null : x)) } }
      : m)));
  };
  // "กู้คืนสมาชิก" (Restore) — flips archived back off on the SAME id/object. All history/stats were
  // already fully intact throughout (archiving never touched them), so the player simply becomes
  // selectable again everywhere with zero data loss and no new id.
  const restorePlayer = (id) => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, archived: false, archivedAt: null } : p)));
  };
  // v1.11.5: "ลบข้อมูลสมาชิก" (Settings → ความเป็นส่วนตัวและข้อมูล) — bulk version of delPlayer for
  // every member at once (same scrub rules: lockPairs + queued-next slots). Does NOT touch
  // history/sessionHistory/tournamentHistory/finance — those store only player ids, never embedded
  // player objects, so historical records stay structurally intact (name lookups just show "?"
  // afterward, exactly like deleting one player already does today — see delPlayer above).
  const deleteAllMembersData = () => {
    setPlayers([]);
    setLockPairs([]);
    setCurrent((prev) => prev.map((m) => (m.queued ? { ...m, queued: null } : m)));
  };
  const openPhoto = (id) => { photoTarget.current = id; fileRef.current.click(); };
  const onPhotoFile = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    const raw = await fileToDataURL(f).catch(() => null); if (!raw) return;
    const id = photoTarget.current;
    setCropJob({ src: raw, circleGuide: true, title: "จัดตำแหน่งรูปโปรไฟล์", onDone: (data) => setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, photo: data } : p))) });
  };
  // ก๊วน (session) photo — shown on the History list/detail instead of the default 🏸 icon when set.
  // Shared file input: histPhotoTarget=null -> photo goes on the CURRENT live session; a sessionHistory
  // id -> photo is added/changed retroactively on that archived entry (never touches other fields).
  const openSessionPhoto = () => { histPhotoTarget.current = null; sessionPhotoFileRef.current.click(); };
  const openHistPhoto = (sessId) => { histPhotoTarget.current = sessId; sessionPhotoFileRef.current.click(); };
  const onSessionPhotoFile = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    const raw = await fileToDataURL(f).catch(() => null); if (!raw) return;
    const target = histPhotoTarget.current;
    setCropJob({ src: raw, circleGuide: true, title: "จัดตำแหน่งรูปก๊วน", onDone: (data) => {
      if (target) setSessionHistory((prev) => prev.map((s) => (s.id === target ? { ...s, photo: data } : s)));
      else setSession((s) => ({ ...s, photo: data }));
    } });
  };
  const clearSessionPhoto = () => setSession((s) => ({ ...s, photo: null }));
  const clearHistPhoto = (sessId) => setSessionHistory((prev) => prev.map((s) => (s.id === sessId ? { ...s, photo: null } : s)));

  // engine
  const emptyTeam = () => (mode === "doubles" ? [null, null] : [null]);
  const genStart = () => {
    if (settings.pairingMode === "manual") {
      const cur = Array.from({ length: courtCount }, (_, i) => ({ id: uid(), mode, source: "casual", teamA: emptyTeam(), teamB: emptyTeam(), status: "next", round: 0, court: i + 1, locked: false }));
      setHistory([]); setCurrent(cur); setFuture([]); setRoundNo(0); setSel(null);
      return;
    }
    // v1.11.6: exclude archived players from the pool genRound draws matches from — they must not be
    // freshly selectable for a new round even if their (pre-archive) status happened to be "ready".
    const base = players.filter((p) => !p.archived).map((p) => ({ ...p, lastPlayedRound: -1 }));
    const cur = genRound(base, mode, courtCount, lockPairs, counts([]), 0);
    const round0 = base.map((p) => ({ ...p }));
    const enterIds = new Set(cur.flatMap((m) => [...m.teamA, ...m.teamB].filter(Boolean)));
    const tnow = Date.now();
    setPlayers((prev) => prev.map((p) => {
      const b = round0.find((x) => x.id === p.id);
      let x = b ? { ...p, lastPlayedRound: b.lastPlayedRound } : { ...p };
      if (enterIds.has(p.id)) { const wms = Math.max(0, tnow - (p.waitingSince || tnow)); x.waitTotal = (p.waitTotal || 0) + wms; x.waitCount = (p.waitCount || 0) + 1; x.waitMax = Math.max(p.waitMax || 0, wms); x.waitingSince = tnow; }
      return x;
    }));
    setHistory([]); setCurrent(cur); setFuture([]); setRoundNo(0); setSel(null);
  };

  const startGame = (mid) => setCurrent((prev) => prev.map((m) => (m.id === mid ? { ...m, status: "playing" } : m)));
  const endGame = (mid) => {
    const m = current.find((x) => x.id === mid);
    if (!m || m.status !== "playing") return;
    const ids = [...m.teamA, ...m.teamB].filter(Boolean);
    setPlayers((prev) => prev.map((p) => (ids.includes(p.id) ? { ...p, games: p.games + 1 } : p)));
    setCurrent((prev) => prev.map((x) => (x.id === mid ? { ...x, status: "done" } : x)));
  };

  // INDEPENDENT per-court: finish a court's done match & prepare its own next match, others untouched
  const nextCourt = (mid) => {
    const m = current.find((x) => x.id === mid);
    if (!m || m.status !== "done") return;
    const court = m.court, t = Date.now(), seq = roundNo + 1;
    const finIds = [...m.teamA, ...m.teamB].filter(Boolean);
    let np = players.map((p) => (finIds.includes(p.id) ? { ...p, waitingSince: t, lastPlayedRound: seq } : { ...p }));
    // a prepared "เกมถัดไป" queued match always takes priority over fresh auto-pairing — see promoteQueued
    let newMatch = promoteQueued(m, seq, court);
    if (newMatch) {
      const ids = new Set([...newMatch.teamA, ...newMatch.teamB].filter(Boolean));
      np = np.map((p) => { if (!ids.has(p.id)) return p; const wms = Math.max(0, t - (p.waitingSince || t)); return { ...p, lastPlayedRound: seq, waitingSince: t, waitTotal: (p.waitTotal || 0) + wms, waitCount: (p.waitCount || 0) + 1, waitMax: Math.max(p.waitMax || 0, wms) }; });
    } else if (settings.pairingMode === "manual") {
      newMatch = { id: uid(), mode, source: "casual", teamA: emptyTeam(), teamB: emptyTeam(), status: "next", round: seq, court, locked: false };
    } else {
      const others = current.filter((c) => c.id !== mid);
      const reserved = reservedIdsFromCurrent(others); // excludes players queued into OTHER courts' next match too
      const base = np.map((p) => ({ ...p }));
      const stats = counts([...history, m, ...others]);
      const order = base.filter((p) => p.status === "ready" && !p.archived && !reserved.has(p.id)).sort(SORT);
      const nm = buildMatch(order, mode, lockPairs, base, stats);
      newMatch = null;
      if (nm) {
        const ids = new Set([...nm.teamA, ...nm.teamB].filter(Boolean));
        np = np.map((p) => { if (!ids.has(p.id)) return p; const wms = Math.max(0, t - (p.waitingSince || t)); return { ...p, lastPlayedRound: seq, waitingSince: t, waitTotal: (p.waitTotal || 0) + wms, waitCount: (p.waitCount || 0) + 1, waitMax: Math.max(p.waitMax || 0, wms) }; });
        newMatch = { id: uid(), mode, source: "casual", teamA: nm.teamA, teamB: nm.teamB, status: "next", round: seq, court, locked: false };
      }
    }
    const newCurrent = current.map((c) => (c.id === mid ? newMatch : c)).filter(Boolean);
    setPlayers(np); setHistory([...history, m]); setCurrent(newCurrent); setRoundNo(seq); setSel(null);
  };

  // one-tap "จบเกม" — finishes the match AND immediately pairs that same court's next match, landing it
  // in "next" status (พร้อมเริ่ม / เกมถัดไป — same card as regenCourt/startGame use, editable + "เริ่มเกม"
  // button) so the organizer never has to leave the court sitting in "เพิ่งจบ" and tap "เริ่มเกมถัดไป"
  // separately just to see who's up next. Does NOT auto-start it as "playing" — the organizer still gets
  // to review/swap players and press "เริ่มเกม" themselves before it actually starts (fuses endGame+nextCourt
  // only, not startGame). Falls back to the old finish-only behavior (leaves it in "เพิ่งจบ" for manual
  // retry) when no next match can be built right now (e.g. not enough free players) — auto pairing mode
  // only; manual mode still opens an empty "next" slot for the organizer to hand-pick, same as before.
  const finishAndAdvance = (mid) => {
    const m = current.find((x) => x.id === mid);
    if (!m || m.status !== "playing") return;
    const finIds = [...m.teamA, ...m.teamB].filter(Boolean);
    const court = m.court, t = Date.now(), seq = roundNo + 1;
    const doneM = { ...m, status: "done" };
    let np = players.map((p) => (finIds.includes(p.id) ? { ...p, games: p.games + 1, waitingSince: t, lastPlayedRound: seq } : { ...p }));
    // a prepared "เกมถัดไป" queued match always takes priority over fresh auto-pairing — see promoteQueued
    let newMatch = promoteQueued(m, seq, court);
    if (newMatch) {
      const ids = new Set([...newMatch.teamA, ...newMatch.teamB].filter(Boolean));
      np = np.map((p) => { if (!ids.has(p.id)) return p; const wms = Math.max(0, t - (p.waitingSince || t)); return { ...p, lastPlayedRound: seq, waitingSince: t, waitTotal: (p.waitTotal || 0) + wms, waitCount: (p.waitCount || 0) + 1, waitMax: Math.max(p.waitMax || 0, wms) }; });
    } else if (settings.pairingMode === "manual") {
      newMatch = { id: uid(), mode, source: "casual", teamA: emptyTeam(), teamB: emptyTeam(), status: "next", round: seq, court, locked: false };
    } else {
      const others = current.filter((c) => c.id !== mid);
      const reserved = reservedIdsFromCurrent(others); // excludes players queued into OTHER courts' next match too
      const base = np.map((p) => ({ ...p }));
      const stats = counts([...history, doneM, ...others]);
      const order = base.filter((p) => p.status === "ready" && !p.archived && !reserved.has(p.id)).sort(SORT);
      const nm = buildMatch(order, mode, lockPairs, base, stats);
      if (nm) {
        const ids = new Set([...nm.teamA, ...nm.teamB].filter(Boolean));
        np = np.map((p) => { if (!ids.has(p.id)) return p; const wms = Math.max(0, t - (p.waitingSince || t)); return { ...p, lastPlayedRound: seq, waitingSince: t, waitTotal: (p.waitTotal || 0) + wms, waitCount: (p.waitCount || 0) + 1, waitMax: Math.max(p.waitMax || 0, wms) }; });
        newMatch = { id: uid(), mode, source: "casual", teamA: nm.teamA, teamB: nm.teamB, status: "next", round: seq, court, locked: false };
      }
    }
    if (!newMatch) {
      // no eligible next match right now — fall back to the plain finish (same as endGame), so the
      // court still shows up in "เพิ่งจบ" for the organizer to advance manually once possible
      setPlayers((prev) => prev.map((p) => (finIds.includes(p.id) ? { ...p, games: p.games + 1 } : p)));
      setCurrent((prev) => prev.map((x) => (x.id === mid ? { ...x, status: "done" } : x)));
      return;
    }
    const newCurrent = current.map((c) => (c.id === mid ? newMatch : c));
    setPlayers(np); setHistory([...history, doneM]); setCurrent(newCurrent); setRoundNo(seq); setSel(null);
  };

  // regenerate a single not-started court (reserve other courts, don't touch playing/games)
  // in manual pairing mode this just clears the court back to empty slots for re-picking
  const regenCourt = (mid) => {
    const m = current.find((x) => x.id === mid);
    if (!m || m.status !== "next" || m.locked) return;
    if (settings.pairingMode === "manual") {
      setCurrent((prev) => prev.map((c) => (c.id === mid ? { ...c, teamA: emptyTeam(), teamB: emptyTeam() } : c)));
      setSel(null);
      return;
    }
    const others = current.filter((c) => c.id !== mid);
    const reserved = reservedIdsFromCurrent(others); // excludes players queued into OTHER courts' next match too
    const base = players.map((p) => ({ ...p }));
    const stats = counts([...history, ...others]);
    const order = base.filter((p) => p.status === "ready" && !p.archived && !reserved.has(p.id)).sort(SORT);
    const nm = buildMatch(order, mode, lockPairs, base, stats);
    if (!nm) return;
    setCurrent((prev) => prev.map((c) => (c.id === mid ? { ...c, teamA: nm.teamA, teamB: nm.teamB } : c)));
    setSel(null);
  };

  // fill an empty court — auto-pick from the waiting pool, or open empty slots for manual pick
  const fillCourt = (court) => {
    if (settings.pairingMode === "manual") {
      const nc = { id: uid(), mode, source: "casual", teamA: emptyTeam(), teamB: emptyTeam(), status: "next", round: roundNo + 1, court, locked: false };
      setCurrent((prev) => [...prev, nc].sort((a, b) => a.court - b.court));
      setSel(null);
      return;
    }
    const reserved = reservedIdsFromCurrent(current); // excludes players queued into any court's next match too
    const base = players.map((p) => ({ ...p }));
    const stats = counts([...history, ...current]);
    const order = base.filter((p) => p.status === "ready" && !p.archived && !reserved.has(p.id)).sort(SORT);
    const nm = buildMatch(order, mode, lockPairs, base, stats);
    if (!nm) return;
    const nc = { id: uid(), mode, source: "casual", teamA: nm.teamA, teamB: nm.teamB, status: "next", round: roundNo + 1, court, locked: false };
    setCurrent((prev) => [...prev, nc].sort((a, b) => a.court - b.court));
    setSel(null);
  };

  // regenerate all not-started courts at once (reserve playing + locked)
  // in manual pairing mode this clears all not-started/not-locked courts back to empty slots
  const regenFuture = () => {
    if (settings.pairingMode === "manual") {
      setCurrent((prev) => prev.map((c) => (c.status !== "next" || c.locked ? c : { ...c, teamA: emptyTeam(), teamB: emptyTeam() })));
      setSel(null);
      return;
    }
    const fixed = current.filter((c) => c.status === "playing" || c.locked);
    const used = new Set(fixed.flatMap((c) => [...c.teamA, ...c.teamB].filter(Boolean)));
    const base = players.map((p) => ({ ...p }));
    const stats = counts([...history, ...fixed]);
    const out = current.map((c) => {
      if (c.status !== "next" || c.locked) return c;
      const order = base.filter((p) => p.status === "ready" && !p.archived && !used.has(p.id)).sort(SORT);
      const nm = buildMatch(order, mode, lockPairs, base, stats);
      if (!nm) return c;
      [...nm.teamA, ...nm.teamB].filter(Boolean).forEach((id) => used.add(id));
      return { ...c, teamA: nm.teamA, teamB: nm.teamB };
    });
    setCurrent(out); setSel(null);
  };

  // score edit (does NOT change games played) — edits current OR history match in place
  const setScore = (mid, ri, side, val) => {
    const upd = (arr) => arr.map((m) => {
      if (m.id !== mid) return m;
      const maxSets = maxSetsFor(settings.rounds || 1);
      const scores = m.scores ? m.scores.map((r) => ({ ...r })) : Array.from({ length: maxSets }, () => ({ a: null, b: null, win: null }));
      while (scores.length < maxSets) scores.push({ a: null, b: null, win: null });
      scores[ri] = { ...scores[ri], [side]: val === "" ? null : Number(val) };
      return { ...m, scores };
    });
    setCurrent((prev) => upd(prev)); setHistory((prev) => upd(prev));
  };
  // manual win/lose pick for a round with no numeric score (e.g. organizer just wants to log who won).
  // side is "A" | "B" | null (null clears the pick). Ignored for display once numeric a/b are both filled —
  // roundWinner() always prefers the numeric result when present.
  const setWin = (mid, ri, side) => {
    const upd = (arr) => arr.map((m) => {
      if (m.id !== mid) return m;
      const maxSets = maxSetsFor(settings.rounds || 1);
      const scores = m.scores ? m.scores.map((r) => ({ ...r })) : Array.from({ length: maxSets }, () => ({ a: null, b: null, win: null }));
      while (scores.length < maxSets) scores.push({ a: null, b: null, win: null });
      scores[ri] = { ...scores[ri], win: side };
      return { ...m, scores };
    });
    setCurrent((prev) => upd(prev)); setHistory((prev) => upd(prev));
  };
  const clearScore = (mid) => { const upd = (arr) => arr.map((m) => (m.id === mid ? { ...m, scores: null } : m)); setCurrent((prev) => upd(prev)); setHistory((prev) => upd(prev)); };

  const togglePaid = (id) => setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, paid: !p.paid } : p)));

  // undo a mistakenly-finished match (only while still in current round, not yet advanced)
  const undoFinish = (mid) => {
    const m = current.find((x) => x.id === mid);
    if (!m || m.status !== "done") return;
    const ids = [...m.teamA, ...m.teamB].filter(Boolean);
    setPlayers((prev) => prev.map((p) => (ids.includes(p.id) ? { ...p, games: Math.max(0, p.games - 1) } : p)));
    setCurrent((prev) => prev.map((x) => (x.id === mid ? { ...x, status: "playing" } : x)));
  };

  const toggleCurrentLock = (mid) => setCurrent((prev) => prev.map((m) => (m.id === mid ? { ...m, locked: !m.locked } : m)));
  const onQRFile = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    const raw = await fileToDataURL(f).catch(() => null); if (!raw) return;
    setCropJob({ src: raw, circleGuide: false, title: "จัดตำแหน่งคิวอาร์โค้ด", onDone: (data) => setSettings((s) => ({ ...s, qr: data })) });
  };
  // v1.10.0 (Tournament Profile, section 1): logo upload reuses the exact same crop/position flow as
  // every other photo in the app (openPhoto/openSessionPhoto/QR above) — square, non-circle guide, same
  // as the QR code. onDone patches the active tournament via tUpdateProfile (passed in from where App()
  // builds the Tournament handlers), not a direct setActiveTournament call, to stay consistent with every
  // other profile-field edit path.
  const openTournamentLogo = () => tLogoFileRef.current.click();
  const onTournamentLogoFile = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    const raw = await fileToDataURL(f).catch(() => null); if (!raw) return;
    setCropJob({ src: raw, circleGuide: false, title: "จัดตำแหน่งโลโก้ทัวร์นาเมนต์", onDone: (data) => tUpdateProfile({ logo: data }) });
  };

  const tapSlot = (mid, team, idx, pid) => {
    if (!sel) { if (pid) setSel({ playerId: pid, mid, team, idx }); return; }
    setCurrent((prev) => {
      const next = prev.map((m) => ({ ...m, teamA: [...m.teamA], teamB: [...m.teamB] }));
      const dst = next.find((m) => m.id === mid); const dstArr = team === "A" ? dst.teamA : dst.teamB; const old = dstArr[idx];
      dstArr[idx] = sel.playerId;
      const src = next.find((m) => m.id === sel.mid); const srcArr = sel.team === "A" ? src.teamA : src.teamB; srcArr[sel.idx] = old;
      return next;
    });
    setSel(null);
  };

  // set a slot's player from the bench dropdown (dropdown-based substitution / manual pick). newPid === null
  // clears the slot. The bench for a "next" (not-yet-started) court now also offers players who are already
  // paired into ANOTHER not-yet-started court (see nextPoolFor below) — swapping one of THOSE in must also
  // vacate their old seat, or the same player would end up on two courts at once. So: if newPid is currently
  // seated anywhere in `current` (any match/slot), this is a true SWAP — they trade places with whoever (if
  // anyone) is in the destination slot. If newPid is a genuinely free/waiting player, it's a plain assign.
  const replaceSlot = (mid, team, idx, newPid) => {
    setCurrent((prev) => {
      const next = prev.map((m) => ({ ...m, teamA: [...m.teamA], teamB: [...m.teamB] }));
      const dst = next.find((m) => m.id === mid);
      if (!dst) return prev;
      const dstArr = team === "A" ? dst.teamA : dst.teamB;
      if (dstArr[idx] === newPid) return prev;
      if (newPid) {
        for (const m of next) {
          for (const tm of ["A", "B"]) {
            const arr = tm === "A" ? m.teamA : m.teamB;
            const srcIdx = arr.indexOf(newPid);
            if (srcIdx !== -1 && !(m.id === mid && tm === team && srcIdx === idx)) {
              const old = dstArr[idx];
              arr[srcIdx] = old;
              dstArr[idx] = newPid;
              return next;
            }
          }
        }
      }
      dstArr[idx] = newPid || null;
      return next;
    });
  };
  // players already paired into ANOTHER "next" (not-yet-started) court — still fair game to swap across
  // courts before either one actually starts, per the organizer's request. Playing/done-match players are
  // excluded (those games are already underway or over).
  const nextPoolFor = (mid) => {
    const ids = new Set();
    current.forEach((c) => { if (c.status === "next" && c.id !== mid) [...c.teamA, ...c.teamB].forEach((id) => id && ids.add(id)); });
    return players.filter((p) => ids.has(p.id));
  };

  // ===================== NEXT-MATCH QUEUE (v1.9.4) — "+ จัดเกมถัดไป" =====================
  // Free/eligible pool for a court's queued next match: ready players not already reserved ANYWHERE
  // (playing/next/done court slot OR another court's own queued match) — see reservedIdsFromCurrent.
  const queueEligiblePool = () => {
    const reserved = reservedIdsFromCurrent(current);
    return activePlayers.filter((p) => p.status === "ready" && !reserved.has(p.id));
  };
  // manual slot edit inside a court's queued match. The bench here (waitQueue, see SessionTab) deliberately
  // includes players already soft-reserved into SOME court's .queued (own or another's) — a queued
  // reservation is meant to stay organizer-editable (Requirement 3/9). So picking one of those isn't a
  // plain assign: it's a MOVE — clear that player out of wherever else they're queued first, mirroring how
  // replaceSlot true-swaps a player pulled from another not-yet-started court's live slots. This also
  // naturally handles picking a player who's already in THIS SAME match's other slot (self-dedup).
  const setQueuedSlot = (mid, team, idx, newPid) => {
    setCurrent((prev) => {
      const next = prev.map((m) => (m.queued ? { ...m, queued: { teamA: [...m.queued.teamA], teamB: [...m.queued.teamB] } } : m));
      const dst = next.find((m) => m.id === mid);
      if (!dst) return prev;
      if (!dst.queued) dst.queued = { teamA: emptyTeam(), teamB: emptyTeam() };
      if (newPid) {
        next.forEach((m) => {
          if (!m.queued) return;
          ["teamA", "teamB"].forEach((tm) => {
            const arr = m.queued[tm];
            const i = arr.indexOf(newPid);
            if (i !== -1 && !(m.id === mid && tm === team && i === idx)) arr[i] = null;
          });
        });
      }
      const dstArr = team === "A" ? dst.queued.teamA : dst.queued.teamB;
      dstArr[idx] = newPid || null;
      return next;
    });
  };
  // auto-fills a court's queued next match using the fairness-weighted SORT + existing balance engine,
  // from ONLY the reservation-eligible pool. Returns false (creates nothing) when fewer than 4 eligible
  // players exist, so the caller can show "ผู้เล่นว่างไม่พอ" instead of an invalid/partial match.
  const autoQueueNext = (mid) => {
    const m = current.find((x) => x.id === mid);
    if (!m) return false;
    const pool = queueEligiblePool().sort(SORT);
    const stats = counts([...history, ...current]);
    const nm = buildMatch(pool, mode, lockPairs, players, stats);
    if (!nm) return false;
    setCurrent((prev) => prev.map((c) => (c.id === mid ? { ...c, queued: { teamA: nm.teamA, teamB: nm.teamB } } : c)));
    return true;
  };
  const clearQueuedNext = (mid) => setCurrent((prev) => prev.map((m) => (m.id === mid ? { ...m, queued: null } : m)));
  // swap Team A <-> Team B inside a court's queued next match (Requirement 6: "สลับทีม" inside edit mode).
  // Pure relabeling within the same match — no cross-match reservation to worry about, unlike setQueuedSlot.
  const swapQueuedTeams = (mid) => setCurrent((prev) => prev.map((m) => (m.id === mid && m.queued ? { ...m, queued: { teamA: m.queued.teamB, teamB: m.queued.teamA } } : m)));

  // add/replace the rule between a and b. A given pair can only hold ONE active rule at a time (whatever
  // its type), so adding a new one silently replaces any existing rule between the same two people.
  // "lock" additionally stays exclusive per-player (as before v1.8.3) — locking a with b clears any other
  // lock a or b had; "avoid*" rules don't have that restriction, so one player can avoid many others.
  const addLockPair = (a, b, type) => {
    if (!a || !b || a === b) return;
    const t = type || "lock";
    setLockPairs((prev) => {
      let next = prev.filter((r) => !((r.a === a && r.b === b) || (r.a === b && r.b === a)));
      if (t === "lock") next = next.filter((r) => !(r.type === "lock" && (r.a === a || r.b === a || r.a === b || r.b === b)));
      return [...next, { id: uid(), a, b, type: t }];
    });
  };
  const removeLockPair = (id) => setLockPairs((prev) => prev.filter((r) => r.id !== id));
  // v1.9.17: "อยากคู่/ไม่อยากคู่กับมือซ้าย" — a single-player attribute (not an A-B pair relation like
  // lockPairs above), so it lives directly on the player as `handPref` instead of in the lockPairs array.
  // Surfaced through the SAME lock-pair editor UI (see LockPairEditor's type dropdown) per spec — set
  // `pref` to null to clear. Soft constraint only: see handPrefNudge inside buildMatch.
  const setHandPref = (id, pref) => setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, handPref: pref === "preferLeft" || pref === "avoidLeft" ? pref : null } : p)));
  const resetGames = () => setPlayers((prev) => prev.map((p) => ({ ...p, games: 0 })));
  const isSel = (pid, mid, team, idx) => sel && sel.playerId === pid && sel.mid === mid && sel.team === team && sel.idx === idx;

  // archive the current session into sessionHistory, then reset session-specific state (keeps player roster)
  const endSession = () => {
    const doneCurrent = current.filter((m) => m.status === "done");
    const totalMatches = history.length + doneCurrent.length;
    const gamesArr = players.map((p) => p.games || 0);
    const bill = computeBill(players, settings);
    const wc = players.reduce((s, p) => s + (p.waitCount || 0), 0);
    const wt = players.reduce((s, p) => s + (p.waitTotal || 0), 0);
    const wmax = players.reduce((s, p) => Math.max(s, p.waitMax || 0), 0);
    const snapshot = {
      id: session.id || uid(), // reuse the live session's id (v1.9.1) so discountCredits' sourceSessionId/usedSessionId stay valid after archiving
      name: session.name || "ก๊วนไม่มีชื่อ",
      date: session.date,
      photo: session.photo || null, // ก๊วน's own photo (distinct from any player's photo) — frozen into history as-is
      endedAt: Date.now(),
      courtCount, mode,
      settings: { ...settings },
      levelPresetId: settings.levelPresetId || "isan", // freeze which preset was active — historical display must never change later
      players: players.map((p) => ({ id: p.id, name: p.name, level: p.level, skillIndex: p.skillIndex, photo: p.photo || null, games: p.games || 0 })),
      matches: [...history, ...current].map((m) => ({ ...m })),
      stats: {
        totalMatches,
        totalGames: gamesArr.reduce((s, g) => s + g, 0),
        minGames: gamesArr.length ? Math.min(...gamesArr) : 0,
        maxGames: gamesArr.length ? Math.max(...gamesArr) : 0,
        avgWaitMin: wc > 0 ? Math.round(wt / wc / 60000) : null,
        maxWaitMin: wc > 0 ? Math.round(wmax / 60000) : null,
      },
      bill: bill.map((b) => ({ id: b.id, name: b.name, level: b.level, skillIndex: b.skillIndex, games: b.games || 0, total: b.total, paid: !!b.paid })),
      // flexible cost model (v1.9.4) — auto-suggested real-cost expense line(s) for this session's active
      // costModel, filed straight into the existing รายรับ/ค่าใช้จ่าย/กำไรสุทธิ pipeline via sessionExpenseList;
      // "simple"/"perPerson" sessions get [] here, identical to every session before this feature existed.
      expenses: computeCostModelExpenses(settings, courtCount, courtLabels, session.date),
    };
    setSessionHistory((prev) => [snapshot, ...prev]);
    // จบก๊วน also clears everyone's attendance back to "ไม่ได้มา" — the next session starts from a
    // clean slate and the organizer marks people "พร้อมเล่น" again as they actually show up, instead of
    // carrying over today's roster as still-checked-in into a brand new quan.
    setPlayers((prev) => prev.map((p) => ({ ...p, status: "absent", games: 0, paid: false, discount: 0, waitingSince: Date.now(), lastPlayedRound: -1, waitTotal: 0, waitCount: 0, waitMax: 0, spun: false, wheelResult: null, wheelDiscount: p.pendingDiscount || 0, pendingDiscount: 0, carriedInDiscount: p.pendingDiscount || 0 })));
    setHistory([]); setCurrent([]); setFuture([]); setRoundNo(0); setLockPairs([]); setSel(null);
    // keep the quan name + photo (most groups reuse the same name/photo every time, e.g. "ก๊วนวันอาทิตย์")
    // — only the date resets to today; the organizer no longer has to re-set these after every session
    setSession((s) => ({ id: uid(), name: s.name, date: new Date().toISOString().slice(0, 10), mode: "casual", photo: s.photo || null }));
  };
  // toggle payment status inside an archived session (independent of the current session's players/paid state)
  const toggleHistoricalPaid = (sessId, playerId) => {
    setSessionHistory((prev) => prev.map((s) => (s.id !== sessId ? s : { ...s, bill: s.bill.map((b) => (b.id === playerId ? { ...b, paid: !b.paid } : b)) })));
  };
  const deleteSessionHistory = (sessId) => setSessionHistory((prev) => prev.filter((s) => s.id !== sessId));

  // ---- Finance (v1.8.5) ----
  // Historical per-session expenses: an archived session starts with an empty `expenses` list — Expense is
  // never auto-guessed from the ค่าสนาม/ค่าลูก billing-rate settings, only recorded by the organizer here.
  const materializedExpenses = (s) => (s.expenses && s.expenses.length ? s.expenses : sessionExpenseList(s));
  const addHistExpense = (sessId, item) => {
    setSessionHistory((prev) => prev.map((s) => {
      if (s.id !== sessId) return s;
      const base = materializedExpenses(s);
      return { ...s, expenses: [...base, { id: uid(), category: item.category || "อื่น ๆ", description: item.description || "", amount: Number(item.amount) || 0, date: item.date || s.date, sourceType: "casual", sourceId: s.id }] };
    }));
  };
  const updateHistExpense = (sessId, expId, patch) => {
    setSessionHistory((prev) => prev.map((s) => {
      if (s.id !== sessId) return s;
      const base = materializedExpenses(s);
      return { ...s, expenses: base.map((e) => (e.id === expId ? { ...e, ...patch, amount: patch.amount != null ? Number(patch.amount) || 0 : e.amount, auto: false } : e)) };
    }));
  };
  const removeHistExpense = (sessId, expId) => {
    setSessionHistory((prev) => prev.map((s) => {
      if (s.id !== sessId) return s;
      const base = materializedExpenses(s);
      return { ...s, expenses: base.filter((e) => e.id !== expId) };
    }));
  };
  // ค่าใช้จ่ายทั่วไป / รายได้อื่น — not tied to any one session (buying a box of shuttles, sponsor money, etc.)
  const addGeneralExpense = (item) => setGeneralExpenses((prev) => [{ id: uid(), category: item.category || "อื่น ๆ", description: item.description || "", amount: Number(item.amount) || 0, date: item.date || new Date().toISOString().slice(0, 10), sourceType: "general" }, ...prev]);
  const updateGeneralExpense = (id, patch) => setGeneralExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch, amount: patch.amount != null ? Number(patch.amount) || 0 : e.amount } : e)));
  const removeGeneralExpense = (id) => setGeneralExpenses((prev) => prev.filter((e) => e.id !== id));
  const addOtherIncome = (item) => setOtherIncome((prev) => [{ id: uid(), description: item.description || "", amount: Number(item.amount) || 0, date: item.date || new Date().toISOString().slice(0, 10), sourceType: "general" }, ...prev]);
  const updateOtherIncome = (id, patch) => setOtherIncome((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch, amount: patch.amount != null ? Number(patch.amount) || 0 : e.amount } : e)));
  const removeOtherIncome = (id) => setOtherIncome((prev) => prev.filter((e) => e.id !== id));

  // ---- Tournament ----
  // Tournament objects are assembled fully-formed by TournamentWizard (which calls the pure engine
  // functions above directly) and handed here just to be activated — keeps App()'s own surface small.
  const startTournament = (built) => { setActiveTournament(built); setSession((s) => ({ ...s, mode: "tournament" })); };
  // v1.11.2: "บันทึกไว้ก่อน" from the wizard — stores a full snapshot of in-progress wizard state as
  // activeTournament with status:"draft" (see TournamentWizard's saveDraft/`iv` hydration and
  // TournamentPanel's draft-resume branch). Reuses the exact same activeTournament persistence slot a
  // real running tournament uses, so it survives an app close with zero extra plumbing.
  const saveTournamentDraft = (draftWizard) => {
    setActiveTournament(makeTournament({
      name: draftWizard.name, date: draftWizard.date, courtCount: draftWizard.courtCount,
      format: draftWizard.format, matchMode: draftWizard.matchMode, logo: draftWizard.draftLogo,
      status: "draft", createdAt: Date.now(),
      draftWizard,
    }));
    setSession((s) => ({ ...s, mode: "tournament" }));
  };
  // rename one court's display number/label within the active Tournament (e.g. venue's courts are numbered 1,3,5) — purely cosmetic, never touches court INDEX (1..courtCount) used internally for match/slot logic
  const tSetCourtLabel = (i, value) => setActiveTournament((t) => {
    if (!t) return t;
    const labels = syncCourtLabels(t.courtLabels, t.courtCount);
    labels[i] = value;
    return { ...t, courtLabels: labels };
  });
  // v1.11.2: court count can now be changed AFTER the tournament has started — real venues gain/lose
  // usable courts mid-event. Increasing is always safe; decreasing is clamped so it never drops below
  // the highest court index a match is CURRENTLY playing on (an in-progress match is never orphaned —
  // the organizer just can't shrink courts out from under a live game).
  const tSetCourtCount = (newCount) => setActiveTournament((t) => {
    if (!t) return t;
    const n = Math.max(1, Math.min(24, Math.floor(newCount) || 1));
    const highestBusy = Math.max(0, ...tournamentAllMatches(t).filter((m) => m.status === "playing").map((m) => m.court || 0));
    const clamped = Math.max(n, highestBusy);
    return { ...t, courtCount: clamped, courtLabels: syncCourtLabels(t.courtLabels, clamped) };
  });
  const tStartMatch = (matchId, court) => {
    setActiveTournament((t) => {
      if (!t) return t;
      const found = findTMatch(t, matchId);
      if (!found || found.match.status !== "ready") return t;
      const busy = tournamentBusyPlayers(t);
      const teamsById = Object.fromEntries((t.teams || []).map((tm) => [tm.id, tm]));
      const thisPlayers = [...(teamsById[found.match.teamAId]?.playerIds || []), ...(teamsById[found.match.teamBId]?.playerIds || [])];
      if (thisPlayers.some((pid) => busy.has(pid))) return t; // guard: a player can never be on two courts at once
      if (tournamentAllMatches(t).some((m) => m.status === "playing" && m.court === court)) return t; // guard: court already occupied
      return updateTournamentMatch(t, matchId, (m) => ({ ...m, status: "playing", court, startedAt: Date.now() }));
    });
  };
  const tSetScore = (matchId, ri, side, val) => {
    setActiveTournament((t) => updateTournamentMatch(t, matchId, (m) => {
      const maxSets = maxSetsFor(settings.rounds || 1);
      const scores = m.scores ? m.scores.map((r) => ({ ...r })) : Array.from({ length: maxSets }, () => ({ a: null, b: null, win: null }));
      while (scores.length < maxSets) scores.push({ a: null, b: null, win: null });
      scores[ri] = { ...scores[ri], [side]: val === "" ? null : Number(val) };
      return { ...m, scores };
    }));
  };
  // manual win/lose pick for a round with no numeric score — see casual setWin() for the same behavior.
  const tSetWin = (matchId, ri, side) => {
    setActiveTournament((t) => updateTournamentMatch(t, matchId, (m) => {
      const maxSets = maxSetsFor(settings.rounds || 1);
      const scores = m.scores ? m.scores.map((r) => ({ ...r })) : Array.from({ length: maxSets }, () => ({ a: null, b: null, win: null }));
      while (scores.length < maxSets) scores.push({ a: null, b: null, win: null });
      scores[ri] = { ...scores[ri], win: side };
      return { ...m, scores };
    }));
  };
  const tClearScore = (matchId) => setActiveTournament((t) => updateTournamentMatch(t, matchId, (m) => ({ ...m, scores: null })));
  // finishes a "playing" match; bracket-stage matches (knockout / group→knockout) refuse to finish
  // without a decisive winner since the bracket needs someone to advance. Returns false if blocked.
  const tFinishMatch = (matchId) => {
    let ok = true;
    setActiveTournament((t) => {
      if (!t) return t;
      const found = findTMatch(t, matchId);
      if (!found || found.match.status !== "playing") { ok = false; return t; }
      const side = matchWinner(found.match);
      if (found.scope === "bracket" && !side) { ok = false; return t; }
      const winnerTeamId = side === "A" ? found.match.teamAId : side === "B" ? found.match.teamBId : null;
      let nt = updateTournamentMatch(t, matchId, (m) => ({ ...m, status: "completed", winnerTeamId, endedAt: Date.now() }));
      if (found.scope === "bracket") {
        const finished = findTMatch(nt, matchId).match;
        nt = { ...nt, divisions: nt.divisions.map((d) => (d.id !== found.divisionId ? d : { ...d, bracket: { ...d.bracket, matches: advanceWinner(d.bracket.matches, finished) } })) };
      }
      return nt;
    });
    return ok;
  };
  // true if undoing/editing `matchId` would silently break bracket progress (its winner already started
  // or finished the next round) — UI must show a warning and get explicit confirmation before calling
  // tUndoMatch(matchId, true).
  const tEditAffectsDownstream = (matchId) => {
    const found = findTMatch(activeTournament, matchId);
    if (!found || !found.match.nextMatchId) return false;
    const next = tournamentAllMatches(activeTournament).find((m) => m.id === found.match.nextMatchId);
    return !!next && (next.status === "playing" || next.status === "completed");
  };
  const tUndoMatch = (matchId, force) => {
    if (!force && tEditAffectsDownstream(matchId)) return false;
    setActiveTournament((t) => {
      if (!t) return t;
      const found = findTMatch(t, matchId);
      if (!found || found.match.status !== "completed") return t;
      let nt = updateTournamentMatch(t, matchId, (m) => ({ ...m, status: "playing", winnerTeamId: null, endedAt: null }));
      if (found.scope === "bracket" && found.match.nextMatchId) {
        nt = { ...nt, divisions: nt.divisions.map((d) => {
          if (d.id !== found.divisionId) return d;
          const retracted = retractWinner(d.bracket.matches, found.match);
          // the downstream match's own progress no longer has a confirmed source — force it back to
          // waiting/ready so it can't be mistaken for a still-valid result
          const matches = retracted.map((m) => (m.id === found.match.nextMatchId && (m.status === "playing" || m.status === "completed") ? { ...m, status: m.teamAId && m.teamBId ? "ready" : "waiting", winnerTeamId: null, scores: null, court: null, startedAt: null, endedAt: null } : m));
          return { ...d, bracket: { ...d.bracket, matches } };
        }) };
      }
      return nt;
    });
    return true;
  };
  const tPauseTournament = () => setActiveTournament((t) => (t ? { ...t, status: "paused" } : t));
  const tResumeTournament = () => setActiveTournament((t) => (t ? { ...t, status: "active" } : t));
  // moving a team between divisions before the tournament starts (draft/ready only) — structural once active
  const tMoveTeamDivision = (teamId, fromDivisionId, toDivisionId) => {
    setActiveTournament((t) => {
      if (!t || (t.status !== "draft" && t.status !== "ready")) return t;
      return { ...t, divisions: t.divisions.map((d) => {
        if (d.id === fromDivisionId) return { ...d, teamIds: d.teamIds.filter((id) => id !== teamId) };
        if (d.id === toDivisionId) return { ...d, teamIds: [...d.teamIds, teamId] };
        return d;
      }) };
    });
  };
  // Group Stage -> Knockout: called once every group's round robin is finished. Builds the bracket from
  // each group's standings-based qualifiers, avoiding same-group clashes / group-winners-meet-round1.
  const tGenerateGroupKnockout = (divisionId, topN) => {
    setActiveTournament((t) => {
      if (!t) return t;
      const d = t.divisions.find((x) => x.id === divisionId);
      if (!d || d.bracket) return t; // already generated — never regenerate silently
      const teamsById = Object.fromEntries(t.teams.map((tm) => [tm.id, tm]));
      const qualifiers = [];
      d.groups.forEach((g) => {
        const groupTeams = g.teamIds.map((id) => teamsById[id]);
        const standings = computeStandings(groupTeams, g.matches, t.pointsConfig);
        standings.slice(0, topN).forEach((row, i) => qualifiers.push({ teamId: row.teamId, groupId: g.id, groupRank: i + 1 }));
      });
      const seeded = seedGroupKnockout(qualifiers);
      // v1.11.2: stamp each qualifier's group-of-origin (groupId + finishing rank in that group) onto
      // the ACTUAL team record in t.teams — not just the throwaway bracketTeams array used to build the
      // bracket — so every later lookup via teamsById (BracketView, "up next" previews, etc.) can show
      // "🥇 Group A" / "🥈 Group B" on round-1 knockout matches without threading extra props through
      // the match objects themselves (round-1 matches only ever store teamAId/teamBId, by design).
      const originByTeamId = Object.fromEntries(seeded.map((q) => [q.teamId, { groupId: q.groupId, groupRank: q.groupRank }]));
      const bracketTeams = seeded.map((q) => ({ ...teamsById[q.teamId], seed: q.seed, ...originByTeamId[q.teamId] }));
      const bracket = generateKnockoutBracket(bracketTeams);
      return {
        ...t,
        teams: t.teams.map((tm) => (originByTeamId[tm.id] ? { ...tm, ...originByTeamId[tm.id] } : tm)),
        divisions: t.divisions.map((x) => (x.id === divisionId ? { ...x, bracket } : x)),
      };
    });
  };
  // Swiss: advance to the next round once every match in the current round is completed/bye
  const tGenerateSwissNextRound = (divisionId) => {
    setActiveTournament((t) => {
      if (!t) return t;
      const d = t.divisions.find((x) => x.id === divisionId);
      if (!d) return t;
      const teamsById = Object.fromEntries(t.teams.map((tm) => [tm.id, tm]));
      const divTeams = d.teamIds.map((id) => teamsById[id]);
      const curRoundMatches = d.swissMatches.filter((m) => m.roundIndex === d.swissRound);
      if (curRoundMatches.some((m) => m.status !== "completed" && m.status !== "bye")) return t; // current round not finished yet
      if (d.swissRound + 1 >= (d.swissRounds || 1)) return t; // already at the configured final round
      const standings = computeStandings(divTeams, d.swissMatches, t.pointsConfig);
      const nextMatches = swissNextRoundPairing(divTeams, standings, d.swissMatches, d.swissRound + 1);
      return { ...t, divisions: t.divisions.map((x) => (x.id === divisionId ? { ...x, swissRound: x.swissRound + 1, swissMatches: [...x.swissMatches, ...nextMatches] } : x)) };
    });
  };
  // finalizes the Tournament: stamps each division's champion/runnerUp/third from its bracket (or
  // top standings for roundRobin/group/swiss/league), archives an immutable snapshot into
  // tournamentHistory (player display level / skillIndex frozen at archive time, exactly like
  // sessionHistory's endSession() snapshot), then clears activeTournament.
  const tCompleteTournament = () => {
    setActiveTournament((t) => {
      if (!t) return t;
      const teamsById = Object.fromEntries(t.teams.map((tm) => [tm.id, tm]));
      // v1.11.4: champion/runnerUp/third + playerStats now come from the same shared
      // computeDivisionPodium/computeTournamentPlayerStats used by the live dashboard, the Summary
      // page, Share, and PDF export — no more separately-computed duplicate logic here.
      const divisions = t.divisions.map((d) => {
        const podium = computeDivisionPodium(d, teamsById, t.pointsConfig);
        return { ...d, champion: podium.champion, runnerUp: podium.runnerUp, third: podium.thirdIds[0] || null, thirdIds: podium.thirdIds };
      });
      const finished = { ...t, divisions, status: "completed", completedAt: Date.now() };
      const allMatches = tournamentAllMatches(finished).filter((m) => m.status !== "bye");
      const playerStats = computeTournamentPlayerStats(finished);
      const snapshot = {
        ...finished,
        playerSnapshots: players.map((p) => ({ id: p.id, name: p.name, level: p.level, skillIndex: p.skillIndex })), // level/skill frozen at archive time
        playerStats,
        courtCount: t.courtCount,
        matchCount: allMatches.length,
        archivedAt: Date.now(),
      };
      setTournamentHistory((prev) => [snapshot, ...prev]);
      return null; // clear activeTournament
    });
  };
  const tArchiveOnly = () => setActiveTournament(null); // organizer dismisses a completed Tournament from the dashboard without re-running tCompleteTournament
  const tDeleteTournament = () => setActiveTournament((t) => (t && t.status === "draft" ? null : t)); // active Tournaments must be paused/completed first, never silently deleted
  // v1.10.0: Tournament Profile — lets the organizer edit name/venue/description/logo AFTER creation
  // (spec section 1 explicitly requires this), without touching any format/team/bracket state. Merges
  // only the given keys so callers never need to spread the whole tournament object themselves.
  const tUpdateProfile = (patch) => setActiveTournament((t) => (t ? { ...t, ...patch } : t));
  // v1.10.0: Registration fee + payment — organizer sets feeMode/feeAmount once; paidTeamIds tracks which
  // teams have paid. Kept as a small toggle (not a full ledger) per spec section 14's "do not clutter".
  const tSetRegistrationConfig = (patch) => setActiveTournament((t) => (t ? { ...t, registration: { ...t.registration, ...patch } } : t));
  const tToggleTeamPaid = (teamId) => setActiveTournament((t) => {
    if (!t) return t;
    const paid = new Set(t.registration.paidTeamIds || []);
    paid.has(teamId) ? paid.delete(teamId) : paid.add(teamId);
    return { ...t, registration: { ...t.registration, paidTeamIds: [...paid] } };
  });
  // v1.10.0: Tournament Finance — a small income/expense ledger scoped to this Tournament (spec sections
  // 15-17). Deliberately its own array pair rather than reusing generalExpenses/otherIncome (which are
  // Casual-session-scoped) so a Tournament's P&L is always computable in isolation without any risk of
  // double-counting when it's also rolled into the overall Finance view (see tournamentFinanceTotals()
  // and its call site in FinanceTab for how the rollup avoids double-counting).
  const tAddFinanceEntry = (kind, entry) => setActiveTournament((t) => {
    if (!t) return t;
    const list = kind === "income" ? t.finance.income : t.finance.expense;
    const next = [...list, { id: uid(), ...entry }];
    return { ...t, finance: { ...t.finance, [kind]: next } };
  });
  const tRemoveFinanceEntry = (kind, id) => setActiveTournament((t) => {
    if (!t) return t;
    const list = (kind === "income" ? t.finance.income : t.finance.expense).filter((e) => e.id !== id);
    return { ...t, finance: { ...t.finance, [kind]: list } };
  });

  // ---- Backup / Restore ----
  // Export the entire persisted state (same shape as "bg-v11") as a downloadable/shareable JSON file.
  // Returns null if the user cancelled the native share sheet or every fallback failed; otherwise
  // { stats, sizeLabel } for the caller to show a success banner with.
  const exportBackup = async () => {
    const payload = buildBackupPayload({ players, history, current, future, roundNo, courtCount, courtLabels, mode, settings, session, lockPairs, sessionHistory, activeTournament, tournamentHistory, generalExpenses, otherIncome, discountCredits });
    const json = JSON.stringify(payload);
    // v1.9.19: "BadQ Back-up <date> <time>.json" per explicit naming request — colon-free time (HH-mm)
    // so the filename stays valid on every OS (Windows rejects ":" in filenames).
    const now = new Date();
    const stamp = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}-${pad2(now.getMinutes())}`;
    const filename = `BadQ Back-up ${stamp}.json`;
    const blob = new Blob([json], { type: "application/json" });
    let completed = false;
    if (navigator.share && navigator.canShare) {
      try {
        const file = new File([blob], filename, { type: "application/json" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: filename });
          completed = true;
        }
      } catch (e) {
        if (e && e.name === "AbortError") return null; // user cancelled the share sheet — do nothing
        // any other share failure: fall through to the direct-download fallback below
      }
    }
    if (!completed) {
      try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        completed = true;
      } catch (e) {
        try { window.open(URL.createObjectURL(blob), "_blank"); completed = true; } catch (e2) { return null; }
      }
    }
    setSettings((s) => ({ ...s, lastBackupAt: new Date().toISOString() }));
    return { stats: backupStats(payload.data), sizeLabel: fmtBytes(blob.size) };
  };
  // parse + validate + migrate an uploaded backup file's text content; never throws, always returns
  // either { ok:true, backup } or { ok:false, reason }.
  const validateBackupFile = (text) => {
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { return { ok: false, reason: "ไฟล์นี้ไม่ใช่ไฟล์สำรอง BadQ ที่รองรับ" }; }
    const struct = validateBackupStructure(parsed);
    if (!struct.ok) return struct;
    let migrated;
    try { migrated = migrateBackupData(parsed); } catch (e) { return { ok: false, reason: "ไฟล์นี้ไม่ใช่ไฟล์สำรอง BadQ ที่รองรับ" }; }
    const integ = validateBackupIntegrity(migrated.data);
    if (!integ.ok) return integ;
    return { ok: true, backup: { ...migrated, data: integ.data } };
  };
  // apply a validated backup. restoreMode "replace" takes a safety snapshot of the CURRENT state first
  // (so it can be undone), then overwrites everything. "mergeHistory" only adds session-history entries
  // that aren't already present (by stable id) — current players/session are left untouched.
  const applyRestore = async (restoreMode, backup) => {
    const data = backup.data;
    if (restoreMode === "replace") {
      try {
        const snapshot = buildBackupPayload({ players, history, current, future, roundNo, courtCount, courtLabels, mode, settings, session, lockPairs, sessionHistory, activeTournament, tournamentHistory, generalExpenses, otherIncome, discountCredits });
        await window.storage.set("bg-v11-prerestore", JSON.stringify(snapshot));
        setHasPreRestoreBackup(true);
      } catch (e) {}
      setPlayers(data.players.map(normPlayer));
      setHistory(data.history);
      setCurrent(data.current);
      setFuture(data.future);
      setRoundNo(data.roundNo);
      setCourtCount(data.courtCount);
      setCourtLabelsRaw(syncCourtLabels(data.courtLabels, data.courtCount));
      setMode(data.mode);
      setSettings(data.settings);
      setSession({ ...data.session, mode: (data.session && data.session.mode) || "casual", id: (data.session && data.session.id) || uid() });
      setLockPairs(data.lockPairs);
      setSessionHistory(data.sessionHistory);
      setActiveTournament(data.activeTournament || null);
      setTournamentHistory(data.tournamentHistory || []);
      setGeneralExpenses(data.generalExpenses || []);
      setOtherIncome(data.otherIncome || []);
      setDiscountCredits((data.discountCredits || []).map(normDiscountCredit));
    } else if (restoreMode === "mergeHistory") {
      setSessionHistory((prev) => {
        const existing = new Set(prev.map((s) => s.id));
        const toAdd = (data.sessionHistory || []).filter((s) => !existing.has(s.id)); // stable-id dedup — never duplicate an existing archived session
        return [...prev, ...toAdd];
      });
      setTournamentHistory((prev) => {
        const existing = new Set(prev.map((t) => t.id));
        const toAdd = (data.tournamentHistory || []).filter((t) => !existing.has(t.id));
        return [...prev, ...toAdd];
      });
      setDiscountCredits((prev) => {
        const existing = new Set(prev.map((c) => c.id));
        const toAdd = (data.discountCredits || []).filter((c) => !existing.has(c.id)); // stable-id dedup — never duplicate an existing credit
        return [...prev, ...toAdd.map(normDiscountCredit)];
      });
    }
  };
  // v1.11.5: "ล้างข้อมูลทั้งหมด" (Settings → ความเป็นส่วนตัวและข้อมูล) — full factory reset. Reuses the
  // EXISTING applyRestore("replace", ...) path instead of a new deletion code path, so this destructive
  // action automatically gets the same pre-restore safety snapshot + "ย้อนกลับการนำเข้าครั้งล่าสุด" undo
  // that a normal backup restore already has — no new undo mechanism needed.
  const wipeAllAppData = () => applyRestore("replace", { data: {
    players: [], history: [], current: [], future: [], roundNo: 0, courtCount: 2, courtLabels: ["1", "2"],
    mode: "doubles", settings: getDefaultSettings(),
    session: { id: uid(), name: "", date: new Date().toISOString().slice(0, 10), mode: "casual" },
    lockPairs: [], sessionHistory: [], generalExpenses: [], otherIncome: [], activeTournament: null,
    tournamentHistory: [], discountCredits: [],
  } });
  // revert the most recent "replace all" restore using the safety snapshot taken right before it.
  const undoRestore = async () => {
    try {
      const r = await window.storage.get("bg-v11-prerestore");
      if (!r?.value) { setHasPreRestoreBackup(false); return false; }
      const snap = JSON.parse(r.value);
      const data = snap.data || snap;
      setPlayers((data.players || []).map(normPlayer));
      setHistory(data.history || []);
      setCurrent(data.current || []);
      setFuture(data.future || []);
      setRoundNo(data.roundNo || 0);
      setCourtCount(data.courtCount || 2);
      setCourtLabelsRaw(syncCourtLabels(data.courtLabels, data.courtCount || 2));
      setMode(data.mode || "doubles");
      setSettings(data.settings || getDefaultSettings());
      setSession(data.session ? { ...data.session, mode: data.session.mode || "casual", id: data.session.id || uid() } : { id: uid(), name: "", date: new Date().toISOString().slice(0, 10), mode: "casual" });
      setLockPairs(migrateLockPairs(data.lockPairs));
      setSessionHistory(data.sessionHistory || []);
      setActiveTournament(normTournament(data.activeTournament) || null);
      setTournamentHistory((data.tournamentHistory || []).map(normTournament));
      setGeneralExpenses(data.generalExpenses || []);
      setOtherIncome(data.otherIncome || []);
      setDiscountCredits((data.discountCredits || []).map(normDiscountCredit));
      await window.storage.delete("bg-v11-prerestore");
      setHasPreRestoreBackup(false);
      return true;
    } catch (e) { return false; }
  };

  // Financial Report Export PDF path (Requirement #16): replace the ENTIRE app render with just the print
  // view while open — guarantees bottom nav / tabs / edit buttons / every other interactive control is
  // completely absent from both the on-screen preview and the printed/saved PDF, with zero extra CSS-hiding
  // logic that could accidentally leak through print's default UA stylesheet handling.
  if (financePrintReport) {
    return <FinancePrintView report={financePrintReport} onClose={() => setFinancePrintReport(null)} />;
  }
  if (tournamentPrintReport) {
    return <TournamentPrintView report={tournamentPrintReport} onClose={() => setTournamentPrintReport(null)} />;
  }

  const BACKUP_REMINDER_DAYS = 7;
  const daysSinceBackup = settings.lastBackupAt ? Math.floor((Date.now() - new Date(settings.lastBackupAt).getTime()) / 86400000) : null;
  const showBackupReminder = !backupNoticeDismissed && (daysSinceBackup == null || daysSinceBackup >= BACKUP_REMINDER_DAYS);

  return (
    <div style={{ background: T.bg, color: T.text, minHeight: "100vh", fontFamily: "ui-sans-serif, system-ui, sans-serif", paddingTop: "env(safe-area-inset-top)" }}>
      {staleSyncNotice && (
        <div style={{ position: "fixed", top: "calc(env(safe-area-inset-top) + 8px)", left: "50%", transform: "translateX(-50%)", zIndex: 9999, background: T.green, color: "#fff", padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 14px rgba(0,0,0,.18)", maxWidth: "90vw", textAlign: "center" }}>
          {staleSyncNotice}
        </div>
      )}
      {autoRecoveryToast && (
        <div style={{ position: "fixed", top: "calc(env(safe-area-inset-top) + 8px)", left: "50%", transform: "translateX(-50%)", zIndex: 9999, background: T.green, color: "#fff", padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 14px rgba(0,0,0,.18)", maxWidth: "90vw", textAlign: "center" }}>
          {autoRecoveryToast}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={onPhotoFile} style={{ display: "none" }} />
      <input ref={sessionPhotoFileRef} type="file" accept="image/*" onChange={onSessionPhotoFile} style={{ display: "none" }} />
      <input ref={qrRef} type="file" accept="image/*" onChange={onQRFile} style={{ display: "none" }} />
      <input ref={tLogoFileRef} type="file" accept="image/*" onChange={onTournamentLogoFile} style={{ display: "none" }} />
      {cropJob && (
        <ImageCropper
          src={cropJob.src}
          circleGuide={cropJob.circleGuide}
          title={cropJob.title}
          onCancel={() => setCropJob(null)}
          onConfirm={(data) => { cropJob.onDone(data); setCropJob(null); }}
        />
      )}
      <div style={{ maxWidth: isWide ? 860 : 520, margin: "0 auto", padding: "16px 14px calc(92px + env(safe-area-inset-bottom))", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
          <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAniklEQVR42tW7d5xdVdX//17nnNumt0zKpIdACKmAoQSC9N4FpIo+gI3iAyjog4aqNEURQaVIk6JIEwEJIfQQWkhIb5Nkksxk+p3bTt3r+8e9M5kE9PH3++v73a/Xed179z1nn73W3qvstT5L+A+aqgpgAQJEIqL8X9hK87QBBcx/Mk/nPxjUFpEIiPr7mpubk/F4vCKRSCRKTNGuri5ERCZOnLjT80uXrqWpqQ5AC4WCpFIpBaRQACiQSqUoTVhc15VkMvmlk+7/r1Ao0D9G/xR93/c9z8uIiAuEXzL3f9nk3xBuASoiOnfuXOvqq68+1HGc4yzLmgWMBipFJA5IGEaaSiUF4P1P1unbn6zBc3056uC9OGDmRPV9X4ovExQFEBFUdWAOWuwTUFWKf0qpm1I/Jc70M0hEUFRU0VAgrdBijPkYeGX58uVv7LvvvkE/LSJi/mMGDOZcIZu90EkkrnAcZ8YuN2FUCcOIeDzG4uUbufqGR2jr6jN7ThqLYyPvL1rNRecdyc8uO1nCMMSyrIFnKRFVImVH/04ssUHD0g9r53sHEyElJg1qYRCu8AP/nttvv/0PN9xwg/lPdsMA8QDt6fbdfd+fr6UWFJvnF1vg+35QKLihqoZ/+sv8sG6Ps/xb7noqbGvvDrK5QqCq4SdL1oXVU74RLFm+IVTV0PO8MAiC/+AKi5fXHoaRhoFqGAT+4HuC/jn0z6fU/CAIvCAIgv55h0H4fnd39/QSbf9e5BcsWOAA9PT0HBYEQWeJcC8oviD0PS/0PC/wfT/I54tEvvDPD6Ly3U4LP/hkZej5YdTa3hNt2tIebWxpjzw/jA7/+v+EDz35aqSqUcF1oyAIvnj5XvEKgijwC1EQaRT0PBP6y+oDf80xYdDxahSEURT4XuT7fuh7XuiX5uH7XvEq/g4D348CP4iK7PA9VdUwDPvS6fSJX8YEZ5dtH/b09Hy1srLyJcuyUmEQ+Ig4CmCMUQFBLIB4PEZfJq/fvfYe88Cdl8s+03eXLds6sW2LeDyG7wdksgW2buti3KhGAKwvSJwWt70VL+ruMKB0I9r3ChS6oOdV1ZYQOexoweggAdGdpVhAizJUukkEEScIgsC27Iry8vLn+vr6viYizw8WB2uQwjO9vb3jKyoqnrHESkVhGCDSzyCjA0oME0WR2rbNk8+9weimBk499kBatnWQTMSwLMF1fYY11vHsy++rmojZs6ZS1AGyM/FYEIuD3wy9SxWsotxHBtJLldBSulIw4ebig2oQKw52HKyECNYOvVGaHxS1a78IiIgdmSgSESkrK3sik8lME5GoRHO/Zim2ZCr1kOM49VEU+ojYRd5ov9ruH11Ui2xfvKxZD/rKZFEVEREKno8g1NVWsq55K1ddf5/8+vqLJBZzCMIIg5Tm26/UfLTlItV1U41+erhS6AEnBt426FsH3QYavi0yZj/w82CnUM3DuuNUNpwLMcfCEgGVwQq9XyEWWWBURKwoiiLbtlOJROLhZcuWxfv9BktVHREx2Wz2nEQ8fkgYhn5p5dUY088AKfFBLRHpX8kpe4yRtz5YTizmMLShlhHDGqipqdSFH63QQ06+0lx/1Tkcc/gsPM8nlbSJxyBWWuB+G0jvW0o2B4ELXnexL7ta6e4Fd6wl068XIh/sJGhWWXmSoe0VdPMTyuLLVayYiKgIA2OK9HOgaHz7O+0wDP1YLDZz3Lhxl5TMou0AkararuteS5GVokWbu8NgD8hVUbQsyyIMIy4692h55uV39fQL55qvHry3uG6B+Qs+1fXrN3HvbZfJGScdApFPzLFY2wtZV2kqh8ZKC0xIQAoZdq+lS44yeB4EWQQw6aXQrsiBvxIqqosci9Lo0lOUnrchBNkOGuRFpvfPGhGR4oIpKLrDUyo6FQJYxhh1HOfK5ubmBwBPALq7++bU1FS8ZaIoVLBQjFEzYHNLA1kDtlYhjCKSyQSLl63Xvfe9UGfOmcLk8U1ywL5T5Lwzj6C6qgJCjyfaLL1rNbp8G7g9Sr0Ppw6N5OcnO9JQBQEx+OhUw9rnkUMWiTTNEp0322jeEuvkd4rL53bCR8cb3f4huEDyIJG9fiLscSyYoN+N6t+0JRFQBvSWanFbFLdGZDtOLJfLnVhRUfGSA5BKxY4tuVVGtaQXZBdtPbhDgJJTc+WtTzF0wkg+/MfdlhOLUTIYEPn8ZK1lfvG5gifYBZAAOjNw/xqji5Z288Z11VJTHcNMvE1Y9rwSdKGAVh1gybTzi+/qW4++eYxh+zqo3U9kxtXC7qdC3C5ZDRmYWkk36YAH2S8ExYVTUNGiSKjjOMcDRQZYlrXPIPWhxdUfTLLs5GiFoSGZjPPKq+/y5p9f1D89eYPlxGLkcnmwbcqTFs9vsfQXS5SkEdSDyFOMB+Ib4jXC0uWezn0izT3fjUlYubtYBz0mVE0ovm2/O3f4vJ/9DPockdnPCnucWjSXAL4Hlv0lXuEXlktLO6DfQvQf6mYAyMcffxybOnXqsng8vnsYhmHJhAxyR4u2v58DRiFuK4u6LM68dzFec7Nuuu9EceIxImMAIR6DOa+qebcF4gpBXtE8aNaAG2H5BtrTDC3zWH3vaKsyYQjtREkBLla87eCMFKqnQKEH7EqIO+iGa5SNL6vUnW8x7UcQBQNUFxVgceUGTg1fIgKqqrFYzA6CoCWdTu9lNTY2VgKVJV7Jrj42usP7LhIPzVk44uXIbB62r+mYdobesNBR21YiI8Rt6MjCyi2KZiHsA5MFzRhwjeJFqB9hwoieTERnOgA7gcl+hjYfq7r+GNWVZ6kunG14+3zFciDuQMuDyorblc6V6FvXGFqXQixWpHlgm0vRWumgI9MOEZBdTmFVtm3XWrFYzBnwCIsHFBlw0ihtnUGrjwUfbBPNdgjxgocWXG5fYHh/E6QSJYVtlKAH6FVM2kDWKIUI3AB8o7ge4npaHjNUVyTA3wBbzjKkFyp+AoIyCGLo8sdVXrlIBVA/hIwNXhWSiRdFoH9hTPFQVvRVES36BUSRIYoMRX9IBssEKLZlWY5VsvO6qxMx6OCpgzsiDFNrjdgFJcxaWNhEkeh5TxrtyBYNa32ZMN42YnVFWNkQsgEUAnBDwfPFyWXRjKdz9oxTV2njbb7DSN9WcGsg60POKz5jV2I+fU7ZuloZ+y2BUdDRC4UatHIEYWjAKrreyWSCRCJOPB6XRDwh8XjcSiWTJJMJKx6PSxRGu1CiuK6LM+Dh7azvZDD5WpKqpB2DCKYMhTvmhHLlM6HGamwQpbkVPfH3kb70bctqqLS57Csq31pYULtasEUlCg34AZLLadDjSqJcrBu/MUKIcrB9IRTiEObAjSAXQs5ATqAzwHRuRSpQ3b4N7YLIHkOyoYkY4HuGDz5ZycJP17B84zZaezPqeiExY2RUTbnsN2N3c8KJB8mwIdUS+P4AqaUjtHzp8bBfZgQwqMak6KMv9dpZ4fZouTpcekiTdPTE+cULrsbqbIjBotURh9wamAe+EbO+eXCKze2Bdf2DvQaNIBaphCGW7zNlXJyHfzJCpoxNiptPY6XzxVUPHfAM5A3kFfos6BOoHSV8eJdGnT5OG8SPOVpau/M89ed/6CtLN+laq5JMw26YxiMxI6slcgSxXWP1beOpeW9z073P6vfOO5ZrfvA1inpeUVVJJBL/PiQWoTiWLV3G47873tXn05s0U/Ag5zMhKtNn5hwthUyT/PrvWXXqY9iOsmJzxCE3uuaCfTNy3ellctyedXLHc7362grImLiMHl7HsYdXsd53xNnqMaWpGhKTxW1eq3a8GrIheEAQh7V9sMfxgmnTcMFDmgzLyXWK3PW2K0+9/iCtjZPVm36s9Gz3VbdshEUfgtur2CKkUsLYPYifdLV6yS6uve16Pvx0pTz98E9RE9Ev+tLa2tpYV1e3LB6PDwmDIDIgpuRG2mIRAaduf9W80reZuihJ5EZEhYBsOkt9BppP/bY19wlL7/prRu06B7Eg7AkYUx3JwQeXEx9Vo+9thuZuxY9KQcq8AV8lnlCO3i0mN89aKtPeOEzd9h61nTLIA60eVEzCfPNGrLd/SmzTKt5YPZQbraOtNXMuVrdypvR8uFytVfPYf1hGpoyr5vAD96CxsVZ7+lzx3QIffLyOp97cqG2zv65Dzj6Ijisu57JDJ3H3bd+z84VCNvD9GTsxIAiDKCYxwS6FQAUeT6/S81vmayMp8l5A6EVEbogdgrt2E3fNOkF+sN+hcstT3Xrdg31KpJxwRDn2tFrmb7DIbo9AxGAplKJythQPrmEI9EVSXp6UJ776oXXS+qvU/fwztQOBEZOJ9j6Y5JoXiJat5edbZsr9M/9b3Jln0zHvE61a/qycPbta/+u8I2Xy1MnEEimMWuQLLnVVSbJugDFKId3Fxd/+BX8feoSWn3K85i49Sz94+gZnv1l7ZZetXTvTGXTgIWbFWJBv0b/0rNaTKybIMbXj5LWuzUguwiXA9wOMF4Efob7B8kO2ZHoB+J+vV8v00Y488I5rNkys5fM1gngGJy4YX0UDBKOqBolKERZRsMsszWULeuars3h/7+Gy97T38LwKVDeT/Ohutq8VuaL3eN48/Q5Np4fi/vIXctFsS77/8PnMmD5FsoWAra2djBxu05POYVs2W/M5AGqry3E1waOP/4JTz/mxvL1xb+Xoc7j73r/In2fdgPYHBSI1IsAKt5PTNr/K79tXcMqaf2i7mwU3QjI+Qc7H5Hw0H2DyPpp1Mek846pqMUDWDTjhwHI6ptbx+UaIhRHkI8JciHEt0ayFegkRz4Z8hBUlLQmTEuYiHNvgZYxe+t65SsFBc5Bs72PNqnLODC+UBRc8Jdvf65FRL1wn7/z2UO773f/QNHoc29q66Ev3sdvYRra29WCJMKSukihSYo5DJlugPGFTWVXOpRccg776FBxwDK8tbdG2tg6m7r67WAPOMrCq0K29OU9rohSWB0aVgxONYnpzUAiRXIgWfKxCgN+ynTFVQ7hk6gFiARXJJDcvMvr+ZxExX4nCBFYsiUMKq7OHyoXXCIt+i6ZdLE1h3vujZVa+bGESVpgNxJI+XZg+jPmbZpPsK7B0aUrOjV9krfja72l/4G+cnXhZPnz9FvacsQ8tW9upq0wQRgbbtujszjCkrpKqyhRrN22npqqMyvIkmZyHWBbd3X0ceeRsnRpPQyh0Jofw2acrFSjugP4MyiinUmzXSDqXp1JtKuwYZ42azL7SIIV1mwg6ejDtacyGdmoi4dLDj5Jnss16z6aPmbd9A3/6SFV6E5ggjul+h+j92wnXLMAsfkKevv4IWXDzXlbtql+JeffXcv/FcT1v/MfCxsXYmhDLLSCepR92zaZ1SSQXVl0k64+/nc677+Kagzv1gfvnaqqskijwqKpI0rylk7qaCmqqyunLuhhVXC9gRGMNfhDS0tbF2JENWJbQ3ZulorqavRrLINsDdSNZsWrDjqCoVfJ190rVMUrK2BxkaC/08sv1H+vcPQ+S1467UG55958sbF6vq0w3uTHVpHZv4ufhau357EMworghUl2FHTuMqK2CfTb9VW697AT5cOV6/h6tN7Nmf0vrayvlgf+J5G8vvqkXXfwDPXD/ZfL0JQskHDJNrUIgqoG8sWUMiypPYd0JvyBz91384owk117zXcnlXTa2dZshNeVWXW0VjuOQy3tkCx7jRzfSk87S1ZNl5LA6wkgYWl9Ne1eGKDLsNmYofdm8VCTjWKGrJllNe1eP7hQVjtRQFk9wQf0kbmx/i4RTxo2fv61xP9If7XWQ3Hn0adyydSHN25cSCfT6EWEhIOGUYzwPqaoncAzRtM3oH9bLj793DEccf5QecTzyjfN6rE1tvVpTldJTTjickeMnSSbv64RxTYyuc2V9LqfqhoKX5l2vg9pvPkDmgcf4+ekxLr3iYto6ehGBUcPq5MgzrzYHzpwsP7nqfInFbCqJs217D2JZ7D5+BC3bOomM0jS0Bi8IScQdWlq7GDm8garKJJYIRm2CMBIApxQ5VUssoijiv8fvI4+tXUxzX7cmrDg/WfgPHl/2oTbNGM0b+TaSxsEEiokMGgmB52Lbo/EXeGIv3iwJr01T6XV6wOwz6ckUSNgiwxur2by9V9JZT+uqy4mikN5MgVFDK2goE9ane0HjWO2vMuy8g2Tjq6v5xh4b+O7l1xK3FMe2cP2Qzu60LF3dou//4y2dMKFJvnPhycWYSc7F93xa23soL0tQWZ6kuaWDmqoyqitTZPMuvhewtbOH1KgqMpksFRVlAsVzvqgWg4phFFGTSPHsAaczJHTwuruJhQ4bqyPeLXRS7jtEniH0DaGvaD7EJkX0psv5G9bqsptO0dX3nS0v/O5K2dxZQFTwQmMsy6Kuuoyt7X0AVFckSWdcgRhJJ1ACxXQ2Uz+jwFZ/mk7r+JvceeulaGTY3pnG9QJGDqtj2aqNmuvpIzFqJMcdsZ9u3NzG6ef+RD9bsoqKVIKC6xOGEb2ZAsOG1JBMxFi9oY0RQ+tw8wVd05VVp6IeutsYPqx+IM43cBiyLQvP95kxZIS8c+JFHFY7hsj3SDVUQ97g+SGRrxjfoNkC2tOJpUmsLRnOPPNQJs3Yi5ETJjB7/2liibFatqdRFTzP15FDq+lK5yUMIyrLk6SzxeOsqFFyHinex+x3ukSvPilzLztMY6kqkjEh5tjEYzZ9WZcNm7dDTzcHzposo0cO069/+2Z99om/61Fn/NBs3LJdx48eSmNDjXp+WMpbGkYNryXnBixc9LlkK4fiG6BvG5MmjSsyQHekYelngh8E7FE/VOafdSkPn3o+vZ5H4CqhGxHl0mg2i4RDofJovLUzCVd2smV7B26E9qRzGoUhe09qYntX2urL+ZJzQy1PJTUZt6WtK6s1FUlT8APFBOqbmNCzmoppVVbXesPRo1vlhBOPFBN4bNrWTWVFikTcIebYrN3QgpqAqy85XX52xyOy6NV3tGxUE2+++Bs8L5BjTr3SzL39YdUo1DCM6OnLIyKUp5Is/Xyl5sdNJ7+uleHlIZMnjS8yIJ/Py64ZV0tEC76nYJjWOJIobzDZXjTvYcl07NiZRGYW+sS7cvgHL8qPj6637Ip6ad3ehxegOTdUx3GYuttQ1rZ0aBCC7wfaNKTKbNzWQyJuU1GWJJv3yGV9IfyIYOJhyqdv6bfO2E+NWvhByKjhdfRlC3R0Z0klY7zx3mId95W9Bcvmpuvvo25ME2+9+Bs2bmpl9rHf138+/6b18zselvnvLJZEIs6YpnraOvvo2N7FglWbMJMOgvde5+AZTTQOqdM1azarU15e3o+s2AlpYSEaRIYxts1QA+3MIB7/Cl62A/iQsgUL+F7Tbtxx1/UA6nqhvLO4WRrrq8yQmnJVLTC0oZrG7iwbW3uwrRpqq5LkvEhUbO1p387WVMS2DSvVqh8m6UyDTkqu47STr6WtK4Pr+VSVp7Btm6FDqulNZzWXK3D6CYfI1XPv06ZhtTz7zC/lL8+9oXfc+AcoL9OvXXiy/PKm70hlZQWFgks6HTJx7DAeeuhZ1tXuRsaLoyte47TvXFByfzzZOSKkOz4sIJZQPuxIkU2fjeYn47W+wEz5J/MPmc6fjjuH7sjSEHTr9l4VMebQfcdpXzbH5rZesoWQTNaV6bsPx/M8USsuyUSSW267lwXvfGpde9O9PPHXeSScvFI7VHVrmoP2rKAQiti2MHpEHS1t3RgTUZ5KsGrdFrn355fLjD3HkOvp09///mdcd9P9eseNv2bKwfvI83+5Xf76p7lYToy4Y1FZniJUaGlp59F5HyKHnk3mpVeY2ARHHX4Avu9TXV1dVIIyKAMSGYjHRe24cPHLEde8leSkhl6pDR6x/nTwHvLPk66gxZ3KrRWH89ha5W9/nUcsUU5Xr0feDXT2tNE4lmH1pk7t7vNNvhCw24hKvfXO+3XZirUy792leveDz+qcWZOlrSurk8bVY7QJujuZPmkYfhCpiSK6e3OMHFaLY1v0Zgq8Mn+Rfu3rP2L1ui36+aLH5Mm/vc4773zCnffeLH//861y8nEHSXdPhphtUfACWjt6GdvUwG/vfYL2qXPY3p1UFjzG9755ErXVFRhjNJFIqJUjNxBGjgwk4rCpFw74vaKexcIzDE8cNYy3T7pcQzmUWa/Ahe/7LN6SA8+V9xZ9Jpu2dbC1o4/OXo/uPo8Ze4ygoTpOy/ZesBM4Toxf3XwfV9/4Rx79zbXWx58u5/BDZomJQsaPHSnky8HPgCC1lSlxHJt0Jk8QRgShoa66nCUr1mkuW9Cbbvij7nvoxXrxeSey7vNn5dL/OlWahtXS3NJOOltg6JAaPD9kxPAGnnr6n7zW2qe5fY4zuUfvZ68JCc454yg8zxtAq1hlWqbFZAgk4sKKNjjv0Yir9xN54FSLZCLi+dVVev5LdXrxPzzd2GpIVMWxX/oDz1w0g7vv/KGOHVZBzDayrmU7azd3s7ktw57jh0llIuRbl/yUV9/6WP74yC0y/28v64ihtTrnwH2ltb2HQw6cxpQ9x4MfCl5EKpUkk/fJuz4Txw2nt6+A6wX4QcQhB8ywyutqrJF7jOHrpx8u+8zYXSzLYntHj3p+QGV5kiF1lazZsI2Ghho2rG7m9j+/rP5pP9KWl5bjLH+Bm6+7hNqqsi+ixAyiMYGWHrhjnuEPX7OYPMKSnrxy1Suqf1oSQQxi1RZUGUwSdK/pPDn/bR0xfjy7TdqNGZNGqRvCpm2d0ry1i0w+kDGjhvHBktX69CNP6opV8+T6W38ol133O/3rA9fL6/PeotKB+YuXq+QaUHsftrR1DZi81u3dVFUkqShP0tzSzkXnHscJR+6HbdsyfsxwtnekKU/FJVlTwfrN7TTWVxGGEU0jGli3ZjOX/PguzNnX6LqVvujTN3Lpd47XI+fMxPcD4vHYDoRWf0RIJT7koXf86PhploxugNXtqmc9bnTJNkutcsSuBRkCmhQ1kRGsONHHi6lYNV/2qfbYZ3QdMyaNZcpeu8nIMSNZtW4T9/zmUb3wwpP17bc+5Pd//icrFj5mffTxZ7qtpZUHF27jY3ucVs7Zm9rmN6Xl2SrZe/dmfffx7woSo60zTUVZgiiKKEsliIyhJ11g5LBaCq5HR3eGqooyVFUrK5KS7stjxRO0bWzhiht/q70nXsGq3ER17/gOR+9fxUO//THlCZuysqQCjjGadV13hqxb19o4YVzd51t6443GhNHoBmRFm3L0H9Vs6RF1ysBqRJx60chSiQpADlVjJEolij5kdxd0rqOmdy0TwzbZI1Wgoaqc0Cjrm7fqhRecQjLuSE9Xm7z50TZ9eMlw5bjToRFo3cpQb75sf3ajWPFh+uxPx8hBX/0qZTFVz4/o7MnI0IYqXD8k7tjkXR/PDxg7spHtnb2kMwVGDK2lrCzJi8/N5+ZHXtTwlCt1dd8Y3N/+gH3GFHj8j3MZUlNGWSqJ49iKqqOq2d50eqZTXg5eiIyoBUugMwsnP6hmS7vglCGxWtSpwEQBEqVB82gUodgWEypcOWWictLuVUwash9BsB9bujxta+1i9WefseTTxRxwwExpbe2U6XsO5/q7luni4DSVGVPQjz5gRsWnct4+9XLIIdN4Ourjzlfr9ccPfMTr0ydJvLFJevp2RHtcL2DU8HpcP6A8lWDT1g6SiTi7jxvOug2t/P6Bp1jQmid/5u26fm1I8OAl7LOb8uA9P6WuKkkiHsNxLAYDJ1S1GBWur6//3HZijZaE0TceU330bdSpVHHqoWyIGN+A24sV5oo4pP3HI9cdhBy/ezF9+vxS5eWVkbqhMqFemdxo2GuIhbrd3P/oy7j5tLy7uFeXZ8+AoSOp7XuW2y9slAvPOEycihoAbd2yiT1Pvo/0hLN1//gL8rvLT5CpM6ZTCCLURFSUJ9hYCoLUVpWRzQdk0328Nu9NHpn3IW1jD9XsxGNk85vLDC/O5fCDRnLX7VczpKacZCJGWSrBoOCPo8Zk8oVCMSpcU1v3eTIRb1yyKQhn3qRIQlTKVSrHWkYtpdALfjeSTKjcfrxw2f5iFSK44TVj/vCmyh5Dhe8epHrURMPQMkNkIjL5gJwbUVtXy49v+C33/LUOGXkQu1lP8fw9JzF5r2kEkZEoCDQ0hrhtcfBpP+ajviPQMWNkSGEB39kvwcEzJsrECWOprKxAgL5MluWrNrBq3Qbmr2jTNdZ4okln0dFrk3v5PmT9c/rtbx7LlZeeQ1ncoiwVpyyVHEj5DTBANVMoFIpR4X64zrMfKdoHVh3ipASxDZEnhN1QZqk8f77Ikbtb8vwqwyUPqelog4cuEv3mnOLgUWjjhRaKTSLlYDkh+VyOs0/9qjz49+e00u3iyT+cyG6TptGbzpJIxNQScL2QQMD1fMg2k+hKanft8dz0aS/1n6xmeHIllU6eZCJO2hXp0lotVO+rZtgMClnIPfs3WPEUe05IcM29P+LIr+6DRgFlqQSpZPwLKFIppoiLucHBf2zYWkRxECpii4oliIIpID88qUj862sMZ/zGqHTCGz8TOXSqJW7xZKuWoLZdxOyoCrZVRILtPWOKXv71RXy+Zps0jduL5k1tWlNZRhD5eF6AxBKsXrmCNc1ptDyLt/ghwc8otXvRNe4I7ardF7usHNE4gqMm9IlWr4fmW6FrEeObHM656hjOOu1oGmrLMFFIZUUZ8ZizA567S+pPRSSZTBYjQv045CEpUQoqhBDlEbFRuwxIIYePRSLgxRWq4XrRKVOUQ6cWB4/ZRRhBMe0sOjitnkjEybsuV33/XC6+4nbuf/gFLjjnWPpcFynlHNNt27nm5j/h9vg0ppZw+gWzdPjwBt7/YDEfffIrupZERFQVc/OWQew8TQ0JZs4cwxFfPZdD5nyF4UOqiaIQR4RUZRm2bX8p8Tsg18UDoGzevLmuYUjjslQyMXzh8iA68EpVZ4gQpaB8TyhrwnR2Id8Zg/2744XNXXD6PcZ8vEj5r5NEfnCCJSNqIRXrhxeUMo8CjoBjAcYQhIalze1cM/c+hg9tYM7B+xC3lbXrWvjz3xaw8fONHH3KbK678lzGjh5eTMVHSlt7Nxs3t9Le0YGJIlJlZQxtqGfUqOEMHVJLPCaEQYBtWaSScRynSLjIlwPhRQTHdpwwDNLZXG66rFmzJjFmzJjPY7H4RJEw+vHDRm59DCMjBLsa4uMgPgbyNpw9Fn64u8huCZXl61Q/XoOUJ5WZ4y0mjxGI7YwsKASwJqeypoAWCj4HNJZrVa6bB+7/izzy7AJt8cpxcy6kO7nse6dy5XdPJxGzERTbtjCq2JaFZdslZEcJ/aVKFEWgxXhhLB7Dsa0i4ZaIFE3cv8x6lyAyrfl8fi8pFSO8kUgkDg2CMIjFsG99RvWGp1VdA9QIzjBIjoZcPSSrYHI97D8EmVJjUS+KFYIfQJ+vtLrQXIAWt1haMjFhOHF43BzbAB+/8T53/30RXUNGsnaLQ3ZDK4V1b/PTK07mwq8fg4lCylMJ4vFYP5wHo6UArOoA+EmsIlbRKsHkB8PlB6FEvwCeKkF9icViju/7HycSiVkCUCgU7kgmk1cFQeCrEovHLZZvUv3dK0ZfWg4tfaVRKoBKgXIgBcQpoqDipVNFApoq4MBGkWMakUNqlQlVccikueX+Z/WhrTFtq55DflsbVjCK+IKf8Mvrjuf0k4/CBD5VlSkcx/nC9i2BVftFDErJ1Z0RLSXp1i9d9cEI0tBxnJjneQ8mk8mLBSCTyRxWUVExPwgCX8FSI5JIFN+RzqpZshlZshU2dCkdBcFDxY6h5WXQWAWjamGPeovdalTGVAg4psQRi3cWLORnT77DitoZWqg/VLNbYlir3ifa8KlM3zOj//jjNxFxqK4sIxZzkJ2KInYA3nZA3b4cu6iDAeRfvvWt0tiR4zixTCZzSlVV1QtOKRz2ju/7Kx3HmRRFkS+W2r4vYlSpTMGcyaJzJmPteKF8ebWJEbwgIuEkyPVl+fUDz/B4q63d+3xfezYmCf75CrbdgHHLsPyl+oNzTyGZLCNmC7GY/a/rd3YCxe8AQv5vhPeb/FLQVxWMbVmO7/ubM5nMPFUVp5iulyCfz98Wj8cfjqKohBFWdSyRyCBBNIC2VYolPaUfg7epwbZtEokEn3ywWK97fB6LK/fBr5uuPUsT0NWNLbVEWz+VWNCpd/70SE485mAsDIlEomgSB7wy/SJ/B9CeO/igyL9d9ZIiYQd2Vo1lWRKG4R1NTU15LZIooapat91222Oe674Vi8WSqsVCHTVGRcC2xHJssEXVElVLMJaoOlbRzNkoqUQc8X1+9ZtHOf/Jj/hs70u1r/pw7fl0G7L0JezuNqJ0SHW4RO+/cSbnnnEsmIhUKrGTve6P0fcvWVH56cAng/6jH9D5r0qgilmv/u9RLBZLBJ73aVlZ2R9K0IBifqy/QiydTo8rKyv70LKsuiiKfBHsfhh2CWdKP85DSjlVYwzxeJxNzS1cde9zvBafoU7ZWHqbPVVvKPR24bQvJMzAqIol3HfLSRwwawYm9KkoRX13sp36v5T6SX9hxJdv/0EAL9EdGtRYtm2rat513QMqKyuX9VeS9afHDWDV1NRscF33dKBg23YCLdbgqWqxdqDIDEtErP6qL9uy8VxXL537sGkaN1m/ecQcelqaVDa3IKvn4RQ8wp48M4a/y9P3XcD++04DE+xCfP/q6q6UDrJh/XFb6QdDfumWl1K2q/SvQQjEsmxA8/n8OSXi7f4yOmvQAJGq2lVVVW9lMpkTgI5YPJ4sFSKakvIxxQI+LSFHFdux6evLsHRjmscefl1zL/xKvz+1E9NXgxP0Em6Yx/H7bePJP17LxHGjcCylvGznld8B997Fbu+sZPpZVZxAiV8DhA+g4Qd8gEhVw1gsngTyuVzutOrq6r+XCkQGyuesXbgYLViwwKmtrV3Q3d092w+C+bFYLBmLxeIljoWqGmpxcCMike/7OqRxiE4dW6np7m360PPva23mdZ0wtopg20ouP7OgD/zyUm2sr9Vk3NZUKqmWZQ0wsV8/CTII1r5DBQzQXPouiAoyyAkaKLikBO0KgDAWi8Xi8XgyDMP3MpnM7Orq6hdLxIf/ce0gQD6f/0YQBB/roGaM0SAI1Pd947quUVWzYtUGM+4r3zBUHGamzPmumXXy7XrHPU+ZbK5genszplAoRL7nmTAMNQgD9X0/isJQoyjacYWhhkGgYRiWrkCDoHiF/Z+7PhNFA6U9g5vv+0sLhcK3586da+1K0//n0llACpnCoVbcOgb4CjBWVStFJAaIMUaSyaSu3bCZBx75B129fZxz2iHMPmBv9VyfRMIREau/PFZ21MyWXLpBbq7ujFQvdaogMtj+76opfVXNAC3AR8aYVz/44IM3Dj300PD/V+nsvyqj7W9r1qxJNDY2lvu+n+iXu87OTiZNmrTTs5+sXKmTRjeQz0MZRfzjF8svdqlsGHSP7grz3uWe/pZIJPzu7u7cuHHj3C+Zu+HfuEr/KwO+pHze/Ctu/r9YPv9/AGQbqpJ8kJr2AAAAAElFTkSuQmCC" alt="BadQ" style={{ width: 32, height: 32, borderRadius: 9, objectFit: "cover", flexShrink: 0 }} />
          <div><div style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.3 }}>BadQ</div><div style={{ fontSize: 11, color: T.muted }}>v{APP_VERSION}</div></div>
        </div>

        {loadCorrupted && (
          <div style={{ background: "#fdecea", border: "1px solid #f0a8a0", borderRadius: 12, padding: "10px 11px", marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 9 }}>
            <span style={{ fontSize: 17, flexShrink: 0, lineHeight: "20px" }}>⚠️</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800 }}>ข้อมูลเดิมเสียหาย ระบบไม่บันทึกทับให้เพื่อกันข้อมูลหายซ้ำ</div>
              <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>น่าจะเกิดจากแอปถูกปิดกลางคันตอนกำลังบันทึก — ไปที่ "ประวัติ" แล้วเปิด "ข้อมูลและการสำรอง" เพื่อกู้คืนจากจุดสำรองอัตโนมัติ หรือไฟล์สำรองที่เคยเก็บไว้</div>
              <div style={{ display: "flex", gap: 8, marginTop: 7 }}>
                <button onClick={() => setTab("history")} style={{ padding: "7px 13px", borderRadius: 9, background: T.accent, border: "none", color: "#fff", fontSize: 12, fontWeight: 800 }}>ไปกู้คืนข้อมูล</button>
                <button onClick={() => { setLoadCorrupted(false); setBootStatus("new-install"); }} style={{ padding: "7px 13px", borderRadius: 9, background: "none", border: `1px solid ${T.border}`, color: T.muted, fontSize: 12, fontWeight: 700 }}>เริ่มต้นใหม่ (ไม่กู้คืน)</button>
              </div>
            </div>
          </div>
        )}

        {updateAvailable && (
          <div style={{ background: "#eaf3ff", border: "1px solid #a9cdf0", borderRadius: 12, padding: "10px 11px", marginBottom: 14, display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ fontSize: 17, flexShrink: 0, lineHeight: "20px" }}>🔄</span>
            <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700 }}>มีเวอร์ชั่นใหม่ (v{updateAvailable}) พร้อมใช้งาน</div>
            <button onClick={applyUpdateNow} style={{ flexShrink: 0, padding: "7px 13px", borderRadius: 9, background: T.blue, border: "none", color: "#fff", fontSize: 12, fontWeight: 800 }}>อัปเดตเลย</button>
          </div>
        )}

        {showBackupReminder && (
          <div style={{ background: "#fff7e6", border: "1px solid #f0c96b", borderRadius: 12, padding: "10px 11px", marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 9 }}>
            <span style={{ fontSize: 17, flexShrink: 0, lineHeight: "20px" }}>💾</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800 }}>{daysSinceBackup == null ? "ยังไม่เคยสำรองข้อมูลเลย" : `ยังไม่ได้สำรองข้อมูลมา ${daysSinceBackup} วันแล้ว`}</div>
              <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>มือถือ (โดยเฉพาะ iPhone) อาจล้างข้อมูลแอปเองได้ถ้าปิด/ไม่ได้เปิดนาน ๆ — สำรองเก็บไว้กันพลาด</div>
              <button onClick={() => { exportBackup(); setBackupNoticeDismissed(true); }} style={{ marginTop: 7, padding: "7px 13px", borderRadius: 9, background: T.green, border: "none", color: "#fff", fontSize: 12, fontWeight: 800 }}>สำรองเลย</button>
            </div>
            <button onClick={() => setBackupNoticeDismissed(true)} style={{ flexShrink: 0, background: "none", border: "none", color: T.muted, padding: 4 }}><X size={16} /></button>
          </div>
        )}

        {tab === "members" && <MembersTab {...{ players: activePlayers, archivedPlayers, playingIds, addPlayer, resetAllToAbsent, setStatus, setPLevel, updatePlayer, delPlayer, archivePlayer, restorePlayer, openPhoto, settings, changeLevelPreset, setCustomLevels, getP, history, current, sessionHistory, tournamentHistory, exportBackup, validateBackupFile, applyRestore, undoRestore, lastBackupAt: settings.lastBackupAt, hasPreRestoreBackup, autoBackups, bootLog, deleteAllMembersData, wipeAllAppData }} />}
        {tab === "session" && <SessionTab {...{ players: activePlayers, getP, playersById, history, current, roundNo, courtCount, setCourtCount, courtLabels, setCourtLabel, mode, setMode, settings, setSettings, session, setSession, sessionHistory, lockPairs, addLockPair, removeLockPair, setHandPref, genStart, startGame, endGame, finishAndAdvance, undoFinish, nextCourt, regenCourt, fillCourt, regenFuture, toggleCurrentLock, setScore, setWin, clearScore, tapSlot, isSel, sel, replaceSlot, nextPoolFor, waitQueue, now, resetGames, endSession, changeLevelPreset, setCustomLevels, setQueuedSlot, autoQueueNext, clearQueuedNext, swapQueuedTeams, queueEligiblePool, activeTournament, tournamentHistory, startTournament, saveTournamentDraft, tStartMatch, tSetCourtLabel, tSetCourtCount, tSetScore, tSetWin, tClearScore, tFinishMatch, tEditAffectsDownstream, tUndoMatch, tPauseTournament, tResumeTournament, tMoveTeamDivision, tGenerateGroupKnockout, tGenerateSwissNextRound, tCompleteTournament, tArchiveOnly, tDeleteTournament, tUpdateProfile, tSetRegistrationConfig, tToggleTeamPaid, tAddFinanceEntry, tRemoveFinanceEntry, openTournamentLogo, openSessionPhoto, clearSessionPhoto, onOpenTournamentPrint: setTournamentPrintReport }} />}
        {tab === "history" && <HistoryTab {...{ sessionHistory, tournamentHistory, playersById, toggleHistoricalPaid, deleteSessionHistory, exportBackup, validateBackupFile, applyRestore, undoRestore, lastBackupAt: settings.lastBackupAt, hasPreRestoreBackup, autoBackups, bootLog, openHistPhoto, clearHistPhoto, addHistExpense, updateHistExpense, removeHistExpense, onOpenTournamentPrint: setTournamentPrintReport }} />}
        {tab === "summary" && <SummaryTab {...{ players, history, current, getP, settings, session, tournamentHistory }} />}
        {tab === "finance" && <FinanceTab {...{ sessionHistory, session, generalExpenses, otherIncome, addHistExpense, updateHistExpense, removeHistExpense, addGeneralExpense, updateGeneralExpense, removeGeneralExpense, addOtherIncome, updateOtherIncome, removeOtherIncome, openHistPhoto, clearHistPhoto, discountCredits, applyDiscountCredits, cancelDiscountCredit, players, history, current, settings, setSettings, togglePaid, setPDiscount, applyWheelPrize, endSession, qrRef, courtCount, courtLabels, onOpenFinancePrint: setFinancePrintReport, activeTournament, tournamentHistory }} />}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.surface, borderTop: `1px solid ${T.border}`, paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div style={{ maxWidth: isWide ? 860 : 520, margin: "0 auto", display: "flex" }}>
          <TabBtn active={tab === "members"} onClick={() => setTab("members")} label="ผู้เล่น"><User size={20} strokeWidth={tab === "members" ? 2.4 : 1.8} /></TabBtn>
          <TabBtn active={tab === "session"} onClick={() => setTab("session")} label="วันนี้"><span style={{ fontSize: 19, lineHeight: "20px" }}>🏸</span></TabBtn>
          <TabBtn active={tab === "summary"} onClick={() => setTab("summary")} label="สรุป"><ClipboardList size={20} strokeWidth={tab === "summary" ? 2.4 : 1.8} /></TabBtn>
          <TabBtn active={tab === "finance"} onClick={() => setTab("finance")} label="การเงิน"><span style={{ fontSize: 19, lineHeight: "20px" }}>💰</span></TabBtn>
          <TabBtn active={tab === "history"} onClick={() => setTab("history")} label="ประวัติ"><History size={20} strokeWidth={tab === "history" ? 2.4 : 1.8} /></TabBtn>
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, label, children }) {
  return (
    <button onClick={onClick} style={{ flex: 1, padding: "9px 0 11px", background: "none", border: "none", color: active ? T.green : T.muted, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      {children}<span style={{ fontSize: 11.5, fontWeight: active ? 700 : 500 }}>{label}</span>
    </button>
  );
}

/* ============ MEMBERS ============ */
function MembersTab({ players, archivedPlayers, playingIds, addPlayer, resetAllToAbsent, setStatus, setPLevel, updatePlayer, delPlayer, archivePlayer, restorePlayer, openPhoto, settings, changeLevelPreset, setCustomLevels, getP, history, current, sessionHistory, tournamentHistory, exportBackup, validateBackupFile, applyRestore, undoRestore, lastBackupAt, hasPreRestoreBackup, autoBackups, bootLog, deleteAllMembersData, wipeAllAppData }) {
  const [q, setQ] = useState(""); const [sort, setSort] = useState("levelDesc"); const [onlyPresent, setOnlyPresent] = useState(false);
  const [editPlayerId, setEditPlayerId] = useState(null); // v1.9.17: id of player shown in "แก้ไขสมาชิก", or null
  const [profilePlayerId, setProfilePlayerId] = useState(null); // v1.11.5: id of player shown in the new Player Profile sheet, or null
  const [generalSettingsOpen, setGeneralSettingsOpen] = useState(false); // v1.11.5: the new ⚙️ ตั้งค่า (general settings, replaces the old skill-only sheet trigger)
  const levelOptions = activeLevelOptions(settings);
  const defaultSkillIndex = levelOptions[Math.min(6, levelOptions.length - 1)]?.skillIndex || levelOptions[0]?.skillIndex || 1;
  const [name, setName] = useState(""); const [skillIndex, setSkillIndex] = useState(defaultSkillIndex);
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const list = useMemo(() => {
    let l = players.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));
    // v1.9.17: "registered" hasn't actually arrived yet, so it doesn't count as "ที่มา" here either —
    // same treatment as "absent" for this filter (everything else about "absent" logic is unchanged).
    if (onlyPresent) l = l.filter((p) => p.status !== "absent" && p.status !== "registered");
    return [...l].sort((a, b) => sort === "levelDesc" ? (b.skillIndex || 0) - (a.skillIndex || 0) || a.name.localeCompare(b.name) : sort === "levelAsc" ? (a.skillIndex || 0) - (b.skillIndex || 0) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));
  }, [players, q, sort, onlyPresent]);
  const readyCount = players.filter((p) => p.status === "ready").length;
  // v1.9.17: "registeredCount" = registered OR ready (anyone who said they're coming, per spec — this is
  // the count a future court-count recommendation feature will build on; readyCount above stays the
  // narrower "actually here right now" number, unchanged).
  const registeredCount = players.filter((p) => p.status === "registered" || p.status === "ready").length;
  // v1.9.11: brought the photo-at-creation control back into Quick Add (per explicit request) — lets the
  // organizer snap/attach a photo right when adding a new member, instead of only after via tap-to-edit.
  // v1.9.13: picking a file now opens the same crop/position step used everywhere else, instead of an
  // auto-centered crop — see cropJob below.
  const [draftPhoto, setDraftPhoto] = useState(null);
  const newPlayerFileRef = useRef();
  const [cropJob, setCropJob] = useState(null); // raw picked-image src awaiting crop, or null
  const onDraftPhotoFile = async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const raw = await fileToDataURL(f).catch(() => null); if (raw) setCropJob(raw); };
  const submit = () => { addPlayer(name, skillIndex, draftPhoto); setName(""); setDraftPhoto(null); };
  return (
    <div>
      <div style={{ position: "relative", marginBottom: 10 }}>
        <Search size={17} style={{ position: "absolute", left: 12, top: 12, color: T.muted }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อสมาชิก" style={{ width: "100%", padding: "11px 12px 11px 36px", borderRadius: 11, background: T.surface, border: `1px solid ${T.border}`, color: T.text, fontSize: 14.5, outline: "none", boxSizing: "border-box" }} />
      </div>

      {/* v1.11.5: the old always-visible "ระบบระดับฝีมือ: อีสาน ⚙️ ตั้งค่า" row was removed entirely (no
          blank gap left behind) — the active skill preset no longer needs permanent screen space; it's
          now reached via ⚙️ ตั้งค่า → ระดับฝีมือ below, which still opens the exact same, unmodified
          LevelSettingsSheet/LevelPresetEditor. Filter row rebuilt into one line: ตัวกรอง / เฉพาะที่มา /
          ⚙️ ตั้งค่า (now GENERAL settings, not skill-only) — kept on one row on iPhone via flex + minWidth:0. */}
      {cropJob && <ImageCropper src={cropJob} circleGuide title="จัดตำแหน่งรูปโปรไฟล์" onCancel={() => setCropJob(null)} onConfirm={(data) => { setDraftPhoto(data); setCropJob(null); }} />}

      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 12 }}>
        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: "100%", appearance: "none", padding: "9px 26px 9px 10px", borderRadius: 10, background: T.surface, border: `1px solid ${T.border}`, color: T.text, fontSize: 12.5, fontWeight: 600, boxSizing: "border-box" }}>
            <option value="levelDesc">ตัวกรอง: เก่ง → เริ่มต้น</option><option value="levelAsc">ตัวกรอง: เริ่มต้น → เก่ง</option><option value="name">ตัวกรอง: ชื่อ (ก-ฮ)</option>
          </select>
          <ChevronDown size={15} style={{ position: "absolute", right: 8, top: 11, color: T.muted, pointerEvents: "none" }} />
        </div>
        <button onClick={() => setOnlyPresent((v) => !v)} style={{ flexShrink: 0, padding: "9px 10px", borderRadius: 10, fontSize: 12, fontWeight: 700, border: `1px solid ${onlyPresent ? T.green : T.border}`, background: onlyPresent ? "#e2f5ec" : T.surface, color: onlyPresent ? T.green : T.muted, whiteSpace: "nowrap" }}>เฉพาะที่มา</button>
        <button onClick={() => setGeneralSettingsOpen(true)} title="ตั้งค่า" style={{ flexShrink: 0, padding: "9px 10px", borderRadius: 10, fontSize: 12, fontWeight: 700, border: `1px solid ${T.border}`, background: T.surface, color: T.text, whiteSpace: "nowrap" }}>⚙️ ตั้งค่า</button>
      </div>
      {generalSettingsOpen && (
        <GeneralSettingsSheet
          settings={settings} changeLevelPreset={changeLevelPreset} setCustomLevels={setCustomLevels}
          exportBackup={exportBackup} validateBackupFile={validateBackupFile} applyRestore={applyRestore} undoRestore={undoRestore}
          lastBackupAt={lastBackupAt} hasPreRestoreBackup={hasPreRestoreBackup} autoBackups={autoBackups} bootLog={bootLog}
          deleteAllMembersData={deleteAllMembersData} wipeAllAppData={wipeAllAppData}
          archivedPlayers={archivedPlayers} restorePlayer={restorePlayer}
          onClose={() => setGeneralSettingsOpen(false)}
        />
      )}
      {/* v1.9.11: Quick Add — photo button restored (snap/attach at creation time) + [ชื่อผู้เล่น][ระดับ][+]. Skill-index explanations still live in the ตั้งค่าระดับฝีมือ sheet above (unaffected). */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <input ref={newPlayerFileRef} type="file" accept="image/*" onChange={onDraftPhotoFile} style={{ display: "none" }} />
        <button onClick={() => newPlayerFileRef.current.click()} title="เพิ่ม/ถ่ายรูปสมาชิกใหม่" style={{ position: "relative", border: `1px solid ${T.border}`, background: T.surface, borderRadius: 11, padding: 0, width: 42, height: 42, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {draftPhoto ? <img src={draftPhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Camera size={17} color={T.muted} />}
        </button>
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="เพิ่มสมาชิกใหม่" style={{ flex: 1, padding: "11px 12px", borderRadius: 11, background: T.surface, border: `1px solid ${T.border}`, color: T.text, fontSize: 14.5, outline: "none" }} />
        <select value={skillIndex} onChange={(e) => setSkillIndex(Number(e.target.value))} style={{ padding: "0 8px", borderRadius: 11, background: T.surface, border: `1px solid ${T.border}`, color: T.text, fontSize: 14, fontWeight: 700 }}>{levelOptions.map((o) => <option key={o.skillIndex + o.label} value={o.skillIndex}>{o.label}</option>)}</select>
        <button onClick={submit} style={{ padding: "0 15px", borderRadius: 11, background: T.accent, border: "none", color: "#fff", display: "flex", alignItems: "center" }}><Plus size={19} /></button>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: T.muted, marginBottom: 8 }}>
        <span>สมาชิก {players.length} คน</span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* v1.9.17: compact "ลงทะเบียน N · พร้อมเล่น N" — same row, no extra vertical space */}
          <span>
            <span style={{ color: PSTATUS.registered.color, fontWeight: 700 }}>ลงทะเบียน {registeredCount}</span>
            <span style={{ color: T.muted }}> · </span>
            <span style={{ color: T.green, fontWeight: 700 }}>พร้อมเล่น {readyCount}</span>
          </span>
          {players.length > 0 && <button onClick={() => setConfirmResetAll(true)} title="รีเซ็ตทุกคนเป็นไม่ได้มา (เริ่มวันใหม่)" style={{ padding: "5px 9px", borderRadius: 8, background: T.surface, border: `1px solid ${T.border}`, color: T.muted, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}><RotateCcw size={12} /> ไม่มาทั้งหมด</button>}
        </span>
      </div>
      {confirmResetAll && (
        <div onClick={() => setConfirmResetAll(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface, borderRadius: 16, padding: 18, maxWidth: 340, width: "100%" }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>รีเซ็ตสถานะทุกคนเป็น "ไม่ได้มา"?</div>
            <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 16 }}>เหมือนเริ่มก๊วนใหม่วันใหม่ — สถิติ/ประวัติของแต่ละคนจะไม่หาย แค่สถานะการมาจะถูกล้าง</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmResetAll(false)} style={btnSecondary}>ยกเลิก</button>
              <button onClick={() => { setConfirmResetAll(false); resetAllToAbsent(); }} style={btnPrimary}>ไม่มาทั้งหมด</button>
            </div>
          </div>
        </div>
      )}
      {list.length === 0 && <div style={{ color: T.muted, fontSize: 13, padding: "22px 0", textAlign: "center" }}>{players.length === 0 ? "ยังไม่มีสมาชิก" : "ไม่พบสมาชิก"}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {list.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: 13, background: T.surface, border: `1px solid ${T.border}` }}>
            <button onClick={() => openPhoto(p.id)} style={{ position: "relative", border: "none", background: "none", padding: 0, flexShrink: 0 }}>
              <Avatar p={p} size={44} />
              <span style={{ position: "absolute", right: -2, bottom: -2, width: 18, height: 18, borderRadius: 9, background: T.surface, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}><Camera size={10} color={T.muted} /></span>
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* v1.11.5: tapping the name now opens the new read-only Player Profile (photo/name/skill/
                  hand/type header + all-time stats) instead of jumping straight into edit — "แก้ไขสมาชิก"
                  is still reached from inside the Profile's own edit action, so nothing about
                  EditPlayerModal itself changes. Quick Edit ระดับฝีมือ (select below), Status dropdown,
                  Delete, and photo (the Avatar button above) are all untouched/unchanged. */}
              <button onClick={() => setProfilePlayerId(p.id)} style={{ display: "block", width: "100%", textAlign: "left", border: "none", background: "none", padding: 0, cursor: "pointer" }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: T.text }}>{p.name}</div>
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                <select value={p.skillIndex} onChange={(e) => setPLevel(p.id, Number(e.target.value))} style={{ background: levelColor(p.skillIndex), color: "#fff", fontWeight: 800, fontSize: 11, border: "none", borderRadius: 7, padding: "3px 6px" }}>{levelOptions.map((o) => <option key={o.skillIndex + o.label} value={o.skillIndex} style={{ background: "#fff", color: "#000" }}>{o.label}</option>)}</select>
                <span style={{ background: HAND_BADGE[p.handedness === "left" ? "left" : "right"].bg, color: HAND_BADGE[p.handedness === "left" ? "left" : "right"].color, fontWeight: 800, fontSize: 11, borderRadius: 7, padding: "3px 6px" }}>{HAND_LABEL[p.handedness === "left" ? "left" : "right"]}</span>
                {/* v1.11.5: Member/Guest badge — order is Skill → Hand → Type per spec, informational
                    only (never read by matchmaking/skill/attendance/tournament logic). */}
                <span style={{ background: MEMBER_TYPE_META[p.memberType === "guest" ? "guest" : "member"].bg, color: MEMBER_TYPE_META[p.memberType === "guest" ? "guest" : "member"].color, fontWeight: 800, fontSize: 11, borderRadius: 7, padding: "3px 6px" }}>{MEMBER_TYPE_META[p.memberType === "guest" ? "guest" : "member"].label}</span>
              </div>
            </div>
            {playingIds && playingIds.has(p.id)
              ? <span style={{ padding: "7px 12px", borderRadius: 20, fontSize: 12, fontWeight: 800, minWidth: 76, textAlign: "center", background: PSTATUS.playing.bg, color: PSTATUS.playing.color }}>กำลังเล่น</span>
              : <select value={p.status || "absent"} onChange={(e) => setStatus(p.id, e.target.value)} style={{ appearance: "none", textAlign: "center", padding: "7px 10px", borderRadius: 20, fontSize: 12, fontWeight: 800, border: "none", minWidth: 76, background: PSTATUS[p.status || "absent"].bg, color: PSTATUS[p.status || "absent"].color }}>
                  {PSTATUS_OPTS.map((s) => <option key={s} value={s} style={{ background: "#fff", color: "#000" }}>{PSTATUS[s].label}</option>)}
                </select>}
            {/* v1.11.6: the per-card trash icon is removed per spec — deleting/archiving a member is a
                destructive/management action and must not sit on the main frequently-tapped screen where
                it can be hit by accident. Both actions now live inside "แก้ไขสมาชิก" → การจัดการสมาชิก. */}
          </div>
        ))}
      </div>
      {editPlayerId && players.find((p) => p.id === editPlayerId) && (
        <EditPlayerModal
          player={players.find((p) => p.id === editPlayerId)}
          levelOptions={levelOptions}
          onOpenPhoto={openPhoto}
          onSave={(patch) => updatePlayer(editPlayerId, patch)}
          onArchive={() => { archivePlayer(editPlayerId); setEditPlayerId(null); }}
          onDelete={() => { delPlayer(editPlayerId); setEditPlayerId(null); }}
          onClose={() => setEditPlayerId(null)}
        />
      )}
      {profilePlayerId && players.find((p) => p.id === profilePlayerId) && (
        <PlayerProfileSheet
          player={players.find((p) => p.id === profilePlayerId)}
          getP={getP}
          history={history}
          current={current}
          sessionHistory={sessionHistory}
          tournamentHistory={tournamentHistory}
          onEdit={() => { setEditPlayerId(profilePlayerId); setProfilePlayerId(null); }}
          onClose={() => setProfilePlayerId(null)}
        />
      )}
    </div>
  );
}

// v1.9.17: "แก้ไขสมาชิก" — opened by tapping a player's NAME on the Player Card (Quick Edit ระดับฝีมือ,
// Status dropdown, Delete, and the photo button are all untouched — this is an ADDITIONAL entry point,
// not a replacement for any of them). Edits name/skill/handedness, plus a shortcut into the exact same
// photo crop flow used everywhere else (onOpenPhoto = the existing openPhoto(id)). Pairing preference
// ("อยากคู่/ไม่อยากคู่กับมือซ้าย") deliberately has NO control here — per spec it stays exclusively on
// the existing ล็อคคู่/ข้อจำกัดคู่ editor (ตั้งค่าก๊วน sheet) rather than a new/duplicate one.
function EditPlayerModal({ player, levelOptions, onOpenPhoto, onSave, onArchive, onDelete, onClose }) {
  const [name, setName] = useState(player.name);
  const [skillIndex, setSkillIndex] = useState(player.skillIndex);
  const [handedness, setHandedness] = useState(player.handedness === "left" ? "left" : "right");
  // v1.11.5: memberType/phone/lineId — informational-only fields (never read by matchmaking, skill
  // calc, attendance, or tournament ranking; see MEMBER_TYPE_META for the badge shown on the main list).
  const [memberType, setMemberType] = useState(player.memberType === "guest" ? "guest" : "member");
  const [phone, setPhone] = useState(player.phone || "");
  const [lineId, setLineId] = useState(player.lineId || "");
  // v1.11.6: permanent-delete confirmation — never a single accidental tap (Archive needs none, it's
  // fully reversible; see "การจัดการสมาชิก" below).
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = () => {
    const n = name.trim();
    if (!n) return;
    onSave({ name: n, skillIndex, handedness, memberType, phone: phone.trim(), lineId: lineId.trim() });
    onClose();
  };
  const handBtn = (v, label) => (
    <button
      onClick={() => setHandedness(v)}
      style={{ flex: 1, padding: "10px 0", borderRadius: 11, border: `1.5px solid ${handedness === v ? HAND_BADGE[v].color : T.border}`, background: handedness === v ? HAND_BADGE[v].bg : T.surface, color: handedness === v ? HAND_BADGE[v].color : T.text, fontWeight: 800, fontSize: 13.5 }}
    >{label}</button>
  );
  return (
    <Overlay onClose={onClose}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>แก้ไขสมาชิก</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <button onClick={() => onOpenPhoto(player.id)} style={{ position: "relative", border: "none", background: "none", padding: 0, flexShrink: 0 }}>
          <Avatar p={{ ...player, name: name || player.name }} size={60} />
          <span style={{ position: "absolute", right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, background: T.surface, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}><Camera size={11} color={T.muted} /></span>
        </button>
        <div style={{ fontSize: 12, color: T.muted }}>แตะรูปเพื่อเปลี่ยน</div>
      </div>
      <Label>ชื่อ</Label>
      <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", padding: "11px 12px", borderRadius: 11, background: T.surface, border: `1px solid ${T.border}`, color: T.text, fontSize: 14.5, outline: "none", boxSizing: "border-box", marginBottom: 14 }} />
      <Label>ระดับฝีมือ</Label>
      <select value={skillIndex} onChange={(e) => setSkillIndex(Number(e.target.value))} style={{ width: "100%", padding: "11px 12px", borderRadius: 11, background: T.surface, border: `1px solid ${T.border}`, color: T.text, fontSize: 14.5, fontWeight: 700, marginBottom: 14, boxSizing: "border-box" }}>
        {levelOptions.map((o) => <option key={o.skillIndex + o.label} value={o.skillIndex}>{o.label}</option>)}
      </select>
      <Label>มือถนัด</Label>
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        {handBtn("left", "ซ้าย")}
        {handBtn("right", "ขวา")}
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 16, lineHeight: 1.5 }}>
        ความต้องการจับคู่กับมือซ้าย (อยาก/ไม่อยาก) ตั้งค่าได้ที่ ตั้งค่าก๊วน → ล็อคคู่/ข้อจำกัดคู่
      </div>

      <Label>ประเภทสมาชิก</Label>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <button onClick={() => setMemberType("member")} style={{ flex: 1, padding: "10px 0", borderRadius: 11, border: `1.5px solid ${memberType === "member" ? MEMBER_TYPE_META.member.border : T.border}`, background: memberType === "member" ? MEMBER_TYPE_META.member.bg : T.surface, color: memberType === "member" ? MEMBER_TYPE_META.member.color : T.text, fontWeight: 800, fontSize: 13.5 }}>Member</button>
        <button onClick={() => setMemberType("guest")} style={{ flex: 1, padding: "10px 0", borderRadius: 11, border: `1.5px solid ${memberType === "guest" ? MEMBER_TYPE_META.guest.border : T.border}`, background: memberType === "guest" ? MEMBER_TYPE_META.guest.bg : T.surface, color: memberType === "guest" ? MEMBER_TYPE_META.guest.color : T.text, fontWeight: 800, fontSize: 13.5 }}>Guest</button>
      </div>

      {/* v1.11.5: optional contact info — display/storage only, explicitly never read by any
          matchmaking/skill/attendance/tournament logic (see spec: informational-only). */}
      <Label>ข้อมูลติดต่อ (ไม่บังคับ)</Label>
      <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 8, marginTop: -6 }}>ใช้สำหรับติดต่อสมาชิกเท่านั้น</div>
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="เบอร์โทรศัพท์" type="tel" inputMode="tel" style={{ width: "100%", padding: "11px 12px", borderRadius: 11, background: T.surface, border: `1px solid ${T.border}`, color: T.text, fontSize: 14.5, outline: "none", boxSizing: "border-box", marginBottom: 10 }} />
      <input value={lineId} onChange={(e) => setLineId(e.target.value)} placeholder="LINE ID" style={{ width: "100%", padding: "11px 12px", borderRadius: 11, background: T.surface, border: `1px solid ${T.border}`, color: T.text, fontSize: 14.5, outline: "none", boxSizing: "border-box", marginBottom: 18 }} />

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onClose} style={btnSecondary}>ยกเลิก</button>
        <button onClick={save} style={btnPrimary}>บันทึก</button>
      </div>

      {/* v1.11.6: "การจัดการสมาชิก" — deliberately separated (spacing + divider) and visually quiet so it
          never competes with the green บันทึก button above, per spec sections 2/8. Archive is a normal
          secondary action (no confirmation — it's fully reversible from ⚙️ ตั้งค่า → สมาชิกที่เก็บไว้);
          permanent delete is styled destructive/red and always requires an explicit confirm (section 5). */}
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
        <Label>การจัดการสมาชิก</Label>
        <button onClick={onArchive} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", borderRadius: 11, background: T.surface, border: `1px solid ${T.border}`, color: T.text, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>📦 เก็บสมาชิก</button>
        <button onClick={() => setConfirmDelete(true)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", borderRadius: 11, background: "none", border: `1px solid ${T.accent}`, color: T.accent, fontSize: 13, fontWeight: 700 }}>🗑️ ลบสมาชิกถาวร</button>
      </div>

      {confirmDelete && (
        <Overlay onClose={() => setConfirmDelete(false)}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>ลบสมาชิกถาวร?</div>
          <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 16, lineHeight: 1.6 }}>
            ข้อมูลสมาชิกนี้จะถูกลบและไม่สามารถกู้คืนได้
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setConfirmDelete(false)} style={btnSecondary}>ยกเลิก</button>
            <button onClick={() => { setConfirmDelete(false); onDelete(); }} style={{ ...btnPrimary, background: T.accent }}>ลบถาวร</button>
          </div>
        </Overlay>
      )}
    </Overlay>
  );
}

// v1.11.5: read-only Player Profile — opened by tapping a member's name on the main list (replacing the
// old direct-to-edit behavior; "แก้ไข" here reopens the exact same EditPlayerModal, unchanged). Stats are
// ALL-TIME (unlike SummaryTab's per-player detail drill-down, which is scoped to just today's session) —
// reuses the existing playerStats/tournamentStatsForPlayer functions rather than reinventing counting
// logic, so the "no-result matches never distort Win Rate" rule already built into playerStats (decided
// = win+loss, noScore/draw excluded) is inherited for free.
function PlayerProfileSheet({ player: p, getP, history, current, sessionHistory, tournamentHistory, onEdit, onClose }) {
  const [showPhoto, setShowPhoto] = useState(false);
  // all-time casual matches this player could appear in: today's completed matches (history + any
  // "done" match still sitting in current, not yet archived) + every archived session's matches.
  const casualMatches = useMemo(() => [
    ...(history || []),
    ...((current || []).filter((m) => m.status === "done")),
    ...((sessionHistory || []).flatMap((s) => s.matches || [])),
  ], [history, current, sessionHistory]);
  const cs = playerStats(p.id, casualMatches);
  const ts = tournamentStatsForPlayer(p.id, tournamentHistory);
  // IMPORTANT STAT RULE (per spec): matches without a recorded win/loss (cs.noScore) count toward the
  // total below but are excluded from both the win/loss counts and the Win Rate denominator — exactly
  // how playerStats already defines "decided" (win+loss only). Tournament matches are unaffected since
  // computeTournamentPlayerStats only ever counts completed matches with a real winner in the first place.
  const totalMatches = cs.win + cs.loss + cs.draw + cs.noScore + ts.matches;
  const wins = cs.win + ts.wins;
  const losses = cs.loss + ts.losses;
  const decided = wins + losses;
  const winRate = decided > 0 ? Math.round((wins / decided) * 100) : null;
  // "จำนวนครั้งที่เข้าร่วมก๊วน" — count of archived sessions this player actually appears in at least one
  // match of (reuses playerStats per session; no new attendance-tracking data invented).
  const sessionsAttended = useMemo(() => (sessionHistory || []).filter((s) => {
    const st = playerStats(p.id, s.matches || []);
    return (st.win + st.loss + st.draw + st.noScore) > 0;
  }).length, [sessionHistory, p.id]);
  const hand = p.handedness === "left" ? "left" : "right";
  const mtype = p.memberType === "guest" ? "guest" : "member";
  return (
    <Overlay onClose={onClose}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
        {/* v1.11.5 section 10: tapping the profile photo opens a simple large view — separate from (and
            does not interfere with) the existing change-photo flow used by the main list's Avatar button
            and EditPlayerModal, which stays exactly as-is. */}
        <button onClick={() => p.photo && setShowPhoto(true)} style={{ border: "none", background: "none", padding: 0, flexShrink: 0, cursor: p.photo ? "pointer" : "default" }}>
          <Avatar p={p} size={58} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
            <span style={{ background: levelColor(p.skillIndex), color: "#fff", fontWeight: 800, fontSize: 11, borderRadius: 7, padding: "3px 7px" }}>{p.level}</span>
            <span style={{ background: HAND_BADGE[hand].bg, color: HAND_BADGE[hand].color, fontWeight: 800, fontSize: 11, borderRadius: 7, padding: "3px 7px" }}>{HAND_LABEL[hand]}</span>
            <span style={{ background: MEMBER_TYPE_META[mtype].bg, color: MEMBER_TYPE_META[mtype].color, fontWeight: 800, fontSize: 11, borderRadius: 7, padding: "3px 7px" }}>{MEMBER_TYPE_META[mtype].label}</span>
          </div>
        </div>
        <button onClick={onEdit} title="แก้ไขสมาชิก" style={{ flexShrink: 0, padding: "7px 10px", borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 12, fontWeight: 700 }}>✎ แก้ไข</button>
      </div>

      <SectionHead icon={<ClipboardList size={16} color={T.green} />} title="สถิติผู้เล่น" />
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <MiniStat label="แมตช์ทั้งหมด" value={totalMatches} />
        <MiniStat label="ชนะ" value={wins} color={T.green} />
        <MiniStat label="แพ้" value={losses} color={T.accent} />
        <MiniStat label="Win Rate" value={winRate != null ? winRate + "%" : "—"} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <MiniStat label="เข้าร่วมก๊วน" value={sessionsAttended} />
        <MiniStat label="Tournament" value={ts.tournaments} />
        <MiniStat label="🥇 Champion" value={ts.championships} color={T.green} />
        <MiniStat label="🥈 Runner-up" value={ts.runnerUps} />
        <MiniStat label="🥉 Third" value={ts.thirds} />
      </div>

      <button onClick={onClose} style={btnSecondary}>ปิด</button>

      {showPhoto && p.photo && (
        <div onClick={() => setShowPhoto(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <img src={p.photo} alt="" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 14, objectFit: "contain" }} />
        </div>
      )}
    </Overlay>
  );
}

// v1.9.9 IA cleanup (Phase 2): consolidates the level-preset switch (LevelPresetEditor, unchanged) and the
// per-skill-index (1-11) description text — previously always-visible / a separate inline toggle in
// MembersTab — into one collapsed sheet, opened from the compact "ตั้งค่าระดับฝีมือ" button.
function LevelSettingsSheet({ settings, changeLevelPreset, setCustomLevels, onClose }) {
  // v1.9.12 fix: LevelPresetEditor already renders its own "ดู/ซ่อนคำอธิบายแต่ละระดับ" toggle + the same
  // per-skill-index (1-11) list — the sheet used to ALSO render that list again unconditionally below it,
  // showing the exact same descriptions twice. Removed the duplicate block; LevelPresetEditor's own toggle
  // is the single source for it now.
  return (
    <Overlay onClose={onClose}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>⚙️ ตั้งค่าระดับฝีมือ</div>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 14 }}>เลือกระบบระดับที่ใช้ในพื้นที่/ก๊วนของคุณ และดูคำอธิบายแต่ละระดับ</div>
      <LevelPresetEditor settings={settings} changeLevelPreset={changeLevelPreset} setCustomLevels={setCustomLevels} />
    </Overlay>
  );
}

// v1.11.5: the new GENERAL app settings sheet — replaces the old skill-only ⚙️ ตั้งค่า trigger on the
// Members tab. "ระดับฝีมือ" here opens the EXISTING LevelSettingsSheet (unmodified, same
// preset-switch/description logic) and "การสำรอง / นำเข้า / ส่งออกข้อมูล" opens the EXISTING
// BackupSettingsEditor (unmodified, same export/import/restore/undo logic already used from History) —
// both reused in place rather than reimplemented, per "do not create duplicate implementations".
function GeneralSettingsSheet({ settings, changeLevelPreset, setCustomLevels, exportBackup, validateBackupFile, applyRestore, undoRestore, lastBackupAt, hasPreRestoreBackup, autoBackups, bootLog, deleteAllMembersData, wipeAllAppData, archivedPlayers, restorePlayer, onClose }) {
  const [levelSheetOpen, setLevelSheetOpen] = useState(false);
  const [backupSheetOpen, setBackupSheetOpen] = useState(false);
  const [archivedSheetOpen, setArchivedSheetOpen] = useState(false); // v1.11.6: "สมาชิกที่เก็บไว้"
  const [expanded, setExpanded] = useState(null); // "policy" | "data" | "manage" | null
  const [confirmDeleteMembers, setConfirmDeleteMembers] = useState(false);
  const [confirmWipeAll, setConfirmWipeAll] = useState(false);
  const [wipedNotice, setWipedNotice] = useState(false);
  const currentPreset = getPresetMeta(settings.levelPresetId || "isan");

  const NavRow = ({ children, onClick }) => (
    <button onClick={onClick} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8, padding: "11px 12px", borderRadius: 11, background: T.surface, border: `1px solid ${T.border}`, marginBottom: 8, cursor: "pointer" }}>{children}</button>
  );
  const ExpandRow = ({ title, id, children }) => (
    <div style={{ marginBottom: 8, borderRadius: 11, background: T.surface, border: `1px solid ${T.border}`, overflow: "hidden" }}>
      <button onClick={() => setExpanded(expanded === id ? null : id)} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", padding: "11px 12px", background: "none", border: "none", cursor: "pointer" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text, flex: 1 }}>{title}</span>
        <ChevronDown size={15} color={T.muted} style={{ transform: expanded === id ? "rotate(180deg)" : "none", flexShrink: 0 }} />
      </button>
      {expanded === id && <div style={{ padding: "0 12px 12px", fontSize: 11.5, color: T.muted, lineHeight: 1.7 }}>{children}</div>}
    </div>
  );

  return (
    <Overlay onClose={onClose}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>⚙️ ตั้งค่า</div>

      <Label>🏸 ระดับฝีมือ</Label>
      <NavRow onClick={() => setLevelSheetOpen(true)}>
        <span style={{ fontSize: 12.5, color: T.muted }}>ระบบที่ใช้อยู่</span>
        <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: 13, color: T.text }}>{currentPreset.name}</span>
        <ChevronRight size={15} color={T.muted} />
      </NavRow>
      {levelSheetOpen && <LevelSettingsSheet settings={settings} changeLevelPreset={changeLevelPreset} setCustomLevels={setCustomLevels} onClose={() => setLevelSheetOpen(false)} />}

      <div style={{ marginTop: 14 }}><Label>🔒 ความเป็นส่วนตัวและข้อมูล</Label></div>

      <ExpandRow title="นโยบายความเป็นส่วนตัว" id="policy">
        BadQ เก็บข้อมูลสมาชิกและประวัติการเล่นไว้ในเครื่องของคุณเท่านั้น (ไม่มีการส่งข้อมูลขึ้นเซิร์ฟเวอร์ภายนอก) ใช้เพื่อจัดก๊วน จับคู่ และสรุปผลภายในแอปนี้เท่านั้น
      </ExpandRow>
      <ExpandRow title="ข้อมูลที่ BadQ จัดเก็บ" id="data">
        ขึ้นอยู่กับการใช้งาน แอปอาจเก็บ: ชื่อสมาชิก, รูปโปรไฟล์, ระดับฝีมือ, มือถนัด, ประเภทสมาชิก, เบอร์โทรศัพท์ (ถ้ากรอก), LINE ID (ถ้ากรอก), ประวัติการเข้าร่วมก๊วน, ประวัติการแข่งขัน/ผลการแข่งขัน, สถิติผู้เล่น, ข้อมูลการชำระเงินที่เกี่ยวข้อง และ Tournament data
        <div style={{ marginTop: 6 }}>เบอร์โทรศัพท์และ LINE ID เป็นข้อมูลไม่บังคับ ใช้สำหรับติดต่อสมาชิกเท่านั้น</div>
      </ExpandRow>
      <ExpandRow title="การจัดการข้อมูลส่วนบุคคล" id="manage">
        แก้ไขหรือลบข้อมูลติดต่อ (เบอร์โทร/LINE ID) ของสมาชิกแต่ละคนได้ที่โปรไฟล์ผู้เล่น → แก้ไขสมาชิก ส่วนการลบข้อมูลสมาชิกทั้งหมดหรือล้างข้อมูลทั้งหมด ทำได้ด้านล่างในหมวดนี้
      </ExpandRow>

      {/* v1.11.6: "สมาชิกที่เก็บไว้" — recovery list for players archived from แก้ไขสมาชิก → เก็บสมาชิก.
          Archiving never deletes anything, so this is where they're found again and restored. */}
      <NavRow onClick={() => setArchivedSheetOpen(true)}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>สมาชิกที่เก็บไว้</span>
        {archivedPlayers && archivedPlayers.length > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: T.muted, marginLeft: 8 }}>{archivedPlayers.length}</span>}
        <ChevronRight size={15} color={T.muted} style={{ marginLeft: "auto" }} />
      </NavRow>
      {archivedSheetOpen && <ArchivedPlayersSheet archivedPlayers={archivedPlayers || []} restorePlayer={restorePlayer} onClose={() => setArchivedSheetOpen(false)} />}

      <NavRow onClick={() => setBackupSheetOpen(true)}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>การสำรอง / นำเข้า / ส่งออกข้อมูล</span>
        <ChevronRight size={15} color={T.muted} style={{ marginLeft: "auto" }} />
      </NavRow>
      {backupSheetOpen && (
        <Overlay onClose={() => setBackupSheetOpen(false)}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>สำรอง / นำเข้า / ส่งออกข้อมูล</div>
          <BackupSettingsEditor exportBackup={exportBackup} validateBackupFile={validateBackupFile} applyRestore={applyRestore} undoRestore={undoRestore} lastBackupAt={lastBackupAt} hasPreRestoreBackup={hasPreRestoreBackup} autoBackups={autoBackups} bootLog={bootLog} />
        </Overlay>
      )}

      {/* destructive actions — explicit confirmation required, never a single accidental tap */}
      <button onClick={() => setConfirmDeleteMembers(true)} style={{ width: "100%", textAlign: "left", padding: "11px 12px", borderRadius: 11, background: T.surface, border: `1px solid ${T.border}`, marginBottom: 8, color: T.accent, fontSize: 13, fontWeight: 700 }}>ลบข้อมูลสมาชิก</button>
      <button onClick={() => setConfirmWipeAll(true)} style={{ width: "100%", textAlign: "left", padding: "11px 12px", borderRadius: 11, background: "#fdecea", border: `1px solid ${T.accent}`, marginBottom: 8, color: T.accent, fontSize: 13, fontWeight: 800 }}>ล้างข้อมูลทั้งหมด</button>

      <button onClick={onClose} style={{ ...btnSecondary, marginTop: 8 }}>ปิด</button>

      {confirmDeleteMembers && (
        <Overlay onClose={() => setConfirmDeleteMembers(false)}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>ลบข้อมูลสมาชิกทั้งหมด?</div>
          <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 16, lineHeight: 1.6 }}>
            จะลบรายชื่อ รูป เบอร์โทร และ LINE ID ของสมาชิกทุกคนออกจากรายการผู้เล่นทันที — ประวัติก๊วน ผลการแข่งขัน และข้อมูลการเงินที่ผ่านมาจะยังอยู่ครบ (ชื่อผู้เล่นที่ถูกลบในประวัติเก่าจะแสดงเป็น "?" แทน) การกระทำนี้ไม่สามารถย้อนกลับได้
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setConfirmDeleteMembers(false)} style={btnSecondary}>ยกเลิก</button>
            <button onClick={() => { deleteAllMembersData(); setConfirmDeleteMembers(false); }} style={{ ...btnPrimary, background: T.accent }}>ลบข้อมูลสมาชิก</button>
          </div>
        </Overlay>
      )}
      {confirmWipeAll && (
        <Overlay onClose={() => setConfirmWipeAll(false)}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>ล้างข้อมูลทั้งหมด?</div>
          <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 16, lineHeight: 1.6 }}>
            จะลบข้อมูลทั้งหมดในแอปนี้: สมาชิกทุกคน, ประวัติก๊วนทุกครั้ง, ผลการแข่งขัน Tournament ทุกรายการ และข้อมูลการเงิน — เหมือนติดตั้งแอปใหม่ ระบบจะเก็บสำเนาไว้ให้กู้คืนได้ครั้งเดียวผ่าน "ย้อนกลับการนำเข้าครั้งล่าสุด" ในหน้าสำรองข้อมูล
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setConfirmWipeAll(false)} style={btnSecondary}>ยกเลิก</button>
            <button onClick={() => { wipeAllAppData(); setConfirmWipeAll(false); setWipedNotice(true); }} style={{ ...btnPrimary, background: T.accent }}>ล้างข้อมูลทั้งหมด</button>
          </div>
        </Overlay>
      )}
      {wipedNotice && (
        <Overlay onClose={() => { setWipedNotice(false); onClose(); }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>ล้างข้อมูลทั้งหมดแล้ว</div>
          <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 16, lineHeight: 1.6 }}>หากล้างผิด กู้คืนได้ที่ การสำรอง / นำเข้า / ส่งออกข้อมูล → ย้อนกลับการนำเข้าครั้งล่าสุด (ใช้ได้ครั้งเดียว)</div>
          <button onClick={() => { setWipedNotice(false); onClose(); }} style={btnPrimary}>ปิด</button>
        </Overlay>
      )}
    </Overlay>
  );
}

// v1.11.6: "สมาชิกที่เก็บไว้" — reached from ⚙️ ตั้งค่า. Deliberately minimal (photo/name/skill/hand/type
// + a single "กู้คืนสมาชิก" action) per spec section 4: this is a recovery list, not a second member-
// management surface — full editing/stats are still only reachable from the normal Player Profile/
// แก้ไขสมาชิก once a player is restored. Restore flips the SAME player's archived flag back off (see
// restorePlayer in App()) — same id, same object, no data is recreated or touched.
function ArchivedPlayersSheet({ archivedPlayers, restorePlayer, onClose }) {
  return (
    <Overlay onClose={onClose}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>สมาชิกที่เก็บไว้</div>
      {archivedPlayers.length === 0 ? (
        <div style={{ color: T.muted, fontSize: 13, padding: "22px 0", textAlign: "center" }}>ยังไม่มีสมาชิกที่เก็บไว้</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
          {archivedPlayers.map((p) => {
            const hand = p.handedness === "left" ? "left" : "right";
            const mtype = p.memberType === "guest" ? "guest" : "member";
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: 13, background: T.surface, border: `1px solid ${T.border}` }}>
                <Avatar p={p} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: T.text }}>{p.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                    <span style={{ background: levelColor(p.skillIndex), color: "#fff", fontWeight: 800, fontSize: 11, borderRadius: 7, padding: "3px 6px" }}>{p.level}</span>
                    <span style={{ background: HAND_BADGE[hand].bg, color: HAND_BADGE[hand].color, fontWeight: 800, fontSize: 11, borderRadius: 7, padding: "3px 6px" }}>{HAND_LABEL[hand]}</span>
                    <span style={{ background: MEMBER_TYPE_META[mtype].bg, color: MEMBER_TYPE_META[mtype].color, fontWeight: 800, fontSize: 11, borderRadius: 7, padding: "3px 6px" }}>{MEMBER_TYPE_META[mtype].label}</span>
                  </div>
                </div>
                <button onClick={() => restorePlayer(p.id)} style={{ flexShrink: 0, padding: "8px 12px", borderRadius: 10, background: "#e2f5ec", border: `1px solid ${T.green}`, color: T.green, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>กู้คืนสมาชิก</button>
              </div>
            );
          })}
        </div>
      )}
      <button onClick={onClose} style={btnSecondary}>ปิด</button>
    </Overlay>
  );
}

function Avatar({ p, size }) {
  if (!p) return null;
  if (p.photo) return <img src={p.photo} alt="" style={{ width: size, height: size, flexShrink: 0, borderRadius: size / 2, objectFit: "cover" }} />;
  return <div style={{ width: size, height: size, flexShrink: 0, borderRadius: size / 2, background: levelColor(p.skillIndex), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: size * 0.4 }}>{p.name.trim().charAt(0).toUpperCase()}</div>;
}

function Fairness({ sA, sB }) {
  const pct = fairnessPct(sA, sB);
  const tag = fairnessTag(pct);
  return (
    <div style={{ marginTop: 7, background: T.surface2, borderRadius: 10, padding: "6px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", fontSize: 12, marginBottom: 4 }}>
        <span style={{ fontWeight: 700, color: T.muted }}>ความสมดุล</span>
        <span style={{ marginLeft: 6, fontWeight: 800, color: tag.color }}>{pct}%</span>
        <span style={{ marginLeft: "auto", fontWeight: 700, color: tag.color }}>{tag.emoji} {tag.label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: T.muted, minWidth: 42, textAlign: "right" }}>ทีม A {sA}</span>
        <div style={{ flex: 1, height: 7, borderRadius: 6, overflow: "hidden", display: "flex", background: "#fff" }}>
          <div style={{ flex: sA || 1, background: T.green }} />
          <div style={{ flex: sB || 1, background: T.blue }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: T.muted, minWidth: 42 }}>{sB} ทีม B</span>
      </div>
    </div>
  );
}

/* ============ SESSION ============ */
function SessionTab(props) {
  const { players, getP, playersById, history, current, roundNo, courtCount, setCourtCount, courtLabels, setCourtLabel, mode, setMode, settings, setSettings, session, setSession, sessionHistory, lockPairs, addLockPair, removeLockPair, setHandPref, genStart, startGame, endGame, finishAndAdvance, undoFinish, nextCourt, regenCourt, fillCourt, regenFuture, toggleCurrentLock, setScore, setWin, clearScore, tapSlot, isSel, sel, replaceSlot, nextPoolFor, waitQueue, now, resetGames, endSession, changeLevelPreset, setCustomLevels, setQueuedSlot, autoQueueNext, clearQueuedNext, swapQueuedTeams, queueEligiblePool,
    activeTournament, tournamentHistory, startTournament, saveTournamentDraft, tStartMatch, tSetCourtLabel, tSetCourtCount, tSetScore, tSetWin, tClearScore, tFinishMatch, tEditAffectsDownstream, tUndoMatch, tPauseTournament, tResumeTournament, tMoveTeamDivision, tGenerateGroupKnockout, tGenerateSwissNextRound, tCompleteTournament, tArchiveOnly, tDeleteTournament, tUpdateProfile, tSetRegistrationConfig, tToggleTeamPaid, tAddFinanceEntry, tRemoveFinanceEntry, openTournamentLogo, openSessionPhoto, clearSessionPhoto, onOpenTournamentPrint } = props;
  const [openQuanSettings, setOpenQuanSettings] = useState(false); // single "ตั้งค่าก๊วน" sheet — replaces the old 4 separate Today-tab accordions
  const [showNameDropdown, setShowNameDropdown] = useState(false); // custom dropdown (not a native <select>) so each option can show its quan photo
  // unique past quan names + their most-recently-used photo, pulled from ประวัติก๊วน (sessionHistory is
  // newest-first, so the first occurrence of a name is also its most recent photo)
  const pastQuans = useMemo(() => {
    const seen = new Set(), out = [];
    (sessionHistory || []).forEach((s) => { if (s.name && !seen.has(s.name)) { seen.add(s.name); out.push({ name: s.name, photo: s.photo || null }); } });
    return out;
  }, [sessionHistory]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyShowAll, setHistoryShowAll] = useState(false); // v1.9.9: cap the expanded match-history list so it never outweighs active courts/queue (Phase 2)
  const HISTORY_PAGE = 8;
  const [scoreOpen, setScoreOpen] = useState(null); // match id whose score editor is open
  // inline "สนาม N" label editor — tap the label right on the court card (no need to open ตั้งค่าก๊วน).
  // `editingCourt` holds the court NUMBER (1-based) currently being edited, or null. The draft lives in
  // its own bit of local state (not bound straight to courtLabels) so backspace-to-clear just works —
  // no fallback-to-default fighting the input on every keystroke; the fallback only kicks in on blur.
  const [editingCourt, setEditingCourt] = useState(null);
  const [courtLabelDraft, setCourtLabelDraft] = useState("");
  const startEditCourtLabel = (c) => { setCourtLabelDraft(courtLabelFor(courtLabels, c)); setEditingCourt(c); };
  const commitCourtLabel = (c) => { const v = courtLabelDraft.trim(); setCourtLabel(c - 1, v || String(c)); setEditingCourt(null); };
  const CourtLabelTag = (c, muted) => editingCourt === c ? (
    <input
      autoFocus
      value={courtLabelDraft}
      onChange={(e) => setCourtLabelDraft(e.target.value)}
      onBlur={() => commitCourtLabel(c)}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      onClick={(e) => e.stopPropagation()}
      style={{ width: 50, padding: "3px 6px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface2, color: T.text, fontWeight: 800, fontSize: 15, textAlign: "center", outline: "none" }}
    />
  ) : (
    <button onClick={() => startEditCourtLabel(c)} title="แตะเพื่อแก้เลขสนาม" style={{ background: "none", border: "none", padding: 0, fontWeight: 800, fontSize: 15, color: muted ? T.muted : T.text }}>
      สนาม {courtLabelFor(courtLabels, c)}
    </button>
  );
  const [confirmRegenAll, setConfirmRegenAll] = useState(false);
  const [queueEditFor, setQueueEditFor] = useState(null); // court/match id currently in inline "แก้ไข" (Edit Next Match Mode) — replaces the old modal-based queueSheetFor
  const started = current.length > 0;
  const waitMin = (p) => Math.max(0, Math.floor((now - (p.waitingSince || now)) / 60000));
  const teamScore = (arr) => arr.reduce((s, id) => s + (id ? getP(id)?.skillIndex || 0 : 0), 0);
  // Requirement 16: block starting a match with unfilled slots — surfaced as a disabled+dimmed button
  // rather than a silent no-op, plus a short hint line under the action row.
  const startReady = (m) => [...m.teamA, ...m.teamB].every(Boolean);
  const byCourt = (a, b) => a.court - b.court;
  const playing = current.filter((m) => m.status === "playing").sort(byCourt);
  const nexts = current.filter((m) => m.status === "next").sort(byCourt);
  const dones = current.filter((m) => m.status === "done").sort(byCourt);
  const occupied = new Set(current.map((m) => m.court));
  const empties = []; for (let c = 1; c <= courtCount; c++) if (!occupied.has(c)) empties.push(c);
  const rounds = settings.rounds || 1;

  // renders a court's card in ANY status (next/playing/done) with the SAME layout — only the badge,
  // buttons, and (for "done") the score editor change. Kept as one component so a given court's card
  // never remounts/jumps position when its status changes; the caller always renders exactly one of
  // these per occupied court, in fixed court-number order (see the unified list below).
  const FullCard = (m) => {
    const st = STATUS[m.status]; const editable = m.status === "next";
    const sA = teamScore(m.teamA), sB = teamScore(m.teamB);
    const badgeText = m.status === "playing" ? "🔴 กำลังเล่น" : m.status === "done" ? "✅ จบแล้ว" : "🔵 เกมถัดไป";
    // a "next" court's swap dropdown also offers players already paired into OTHER not-yet-started
    // courts (not just the free/waiting pool) — see nextPoolFor/replaceSlot for how the actual swap
    // avoids duplicating anyone onto two courts at once.
    const bench = editable ? [...waitQueue, ...nextPoolFor(m.id)] : waitQueue;
    return (
      <div key={m.id} style={{ background: T.surface, border: `1px solid ${m.locked ? T.accent : (m.status === "playing" ? T.green : T.border)}`, borderRadius: 14, padding: 11, marginBottom: 9 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          {CourtLabelTag(m.court)}
          {editable && (
            <button onClick={() => toggleCurrentLock(m.id)} title={m.locked ? "ล็อกอยู่ — แตะเพื่อปลดล็อก" : "แตะเพื่อล็อกคู่นี้ไว้ (จัดใหม่ทั้งหมดจะไม่เปลี่ยนคู่นี้)"} style={{ marginLeft: 8, display: "flex", alignItems: "center", gap: 4, background: m.locked ? "#fdecea" : "none", border: "none", borderRadius: 8, padding: m.locked ? "3px 7px" : 0, color: m.locked ? T.accent : T.muted }}>
              {m.locked ? <Lock size={15} /> : <Unlock size={15} />}
              {m.locked && <span style={{ fontSize: 10.5, fontWeight: 800 }}>ล็อก</span>}
            </button>
          )}
          <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 800, color: st.color, background: st.bg, padding: "4px 10px", borderRadius: 20 }}>{badgeText}</span>
        </div>
        <MatchTeams m={m} getP={getP} editable={editable} tapSlot={tapSlot} isSel={isSel} replaceSlot={replaceSlot} bench={bench} big={m.status === "playing"} now={now} />
        {/* Balance is a pre-game decision aid only (Requirement 2/4): once a court is actually playing,
            the CURRENT match never shows Balance/%/bar. "next" (not-yet-started) and "done" keep it —
            but ONLY once every slot is filled (FIX: an incomplete "next" court used to show a bogus
            0%/ห่างกัน/team-score reading computed from partial teams — now it shows a plain hint instead,
            with no % / status label / team score / bar at all until the match is fully selected). */}
        {m.status !== "playing" && (startReady(m) ? <Fairness sA={sA} sB={sB} /> : <div style={{ fontSize: 11, color: T.accent, fontWeight: 700, marginTop: 7, textAlign: "center" }}>เลือกผู้เล่นให้ครบก่อนเริ่มเกม</div>)}
        {m.status === "playing" && (
          <NextMatchBlock
            m={m}
            getP={getP}
            pool={waitQueue}
            autoQueueNext={autoQueueNext}
            setQueuedSlot={setQueuedSlot}
            swapQueuedTeams={swapQueuedTeams}
            clearQueuedNext={clearQueuedNext}
            now={now}
            editing={queueEditFor === m.id}
            onEdit={() => setQueueEditFor(m.id)}
            onDone={() => setQueueEditFor(null)}
          />
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
          {m.status === "next" && <>
            <button onClick={() => regenCourt(m.id)} disabled={m.locked} style={{ ...btnSecondary, opacity: m.locked ? 0.4 : 1 }}><Shuffle size={15} /> {settings.pairingMode === "manual" ? "ล้างสนาม" : "จัดใหม่"}</button>
            <button onClick={() => startGame(m.id)} disabled={!startReady(m)} style={{ ...btnPrimary, opacity: startReady(m) ? 1 : 0.4 }}><Play size={15} /> เริ่มเกม</button>
          </>}
          {m.status === "playing" && <button onClick={() => finishAndAdvance(m.id)} style={{ ...btnPrimary, background: T.accent }}><Check size={16} /> จบเกม</button>}
          {m.status === "done" && <>
            <button onClick={() => setScoreOpen(scoreOpen === m.id ? null : m.id)} style={{ ...btnSecondary, padding: "9px 0" }}><ClipboardList size={15} /> {hasScore(m) ? "แก้คะแนน" : "ใส่คะแนน"}</button>
            <button onClick={() => undoFinish(m.id)} style={{ padding: "0 14px", borderRadius: 11, background: T.surface2, border: `1px solid ${T.border}`, color: T.muted, display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700 }}><Undo2 size={15} /></button>
            <button onClick={() => { setScoreOpen(null); nextCourt(m.id); }} style={btnPrimary}><ChevronRight size={16} /> เริ่มเกมถัดไป</button>
          </>}
        </div>
        {m.status === "done" && scoreOpen === m.id && <ScoreEditor m={m} rounds={rounds} setScore={setScore} setWin={setWin} clearScore={clearScore} />}
      </div>
    );
  };

  // compact mode selector — the only place Tournament and Casual meet on Today; switching it never
  // touches Casual `current`/`history`/`session` state, it only changes what's rendered below
  const ModeSelector = (
    <div style={{ display: "flex", gap: 6, background: T.surface2, borderRadius: 12, padding: 4, marginBottom: 12 }}>
      <button onClick={() => setSession((s) => ({ ...s, mode: "casual" }))} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "none", fontSize: 13, fontWeight: 800, background: (session.mode || "casual") === "casual" ? T.surface : "none", color: (session.mode || "casual") === "casual" ? T.text : T.muted, boxShadow: (session.mode || "casual") === "casual" ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>🏸 จัดก๊วน</button>
      <button onClick={() => setSession((s) => ({ ...s, mode: "tournament" }))} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "none", fontSize: 13, fontWeight: 800, background: session.mode === "tournament" ? T.surface : "none", color: session.mode === "tournament" ? T.text : T.muted, boxShadow: session.mode === "tournament" ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>🏆 Tournament</button>
    </div>
  );
  if (session.mode === "tournament") {
    return (
      <div>
        {ModeSelector}
        <TournamentPanel {...{ players, playersById, settings, activeTournament, tournamentHistory, startTournament, saveTournamentDraft, tStartMatch, tSetCourtLabel, tSetCourtCount, tSetScore, tSetWin, tClearScore, tFinishMatch, tEditAffectsDownstream, tUndoMatch, tPauseTournament, tResumeTournament, tMoveTeamDivision, tGenerateGroupKnockout, tGenerateSwissNextRound, tCompleteTournament, tArchiveOnly, tDeleteTournament, tUpdateProfile, tSetRegistrationConfig, tToggleTeamPaid, tAddFinanceEntry, tRemoveFinanceEntry, openTournamentLogo, onOpenTournamentPrint }} />
      </div>
    );
  }

  return (
    <div>
      {ModeSelector}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={openSessionPhoto} title="แตะเพื่อเปลี่ยนรูปก๊วน" style={{ position: "relative", flexShrink: 0, border: "none", background: "none", padding: 0, width: 32, height: 32 }}>
            {session.photo ? (
              <img src={session.photo} alt="" style={{ width: 32, height: 32, borderRadius: 9, objectFit: "cover" }} />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: 9, background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🏸</div>
            )}
            <span style={{ position: "absolute", right: -3, bottom: -3, width: 15, height: 15, borderRadius: 8, background: T.surface, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}><Camera size={8} color={T.muted} /></span>
          </button>
          <input value={session.name} onChange={(e) => setSession((s) => ({ ...s, name: e.target.value }))} placeholder="ชื่อก๊วน เช่น ก๊วนวันอาทิตย์" style={{ flex: 1, minWidth: 0, border: "none", outline: "none", fontSize: 16, fontWeight: 800, background: "transparent", color: T.text, boxSizing: "border-box" }} />
          {pastQuans.length > 0 && (
            <div style={{ position: "relative", flexShrink: 0 }}>
              <button onClick={() => setShowNameDropdown((v) => !v)} title="เลือกชื่อก๊วนที่เคยใช้" style={{ width: 28, height: 28, borderRadius: 8, background: T.surface2, color: T.muted, border: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ChevronDown size={16} />
              </button>
              {showNameDropdown && (
                <>
                  <div onClick={() => setShowNameDropdown(false)} style={{ position: "fixed", inset: 0, zIndex: 39 }} />
                  <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 40, minWidth: 190, maxHeight: 260, overflowY: "auto", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, boxShadow: "0 6px 20px rgba(0,0,0,0.15)", padding: 6 }}>
                    <div style={{ fontSize: 11, color: T.muted, fontWeight: 700, padding: "6px 8px 4px" }}>ชื่อก๊วนที่เคยใช้</div>
                    {pastQuans.map((q) => (
                      <button
                        key={q.name}
                        onClick={() => { setSession((s) => ({ ...s, name: q.name, photo: q.photo })); setShowNameDropdown(false); }}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 9, background: "none", border: "none", textAlign: "left" }}
                      >
                        {q.photo ? (
                          <img src={q.photo} alt="" style={{ width: 26, height: 26, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 26, height: 26, borderRadius: 8, background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>🏸</div>
                        )}
                        <span style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.name}</span>
                        {session.name === q.name && <Check size={14} color={T.green} style={{ marginLeft: "auto", flexShrink: 0 }} />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, color: T.muted }}>
          <Calendar size={15} />
          <input type="date" value={session.date} onChange={(e) => setSession((s) => ({ ...s, date: e.target.value }))} style={{ border: "none", background: "transparent", color: T.muted, fontSize: 13, outline: "none" }} />
          {session.photo && <button onClick={clearSessionPhoto} style={{ marginLeft: "auto", background: "none", border: "none", color: T.muted, fontSize: 11, fontWeight: 700 }}>ลบรูปก๊วน</button>}
        </div>
      </div>

      {/* compact format badge */}
      <div style={{ textAlign: "center", fontSize: 12.5, color: T.muted, fontWeight: 600, marginBottom: 12 }}>{fmtMode(settings, mode)}</div>

      {/* SETTINGS ENTRY POINT — the 4 separate accordions that used to live here (เกม/จ่ายเงิน/รางวัล/
          ระดับฝีมือ) now live inside one "ตั้งค่าก๊วน" sheet, so Today stays focused on Play (courts /
          matches / queue) instead of Setup. All the same fields, same state, same logic — just moved. */}
      <button onClick={() => setOpenQuanSettings(true)} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: T.surface, border: `1px solid ${T.border}`, marginBottom: 16 }}>
        <span style={{ fontSize: 17 }}>⚙️</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 800, color: T.text }}>ตั้งค่าก๊วน</span>
          <span style={{ display: "block", fontSize: 12, color: T.muted, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{quanSettingsSummary(settings, mode, courtCount)}</span>
        </span>
        <ChevronRight size={18} color={T.muted} />
      </button>
      {openQuanSettings && (
        <QuanSettingsSheet
          mode={mode} setMode={setMode} courtCount={courtCount} setCourtCount={setCourtCount} courtLabels={courtLabels} setCourtLabel={setCourtLabel}
          settings={settings} setSettings={setSettings}
          players={players} lockPairs={lockPairs} addLockPair={addLockPair} removeLockPair={removeLockPair} setHandPref={setHandPref} getP={getP}
          resetGames={resetGames} changeLevelPreset={changeLevelPreset} setCustomLevels={setCustomLevels}
          onClose={() => setOpenQuanSettings(false)}
        />
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => (started ? setConfirmRegenAll(true) : genStart())} style={{ flex: 1, padding: "13px 0", borderRadius: 13, background: T.green, color: "#fff", border: "none", fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <Shuffle size={17} /> {started ? (settings.pairingMode === "manual" ? "ล้างสนามทั้งหมด" : "จัดก๊วนใหม่ทั้งหมด") : (settings.pairingMode === "manual" ? "เริ่มก๊วน (เลือกเอง)" : "เริ่มจัดก๊วน")}
        </button>
        {nexts.length > 1 && <button onClick={regenFuture} title={settings.pairingMode === "manual" ? "ล้างสนามที่ยังไม่เริ่มทั้งหมด" : "สุ่มสนามที่ยังไม่เริ่มใหม่ทั้งหมด"} style={{ padding: "0 15px", borderRadius: 13, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700 }}><Shuffle size={15} /></button>}
      </div>
      {!started && <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: "0 0 18px" }}>{settings.pairingMode === "manual" ? 'ติ๊ก "พร้อมเล่น" ในแท็บผู้เล่น แล้วกดเริ่มก๊วน จากนั้นแตะ "+ เลือกคน" เพื่อจัดคู่เอง' : 'ติ๊ก "พร้อมเล่น" ในแท็บผู้เล่น แล้วกดเริ่มจัดก๊วน'}</div>}

      {confirmRegenAll && (
        <div onClick={() => setConfirmRegenAll(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface, borderRadius: 16, padding: 18, maxWidth: 340, width: "100%" }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>{settings.pairingMode === "manual" ? "ล้างคู่ทุกสนามที่ยังไม่เริ่ม?" : "จัดคู่ใหม่ทุกสนาม?"}</div>
            <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 16 }}>{settings.pairingMode === "manual" ? "เกมที่กำลังเล่นจะไม่ถูกเปลี่ยน ระบบจะล้างเฉพาะสนามที่ยังไม่เริ่มให้เลือกคนใหม่" : "เกมที่กำลังเล่นจะไม่ถูกเปลี่ยน ระบบจะจัดใหม่เฉพาะเกมที่ยังไม่เริ่ม"}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmRegenAll(false)} style={btnSecondary}>ยกเลิก</button>
              <button onClick={() => { setConfirmRegenAll(false); regenFuture(); }} style={btnPrimary}>{settings.pairingMode === "manual" ? "ล้างทั้งหมด" : "จัดใหม่ทั้งหมด"}</button>
            </div>
          </div>
        </div>
      )}

      {/* COURTS — one flat list in fixed court-number order (not grouped by status), so a court's card
          never jumps to a different section/position on screen when it finishes, gets paired, or starts —
          only its badge/buttons change in place. Status is still shown per-card via the badge. */}
      {Array.from({ length: courtCount }, (_, i) => i + 1).map((c) => {
        const m = current.find((x) => x.court === c);
        if (m) return FullCard(m);
        return (
          <div key={"e" + c} style={{ background: T.surface, border: `1px dashed ${T.border}`, borderRadius: 14, padding: 11, marginBottom: 9, display: "flex", alignItems: "center", gap: 10 }}>
            {CourtLabelTag(c, true)}
            <span style={{ fontSize: 12.5, color: T.muted }}>ว่าง</span>
            {started && <button onClick={() => fillCourt(c)} style={{ marginLeft: "auto", ...btnSecondary, flex: "none", padding: "9px 14px" }}><Plus size={15} /> จัดเกม</button>}
          </div>
        );
      })}

      {/* 4. HISTORY */}
      {history.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button onClick={() => setShowHistory((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 11, background: T.surface2, border: `1px solid ${T.border}`, color: T.muted, fontSize: 13, fontWeight: 700 }}>
            <History size={15} /> ประวัติแมตช์ ({history.length})
            <ChevronDown size={16} style={{ marginLeft: "auto", transform: showHistory ? "rotate(180deg)" : "none" }} />
          </button>
          {showHistory && (() => {
            // recent-first (history is stored oldest -> newest); capped to HISTORY_PAGE unless expanded,
            // so a long match log never competes visually with active courts/queue (Phase 2 cleanup).
            const recent = [...history].reverse();
            const shown = historyShowAll ? recent : recent.slice(0, HISTORY_PAGE);
            return (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                {shown.map((m) => (
                  <div key={m.id}>
                    <CompactMatch m={m} getP={getP} onClick={() => setScoreOpen(scoreOpen === m.id ? null : m.id)} />
                    {scoreOpen === m.id && <ScoreEditor m={m} rounds={rounds} setScore={setScore} setWin={setWin} clearScore={clearScore} />}
                  </div>
                ))}
                {!historyShowAll && recent.length > HISTORY_PAGE && (
                  <button onClick={() => setHistoryShowAll(true)} style={{ width: "100%", padding: "8px 0", borderRadius: 10, background: "none", border: `1px dashed ${T.border}`, color: T.muted, fontSize: 12.5, fontWeight: 700 }}>
                    ดูทั้งหมด ({recent.length})
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* 5. WAITING — kept last/bottom-most on purpose: keeps the Playing→Done→"เกมถัดไป" action flow
          uninterrupted (organizer doesn't have to scroll past the wait queue between court actions) */}
      {started && (
        <div style={{ marginTop: 12, marginBottom: 8 }}>
          <SectionHead icon={<Clock size={16} color={T.amber} />} title={`รอเล่น — ${waitQueue.length} คน`} sub="เลือกคนรอนานก่อน" />
          {waitQueue.length === 0 ? <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: "8px 0" }}>ไม่มีคนรอ</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {waitQueue.slice(0, 10).map((p, i) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 11px", borderRadius: 11, background: T.surface, border: `1px solid ${T.border}` }}>
                  <span style={{ width: 20, textAlign: "center", fontWeight: 800, fontSize: 13, color: i < 3 ? T.amber : T.muted }}>{i + 1}</span>
                  <Avatar p={p} size={30} />
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name} <span style={{ color: levelColor(p.skillIndex), fontWeight: 800, fontSize: 12 }}>({p.level})</span></span>
                  <span style={{ fontSize: 12, color: T.muted, fontWeight: 600, textAlign: "right" }}>รอ {waitMin(p)} น.<br /><span style={{ fontSize: 11 }}>{p.games || 0} เกม</span></span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {sel && <div style={{ marginTop: 12, fontSize: 12, color: T.green, textAlign: "center", fontWeight: 600 }}>เลือก {getP(sel.playerId)?.name} — แตะอีกคนเพื่อสลับ</div>}
    </div>
  );
}

// One consolidated settings surface for a casual quan — replaces the old 4 separate Today-tab
// accordions (ตั้งค่าเกม / ตั้งค่าการจ่ายเงิน / ตั้งค่ารางวัล / ระบบระดับฝีมือ). Pure UI relocation:
// every field here reads/writes the exact same mode/courtCount/settings/lockPairs state as before, so
// Casual matchmaking/payment/wheel/level logic is 100% unchanged — only WHERE the controls live moved.
/* ============ TOURNAMENT UI ============ */
function TournamentPanel(props) {
  const { activeTournament } = props;
  const [showWizard, setShowWizard] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // v1.11.2: a status:"draft" activeTournament (saved via the wizard's "บันทึกไว้ก่อน" — see
  // saveTournamentDraft) is NOT ready for TournamentDashboard (no teams/divisions/matches yet) — show a
  // small resume card instead and reopen the SAME wizard pre-filled from it.
  if (activeTournament && activeTournament.status === "draft") {
    return (
      <div>
        <div style={{ textAlign: "center", padding: "30px 20px", color: T.muted, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>มีร่าง Tournament ค้างอยู่</div>
          <div style={{ fontSize: 13, marginBottom: 18 }}>{activeTournament.name || "(ยังไม่ตั้งชื่อ)"}</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={() => setConfirmDiscard(true)} style={{ ...btnSecondary, flex: "none", padding: "10px 16px" }}>ลบร่าง</button>
            <button onClick={() => setShowWizard(true)} style={{ ...btnPrimary, flex: "none", padding: "10px 22px", display: "inline-flex" }}>ทำต่อ</button>
          </div>
        </div>
        {showWizard && <TournamentWizard players={props.players} playersById={props.playersById} settings={props.settings} tournamentHistory={props.tournamentHistory} activeDraft={activeTournament} onClose={() => setShowWizard(false)} onSaveDraft={props.saveTournamentDraft} onCreate={(t) => { props.startTournament(t); setShowWizard(false); }} />}
        {confirmDiscard && (
          <Overlay onClose={() => setConfirmDiscard(false)}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>ลบร่าง Tournament นี้?</div>
            <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 16 }}>ข้อมูลที่กรอกไว้ทั้งหมดจะหายไป</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmDiscard(false)} style={btnSecondary}>ยกเลิก</button>
              <button onClick={() => { props.tDeleteTournament(); setConfirmDiscard(false); }} style={{ ...btnPrimary, background: T.accent }}>ลบร่าง</button>
            </div>
          </Overlay>
        )}
      </div>
    );
  }
  if (activeTournament) return <TournamentDashboard {...props} />;
  return (
    <div>
      <div style={{ textAlign: "center", padding: "44px 20px", color: T.muted, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14 }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🏆</div>
        <div style={{ fontSize: 14, marginBottom: 18 }}>ยังไม่มี Tournament ที่กำลังดำเนินอยู่</div>
        <button onClick={() => setShowWizard(true)} style={{ ...btnPrimary, flex: "none", padding: "12px 22px", display: "inline-flex" }}><Plus size={16} /> สร้าง Tournament</button>
      </div>
      {props.tournamentHistory && props.tournamentHistory.length > 0 && (
        <div style={{ marginTop: 14, textAlign: "center", fontSize: 12, color: T.muted }}>ดู Tournament ที่จบแล้วได้ที่แท็บ “ประวัติ”</div>
      )}
      {showWizard && <TournamentWizard players={props.players} playersById={props.playersById} settings={props.settings} tournamentHistory={props.tournamentHistory} onClose={() => setShowWizard(false)} onSaveDraft={props.saveTournamentDraft} onCreate={(t) => { props.startTournament(t); setShowWizard(false); }} />}
    </div>
  );
}

const TW_STEPS = ["ข้อมูลรายการ", "ผู้เข้าร่วม", "ทีม", "Division", "Seeding", "Preview"];
// v1.11.2: multi-day tournament setup — real organizers spend DAYS collecting participants before an
// event, need to step away and come back to add more people, then re-pair/re-seed once the roster is
// final. `activeDraft` (an activeTournament with status:"draft", saved via onSaveDraft below) carries a
// `draftWizard` snapshot of every piece of wizard state so re-opening the wizard resumes exactly where
// the organizer left off — reusing the SAME persistence layer (IndexedDB/localStorage/LKG/AutoBackup)
// that already keeps activeTournament safe, rather than inventing a separate save path.
function TournamentWizard({ players, playersById, settings, tournamentHistory, activeDraft, onClose, onCreate, onSaveDraft }) {
  const iv = (activeDraft && activeDraft.draftWizard) || {};
  const [step, setStep] = useState(() => iv.step || 1);
  // step 1
  const [name, setName] = useState(() => iv.name || "");
  // v1.11.2: unique past tournament names + their most-recent logo, pulled from ประวัติ (tournamentHistory
  // is newest-first already) — mirrors the ก๊วน name dropdown (see pastQuans in SessionTab) so organizers
  // running the same recurring tournament don't retype the name every time.
  const [showTNameDropdown, setShowTNameDropdown] = useState(false);
  const pastTournaments = useMemo(() => {
    const seen = new Set(), out = [];
    (tournamentHistory || []).forEach((t) => { if (t.name && !seen.has(t.name)) { seen.add(t.name); out.push({ name: t.name, logo: t.logo || null }); } });
    return out;
  }, [tournamentHistory]);
  const [date, setDate] = useState(() => iv.date || new Date().toISOString().slice(0, 10));
  const [courtCount, setCourtCount] = useState(() => iv.courtCount || 2);
  const [format, setFormat] = useState(() => iv.format || "knockout");
  const [matchMode, setMatchMode] = useState(() => iv.matchMode || "doubles"); // doubles | singles — Tournament's own, independent of Casual's `mode`
  // v1.11.1: let the organizer attach a logo right at creation (step 1), same as adding a photo when
  // quick-adding a new member (see draftPhoto/cropJob in the Members list) or the ก๊วน header's own photo
  // button — previously a Tournament logo could only be added AFTER creation via the ✎ profile editor.
  const [draftLogo, setDraftLogo] = useState(() => iv.draftLogo || null);
  const wizardLogoFileRef = useRef();
  const [wizardCropJob, setWizardCropJob] = useState(null); // raw picked-image src awaiting crop, or null
  const onWizardLogoFile = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    const raw = await fileToDataURL(f).catch(() => null);
    if (raw) setWizardCropJob(raw);
  };
  // step 2
  const [teamEntryMode, setTeamEntryMode] = useState(() => iv.teamEntryMode || "individual");
  // v1.11.2: players who already marked themselves "ลงทะเบียน" (registered) for this tournament come
  // in pre-checked — organizers otherwise have to re-tap every name that already RSVP'd, which is most
  // of them in real usage (see Step 2 list below for the checkbox itself). A resumed draft's own saved
  // selection always wins over this default.
  const [selectedIds, setSelectedIds] = useState(() => iv.selectedIds || players.filter((p) => p.status === "registered").map((p) => p.id));
  const [q, setQ] = useState("");
  const [guestName, setGuestName] = useState(""); const [guestSkill, setGuestSkill] = useState(6);
  const [guestPlayers, setGuestPlayers] = useState(() => iv.guestPlayers || []);
  const [fixedPairs, setFixedPairs] = useState(() => iv.fixedPairs || []); // [[idA,idB]] (doubles) or [[idA]] (singles)
  const [pendingPick, setPendingPick] = useState(null); // first player tapped while building a fixed pair
  // step 3
  const [teamBuildMode, setTeamBuildMode] = useState(() => iv.teamBuildMode || "balancedRandom");
  const [teams, setTeams] = useState(() => iv.teams || []);
  // step 4
  const [divisionMode, setDivisionMode] = useState(() => iv.divisionMode || "none"); // none | auto | manual
  const [divisionPreset, setDivisionPreset] = useState(() => iv.divisionPreset || "2"); // "2" | "3" | "custom"
  const [divisionRanges, setDivisionRanges] = useState(() => iv.divisionRanges || [{ name: "ระดับกลาง-สูง", skillMin: 6, skillMax: 11 }, { name: "ระดับเริ่มต้น-กลาง", skillMin: 1, skillMax: 5 }]);
  const [teamDivisionMap, setTeamDivisionMap] = useState(() => iv.teamDivisionMap || {}); // teamId -> division name (manual mode)
  // step 5
  const [seedMode, setSeedMode] = useState(() => iv.seedMode || "skill");
  const [advSeedKind, setAdvSeedKind] = useState(() => iv.advSeedKind || "hybrid"); // skill | performance | hybrid
  const [manualOrder, setManualOrder] = useState(() => iv.manualOrder || []); // teamIds in seed order
  // format-specific extras
  const [groupCount, setGroupCount] = useState(() => iv.groupCount || 2);
  const [qualifyTopN, setQualifyTopN] = useState(() => iv.qualifyTopN || 2);
  const [swissRounds, setSwissRounds] = useState(() => iv.swissRounds || 4);
  const [doubleRound, setDoubleRound] = useState(() => iv.doubleRound || false);
  const [handicapMode, setHandicapMode] = useState(() => iv.handicapMode || "off");
  const [saveGuestsToRoster, setSaveGuestsToRoster] = useState(() => iv.saveGuestsToRoster || false);
  // v1.11.2: "บันทึกไว้ก่อน" — snapshots every piece of wizard state above into activeTournament as a
  // status:"draft" record (see tDeleteTournament/tMoveTeamDivision, which already anticipated a
  // draft/ready pre-active lifecycle) so it survives an app close via the SAME persistence layer as a
  // real running tournament, and TournamentPanel reopens this same wizard pre-filled next time.
  const saveDraft = () => {
    onSaveDraft({
      step, name, date, courtCount, format, matchMode, draftLogo,
      teamEntryMode, selectedIds, guestPlayers, fixedPairs,
      teamBuildMode, teams,
      divisionMode, divisionPreset, divisionRanges, teamDivisionMap,
      seedMode, advSeedKind, manualOrder,
      groupCount, qualifyTopN, swissRounds, doubleRound, handicapMode, saveGuestsToRoster,
    });
    onClose();
  };

  const allPeople = [...players, ...guestPlayers];
  const peopleById = { ...playersById, ...Object.fromEntries(guestPlayers.map((g) => [g.id, g])) };
  const teamSize = matchMode === "singles" ? 1 : 2;
  const filteredPlayers = players.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));

  const toggleSelect = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const addGuest = () => { if (!guestName.trim()) return; const g = { id: "guest-" + uid(), name: guestName.trim(), skillIndex: guestSkill }; setGuestPlayers((prev) => [...prev, g]); setSelectedIds((prev) => [...prev, g.id]); setGuestName(""); };
  const tapForPair = (id) => {
    if (teamSize === 1) { setFixedPairs((prev) => [...prev, [id]]); setSelectedIds((prev) => prev.filter((x) => x !== id)); return; }
    if (pendingPick == null) { setPendingPick(id); return; }
    if (pendingPick === id) { setPendingPick(null); return; }
    setFixedPairs((prev) => [...prev, [pendingPick, id]]);
    setSelectedIds((prev) => prev.filter((x) => x !== pendingPick && x !== id));
    setPendingPick(null);
  };

  const buildTeams = () => {
    const pool = teamEntryMode === "fixedTeam" ? fixedPairs.map((p) => makeTournamentTeam(p)) : (() => {
      if (teamBuildMode === "random") return randomTeams(selectedIds, teamSize);
      if (teamBuildMode === "advancedBalanced" && teamSize === 2) return advancedBalancedTeams(selectedIds, peopleById, computePartnerCounts(tournamentHistory, []));
      if (teamSize === 1) return selectedIds.map((id) => makeTournamentTeam([id]));
      return balancedRandomTeams(selectedIds, peopleById, teamSize);
    })();
    setTeams(pool);
  };
  const goStep3 = () => { if (teamEntryMode === "fixedTeam") { setTeams(fixedPairs.map((p) => makeTournamentTeam(p))); setStep(4); } else { buildTeams(); setStep(3); } };

  const applySeed = (list) => {
    if (seedMode === "random") return seedRandom(list);
    if (seedMode === "manual") { const order = manualOrder.length ? manualOrder : list.map((t) => t.id); return order.map((id, i) => ({ ...list.find((t) => t.id === id), seed: i + 1 })).filter(Boolean); }
    if (seedMode === "advanced") return advSeedKind === "performance" ? seedByPerformance(list, peopleById, tournamentHistory) : advSeedKind === "skill" ? seedBySkill(list, peopleById) : seedHybrid(list, peopleById, tournamentHistory);
    return seedBySkill(list, peopleById);
  };

  const divisionsPreview = () => {
    if (divisionMode === "none") return [{ name: "ทั้งหมด", skillMin: 1, skillMax: 11, teamIds: teams.map((t) => t.id) }];
    if (divisionMode === "manual") {
      const names = [...new Set(Object.values(teamDivisionMap))];
      return (names.length ? names : ["ทั้งหมด"]).map((n) => ({ name: n, skillMin: 1, skillMax: 11, teamIds: teams.filter((t) => (teamDivisionMap[t.id] || "ทั้งหมด") === n).map((t) => t.id) }));
    }
    // auto: classify by AVERAGE team skill (doubles default classification) against each range
    return divisionRanges.map((r) => ({ ...r, teamIds: teams.filter((t) => { const avg = teamStrength(t, peopleById) / (t.playerIds.length || 1); return avg >= r.skillMin && avg <= r.skillMax; }).map((t) => t.id) }));
  };

  const estimateMatches = (divs) => divs.reduce((sum, d) => {
    const n = d.teamIds.length; if (n < 2) return sum;
    if (format === "knockout") return sum + (n - 1);
    if (format === "roundRobin" || format === "league") return sum + (n * (n - 1) / 2) * (doubleRound ? 2 : 1);
    if (format === "swiss") return sum + Math.floor(n / 2) * swissRounds;
    if (format === "group") { const perGroup = Math.ceil(n / groupCount); const g = Math.min(groupCount, n); const rr = g * (perGroup * (perGroup - 1) / 2); const ko = Math.max(0, g * qualifyTopN - 1); return sum + rr + ko; }
    return sum;
  }, 0);

  const create = () => {
    const divs = divisionsPreview();
    const finalDivisions = divs.filter((d) => d.teamIds.length >= 2).map((d) => {
      const divTeams = applySeed(teams.filter((t) => d.teamIds.includes(t.id)));
      const teamsWithDivision = divTeams.map((t) => ({ ...t, divisionId: null }));
      let division = makeDivision({ name: d.name, skillMin: d.skillMin, skillMax: d.skillMax, teamIds: teamsWithDivision.map((t) => t.id) });
      if (format === "knockout") {
        division = { ...division, bracket: generateKnockoutBracket(teamsWithDivision) };
      } else if (format === "roundRobin" || format === "league") {
        const { matches } = generateRoundRobinFixture(teamsWithDivision, format === "league" ? doubleRound : false);
        division = { ...division, matches };
      } else if (format === "swiss") {
        division = { ...division, swissRound: 0, swissRounds, swissMatches: swissRound1Pairing(teamsWithDivision, seedMode === "random" ? "random" : "skill", peopleById) };
      } else if (format === "group") {
        const groups = assignGroups(teamsWithDivision, Math.min(groupCount, Math.max(1, Math.floor(teamsWithDivision.length / 2))));
        const teamsById2 = Object.fromEntries(teamsWithDivision.map((t) => [t.id, t]));
        const groupsWithMatches = groups.map((g) => ({ ...g, matches: generateRoundRobinFixture(g.teamIds.map((id) => teamsById2[id]), false).matches }));
        division = { ...division, groups: groupsWithMatches };
      }
      return { ...division, _teamsWithSeed: teamsWithDivision };
    });
    const allTeams = finalDivisions.flatMap((d) => d._teamsWithSeed.map((t) => ({ ...t, divisionId: d.id })));
    const divisionsClean = finalDivisions.map(({ _teamsWithSeed, ...d }) => d);
    if (saveGuestsToRoster) { /* left as an explicit organizer choice — Casual roster (players[]) is NOT touched automatically */ }
    const tournament = makeTournament({
      name: name.trim() || "Tournament", date, courtCount, courtLabels: Array.from({ length: courtCount }, (_, i) => String(i + 1)), format, teamEntryMode, teamBuildMode, seedMode,
      status: "active", createdAt: Date.now(), startedAt: Date.now(),
      guestPlayers, teams: allTeams, divisions: divisionsClean,
      pointsConfig: { win: 3, draw: 1, loss: 0 }, handicap: { mode: handicapMode }, doubleRound,
      qualifyTopN, groupCount, matchMode,
      logo: draftLogo,
    });
    onCreate(tournament);
  };

  const canNext1 = name.trim().length > 0 && courtCount > 0;
  const canNext2 = teamEntryMode === "individual" ? selectedIds.length >= teamSize * 2 : fixedPairs.length >= 2;
  const canNext3 = teams.length >= 2;

  return (
    <Overlay onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>สร้าง Tournament</div>
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: T.muted, fontWeight: 700 }}>{step}/6 · {TW_STEPS[step - 1]}</span>
      </div>
      <div style={{ display: "flex", gap: 3, marginBottom: 16 }}>{TW_STEPS.map((_, i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 3, background: i < step ? T.green : T.border }} />)}</div>

      {step === 1 && (
        <div>
          <input ref={wizardLogoFileRef} type="file" accept="image/*" onChange={onWizardLogoFile} style={{ display: "none" }} />
          {wizardCropJob && (
            <ImageCropper
              src={wizardCropJob}
              circleGuide={false}
              title="จัดตำแหน่งโลโก้ทัวร์นาเมนต์"
              onCancel={() => setWizardCropJob(null)}
              onConfirm={(data) => { setDraftLogo(data); setWizardCropJob(null); }}
            />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <button onClick={() => wizardLogoFileRef.current.click()} style={{ flexShrink: 0, width: 56, height: 56, borderRadius: 14, background: T.surface2, border: `1px dashed ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: 0 }}>
              {draftLogo ? <img src={draftLogo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Camera size={20} color={T.muted} />}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <button onClick={() => wizardLogoFileRef.current.click()} style={{ padding: "7px 12px", borderRadius: 9, background: "none", border: `1px solid ${T.border}`, color: T.text, fontSize: 12, fontWeight: 700 }}>{draftLogo ? "เปลี่ยนโลโก้" : "เพิ่มโลโก้ (ไม่บังคับ)"}</button>
              {draftLogo && <button onClick={() => setDraftLogo(null)} style={{ marginLeft: 8, background: "none", border: "none", color: T.muted, fontSize: 11.5, fontWeight: 700 }}>ลบ</button>}
            </div>
          </div>
          <Label>ชื่อ Tournament</Label>
          <div style={{ position: "relative", marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น BadQ Championship" style={{ flex: 1, minWidth: 0, padding: "11px 12px", borderRadius: 11, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 14.5, outline: "none", boxSizing: "border-box" }} />
              {pastTournaments.length > 0 && (
                <button onClick={() => setShowTNameDropdown((v) => !v)} title="เลือกชื่อ Tournament ที่เคยใช้" style={{ flexShrink: 0, width: 40, borderRadius: 11, background: T.surface2, color: T.muted, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ChevronDown size={18} />
                </button>
              )}
            </div>
            {showTNameDropdown && (
              <>
                <div onClick={() => setShowTNameDropdown(false)} style={{ position: "fixed", inset: 0, zIndex: 39 }} />
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 40, minWidth: 220, maxHeight: 260, overflowY: "auto", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, boxShadow: "0 6px 20px rgba(0,0,0,0.15)", padding: 6 }}>
                  <div style={{ fontSize: 11, color: T.muted, fontWeight: 700, padding: "6px 8px 4px" }}>ชื่อ Tournament ที่เคยใช้</div>
                  {pastTournaments.map((pt) => (
                    <button
                      key={pt.name}
                      onClick={() => { setName(pt.name); if (pt.logo) setDraftLogo(pt.logo); setShowTNameDropdown(false); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 9, background: "none", border: "none", textAlign: "left" }}
                    >
                      {pt.logo ? (
                        <img src={pt.logo} alt="" style={{ width: 26, height: 26, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 26, height: 26, borderRadius: 8, background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>🏆</div>
                      )}
                      <span style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pt.name}</span>
                      {name === pt.name && <Check size={14} color={T.green} style={{ marginLeft: "auto", flexShrink: 0 }} />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <Label>วันที่</Label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "100%", padding: "11px 12px", borderRadius: 11, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 14, outline: "none", marginBottom: 12, boxSizing: "border-box" }} />
          <Label>จำนวนสนาม</Label>
          <div style={{ marginBottom: 12 }}><Stepper value={courtCount} setValue={setCourtCount} min={1} max={12} /></div>
          <Label>ประเภทการแข่งขัน</Label>
          <Seg options={[["doubles", "ตีคู่"], ["singles", "ตีเดี่ยว"]]} value={matchMode} onChange={setMatchMode} />
          <div style={{ height: 10 }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {[["knockout", "Knockout"], ["roundRobin", "Round Robin"], ["group", "Group Stage"], ["swiss", "Swiss"], ["league", "League"]].map(([v, l]) => (
              <button key={v} onClick={() => setFormat(v)} style={{ padding: "9px 13px", borderRadius: 10, fontSize: 12.5, fontWeight: 800, border: `1.5px solid ${format === v ? T.green : T.border}`, background: format === v ? "#e2f5ec" : T.surface, color: format === v ? T.green : T.text }}>{l}</button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <Seg options={[["individual", "ผู้เล่นเดี่ยว"], ["fixedTeam", "ทีม/คู่ที่กำหนดแล้ว"]]} value={teamEntryMode} onChange={setTeamEntryMode} />
          <div style={{ height: 10 }} />
          <div style={{ position: "relative", marginBottom: 8 }}>
            <Search size={16} style={{ position: "absolute", left: 11, top: 11, color: T.muted }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อสมาชิก" style={{ width: "100%", padding: "10px 12px 10px 34px", borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 13.5, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto", border: `1px solid ${T.border}`, borderRadius: 11, marginBottom: 10 }}>
            {[...filteredPlayers, ...guestPlayers].map((p) => {
              const inFixed = fixedPairs.some((pair) => pair.includes(p.id));
              const sel = selectedIds.includes(p.id);
              return (
                <div key={p.id} onClick={() => (teamEntryMode === "fixedTeam" ? (sel && tapForPair(p.id)) : toggleSelect(p.id))} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", borderBottom: `1px solid ${T.border}`, cursor: "pointer", opacity: inFixed ? 0.4 : 1, background: pendingPick === p.id ? "#e2f5ec" : "none" }}>
                  <input type="checkbox" checked={sel || inFixed} disabled={inFixed} onChange={() => toggleSelect(p.id)} onClick={(e) => e.stopPropagation()} />
                  <span style={{ fontSize: 13.5, fontWeight: 700 }}>{p.name}</span>
                  <span style={{ fontSize: 11, color: T.muted, marginLeft: "auto" }}>{p.id.startsWith("guest-") ? "Guest" : displayLevelFor(p.skillIndex, settings)}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="+ Guest Player" style={{ flex: 1, padding: "9px 11px", borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 13, outline: "none" }} />
            <select value={guestSkill} onChange={(e) => setGuestSkill(Number(e.target.value))} style={{ padding: "0 8px", borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}`, fontSize: 13, fontWeight: 700 }}>{activeLevelOptions(settings).map((o) => <option key={o.skillIndex} value={o.skillIndex}>{o.label}</option>)}</select>
            <button onClick={addGuest} style={{ padding: "0 12px", borderRadius: 10, background: T.accent, border: "none", color: "#fff" }}><Plus size={16} /></button>
          </div>
          {guestPlayers.length > 0 && <div style={{ fontSize: 11, color: T.muted, marginBottom: 10 }}>Guest จะไม่ถูกบันทึกเข้าฐานสมาชิกถาวร เว้นแต่จะเลือก “บันทึกเป็นสมาชิก” ภายหลัง</div>}
          {teamEntryMode === "fixedTeam" ? (
            <div>
              <Label>{teamSize === 2 ? "จับคู่: แตะผู้เล่นคนแรกแล้วคนที่สอง" : "รายชื่อ (Singles = 1 คน 1 ทีม)"}</Label>
              {fixedPairs.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, padding: "6px 0" }}>
                  <span>{p.map((id) => peopleById[id]?.name).join(" + ")}</span>
                  <button onClick={() => setFixedPairs((prev) => prev.filter((_, idx) => idx !== i))} style={{ marginLeft: "auto", background: "none", border: "none", color: T.accent }}><Trash2 size={14} /></button>
                </div>
              ))}
              {teamSize === 1 && selectedIds.length > 0 && <button onClick={() => { setFixedPairs((prev) => [...prev, ...selectedIds.map((id) => [id])]); setSelectedIds([]); }} style={{ ...btnSecondary, marginTop: 6 }}>เพิ่มทั้งหมดเป็นทีมเดี่ยว</button>}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: T.muted }}>เลือกแล้ว {selectedIds.length} คน ({matchMode === "doubles" ? `${Math.floor(selectedIds.length / 2)} ทีมโดยประมาณ` : `${selectedIds.length} ทีม`})</div>
          )}
        </div>
      )}

      {step === 3 && teamEntryMode === "individual" && (
        <div>
          <Label>วิธีจัดทีม</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
            {[["random", "สุ่มทีม"], ["balancedRandom", "Balanced Random"], ...(matchMode === "doubles" ? [["advancedBalanced", "Advanced Balanced"]] : [])].map(([v, l]) => (
              <button key={v} onClick={() => { setTeamBuildMode(v); }} style={{ padding: "9px 13px", borderRadius: 10, fontSize: 12.5, fontWeight: 800, border: `1.5px solid ${teamBuildMode === v ? T.green : T.border}`, background: teamBuildMode === v ? "#e2f5ec" : T.surface, color: teamBuildMode === v ? T.green : T.text }}>{l}</button>
            ))}
          </div>
          <button onClick={buildTeams} style={{ ...btnSecondary, marginBottom: 12 }}><Shuffle size={15} /> สุ่มใหม่</button>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {teams.map((t, i) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", padding: "8px 10px", background: T.surface2, borderRadius: 9, marginBottom: 6, fontSize: 13 }}>
                <span style={{ fontWeight: 700 }}>{t.playerIds.map((id) => peopleById[id]?.name).join(" + ")}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: T.muted }}>ความแข็งทีม {teamStrength(t, peopleById)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          <Seg options={[["none", "ไม่แบ่ง"], ["auto", "แบ่งอัตโนมัติ"], ["manual", "กำหนดเอง"]]} value={divisionMode} onChange={setDivisionMode} />
          <div style={{ height: 10 }} />
          {divisionMode === "auto" && (
            <div>
              <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
                <button onClick={() => { setDivisionPreset("2"); setDivisionRanges([{ name: "Advanced", skillMin: 6, skillMax: 11 }, { name: "Beginner", skillMin: 1, skillMax: 5 }]); }} style={{ ...btnSecondary, flex: "none", padding: "8px 12px", background: divisionPreset === "2" ? "#e2f5ec" : T.surface2 }}>2 ระดับ</button>
                <button onClick={() => { setDivisionPreset("3"); setDivisionRanges([{ name: "Advanced", skillMin: 8, skillMax: 11 }, { name: "Intermediate", skillMin: 5, skillMax: 7 }, { name: "Beginner", skillMin: 1, skillMax: 4 }]); }} style={{ ...btnSecondary, flex: "none", padding: "8px 12px", background: divisionPreset === "3" ? "#e2f5ec" : T.surface2 }}>3 ระดับ</button>
              </div>
              {divisionRanges.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 12.5 }}>
                  <input value={r.name} onChange={(e) => setDivisionRanges((prev) => prev.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))} style={{ flex: 1, padding: "7px 9px", borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12.5 }} />
                  <span>Skill</span>
                  <input type="number" value={r.skillMin} onChange={(e) => setDivisionRanges((prev) => prev.map((x, idx) => (idx === i ? { ...x, skillMin: Number(e.target.value) } : x)))} style={{ width: 44, padding: "7px", borderRadius: 8, border: `1px solid ${T.border}`, textAlign: "center" }} />
                  <span>-</span>
                  <input type="number" value={r.skillMax} onChange={(e) => setDivisionRanges((prev) => prev.map((x, idx) => (idx === i ? { ...x, skillMax: Number(e.target.value) } : x)))} style={{ width: 44, padding: "7px", borderRadius: 8, border: `1px solid ${T.border}`, textAlign: "center" }} />
                </div>
              ))}
              <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>จัดตาม “ความแข็งทีมเฉลี่ยต่อคน” (Average Team Skill) — แก้ Range เองได้</div>
            </div>
          )}
          {divisionMode === "manual" && (
            <div>
              {teams.map((t) => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", fontSize: 13 }}>
                  <span style={{ flex: 1 }}>{t.playerIds.map((id) => peopleById[id]?.name).join(" + ")}</span>
                  <input value={teamDivisionMap[t.id] || "ทั้งหมด"} onChange={(e) => setTeamDivisionMap((prev) => ({ ...prev, [t.id]: e.target.value }))} placeholder="Division" style={{ width: 110, padding: "6px 8px", borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12 }} />
                </div>
              ))}
            </div>
          )}
          {(() => {
            const divs = divisionsPreview();
            const low = divs.filter((d) => d.teamIds.length > 0 && d.teamIds.length < 2);
            return (
              <div style={{ marginTop: 12, fontSize: 12, color: T.muted }}>
                {divs.filter((d) => d.teamIds.length > 0).map((d) => <div key={d.name}>{d.name}: {d.teamIds.length} ทีม</div>)}
                {low.length > 0 && <div style={{ color: T.accent, marginTop: 4 }}>⚠️ บาง Division มีทีมน้อยเกินไป (ต้องอย่างน้อย 2 ทีม)</div>}
              </div>
            );
          })()}
        </div>
      )}

      {step === 5 && (
        <div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
            {[["random", "Random"], ["skill", "Skill Based"], ["manual", "Manual"], ["advanced", "Advanced"]].map(([v, l]) => (
              <button key={v} onClick={() => { setSeedMode(v); if (v === "manual") setManualOrder(seedBySkill(teams, peopleById).map((t) => t.id)); }} style={{ padding: "9px 13px", borderRadius: 10, fontSize: 12.5, fontWeight: 800, border: `1.5px solid ${seedMode === v ? T.green : T.border}`, background: seedMode === v ? "#e2f5ec" : T.surface, color: seedMode === v ? T.green : T.text }}>{l}</button>
            ))}
          </div>
          {seedMode === "advanced" && (
            <Seg options={[["skill", "Skill Seed"], ["performance", "Performance"], ["hybrid", "Hybrid"]]} value={advSeedKind} onChange={setAdvSeedKind} />
          )}
          {seedMode === "manual" && (
            <div style={{ marginTop: 10 }}>
              {manualOrder.map((id, i) => {
                const t = teams.find((x) => x.id === id); if (!t) return null;
                return (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", background: T.surface2, borderRadius: 9, marginBottom: 5, fontSize: 12.5 }}>
                    <span style={{ fontWeight: 800, width: 22 }}>#{i + 1}</span>
                    <span style={{ flex: 1 }}>{t.playerIds.map((pid) => peopleById[pid]?.name).join(" + ")}</span>
                    <button disabled={i === 0} onClick={() => setManualOrder((prev) => { const a = [...prev]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return a; })} style={{ background: "none", border: "none", opacity: i === 0 ? 0.3 : 1 }}>▲</button>
                    <button disabled={i === manualOrder.length - 1} onClick={() => setManualOrder((prev) => { const a = [...prev]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; return a; })} style={{ background: "none", border: "none", opacity: i === manualOrder.length - 1 ? 0.3 : 1 }}>▼</button>
                  </div>
                );
              })}
            </div>
          )}
          {format === "group" && (
            <div style={{ marginTop: 14 }}>
              <Label>จำนวน Group</Label>
              <Stepper value={groupCount} setValue={setGroupCount} min={2} max={8} />
              <div style={{ height: 8 }} />
              <Label>เข้ารอบต่อ Group (Top N)</Label>
              <Stepper value={qualifyTopN} setValue={setQualifyTopN} min={1} max={4} />
            </div>
          )}
          {format === "swiss" && (
            <div style={{ marginTop: 14 }}>
              <Label>จำนวน Rounds</Label>
              <Stepper value={swissRounds} setValue={setSwissRounds} min={2} max={9} />
            </div>
          )}
          {format === "league" && (
            <div style={{ marginTop: 14 }}>
              <Label>รอบการแข่งขัน</Label>
              <Seg options={[[false, "Single Round Robin"], [true, "Double Round Robin"]]} value={doubleRound} onChange={setDoubleRound} />
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            <Label>Handicap</Label>
            <Seg options={[["off", "ปิด"], ["manual", "กำหนดเอง"], ["skill", "ตาม Skill (คำแนะนำ)"]]} value={handicapMode} onChange={setHandicapMode} />
          </div>
        </div>
      )}

      {step === 6 && (() => {
        const divs = divisionsPreview().filter((d) => d.teamIds.length >= 2);
        const estTotal = estimateMatches(divs);
        // v1.11.2: preview WHO actually lands together, not just headcounts — organizers previously had
        // to hit "เริ่มการแข่งขัน" blind to see the real Division/Group lineup. assignGroups() is fully
        // deterministic (sorts by seed, snake-distributes — see its definition), so calling it here for
        // display only, with the exact same clamp create() uses, is side-effect-free and always matches
        // what create() will actually produce.
        const previewBlocks = divs.map((d) => {
          const divTeams = applySeed(teams.filter((t) => d.teamIds.includes(t.id)));
          let groupsPreview = null;
          if (format === "group") {
            const gc = Math.min(groupCount, Math.max(1, Math.floor(divTeams.length / 2)));
            groupsPreview = assignGroups(divTeams, gc);
          }
          return { division: d, divTeams, groupsPreview };
        });
        return (
          <div>
            <div style={{ background: T.surface2, borderRadius: 12, padding: 12, marginBottom: 12, fontSize: 12.5, lineHeight: 1.9 }}>
              <div><b>{name || "Tournament"}</b> · {fmtThaiDate(date)}</div>
              <div>รูปแบบ: {format} · {matchMode === "doubles" ? "ตีคู่" : "ตีเดี่ยว"} · {courtCount} สนาม</div>
              <div>ผู้เข้าร่วม: {teams.reduce((s, t) => s + t.playerIds.length, 0)} คน · {teams.length} ทีม</div>
              <div>Division: {divs.map((d) => `${d.name}(${d.teamIds.length})`).join(", ") || "-"}</div>
              <div>Seed: {seedMode}{seedMode === "advanced" ? ` (${advSeedKind})` : ""}</div>
              <div>จำนวนแมตช์โดยประมาณ: {estTotal}</div>
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {previewBlocks.map(({ division: d, divTeams, groupsPreview }) => (
                <div key={d.name} style={{ marginBottom: 12 }}>
                  {divs.length > 1 && <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 5 }}>{d.name}</div>}
                  {groupsPreview ? (
                    groupsPreview.map((g) => (
                      <div key={g.id} style={{ background: T.surface2, borderRadius: 10, padding: "8px 10px", marginBottom: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: T.muted, marginBottom: 4 }}>Group {g.name}</div>
                        {g.teamIds.map((tid) => {
                          const t = divTeams.find((x) => x.id === tid); if (!t) return null;
                          return <div key={tid} style={{ fontSize: 12, padding: "2px 0" }}>{t.playerIds.map((id) => peopleById[id]?.name).join(" + ")} <span style={{ color: T.muted }}>· ความแข็งทีม {teamStrength(t, peopleById)}</span></div>;
                        })}
                      </div>
                    ))
                  ) : (
                    divTeams.map((t) => <div key={t.id} style={{ fontSize: 12, color: T.muted, padding: "3px 0" }}>{t.playerIds.map((id) => peopleById[id]?.name).join(" + ")} · ความแข็งทีม {teamStrength(t, peopleById)}</div>)
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {step > 1 && <button onClick={() => setStep((s) => s - 1)} style={btnSecondary}>ย้อนกลับ</button>}
        {step < 6 && step !== 2 && <button disabled={step === 1 ? !canNext1 : step === 3 ? !canNext3 : false} onClick={() => setStep((s) => s + 1)} style={{ ...btnPrimary, opacity: (step === 1 && !canNext1) || (step === 3 && !canNext3) ? 0.5 : 1 }}>ถัดไป</button>}
        {step === 2 && <button disabled={!canNext2} onClick={goStep3} style={{ ...btnPrimary, opacity: canNext2 ? 1 : 0.5 }}>ถัดไป</button>}
        {step === 6 && <button onClick={create} style={{ ...btnPrimary, background: T.accent }}><Play size={15} /> เริ่มการแข่งขัน</button>}
      </div>
      {/* v1.11.2: save-and-resume-later — real tournament setup often spans multiple days (see saveDraft
          above); available at every step so an organizer can bank whatever they've entered so far. */}
      <button onClick={saveDraft} style={{ width: "100%", marginTop: 8, padding: "9px 0", borderRadius: 10, background: "none", border: "none", color: T.muted, fontSize: 12, fontWeight: 700 }}>
        💾 บันทึกไว้ก่อน (ทำต่อทีหลัง)
      </button>
    </Overlay>
  );
}

function tTeamName(team, peopleById) { return (team?.playerIds || []).map((id) => peopleById[id]?.name || "?").join(" + "); }
function tMatchLabel(m, teamsById, peopleById) {
  const a = m.teamAId ? tTeamName(teamsById[m.teamAId], peopleById) : (m.status === "bye" ? "-" : "รอทีม");
  const b = m.teamBId ? tTeamName(teamsById[m.teamBId], peopleById) : (m.status === "bye" ? "BYE" : "รอทีม");
  return { a, b };
}
// v1.11.2: round-1 knockout matches born from a Group Stage carry their group-of-origin (see
// tGenerateGroupKnockout, which stamps groupId/groupRank onto the real team record) — medal emoji for
// the team's finishing RANK inside its own group (1st="🥇 Group A"), so a match card that hasn't
// finished yet still tells the room "the winner here plays whoever comes out of Group X next".
const GROUP_RANK_MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" };
function groupOriginTag(team, groupNameById) {
  if (!team || team.groupId == null || !groupNameById || !groupNameById[team.groupId]) return null;
  const medal = GROUP_RANK_MEDAL[team.groupRank] || `#${team.groupRank}`;
  return `${medal} Group ${groupNameById[team.groupId]}`;
}
/* ============ v1.11.4: redesigned Knockout Bracket ============
   Two view modes over the SAME bracket data (never a separate/duplicated data source):
   - "round" (default, mobile-first): a round selector + one round's match cards at a time.
   - "full": a horizontally-scrollable, visually-connected bracket (all rounds side by side).
   Both recompute each round's label fresh from its actual team count (roundLabelFor) instead of
   trusting the round's stored `label` string, so brackets generated before the v1.11.4 label fix
   (which mislabeled 16/32-team rounds) display correctly too, with zero data migration needed.
   Per spec: no trophy beside every match winner — the trophy is reserved for the champion banner. */
function bracketRoundsWithFixedLabels(bracket) {
  return (bracket.rounds || []).map((r) => ({ ...r, label: roundLabelFor(r.matchIds.length * 2) }));
}
function BracketMatchCard({ m, teamsById, peopleById, tagA, tagB, compact }) {
  const lbl = tMatchLabel(m, teamsById, peopleById);
  return (
    <div style={{ background: m.status === "playing" ? "#e2f5ec" : T.surface, border: `1px solid ${m.status === "playing" ? T.green : T.border}`, borderRadius: 10, padding: compact ? "7px 9px" : "8px 10px", fontSize: compact ? 11.5 : 12.5, height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontWeight: m.winnerTeamId === m.teamAId ? 800 : 500, color: m.winnerTeamId === m.teamAId ? T.green : T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tagA && <span style={{ fontSize: 10.5, color: T.muted, fontWeight: 700 }}>{tagA} · </span>}{lbl.a}</div>
      <div style={{ fontWeight: m.winnerTeamId === m.teamBId ? 800 : 500, color: m.winnerTeamId === m.teamBId ? T.green : T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tagB && <span style={{ fontSize: 10.5, color: T.muted, fontWeight: 700 }}>{tagB} · </span>}{lbl.b}</div>
      {!compact && matchScoreText(m) && <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>{matchScoreText(m)}</div>}
      {m.status === "bye" && <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>BYE — ไม่นับเป็นแมตช์</div>}
    </div>
  );
}
// mobile default: round-selector chips + one round's match cards, stacked vertically.
function BracketRoundByRound({ rounds, bracket, teamsById, peopleById, groupNameById, defaultIdx }) {
  const [idx, setIdx] = useState(Math.min(defaultIdx, rounds.length - 1));
  const r = rounds[idx];
  return (
    <div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 8, WebkitOverflowScrolling: "touch" }}>
        {rounds.map((rr, i) => (
          <button key={rr.index} onClick={() => setIdx(i)} style={{ flexShrink: 0, padding: "7px 12px", borderRadius: 9, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", border: `1.5px solid ${idx === i ? T.green : T.border}`, background: idx === i ? "#e2f5ec" : T.surface, color: idx === i ? T.green : T.muted }}>{rr.label}</button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {r.matchIds.map((mid) => {
          const m = bracket.matches.find((x) => x.id === mid);
          if (!m) return null;
          const tagA = r.index === 0 ? groupOriginTag(teamsById[m.teamAId], groupNameById) : null;
          const tagB = r.index === 0 ? groupOriginTag(teamsById[m.teamBId], groupNameById) : null;
          return <BracketMatchCard key={mid} m={m} teamsById={teamsById} peopleById={peopleById} tagA={tagA} tagB={tagB} />;
        })}
      </div>
    </div>
  );
}
// "เต็มสาย" — full connected bracket, horizontal scroll, one column per round. Uses the classic
// flexbox `space-around` bracket technique: every column stretches to the same height and evenly
// distributes its matches within it, which places each match's vertical center at exactly the
// average of its two children's centers in the previous round — so simple CSS connector lines
// (drawn via the scoped .bqbk-* rules below) line up correctly with no manual pixel math.
function BracketFull({ rounds, bracket, teamsById, peopleById, groupNameById }) {
  const CARD_H = 52;
  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", marginBottom: 4 }}>
      <style>{`
        .bqbk-row { display:flex; align-items:stretch; gap:26px; min-width:max-content; padding:4px 2px 10px; }
        .bqbk-col { display:flex; flex-direction:column; justify-content:space-around; gap:10px; width:132px; flex-shrink:0; }
        .bqbk-match { position:relative; }
        .bqbk-col:not(:last-child) .bqbk-match::after { content:''; position:absolute; right:-14px; width:14px; border-right:2px solid #cbd5c9; }
        .bqbk-col:not(:last-child) .bqbk-match:nth-child(odd)::after { top:50%; height:calc(50% + 5px); border-top:2px solid #cbd5c9; border-top-right-radius:6px; }
        .bqbk-col:not(:last-child) .bqbk-match:nth-child(even)::after { bottom:50%; height:calc(50% + 5px); border-bottom:2px solid #cbd5c9; border-bottom-right-radius:6px; }
        .bqbk-col:not(:first-child) .bqbk-match::before { content:''; position:absolute; left:-14px; top:50%; width:14px; height:2px; background:#cbd5c9; }
      `}</style>
      <div className="bqbk-row">
        {rounds.map((r) => (
          <div key={r.index} className="bqbk-col">
            <div style={{ fontSize: 11, fontWeight: 800, color: T.muted, textAlign: "center", marginBottom: 2 }}>{r.label}</div>
            {r.matchIds.map((mid) => {
              const m = bracket.matches.find((x) => x.id === mid);
              if (!m) return null;
              const tagA = r.index === 0 ? groupOriginTag(teamsById[m.teamAId], groupNameById) : null;
              const tagB = r.index === 0 ? groupOriginTag(teamsById[m.teamBId], groupNameById) : null;
              return (
                <div key={mid} className="bqbk-match" style={{ minHeight: CARD_H }}>
                  <BracketMatchCard m={m} teamsById={teamsById} peopleById={peopleById} tagA={tagA} tagB={tagB} compact />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
// entry point: toggle between the two views above, plus the champion banner (only when decided).
function TournamentBracket({ bracket, teamsById, peopleById, champion, groupNameById }) {
  const [mode, setMode] = useState("round");
  const rounds = bracketRoundsWithFixedLabels(bracket);
  // default round shown = the earliest one that isn't fully decided yet (the "current" round for an
  // in-progress tournament); once everything is decided (completed tournament) that's simply the final.
  const firstIncompleteIdx = rounds.findIndex((r) => r.matchIds.some((mid) => { const m = bracket.matches.find((x) => x.id === mid); return m && m.status !== "completed" && m.status !== "bye"; }));
  const defaultIdx = firstIncompleteIdx === -1 ? rounds.length - 1 : firstIncompleteIdx;
  return (
    <div>
      {rounds.length > 1 && <div style={{ marginBottom: 10 }}><Seg options={[["round", "ทีละรอบ"], ["full", "เต็มสาย"]]} value={mode} onChange={setMode} /></div>}
      {mode === "round" || rounds.length <= 1
        ? <BracketRoundByRound rounds={rounds} bracket={bracket} teamsById={teamsById} peopleById={peopleById} groupNameById={groupNameById} defaultIdx={defaultIdx} />
        : <BracketFull rounds={rounds} bracket={bracket} teamsById={teamsById} peopleById={peopleById} groupNameById={groupNameById} />}
      {champion && <div style={{ textAlign: "center", padding: 14, background: "#fff7e6", borderRadius: 12, marginTop: 10 }}><div style={{ fontSize: 22 }}>🏆</div><div style={{ fontWeight: 800, fontSize: 13.5 }}>{tTeamName(teamsById[champion], peopleById)}</div></div>}
    </div>
  );
}
// vertical, round-by-round bracket — deliberately NOT a traditional wide horizontal bracket (canvas-style
// brackets are hard to use on iPhone); each round just stacks as its own labeled group of match cards.
// v1.11.4: superseded by TournamentBracket (above) on the redesigned Summary page — kept here as-is
// since the LIVE in-progress Tournament dashboard's own Bracket/Standings tab still renders through it.
function BracketView({ bracket, teamsById, peopleById, champion, groupNameById }) {
  return (
    <div>
      {bracket.rounds.map((r) => (
        <div key={r.index} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.muted, marginBottom: 6 }}>{r.label}</div>
          {r.matchIds.map((mid) => {
            const m = bracket.matches.find((x) => x.id === mid);
            if (!m) return null;
            const lbl = tMatchLabel(m, teamsById, peopleById);
            const tagA = r.index === 0 ? groupOriginTag(teamsById[m.teamAId], groupNameById) : null;
            const tagB = r.index === 0 ? groupOriginTag(teamsById[m.teamBId], groupNameById) : null;
            return (
              <div key={mid} style={{ background: m.status === "playing" ? "#e2f5ec" : T.surface, border: `1px solid ${m.status === "playing" ? T.green : T.border}`, borderRadius: 10, padding: "8px 10px", marginBottom: 6, fontSize: 12.5 }}>
                <div style={{ fontWeight: m.winnerTeamId === m.teamAId ? 800 : 500, color: m.winnerTeamId === m.teamAId ? T.green : T.text }}>{tagA && <span style={{ fontSize: 11, color: T.muted, fontWeight: 700 }}>{tagA} · </span>}{lbl.a}{m.winnerTeamId === m.teamAId ? " 🏆" : ""}</div>
                <div style={{ fontWeight: m.winnerTeamId === m.teamBId ? 800 : 500, color: m.winnerTeamId === m.teamBId ? T.green : T.text }}>{tagB && <span style={{ fontSize: 11, color: T.muted, fontWeight: 700 }}>{tagB} · </span>}{lbl.b}{m.winnerTeamId === m.teamBId ? " 🏆" : ""}</div>
                {matchScoreText(m) && <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>{matchScoreText(m)}</div>}
                {m.status === "bye" && <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>BYE — ไม่นับเป็นแมตช์</div>}
              </div>
            );
          })}
        </div>
      ))}
      {champion && <div style={{ textAlign: "center", padding: 14, background: "#fff7e6", borderRadius: 12, marginTop: 6 }}><div style={{ fontSize: 22 }}>🏆</div><div style={{ fontWeight: 800, fontSize: 13.5 }}>{tTeamName(teamsById[champion], peopleById)}</div></div>}
    </div>
  );
}
// v1.11.4: same standings math as StandingsTable, but (a) drops the D column — draws are structurally
// impossible in this app's completed-match flow (a match can't be finished without a definite winner,
// see matchWinner()/the "จบแมตช์" button's disabled guard), so a D column would only ever show zeros —
// and (b) optionally highlights the qualification cutoff (top `qualifyCount` rows) when this group's
// teams actually carry a stamped groupRank from a real group->knockout promotion (tGenerateGroupKnockout).
// Kept as a separate component from StandingsTable (which stays untouched — still used during live play).
function StandingsTableNoD({ teams, matches, pointsConfig, peopleById, qualifyCount = 0 }) {
  const standings = computeStandings(teams.filter(Boolean), matches, pointsConfig);
  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
          <thead><tr style={{ color: T.muted, textAlign: "left" }}>
            <th style={{ padding: "5px 6px" }}>ทีม</th><th style={{ padding: "5px 4px", textAlign: "center" }}>P</th><th style={{ padding: "5px 4px", textAlign: "center" }}>W</th><th style={{ padding: "5px 4px", textAlign: "center" }}>L</th><th style={{ padding: "5px 4px", textAlign: "center" }}>Pts</th><th style={{ padding: "5px 4px", textAlign: "center" }}>+/-</th>
          </tr></thead>
          <tbody>
            {standings.map((row, i) => {
              const team = teams.find((tm) => tm && tm.id === row.teamId);
              const qualifies = qualifyCount > 0 && i < qualifyCount;
              const isCutoff = qualifyCount > 0 && i === qualifyCount - 1 && i < standings.length - 1;
              return (
                <tr key={row.teamId} style={{ borderTop: `1px solid ${T.border}`, borderBottom: isCutoff ? `2px dashed ${T.green}` : undefined, background: qualifies ? "#eafbf3" : "transparent" }}>
                  <td style={{ padding: "6px" }}>{i + 1}. {team ? tTeamName(team, peopleById) : "-"}</td>
                  <td style={{ textAlign: "center" }}>{row.played}</td><td style={{ textAlign: "center" }}>{row.win}</td><td style={{ textAlign: "center" }}>{row.loss}</td>
                  <td style={{ textAlign: "center", fontWeight: 800 }}>{row.points}</td><td style={{ textAlign: "center" }}>{row.diff > 0 ? "+" : ""}{row.diff}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {qualifyCount > 0 && <div style={{ fontSize: 10.5, color: T.green, fontWeight: 700, marginTop: 6 }}>อันดับ 1-{qualifyCount} ผ่านเข้ารอบ Knockout</div>}
    </div>
  );
}
// v1.11.4: tab-per-group Standings — shows one group at a time instead of every group fully expanded
// (previously the biggest source of a long Summary page for group-stage tournaments). A single-group
// tournament skips the chip row entirely and just shows that one group's table directly.
function GroupStandingsTabs({ groups, teamsById, peopleById, pointsConfig }) {
  const [gi, setGi] = useState(0);
  if (!groups || !groups.length) return null;
  const g = groups[Math.min(gi, groups.length - 1)];
  const groupTeams = g.teamIds.map((id) => teamsById[id]).filter(Boolean);
  const qualifyCount = groupTeams.filter((tm) => tm && tm.groupRank != null).length;
  return (
    <div style={{ marginBottom: 14 }}>
      {groups.length > 1 && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 8, WebkitOverflowScrolling: "touch" }}>
          {groups.map((gg, i) => (
            <button key={gg.id} onClick={() => setGi(i)} style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 9, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", border: `1.5px solid ${gi === i ? T.green : T.border}`, background: gi === i ? "#e2f5ec" : T.surface, color: gi === i ? T.green : T.muted }}>Group {gg.name}</button>
          ))}
        </div>
      )}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 10 }}>
        {groups.length === 1 && <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 6 }}>Group {g.name}</div>}
        <StandingsTableNoD teams={groupTeams} matches={g.matches} pointsConfig={pointsConfig} peopleById={peopleById} qualifyCount={qualifyCount} />
      </div>
    </div>
  );
}
// compact standings table (P/W/D/L/Pts/+-); scrolls horizontally inside itself on very narrow screens
// rather than forcing the whole page wide.
function StandingsTable({ teams, matches, pointsConfig, peopleById }) {
  const standings = computeStandings(teams.filter(Boolean), matches, pointsConfig);
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
        <thead><tr style={{ color: T.muted, textAlign: "left" }}>
          <th style={{ padding: "5px 6px" }}>ทีม</th><th style={{ padding: "5px 4px", textAlign: "center" }}>P</th><th style={{ padding: "5px 4px", textAlign: "center" }}>W</th><th style={{ padding: "5px 4px", textAlign: "center" }}>D</th><th style={{ padding: "5px 4px", textAlign: "center" }}>L</th><th style={{ padding: "5px 4px", textAlign: "center" }}>Pts</th><th style={{ padding: "5px 4px", textAlign: "center" }}>+/-</th>
        </tr></thead>
        <tbody>
          {standings.map((row, i) => {
            const team = teams.find((tm) => tm && tm.id === row.teamId);
            return (
              <tr key={row.teamId} style={{ borderTop: `1px solid ${T.border}` }}>
                <td style={{ padding: "6px" }}>{i + 1}. {team ? tTeamName(team, peopleById) : "-"}</td>
                <td style={{ textAlign: "center" }}>{row.played}</td><td style={{ textAlign: "center" }}>{row.win}</td><td style={{ textAlign: "center" }}>{row.draw}</td><td style={{ textAlign: "center" }}>{row.loss}</td>
                <td style={{ textAlign: "center", fontWeight: 800 }}>{row.points}</td><td style={{ textAlign: "center" }}>{row.diff > 0 ? "+" : ""}{row.diff}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TournamentDashboard(props) {
  const { activeTournament: t, playersById, settings, tStartMatch, tSetCourtLabel, tSetCourtCount, tSetScore, tSetWin, tClearScore, tFinishMatch, tEditAffectsDownstream, tUndoMatch, tPauseTournament, tResumeTournament, tGenerateGroupKnockout, tGenerateSwissNextRound, tCompleteTournament, tUpdateProfile, tSetRegistrationConfig, tToggleTeamPaid, tAddFinanceEntry, tRemoveFinanceEntry, openTournamentLogo, onOpenTournamentPrint } = props;
  const [view, setView] = useState("courts");
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [editingMatch, setEditingMatch] = useState(null);
  const [pendingCascade, setPendingCascade] = useState(null);
  const [editCourtLabels, setEditCourtLabels] = useState(false); // "แก้ไขเลขสนาม" — start sequential 1..N, renumber later to match the venue's actual court numbers
  const [showProfileEditor, setShowProfileEditor] = useState(false); // section 1: edit name/venue/description/logo after creation
  const [showFinance, setShowFinance] = useState(false); // sections 14-17: registration fee/payment + tournament finance — one drill-down overlay, kept off the main dashboard

  const teamsById = Object.fromEntries(t.teams.map((tm) => [tm.id, tm]));
  const peopleById = { ...playersById, ...Object.fromEntries((t.guestPlayers || []).map((g) => [g.id, g])) };
  // v1.11.2: group-id -> "A"/"B"/... across EVERY division's groups, for the 🥇/🥈 group-origin tags on
  // round-1 knockout matches (see groupOriginTag/tGenerateGroupKnockout) — group ids are uid()-generated
  // so merging across divisions can't collide.
  const groupNameById = Object.fromEntries(t.divisions.flatMap((d) => (d.groups || []).map((g) => [g.id, g.name])));
  const matchGroupTags = (m) => (m && m.roundIndex === 0 ? { a: groupOriginTag(teamsById[m.teamAId], groupNameById), b: groupOriginTag(teamsById[m.teamBId], groupNameById) } : { a: null, b: null });
  const allMatches = tournamentAllMatches(t);
  const { done, total } = totalTournamentMatchCount(t);
  const playing = allMatches.filter((m) => m.status === "playing");
  const readyList = allMatches.filter((m) => m.status === "ready");
  const busyCourts = new Set(playing.map((m) => m.court));
  const emptyCourts = []; for (let c = 1; c <= t.courtCount; c++) if (!busyCourts.has(c)) emptyCourts.push(c);
  const suggested = suggestNextTMatch(t);
  const regProgress = registrationProgress(t);
  const finTotals = tournamentFinanceTotals(t);
  // v1.11.4: same report builder used by History/Share/PDF — reused here (not reimplemented) so a
  // live, in-progress tournament's Podium/Bracket/Share/PDF always match the completed-tournament view
  // exactly. computeDivisionPodium never fabricates a champion before the final is decided, so this is
  // safe to render even while matches are still in progress.
  const report = buildTournamentResultReport(t, peopleById);

  return (
    <div>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {t.logo && <img src={t.logo} alt="" style={{ width: 32, height: 32, borderRadius: 9, objectFit: "cover", flexShrink: 0 }} />}
          <div style={{ fontWeight: 800, fontSize: 15.5, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🏆 {t.name}</div>
          <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: 11, fontWeight: 800, color: t.status === "paused" ? T.accent : T.green, background: t.status === "paused" ? "#fdecea" : "#e2f5ec", padding: "3px 9px", borderRadius: 20 }}>{t.status === "paused" ? "พักการแข่งขัน" : "กำลังแข่งขัน"}</span>
          <button onClick={() => setShowProfileEditor(true)} title="แก้ไขข้อมูลรายการ" style={{ flexShrink: 0, background: "none", border: "none", color: T.muted, padding: 2 }}>✎</button>
        </div>
        {(t.venue || t.description) && (
          <div style={{ fontSize: 11.5, color: T.muted, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {t.venue}{t.venue && t.description ? " · " : ""}{t.description}
          </div>
        )}
        <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{t.format} · {t.courtCount} สนาม · {done} / {total} แมตช์</div>
        <div style={{ height: 6, background: T.surface2, borderRadius: 4, marginTop: 8, overflow: "hidden" }}><div style={{ height: "100%", width: `${total ? (done / total) * 100 : 0}%`, background: T.green }} /></div>
        <button onClick={() => setShowFinance(true)} style={{ width: "100%", marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 12, fontWeight: 700 }}>
          <span>💰 ค่าสมัครและการเงิน</span>
          <span style={{ color: T.muted, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            {t.registration.feeMode !== "none" && <span>ชำระแล้ว {regProgress.paid}/{regProgress.total}</span>}
            <span style={{ color: finTotals.profit >= 0 ? T.green : T.accent }}>{finTotals.profit >= 0 ? "กำไร" : "ขาดทุน"} ฿{Math.abs(finTotals.profit).toLocaleString()}</span>
            <ChevronRight size={15} />
          </span>
        </button>
      </div>
      {showProfileEditor && <TournamentProfileEditor t={t} onSave={(patch) => { tUpdateProfile(patch); setShowProfileEditor(false); }} onOpenLogoPicker={openTournamentLogo} onClose={() => setShowProfileEditor(false)} />}
      {showFinance && <TournamentFinancePanel t={t} teamsById={teamsById} peopleById={peopleById} tSetRegistrationConfig={tSetRegistrationConfig} tToggleTeamPaid={tToggleTeamPaid} tAddFinanceEntry={tAddFinanceEntry} tRemoveFinanceEntry={tRemoveFinanceEntry} onClose={() => setShowFinance(false)} />}

      <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto" }}>
        {[["courts", "สนาม"], ["bracket", "Bracket/Standings"], ["teams", "ทีม"], ["results", "ผล"]].map(([v, l]) => (
          <button key={v} onClick={() => setView(v)} style={{ flex: "none", padding: "8px 13px", borderRadius: 10, fontSize: 12.5, fontWeight: 800, border: `1.5px solid ${view === v ? T.green : T.border}`, background: view === v ? "#e2f5ec" : T.surface, color: view === v ? T.green : T.muted }}>{l}</button>
        ))}
      </div>

      {view === "courts" && (
        <div>
          <button onClick={() => setEditCourtLabels((v) => !v)} style={{ width: "100%", textAlign: "left", padding: "8px 11px", borderRadius: 10, background: T.surface, border: `1px solid ${T.border}`, color: T.muted, fontSize: 12, fontWeight: 700, marginBottom: editCourtLabels ? 6 : 10, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12 }}>🔢</span> แก้ไขจำนวน/เลขสนาม<ChevronDown size={14} style={{ marginLeft: "auto", transform: editCourtLabels ? "rotate(180deg)" : "none" }} />
          </button>
          {editCourtLabels && (
            <div style={{ marginBottom: 10, padding: "10px 11px", borderRadius: 10, background: T.surface, border: `1px solid ${T.border}` }}>
              {/* v1.11.2: จำนวนสนาม can be edited after the tournament has started — real venues gain/lose
                  courts mid-event. tSetCourtCount blocks shrinking below whatever court a match is
                  CURRENTLY playing on, so an in-progress game is never orphaned. */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: T.muted, fontWeight: 700 }}>จำนวนสนาม</span>
                <Stepper value={t.courtCount} setValue={tSetCourtCount} min={Math.max(1, ...[...busyCourts, 0])} max={24} />
              </div>
              {[...busyCourts].length > 0 && Math.max(...busyCourts) >= t.courtCount && (
                <div style={{ fontSize: 10.5, color: T.accent, marginBottom: 8 }}>ลดสนามไม่ได้ต่ำกว่าสนามที่กำลังแข่งอยู่</div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {Array.from({ length: t.courtCount }, (_, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 11, color: T.muted, fontWeight: 700 }}>สนามที่ {i + 1}:</span>
                  <input
                    value={(t.courtLabels && t.courtLabels[i]) ?? ""}
                    onChange={(e) => tSetCourtLabel(i, e.target.value)}
                    onBlur={() => { if (!String((t.courtLabels && t.courtLabels[i]) ?? "").trim()) tSetCourtLabel(i, String(i + 1)); }}
                    style={{ width: 46, padding: "6px 7px", borderRadius: 8, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 13, fontWeight: 700, textAlign: "center" }}
                  />
                </div>
              ))}
              </div>
            </div>
          )}
          {playing.map((m) => (
            <div key={m.id} style={{ background: T.surface, border: `1px solid ${T.green}`, borderRadius: 14, padding: 11, marginBottom: 9 }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontWeight: 800, fontSize: 15 }}>สนาม {courtLabelFor(t.courtLabels, m.court)}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, color: T.green, background: "#e2f5ec", padding: "3px 9px", borderRadius: 20 }}>🔴 กำลังแข่งขัน</span>
              </div>
              {(() => { const tags = matchGroupTags(m); return (tags.a || tags.b) && (
                <div style={{ fontSize: 11, color: T.muted, fontWeight: 700, marginBottom: 2 }}>{tags.a || "?"} <span style={{ fontWeight: 400 }}>vs</span> {tags.b || "?"}</div>
              ); })()}
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{tMatchLabel(m, teamsById, peopleById).a} <span style={{ color: T.muted, fontWeight: 400 }}>vs</span> {tMatchLabel(m, teamsById, peopleById).b}</div>
              <ScoreEditor m={m} rounds={settings.rounds || 1} setScore={tSetScore} setWin={tSetWin} clearScore={tClearScore} />
              <button onClick={() => tFinishMatch(m.id)} disabled={!hasScore(m) || !matchWinner(m)} style={{ ...btnPrimary, marginTop: 8, opacity: (!hasScore(m) || !matchWinner(m)) ? 0.5 : 1 }}><Check size={16} /> จบแมตช์</button>
            </div>
          ))}
          {emptyCourts.map((c) => (
            <div key={c} style={{ background: T.surface2, border: `1px dashed ${T.border}`, borderRadius: 14, padding: 11, marginBottom: 9 }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>สนาม {courtLabelFor(t.courtLabels, c)} — ว่าง</div>
              {suggested ? (
                <div>
                  {(() => { const tags = matchGroupTags(suggested); return (tags.a || tags.b) && (
                    <div style={{ fontSize: 10.5, color: T.muted, fontWeight: 700, marginBottom: 2 }}>{tags.a || "?"} <span style={{ fontWeight: 400 }}>vs</span> {tags.b || "?"}</div>
                  ); })()}
                  <div style={{ fontSize: 12.5, marginBottom: 8 }}>{tMatchLabel(suggested, teamsById, peopleById).a} vs {tMatchLabel(suggested, teamsById, peopleById).b}</div>
                  <button onClick={() => tStartMatch(suggested.id, c)} style={btnPrimary}><Play size={15} /> เริ่มที่สนามนี้</button>
                </div>
              ) : <div style={{ fontSize: 12, color: T.muted }}>ยังไม่มีแมตช์พร้อมเล่น</div>}
            </div>
          ))}
          {readyList.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <SectionHead icon={<ClipboardList size={16} color={T.muted} />} title="พร้อมแข่ง" sub={`${readyList.length} แมตช์`} />
              {readyList.map((m) => { const tags = matchGroupTags(m); return (
                <div key={m.id} style={{ display: "flex", alignItems: "center", padding: "8px 10px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 6, fontSize: 12.5 }}>
                  <span>{(tags.a || tags.b) ? <span style={{ fontSize: 10.5, color: T.muted, fontWeight: 700 }}>{tags.a || "?"} vs {tags.b || "?"} · </span> : null}{tMatchLabel(m, teamsById, peopleById).a} vs {tMatchLabel(m, teamsById, peopleById).b}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: T.muted }}>{m.roundLabel}</span>
                </div>
              ); })}
            </div>
          )}
          {playing.length === 0 && emptyCourts.length === 0 && readyList.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: 30 }}>ไม่มีแมตช์เหลืออยู่</div>}
        </div>
      )}

      {view === "bracket" && (
        <div>
          {t.divisions.map((d) => {
            const rd = report.divisions.find((x) => x.id === d.id) || { podium: { champion: null, runnerUp: null, thirdIds: [] } };
            return (
            <div key={d.id} style={{ marginBottom: 20 }}>
              {t.divisions.length > 1 && <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 8 }}>{d.name}</div>}
              {/* v1.11.4: Podium/Bracket redesign wired into the LIVE dashboard too (not just the
                  completed-tournament History view) — same components, same computeDivisionPodium, so
                  an in-progress tournament shows the "เส้นทางสู่แชมป์" placeholder (never a fake
                  champion) and a decided final flips it to the real podium automatically. */}
              {d.bracket && <TournamentPodium podium={rd.podium} teamsById={teamsById} peopleById={peopleById} />}
              {d.bracket && <TournamentBracket bracket={d.bracket} teamsById={teamsById} peopleById={peopleById} champion={rd.podium.champion} groupNameById={groupNameById} />}
              {d.groups && d.groups.length > 0 && (
                <div>
                  <GroupStandingsTabs groups={d.groups} teamsById={teamsById} peopleById={peopleById} pointsConfig={t.pointsConfig} />
                  {!d.bracket && d.groups.every((g) => g.matches.every((m) => m.status === "completed" || m.status === "bye")) && (
                    <button onClick={() => tGenerateGroupKnockout(d.id, t.qualifyTopN || 2)} style={{ ...btnPrimary, marginTop: 6 }}>สร้าง Knockout รอบต่อไป</button>
                  )}
                </div>
              )}
              {!d.bracket && (!d.groups || !d.groups.length) && d.swissMatches && d.swissMatches.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>Swiss รอบ {d.swissRound + 1} / {d.swissRounds}</div>
                  <StandingsTableNoD teams={d.teamIds.map((id) => teamsById[id])} matches={d.swissMatches} pointsConfig={t.pointsConfig} peopleById={peopleById} />
                  {d.swissMatches.filter((m) => m.roundIndex === d.swissRound).every((m) => m.status === "completed" || m.status === "bye") && d.swissRound + 1 < (d.swissRounds || 1) && (
                    <button onClick={() => tGenerateSwissNextRound(d.id)} style={{ ...btnPrimary, marginTop: 8 }}>จับคู่รอบถัดไป</button>
                  )}
                </div>
              )}
              {!d.bracket && (!d.groups || !d.groups.length) && (!d.swissMatches || !d.swissMatches.length) && d.matches && d.matches.length > 0 && (
                <StandingsTableNoD teams={d.teamIds.map((id) => teamsById[id])} matches={d.matches} pointsConfig={t.pointsConfig} peopleById={peopleById} />
              )}
            </div>
          );})}
        </div>
      )}

      {view === "teams" && (
        <div>
          {t.divisions.map((d) => (
            <div key={d.id} style={{ marginBottom: 16 }}>
              {t.divisions.length > 1 && <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 8 }}>{d.name}</div>}
              {d.teamIds.map((id) => { const tm = teamsById[id]; if (!tm) return null; return (
                <div key={id} style={{ display: "flex", alignItems: "center", padding: "9px 11px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 6, fontSize: 13 }}>
                  {tm.seed && <span style={{ fontWeight: 800, color: T.muted, marginRight: 8 }}>#{tm.seed}</span>}
                  <span style={{ fontWeight: 700 }}>{tTeamName(tm, peopleById)}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: T.muted }}>ความแข็งทีม {teamStrength(tm, peopleById)}</span>
                </div>
              ); })}
            </div>
          ))}
        </div>
      )}

      {view === "results" && (
        <div>
          {allMatches.filter((m) => m.status === "completed").sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0)).map((m) => (
            <div key={m.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 11, padding: 10, marginBottom: 7 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>{tMatchLabel(m, teamsById, peopleById).a}{m.winnerTeamId === m.teamAId ? " 🏆" : ""} <span style={{ color: T.muted, fontWeight: 400 }}>vs</span> {tMatchLabel(m, teamsById, peopleById).b}{m.winnerTeamId === m.teamBId ? " 🏆" : ""}</div>
              {matchScoreText(m) && <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>{matchScoreText(m)}</div>}
              {editingMatch === m.id ? (
                <div>
                  <ScoreEditor m={m} rounds={settings.rounds || 1} setScore={tSetScore} setWin={tSetWin} clearScore={tClearScore} />
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <button onClick={() => { if (tEditAffectsDownstream(m.id)) setPendingCascade(m.id); else { tUndoMatch(m.id, false); tFinishMatch(m.id); } setEditingMatch(null); }} style={btnPrimary}>บันทึกผลใหม่</button>
                    <button onClick={() => setEditingMatch(null)} style={btnSecondary}>ยกเลิก</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setEditingMatch(m.id)} style={{ background: "none", border: "none", color: T.accent, fontSize: 11.5, fontWeight: 700, marginTop: 4 }}>แก้ไขผล</button>
              )}
            </div>
          ))}
          {allMatches.filter((m) => m.status === "completed").length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: 30 }}>ยังไม่มีผลการแข่งขัน</div>}
          {report.playerStats.length > 0 && <div style={{ marginTop: 16 }}><PlayerPerformanceList playerStats={report.playerStats} peopleById={peopleById} /></div>}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={() => (t.status === "paused" ? tResumeTournament() : tPauseTournament())} style={btnSecondary}>{t.status === "paused" ? "เล่นต่อ" : "พักการแข่งขัน"}</button>
        <button onClick={() => shareSummary(buildTournamentShareText(report, teamsById, peopleById))} style={btnSecondary}><Share2 size={15} /> แชร์</button>
        <button onClick={() => setConfirmComplete(true)} style={{ ...btnPrimary, background: T.accent }}><LogOut size={15} /> จบ Tournament</button>
      </div>
      {/* v1.11.4: Export PDF available on the live dashboard too — same buildTournamentResultReport +
          TournamentPrintView as the completed-tournament History page, so an in-progress event can
          already be exported/printed mid-tournament (partial bracket, no fake podium). */}
      <button onClick={() => onOpenTournamentPrint && onOpenTournamentPrint(report)} style={{ ...btnPrimary, width: "100%", marginTop: 8, background: T.green }}><Download size={15} /> Export PDF</button>
      <button onClick={() => exportTournamentJSON(t, playersById)} style={{ ...btnSecondary, width: "100%", marginTop: 8 }}><Download size={15} /> ส่งออกข้อมูล Tournament (JSON)</button>

      {pendingCascade && (
        <Overlay onClose={() => setPendingCascade(null)}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>ผลการแข่งขันนี้มีผลต่อแมตช์รอบถัดไป</div>
          <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 16 }}>แมตช์รอบถัดไปเริ่มเล่น/จบไปแล้ว หากบันทึกผลใหม่ ระบบจะรีเซ็ตแมตช์รอบถัดไปให้แข่งใหม่</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setPendingCascade(null)} style={btnSecondary}>ยกเลิก</button>
            <button onClick={() => { tUndoMatch(pendingCascade, true); tFinishMatch(pendingCascade); setPendingCascade(null); }} style={{ ...btnPrimary, background: T.accent }}>ยืนยัน</button>
          </div>
        </Overlay>
      )}

      {confirmComplete && (() => {
        let champ = null;
        t.divisions.forEach((d) => {
          if (d.bracket) { const fin = d.bracket.matches.find((m) => !m.nextMatchId && m.status === "completed"); if (fin) champ = fin.winnerTeamId; }
          else { const matches = d.matches?.length ? d.matches : d.swissMatches || []; const st = computeStandings(d.teamIds.map((id) => teamsById[id]), matches, t.pointsConfig); if (st[0]) champ = st[0].teamId; }
        });
        return (
          <Overlay onClose={() => setConfirmComplete(false)}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>จบ Tournament "{t.name}"?</div>
            {champ && <div style={{ fontSize: 13.5, marginBottom: 10 }}>🏆 แชมป์: {tTeamName(teamsById[champ], peopleById)}</div>}
            <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 16 }}>ระบบจะบันทึก Tournament นี้ไว้ในประวัติ</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmComplete(false)} style={btnSecondary}>ยกเลิก</button>
              <button onClick={() => { tCompleteTournament(); setConfirmComplete(false); }} style={{ ...btnPrimary, background: T.accent }}>ยืนยันจบ</button>
            </div>
          </Overlay>
        );
      })()}
    </div>
  );
}

// v1.10.0 (Tournament Profile, section 1): edit name/venue/description/logo AFTER creation. Logo tap
// reuses the app-wide crop/position flow (see openTournamentLogo in App()) — the logo itself saves
// immediately on crop-confirm, independent of this sheet's own "บันทึก" button, exactly like every
// other photo field in the app (player photo, ก๊วน photo, QR). Only the text fields batch into onSave.
function TournamentProfileEditor({ t, onSave, onOpenLogoPicker, onClose }) {
  const [name, setName] = useState(t.name || "");
  const [venue, setVenue] = useState(t.venue || "");
  const [description, setDescription] = useState(t.description || "");
  const canSave = name.trim().length > 0;
  return (
    <Overlay onClose={onClose}>
      <div style={{ fontWeight: 800, fontSize: 15.5, marginBottom: 14 }}>แก้ไขข้อมูลรายการ</div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onOpenLogoPicker} style={{ flexShrink: 0, width: 62, height: 62, borderRadius: 14, background: T.surface2, border: `1px dashed ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: 0 }}>
          {t.logo ? <img src={t.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 20 }}>🏆</span>}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <button onClick={onOpenLogoPicker} style={{ padding: "7px 12px", borderRadius: 9, background: "none", border: `1px solid ${T.border}`, color: T.text, fontSize: 12, fontWeight: 700 }}>{t.logo ? "เปลี่ยนโลโก้" : "เพิ่มโลโก้"}</button>
          <div style={{ fontSize: 10.5, color: T.muted, marginTop: 5 }}>ไม่บังคับ — จะแสดงในหน้าภาพรวม, หัวข้อ และสายแข่ง</div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: T.muted, marginBottom: 5 }}>ชื่อรายการ</div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น BadQ Open 2026" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 14, boxSizing: "border-box" }} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: T.muted, marginBottom: 5 }}>สถานที่จัด</div>
        <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="เช่น สนามแบดมินตัน ABC" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 14, boxSizing: "border-box" }} />
      </div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: T.muted, marginBottom: 5 }}>รายละเอียด (ไม่บังคับ)</div>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="เช่น รุ่นคู่ผสม, จำกัด 16 ทีม" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 13.5, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onClose} style={btnSecondary}>ยกเลิก</button>
        <button onClick={() => canSave && onSave({ name: name.trim(), venue: venue.trim(), description: description.trim() })} disabled={!canSave} style={{ ...btnPrimary, opacity: canSave ? 1 : 0.5 }}>บันทึก</button>
      </div>
    </Overlay>
  );
}

// v1.10.0 (sections 14-17): one drill-down overlay covering registration fee config, per-team paid
// status, and tournament finance (income/expense + P&L) — kept off the main dashboard per the spec's
// "don't clutter main screen" instruction. Entry-fee income is NEVER entered here directly — it's
// derived (registrationFeeAmountFor / tournamentEntryFeeTotal) from feeMode+feeAmount+paidTeamIds, so
// there is exactly one source of truth and no way to double-count it against manual finance entries.
function TournamentFinancePanel({ t, teamsById, peopleById, tSetRegistrationConfig, tToggleTeamPaid, tAddFinanceEntry, tRemoveFinanceEntry, onClose }) {
  const [showPaidList, setShowPaidList] = useState(false);
  const [addingIncome, setAddingIncome] = useState(false);
  const [addingExpense, setAddingExpense] = useState(false);
  const reg = t.registration || { feeMode: "none", feeAmount: 0, paidTeamIds: [] };
  const progress = registrationProgress(t);
  const totals = tournamentFinanceTotals(t);
  const feeModeLabel = { none: "ไม่เก็บค่าสมัคร", perTeam: "เก็บต่อทีม", perPlayer: "เก็บต่อคน" };

  return (
    <Overlay onClose={onClose}>
      <div style={{ fontWeight: 800, fontSize: 15.5, marginBottom: 14 }}>ค่าสมัครและการเงิน</div>

      <SectionHead icon={<span style={{ fontSize: 14 }}>🎫</span>} title="ค่าสมัคร" sub={feeModeLabel[reg.feeMode] || ""} />
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {[["none", "ไม่เก็บ"], ["perTeam", "ต่อทีม"], ["perPlayer", "ต่อคน"]].map(([v, l]) => (
          <button key={v} onClick={() => tSetRegistrationConfig({ feeMode: v })} style={{ flex: 1, padding: "8px 6px", borderRadius: 9, fontSize: 12, fontWeight: 800, border: `1.5px solid ${reg.feeMode === v ? T.green : T.border}`, background: reg.feeMode === v ? "#e2f5ec" : T.surface2, color: reg.feeMode === v ? T.green : T.muted }}>{l}</button>
        ))}
      </div>
      {reg.feeMode !== "none" && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: T.muted, marginBottom: 5 }}>ค่าสมัคร ({reg.feeMode === "perTeam" ? "บาท/ทีม" : "บาท/คน"})</div>
          <input type="number" inputMode="numeric" value={reg.feeAmount || ""} onChange={(e) => tSetRegistrationConfig({ feeAmount: Math.max(0, Number(e.target.value) || 0) })} placeholder="0" style={{ width: "100%", padding: "9px 12px", borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 14, boxSizing: "border-box" }} />
        </div>
      )}
      {reg.feeMode !== "none" && (
        <button onClick={() => setShowPaidList((v) => !v)} style={{ width: "100%", textAlign: "left", padding: "9px 11px", borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 12.5, fontWeight: 700, marginBottom: showPaidList ? 6 : 16, display: "flex", alignItems: "center", gap: 6 }}>
          <span>ชำระแล้ว {progress.paid}/{progress.total} ทีม</span><ChevronDown size={14} style={{ marginLeft: "auto", transform: showPaidList ? "rotate(180deg)" : "none" }} />
        </button>
      )}
      {reg.feeMode !== "none" && showPaidList && (
        <div style={{ marginBottom: 16 }}>
          {t.teams.map((team) => {
            const paid = (reg.paidTeamIds || []).includes(team.id);
            return (
              <div key={team.id} style={{ display: "flex", alignItems: "center", padding: "8px 10px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 12.5, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tTeamName(team, peopleById)}</span>
                <span style={{ fontSize: 11, color: T.muted, marginRight: 8 }}>฿{registrationFeeAmountFor(t, team).toLocaleString()}</span>
                <button onClick={() => tToggleTeamPaid(team.id)} style={{ flexShrink: 0, padding: "5px 11px", borderRadius: 8, fontSize: 11.5, fontWeight: 800, border: "none", background: paid ? "#e2f5ec" : T.surface2, color: paid ? T.green : T.muted }}>{paid ? "ชำระแล้ว ✓" : "ยังไม่จ่าย"}</button>
              </div>
            );
          })}
          {t.teams.length === 0 && <div style={{ fontSize: 12, color: T.muted, textAlign: "center", padding: 10 }}>ยังไม่มีทีม</div>}
        </div>
      )}

      <SectionHead icon={<span style={{ fontSize: 14 }}>💵</span>} title="รายรับ-รายจ่าย" />
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 11, marginBottom: 10 }}>
        <Row label="ค่าสมัคร (อัตโนมัติ)" value={`฿${totals.entryFee.toLocaleString()}`} />
        <Row label="รายรับอื่นๆ" value={`฿${totals.otherIncome.toLocaleString()}`} />
        <Row label="รายจ่ายรวม" value={`฿${totals.expense.toLocaleString()}`} />
        <div style={{ height: 1, background: T.border, margin: "7px 0" }} />
        <Row label={totals.profit >= 0 ? "กำไร" : "ขาดทุน"} value={`฿${Math.abs(totals.profit).toLocaleString()}`} bold color={totals.profit >= 0 ? T.green : T.accent} />
      </div>

      <FinanceEntryList title="รายรับอื่นๆ" categories={TOURNAMENT_INCOME_CATEGORIES} entries={t.finance.income} adding={addingIncome} setAdding={setAddingIncome} onAdd={(entry) => tAddFinanceEntry("income", entry)} onRemove={(id) => tRemoveFinanceEntry("income", id)} />
      <FinanceEntryList title="รายจ่าย" categories={TOURNAMENT_EXPENSE_CATEGORIES} entries={t.finance.expense} adding={addingExpense} setAdding={setAddingExpense} onAdd={(entry) => tAddFinanceEntry("expense", entry)} onRemove={(id) => tRemoveFinanceEntry("expense", id)} />

      <button onClick={onClose} style={{ ...btnSecondary, marginTop: 4 }}>ปิด</button>
    </Overlay>
  );
}

function Row({ label, value, bold, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: bold ? 13.5 : 12.5, fontWeight: bold ? 800 : 500, color: color || T.text }}>
      <span style={{ color: bold ? color || T.text : T.muted }}>{label}</span><span>{value}</span>
    </div>
  );
}

// simple line-item entry list shared by tournament finance's income/expense sections (spec section 15:
// "simple line-item entry, not full accounting") — collapsed add-form, tap-to-remove existing entries.
function FinanceEntryList({ title, categories, entries, adding, setAdding, onAdd, onRemove }) {
  const [category, setCategory] = useState(categories[0][0]);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const canAdd = Number(amount) > 0;
  const submit = () => {
    if (!canAdd) return;
    onAdd({ category, label: label.trim(), amount: Number(amount) });
    setLabel(""); setAmount(""); setAdding(false);
  };
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: T.muted }}>{title}</span>
        <button onClick={() => setAdding((v) => !v)} style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 800, color: T.green, background: "none", border: "none", padding: "2px 4px" }}>{adding ? "ยกเลิก" : "+ เพิ่มรายการ"}</button>
      </div>
      {entries.length === 0 && !adding && <div style={{ fontSize: 11.5, color: T.muted, padding: "4px 2px" }}>ยังไม่มีรายการ</div>}
      {entries.map((e) => {
        const catLabel = (categories.find((c) => c[0] === e.category) || [, e.category])[1];
        return (
          <div key={e.id} style={{ display: "flex", alignItems: "center", padding: "7px 10px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 6 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.label || catLabel}</div>
              <div style={{ fontSize: 10.5, color: T.muted }}>{catLabel}</div>
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 800, marginRight: 8 }}>฿{e.amount.toLocaleString()}</span>
            <button onClick={() => onRemove(e.id)} style={{ flexShrink: 0, background: "none", border: "none", color: T.muted, padding: 3 }}><X size={14} /></button>
          </div>
        );
      })}
      {adding && (
        <div style={{ padding: 10, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, marginTop: 4 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 8, overflowX: "auto" }}>
            {categories.map(([v, l]) => (
              <button key={v} onClick={() => setCategory(v)} style={{ flex: "none", padding: "6px 10px", borderRadius: 8, fontSize: 11.5, fontWeight: 800, border: `1.5px solid ${category === v ? T.green : T.border}`, background: category === v ? "#e2f5ec" : T.surface, color: category === v ? T.green : T.muted }}>{l}</button>
            ))}
          </div>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="รายละเอียด (ไม่บังคับ)" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: T.surface, border: `1px solid ${T.border}`, color: T.text, fontSize: 13, boxSizing: "border-box", marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="จำนวนเงิน (บาท)" style={{ flex: 1, padding: "8px 10px", borderRadius: 8, background: T.surface, border: `1px solid ${T.border}`, color: T.text, fontSize: 13, boxSizing: "border-box" }} />
            <button onClick={submit} disabled={!canAdd} style={{ padding: "8px 16px", borderRadius: 8, background: T.green, border: "none", color: "#fff", fontSize: 12.5, fontWeight: 800, opacity: canAdd ? 1 : 0.5 }}>เพิ่ม</button>
          </div>
        </div>
      )}
    </div>
  );
}

function QuanSettingsSheet({ mode, setMode, courtCount, setCourtCount, courtLabels, setCourtLabel, settings, setSettings, players, lockPairs, addLockPair, removeLockPair, setHandPref, getP, resetGames, changeLevelPreset, setCustomLevels, onClose }) {
  // v1.8.4: ค่าใช้จ่าย (💳) and รางวัล (🏆) moved out of this sheet into FinanceSettingsSheet, opened from the
  // ชำระเงิน tab instead — Today/ตั้งค่าก๊วน is now Game Operations only, money settings live with money UI.
  const [open, setOpen] = useState("play"); // "play" | "level" | null — one section open at a time
  const [editCourtLabels, setEditCourtLabels] = useState(false);
  const toggle = (key) => setOpen((v) => (v === key ? null : key));

  return (
    <Overlay onClose={onClose}>
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>⚙️ ตั้งค่าก๊วน</div>

      {/* 🎮 การเล่น */}
      <button onClick={() => toggle("play")} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", borderRadius: 12, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 13.5, fontWeight: 700, marginBottom: open === "play" ? 0 : 8 }}>
        <Shuffle size={15} color={T.muted} /> 🎮 การเล่น
        <ChevronDown size={17} color={T.muted} style={{ marginLeft: "auto", transform: open === "play" ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open === "play" && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: "none", borderRadius: "0 0 12px 12px", padding: 14, marginBottom: 8 }}>
          <Label>รูปแบบการเล่น</Label>
          <div style={{ marginBottom: 12 }}>
            <Seg options={[["doubles", "ตีคู่ (2v2)"], ["singles", "ตีเดี่ยว (1v1)"]]} value={mode} onChange={setMode} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 5 }}>จำนวนเซต</div>
            <Seg options={[[1, "1 เซต"], [2, "2 ใน 3 เซต"], [3, "3 ใน 5 เซต"]]} value={settings.rounds || 1} onChange={(v) => setSettings((s) => ({ ...s, rounds: v }))} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 5 }}>เล่นถึง</div>
            <Seg options={[[9, "9"], [15, "15"], [21, "21"]]} value={settings.winScore || 21} onChange={(v) => setSettings((s) => ({ ...s, winScore: v }))} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 5 }}>ดิว</div>
            <Seg options={[[true, "มีดิว"], [false, "ไม่มีดิว"]]} value={!!settings.deuce} onChange={(v) => setSettings((s) => ({ ...s, deuce: v }))} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 5 }}>โหมดจัดคู่</div>
            <Seg options={[["auto", "สุ่มอัตโนมัติ"], ["manual", "เลือกเอง (Manual)"]]} value={settings.pairingMode || "auto"} onChange={(v) => setSettings((s) => ({ ...s, pairingMode: v }))} />
          </div>
          <Label>จำนวนสนาม</Label>
          <div style={{ marginBottom: 10 }}><Stepper value={courtCount} setValue={setCourtCount} min={1} max={12} /></div>
          <button onClick={() => setEditCourtLabels((v) => !v)} style={{ width: "100%", textAlign: "left", padding: "8px 11px", borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}`, color: T.muted, fontSize: 12, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12 }}>🔢</span> แก้ไขเลขสนาม (เช่น มี 3 สนาม แต่เป็นเบอร์ 1, 3, 5)<ChevronDown size={14} style={{ marginLeft: "auto", transform: editCourtLabels ? "rotate(180deg)" : "none" }} />
          </button>
          {editCourtLabels && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, padding: "10px 11px", borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}` }}>
              {Array.from({ length: courtCount }, (_, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 11, color: T.muted, fontWeight: 700 }}>สนามที่ {i + 1}:</span>
                  <input
                    value={courtLabels[i] ?? ""}
                    onChange={(e) => setCourtLabel(i, e.target.value)}
                    onBlur={() => { if (!String(courtLabels[i] ?? "").trim()) setCourtLabel(i, String(i + 1)); }}
                    style={{ width: 46, padding: "6px 7px", borderRadius: 8, background: T.surface, border: `1px solid ${T.border}`, color: T.text, fontSize: 13, fontWeight: 700, textAlign: "center" }}
                  />
                </div>
              ))}
            </div>
          )}
          <Label>ล็อคคู่ / เลี่ยงคู่ (เฉพาะโหมดตีคู่ ยกเว้น "ไม่อยากสู้/ไม่อยากเจอเลย" ใช้ได้ทั้งเดี่ยว-คู่)</Label>
          <LockPairEditor {...{ players, lockPairs, addLockPair, removeLockPair, setHandPref, getP }} />
          <button onClick={resetGames} style={{ marginTop: 14, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", borderRadius: 11, background: T.surface2, border: `1px solid ${T.border}`, color: T.muted, fontSize: 12.5, fontWeight: 700 }}><RotateCcw size={14} /> รีเซ็ตจำนวนเกม</button>
        </div>
      )}

      {/* 🏸 ระดับฝีมือ */}
      <button onClick={() => toggle("level")} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", borderRadius: 12, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 13.5, fontWeight: 700, marginBottom: open === "level" ? 0 : 4 }}>
        <ClipboardList size={15} color={T.muted} /> 🏸 ระดับฝีมือ ({getPresetMeta(settings.levelPresetId || "isan").name})
        <ChevronDown size={17} color={T.muted} style={{ marginLeft: "auto", transform: open === "level" ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open === "level" && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: "none", borderRadius: "0 0 12px 12px", padding: 14 }}>
          <LevelPresetEditor settings={settings} changeLevelPreset={changeLevelPreset} setCustomLevels={setCustomLevels} />
        </div>
      )}
    </Overlay>
  );
}

// v1.8.4: ค่าใช้จ่ายก๊วน + รางวัล — moved here from QuanSettingsSheet (formerly the "💳"/"🏆" accordions
// inside Today's ตั้งค่าก๊วน) so money settings live with the money UI (ชำระเงิน tab), not the play UI.
// Same fields, same state (settings.court/shuttle/other/qr/bank/wheelEnabled/wheelPrizes), just relocated.
function FinanceSettingsSheet({ settings, setSettings, qrRef, courtCount, courtLabels, onClose }) {
  const [open, setOpen] = useState("payment"); // "payment" | "prize" | null
  const toggle = (key) => setOpen((v) => (v === key ? null : key));
  const model = settings.costModel || "simple";
  const setCourtRate = (court, amount) => setSettings((s) => {
    const rates = (s.perCourtRates || []).filter((r) => r.court !== court);
    return { ...s, perCourtRates: [...rates, { court, amount }] };
  });
  const courtRateFor = (c) => (settings.perCourtRates || []).find((r) => r.court === c)?.amount ?? "";
  const setCustomRow = (patch) => setSettings((s) => ({ ...s, customCostRows: [...(s.customCostRows || []), { id: uid(), ...patch }] }));
  const updateCustomRow = (id, patch) => setSettings((s) => ({ ...s, customCostRows: (s.customCostRows || []).map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const removeCustomRow = (id) => setSettings((s) => ({ ...s, customCostRows: (s.customCostRows || []).filter((r) => r.id !== id) }));
  return (
    <Overlay onClose={onClose}>
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>⚙️ ตั้งค่าค่าก๊วนและรางวัล</div>

      {/* 💳 อัตราเรียกเก็บจากผู้เล่น — NOT organizer expense: this sets what's billed to players (Revenue side
          of computeBill). Real out-of-pocket costs live separately as Expense items in the การเงิน tab. */}
      <button onClick={() => toggle("payment")} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", borderRadius: 12, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 13.5, fontWeight: 700, marginBottom: open === "payment" ? 0 : 8 }}>
        <Wallet size={15} color={T.muted} /> 💳 ค่าก๊วน (เรียกเก็บจากผู้เล่น)
        <ChevronDown size={17} color={T.muted} style={{ marginLeft: "auto", transform: open === "payment" ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open === "payment" && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: "none", borderRadius: "0 0 12px 12px", padding: 14, marginBottom: 8 }}>
          {/* v1.9.4: รูปแบบคิดค่าใช้จ่าย — progressive disclosure, only the selected model's fields show below.
              "simple" = the original ค่าสนาม/ค่าลูก fields, unchanged behavior/position for existing groups. */}
          <Label>รูปแบบคิดค่าใช้จ่าย</Label>
          <div style={{ marginBottom: 14 }}>
            <Seg options={[["simple", "แบบง่าย"], ["perPerson", "รายคน"]]} value={model === "perCourt" || model === "hourly" || model === "custom" ? "" : model} onChange={(v) => setSettings((s) => ({ ...s, costModel: v }))} />
            <div style={{ marginTop: 6 }}>
              <Seg options={[["perCourt", "แยกรายสนาม"], ["hourly", "รายชั่วโมง"], ["custom", "กำหนดเอง"]]} value={["perCourt", "hourly", "custom"].includes(model) ? model : ""} onChange={(v) => setSettings((s) => ({ ...s, costModel: v }))} />
            </div>
          </div>

          {model === "simple" && (<>
            <Label>อัตราเรียกเก็บจากผู้เล่น</Label>
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <NumField label="ค่าสนาม/คน (฿)" value={settings.court} onChange={(v) => setSettings((s) => ({ ...s, court: v }))} />
              <NumField label="ค่าลูก/เกม (฿)" value={settings.shuttle} onChange={(v) => setSettings((s) => ({ ...s, shuttle: v }))} />
            </div>
          </>)}

          {model === "perPerson" && (
            <div style={{ marginBottom: 10 }}>
              <NumField label="ราคาต่อคน (฿) — เหมาแทนค่าสนาม+ค่าลูก" value={settings.perPersonRate || 0} onChange={(v) => setSettings((s) => ({ ...s, perPersonRate: v }))} />
              <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>คำนวณรายได้จากจำนวนผู้เล่นที่เข้าร่วม ตามระบบเรียกเก็บเงินเดิม</div>
            </div>
          )}

          {model === "perCourt" && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 8 }}>ค่าคอร์ทของแต่ละสนาม (฿) — บันทึกเป็นค่าใช้จ่ายอัตโนมัติเมื่อจบก๊วน</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Array.from({ length: courtCount || 1 }, (_, i) => i + 1).map((c) => (
                  <div key={c} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, minWidth: 64 }}>สนาม {courtLabelFor(courtLabels || [], c)}</span>
                    <input type="number" placeholder="0" value={courtRateFor(c)} onChange={(e) => setCourtRate(c, Number(e.target.value) || 0)} style={{ flex: 1, padding: "8px 10px", borderRadius: 9, border: `1px solid ${T.border}`, fontSize: 13, fontWeight: 700, outline: "none", boxSizing: "border-box" }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {model === "hourly" && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <NumField label="จำนวนสนาม" value={settings.hourly?.courts || 0} onChange={(v) => setSettings((s) => ({ ...s, hourly: { ...(s.hourly || {}), courts: v } }))} />
                <NumField label="ราคา/ชั่วโมง (฿)" value={settings.hourly?.rate || 0} onChange={(v) => setSettings((s) => ({ ...s, hourly: { ...(s.hourly || {}), rate: v } }))} />
              </div>
              <NumField label="จำนวนชั่วโมง" value={settings.hourly?.hours || 0} onChange={(v) => setSettings((s) => ({ ...s, hourly: { ...(s.hourly || {}), hours: v } }))} />
            </div>
          )}

          {(model === "perCourt" || model === "hourly") && (
            <div style={{ marginBottom: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 8 }}>ค่าลูกแบด (ไม่บังคับ — รวมเป็นค่าใช้จ่ายอีกรายการ)</div>
              <div style={{ display: "flex", gap: 10 }}>
                <NumField label="จำนวนลูก" value={settings.shuttleCalc?.qty || 0} onChange={(v) => setSettings((s) => ({ ...s, shuttleCalc: { ...(s.shuttleCalc || {}), qty: v } }))} />
                <NumField label="ราคา/ลูก (฿)" value={settings.shuttleCalc?.pricePerUnit || 0} onChange={(v) => setSettings((s) => ({ ...s, shuttleCalc: { ...(s.shuttleCalc || {}), pricePerUnit: v } }))} />
              </div>
            </div>
          )}

          {model === "custom" && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 8 }}>รายการค่าใช้จ่าย — บันทึกเป็นค่าใช้จ่ายอัตโนมัติเมื่อจบก๊วน</div>
              <ExpenseListEditor items={settings.customCostRows || []} onAdd={setCustomRow} onUpdate={updateCustomRow} onRemove={removeCustomRow} categories={EXPENSE_CATEGORIES} />
            </div>
          )}

          <div style={{ marginBottom: 16 }}><NumField label="อื่น ๆ ที่เรียกเก็บรวม (หารเท่ากัน) (฿)" value={settings.other || 0} onChange={(v) => setSettings((s) => ({ ...s, other: v }))} /></div>
          <Label>QR รับเงิน</Label>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            {settings.qr
              ? <img src={settings.qr} alt="QR" style={{ width: 72, height: 72, borderRadius: 10, objectFit: "contain", background: "#fff", border: `1px solid ${T.border}` }} />
              : <div style={{ width: 72, height: 72, borderRadius: 10, background: T.surface2, border: `1px dashed ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted }}><QrCode size={26} /></div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button onClick={() => qrRef.current.click()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 12.5, fontWeight: 700 }}><Upload size={14} /> {settings.qr ? "เปลี่ยน QR" : "แนบ QR"}</button>
              {settings.qr && <button onClick={() => setSettings((s) => ({ ...s, qr: null }))} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, background: "none", border: `1px solid ${T.border}`, color: T.accent, fontSize: 12.5, fontWeight: 700 }}><Trash2 size={14} /> ลบ QR</button>}
            </div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 5 }}>เลขบัญชี / พร้อมเพย์ (สำหรับคนที่โอนเอง)</div>
            <textarea value={settings.bank || ""} onChange={(e) => setSettings((s) => ({ ...s, bank: e.target.value }))} placeholder="เช่น ธ.กสิกร 123-4-56789-0 นาย A / พร้อมเพย์ 08x-xxx-xxxx" rows={2} style={{ width: "100%", padding: "10px 12px", borderRadius: 11, background: T.surface, border: `1px solid ${T.border}`, color: T.text, fontSize: 13.5, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
          </div>
        </div>
      )}

      {/* 🎁 รางวัล */}
      <button onClick={() => toggle("prize")} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", borderRadius: 12, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 13.5, fontWeight: 700, marginBottom: open === "prize" ? 0 : 4 }}>
        <Trophy size={15} color={T.muted} /> 🎁 รางวัล
        <ChevronDown size={17} color={T.muted} style={{ marginLeft: "auto", transform: open === "prize" ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open === "prize" && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: "none", borderRadius: "0 0 12px 12px", padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>เปิดใช้งานวงล้อรางวัล</div>
            <Seg options={[[true, "เปิด"], [false, "ปิด"]]} value={settings.wheelEnabled !== false} onChange={(v) => setSettings((s) => ({ ...s, wheelEnabled: v }))} />
          </div>
          {settings.wheelEnabled !== false && (<>
            {/* v1.9.19: sold-out prizes are excluded from the wheel by default (unchanged behavior) —
                this lets the organizer opt into showing them anyway, purely so players still see the
                wheel as fully stocked for the suspense. v1.9.21: when shown, they're drawn IDENTICAL to
                a live slice (no gray, no "(หมด)" marker) — a spinning player can't tell they're gone.
                Never affects actual odds: see SpinWheel — sold-out slices are excluded from the
                random-selection pool regardless of how they're drawn. */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>รางวัลที่หมดแล้วในวงล้อ</div>
              <Seg options={[[false, "แค่ที่เหลือ"], [true, "แสดงทั้งหมด"]]} value={!!settings.wheelShowSoldOut} onChange={(v) => setSettings((s) => ({ ...s, wheelShowSoldOut: v }))} />
            </div>
            <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 14 }}>"แสดงทั้งหมด" = วงล้อยังโชว์ครบเหมือนของเดิม (ผู้เล่นไม่รู้ว่าหมดแล้ว) แต่หมุนไม่มีทางออกจริง</div>
            <Label>🎡 วงล้อรางวัล — กำหนดรางวัลและโอกาสออก</Label>
            <WheelPrizeEditor prizes={settings.wheelPrizes || []} setPrizes={(updater) => setSettings((s) => ({ ...s, wheelPrizes: typeof updater === "function" ? updater(s.wheelPrizes || []) : updater }))} />
          </>)}
        </div>
      )}
    </Overlay>
  );
}

function Seg({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {options.map(([v, lb]) => (
        <button key={String(v)} onClick={() => onChange(v)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 12.5, fontWeight: 800, border: `1.5px solid ${value === v ? T.green : T.border}`, background: value === v ? "#e2f5ec" : T.surface, color: value === v ? T.green : T.muted }}>{lb}</button>
      ))}
    </div>
  );
}

const TEAM_A_COLOR = "#2563eb"; // blue
const TEAM_B_COLOR = "#e11d48"; // red (not the same hue as the error/unpaid accent color)
function CompactMatch({ m, getP, onClick }) {
  const nm = (id) => getP(id)?.name || "-";
  const lv = (id) => getP(id)?.level || "";
  const side = (arr) => arr.filter(Boolean).map((id) => `${nm(id)} (${lv(id)})`).join(" + ");
  const sc = matchScoreText(m);
  return (
    <button onClick={onClick} style={{ width: "100%", textAlign: "left", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 11, padding: "9px 11px", display: "flex", alignItems: "center", gap: 8 }}>
      <Check size={14} color={T.green} style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 10.5, fontWeight: 800, color: T.muted, background: T.surface2, padding: "2px 6px", borderRadius: 6, flexShrink: 0 }}>R{(m.round ?? 0) + 1}·C{m.court}</span>
      <span style={{ flex: 1, fontSize: 12.5, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
        <span style={{ color: TEAM_A_COLOR, fontWeight: 700 }}>{side(m.teamA)}</span>
        {sc ? <span style={{ fontWeight: 800, color: T.text, margin: "0 6px" }}>{sc}</span> : <span style={{ color: T.muted, fontWeight: 800, margin: "0 6px" }}>vs</span>}
        <span style={{ color: TEAM_B_COLOR, fontWeight: 700 }}>{side(m.teamB)}</span>
      </span>
    </button>
  );
}

// win/lose dropdown for one side of one round. `state` is "win" | "lose" | "" (undetermined).
// Locked (disabled, greyed) once a numeric score decides the round automatically — see roundWinner().
function WinLoseSelect({ state, onPick, locked }) {
  const bg = state === "win" ? "#e2f5ec" : state === "lose" ? "#fdeae7" : T.surface;
  const border = state === "win" ? T.green : state === "lose" ? T.accent : T.border;
  const color = state === "win" ? T.green : state === "lose" ? T.accent : T.muted;
  return (
    <select
      value={state}
      disabled={locked}
      onChange={(e) => onPick(e.target.value)}
      style={{ width: 54, padding: "7px 2px", borderRadius: 9, background: bg, border: `1px solid ${border}`, color, fontSize: 11, fontWeight: 800, textAlign: "center", outline: "none", opacity: locked ? 0.75 : 1 }}
    >
      <option value="">-</option>
      <option value="win">ชนะ</option>
      <option value="lose">แพ้</option>
    </select>
  );
}
function ScoreEditor({ m, rounds, setScore, setWin, clearScore }) {
  // `rounds` here is "sets needed to win" (see maxSetsFor/visibleSetCount) — best-of-3 for 2, best-of-5
  // for 3. Only reveal as many set rows as are actually needed right now: stop early once a side has
  // clinched it in straight sets, but add the decider row the moment the score is split.
  const visible = visibleSetCount(m, rounds || 1);
  return (
    <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 11, padding: 11, marginTop: 6 }}>
      {Array.from({ length: visible }).map((_, ri) => {
        const r = (m.scores && m.scores[ri]) || { a: null, b: null, win: null };
        const auto = r.a != null && r.b != null ? (Number(r.a) === Number(r.b) ? null : (Number(r.a) > Number(r.b) ? "A" : "B")) : null;
        const eff = auto || r.win || null; // "A" | "B" | null — effective round winner (auto beats manual pick)
        const locked = !!auto; // once both scores are in, the dropdowns just reflect the auto result
        const stateFor = (side) => (eff === side ? "win" : eff && eff !== side ? "lose" : "");
        const pick = (side) => (v) => {
          if (v === "win") setWin(m.id, ri, side);
          else if (v === "lose") setWin(m.id, ri, side === "A" ? "B" : "A");
          else setWin(m.id, ri, null);
        };
        return (
          <div key={ri} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: ri < visible - 1 ? 8 : 0 }}>
            {visible > 1 && <span style={{ fontSize: 11, fontWeight: 800, color: T.muted, minWidth: 40 }}>เซต {ri + 1}</span>}
            {setWin && <WinLoseSelect state={stateFor("A")} onPick={pick("A")} locked={locked} />}
            <span style={{ fontSize: 11.5, fontWeight: 700, color: T.green }}>A</span>
            <input type="number" value={r.a ?? ""} onChange={(e) => setScore(m.id, ri, "a", e.target.value)} style={scoreInput} />
            <span style={{ color: T.muted, fontWeight: 800 }}>–</span>
            <input type="number" value={r.b ?? ""} onChange={(e) => setScore(m.id, ri, "b", e.target.value)} style={scoreInput} />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: T.blue }}>B</span>
            {setWin && <WinLoseSelect state={stateFor("B")} onPick={pick("B")} locked={locked} />}
          </div>
        );
      })}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <span style={{ fontSize: 11, color: T.muted }}>คะแนนไม่บังคับ · แก้ภายหลังได้</span>
        {hasScore(m) && <button onClick={() => clearScore(m.id)} style={{ background: "none", border: "none", color: T.accent, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}><Trash2 size={13} /> ลบคะแนน</button>}
      </div>
    </div>
  );
}
const scoreInput = { width: 54, padding: "8px 8px", borderRadius: 9, background: "#fff", border: `1px solid ${T.border}`, color: T.text, fontSize: 15, fontWeight: 800, textAlign: "center", outline: "none" };

function SectionHead({ icon, title, sub }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "4px 0 10px" }}>{icon}<span style={{ fontWeight: 800, fontSize: 14 }}>{title}</span>{sub && <span style={{ fontSize: 11.5, color: T.muted }}>{sub}</span>}</div>;
}

/* ============ FINANCE — reusable expense / income list editors (v1.8.4) ============
   Used by: HistoricalDetail (per-session ค่าใช้จ่าย), FinanceTab (ค่าใช้จ่ายทั่วไป + รายได้อื่น).
   `categories` present → expense mode (category select shown, no sign). `categories` absent → income mode. */
function ExpenseListEditor({ items, onAdd, onUpdate, onRemove, categories }) {
  const [adding, setAdding] = useState(false);
  const blank = () => ({ category: categories ? categories[0] : undefined, description: "", amount: "", date: new Date().toISOString().slice(0, 10) });
  const [draft, setDraft] = useState(blank());
  const submit = () => {
    const amt = Number(draft.amount) || 0;
    if (amt <= 0) return;
    onAdd({ ...draft, amount: amt });
    setDraft(blank());
    setAdding(false);
  };
  return (
    <div>
      {items.length === 0 && !adding && <div style={{ color: T.muted, fontSize: 12.5, textAlign: "center", padding: "8px 0" }}>ยังไม่มีรายการ</div>}
      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
          {items.map((it) => (
            <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, background: T.surface, border: `1px solid ${T.border}` }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                {categories && <span style={{ display: "block", fontSize: 11, color: T.muted, fontWeight: 700 }}>{it.category}{it.auto ? " · ประมาณการ" : ""}</span>}
                <span style={{ display: "block", fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.description || (categories ? "-" : "ไม่มีรายละเอียด")}</span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 13, fontWeight: 800 }}>
                ฿<input type="number" value={it.amount} onChange={(e) => onUpdate(it.id, { amount: e.target.value })} style={{ width: 64, padding: "6px 6px", borderRadius: 8, border: `1px solid ${T.border}`, textAlign: "right", fontSize: 13, fontWeight: 800, outline: "none" }} />
              </span>
              <button onClick={() => onRemove(it.id)} style={{ background: "none", border: "none", color: T.accent, padding: 4, flexShrink: 0 }}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
      {adding ? (
        <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 11, padding: 10 }}>
          {categories && (
            <select value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} style={{ width: "100%", padding: "8px 10px", borderRadius: 9, border: `1px solid ${T.border}`, fontSize: 13, marginBottom: 8, background: "#fff" }}>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <input type="text" placeholder="รายละเอียด (ไม่บังคับ)" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} style={{ width: "100%", padding: "8px 10px", borderRadius: 9, border: `1px solid ${T.border}`, fontSize: 13, marginBottom: 8, boxSizing: "border-box", outline: "none" }} />
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input type="number" placeholder="จำนวนเงิน (฿)" value={draft.amount} onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))} style={{ flex: 1, padding: "8px 10px", borderRadius: 9, border: `1px solid ${T.border}`, fontSize: 13, boxSizing: "border-box", outline: "none" }} />
            <input type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} style={{ flex: 1, padding: "8px 10px", borderRadius: 9, border: `1px solid ${T.border}`, fontSize: 13, boxSizing: "border-box", outline: "none" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={submit} style={{ flex: 1, padding: "9px 0", borderRadius: 9, background: T.green, border: "none", color: "#fff", fontSize: 12.5, fontWeight: 800 }}>บันทึก</button>
            <button onClick={() => { setAdding(false); setDraft(blank()); }} style={{ flex: 1, padding: "9px 0", borderRadius: 9, background: "none", border: `1px solid ${T.border}`, color: T.muted, fontSize: 12.5, fontWeight: 700 }}>ยกเลิก</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", borderRadius: 10, background: "none", border: `1.5px dashed ${T.border}`, color: T.muted, fontSize: 12.5, fontWeight: 700 }}><Plus size={14} /> เพิ่มรายการ</button>
      )}
    </div>
  );
}

/* ============ SESSION HISTORY (archived / ended sessions) ============ */
function fmtThaiDate(iso) {
  if (!iso) return "-";
  const MO = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MO[d.getMonth()]} ${d.getFullYear() + 543}`;
}
// "2026-07" -> "ก.ค. 2569" — used by the Finance tab's month/day drill-down picker (v1.9.3)
function fmtThaiMonthLabel(ym) {
  if (!ym) return "-";
  const MO = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return `${MO[m - 1]} ${y + 543}`;
}
function HistoryTab({ sessionHistory, tournamentHistory, playersById, toggleHistoricalPaid, deleteSessionHistory, exportBackup, validateBackupFile, applyRestore, undoRestore, lastBackupAt, hasPreRestoreBackup, autoBackups, bootLog, openHistPhoto, clearHistPhoto, addHistExpense, updateHistExpense, removeHistExpense, onOpenTournamentPrint }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("latest"); // "latest" | "oldest"
  const [openId, setOpenId] = useState(null); // id of session shown in read-only detail overlay
  const [openTId, setOpenTId] = useState(null); // id of a tournamentHistory snapshot shown in read-only detail overlay
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [openBackupSettings, setOpenBackupSettings] = useState(false);
  const th = tournamentHistory || [];

  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const casual = sessionHistory
      .filter((s) => (s.name || "").toLowerCase().includes(qq) || (s.date || "").includes(q.trim()))
      .map((s) => ({ _kind: "casual", _ts: s.endedAt || 0, s }));
    const tourn = th
      .filter((t) => (t.name || "").toLowerCase().includes(qq) || (t.date || "").includes(q.trim()))
      .map((t) => ({ _kind: "tournament", _ts: t.archivedAt || t.completedAt || 0, t }));
    const merged = [...casual, ...tourn];
    merged.sort((a, b) => (sort === "latest" ? b._ts - a._ts : a._ts - b._ts));
    return merged;
  }, [sessionHistory, th, q, sort]);

  const open = openId ? sessionHistory.find((s) => s.id === openId) : null;
  const openT = openTId ? th.find((t) => t.id === openTId) : null;

  return (
    <div>
      {/* BACKUP / RESTORE */}
      <button onClick={() => setOpenBackupSettings((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", borderRadius: 12, background: T.surface, border: `1px solid ${T.border}`, color: T.text, fontSize: 13.5, fontWeight: 700, marginBottom: openBackupSettings ? 0 : 12 }}>
        <Download size={15} color={T.muted} /> ข้อมูลและการสำรอง
        <ChevronDown size={17} color={T.muted} style={{ marginLeft: "auto", transform: openBackupSettings ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>
      {openBackupSettings && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: "none", borderRadius: "0 0 12px 12px", padding: 14, marginBottom: 12 }}>
          <BackupSettingsEditor exportBackup={exportBackup} validateBackupFile={validateBackupFile} applyRestore={applyRestore} undoRestore={undoRestore} lastBackupAt={lastBackupAt} hasPreRestoreBackup={hasPreRestoreBackup} autoBackups={autoBackups} bootLog={bootLog} />
        </div>
      )}

      <div style={{ position: "relative", marginBottom: 10 }}>
        <Search size={17} style={{ position: "absolute", left: 12, top: 12, color: T.muted }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อก๊วน หรือวันที่" style={{ width: "100%", padding: "11px 12px 11px 36px", borderRadius: 11, background: T.surface, border: `1px solid ${T.border}`, color: T.text, fontSize: 14.5, outline: "none", boxSizing: "border-box" }} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <Seg options={[["latest", "ล่าสุด"], ["oldest", "เก่าสุด"]]} value={sort} onChange={setSort} />
      </div>

      {sessionHistory.length === 0 && th.length === 0 ? (
        <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: "40px 0" }}>ยังไม่มีประวัติก๊วน<br />เมื่อจบก๊วนหรือ Tournament ข้อมูลจะถูกบันทึกไว้ที่นี่</div>
      ) : list.length === 0 ? (
        <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: "24px 0" }}>ไม่พบรายการที่ค้นหา</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((row) => {
            if (row._kind === "tournament") {
              const t = row.t;
              const teamCount = (t.teams || []).length;
              const playerCount = (t.playerSnapshots || []).length;
              const champTeam = (t.divisions || []).map((d) => d.champion).find(Boolean);
              const champTm = champTeam ? (t.teams || []).find((tm) => tm.id === champTeam) : null;
              const champName = champTm ? tTeamName(champTm, playersById) : null;
              return (
                <button key={"t" + t.id} onClick={() => setOpenTId(t.id)} style={{ textAlign: "left", display: "flex", alignItems: "flex-start", gap: 10, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, padding: "12px 14px" }}>
                  {/* v1.11.3: Tournament rows now show their logo, exactly like ก๊วน sessions show s.photo
                      just below — previously this row skipped straight to the 🏆 emoji even when the
                      organizer had set a logo (see the wizard's step-1 logo picker, added in v1.11.1). */}
                  {t.logo ? (
                    <img src={t.logo} alt="" style={{ width: 34, height: 34, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>🏆</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, fontSize: 14.5 }}>{t.name || "Tournament ไม่มีชื่อ"}</span>
                      <span style={{ marginLeft: "auto", fontSize: 12, color: T.muted, fontWeight: 700 }}>{fmtThaiDate(t.date)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", fontSize: 12, color: T.muted }}>
                      <span>{playerCount} คน · {teamCount} ทีม · {TOURNAMENT_FORMAT_LABELS[t.format] || t.format}</span>
                    </div>
                    {champName && <div style={{ marginTop: 4, fontSize: 11, color: T.green, fontWeight: 700 }}>🏆 {champName}</div>}
                  </div>
                </button>
              );
            }
            const s = row.s;
            const paidCount = (s.bill || []).filter((b) => b.paid).length;
            return (
              <button key={s.id} onClick={() => setOpenId(s.id)} style={{ textAlign: "left", display: "flex", alignItems: "flex-start", gap: 10, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, padding: "12px 14px" }}>
                {s.photo ? (
                  <img src={s.photo} alt="" style={{ width: 34, height: 34, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>🏸</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 800, fontSize: 14.5 }}>{s.name || "ก๊วนไม่มีชื่อ"}</span>
                    <span style={{ marginLeft: "auto", fontSize: 12, color: T.muted, fontWeight: 700 }}>{fmtThaiDate(s.date)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", fontSize: 12, color: T.muted }}>
                    <span>{(s.players || []).length} คน · {(s.stats?.totalMatches ?? 0)} แมตช์ · {s.courtCount || 1} สนาม</span>
                    <span style={{ marginLeft: "auto", fontWeight: 800, color: T.green }}>{formatCurrency((s.bill || []).reduce((sum, b) => sum + (b.total || 0), 0))}</span>
                  </div>
                  {(s.bill || []).length > 0 && <div style={{ marginTop: 4, fontSize: 11, color: T.muted }}>จ่ายแล้ว {paidCount}/{(s.bill || []).length} คน</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {open && (
        <Overlay onClose={() => setOpenId(null)}>
          <HistoricalDetail s={open} toggleHistoricalPaid={toggleHistoricalPaid} onDelete={() => setConfirmDeleteId(open.id)} openHistPhoto={openHistPhoto} clearHistPhoto={clearHistPhoto} addHistExpense={addHistExpense} updateHistExpense={updateHistExpense} removeHistExpense={removeHistExpense} />
        </Overlay>
      )}

      {openT && (
        <Overlay onClose={() => setOpenTId(null)}>
          <TournamentHistoricalDetail t={openT} playersById={playersById} onOpenTournamentPrint={onOpenTournamentPrint} />
        </Overlay>
      )}

      {confirmDeleteId && (
        <div onClick={() => setConfirmDeleteId(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface, borderRadius: 16, padding: 18, maxWidth: 340, width: "100%" }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>ลบประวัติก๊วนนี้?</div>
            <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 16 }}>ข้อมูลแมตช์และการชำระเงินของก๊วนนี้จะถูกลบออกจากเครื่อง</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmDeleteId(null)} style={btnSecondary}>ยกเลิก</button>
              <button onClick={() => { const id = confirmDeleteId; setConfirmDeleteId(null); setOpenId(null); deleteSessionHistory(id); }} style={{ ...btnPrimary, background: T.accent }}><Trash2 size={15} /> ลบ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoricalDetail({ s, toggleHistoricalPaid, onDelete, openHistPhoto, clearHistPhoto, addHistExpense, updateHistExpense, removeHistExpense }) {
  const stats = s.stats || {};
  const bill = s.bill || [];
  const grandTotal = bill.reduce((sum, b) => sum + (b.total || 0), 0);
  const collected = bill.filter((b) => b.paid).reduce((sum, b) => sum + (b.total || 0), 0);
  const paidCount = bill.filter((b) => b.paid).length;
  const receivable = sessionReceivable(s);
  const expenseList = sessionExpenseList(s);
  const expenseTotal = sessionExpenseTotal(s);
  const profit = sessionProfit(s);
  const getSP = (id) => (s.players || []).find((p) => p.id === id);
  const ranking = [...(s.players || [])].sort((a, b) => (b.games || 0) - (a.games || 0) || a.name.localeCompare(b.name));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <button onClick={() => openHistPhoto(s.id)} title="แตะเพื่อเพิ่ม/เปลี่ยนรูปก๊วน" style={{ position: "relative", flexShrink: 0, border: "none", background: "none", padding: 0, width: 48, height: 48 }}>
          {s.photo ? (
            <img src={s.photo} alt="" style={{ width: 48, height: 48, borderRadius: 13, objectFit: "cover" }} />
          ) : (
            <div style={{ width: 48, height: 48, borderRadius: 13, background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🏸</div>
          )}
          <span style={{ position: "absolute", right: -3, bottom: -3, width: 19, height: 19, borderRadius: 10, background: T.surface, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}><Camera size={10} color={T.muted} /></span>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{s.name || "ก๊วนไม่มีชื่อ"}</div>
          <div style={{ fontSize: 12.5, color: T.muted, marginTop: 2 }}>{fmtThaiDate(s.date)} · {(s.players || []).length} คน · {s.courtCount || 1} สนาม · {fmtMode(s.settings || {}, s.mode)}</div>
          {s.photo && <button onClick={() => clearHistPhoto(s.id)} style={{ background: "none", border: "none", color: T.muted, fontSize: 11, fontWeight: 700, padding: 0, marginTop: 3 }}>ลบรูปก๊วน</button>}
        </div>
      </div>

      <button
        onClick={() => shareSummary(buildShareText({ name: s.name, date: fmtThaiDate(s.date), playerCount: (s.players || []).length, totalMatches: stats.totalMatches || 0, maxGames: stats.maxGames || 0, totalExpense: grandTotal }))}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 0", borderRadius: 11, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 13, fontWeight: 700, marginBottom: 14 }}
      ><Share2 size={15} /> แชร์สรุปก๊วน</button>

      <SectionHead icon={<ClipboardList size={16} color={T.green} />} title="สรุป" />
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <MiniStat label="แมตช์" value={stats.totalMatches ?? 0} />
        <MiniStat label="เกมรวม" value={stats.totalGames ?? 0} />
        <MiniStat label="เกมมากสุด" value={stats.maxGames ?? 0} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <MiniStat label="เกมน้อยสุด" value={stats.minGames ?? 0} />
        <MiniStat label="รอเฉลี่ย (นาที)" value={stats.avgWaitMin ?? "-"} />
        <MiniStat label="รอนานสุด (นาที)" value={stats.maxWaitMin ?? "-"} />
      </div>

      <SectionHead icon={<User size={16} color={T.green} />} title="ผู้เล่น" sub="ชนะ-แพ้-เสมอ" />
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
        {ranking.length === 0 ? <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: "8px 0" }}>ไม่มีผู้เล่น</div> :
          ranking.map((p) => {
            const st = playerStats(p.id, s.matches || []);
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", borderRadius: 11, background: T.surface, border: `1px solid ${T.border}` }}>
                <Avatar p={p} size={28} />
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name} <span style={{ color: levelColor(p.skillIndex), fontWeight: 800, fontSize: 12 }}>({p.level})</span></span>
                {(st.win + st.loss + st.draw) > 0 && <span style={{ fontSize: 11.5, color: T.muted }}>{st.win}-{st.loss}-{st.draw}</span>}
                <span style={{ fontSize: 12.5, fontWeight: 800, color: T.text }}>{p.games || 0} เกม</span>
              </div>
            );
          })}
      </div>

      <SectionHead icon={<Wallet size={16} color={T.green} />} title="การชำระเงิน" sub="แตะเพื่อรับ/ยกเลิก — แก้ย้อนหลังได้" />
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: T.muted }}>จ่ายแล้ว</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.green }}>{paidCount}/{bill.length} คน</div>
        </div>
        <div style={{ flex: 1, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: T.muted }}>รับแล้ว</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.green }}>{formatCurrency(collected)} <span style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>/ {formatCurrency(grandTotal)}</span></div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
        {bill.length === 0 ? <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: "8px 0" }}>ไม่มีข้อมูลการชำระเงิน</div> : bill.map((b) => (
          <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", borderRadius: 11, background: T.surface, border: `1px solid ${T.border}` }}>
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name} <span style={{ color: levelColor(b.skillIndex), fontWeight: 800, fontSize: 11.5 }}>({b.level})</span> <span style={{ color: T.muted, fontWeight: 600, fontSize: 11.5 }}>· {formatCurrency(b.total)}</span></span>
            <button onClick={() => toggleHistoricalPaid(s.id, b.id)} style={{ padding: "6px 11px", borderRadius: 20, fontSize: 12, fontWeight: 800, border: "none", background: b.paid ? "#e2f5ec" : "#fdecea", color: b.paid ? T.green : T.accent }}>{b.paid ? "🟢 จ่ายแล้ว" : "🔴 ยังไม่จ่าย"}</button>
          </div>
        ))}
      </div>

      <SectionHead icon={<Wallet size={16} color={T.green} />} title="ค่าใช้จ่าย" sub="แก้ไขได้ — เพิ่มยอดจริงที่มาทีหลังได้" />
      <div style={{ marginBottom: 10 }}>
        <ExpenseListEditor
          items={expenseList}
          categories={EXPENSE_CATEGORIES}
          onAdd={(item) => addHistExpense(s.id, item)}
          onUpdate={(id, patch) => updateHistExpense(s.id, id, patch)}
          onRemove={(id) => removeHistExpense(s.id, id)}
        />
      </div>
      <div style={{ background: T.surface2, borderRadius: 12, padding: 12, marginBottom: 18 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 8 }}>สรุปกำไรขาดทุน</div>
        <BillRow label="รายได้ (ยอดเรียกเก็บ)" v={grandTotal} />
        <BillRow label="รับแล้วจริง" v={collected} />
        <BillRow label="ค้างรับ" v={receivable} />
        <BillRow label="ค่าใช้จ่ายรวม" v={expenseTotal} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, marginTop: 6, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
          <span>{profit >= 0 ? "กำไรสุทธิ" : "ขาดทุนสุทธิ"}</span>
          <span style={{ color: profit >= 0 ? T.green : T.accent }}>{formatCurrency(Math.abs(profit))}</span>
        </div>
      </div>

      <SectionHead icon={<History size={16} color={T.muted} />} title="ประวัติแมตช์" sub={`${(s.matches || []).length} เกม`} />
      {(s.matches || []).length === 0 ? <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: "8px 0", marginBottom: 18 }}>ยังไม่มีแมตช์ที่จบ</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
          {(s.matches || []).map((m) => <CompactMatch key={m.id} m={m} getP={getSP} onClick={() => {}} />)}
        </div>
      )}

      <button onClick={onDelete} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0", borderRadius: 11, background: "none", border: `1px solid ${T.accent}`, color: T.accent, fontSize: 13, fontWeight: 700 }}><Trash2 size={15} /> ลบประวัติก๊วน</button>
    </div>
  );
}

/* ============ FINANCE (v1.8.4) — dashboard scoped to sessionHistory + general income/expense ============ */
// drill-down detail for one archived session's finances only (revenue/collected/receivable + editable
// expenses + profit) — a narrower view than HistoricalDetail (which also shows matches/player photos/etc.)
function SessionFinancialDetail({ s, addHistExpense, updateHistExpense, removeHistExpense, onClose }) {
  const revenue = sessionRevenue(s);
  const collected = sessionCollected(s);
  const receivable = sessionReceivable(s);
  const expenseList = sessionExpenseList(s);
  const expenseTotal = sessionExpenseTotal(s);
  const profit = sessionProfit(s);
  return (
    <Overlay onClose={onClose}>
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 2 }}>{s.name || "ก๊วนไม่มีชื่อ"}</div>
      <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 14 }}>{fmtThaiDate(s.date)}</div>

      <SectionHead icon={<Wallet size={16} color={T.green} />} title="รายได้" />
      <div style={{ background: T.surface2, borderRadius: 12, padding: 12, marginBottom: 14 }}>
        <BillRow label="ยอดเรียกเก็บ" v={revenue} />
        <BillRow label="รับจริง" v={collected} />
        <BillRow label="ค้างรับ" v={receivable} />
      </div>

      <SectionHead icon={<Wallet size={16} color={T.accent} />} title="ค่าใช้จ่าย" sub="แก้ไขได้" />
      <div style={{ marginBottom: 14 }}>
        <ExpenseListEditor
          items={expenseList}
          categories={EXPENSE_CATEGORIES}
          onAdd={(item) => addHistExpense(s.id, item)}
          onUpdate={(id, patch) => updateHistExpense(s.id, id, patch)}
          onRemove={(id) => removeHistExpense(s.id, id)}
        />
      </div>

      <div style={{ background: T.surface2, borderRadius: 12, padding: 12 }}>
        <BillRow label="ค่าใช้จ่ายรวม" v={expenseTotal} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, marginTop: 6, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
          <span>{profit >= 0 ? "กำไรสุทธิ" : "ขาดทุนสุทธิ"}</span>
          <span style={{ color: profit >= 0 ? T.green : T.accent }}>{formatCurrency(Math.abs(profit))}</span>
        </div>
      </div>
    </Overlay>
  );
}

// ===================== FINANCE TAB (v1.9.6) — 3-level drill-down redesign =====================
// ภาพรวม (year/lifetime) → รายเดือน (one month) → รายวัน (one date) → existing group detail (SessionFinancialDetail).
// All figures come from the computeFinanceForRange family above — this component only picks a period and
// renders; it never re-sums anything itself (IMPLEMENTATION PRINCIPLE: one calculation source).
function FinanceTab({ sessionHistory, session, generalExpenses, otherIncome, addHistExpense, updateHistExpense, removeHistExpense, addGeneralExpense, updateGeneralExpense, removeGeneralExpense, addOtherIncome, updateOtherIncome, removeOtherIncome, discountCredits, applyDiscountCredits, cancelDiscountCredit, players, history, current, settings, setSettings, togglePaid, setPDiscount, applyWheelPrize, endSession, qrRef, courtCount, courtLabels, onOpenFinancePrint, tournamentHistory }) {
  // v1.9.9 IA cleanup (Phase 1): "ชำระเงิน" is no longer a standalone bottom-nav tab — it now lives here as
  // a sub-tab, reusing PaymentTab UNCHANGED (same payment logic/state/fee calc — no duplicated payment
  // system). Defaults to ชำระเงิน while a group session is actively running so the organizer lands where
  // they need to be during play; otherwise defaults to the finance dashboard. This only reads `current`
  // once on mount (by design) — manually switching away doesn't get overridden mid-session.
  const [payTab, setPayTab] = useState((current && current.length > 0) ? "payment" : "overview");
  const [mode, setMode] = useState("day"); // "day" | "month" | "overview"
  const [openId, setOpenId] = useState(null); // sessionHistory id opened in SessionFinancialDetail
  const [discountSheetOpen, setDiscountSheetOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(null); // "day-month" | "month-month" | "year" | null
  const [exportSheetOpen, setExportSheetOpen] = useState(false); // ส่งออกรายงานการเงิน (Financial Report Export)

  const allMonths = useMemo(() => getActiveMonths(sessionHistory, generalExpenses, otherIncome, tournamentHistory), [sessionHistory, generalExpenses, otherIncome, tournamentHistory]);
  const allYears = useMemo(() => getActiveYears(sessionHistory, generalExpenses, otherIncome, tournamentHistory), [sessionHistory, generalExpenses, otherIncome, tournamentHistory]);
  const defaultYm = allMonths[0] || todayYm();

  const [dayYm, setDayYm] = useState(defaultYm); // month currently shown by รายวัน's date-chip row
  const [selectedDate, setSelectedDate] = useState(null); // explicit pick within dayYm; auto-falls back to newest below
  const [monthYm, setMonthYm] = useState(defaultYm); // month currently shown by รายเดือน
  const [year, setYear] = useState(allYears[0] || "all"); // "YYYY" or "all" — ภาพรวม's selected period

  const datesInDayYm = useMemo(() => getActiveDates(dayYm, sessionHistory, generalExpenses, otherIncome, tournamentHistory), [dayYm, sessionHistory, generalExpenses, otherIncome, tournamentHistory]);
  const effectiveDate = datesInDayYm.includes(selectedDate) ? selectedDate : (datesInDayYm[0] || null);
  // ส่งออกรายงานการเงิน (Financial Report Export) — always follows whatever period is CURRENTLY selected on
  // this page (Requirement #2); the sheet itself may additionally offer a custom-range override.
  const exportDefaultPeriod = financePeriodMeta(mode, effectiveDate, monthYm, year, null);

  // drill-down: รายเดือน's daily-performance row -> รายวัน with that exact date selected (Requirement 8/11)
  const goDay = (dateStr) => { setMode("day"); setDayYm(dateStr.slice(0, 7)); setSelectedDate(dateStr); };
  // drill-down: ภาพรวม's monthly-performance row -> รายเดือน with that exact month selected (Requirement 10/11)
  const goMonth = (ym) => { setMode("month"); setMonthYm(ym); };

  // ส่วนลดคงเหลือ (Requirement 12) — an outstanding future credit is NOT a period expense, so this summary
  // deliberately ignores mode/dayYm/monthYm/year entirely; it only ever reflects live status:"available" credits.
  const availCredits = (discountCredits || []).filter((c) => c.status === "available");
  const availCreditTotal = availCredits.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const availCreditPeople = new Set(availCredits.map((c) => c.playerId || c.playerNameSnapshot)).size;
  const discountRow = availCredits.length > 0 ? (
    <button onClick={() => setDiscountSheetOpen(true)} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: T.surface, border: `1px solid ${T.border}`, marginBottom: 18 }}>
      <span style={{ fontSize: 15 }}>🎁</span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>ส่วนลดคงเหลือ — {availCreditPeople} คน · {formatCurrency(availCreditTotal)}</span>
      <ChevronRight size={16} color={T.muted} />
    </button>
  ) : (discountCredits || []).length > 0 ? (
    <div style={{ fontSize: 11.5, color: T.muted, padding: "0 2px 14px" }}>ไม่มีส่วนลดคงเหลือ</div>
  ) : null;

  const openSession = openId ? (sessionHistory || []).find((s) => s.id === openId) : null;
  const noDataAtAll = allMonths.length === 0;
  const emptyBlock = (msg) => <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: "30px 0" }}>{msg}</div>;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Seg options={[["payment", "ชำระเงิน"], ["overview", "ภาพรวมการเงิน"]]} value={payTab} onChange={setPayTab} />
      </div>

      {/* v1.11.6: FinanceTab already receives the FULL top-level roster as `players` (its own call site
          in App() was never changed to the archived-filtered activePlayers) — so PaymentTab below already
          sees every player regardless of archive status, and a member who played earlier today keeps
          showing up in their own unpaid bill even if archived mid-session. No change needed here. */}
      {payTab === "payment" ? (
        <PaymentTab players={players} history={history} current={current} settings={settings} setSettings={setSettings} togglePaid={togglePaid} session={session} setPDiscount={setPDiscount} applyWheelPrize={applyWheelPrize} endSession={endSession} qrRef={qrRef} discountCredits={discountCredits} applyDiscountCredits={applyDiscountCredits} courtCount={courtCount} courtLabels={courtLabels} />
      ) : (
      <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <SectionHead icon={<span style={{ fontSize: 16 }}>💰</span>} title="การเงิน" sub="รายรับ-รายจ่ายของก๊วน" />
        <button onClick={() => setExportSheetOpen(true)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 20, background: T.surface2, border: `1px solid ${T.border}`, fontSize: 12.5, fontWeight: 800, color: T.text, flexShrink: 0, marginBottom: 10 }}>📤 ส่งออก</button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Seg options={[["day", "รายวัน"], ["month", "รายเดือน"], ["overview", "ภาพรวม"]]} value={mode} onChange={setMode} />
      </div>

      {mode === "day" && (noDataAtAll ? emptyBlock("ยังไม่มีข้อมูลการเงิน") : (
        <>
          <MonthNav ym={dayYm} months={allMonths} onChange={(ym) => { setDayYm(ym); setSelectedDate(null); }} onOpenPicker={() => setPickerOpen("day-month")} />
          {datesInDayYm.length === 0 ? emptyBlock("ไม่มีรายการในเดือนนี้") : (() => {
            const f = getFinanceForDate(effectiveDate, sessionHistory, generalExpenses, otherIncome, tournamentHistory);
            return (
              <>
                <DayChipRow dates={datesInDayYm} selected={effectiveDate} onSelect={setSelectedDate} />
                <div style={{ fontSize: 13, fontWeight: 800, color: T.muted, marginBottom: 8 }}>{fmtThaiDateFull(effectiveDate)}</div>
                <FinanceSummaryCard revenue={f.revenue} expense={f.expense} profit={f.profit} />
                <FinancePL sessionRevenueTotal={f.sessionRevenueTotal} otherIncomeTotal={f.otherIncomeTotal} tournamentIncomeTotal={f.tournamentIncomeTotal} catTotals={f.catTotals} expense={f.expense} profit={f.profit} />
                {discountRow}
                <FinanceGroupsList title="ก๊วนในวันนี้" sessions={f.sessionsInRange} onOpen={setOpenId} />
                {f.tournamentsInRange.length > 0 && <TournamentFinanceGroupsList title="ทัวร์นาเมนต์ในวันนี้" tournaments={f.tournamentsInRange} />}
                <SectionHead title="ค่าใช้จ่ายทั่วไป" sub="ไม่ผูกกับก๊วน" />
                <div style={{ marginBottom: 18 }}><ExpenseListEditor items={f.genExpInRange} categories={EXPENSE_CATEGORIES} onAdd={addGeneralExpense} onUpdate={updateGeneralExpense} onRemove={removeGeneralExpense} /></div>
                <SectionHead title="รายได้อื่น" sub="สปอนเซอร์ / รายได้นอกก๊วน" />
                <div style={{ marginBottom: 10 }}><ExpenseListEditor items={f.otherIncInRange} onAdd={addOtherIncome} onUpdate={updateOtherIncome} onRemove={removeOtherIncome} /></div>
              </>
            );
          })()}
        </>
      ))}

      {mode === "month" && (noDataAtAll ? emptyBlock("ยังไม่มีข้อมูลการเงิน") : (
        <>
          <MonthNav ym={monthYm} months={allMonths} onChange={setMonthYm} onOpenPicker={() => setPickerOpen("month-month")} />
          {(() => {
            const f = getFinanceForMonth(monthYm, sessionHistory, generalExpenses, otherIncome, tournamentHistory);
            const empty = f.sessionsInRange.length === 0 && f.genExpInRange.length === 0 && f.otherIncInRange.length === 0 && f.tournamentsInRange.length === 0;
            if (empty) return emptyBlock("ไม่มีรายการในเดือนนี้");
            const days = financeByDay(monthYm, sessionHistory, generalExpenses, otherIncome, tournamentHistory);
            return (
              <>
                <FinanceSummaryCard revenue={f.revenue} expense={f.expense} profit={f.profit} />
                <FinancePL sessionRevenueTotal={f.sessionRevenueTotal} otherIncomeTotal={f.otherIncomeTotal} tournamentIncomeTotal={f.tournamentIncomeTotal} catTotals={f.catTotals} expense={f.expense} profit={f.profit} />
                {discountRow}
                <FinancePerformanceList title="ผลประกอบการรายวัน" rows={days.map((d) => ({ key: d.date, label: fmtThaiMonthDay(d.date), count: d.sessionCount, profit: d.profit }))} onPick={goDay} />
                {f.tournamentsInRange.length > 0 && <TournamentFinanceGroupsList title="ทัวร์นาเมนต์ในเดือนนี้" tournaments={f.tournamentsInRange} />}
                <SectionHead title="ค่าใช้จ่ายทั่วไป" sub="ไม่ผูกกับก๊วน" />
                <div style={{ marginBottom: 18 }}><ExpenseListEditor items={f.genExpInRange} categories={EXPENSE_CATEGORIES} onAdd={addGeneralExpense} onUpdate={updateGeneralExpense} onRemove={removeGeneralExpense} /></div>
                <SectionHead title="รายได้อื่น" sub="สปอนเซอร์ / รายได้นอกก๊วน" />
                <div style={{ marginBottom: 10 }}><ExpenseListEditor items={f.otherIncInRange} onAdd={addOtherIncome} onUpdate={updateOtherIncome} onRemove={removeOtherIncome} /></div>
              </>
            );
          })()}
        </>
      ))}

      {mode === "overview" && (allYears.length === 0 ? emptyBlock("ยังไม่มีข้อมูลการเงิน") : (
        <>
          <div style={{ textAlign: "center" }}>
            <button onClick={() => setPickerOpen("year")} style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: "0 auto 16px", padding: "8px 16px", borderRadius: 20, background: T.surface2, border: `1px solid ${T.border}`, fontSize: 15, fontWeight: 800, color: T.text }}>
              {year === "all" ? "ทั้งหมด" : Number(year) + 543} <ChevronDown size={16} color={T.muted} />
            </button>
          </div>
          {(() => {
            const f = year === "all" ? getFinanceAllTime(sessionHistory, generalExpenses, otherIncome, tournamentHistory) : getFinanceForYear(year, sessionHistory, generalExpenses, otherIncome, tournamentHistory);
            const months = financeByMonthForYear(year, sessionHistory, generalExpenses, otherIncome, tournamentHistory);
            return (
              <>
                <FinanceSummaryCard revenue={f.revenue} expense={f.expense} profit={f.profit} />
                <FinancePL sessionRevenueTotal={f.sessionRevenueTotal} otherIncomeTotal={f.otherIncomeTotal} tournamentIncomeTotal={f.tournamentIncomeTotal} catTotals={f.catTotals} expense={f.expense} profit={f.profit} />
                {discountRow}
                <FinancePerformanceList title="ผลประกอบการรายเดือน" rows={months.map((m) => ({ key: m.ym, label: fmtThaiMonthLabel(m.ym), count: null, profit: m.profit }))} onPick={goMonth} />
                {f.tournamentsInRange.length > 0 && <TournamentFinanceGroupsList title="ทัวร์นาเมนต์ในช่วงนี้" tournaments={f.tournamentsInRange} />}
                <SectionHead title="ค่าใช้จ่ายทั่วไป" sub="ไม่ผูกกับก๊วน" />
                <div style={{ marginBottom: 18 }}><ExpenseListEditor items={f.genExpInRange} categories={EXPENSE_CATEGORIES} onAdd={addGeneralExpense} onUpdate={updateGeneralExpense} onRemove={removeGeneralExpense} /></div>
                <SectionHead title="รายได้อื่น" sub="สปอนเซอร์ / รายได้นอกก๊วน" />
                <div style={{ marginBottom: 10 }}><ExpenseListEditor items={f.otherIncInRange} onAdd={addOtherIncome} onUpdate={updateOtherIncome} onRemove={removeOtherIncome} /></div>
              </>
            );
          })()}
        </>
      ))}

      {openSession && <SessionFinancialDetail s={openSession} addHistExpense={addHistExpense} updateHistExpense={updateHistExpense} removeHistExpense={removeHistExpense} onClose={() => setOpenId(null)} />}
      {discountSheetOpen && (
        <DiscountCreditSheet
          discountCredits={discountCredits}
          session={session}
          sessionHistory={sessionHistory}
          applyDiscountCredits={applyDiscountCredits}
          cancelDiscountCredit={cancelDiscountCredit}
          onClose={() => setDiscountSheetOpen(false)}
        />
      )}
      {pickerOpen === "day-month" && <MonthPickerSheet months={allMonths} onPick={(ym) => { setDayYm(ym); setSelectedDate(null); }} onClose={() => setPickerOpen(null)} />}
      {pickerOpen === "month-month" && <MonthPickerSheet months={allMonths} onPick={setMonthYm} onClose={() => setPickerOpen(null)} />}
      {pickerOpen === "year" && <YearPickerSheet years={allYears} onPick={setYear} onClose={() => setPickerOpen(null)} />}
      {exportSheetOpen && (
        <FinanceExportSheet
          defaultPeriod={exportDefaultPeriod}
          sessionHistory={sessionHistory}
          generalExpenses={generalExpenses}
          otherIncome={otherIncome}
          discountCredits={discountCredits}
          tournamentHistory={tournamentHistory}
          onOpenPrint={onOpenFinancePrint}
          onClose={() => setExportSheetOpen(false)}
        />
      )}
      </>
      )}
    </div>
  );
}

// ===================== FINANCIAL REPORT EXPORT — BOTTOM SHEET (Requirement #1) =====================
// Compact entry point's sheet: shows the period currently being exported (always follows what's selected on
// the Finance page — Requirement #2 — with an optional custom-range override scoped to export only, so it
// never touches the Finance page's own period selection), a live preview, then TXT / Excel / PDF.
function FinanceExportSheet({ defaultPeriod, sessionHistory, generalExpenses, otherIncome, discountCredits, tournamentHistory, onOpenPrint, onClose }) {
  const [customOn, setCustomOn] = useState(false);
  const [customFrom, setCustomFrom] = useState(defaultPeriod ? defaultPeriod.range.from.slice(0, 10) : "");
  const [customTo, setCustomTo] = useState(defaultPeriod ? defaultPeriod.range.to.slice(0, 10) : "");
  const [busy, setBusy] = useState(null); // "txt" | "xlsx" | null
  const [status, setStatus] = useState(null); // { kind: "ok"|"error", msg } | null

  const period = useMemo(() => {
    if (customOn && customFrom && customTo) return financePeriodMeta(null, null, null, null, { from: customFrom, to: customTo });
    return defaultPeriod;
  }, [customOn, customFrom, customTo, defaultPeriod]);

  const ctx = { sessionHistory, generalExpenses, otherIncome, discountCredits, tournamentHistory };
  const report = useMemo(() => (period ? buildFinancialReport(period, ctx) : null), [period, sessionHistory, generalExpenses, otherIncome, discountCredits, tournamentHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  const isEmpty = report && report.sessions.length === 0 && report.transactions.length === 0 && report.outstandingPayments.length === 0 && report.discountCredits.length === 0;

  const doExport = async (fmt) => {
    if (!report) return;
    setBusy(fmt);
    setStatus(null);
    try {
      const outcome = fmt === "txt" ? await downloadFinancialReportTxt(report) : await downloadFinancialReportXlsx(report);
      if (outcome === "done") setStatus({ kind: "ok", msg: "บันทึก/แชร์ไฟล์แล้ว" });
      else if (outcome === "cancelled") setStatus(null);
      else setStatus({ kind: "error", msg: "ส่งออกไม่สำเร็จ ลองอีกครั้ง" });
    } catch (e) {
      setStatus({ kind: "error", msg: "ส่งออกไม่สำเร็จ ลองอีกครั้ง" });
    }
    setBusy(null);
  };
  const openPdf = () => {
    if (!report || !onOpenPrint) return;
    onOpenPrint(report);
    onClose();
  };
  const rowStyle = { display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "3px 0" };

  return (
    <Overlay onClose={onClose}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>ส่งออกรายงานการเงิน</div>

      <div style={{ fontSize: 11.5, fontWeight: 800, color: T.muted, marginBottom: 4 }}>ช่วงเวลา</div>
      <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 10 }}>{period ? period.label : "-"}</div>
      <button onClick={() => setCustomOn((v) => !v)} style={{ fontSize: 12, fontWeight: 700, color: T.accent, background: "none", border: "none", padding: 0, marginBottom: customOn ? 8 : 14 }}>
        {customOn ? "✕ ยกเลิกกำหนดช่วงเอง" : "กำหนดช่วงวันที่เอง"}
      </button>
      {customOn && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={{ flex: 1, padding: "8px 10px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 13 }} />
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={{ flex: 1, padding: "8px 10px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 13 }} />
        </div>
      )}

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 14px", marginBottom: 16 }}>
        {isEmpty && <div style={{ fontSize: 13, color: T.muted, textAlign: "center", padding: "6px 0" }}>ไม่พบข้อมูลการเงินในช่วงเวลานี้</div>}
        <div style={rowStyle}><span style={{ color: T.muted }}>{report ? `${report.sessions.length} ก๊วน` : "-"}</span><span /></div>
        <div style={rowStyle}><span>รายได้</span><span style={{ fontWeight: 800 }}>{report ? formatCurrency(report.summary.revenue) : "-"}</span></div>
        <div style={rowStyle}><span>ค่าใช้จ่าย</span><span style={{ fontWeight: 800 }}>{report ? formatCurrency(report.summary.expense) : "-"}</span></div>
        <div style={rowStyle}>
          <span>{report && report.summary.profit < 0 ? "ขาดทุน" : "กำไร"}</span>
          <span style={{ fontWeight: 800, color: report && report.summary.profit < 0 ? T.accent : T.green }}>{report ? formatCurrency(Math.abs(report.summary.profit)) : "-"}</span>
        </div>
      </div>

      {status && <div style={{ fontSize: 12.5, fontWeight: 700, color: status.kind === "ok" ? T.green : T.accent, textAlign: "center", marginBottom: 10 }}>{status.msg}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[["txt", "📄 TXT"], ["xlsx", "📊 Excel"]].map(([fmt, label]) => (
          <button
            key={fmt}
            disabled={!report || busy !== null}
            onClick={() => doExport(fmt)}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, background: T.surface2, border: `1px solid ${T.border}`, fontSize: 14, fontWeight: 800, color: T.text, opacity: !report || busy !== null ? 0.6 : 1 }}
          >
            {busy === fmt ? "กำลังสร้างไฟล์…" : label}
          </button>
        ))}
        <button disabled={!report} onClick={openPdf} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, background: T.surface2, border: `1px solid ${T.border}`, fontSize: 14, fontWeight: 800, color: T.text, opacity: !report ? 0.6 : 1 }}>
          🖨️ PDF
        </button>
      </div>
    </Overlay>
  );
}

// ===================== FINANCIAL REPORT EXPORT — PDF PRINT VIEW (Requirements #15/#16) =====================
// Small reusable table for the print report's detail sections — plain <table>, browsers paginate long ones
// across pages on their own (Requirement #16 "long tables may continue on the next page").
function PrintTable({ headers, rows, rightCols }) {
  const isRight = (i) => !!(rightCols && rightCols.includes(i));
  const th = { border: "1px solid #ccc", padding: "4px 6px", fontSize: 10.5, fontWeight: 800, background: "#f3f6f4" };
  const td = { border: "1px solid #ddd", padding: "4px 6px", fontSize: 10.5 };
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 4 }}>
      <thead>
        <tr>{headers.map((h, i) => <th key={i} style={{ ...th, textAlign: isRight(i) ? "right" : "left" }}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={headers.length} style={{ ...td, textAlign: "center", color: "#6b7d74" }}>ไม่มีรายการ</td></tr>
        ) : rows.map((r, ri) => (
          <tr key={ri}>{r.map((c, ci) => <td key={ci} style={{ ...td, textAlign: isRight(ci) ? "right" : "left" }}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}
function PrintSectionTitle({ children }) {
  return <div style={{ fontSize: 13, fontWeight: 800, margin: "18px 0 6px", color: "#16241d" }}>{children}</div>;
}
function FinancePrintView({ report, onClose }) {
  const negative = report.summary.profit < 0;
  const negativePnl = report.pnl.netProfit < 0;
  const expenseRows = Object.entries(report.pnl.expenseByCategory).filter(([, amt]) => amt > 0);
  return (
    <div style={{ background: "#fff", color: "#16241d", minHeight: "100vh", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 14mm; }
          .fpv-noprint { display: none !important; }
          .fpv-page { padding: 0 !important; }
          .fpv-avoidbreak { break-inside: avoid; }
        }
      `}</style>
      <div className="fpv-noprint" style={{ position: "sticky", top: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#16241d", color: "#fff", zIndex: 5 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", fontSize: 14, fontWeight: 700 }}>‹ ปิด</button>
        <button onClick={() => window.print()} style={{ background: "#fff", color: "#16241d", border: "none", borderRadius: 20, padding: "8px 16px", fontSize: 13.5, fontWeight: 800 }}>🖨️ พิมพ์ / บันทึกเป็น PDF</button>
      </div>
      <div className="fpv-page" style={{ maxWidth: 780, margin: "0 auto", padding: "20px 18px 60px", boxSizing: "border-box" }}>
        <div className="fpv-avoidbreak" style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>BadQ</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>รายงานการเงิน</div>
          <div style={{ fontSize: 12.5, color: "#6b7d74" }}>ช่วงเวลา: {report.period.label}</div>
          <div style={{ fontSize: 11, color: "#6b7d74" }}>วันที่สร้างรายงาน: {fmtGeneratedAt(report.generatedAt)}</div>
        </div>

        <div className="fpv-avoidbreak" style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          {[["รายได้", report.summary.revenue, "#16241d"], ["ค่าใช้จ่าย", report.summary.expense, "#16241d"], [negative ? "ขาดทุนสุทธิ" : "กำไรสุทธิ", Math.abs(report.summary.profit), negative ? "#ef5a44" : "#12986a"]].map(([label, amt, color], i) => (
            <div key={i} style={{ flex: 1, border: "1px solid #dde5e1", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 10.5, color: "#6b7d74", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color }}>{formatCurrency(amt)}</div>
            </div>
          ))}
        </div>

        <PrintSectionTitle>สรุป</PrintSectionTitle>
        <PrintTable
          headers={["รายการ", "จำนวนเงิน"]}
          rightCols={[1]}
          rows={[
            ["รายได้", formatCurrency(report.summary.revenue)],
            ["รับแล้ว", formatCurrency(report.summary.collected)],
            ["ค้างรับ", formatCurrency(report.summary.receivable)],
            ["ค่าใช้จ่าย", formatCurrency(report.summary.expense)],
            [negative ? "ขาดทุนสุทธิ" : "กำไรสุทธิ", formatCurrency(Math.abs(report.summary.profit))],
          ]}
        />

        <PrintSectionTitle>สรุปกำไรขาดทุน</PrintSectionTitle>
        <PrintTable
          headers={["รายการ", "จำนวนเงิน"]}
          rightCols={[1]}
          rows={[
            ["รายได้ค่าก๊วน", formatCurrency(report.pnl.groupRevenue)],
            ["รายได้อื่น", formatCurrency(report.pnl.otherIncome)],
            ...(report.pnl.tournamentIncome > 0 ? [["รายได้ Tournament", formatCurrency(report.pnl.tournamentIncome)]] : []),
            ["รายได้รวม", formatCurrency(report.pnl.totalRevenue)],
            ...expenseRows.map(([cat, amt]) => [cat, formatCurrency(amt)]),
            ["ค่าใช้จ่ายรวม", formatCurrency(report.pnl.totalExpense)],
            [negativePnl ? "ขาดทุนสุทธิ" : "กำไรสุทธิ", formatCurrency(Math.abs(report.pnl.netProfit))],
          ]}
        />

        <PrintSectionTitle>รายก๊วน</PrintSectionTitle>
        <PrintTable
          headers={["วันที่", "ชื่อก๊วน", "ผู้เล่น", "แมตช์", "สนาม", "รายได้", "ค่าใช้จ่าย", "กำไร/ขาดทุน"]}
          rightCols={[2, 3, 4, 5, 6, 7]}
          rows={report.sessions.map((s) => [fmtThaiDateFull(s.date), s.name, s.playerCount, s.matchCount, s.courtCount, formatCurrency(s.revenue), formatCurrency(s.expense), formatCurrency(s.profit)])}
        />

        <PrintSectionTitle>รายรับรายจ่าย</PrintSectionTitle>
        <PrintTable
          headers={["วันที่", "ประเภท", "หมวด", "รายละเอียด", "ก๊วน", "จำนวนเงิน"]}
          rightCols={[5]}
          rows={report.transactions.map((t) => [fmtThaiDateFull(t.date), t.type === "revenue" ? "รายได้" : "ค่าใช้จ่าย", t.category, t.description, t.session, formatCurrency(t.amount)])}
        />

        <PrintSectionTitle>ค้างชำระ</PrintSectionTitle>
        <PrintTable
          headers={["วันที่", "ก๊วน", "ผู้เล่น", "ยอดที่ต้องชำระ", "รับแล้ว", "ค้างชำระ"]}
          rightCols={[3, 4, 5]}
          rows={report.outstandingPayments.length === 0 ? [] : report.outstandingPayments.map((o) => [fmtThaiDateFull(o.date), o.sessionName, o.playerName, formatCurrency(o.due), formatCurrency(o.collected), formatCurrency(o.outstanding)])}
        />
        {report.outstandingPayments.length === 0 && <div style={{ fontSize: 11.5, color: "#6b7d74", marginTop: -6, marginBottom: 8 }}>ไม่มีรายการค้างชำระ</div>}

        <PrintSectionTitle>ส่วนลดคงเหลือ</PrintSectionTitle>
        <PrintTable
          headers={["ผู้เล่น", "จำนวนเงิน", "ก๊วนต้นทาง", "สถานะ"]}
          rightCols={[1]}
          rows={report.discountCredits.length === 0 ? [] : report.discountCredits.map((c) => [c.playerName, formatCurrency(c.amount), c.sourceSession, c.status])}
        />
        {report.discountCredits.length === 0 && <div style={{ fontSize: 11.5, color: "#6b7d74", marginTop: -6, marginBottom: 8 }}>ไม่มีส่วนลดคงเหลือ</div>}

        <div style={{ textAlign: "center", fontSize: 10.5, color: "#6b7d74", marginTop: 24, borderTop: "1px solid #dde5e1", paddingTop: 10 }}>
          สร้างจาก BadQ · {fmtGeneratedAt(report.generatedAt)}
        </div>
      </div>
    </div>
  );
}

/* ============ v1.11.4: dedicated Tournament PDF export ============
   Same print-to-PDF mechanism as FinancePrintView (proven, already used in this app): a full-screen
   print-only view mounted via an early return in App() so the bottom nav/tabs/edit controls are
   guaranteed absent from both the on-screen preview and the saved PDF — never a screenshot of the
   mobile UI, and built entirely from the SAME buildTournamentResultReport used by the Summary page/
   Podium/Bracket/Share text (never a separate calculation of champion/scores for the PDF).
   Design note: every page stays A4-portrait, including the bracket page, rather than switching to
   landscape mid-document — mixing page orientations inside one print job is unreliable across
   browsers/OS print pipelines (notably iOS Safari's Share-Sheet print path, which cannot be verified
   from this headless environment) — so the bracket instead uses a compact multi-column layout sized
   to fit A4-portrait width for up to 4 rounds (16 teams), falling back to a stacked round-by-round
   layout for bigger brackets where a forced side-by-side layout would otherwise turn illegible. */
function tournamentPdfFilename(t) {
  const clean = (t.name || "Tournament").replace(/[^\p{L}\p{N}\- ]/gu, "").trim().replace(/\s+/g, "-");
  return `BadQ_${clean || "Tournament"}_${t.date || "report"}`;
}
function PrintPodiumBlock({ podium, teamsById, peopleById }) {
  if (!podium || !podium.champion) {
    return <div style={{ textAlign: "center", padding: "16px 0", color: "#6b7d74", fontSize: 12.5 }}>ยังไม่ทราบผู้ชนะ — Tournament กำลังดำเนินอยู่</div>;
  }
  const champTeam = teamsById[podium.champion];
  const champName = tTeamName(champTeam, peopleById);
  const runnerTeam = podium.runnerUp ? teamsById[podium.runnerUp] : null;
  const runnerName = runnerTeam ? tTeamName(runnerTeam, peopleById) : null;
  const thirdIds = podium.thirdIds || [];
  const thirdNames = thirdIds.map((id) => tTeamName(teamsById[id], peopleById));
  return (
    <div className="tpv-avoidbreak" style={{ textAlign: "center", marginBottom: 12 }}>
      <div style={{ border: "1.5px solid #d97706", background: "#fff8ec", borderRadius: 10, padding: "14px 10px", marginBottom: 8 }}>
        <div style={{ fontSize: 32 }}>🏆</div>
        <div style={{ fontSize: 11, color: "#d97706", fontWeight: 800, letterSpacing: 0.5, marginBottom: 5 }}>แชมป์เปี้ยน</div>
        <PodiumTeamPeople team={champTeam} peopleById={peopleById} photoSize={36} fontSize={12.5} gap={16} />
      </div>
      {(runnerName || thirdNames.length > 0) && (
        <div style={{ display: "flex", gap: 8 }}>
          {runnerName && (
            <div style={{ flex: 1, border: "1px solid #dde5e1", borderRadius: 8, padding: "8px 6px" }}>
              <div style={{ fontSize: 20 }}>🥈</div>
              <div style={{ fontSize: 10, color: "#6b7d74", fontWeight: 700, marginBottom: 4 }}>รองแชมป์</div>
              <PodiumTeamPeople team={runnerTeam} peopleById={peopleById} photoSize={26} fontSize={11} gap={8} maxWidth={54} />
            </div>
          )}
          {thirdNames.length > 0 && (
            <div style={{ flex: 1, border: "1px solid #dde5e1", borderRadius: 8, padding: "8px 6px" }}>
              <div style={{ fontSize: 20 }}>🥉</div>
              <div style={{ fontSize: 10, color: "#6b7d74", fontWeight: 700, marginBottom: 4 }}>{thirdNames.length > 1 ? "ร่วมอันดับ 3" : "อันดับ 3"}</div>
              {thirdIds.length > 1 ? (
                <div style={{ display: "flex", gap: 5 }}>
                  {thirdIds.map((id) => <div key={id} style={{ flex: 1, minWidth: 0 }}><PodiumTeamPeople team={teamsById[id]} peopleById={peopleById} photoSize={16} fontSize={8} gap={3} maxWidth={30} /></div>)}
                </div>
              ) : (
                <PodiumTeamPeople team={teamsById[thirdIds[0]]} peopleById={peopleById} photoSize={26} fontSize={11} gap={8} maxWidth={54} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
function PrintBracket({ divisions, teamsById, peopleById }) {
  const th = { fontSize: 9.5, fontWeight: 800, color: "#6b7d74", textAlign: "center", marginBottom: 4 };
  const renderMatch = (m) => {
    const lbl = tMatchLabel(m, teamsById, peopleById);
    const sc = matchScoreText(m);
    return (
      <div key={m.id} style={{ border: "1px solid #dde5e1", borderRadius: 6, padding: "5px 6px", marginBottom: 5, fontSize: 9.5 }}>
        <div style={{ fontWeight: m.winnerTeamId === m.teamAId ? 800 : 500, color: m.winnerTeamId === m.teamAId ? "#12986a" : "#16241d" }}>{lbl.a}</div>
        <div style={{ fontWeight: m.winnerTeamId === m.teamBId ? 800 : 500, color: m.winnerTeamId === m.teamBId ? "#12986a" : "#16241d" }}>{lbl.b}</div>
        {sc && <div style={{ color: "#6b7d74", fontSize: 8.5, marginTop: 1 }}>{sc}</div>}
      </div>
    );
  };
  return (
    <div>
      {divisions.map((d) => {
        if (!d.bracket) return null;
        const rounds = bracketRoundsWithFixedLabels(d.bracket);
        const wide = rounds.length <= 4;
        // no break-avoidance wrapper on the div below on purpose: a bracket can span many rows/pages,
        // and an unbreakable box taller than one page forces the WHOLE thing onto the next page instead
        // of flowing naturally — leaving a near-blank page behind it (found via a real 32-team-bracket
        // PDF render during testing). Each match card/round-title chunk is small enough to paginate
        // cleanly on its own without needing the wrapper.
        return (
          <div key={d.id} style={{ marginBottom: 16 }}>
            {divisions.length > 1 && <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>{d.name}</div>}
            {wide ? (
              <div style={{ display: "flex", gap: 8 }}>
                {rounds.map((r) => (
                  <div key={r.index} style={{ flex: 1, minWidth: 0 }}>
                    <div style={th}>{r.label}</div>
                    {r.matchIds.map((mid) => { const m = d.bracket.matches.find((x) => x.id === mid); return m ? renderMatch(m) : null; })}
                  </div>
                ))}
              </div>
            ) : (
              // CSS grid, not flexbox, for the match cards: Chromium's print pagination treats a
              // flex container as one atomic unbreakable block, so a flex-wrap grid of many matches
              // either fits entirely on the current page or jumps whole to the next one — leaving a
              // near-blank page behind it for a big bracket. A grid's cells paginate individually.
              rounds.map((r) => (
                <div key={r.index} style={{ marginBottom: 10 }}>
                  <div style={{ ...th, textAlign: "left" }}>{r.label}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {r.matchIds.map((mid) => { const m = d.bracket.matches.find((x) => x.id === mid); return m ? <div key={mid}>{renderMatch(m)}</div> : null; })}
                  </div>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
function TournamentPrintView({ report, onClose }) {
  const { t, teamsById, peopleById, divisions, totals, playerStats, podium, isCompleted } = report;
  // best-effort filename hint for "Save as PDF" — most browsers title the suggested PDF file after
  // document.title at the moment window.print() is invoked; restored on unmount so it never leaks
  // into the rest of the app (tab title, etc).
  useEffect(() => {
    const original = document.title;
    document.title = tournamentPdfFilename(t);
    return () => { document.title = original; };
  }, []);
  const groupsFlat = divisions.flatMap((d) => (d.groups || []).map((g) => ({ ...g, divisionName: d.name })));
  const hasQualifyMarks = groupsFlat.some((g) => (g.teamIds || []).some((id) => teamsById[id]?.groupRank != null));
  return (
    <div style={{ background: "#fff", color: "#16241d", minHeight: "100vh", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 14mm; }
          html, body { background: #fff !important; } /* app's own body bg (#f3f6f4) would otherwise
            show through any leftover space past the last printed page's content */
          .tpv-noprint { display: none !important; }
          .tpv-page { padding: 0 !important; }
          .tpv-avoidbreak { break-inside: avoid; }
          .tpv-pagebreak { page-break-before: always; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <div className="tpv-noprint" style={{ position: "sticky", top: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#16241d", color: "#fff", zIndex: 5 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", fontSize: 14, fontWeight: 700 }}>‹ ปิด</button>
        <button onClick={() => window.print()} style={{ background: "#fff", color: "#16241d", border: "none", borderRadius: 20, padding: "8px 16px", fontSize: 13.5, fontWeight: 800 }}>🖨️ พิมพ์ / บันทึกเป็น PDF</button>
      </div>
      <div className="tpv-page" style={{ maxWidth: 780, margin: "0 auto", padding: "20px 18px 60px", boxSizing: "border-box" }}>
        <div className="tpv-avoidbreak" style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#12986a" }}>BadQ</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>{t.name || "Tournament ไม่มีชื่อ"}</div>
          <div style={{ fontSize: 12, color: "#6b7d74", marginTop: 3 }}>{fmtThaiDateFull(t.date)} · {totals.teamCount} ทีม · {totals.playerCount} คน · {totals.stagePath}</div>
          {!isCompleted && <div style={{ display: "inline-block", marginTop: 6, padding: "3px 10px", borderRadius: 20, background: "#fef3c7", color: "#92400e", fontSize: 11, fontWeight: 800 }}>สถานะ: กำลังแข่งขัน</div>}
        </div>
        <PrintPodiumBlock podium={podium} teamsById={teamsById} peopleById={peopleById} />

        {totals.hasBracket && (
          <div className="tpv-pagebreak">
            <PrintSectionTitle>Knockout Bracket</PrintSectionTitle>
            <PrintBracket divisions={divisions} teamsById={teamsById} peopleById={peopleById} />
          </div>
        )}

        {totals.hasGroups && (
          <div className="tpv-pagebreak">
            <PrintSectionTitle>ผลรอบแบ่งกลุ่ม (Group Stage)</PrintSectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {groupsFlat.map((g) => {
                const gTeams = (g.teamIds || []).map((id) => teamsById[id]).filter(Boolean);
                const qualifyCount = gTeams.filter((tm) => tm && tm.groupRank != null).length;
                const standings = computeStandings(gTeams, g.matches || [], t.pointsConfig);
                return (
                  <div key={g.id} className="tpv-avoidbreak">
                    <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>Group {g.name}</div>
                    <PrintTable
                      headers={["ทีม", "P", "W", "L", "Pts", "+/-"]}
                      rightCols={[1, 2, 3, 4, 5]}
                      rows={standings.map((row, i) => {
                        const team = gTeams.find((tm) => tm.id === row.teamId);
                        return [`${i + 1}. ${team ? tTeamName(team, peopleById) : "-"}${qualifyCount > 0 && i < qualifyCount ? " ✓" : ""}`, row.played, row.win, row.loss, row.points, (row.diff > 0 ? "+" : "") + row.diff];
                      })}
                    />
                  </div>
                );
              })}
            </div>
            {hasQualifyMarks && <div style={{ fontSize: 9.5, color: "#12986a", marginTop: 6 }}>✓ ผ่านเข้ารอบ Knockout</div>}
          </div>
        )}

        {playerStats.length > 0 && (
          <div className="tpv-pagebreak">
            <PrintSectionTitle>สถิติผู้เล่น</PrintSectionTitle>
            <PrintTable
              headers={["ผู้เล่น", "ชนะ", "แพ้"]}
              rightCols={[1, 2]}
              rows={[...playerStats].sort((a, b) => b.wins - a.wins).map((ps) => [peopleById[ps.playerId]?.name || "?", ps.wins, ps.losses])}
            />
          </div>
        )}

        <div style={{ textAlign: "center", fontSize: 10.5, color: "#6b7d74", marginTop: 24, borderTop: "1px solid #dde5e1", paddingTop: 10 }}>
          สร้างจาก BadQ · {fmtGeneratedAt(Date.now())}
        </div>
      </div>
    </div>
  );
}

// ‹ month › nav shared by รายวัน and รายเดือน — arrows jump to the nearest ACTIVE month (can skip empty
// months/years entirely, Requirement 3); tapping the label opens the compact picker sheet instead of a
// full calendar (Requirement 3/19).
function MonthNav({ ym, months, onChange, onOpenPicker }) {
  const prev = adjacentActiveMonth(ym, "prev", months);
  const next = adjacentActiveMonth(ym, "next", months);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 14 }}>
      <button onClick={() => prev && onChange(prev)} disabled={!prev} style={{ background: "none", border: "none", padding: 8, fontSize: 20, fontWeight: 700, color: prev ? T.text : T.border, cursor: prev ? "pointer" : "default" }}>‹</button>
      <button onClick={onOpenPicker} style={{ background: "none", border: "none", fontSize: 15, fontWeight: 800, color: T.text, padding: "4px 8px", minWidth: 140, textAlign: "center" }}>{fmtThaiMonthFull(ym)}</button>
      <button onClick={() => next && onChange(next)} disabled={!next} style={{ background: "none", border: "none", padding: 8, fontSize: 20, fontWeight: 700, color: next ? T.text : T.border, cursor: next ? "pointer" : "default" }}>›</button>
    </div>
  );
}

// only the DATES that actually have financial activity — never a 1–31 calendar grid (Requirement 2/16)
function DayChipRow({ dates, selected, onSelect }) {
  if (!dates.length) return null;
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 14 }}>
      {dates.map((d) => {
        const dayNum = Number(d.slice(8, 10));
        const active = d === selected;
        return (
          <button key={d} onClick={() => onSelect(d)} style={{ flexShrink: 0, minWidth: 42, padding: "8px 4px", borderRadius: 12, border: `1.5px solid ${active ? T.green : T.border}`, background: active ? "#e2f5ec" : T.surface, color: active ? T.green : T.text, fontSize: 13.5, fontWeight: 800 }}>{dayNum}</button>
        );
      })}
    </div>
  );
}

// ONE compact row — รายได้ | ค่าใช้จ่าย | กำไร/ขาดทุน — replaces the old 3 stacked cards (Requirement 4/14)
function FinanceSummaryCard({ revenue, expense, profit }) {
  const loss = profit < 0;
  const col = { flex: 1, padding: "12px 4px", textAlign: "center", minWidth: 0 };
  return (
    <div style={{ display: "flex", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, marginBottom: 16, overflow: "hidden" }}>
      <div style={{ ...col, borderRight: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 11, color: T.muted, marginBottom: 3 }}>รายได้</div>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatCurrency(revenue)}</div>
      </div>
      <div style={{ ...col, borderRight: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 11, color: T.muted, marginBottom: 3 }}>ค่าใช้จ่าย</div>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: T.accent, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatCurrency(expense)}</div>
      </div>
      <div style={col}>
        <div style={{ fontSize: 11, color: T.muted, marginBottom: 3 }}>{loss ? "ขาดทุน" : "กำไร"}</div>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: loss ? T.accent : T.green, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatCurrency(Math.abs(profit))}</div>
      </div>
    </div>
  );
}

// สรุปกำไรขาดทุน — same P&L shape at every period level (Requirement 5/7/10), one shared renderer
function FinancePL({ sessionRevenueTotal, otherIncomeTotal, tournamentIncomeTotal, catTotals, expense, profit }) {
  return (
    <>
      <SectionHead title="สรุปกำไรขาดทุน" />
      <div style={{ background: T.surface2, borderRadius: 12, padding: 12, marginBottom: 18 }}>
        <BillRow label="รายได้ (ค่าก๊วน)" v={sessionRevenueTotal} />
        <BillRow label="รายได้อื่น" v={otherIncomeTotal} />
        {tournamentIncomeTotal > 0 && <BillRow label="รายได้ 🏆 Tournament" v={tournamentIncomeTotal} />}
        <div style={{ height: 4 }} />
        {Object.keys(catTotals).length === 0
          ? <div style={{ fontSize: 12, color: T.muted, padding: "3px 0" }}>ไม่มีค่าใช้จ่ายในช่วงนี้</div>
          : Object.entries(catTotals).map(([cat, amt]) => <BillRow key={cat} label={`หัก ${cat}`} v={-amt} />)}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, padding: "3px 0", borderTop: `1px solid ${T.border}`, marginTop: 4, paddingTop: 6 }}>
          <span>ค่าใช้จ่ายรวม</span><span>{formatCurrency(-expense)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, marginTop: 6, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
          <span>{profit >= 0 ? "กำไรสุทธิ" : "ขาดทุนสุทธิ"}</span>
          <span style={{ color: profit >= 0 ? T.green : T.accent }}>{formatCurrency(Math.abs(profit))}</span>
        </div>
      </div>
    </>
  );
}

// ก๊วนในวันนี้ — tapping a row opens the EXISTING SessionFinancialDetail overlay, never a duplicate screen
function FinanceGroupsList({ title, sessions, onOpen }) {
  return (
    <>
      <SectionHead title={title} sub={`${sessions.length} ก๊วน`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
        {sessions.length === 0 ? <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: "8px 0" }}>ไม่มีก๊วนในวันนี้</div> :
          sessions.map((s) => {
            const rev = sessionRevenue(s), exp = sessionExpenseTotal(s), prof = sessionProfit(s);
            return (
              <button key={s.id} onClick={() => onOpen(s.id)} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 11, background: T.surface, border: `1px solid ${T.border}` }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name || "ก๊วนไม่มีชื่อ"}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: T.muted }}>รายได้ {formatCurrency(rev)} · ค่าใช้จ่าย {formatCurrency(exp)}</span>
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, color: prof >= 0 ? T.green : T.accent, flexShrink: 0 }}>{prof >= 0 ? "+" : "-"}{formatCurrency(Math.abs(prof))}</span>
                <ChevronRight size={16} color={T.muted} style={{ flexShrink: 0 }} />
              </button>
            );
          })}
      </div>
    </>
  );
}

// v1.11.2: "ทัวร์นาเมนต์ในวันนี้" — the Tournament-side counterpart of FinanceGroupsList above. Tournament
// income/expense totals were already correctly merged into the overall period totals since v1.11.1 (see
// computeFinanceForRange), but there was no per-tournament ROW like ก๊วน sessions get — organizers could
// see the combined number move but couldn't tell which tournament it came from. Kept self-contained
// (inline expand, no separate overlay) rather than wiring a new drill-through prop across the whole app.
function TournamentFinanceGroupsList({ title, tournaments }) {
  const [openId, setOpenId] = useState(null);
  return (
    <>
      <SectionHead title={title} sub={`${tournaments.length} รายการ`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
        {tournaments.length === 0 ? <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: "8px 0" }}>ไม่มีทัวร์นาเมนต์ในช่วงนี้</div> :
          tournaments.map((t) => {
            const ft = tournamentFinanceTotals(t);
            const open = openId === t.id;
            return (
              <div key={t.id} style={{ borderRadius: 11, background: T.surface, border: `1px solid ${T.border}`, overflow: "hidden" }}>
                <button onClick={() => setOpenId(open ? null : t.id)} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "none", border: "none" }}>
                  {t.logo ? <img src={t.logo} alt="" style={{ width: 22, height: 22, borderRadius: 7, objectFit: "cover", flexShrink: 0 }} /> : <span style={{ fontSize: 15, flexShrink: 0 }}>🏆</span>}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name || "Tournament ไม่มีชื่อ"}</span>
                    <span style={{ display: "block", fontSize: 11.5, color: T.muted }}>รายได้ {formatCurrency(ft.income)} · ค่าใช้จ่าย {formatCurrency(ft.expense)}</span>
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: ft.profit >= 0 ? T.green : T.accent, flexShrink: 0 }}>{ft.profit >= 0 ? "+" : "-"}{formatCurrency(Math.abs(ft.profit))}</span>
                  <ChevronDown size={16} color={T.muted} style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none" }} />
                </button>
                {open && (
                  <div style={{ padding: "0 12px 12px", fontSize: 12, color: T.muted, lineHeight: 1.8 }}>
                    {ft.entryFee > 0 && <div>ค่าสมัคร: {formatCurrency(ft.entryFee)}</div>}
                    {(t.finance?.income || []).map((e) => <div key={e.id}>รายได้ · {e.label || TOURNAMENT_INCOME_CAT_LABEL[e.category] || e.category}: {formatCurrency(e.amount)}</div>)}
                    {(t.finance?.expense || []).map((e) => <div key={e.id}>ค่าใช้จ่าย · {e.label || TOURNAMENT_EXPENSE_CAT_LABEL[e.category] || e.category}: {formatCurrency(e.amount)}</div>)}
                    {ft.entryFee === 0 && !(t.finance?.income || []).length && !(t.finance?.expense || []).length && <div>ไม่มีรายการ</div>}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </>
  );
}

// generic drill-down row list — powers both "ผลประกอบการรายวัน" (รายเดือน, has a count) and
// "ผลประกอบการรายเดือน" (ภาพรวม, no count) per Requirement 8/10. Only ACTIVE periods are ever passed in.
function FinancePerformanceList({ title, rows, onPick }) {
  return (
    <>
      <SectionHead title={title} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
        {rows.length === 0 ? <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: "8px 0" }}>ไม่มีรายการ</div> :
          rows.map((r) => (
            <button key={r.key} onClick={() => onPick(r.key)} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 11, background: T.surface, border: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, flexShrink: 0, minWidth: r.count != null ? 60 : "auto" }}>{r.label}</span>
              {r.count != null && <span style={{ fontSize: 11.5, color: T.muted, flex: 1 }}>{r.count} ก๊วน</span>}
              {r.count == null && <span style={{ flex: 1 }} />}
              <span style={{ fontSize: 13, fontWeight: 800, color: r.profit >= 0 ? T.green : T.accent, flexShrink: 0 }}>{r.profit >= 0 ? "+" : "-"}{formatCurrency(Math.abs(r.profit))}</span>
              <ChevronRight size={16} color={T.muted} style={{ flexShrink: 0 }} />
            </button>
          ))}
      </div>
    </>
  );
}

// compact "tap the title" alternative to the ‹ › arrows — lists ONLY months/years that actually have data,
// never a full calendar (Requirement 3/9/19)
function MonthPickerSheet({ months, onPick, onClose }) {
  return (
    <Overlay onClose={onClose}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>เลือกเดือน</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {months.map((m) => (
          <button key={m} onClick={() => { onPick(m); onClose(); }} style={{ width: "100%", textAlign: "left", padding: "11px 14px", borderRadius: 11, background: T.surface2, border: `1px solid ${T.border}`, fontSize: 14, fontWeight: 700, color: T.text }}>{fmtThaiMonthFull(m)}</button>
        ))}
      </div>
    </Overlay>
  );
}
function YearPickerSheet({ years, onPick, onClose }) {
  return (
    <Overlay onClose={onClose}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>เลือกช่วงเวลา</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button onClick={() => { onPick("all"); onClose(); }} style={{ width: "100%", textAlign: "left", padding: "11px 14px", borderRadius: 11, background: T.surface2, border: `1px solid ${T.border}`, fontSize: 14, fontWeight: 700, color: T.text }}>ทั้งหมด (ตลอดกาล)</button>
        {years.map((y) => (
          <button key={y} onClick={() => { onPick(y); onClose(); }} style={{ width: "100%", textAlign: "left", padding: "11px 14px", borderRadius: 11, background: T.surface2, border: `1px solid ${T.border}`, fontSize: 14, fontWeight: 700, color: T.text }}>ปี {Number(y) + 543}</button>
        ))}
      </div>
    </Overlay>
  );
}

// ===================== DISCOUNT CREDIT SHEET (v1.9.1) =====================
// Full detail lives ONLY here — the Finance page itself shows just the one compact summary row, per spec
// ("avoid clutter — never show full names/list directly on the Finance page").
function DiscountCreditSheet({ discountCredits, session, sessionHistory, applyDiscountCredits, cancelDiscountCredit, onClose }) {
  const [filter, setFilter] = useState("available");
  const [openCredit, setOpenCredit] = useState(null); // credit id with detail/actions expanded
  const list = (discountCredits || []).filter((c) => c.status === filter).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const availTotal = (discountCredits || []).filter((c) => c.status === "available").reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const availPeople = new Set((discountCredits || []).filter((c) => c.status === "available").map((c) => c.playerId || c.playerNameSnapshot)).size;
  const FILTERS = [["available", "คงเหลือ"], ["used", "ใช้แล้ว"], ["cancelled", "ยกเลิก"]];
  const STATUS_LABEL = { available: "คงเหลือ", used: "ใช้แล้ว", cancelled: "ยกเลิกแล้ว" };
  const active = openCredit ? (discountCredits || []).find((c) => c.id === openCredit) : null;
  return (
    <Overlay onClose={onClose}>
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 2 }}>🎁 ส่วนลดคงเหลือ</div>
      <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 14 }}>{availPeople} คน · รวม {formatCurrency(availTotal)}</div>
      <div style={{ marginBottom: 10 }}>
        <Seg options={FILTERS} value={filter} onChange={setFilter} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
        {list.length === 0 ? (
          <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: "16px 0" }}>ไม่มีรายการ</div>
        ) : list.map((c) => (
          <button key={c.id} onClick={() => setOpenCredit(c.id)} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 11, background: T.surface, border: `1px solid ${T.border}` }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.playerNameSnapshot}</span>
              <span style={{ display: "block", fontSize: 11.5, color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                จาก {resolveSessionLabel(c.sourceSessionId, session, sessionHistory) || "ก๊วนที่ผ่านมา"}
                {c.status === "used" && c.usedSessionId ? ` · ใช้กับ ${resolveSessionLabel(c.usedSessionId, session, sessionHistory) || "ก๊วนที่ผ่านมา"}` : ""}
              </span>
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 800, color: c.status === "available" ? T.green : T.muted, flexShrink: 0 }}>{formatCurrency(c.amount)}</span>
            <ChevronRight size={16} color={T.muted} style={{ flexShrink: 0 }} />
          </button>
        ))}
      </div>
      {active && (
        <DiscountCreditDetail
          credit={active}
          session={session}
          sessionHistory={sessionHistory}
          applyDiscountCredits={applyDiscountCredits}
          cancelDiscountCredit={cancelDiscountCredit}
          onClose={() => setOpenCredit(null)}
        />
      )}
    </Overlay>
  );
}

// Detail/actions for ONE credit — reachable from the Discount Credit Sheet OR the Payment-page notice.
// `players` (optional) is passed only from the Payment-page flow, to run the CRITICAL double-discount check
// against the current session's live player.discount before allowing "ใช้ส่วนลดตอนนี้".
function DiscountCreditDetail({ credit, session, sessionHistory, applyDiscountCredits, cancelDiscountCredit, players, onClose }) {
  const [confirmUse, setConfirmUse] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const livePlayer = players ? players.find((p) => p.id === credit.playerId) : null;
  const alreadyHasManualDiscount = !!(livePlayer && Number(livePlayer.discount) > 0);
  if (credit.status !== "available") {
    return (
      <Overlay onClose={onClose}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{credit.playerNameSnapshot}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: T.muted, marginBottom: 10 }}>{formatCurrency(credit.amount)}</div>
        <div style={{ fontSize: 12.5, color: T.muted }}>สถานะ: {credit.status === "used" ? "ใช้แล้ว" : "ยกเลิกแล้ว"}</div>
        {credit.status === "used" && credit.usedAt && <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>เมื่อ {fmtThaiDateTime(new Date(credit.usedAt).toISOString())}</div>}
        {credit.status === "cancelled" && credit.cancelledAt && <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>เมื่อ {fmtThaiDateTime(new Date(credit.cancelledAt).toISOString())}</div>}
      </Overlay>
    );
  }
  return (
    <Overlay onClose={onClose}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{credit.playerNameSnapshot}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: T.green, marginBottom: 10 }}>{formatCurrency(credit.amount)}</div>
      <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 16 }}>ได้รับจาก {resolveSessionLabel(credit.sourceSessionId, session, sessionHistory) || "ก๊วนที่ผ่านมา"}</div>

      {alreadyHasManualDiscount && !confirmUse && (
        <div style={{ background: "#fff8e6", border: `1px solid #f5d98a`, borderRadius: 11, padding: "10px 12px", marginBottom: 12, fontSize: 12.5, color: "#8a6300" }}>
          ⚠️ ผู้เล่นคนนี้มีส่วนลดในก๊วนปัจจุบันแล้ว {formatCurrency(livePlayer.discount)}
        </div>
      )}

      {!confirmUse && !confirmCancel && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={() => setConfirmUse(true)} style={{ width: "100%", padding: "12px 0", borderRadius: 11, border: "none", background: T.green, color: "#fff", fontSize: 13.5, fontWeight: 800 }}>ใช้ส่วนลดตอนนี้</button>
          <button onClick={() => setConfirmCancel(true)} style={{ width: "100%", padding: "12px 0", borderRadius: 11, border: `1.5px solid ${T.accent}`, background: "none", color: T.accent, fontSize: 13.5, fontWeight: 800 }}>ยกเลิกส่วนลดครั้งถัดไป</button>
        </div>
      )}

      {confirmUse && (
        <div>
          <div style={{ fontSize: 13.5, marginBottom: 4 }}>ใช้ส่วนลด {formatCurrency(credit.amount)} กับก๊วนปัจจุบัน?</div>
          {alreadyHasManualDiscount && <div style={{ fontSize: 12, color: T.accent, marginBottom: 10 }}>ผู้เล่นคนนี้มีส่วนลดในก๊วนปัจจุบันอยู่แล้ว {formatCurrency(livePlayer.discount)} — การกด "ใช้ส่วนลด" จะเพิ่มส่วนลดนี้เข้าไปอีก</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => setConfirmUse(false)} style={{ flex: 1, padding: "11px 0", borderRadius: 11, border: `1px solid ${T.border}`, background: "none", color: T.text, fontSize: 13, fontWeight: 700 }}>ยกเลิก</button>
            <button onClick={() => { applyDiscountCredits(credit.id); onClose(); }} style={{ flex: 1, padding: "11px 0", borderRadius: 11, border: "none", background: T.green, color: "#fff", fontSize: 13, fontWeight: 800 }}>ใช้ส่วนลด</button>
          </div>
        </div>
      )}

      {confirmCancel && (
        <div>
          <div style={{ fontSize: 13.5, marginBottom: 4 }}>ยกเลิกสิทธิ์ส่วนลด {formatCurrency(credit.amount)} ของ {credit.playerNameSnapshot}?</div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>ประวัติรางวัลจะยังถูกเก็บไว้ แต่ส่วนลดนี้จะไม่ถูกนำไปใช้อีก</div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => setConfirmCancel(false)} style={{ flex: 1, padding: "11px 0", borderRadius: 11, border: `1px solid ${T.border}`, background: "none", color: T.text, fontSize: 13, fontWeight: 700 }}>ยกเลิก</button>
            <button onClick={() => { cancelDiscountCredit(credit.id); onClose(); }} style={{ flex: 1, padding: "11px 0", borderRadius: 11, border: "none", background: T.accent, color: "#fff", fontSize: 13, fontWeight: 800 }}>ยืนยันยกเลิกสิทธิ์</button>
          </div>
        </div>
      )}
    </Overlay>
  );
}

// Quick "ใช้กับก๊วนนี้" confirm from the Payment-page detail overlay — applies ALL of this player's
// "available" credits to the CURRENT session at once. Same CRITICAL double-discount guard as
// DiscountCreditDetail: if the player already has a nonzero manual discount this session, warn and
// require an explicit tap-through rather than applying silently.
function ApplyCreditsConfirm({ player, credits, applyDiscountCredits, onClose }) {
  if (!player || !credits.length) return null;
  const total = credits.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const alreadyHasManualDiscount = Number(player.discount) > 0;
  return (
    <Overlay onClose={onClose}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{player.name}</div>
      <div style={{ fontSize: 13.5, marginBottom: 4 }}>ใช้ส่วนลด {formatCurrency(total)} กับก๊วนปัจจุบัน?</div>
      {alreadyHasManualDiscount && (
        <div style={{ background: "#fff8e6", border: `1px solid #f5d98a`, borderRadius: 11, padding: "10px 12px", margin: "10px 0", fontSize: 12.5, color: "#8a6300" }}>
          ⚠️ ผู้เล่นคนนี้มีส่วนลดในก๊วนปัจจุบันแล้ว {formatCurrency(player.discount)} — การกด "ใช้ส่วนลด" จะเพิ่มส่วนลดนี้เข้าไปอีก
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 11, border: `1px solid ${T.border}`, background: "none", color: T.text, fontSize: 13, fontWeight: 700 }}>ยกเลิก</button>
        <button onClick={() => { applyDiscountCredits(credits.map((c) => c.id)); onClose(); }} style={{ flex: 1, padding: "11px 0", borderRadius: 11, border: "none", background: T.green, color: "#fff", fontSize: 13, fontWeight: 800 }}>ใช้ส่วนลด</button>
      </div>
    </Overlay>
  );
}

// Read-only snapshot view of an archived Tournament from tournamentHistory. Player display level /
// skillIndex shown here come from t.playerSnapshots — frozen at the moment the Tournament was
// completed — never the player's current (possibly later-edited) level, per the archive rule.
// v1.11.4: shared header used by the completed Summary page (and, later, the live in-progress
// dashboard + PDF export) — shows the tournament's own logo exactly like the History list rows do.
function TournamentResultHeader({ t, totals, statusLabel }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
      {t.logo ? (
        <img src={t.logo} alt="" style={{ width: 42, height: 42, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
      ) : (
        <div style={{ width: 42, height: 42, borderRadius: 12, background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🏆</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name || "Tournament ไม่มีชื่อ"}</div>
        <div style={{ fontSize: 12.5, color: T.muted, marginTop: 2 }}>{fmtThaiDate(t.date)} · {totals.playerCount} คน · {totals.teamCount} ทีม · {totals.stagePath}</div>
        {statusLabel && <div style={{ fontSize: 11.5, color: T.amber, fontWeight: 800, marginTop: 3 }}>สถานะ: {statusLabel}</div>}
      </div>
    </div>
  );
}
// v1.11.4: replaces the old flat champion/runnerUp/third MiniStat row with a real podium. Shows
// "เส้นทางสู่แชมป์" (never a fabricated result) until a division actually has a decided champion —
// used identically for an in-progress division (podium.champion === null) and a completed one.
// Supports a shared/joint 3rd place (podium.thirdIds may hold 2 ids from both semifinal losers).
// v1.11.4: shows a team's player photo(s) inside a Podium box. Singles -> one centered photo.
// Doubles -> one photo on the left, one on the right (per explicit request), so a pair's two faces
// bookend the box instead of just showing a name.
// v1.11.4 (podium photo alignment fix): each player gets their own photo-above-name column instead
// of stretching photos to the box's outer edges (space-between) with a separate combined name line
// below — that made photos hug the left/right edges while the "Alice + Bob" text sat centered in the
// middle, misaligned with either photo. Columns are centered as a group so a single name always sits
// directly beneath its own photo, for both singles and doubles teams.
function PodiumPersonCol({ p, photoSize, fontSize, maxWidth }) {
  if (!p) return null;
  // Avatar is a fixed-width block box; text-align:center on the wrapper only centers inline content
  // (the name), not a block child, so without this explicit flex+justifyContent the photo can sit
  // off-center relative to the name whenever maxWidth is wider than the photo itself. Wrapping it in
  // its own centered flex row guarantees the photo's center-X always matches the name's center-X.
  return (
    <div style={{ textAlign: "center", minWidth: 0, maxWidth: maxWidth || photoSize + 26 }}>
      <div style={{ display: "flex", justifyContent: "center" }}><Avatar p={p} size={photoSize} /></div>
      <div style={{ fontSize, fontWeight: 700, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name || "?"}</div>
    </div>
  );
}
function PodiumTeamPeople({ team, peopleById, photoSize, fontSize, gap = 14, maxWidth }) {
  const pids = (team?.playerIds || []).slice(0, 2);
  if (pids.length === 0) return null;
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", gap, flexWrap: "nowrap" }}>
      {pids.map((pid) => <PodiumPersonCol key={pid} p={peopleById[pid]} photoSize={photoSize} fontSize={fontSize} maxWidth={maxWidth} />)}
    </div>
  );
}
function TournamentPodium({ podium, teamsById, peopleById }) {
  if (!podium || !podium.champion) {
    return (
      <div style={{ textAlign: "center", padding: "20px 14px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 28 }}>🏆</div>
        <div style={{ fontSize: 14.5, fontWeight: 800, marginTop: 2 }}>เส้นทางสู่แชมป์</div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>ยังไม่ทราบผู้ชนะ — ติดตามผลแต่ละคู่ได้ด้านล่าง</div>
      </div>
    );
  }
  const champTeam = teamsById[podium.champion];
  const champName = tTeamName(champTeam, peopleById);
  const runnerTeam = podium.runnerUp ? teamsById[podium.runnerUp] : null;
  const runnerName = runnerTeam ? tTeamName(runnerTeam, peopleById) : null;
  const thirdIds = podium.thirdIds || [];
  const thirdNames = thirdIds.map((id) => tTeamName(teamsById[id], peopleById));
  const GOLD = "#d97706", BRONZE = "#c2703d";
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ textAlign: "center", padding: "18px 14px", background: "#fff8ec", border: `1.5px solid ${GOLD}`, borderRadius: 14, marginBottom: 8 }}>
        <div style={{ fontSize: 42 }}>🏆</div>
        <div style={{ fontSize: 11.5, color: GOLD, fontWeight: 800, letterSpacing: 0.5, marginTop: 2, marginBottom: 6 }}>แชมป์เปี้ยน</div>
        <PodiumTeamPeople team={champTeam} peopleById={peopleById} photoSize={42} fontSize={13} gap={18} />
      </div>
      {(runnerName || thirdNames.length > 0) && (
        <div style={{ display: "flex", gap: 8 }}>
          {runnerName && (
            <div style={{ flex: 1, textAlign: "center", padding: "10px 8px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, minWidth: 0 }}>
              <div style={{ fontSize: 26 }}>🥈</div>
              <div style={{ fontSize: 10.5, color: T.muted, fontWeight: 700, marginTop: 1, marginBottom: 5 }}>รองแชมป์</div>
              <PodiumTeamPeople team={runnerTeam} peopleById={peopleById} photoSize={30} fontSize={11.5} gap={10} maxWidth={62} />
            </div>
          )}
          {thirdNames.length > 0 && (
            <div style={{ flex: 1, textAlign: "center", padding: "10px 8px", background: T.surface, border: `1px solid ${BRONZE}55`, borderRadius: 12, minWidth: 0 }}>
              <div style={{ fontSize: 26 }}>🥉</div>
              <div style={{ fontSize: 10.5, color: T.muted, fontWeight: 700, marginTop: 1, marginBottom: 5 }}>{thirdNames.length > 1 ? "ร่วมอันดับ 3" : "อันดับ 3"}</div>
              {thirdIds.length > 1 ? (
                // joint 3rd: the box splits into a left half (first team's own photo+name column(s))
                // and a right half (the other team's), per explicit request — not one merged row.
                // Text/photos shrink further here (per user's "บีบให้เล็กลง" request) so names fit on
                // one line without wrapping in the cramped half-width space.
                <div style={{ display: "flex", gap: 6 }}>
                  {thirdIds.map((id) => <div key={id} style={{ flex: 1, minWidth: 0 }}><PodiumTeamPeople team={teamsById[id]} peopleById={peopleById} photoSize={18} fontSize={8.5} gap={4} maxWidth={34} /></div>)}
                </div>
              ) : (
                <PodiumTeamPeople team={teamsById[thirdIds[0]]} peopleById={peopleById} photoSize={30} fontSize={11.5} gap={10} maxWidth={62} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
function TournamentHistoricalDetail({ t, playersById, onOpenTournamentPrint }) {
  // v1.11.4 fix: playerSnapshots only ever froze {id, name, level, skillIndex} (by design — so the
  // archived tournament always shows the player's skill/level AS OF completion, never a later edit).
  // The old merge (`{...playersById, ...snapById}`) replaced each player's ENTIRE live record with the
  // bare snapshot object, silently dropping `photo` (and anything else not captured in the snapshot)
  // for every real registered player in every completed tournament — the Podium then had no choice but
  // to fall back to initial-letter circles. Fixed by merging the snapshot's frozen fields ON TOP OF the
  // live record per player, instead of replacing it outright, so `photo` survives while level/skillIndex
  // still come from the frozen snapshot exactly as before.
  const snapById = Object.fromEntries((t.playerSnapshots || []).map((p) => [p.id, { ...playersById[p.id], ...p }]));
  const peopleById = { ...playersById, ...snapById, ...Object.fromEntries((t.guestPlayers || []).map((g) => [g.id, g])) };
  const teamsById = Object.fromEntries((t.teams || []).map((tm) => [tm.id, tm]));
  // v1.11.4: podium/totals are recomputed fresh from the live bracket/match data every render (never
  // trusted from the frozen d.champion/d.third fields) so an edited result always reflects correctly —
  // this is the same buildTournamentResultReport used by the live dashboard, Share, and PDF export.
  const report = buildTournamentResultReport(t, peopleById);
  return (
    <div>
      <TournamentResultHeader t={t} totals={report.totals} />
      {report.mainDivision && <TournamentPodium podium={report.mainDivision.podium} teamsById={teamsById} peopleById={peopleById} />}

      {report.divisions.map((d) => (
        <div key={d.id} style={{ marginBottom: 18 }}>
          {report.divisions.length > 1 && <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 8 }}>{d.name}</div>}
          {report.divisions.length > 1 && <TournamentPodium podium={d.podium} teamsById={teamsById} peopleById={peopleById} />}
          {d.bracket && <TournamentBracket bracket={d.bracket} teamsById={teamsById} peopleById={peopleById} champion={d.podium.champion} groupNameById={Object.fromEntries((d.groups || []).map((g) => [g.id, g.name]))} />}
          {d.groups && d.groups.length > 0 && <GroupStandingsTabs groups={d.groups} teamsById={teamsById} peopleById={peopleById} pointsConfig={t.pointsConfig} />}
          {!d.bracket && (!d.groups || !d.groups.length) && (d.matches?.length > 0 || d.swissMatches?.length > 0) && (
            <StandingsTableNoD teams={d.teamIds.map((id) => teamsById[id])} matches={d.matches?.length ? d.matches : d.swissMatches} pointsConfig={t.pointsConfig} peopleById={peopleById} />
          )}
        </div>
      ))}

      <PlayerPerformanceList playerStats={report.playerStats} peopleById={peopleById} />

      {/* v1.11.4: compact share/export bar at the very bottom, per spec — PDF is the polished
          user-facing report and sits at the same visual tier as Share; the old JSON export is kept
          (still needed as a data backup/import path) but demoted to a small text-link below, not
          given equal visual weight with the new PDF button. */}
      <SectionHead icon={<Share2 size={16} color={T.green} />} title="แชร์และส่งออก" />
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button
          onClick={() => shareSummary(buildTournamentShareText(report, teamsById, peopleById))}
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px 0", borderRadius: 11, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 13, fontWeight: 700 }}
        ><Share2 size={15} /> แชร์สรุป</button>
        <button
          onClick={() => onOpenTournamentPrint && onOpenTournamentPrint(report)}
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px 0", borderRadius: 11, background: T.green, border: "none", color: "#fff", fontSize: 13, fontWeight: 800 }}
        ><Download size={15} /> Export PDF</button>
      </div>
      <button onClick={() => exportTournamentJSON(t, playersById)} style={{ width: "100%", textAlign: "center", padding: "8px 0", marginBottom: 8, background: "none", border: "none", color: T.muted, fontSize: 11.5, fontWeight: 700, textDecoration: "underline" }}>ข้อมูล/สำรอง/เพิ่มเติม — ส่งออก JSON</button>
    </div>
  );
}
// v1.11.4: top-5 by wins + a "ดูทั้งหมด" drill-down for the rest, instead of the full list always
// fully expanded — one of the biggest single contributors to a long Summary page for big tournaments.
function PlayerPerformanceList({ playerStats, peopleById }) {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...(playerStats || [])].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  const shown = showAll ? sorted : sorted.slice(0, 5);
  const Row = (ps) => {
    const p = peopleById[ps.playerId];
    return (
      <div key={ps.playerId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", borderRadius: 11, background: T.surface, border: `1px solid ${T.border}` }}>
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p?.name || "?"}</span>
        <span style={{ fontSize: 11.5, color: T.muted }}>{ps.wins}W - {ps.losses}L</span>
      </div>
    );
  };
  return (
    <div>
      <SectionHead icon={<User size={16} color={T.green} />} title="สถิติผู้เล่น" sub="ชนะ-แพ้ ใน Tournament นี้" />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sorted.length === 0 ? <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: "8px 0" }}>ไม่มีข้อมูล</div> : shown.map(Row)}
      </div>
      {sorted.length > 5 && (
        <button onClick={() => setShowAll((v) => !v)} style={{ width: "100%", textAlign: "center", padding: "9px 0", marginTop: 8, borderRadius: 10, background: "none", border: "none", color: T.green, fontSize: 12.5, fontWeight: 800 }}>
          {showAll ? "▲ ย่อกลับ" : `▼ ดูทั้งหมด (${sorted.length} คน)`}
        </button>
      )}
    </div>
  );
}

/* ============ SUMMARY ============ */
function SummaryTab({ players, history, current, getP, settings, session, tournamentHistory }) {
  const [detail, setDetail] = useState(null); // player id for detail
  const doneCurrent = current.filter((m) => m.status === "done");
  const totalMatches = history.length + doneCurrent.length;
  const played = players.filter((p) => (p.games || 0) > 0 || (p.status !== "absent" && p.status !== "registered"));
  const gamesArr = played.map((p) => p.games || 0);
  const minGames = gamesArr.length ? Math.min(...gamesArr) : 0;
  const maxGames = gamesArr.length ? Math.max(...gamesArr) : 0;
  const totalGames = gamesArr.reduce((s, g) => s + g, 0);
  // session-long wait metrics accumulated when players entered a match
  const wc = players.reduce((s, p) => s + (p.waitCount || 0), 0);
  const wt = players.reduce((s, p) => s + (p.waitTotal || 0), 0);
  const wmax = players.reduce((s, p) => Math.max(s, p.waitMax || 0), 0);
  const avgWaitMin = wc > 0 ? Math.round(wt / wc / 60000) : null;
  const maxWaitMin = wc > 0 ? Math.round(wmax / 60000) : null;
  const ranking = [...played].sort((a, b) => (b.games || 0) - (a.games || 0) || a.name.localeCompare(b.name));
  const allHist = [...history, ...doneCurrent];
  const grandTotal = computeBill(players, settings).reduce((s, b) => s + b.total, 0); // for the share-text total only
  const detailP = detail ? players.find((p) => p.id === detail) : null;
  const detailStats = detailP ? playerStats(detailP.id, allHist) : null;
  const detailTStats = detailP ? tournamentStatsForPlayer(detailP.id, tournamentHistory) : null;

  const started = totalMatches > 0 || current.length > 0 || played.length > 0;
  if (!started) return <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: "40px 0" }}>ยังไม่มีข้อมูลก๊วน — เริ่มจัดก๊วนในแท็บ "วันนี้" ก่อน</div>;

  const Stat = ({ label, value }) => (
    <div style={{ flex: 1, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, padding: "12px 10px", textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: T.green }}>{value}</div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{label}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <Stat label="แมตช์ทั้งหมด" value={totalMatches} />
        <Stat label="เกมรวม" value={totalGames} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <Stat label="เกมน้อยสุด" value={minGames} />
        <Stat label="เกมมากสุด" value={maxGames} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Stat label="รอเฉลี่ย (นาที)" value={avgWaitMin ?? "-"} />
        <Stat label="รอนานสุด (นาที)" value={maxWaitMin ?? "-"} />
      </div>

      <button
        onClick={() => shareSummary(buildShareText({ name: session?.name, date: session?.date, playerCount: ranking.length, totalMatches, maxGames, totalExpense: grandTotal }))}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 0", borderRadius: 11, background: T.surface, border: `1px solid ${T.border}`, color: T.text, fontSize: 13, fontWeight: 700, marginBottom: 18 }}
      ><Share2 size={15} /> แชร์สรุปก๊วน</button>

      <SectionHead icon={<User size={16} color={T.green} />} title="จำนวนเกมของแต่ละคน" sub="ชนะ-แพ้-เสมอ · แตะดูรายละเอียด" />
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
        {ranking.length === 0 ? <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: "8px 0" }}>ยังไม่มีผู้เล่น</div> :
          ranking.map((p) => {
            const st = playerStats(p.id, allHist);
            return (
              <button key={p.id} onClick={() => setDetail(p.id)} style={{ textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", borderRadius: 11, background: T.surface, border: `1px solid ${T.border}` }}>
                <Avatar p={p} size={30} />
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name} <span style={{ color: levelColor(p.skillIndex), fontWeight: 800, fontSize: 12 }}>({p.level})</span></span>
                {(st.win + st.loss + st.draw) > 0 && <span style={{ fontSize: 11.5, color: T.muted }}>{st.win}-{st.loss}-{st.draw}</span>}
                <span style={{ fontSize: 12.5, fontWeight: 800, color: T.text }}>{p.games || 0} เกม</span>
                <ChevronRight size={15} color={T.muted} />
              </button>
            );
          })}
      </div>

      <SectionHead icon={<History size={16} color={T.muted} />} title="ประวัติแมตช์" sub={`${allHist.length} เกม`} />
      {allHist.length === 0 ? <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: "8px 0" }}>ยังไม่มีเกมที่จบ</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {allHist.map((m) => <CompactMatch key={m.id} m={m} getP={getP} onClick={() => {}} />)}
        </div>
      )}

      {/* PLAYER DETAIL (game stats only — payment/billing lives in the "ชำระเงิน" tab) */}
      {detailP && detailStats && (
        <Overlay onClose={() => setDetail(null)}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Avatar p={detailP} size={44} />
            <div><div style={{ fontSize: 16, fontWeight: 800 }}>{detailP.name} <span style={{ color: levelColor(detailP.skillIndex), fontSize: 13 }}>({detailP.level})</span></div><div style={{ fontSize: 12, color: T.muted }}>{PSTATUS[detailP.status || "absent"].label}</div></div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <MiniStat label="เกม" value={detailP.games || 0} />
            <MiniStat label="ชนะ" value={detailStats.win} color={T.green} />
            <MiniStat label="แพ้" value={detailStats.loss} color={T.accent} />
            <MiniStat label="เสมอ" value={detailStats.draw} color={T.blue} />
            <MiniStat label="Win%" value={detailStats.winRate != null ? detailStats.winRate + "%" : "-"} />
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 12 }}>ไม่มีคะแนน {detailStats.noScore} เกม (นับเกมแต่ไม่นับแพ้ชนะ)</div>
          <DetailList title="คู่ที่เล่นด้วย" map={detailStats.partners} getP={getP} />
          <DetailList title="คู่ต่อสู้ที่พบ" map={detailStats.opps} getP={getP} />

          {detailTStats && detailTStats.tournaments > 0 && (
            <div style={{ marginTop: 16 }}>
              <SectionHead icon={<span>🏆</span>} title="สถิติ Tournament" sub="แยกจากสถิติจัดก๊วน" />
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <MiniStat label="Tournament" value={detailTStats.tournaments} />
                <MiniStat label="แมตช์" value={detailTStats.matches} />
                <MiniStat label="ชนะ" value={detailTStats.wins} color={T.green} />
                <MiniStat label="แพ้" value={detailTStats.losses} color={T.accent} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <MiniStat label="🏆 แชมป์" value={detailTStats.championships} color={T.green} />
                <MiniStat label="🥈 รองแชมป์" value={detailTStats.runnerUps} />
              </div>
            </div>
          )}
        </Overlay>
      )}
    </div>
  );
}

/* ============ PAYMENT (separated from Summary — sits between "สรุป" and "ประวัติ") ============ */
function PaymentTab({ players, history, current, settings, setSettings, togglePaid, session, setPDiscount, applyWheelPrize, endSession, qrRef, discountCredits, applyDiscountCredits, courtCount, courtLabels }) {
  const [openCreditFor, setOpenCreditFor] = useState(null); // playerId whose "available" credit detail/apply sheet is open
  const [detail, setDetail] = useState(null); // player id for detail
  const [qrFull, setQrFull] = useState(null); // {name, amount}
  const [payFilter, setPayFilter] = useState("unpaid"); // "all" | "unpaid" | "paid"
  const [wheelFor, setWheelFor] = useState(null); // player id currently spinning the wheel
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [openFinanceSettings, setOpenFinanceSettings] = useState(false);
  const doneCurrent = current.filter((m) => m.status === "done");
  const played = players.filter((p) => (p.games || 0) > 0 || (p.status !== "absent" && p.status !== "registered"));
  const bill = computeBill(players, settings);
  const billBy = (id) => bill.find((b) => b.id === id);
  const grandTotal = bill.reduce((s, b) => s + b.total, 0);
  const collected = bill.filter((b) => b.paid).reduce((s, b) => s + b.total, 0);
  const receivable = grandTotal - collected;
  const paidCount = bill.filter((b) => b.paid).length;
  const allPaid = bill.length > 0 && paidCount === bill.length;
  const detailP = detail ? players.find((p) => p.id === detail) : null;
  const detailBill = detailP ? billBy(detailP.id) : null;
  // "available" discount credits for the player currently open in the payment detail overlay (v1.9.1) —
  // NOT auto-applied, just surfaced as a suggestion with a manual "ใช้กับก๊วนนี้" action (see spec: SUGGEST, never auto-deduct).
  const detailPCredits = detailP ? (discountCredits || []).filter((c) => c.playerId === detailP.id && c.status === "available") : [];
  const detailPCreditTotal = detailPCredits.reduce((s, c) => s + (Number(c.amount) || 0), 0);

  const started = history.length + doneCurrent.length > 0 || current.length > 0 || played.length > 0;
  if (!started) return <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: "40px 0" }}>ยังไม่มีข้อมูลก๊วน — เริ่มจัดก๊วนในแท็บ "วันนี้" ก่อน</div>;

  return (
    <div>
      <SectionHead icon={<Wallet size={16} color={T.green} />} title="การชำระเงิน" sub="แตะเพื่อดู/รับเงิน" />

      {/* FINANCE SETTINGS ENTRY POINT — ค่าคอร์ท/ค่าลูก/ค่าใช้จ่ายอื่น/QR/บัญชี/รางวัล ทั้งหมดย้ายมาที่นี่จาก Today */}
      <button onClick={() => setOpenFinanceSettings(true)} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: T.surface, border: `1px solid ${T.border}`, marginBottom: 12 }}>
        <span style={{ fontSize: 17 }}>⚙️</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 800, color: T.text }}>ตั้งค่าค่าก๊วนและรางวัล</span>
          <span style={{ display: "block", fontSize: 12, color: T.muted, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{financeSettingsSummary(settings)}</span>
        </span>
        <ChevronRight size={18} color={T.muted} />
      </button>
      {openFinanceSettings && (
        <FinanceSettingsSheet settings={settings} setSettings={setSettings} qrRef={qrRef} courtCount={courtCount} courtLabels={courtLabels} onClose={() => setOpenFinanceSettings(false)} />
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: T.muted }}>จ่ายแล้ว</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.green }}>{paidCount}/{bill.length} คน</div>
        </div>
        <div style={{ flex: 1, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: T.muted }}>รับแล้ว</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.green }}>{formatCurrency(collected)} <span style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>/ {formatCurrency(grandTotal)}</span></div>
        </div>
        <div style={{ flex: 1, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: T.muted }}>ค้างรับ</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: receivable > 0 ? T.accent : T.green }}>{formatCurrency(receivable)}</div>
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <Seg options={[["unpaid", "ยังไม่จ่าย"], ["all", "ทั้งหมด"], ["paid", "จ่ายแล้ว"]]} value={payFilter} onChange={setPayFilter} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
        {bill.filter((b) => payFilter === "all" ? true : payFilter === "paid" ? b.paid : !b.paid).length === 0 ? (
          <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: "16px 0" }}>{payFilter === "unpaid" ? "ชำระครบแล้ว 🎉" : payFilter === "paid" ? "ยังไม่มีใครจ่าย" : "ยังไม่มีข้อมูลการชำระเงิน"}</div>
        ) : bill.filter((b) => payFilter === "all" ? true : payFilter === "paid" ? b.paid : !b.paid).map((b) => (
          <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", borderRadius: 11, background: T.surface, border: `1px solid ${T.border}` }}>
            <button onClick={() => setDetail(b.id)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", textAlign: "left", padding: 0 }}>
              <Avatar p={b} size={30} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name} <span style={{ color: levelColor(b.skillIndex), fontWeight: 800, fontSize: 11.5 }}>({b.level})</span></span>
                <span style={{ display: "block", fontSize: 11.5, color: T.muted }}>{b.games || 0} เกม · {formatCurrency(b.total)}</span>
              </span>
            </button>
            <button onClick={() => togglePaid(b.id)} style={{ padding: "6px 11px", borderRadius: 20, fontSize: 12, fontWeight: 800, border: "none", background: b.paid ? "#e2f5ec" : "#fdecea", color: b.paid ? T.green : T.accent }}>{b.paid ? "🟢 จ่ายแล้ว" : "🔴 ยังไม่จ่าย"}</button>
          </div>
        ))}
      </div>

      <button
        onClick={() => allPaid && setConfirmEnd(true)}
        disabled={!allPaid}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px 0", borderRadius: 13, background: allPaid ? "none" : T.surface2, border: `1.5px solid ${allPaid ? T.accent : T.border}`, color: allPaid ? T.accent : T.muted, fontSize: 13.5, fontWeight: 800, marginBottom: 18, opacity: allPaid ? 1 : 0.6 }}
      >
        <LogOut size={15} /> {bill.length === 0 ? "ยังไม่มีผู้เล่นที่ต้องจ่าย" : allPaid ? "จบก๊วนวันนี้" : `จบก๊วนวันนี้ (รอจ่ายอีก ${bill.length - paidCount} คน)`}
      </button>

      {/* PLAYER PAYMENT DETAIL */}
      {detailP && detailBill && (
        <Overlay onClose={() => setDetail(null)}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Avatar p={detailP} size={44} />
            <div><div style={{ fontSize: 16, fontWeight: 800 }}>{detailP.name} <span style={{ color: levelColor(detailP.skillIndex), fontSize: 13 }}>({detailP.level})</span></div><div style={{ fontSize: 12, color: T.muted }}>{PSTATUS[detailP.status || "absent"].label}</div></div>
          </div>
          <div style={{ background: T.surface2, borderRadius: 12, padding: 12, marginTop: 6 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 8 }}>รายละเอียดค่าก๊วน</div>
            <BillRow label="ค่าสนาม" v={detailBill.eCourt} />
            <BillRow label="ค่าลูก" v={detailBill.eShuttle} />
            <BillRow label="อื่น ๆ" v={Math.round(detailBill.eOther)} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "3px 0", color: T.green }}>
              <span>ส่วนลด</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span>-฿</span>
                <input
                  type="number"
                  value={detailP.discount || 0}
                  onChange={(e) => setPDiscount(detailP.id, e.target.value)}
                  style={{ width: 64, padding: "4px 6px", borderRadius: 8, border: `1px solid ${T.border}`, textAlign: "right", fontSize: 13, fontWeight: 700, color: T.green, outline: "none" }}
                />
              </span>
            </div>
            {detailBill.eCarriedInDiscount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0", color: T.green }}>
                <span>ส่วนลดจากรอบที่แล้ว</span>
                <span>{formatCurrency(-Math.round(detailBill.eCarriedInDiscount))}</span>
              </div>
            )}
            {detailBill.eWheelDiscount - detailBill.eCarriedInDiscount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0", color: T.green }}>
                <span>🎡 รางวัลวงล้อ</span>
                <span>{formatCurrency(-Math.round(detailBill.eWheelDiscount - detailBill.eCarriedInDiscount))}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, marginTop: 6, paddingTop: 8, borderTop: `1px solid ${T.border}` }}><span>รวม</span><span style={{ color: T.green }}>{formatCurrency(detailBill.total)}</span></div>
            {detailPCredits.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, background: "#fff8e6", border: `1px solid #f5d98a`, borderRadius: 11, padding: "9px 11px" }}>
                <span style={{ flex: 1, fontSize: 12.5, color: "#8a6300", fontWeight: 700 }}>🎁 มีส่วนลดคงเหลือ {formatCurrency(detailPCreditTotal)}</span>
                <button onClick={() => setOpenCreditFor(detailP.id)} style={{ flexShrink: 0, padding: "7px 12px", borderRadius: 20, border: "none", background: T.green, color: "#fff", fontSize: 12, fontWeight: 800 }}>ใช้กับก๊วนนี้</button>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => togglePaid(detailP.id)} style={{ flex: 1, padding: "11px 0", borderRadius: 11, border: "none", fontSize: 13.5, fontWeight: 800, background: detailBill.paid ? "#e2f5ec" : T.green, color: detailBill.paid ? T.green : "#fff" }}>{detailBill.paid ? "🟢 จ่ายแล้ว (แตะเพื่อยกเลิก)" : "ทำเครื่องหมายว่าจ่ายแล้ว"}</button>
            </div>

            {detailP.spun ? (
              <div style={{ marginTop: 10, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 11, padding: "10px 12px", fontSize: 12.5, color: T.text }}>
                🎉 ผลวงล้อ: <span style={{ fontWeight: 800 }}>{detailP.wheelResult}</span>
              </div>
            ) : settings.wheelEnabled !== false ? (
              <button onClick={() => setWheelFor(detailP.id)} style={{ marginTop: 10, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px 0", borderRadius: 11, background: "none", border: `1.5px dashed ${T.green}`, color: T.green, fontSize: 13, fontWeight: 800 }}>
                🎡 หมุนวงล้อรางวัล (ใช้ได้ 1 ครั้ง)
              </button>
            ) : null}

            {settings.qr && (
              <button onClick={() => setQrFull({ name: detailP.name, amount: detailBill.total })} style={{ marginTop: 12, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 0", borderRadius: 13, background: T.green, border: "none", color: "#fff", fontSize: 14, fontWeight: 800 }}>
                <QrCode size={17} /> เปิด QR เพื่อชำระเงิน {formatCurrency(detailBill.total)}
              </button>
            )}
            {settings.bank && (
              <div style={{ marginTop: 12, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 11, padding: "10px 12px" }}>
                <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 3 }}>หรือโอนเข้าบัญชี</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "pre-wrap" }}>{settings.bank}</div>
              </div>
            )}
            {!settings.qr && !settings.bank && <div style={{ marginTop: 10, fontSize: 11.5, color: T.muted, textAlign: "center" }}>เพิ่ม QR / เลขบัญชีได้ที่ ⚙️ ตั้งค่าค่าก๊วนและรางวัล ด้านบน</div>}
          </div>
        </Overlay>
      )}

      {openCreditFor && (
        <ApplyCreditsConfirm
          player={players.find((p) => p.id === openCreditFor)}
          credits={(discountCredits || []).filter((c) => c.playerId === openCreditFor && c.status === "available")}
          applyDiscountCredits={applyDiscountCredits}
          onClose={() => setOpenCreditFor(null)}
        />
      )}

      {/* FULLSCREEN QR (no crop/filter) */}
      {qrFull && settings.qr && (
        <div onClick={() => setQrFull(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 50, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "calc(12px + env(safe-area-inset-top)) 12px calc(12px + env(safe-area-inset-bottom))" }}>
          <div style={{ color: "#fff", fontSize: 18, fontWeight: 800, marginBottom: 4 }}>ยอดชำระ {formatCurrency(qrFull.amount)}</div>
          <div style={{ color: "#cbd5cf", fontSize: 14, marginBottom: 12 }}>{qrFull.name}</div>
          <img src={settings.qr} alt="QR" style={{ width: "min(94vw, 520px)", height: "min(94vw, 520px)", objectFit: "contain", background: "#fff", borderRadius: 14, padding: 8 }} />
          {settings.bank && <div style={{ color: "#e5e7eb", fontSize: 13, marginTop: 14, textAlign: "center", whiteSpace: "pre-wrap", maxWidth: 340 }}>{settings.bank}</div>}
          <button onClick={() => setQrFull(null)} style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 7, padding: "13px 26px", borderRadius: 30, background: "#fff", border: "none", color: "#111", fontSize: 15, fontWeight: 800 }}><X size={18} /> ปิด</button>
        </div>
      )}

      {wheelFor && (
        <SpinWheel
          prizes={settings.wheelPrizes || []}
          remainingPlayers={played.filter((p) => !p.spun).length}
          showSoldOut={!!settings.wheelShowSoldOut}
          onFinish={(prize) => applyWheelPrize(wheelFor, prize)}
          onClose={() => setWheelFor(null)}
        />
      )}

      {confirmEnd && (
        <div onClick={() => setConfirmEnd(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface, borderRadius: 16, padding: 18, maxWidth: 340, width: "100%" }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>จบก๊วน "{session.name || "ไม่มีชื่อ"}"?</div>
            <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 16 }}>ระบบจะบันทึกข้อมูลก๊วนนี้ไว้ในประวัติก๊วน แล้วเริ่มก๊วนใหม่ให้พร้อมใช้งาน</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmEnd(false)} style={btnSecondary}>ยกเลิก</button>
              <button onClick={() => { setConfirmEnd(false); endSession(); }} style={{ ...btnPrimary, background: T.accent }}>จบก๊วน</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return <div style={{ flex: 1, background: T.surface2, borderRadius: 11, padding: "10px 6px", textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 800, color: color || T.text }}>{value}</div><div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>{label}</div></div>;
}
function BillRow({ label, v }) {
  const neg = v < 0;
  return <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0", color: neg ? T.green : T.muted }}><span>{label}</span><span>{formatCurrency(v)}</span></div>;
}
function DetailList({ title, map, getP }) {
  const entries = Object.entries(map || {}).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: T.muted, marginBottom: 6 }}>{title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {entries.map(([id, n]) => <span key={id} style={{ fontSize: 12, fontWeight: 600, background: T.surface2, borderRadius: 8, padding: "4px 9px" }}>{getP(id)?.name || "-"} <span style={{ color: T.muted }}>×{n}</span></span>)}
      </div>
    </div>
  );
}
function Overlay({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.bg, width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto", borderRadius: "18px 18px 0 0", padding: "18px 18px calc(18px + env(safe-area-inset-bottom))", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}><button onClick={onClose} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 20, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted }}><X size={17} /></button></div>
        {children}
      </div>
    </div>
  );
}

function MatchTeams({ m, getP, editable, tapSlot, isSel, replaceSlot, bench, big, now }) {
  const [openSlot, setOpenSlot] = useState(null); // { team, idx } | null — shared between both team sides so only one picker is open at a time
  const A = m.teamA, B = m.teamB;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <TeamSide arr={A} team="A" m={m} getP={getP} editable={editable} tapSlot={tapSlot} isSel={isSel} replaceSlot={replaceSlot} bench={bench} openSlot={openSlot} setOpenSlot={setOpenSlot} big={big} now={now} />
      <span style={{ flex: "none", fontSize: 10, fontWeight: 800, color: T.muted, padding: "0 1px" }}>vs</span>
      <TeamSide arr={B} team="B" m={m} getP={getP} editable={editable} tapSlot={tapSlot} isSel={isSel} replaceSlot={replaceSlot} bench={bench} openSlot={openSlot} setOpenSlot={setOpenSlot} big={big} now={now} />
    </div>
  );
}

function TeamSide({ arr, team, m, getP, editable, tapSlot, isSel, replaceSlot, bench, openSlot, setOpenSlot, big, now }) {
  const isWide = useIsWide(); // iPad / landscape phone (≥700px) — only the photo scales up further here; text stays the same size on every screen
  const compact = arr.length > 1; // doubles: tighten padding so both teams fit on one line
  const avatarSize = isWide
    ? (big ? (compact ? 46 : 54) : (compact ? 38 : 44))
    : (big ? (compact ? 34 : 40) : (compact ? 26 : 30)); // bigger photos on courts that are actively playing — easier to spot/call the right person
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 4 }}>
      {arr.map((id, idx) => {
        const p = id ? getP(id) : null;
        const selected = isSel && isSel(id, m.id, team, idx);
        const isOpen = !!(openSlot && openSlot.team === team && openSlot.idx === idx);
        const toggle = () => setOpenSlot(isOpen ? null : { team, idx });
        const pick = (newId) => { replaceSlot && replaceSlot(m.id, team, idx, newId); setOpenSlot(null); };
        const nameLong = p && p.name.length > 7;
        const nameFs = nameLong ? (compact ? 12.5 : 13) : (compact ? 14 : 15);
        const lvlFs = nameLong ? 11 : (compact ? 12 : 13);
        return p ? (
          <div key={idx} style={{ flex: 1, minWidth: 0, position: "relative", display: "flex", alignItems: "center", gap: compact ? 6 : 7, padding: compact ? "6px 7px" : "7px 8px", borderRadius: 10, background: selected ? "#e2f5ec" : T.surface2, border: `1.5px solid ${selected ? T.green : "transparent"}`, minHeight: 46 }}>
            <Avatar p={p} size={avatarSize} />
            {isWide ? (
              // wide screens have room to spare — name + level stay on one line, ellipsis only as a rare safety net
              <span style={{ minWidth: 0, lineHeight: 1.2, display: "block", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                <span style={{ fontWeight: 700, fontSize: nameFs }}>{p.name}</span>{" "}
                <span style={{ fontSize: lvlFs, fontWeight: 800, color: levelColor(p.skillIndex) }}>({p.level})</span>
              </span>
            ) : (
              // narrow phone in portrait: never truncate/split the name — stack it above the level badge instead
              <span style={{ minWidth: 0, lineHeight: 1.25 }}>
                <span style={{ display: "block", fontWeight: 700, fontSize: nameFs, whiteSpace: "nowrap" }}>{p.name}</span>
                <span style={{ display: "block", fontSize: lvlFs, fontWeight: 800, color: levelColor(p.skillIndex) }}>({p.level})</span>
              </span>
            )}
            {editable && (
              <button onClick={toggle} title="เปลี่ยนผู้เล่น" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", background: "none", border: "none", padding: 0, cursor: "pointer" }} />
            )}
            {isOpen && <PlayerPicker bench={bench || []} allowClear align={team === "A" ? "left" : "right"} onPick={pick} onClose={() => setOpenSlot(null)} now={now} />}
          </div>
        ) : (
          <div key={idx} style={{ flex: 1, minWidth: 0, position: "relative", padding: "7px 8px", borderRadius: 10, border: `1.5px dashed ${editable ? T.green : T.border}`, color: editable ? T.green : T.muted, fontSize: 13, minHeight: 46, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {editable ? (
              <button onClick={toggle} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", background: "none", border: "none", color: T.green, fontSize: 13, fontWeight: 700, cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{compact ? "+ เลือก" : "+ เลือกคน"}</button>
            ) : "ว่าง"}
            {isOpen && <PlayerPicker bench={bench || []} align={team === "A" ? "left" : "right"} onPick={pick} onClose={() => setOpenSlot(null)} now={now} />}
          </div>
        );
      })}
    </div>
  );
}

// custom dropdown (shows avatar photos — a native <select>/<option> can't render images)
// `now` is OPTIONAL (Requirement 8) — when passed, each bench row also shows a small "รอ Xนาที ·
// เล่น Yเกม" hint so the organizer understands WHY someone is fairness-prioritized. Callers that don't
// pass `now` (e.g. existing Tournament-side reuse) simply don't render the hint — no crash, no layout change.
function PlayerPicker({ bench, allowClear, align, onPick, onClose, now }) {
  const alignRight = align === "right";
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 55, background: "transparent" }} />
      <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: "100%", ...(alignRight ? { right: 0, left: "auto" } : { left: 0, right: "auto" }), marginTop: 4, width: "max(100%, 210px)", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: "0 10px 28px rgba(0,0,0,0.2)", zIndex: 56, maxHeight: 250, overflowY: "auto" }}>
        {allowClear && (
          <button onClick={() => onPick(null)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", background: "none", border: "none", borderBottom: `1px solid ${T.border}`, textAlign: "left", color: T.accent, fontSize: 12.5, fontWeight: 700 }}>
            <X size={15} /> เอาออก (ว่าง)
          </button>
        )}
        {bench.length === 0 ? (
          <div style={{ padding: "12px 11px", fontSize: 12.5, color: T.muted, textAlign: "center" }}>ไม่มีคนรอเปลี่ยน</div>
        ) : bench.map((b) => (
          <button key={b.id} onClick={() => onPick(b.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", background: "none", border: "none", borderBottom: `1px solid ${T.border}`, textAlign: "left" }}>
            <Avatar p={b} size={26} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name} <span style={{ color: levelColor(b.skillIndex), fontWeight: 800, fontSize: 11.5 }}>({b.level})</span></span>
              {typeof now === "number" && (
                <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: T.muted, marginTop: 1 }}>
                  รอ {Math.max(0, Math.floor((now - (b.waitingSince || now)) / 60000))} นาที · เล่น {b.games || 0} เกม
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

// ===================== INLINE NEXT-MATCH EDITOR (v1.9.7) — replaces the old QueueNextSheet modal =====================
// Renders directly inside a "playing" court's FullCard, right below Current Match, in the SAME card
// (Requirement 1). Three states:
//   1) no m.queued, not editing -> compact dashed empty state "+ จัดเกมถัดไป" (Requirement 10) — tapping
//      it goes straight into edit mode, no modal ever opens (Requirement 5).
//   2) m.queued exists, not editing -> compact read-only avatar/name row + Balance (or "พร้อม X/N คน" if
//      partial, Requirement 9) + a single "แก้ไข" button (Requirement 3/6).
//   3) editing -> the SAME MatchTeams/TeamSide/PlayerPicker slots used everywhere else become editable
//      in place (tap a slot -> small inline PlayerPicker dropdown, never a big modal — Requirement 5),
//      plus "สุ่มใหม่" (reuses the existing autoQueueNext fairness algorithm, Requirement 7), "สลับทีม"
//      (Requirement 6), "ยกเลิก" and "เสร็จสิ้น". No data-layer changes here — setQueuedSlot/autoQueueNext/
//      clearQueuedNext/swapQueuedTeams are 100% reused, so the existing PLANNED_NEXT-style cross-court
//      reservation/dedup guarantees (Requirement 15/16) hold automatically.
function NextMatchBlock({ m, getP, pool, autoQueueNext, setQueuedSlot, swapQueuedTeams, clearQueuedNext, now, editing, onEdit, onDone }) {
  const [autoFailed, setAutoFailed] = useState(false);
  const q = m.queued;
  // mode-aware team size (fixes the old QueueNextSheet's hardcoded [null,null] singles-mode bug) — a
  // court's queued match is always the same mode as its current match.
  const teamSize = m.mode === "doubles" ? 2 : 1;
  const emptyArr = () => Array(teamSize).fill(null);
  const synthM = { id: m.id, teamA: (q && q.teamA) || emptyArr(), teamB: (q && q.teamB) || emptyArr() };
  const total = teamSize * 2;
  const filled = [...synthM.teamA, ...synthM.teamB].filter(Boolean).length;
  const full = filled === total;
  const sA = full ? synthM.teamA.reduce((s, id) => s + (getP(id)?.skillIndex || 0), 0) : 0;
  const sB = full ? synthM.teamB.reduce((s, id) => s + (getP(id)?.skillIndex || 0), 0) : 0;
  const replaceSlotQueued = (mid, team, idx, newId) => setQueuedSlot(mid, team, idx, newId);
  const doAuto = () => { const ok = autoQueueNext(m.id); setAutoFailed(!ok); };

  if (!q && !editing) {
    return (
      <button onClick={onEdit} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", marginTop: 8, background: "#f2f6ff", border: `1px dashed #c7d7f5`, borderRadius: 10, padding: "7px 0", color: "#3d63c4", fontSize: 11.5, fontWeight: 700 }}>
        🔵 เกมถัดไป <span>+ จัดเกมถัดไป</span>
      </button>
    );
  }

  return (
    <div style={{ marginTop: 8, padding: "8px 9px 9px", borderRadius: 10, background: "#f2f6ff", border: `1px solid #c7d7f5` }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontWeight: 800, fontSize: 12, color: "#3d63c4" }}>🔵 เกมถัดไป</span>
        {!full && <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: T.muted }}>พร้อม {filled}/{total} คน</span>}
        {editing ? (
          <button onClick={onDone} style={{ marginLeft: "auto", background: "none", border: "none", color: T.green, fontSize: 11.5, fontWeight: 800, padding: "2px 4px" }}>เสร็จสิ้น</button>
        ) : (
          <button onClick={onEdit} style={{ marginLeft: "auto", background: "none", border: "none", color: T.accent, fontSize: 11.5, fontWeight: 800, padding: "2px 4px" }}>แก้ไข</button>
        )}
      </div>

      {/* v1.9.9: while actively picking players, show Balance ABOVE the team row (not below) so the per-slot
          picker dropdown — which expands downward over this block — never covers it, and so the organizer can
          see the resulting balance as a decision aid while still choosing players. Reuses the exact same
          full-gated Fairness render as the view-mode block below; disappears automatically once เสร็จสิ้น is
          pressed (editing becomes false), leaving only the unchanged view-mode Balance below. */}
      {editing && full && <div style={{ marginBottom: 2 }}><Fairness sA={sA} sB={sB} /></div>}

      <MatchTeams m={synthM} getP={getP} editable={editing} bench={pool} replaceSlot={replaceSlotQueued} big={false} now={now} />

      {editing && (
        <>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button onClick={doAuto} style={{ ...btnSecondary, padding: "7px 0", fontSize: 11.5 }}><Shuffle size={13} /> สุ่มใหม่</button>
            <button onClick={() => swapQueuedTeams(m.id)} disabled={!q} style={{ ...btnSecondary, padding: "7px 0", fontSize: 11.5, opacity: q ? 1 : 0.4 }}>⇄ สลับทีม</button>
            <button onClick={() => { clearQueuedNext(m.id); onDone(); }} disabled={!q} style={{ ...btnSecondary, padding: "7px 0", fontSize: 11.5, color: T.accent, opacity: q ? 1 : 0.4 }}>ยกเลิก</button>
          </div>
          {autoFailed && <div style={{ fontSize: 11, fontWeight: 700, color: T.accent, textAlign: "center", padding: "5px 0 0" }}>ผู้เล่นว่างไม่พอ (ต้องการอย่างน้อย {total} คน)</div>}
        </>
      )}

      {/* v1.11.5: Balance is intentionally NOT shown once เสร็จสิ้น has been pressed (editing === false)
          — per explicit request, to save screen space once the queued next match is confirmed. While
          still actively editing, the exact same full-gated Fairness above (line ~7766) already covers
          the "as a decision aid" need, so nothing is lost — this only removes the redundant second copy
          that used to also render in the read-only/confirmed view. */}
    </div>
  );
}

function MiniMatch({ m, getP }) {
  const nm = (id) => getP(id)?.name || "-";
  const line = (arr) => arr.filter(Boolean).map(nm).join(" & ");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 11px", borderRadius: 10, background: T.surface, border: `1px solid ${T.border}`, fontSize: 12.5 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: T.muted, background: T.surface2, padding: "2px 7px", borderRadius: 6 }}>R{m.round + 1}·C{m.court}</span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{line(m.teamA)} <span style={{ color: T.muted }}>vs</span> {line(m.teamB)}</span>
    </div>
  );
}

// visual + label meta per pair-rule type, keyed the same as the `type` field on each lockPairs entry
const PAIR_RULE_META = {
  lock: { label: "ล็อคคู่ (จับคู่กันแน่นอน)", short: "ล็อคคู่", bg: "#fef3ec", border: "#f6d9c8", color: "#c2650a" },
  avoidPartner: { label: "ไม่อยากคู่ (ห้ามเป็นคู่กัน)", short: "ไม่อยากคู่", bg: "#fdecec", border: "#f5c9c9", color: "#c0392b" },
  avoidOpponent: { label: "ไม่อยากสู้ (ห้ามอยู่คนละฝั่ง)", short: "ไม่อยากสู้", bg: "#eef1fd", border: "#c9d3f5", color: "#3d4fb0" },
  avoidBoth: { label: "ไม่อยากเจอเลย (ทั้งคู่และสู้)", short: "ไม่อยากเจอเลย", bg: "#f3effb", border: "#ddcff0", color: "#6d3fa8" },
};
// v1.9.17: the two handedness-preference values, shown as two MORE options in the exact same type
// dropdown below — per spec these must NOT get a new section/control, only ride along on the existing
// lock-pair editor. Unlike PAIR_RULE_META above these describe a single PLAYER, not an A-B pair, so they
// key onto player.handPref (via setHandPref) instead of into the lockPairs array.
const HAND_PREF_META = {
  preferLeft: { label: "อยากคู่กับมือซ้าย", short: "อยากคู่มือซ้าย", bg: HAND_BADGE.left.bg, border: "#ddc8fb", color: HAND_BADGE.left.color },
  avoidLeft: { label: "ไม่อยากคู่กับมือซ้าย", short: "ไม่อยากคู่มือซ้าย", bg: "#fdecec", border: "#f5c9c9", color: "#c0392b" },
};
function LockPairEditor({ players, lockPairs, addLockPair, removeLockPair, setHandPref, getP }) {
  const [a, setA] = useState(""); const [b, setB] = useState(""); const [type, setType] = useState("lock");
  const sty = { flex: 1, padding: "9px 8px", borderRadius: 10, background: T.surface, border: `1px solid ${T.border}`, color: T.text, fontSize: 13, minWidth: 0 };
  const isHandPrefType = type === "preferLeft" || type === "avoidLeft";
  const handPrefPlayers = players.filter((p) => p.handPref === "preferLeft" || p.handPref === "avoidLeft");
  const add = () => {
    if (isHandPrefType) { if (a) setHandPref(a, type); }
    else addLockPair(a, b, type);
    setA(""); setB("");
  };
  return (
    <div>
      {(lockPairs.length > 0 || handPrefPlayers.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {lockPairs.map((r) => {
            const meta = PAIR_RULE_META[r.type] || PAIR_RULE_META.lock;
            return (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 11px", borderRadius: 10, background: meta.bg, border: `1px solid ${meta.border}` }}>
                {r.type === "lock" ? <Lock size={13} color={meta.color} /> : <Unlock size={13} color={meta.color} />}
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{getP(r.a)?.name} + {getP(r.b)?.name}</span>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: meta.color }}>{meta.short}</span>
                <button onClick={() => removeLockPair(r.id)} style={{ background: "none", border: "none", color: T.muted, display: "flex" }}><X size={15} /></button>
              </div>
            );
          })}
          {handPrefPlayers.map((p) => {
            const meta = HAND_PREF_META[p.handPref];
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 11px", borderRadius: 10, background: meta.bg, border: `1px solid ${meta.border}` }}>
                <Unlock size={13} color={meta.color} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: meta.color }}>{meta.short}</span>
                <button onClick={() => setHandPref(p.id, null)} style={{ background: "none", border: "none", color: T.muted, display: "flex" }}><X size={15} /></button>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
        <select value={a} onChange={(e) => setA(e.target.value)} style={sty}><option value="">เลือกคน</option>{players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        {!isHandPrefType && <>
          <span style={{ color: T.muted, fontWeight: 800 }}>+</span>
          <select value={b} onChange={(e) => setB(e.target.value)} style={sty}><option value="">เลือกคน</option>{players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </>}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...sty, flex: 1.6, fontWeight: 700 }}>
          {Object.entries(PAIR_RULE_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          {Object.entries(HAND_PREF_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select>
        <button onClick={add} style={{ padding: "0 13px", height: 36, borderRadius: 10, background: T.accent, border: "none", color: "#fff", display: "flex", alignItems: "center" }}><Plus size={17} /></button>
      </div>
    </div>
  );
}

const WHEEL_TYPE_LABEL = { now: "ใช้ทันที", next: "ครั้งถัดไป", item: "ของรางวัล", none: "ไม่ได้รางวัล" };
// how many of this prize are left on the wheel. New prizes store this directly as `qty`; prizes saved
// by an older version only have `weight` (a relative-odds number) — reused as-is for the initial stock
// so upgrading never silently empties/changes anyone's existing wheel.
function prizeQty(p) {
  if (p.qty != null) return Math.max(0, Number(p.qty) || 0);
  if (p.weight != null) return Math.max(0, Number(p.weight) || 0);
  return 5;
}
// how many of this prize the organizer last stocked (set whenever they create or restock a prize —
// see add()/editQty() below), separate from `qty` (the live remaining count, decremented by one on every
// win — see applyWheelPrize). SpinWheel uses totalQty - qty to know how many units of a prize have already
// been claimed, so it can render that many individual "sold out" cosmetic slices. Missing on prizes saved
// before this existed (or never restocked since) — callers should fall back to treating it as == qty
// (i.e. nothing claimed yet) rather than crash, exactly like prizeQty() does for the older `weight` field.
function WheelPrizeEditor({ prizes, setPrizes }) {
  const [label, setLabel] = useState("");
  const [qty, setQty] = useState(5);
  const [type, setType] = useState("now");
  const [amount, setAmount] = useState(10);
  const needsAmount = type === "now" || type === "next";
  const add = () => {
    const n = label.trim();
    if (!n) return;
    const q = Math.max(0, Number(qty) || 0);
    setPrizes((prev) => [...(prev || []), { id: uid(), label: n, type, amount: needsAmount ? Number(amount) || 0 : 0, qty: q, totalQty: q }]);
    setLabel(""); setQty(5); setAmount(10); setType("now");
  };
  const remove = (id) => setPrizes((prev) => (prev || []).filter((p) => p.id !== id));
  // editing the "remaining" number is how organizers restock — treat it as resetting the baseline too,
  // so a fresh top-up doesn't retroactively show a pile of "sold out" slices from before the restock.
  const editQty = (id, v) => setPrizes((prev) => (prev || []).map((p) => (p.id === id ? { ...p, qty: Math.max(0, Number(v) || 0), totalQty: Math.max(0, Number(v) || 0) } : p)));
  const sty = { padding: "9px 8px", borderRadius: 10, background: T.surface, border: `1px solid ${T.border}`, color: T.text, fontSize: 12.5 };
  return (
    <div>
      {(prizes || []).length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {prizes.map((p) => {
            const remaining = prizeQty(p);
            const unlimited = p.type === "none"; // "no prize" slice never runs out
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 11px", borderRadius: 10, background: T.surface2, opacity: !unlimited && remaining === 0 ? 0.55 : 1 }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.label}</span>
                <span style={{ fontSize: 10.5, color: T.muted, fontWeight: 700, flexShrink: 0 }}>{WHEEL_TYPE_LABEL[p.type] || p.type}</span>
                {unlimited ? (
                  <span style={{ fontSize: 10.5, color: T.muted, fontWeight: 700, flexShrink: 0 }}>ไม่จำกัด</span>
                ) : (
                  <span style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                    <input type="number" value={remaining} onChange={(e) => editQty(p.id, e.target.value)} title="จำนวนคงเหลือ — แก้เพื่อเติมสต็อก" style={{ ...sty, width: 46, padding: "5px 6px", textAlign: "right", color: remaining === 0 ? T.accent : T.text, fontWeight: 800 }} />
                    <span style={{ fontSize: 10.5, color: T.muted }}>{remaining === 0 ? "หมด" : "เหลือ"}</span>
                  </span>
                )}
                <button onClick={() => remove(p.id)} style={{ background: "none", border: "none", color: T.muted, display: "flex", flexShrink: 0 }}><X size={15} /></button>
              </div>
            );
          })}
        </div>
      )}
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ชื่อรางวัล เช่น ส่วนลด 10฿ / แจกไม้แบต" style={{ ...sty, width: "100%", marginBottom: 6, boxSizing: "border-box" }} />
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...sty, flexShrink: 0 }}>
          <option value="now">ส่วนลด ใช้ทันที</option>
          <option value="next">ส่วนลด ครั้งถัดไป</option>
          <option value="item">ของรางวัล (ไม่ใช่ส่วนลด)</option>
          <option value="none">ไม่ได้รางวัล</option>
        </select>
        {needsAmount && <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="฿" style={{ ...sty, width: 58, flexShrink: 0 }} />}
        {type !== "none" && <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="จำนวน" title="จำนวนรางวัลทั้งหมด" style={{ ...sty, width: 62, flexShrink: 0 }} />}
        <button onClick={add} style={{ padding: "0 13px", height: 36, borderRadius: 10, background: T.accent, border: "none", color: "#fff", display: "flex", alignItems: "center", flexShrink: 0 }}><Plus size={17} /></button>
      </div>
      <div style={{ fontSize: 10.5, color: T.muted, marginTop: 6 }}>ตัวเลข "จำนวน" คือจำนวนรางวัลที่มีจริง — หมุนถูกแล้วจะลดลง 1 ทุกครั้ง จนกว่าจะหมด (ยกเว้น "ไม่ได้รางวัล" ที่ไม่จำกัด) — เลือก "ของรางวัล" สำหรับของที่ไม่ใช่ส่วนลด เช่น ไม้แบต รองเท้า น้ำดื่ม</div>
    </div>
  );
}

// preset picker + confirm-before-switch + (when custom is active) the custom level editor.
// Switching preset only ever rewrites each player's cached DISPLAY label (via changeLevelPreset,
// defined in App()) — skillIndex (matchmaking source of truth) never changes.
function LevelPresetEditor({ settings, changeLevelPreset, setCustomLevels }) {
  const currentId = settings.levelPresetId || "isan";
  const [pendingPreset, setPendingPreset] = useState(null); // preset id awaiting confirm, or null
  const [showSkillInfo, setShowSkillInfo] = useState(false);
  const allPresets = [...LEVEL_PRESETS, getPresetMeta("custom")];
  const levelOptions = activeLevelOptions(settings); // preset-specific labels (R/BG1/... for อีสาน, etc.) for the skill-index legend below
  const pick = (id) => { if (id !== currentId) setPendingPreset(id); };
  const confirm = () => { changeLevelPreset(pendingPreset); setPendingPreset(null); };
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
        {allPresets.map((preset) => {
          const active = preset.id === currentId;
          return (
            <button key={preset.id} onClick={() => pick(preset.id)} style={{ textAlign: "left", padding: "10px 12px", borderRadius: 11, border: `1.5px solid ${active ? T.green : T.border}`, background: active ? "#e2f5ec" : T.surface2, display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontWeight: 800, fontSize: 13.5, color: active ? T.green : T.text }}>{preset.name}</span>
                {active && <span style={{ fontSize: 10.5, fontWeight: 800, color: T.green, background: "#fff", padding: "2px 7px", borderRadius: 10 }}>ใช้อยู่</span>}
              </div>
              <div style={{ fontSize: 11, color: T.muted }}>{preset.description}</div>
            </button>
          );
        })}
      </div>

      {currentId === "custom" && (
        <div style={{ marginBottom: 10 }}>
          <CustomLevelEditor customLevels={settings.customLevels || []} setCustomLevels={setCustomLevels} />
        </div>
      )}

      <button onClick={() => setShowSkillInfo((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", borderRadius: 10, background: "none", border: `1px solid ${T.border}`, color: T.muted, fontSize: 12, fontWeight: 700 }}>
        <Info size={14} /> {showSkillInfo ? "ซ่อน" : "ดู"}คำอธิบายแต่ละระดับ
      </button>
      {showSkillInfo && (
        <div style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.6, marginTop: 8 }}>
          {Array.from({ length: 11 }, (_, i) => i + 1).map((si) => (
            <div key={si} style={{ marginBottom: 2 }}><span style={{ fontWeight: 800, color: levelColor(si) }}>{levelOptions.find((o) => o.skillIndex === si)?.label || `Skill ${si}`}</span> — {SKILL_DESC[si]}</div>
          ))}
        </div>
      )}

      {pendingPreset && (
        <div onClick={() => setPendingPreset(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface, borderRadius: 16, padding: 18, maxWidth: 340, width: "100%" }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>เปลี่ยนระบบระดับฝีมือ?</div>
            <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 16 }}>ระดับผู้เล่นจะถูกแปลงอัตโนมัติตามระดับฝีมือเดิม สถิติ การจับคู่ และประวัติก๊วนจะไม่เปลี่ยน</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setPendingPreset(null)} style={btnSecondary}>ยกเลิก</button>
              <button onClick={confirm} style={btnPrimary}>เปลี่ยนระบบ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomLevelEditor({ customLevels, setCustomLevels }) {
  const [name, setName] = useState("");
  const [skillIndex, setSkillIndex] = useState(6);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const sty = { padding: "9px 8px", borderRadius: 10, background: T.surface, border: `1px solid ${T.border}`, color: T.text, fontSize: 12.5 };
  const sorted = [...customLevels].sort((a, b) => a.skillIndex - b.skillIndex);
  const add = () => {
    const n = name.trim();
    if (!n) { setError("ชื่อห้ามว่าง"); return; }
    setError("");
    setCustomLevels((prev) => [...(prev || []), { id: uid(), name: n, skillIndex: Math.max(1, Math.min(11, Number(skillIndex) || 1)), description: description.trim() }]);
    setName(""); setDescription("");
  };
  const remove = (id) => {
    if (customLevels.length <= 2) { setError("ต้องมีอย่างน้อย 2 ระดับ"); return; }
    setError("");
    setCustomLevels((prev) => (prev || []).filter((l) => l.id !== id));
  };
  const editField = (id, field, value) => setCustomLevels((prev) => (prev || []).map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  return (
    <div style={{ background: T.surface2, borderRadius: 11, padding: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>กำหนดระดับเอง ({customLevels.length} ระดับ)</div>
      {sorted.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {sorted.map((l) => (
            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", borderRadius: 10, padding: "7px 9px", border: `1px solid ${T.border}` }}>
              <input value={l.name} onChange={(e) => editField(l.id, "name", e.target.value)} style={{ ...sty, flex: 1, minWidth: 0, padding: "5px 7px" }} />
              <select value={l.skillIndex} onChange={(e) => editField(l.id, "skillIndex", Number(e.target.value))} style={{ ...sty, flexShrink: 0, padding: "5px 6px" }}>
                {Array.from({ length: 11 }, (_, i) => i + 1).map((si) => <option key={si} value={si}>Skill {si}</option>)}
              </select>
              <button onClick={() => remove(l.id)} style={{ background: "none", border: "none", color: T.muted, display: "flex", flexShrink: 0 }}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อระดับ เช่น มือใหม่" style={{ ...sty, width: "100%", marginBottom: 6, boxSizing: "border-box" }} />
      <div style={{ display: "flex", gap: 6 }}>
        <select value={skillIndex} onChange={(e) => setSkillIndex(Number(e.target.value))} style={{ ...sty, flexShrink: 0 }}>
          {Array.from({ length: 11 }, (_, i) => i + 1).map((si) => <option key={si} value={si}>Skill {si}</option>)}
        </select>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="คำอธิบาย (ไม่บังคับ)" style={{ ...sty, flex: 1, minWidth: 0 }} />
        <button onClick={add} style={{ padding: "0 13px", height: 36, borderRadius: 10, background: T.accent, border: "none", color: "#fff", display: "flex", alignItems: "center", flexShrink: 0 }}><Plus size={17} /></button>
      </div>
      {error && <div style={{ fontSize: 11, color: T.accent, marginTop: 6, fontWeight: 700 }}>{error}</div>}
    </div>
  );
}

// local-file backup / restore UI: export the whole app state as a JSON file, or import one back with
// a validate -> preview -> confirm flow. A "replace all" restore always takes a safety snapshot first
// (see App().applyRestore) so it can be undone with the button below the two main actions.
function BackupSettingsEditor({ exportBackup, validateBackupFile, applyRestore, undoRestore, lastBackupAt, hasPreRestoreBackup, autoBackups, bootLog }) {
  const [busy, setBusy] = useState(false);
  const [showBootLog, setShowBootLog] = useState(false); // v1.9.18: collapsed by default — diagnostic only
  const [successMsg, setSuccessMsg] = useState(null); // { kind: "export"|"import"|"undo", stats?, sizeLabel? }
  const [importError, setImportError] = useState(null);
  const [preview, setPreview] = useState(null); // validated backup object awaiting mode choice / confirm
  const [restoreMode, setRestoreMode] = useState("replace"); // "replace" | "mergeHistory"
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const fileRef = useRef();

  const doExport = async () => {
    setBusy(true); setSuccessMsg(null); setImportError(null);
    const res = await exportBackup();
    setBusy(false);
    if (res) setSuccessMsg({ kind: "export", stats: res.stats, sizeLabel: res.sizeLabel });
  };

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setSuccessMsg(null); setImportError(null);
    let text;
    try { text = await f.text(); } catch (err) { setImportError("ไม่สามารถอ่านไฟล์นี้ได้"); return; }
    const res = validateBackupFile(text);
    if (!res.ok) { setImportError(res.reason || "ไฟล์นี้ไม่ใช่ไฟล์สำรอง BadQ ที่รองรับ"); return; }
    setRestoreMode("replace");
    setPreview(res.backup);
  };

  const confirmDoRestore = async () => {
    setConfirmRestore(false); setBusy(true);
    const stats = backupStats(preview.data);
    await applyRestore(restoreMode, preview);
    setBusy(false);
    setSuccessMsg({ kind: "import", stats });
    setPreview(null);
  };

  const doUndo = async () => {
    setConfirmUndo(false); setBusy(true);
    const ok = await undoRestore();
    setBusy(false);
    if (ok) setSuccessMsg({ kind: "undo" });
  };

  return (
    <div>
      <input ref={fileRef} type="file" accept="application/json" onChange={onFile} style={{ display: "none" }} />
      <Label>สำรองและกู้คืนข้อมูล</Label>
      <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 10 }}>
        {lastBackupAt ? `สำรองล่าสุด: ${fmtThaiDateTime(lastBackupAt)}` : "ยังไม่เคยสำรองข้อมูล"}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button disabled={busy} onClick={doExport} style={{ ...btnSecondary, opacity: busy ? 0.6 : 1 }}><Download size={15} /> สำรองข้อมูล</button>
        <button disabled={busy} onClick={() => fileRef.current.click()} style={{ ...btnSecondary, opacity: busy ? 0.6 : 1 }}><Upload size={15} /> นำเข้าข้อมูล</button>
      </div>
      {hasPreRestoreBackup && (
        <button disabled={busy} onClick={() => setConfirmUndo(true)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", borderRadius: 11, background: "none", border: `1px dashed ${T.border}`, color: T.muted, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
          <RotateCcw size={14} /> ย้อนกลับการนำเข้าครั้งล่าสุด
        </button>
      )}
      {successMsg && (
        <div style={{ background: "#e2f5ec", border: `1px solid ${T.green}`, borderRadius: 11, padding: "10px 12px", fontSize: 12.5, color: T.green, marginBottom: 8, lineHeight: 1.7 }}>
          {successMsg.kind === "export" && <>สำรองข้อมูลเรียบร้อย<br />ผู้เล่น {successMsg.stats.playerCount} คน · ประวัติก๊วน {successMsg.stats.sessionHistoryCount} ครั้ง · แมตช์ทั้งหมด {successMsg.stats.matchCount} แมตช์<br /><span style={{ color: T.muted }}>ขนาดไฟล์สำรอง {successMsg.sizeLabel}</span></>}
          {successMsg.kind === "import" && <>นำเข้าข้อมูลเรียบร้อย<br />ผู้เล่น {successMsg.stats.playerCount} คน · ประวัติก๊วน {successMsg.stats.sessionHistoryCount} ครั้ง</>}
          {successMsg.kind === "undo" && <>ย้อนกลับข้อมูลก่อนนำเข้าเรียบร้อย</>}
        </div>
      )}
      {importError && (
        <div style={{ background: "#fdecea", border: `1px solid ${T.accent}`, borderRadius: 11, padding: "10px 12px", fontSize: 12.5, color: T.accent, marginBottom: 8, lineHeight: 1.7 }}>
          ไม่สามารถนำเข้าข้อมูลได้<br />ไฟล์นี้ไม่ใช่ไฟล์สำรอง BadQ ที่รองรับ
        </div>
      )}
      <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5 }}>
        ไฟล์สำรองอาจมีชื่อ รูปผู้เล่น ประวัติการเล่น และข้อมูลการชำระเงิน กรุณาเก็บไฟล์ไว้ในที่ปลอดภัย
      </div>

      {autoBackups && autoBackups.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Label>จุดสำรองอัตโนมัติ (ในเครื่องนี้)</Label>
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 8, lineHeight: 1.5 }}>
            ระบบบันทึกจุดกู้คืนให้อัตโนมัติทุกครั้งที่จบก๊วนหรือ Tournament — เก็บไว้ {autoBackups.length} จุดล่าสุดในเครื่องนี้เท่านั้น (ไม่ใช่ไฟล์แยกต่างหาก จึงยังควรกด "สำรองข้อมูล" ด้านบนเป็นระยะ เพื่อเก็บไฟล์ไว้นอกเครื่องด้วย)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {autoBackups.map((entry) => (
              <div key={entry.savedAt} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 10px", borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 12, lineHeight: 1.5, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: T.text }}>{fmtThaiDateTime(entry.savedAt)}</div>
                  <div style={{ color: T.muted }}>
                    ผู้เล่น {entry.stats.playerCount} คน · ประวัติก๊วน {entry.stats.sessionHistoryCount} ครั้ง
                    {entry.reason === "tournament" ? " · หลังจบ Tournament" : " · หลังจบก๊วน"}
                  </div>
                </div>
                <button disabled={busy} onClick={() => { setSuccessMsg(null); setImportError(null); setRestoreMode("replace"); setPreview(entry.payload); }} style={{ ...btnSecondary, padding: "7px 10px", fontSize: 12, flexShrink: 0, opacity: busy ? 0.6 : 1 }}>กู้คืน</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* v1.9.18: forensic boot/heal log — diagnoses reports of "data reverted after updating".
          Collapsed by default, read-only, never affects any of the logic above. */}
      {bootLog && bootLog.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button onClick={() => setShowBootLog((v) => !v)} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer" }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: T.muted }}>บันทึกการซิงค์ข้อมูล (debug)</span>
            <ChevronDown size={13} color={T.muted} style={{ transform: showBootLog ? "rotate(180deg)" : "none" }} />
          </button>
          {showBootLog && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
              {bootLog.map((e, i) => (
                <div key={e.t + "-" + i} style={{ fontSize: 10.5, fontFamily: "monospace", color: T.muted, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 8px", lineHeight: 1.5, wordBreak: "break-all" }}>
                  {fmtThaiDateTime(e.t)} · {e.event}
                  {e.event === "boot" && ` · v${e.appVersion} · ${e.bootStatus || "-"}${e.recoverySource ? " (" + e.recoverySource + ")" : ""} · โหลด savedAt=${e.loadedSavedAt ? fmtThaiDateTime(e.loadedSavedAt) : "ไม่มี"} · ผู้เล่น ${e.playerCount} · ประวัติ ${e.sessionHistoryCount} · reload=${e.viaUpdateReload ? "yes" : "no"}`}
                  {e.event === "heal" && ` · ${e.fromSavedAt ? fmtThaiDateTime(e.fromSavedAt) : "-"} → ${fmtThaiDateTime(e.toSavedAt)} · ผู้เล่น ${e.playerCount} · ประวัติ ${e.sessionHistoryCount}`}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface, borderRadius: 16, padding: 18, maxWidth: 360, width: "100%", maxHeight: "85vh", overflowY: "auto", boxSizing: "border-box" }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>พบข้อมูลสำรอง</div>
            <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 2 }}>วันที่สำรอง: {fmtThaiDateTime(preview.exportedAt)}</div>
            <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 12 }}>Version: BadQ v{preview.appVersion}</div>
            <div style={{ background: T.surface2, borderRadius: 11, padding: 12, fontSize: 12.5, marginBottom: 14, lineHeight: 1.9 }}>
              {(() => {
                const st = backupStats(preview.data);
                return (
                  <>
                    ผู้เล่น {st.playerCount} คน<br />
                    ประวัติก๊วน {st.sessionHistoryCount} ครั้ง<br />
                    แมตช์ {st.matchCount} แมตช์<br />
                    {st.hasCurrentSession && <>มีก๊วนที่กำลังใช้งาน 1 ก๊วน<br /></>}
                    {st.hasPayment && <>มีข้อมูลชำระเงิน<br /></>}
                    {st.hasQR && <>มี QR รับเงิน<br /></>}
                    {st.tournamentHistoryCount > 0 && <>ประวัติ Tournament {st.tournamentHistoryCount} รายการ<br /></>}
                    {st.hasActiveTournament && <>มี Tournament ที่กำลังดำเนินอยู่</>}
                  </>
                );
              })()}
            </div>
            <Label>รูปแบบการนำเข้า</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              <button onClick={() => setRestoreMode("replace")} style={{ textAlign: "left", padding: "10px 12px", borderRadius: 11, border: `1.5px solid ${restoreMode === "replace" ? T.green : T.border}`, background: restoreMode === "replace" ? "#e2f5ec" : T.surface }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: restoreMode === "replace" ? T.green : T.text }}>แทนที่ข้อมูลทั้งหมด</div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>ข้อมูล BadQ ปัจจุบันจะถูกแทนที่ด้วยข้อมูลจากไฟล์สำรอง</div>
              </button>
              <button onClick={() => setRestoreMode("mergeHistory")} style={{ textAlign: "left", padding: "10px 12px", borderRadius: 11, border: `1.5px solid ${restoreMode === "mergeHistory" ? T.green : T.border}`, background: restoreMode === "mergeHistory" ? "#e2f5ec" : T.surface }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: restoreMode === "mergeHistory" ? T.green : T.text }}>รวมเฉพาะประวัติก๊วน</div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>เพิ่มเฉพาะประวัติก๊วนที่ยังไม่มี ไม่แตะผู้เล่น/ก๊วนปัจจุบัน (กันซ้ำอัตโนมัติ)</div>
              </button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setPreview(null)} style={btnSecondary}>ยกเลิก</button>
              <button onClick={() => setConfirmRestore(true)} style={btnPrimary}>นำเข้าข้อมูล</button>
            </div>
          </div>
        </div>
      )}

      {confirmRestore && (
        <div onClick={() => setConfirmRestore(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 71, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface, borderRadius: 16, padding: 18, maxWidth: 340, width: "100%" }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>นำเข้าข้อมูลสำรอง?</div>
            <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 16 }}>
              {restoreMode === "replace" ? "ระบบจะสำรองข้อมูลปัจจุบันไว้ก่อนดำเนินการ" : "จะเพิ่มเฉพาะประวัติก๊วนที่ยังไม่มี ไม่กระทบผู้เล่น/ก๊วนปัจจุบัน"}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmRestore(false)} style={btnSecondary}>ยกเลิก</button>
              <button onClick={confirmDoRestore} style={btnPrimary}>นำเข้าข้อมูล</button>
            </div>
          </div>
        </div>
      )}

      {confirmUndo && (
        <div onClick={() => setConfirmUndo(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 71, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface, borderRadius: 16, padding: 18, maxWidth: 340, width: "100%" }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16 }}>ย้อนกลับการนำเข้าครั้งล่าสุด?</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmUndo(false)} style={btnSecondary}>ยกเลิก</button>
              <button onClick={doUndo} style={btnPrimary}>ย้อนกลับ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const NONE_SLICE_COLOR = "#ef4444"; // every "no prize" arc shares this one red, whatever prize it's interspersed between — clearly reads as "miss" against the bright prize colors
// angleFromTop is degrees clockwise from 12 o'clock (matches the old CSS conic-gradient convention,
// which the spin/rotation math below is built around) — converts to an SVG (x,y) point on that circle.
function polarToCartesian(cx, cy, r, angleFromTop) {
  const rad = ((angleFromTop - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function describeSlicePath(cx, cy, r, startDeg, endDeg) {
  const p1 = polarToCartesian(cx, cy, r, startDeg);
  const p2 = polarToCartesian(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`;
}
function truncateLabel(s, n) { return !s ? "" : (s.length > n ? s.slice(0, n) : s); } // hard cap only as a defensive backstop against a pathologically long label — no "…" appended

// custom spin wheel — v1.9.21: every remaining UNIT of every real prize gets its own equal-size slice
// (a prize with qty 3 draws 3 separate slices, not one slice 3x the size) — shuffled together ("คละกัน")
// so same-prize slices never cluster, then a "miss" slice is inserted after each one so the wheel
// alternates prize/miss all the way around, same red every time so a miss always reads the same at a
// glance. Sold-out units (already won — materialized only when the organizer turns settings.wheelShowSoldOut
// on) are individual unwinnable slices mixed in right alongside the still-live ones, deliberately drawn to
// look IDENTICAL to a live slice of the same prize (same color, same label — no "(หมด)" marker, no gray):
// the point of "แสดงทั้งหมด" is to keep the wheel looking fully stocked so a spinning player can't tell some
// slices are already gone, keeping the suspense up, even though those slices can structurally never win
// (see `selectable` in spin()). How many of each prize are "used" comes from totalQty (the stocked amount,
// set once per restock in WheelPrizeEditor and never decremented) minus qty (the live remaining count,
// decremented on every win — see prizeQty()).
function SpinWheel({ prizes, remainingPlayers, showSoldOut, onFinish, onClose }) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [resultPrize, setResultPrize] = useState(null);
  // bright/light tones for prize slices, cycling yellow → green → orange → blue → ...; red is deliberately
  // never used here — it's reserved for the "no prize" slices (NONE_SLICE_COLOR below) so a glance at the
  // wheel tells red = miss, every other color = a real prize (all units of the same prize share one color
  // even after shuffling, so it's still easy to spot "how many slices of THIS prize are left").
  const colors = ["#fbbf24", "#4ade80", "#fb923c", "#38bdf8", "#c084fc", "#2dd4bf", "#f9a8d4", "#a3e635", "#fcd34d", "#7dd3fc"];
  const noneProto = (prizes || []).find((p) => p.type === "none") || { id: "__none__", label: "ไม่ได้รางวัล", type: "none", amount: 0 };
  const totalPrizeQty = (prizes || []).filter((p) => p.type !== "none").reduce((s, p) => s + prizeQty(p), 0);
  // never let the math imply >100% win odds — total players due to spin is always at least the prize count
  const totalPlayers = Math.max(totalPrizeQty, Number(remainingPlayers) || 0);

  // Built once via useState's lazy initializer so the shuffled layout stays put for as long as this wheel
  // instance is open (the parent unmounts/remounts SpinWheel — see wheelFor in PaymentTab — between spins,
  // so each new spin naturally gets a fresh shuffle).
  const [segs] = useState(() => {
    const realPrizes = (prizes || []).filter((p) => p.type !== "none");
    const colorById = {};
    realPrizes.forEach((p, i) => { colorById[p.id] = colors[i % colors.length]; });
    let units = [];
    realPrizes.forEach((p) => {
      const remaining = prizeQty(p);
      for (let i = 0; i < remaining; i++) units.push({ ...p, isSoldOut: false, isNone: false, color: colorById[p.id] });
      if (showSoldOut) {
        // totalQty missing (prize saved before v1.9.21, or never restocked since): if it still has stock
        // left, assume nothing's been claimed (we simply don't know, and nothing looked "sold out" about
        // it before). If it's already at 0 though, show it as exactly ONE sold-out slice rather than
        // vanishing it entirely — matches how v1.9.19/1.9.20 always rendered one cosmetic slice per
        // depleted prize TYPE, so upgrading never silently drops a prize the organizer could already see.
        const total = p.totalQty != null ? Math.max(Number(p.totalQty) || 0, remaining) : (remaining > 0 ? remaining : 1);
        const used = Math.max(0, total - remaining);
        // deliberately made to look IDENTICAL to a live slice of the same prize (same color, same label,
        // no "(หมด)" marker) — the whole point is that a spinning player can't tell it's already gone, so
        // the wheel still looks fully stocked and keeps the suspense up. isSoldOut is what actually keeps
        // it unwinnable (see the `selectable` filter in spin() below); nothing about how it LOOKS gives it away.
        for (let i = 0; i < used; i++) units.push({ ...p, isSoldOut: true, isNone: false, color: colorById[p.id] });
      }
    });
    for (let i = units.length - 1; i > 0; i--) { // Fisher–Yates shuffle ("คละกัน")
      const j = Math.floor(Math.random() * (i + 1));
      [units[i], units[j]] = [units[j], units[i]];
    }
    let built;
    if (units.length === 0) {
      built = totalPlayers > 0 ? [{ ...noneProto, span: 360, isNone: true, isSoldOut: false, color: NONE_SLICE_COLOR }] : [];
    } else {
      const span = 360 / (units.length * 2); // one prize slice + one miss slice per unit, all equal size
      built = [];
      units.forEach((u) => {
        built.push({ ...u, span });
        built.push({ ...noneProto, span, isNone: true, isSoldOut: false, color: NONE_SLICE_COLOR });
      });
    }
    let acc = 0;
    return built.map((s) => { const seg = { ...s, start: acc }; acc += s.span; return seg; });
  });

  const spin = () => {
    if (spinning || resultPrize || segs.length === 0) return;
    // cosmetic sold-out slices are excluded here — they occupy real visual space on the wheel above but
    // can NEVER be the one actually chosen, whatever `showSoldOut` is set to.
    const selectable = segs.filter((s) => !s.isSoldOut);
    if (selectable.length === 0) return;
    const totalSelectable = selectable.reduce((s, x) => s + x.span, 0);
    const r = Math.random() * totalSelectable;
    let cum = 0, chosen = selectable[selectable.length - 1];
    for (const s of selectable) { cum += s.span; if (r <= cum) { chosen = s; break; } }
    const center = chosen.start + chosen.span / 2;
    const target = 5 * 360 + (360 - center);
    setSpinning(true);
    setRotation(target);
    setTimeout(() => { setSpinning(false); setResultPrize(chosen); onFinish(chosen); }, 4200);
  };

  const R = 125, CX = 125, CY = 125, LABEL_R = R * 0.58; // centered between the hub (~22) and the rim (125), not hugging the center — SVG drawing math stays in this fixed 250-unit space; only the on-screen CSS size below scales
  // scale the wheel to fill most of the screen on any device (phone or tablet, portrait or landscape) while
  // always leaving room for the title/subtitle above and the spin/close buttons below so nothing overflows
  const wheelSize = "min(90vw, 58vh, 640px)";
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 80, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "calc(20px + env(safe-area-inset-top)) 20px calc(20px + env(safe-area-inset-bottom))", boxSizing: "border-box" }}>
      <div style={{ color: "#fff", fontSize: 17, fontWeight: 800, marginBottom: 6 }}>🎡 หมุนวงล้อรางวัล</div>
      {totalPlayers > 0 && <div style={{ color: "#cbd5cf", fontSize: 11.5, marginBottom: 12 }}>เหลือรางวัล {totalPrizeQty} จาก {totalPlayers} คนที่ยังไม่ได้หมุน</div>}
      <div style={{ position: "relative", width: wheelSize, height: wheelSize, flexShrink: 0 }}>
        <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", zIndex: 2, fontSize: "min(7vw, 32px)" }}>🔻</div>
        <div style={{ width: "100%", height: "100%", borderRadius: "50%", boxShadow: "0 8px 30px rgba(0,0,0,0.4)", transition: "transform 4.2s cubic-bezier(0.17,0.67,0.24,1)", transform: `rotate(${rotation}deg)`, overflow: "hidden", border: "6px solid #fff", boxSizing: "border-box", background: T.surface2 }}>
          <svg viewBox="0 0 250 250" width="100%" height="100%">
            {segs.map((s, i) => (
              <path key={i} d={describeSlicePath(CX, CY, R, s.start, s.start + s.span)} fill={s.color} stroke="#fff" strokeWidth={1} />
            ))}
            {segs.map((s, i) => {
              if (s.isNone || s.span < 6) return null; // skip labels on miss slices, and on slivers too thin to hold text
              const mid = s.start + s.span / 2; // slice bisector angle — text runs straight along this line, so it's always centered within its own colored slice
              const pt = polarToCartesian(CX, CY, LABEL_R, mid);
              const rot = mid - 90; // radial orientation, but centered (textAnchor="middle") on pt rather than starting there — reads centered within the slice, clear of both the hub and the rim
              // dark fill + white outline reads clearly on every slice now that the palette is bright/light (yellow text on a yellow slice would vanish)
              return (
                <text key={"t" + i} x={pt.x} y={pt.y} transform={`rotate(${rot} ${pt.x} ${pt.y})`} textAnchor="middle" dominantBaseline="middle" fontSize="9.5" fontWeight="800" fill="#1f2937" stroke="#ffffff" strokeWidth="3" paintOrder="stroke" style={{ fontFamily: "inherit" }}>
                  {truncateLabel(s.label, 22)}
                </text>
              );
            })}
          </svg>
        </div>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "17.6%", height: "17.6%", borderRadius: "50%", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "min(7vw, 32px)" }}>🏸</div>
      </div>
      {!resultPrize ? (
        <>
          <button onClick={spin} disabled={spinning || segs.length === 0} style={{ marginTop: 26, padding: "13px 34px", borderRadius: 30, background: spinning ? T.muted : T.green, border: "none", color: "#fff", fontSize: 15, fontWeight: 800 }}>{spinning ? "กำลังหมุน..." : "หมุนเลย!"}</button>
          {segs.length === 0 && <div style={{ color: "#e5b3b3", fontSize: 12.5, marginTop: 10 }}>ยังไม่ได้ตั้งค่ารางวัลในวงล้อ</div>}
          {!spinning && <button onClick={onClose} style={{ marginTop: 14, background: "none", border: "none", color: "#cbd5cf", fontSize: 13 }}>ปิด</button>}
        </>
      ) : (
        <>
          <div style={{ marginTop: 22, background: "#fff", borderRadius: 16, padding: "16px 24px", textAlign: "center", maxWidth: 290, boxSizing: "border-box" }}>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 4 }}>ผลการหมุน</div>
            <div style={{ fontSize: 16.5, fontWeight: 800, color: T.green }}>🎉 {resultPrize.label}</div>
          </div>
          <button onClick={onClose} style={{ marginTop: 18, padding: "11px 26px", borderRadius: 30, background: "#fff", border: "none", color: "#111", fontSize: 14, fontWeight: 800 }}>ปิด</button>
        </>
      )}
    </div>
  );
}

function Label({ children }) { return <div style={{ fontSize: 12.5, fontWeight: 800, color: T.muted, marginBottom: 8 }}>{children}</div>; }
function Stepper({ value, setValue, min, max }) {
  const btn = { width: 38, height: 38, borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface2, color: T.text, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 };
  return <div style={{ display: "flex", alignItems: "center", gap: 12 }}><button onClick={() => setValue(Math.max(min, value - 1))} style={btn}><Minus size={17} /></button><span style={{ fontSize: 22, fontWeight: 800, minWidth: 26, textAlign: "center" }}>{value}</span><button onClick={() => setValue(Math.min(max, value + 1))} style={btn}><Plus size={17} /></button></div>;
}
function NumField({ label, value, onChange }) {
  return <div style={{ flex: 1 }}><div style={{ fontSize: 11.5, color: T.muted, marginBottom: 5 }}>{label}</div><input type="number" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} style={{ width: "100%", padding: "11px 12px", borderRadius: 11, background: T.surface, border: `1px solid ${T.border}`, color: T.text, fontSize: 15, fontWeight: 700, outline: "none", boxSizing: "border-box" }} /></div>;
}
const btnPrimary = { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "11px 0", borderRadius: 11, background: T.green, border: "none", color: "#fff", fontSize: 13.5, fontWeight: 800 };
const btnSecondary = { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "11px 0", borderRadius: 11, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 13.5, fontWeight: 700 };
