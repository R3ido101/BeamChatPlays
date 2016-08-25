function Interactive(electron, mainWindow) {
    var ipcMain = electron.ipcMain;
    let { app, BrowserWindow } = require('electron');
    let win = null;

    const Beam = require('beam-client-node');
    const Interactive = require('beam-interactive-node');
    const rjs = require('robotjs');
    const Packets = require('beam-interactive-node/dist/robot/packets').default;
    const beam = new Beam();

    // Connects to interactive
    function beamConnect(activeProfile) {

        // Global Vars
        app = {
            auth: require('./settings/auth.json'),
            settings: require('./settings/settings.json'),
            controls: require('./controls/' + activeProfile + '.json'),
            clientID: "256e0678a231e8fff721e476d6eb0b43cada80730bd771a4"
        }

        const clientId = app.clientID;
        const channelId = app.auth['channelID'];
        const token = app.auth['token'];

        beam.use('oauth', {
                clientId: clientId,
                token: {
                    access: token,
                    expires: Date.now() + (365 * 24 * 60 * 60 * 1000)
                },
            })
            .attempt()
            .then(() => beam.game.join(channelId))
            .then(res => createRobot(res))
            .then(robot => performRobotHandShake(robot))
            .then(robot => setupRobotEvents(robot))
            .catch(err => {
                if (err.res) {
                    guiLogger('Error connecting to Interactive.');
                    guiEvent('disconnected', 'Disconnected from Interactive.');
                    throw new Error('Error connecting to Interactive:' + err.res.body.message);
                }
                guiLogger('Error connecting to Interactive.');
                guiEvent('disconnected', 'Disconnected from Interactive.');
                throw new Error('Error connecting to Interactive', err);
            });

        guiEvent('connected', 'Connected to interactive.');
    }

    // Creating Robot
    function createRobot(res, stream) {
        return new Interactive.Robot({
            remote: res.body.address,
            channel: channelId,
            key: res.body.key,
        });
    }

    // Robot Handshake
    function performRobotHandShake(robot) {
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
            guiLogger('There was an error setting up robot events.');
            guiLogger(err);
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

                if (isNaN(movementCounter) === true && movementCounter !== null && movementCounter !== undefined && movementCounter !== "") {

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
                guiLogger("ERROR: Button #" + rawid + " is missing from game profile in app.");
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

        if (keyOne > keyTwo && keyOnePressed === false) {
            guiLogger("Movement: " + key + " was pressed.");
            rjs.keyToggle(key, "down");
            app[key + 'Save'] = true;
        }
        if (keyTwo > keyOne && keyTwoPressed === false) {
            guiLogger("Movement: " + movementCounter + " was pressed.");
            rjs.keyToggle(movementCounter, "down");
            app[movementCounter + 'Save'] = true;
        }
        if (keyOne === keyTwo) {
            if (keyOnePressed === true || keyTwoPressed === true) {
                rjs.keyToggle(key, "up");
                rjs.keyToggle(movementCounter, "up");
                app[key + 'Save'] = false;
                app[movementCounter + 'Save'] = false;
            }
        }
    }

    // Tactile Key Hold
    function tactileHold(key, holding, buttonID) {
        if (app[key] > 0 && app[key + 'Save'] !== true) {
            guiLogger(key + " is being held down.");
            rjs.keyToggle(key, "down");
            app[key + 'Save'] = true;
        } else if (holding === 0 && app[key + 'Save'] !== false) {
            guiLogger(key + " is no longer held down.");
            rjs.keyToggle(key, "up");
            app[key + 'Save'] = false;
        }
    }

    // Tactile Key Tap.
    function tactileTap(key, press, buttonID) {
        if (press > 0) {
            guiLogger(key + " was pressed.");
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
        var screenWidth = 1920;
        var screenHeight = 1080;
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

        //console.log(progress);

        robot.send(new Packets.ProgressUpdate(progress));
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
            var button = controls.tactile[rawid]
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

    // Webcontents Send
    function guiLogger(msg) {
        mainWindow.webContents.send('logger', msg);
    }

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
