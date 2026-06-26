import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.resolve(process.cwd(), '.env');
const correctKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlub3JlbXdhemljdXpic2VoemF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI2NzY3MiwiZXhwIjoyMDk0ODQzNjcyfQ.bNvwhlXSEx4f6PS9Q-67kA0DgqqDMfOYo1vio_3F7P4';

function run() {
  if (!fs.existsSync(envPath)) {
    console.error('.env file not found!');
    return;
  }

  let content = fs.readFileSync(envPath, 'utf8');
  
  // Replace the old service role key line
  const oldKeyPattern = /SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^\s\n]+/g;
  if (oldKeyPattern.test(content)) {
    content = content.replace(oldKeyPattern, `SUPABASE_SERVICE_ROLE_KEY=${correctKey}`);
    console.log('Found and updated SUPABASE_SERVICE_ROLE_KEY in .env');
  } else {
    // Append it if not present
    content += `\nSUPABASE_SERVICE_ROLE_KEY=${correctKey}\n`;
    console.log('Appended SUPABASE_SERVICE_ROLE_KEY to .env');
  }

  fs.writeFileSync(envPath, content, 'utf8');
  console.log('.env file updated successfully.');

  // Now, test connection
  const supabaseUrl = 'https://inoremwazicuzbsehzax.supabase.co';
  const supabase = createClient(supabaseUrl, correctKey);

  supabase.from('beatmarket').select('*').limit(1).then(({ data, error }) => {
    if (error) {
      console.error('Test connection with updated service role key FAILED:', error.message);
    } else {
      console.log('Test connection with updated service role key SUCCEEDED! Fetched data:', data);
    }
  });
}

run();
