const fs = require('fs');
const content = fs.readFileSync('components/MapsContainer.tsx', 'utf8');

let braceCount = 0;
let lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    for (let char of lines[i]) {
        if (char === '{') braceCount++;
        if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
                 console.log(`Component or top-level block closed at line ${i+1}`);
            }
        }
    }
}
