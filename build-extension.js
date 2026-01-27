// Script to build Chrome extension
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Building Chrome extension...\n');

// Step 1: Build React app (without Electron-specific steps)
console.log('Step 1: Building React app...');
try {
  execSync('react-scripts build', { stdio: 'inherit' });
  console.log('✓ React app built successfully\n');
} catch (error) {
  console.error('✗ Failed to build React app');
  process.exit(1);
}

// Step 2: Copy extension-specific files to build folder
console.log('Step 2: Copying extension files to build folder...');
const buildDir = path.join(__dirname, 'build');
const publicDir = path.join(__dirname, 'public');

// Files to copy from public folder
const filesToCopy = [
  'manifest.json',
  'background.js',
  'popup.html',
  'auth-redirect.html',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'favicon.ico',
  'android-chrome-192x192.png',
  'android-chrome-512x512.png'
];

// Directories to copy
const dirsToCopy = [
  'meme'
];

// Copy files
filesToCopy.forEach(file => {
  const src = path.join(publicDir, file);
  const dest = path.join(buildDir, file);
  
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`✓ Copied ${file}`);
  } else {
    console.warn(`⚠ ${file} not found in public folder`);
  }
});

// Copy directories recursively
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

dirsToCopy.forEach(dir => {
  const src = path.join(publicDir, dir);
  const dest = path.join(buildDir, dir);
  
  if (fs.existsSync(src)) {
    copyDir(src, dest);
    console.log(`✓ Copied directory ${dir}/`);
  } else {
    console.warn(`⚠ ${dir} directory not found in public folder`);
  }
});

// Copy avatar images
const avatarFiles = [
  'avatar-belinda.jpg',
  'avatar-charlie.jpg',
  'avatar-diana.jpg',
  'avatar-user-female.jpg',
  'avatar-user-male.jpg',
  'avator-adrien.jpg'
];

avatarFiles.forEach(file => {
  const src = path.join(publicDir, file);
  const dest = path.join(buildDir, file);
  
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`✓ Copied ${file}`);
  }
});

console.log('\n✓ Chrome extension build completed successfully!');
console.log(`\nExtension files are in: ${buildDir}`);
console.log('\nTo load the extension in Chrome:');
console.log('1. Open Chrome and go to chrome://extensions/');
console.log('2. Enable "Developer mode"');
console.log('3. Click "Load unpacked"');
console.log('4. Select the "build" folder');
