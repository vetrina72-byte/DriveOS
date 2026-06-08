const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        if (dirPath.includes('node_modules')) return;
        if (fs.statSync(dirPath).isDirectory()) {
            walk(dirPath, callback);
        } else {
            callback(dirPath);
        }
    });
}

const regex1 = /\$\{([^}]+)\}px`/g;
// Another regex: some files might have width: "20px"
// Let's just fix the backtick ones first

["./components"].forEach(dir => {
    if (fs.existsSync(dir)) {
        walk(dir, (filePath) => {
            if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
                let content = fs.readFileSync(filePath, 'utf-8');
                let newContent = content.replace(regex1, '${($1) / 16}rem`');
                
                if (newContent !== content) {
                    fs.writeFileSync(filePath, newContent, 'utf-8');
                    console.log('Updated ' + filePath);
                }
            }
        });
    }
});
