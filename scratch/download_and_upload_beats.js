import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Helper function to load environmental variables
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

if (!supabaseServiceKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY is not defined in .env.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const BUCKET_NAME = 'beats';

const BEATS_TO_UPLOAD = [
  {
    title: 'Boom Bap Old School Funk',
    filename: 'boom_bap_old_school.mp3',
    url: 'https://archive.org/download/BASERAP_20180210/BASE%20DE%20RAP%20-%20OLD%20SCHOOL%20-%20BE%20FREE%20-%20FREE%20HIP%20HOP%20-%20USO%20LIBRE%20-%20FUNK%20%5BBASE%20RAP%5D.mp3',
    bpm: 90,
    genre: 'Boom Bap',
    producer: 'Sebastián Lorca',
    introDuration: 0
  },
  {
    title: 'Trance Trap Free',
    filename: 'trance_trap_free.mp3',
    url: 'https://archive.org/download/BASERAP6_20180209/BASE%20DE%20RAP%20-%20TRANCE%20TRAP%20-%20USO%20LIBRE%20-%20FREE%20HIP%20HOP.mp3',
    bpm: 120,
    genre: 'Trap',
    producer: 'BasesRap',
    introDuration: 0
  },
  {
    title: 'Base de Rap Para Improvisar',
    filename: 'base_improvisar_rap.mp3',
    url: 'https://archive.org/download/BASERAP6_201802/BASE%20DE%20RAP%20-%20PARA%20IMPROVISAR%20-%20HIP%20HOP%20INSTRUMENTALS%20-%20FREE%20USE.mp3',
    bpm: 95,
    genre: 'Boom Bap',
    producer: 'BasesRap',
    introDuration: 5.5
  }
];

async function setupBucket() {
  console.log(`Checking if bucket "${BUCKET_NAME}" exists...`);
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  
  if (listError) {
    throw new Error(`Failed to list buckets: ${listError.message}`);
  }

  const exists = buckets.some(b => b.name === BUCKET_NAME);
  if (!exists) {
    console.log(`Bucket "${BUCKET_NAME}" not found. Creating public bucket...`);
    const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      allowedMimeTypes: ['audio/mpeg', 'audio/mp3']
    });

    if (createError) {
      throw new Error(`Failed to create bucket: ${createError.message}`);
    }
    console.log(`Bucket "${BUCKET_NAME}" created successfully.`);
  } else {
    console.log(`Bucket "${BUCKET_NAME}" already exists.`);
  }
}

async function downloadAndUploadBeat(beat) {
  console.log(`\n--- Processing: ${beat.title} ---`);
  console.log(`Downloading from: ${beat.url}`);
  
  const response = await fetch(beat.url);
  if (!response.ok) {
    throw new Error(`Failed to download beat from Internet Archive: ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  console.log(`Downloaded successfully. Size: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB`);

  console.log(`Uploading to Supabase Storage bucket "${BUCKET_NAME}" as "${beat.filename}"...`);
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(beat.filename, buffer, {
      contentType: 'audio/mpeg',
      upsert: true
    });

  if (uploadError) {
    throw new Error(`Failed to upload to storage: ${uploadError.message}`);
  }
  console.log('Upload successful.');

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(beat.filename);

  const publicUrl = publicUrlData.publicUrl;
  console.log(`Public URL: ${publicUrl}`);

  // Insert or update beatmarket record
  console.log(`Registering in table "beatmarket"...`);
  
  // Check if beat with the same title already exists
  const { data: existing, error: checkError } = await supabase
    .from('beatmarket')
    .select('id')
    .eq('beat_title', beat.title);

  if (checkError) {
    throw new Error(`Failed to check existing beat: ${checkError.message}`);
  }

  const record = {
    beat_title: beat.title,
    producer_name: beat.producer,
    genre: beat.genre,
    bpm: beat.bpm,
    intro_duration: beat.introDuration,
    audio_url: publicUrl
  };

  if (existing && existing.length > 0) {
    const id = existing[0].id;
    console.log(`Beat already exists with ID: ${id}. Updating...`);
    const { error: updateError } = await supabase
      .from('beatmarket')
      .update(record)
      .eq('id', id);

    if (updateError) {
      throw new Error(`Failed to update beatmarket record: ${updateError.message}`);
    }
    console.log('Updated record successfully.');
  } else {
    console.log('Inserting new beatmarket record...');
    const { error: insertError } = await supabase
      .from('beatmarket')
      .insert([record]);

    if (insertError) {
      throw new Error(`Failed to insert beatmarket record: ${insertError.message}`);
    }
    console.log('Inserted record successfully.');
  }
}

async function run() {
  try {
    await setupBucket();
    
    for (const beat of BEATS_TO_UPLOAD) {
      await downloadAndUploadBeat(beat);
    }
    
    console.log('\n=========================================');
    console.log('All instrumentals successfully downloaded, uploaded, and registered!');
    console.log('=========================================');
  } catch (err) {
    console.error('\nCritical Error during execution:', err.message || err);
    process.exit(1);
  }
}

run();
