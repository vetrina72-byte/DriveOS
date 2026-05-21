import fs from 'fs';

const html = fs.readFileSync('maps.html', 'utf8');
const tsx = fs.readFileSync('components/MapsContainer.tsx', 'utf8');

const startIdx = tsx.indexOf('const mapHtmlContent = `') + 'const mapHtmlContent = `'.length;
const endIdx = tsx.indexOf('`;', startIdx);

if (startIdx > -1 && endIdx > -1) {
  // Escape backticks and ${} in the HTML content
  const escapedHtml = html.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  const newTsx = tsx.substring(0, startIdx) + '\n' + escapedHtml + '\n' + tsx.substring(endIdx);
  fs.writeFileSync('components/MapsContainer.tsx', newTsx);
  console.log('Successfully updated MapsContainer.tsx');
} else {
  console.log('Could not find mapHtmlContent string literal bounds');
}
