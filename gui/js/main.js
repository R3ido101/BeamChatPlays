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
        scopes: ["user:details:self", "interactive:manage:self", "interactive:robot:self", ] // Scopes limit access for OAuth tokens.
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
        dbAuth.push('/', { "channelID": data.channel.id, "username": data.username, "token": token, "level": data.level, "experience": data.experience, "verified": data.verified, "avatarUrl": data.avatarUrl });
        //Load up avatar and such on login page. 
        savedLogin();

        authWindow.close()
    });
};

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
    console.log(auth.length);
    if ($.isEmptyObject(auth)) {
        console.log('User has not logged in yet.');
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
        var keypress = $('.control-entry .key input').val();
        var movecounter = $('.control-entry .counter input').val();
        var cooldown = $('.control-entry .cooldown input').val();

        // Push to DB.
        dbControls.push("/tactile/" + buttonid, { "id": buttonid, "key": keypress, "movementCounter": movecounter, "cooldown": cooldown });

        gameProfileButtonList();

        // Clean up inputs
        $('.control-entry input').val("").removeClass('parsley-success');

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
gameProfileList();
tips();
savedLogin();
