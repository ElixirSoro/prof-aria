import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY, ARIA_FUNCTION } from "./config.js";
import { createDictation, speak, stopSpeaking, dictationSupported } from "./speech.js";
import { createSky } from "./sky.js";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);

let profile = null;
let busy = false;

/* ============================================================
   1. Connexion
   ============================================================ */
$("btn-google").addEventListener("click", () =>
  sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.href.split("#")[0] }
  })
);

$("btn-magic").addEventListener("click", async () => {
  const email = $("email").value.trim();
  if (!email) return setGateMsg("Entrez une adresse e-mail pour recevoir le lien.");
  $("btn-magic").disabled = true;
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href.split("#")[0] }
  });
  $("btn-magic").disabled = false;
  setGateMsg(error ? `Envoi impossible : ${error.message}` : "Lien envoyé. Ouvrez-le depuis cet appareil.");
});

$("btn-signout").addEventListener("click", async () => {
  stopSpeaking();
  await sb.auth.signOut();
  location.reload();
});

const setGateMsg = t => { $("gate-msg").textContent = t; };

sb.auth.onAuthStateChange((_e, session) => { if (session) boot(session); });

(async function start() {
  const { data } = await sb.auth.getSession();
  data.session ? boot(data.session) : showGate();
})();

const sky = createSky($("sky"));

function showGate() {
  $("gate").hidden = false;
  $("app").hidden = true;
  sky.demarrer();
}

/* ============================================================
   2. Démarrage de la séance
   ============================================================ */
async function boot(session) {
  sky.arreter();
  $("gate").hidden = true;
  $("app").hidden = false;
  $("who").textContent = session.user.email ?? session.user.id;

  await loadProfile(session.user);
  await loadThread();
  renderRail();

  if (!$("thread").children.length) {
    addMessage("aria",
      "Bienvenue. Avant toute leçon, je dois évaluer votre niveau réel — sans ce diagnostic, " +
      "tout plan sur six semaines serait une supposition.\n\n" +
      "Écrivez **start** pour lancer le test, ou dites-moi d'abord votre objectif " +
      "(TOEFL, TOEIC, les deux), votre langue maternelle et le temps dont vous disposez chaque jour."
    );
  }
}

async function loadProfile(user) {
  const { data } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (data) { profile = data; return; }

  const { data: created, error } = await sb.from("profiles").insert({
    id: user.id,
    email: user.email,
    cefr_level: null,
    day: 1,
    week: 1,
    target_level: "C2"
  }).select().single();

  if (error) { setStatus(`Profil non créé : ${error.message}`); return; }
  profile = created;
}

async function loadThread() {
  const { data } = await sb.from("sessions")
    .select("role, content, created_at")
    .order("created_at", { ascending: true })
    .limit(60);
  (data ?? []).forEach(m => addMessage(m.role === "user" ? "me" : "aria", m.content, { silent: true }));
  scrollThread();
}

/* ============================================================
   3. Envoi d'un message
   ============================================================ */
const input = $("input");
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 180) + "px";
});
input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
});
$("btn-send").addEventListener("click", send);

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/${ARIA_FUNCTION}`;

async function send() {
  const text = input.value.trim();
  if (!text || busy) return;

  busy = true;
  $("btn-send").disabled = true;
  input.value = "";
  input.style.height = "auto";
  addMessage("me", text);

  const bubble = addStreamingMessage();
  let received = "";

  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error("session expirée, reconnectez-vous");

    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
        "apikey": SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ message: text })
    });

    // Les erreurs arrivent en JSON classique, pas en flux.
    if (!res.ok || !res.body) {
      let detail = `code ${res.status}`;
      try { detail = (await res.json()).error ?? detail; } catch { /* corps non JSON */ }
      throw new Error(detail);
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let stuck = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });

      let nl;
      while ((nl = buf.indexOf("\n\n")) !== -1) {
        const frame = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 2);
        if (!frame.startsWith("data:")) continue;

        let evt;
        try { evt = JSON.parse(frame.slice(5).trim()); } catch { continue; }

        if (evt.type === "delta") {
          received += evt.text;
          bubble.write(received);
        } else if (evt.type === "error") {
          stuck = evt.error;
        } else if (evt.type === "done") {
          received = evt.reply ?? received;
          bubble.write(received);
          if (evt.profile) { profile = evt.profile; renderRail(); }
          if ($("tts-auto").checked) speak(stripMarkup(received));
        }
      }
    }

    bubble.finish(received);
    setStatus(stuck ?? "");
  } catch (err) {
    if (received) {
      bubble.finish(received);
      setStatus(`Flux interrompu : ${err.message}. La réponse est peut-être incomplète.`);
    } else {
      bubble.el.remove();
      setStatus(`Réponse non reçue : ${err.message}. Votre message n'a pas été perdu, réessayez.`);
      input.value = text;
      input.dispatchEvent(new Event("input"));
    }
  } finally {
    busy = false;
    $("btn-send").disabled = false;
    input.focus();
  }
}

/* ============================================================
   4. Affichage des messages
   ============================================================ */
function addMessage(who, text, { speak: read = false, silent = false } = {}) {
  const el = document.createElement("article");
  el.className = `msg msg--${who === "me" ? "me" : "aria"}`;
  el.innerHTML = `
    <p class="msg__who">${who === "me" ? "Vous" : "Prof. Aria"}</p>
    <div class="msg__body">${renderMarkdown(text)}</div>`;

  if (who !== "me" && "speechSynthesis" in window) {
    const b = document.createElement("button");
    b.className = "msg__listen";
    b.textContent = "Écouter";
    b.addEventListener("click", () => speak(stripMarkup(text)));
    el.appendChild(b);
  }

  $("thread").appendChild(el);
  if (!silent) scrollThread();
  if (read) speak(stripMarkup(text));
  return el;
}

/**
 * Bulle qui se remplit pendant le flux. `write` rend le Markdown reçu jusqu'ici,
 * `finish` retire le curseur et ajoute le bouton d'écoute.
 */
function addStreamingMessage() {
  const el = document.createElement("article");
  el.className = "msg msg--aria";
  el.innerHTML = `<p class="msg__who">Prof. Aria</p>
    <div class="msg__body"><span class="pulse"><i></i><i></i><i></i></span></div>`;
  $("thread").appendChild(el);
  scrollThread();

  const body = el.querySelector(".msg__body");
  return {
    el,
    write(text) {
      // Ne suit le flux que si l'utilisateur n'a pas remonté pour relire.
      const thread = $("thread");
      const atBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 90;
      body.innerHTML = renderMarkdown(text) + `<span class="caret"></span>`;
      if (atBottom) scrollThread();
    },
    finish(text) {
      body.innerHTML = renderMarkdown(text);
      if ("speechSynthesis" in window && text.trim()) {
        const b = document.createElement("button");
        b.className = "msg__listen";
        b.textContent = "Écouter";
        b.addEventListener("click", () => speak(stripMarkup(text)));
        el.appendChild(b);
      }
      scrollThread();
    }
  };
}

const scrollThread = () => { $("thread").scrollTop = $("thread").scrollHeight; };
const setStatus = t => { $("status").textContent = t; };

const esc = s => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

/** Rendu Markdown minimal : blocs de code, titres, listes, gras, code en ligne. */
function renderMarkdown(src = "") {
  const blocks = [];
  let text = src.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, __, code) => {
    blocks.push(`<pre><code>${esc(code.trim())}</code></pre>`);
    return `\u0000${blocks.length - 1}\u0000`;
  });

  const inline = s => esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

  const out = [];
  let list = null;
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const ph = line.match(/^\u0000(\d+)\u0000$/);
    if (ph) { closeList(); out.push(blocks[+ph[1]]); continue; }
    if (!line.trim()) { closeList(); continue; }

    const h = line.match(/^#{1,4}\s+(.*)$/);
    if (h) { closeList(); out.push(`<h3>${inline(h[1])}</h3>`); continue; }

    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      const tag = ul ? "ul" : "ol";
      if (list !== tag) { closeList(); out.push(`<${tag}>`); list = tag; }
      out.push(`<li>${inline((ul || ol)[1])}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  function closeList() { if (list) { out.push(`</${list}>`); list = null; } }
  return out.join("");
}

const stripMarkup = s => s
  .replace(/```[\s\S]*?```/g, "")
  .replace(/[*#`>]/g, "")
  .trim();

/* ============================================================
   5. Rail : niveau, trajectoire, jauges, points faibles
   ============================================================ */
function renderRail() {
  if (!profile) return;

  const day = profile.day ?? 1;
  const week = profile.week ?? Math.ceil(day / 7);
  $("day-line").textContent = `Jour ${day} / 42 · Semaine ${week} / 6`;
  $("level-line").textContent = profile.cefr_level
    ? `Niveau ${profile.cefr_level}`
    : "Niveau non évalué";

  const gap = drawSpine($("spine-host"), {
    day,
    points: profile.level_history ?? [],
    target: profile.target_level ?? "C2"
  });
  $("spine-gap").textContent = gap;

  gauge("toefl", profile.toefl_estimate, 120);
  gauge("toeic", profile.toeic_estimate, 990);

  const weak = profile.weak_points ?? [];
  $("weak-list").innerHTML = weak.length
    ? weak.slice(0, 8).map(w => `<li>${esc(typeof w === "string" ? w : w.detail ?? "")}</li>`).join("")
    : `<li class="chips__empty">Rien de relevé pour l'instant.</li>`;
}

function gauge(name, value, max) {
  $(`g-${name}-v`).textContent = Number.isFinite(value) ? value : "—";
  $(`g-${name}-b`).style.setProperty("--w", `${Math.min(100, ((value ?? 0) / max) * 100)}%`);
}

/* ============================================================
   6. Export, import, réinitialisation
   ============================================================ */
$("btn-export").addEventListener("click", async () => {
  const { data: sessions } = await sb.from("sessions")
    .select("role, content, meta, created_at").order("created_at", { ascending: true });
  const blob = new Blob(
    [JSON.stringify({ exported_at: new Date().toISOString(), profile, sessions }, null, 2)],
    { type: "application/json" }
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `prof-aria-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus("Profil exporté.");
});

$("btn-import").addEventListener("click", () => $("file-import").click());
$("file-import").addEventListener("change", async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!parsed.profile) throw new Error("aucun profil dans ce fichier");
    const { id, email, created_at, ...fields } = parsed.profile;
    const { data, error } = await sb.from("profiles")
      .update(fields).eq("id", profile.id).select().single();
    if (error) throw error;
    profile = data;
    renderRail();
    setStatus("Profil importé. L'historique de conversation n'est pas remplacé.");
  } catch (err) {
    setStatus(`Import refusé : ${err.message}.`);
  } finally {
    e.target.value = "";
  }
});

$("btn-reset").addEventListener("click", async () => {
  if (!confirm("Effacer la progression et repartir du jour 1 ? L'historique des séances sera supprimé.")) return;
  await sb.from("sessions").delete().eq("user_id", profile.id);
  const { data, error } = await sb.from("profiles").update({
    cefr_level: null, skill_levels: null, toefl_estimate: null, toeic_estimate: null,
    weak_points: [], level_history: [], day: 1, week: 1, progress_notes: null
  }).eq("id", profile.id).select().single();
  if (error) return setStatus(`Réinitialisation impossible : ${error.message}`);
  profile = data;
  $("thread").innerHTML = "";
  renderRail();
  setStatus("Progression remise à zéro. Le prochain message relancera le diagnostic.");
});

/* ============================================================
   7. Dictée
   ============================================================ */
const mic = $("btn-mic");
if (!dictationSupported) {
  mic.disabled = true;
  mic.title = "Dictée non disponible dans ce navigateur";
} else {
  const dictation = createDictation({
    onText: t => {
      input.value = (input.value ? input.value + " " : "") + t;
      input.dispatchEvent(new Event("input"));
    },
    onEnd: () => mic.classList.remove("on")
  });
  mic.addEventListener("click", () => {
    if (dictation.active) { dictation.stop(); return; }
    stopSpeaking();
    dictation.start();
    mic.classList.add("on");
  });
}

$("tts-auto").addEventListener("change", e => { if (!e.target.checked) stopSpeaking(); });

/* ============================================================
   8. Tiroir du dossier (mobile)
   ============================================================ */
const railBtn = $("btn-rail");

function setRail(open) {
  document.body.classList.toggle("rail-open", open);
  if (railBtn) railBtn.setAttribute("aria-expanded", open ? "true" : "false");
}

function toggleRail(e) {
  if (e) e.preventDefault();
  setRail(!document.body.classList.contains("rail-open"));
}

// Deux zones d'ouverture : le bouton, et le bloc jour/niveau a cote.
if (railBtn) railBtn.addEventListener("click", toggleRail);
const meta = document.querySelector(".session__meta");
if (meta) meta.addEventListener("click", () => {
  if (window.innerWidth <= 900) toggleRail();
});

$("btn-rail-close").addEventListener("click", () => setRail(false));
$("scrim").addEventListener("click", () => setRail(false));
document.addEventListener("keydown", e => { if (e.key === "Escape") setRail(false); });

// Le tiroir n'a plus de raison d'etre au-dela de 900 px : on referme.
const wide = matchMedia("(min-width: 901px)");
const onWide = e => { if (e.matches) setRail(false); };
if (wide.addEventListener) wide.addEventListener("change", onWide);
else if (wide.addListener) wide.addListener(onWide);

/* ============================================================
   9. Trajectoire CEFR (SVG)
   L'aire pleine, c'est l'acquis. Le pointille, ce qui reste a gravir.
   ============================================================ */
var LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
var W = 300, H = 196, PAD_L = 28, PAD_R = 6, PAD_T = 12, PAD_B = 24;

function y(i) {
  return PAD_T + (H - PAD_T - PAD_B) * (1 - i / (LEVELS.length - 1));
}

function x(d) {
  var day = Math.min(Math.max(d, 1), 42);
  return PAD_L + (W - PAD_L - PAD_R) * (day - 1) / 41;
}

function levelIndex(code) {
  var i = LEVELS.indexOf(String(code || "").toUpperCase().replace(/\s/g, ""));
  return i === -1 ? null : i;
}

function drawSpine(host, data) {
  var opts = data || {};
  var day = opts.day || 1;
  var raw = opts.points || [];
  var target = opts.target || "C2";

  var plotted = [];
  for (var k = 0; k < raw.length; k++) {
    var d = Number(raw[k].day);
    var i = levelIndex(raw[k].level);
    if (i !== null && isFinite(d)) plotted.push({ d: d, i: i });
  }
  plotted.sort(function (a, b) { return a.d - b.d; });

  var ti = levelIndex(target);
  if (ti === null) ti = 5;
  var baseY = y(0);

  // Paliers CEFR. Celui qui est vise est trace en pointille.
  var grid = "";
  for (var g = 0; g < LEVELS.length; g++) {
    var isGoal = g === ti;
    var stroke = isGoal ? "var(--stone)" : "rgb(236 233 225 / .08)";
    var dash = isGoal ? ' stroke-dasharray="2 5" opacity=".55"' : "";
    grid +=
      '<line x1="' + PAD_L + '" y1="' + y(g) + '" x2="' + (W - PAD_R) + '" y2="' + y(g) +
      '" stroke="' + stroke + '" stroke-width="1"' + dash + "/>" +
      '<text x="0" y="' + (y(g) + 3.6) + '" font-family="var(--mono)" font-size="10"' +
      ' letter-spacing=".06em" fill="' + (isGoal ? "var(--stone)" : "var(--on-dark-dim)") + '">' +
      LEVELS[g] + "</text>";
  }

  var ticks = "";
  var marks = [1, 14, 28, 42];
  for (var t = 0; t < marks.length; t++) {
    ticks +=
      '<text x="' + x(marks[t]) + '" y="' + (H - 6) + '" text-anchor="middle"' +
      ' font-family="var(--mono)" font-size="10" fill="var(--on-dark-dim)">J' + marks[t] + "</text>";
  }

  var now =
    '<line x1="' + x(day) + '" y1="' + (PAD_T - 5) + '" x2="' + x(day) + '" y2="' + baseY +
    '" stroke="#ECE9E1" stroke-width="1" opacity=".2"/>';

  var area = "", line = "", dots = "", plan = "";

  if (plotted.length > 0) {
    var coords = [];
    for (var p = 0; p < plotted.length; p++) {
      coords.push(x(plotted[p].d).toFixed(1) + "," + y(plotted[p].i).toFixed(1));
      dots +=
        '<circle cx="' + x(plotted[p].d).toFixed(1) + '" cy="' + y(plotted[p].i).toFixed(1) +
        '" r="3" fill="var(--plum-2)" stroke="var(--rose)" stroke-width="1.8"/>';
    }

    var first = plotted[0];
    var last = plotted[plotted.length - 1];

    line =
      '<path class="spine__line" d="M' + coords.join(" L") + '" fill="none" stroke="var(--rose)"' +
      ' stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>';

    area =
      '<path d="M' + x(first.d).toFixed(1) + "," + baseY + " L" + coords.join(" L") +
      " L" + x(last.d).toFixed(1) + "," + baseY + ' Z" fill="url(#acquis)"/>';

    if (last.d < 42) {
      plan =
        '<path d="M' + x(last.d).toFixed(1) + "," + y(last.i).toFixed(1) +
        " L" + x(42) + "," + y(ti) + '" fill="none" stroke="var(--stone)" stroke-width="1.8"' +
        ' stroke-dasharray="2 5" stroke-linecap="round" opacity=".9"/>' +
        '<circle cx="' + x(42) + '" cy="' + y(ti) + '" r="3" fill="var(--stone)"/>';
    }
  }

  host.innerHTML =
    '<svg viewBox="0 0 ' + W + " " + H + '" role="img"' +
    ' aria-label="Trajectoire CEFR sur 42 jours, jour ' + day + ', objectif ' + target + '">' +
    "<defs>" +
    '<linearGradient id="acquis" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="var(--rose)" stop-opacity=".34"/>' +
    '<stop offset="100%" stop-color="var(--rose)" stop-opacity="0"/>' +
    "</linearGradient></defs>" +
    grid + ticks + now + area + plan + line + dots +
    "</svg>";

  var path = host.querySelector(".spine__line");
  if (path && path.getTotalLength && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var len = path.getTotalLength();
    path.animate(
      [
        { strokeDasharray: len, strokeDashoffset: len },
        { strokeDasharray: len, strokeDashoffset: 0 }
      ],
      { duration: 1000, easing: "cubic-bezier(.2,.8,.2,1)" }
    );
  }

  return gapLabel(plotted, ti, day);
}

// Ce qu'il reste a gravir, dit sans detour.
function gapLabel(plotted, ti, day) {
  if (plotted.length === 0) return "niveau non evalue";
  var current = plotted[plotted.length - 1].i;
  var steps = ti - current;
  var daysLeft = Math.max(0, 42 - day);
  if (steps <= 0) return "objectif atteint · J" + day;
  return steps + " palier" + (steps > 1 ? "s" : "") +
         " en " + daysLeft + " jour" + (daysLeft > 1 ? "s" : "");
}
