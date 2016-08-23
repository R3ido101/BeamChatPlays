var Interactive = require('./interactive');
var electron = require('electron');
var { app, globalShortcut } = require('electron');
var ipcMain = electron.ipcMain;
var gui = electron.app;
var BrowserWindow = electron.BrowserWindow;
var mainWindow = null;

// Quit everything on GUI exit.
gui.on('window-all-closed', function() {
    if (process.platform != 'darwin') {
        gui.quit();
    }
});

// This runs when GUI starts.
gui.on('ready', function() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1000,
        minHeight: 500,
        minWidth: 500,
        minHeight: 300,
        fullscreenable: false,
        icon: __dirname + '/fav.png'
    });
    //mainWindow.setMenu(null);

    // and load the index.html of the app.
    mainWindow.loadURL('file://' + __dirname + '/gui/index.html');

    // Load up interactive
    var interactive = new Interactive(electron, mainWindow);

    // Emitted when the window is closed.
    mainWindow.on('closed', function() {
        mainWindow = null;
        gui.quit();
    });

    // When Ctrl+Backspace is pressed, interactive will stop.
    globalShortcut.register('CommandOrControl+Backspace', () => {
        gui.quit();
    })
});

// When Quittin.
gui.on('will-quit', () => {
    // Unregister all shortcuts.
    globalShortcut.unregisterAll()
})
