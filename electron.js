const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  // Check if we're in development mode
  // In development, we'll load from localhost:3000
  // In production, we'll load from the build folder
  const isDev = process.env.NODE_ENV === 'development' || (app && !app.isPackaged);

  // Determine if we're running from build folder (production) or root (development)
  const isInBuildFolder = __dirname.includes('build') || __dirname.includes('app.asar');
  
  // Create the browser window - show immediately to display loading screen
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true, // Show window immediately
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    }
    // Icon is handled by electron-builder configuration
  });

  // Load the app - the inline loading screen in index.html will show automatically
  if (isDev) {
    // In development, load from React dev server
    mainWindow.loadURL('http://localhost:3000');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from build folder
    // When packaged, electron.js is in the same directory as index.html (both in build/)
    const indexPath = isInBuildFolder
      ? path.join(__dirname, 'index.html')
      : path.join(__dirname, 'build', 'index.html');
    mainWindow.loadFile(indexPath);
  }

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS, re-create a window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
  });
});

