import { createClient } from "@supabase/supabase-js";

const url = __SUPABASE_URL__;
const key = __SUPABASE_PUBLISHABLE_KEY__;

// Keep the practice app usable when cloud history has not been configured.
export const supabase = url && key ? createClient(url, key) : null;
