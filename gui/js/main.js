var remote = require('electron').remote;
var BrowserWindow = remote.BrowserWindow;
var JsonDB = require('node-json-db');

var dbControls = new JsonDB("./controls/current", true, false);
var dbAuth = new JsonDB("./settings/auth", true, false);
var dbSettings = new JsonDB('./settings/settings', true, false);

// Set up the Tabs
$( function() {
    $( "#tabs" ).tabs().addClass( "ui-tabs-vertical ui-helper-clearfix" );
    $( "#tabs li" ).removeClass( "ui-corner-top" ).addClass( "ui-corner-left" );
 } );

/////////////////////
// BUTTONS PANEL
/////////////////////

$('.control-dropdown').on('change', function() {
	var option = $(this).val();
	console.log(option);
	// Hide button settings if nothing selected.
	if( option !== "default"){
		$('.control-entry').css('display','block');
	} else {
		$('.control-entry').css('display','none');
	}
});

function gameProfileList(){
	var games = Object.keys( dbSettings.getData("/gameProfiles") );
	for( var i = 0, length = games.length; i < length; i++){
		$('.control-dropdown').append('<option value="'+games[i]+'">'+games[i]+'</option>');
	}
}
gameProfileList();