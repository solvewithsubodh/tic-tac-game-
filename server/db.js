const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Glitch.com persistent storage directory
const dataDir = path.join(__dirname, '..', '.data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'xo-game.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_index INTEGER DEFAULT 0,
    player_id TEXT UNIQUE NOT NULL,
    points INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    last_seen TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id),
    UNIQUE(sender_id, receiver_id)
  );

  CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    player1_id TEXT NOT NULL,
    player2_id TEXT,
    winner_id TEXT,
    mode TEXT NOT NULL,
    p1_points_change INTEGER DEFAULT 0,
    p2_points_change INTEGER DEFAULT 0,
    result TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_users_player_id ON users(player_id);
  CREATE INDEX IF NOT EXISTS idx_users_points ON users(points DESC);
  CREATE INDEX IF NOT EXISTS idx_friends_sender ON friends(sender_id);
  CREATE INDEX IF NOT EXISTS idx_friends_receiver ON friends(receiver_id);
`);

function generatePlayerId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'XO-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const queries = {
  // User operations
  createUser(username, displayName, avatarIndex = 0) {
    const id = uuidv4();
    let playerId = generatePlayerId();
    // Ensure unique player ID
    while (this.getUserByPlayerId(playerId)) {
      playerId = generatePlayerId();
    }
    const stmt = db.prepare(`
      INSERT INTO users (id, username, display_name, avatar_index, player_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, username.toLowerCase(), displayName, avatarIndex, playerId);
    return this.getUserById(id);
  },

  getUserById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  getUserByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username.toLowerCase());
  },

  getUserByPlayerId(playerId) {
    return db.prepare('SELECT * FROM users WHERE player_id = ?').get(playerId);
  },

  updateUserStats(userId, wins, losses, draws, points) {
    db.prepare(`
      UPDATE users SET wins = ?, losses = ?, draws = ?, points = MAX(0, ?), last_seen = datetime('now')
      WHERE id = ?
    `).run(wins, losses, draws, points, userId);
  },

  updateLastSeen(userId) {
    db.prepare(`UPDATE users SET last_seen = datetime('now') WHERE id = ?`).run(userId);
  },

  // Leaderboard
  getLeaderboard(limit = 100, offset = 0) {
    return db.prepare(`
      SELECT id, username, display_name, avatar_index, player_id, points, wins, losses, draws,
      RANK() OVER (ORDER BY points DESC, wins DESC) as rank
      FROM users
      ORDER BY points DESC, wins DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
  },

  getUserRank(userId) {
    const result = db.prepare(`
      SELECT COUNT(*) + 1 as rank FROM users
      WHERE points > (SELECT points FROM users WHERE id = ?)
    `).get(userId);
    return result ? result.rank : null;
  },

  // Friends
  sendFriendRequest(senderId, receiverId) {
    // Check if already friends or pending
    const existing = db.prepare(`
      SELECT * FROM friends
      WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
    `).get(senderId, receiverId, receiverId, senderId);
    if (existing) return { error: 'Request already exists', existing };

    db.prepare(`INSERT INTO friends (sender_id, receiver_id) VALUES (?, ?)`).run(senderId, receiverId);
    return { success: true };
  },

  acceptFriendRequest(requestId) {
    db.prepare(`UPDATE friends SET status = 'accepted' WHERE id = ?`).run(requestId);
  },

  rejectFriendRequest(requestId) {
    db.prepare(`DELETE FROM friends WHERE id = ?`).run(requestId);
  },

  removeFriend(userId, friendId) {
    db.prepare(`
      DELETE FROM friends
      WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
    `).run(userId, friendId, friendId, userId);
  },

  getFriends(userId) {
    return db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar_index, u.player_id, u.points, u.wins, u.losses, u.draws
      FROM friends f
      JOIN users u ON (u.id = CASE WHEN f.sender_id = ? THEN f.receiver_id ELSE f.sender_id END)
      WHERE (f.sender_id = ? OR f.receiver_id = ?) AND f.status = 'accepted'
    `).all(userId, userId, userId);
  },

  getPendingRequests(userId) {
    return db.prepare(`
      SELECT f.id as request_id, u.id, u.username, u.display_name, u.avatar_index, u.player_id, f.created_at
      FROM friends f
      JOIN users u ON u.id = f.sender_id
      WHERE f.receiver_id = ? AND f.status = 'pending'
    `).all(userId);
  },

  getSentRequests(userId) {
    return db.prepare(`
      SELECT f.id as request_id, u.id, u.username, u.display_name, u.avatar_index, u.player_id
      FROM friends f
      JOIN users u ON u.id = f.receiver_id
      WHERE f.sender_id = ? AND f.status = 'pending'
    `).all(userId);
  },

  getFriendsLeaderboard(userId) {
    const friends = this.getFriends(userId);
    const user = this.getUserById(userId);
    if (user) friends.push(user);
    friends.sort((a, b) => b.points - a.points || b.wins - a.wins);
    return friends.map((f, i) => ({ ...f, rank: i + 1 }));
  },

  // Matches
  recordMatch(player1Id, player2Id, winnerId, mode, p1Change, p2Change, result) {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO matches (id, player1_id, player2_id, winner_id, mode, p1_points_change, p2_points_change, result)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, player1Id, player2Id, winnerId, mode, p1Change, p2Change, result);
    return id;
  },

  getPlayerMatches(userId, limit = 20) {
    return db.prepare(`
      SELECT m.*,
        u1.display_name as p1_name, u1.player_id as p1_player_id,
        u2.display_name as p2_name, u2.player_id as p2_player_id
      FROM matches m
      LEFT JOIN users u1 ON m.player1_id = u1.id
      LEFT JOIN users u2 ON m.player2_id = u2.id
      WHERE m.player1_id = ? OR m.player2_id = ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `).all(userId, userId, limit);
  }
};

module.exports = { db, queries };
