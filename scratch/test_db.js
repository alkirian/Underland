import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bnnuvpzxecnhyrmvkfdd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubnV2cHp4ZWNuaHlybXZrZmRkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjMyMjQ4MywiZXhwIjoyMDk3ODk4NDgzfQ.rq_4pBCRr2DhgKu1m7e80mZGLsHw9bq7qEGfRkwPEz4';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  console.log('Testing connection to Supabase...');
  
  console.log('\nQuerying agenda_eventos...');
  const { data: events, error: eventsErr } = await supabase
    .from('agenda_eventos')
    .select('*')
    .limit(3);
  
  if (eventsErr) {
    console.error('Error querying agenda_eventos:', eventsErr.message);
  } else {
    console.log(`Success! Found ${events?.length} events.`);
    console.log('First event:', events?.[0]);
  }

  console.log('\nQuerying beatmarket...');
  const { data: beats, error: beatsErr } = await supabase
    .from('beatmarket')
    .select('*')
    .limit(3);

  if (beatsErr) {
    console.error('Error querying beatmarket:', beatsErr.message);
  } else {
    console.log(`Success! Found ${beats?.length} beats.`);
    console.log('First beat:', beats?.[0]);
  }
}

test();
