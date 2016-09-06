function Interactive(electron, mainWindow) {

    var ipcMain = electron.ipcMain;
    let { app, BrowserWindow } = require('electron');
    let win = null;

    var JsonDB = require('node-json-db');
    const Beam = require('beam-client-node');
    const Interactive = require('beam-interactive-node');
    const rjs = require('robotjs');
    rjs.setKeyboardDelay(0);
    const Packets = require('beam-interactive-node/dist/robot/packets').default;
    const beam = new Beam();

    // Connects to interactive
    function beamConnect(activeProfile) {
        var dbAuth = new JsonDB("./settings/auth", true, false);
        var dbControls = new JsonDB('./controls/' + activeProfile, true, false);

        guiEvent('logger', 'Attempting to connect to interactive.');

        // Global Vars
        app = {
            auth: dbAuth.getData('/'),
            controls: dbControls.getData('/'),
            clientID: "256e0678a231e8fff721e476d6eb0b43cada80730bd771a4",
            progress: ""
        }

        const channelId = app.auth['channelID'];
        const authToken = app.auth['token'];

        beam.use('oauth', {
            clientId: app.clientID,
            tokens: {
                access: authToken,
                expires: Date.now() + 365 * 24 * 60 * 60 * 1000
            }
        })
        beam.game.join(channelId)
            .then(res => createRobot(res, channelId))
            .then(robot => performRobotHandShake(robot))
            .then(robot => setupRobotEvents(robot))
            .catch(err => {
                if (err.res) {
                    guiEvent('logger', 'Error connecting to Interactive.');
                    guiEvent('disconnected', 'Error connecting to Interactive.');
                    throw new Error('Error connecting to Interactive:' + err.res.body.message);
                }
                guiEvent('logger', 'Error connecting to Interactive.');
                guiEvent('disconnected', 'Error connecting to Interactive.');
                throw err;
            });

        guiEvent('connected', 'Connected to interactive.');
    }

    // Creating Robot
    function createRobot(res, channelId) {
        console.log('Creating robot...')
        return new Interactive.Robot({
            remote: res.body.address,
            channel: channelId,
            key: res.body.key,
        });
    }

    // Robot Handshake
    function performRobotHandShake(robot) {
        console.log('Robot Handshaking...');
        return new Promise((resolve, reject) => {
            robot.handshake(err => {
                if (err) {
                    reject(err);
                }
                resolve(robot);
            });
        });
    }

    // Robot Events
    function setupRobotEvents(robot) {
        console.log("Good news everyone! Interactive is ready to go!");
        robot.on('report', report => {

            if (report.tactile.length > 0) {
                tactile(report.tactile);
                tactileProgress(report.tactile);
            }
            if (report.joystick.length > 0) {
                joystick(report.joystick[0]);
                joystickProgress(report.joystick[0]);
            }
            if (report.screen.length > 0) {
                screen(report.screen[0]);
                screenProgress(report.screen[0]);
            }

            progressUpdate(robot);
        });
        robot.on('error', err => {
            console.log('Error setting up robot events.', err);
            guiEvent('logger', 'Error connecting to Interactive.');
            guiEvent('disconnected', 'Error with robot. Check log.');
            guiEvent('logger', 'There was an error setting up robot events.');
        });

        robot = robot;
    }

    // Tactile Handler
    function tactile(tactile) {

        for (i = 0; i < tactile.length; i++) {
            // Get Button Settings for ID
            var rawid = tactile[i].id;
            var holding = tactile[i].holding;
            var press = tactile[i].pressFrequency;
            var controls = app.controls;
            var button = controls.tactile[rawid]

            if (button !== undefined && button !== null) {
                var buttonID = button['id'];
                var key = button['key'];
                var movementCounter = button['movementCounter'];
                var cooldown = button['cooldown'];

                buttonSave(key, holding, press);

                if (movementCounter !== "") {

                    movement(key, movementCounter, buttonID);

                } else {
                    if (isNaN(holding) === false) {
                        tactileHold(key, holding, buttonID);
                    }

                    if (isNaN(press) === false) {
                        tactileTap(key, press, buttonID);
                    }
                }
            } else {
                guiEvent('logger', "ERROR: Button #" + rawid + " is missing from game profile in app. Add these buttons to the game profile and restart the app.");
            }
        }
    }

    // Button Saves
    // Constantly saves holding number to var for reference in key versus comparisons.
    function buttonSave(key, holding, press) {
        if (holding > 0) {
            app[key] = holding;
        } else if (press > 0) {
            app[key] = press;
        } else {
            app[key] = 0;
        }

        if (app[key + 'Save'] === undefined) {
            app[key + 'Save'] = false;
        }

    }

    // Movement Keys
    function movement(key, movementCounter, buttonID) {

        var keyOne = app[key];
        var keyOnePressed = app[key + 'Save'];
        var keyTwo = app[movementCounter];
        var keyTwoPressed = app[movementCounter + 'Save'];

        if (keyTwo === undefined || keyTwo === null) {
            var keyTwo = 0;
            var keyTwoPressed = false;
        }

        if (keyOne > keyTwo && keyOnePressed === false) {
            guiEvent('logger', "Movement: " + key + " was pressed.");
            rjs.keyToggle(key, "down");
            app[key + 'Save'] = true;
        }
        if (keyTwo > keyOne && keyTwoPressed === false) {
            guiEvent('logger', "Movement: " + movementCounter + " was pressed.");
            rjs.keyToggle(movementCounter, "down");
            app[movementCounter + 'Save'] = true;
        }
        if (keyOne === keyTwo) {
            if (keyOnePressed === true) {
                rjs.keyToggle(key, "up");
                app[key + 'Save'] = false;
                guiEvent('logger', "Movement: " + key + " was released.");
            }
            if (keyTwoPressed === true) {
                rjs.keyToggle(movementCounter, "up");
                app[movementCounter + 'Save'] = false;
                guiEvent('logger', "Movement: " + movementCounter + " was released.");
            }
        }
    }

    // Tactile Key Hold
    function tactileHold(key, holding, buttonID) {
        if (app[key] > 0 && app[key + 'Save'] !== true) {
            guiEvent('logger', key + " is being held down.");
            rjs.keyToggle(key, "down");
            app[key + 'Save'] = true;
        } else if (holding === 0 && app[key + 'Save'] !== false) {
            guiEvent('logger', key + " is no longer held down.");
            rjs.keyToggle(key, "up");
            app[key + 'Save'] = false;
        }
    }

    // Tactile Key Tap.
    function tactileTap(key, press, buttonID) {
        if (press > 0) {
            guiEvent('logger', key + " was pressed.");
            rjs.keyToggle(key, "down");
            setTimeout(function() {
                rjs.keyToggle(key, "up");
            }, 20);
        }
    }

    // Joystick Controls
    function joystick(report) {
        const mouse = rjs.getMousePos();
        const mean = report.coordMean;
        if (!isNaN(mean.x) && !isNaN(mean.y)) {
            rjs.moveMouse(
                Math.round(mouse.x + 50 * mean.x),
                Math.round(mouse.y + 50 * mean.y)
            );
        }
    }

    // Screen Controls
    function screen(report) {
        //http://electron.atom.io/docs/api/screen/
        const { width, height } = electron.screen.getPrimaryDisplay().size;

        var screenWidth = width;
        var screenHeight = height;
        const mean = report.coordMean;
        if (!isNaN(mean.x) && !isNaN(mean.y)) {
            rjs.moveMouse(
                Math.round(screenWidth * mean.x),
                Math.round(screenHeight * mean.y)
            );
        }
    }

    // Progress Updates

    // Progress Compile
    function progressUpdate(robot) {
        var tactile = app.tactileProgress;
        var screen = app.screenProgress;
        var joystick = app.joystickProgress;

        var progress = {
            "tactile": tactile,
            "screen": screen,
            "joystick": joystick
        }

        // If there is any new info, send progress update.
        if (app.progress !== progress) {
            robot.send(new Packets.ProgressUpdate(progress));
            app.progress = progress;
        }

        app.tactileProgress = [];
        app.screenProgress = [];
        app.joystickProgress = [];
    }

    // Tactile
    function tactileProgress(tactile) {
        var json = [];
        for (i = 0; i < tactile.length; i++) {
            var rawid = tactile[i].id;
            var holding = tactile[i].holding;
            var press = tactile[i].pressFrequency;

            var controls = app.controls;
            var button = controls.tactile[rawid];
            var cooldown = button['cooldown'];

            // Convert JSON Cooldown Number to Milliseconds
            var cooldown = parseInt(cooldown) * 1000;

            if (isNaN(holding) === false && holding > 0 || isNaN(press) === false && press > 0) {
                json.push({
                    "id": rawid,
                    "cooldown": cooldown,
                    "fired": true,
                    "progress": 1
                });
            } else {
                json.push({
                    "id": rawid,
                    "fired": false,
                    "progress": 0
                });
            }
        }
        app.tactileProgress = json;
    }

    // Screen
    function screenProgress(screen) {
        var json = [];
        var rawid = screen.id;
        var mean = screen.coordMean;
        var screenX = mean.x;
        var screenY = mean.y;
        var clicks = screen.clicks;

        if (clicks > 0) {
            json.push({
                "id": rawid,
                "clicks": [{
                    "coordinate": mean,
                    "intensity": 1
                }]
            });
        }
        app.screenProgress = json;
    }

    // Joystick
    function joystickProgress(joystick) {
        var json = [];
        var rawid = joystick.id;
        var mean = joystick.coordMean;
        var joyX = mean.x;
        var joyY = mean.y;
        if (isNaN(joyX) === true) {
            var joyX = 0;
        }
        if (isNaN(joyY) === true) {
            var joyY = 0;
        }

        var rad = Math.atan2(joyY, joyX);

        json.push({
            "id": rawid,
            "angle": rad,
            "intensity": 1
        });
        app.joystickProgress = json;
    }

    // Send Event to Gui
    function guiEvent(event, msg) {
        mainWindow.webContents.send(event, msg);
    }

    // Connects when connect button is clicked.
    ipcMain.on('beam-connect', function(event, activeProfile) {
        // Initial Connection
        beamConnect(activeProfile);
    });

} // End Interactive wrap
module.exports = Interactive;
