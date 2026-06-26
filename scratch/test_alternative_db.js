import { createClient } from '@supabase/supabase-js';

const url = 'https://bnnuvpzxecnhyrmvkfdd.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubnV2cHp4ZWNuaHlybXZrZmRkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc8MjMyMjQ4MywiZXhwIjoyMDk3ODk4NDgzfQ.rq_4pBCRr2DhgKu1m7e80mZGLsHw9bq7qEGfRkwPEz4'; // note: corrected minor character if any

// Let's load it directly from env to be safe:
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

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
console.log('Testing with key from env, decoded ref should be bnnuvpzxecnhyrmvkfdd.');
const targetUrl = 'https://bnnuvpzxecnhyrmvkfdd.supabase.co';
const supabase = createClient(targetUrl, serviceKey);

async function check() {
  const { data, error } = await supabase.from('beatmarket').select('*').limit(3);
  if (error) {
    console.error('Error connecting to alternative URL:', error.message);
  } else {
    console.log('Alternative URL works! Beatmarket rows:', data.length);
    console.log(data);
  }
}

check();
