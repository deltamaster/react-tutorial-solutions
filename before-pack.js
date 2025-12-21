// Script to run before electron-builder packages the app
const fs = require('fs');
const path = require('path');

console.log('Running beforePack script...');

// Ensure electron.js and preload.js are in build folder
const buildDir = path.join(__dirname, 'build');
const electronSrc = path.join(__dirname, 'public', 'electron.js');
const preloadSrc = path.join(__dirname, 'public', 'preload.js');
const electronDest = path.join(buildDir, 'electron.js');
const preloadDest = path.join(buildDir, 'preload.js');

if (fs.existsSync(electronSrc)) {
  fs.copyFileSync(electronSrc, electronDest);
  console.log('✓ Copied electron.js to build folder');
} else {
  console.error('✗ electron.js not found in public folder');
}

if (fs.existsSync(preloadSrc)) {
  fs.copyFileSync(preloadSrc, preloadDest);
  console.log('✓ Copied preload.js to build folder');
} else {
  console.error('✗ preload.js not found in public folder');
}


// Update package.json in build folder to have correct main field
const buildPkgPath = path.join(buildDir, 'package.json');
if (fs.existsSync(buildPkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(buildPkgPath, 'utf8'));
  pkg.main = 'electron.js';
  fs.writeFileSync(buildPkgPath, JSON.stringify(pkg, null, 2));
  console.log('✓ Updated package.json main field in build folder');
} else {
  // Create package.json in build folder if it doesn't exist
  const rootPkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  const buildPkg = {
    name: rootPkg.name,
    version: rootPkg.version,
    main: 'electron.js',
    description: rootPkg.description,
    author: rootPkg.author
  };
  fs.writeFileSync(buildPkgPath, JSON.stringify(buildPkg, null, 2));
  console.log('✓ Created package.json in build folder');
}

console.log('beforePack script completed');
