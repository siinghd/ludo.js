"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ws_1 = require("ws");
var index_1 = require("../dist/index");
var wss = new ws_1.WebSocketServer({ port: 8080 });
var games = {};
wss.on('connection', function (ws) {
    console.log('New client connected');
    ws.on('message', function (message) {
        try {
            var data = JSON.parse(message.toString());
            switch (data.type) {
                case 'createGame':
                    handleCreateGame(ws, data);
                    break;
                case 'joinGame':
                    handleJoinGame(ws, data);
                    break;
                case 'rollDice':
                    handleRollDice(ws, data);
                    break;
                case 'movePiece':
                    handleMovePiece(ws, data);
                    break;
                default:
                    ws.send(JSON.stringify({ type: 'error', message: 'Invalid message type' }));
                    break;
            }
        }
        catch (error) {
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to process message' }));
        }
    });
    ws.on('close', function () {
        console.log('Client disconnected');
        handleDisconnect(ws);
    });
});
function handleCreateGame(ws, data) {
    var playerCount = data.playerCount || 4;
    var game = new index_1.LudoGame(playerCount);
    games[game.id] = { game: game, players: [ws] };
    ws.send(JSON.stringify({ type: 'gameCreated', gameId: game.id, playerIndex: 0 }));
    broadcastGameState(game.id);
}
function handleJoinGame(ws, data) {
    var gameId = data.gameId;
    var gameData = games[gameId];
    if (gameData) {
        var game = gameData.game;
        if (game.started) {
            ws.send(JSON.stringify({ type: 'error', message: 'Game has already started' }));
            return;
        }
        var playerIndex = gameData.players.length;
        gameData.players.push(ws);
        ws.send(JSON.stringify({ type: 'gameJoined', gameId: gameId, playerIndex: playerIndex }));
        if (gameData.players.length === game.getPlayers().length) {
            game.startGame();
            broadcastGameStart(gameId);
        }
        else {
            broadcastGameState(gameId);
        }
    }
    else {
        ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
    }
}
function handleRollDice(ws, data) {
    var gameId = data.gameId;
    var gameData = games[gameId];
    if (gameData) {
        var game = gameData.game;
        var playerIndex = gameData.players.indexOf(ws);
        if (!game.started) {
            ws.send(JSON.stringify({ type: 'error', message: 'Game has not started yet' }));
            return;
        }
        if (playerIndex === game.getGameState().currentTurn) {
            try {
                var diceValue = game.rollDice();
                broadcastGameState(game.id);
            }
            catch (error) {
                ws.send(JSON.stringify({ type: 'error', message: error.message }));
            }
        }
        else {
            ws.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
        }
    }
    else {
        ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
    }
}
function handleMovePiece(ws, data) {
    var gameId = data.gameId;
    var gameData = games[gameId];
    if (gameData) {
        var game = gameData.game;
        var playerIndex = gameData.players.indexOf(ws);
        if (playerIndex === game.getGameState().currentTurn) {
            var pieceIndex = data.pieceIndex;
            if (game.movePiece(playerIndex, pieceIndex)) {
                game.nextTurn();
                broadcastGameState(game.id);
            }
            else {
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid move' }));
            }
        }
        else {
            ws.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
        }
    }
    else {
        ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
    }
}
function handleDisconnect(ws) {
    for (var gameId in games) {
        var gameData = games[gameId];
        var playerIndex = gameData.players.indexOf(ws);
        if (playerIndex !== -1) {
            gameData.players.splice(playerIndex, 1);
            if (gameData.players.length === 0) {
                delete games[gameId];
            }
            else {
                broadcastGameState(gameId);
            }
            break;
        }
    }
}
function broadcastGameStart(gameId) {
    var gameData = games[gameId];
    if (gameData) {
        var message_1 = JSON.stringify({
            type: 'gameStart',
            gameState: gameData.game.getGameState(),
        });
        gameData.players.forEach(function (playerWs) {
            if (playerWs.readyState === playerWs.OPEN) {
                playerWs.send(message_1);
            }
        });
    }
}
function broadcastGameState(gameId) {
    var gameData = games[gameId];
    if (gameData) {
        var gameState = gameData.game.getGameState();
        var message_2 = JSON.stringify({
            type: 'gameState',
            gameState: gameState,
        });
        gameData.players.forEach(function (playerWs) {
            if (playerWs.readyState === playerWs.OPEN) {
                playerWs.send(message_2);
            }
        });
    }
}
console.log('WebSocket server is running on ws://localhost:8080');
