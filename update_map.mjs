import fs from 'fs';

const html1 = fs.readFileSync('new_html_1.html', 'utf8');
const html2 = fs.readFileSync('new_html_2.html', 'utf8');
const htmlContentUnescaped = html1 + html2;
const htmlContentEscaped = htmlContentUnescaped.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

const code = fs.readFileSync('components/MapsContainer.tsx', 'utf8');

const startToken = "const mapHtmlContent = `\n";
const closingTag = "\n      </style>\n    `;";

const startIndex = code.indexOf(startToken);
const endIndex = code.indexOf(closingTag, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
    const newCode = code.substring(0, startIndex + startToken.length) + htmlContentEscaped + code.substring(endIndex);
    fs.writeFileSync('components/MapsContainer.tsx', newCode);
    console.log("Success escaping!");
} else {
    // Fallback: use regex
    const fallbackRegex = /const mapHtmlContent = `[\s\S]*?<\/style>\n    `;/;
    if (fallbackRegex.test(code)) {
        const fallbackNewCode = code.replace(fallbackRegex, "const mapHtmlContent = `\n" + htmlContentEscaped + "\n      </style>\n    `;");
        fs.writeFileSync('components/MapsContainer.tsx', fallbackNewCode);
        console.log("Success with regex escaping!");
    } else {
        console.log("Failure.");
    }
}
