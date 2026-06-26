import fs from 'fs';
import path from 'path';

const transPath = 'C:\\Users\\MARCE\\.gemini\\antigravity\\brain\\704df98d-1ee7-4add-8626-72bd150c2bd1\\.system_generated\\logs\\transcript.jsonl';

const lines = fs.readFileSync(transPath, 'utf8').split('\n');
console.log('Line 186:');
console.log(lines[186]);
