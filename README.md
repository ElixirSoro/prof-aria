# Prof. Aria

Coaching d'anglais intensif sur 42 jours — CEFR, TOEFL iBT, TOEIC.
Front statique sur GitHub Pages, données et IA sur Supabase.

```
Navigateur (GitHub Pages)
    │  JWT Supabase
    ▼
Edge Function « aria »  ──── clé Gemini ───▶  Google Gemini
    │
    ▼
Postgres : profiles, sessions
```

La clé Gemini ne quitte jamais l'Edge Function. Le prompt pédagogique non plus.
Le navigateur envoie un message, reçoit une réponse et un profil à jour.

---

## 1. Créer le projet Supabase

1. [supabase.com](https://supabase.com) → **New project**. Notez l'URL du projet et la clé `anon`.
2. **SQL Editor** → collez `supabase/schema.sql` → **Run**.
3. **Authentication → Providers** :
   - **Email** est actif par défaut (lien magique).
   - **Google** : activez-le, collez le Client ID et le Client Secret d'un projet Google Cloud
     (type « Application Web »). Dans Google Cloud, l'URI de redirection autorisée est
     `https://VOTRE-PROJET.supabase.co/auth/v1/callback`.
4. **Authentication → URL Configuration** → *Site URL* et *Redirect URLs* :
   ajoutez `https://VOTRE-COMPTE.github.io/prof-aria/` et, pour développer,
   `http://localhost:5173`.

## 2. Obtenir une clé Gemini

[Google AI Studio](https://aistudio.google.com/apikey) → **Create API key**. L'offre gratuite suffit
largement pour un usage individuel ou une poignée d'apprenants.

## 3. Déployer l'Edge Function

```bash
npm install -g supabase
supabase login
supabase link --project-ref VOTRE-REF-PROJET

supabase secrets set GEMINI_API_KEY=votre_cle_gemini
supabase secrets set GEMINI_MODEL=gemini-2.5-flash   # facultatif

supabase functions deploy aria
```

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont injectées automatiquement, ne les définissez pas.

## 4. Renseigner le front

Dans `assets/js/config.js` :

```js
export const SUPABASE_URL = "https://VOTRE-PROJET.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

Ces deux valeurs sont publiques par conception : la clé `anon` ne donne accès qu'à ce que les
politiques RLS autorisent, c'est-à-dire les lignes de l'utilisateur connecté.

## 5. Publier sur GitHub Pages

```bash
git init && git add . && git commit -m "Prof. Aria"
git branch -M main
git remote add origin https://github.com/VOTRE-COMPTE/prof-aria.git
git push -u origin main
```

Puis **Settings → Pages → Source : GitHub Actions**. Le workflow `.github/workflows/pages.yml`
publie à chaque push sur `main`.

## 6. Développer en local

Les modules ES imposent un serveur HTTP ; ouvrir `index.html` en `file://` ne fonctionne pas.

```bash
npx serve .        # ou : python3 -m http.server 5173
```

---

## Ce que fait l'application

| | |
|---|---|
| **Diagnostic** | Aucun niveau n'est supposé : le premier échange lance un test adaptatif. |
| **Trajectoire** | Chaque estimation de niveau est datée d'un jour du programme et tracée sur la colonne CEFR. |
| **Jour / semaine** | Le compteur n'avance que si le tuteur déclare la séance terminée (`advance_day`), pas à chaque message. |
| **Points faibles** | Les erreurs relevées s'accumulent, dédoublonnées, et nourrissent le prompt de la séance suivante. |
| **Voix** | Dictée et lecture à voix haute via l'API Web Speech du navigateur. Chrome et Edge la supportent le mieux ; Firefox n'a pas la dictée. |
| **Export / import** | Un JSON contenant le profil et toutes les séances. L'import restaure le profil, pas l'historique de conversation. |

## Structure

```
index.html                        coque de l'application
assets/css/aria.css               palette, typographie, mise en page
assets/js/config.js               URL et clé anon Supabase
assets/js/app.js                  auth, séance, profil, export
assets/js/spine.js                colonne CEFR animée (SVG)
assets/js/speech.js               dictée et synthèse vocale
supabase/schema.sql               tables et politiques RLS
supabase/functions/aria/index.ts  appel Gemini, parsing, écritures
supabase/functions/aria/prompt.ts prompt système Prof. Aria
```

## Modifier la pédagogie

Tout se passe dans `supabase/functions/aria/prompt.ts`. Si vous changez les clés du bloc JSON
attendu, mettez à jour la section 6 de `index.ts` qui les lit, sinon le profil cessera de se
mettre à jour en silence.

```bash
supabase functions deploy aria    # après chaque modification du prompt
```

## Limites connues

- La reconnaissance vocale du navigateur transcrit ; elle ne mesure ni prononciation ni intonation.
  L'évaluation du speaking porte donc sur la transcription, pas sur l'audio.
- L'offre gratuite Gemini plafonne en requêtes par minute. À plusieurs dizaines d'utilisateurs
  simultanés, il faudra un compte facturé.
- Aucun scoring officiel n'est produit : les nombres affichés sont des estimations du tuteur.
