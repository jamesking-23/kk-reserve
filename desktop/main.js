const { app, BrowserWindow, shell, Menu } = require('electron');

const APP_URL = 'https://kk-reserve-kkingg.vercel.app';
const ALLOWED = new Set(['kk-reserve-kkingg.vercel.app', 'psypetkhwwsezfhywwmk.supabase.co']);

if (!app.requestSingleInstanceLock()) app.quit();

function isAllowed(url) {
  try { return ALLOWED.has(new URL(url).hostname); } catch { return false; }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 380,
    minHeight: 600,
    backgroundColor: '#1b1b3a',
    title: 'kkingg reserves',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  Menu.setApplicationMenu(null);
  win.loadURL(APP_URL);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowed(url)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!isAllowed(url)) { e.preventDefault(); shell.openExternal(url); }
  });
  win.webContents.on('did-fail-load', (_e, code, _d, _u, isMain) => {
    if (isMain && code !== -3) {
      win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
        '<body style="font-family:Segoe UI,sans-serif;background:#1b1b3a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center">' +
        '<div><h2>kkingg reserves</h2><p>No internet connection.</p><p>Check your network and press Ctrl+R to retry.</p></div>'));
    }
  });
  win.webContents.on('before-input-event', (_e, i) => {
    if (i.type === 'keyDown' && i.control && i.key.toLowerCase() === 'r') win.loadURL(APP_URL);
  });
}

app.whenReady().then(createWindow);
app.on('second-instance', () => {
  const w = BrowserWindow.getAllWindows()[0];
  if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
});
app.on('window-all-closed', () => app.quit());
