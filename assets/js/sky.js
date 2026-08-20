// Ciel de la page de connexion.
// Une nuee derive en continu ; l'inclinaison du telephone ou la position
// du pointeur infléchit sa course. Palette « Dried Roses » uniquement.

var TEINTES = [
  [185, 143, 151],  // rose  B98F97
  [196, 193, 185],  // stone C4C1B9
  [236, 233, 225],  // bone  ECE9E1
  [117,  80,  88]   // mauve 755058
];

var ANGLE_BASE = 0.30;      // course generale, vers le bas a droite
var NB_MIN = 60, NB_MAX = 150;

export function createSky(canvas) {
  var ctx = canvas.getContext("2d");
  var sobre = matchMedia("(prefers-reduced-motion: reduce)").matches;

  var w = 0, h = 0, dpr = 1;
  var etoiles = [];
  var filantes = [];
  var frame = null;
  var vivant = false;

  // Barre franchie par le pointeur ou l'inclinaison, entre -1 et 1.
  var barreX = 0, barreY = 0;
  var barreLisseeX = 0, barreLisseeY = 0;

  function redimensionner() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    peupler();
  }

  function peupler() {
    var densite = Math.round((w * h) / 12000);
    var n = Math.max(NB_MIN, Math.min(NB_MAX, densite));
    etoiles = [];
    for (var i = 0; i < n; i++) etoiles.push(naitre(true));
  }

  // profondeur : 0 = lointain et lent, 1 = proche et rapide
  function naitre(partout) {
    var p = Math.random();
    var teinte = TEINTES[Math.floor(Math.random() * TEINTES.length)];
    return {
      x: partout ? Math.random() * w : -60 - Math.random() * 200,
      y: partout ? Math.random() * h : Math.random() * h - h * 0.3,
      p: p,
      v: 0.18 + p * 1.5,
      len: 6 + p * 26,
      a: 0.15 + p * 0.55,
      c: teinte,
      scint: Math.random() * Math.PI * 2
    };
  }

  function naitreFilante() {
    return {
      x: -80,
      y: Math.random() * h * 0.75,
      v: 7 + Math.random() * 6,
      len: 130 + Math.random() * 150,
      vie: 1,
      c: TEINTES[Math.random() < 0.6 ? 2 : 0]   // surtout bone, parfois rose
    };
  }

  function trait(x, y, dx, dy, couleur, alpha, epaisseur) {
    ctx.strokeStyle = "rgba(" + couleur[0] + "," + couleur[1] + "," + couleur[2] + "," + alpha + ")";
    ctx.lineWidth = epaisseur;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - dx, y - dy);
    ctx.stroke();
  }

  function dessiner(t) {
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round";

    // La barre suit le pointeur avec de l'inertie : jamais de saccade.
    barreLisseeX += (barreX - barreLisseeX) * 0.045;
    barreLisseeY += (barreY - barreLisseeY) * 0.045;

    var angle = ANGLE_BASE + barreLisseeX * 0.55;
    var cos = Math.cos(angle), sin = Math.sin(angle);
    var elan = 1 + barreLisseeY * 0.45;

    for (var i = 0; i < etoiles.length; i++) {
      var e = etoiles[i];

      if (!sobre) {
        e.x += cos * e.v * elan;
        e.y += sin * e.v * elan;
        e.scint += 0.02 + e.p * 0.03;
      }

      // Derive laterale de parallaxe : le premier plan reagit plus fort.
      var glissX = barreLisseeX * 26 * e.p;
      var glissY = barreLisseeY * 18 * e.p;

      var battement = 0.72 + Math.sin(e.scint) * 0.28;
      var dx = cos * e.len, dy = sin * e.len;
      trait(e.x + glissX, e.y + glissY, dx, dy, e.c, e.a * battement, 0.5 + e.p * 1.2);

      if (e.x - 60 > w || e.y - 60 > h) etoiles[i] = naitre(false);
    }

    // Etoiles filantes : rares, franches, avec une vraie tra;nee.
    if (!sobre) {
      if (filantes.length < 3 && Math.random() < 0.006) filantes.push(naitreFilante());

      for (var f = filantes.length - 1; f >= 0; f--) {
        var s = filantes[f];
        s.x += cos * s.v * elan * 2.1;
        s.y += sin * s.v * elan * 2.1;
        s.vie -= 0.004;

        var qx = s.x - cos * s.len, qy = s.y - sin * s.len;
        var deg = ctx.createLinearGradient(s.x, s.y, qx, qy);
        var rgb = s.c[0] + "," + s.c[1] + "," + s.c[2];
        deg.addColorStop(0, "rgba(" + rgb + "," + (0.9 * s.vie) + ")");
        deg.addColorStop(0.4, "rgba(" + rgb + "," + (0.28 * s.vie) + ")");
        deg.addColorStop(1, "rgba(" + rgb + ",0)");

        ctx.strokeStyle = deg;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(qx, qy);
        ctx.stroke();

        // Tete lumineuse
        ctx.fillStyle = "rgba(" + rgb + "," + (0.95 * s.vie) + ")";
        ctx.beginPath();
        ctx.arc(s.x, s.y, 1.6, 0, Math.PI * 2);
        ctx.fill();

        if (s.vie <= 0 || s.x - s.len > w || s.y - s.len > h) filantes.splice(f, 1);
      }
    }

    if (vivant) frame = requestAnimationFrame(dessiner);
  }

  /* ---------------- Entrees ---------------- */

  function surPointeur(e) {
    barreX = (e.clientX / window.innerWidth) * 2 - 1;
    barreY = (e.clientY / window.innerHeight) * 2 - 1;
  }

  function surToucher(e) {
    if (!e.touches || !e.touches.length) return;
    barreX = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
    barreY = (e.touches[0].clientY / window.innerHeight) * 2 - 1;
  }

  function surInclinaison(e) {
    if (e.gamma === null || e.beta === null) return;
    barreX = Math.max(-1, Math.min(1, e.gamma / 45));       // gauche / droite
    barreY = Math.max(-1, Math.min(1, (e.beta - 45) / 45)); // avant / arriere
  }

  var surRedim = function () { redimensionner(); };

  function demarrer() {
    if (vivant) return;
    vivant = true;
    redimensionner();
    window.addEventListener("resize", surRedim);
    window.addEventListener("pointermove", surPointeur, { passive: true });
    window.addEventListener("touchmove", surToucher, { passive: true });
    if (window.DeviceOrientationEvent) {
      window.addEventListener("deviceorientation", surInclinaison, { passive: true });
    }
    frame = requestAnimationFrame(dessiner);
  }

  function arreter() {
    vivant = false;
    if (frame) cancelAnimationFrame(frame);
    window.removeEventListener("resize", surRedim);
    window.removeEventListener("pointermove", surPointeur);
    window.removeEventListener("touchmove", surToucher);
    window.removeEventListener("deviceorientation", surInclinaison);
  }

  // iOS exige une autorisation explicite, declenchee par un geste.
  function demanderInclinaison() {
    var D = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === "function") {
      D.requestPermission().then(function (r) {
        if (r === "granted") window.addEventListener("deviceorientation", surInclinaison, { passive: true });
      }).catch(function () { /* refus : le toucher suffit */ });
    }
  }

  return { demarrer: demarrer, arreter: arreter, demanderInclinaison: demanderInclinaison };
}
