// Configuración del cliente de Supabase
import { createClient } from '@supabase/supabase-js';

let SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
let SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Force override if the environment is set to the mock database (inoremwazicuzbsehzax)
if (!SUPABASE_URL || SUPABASE_URL.includes('inoremwazicuzbsehzax')) {
  SUPABASE_URL = 'https://bnnuvpzxecnhyrmvkfdd.supabase.co';
  SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubnV2cHp4ZWNuaHlybXZrZmRkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjMyMjQ4MywiZXhwIjoyMDk3ODk4NDgzfQ.rq_4pBCRr2DhgKu1m7e80mZGLsHw9bq7qEGfRkwPEz4';
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
