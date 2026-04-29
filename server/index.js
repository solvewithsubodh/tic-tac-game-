const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { queries } = require('./db');
const { GameRoom, generateRoomCode } = require('./gameEngine');
const { processMatchResult, processDrawResult, getRankTier } = require('./rankEngine');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── REST API ──────────────────────────────────────────────

// Register / Login (simple username-based)
app.post('/api/auth/register', (req, res) => {
  const { username, displayName, avatarIndex } = req.body;
  if (!username || !displayName) return res.status(400).json({ error: 'Username and display name required' });
  if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
  if (queries.getUserByUsername(username)) return res.status(409).json({ error: 'Username already taken' });
  try {
    const user = queries.createUser(username, displayName, avatarIndex || 0);
    res.json({ success: true, user });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });
  const user = queries.getUserByUsername(username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  queries.updateLastSeen(user.id);
  res.json({ success: true, user });
});

// User
app.get('/api/user/:id', (req, res) => {
  const user = queries.getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const rank = queries.getUserRank(user.id);
  res.json({ ...user, rank });
});

app.get('/api/user/pid/:playerId', (req, res) => {
  const user = queries.getUserByPlayerId(req.params.playerId);
  if (!user) return res.status(404).json({ error: 'Player not found' });
  res.json(user);
});

// Leaderboard
app.get('/api/leaderboard', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const offset = parseInt(req.query.offset) || 0;
  const data = queries.getLeaderboard(limit, offset);
  res.json(data);
});

app.get('/api/leaderboard/friends/:userId', (req, res) => {
  const data = queries.getFriendsLeaderboard(req.params.userId);
  res.json(data);
});

// Friends
app.post('/api/friends/request', (req, res) => {
  const { senderId, receiverPlayerId } = req.body;
  const receiver = queries.getUserByPlayerId(receiverPlayerId);
  if (!receiver) return res.status(404).json({ error: 'Player not found' });
  if (receiver.id === senderId) return res.status(400).json({ error: 'Cannot friend yourself' });
  const result = queries.sendFriendRequest(senderId, receiver.id);
  if (result.error) return res.status(409).json(result);
  // Notify receiver via socket
  const receiverSocket = onlineUsers.get(receiver.id);
  if (receiverSocket) {
    io.to(receiverSocket).emit('friend-request', {
      from: queries.getUserById(senderId)
    });
  }
  res.json({ success: true });
});

app.post('/api/friends/accept', (req, res) => {
  const { requestId } = req.body;
  queries.acceptFriendRequest(requestId);
  res.json({ success: true });
});

app.post('/api/friends/reject', (req, res) => {
  const { requestId } = req.body;
  queries.rejectFriendRequest(requestId);
  res.json({ success: true });
});

app.post('/api/friends/remove', (req, res) => {
  const { userId, friendId } = req.body;
  queries.removeFriend(userId, friendId);
  res.json({ success: true });
});

app.get('/api/friends/:userId', (req, res) => {
  const friends = queries.getFriends(req.params.userId);
  // Add online status
  const withStatus = friends.map(f => ({
    ...f,
    online: onlineUsers.has(f.id)
  }));
  res.json(withStatus);
});

app.get('/api/friends/pending/:userId', (req, res) => {
  const pending = queries.getPendingRequests(req.params.userId);
  res.json(pending);
});

app.get('/api/matches/:userId', (req, res) => {
  const matches = queries.getPlayerMatches(req.params.userId);
  res.json(matches);
});

// Record match result for vs computer
app.post('/api/match/record', (req, res) => {
  const { userId, result, mode } = req.body;
  const user = queries.getUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  let pointsChange = 0;
  if (result === 'win') {
    pointsChange = 15;
    queries.updateUserStats(userId, user.wins + 1, user.losses, user.draws, user.points + pointsChange);
  } else if (result === 'loss') {
    pointsChange = -10;
    queries.updateUserStats(userId, user.wins, user.losses + 1, user.draws, user.points + pointsChange);
  } else {
    pointsChange = 5;
    queries.updateUserStats(userId, user.wins, user.losses, user.draws + 1, user.points + pointsChange);
  }

  queries.recordMatch(userId, null, result === 'win' ? userId : null, mode, pointsChange, 0, result);
  const updated = queries.getUserById(userId);
  res.json({ user: updated, pointsChange, rank: getRankTier(updated.points) });
});

// ── Socket.io ─────────────────────────────────────────────

const gameRooms = new Map();
const onlineUsers = new Map(); // userId -> socketId
const socketToUser = new Map(); // socketId -> userId

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // User goes online
  socket.on('user-online', (userId) => {
    onlineUsers.set(userId, socket.id);
    socketToUser.set(socket.id, userId);
    console.log(`User online: ${userId}`);
  });

  // Create game room
  socket.on('create-room', (data) => {
    let roomCode = generateRoomCode();
    while (gameRooms.has(roomCode)) {
      roomCode = generateRoomCode();
    }
    const room = new GameRoom(roomCode, data.userId, socket.id);
    gameRooms.set(roomCode, room);
    socket.join(roomCode);
    socket.emit('room-created', {
      roomCode,
      symbol: 'X',
      message: 'Waiting for opponent...'
    });
    console.log(`Room created: ${roomCode} by ${data.userId}`);
  });

  // Join game room
  socket.on('join-room', (data) => {
    const room = gameRooms.get(data.roomCode);
    if (!room) {
      socket.emit('room-error', { error: 'Room not found' });
      return;
    }
    if (room.status !== 'waiting') {
      socket.emit('room-error', { error: 'Room is full or game already started' });
      return;
    }
    if (room.players[0].id === data.userId) {
      socket.emit('room-error', { error: 'Cannot join your own room' });
      return;
    }

    const added = room.addPlayer(data.userId, socket.id);
    if (!added) {
      socket.emit('room-error', { error: 'Room is full' });
      return;
    }

    socket.join(data.roomCode);

    // Get player info
    const p1 = queries.getUserById(room.players[0].id);
    const p2 = queries.getUserById(room.players[1].id);

    // Notify both players
    io.to(data.roomCode).emit('game-start', {
      roomCode: data.roomCode,
      players: [
        { ...p1, symbol: room.players[0].symbol },
        { ...p2, symbol: room.players[1].symbol }
      ],
      currentTurn: room.currentTurn,
      board: room.board
    });

    console.log(`Game started in room ${data.roomCode}`);
  });

  // Make move
  socket.on('make-move', (data) => {
    const room = gameRooms.get(data.roomCode);
    if (!room) return;

    const result = room.makeMove(data.userId, data.index);
    if (result.error) {
      socket.emit('move-error', { error: result.error });
      return;
    }

    io.to(data.roomCode).emit('move-made', {
      index: data.index,
      symbol: room.board[data.index],
      board: result.board,
      gameOver: result.gameOver,
      nextTurn: result.nextTurn
    });

    if (result.gameOver) {
      if (result.draw) {
        // Process draw
        const p1 = queries.getUserById(room.players[0].id);
        const p2 = queries.getUserById(room.players[1].id);
        const drawResult = processDrawResult(p1, p2);

        queries.updateUserStats(p1.id, p1.wins, p1.losses, p1.draws + 1, drawResult.p1NewPoints);
        queries.updateUserStats(p2.id, p2.wins, p2.losses, p2.draws + 1, drawResult.p2NewPoints);
        queries.recordMatch(p1.id, p2.id, null, 'online', drawResult.p1Change, drawResult.p2Change, 'draw');

        io.to(data.roomCode).emit('game-over', {
          result: 'draw',
          players: {
            [p1.id]: { change: drawResult.p1Change, newPoints: drawResult.p1NewPoints, rank: drawResult.p1Rank },
            [p2.id]: { change: drawResult.p2Change, newPoints: drawResult.p2NewPoints, rank: drawResult.p2Rank }
          }
        });
      } else {
        // Process win
        const winnerId = result.winner;
        const loserId = room.players.find(p => p.id !== winnerId).id;
        const winner = queries.getUserById(winnerId);
        const loser = queries.getUserById(loserId);
        const matchResult = processMatchResult(winner, loser);

        queries.updateUserStats(winnerId, winner.wins + 1, winner.losses, winner.draws, matchResult.winnerNewPoints);
        queries.updateUserStats(loserId, loser.wins, loser.losses + 1, loser.draws, matchResult.loserNewPoints);
        queries.recordMatch(winnerId, loserId, winnerId, 'online', matchResult.winnerChange, matchResult.loserChange, 'win');

        io.to(data.roomCode).emit('game-over', {
          result: 'win',
          winnerId,
          winLine: result.winLine,
          players: {
            [winnerId]: { change: matchResult.winnerChange, newPoints: matchResult.winnerNewPoints, rank: matchResult.winnerRank },
            [loserId]: { change: matchResult.loserChange, newPoints: matchResult.loserNewPoints, rank: matchResult.loserRank }
          }
        });
      }
    }
  });

  // Rematch
  socket.on('request-rematch', (data) => {
    const room = gameRooms.get(data.roomCode);
    if (!room) return;
    socket.to(data.roomCode).emit('rematch-requested', { from: data.userId });
  });

  socket.on('accept-rematch', (data) => {
    const room = gameRooms.get(data.roomCode);
    if (!room) return;
    room.reset();
    const p1 = queries.getUserById(room.players[0].id);
    const p2 = queries.getUserById(room.players[1].id);
    io.to(data.roomCode).emit('game-start', {
      roomCode: data.roomCode,
      players: [
        { ...p1, symbol: room.players[0].symbol },
        { ...p2, symbol: room.players[1].symbol }
      ],
      currentTurn: room.currentTurn,
      board: room.board
    });
  });

  // Invite friend
  socket.on('invite-friend', (data) => {
    const friendSocket = onlineUsers.get(data.friendId);
    if (friendSocket) {
      const inviter = queries.getUserById(data.userId);
      io.to(friendSocket).emit('game-invite', {
        from: inviter,
        roomCode: data.roomCode
      });
    }
  });

  // Chat in game
  socket.on('game-chat', (data) => {
    socket.to(data.roomCode).emit('game-chat', {
      message: data.message,
      from: data.userId
    });
  });

  // Disconnect
  socket.on('disconnect', () => {
    const userId = socketToUser.get(socket.id);
    if (userId) {
      onlineUsers.delete(userId);
      socketToUser.delete(socket.id);
    }

    // Handle game room cleanup
    for (const [code, room] of gameRooms) {
      const player = room.getPlayerBySocket(socket.id);
      if (player) {
        room.removePlayer(socket.id);
        socket.to(code).emit('opponent-disconnected', {
          message: 'Opponent disconnected'
        });
        if (room.players.length === 0) {
          gameRooms.delete(code);
        }
        break;
      }
    }
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// ── Start Server ──────────────────────────────────────────

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎮 XO Game Server running at http://localhost:${PORT}\n`);
});
