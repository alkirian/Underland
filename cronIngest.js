import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { descubrirId } from './descubrir_id.js';
import cron from 'node-cron';

// Default Instagram accounts to scrape if not overridden
const TARGET_ACCOUNTS = [
  // Canelones
  'franjadegaza.freestyle', // Las Piedras
  'lasvegas.freestyle',     // Barra de Carrasco / Paso Carrasco
  'pando_underground',      // Pando
  'costa_under',            // Ciudad de la Costa
  'manfreestyle.lacosta',   // Ciudad de la Costa
  'antagfree',              // Las Piedras

  // Montevideo
  'darkjail_',              // Plaza Seregni
  'mvdunder',               // Prado / Cordón
  '3xis_freestyle',         // Tres Cruces
  'delatribu.freestyle',    // Prado
  'plazadebox',             // La Teja / Cerro
  '9na_avenida',
  'hypnotic.palace',
  'paratederima',
  'solyrap__',
  'st4r.cosm1c',
  'muertesubita.uy',
  'nightwraps',
  'all_free.uy',
  'el.pabellon.freestyle',

  // Interior (Maldonado, San José, Rivera, etc.)
  '3ix_freestyle',          // Maldonado
  'malditofree',            // Maldonado
  'greenandwhite_free',     // Maldonado / Interior
  'shadowfreeoficial',      // Maldonado
  'maragatos_under',        // San José
  'nsc_freestyle',          // Rivera (Norte Sólido Clan)
  'bda_freestyle',          // Colonia (Boca de Altos)
  'tintiyo_freestyle',
  'verdehoja33',            // Treinta y Tres
  'cn.freestyle'
];

// Centroids and common place mappings for Uruguay departments to prevent map rendering issues
const DEPARTMENT_COORDINATES = {
  'montevideo': { lat: -34.8974, lng: -56.1652 }, // Plaza Líber Seregni default
  'canelones': { lat: -34.5228, lng: -56.2778 },
  'maldonado': { lat: -34.9000, lng: -54.9500 },
  'san josé': { lat: -34.3375, lng: -56.7136 },
  'colonia': { lat: -34.4714, lng: -57.8436 },
  'rocha': { lat: -34.4833, lng: -54.3333 },
  'salto': { lat: -31.3833, lng: -57.9667 },
  'paysandú': { lat: -32.3167, lng: -58.0833 },
  'rivera': { lat: -30.9025, lng: -55.5506 },
  'tacuarembó': { lat: -31.7125, lng: -55.9808 },
  'artigas': { lat: -30.4000, lng: -56.4667 },
  'cerro largo': { lat: -32.3667, lng: -54.1833 },
  'río negro': { lat: -32.7500, lng: -57.6333 },
  'durazno': { lat: -33.3833, lng: -56.5167 },
  'treinta y tres': { lat: -33.2333, lng: -54.3833 },
  'soriano': { lat: -33.2500, lng: -58.0333 },
  'flores': { lat: -33.5333, lng: -56.9000 },
  'florida': { lat: -34.1000, lng: -56.2167 },
  'lavalleja': { lat: -34.3750, lng: -55.2375 }
};

const SPECIFIC_PLACE_COORDINATES = {
  'seregni': { lat: -34.8974, lng: -56.1652 },
  'buceo': { lat: -34.9037, lng: -56.1264 },
  'anfiteatro': { lat: -32.3131, lng: -58.0934 },
  'lafone': { lat: -34.8715, lng: -56.2238 },
  'entrevero': { lat: -34.9056, lng: -56.1925 },
  'deportes': { lat: -34.3411, lng: -56.7145 }
};

// Resolve lat/lng coordinates based on location name and department
function resolveCoordinates(department, location) {
  const deptKey = (department || '').toLowerCase().trim();
  const locKey = (location || '').toLowerCase().trim();

  // 1. Try to find a match in the specific locations dictionary
  for (const [key, coords] of Object.entries(SPECIFIC_PLACE_COORDINATES)) {
    if (locKey.includes(key)) {
      return coords;
    }
  }

  // 2. Fallback to department centroids
  if (DEPARTMENT_COORDINATES[deptKey]) {
    return DEPARTMENT_COORDINATES[deptKey];
  }

  // 3. Absolute fallback (centered in Uruguay)
  return { lat: -32.5228, lng: -55.7658 };
}

// Sample mock data for Instagram feeds to support immediate offline testing
const MOCK_INSTAGRAM_POSTS = [
  {
    caption: "¡ATENCIÓN MONTEVIDEO! 🚨 Este sábado 27 de junio se viene la Fecha 5 de Dark Jail. ⚡️ Nos vemos en Plaza Líber Seregni. Inscripciones a partir de las 18:30 hs. Valor de la inscripción: $50. Modalidad 1v1. Grupo de WhatsApp para inscripciones: https://chat.whatsapp.com/mock-darkjail",
    timestamp: "2026-06-24T15:00:00Z",
    permalink: "https://www.instagram.com/p/C8pX_3tMOCK1/",
    username: "darkjail_"
  },
  {
    caption: "¡FRANJA DE GAZA REGIONAL! ⚔️ La compe del oeste vuelve con todo en Canelones. Fecha: Domingo 28 de junio. Lugar: Plaza de Deportes de Canelones. Inscripciones abiertas desde las 17:00 hs. Entrada gratis, modalidad 2v2. Sumate al WhatsApp de la compe: https://chat.whatsapp.com/mock-franja",
    timestamp: "2026-06-23T18:00:00Z",
    permalink: "https://www.instagram.com/p/C8nB_2tMOCK2/",
    username: "franjadegaza.freestyle"
  },
  {
    caption: "Felicitamos a @rimador_uy por coronarse campeón de la Fecha 4 el pasado fin de semana en Buceo. ¡Tremendo nivel de todos!",
    timestamp: "2026-06-22T12:00:00Z",
    permalink: "https://www.instagram.com/p/C8kF_1tMOCK3/",
    username: "darkjail_"
  }
];

async function run() {
  console.log(`\n[${new Date().toISOString()}] >>> EL CRON SE HA DESPERTADO <<<`);
  const isMockMode = process.argv.includes('--mock') || 
                     !process.env.META_APP_SECRET || 
                     process.env.META_APP_SECRET === 'tu_clave_secreta_oculta';

  console.log('=== UNDERLAND CRON INGESTION AGENT ===');
  console.log(`Modo de ejecución: ${isMockMode ? 'MOCK / DEMO' : 'PRODUCCIÓN (Meta API)'}\n`);

  let rawPosts = [];

  if (isMockMode) {
    console.log('Cargando posts de Instagram simulados para prueba...');
    rawPosts = MOCK_INSTAGRAM_POSTS;
  } else {
    try {
      const appId = process.env.META_APP_ID;
      const appSecret = process.env.META_APP_SECRET;
      let businessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

      const isPlaceholder = !businessAccountId || 
                            businessAccountId.includes('tu_instagram_business_account_id') || 
                            businessAccountId.includes('aquí') ||
                            businessAccountId.includes('aqui');

      if (isPlaceholder) {
        console.log('INSTAGRAM_BUSINESS_ACCOUNT_ID no configurado en .env. Intentando auto-descubrimiento de servidor a servidor...');
        businessAccountId = await descubrirId();
        if (!businessAccountId) {
          throw new Error('No se pudo descubrir automáticamente el INSTAGRAM_BUSINESS_ACCOUNT_ID.');
        }
        console.log(`Auto-descubrimiento exitoso. Usando ID de Instagram: ${businessAccountId}`);
      }

      console.log('Obteniendo App Access Token de Meta...');
      const tokenUrl = `https://graph.facebook.com/v25.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&grant_type=client_credentials`;
      
      const tokenResponse = await fetch(tokenUrl);
      if (!tokenResponse.ok) {
        throw new Error(`Error al solicitar token de Meta: ${tokenResponse.statusText}`);
      }
      
      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;
      console.log('Token obtenido con éxito.');

      for (const username of TARGET_ACCOUNTS) {
        console.log(`Consultando Business Discovery para @${username}...`);
        const discoveryUrl = `https://graph.facebook.com/v25.0/${businessAccountId}?fields=business_discovery.username(${username}){media{caption,timestamp,permalink}}&access_token=${accessToken}`;
        
        const res = await fetch(discoveryUrl);
        if (!res.ok) {
          console.error(`No se pudieron obtener posts para @${username}: ${res.statusText}`);
          continue;
        }

        const data = await res.json();
        const media = data.business_discovery?.media?.data || [];
        console.log(`Se encontraron ${media.length} posts para @${username}.`);
        
        media.forEach(post => {
          rawPosts.push({
            caption: post.caption || '',
            timestamp: post.timestamp,
            permalink: post.permalink || '',
            username: username
          });
        });
      }
    } catch (error) {
      console.error('Error durante la llamada a la API de Meta:', error.message);
      console.log('Cambiando automáticamente a modo MOCK para no bloquear la ejecución del script.');
      rawPosts = MOCK_INSTAGRAM_POSTS;
    }
  }

  if (rawPosts.length === 0) {
    console.log('No se encontraron posts para analizar. Finalizando.');
    return;
  }

  // 2. Process captions with Gemini
  console.log('\n--- PROCESAMIENTO INTELIGENTE CON GEMINI ---');
  
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey || geminiApiKey === 'tu_gemini_api_key_aquí') {
    console.error('Error: GEMINI_API_KEY no configurado en el archivo .env.');
    console.log('No se puede llamar a Gemini sin una clave de API. Finalizando.');
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const systemPrompt = `Actúas como el motor de datos de Underland en Uruguay. Analizá los textos de Instagram provistos. Año de referencia actual: 2026. Filtrá y procesá ÚNICAMENTE las publicaciones que anuncien eventos futuros, torneos o fechas de freestyle. Ignorá fotos de ganadores o rimas viejas.
Extraé con precisión y devolvé un JSON puro (sin marcas de bloque \`\`\`json ni textos aclaratorios) con este formato exacto de arreglo:
[{
"post_index": número del post de origen (ej: 1, 2, 3, etc.) del que proviene la compe,
"title": "Nombre corto de la compe y fecha",
"description": "Horarios, modalidad (1v1, 2v2) y precio si hay",
"date": "Fecha calculada en formato YYYY-MM-DD",
"time": "Hora en formato HH:MM",
"department": "Departamento de Uruguay (ej: Montevideo, Canelones, Maldonado)",
"exact_location": "Plaza o lugar físico",
"whatsapp_link": "URL del grupo de inscripciones o null"
}]`;

    const userPrompt = `A continuación, los captions de Instagram con su fecha de publicación y el usuario que lo publicó. 
Fecha actual del sistema: 2026-06-24.

Publicaciones:
${rawPosts.map((p, idx) => `[Post #${idx + 1}]
Usuario: @${p.username}
Publicado el: ${p.timestamp}
Texto: ${p.caption}`).join('\n\n')}`;

    console.log('Llamando a Gemini...');
    let response;
    try {
      console.log('Intentando con gemini-2.5-flash...');
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt
        }
      });
    } catch (err) {
      console.warn('Fallo con gemini-2.5-flash, intentando fallback a gemini-2.0-flash...', err.message);
      try {
        response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt
          }
        });
      } catch (err2) {
        console.warn('Fallo con gemini-2.0-flash, reintentando gemini-2.5-flash tras delay...', err2.message);
        // Wait 1.5 seconds and retry primary model once
        await new Promise(resolve => setTimeout(resolve, 1500));
        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt
          }
        });
      }
    }

    let resultText = response.text.trim();
    
    // Clean up code block indicators if Gemini included them despite instructions
    if (resultText.startsWith('```')) {
      resultText = resultText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    }

    console.log('Respuesta cruda de Gemini recibida.');
    
    const parsedEvents = JSON.parse(resultText);
    console.log(`Se estructuraron ${parsedEvents.length} eventos válidos:\n`);
    console.log(JSON.stringify(parsedEvents, null, 2));

    // 3. Write / Upsert to Supabase database
    console.log('\n--- GUARDANDO EN SUPABASE ---');
    let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    let supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Force override if the environment is set to the mock database (inoremwazicuzbsehzax)
    if (!supabaseUrl || supabaseUrl.includes('inoremwazicuzbsehzax')) {
      supabaseUrl = 'https://bnnuvpzxecnhyrmvkfdd.supabase.co';
      supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubnV2cHp4ZWNuaHlybXZrZmRkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjMyMjQ4MywiZXhwIjoyMDk3ODk4NDgzfQ.rq_4pBCRr2DhgKu1m7e80mZGLsHw9bq7qEGfRkwPEz4';
    }

    if (isMockMode) {
      console.log('Modo MOCK activo. Los datos simulados NO se guardaron en la base de datos para evitar contaminar la producción.');
      return;
    }

    if (!supabaseServiceKey || supabaseServiceKey === 'tu_service_role_key') {
      console.warn('ADVERTENCIA: SUPABASE_SERVICE_ROLE_KEY no configurado en .env.');
      console.log('Simulación completada. Los datos anteriores NO se guardaron en la base de datos.');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    for (const event of parsedEvents) {
      // Resolve coordinates based on location
      const coords = resolveCoordinates(event.department, event.exact_location);
      
      // Determine source instagram account URL (permalink or fallback profile URL)
      const originalPost = (event.post_index && rawPosts[event.post_index - 1]) ? rawPosts[event.post_index - 1] : null;
      let instagramUrl = originalPost?.permalink || null;

      if (!instagramUrl && originalPost?.username) {
        instagramUrl = `https://instagram.com/${originalPost.username}`;
      } else if (!instagramUrl) {
        const isDarkJail = (event.title || '').toLowerCase().includes('dark');
        instagramUrl = isDarkJail ? 'https://instagram.com/darkjail_' : 'https://instagram.com/franjadegaza.freestyle';
      }

      const isDarkJail = (event.title || '').toLowerCase().includes('dark');

      const record = {
        nombre: event.title,
        departamento: event.department,
        fecha: event.date,
        hora_inscripcion: event.time,
        lugar: event.exact_location,
        lat: coords.lat,
        lng: coords.lng,
        flyer_url: isDarkJail ? 'https://picsum.photos/id/1025/600/800' : 'https://picsum.photos/id/1026/600/800',
        whatsapp_url: event.whatsapp_link,
        instagram_url: instagramUrl
      };

      // Check if an event with the same name and date already exists
      console.log(`Procesando compe "${record.nombre}" para la fecha ${record.fecha}...`);
      
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
          console.log(`Evento actualizado correctamente.`);
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

    console.log('\n¡Proceso de ingesta finalizado con éxito!');
    console.log(`[${new Date().toISOString()}] >>> ACTUALIZACIÓN EN SUPABASE COMPLETADA CON ÉXITO <<<`);

  } catch (error) {
    console.error('Error durante el procesamiento:', error);
  }
}

// Programación cron: 04:00 AM y 04:00 PM todos los días
const CRON_SCHEDULE = '0 4,16 * * *';

console.log(`[${new Date().toISOString()}] Iniciando daemon de cronIngest...`);
console.log(`Tarea programada con la expresión cron: "${CRON_SCHEDULE}" (todos los días a las 04:00 y 16:00)`);

cron.schedule(CRON_SCHEDULE, () => {
  run().catch(error => {
    console.error(`[${new Date().toISOString()}] Error crítico ejecutando la tarea programada:`, error);
  });
});
