// La trajectoire — element signature du dossier.
// L'aire pleine, c'est l'acquis. Le pointille, c'est ce qui reste a gravir.
// Ecrit sans syntaxe recente, pour passer dans tous les moteurs.

var LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
var W = 300, H = 188, PAD_L = 24, PAD_R = 6, PAD_T = 12, PAD_B = 20;

function y(i) {
  return PAD_T + (H - PAD_T - PAD_B) * (1 - i / (LEVELS.length - 1));
}

function x(d) {
  var day = Math.min(Math.max(d, 1), 42);
  return PAD_L + (W - PAD_L - PAD_R) * (day - 1) / 41;
}

export function levelIndex(code) {
  var i = LEVELS.indexOf(String(code || "").toUpperCase().replace(/\s/g, ""));
  return i === -1 ? null : i;
}

export function drawSpine(host, data) {
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
      '<text x="0" y="' + (y(g) + 3.2) + '" font-family="var(--mono)" font-size="8.5"' +
      ' letter-spacing=".06em" fill="' + (isGoal ? "var(--stone)" : "var(--on-dark-dim)") + '">' +
      LEVELS[g] + "</text>";
  }

  var ticks = "";
  var marks = [1, 14, 28, 42];
  for (var t = 0; t < marks.length; t++) {
    ticks +=
      '<text x="' + x(marks[t]) + '" y="' + (H - 5) + '" text-anchor="middle"' +
      ' font-family="var(--mono)" font-size="8.5" fill="var(--on-dark-dim)">J' + marks[t] + "</text>";
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
