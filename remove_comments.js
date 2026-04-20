const fs = require('fs');
const path = require('path');

const filesToProcess = [
    'js/teacher.js',
    'js/student.js',
    'js/firebase-config.js',
    'css/style.css',
    'index.html',
    'exam.html',
    'policy.html'
];

function removeComments(content, ext) {
    if (ext === '.js' || ext === '.css') {
        // Remove block comments /* ... */
        content = content.replace(/\/\*[\s\S]*?\*\//g, '');
        if (ext === '.js') {
            // Very basic line comment removal. We must be careful not to remove // inside strings or URLs.
            // A safer regex for // outside strings/URLs in JS:
            content = content.replace(/(?:^|[^\\])\/\/(?!\/).*$/gm, '');
        }
    } else if (ext === '.html') {
        // Remove HTML comments <!-- ... -->
        content = content.replace(/<!--[\s\S]*?-->/g, '');
    }
    
    // Remove multiple empty lines
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    return content;
}

for (const file of filesToProcess) {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        const ext = path.extname(file);
        content = removeComments(content, ext);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Cleaned ${file}`);
    }
}
