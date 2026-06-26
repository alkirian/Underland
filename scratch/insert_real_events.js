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

const REAL_EVENTS = [
  {
    nombre: "Antag - Fecha en Las Piedras",
    departamento: "Canelones",
    fecha: "2026-07-04",
    hora_inscripcion: "17:00",
    lugar: "Las Piedras (Plaza Batlle y Ordóñez)",
    lat: -34.7297,
    lng: -56.2201,
    flyer_url: "https://picsum.photos/id/1025/600/800",
    whatsapp_url: null,
    instagram_url: "https://www.instagram.com/antagfree/"
  },
  {
    nombre: "La Dark - Edición x Equipos",
    departamento: "Montevideo",
    fecha: "2026-07-05",
    hora_inscripcion: "15:00",
    lugar: "Hotel del Prado",
    lat: -34.8550,
    lng: -56.2074,
    flyer_url: "https://picsum.photos/id/1025/600/800",
    whatsapp_url: null,
    instagram_url: "https://www.instagram.com/darkjail/p/DZ5jVfvxbnv/"
  },
  {
    nombre: "Red Bull Batalla Torneo de Plazas (Hypnotic Palace)",
    departamento: "Montevideo",
    fecha: "2026-08-15",
    hora_inscripcion: "17:00",
    lugar: "Montevideo (Plaza de la Bandera)",
    lat: -34.8974,
    lng: -56.1652,
    flyer_url: "https://picsum.photos/id/1026/600/800",
    whatsapp_url: null,
    instagram_url: "https://www.instagram.com/redbullbatalla/"
  }
];

async function run() {
  console.log("=== INGESTIÓN DE EVENTOS REALES (INVIERNO 2026) ===");
  
  for (const record of REAL_EVENTS) {
    console.log(`\nProcesando evento "${record.nombre}"...`);
    
    // Check if duplicate exists
    const { data: existing, error: checkError } = await supabase
      .from('agenda_eventos')
      .select('id')
      .eq('nombre', record.nombre)
      .eq('fecha', record.fecha);
      
    if (checkError) {
      console.error(`Error al buscar duplicados para ${record.nombre}:`, checkError.message);
      continue;
    }
    
    if (existing && existing.length > 0) {
      console.log(`El evento ya existe (ID: ${existing[0].id}). Actualizando información existente...`);
      const { error: updateError } = await supabase
        .from('agenda_eventos')
        .update(record)
        .eq('id', existing[0].id);
        
      if (updateError) {
        console.error(`Error al actualizar evento:`, updateError.message);
      } else {
        console.log(`Evento actualizado con éxito.`);
      }
    } else {
      console.log(`Insertando nuevo evento...`);
      const { error: insertError } = await supabase
        .from('agenda_eventos')
        .insert([record]);
        
      if (insertError) {
        console.error(`Error al insertar evento:`, insertError.message);
      } else {
        console.log(`Evento creado con éxito.`);
      }
    }
  }
  
  console.log("\n¡Ingestión finalizada con éxito!");
}

run();
