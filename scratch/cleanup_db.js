import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2].trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
}

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log("=== LIMPIEZA DE BASE DE DATOS (ELIMINANDO DATOS FALSOS/ESTIMADOS) ===");
  
  // 1. Delete events containing 'mock' in any URL
  const { data: d1, error: e1 } = await supabase
    .from('agenda_eventos')
    .delete()
    .or('whatsapp_url.like.%mock%,instagram_url.like.%mock%');
    
  if (e1) {
    console.error("Error al eliminar eventos mock:", e1.message);
  } else {
    console.log("Eventos con URLs simuladas eliminados.");
  }
  
  // 2. Delete estimated TBD events (like Hotel del Prado with estimated date)
  const { data: d2, error: e2 } = await supabase
    .from('agenda_eventos')
    .delete()
    .like('nombre', '%Hotel del Prado%');
    
  if (e2) {
    console.error("Error al eliminar evento Prado estimado:", e2.message);
  } else {
    console.log("Evento con fecha estimada del Hotel del Prado eliminado.");
  }
  
  // 3. Delete any other known dummy names if any left
  const { data: d3, error: e3 } = await supabase
    .from('agenda_eventos')
    .delete()
    .or('nombre.like.%Fecha 5%,nombre.like.%Regional%');
    
  if (e3) {
    console.error("Error al limpiar nombres dummy:", e3.message);
  } else {
    console.log("Cualquier otro remanente con nombres dummy eliminado.");
  }
  
  console.log("\nLimpieza finalizada.");
}

run();
