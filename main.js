const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// Auto-aktualizacje w tle
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    kiosk: true, // PEŁNY TRYB KIOSKU OSP
    fullscreen: true,
    autoHideMenuBar: true, // Ukrywa pasek menu na Windows
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: false // BLOKADA NARZĘDZI DEWELOPERSKICH
    }
  });

  // W produkcji ładujemy zbudowany plik, w dev lokalny serwer
  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  // Sprawdzaj aktualizacje, jeśli aplikacja jest w wersji produkcyjnej
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      console.error('Błąd podczas sprawdzania aktualizacji:', err);
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  ipcMain.on('quit-app', () => {
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
