class LeaderboardManager {
  constructor() {
    this.currentTab = 'global'; // 'global' or 'friends'
    this.userId = null;
    this.initListeners();
  }

  initListeners() {
    document.getElementById('lb-tab-global').addEventListener('click', (e) => {
      this.switchTab('global');
    });
    document.getElementById('lb-tab-friends').addEventListener('click', (e) => {
      this.switchTab('friends');
    });
  }

  setUserId(id) {
    this.userId = id;
  }

  switchTab(tab) {
    this.currentTab = tab;
    document.getElementById('lb-tab-global').classList.toggle('active', tab === 'global');
    document.getElementById('lb-tab-friends').classList.toggle('active', tab === 'friends');
    this.loadData();
  }

  async loadData() {
    const tbody = document.getElementById('lb-table-body');
    const emptyMsg = document.getElementById('lb-empty');
    
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Loading...</td></tr>';
    emptyMsg.style.display = 'none';

    try {
      const endpoint = this.currentTab === 'global' ? '/api/leaderboard' : `/api/leaderboard/friends/${this.userId}`;
      const res = await fetch(endpoint);
      const data = await res.json();
      
      if (!data || data.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.style.display = 'block';
        return;
      }
      
      tbody.innerHTML = data.map(p => this.createRow(p)).join('');
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--red)">Failed to load rankings</td></tr>';
    }
  }

  getRankBadge(points) {
    if (points >= 1500) return '<span class="rank-badge" style="background:#ff00aa22; color:#ff00aa">👑 Champion</span>';
    if (points >= 1000) return '<span class="rank-badge" style="background:#00f5ff22; color:#00f5ff">💎 Diamond</span>';
    if (points >= 600)  return '<span class="rank-badge" style="background:#ffd70022; color:#ffd700">🥇 Gold</span>';
    if (points >= 300)  return '<span class="rank-badge" style="background:#c0c0c022; color:#c0c0c0">🥈 Silver</span>';
    return '<span class="rank-badge" style="background:#cd7f3222; color:#cd7f32">🥉 Bronze</span>';
  }

  createRow(player) {
    const isMe = player.id === this.userId;
    return `
      <tr class="${isMe ? 'is-me' : ''}">
        <td>#${player.rank}</td>
        <td>
          <div class="lb-player-cell">
            <div class="profile-avatar">${player.display_name.charAt(0).toUpperCase()}</div>
            <div style="display:flex; flex-direction:column;">
              <span style="font-weight:600">${player.display_name} ${isMe ? '(You)' : ''}</span>
              <span style="font-size:0.7rem; color:var(--text-dim); font-family:var(--font-display)">${player.player_id}</span>
            </div>
          </div>
        </td>
        <td style="color:var(--green)">${player.wins}</td>
        <td style="color:var(--red)">${player.losses}</td>
        <td style="color:var(--gold)">${player.draws}</td>
        <td>
          <div style="display:flex; flex-direction:column;">
            <span style="font-weight:700; font-family:var(--font-display)">${player.points}</span>
            ${this.getRankBadge(player.points)}
          </div>
        </td>
      </tr>
    `;
  }
}

window.leaderboardManager = new LeaderboardManager();
