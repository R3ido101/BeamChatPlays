var remote = require('electron').remote;
var BrowserWindow = remote.BrowserWindow;
var JsonDB = require('node-json-db');
const fs = require('fs');
var ipcRenderer = require('electron').ipcRenderer;
const shell = require('electron').shell;

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

// Game Profile List
// This function grabs a list of all saved game profiles.
function gameProfileList() {
    $(".control-dropdown option").not(".control-dropdown .default").each(function() {
        $(this).remove();
    });

    var games = Object.keys(dbSettings.getData("/gameProfiles"));
    for (var i = 0, length = games.length; i < length; i++) {
        $('.control-dropdown').append('<option value="' + games[i] + '">' + games[i] + '</option>');
    }
}

// Populate Button List
// This function reads the current game profile and populates the button list.
function gameProfileButtonList() {
    $('.button-right-content').empty();
    var activeProfile = $('.control-dropdown').val();
    var dbControls = new JsonDB("./controls/" + activeProfile, true, false);
    var gameProfile = dbControls.getData("/tactile");
    var buttonArray = $.map(gameProfile, function(el) {
        return el
    });

    for (var i = 0; i < buttonArray.length; i++) {
        var buttonid = buttonArray[i].id;
        var keypress = buttonArray[i].key;
        var movecounter = buttonArray[i].movementCounter;
        var cooldown = buttonArray[i].cooldown;

        $('.button-right-content').append('<div class="button-list-item .col-md-4"><div class="button-header"><div class="removebutton"><button class="remove" onclick=gameProfileButtonRemove("' + buttonid + ')">X</button></div></div><div class="button-content"><div class="buttonid">ID: ' + buttonid + '</div><div class="buttonkey">Key Press: ' + keypress + '</div><div class="movementCounter">Counter: ' + movecounter + '</div><div class="cooldown">Cooldown: ' + cooldown + '</div></div></div>');
    }
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

// Add Game Profile
// This adds a new game profile and refreshes the dropdown menu.
function gameProfileAdd() {
    var profileName = $('.profile-name input').val();
    var dbControls = new JsonDB("./controls/" + profileName, true, false);
    dbSettings.push('/gameProfiles/' + profileName + '/filename', profileName);
    dbControls.push('/' + profileName);
    $('.profile-name input').val("");
    gameProfileList();
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
    var activeProfile = $('.control-dropdown').val();
    ipcRenderer.send('beam-connect', activeProfile);
}

// Beam Interactive Disconnect
function beamDisconnect() {
    ipcRenderer.send('beam-disconnect');
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
    var activeProfile = $('.control-dropdown').val();
    var dbControls = new JsonDB("./controls/" + activeProfile, true, false);

    var buttonid = $('.control-entry .buttonid input').val();
    var keypress = $('.control-entry .key input').val();
    var movecounter = $('.control-entry .counter input').val();
    var cooldown = $('.control-entry .cooldown input').val();

    // Push to DB.
    dbControls.push("/tactile/" + buttonid, { "id": buttonid, "key": keypress, "movementCounter": movecounter, "cooldown": cooldown });

    // Reload button list.
    gameProfileButtonList();

    $('.control-entry input').val("");
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

// When login button is clicked send saved info to json.
$('.login .login-btn').click(function() {
    var username = $('.username input').val();
    var password = $('.password input').val();

    $.get("https://beam.pro/api/v1/channels/" + username + "?fields=id", function(data) {
        var channelID = data.id;
        dbAuth.push('/', { "channelID": channelID, "username": username, "password": password });
    })
});

// When app first loaded, put saved username in username field.
function savedLogin() {
    var saved = dbAuth.getData("/");
    var username = saved.username;
    var password = saved.password;
    $('.username input').val(username);
    $('.password input').val(password);
}

/////////////////////
// Log Panel
/////////////////////

ipcRenderer.on('logger', (event, message) => {
    $('.log-contents').prepend('<div class="log-message">' + message + '</div>');
    $('.log-message:gt(50)').remove();
})

/////////////////////////
// Initial Load Functions
/////////////////////////
gameProfileList();
savedLogin();
