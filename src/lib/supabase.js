import { createClient } from '@supabase/supabase-js';

// Public (client-safe) values. Override per environment with VITE_SUPABASE_URL /
// VITE_SUPABASE_PUBLISHABLE_KEY; the defaults keep the production project.
// NEVER put a service-role / secret key here — it would ship in the bundle.
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://pskipsjciatnjuvtxwno.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_OOzjrUtKpRY6qy9Phw0XNw_H5tv3sBM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});