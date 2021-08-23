function print(x) {
	console.log(x);
}

// Config settings received from server.
const defaultNewTableSettings = {
	// Table settings
	minPlayers: 3,
	maxPlayers: 7, 
};
var newTableSettings = Cookies.getJSON("table settings") || defaultNewTableSettings;

////////// Game states \\\\\\\\\\\\

const ERROR_DURATION_SEC = 3;

const BACK = "background"
const IMAGES = []
IMAGES[BACK] = new PreLoadedImage("/images/background.jpg");

const CARD_RATIO = 1.514;
const CARD_BACK = "CARD_BACK";
const CARD_FIELD = "CARD_FIELD";
const CARDS = [];
CARDS[CARD_BACK] = new PreLoadedImage("/images/cards/BACK.jpg");
CARDS[CARD_FIELD] = new PreLoadedImage("/images/cards/FIELD.jpg");
for (var val = 4; val < 26; val+=2) {
	CARDS[val] = new PreLoadedImage(`/images/cards/${val}.jpg`);
}

// Player images
const PLAYER_IMAGES = [];
for (var i = 0; i < constants.AVATAR_COUNT; i++) {
	PLAYER_IMAGES[i] = new PreLoadedImage(`/images/avatars/${i}.png`);
}

// Debug settings
var DEBUG = false;
var logFull = true;

// Game state
var socket = io();
var labels = [];
var buttons = [];
var elems = [];
var drawGroups = [];
var sounds = [];
 
// Game state
var gameState, theTable, playerId, thePlayerIds, thePlayer;
var hand = [];
var coins = [];
var tradePositions = [];
var clickedOrigin = undefined;
var clickedOriginIndex = undefined;
var clickedCards = [];
var fieldButtons = [];
for (var i = 0; i < 3; i++) {
	fieldButtons[i] = makeCardButton(CARD_BACK, constants.loc.FIELD, i);
}
var tableCardButtons = [];
for (var i = 0; i < 2; i++) {
	tableCardButtons[i] = makeCardButton(CARD_BACK, constants.loc.TABLE, i);
}
plantButton = new ShapeButton("#d4aa78", clickLocation.bind(null, constants.loc.PLANT), "white").setHighlight("gold");
handButton = new ShapeButton("#d4aa78", clickLocation.bind(null, constants.loc.HAND), "white").setHighlight("gold");
var plantCards = [];
var offerCards = [];
var askCards = {};
var tradeButtons = [];

// Display
var timers = [];

// Overlay
var overlay, popupMessage, howtoPage;
const HOW_TO_PAGES = 2;
const OVERLAY_POPUP = "pop up";
const OVERLAY_AVATAR = "avatar";
const OVERLAY_HOWTO = "how to";
const OVERLAY_SETTINGS = "settings";
const OVERLAY_ACCEPT_DEMON = "accept demon";

//////////  Socket Events  \\\\\\\\\\

var ts = timesync.create({
	server: "/timesync",
	interval: 10000
});

socket.on("player id", function(id) {
	playerId = id;
});

socket.on("connect", function() {
	updateTable();
});

socket.on("update state", function(table) {
	updateTable(table);
});

socket.on("server error", function(msg) {
	raiseError(msg);
});

socket.on("chat msg", function(msg, sender) {
	console.log(`CHAT MSG: ${msg} ${sender}`);
	if (sender) addPlayerChat(msg, sender);
	else addMessage(elems["game-log"], msg);
});

socket.on("clear chat", function(chat) {
	clearChat(chat);
});

socket.on("pop up", function(msg) {
	popupMessage = msg;
	enableOverlay(OVERLAY_POPUP);
});

socket.on("playerInfo", function(info) {
	if (!hand || hand.length !== info.hand.length) hand = makeCardArray(info.hand, constants.loc.HAND);
	coins = info.coins;
	tradePositions = info.tradePositions || [];
	enableCards();
});

function makeCardArray(cards, origin, originIndex) {
	var array = []
	for (var i = 0; i < cards.length; i++) {
		array.push(makeCardButton(cards[i], origin, i, originIndex))
	}
	return array;
}

function makeCardButton(cardValue, origin, index, originIndex) {
	// console.log(`MAKE CARD ${cardValue} ${origin} ${index} ${originIndex}`);
	var callback, uncallback, doublecallback;
	switch (origin) {
		case constants.loc.HAND:
		case constants.loc.TABLE:
		case constants.loc.PLANT:
			callback = clickCard.bind(null, origin, index);
			uncallback = unClickCard.bind(null, origin, index);
			doublecallback = doubleClickCard.bind(null, origin, index);
			break;
		case constants.loc.TRADE:
			callback = clickCard.bind(null, origin, index, originIndex);
			uncallback = unClickCard.bind(null, origin, index);
			doublecallback = doubleClickCard.bind(null, origin, index, originIndex);
			break;
		case constants.loc.FIELD:
			callback = clickLocation.bind(null, origin, index)
			uncallback = undefined;
			break;
	}
	b = new ImageButton(CARDS[cardValue], callback, undefined, uncallback, doublecallback).setHighlight("gold").setLayer(0);
	b.value = cardValue
	return b;
}

socket.on("init settings", function(settings) {
	labels["version"].text = settings.code_version ? `v${settings.code_version}` : "local";
	if (settings.DEBUG !== undefined) DEBUG = settings.DEBUG;
	if (DEBUG) {
		newTableSettings.minPlayers = 3;
		elems["player-name"].elem.value = "Player" + Math.floor(Math.random() * 100);
		elems["game-code"].elem.value = "AAAA";
	}
	handleResize();
});

socket.on("disconnect", function() {
	handleServerDisconnect();
});

//////////  Init static GUI elements  \\\\\\\\\\

function initLabels() {
	labels["title"] = new Label("BOHNANZA", 80).setPosition(0.5, 0.4);
	labels["disconnected"] = new Label("Waiting for server connection...", 20).setPosition(0.5, 0.92);
	labels["error msg"] = new Label("", 20).setPosition(0.5, 0.98);

	// Main menu
	buttons["make table"] = new Button("Make Table", 60, makeTable).setPosition(0.5, 0.55).setDims(0.427, 0.14).setCenter(true);
	buttons["join table"] = new Button("Join Table", 60, joinTable).setPosition(0.5, 0.80).setDims(0.427, 0.14).setCenter(true);
	drawGroups["main menu"] = new DrawGroup([
		labels["title"],
		buttons["make table"],
		buttons["join table"],
	]);
	elems["player-name"] = new DocumentElement("input", "player-name").setPosition(0.288, 0.63).setDims(0.3, 0.09).setSize(40);
	elems["player-name"].elem.maxLength = 16;
	elems["player-name"].elem.placeholder = "Player Name";
	elems["player-name"].elem.value = Cookies("name") || "";
	elems["game-code"] = new DocumentElement("input", "game-code").setPosition(0.594, 0.63).setDims(0.12, 0.09).setSize(40);
	elems["game-code"].elem.maxLength = 4;
	elems["game-code"].elem.placeholder = "CODE";
	elems["game-code"].elem.style.textTransform = "uppercase";

	// Table lobby
	buttons["begin game"] = new Button("Start Game", 15, doMove.bind(null, constants.moves.BEGIN)).setPosition(0.5, 0.55).setDims(0.15, 0.07).setCenter(true);
	//buttons["table settings"] = new Button("Table Settings", 15, enableOverlay.bind(null, OVERLAY_SETTINGS)).setPosition(0.3, 0.4).setDims(0.15, 0.07).setCenter(true);
	buttons["leave table"] = new Button("Leave Table", 15, leaveTable).setPosition(0.5, 0.65).setDims(0.15, 0.07).setCenter(true);
	//buttons["change avatar"] = new Button("Change Avatar", 15, enableOverlay.bind(null, OVERLAY_AVATAR)).setPosition(0.3, 0.7).setDims(0.15, 0.07).setCenter(true);
	drawGroups["table lobby"] = new DrawGroup([
		buttons["leave table"],
		//buttons["table settings"],
		buttons["begin game"],
		//buttons["change avatar"],
	])
	buttons["finish game"] = new Button("Finish Game", 15, doMove.bind(null, constants.moves.FINISH)).setPosition(0.3, 0.6).setDims(0.15, 0.07).setCenter(true);

	// Game buttons
	buttons["pass"] = new Button("Pass", 15, doMove.bind(null, constants.moves.PASS)).setPosition(0.6, 0.675).setDims(0.15, 0.07).setCenter(true);
	for (var i = 0; i < 3; i++) {
		// Dig must be double clicked.
		buttons[`dig ${i}`] = new Button("", 10, false, false, digField.bind(null, i));
	}

	// Game settings (bottom bar)
	buttons["table code"] = new Button("Table ????", 12, toggleShowTable).setPosition(0.05, 0.97).setDims(0.09, 0.04).setCenter(true);
	//buttons["howto"] = new Button("How To Play", 12, enableOverlay.bind(null, OVERLAY_HOWTO)).setPosition(0.15, 0.97).setDims(0.09, 0.04).setCenter(true);
	labels["version"] = new Label("", 15).setPosition(0.99, 0.98).setAlign("right").setFont("monospace");
	drawGroups["bottom bar"] = new DrawGroup([
		buttons["table code"],
		//buttons["howto"],
		labels["error msg"],
		// buttons["sound"],
		labels["version"],
	]);
}

////////// Input elements \\\\\\\\\\

function disableInputs() {
	setElemDisplay();
	Object.values(demonChats).forEach(c => c.hide());
}

function setElemDisplay(inputs = []) {
	for (var name in elems) {
		inputs.includes(name) ? elems[name].show() : elems[name].hide();
	}
}

function enableInputs() {
	switch (gameState) {
		case undefined:
		case constants.states.INIT:
		case constants.states.MAIN_MENU: {
			let inputs = ["player-name", "game-code"];
			if (DEBUG) inputs.push("sessionId");
			setElemDisplay(inputs);
			break;
		}
		default: {
			/*
			let inputs = ["chat-input", "game-log", "player-chat"];
			if (thePlayerIsPossessed) {
				buttons["demon-chat"].enable();
				inputs.push("demon-chat");
			} else {
				buttons["demon-chat"].disable();
			}*/
			setElemDisplay();
			//drawGroups["chat"].enable();
			break;
		}
	}
}

/////////// Game logic \\\\\\\\\\\\

function changeState(state) {
	if (state === gameState) return;

	for (var button of getButtons()) button.disable();

	drawGroups["bottom bar"].enable();

	switch(state) {
		case constants.states.INIT:
			overlay = undefined;
			howtoPage = 0;
			drawGroups["main menu"].disable().show();
			//clearChats();
			break;
		case constants.states.MAIN_MENU:
			overlay = undefined;
			thePlayerIds = [];
			drawGroups["main menu"].enable();
			labels["error msg"].text = "";
			//clearChats();
			break;
		case constants.states.LOBBY:
			hand = [];
			coins = [];
			overlay = undefined;
			//clearChats();
			drawGroups["table lobby"].enable();
			break;
		case constants.states.PLANT_FIRST:
			break;
		case constants.states.PLANT_SECOND:
			break;
		case constants.states.TRADING:
			if (isCurrentPlayer()) {
				theTable.players.map(player => buttons[`confirm ${player.id}`].enable());
				theTable.players.map(player => buttons[`clear ${player.id}`].enable());
			} else {
				buttons[`confirm ${thePlayer.id}`].enable();
				buttons[`clear ${thePlayer.id}`].enable();
			}
			break;
		case constants.states.PLANT_TRADED:
			break;
		case constants.states.END:
			break;
	}
	gameState = state;
	enableCards();
	enableInputs();
}

function enableCards() {
	if (!theTable) return;
	if (hand.length > 0) {
		if ([constants.states.PLANT_FIRST, constants.states.PLANT_SECOND, constants.states.TRADING].includes(gameState)) {
			if (gameState === constants.states.TRADING || thePlayer !== getCurrentPlayer()) {
				hand.map((b, index) => tradePositions.includes(index) ? b.disable().show() : b.enable());
			} else {
				hand.map(b => b.disable().show());
				if (hand[0]) hand[0].enable();
			}
		} else {
			hand.map(b => b.disable().show());
		}
	}
	if (plantCards.length > 0) {
		if (gameState === constants.states.PLANT_TRADED) plantCards.map(b => b.enable());
		else plantCards.map(b => b.disable().show());
	}
	if (offerCards.length > 0) {
		if (thePlayer !== getCurrentPlayer() && [constants.states.PLANT_FIRST, constants.states.PLANT_SECOND, constants.states.TRADING].includes(gameState)) offerCards.map(b => b.enable());
		else offerCards.map(b => b.disable().show());
	}
	for (var cards of Object.values(askCards)) {
		if (cards.length > 0) {
			if (thePlayer === getCurrentPlayer() && gameState === constants.states.TRADING) cards.map(b => b.enable());
			else cards.map(b => b.disable().show());
		}
	}
	if (isCurrentPlayer()) tableCardButtons.map((b, i) => theTable.tableCardCommitted[i] || !theTable.tableCards[i] ? b.disable().show() : b.enable());
}

/////////// Buttons \\\\\\\\\\\\\\\

function unClickCard(origin, index) {
	console.log(`UN-CLICK CARD: ${origin} ${index} ${clickedOrigin} ${clickedCards}`);
	utils.removeByValue(clickedCards, index);
	if (clickedCards.length === 0) clickedOrigin = undefined;
}

function clickCard(origin, index, originIndex) {
	if (origin !== clickedOrigin || originIndex !== clickedOriginIndex) clearClicked();
	if (gameState === constants.states.PLANT_TRADED) clickedCards.filter(idx => thePlayer.plant[idx] !== thePlayer.plant[index]).forEach(idx => plantCards[idx].toggle());
	clickedOrigin = origin;
	clickedOriginIndex = originIndex;
	clickedCards.push(index);
}

function doubleClickCard(origin, index, originIndex) {
	if (!theTable) return;
	if (origin !== clickedOrigin || originIndex !== clickedOriginIndex) clearClicked();
	clickedOrigin = origin;
	clickedOriginIndex = originIndex;
	if (!clickedCards.includes(index)) clickedCards.push(index);
	switch (gameState) {
		case constants.states.PLANT_FIRST:
		case constants.states.PLANT_SECOND:
			if (isCurrentPlayer()) {
				if (index > 0 || origin !== constants.loc.HAND) return;
				var indices = getMatchingFields(hand[0].value);
				if (indices) clickedCards = [0]; clickLocation(constants.loc.FIELD, indices[0]);
			} else if (origin === constants.loc.HAND) clickLocation(constants.loc.TRADE, thePlayer.id);
			else if (origin === constants.loc.TRADE) clickLocation(constants.loc.HAND);
		break;
		case constants.states.TRADING:
			if (isCurrentPlayer()) {
				if (origin === constants.loc.TRADE) clickLocation(constants.loc.HAND);
				else if (origin === constants.loc.TABLE) clickLocation(constants.loc.PLANT);
			} else {
				if (origin === constants.loc.HAND) clickLocation(constants.loc.TRADE, thePlayer.id);
				else if (origin === constants.loc.TRADE) clickLocation(constants.loc.HAND);
			}
		break;
		case constants.states.PLANT_TRADED:
			if (origin !== constants.loc.PLANT) return;
			var indices = getMatchingFields(thePlayer.plant[index]);
			if (indices) clickLocation(constants.loc.FIELD, indices[0]);
		break;
	}
	clearClicked();
}

function getMatchingFields(value) {
	var fieldIndices = [];
	for (var i = 0; i < 3; i++) if (thePlayer.fields[i] && thePlayer.fields[i][0] === value) fieldIndices.push(i);
	if (fieldIndices.length > 0) return fieldIndices;
	for (var i = 0; i < 3; i++) if (thePlayer.fields[i] && !thePlayer.fields[i][0]) fieldIndices.push(i);
	return fieldIndices;
}


function clearClicked() {
	clickedCards.map(index => getCard(clickedOrigin, index, clickedOriginIndex).clicked = false);
	clickedCards = [];
	clickedOrigin = undefined;
	clickedOriginIndex = undefined;
}

function getCard(origin, index, originIndex) {
	switch (origin) {
		case constants.loc.HAND:
			return hand[index];
		case constants.loc.TRADE:
			if (isCurrentPlayer()) return askCards[originIndex][index];
			else if (originIndex === thePlayer.id) return offerCards[index];
		case constants.loc.PLANT:
			return plantCards[index];
		case constants.loc.TABLE:
			return tableCardButtons[index];
		default:
			console.log(`COULD NOT GET CARD! ${origin} ${index} ${originIndex}`);
	}
}

function clickLocation(origin, index) {
	console.log(`CLICK LOCATION: ${origin} ${index} ${clickedOrigin} ${clickedOriginIndex} ${clickedCards}`);
	// Special case for buying third bean field.
	if (origin === constants.loc.FIELD && index == 2 && !thePlayer.fields[2]) {
		fieldButtons[2].clicked = false;
		if (coins.length > 2) buyField();
		return;
	}
	if (!clickedCards || !clickedOrigin) return;
	var msg = {
		type: constants.moves.MOVE_CARD,
		src: clickedOrigin,
		srcIndices: clickedCards,
		dest: origin,
		destIndex: index,
	};
	var valid = false;
	switch (origin) {
		case constants.loc.FIELD:
			switch (clickedOrigin) {
				case constants.loc.HAND:
					valid = clickedCards.length === 1;
					break;
				case constants.loc.PLANT:
					valid = true;
					break;
			}
			break;
		case constants.loc.PLANT:
			switch (clickedOrigin) {
				case constants.loc.TABLE:
					valid = isCurrentPlayer();
					break;
			}
			break;
		case constants.loc.TRADE:
			switch (clickedOrigin) {
				case constants.loc.HAND:
					// Current player can not move into their own trade area, other players must.
					valid = isCurrentPlayer() ? index !== thePlayer.id : index === thePlayer.id;
					break;
				case constants.loc.TABLE:
					valid = isCurrentPlayer();
					break;
			}
			break;
		case constants.loc.HAND:
			switch(clickedOrigin) {
				case constants.loc.TRADE:
					valid = true;
					msg.playerId = clickedOriginIndex;
					break;
			}
			break;
	}
	socket.emit("do move", msg);
	clearClicked();
}

function doMove(move) {
	if (move === constants.moves.READY) buttons["ready"].disable();
	socket.emit("do move", {type: move});
}

function confirmTrade(playerId) {
	socket.emit("do move", {
		type: constants.moves.CONFIRM_TRADE,
		id: playerId,
	});
}

function clearTrade(playerId) {
	socket.emit("do move", {
		type: constants.moves.CLEAR_TRADE,
		id: playerId,
	});
}

function digField(index) {
	buttons[`dig ${index}`].disable();
	socket.emit("do move", {
		type: constants.moves.DIG_FIELD,
		field: index,
	});
}

function buyField() {
	socket.emit("do move", {
		type: constants.moves.BUY_FIELD,
	});
}

function changeAvatar(avatarId) {
	Cookies.set("avatarId", avatarId);
	socket.emit("update player settings", {avatarId: avatarId});
}

function changeColor(color) {
	Cookies.set("color", color);
	socket.emit("update player settings", {color: color});
}

function toggleShowTable() {
	if (buttons["table code"].hideCode) {
		buttons["table code"].hideCode = false;
		buttons["table code"].text = theTable ? `Table ${theTable.code}` : "Table ????";
	} else {
		buttons["table code"].hideCode = true;
		buttons["table code"].text = "Table ????";
	}
}

function makeTable() {
	if (!socket.connected) raiseError("No connection to server");

	const name = elems["player-name"].elem.value.trim();
	if (!name) raiseError("Must provide name to create table");
	else {
		const playerSettings = {
			name: name,
			avatarId: parseInt(Cookies("avatarId")),
			color: Cookies("color"),
		}
		Cookies.set("name", name);
		socket.emit("make table", newTableSettings, playerSettings);
	}
}

function joinTable() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (!socket.connected) raiseError("No connection to server");

	const name = elems["player-name"].elem.value.trim();
	const code = elems["game-code"].elem.value.trim();
	if (!name) raiseError("Must provide name and table code to join table");
	else if (!code) raiseError("Must provide name and table code to join table");
	else {
		const playerSettings = {
			name: name,
			avatarId: parseInt(Cookies("avatarId")),
			color: Cookies("color"),
		}
		Cookies.set("name", name);
		socket.emit("join table", code, playerSettings);
	}
}

function updateTable(table) {
	if (!table) {
		theTable = undefined;
		changeState(constants.states.MAIN_MENU);
		buttons["table code"].text = "Table ????";
		return;
	}
	// Update state.
	var change = !theTable || gameState != table.state;
	theTable = table;

	// Update players
	// TODO: replace with per player updates?
	const latestPlayerIds = [];
	table.players.forEach(player => {
		latestPlayerIds.push(player.id);
		if (player.id === playerId) {
			thePlayer = player;
			if (plantCards.length !== player.plant.length)  plantCards = makeCardArray(player.plant, constants.loc.PLANT);
			if (offerCards.length !== player.trade.offer.length) offerCards = makeCardArray(player.trade.offer, constants.loc.TRADE, player.id);
			if (buttons[`confirm ${player.id}`]) buttons[`confirm ${player.id}`].clicked = player.trade.offerConfirmed;
		}
		if (thePlayerIds.includes(player.id)) return;
		tradeButtons[player.id] = new ShapeButton(false, clickLocation.bind(null, constants.loc.TRADE, player.id)).setHighlight("gold");
		buttons[`confirm ${player.id}`] = new Button("✓", 10, confirmTrade.bind(null, player.id), confirmTrade.bind(null, player.id)).disable();
		buttons[`clear ${player.id}`] = new Button("X", 10, clearTrade.bind(null, player.id)).disable();
	});
	// Get ask cards for current player, otherwise none.
	if (isCurrentPlayer()) {
		table.players.forEach(player => {
			if (player.id === playerId) return;
			if (!askCards[player.id] || askCards[player.id].length !== player.trade.ask.length) askCards[player.id] = makeCardArray(player.trade.ask, constants.loc.TRADE, player.id);
			if (buttons[`confirm ${player.id}`]) buttons[`confirm ${player.id}`].clicked = player.trade.askConfirmed;
		});
	} else {
		askCards = {};
	}
	enableCards();

	// Remove old players
	const removedPlayerIds = thePlayerIds.filter(id => !latestPlayerIds.includes(id));
	thePlayerIds = latestPlayerIds;
	removedPlayerIds.forEach(id => {
		delete tradeButtons[id];
		delete buttons[`confirm ${id}`]
	});

	if (change) {
		changeState(table.state);
		enableInputs();
	}
	if (!buttons["table code"].hideCode) buttons["table code"].text = `Table ${theTable.code}`;
}

function leaveTable() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	socket.emit("leave table");
}

function handleServerDisconnect() {
	if (logFull) console.log("%s(%s)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	raiseError("Server disconnected!");
	// TODO: once db backup is added, remove this, disable buttons.
	changeState(constants.states.INIT);
	theTable = undefined;
}

function clearChats() {
	["game-log", "player-chat", "demon-chat"].forEach(chat => clearChat(chat));
}

/////////// Utilities \\\\\\\\\

function raiseError(msg) {
	labels["error msg"].text = msg;
	setTimeout(fadeLabel.bind(null, "error msg", true), ERROR_DURATION_SEC * 10);
}

function fadeLabel(label, start) {
	//console.log(`IN FADE LABEL ${labels[label].opacity} ${start}`)
	if (start) {
		labels[label].opacity = 100;
		labels[label].visible = true;
	} else {
		labels[label].opacity -= 1;
	}
	if (labels[label].opacity > 0) {
		//console.log(`\tCALLING AGAIN`);
		setTimeout(fadeLabel.bind(null, "error msg", false), ERROR_DURATION_SEC * 10);
	} else {
		labels[label].opacity = 0;
		//console.log(`\tTHAT's ALL FOLKS!`);
		labels[label].visible = false;
	}
}

Number.prototype.mod = function(n) {
	return ((this % n) + n) % n;
}


////////// Chat logic \\\\\\\\\\\\
/*
var lastSender = undefined;
var chatBgnd = false;
function addPlayerChat(msg, senderName) {
	// Handle simple text messages;
	let item = document.createElement("li");
	if (senderName !== lastSender) chatBgnd = !chatBgnd;
	lastSender = senderName;
	if (chatBgnd) item.style.background = "#575757";
	if (senderName === thePlayer.name) {
		item.style.textAlign = "right";
	} else {
		addMarkedUpContent(item, `<c>${senderName}</c>: `);
	}
	addMessage(elems["player-chat"], msg, item);
}

function addDemonChat(msg, id) {
	const chat = demonChats[id];
	if (!chat) return;
	addMessage(demonChats[id], msg);
}

function addMessage(container, msg, item) {
	item = item || document.createElement("li");
	addMarkedUpContent(item, msg);
	container.appendChild(item);
	item.scrollIntoView();
}

function addMarkedUpContent(item, content) {
	var stack = [item];
	var lastText;

	var index = 0
	while (true) {
		var next = content.indexOf('<', index);
		if (next === -1) break;
		if (next !== index) {
			lastText = content.substring(index, next)
			addSpan(stack[stack.length - 1], lastText);
		}
		index = next + 1;
		next = content.indexOf('>', index);
		var tag = content.substring(index, next);
		if (tag.startsWith("/")) {
			switch (tag.substring(1).toLowerCase()) {
				case "c":
					var player = getPlayerByName(lastText);
					if (player) stack[stack.length - 1].style.color = player.color;
					break;
				case "b": 
					stack[stack.length -1].style.fontWeight = "bold";
					break;
			}
			stack.pop();
		} else {
			stack.push(addSpan(stack[stack.length - 1]));
		}
		index = next + 1;
	}
	if (index !== content.length) addSpan(item, content.substring(index));
}

function addSpan(item, text) {
	var sp = document.createElement("span");
	if (text) sp.innerText = text;
	item.appendChild(sp);
	return sp;
}

function clearChat(chat) {
	elems[chat].elem.innerHTML = "";
}

function submitChat() {
	const input = elems["chat-input"].elem;
	if (input.value) {
		if (ALT && thePlayer.isDemon) {
			for (var player of possessedPlayers) {
				socket.emit("chat msg", input.value, player);
			}
		} else {
			socket.emit("chat msg", input.value, thePlayer.isDemon ? selectedPlayer : false);
		}
		input.value = "";
	}
}

function fastChat(msg) {
	elems["chat-input"].elem.value += msg + " ";
}

function setChatHeight() {
	if (!thePlayer) return;
	if (thePlayer.isDemon) {
		const CHAT_X = 0.79;
		const CHAT_W = 0.19;
		const CHAT_TOP = 0.25;
		const CHAT_BOT = 0.80;
		const CHAT_HEIGHT = CHAT_BOT - CHAT_TOP;
		const DIV_HEIGHT = 0.025;

		// Transitioning from human to demon.
		if (buttons["game-log"].xx !== CHAT_X) {

			for (var name of ["game-log", "player-chat"]) {
				buttons[name].setDims(CHAT_W, DIV_HEIGHT);
			}

			buttons["game-log"].setPosition(CHAT_X, CHAT_TOP).setFixed(true);
			buttons["player-chat"].setPosition(CHAT_X, CHAT_TOP + CHAT_HEIGHT * 0.5);

			elems["chat-input"].setPosition(0.35, 0.9).setDims(0.3, 0.05);

			buttons["player-chat"].setFixed(false).setLimits(CHAT_TOP + DIV_HEIGHT, CHAT_BOT - DIV_HEIGHT);

			buttons["submit chat"].setPosition(0.67, 0.925);

			labels["round timer title"].setPosition(0.815, 0.84);
			labels["round timer hourglass"].setPosition(0.845, 0.805);
			labels[constants.timers.ROUND].setPosition(0.91, 0.84);
			labels["move timer hourglass"].setPosition(0.92, 0.805);
			labels[constants.timers.MOVE].setPosition(0.957, 0.84);
		}

		// Set chats based on dividers
		for (var name of ["game-log", "player-chat"]) {
			elems[name].setPosition(CHAT_X, buttons[name].yy + DIV_HEIGHT);
		}
		elems["game-log"].setDims(CHAT_W, buttons["player-chat"].yy - elems["game-log"].yy);
		elems["player-chat"].setDims(CHAT_W, CHAT_BOT - elems["player-chat"].yy);
	} else {		
		const CHAT_X = 0.60;
		const CHAT_W = 0.35;
		const CHAT_TOP = 0.02;
		const CHAT_BOT = 0.90;
		const CHAT_HEIGHT = CHAT_BOT - CHAT_TOP;
		const DIV_HEIGHT = 0.025;

		if (buttons["demon-chat"].xx !== CHAT_X) buttons["demon-chat"].setPosition(CHAT_X, CHAT_TOP).setFixed(true);

		// Transitioning from demon to human
		if (buttons["game-log"].xx !== CHAT_X) {
			for (var name of ["game-log", "player-chat", "demon-chat"]) {
				buttons[name].setDims(CHAT_W, DIV_HEIGHT);
			}

			buttons["game-log"].setPosition(CHAT_X, CHAT_TOP).setFixed(true);
			buttons["player-chat"].setPosition(CHAT_X, CHAT_TOP + CHAT_HEIGHT * 0.5);

			elems["chat-input"].setPosition(0.6, CHAT_BOT).setDims(0.32, 0.05);	

			buttons["submit chat"].setPosition(0.935, 0.925);

			labels["move timer hourglass"].setPosition(0.28, 0.755);
			labels[constants.timers.MOVE].setPosition(0.32, 0.79);
			labels["round timer title"].setPosition(theTable.settings.turnOrder ? 0.3 : 0.26, 0.235);
			labels["round timer hourglass"].setPosition(0.295, 0.2);
			labels[constants.timers.ROUND].setPosition(0.365, 0.235);
		}

		if (thePlayerIsPossessed) {
			// Transitioning into possessed
			if (buttons["game-log"].yy === CHAT_TOP) {
				var playerHeightRatio = buttons["player-chat"].yy / CHAT_HEIGHT;
				buttons["game-log"].yy = 0.3;
				buttons["player-chat"].yy = 0.3 + (CHAT_HEIGHT - 0.3) * playerHeightRatio;
			}
			buttons["game-log"].setFixed(false).setLimits(CHAT_TOP + DIV_HEIGHT, buttons["player-chat"].yy - DIV_HEIGHT);
			buttons["player-chat"].setFixed(false).setLimits(buttons["game-log"].yy + DIV_HEIGHT, CHAT_BOT - DIV_HEIGHT);
		} else {
			// Transitioning out of possessed
			if (buttons["game-log"].yy !== CHAT_TOP) {
				var playerHeightRatio = (buttons["player-chat"].yy - buttons["game-log"].yy) / (CHAT_BOT - buttons["game-log"].yy);
				buttons["player-chat"].yy = CHAT_HEIGHT * playerHeightRatio;
				buttons["game-log"].setPosition(0.6, CHAT_TOP).setFixed(true);
			}
			buttons["player-chat"].setFixed(false).setLimits(CHAT_TOP + DIV_HEIGHT, CHAT_BOT - DIV_HEIGHT);
		}

		for (var name of ["demon-chat", "game-log", "player-chat"]) {
			elems[name].setPosition(CHAT_X, buttons[name].yy + DIV_HEIGHT);
		}
		elems["demon-chat"].setDims(CHAT_W, buttons["game-log"].yy - elems["demon-chat"].yy);
		elems["game-log"].setDims(CHAT_W, buttons["player-chat"].yy - elems["game-log"].yy);
		elems["player-chat"].setDims(CHAT_W, CHAT_BOT - elems["player-chat"].yy);
	}
	resizeElems();
}

/////////////////////// OVERLAY STUFF \\\\\\\\\\\\\\\\\\\

function enableOverlay(theOverlay) {
	overlay = theOverlay;
	switch(overlay) {
		case OVERLAY_POPUP:
			buttons["clear popup"].enable();
			break;
		case OVERLAY_HOWTO:
			drawGroups["howto"].enable();
			disableInputs();
			break;
		case OVERLAY_AVATAR:
			drawGroups["avatar selection"].enable();
			buttons["clear avatar"].enable();
			disableInputs();
			break;
		case OVERLAY_ACCEPT_DEMON:
			drawGroups["accept demon"].enable();
			break;
		case OVERLAY_SETTINGS:
			drawGroups["settings"].enable();
			for (var setting of Object.values(constants.items).concat(["order", "purify"])) {
				var set = theTable.settings.items[setting];
				switch(setting) {
					case "order":
						set = theTable.settings.turnOrder;
						break;
					case "purify":
						set = theTable.settings.waterPurify;
						break;
				}
				buttons[`${set ? "enable" : "disable"} ${setting}`].clicked = true;
			}
			disableInputs();
			break;
	}
}

function clearOverlay() {
	enableInputs();
	switch(overlay) {
		case OVERLAY_POPUP:
			buttons["clear popup"].disable();
			break;
		case OVERLAY_HOWTO:
			drawGroups["howto"].disable();
			break;
		case OVERLAY_AVATAR:
			drawGroups["avatar selection"].disable();
			buttons["clear avatar"].disable();
			break;
		case OVERLAY_ACCEPT_DEMON:
			drawGroups["accept demon"].disable();
			break;
		case OVERLAY_SETTINGS:
			drawGroups["settings"].disable();
			Cookies.set("table settings", theTable.settings);
			socket.emit("update settings", theTable.settings);
			break;
	}
	overlay = undefined;
}

function pageHowTo(inc) {
	howtoPage = (howtoPage + inc).mod(HOW_TO_PAGES);
}
*/
