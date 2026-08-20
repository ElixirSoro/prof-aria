// La trajectoire — élément signature du dossier.
// L'aire pleine, c'est l'acquis. Le pointillé, c'est ce qui reste à gravir.

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const W = 300, H = 188, PAD_L = 24, PAD_R = 6, PAD_T = 12, PAD_B = 20;

const y = i => PAD_T + (H - PAD_T - PAD_B) * (1 - i / (LEVELS.length - 1));
const x = d => PAD_L + (W - PAD_L - PAD_R) * (Math.min(Math.max(d, 1), 42) - 1) / 41;

export function levelIndex(code) {
  const i = LEVELS.indexOf(String(code || "").toUpperCase().trim());
  return i === -1 ? null : i;
}

/**
 * @param {HTMLElement} host
 * @param {{day:number, points:{day:number, level:string}[], target:string}} data
 * @returns {string} libellé de l'écart restant, pour l'en-tête du panneau
 */
export function drawSpine(host, { day = 1, points = [], target = "C2" } = {}) {
  const plotted = points
    .map(p => ({ d: Number(p.day), i: levelIndex(p.level) }))
    .filter(p => p.i !== null && Number.isFinite(p.d))
    .sort((a, b) => a.d - b.d);

  const ti = levelIndex(target) ?? 5;
  const baseY = y(0);

  const grid = LEVELS.map((lv, i) => {
    const goal = i === ti;
    return `
    <line x1="${PAD_L}" y1="${y(i)}" x2="${W - PAD_R}" y2="${y(i)}"
          stroke="${goal ? "var(--stone)" : "rgb(255 255 255 / .07)"}" stroke-width="1"
          ${goal ? 'stroke-dasharray="2 5" opacity=".55"' : ""}/>
    <text x="0" y="${y(i) + 3.2}" font-family="var(--mono)" font-size="8.5"
          letter-spacing=".06em" fill="${goal ? "var(--stone)" : "var(--on-dark-dim)"}">${lv}</text>`;
  }).join("");

  const ticks = [1, 14, 28, 42].map(d => `
    <text x="${x(d)}" y="${H - 5}" text-anchor="middle" font-family="var(--mono)"
          font-size="8.5" fill="var(--on-dark-dim)">J${d}</text>`).join("");

  let area = "", line = "", dots = "", plan = "", now = "";

  if (plotted.length) {
    const pts = plotted.map(p => `${x(p.d).toFixed(1)},${y(p.i).toFixed(1)}`);
    line = `<path class="spine__line" d="M${pts.join(" L")}" fill="none" stroke="var(--rose)"
              stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
    area = `<path d="M${x(plotted[0].d).toFixed(1)},${baseY} L${pts.join(" L")} L${x(plotted[plotted.length - 1].d).toFixed(1)},${baseY} Z"
              fill="url(#acquis)"/>`;
    dots = plotted.map(p =>
      `<circle cx="${x(p.d).toFixed(1)}" cy="${y(p.i).toFixed(1)}" r="3"
               fill="var(--plum-2)" stroke="var(--rose)" stroke-width="1.8"/>`).join("");

    const last = plotted[plotted.length - 1];
    if (last.d < 42) {
      plan = `<path d="M${x(last.d).toFixed(1)},${y(last.i).toFixed(1)} L${x(42)},${y(ti)}"
                fill="none" stroke="var(--stone)" stroke-width="1.8"
                stroke-dasharray="2 5" stroke-linecap="round" opacity=".9"/>
              <circle cx="${x(42)}" cy="${y(ti)}" r="3" fill="var(--stone)"/>`;
    }
  }

  // Repère du jour courant
  now = `<line x1="${x(day)}" y1="${PAD_T - 5}" x2="${x(day)}" y2="${baseY}"
               stroke="#fff" stroke-width="1" opacity=".22"/>`;

  host.innerHTML = `
  <svg viewBox="0 0 ${W} ${H}" role="img"
       aria-label="Trajectoire CEFR sur 42 jours, jour ${day}, objectif ${target}">
    <defs>
      <linearGradient id="acquis" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="var(--rose)" stop-opacity=".34"/>
        <stop offset="100%" stop-color="var(--rose)" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${grid}${ticks}${now}${area}${plan}${line}${dots}
  </svg>`;

  // Tracé animé
  const path = host.querySelector(".spine__line");
  if (path && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const len = path.getTotalLength();
    path.animate(
      [{ strokeDasharray: len, strokeDashoffset: len }, { strokeDasharray: len, strokeDashoffset: 0 }],
      { duration: 1000, easing: "cubic-bezier(.2,.8,.2,1)" }
    );
  }

  return gapLabel(plotted, ti, day);
}

/** Ce qu'il reste à gravir, dit sans détour. */
function gapLabel(plotted, ti, day) {
  if (!plotted.length) return "niveau non évalué";
  const current = plotted[plotted.length - 1].i;
  const steps = ti - current;
  const daysLeft = Math.max(0, 42 - day);
  if (steps <= 0) return `objectif atteint · J${day}`;
  return `${steps} palier${steps > 1 ? "s" : ""} en ${daysLeft} jour${daysLeft > 1 ? "s" : ""}`;
}    : "";

  const dots = plotted.map(p =>
    `<circle cx="${x(p.d).toFixed(1)}" cy="${y(p.i).toFixed(1)}" r="2.8"
             fill="var(--surface)" stroke="var(--verdi)" stroke-width="1.6"/>`).join("");

  // Projection : du dernier point relevé jusqu'à l'objectif au jour 42.
  const last = plotted[plotted.length - 1];
  const ti = levelIndex(target) ?? 5;
  const plan = last && last.d < 42
    ? `<path d="M${x(last.d).toFixed(1)},${y(last.i).toFixed(1)} L${x(42)},${y(ti)}"
             fill="none" stroke="var(--ochre)" stroke-width="1.6"
             stroke-dasharray="3 4" stroke-linecap="round" opacity=".85"/>`
    : "";

  host.innerHTML = `
  <svg viewBox="0 0 ${W} ${H}" role="img"
       aria-label="Trajectoire CEFR sur 42 jours, jour ${day}">
    ${grid}${ticks}
    <line x1="${x(day)}" y1="${PAD_T - 4}" x2="${x(day)}" y2="${H - PAD_B}"
          stroke="var(--plum)" stroke-width="1" opacity=".5"/>
    ${plan}
    ${path ? `<path class="spine__line" d="${path}" fill="none" stroke="var(--verdi)"
              stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : ""}
    ${dots}
  </svg>`;

  // Tracé animé, sauf si l'utilisateur préfère moins de mouvement.
  const line = host.querySelector(".spine__line");
  if (line && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const len = line.getTotalLength();
    line.style.strokeDasharray = len;
    line.style.strokeDashoffset = len;
    line.animate(
      [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
      { duration: 900, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" }
    );
  }
}
