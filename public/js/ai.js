class TicTacToeAI {
  constructor(difficulty = 'easy') {
    this.difficulty = difficulty; // 'easy', 'medium', 'hard'
  }

  // Returns index 0-8 for the chosen move
  getBestMove(board, aiSymbol) {
    const humanSymbol = aiSymbol === 'X' ? 'O' : 'X';
    
    // Easy: Completely random
    if (this.difficulty === 'easy') {
      return this.getRandomMove(board);
    }
    
    // Medium: 60% chance to make the best move, 40% chance random
    if (this.difficulty === 'medium') {
      if (Math.random() < 0.4) {
        return this.getRandomMove(board);
      } else {
        return this.minimax(board, aiSymbol, aiSymbol, humanSymbol).index;
      }
    }
    
    // Hard: Minimax (unbeatable)
    return this.minimax(board, aiSymbol, aiSymbol, humanSymbol).index;
  }

  getRandomMove(board) {
    const available = [];
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) available.push(i);
    }
    return available[Math.floor(Math.random() * available.length)];
  }

  minimax(newBoard, player, aiSymbol, humanSymbol) {
    const availSpots = [];
    for (let i = 0; i < 9; i++) {
      if (newBoard[i] === null) availSpots.push(i);
    }

    if (this.checkWin(newBoard, humanSymbol)) return { score: -10 };
    else if (this.checkWin(newBoard, aiSymbol)) return { score: 10 };
    else if (availSpots.length === 0) return { score: 0 };

    const moves = [];

    for (let i = 0; i < availSpots.length; i++) {
      const move = {};
      move.index = availSpots[i];
      newBoard[availSpots[i]] = player;

      if (player === aiSymbol) {
        const result = this.minimax(newBoard, humanSymbol, aiSymbol, humanSymbol);
        move.score = result.score;
      } else {
        const result = this.minimax(newBoard, aiSymbol, aiSymbol, humanSymbol);
        move.score = result.score;
      }

      newBoard[availSpots[i]] = null;
      moves.push(move);
    }

    let bestMove;
    if (player === aiSymbol) {
      let bestScore = -10000;
      for (let i = 0; i < moves.length; i++) {
        if (moves[i].score > bestScore) {
          bestScore = moves[i].score;
          bestMove = i;
        }
      }
    } else {
      let bestScore = 10000;
      for (let i = 0; i < moves.length; i++) {
        if (moves[i].score < bestScore) {
          bestScore = moves[i].score;
          bestMove = i;
        }
      }
    }

    return moves[bestMove];
  }

  checkWin(board, player) {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    return lines.some(line => line.every(i => board[i] === player));
  }
}

window.TicTacToeAI = TicTacToeAI;
