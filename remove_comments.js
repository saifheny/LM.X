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
        content = content.replace(/\/\*[\s\S]*?\*\//g, '');
        if (ext === '.js') {
            content = content.replace(/(?:^|[^\\])\/\/(?!\/).*$/gm, '');
        }
    } else if (ext === '.html') {
        content = content.replace(/<!--[\s\S]*?-->/g, '');
    }

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
