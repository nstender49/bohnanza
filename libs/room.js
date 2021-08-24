var ENV = process.env.NODE_ENV || "dev";
var DEBUG = ENV === "dev";

var constants = require("../public/shared/constants");
var utils = require("../public/shared/utils");


class Room {
    constructor(io, code, settings) {
        this.io = io;
        this.code = code;
        this.sockets = {};
        this.socketToId = {};

        this.eventHandlers = {
            "leave table": this.leaveTable,
            "do move": this.handleMove,
            // "chat msg": this.sendMessage,
            "update settings": this.updateSettings,
            "update player settings": this.updatePlayer,
        };

        // Public data
        this.state = constants.states.LOBBY;
        this.round = 0;
        this.message = "";
        this.winners = [];

        this.players = [];
        this.tableCards = [];
        this.tableCardCommitted = [];

        // this.timers = {};

        // Private data
        this.deck = [];
        this.discard = [];
        this.hands = {};
        this.coins = {};
        this.tradePositions = {};
        this.currentPlayer = undefined;

        this._updateSettings(settings);

        // Chat
        // this.generalChat = [];
    }

    static makeCode() {
        // const charset = DEBUG ? String.fromCharCode('A'.charCodeAt() + Object.keys(this.rooms).length) : "ABCDEFGHIJKLMNOPQRSTUCWXYZ";
        const charset = DEBUG ? "A" : "ABCDEFGHIJKLMNOPQRSTUCWXYZ";
        // const charset = "ABCDEFGHIJKLMNOPQRSTUCWXYZ";
        const codeLen = 4;
        let code = "";
        for (var i = 0; i < codeLen; i++) {
            code += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return code;
    }

    static validatePlayer(socket, settings) {
        if (!settings) {
            socket.emit("server error", "Must provide player settings!");
            return false;
        }
        if (!settings.name) {
            socket.emit("server error", "Must provide player name!");
            return false;
        }
        if (!settings.name.match("^[\\d\\w\\s!]+$")) {
            socket.emit("server error", `Invalid name: '${settings.name.trim()}', alphanumeric only!`);
            return false;
        }
        return true;
    }

    addPlayer(socket, id, settings) {
        let player = this.getPlayer(id);
        if (!player) return this.addNewPlayer(socket, id, settings);
        else this.markPlayerActive(socket, player);
        return true;
    }

    addNewPlayer(socket, id, settings) {
        // Allow new player to replace existing, inactive player.
        let existing = this.players.find(p => p.name.toLowerCase().trim() === settings.name.toLowerCase().trim());
        if (existing && existing.active) {
            socket.emit("server error", `Player with name '${settings.name}' already exists at table ${this.code}`);
            return false;
        }
        if (existing) {
            // Need to replace any inflight id references here.
            this.markPlayerActive(socket, existing);
            return true;
        }

        // Otherwise, this is a truly new player.
        if (this.players.length >= this.settings.maxPlayers) {
            socket.emit("server error", `Table ${this.code} full!`);
            return false;
        }
        if (this.state !== constants.states.LOBBY) {
            socket.emit("server error", `Table ${this.code} game in progress!`);
            return false;
        }
        
        this.addSocket(socket, id);
        this.players.push({
            name: settings.name,
            // color: this.getAvailableColor(settings.color),
            // avatarId: (settings.avatarId || settings.avatarId === 0) ? settings.avatarId : Math.floor(Math.random() * constants.AVATAR_COUNT),
            id: id,
            active: true,
            fields: [[false, 0], [false, 0], false],
            plant: [],
            trade: {
                offer: [],
                ask: [],
                offerConfirmed: false,
                askConfirmed: false,
            },
            handSize: 0,
        });
        this.updateTable();
        // this.generalChat.map(l => socket.emit("chat msg", l.msg, l.sender));
        return true;
    }

    markPlayerActive(socket, player) {
        player.active = true;
        this.addSocket(socket, player.id);

        this.emitPlayerInfo(player.id);
        
        // Update public state
        this.updateTable();

        // Update chats
        // this.generalChat.map(l => this.emit(player.id, "chat msg", l.msg, l.sender));
    }

    /**
     * Removes a player the table. 
     * If a game is in progress, marks the player as inactive, otherwise removes player completely.
     * 
     * @param {socket}   Associated socket.
     * @param {uuid}     Player id  
     * @return {Boolean} True if player was removed from room, false otherwise.
     */
    removePlayer(socket, id) {
        let player = this.getPlayer(id);
        if (!player) return true;
        if (this.state === constants.states.LOBBY) return this.leaveTable(id);
        if (player.active) this.markPlayerInactive(player);
        return false;
    }

    leaveTable(id) {
        if (this.state !== constants.states.LOBBY) {
            this.emit(id, "server error", "Can not leave table while a game is in progress!");
            return false;
        }
        this.emit(id, "clear state");
        this.removeSocket(id);
        utils.removeByValue(this.players, this.players.find(p => p.id === id));
        this.updateTable();
        return true;
    }

    markPlayerInactive(player) {
        player.active = false;
        this.removeSocket(player.id);
        this.updateTable();
    }

    addSocket(socket, id) {
        this.sockets[id] = socket;
        this.socketToId[socket.id] = id;
        socket.join(this.code);
        Object.entries(this.eventHandlers).forEach(([event, callback]) => {
            socket.on(event, function(...args) { 
                const id = this.socketToId[socket.id];
                if (id) callback.bind(this)(id, ...args);
            }.bind(this));
        });
        this.emit(id, "player id", id);
        this.emit(id, "init settings", { code_version: process.env.npm_package_version });
    }

    removeSocket(id) {
        const socket = this.sockets[id];
        delete this.sockets[id];
        if (!socket) return;
        delete this.socketToId[socket.id];
        socket.leave(this.code);
        socket.emit("update state");
        Object.keys(this.eventHandlers).forEach(event => socket.removeAllListeners(event));
    }

    empty() {
        return this.players.length === 0;
    }

    active() {
        return this.players.reduce((acc, p) => acc || p.active, false);
    }

    updateTable() {
        // Send public data to the players.
        this.broadcast("update state", {
            // Settings
            settings: this.settings,
            code: this.code,
            // Game data
            state: this.state,
            round: this.round,
            players: this.players,
            deckSize: this.deck.length,
            topDiscard: this.discard[this.discard.length - 1],
            tableCards: this.tableCards,
            tableCardCommitted: this.tableCardCommitted,
            // Display data
            message: this.message,
            winners: this.winners,
            // Turn order
            currentPlayer: this.currentPlayer,
        });
    }

    emitPlayerInfo(id) {
        this.emit(id, "playerInfo", {
            hand: this.hands[id],
            coins: this.coins[id],
            tradePositions: this.getAllTradePositions(id),
        });
    }

    getAllTradePositions(id) {
        return this.isCurrentPlayer(id) ? [].concat(...Object.values(this.tradePositions[id] || [])) : this.tradePositions[id];
    }

    emit(id, event, ...args) {
        if (id in this.sockets) this.sockets[id].emit(event, ...args)
    }

    broadcast(...args) {
        this.io.to(this.code).emit(...args);
    }

    sendMessage(id, msg) {
	    this.broadcast("chat msg", msg, sender);
        this.generalChat.push({msg: msg, sender: sender});
    }

    clearChats() {
        this.broadcast("clear chat", "player-chat");
        this.broadcast("clear chat", "game-log");
        this.generalChat = [];
    }

    updatePlayer(id, settings) {
        let player = this.getPlayer(id);
        if (settings.color) player.color = this.getAvailableColor(settings.color);
        if (settings.avatarId) player.avatarId = settings.avatarId;
        this.updateTable();
    }

    updateSettings(id, settings) {
        if (!this.isOwner(id)) {
            this.emit(id, "server error", "Only owner can modify table settings!");
            return;
        }
        this._updateSettings(settings);
    }

    _updateSettings(settings) {
        this.settings = settings;
        this.updateTable();
    }

    handleMove(id, move) {
        let result = this.handlePlayerMove(id, move);
        if (result.advance) {
            this.advanceState();
        } else if (result.handled) {
            this.updateTable();
        } else {
            console.error(`Move not handled! State: ${this.state}, move: ${move}`);
        }
    }

    handlePlayerMove(id, move) {
        var result = {
            handled: false,
            advance: false,
        };

        // If we're in the lobby, all we can do is start the game.
        if (this.state === constants.states.LOBBY) {
            if (move.type !== constants.moves.BEGIN) return result;
            if (!this.isOwner(id)) return result;
            if (this.players.length < this.settings.minPlayers) {
                this.emit(id, "server error", `Cannot being game with less than ${this.settings.minPlayers} players!`);
                return result;
            }
            if (this.players.length > this.settings.maxPlayers) {
                this.emit(id, "server error", `Cannot being game with more than ${this.settings.maxPlayers} players!`);
                return result;
            }
            result.handled = true;
            result.advance = true;
            return result;
        }
        
        if (this.state === constants.states.END) {
            if (move.type !== constants.moves.FINISH || !this.isOwner(id)) return result;

            result.handled = true;
            result.advance = true;
            return result;     
        }
        
        switch(move.type) {
            case constants.moves.MOVE_CARD: {
                result.handled = this.moveCard(id, move);
                if (this.isCurrentPlayer(id) && [constants.states.PLANT_FIRST, constants.states.PLANT_SECOND].includes(this.state)) result.advance = result.handled;
                if (this.state === constants.states.PLANT_TRADED && this.players.reduce((acc, p) => acc + p.plant.length, 0) === 0) result.advance = true;
                break;
            }
            case constants.moves.DIG_FIELD: {
                result.handled = this.digField(id, move.field);
                break;
            }
            case constants.moves.CONFIRM_TRADE: {
                if (this.state !== constants.states.TRADING) return result;
                result.handled = this.handleTrade(id, move);
                break;
            }
            case constants.moves.CLEAR_TRADE: {
                if (this.state !== constants.states.TRADING) return result;
                result.handled = this.clearTrade(id, move);
                break;
            }
            case constants.moves.BUY_FIELD: {
                var player = this.getPlayer(id);
                if (!player.fields[2] && this.coins[id].length > 2) {
                    this.discard.push(...utils.pop(this.coins[id], 3));
                    player.fields[2] = [false, 0];
                    result.handled = true;
                }
                break;
            }
            case constants.moves.PASS: {
                // The current player may pass when planting a second card and when done trading.
                if (!this.isCurrentPlayer(id)) return result;
                if (this.state === constants.states.PLANT_SECOND || (this.state === constants.states.TRADING && this.tableCards.length === 0)) {
                    result.handled = true;
                    result.advance = true;
                }
                break;
            }
        }
        return result;
    }

    
    digField(id, fieldIndex) {
        var player = this.getPlayer(id);
        if (!player.fields[fieldIndex]) return false;
        var fieldValue, fieldCount;
        [fieldValue, fieldCount] = player.fields[fieldIndex];
        if (fieldCount === 0) return false;
        // If field to dig has 1 bean, check that no other field has more than one bean.
        if (fieldCount === 1 && player.fields.map(f => f ? f[1] : 0).some((count) => count > 1)) return false;

        var coinCount = this.getCoinCount(fieldValue, fieldCount);

        this.coins[id].push(...Array(coinCount).fill(fieldValue))
        this.discard.push(...Array(fieldCount - coinCount).fill(fieldValue))
        player.fields[fieldIndex] = [false, 0];

        this.emitPlayerInfo(id);

        return true;
    }

    getCoinCount(fieldValue, fieldCount) {
        var COIN_COUNTS = {
            4: [2, 2, 3, 4],
            6: [2, 2, 3],
            8: [2, 3, 4, 5],
            10: [2, 4, 5, 6],
            12: [2, 4, 6, 7],
            14: [3, 5, 6, 7],
            16: [3, 5, 7, 8],
            18: [3, 6, 8, 9],
            20: [4, 6, 8, 10],
            22: [4, 7, 9, 11],
            24: [4, 7, 10, 12],
        };
        for (var i = COIN_COUNTS[fieldValue].length - 1; i >= 0; i--) {
            if (fieldCount >= COIN_COUNTS[fieldValue][i]) return i + 1;
        }
        return 0;
    }

    getOrCreateTradePositions(id, otherId) {
        if (this.isCurrentPlayer(id)) {
            if (!this.tradePositions[id]) this.tradePositions[id] = {};
            if (!this.tradePositions[id][otherId]) this.tradePositions[id][otherId] = [];
            return this.tradePositions[id][otherId];
        } else {
            if (!this.tradePositions[id]) this.tradePositions[id] = []
            return this.tradePositions[id];
        }   
    }

    moveCard(id, move) {
        if (move.src === constants.loc.HAND && move.dest === constants.loc.FIELD) {
            if (!this.isCurrentPlayer(id)) return false;
            if (![constants.states.PLANT_FIRST, constants.states.PLANT_SECOND].includes(this.state)) return false;
            if (!this.moveCardToField(this.getPlayer(id).fields[move.destIndex], this.hands[id][0])) return false;
            this.hands[id].shift();
            this.getPlayer(id).handSize--;
        } else if (move.src === constants.loc.PLANT && move.dest === constants.loc.FIELD) {
            if (this.state !== constants.states.PLANT_TRADED) return false;
            var player = this.getPlayer(id);
            for (var idx of move.srcIndices) if (!player.plant[idx]) return false;
            for (var idx of move.srcIndices.sort((a, b) => b - a)) {
                if (!this.moveCardToField(player.fields[move.destIndex], player.plant[idx])) return false;
                player.plant.splice(idx, 1);
            }
        } else if (move.src === constants.loc.HAND && move.dest === constants.loc.TRADE) {
            if (!move.destIndex) return false;
            // Current player can not move into their own trade area, other players must.
            if (this.isCurrentPlayer(id) ? move.destIndex === id : move.destIndex !== id) return false;
            // If trade positions already has this card from hand, reject.
            var tradePositions = this.getOrCreateTradePositions(id, move.destIndex);
            for (var idx of move.srcIndices) {
                if (!this.hands[id][idx]) return false;
                if (this.getAllTradePositions(id).includes(idx)) return false;
            }
            var otherPlayer = this.getPlayer(move.destIndex);
            for (var idx of move.srcIndices) {
                // If trade positions already has this card from hand, reject.
                tradePositions.push(idx);
                if (this.isCurrentPlayer(id)) {
                    otherPlayer.trade.ask.push(this.hands[id][idx]);
                } else {
                    otherPlayer.trade.offer.push(this.hands[id][idx]);
                }
            }
            otherPlayer.trade.offerConfirmed = false;
            otherPlayer.trade.askConfirmed = false;
        } else if (move.src === constants.loc.TABLE && move.dest === constants.loc.TRADE) {
            if (!this.isCurrentPlayer(id) || !move.destIndex) return false;
            // Current player can not move into their own trade
            if (move.destIndex === id) return false;
            // If trade positions already has this card from hand, reject.
            var tradePositions = this.getOrCreateTradePositions(id, move.destIndex);
            for (var idx of move.srcIndices) {
                if (!this.tableCards[idx]) return false;
                if (this.getAllTradePositions(id).includes(idx - 2)) return false;
            }
            var otherPlayer = this.getPlayer(move.destIndex);
            for (var idx of move.srcIndices) {
                tradePositions.push(idx - 2);
                // Add to trade.
                otherPlayer.trade.ask.push(this.tableCards[idx]);
                this.tableCardCommitted[idx] = true;
            }
            otherPlayer.trade.offerConfirmed = false;
            otherPlayer.trade.askConfirmed = false;
        } else if (move.src === constants.loc.TABLE && move.dest === constants.loc.PLANT) {
            if (!this.isCurrentPlayer(id)) return false;
            for (var idx of move.srcIndices) if (!this.tableCards[idx]) return false;
            for (var idx of move.srcIndices) {
                this.getCurrentPlayer().plant.push(this.tableCards[idx])
                this.tableCards[idx] = false;
            }
            if (!this.tableCards[0] && !this.tableCards[1]) this.tableCards = [];
        } else if (move.src === constants.loc.TRADE) {
            if (!move.destIndex || !this.tradePositions[id]) return false;

            // Current player can not move into their own trade area, other players must.
            if (this.isCurrentPlayer(id) ? move.destIndex === id : move.destIndex !== id) return false;
            var tradePositions = this.getOrCreateTradePositions(id, move.destIndex);
            for (var idx of move.srcIndices) if (tradePositions[idx] === undefined) return false;
            // Remove the index from trade positions, and table commited cards if needed.
            var otherPlayer = this.getPlayer(move.destIndex);
            for (var idx of move.srcIndices.sort((a, b) => b - a)) {
                var index = tradePositions.splice(idx, 1)[0];
                if (index < 0) this.tableCardCommitted[index + 2] = false;
                if (this.isCurrentPlayer(id)) {
                    otherPlayer.trade.ask.splice(idx, 1);
                } else {
                    otherPlayer.trade.offer.splice(idx, 1);
                }
            }
            otherPlayer.trade.offerConfirmed = false;
            otherPlayer.trade.askConfirmed = false;
        } else {
            return false;
        }
        this.emitPlayerInfo(id);
        return true;
    } 

    moveCardToField(field, cardValue) {
        if (!field || !cardValue) return false;
        if (![cardValue, false].includes(field[0])) return false;
        // Add card to field
        field[0] = cardValue;
        field[1]++;
        return true;
    }

    handleTrade(id, move) {
        var currentPlayer = this.getCurrentPlayer();
        var otherPlayer = this.getPlayer(move.id);
        var trade = otherPlayer.trade;

        // Toggle trade confirmation
        if (id === currentPlayer.id) {
            // A player can not trade with themself, this should not be possible.
            if (id === move.id) return false;
            trade.askConfirmed = !trade.askConfirmed;
        } else {
            trade.offerConfirmed = !trade.offerConfirmed;
        }

        // If both sides haven't confirmed, we're done.
        if (!trade.askConfirmed || !trade.offerConfirmed) return true;

        // Execute the trade.
        currentPlayer.plant.push(...trade.offer);
        otherPlayer.plant.push(...trade.ask);

        // Remove the cards from the hands / table cards.
        for (var pos of this.getOrCreateTradePositions(currentPlayer.id, move.id).sort((a, b) => b - a)) {
            for (var [pId, otherPositions] of Object.entries(this.tradePositions[currentPlayer.id])) {
                if (pId === move.id) continue;
                otherPositions = otherPositions.map(x => x > pos ? x - 1 : x);
            }
            // Remove the card from the hand or table.
            if (pos >= 0) {
                this.hands[currentPlayer.id].splice(pos, 1);
                currentPlayer.handSize--;
            } else {
                // Table cards 0 and 1 are stored as -2 and -1.
                this.tableCards[pos + 2] = false;
                this.tableCardCommitted[pos + 2] = false;
                if (!this.tableCards[0] && !this.tableCards[1]) this.tableCards = [];
            }
        }
        // Remove cards from the hand of the other player.
        for (var pos of this.getOrCreateTradePositions(move.id).sort((a, b) => b - a)) {
            this.hands[otherPlayer.id].splice(pos, 1);
            otherPlayer.handSize--;
        }
        this.tradePositions[currentPlayer.id][move.id] = [];
        this.tradePositions[move.id] = [];

        trade.offer = [];
        trade.ask = [];
        trade.offerConfirmed = false;
        trade.askConfirmed = false;

        this.emitPlayerInfo(currentPlayer.id);
        this.emitPlayerInfo(otherPlayer.id);

        return true;
    }

    clearTrade(id, move) {
        var currentPlayer = this.getCurrentPlayer();
        var otherPlayer = this.getPlayer(move.id);
        var trade = otherPlayer.trade;

        if (currentPlayer.id === id) {
            for (var pos of this.getOrCreateTradePositions(currentPlayer.id, move.id)) {
                if (pos < 0) this.tableCardCommitted[pos + 2] = false;
            }
            this.tradePositions[id][move.id] = [];
            otherPlayer.trade.ask = [];
            this.emitPlayerInfo(currentPlayer.id);
        } else {
            this.tradePositions[move.id] = [];
            otherPlayer.trade.offer = [];
            this.emitPlayerInfo(otherPlayer.id);
        }
        trade.offerConfirmed = false;
        trade.askConfirmed = false;

        return true;
    }

    advanceState() {
        switch (this.state) {
            // Start game.
            case constants.states.LOBBY: {
                this.handleNewGame();
                this.message = "Player must plant first card.";
                this.state = constants.states.PLANT_FIRST;
                break;
            }
            case constants.states.PLANT_FIRST:
                if (this.hands[this.getCurrentPlayer().id].length === 0) {
                    this.message = "Players may trade with current player.";
                    this.state = constants.states.TRADING;
                } else {
                    this.message = "Player may plant second card.";
                    this.state = constants.states.PLANT_SECOND;
                }
                break;
            case constants.states.PLANT_SECOND: {
                this.message = "Players may trade with current player.";
                this.drawtableCards();
                this.state = constants.states.TRADING;
                break;
            } 
            case constants.states.TRADING: {
                this.message = "Plant traded cards.";
                this.cleanupTrades();
                this.state = constants.states.PLANT_TRADED;
                break;
            }
            case constants.states.PLANT_TRADED: {
                const player = this.getCurrentPlayer();
                this.drawCards(this.hands[player.id], 3);
                player.handSize = this.hands[player.id].length;
                this.emitPlayerInfo(player.id);
                if (this.deck.length === 0 && this.round === this.numRounds()) {
                    this.handleGameEnd();
                    this.state = constants.states.END;
                } else {
                    this.advanceCurrentPlayer();
                    if (this.hands[this.getCurrentPlayer().id].length === 0) {
                        this.message = "Players may trade with current player.";
                        this.state = constants.states.TRADING;
                    } else {
                        this.message = "Player must plant first card.";
                        this.state = constants.states.PLANT_FIRST;
                    }
                }
                break;
            }
            case constants.states.END: {
                this.clearTable();
                this.message = undefined;
                this.state = constants.states.LOBBY;
                break;
            }
        }
        this.updateTable();
    }

    handleGameEnd() {
        var maxCount = 0;
        var maxNames = [];
        for (var player of this.players) {
            for (var i = 0; i < 3; i++) {
                if (!player.fields[i]) continue;
                if (player.fields[i][0] && this.getCoinCount(player.fields[i][0], player.fields[i][1])) this.digField(player.id, i);
            }
            player.coinCount = this.coins[player.id].length;
            if (player.coinCount > maxCount) {
                maxCount = player.coinCount;
                maxNames = [player.name];
            } else if (player.coinCount === maxCount) {
                maxNames.push(player.name);
            }
        }
        this.winners = maxNames;
        this.message = `${maxNames.join(",")} win${maxNames.length === 1 ? "s" : ""}!`;
    }

    drawtableCards() {
        this.drawCards(this.tableCards, 2)
    }

    cleanupTrades() {
        this.tradePositions = {};
        for (var player of this.players) this.cleanupTrade(player);
        this.tableCardCommitted = [false, false];
    }

    cleanupTrade(player) {
        player.trade = {
            offer: [],
            ask: [],
            offerConfirmed: false,
            askConfirmed: false,
        };
        this.emitPlayerInfo(player.id);
    }

    clearTable() {
        for (var player of this.players) {
            this.coins[player.id] = []
            this.hands[player.id] = []
            player.handSize = 0;
            player.fields = [[false, 0], [false, 0], false]
            player.plant = []
            this.emitPlayerInfo(player.id);
        }
    }

    handleNewGame() {
        this.createDeck();
        this.coins = {};
        this.hands = {};

        // Clear chat logs
        // this.clearChats();

        this.round = 1;
        // this.currentPlayer = Math.floor(Math.random() * this.players.length);
        this.currentPlayer = 0;
        this.winners = [];

        // For 5 players or less, hand size is 5, otherwise, it starts with 3 and goes to 6.
        var handSize = this.players.length > 5 ? 3 : 5;
        for (var i = 0; i < this.players.length; i++) {
            var player = this.getCurrentPlayer();
            this.coins[player.id] = []
            this.hands[player.id] = []
            this.drawCards(this.hands[player.id], handSize)
            player.handSize = handSize;
            player.fields = [[false, 0], [false, 0], false]
            player.plant = []

            this.emitPlayerInfo(player.id);
 
            this.advanceCurrentPlayer()
            handSize = this.players.length > 5 ? Math.min(handSize + 1, 6) : 5;
        }
    }

    drawCards(hand, numCards) {
        if (this.deck.length < numCards) this.addDiscard();
        hand.push(...utils.pop(this.deck, numCards))
    }

    createDeck() {
        const min = this.players.length === 3 ? 3 : this.players.length < 6 ? 2 : 4;
        const max = this.players.length > 3 && this.players.length < 6 ? 11 : 12;
        this.deck = this.shuffle(
            //[].concat(...[...Array(max - min + 1).keys()].map(i => (i + min) * 2).map(i => Array(i).fill(i)))
            [].concat(...[...Array(max - min + 1).keys()].map(i => (i + min) * 2).map(i => Array(3).fill(i)))
        );
        // this.deck = [].concat(...[...Array(max - min + 1).keys()].map(i => (i + min) * 2).map(i => Array(i).fill(i)));
    }

    addDiscard() {
        if (this.round === this.numRounds()) return;
        this.round++;
        var remainder = this.deck;
        this.deck = this.shuffle(this.discard)
        this.deck.push(...remainder);
        this.discard = [];
    }

    shuffle(array) {
        var currentIndex = array.length,  randomIndex;
        while (currentIndex != 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
        return array;
    }

    ////////// Helpers \\\\\\\\\\

    numRounds() {
        return this.players.length == 3 ? 2 : 3;
    }

    getPlayer(id) {
        return this.players.find(p => p.id === id);
    }

    isOwner(id) {
        return this.players.length > 0 && this.players[0].id === id;
    }

    isCurrentPlayer(id) {
        return this.getCurrentPlayer().id === id;
    }

    getCurrentPlayer() {
        return this.players[this.currentPlayer];
    }

    advanceCurrentPlayer() {
        this.currentPlayer = (this.currentPlayer + 1).mod(this.players.length);
    }

    getAvailableColor(perference) {
        const tableColors = this.players.map(p => p.color);
        if (perference && !tableColors.includes(perference)) return perference;
        return constants.PLAYER_COLORS.find(c => !tableColors.includes(c));
    }
}

Number.prototype.mod = function(n) {
	return ((this % n) + n) % n;
}

module.exports = Room;