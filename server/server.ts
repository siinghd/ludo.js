import { WebSocketServer } from 'ws';
import { LudoGame } from '../dist/index';
import { v4 as uuidv4 } from 'uuid';

const wss = new WebSocketServer({ port: 8080 });

const games: Record<string, { game: LudoGame; players: WebSocket[] }> = {};

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

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
          ws.send(
            JSON.stringify({ type: 'error', message: 'Invalid message type' })
          );
          break;
      }
    } catch (error) {
      ws.send(
        JSON.stringify({ type: 'error', message: 'Failed to process message' })
      );
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    handleDisconnect(ws);
  });
});

function handleCreateGame(ws, data) {
  const playerCount = data.playerCount || 4;
  const game = new LudoGame(playerCount);
  games[game.id] = { game, players: [ws] };
  ws.send(
    JSON.stringify({ type: 'gameCreated', gameId: game.id, playerIndex: 0 })
  );
  broadcastGameState(game.id);
}

function handleJoinGame(ws, data) {
  const gameId = data.gameId;
  const gameData = games[gameId];
  if (gameData) {
    const game = gameData.game;
    if (game.started) {
      ws.send(
        JSON.stringify({ type: 'error', message: 'Game has already started' })
      );
      return;
    }
    const playerIndex = gameData.players.length;
    gameData.players.push(ws);
    ws.send(JSON.stringify({ type: 'gameJoined', gameId, playerIndex }));
    if (gameData.players.length === game.getPlayers().length) {
      game.startGame();
      broadcastGameStart(gameId);
    } else {
      broadcastGameState(gameId);
    }
  } else {
    ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
  }
}

function handleRollDice(ws, data) {
  const gameId = data.gameId;
  const gameData = games[gameId];
  if (gameData) {
    const game = gameData.game;
    const playerIndex = gameData.players.indexOf(ws);
    if (!game.started) {
      ws.send(
        JSON.stringify({ type: 'error', message: 'Game has not started yet' })
      );
      return;
    }
    if (playerIndex === game.getGameState().currentTurn) {
      try {
        const diceValue = game.rollDice();
        broadcastGameState(game.id);
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', message: error.message }));
      }
    } else {
      ws.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
    }
  } else {
    ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
  }
}

function handleMovePiece(ws, data) {
  const gameId = data.gameId;
  const gameData = games[gameId];
  if (gameData) {
    const game = gameData.game;
    const playerIndex = gameData.players.indexOf(ws);
    if (playerIndex === game.getGameState().currentTurn) {
      const pieceIndex = data.pieceIndex;
      if (game.movePiece(playerIndex, pieceIndex)) {
        game.nextTurn();
        broadcastGameState(game.id);
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid move' }));
      }
    } else {
      ws.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
    }
  } else {
    ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
  }
}

function handleDisconnect(ws) {
  for (const gameId in games) {
    const gameData = games[gameId];
    const playerIndex = gameData.players.indexOf(ws);
    if (playerIndex !== -1) {
      gameData.players.splice(playerIndex, 1);
      if (gameData.players.length === 0) {
        delete games[gameId];
      } else {
        broadcastGameState(gameId);
      }
      break;
    }
  }
}

function broadcastGameStart(gameId: string) {
  const gameData = games[gameId];
  if (gameData) {
    const message = JSON.stringify({
      type: 'gameStart',
      gameState: gameData.game.getGameState(),
    });

    gameData.players.forEach((playerWs) => {
      if (playerWs.readyState === playerWs.OPEN) {
        playerWs.send(message);
      }
    });
  }
}

function broadcastGameState(gameId: string) {
  const gameData = games[gameId];
  if (gameData) {
    const gameState = gameData.game.getGameState();
    const message = JSON.stringify({
      type: 'gameState',
      gameState,
    });

    gameData.players.forEach((playerWs) => {
      if (playerWs.readyState === playerWs.OPEN) {
        playerWs.send(message);
      }
    });
  }
}

console.log('WebSocket server is running on ws://localhost:8080');
