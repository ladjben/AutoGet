import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nyehvkzhflxrewllwjzv.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55ZWh2a3poZmx4cmV3bGx3anp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjU5NzEsImV4cCI6MjA3NzE0MTk3MX0.BmSbhe4kj7SG4JHR5SSoazE43W6NzPdJNlPA5Wggb1U';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ENV manquantes: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

