function isTableOwner() {
	return theTable && theTable.players.length > 0 && theTable.players[0].id === playerId;
}

function getSelectedPlayer() {
	if (selectedPlayer) {
		for (var player of theTable.players) {
			if (player.name === selectedPlayer) {
				return player;
			}
		}
	}
}

function getPlayer(id) {
	return theTable.players.find(p => p.id === id);
}

function getPlayerByName(name) {
	return theTable.players.find(p => p.name.trim() === name.trim());
}

function getCurrentPlayer() {
	if (!theTable) return false;
	return theTable.players[theTable.currentPlayer]
}

function isCurrentPlayer() {
	return theTable && thePlayer === getCurrentPlayer();
}