import fs from 'fs';
import path from 'path';

const brainDir = 'C:\\Users\\MARCE\\.gemini\\antigravity\\brain';

async function search() {
  try {
    const folders = fs.readdirSync(brainDir);
    console.log(`Searching through ${folders.length} conversation folders...`);
    
    for (const folder of folders) {
      const transPath = path.join(brainDir, folder, '.system_generated', 'logs', 'transcript.jsonl');
      if (fs.existsSync(transPath)) {
        const content = fs.readFileSync(transPath, 'utf8');
        if (content.includes('inoremwazicuzbsehzax')) {
          console.log(`\nMatch in conversation: ${folder}`);
          const lines = content.split('\n');
          lines.forEach((line, index) => {
            if (line.includes('inoremwazicuzbsehzax')) {
              // Print around matching text
              const serviceRoleIndex = line.indexOf('service_role');
              const serviceRoleKeyIndex = line.indexOf('SUPABASE_SERVICE_ROLE_KEY');
              const keyStartIdx = line.indexOf('eyJhbGciOiJIUzI1NiIs');
              
              console.log(`  Line ${index}:`);
              if (keyStartIdx !== -1) {
                // Found a JWT key
                const jwtPiece = line.substring(keyStartIdx, keyStartIdx + 150);
                console.log(`    JWT Key start: ${jwtPiece}...`);
              }
              if (serviceRoleKeyIndex !== -1) {
                console.log(`    SUPABASE_SERVICE_ROLE_KEY mentioned: ${line.substring(serviceRoleKeyIndex, serviceRoleKeyIndex + 100)}...`);
              }
              // Print a snippet of the line
              console.log(`    Snippet: ${line.substring(0, 300)}...`);
            }
          });
        }
      }
    }
    console.log('\nSearch completed.');
  } catch (err) {
    console.error('Error during search:', err);
  }
}

search();
