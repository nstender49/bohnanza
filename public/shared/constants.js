(function(exports){

   exports.states = {
        INIT: "init",
        MAIN_MENU: "main menu",
        LOBBY: "lobby",
        PLANT_FIRST: "plant first",
        PLANT_SECOND: "plant second",
        TRADING: "trading",
        PLANT_TRADED: "plant traded",
        END: "game over",
    };

    exports.moves = {
        BEGIN: "BEGIN",
        MOVE_CARD: "MOVE CARD",
        CONFIRM_TRADE: "CONFIRM TRADE",
        CLEAR_TRADE: "CLEAR TRADE",
        DIG_FIELD: "DIG FIELD",
        PASS: "PASS",
    };

    exports.loc = {
        HAND: "HAND",
        PLANT: "PLANT",
        TRADE: "TRADE",
        FIELD: "FIELD",
        TABLE: "TABLE",
    }

    exports.PLAYER_COLORS = [
        "#fbb7c5",
        "#8dd304",
        "#0089cc",
        "#98178e",
        "#ed6e01",  
        "#a37e30",
        "#ed2c34",
        "#144c2a",
        "#0046b6",
        "#512246",
        "#fdc918", 
        "#4c270c",
        "#000000",
        "#ffffff",
    ];

    exports.AVATAR_COUNT = 50;


})(typeof exports === 'undefined'? this['constants']={}: exports);