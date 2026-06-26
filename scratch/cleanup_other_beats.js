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
        process.env[key] = value;
      }
    });
  }
}

loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://inoremwazicuzbsehzax.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const KEEP_TITLES = [
  'Boom Bap Old School Funk',
  'Trance Trap Free',
  'Base de Rap Para Improvisar'
];

async function run() {
  console.log('Cleaning up other beats from the database table "beatmarket"...');
  
  const { data, error } = await supabase
    .from('beatmarket')
    .delete()
    .not('beat_title', 'in', `(${KEEP_TITLES.map(t => `"${t}"`).join(',')})`)
    .select();

  if (error) {
    console.error('Error during cleanup:', error.message);
  } else {
    console.log(`Cleanup complete. Deleted ${data ? data.length : 0} other beats.`);
    if (data && data.length > 0) {
      console.log('Deleted beats:', data.map(b => b.beat_title));
    }
  }
}

run();
