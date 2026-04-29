class AppController {
  constructor() {
    this.currentUser = null;
    this.screens = document.querySelectorAll('.screen');
    
    // Auth State
    const savedUser = localStorage.getItem('xo_user');
    if (savedUser) {
      try {
        this.currentUser = JSON.parse(savedUser);
      } catch (e) {
        localStorage.removeItem('xo_user');
      }
    }

    this.initNavigation();
    this.initAuth();
    this.initLocalMode();
    this.initOnlineMode();
    this.initComputerMode();

    // Start with Splash, then transition based on auth state
    setTimeout(() => {
      if (this.currentUser) {
        this.finishLogin(this.currentUser);
      } else {
        this.switchScreen('auth');
      }
    }, 2000);
  }

  switchScreen(screenId) {
    this.screens.forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${screenId}`).classList.add('active');
  }

  // --- NAVIGATION ---
  initNavigation() {
    // Back buttons
    document.getElementById('btn-diff-back').onclick = () => this.switchScreen('menu');
    document.getElementById('btn-local-back').onclick = () => this.switchScreen('menu');
    document.getElementById('btn-online-back').onclick = () => this.switchScreen('menu');
    document.getElementById('btn-lb-back').onclick = () => this.switchScreen('menu');
    document.getElementById('btn-friends-back').onclick = () => this.switchScreen('menu');
    document.getElementById('btn-profile-back').onclick = () => this.switchScreen('menu');
    
    // Menu buttons
    document.getElementById('btn-mode-computer').onclick = () => this.switchScreen('difficulty');
    document.getElementById('btn-mode-local').onclick = () => this.switchScreen('local-setup');
    document.getElementById('btn-mode-online').onclick = () => {
      if (!this.currentUser) return window.animations.showToast('Login required for online play', 'error');
      this.switchScreen('online-lobby');
    };
    
    document.getElementById('btn-nav-leaderboard').onclick = () => {
      this.switchScreen('leaderboard');
      window.leaderboardManager.loadData();
    };
    
    document.getElementById('btn-nav-friends').onclick = () => {
      if (!this.currentUser) return window.animations.showToast('Login required to view friends', 'error');
      this.switchScreen('friends');
      window.friendManager.loadFriends();
    };
    
    document.getElementById('btn-nav-profile').onclick = () => {
      if (!this.currentUser) return window.animations.showToast('Login required to view profile', 'error');
      this.switchScreen('profile');
      this.fetchUserProfile();
    };

    // Game Actions
    document.getElementById('btn-game-menu').onclick = () => this.switchScreen('menu');
    document.getElementById('btn-result-menu').onclick = () => this.switchScreen('menu');
    
    document.getElementById('btn-game-rematch').onclick = () => this.handleRematch();
    document.getElementById('btn-result-rematch').onclick = () => this.handleRematch();
  }

  handleRematch() {
    if (window.gameBoard.mode === 'computer') {
      window.gameBoard.resetBoard();
      this.switchScreen('game');
    } else if (window.gameBoard.mode === 'local') {
      window.gameBoard.resetBoard();
      this.switchScreen('game');
    } else if (window.gameBoard.mode === 'online') {
      window.onlineManager.socket.emit('request-rematch', { roomCode: window.onlineManager.roomCode, userId: this.currentUser.id });
      window.animations.showToast('Rematch requested...', 'info');
    }
  }

  // --- AUTHENTICATION ---
  initAuth() {
    const isRegistering = { value: false };
    const authDisplayGrp = document.getElementById('auth-display-group');
    const authBtnLogin = document.getElementById('btn-auth-login');
    const authBtnReg = document.getElementById('btn-auth-register');
    const authSwitch = document.getElementById('btn-auth-switch');
    const errorEl = document.getElementById('auth-error');

    authSwitch.onclick = (e) => {
      e.preventDefault();
      isRegistering.value = !isRegistering.value;
      if (isRegistering.value) {
        authDisplayGrp.style.display = 'block';
        authBtnLogin.style.display = 'none';
        authBtnReg.style.display = 'inline-flex';
        document.getElementById('auth-switch-text').innerHTML = `Already have an account? <a href="#" id="btn-auth-switch">Login</a>`;
      } else {
        authDisplayGrp.style.display = 'none';
        authBtnLogin.style.display = 'inline-flex';
        authBtnReg.style.display = 'none';
        document.getElementById('auth-switch-text').innerHTML = `New player? <a href="#" id="btn-auth-switch">Create Account</a>`;
      }
      this.initAuth(); // re-bind newly created switch link
    };

    authBtnLogin.onclick = async () => {
      const username = document.getElementById('auth-username').value.trim();
      if (!username) return (errorEl.textContent = 'Username is required');
      
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username })
        });
        const data = await res.json();
        if (data.error) errorEl.textContent = data.error;
        else this.finishLogin(data.user);
      } catch (e) {
        errorEl.textContent = 'Network error during login';
      }
    };

    authBtnReg.onclick = async () => {
      const username = document.getElementById('auth-username').value.trim();
      const displayName = document.getElementById('auth-display-name').value.trim();
      if (!username || !displayName) return (errorEl.textContent = 'All fields required');
      
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, displayName })
        });
        const data = await res.json();
        if (data.error) errorEl.textContent = data.error;
        else this.finishLogin(data.user);
      } catch (e) {
        errorEl.textContent = 'Network error during registration';
      }
    };

    document.getElementById('btn-logout').onclick = () => {
      this.currentUser = null;
      localStorage.removeItem('xo_user');
      if (window.onlineManager && window.onlineManager.socket) {
        window.onlineManager.socket.disconnect();
        window.onlineManager.socket = null;
      }
      this.switchScreen('auth');
    };
  }

  finishLogin(user) {
    this.currentUser = user;
    localStorage.setItem('xo_user', JSON.stringify(user));
    
    // Initialize managers
    if (window.onlineManager) window.onlineManager.connect(user.id);
    if (window.friendManager) window.friendManager.setUserId(user.id);
    if (window.leaderboardManager) window.leaderboardManager.setUserId(user.id);
    
    // Update Menu Top Bar
    document.getElementById('menu-name').textContent = user.display_name;
    document.getElementById('menu-points').textContent = user.points + ' pts';
    document.getElementById('menu-player-id').textContent = user.player_id;
    document.getElementById('menu-avatar').textContent = user.display_name.charAt(0).toUpperCase();
    
    this.switchScreen('menu');
    this.fetchUserProfile();
  }

  async fetchUserProfile() {
    if (!this.currentUser) return;
    try {
      const res = await fetch(`/api/user/${this.currentUser.id}`);
      const user = await res.json();
      this.currentUser = user; // refresh data
      localStorage.setItem('xo_user', JSON.stringify(user));
      
      // Update Top Bar
      document.getElementById('menu-points').textContent = user.points + ' pts';
      if (user.rank) document.getElementById('menu-rank').textContent = 'Global Rank: #' + user.rank;

      // Update Profile Screen
      document.getElementById('profile-name').textContent = user.display_name;
      document.getElementById('profile-player-id').textContent = user.player_id;
      document.getElementById('profile-avatar').textContent = user.display_name.charAt(0).toUpperCase();
      document.getElementById('profile-points').textContent = user.points;
      document.getElementById('profile-wins').textContent = user.wins;
      document.getElementById('profile-losses').textContent = user.losses;
      document.getElementById('profile-draws').textContent = user.draws;
      
      const totalMatches = user.wins + user.losses + user.draws;
      const winRate = totalMatches > 0 ? Math.round((user.wins / totalMatches) * 100) : 0;
      document.getElementById('profile-winrate').textContent = winRate + '%';
      document.getElementById('profile-rank-num').textContent = user.rank ? '#' + user.rank : '-';

      // Load Match History
      const matchRes = await fetch(`/api/matches/${this.currentUser.id}`);
      const matches = await matchRes.json();
      const histEl = document.getElementById('profile-match-history');
      if (matches.length === 0) {
        histEl.innerHTML = '<p style="color:var(--text-dim); text-align:center; padding: 20px;">No matches played yet.</p>';
      } else {
        histEl.innerHTML = matches.map(m => {
          let resCls = m.result === 'draw' ? 'draw' : (m.winner_id === this.currentUser.id ? 'win' : 'loss');
          let resText = m.result === 'draw' ? 'DRAW' : (m.winner_id === this.currentUser.id ? 'VICTORY' : 'DEFEAT');
          let opponent = m.player1_id === this.currentUser.id ? m.p2_name : m.p1_name;
          if (!opponent) opponent = 'Computer';
          
          let pChange = m.player1_id === this.currentUser.id ? m.p1_points_change : m.p2_points_change;
          
          return `
            <div class="match-card">
              <div>
                <div class="match-result ${resCls}">${resText}</div>
                <div style="font-size:0.7rem; color:var(--text-dim); margin-top:4px">vs ${opponent}</div>
              </div>
              <div style="font-family:var(--font-display); font-weight:700; color:${pChange >= 0 ? 'var(--green)' : 'var(--red)'}">
                ${pChange >= 0 ? '+' : ''}${pChange}
              </div>
            </div>
          `;
        }).join('');
      }

    } catch (e) {
      console.error('Failed to fetch user profile', e);
    }
  }

  // --- MODES ---
  initLocalMode() {
    document.getElementById('btn-local-start').onclick = () => {
      const p1 = document.getElementById('local-p1-name').value || 'Player 1';
      const p2 = document.getElementById('local-p2-name').value || 'Player 2';
      
      document.getElementById('game-p1-name').textContent = p1;
      document.getElementById('game-p2-name').textContent = p2;
      document.getElementById('game-p1-avatar').textContent = p1.charAt(0).toUpperCase();
      document.getElementById('game-p2-avatar').textContent = p2.charAt(0).toUpperCase();
      
      window.gameBoard.startMatch('local');
      this.switchScreen('game');
    };
  }

  initComputerMode() {
    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.onclick = () => {
        const diff = btn.dataset.diff;
        document.getElementById('game-p1-name').textContent = 'You';
        document.getElementById('game-p2-name').textContent = 'Computer (' + diff + ')';
        document.getElementById('game-p1-avatar').textContent = '👤';
        document.getElementById('game-p2-avatar').textContent = '🤖';
        
        window.gameBoard.onGameOver = async (result, winnerSymbol) => {
          if (!this.currentUser) return; // Guest mode doesn't record stats
          
          let res = 'draw';
          if (result === 'win') {
            res = winnerSymbol === 'X' ? 'win' : 'loss';
          }
          
          try {
            const apiRes = await fetch('/api/match/record', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: this.currentUser.id, result: res, mode: 'computer' })
            });
            const data = await apiRes.json();
            
            setTimeout(() => {
              document.getElementById('result-title').textContent = res === 'win' ? 'Victory!' : (res === 'loss' ? 'Defeat!' : 'Draw!');
              document.getElementById('result-subtitle').textContent = `vs Computer (${diff})`;
              document.getElementById('result-points').style.display = 'block';
              
              const pChange = document.getElementById('points-change');
              pChange.textContent = (data.pointsChange >= 0 ? '+' : '') + data.pointsChange;
              pChange.className = 'points-change ' + (data.pointsChange >= 0 ? 'positive' : 'negative');
              document.getElementById('result-rank').textContent = 'Rank: ' + data.rank.name;
              
              this.switchScreen('result');
              this.fetchUserProfile();
            }, 2000);
          } catch(e) {
            console.error(e);
          }
        };

        window.gameBoard.startMatch('computer', diff);
        this.switchScreen('game');
      };
    });
  }

  initOnlineMode() {
    // Show panels
    document.getElementById('btn-create-room').onclick = () => {
      document.getElementById('panel-create-room').style.display = 'block';
      document.getElementById('panel-join-room').style.display = 'none';
      document.getElementById('panel-invite-friend').style.display = 'none';
      window.onlineManager.createRoom();
    };

    document.getElementById('btn-join-room').onclick = () => {
      document.getElementById('panel-create-room').style.display = 'none';
      document.getElementById('panel-join-room').style.display = 'block';
      document.getElementById('panel-invite-friend').style.display = 'none';
    };

    document.getElementById('btn-invite-friend').onclick = async () => {
      document.getElementById('panel-create-room').style.display = 'none';
      document.getElementById('panel-join-room').style.display = 'none';
      document.getElementById('panel-invite-friend').style.display = 'block';
      
      window.onlineManager.createRoom(); // create a room first to invite them to
      
      // Load friends
      const res = await fetch(`/api/friends/${this.currentUser.id}`);
      const friends = await res.json();
      const onlineFriends = friends.filter(f => f.online);
      
      const listEl = document.getElementById('invite-friends-list');
      if (onlineFriends.length === 0) {
        listEl.innerHTML = '<p class="friends-empty" style="padding: 10px">No online friends available to invite.</p>';
      } else {
        listEl.innerHTML = onlineFriends.map(f => `
          <div class="friend-card glass-panel" style="padding: 8px; margin-bottom: 4px;">
            <div class="friend-status online"></div>
            <div class="friend-info">
              <span class="friend-name" style="font-size:0.8rem">${f.display_name}</span>
            </div>
            <button class="btn btn-primary btn-small" onclick="window.friendManager.inviteFriend('${f.id}')">Invite</button>
          </div>
        `).join('');
      }
    };

    document.getElementById('btn-join-code').onclick = () => {
      const code = document.getElementById('input-room-code').value.toUpperCase().trim();
      if (code) {
        window.onlineManager.joinRoom(code);
      }
    };

    document.getElementById('btn-copy-code').onclick = () => {
      const code = document.getElementById('room-code-display').textContent;
      navigator.clipboard.writeText(code);
      window.animations.showToast('Code copied to clipboard!', 'info');
    };
    
    document.getElementById('btn-copy-pid').onclick = () => {
      const pid = document.getElementById('profile-player-id').textContent;
      navigator.clipboard.writeText(pid);
      window.animations.showToast('Player ID copied!', 'info');
    };
  }
}

// Initialize application
window.addEventListener('DOMContentLoaded', () => {
  window.app = new AppController();
});
