class GameBoard {
  constructor() {
    this.board = Array(9).fill(null);
    this.cells = document.querySelectorAll('.cell');
    this.winLineSvg = document.getElementById('win-line');
    this.statusEl = document.getElementById('game-status');
    this.turnIndLeft = document.getElementById('turn-indicator-left');
    this.turnIndRight = document.getElementById('turn-indicator-right');
    this.scoreP1El = document.getElementById('game-score-p1');
    this.scoreP2El = document.getElementById('game-score-p2');
    this.actionsEl = document.getElementById('game-actions');
    
    this.scores = { p1: 0, p2: 0 };
    this.currentTurn = 'X';
    this.mode = 'computer'; // computer, local, online
    this.ai = new window.TicTacToeAI('medium');
    this.aiSymbol = 'O';
    this.isAiThinking = false;
    this.isGameOver = false;

    this.onGameOver = null; // callback

    this.initListeners();
  }

  initListeners() {
    this.cells.forEach(cell => {
      cell.addEventListener('click', () => this.handleCellClick(cell.dataset.index));
    });
  }

  startMatch(mode, difficulty = 'medium') {
    this.mode = mode;
    this.board = Array(9).fill(null);
    this.currentTurn = 'X';
    this.isGameOver = false;
    this.isAiThinking = false;
    this.scores = { p1: 0, p2: 0 };
    
    if (mode === 'computer') {
      this.ai.difficulty = difficulty;
    }
    
    this.render();
    this.updateStatus();
    this.updateScore();
  }

  resetBoard() {
    this.board = Array(9).fill(null);
    this.currentTurn = 'X';
    this.isGameOver = false;
    this.isAiThinking = false;
    this.render();
    this.updateStatus();
    
    if (this.mode === 'computer' && this.aiSymbol === 'X') {
      this.makeAIMove();
    }
  }

  handleCellClick(index) {
    if (this.isGameOver || this.board[index] !== null) return;
    if (this.mode === 'computer' && this.isAiThinking) return;
    if (this.mode === 'online') {
      // Handled by online.js
      if (window.onlineManager) {
        window.onlineManager.makeMove(index);
      }
      return;
    }

    this.makeMove(index, this.currentTurn);

    if (!this.isGameOver && this.mode === 'computer' && this.currentTurn === this.aiSymbol) {
      this.makeAIMove();
    }
  }

  makeMove(index, symbol) {
    this.board[index] = symbol;
    
    // Play sound
    if (symbol === 'X') window.sounds && window.sounds.playX();
    else window.sounds && window.sounds.playO();

    const winResult = this.checkWin(this.board);
    
    if (winResult) {
      this.isGameOver = true;
      if (symbol === 'X') this.scores.p1++; else this.scores.p2++;
      this.updateScore();
      this.render();
      this.drawWinLine(winResult.line);
      this.updateStatus(`${symbol} WINS!`);
      if (window.sounds) window.sounds.playWin();
      if (window.animations) window.animations.triggerConfetti();
      
      if (this.onGameOver) this.onGameOver('win', symbol);
    } else if (this.board.every(cell => cell !== null)) {
      this.isGameOver = true;
      this.render();
      this.updateStatus("IT's A DRAW!");
      if (window.sounds) window.sounds.playDraw();
      
      if (this.onGameOver) this.onGameOver('draw');
    } else {
      this.currentTurn = this.currentTurn === 'X' ? 'O' : 'X';
      this.updateStatus();
      this.render();
    }
  }

  makeAIMove() {
    this.isAiThinking = true;
    this.updateStatus("Computer is thinking...");
    
    setTimeout(() => {
      const bestMove = this.ai.getBestMove(this.board, this.aiSymbol);
      this.makeMove(bestMove, this.aiSymbol);
      this.isAiThinking = false;
    }, 600 + Math.random() * 400); // 0.6 to 1s delay
  }

  checkWin(board) {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (let line of lines) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a], line };
      }
    }
    return null;
  }

  drawWinLine(lineIndexes) {
    // lineIndexes = e.g., [0, 1, 2]
    const svg = document.getElementById('win-line-svg');
    const cells = Array.from(this.cells);
    const startCell = cells[lineIndexes[0]].getBoundingClientRect();
    const endCell = cells[lineIndexes[2]].getBoundingClientRect();
    const boardRect = document.getElementById('game-board').getBoundingClientRect();
    
    const x1 = startCell.left + startCell.width/2 - boardRect.left;
    const y1 = startCell.top + startCell.height/2 - boardRect.top;
    const x2 = endCell.left + endCell.width/2 - boardRect.left;
    const y2 = endCell.top + endCell.height/2 - boardRect.top;

    this.winLineSvg.setAttribute('x1', x1);
    this.winLineSvg.setAttribute('y1', y1);
    this.winLineSvg.setAttribute('x2', x2);
    this.winLineSvg.setAttribute('y2', y2);

    // Apply classes for glow
    lineIndexes.forEach(idx => cells[idx].classList.add('win-cell'));
    this.winLineSvg.classList.add('drawn');
  }

  render() {
    this.board.forEach((symbol, index) => {
      const cell = this.cells[index];
      cell.textContent = symbol || '';
      cell.className = 'cell'; // reset
      if (symbol) {
        cell.classList.add('taken');
        cell.classList.add(symbol === 'X' ? 'x-cell' : 'o-cell');
      }
    });

    if (!this.isGameOver) {
      this.winLineSvg.classList.remove('drawn');
      this.winLineSvg.setAttribute('x1', 0);
      this.winLineSvg.setAttribute('y1', 0);
      this.winLineSvg.setAttribute('x2', 0);
      this.winLineSvg.setAttribute('y2', 0);
    }
  }

  updateStatus(customMsg = null) {
    if (customMsg) {
      this.statusEl.textContent = customMsg;
      this.turnIndLeft.classList.remove('active-turn');
      this.turnIndRight.classList.remove('active-turn');
      return;
    }
    
    if (this.mode === 'local') {
      const pName = this.currentTurn === 'X' ? document.getElementById('local-p1-name').value : document.getElementById('local-p2-name').value;
      this.statusEl.textContent = `${pName}'s Turn (${this.currentTurn})`;
    } else if (this.mode === 'online') {
       // Custom set by online manager
    } else {
      this.statusEl.textContent = this.currentTurn === 'X' ? "Your Turn (X)" : "Computer's Turn (O)";
    }

    if (this.currentTurn === 'X') {
      this.turnIndLeft.classList.add('active-turn');
      this.turnIndRight.classList.remove('active-turn');
    } else {
      this.turnIndLeft.classList.remove('active-turn');
      this.turnIndRight.classList.add('active-turn');
    }
  }

  updateScore() {
    this.scoreP1El.textContent = this.scores.p1;
    this.scoreP2El.textContent = this.scores.p2;
  }
}

window.gameBoard = new GameBoard();
