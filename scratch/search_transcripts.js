import fs from 'fs';
import path from 'path';

const brainDir = 'C:\\Users\\MARCE\\.gemini\\antigravity\\brain';

async function search() {
  try {
    const folders = fs.readdirSync(brainDir);
    for (const folder of folders) {
      const transPath = path.join(brainDir, folder, '.system_generated', 'logs', 'transcript.jsonl');
      if (fs.existsSync(transPath)) {
        const content = fs.readFileSync(transPath, 'utf8');
        if (content.toLowerCase().includes('caption')) {
          console.log(`Match in conversation: ${folder}`);
          const lines = content.split('\n');
          lines.forEach((line, index) => {
            if (line.toLowerCase().includes('caption') && line.includes('USER_INPUT')) {
              try {
                const parsed = JSON.parse(line);
                console.log(`  Line ${index} (${parsed.type}): ${parsed.content.substring(0, 1000)}...`);
              } catch (e) {
                console.log(`  Line ${index}: ${line.substring(0, 500)}...`);
              }
            }
          });
        }
      }
    }
  } catch (err) {
    console.error('Error during search:', err);
  }
}

search();
