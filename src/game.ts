import Player from './player';
import { rollDice, isSafePosition, generateSafePositions } from './utils';
import EventEmitter from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';

interface GameState {
  id: string;
  players: Player[];
  currentTurn: number;
  winners: number[];
  started: boolean;
  lastDiceValue: number | null;
  awaitingPieceSelection: boolean;
}

export default class LudoGame extends EventEmitter {
  public id: string;
  private playerCount: number;
  private boardSize: number;
  private players: Player[];
  private currentTurn: number;
  private safePositions: Set<number>;
  private winPosition: number;
  private lastSafePositionsCount: number;
  private winners: number[];
  private turnsInARow: number;
  private lastDiceValue: number | null;
  public started: boolean;
  public awaitingPieceSelection: boolean;

  constructor(playerCount: number) {
    super();
    this.id = uuidv4();
    if (playerCount < 2 || playerCount > 24) {
      throw new Error('Player count must be between 2 and 24.');
    }
    this.playerCount = playerCount;
    this.boardSize = playerCount * 13; // Adjusting board size for more players
    this.players = this.initializePlayers(playerCount);
    this.currentTurn = 0;
    this.safePositions = generateSafePositions(playerCount, this.boardSize);
    this.winPosition = this.boardSize - 1;
    this.lastSafePositionsCount = 6;
    this.winners = [];
    this.turnsInARow = 0;
    this.lastDiceValue = null;
    this.started = false;
    this.awaitingPieceSelection = false;
  }

  private initializePlayers(playerCount: number): Player[] {
    const players: Player[] = [];
    for (let i = 0; i < playerCount; i++) {
      players.push(new Player(i, this.boardSize / playerCount));
    }
    return players;
  }

  public rollDice(): number {
    if (this.awaitingPieceSelection) {
      throw new Error('Player must select a piece to move');
    }
    const value = rollDice();
    this.lastDiceValue = value;
    this.emit('diceRolled', this.currentTurn, value);

    if (
      value === 6 &&
      this.players[this.currentTurn].pieces.some((p) => p === -1)
    ) {
      this.awaitingPieceSelection = true;
    }

    return value;
  }

  public movePiece(playerId: number, pieceIndex: number): boolean {
    const player = this.players[playerId];
    if (!player) throw new Error('Invalid player ID');
    if (!this.lastDiceValue) throw new Error('Dice not rolled yet');
    const piecePosition = player.pieces[pieceIndex];
    let newPosition: number;

    if (piecePosition === -1) {
      if (this.lastDiceValue === 6) {
        newPosition = player.startPosition;
        this.awaitingPieceSelection = false;
      } else {
        return false;
      }
    } else {
      newPosition = piecePosition + this.lastDiceValue;
    }

    if (newPosition > this.winPosition) {
      return false;
    } else if (newPosition === this.winPosition) {
      player.pieces[pieceIndex] = newPosition;
      player.homeCount += 1;
      if (player.homeCount === 4 && !this.winners.includes(playerId)) {
        this.winners.push(playerId);
        this.emit('playerWon', playerId, this.winners.length);
      }
      return true;
    }

    for (const otherPlayer of this.players) {
      if (otherPlayer.id !== playerId) {
        for (let i = 0; i < otherPlayer.pieces.length; i++) {
          if (
            otherPlayer.pieces[i] === newPosition &&
            !isSafePosition(
              newPosition,
              this.safePositions,
              this.winPosition,
              this.lastSafePositionsCount
            )
          ) {
            otherPlayer.pieces[i] = -1;
            this.emit('pieceCaptured', otherPlayer.id, i);
          }
        }
      }
    }

    player.pieces[pieceIndex] = newPosition;
    return true;
  }

  public nextTurn(): void {
    if (this.winners.length === this.playerCount) {
      this.emit('gameOver', this.winners);
      return;
    }

    if (!this.awaitingPieceSelection) {
      if (this.turnsInARow < 2 && this.lastDiceValue === 6) {
        this.turnsInARow += 1;
      } else {
        this.turnsInARow = 0;
        do {
          this.currentTurn = (this.currentTurn + 1) % this.playerCount;
        } while (this.winners.includes(this.currentTurn));
      }

      this.emit('turnChanged', this.currentTurn);
    }
  }

  public getGameState(): GameState {
    return {
      id: this.id,
      players: this.players,
      currentTurn: this.currentTurn,
      winners: this.winners,
      started: this.started,
      lastDiceValue: this.lastDiceValue,
      awaitingPieceSelection: this.awaitingPieceSelection,
    };
  }

  public startGame(): void {
    this.started = true;
  }

  public getPlayers(): Player[] {
    return this.players;
  }

  public addPlayer(): void {
    if (this.players.length >= 24) {
      throw new Error('Cannot add more than 24 players.');
    }
    const newPlayerId = this.players.length;
    this.players.push(
      new Player(newPlayerId, this.boardSize / this.playerCount)
    );
    this.emit('playerAdded', newPlayerId);
  }

  public removePlayer(playerId: number): void {
    this.players = this.players.filter((player) => player.id !== playerId);
    this.emit('playerRemoved', playerId);
  }

  public saveGameState(): string {
    return JSON.stringify(this.getGameState());
  }

  public loadGameState(state: string): void {
    const {
      id,
      players,
      currentTurn,
      winners,
      started,
      lastDiceValue,
      awaitingPieceSelection,
    } = JSON.parse(state);
    this.id = id;
    this.players = players;
    this.currentTurn = currentTurn;
    this.winners = winners;
    this.started = started;
    this.lastDiceValue = lastDiceValue;
    this.awaitingPieceSelection = awaitingPieceSelection;
    this.emit('gameStateLoaded');
  }
}
