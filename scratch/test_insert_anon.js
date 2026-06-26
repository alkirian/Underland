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

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const testBeat = {
    beat_title: 'Test Beat Anon',
    producer_name: 'Test Producer',
    genre: 'Test Genre',
    bpm: 90,
    intro_duration: 0,
    audio_url: 'https://example.com/test.mp3'
  };

  const { data, error } = await supabase.from('beatmarket').insert([testBeat]).select();
  if (error) {
    console.error('Error inserting with anon key:', error.message);
  } else {
    console.log('Successfully inserted row using anon key:', data);
    
    // Clean it up immediately if inserted
    if (data && data[0] && data[0].id) {
      const { error: deleteError } = await supabase.from('beatmarket').delete().eq('id', data[0].id);
      if (deleteError) {
        console.error('Error cleaning up test row:', deleteError.message);
      } else {
        console.log('Successfully cleaned up test row.');
      }
    }
  }
}

run();
