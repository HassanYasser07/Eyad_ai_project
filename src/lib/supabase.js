import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://pskipsjciatnjuvtxwno.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_OOzjrUtKpRY6qy9Phw0XNw_H5tv3sBM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});