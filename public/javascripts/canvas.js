
function init() { 
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	canvas = document.getElementById("game-canvas");
	ctx = canvas.getContext("2d");

	document.body.style.backgroundColor = BACKGROUND_COLOR;

	thePlayerIds = [];
	initLabels();
	changeState(constants.states.INIT);
	handleResize();
}


var cursorX, cursorY;

function animate() {
	requestAnimFrame(animate);
	tick();
}

//////////  Events  \\\\\\\\\\


function getCardButtons() {
	return hand.concat(tableCardButtons).concat(plantCards).concat(offerCards).concat(...Object.values(askCards))
}

function getLocationButtons() {
	return fieldButtons.concat(...Object.values(tradeButtons)).concat([plantButton, handButton]);
}

function getButtons() {
	return Object.values(buttons).concat(getCardButtons()).concat(getLocationButtons()).sort((a, b) => b.layer - a.layer);
}

function handleMouseMove(event) {
	cursorX = event.pageX - canvas.offsetLeft;
	cursorY = event.pageY - canvas.offsetTop;
	for (var button of getButtons()) {
		if (button.under(cursorX, cursorY)) {
			if (!clickCursor) {
				$("#game-canvas").css("cursor", "pointer");
				clickCursor = true;
			}
			return;
		}
	}
	// console.log(cursorX, cursorY);
	$("#game-canvas").css("cursor","auto");
	clickCursor = false;
}

function handleMouseDown(event) {
	for (var button of getButtons()) {
		if (button.handleMouseDown(cursorX, cursorY)) return;
	}
}

function handleMouseUp(event) {
	var anyClicked = false;
	for (var button of getButtons()) {
		anyClicked |= button.handleMouseUp(cursorX, cursorY);
	}
	if (!anyClicked) clearClicked();
	handleMouseMove(event);
}

var SHIFTED = false;
var ALT = false;
function handleKeyDown(event) {
	switch (event.keyCode) {
		case 13:	// enter
			if (overlay && overlay !== OVERLAY_ACCEPT_DEMON) {
				clearOverlay();
			} else if (theTable) {
				buttons["submit chat"].click();
			} else {
				if (SHIFTED) {
					buttons["make table"].click();
				} else {
					buttons["join table"].click();
				}
			}
			break;
		case 38:    // up
			buttons["begin game"].click();
			break;
		case 39:    // ->
			if (thePlayer && thePlayer.isDemon) {
				cycleActivePlayer(true);
			} else {
				buttons["vote no"].click();
			}
			break;
		case 37:	// <-
			if (thePlayer && thePlayer.isDemon) {
				cycleActivePlayer(false);
			} else {
				buttons["vote yes"].click();
			}
			break;
		case 40:    // down
			buttons["ready"].click();
			break;
		case 16:    // shift
			SHIFTED = true;
			break;
		case 18:    // alt
			ALT = true;
			break;
		case 27: 	// esc
			if (gameState === constants.states.LOBBY) {
				buttons["leave table"].click();
			} else {
				buttons[constants.moves.PASS].click();
			}
			break;
	}
	console.log("Key press: " + event.keyCode);
}

function handleKeyUp(event) {
	switch (event.keyCode) {
		case 16:
			SHIFTED = false;
			break;
		case 18:
			ALT = false;
			break;
	}
}

var wOff;
var hOff;
function handleResize() {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (window.innerWidth < window.innerHeight * aspect) {
		cvW = window.innerWidth;
		cvH = window.innerWidth/ aspect;
		r = cvW / 1000;
		wOff = 0;
		hOff = (window.innerHeight - cvH) / 2;
	} else {
		cvW = window.innerHeight * aspect;
		cvH = window.innerHeight;
		r = cvH * aspect / 1000;
		wOff = (window.innerWidth - cvW) / 2;
		hOff = 0;
	}
	resizeCanvas(window.innerWidth, window.innerHeight);
	resizeElems();
}

function resizeElems() {
	// Resize input boxes
	for (var name in elems) elems[name].resize();
}

function resizeCanvas(w, h) {
    let ratio = window.devicePixelRatio;
	canvas.width = w * ratio;
    canvas.height = h * ratio;
    canvas.style.width = w + "px";
	canvas.style.height = h + "px";
    canvas.getContext("2d").scale(ratio, ratio);
}

//////////  Drawing  \\\\\\\\\\

function tick() {	
	if (IMAGES[BACK].loaded) {
		ctx.drawImage(IMAGES[BACK].img, 0, 0, window.innerWidth, window.innerHeight);
	} else {
		drawRect(BACKGROUND_COLOR, 0, 0, window.innerWidth,	window.innerHeight, true);
	}

	// Check for holding buttons.
	for (var button of getButtons()) button.checkHold(cursorX, cursorY);

	switch(gameState) {
		case constants.states.INIT:
			drawGroups["main menu"].draw();
			labels["disconnected"].draw();
			drawGroups["bottom bar"].draw();
			break;
		case constants.states.MAIN_MENU:
			drawGroups["main menu"].draw();
			drawGroups["bottom bar"].draw();
			break;
		case constants.states.LOBBY:
			//drawGroups["chat"].draw();
			drawTable();
			if (isTableOwner()) {
				if (theTable.players.length >= theTable.settings.minPlayers) {
					theTable.message = "Press start to begin!";
					buttons["begin game"].enable();
				} else {
					theTable.message = "Waiting for enough players to join...";
					buttons["begin game"].disable().show();
				}
				//buttons["table settings"].enable();
			} else {
				theTable.message = "Waiting for game to begin...";
				buttons["begin game"].disable();
				//buttons["table settings"].disable();
			}
			drawGroups["table lobby"].draw();
			drawGroups["bottom bar"].draw();
			break;
		default:
			//drawGroups["chat"].draw();
			drawTable();
			//drawTimers();
			drawGroups["bottom bar"].draw();
			break;
	}

	/*
	switch (overlay) {
		case OVERLAY_POPUP:
			drawPopUp();
			break;
		case OVERLAY_HOWTO:
			drawHowTo();
			break;
		case OVERLAY_AVATAR:
			drawAvatarSelection();
			break;
		case OVERLAY_ACCEPT_DEMON:
			drawDemonAccept();
			break;
		case OVERLAY_SETTINGS:
			drawSettings();
			break;
	}
	*/
}

window.requestAnimFrame = (function () {
	return window.requestAnimationFrame ||
		   window.webkitRequestAnimationFrame ||
		   window.mozRequestAnimationFrame ||
		   window.oRequestAnimationFrame ||
		   window.msRequestAnimationFrame ||
		   function (callback, element) {
			   window.setTimeout(callback, 1000 / 30);
		   };
})();

// TODO: move most of this to constant
var canvas, ctx, cvW, cvH;
var clickCursor = false,
	aspect = 16 / 10,
	BACKGROUND_COLOR = "#ecd5ad",
	LABEL_FONT = "Tahoma",
	WHITE = "#ffffff",
	BUTTON_BACKGROUND = "#d98137",
	BUTTON_BORDER = "#4d3e3a",
	BUTTON_TEXT = "#4d3e3a",
	BUTTON_DISABLED = "gray";

init();
animate();

window.addEventListener("resize", handleResize, false);
window.addEventListener("mousemove", handleMouseMove, false);
window.addEventListener("mousedown", handleMouseDown, false);
window.addEventListener("mouseup", handleMouseUp, false);
window.addEventListener("keydown", handleKeyDown, false);
window.addEventListener("keyup", handleKeyUp, false);