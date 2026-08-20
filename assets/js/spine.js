// La colonne CEFR : 42 jours en abscisse, six paliers en ordonnée.
// Le relevé se trace en vert-de-gris, la projection vers l'objectif en ochre.

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const W = 288, H = 210, PAD_L = 26, PAD_R = 8, PAD_T = 10, PAD_B = 22;

const y = i => PAD_T + (H - PAD_T - PAD_B) * (1 - i / (LEVELS.length - 1));
const x = d => PAD_L + (W - PAD_L - PAD_R) * (Math.min(Math.max(d, 1), 42) - 1) / 41;

export function levelIndex(code) {
  const i = LEVELS.indexOf(String(code || "").toUpperCase().trim());
  return i === -1 ? null : i;
}

/**
 * @param {HTMLElement} host
 * @param {{day:number, points:{day:number, level:string}[], target:string}} data
 */
export function drawSpine(host, { day = 1, points = [], target = "C2" } = {}) {
  const plotted = points
    .map(p => ({ d: p.day, i: levelIndex(p.level) }))
    .filter(p => p.i !== null && Number.isFinite(p.d))
    .sort((a, b) => a.d - b.d);

  const grid = LEVELS.map((lv, i) => `
    <line x1="${PAD_L}" y1="${y(i)}" x2="${W - PAD_R}" y2="${y(i)}"
          stroke="var(--line)" stroke-width="1" ${i % 1 ? "" : ""}/>
    <text x="0" y="${y(i) + 3.5}" font-family="var(--mono)" font-size="9"
          letter-spacing=".08em" fill="var(--ink-2)">${lv}</text>`).join("");

  const ticks = [1, 14, 28, 42].map(d => `
    <text x="${x(d)}" y="${H - 6}" text-anchor="middle" font-family="var(--mono)"
          font-size="9" fill="var(--ink-2)">J${d}</text>`).join("");

  const path = plotted.length
    ? plotted.map((p, k) => `${k ? "L" : "M"}${x(p.d).toFixed(1)},${y(p.i).toFixed(1)}`).join(" ")
    : "";

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
