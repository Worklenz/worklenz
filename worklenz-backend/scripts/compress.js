const fs = require('fs');
const path = require('path');
const { createGzip } = require('zlib');
const { pipeline } = require('stream');

async function compressFile(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const gzip = createGzip();
    const source = fs.createReadStream(inputPath);
    const destination = fs.createWriteStream(outputPath);

    pipeline(source, gzip, destination, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function compressDirectory(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    
    if (file.isDirectory()) {
      await compressDirectory(fullPath);
    } else if (file.name.endsWith('.js') || file.name.endsWith('.css')) {
      const gzPath = fullPath + '.gz';
      await compressFile(fullPath, gzPath);
      console.log(`Compressed: ${fullPath} -> ${gzPath}`);
    }
  }
}

async function main() {
  try {
    const buildDir = path.join(__dirname, '../build');
    if (fs.existsSync(buildDir)) {
      await compressDirectory(buildDir);
      console.log('Compression complete!');
    } else {
      console.log('Build directory not found. Run build first.');
    }
  } catch (error) {
    console.error('Compression failed:', error);
    process.exit(1);
  }
}

main(); 