function drawTable() {
	// Check table still exists, in case we have left the table.
	if (!theTable) return;
	
	highlightLocations();

	// Draw table
	const padWidth = 0.25;
	const padHeight = 0.4;

	// Draw deck, discard, and table cards 
	if (![constants.states.LOBBY].includes(gameState)) drawPlayerConsole(padWidth, padHeight);

	// Draw player's hand
	drawImage(IMAGES[COIN_STACK], 0.01, padHeight * 2.1, false, (1 - padHeight * 2) * 0.4);
	drawText(`x${coins.length}`, 0.075, padHeight * 2.25, 30, "center", false, 0.2);
	drawText(theTable.message, 0.1, padHeight * 1.975, 15, "left", false, 0.3);
	handButton.setPosition(0.1, padHeight * 2).setDims(0.8, 1 - padHeight * 2).setBorder(isCurrentPlayer() ? "green" : "white").draw();
	if (hand) drawCardRow(hand, 0.1, padHeight * 2, 0.8, 1 - padHeight * 2, tradePositions);

	// Draw the rest of the players.
	drawPlayers(padWidth, padHeight);
}

function drawPlayerConsole(padW, padH) {
	drawCard(theTable.topDiscard, padW * 1.1, padH * 1.1, padH * 0.4);
	drawCard(CARD_BACK, padW * 1.4, padH * 1.1, padH * 0.4);
	drawText(`Round ${theTable.round}`, padW * 1.8, padH * 1.2, 20, "center", false, padH * 0.15);
	drawText(`x${theTable.deckSize}`, padW * 1.8, padH * 1.4, 30, "center", false, padH * 0.2);
	if (isCurrentPlayer()) {
		drawCard(false, padW * 1.5, padH * 1.5, padH * 0.4);
		for (var i = 0; i < 2; i++) {
			var xPos = padW * (1.2 + 0.3 * i);
			var yPos = padH * 1.5;
			var h = padH * 0.4;
			drawCard(false, xPos, yPos, h);
			tableCardButtons[i].on_img = CARDS[theTable.tableCards[i]];
			tableCardButtons[i].setPosition(xPos, yPos + h * 0.05 * (theTable.tableCardCommitted[i] ? 3 : 1)).setDims(false, h * 0.9).setOutline(!theTable.tableCards[i]).draw();
		}
	} else {
		drawCard(theTable.tableCards[0], padW * 1.2, padH * 1.5, padH * 0.4);
		drawCard(theTable.tableCards[1], padW * 1.5, padH * 1.5, padH * 0.4);
	}
	// Draw player's fields and trading area.
	drawFields(thePlayer, padW * 2, padH, padW, padH * 0.4);
	drawTradingArea(thePlayer, padW * 2, padH * 1.4, padW, padH * 0.55);
}

function drawPlayers(padW, padH) {
	if (!theTable.players) return;
	var numOpponents = theTable.players.length - 1;
	var positions = []
	switch(numOpponents) {
		case 0:
			return;
		case 1:
			positions = [
				[0.5 - padW / 2, 0],
			];
			break;
		case 2:
			positions = [
				 [0, 0],
				 [1 - padW, 0],
			];
			break;
		case 3:
			positions = [
				[0, padH / 2],
				[0.5 - padW / 2, 0],
				[1 - padW, padH / 2],
			];
			break;
		case 4:
			topGap = getGap(padW, 1 - padW * 2, 2);
			positions = [
				[0, padH], 
				[padW + topGap, 0], 
				[(padW + topGap) * 2, 0], 
				[1 - padW, padH],
			];
			break;
		case 5:
			var topGap = getGap(padW, 1, 3);
			positions = [
				[0, padH],
				[topGap, 0], 
				[topGap * 2 + padW, 0],
				[topGap * 3 + padW * 2, 0],
				[1 - padW, padH],
			];
			break;
		case 6:
			var topGap = getGap(padW, 1, 4);
			positions = [
				[0, padH],
				[topGap, 0], 
				[topGap * 2 + padW, 0],
				[topGap * 3 + padW * 2, 0],
				[topGap * 4 + padW * 3, 0],
				[1 - padW, padH],
			]; 
			break;
		default:
			return;
	}
	playerIndex = theTable.players.indexOf(thePlayer) + 1;
	for (var pos of positions) {
		drawPlayer(playerIndex.mod(theTable.players.length), pos[0], pos[1], padW, padH);
		playerIndex++;
	}
}

function getGap(elemW, totalW, num) {
	return (totalW - elemW * num) / (num + 1);
}


function drawPlayer(index, x, y, padW, padH) {
	var player = theTable.players[index];

	var rowHeight = padH * 0.2;
	var borderColor = "white";
	drawText(player.name, x + padW * 0.05, y + rowHeight * 0.7, 30, "left", false, padW * 0.6);
	if (gameState === constants.states.END) {
		if (theTable.winners.includes(player.name)) borderColor = "gold";
		drawImage(IMAGES[COIN_STACK], x + padW * 0.7, y + rowHeight * 0.2, false, rowHeight * 0.6);
		drawText(`x${player.coinCount}`, x + padW * 0.875, y + rowHeight * 0.7, 30, "center", false, padW * 0.1);
	} else {
		if (index == theTable.currentPlayer) borderColor = "green";
		drawCard(CARD_BACK, x + padW * 0.7, y + rowHeight * 0.1, rowHeight * 0.8);
		drawText(`x${player.handSize}`, x + padW * 0.875, y + rowHeight * 0.7, 30, "center", false, padW * 0.1);
	}

	drawFields(player, x, y + padH * 0.2, padW, padH * 0.4);
	drawTradingArea(player, x, y + padH * 0.6, padW, padH * 0.4);
	drawRect(undefined, x, y, padW, padH, false, borderColor);
}

function drawTradingArea(player, x, y, w, h) {
	// drawRect("#d4aa78", x, y, w * 0.4, h, false, "white");
	// drawRect("#d4aa78", x + w * 0.4, y, w * 0.4, h, false, "white");
	// drawRect("#d4aa78", x + w * 0.8, y, w * 0.2, h, false, "white");

	plantButton.setPosition(x + w * 0.8, y).setDims(w * 0.2, h).show().draw();
	if (player === thePlayer) {
		tradeButtons[player.id].setPosition(x, y).setDims(w * 0.4, h).show().draw();
		drawImage(IMAGES[TRADE_PAD_IN], x + w * 0.4, y, w * 0.4, h);
		drawRect(false, x + w * 0.4, y, w * 0.4, h, false, "white");
	} else {
		drawImage(IMAGES[TRADE_PAD_IN], x, y, w * 0.4, h);
		drawRect(false, x, y, w * 0.4, h, false, "white");
		tradeButtons[player.id].setPosition(x + w * 0.4, y).setDims(w * 0.4, h).show().draw();
	}
	if (player === thePlayer && isCurrentPlayer()) {
		if (theTable.state === constants.states.PLANT_SECOND || theTable.state === constants.states.TRADING && theTable.tableCards.length === 0) buttons["pass"].enable().draw(); 
		drawCardColumn(plantCards, x + w * 0.8, y, w * 0.2, h);
	} else {
		if (player === thePlayer) {
			tradeButtons[player.id].setPosition(x, y).setDims(w * 0.4, h).show().draw();
			drawCardColumn(offerCards, x, y, w * 0.2, h);
			drawCardColumn(plantCards, x + w * 0.8, y, w * 0.2, h);
			drawCardColumn(player.trade.ask, x + w * 0.6, y, w * 0.2, h);
		} else if (isCurrentPlayer()) {
			drawCardColumn(player.trade.offer, x, y, w * 0.2, h);
			drawCardColumn(askCards[player.id], x + w * 0.6, y, w * 0.2, h);
			drawCardColumn(player.plant, x + w * 0.8, y, w * 0.2, h);
		} else if (player === getCurrentPlayer()) {
			drawCardColumn(thePlayer.trade.ask, x, y, w * 0.2, h);
			drawCardColumn(thePlayer.trade.offer, x + w * 0.6, y, w * 0.2, h);
			drawCardColumn(player.plant, x + w * 0.8, y, w * 0.2, h);
		} else {
			drawCardColumn(player.trade.offer, x, y, w * 0.2, h);
			drawCardColumn(player.trade.ask, x + w * 0.6, y, w * 0.2, h);
			drawCardColumn(player.plant, x + w * 0.8, y, w * 0.2, h);
		}
		buttons[`confirm ${player.id}`].setPosition(x + w * 0.4, y + h * 0.35).setDims(w * 0.1).draw();
		buttons[`clear ${player.id}`].setPosition(x + w * 0.4, y + h * 0.65).setDims(w * 0.1).draw();
	}
}

function drawFields(player, x, y, w, h) {
	offset = w * 0.05;
	for (var i = 0; i < 3; i++) {
		if (!player.fields[i]) var [fieldValue, fieldCount] = ["FIELD 3 DASH", 0];
		else if (player.fields[i][0]) var [fieldValue, fieldCount] = player.fields[i];
		else var [fieldValue, fieldCount] = [`FIELD ${i+1}`, 0];
		if (player === thePlayer) {
			if (fieldCount > 0 && (fieldCount > 1 || !player.fields.map(f => f ? f[1] : 0).some((count) => count > 1))) buttons[`dig ${i}`].enable();
			if (fieldValue && fieldCount > 0) buttons[`dig ${i}`].setText(`x${fieldCount}`).setPosition(x + offset + w * 0.25, y + h * 0.55).setDims(false, 0.03).show().draw();
			fieldButtons[i].on_img = CARDS[fieldValue];
			fieldButtons[i].setPosition(x + offset, y + h * 0.1).setDims(false, h * 0.8).draw();
		} else {
			if (fieldValue && fieldCount > 0) drawText(`x${fieldCount}`, x + offset + w * 0.25, y + h * 0.55, 20, "center", false, w * 0.075);
			drawCard(fieldValue, x + offset, y + h * 0.1, h * 0.8);
		}
		offset += w * 0.3;
	}
}

function drawCardColumn(cards, x, y, w, h) {
	if (!cards || cards.length === 0) return;
	var dims = new ImageLabel(CARDS[CARD_BACK]).setDims(w * 0.9, false).dims();
	cardHeight = dims.height / cvH;
	cardWidth = dims.width / cvW;
	// Gap between cards is either MIN_GAP * cardWidth, or negative to stack cards if there are too many.
	var minGap = cardHeight * 0.1;
	var gapWidth = Math.min(minGap, (h - 2 * minGap - cards.length * cardHeight) / (cards.length - 1));
	for (var i = 0; i < cards.length; i++) {
		yPos = y + h / 2 - ((cards.length - 1) / 2 * gapWidth) - (cards.length  / 2 * cardHeight) + (cardHeight + gapWidth) * i;
		xPos = x + w * 0.05;
		if (cards[i] instanceof ImageButton) {
			cards[i].setPosition(xPos, yPos).setDims(cardWidth * 0.9).setLayer(i).draw();
		} else {
			drawCard(cards[i], xPos, yPos, cardHeight * 0.9);
		}
	}
}

function drawCardRow(cards, x, y, w, h, offsetIndices) {
	if (!cards || cards.length === 0) return;
	var dims = new ImageLabel(CARDS[CARD_BACK]).setDims(false, h * 0.9).dims();
	cardHeight = dims.height / cvH;
	cardWidth = dims.width / cvW;
	// Gap between cards is either MIN_GAP * cardWidth, or negative to stack cards if there are too many.
	var minGap = cardWidth * 0.1;
	var gapWidth = Math.min(minGap, (w - 2 * minGap - cards.length * cardWidth) / (cards.length - 1));
	for (var i = cards.length - 1; i >= 0; i--) {
		xPos = x + w / 2 - ((cards.length - 1) / 2 * gapWidth) - (cards.length  / 2 * cardWidth) + (cardWidth + gapWidth) * i;
		yPos = y + h * 0.05 * (offsetIndices.includes(i) ? 3 : 1);
		// yPos = y + h * 0.05;
		cards[i].setPosition(xPos, yPos).setDims(false, cardHeight * 0.9).draw(); 
	}
}

function drawCard(card, x, y, h) {
	if (card) {
		drawImage(CARDS[card], x, y + h * 0.05, undefined, h * 0.9);
	} else {
		var dims = new ImageLabel(CARDS[CARD_BACK]).setDims(false, h * 0.9).dims();
		drawRect(false, x, y + h * 0.05, dims.width / cvW, dims.height / cvH, false, "white");
	}
}

function highlightLocations() {
	getLocationButtons().map(b => b.setHighlighted(false).disable().show());
	if (!thePlayer.fields[2] && coins.length > 2) fieldButtons[2].enable();
	if (thePlayer.fields[2] && fieldButtons[2].doubleCallback) fieldButtons[2].callback = fieldButtons[2].doubleCallback; fieldButtons[2].doubleCallback = undefined;
	if (clickedCards.length === 0) return;

	var toEnable = []
	switch (gameState) {
		case constants.states.PLANT_FIRST:
		case constants.states.PLANT_SECOND:
			if (isCurrentPlayer()) {
				toEnable.push(...getMatchingFields(hand[clickedCards[0]].value).map(idx => fieldButtons[idx]));
			} else if (clickedOrigin === constants.loc.HAND) toEnable.push(tradeButtons[thePlayer.id]);
			else if (clickedOrigin === constants.loc.TRADE) toEnable.push(handButton);
			break;
		case constants.states.TRADING:
			if (isCurrentPlayer()) {
				if (clickedOrigin === constants.loc.TABLE) {
					toEnable.push(plantButton);
					toEnable.push(...theTable.players.filter(p => p !== thePlayer).map(p => tradeButtons[p.id]));
				} else if (clickedOrigin === constants.loc.HAND) {
					toEnable.push(...theTable.players.filter(p => p !== thePlayer).map(p => tradeButtons[p.id]));
				} else if (clickedOrigin === constants.loc.TRADE) {
					toEnable.push(handButton);
					// TODO: need a way to return table cards.
				}
			} else {
				if (clickedOrigin === constants.loc.HAND) {
					toEnable.push(tradeButtons[thePlayer.id]);
				} else if (clickedOrigin === constants.loc.TRADE) {
					toEnable.push(handButton);
				}
			}
			break;
		case constants.states.PLANT_TRADED:
			var clickedValues = new Set(clickedCards.map(idx => thePlayer.plant[idx]));
			if (clickedValues.size > 1) return;
			toEnable.push(...getMatchingFields(thePlayer.plant[clickedCards[0]]).map(idx => fieldButtons[idx]));
			break;
	}
	toEnable.forEach(b => b.setHighlighted(true).enable());
}