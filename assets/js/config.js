// Ces deux valeurs sont publiques par conception : la clé « anon » ne donne accès
// qu'à ce que les règles RLS autorisent. La clé Gemini, elle, reste dans l'Edge Function.
export const SUPABASE_URL = "https://VOTRE-PROJET.supabase.co";
export const SUPABASE_ANON_KEY = "VOTRE_CLE_ANON";

// Nom de l'Edge Function qui parle à Gemini.
export const ARIA_FUNCTION = "aria";
