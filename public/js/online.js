class OnlineManager {
  constructor() {
    this.socket = null;
    this.roomCode = null;
    this.mySymbol = null;
    this.myUserId = null;
    this.opponentId = null;
    this.isConnected = false;
  }

  connect(userId) {
    this.myUserId = userId;
    if (!this.socket) {
      this.socket = io();
      this.initListeners();
    }
    this.socket.emit('user-online', userId);
    this.isConnected = true;
  }

  initListeners() {
    this.socket.on('room-created', (data) => {
      this.roomCode = data.roomCode;
      this.mySymbol = data.symbol;
      document.getElementById('room-code-display').textContent = this.roomCode;
      window.animations.showToast('Room created! Waiting for opponent...', 'success');
    });

    this.socket.on('game-start', (data) => {
      this.roomCode = data.roomCode;
      
      const me = data.players.find(p => p.id === this.myUserId);
      const opponent = data.players.find(p => p.id !== this.myUserId);
      
      this.mySymbol = me.symbol;
      this.opponentId = opponent.id;
      
      // Setup UI
      document.getElementById('game-p1-name').textContent = me.symbol === 'X' ? me.display_name : opponent.display_name;
      document.getElementById('game-p2-name').textContent = me.symbol === 'O' ? me.display_name : opponent.display_name;
      
      // Navigate to game
      window.app.switchScreen('game');
      window.gameBoard.mode = 'online';
      window.gameBoard.isGameOver = false;
      window.gameBoard.board = data.board;
      window.gameBoard.currentTurn = data.currentTurn;
      window.gameBoard.render();
      this.updateStatus(data.currentTurn);
    });

    this.socket.on('move-made', (data) => {
      window.gameBoard.board = data.board;
      window.gameBoard.render();
      
      if (data.symbol === 'X') window.sounds && window.sounds.playX();
      else window.sounds && window.sounds.playO();

      if (!data.gameOver) {
        window.gameBoard.currentTurn = data.nextTurn;
        this.updateStatus(data.nextTurn);
      }
    });

    this.socket.on('game-over', (data) => {
      window.gameBoard.isGameOver = true;
      if (data.result === 'win') {
        window.gameBoard.drawWinLine(data.winLine);
        const meWinner = data.winnerId === this.myUserId;
        
        if (meWinner) {
          window.gameBoard.updateStatus('YOU WIN!');
          window.sounds && window.sounds.playWin();
          window.animations && window.animations.triggerConfetti();
        } else {
          window.gameBoard.updateStatus('YOU LOSE!');
          window.sounds && window.sounds.playLose();
        }
        
        // Show result screen after delay
        setTimeout(() => this.showResult(meWinner ? 'Victory!' : 'Defeat!', data), 2000);
      } else {
        window.gameBoard.updateStatus('DRAW!');
        window.sounds && window.sounds.playDraw();
        setTimeout(() => this.showResult('Draw!', data), 2000);
      }
    });

    this.socket.on('room-error', (data) => {
      document.getElementById('join-error').textContent = data.error;
      window.animations.showToast(data.error, 'error');
    });

    this.socket.on('opponent-disconnected', (data) => {
      window.animations.showToast('Opponent disconnected!', 'error');
      setTimeout(() => window.app.switchScreen('menu'), 2000);
    });
    
    this.socket.on('game-invite', (data) => {
      document.getElementById('invite-from-name').textContent = data.from.display_name;
      document.getElementById('modal-invite').style.display = 'flex';
      
      document.getElementById('btn-accept-invite').onclick = () => {
        this.joinRoom(data.roomCode);
        document.getElementById('modal-invite').style.display = 'none';
      };
      
      document.getElementById('btn-reject-invite').onclick = () => {
        document.getElementById('modal-invite').style.display = 'none';
      };
    });
  }

  createRoom() {
    this.socket.emit('create-room', { userId: this.myUserId });
  }

  joinRoom(code) {
    this.socket.emit('join-room', { roomCode: code, userId: this.myUserId });
  }

  makeMove(index) {
    if (window.gameBoard.currentTurn !== this.mySymbol) {
      window.animations.showToast("It's not your turn!", 'error');
      return;
    }
    this.socket.emit('make-move', {
      roomCode: this.roomCode,
      userId: this.myUserId,
      index: index
    });
  }

  updateStatus(turn) {
    if (turn === this.mySymbol) {
      window.gameBoard.updateStatus('Your Turn (' + turn + ')');
    } else {
      window.gameBoard.updateStatus("Opponent's Turn (" + turn + ")");
    }
  }
  
  showResult(title, data) {
    const res = data.players[this.myUserId];
    document.getElementById('result-title').textContent = title;
    
    if (res) {
      document.getElementById('result-points').style.display = 'block';
      const pChange = document.getElementById('points-change');
      pChange.textContent = (res.change >= 0 ? '+' : '') + res.change;
      pChange.className = 'points-change ' + (res.change >= 0 ? 'positive' : 'negative');
      document.getElementById('result-rank').textContent = 'Rank: ' + res.rank.name;
    } else {
      document.getElementById('result-points').style.display = 'none';
    }
    
    window.app.switchScreen('result');
    window.app.fetchUserProfile(); // Refresh top bar
  }
}

window.onlineManager = new OnlineManager();
