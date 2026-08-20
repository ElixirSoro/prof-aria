// Ces deux valeurs sont publiques par conception : la clé « anon » ne donne accès
// qu'à ce que les règles RLS autorisent. La clé Gemini, elle, reste dans l'Edge Function.
export const SUPABASE_URL = "https://armmrijmsaejjatoonrf.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_3SFnUOfgwmZE37m9GTpplw_RG42folo";

// Nom de l'Edge Function qui parle à Gemini.
export const ARIA_FUNCTION = "aria";
