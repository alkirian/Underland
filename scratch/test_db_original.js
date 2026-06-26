import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://inoremwazicuzbsehzax.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlub3JlbXdhemljdXpic2VoemF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNjc2NzIsImV4cCI6MjA5NDg0MzY3Mn0.0OXnvocEjhgsOC3Te1ggh8otTn5TKHfwR0vFj2A3Wx4';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  const { data: beats, error } = await supabase
    .from('beatmarket')
    .select('*');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log(JSON.stringify(beats, null, 2));
  }
}

test();
