// Ciel de la page de connexion.
// Les etoiles naissent au point de fuite et foncent vers le spectateur :
// elles accelerent, s'ecartent, grossissent, puis passent hors champ.
// Le point de fuite suit le pointeur ou l'inclinaison du telephone.
// Palette « Dried Roses » uniquement.

var TEINTES = [
  [185, 143, 151],  // rose  B98F97
  [196, 193, 185],  // stone C4C1B9
  [236, 233, 225],  // bone  ECE9E1
  [117,  80,  88]   // mauve 755058
];

var Z_LOIN = 1;         // profondeur de naissance
var Z_PRES = 0.055;     // au-dela, l'etoile a depasse le spectateur
var NB_MIN = 70, NB_MAX = 190;

export function createSky(canvas) {
  var ctx = canvas.getContext("2d");
  var sobre = matchMedia("(prefers-reduced-motion: reduce)").matches;

  var w = 0, h = 0, dpr = 1, focale = 300;
  var etoiles = [];
  var frame = null;
  var vivant = false;
  var tempsGerbe = 0;

  // Position visee du point de fuite, entre -1 et 1, et sa version lissee.
  var viseX = 0, viseY = 0;
  var fuiteX = 0, fuiteY = 0;

  function redimensionner() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    focale = Math.max(w, h) * 0.62;
    peupler();
  }

  function peupler() {
    var n = Math.max(NB_MIN, Math.min(NB_MAX, Math.round((w * h) / 9000)));
    etoiles = [];
    for (var i = 0; i < n; i++) {
      var e = naitre();
      e.z = Z_PRES + Math.random() * (Z_LOIN - Z_PRES);  // etaler la nuee au depart
      etoiles.push(e);
    }
  }

  // Direction tiree au hasard sur le disque, avec un creux au centre
  // pour eviter l'amas de points immobiles au point de fuite.
  function naitre(gerbe) {
    var angle = Math.random() * Math.PI * 2;
    var rayon = 0.18 + Math.pow(Math.random(), 0.55) * 0.95;
    return {
      dx: Math.cos(angle) * rayon,
      dy: Math.sin(angle) * rayon,
      z: Z_LOIN,
      v: gerbe ? 0.016 + Math.random() * 0.012 : 0.0035 + Math.random() * 0.0075,
      c: TEINTES[gerbe
        ? (Math.random() < 0.55 ? 2 : 0)
        : Math.floor(Math.random() * TEINTES.length)],
      gerbe: !!gerbe,
      eclat: 0.45 + Math.random() * 0.55
    };
  }

  function gerbe() {
    var n = 16 + Math.floor(Math.random() * 12);
    for (var i = 0; i < n; i++) {
      var e = naitre(true);
      e.z = 0.82 + Math.random() * 0.16;
      etoiles.push(e);
    }
  }

  function dessiner() {
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round";

    // Inertie : le point de fuite rattrape le pointeur sans a-coup.
    fuiteX += (viseX - fuiteX) * 0.05;
    fuiteY += (viseY - fuiteY) * 0.05;

    var cx = w / 2 + fuiteX * w * 0.22;
    var cy = h / 2 + fuiteY * h * 0.22;

    for (var i = etoiles.length - 1; i >= 0; i--) {
      var e = etoiles[i];

      var zAvant = e.z;
      if (!sobre) e.z -= e.v;

      if (e.z <= Z_PRES) {
        if (e.gerbe) { etoiles.splice(i, 1); continue; }
        var neuve = naitre();
        etoiles[i] = neuve;
        continue;
      }

      // Projection perspective : plus l'etoile est proche, plus elle s'ecarte.
      var k = focale / e.z, kAvant = focale / zAvant;
      var x = cx + e.dx * k,  y = cy + e.dy * k;
      var xA = cx + e.dx * kAvant, yA = cy + e.dy * kAvant;

      // Hors champ : on la renvoie au fond sans attendre.
      if (x < -160 || x > w + 160 || y < -160 || y > h + 160) {
        if (e.gerbe) { etoiles.splice(i, 1); continue; }
        etoiles[i] = naitre();
        continue;
      }

      var proximite = 1 - e.z;                       // 0 au loin, ~1 tout pres
      var alpha = Math.min(1, proximite * 1.5) * e.eclat;
      var epaisseur = 0.4 + proximite * (e.gerbe ? 2.6 : 1.9);
      var rgb = e.c[0] + "," + e.c[1] + "," + e.c[2];

      // La trainee est l'ecart parcouru depuis l'image precedente :
      // elle s'allonge d'elle-meme a mesure que l'etoile accelere.
      ctx.strokeStyle = "rgba(" + rgb + "," + alpha + ")";
      ctx.lineWidth = epaisseur;
      ctx.beginPath();
      ctx.moveTo(xA, yA);
      ctx.lineTo(x, y);
      ctx.stroke();

      // Tete lumineuse sur les etoiles proches et sur les gerbes.
      if (proximite > 0.55 || e.gerbe) {
        ctx.fillStyle = "rgba(" + rgb + "," + Math.min(1, alpha * 1.25) + ")";
        ctx.beginPath();
        ctx.arc(x, y, epaisseur * 0.62, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Une gerbe de temps a autre, jamais deux coup sur coup.
    if (!sobre) {
      tempsGerbe -= 1;
      if (tempsGerbe <= 0 && etoiles.length < NB_MAX + 90) {
        gerbe();
        tempsGerbe = 150 + Math.random() * 260;   // environ 3 a 7 secondes
      }
    }

    if (vivant) frame = requestAnimationFrame(dessiner);
  }

  /* ---------------- Entrees ---------------- */

  function surPointeur(e) {
    viseX = (e.clientX / window.innerWidth) * 2 - 1;
    viseY = (e.clientY / window.innerHeight) * 2 - 1;
  }

  function surToucher(e) {
    if (!e.touches || !e.touches.length) return;
    viseX = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
    viseY = (e.touches[0].clientY / window.innerHeight) * 2 - 1;
  }

  function surInclinaison(e) {
    if (e.gamma === null || e.beta === null) return;
    viseX = Math.max(-1, Math.min(1, e.gamma / 40));
    viseY = Math.max(-1, Math.min(1, (e.beta - 45) / 40));
  }

  var surRedim = function () { redimensionner(); };

  function demarrer() {
    if (vivant) return;
    vivant = true;
    redimensionner();
    tempsGerbe = 90;
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
