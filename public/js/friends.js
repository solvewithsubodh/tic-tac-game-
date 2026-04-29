class FriendManager {
  constructor() {
    this.userId = null;
    this.initListeners();
  }

  initListeners() {
    document.getElementById('btn-add-friend').addEventListener('click', () => {
      const pid = document.getElementById('friend-add-input').value.toUpperCase().trim();
      if (!pid) return;
      this.sendRequest(pid);
    });
  }

  setUserId(id) {
    this.userId = id;
    this.loadFriends();
    this.loadPendingRequests();
  }

  async sendRequest(playerId) {
    const errorEl = document.getElementById('friend-add-error');
    const successEl = document.getElementById('friend-add-success');
    errorEl.textContent = '';
    successEl.textContent = '';

    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: this.userId, receiverPlayerId: playerId })
      });
      const data = await res.json();
      
      if (data.error) {
        errorEl.textContent = data.error;
      } else {
        successEl.textContent = 'Friend request sent!';
        document.getElementById('friend-add-input').value = '';
        window.animations.showToast('Friend request sent!', 'success');
      }
    } catch (e) {
      errorEl.textContent = 'Failed to send request.';
    }
  }

  async loadFriends() {
    try {
      const res = await fetch(`/api/friends/${this.userId}`);
      const friends = await res.json();
      const listEl = document.getElementById('friends-list');
      
      if (friends.length === 0) {
        listEl.innerHTML = '<p class="friends-empty">No friends yet. Add friends using their Player ID!</p>';
        return;
      }
      
      listEl.innerHTML = friends.map(f => `
        <div class="friend-card glass-panel">
          <div class="friend-status ${f.online ? 'online' : 'offline'}"></div>
          <div class="friend-info">
            <span class="friend-name">${f.display_name}</span>
            <span class="friend-pid">${f.player_id}</span>
          </div>
          <div class="friend-actions">
            ${f.online ? `<button class="btn btn-primary btn-small" onclick="window.friendManager.inviteFriend('${f.id}')">Invite</button>` : ''}
            <button class="btn btn-secondary btn-small" onclick="window.friendManager.removeFriend('${f.id}')">Remove</button>
          </div>
        </div>
      `).join('');
    } catch (e) {
      console.error('Failed to load friends', e);
    }
  }

  async loadPendingRequests() {
    try {
      const res = await fetch(`/api/friends/pending/${this.userId}`);
      const pending = await res.json();
      
      const section = document.getElementById('pending-requests-section');
      const listEl = document.getElementById('pending-requests-list');
      const badge = document.getElementById('friend-req-badge');
      
      if (pending.length === 0) {
        section.style.display = 'none';
        badge.style.display = 'none';
        return;
      }
      
      section.style.display = 'block';
      badge.style.display = 'block';
      badge.textContent = pending.length;
      
      listEl.innerHTML = pending.map(req => `
        <div class="friend-card glass-panel">
          <div class="friend-info">
            <span class="friend-name">${req.display_name}</span>
            <span class="friend-pid">${req.player_id}</span>
          </div>
          <div class="friend-actions">
            <button class="btn btn-primary btn-small" onclick="window.friendManager.acceptRequest(${req.request_id})">Accept</button>
            <button class="btn btn-danger btn-small" onclick="window.friendManager.rejectRequest(${req.request_id})">Decline</button>
          </div>
        </div>
      `).join('');
    } catch (e) {
      console.error('Failed to load requests', e);
    }
  }

  async acceptRequest(reqId) {
    await fetch('/api/friends/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: reqId })
    });
    this.loadPendingRequests();
    this.loadFriends();
    window.animations.showToast('Friend request accepted!', 'success');
  }

  async rejectRequest(reqId) {
    await fetch('/api/friends/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: reqId })
    });
    this.loadPendingRequests();
  }

  async removeFriend(friendId) {
    await fetch('/api/friends/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: this.userId, friendId })
    });
    this.loadFriends();
    window.animations.showToast('Friend removed', 'info');
  }

  inviteFriend(friendId) {
    if (window.onlineManager && window.onlineManager.roomCode) {
      window.onlineManager.socket.emit('invite-friend', {
        userId: this.userId,
        friendId: friendId,
        roomCode: window.onlineManager.roomCode
      });
      window.animations.showToast('Invite sent!', 'success');
    }
  }
}

window.friendManager = new FriendManager();
