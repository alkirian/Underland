import { createClient } from '@supabase/supabase-js';

const url = 'https://bnnuvpzxecnhyrmvkfdd.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubnV2cHp4ZWNuaHlybXZrZmRkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjMyMjQ4MywiZXhwIjoyMDk3ODk4NDgzfQ.rq_4pBCRr2DhgKu1m7e80mZGLsHw9bq7qEGfRkwPEz4';

const supabase = createClient(url, key);

async function main() {
  console.log('Fetching beatmarket from ' + url);
  const { data, error } = await supabase.from('beatmarket').select('*');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success! Data:', data);
  }
}

main();
