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
        width: 1100,
        minHeight: 500,
        minWidth: 50,
        minHeight: 300,
        fullscreenable: false,
        show: false,
        icon: __dirname + '/fav.png'
    });
    //mainWindow.setMenu(null);

    // and load the index.html of the app.
    mainWindow.loadURL('file://' + __dirname + '/gui/index.html');

    // Load up interactive
    var interactive = new Interactive(electron, mainWindow);

    process.on('uncaughtException', function(error) {
        // Handle the error
        console.error(error);
    });

    // Emitted when the window is closed.
    mainWindow.on('closed', function() {
        mainWindow = null;
        gui.quit();
    });

    // When Ctrl+Backspace is pressed, interactive will stop.
    globalShortcut.register('CommandOrControl+Backspace', () => {
        gui.quit();
    })

    // Window Loaded!
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    })
});

// When Quittin.
gui.on('will-quit', () => {
    // Unregister all shortcuts.
    globalShortcut.unregisterAll()
});
