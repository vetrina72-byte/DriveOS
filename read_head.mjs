import fs from 'fs';

const code = fs.readFileSync('components/MusicPlayer.tsx', 'utf8');
const lines = code.split('\n');

for (let i = 0; i < 200; i++) {
    console.log(`${i+1}: ${lines[i]}`);
}
