var remote = require('electron').remote;
var BrowserWindow = remote.BrowserWindow;
var JsonDB = require('node-json-db');
const fs = require('fs');
var ipcRenderer = require('electron').ipcRenderer;
const shell = require('electron').shell;
const request = require('request');

var dbAuth = new JsonDB("./settings/auth", true, false);
var dbSettings = new JsonDB('./settings/settings', true, false);

// Initial Tab Setup
$(function() {
    // Add version number to title bar.
    var pjson = process.env.npm_package_version;
    $('title').text('Beam Chat Plays ' + pjson + ' by @firebottletv');

    // Set up tabs.
    $("#tabs").tabs().addClass("ui-tabs-vertical ui-helper-clearfix");
    $("#tabs li").removeClass("ui-corner-top").addClass("ui-corner-left");
});

/////////////////////
// Helpers
/////////////////////

// Open Link In Browser
// This opens link in system default browser.
$(document).on('click', 'a[href^="http"]', function(event) {
    event.preventDefault();
    shell.openExternal(this.href);
});

$(document).tooltip({
    position: { my: "left+15 center", at: "right center" }
});

// Start up field validation.
$('#button-adder').parsley();
$('#profile-adder').parsley();

function authBeam() {
    var options = {
        client_id: '256e0678a231e8fff721e476d6eb0b43cada80730bd771a4',
        scopes: ["user:details:self", "interactive:manage:self", "interactive:robot:self"] // Scopes limit access for OAuth tokens.
    };

    var authWindow = new BrowserWindow({
        width: 400,
        height: 600,
        resizable: false,
        alwaysOnTop: true,
        transparent: true,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            partition: 'persist:interactive'
        }
    });

    var url = "https://beam.pro/oauth/authorize?";
    var authUrl = url + "client_id=" + options.client_id + "&scope=" + options.scopes.join(' ') + "&redirect_uri=http://localhost/callback" + "&response_type=token";
    authWindow.loadURL(encodeURI(authUrl));
    authWindow.show();

    function handleCallback(url) {
        var raw_token = /token=([^&]*)/.exec(url) || null;
        var token = (raw_token && raw_token.length > 1) ? raw_token[1] : null;
        var error = /\?error=(.+)$/.exec(url);

        if (token) {
            requestBeamData(token, authWindow)
        }
        if (error) {
            authWindow.close();
        }
    }

    authWindow.webContents.on('will-navigate', function(event, url) {
        handleCallback(url);
    });

    authWindow.webContents.on('did-get-redirect-request', function(event, oldUrl, newUrl) {

        handleCallback(newUrl);
    });

    // Reset the authWindow on close
    authWindow.on('close', function() {
        authWindow = null;
    }, false);
}

requestBeamData = function(token, authWindow) {
    request({
        url: 'https://beam.pro/api/v1/users/current',
        auth: {
            'bearer': token
        }
    }, function(err, res) {
        var data = JSON.parse(res.body);
        //Save Login Info
        dbAuth.push('/', { "channelID": data.channel.id, "username": data.username, "token": token, "avatarUrl": data.avatarUrl });
        //Load up avatar and such on login page. 
        savedLogin();

        authWindow.close()
    });
};

// Build settings.json
// Builds the settings.json file on app launch. Keeps valid keys from getting lost.
function settingsBuild() {
    dbSettings.push('/validKeys', { "0": true, "1": true, "2": true, "3": true, "4": true, "5": true, "6": true, "7": true, "8": true, "9": true, "a": true, "b": true, "c": true, "d": true, "e": true, "f": true, "g": true, "h": true, "i": true, "j": true, "k": true, "l": true, "m": true, "n": true, "o": true, "p": true, "q": true, "r": true, "s": true, "t": true, "u": true, "v": true, "w": true, "x": true, "y": true, "z": true, "backspace": true, "delete": true, "enter": true, "space": true, "tab": true, "escape": true, "up": true, "down": true, "left": true, "right": true, "home": true, "end": true, "pageup": true, "pagedown": true, "f1": true, "f2": true, "f3": true, "f4": true, "f5": true, "f6": true, "f7": true, "f8": true, "f9": true, "f0": true, "f11": true, "f12": true, "alt": true, "control": true, "shift": true, "right_shift": true, "numpad_0": true, "numpad_1": true, "numpad_2": true, "numpad_3": true, "numpad_4": true, "numpad_5": true, "numpad_6": true, "numpad_7": true, "numpad_8": true, "numpad_9": true });
}

// Remove Saved Account
// Removes saved account info.
function authBeamRemove() {
    dbAuth.push("/", "");
    savedLogin();

    // Open OAuth page for user to remove app from account.
    shell.openExternal('https://beam.pro/me/account/oauth');
}

// Login Info
// Loads saved login info once a person has used oauth, or if user not logged in or disconnects account it shows new info.
function savedLogin() {
    var auth = dbAuth.getData('/');
    if ($.isEmptyObject(auth)) {
        $('.user-profile .avatar, .user-profile .username').empty();
        $('.oauth-details, .login .login-btn').show();
        $('.login .logout-btn').hide();
    } else {
        $('.user-profile .avatar').html('<img src="' + auth.avatarUrl + '">');
        $('.user-profile .username').html(auth.username + ' #' + auth.channelID);
        $('.oauth-details, .login .login-btn').hide();
        $('.login .logout-btn').show();
    }
}

// Game Profile List
// This function grabs a list of all saved game profiles.
function gameProfileList() {
    $(".control-dropdown option, .active-profile-dropdown option").not(".control-dropdown .default").each(function() {
        $(this).remove();
    });

    var games = Object.keys(dbSettings.getData("/gameProfiles"));
    for (var i = 0, length = games.length; i < length; i++) {
        $('.control-dropdown, .active-profile-dropdown').append('<option value="' + games[i] + '">' + games[i] + '</option>');
    }
}

// Populate Button List
// This function reads the current game profile and populates the button list.
function gameProfileButtonList() {
    $('.button-right-content').empty();

    $('.button-right-content').fadeOut("fast", function() {
        $('.button-right-content').empty();
        var activeProfile = $('.control-dropdown').val();
        var dbControls = new JsonDB("./controls/" + activeProfile, true, false);

        try {

            var gameProfile = dbControls.getData("/tactile");
            var buttonArray = $.map(gameProfile, function(el) {
                return el
            });

            for (var i = 0; i < buttonArray.length; i++) {
                var buttonid = buttonArray[i].id;
                var keypress = buttonArray[i].key;
                var movecounter = buttonArray[i].movementCounter;
                var cooldown = buttonArray[i].cooldown;

                console.log(keypress);

                if (keypress != "") {
                    try {
                        dbSettings.getData("/validKeys/" + keypress);
                    } catch (error) {
                        $('.log-contents').prepend('<div class="log-message">' + keypress + ' is an invalid key. This is caused by an invalid control in the controls JSON file. Remake the button using the app.</div>');
                        var keypress = "<span class=error>Invalid Key</span>"
                    }
                }

                if (movecounter != "") {
                    try {
                        dbSettings.getData("/validKeys/" + movecounter);
                    } catch (error) {
                        $('.log-contents').prepend('<div class="log-message">' + movecounter + ' is an invalid key. This is caused by an invalid control in the controls JSON file. Remake the button using the app.</div>');
                        var movecounter = "<span class=error>Invalid Key</span>"
                    }
                }


                if (movecounter == "") {
                    var movecounter = "None";
                }

                $('.button-right-content').append('<div class="button-list-item col-md-3"><div class="button-header"><div class="buttonid">' + buttonid + '</div><div class="removebutton"><button class="remove" onclick=gameProfileButtonRemove("' + buttonid + '")>X</button></div></div><div class="button-content"><div class="buttonkey"><span class="button-option">Key Press:</span><br>' + keypress + '</div><div class="movementCounter"><span class="button-option">Counter:</span><br>' + movecounter + '</div><div class="cooldown"><span class="button-option">Cooldown:</span><br>' + cooldown + ' sec.</div></div></div>');
            }
            $('.button-right-content').fadeIn("fast");

        } catch (error) {
            console.log(error);
        }

    });
}

// Add Game Profile
// This adds a new game profile and refreshes the dropdown menu.
function gameProfileAdd() {
    $('#profile-adder').parsley().on('form:submit', function() {
        var profileName = $('.profile-name input').val();
        var dbControls = new JsonDB("./controls/" + profileName, true, false);
        dbSettings.push('/gameProfiles/' + profileName + '/filename', profileName);
        $('.profile-name input').val("").removeClass('parsley-success');
        gameProfileList();
        $('.control-dropdown').val(profileName);
        $('.new-game-profile').fadeOut("fast", function() {
            $('.control-entry').fadeIn("fast");
        });
        return false;
    });
}

// Remove Game Profile
// This removes the current game profile.
function gameProfileRemove() {
    var profileName = $('.control-dropdown').val();
    fs.unlink('./controls/' + profileName + '.json', (err) => {
        if (err) throw err;
        console.log('Deleted file /controls/' + profileName);
        dbSettings.delete("/gameProfiles/" + profileName);
        gameProfileList();
        gameProfileButtonList();
        $('.control-dropdown option:eq(0)').prop('selected', true);
        $('.control-entry').fadeOut('fast');
    })
}

// Beam Interactive Connect
function beamConnect() {
    var activeProfile = $('.active-profile-dropdown').val();
    ipcRenderer.send('beam-connect', activeProfile);
}

// Beam Interactive Disconnect
function beamDisconnect() {
    ipcRenderer.send('beam-disconnect');
}

// Add button to game profile
function addButtonToProfile() {

    $('#button-adder').parsley().on('form:submit', function() {

        var activeProfile = $('.control-dropdown').val();
        var dbControls = new JsonDB("./controls/" + activeProfile, true, false);

        var buttonid = $('.control-entry .buttonid input').val();
        var keypress = $('.control-entry .key .key-dropdown').val();
        var movecounter = $('.control-entry .counter .counter-dropdown').val();
        var cooldown = $('.control-entry .cooldown input').val();


        // Push to DB.
        dbControls.push("/tactile/" + buttonid, { "id": buttonid, "key": keypress, "movementCounter": movecounter, "cooldown": cooldown });

        gameProfileButtonList();

        // Clean up inputs
        $('.control-entry input').val("").removeClass('parsley-success');
        $('.control-entry select').removeClass('parsley-success');
        $('.control-entry .key .key-dropdown option:eq(0)').prop('selected', true);
        $('.control-entry .counter .counter-dropdown option:eq(0)').prop('selected', true);

        return false;
    });
}

// Remove Button
// This removes the current button from the game profile.
function gameProfileButtonRemove(buttonid) {
    var activeProfile = $('.control-dropdown').val();
    var dbControls = new JsonDB("./controls/" + activeProfile, true, false);

    // Remove button from json.
    dbControls.delete("/tactile/" + buttonid);

    // Reload button list.
    gameProfileButtonList();
}

// Tip Popup
// Shows a popup every 5 minutes with a tip.
function tips() {
    $('.tips').fadeIn("fast").delay(10000).fadeOut("fast");
    window.setTimeout(function() {
        $('.tips').fadeIn("fast").delay(10000).fadeOut("fast");
    }, 600000);
}

/////////////////////
// BUTTONS PANEL
/////////////////////

// When the game profile dropdown changes, show the controls to add a button.
$('.control-dropdown').on('change', function() {
    var option = $(this).val();
    if (option !== "default") {
        $('.new-game-profile').fadeOut("fast", function() {
            $('.control-entry').fadeIn("fast");
        });
        // Reload button list.
        gameProfileButtonList();
    } else {
        $('.control-entry').css('display', 'none');
    }
});

// When user clicks the add button to profile button, get entered info and submit to profile.
$('.buttonsubmit .buttonadd').click(function() {
    // Add button to profile
    addButtonToProfile();

    // Reload button list.
    gameProfileButtonList();

});

// When user hits the add profile button show related fields.
$('.add-profile').click(function() {
    $('.control-dropdown option:eq(0)').prop('selected', true);
    $('.control-entry').fadeOut("fast", function() {
        $('.new-game-profile').fadeIn("fast");
    });
});

// When user submits new profile.
$('.new-game-profile .profile-add').click(function() {
    gameProfileAdd();
});

// When user deletes a profile.
$('.remove-profile').click(function() {
    gameProfileRemove();
});

// Connect to Beam
$('.beam-connect-btn').click(function() {
    beamConnect();
});

/////////////////////
// Login Panel
/////////////////////



/////////////////////
// Log Panel
/////////////////////

ipcRenderer.on('logger', (event, message) => {
    $('.log-contents').prepend('<div class="log-message">' + message + '</div>');
    $('.log-message:gt(50)').remove();
})

ipcRenderer.on('connected', (event, message) => {
    $('.beam-connection .status').text(message);
})

ipcRenderer.on('disconnected', (event, message) => {
    $('.beam-connection .status').text(message);
})

/////////////////////////
// Initial Load Functions
/////////////////////////
settingsBuild();
gameProfileList();
tips();
savedLogin();
