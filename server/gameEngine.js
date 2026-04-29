// Server-side game logic
function checkWin(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
    [0, 4, 8], [2, 4, 6]             // diags
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a, b, c] };
    }
  }
  return null;
}

function checkDraw(board) {
  return board.every(cell => cell !== null);
}

function isValidMove(board, index) {
  return index >= 0 && index < 9 && board[index] === null;
}

class GameRoom {
  constructor(roomCode, hostId, hostSocket) {
    this.roomCode = roomCode;
    this.board = Array(9).fill(null);
    this.players = [{ id: hostId, socket: hostSocket, symbol: 'X' }];
    this.currentTurn = 'X';
    this.status = 'waiting'; // waiting, playing, finished
    this.moveTimer = null;
    this.moveTimeout = 30000; // 30 seconds per move
    this.createdAt = Date.now();
  }

  addPlayer(playerId, playerSocket) {
    if (this.players.length >= 2) return false;
    this.players.push({ id: playerId, socket: playerSocket, symbol: 'O' });
    this.status = 'playing';
    return true;
  }

  makeMove(playerId, index) {
    if (this.status !== 'playing') return { error: 'Game not in progress' };

    const player = this.players.find(p => p.id === playerId);
    if (!player) return { error: 'Player not in this room' };
    if (player.symbol !== this.currentTurn) return { error: 'Not your turn' };
    if (!isValidMove(this.board, index)) return { error: 'Invalid move' };

    this.board[index] = player.symbol;

    // Clear move timer
    if (this.moveTimer) {
      clearTimeout(this.moveTimer);
      this.moveTimer = null;
    }

    // Check win
    const winResult = checkWin(this.board);
    if (winResult) {
      this.status = 'finished';
      return {
        success: true,
        board: [...this.board],
        gameOver: true,
        winner: playerId,
        winnerSymbol: player.symbol,
        winLine: winResult.line
      };
    }

    // Check draw
    if (checkDraw(this.board)) {
      this.status = 'finished';
      return {
        success: true,
        board: [...this.board],
        gameOver: true,
        draw: true
      };
    }

    // Switch turn
    this.currentTurn = this.currentTurn === 'X' ? 'O' : 'X';

    return {
      success: true,
      board: [...this.board],
      gameOver: false,
      nextTurn: this.currentTurn
    };
  }

  reset() {
    this.board = Array(9).fill(null);
    this.currentTurn = 'X';
    this.status = 'playing';
    // Swap symbols for fairness
    this.players.forEach(p => {
      p.symbol = p.symbol === 'X' ? 'O' : 'X';
    });
    if (this.moveTimer) clearTimeout(this.moveTimer);
  }

  getPlayerBySocket(socketId) {
    return this.players.find(p => p.socket === socketId);
  }

  removePlayer(socketId) {
    this.players = this.players.filter(p => p.socket !== socketId);
    if (this.status === 'playing') this.status = 'finished';
  }
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

module.exports = { checkWin, checkDraw, isValidMove, GameRoom, generateRoomCode };
