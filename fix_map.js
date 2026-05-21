import fs from 'fs';

const tsx = fs.readFileSync('components/MapsContainer.tsx', 'utf8');
const html = fs.readFileSync('maps.html', 'utf8');

const startIdx = tsx.indexOf('const mapHtmlContent = `') + 'const mapHtmlContent = `'.length;
const endIdx = tsx.indexOf('`\n\nconst MapsContainer', startIdx);

if (startIdx > -1 && endIdx > -1) {
  const escapedHtml = html.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  const newTsx = tsx.substring(0, startIdx) + '\n' + escapedHtml + '\n' + tsx.substring(endIdx);
  fs.writeFileSync('components/MapsContainer.tsx', newTsx);
  console.log('Successfully fixed MapsContainer.tsx');
} else {
  console.log('Could not find proper bounds');
}
