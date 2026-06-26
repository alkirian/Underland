import fs from 'fs';
import path from 'path';

// Helper to manually load .env file
function loadEnv() {
  try {
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
  } catch (err) {
    console.warn('Advertencia al cargar .env manualmente:', err.message);
  }
}

loadEnv();

function saveIdToEnv(id) {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    let content = fs.readFileSync(envPath, 'utf8');
    
    // Check if the key exists
    if (content.includes('INSTAGRAM_BUSINESS_ACCOUNT_ID=')) {
      content = content.replace(/INSTAGRAM_BUSINESS_ACCOUNT_ID=.*/g, `INSTAGRAM_BUSINESS_ACCOUNT_ID=${id}`);
    } else {
      content += `\nINSTAGRAM_BUSINESS_ACCOUNT_ID=${id}`;
    }
    
    fs.writeFileSync(envPath, content, 'utf8');
    console.log(`\n💾 Guardado exitosamente en .env: INSTAGRAM_BUSINESS_ACCOUNT_ID=${id}`);
  } catch (err) {
    console.error('No se pudo guardar el ID en el archivo .env:', err.message);
  }
}

async function descubrirId() {
  const appId = process.env.META_APP_ID || '1349215320475113';
  const appSecret = process.env.META_APP_SECRET;

  console.log('=== DESCUBRIDOR DIRECTO DE INSTAGRAM BUSINESS ACCOUNT ID ===');
  console.log(`App ID: ${appId}`);

  if (!appSecret || appSecret === 'tu_clave_secreta_oculta') {
    console.error('Error: META_APP_SECRET no está configurado en .env.');
    return null;
  }

  // 1. Construct Token
  const accessToken = `${appId}|${appSecret}`;

  // 2. Query target App Accounts endpoint
  try {
    const accountsUrl = `https://graph.facebook.com/v25.0/${appId}/accounts?access_token=${accessToken}`;
    console.log(`Consultando endpoint: /${appId}/accounts...`);
    
    const res = await fetch(accountsUrl);
    const data = await res.json();

    if (!res.ok) {
      console.error('\n❌ ERROR DE META API:');
      console.error(JSON.stringify(data.error || data, null, 2));
      return null;
    }

    const pages = data.data || [];
    if (pages.length === 0) {
      console.log('\n⚠️  No se encontraron páginas de Facebook vinculadas a la aplicación a través de este endpoint.');
      console.log('Si tienes el ID de tu página de Facebook, puedes guardarlo como META_PAGE_ID en .env y el script intentará consultar ese nodo directamente.');
      
      const pageId = process.env.META_PAGE_ID;
      if (pageId) {
        console.log(`\nIntentando consulta directa con el ID de Página: ${pageId}...`);
        const pageUrl = `https://graph.facebook.com/v25.0/${pageId}?fields=instagram_business_account&access_token=${accessToken}`;
        const pageRes = await fetch(pageUrl);
        const pageData = await pageRes.json();
        
        if (pageRes.ok && pageData.instagram_business_account) {
          const igId = pageData.instagram_business_account.id;
          console.log(`\n✅ ¡ÉXITO! ID de Instagram Business obtenido de la página: ${igId}`);
          saveIdToEnv(igId);
          return igId;
        } else {
          console.error('La consulta directa de la página falló o no tiene cuenta de Instagram vinculada.');
          console.error(JSON.stringify(pageData, null, 2));
        }
      }
      return null;
    }

    console.log(`Se encontraron ${pages.length} páginas comerciales.`);
    for (const page of pages) {
      if (page.instagram_business_account) {
        const igId = page.instagram_business_account.id;
        console.log(`\n✅ ¡ÉXITO! Se encontró la cuenta de Instagram vinculada en la página "${page.name}":`);
        console.log(`ID de Instagram Business Account: ${igId}`);
        saveIdToEnv(igId);
        return igId;
      }
    }

    console.log('Se listaron las páginas de la aplicación, pero ninguna tiene una cuenta de Instagram Business vinculada.');
    return null;

  } catch (error) {
    console.error('Error al realizar la consulta a Meta:', error.message);
    return null;
  }
}

// Export for integration
export { descubrirId };

// Run if called directly
import { fileURLToPath } from 'url';
const isDirectRun = process.argv[1] && (
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
);
if (isDirectRun) {
  descubrirId();
}
