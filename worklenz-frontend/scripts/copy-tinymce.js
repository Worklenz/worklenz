const fs = require('fs');
const path = require('path');

// Create the directory if it doesn't exist
const targetDir = path.join(__dirname, '..', 'public', 'tinymce');
if (!fs.existsSync(path.join(__dirname, '..', 'public'))) {
  fs.mkdirSync(path.join(__dirname, '..', 'public'));
}
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir);
}

// Copy the tinymce files
const sourceDir = path.join(__dirname, '..', 'node_modules', 'tinymce');
copyFolderRecursiveSync(sourceDir, path.join(__dirname, '..', 'public'));

function copyFolderRecursiveSync(source, target) {
  const targetFolder = path.join(target, path.basename(source));

  // Create target folder if it doesn't exist
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder);
  }

  // Copy files
  if (fs.lstatSync(source).isDirectory()) {
    const files = fs.readdirSync(source);
    files.forEach(function (file) {
      const curSource = path.join(source, file);
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, targetFolder);
      } else {
        fs.copyFileSync(curSource, path.join(targetFolder, file));
      }
    });
  }
}

console.log('TinyMCE files copied successfully!');
