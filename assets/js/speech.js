// Dictee et lecture a voix haute.
// Prof. Aria melange les deux langues dans une meme reponse : le francais
// pour les consignes, l'anglais pour le contenu d'apprentissage. On decoupe
// donc le texte et on lit chaque fragment avec la bonne voix.

var SR = window.SpeechRecognition || window.webkitSpeechRecognition;

export var dictationSupported = Boolean(SR);
export var speechSupported = "speechSynthesis" in window;

/* ============================================================
   Dictee
   ============================================================ */
export function createDictation(opts) {
  if (!SR) return null;
  var rec = new SR();
  rec.lang = opts.lang || "en-US";
  rec.continuous = true;
  rec.interimResults = false;
  var actif = false;

  rec.onresult = function (e) {
    for (var i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) opts.onText(e.results[i][0].transcript.trim());
    }
  };
  rec.onend = function () { actif = false; if (opts.onEnd) opts.onEnd(); };
  rec.onerror = function () { actif = false; if (opts.onEnd) opts.onEnd(); };

  return {
    get active() { return actif; },
    start: function () {
      if (actif) return;
      actif = true;
      try { rec.start(); } catch (err) { actif = false; }
    },
    stop: function () { if (actif) rec.stop(); }
  };
}

/* ============================================================
   Detection de langue
   ============================================================ */

var MOTS_FR = ["le","la","les","des","une","du","de","et","est","sont","vous","votre",
  "nous","pour","dans","avec","que","qui","pas","sur","mais","donc","plus","bien",
  "ce","cette","vos","tres","alors","maintenant","reponse","phrase","erreur","regle",
  "exercice","niveau","corrigez","ecrivez","voici","attention"];

var MOTS_EN = ["the","you","your","and","is","are","of","to","in","for","with","that",
  "this","it","on","have","has","will","would","can","should","there","their","about",
  "write","read","listen","answer","question","sentence","word","because","which"];

function scoreLangue(texte) {
  var bas = texte.toLowerCase();
  var fr = 0, en = 0;

  // Les accents ne trompent pas : ils n'existent pas en anglais courant.
  var accents = bas.match(/[àâäéèêëîïôöùûüçœ]/g);
  if (accents) fr += accents.length * 2.5;

  // Les apostrophes elidees non plus : l', d', qu', j', n'
  var elisions = bas.match(/\b[ldqjnmts]'/g);
  if (elisions) fr += elisions.length * 1.5;

  var mots = bas.split(/[^a-zàâäéèêëîïôöùûüçœ']+/);
  for (var i = 0; i < mots.length; i++) {
    if (MOTS_FR.indexOf(mots[i]) !== -1) fr += 1;
    if (MOTS_EN.indexOf(mots[i]) !== -1) en += 1;
  }
  return { fr: fr, en: en };
}

function langueDe(texte, defaut) {
  var s = scoreLangue(texte);
  if (s.fr === 0 && s.en === 0) return defaut || "fr-FR";
  return s.fr >= s.en ? "fr-FR" : "en-US";
}

/**
 * Decoupe le texte en fragments homogenes, chacun avec sa langue.
 * Les fragments consecutifs de meme langue sont refusionnes, sinon
 * la lecture serait hachee phrase par phrase.
 */
export function segmenter(texte) {
  var brut = String(texte || "")
    .replace(/```[\s\S]*?```/g, " ")     // pas de bloc de code a lire
    .replace(/[*#`>_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!brut) return [];

  // Coupe apres . ! ? : et apres les retours de ligne deja aplatis.
  var phrases = brut.match(/[^.!?:;]+[.!?:;]*/g) || [brut];

  var out = [];
  var derniere = "fr-FR";
  for (var i = 0; i < phrases.length; i++) {
    var p = phrases[i].trim();
    if (!p) continue;

    // Un fragment trop court n'a pas de quoi trancher : il herite du precedent.
    var lang = p.replace(/[^a-zà-ÿ]/gi, "").length < 12
      ? derniere
      : langueDe(p, derniere);
    derniere = lang;

    if (out.length && out[out.length - 1].lang === lang) {
      out[out.length - 1].text += " " + p;
    } else {
      out.push({ text: p, lang: lang });
    }
  }
  return out;
}

/* ============================================================
   Lecture
   ============================================================ */

var file = [];        // fragments restants
var enCours = false;

function voixPour(lang) {
  var voix = speechSynthesis.getVoices() || [];
  var court = lang.slice(0, 2);
  var exacte = null, approchante = null;
  for (var i = 0; i < voix.length; i++) {
    if (voix[i].lang === lang) { exacte = voix[i]; break; }
    if (!approchante && voix[i].lang.slice(0, 2) === court) approchante = voix[i];
  }
  return exacte || approchante || null;
}

function suivant() {
  if (!file.length) { enCours = false; return; }
  var frag = file.shift();
  var u = new SpeechSynthesisUtterance(frag.text);
  u.lang = frag.lang;
  var v = voixPour(frag.lang);
  if (v) u.voice = v;
  u.rate = frag.lang === "fr-FR" ? 1.0 : 0.96;
  u.onend = suivant;
  u.onerror = suivant;
  speechSynthesis.speak(u);
}

/** Lit un texte en basculant de langue au fil des fragments. */
export function speak(texte) {
  if (!speechSupported || !texte) return;
  speechSynthesis.cancel();
  file = segmenter(texte).slice(0, 40);
  if (!file.length) return;
  enCours = true;

  // Les voix arrivent parfois apres coup dans Safari et Chrome.
  if (!speechSynthesis.getVoices().length) {
    speechSynthesis.onvoiceschanged = function () {
      speechSynthesis.onvoiceschanged = null;
      suivant();
    };
    setTimeout(function () { if (enCours && !speechSynthesis.speaking) suivant(); }, 350);
    return;
  }
  suivant();
}

export function stopSpeaking() {
  if (!speechSupported) return;
  file = [];
  enCours = false;
  speechSynthesis.cancel();
}
