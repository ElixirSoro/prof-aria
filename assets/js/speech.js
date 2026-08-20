// Dictée et lecture à voix haute. Tout se passe dans le navigateur.

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

export const dictationSupported = Boolean(SR);
export const speechSupported = "speechSynthesis" in window;

/**
 * Dictée continue en anglais. Renvoie un contrôleur { start, stop, active }.
 * onText reçoit le texte final au fil de l'eau, onEnd signale l'arrêt.
 */
export function createDictation({ onText, onEnd, lang = "en-US" }) {
  if (!SR) return null;
  const rec = new SR();
  rec.lang = lang;
  rec.continuous = true;
  rec.interimResults = false;
  let active = false;

  rec.onresult = e => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) onText(e.results[i][0].transcript.trim());
    }
  };
  rec.onend = () => { active = false; onEnd?.(); };
  rec.onerror = () => { active = false; onEnd?.(); };

  return {
    get active() { return active; },
    start() { if (!active) { active = true; try { rec.start(); } catch { active = false; } } },
    stop()  { if (active) rec.stop(); }
  };
}

/** Lit un texte. Les segments anglais dominent, on lit donc en en-US par défaut. */
export function speak(text, lang = "en-US") {
  if (!speechSupported || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.slice(0, 3000));
  u.lang = lang;
  u.rate = 0.98;
  speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (speechSupported) speechSynthesis.cancel();
}
