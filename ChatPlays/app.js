const Beam = require('beam-client-node');
const Interactive = require('beam-interactive-node');
const rjs = require('robotjs');
var auth = require('./settings/settings.json');
var Packets = require('beam-interactive-node/dist/robot/packets').default;

// Global Vars
app = {
	auth: require('./settings/auth.json'),
	controls: require('./controls/current.json'),
	settings: require('./settings/settings.json'),
	progress: []
}

const channelId = app.auth['channelID'];
const username = app.auth['username'];
const password = app.auth['password'];

// Connects to interactive
const beam = new Beam();
beam.use('password', {
    username,
    password,
})
.attempt()
.then(() => beam.game.join(channelId))
.then(res => createRobot(res))
.then(robot => performRobotHandShake(robot))
.then(robot => setupRobotEvents(robot))
.catch(err => {
	console.log(err.message);
    if (err.res) {
        throw new Error('Error connecting to Interactive:' + err.res.body.mesage);
    }
    throw new Error('Error connecting to Interactive', err);
});

// Creating Robot
function createRobot(res, stream) {
    return new Interactive.Robot({
        remote: res.body.address,
        channel: channelId,
        key: res.body.key,
    });
}

// Robot Handshake
function performRobotHandShake (robot) {
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
function setupRobotEvents (robot) {
	console.log("Good news everyone! Interactive is ready to go!");
    robot.on('report', report => {
    	if (report.tactile.length > 0){
    		tactile(report.tactile);
    	}
    	if (report.joystick.length > 0) {
    		joystick(report.joystick[0]);
    	}
    	if (report.screen.length > 0) {
    		screen(report.screen[0]);
    	}
    });
    robot.on('error', err => {
        throw new Error('There was an error setting up robot events.', err);
    });
}


// Tactile Handler
function tactile(tactile){
	for( i = 0; i < tactile.length; i++){
		// Get Button Settings for ID
		var rawid = tactile[i].id;
		var holding = tactile[i].holding;
		var press = tactile[i].pressFrequency;
        var controls = app.controls;
        var button = controls.tactile[rawid]

		if ( button !== undefined && button !== null){
			var buttonID = button['id'];
			var key = button['key'];

			if(isNaN(holding) === false){
				tactileHold(key, holding);
			}

            if (isNaN(press) === false) {
				tactileTap(key, press);
			}

		} else {
			console.error("ERROR: Button #"+rawid+" is missing from controls json file. Stopping app.");
            process.exit();
		}
	}
}

// Versus Key Saves
// Constantly saves holding number to var for reference in key versus comparisons.
function versusSave(key, holding){
    app[key] = holding;
}

// Tactile Key Hold
function tactileHold(key, holding){
    var holdSave = app[key];
	if (holding > 0 && holdSave !== true){
		console.log(key+" is being held by "+holding+" human(s).");
        rjs.keyToggle(key, "down");
        app[key] = true;
	} else if (holding === 0 && holdSave !== false){
        console.log(key+" is being held by "+holding+" human(s).");
        rjs.keyToggle(key, "up");
        app[key] = false;
    }
}

// Tactile Key Tap.
function tactileTap(key, press){
	if (press > 0){
		console.log(key+" was pressed by "+press+" human(s).");
		rjs.keyToggle(key, "down");
		setTimeout(function(){ 
			rjs.keyToggle(key, "up"); 
		}, 20);
	}
}

// Joystick Controls
function joystick(report){
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
function screen(report){
	var screenWidth = 1920;
	var screenHeight = 1080;
    const mean = report.coordMean;
    if (!isNaN(mean.x) && !isNaN(mean.y)) {
        rjs.moveMouse(
            Math.round( screenWidth * mean.x),
            Math.round( screenHeight * mean.y)
        );
    }
}

// Progress Updates
function progressUpdate(){

}