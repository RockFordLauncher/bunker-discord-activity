import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { BunkerGame } from './game.js';
import { RoomManager } from './rooms.js';
import { SOCKET_EVENTS, GAME_PHASES } from '../shared/constants.js';

// ─── Config ──────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
const CLIENT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://discord.com',
  /\.discord\.com$/,
  /\.discordsays\.com$/,
];

// ─── App setup ───────────────────────────────────────────────────────────────

const app = express();
app.use(cors({ origin: CLIENT_ORIGINS, credentials: true }));
app.use(express.json({ limit: '10mb' }));

const httpServer = createServer(app);

const io = new Server(httpServer, {
  maxHttpBufferSize: 1e7, // 10MB to comfortably support custom 3D models with embedded textures
  cors: {
    origin: CLIENT_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ─── Game state ───────────────────────────────────────────────────────────────

const game = new BunkerGame();
const rooms = new RoomManager(game);

// ─── REST endpoints ───────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ...rooms.stats(), uptime: process.uptime() });
});

// Serve frontend static build (client/dist)
const distPath = path.resolve(__dirname, '../client/dist');
app.use(express.static(distPath));

// Discord OAuth2 Token Exchange
app.post('/api/token', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Missing code' });
    }

    const clientId = process.env.DISCORD_CLIENT_ID || '1574931331341750383';
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;

    if (!clientSecret) {
      console.warn('[/api/token] DISCORD_CLIENT_SECRET not configured in environment variables');
      return res.status(500).json({ error: 'Server OAuth secret not set' });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code: code,
    });

    const discordRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await discordRes.json();
    if (!discordRes.ok) {
      console.error('[/api/token] Discord error:', data);
      return res.status(discordRes.status).json(data);
    }

    res.json({ access_token: data.access_token });
  } catch (err) {
    console.error('[/api/token] Error exchanging token:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/rooms/:code', (req, res) => {
  try {
    const state = game.getRoomState(req.params.code, null);
    res.json(state);
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

// ─── Socket.io ───────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  const { id } = socket;
  console.log(`[+] Connected: ${id}`);

  // ── Helper: broadcast room state to everyone in the room ──────────────────
  const broadcastRoomState = (roomCode) => {
    const roomData = game.rooms.get(roomCode);
    if (!roomData) return;

    for (const [playerId] of roomData.players) {
      // Skip bots
      const player = roomData.players.get(playerId);
      if (player?.isBot) continue;

      const playerSocket = io.sockets.sockets.get(playerId);
      if (playerSocket) {
        const state = game.getRoomState(roomCode, playerId);
        playerSocket.emit(SOCKET_EVENTS.ROOM_STATE, state);
      }
    }
  };

  // ── Helper: emit error back to caller ─────────────────────────────────────
  const emitError = (msg) => {
    socket.emit(SOCKET_EVENTS.ERROR, { message: msg });
    console.warn(`[!] ${id} error: ${msg}`);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // create_room
  // ─────────────────────────────────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.CREATE_ROOM, ({ packId = 'base', packIds, username = 'Хост', avatarUrl = null, testMode = false, customization = null } = {}, ack) => {
    try {
      // Support both old packIds array and new packId string
      const finalPackId = packId || (packIds && packIds[0]) || 'base';

      const { roomCode, animeName } = game.createRoom(id, finalPackId, testMode);
      // Auto-join host as a player
      game.joinRoom(roomCode, id, username, false, customization, avatarUrl);
      rooms.socketRooms.set(id, roomCode);
      socket.join(roomCode);

      // If test mode, add bots
      if (testMode) {
        game.addBots(roomCode, 5);
      }

      const state = game.getRoomState(roomCode, id);
      const payload = {
        roomCode,
        players: state.players || [],
        packId: finalPackId,
        animeName,
        testMode,
        hostId: id,
      };
      socket.emit(SOCKET_EVENTS.ROOM_CREATED, payload);
      if (typeof ack === 'function') ack({ ok: true, ...payload });
      console.log(`[room] Created ${roomCode} by ${username} (${id}) pack=${finalPackId} test=${testMode} anime=${animeName || 'none'}`);
    } catch (e) {
      emitError(e.message);
      if (typeof ack === 'function') ack({ ok: false, error: e.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // join_room
  // ─────────────────────────────────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.JOIN_ROOM, ({ roomCode, username, avatarUrl = null, customization = null } = {}, ack) => {
    try {
      if (!roomCode || !username) throw new Error('Нужны roomCode и username');
      const normalizedCode = roomCode.toUpperCase();
      game.joinRoom(normalizedCode, id, username, false, customization, avatarUrl);
      rooms.socketRooms.set(id, normalizedCode);
      socket.join(normalizedCode);

      const state = game.getRoomState(normalizedCode, id);
      const payload = {
        roomCode: normalizedCode,
        players: state.players || [],
        packId: state.packId,
      };
      socket.emit(SOCKET_EVENTS.ROOM_JOINED, payload);
      if (typeof ack === 'function') ack({ ok: true, ...payload });

      // Notify others with updated player list
      const updatedState = game.getRoomState(normalizedCode, null);
      socket.to(normalizedCode).emit(SOCKET_EVENTS.PLAYER_JOINED, {
        playerId: id,
        username,
        players: updatedState.players || [],
      });

      console.log(`[room] ${username} (${id}) joined ${normalizedCode}`);
    } catch (e) {
      emitError(e.message);
      if (typeof ack === 'function') ack({ ok: false, error: e.message });
    }
  });

  // ── Helper: bot turn processor ──────────────────────────────────────────
  const handleTurnExecution = (roomCode) => {
    const room = game.rooms.get(roomCode);
    if (!room || room.phase !== GAME_PHASES.PLAYING) return;

    const currentId = room.currentTurnPlayerId;
    if (!currentId) return;

    const player = room.players.get(currentId);
    if (player && player.isBot) {
      setTimeout(() => {
        try {
          const currentRoom = game.rooms.get(roomCode);
          if (!currentRoom || currentRoom.phase !== GAME_PHASES.PLAYING || currentRoom.currentTurnPlayerId !== currentId) return;

          // 1. Bot reveals card
          const result = game.botPlayTurn(roomCode, currentId);
          if (!result) return;

          const p = currentRoom.players.get(currentId);
          io.to(roomCode).emit(SOCKET_EVENTS.CARD_REVEALED, {
            playerId: currentId,
            username: p?.username || 'БОТ',
            cardType: result.cardType,
            cardData: result.card,
            isExplaining: true,
            currentTurnPlayerId: currentId,
          });

          broadcastRoomState(roomCode);

          // 2. Simulated bot explanation pause (2.5s) so players can read the card
          setTimeout(() => {
            try {
              const r = game.rooms.get(roomCode);
              if (!r || r.phase !== GAME_PHASES.PLAYING || r.currentTurnPlayerId !== currentId) return;

              // Bot finishes explanation
              const finishResult = game.finishExplanation(roomCode, currentId);
              io.to(roomCode).emit('turn_advanced', {
                playerId: currentId,
                nextTurnPlayerId: finishResult.nextTurnPlayerId,
                roundComplete: finishResult.roundComplete,
                roundNumber: finishResult.roundNumber,
              });

              if (finishResult.roundComplete) {
                if (finishResult.noKickRound) {
                  // Round 1 completed without kicking anyone!
                  io.to(roomCode).emit('round_advanced', {
                    roundNumber: 2,
                    message: 'РАУНД 1 ЗАВЕРШЁН: Ознакомление окончено. Все участники переходят во 2-й раунд без изгнания!',
                  });
                  broadcastRoomState(roomCode);
                  setTimeout(() => handleTurnExecution(roomCode), 2000);
                } else {
                  // Round >= 2: Start voting!
                  setTimeout(() => {
                    try {
                      const rVote = game.rooms.get(roomCode);
                      if (rVote && rVote.phase === GAME_PHASES.PLAYING) {
                        game.startVoting(roomCode, rVote.hostId);
                        io.to(roomCode).emit(SOCKET_EVENTS.VOTING_STARTED, { roundNumber: rVote.round });
                        broadcastRoomState(roomCode);
                      }
                    } catch (e) {
                      console.warn('[vote-auto] error starting voting:', e.message);
                    }
                  }, 1800);
                }
              } else {
                broadcastRoomState(roomCode);
                handleTurnExecution(roomCode);
              }
            } catch (e) {
              console.warn('[bot-finish] Error finishing bot explanation:', e.message);
            }
          }, 2400);
        } catch (e) {
          console.warn('[bot-turn] Error playing turn:', e.message);
        }
      }, 1500);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // start_game
  // ─────────────────────────────────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.START_GAME, (_, ack) => {
    try {
      const roomCode = rooms.getRoomCode(id);
      if (!roomCode) throw new Error('Вы не в комнате');

      const room = game.startGame(roomCode, id);

      // Send each REAL player their own cards + all players info
      for (const [playerId] of room.players) {
        const player = room.players.get(playerId);
        if (player?.isBot) continue;

        const playerSocket = io.sockets.sockets.get(playerId);
        if (!playerSocket) continue;
        const hand = room.hands[playerId];
        const state = game.getRoomState(roomCode, playerId);
        playerSocket.emit(SOCKET_EVENTS.GAME_STARTED, {
          roundNumber: room.round,
          catastrophe: room.catastrophe,
          bunker: room.bunker,
          myCards: {
            profession: hand.profession,
            health: hand.health,
            hobby: hand.hobby,
            baggage: hand.baggage,
            fact: hand.fact,
            biology: hand.biology,
            special: hand.special,
          },
          players: state.players,
          testMode: room.testMode,
          animeName: room.animeName,
          packId: room.packId,
          currentTurnPlayerId: room.currentTurnPlayerId,
        });
      }

      broadcastRoomState(roomCode);
      if (typeof ack === 'function') ack({ ok: true });
      console.log(`[game] Started in room ${roomCode}, first turn: ${room.currentTurnPlayerId}`);

      // If first player is a bot, start their turn
      handleTurnExecution(roomCode);
    } catch (e) {
      emitError(e.message);
      if (typeof ack === 'function') ack({ ok: false, error: e.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // reveal_card
  // ─────────────────────────────────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.REVEAL_CARD, ({ cardType } = {}, ack) => {
    try {
      const roomCode = rooms.getRoomCode(id);
      if (!roomCode) throw new Error('Вы не в комнате');

      const result = game.revealCard(roomCode, id, cardType);
      const room = game.rooms.get(roomCode);
      const player = room.players.get(id);

      io.to(roomCode).emit(SOCKET_EVENTS.CARD_REVEALED, {
        playerId: id,
        username: player?.username || 'Игрок',
        cardType: result.cardType,
        cardData: result.card,
        isExplaining: true,
        currentTurnPlayerId: id,
      });

      broadcastRoomState(roomCode);
      if (typeof ack === 'function') ack({ ok: true, result });
    } catch (e) {
      emitError(e.message);
      if (typeof ack === 'function') ack({ ok: false, error: e.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // finish_explanation (ends active player's explanation and passes turn)
  // ─────────────────────────────────────────────────────────────────────────
  socket.on('finish_explanation', (_, ack) => {
    try {
      const roomCode = rooms.getRoomCode(id);
      if (!roomCode) throw new Error('Вы не в комнате');

      const finishResult = game.finishExplanation(roomCode, id);
      io.to(roomCode).emit('turn_advanced', {
        playerId: id,
        nextTurnPlayerId: finishResult.nextTurnPlayerId,
        roundComplete: finishResult.roundComplete,
        roundNumber: finishResult.roundNumber,
      });

      broadcastRoomState(roomCode);
      if (typeof ack === 'function') ack({ ok: true, result: finishResult });

      if (finishResult.roundComplete) {
        if (finishResult.noKickRound) {
          io.to(roomCode).emit('round_advanced', {
            roundNumber: 2,
            message: 'РАУНД 1 ЗАВЕРШЁН: Ознакомление окончено. Все участники переходят во 2-й раунд без изгнания!',
          });
          broadcastRoomState(roomCode);
          setTimeout(() => handleTurnExecution(roomCode), 2000);
        } else {
          setTimeout(() => {
            try {
              const rVote = game.rooms.get(roomCode);
              if (rVote && rVote.phase === GAME_PHASES.PLAYING) {
                game.startVoting(roomCode, rVote.hostId);
                io.to(roomCode).emit(SOCKET_EVENTS.VOTING_STARTED, { roundNumber: rVote.round });
                broadcastRoomState(roomCode);
              }
            } catch (e) {
              console.warn('[vote-auto] error starting voting:', e.message);
            }
          }, 1800);
        }
      } else {
        handleTurnExecution(roomCode);
      }
    } catch (e) {
      emitError(e.message);
      if (typeof ack === 'function') ack({ ok: false, error: e.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // start_voting (host-only)
  // ─────────────────────────────────────────────────────────────────────────
  socket.on('start_voting', (_, ack) => {
    try {
      const roomCode = rooms.getRoomCode(id);
      if (!roomCode) throw new Error('Вы не в комнате');

      const room = game.startVoting(roomCode, id);
      
      // Emit to real players only
      for (const [playerId] of room.players) {
        const player = room.players.get(playerId);
        if (player?.isBot) continue;
        const playerSocket = io.sockets.sockets.get(playerId);
        if (playerSocket) {
          playerSocket.emit(SOCKET_EVENTS.VOTING_STARTED, { roundNumber: room.round });
        }
      }
      
      broadcastRoomState(roomCode);
      if (typeof ack === 'function') ack({ ok: true });
    } catch (e) {
      emitError(e.message);
      if (typeof ack === 'function') ack({ ok: false, error: e.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // vote
  // ─────────────────────────────────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.VOTE, ({ targetId } = {}, ack) => {
    try {
      const roomCode = rooms.getRoomCode(id);
      if (!roomCode) throw new Error('Вы не в комнате');

      const result = game.vote(roomCode, id, targetId);
      io.to(roomCode).emit(SOCKET_EVENTS.VOTE_CAST, { voterId: id });

      // In test mode, auto end voting after human votes
      const room = game.rooms.get(roomCode);
      if (room?.testMode) {
        setTimeout(() => {
          try {
            const voteResult = game.endVoting(roomCode, room.hostId);
            const state = game.getRoomState(roomCode, null);

            // Emit to real players
            for (const [playerId] of room.players) {
              const player = room.players.get(playerId);
              if (player?.isBot) continue;
              const playerSocket = io.sockets.sockets.get(playerId);
              if (playerSocket) {
                const pState = game.getRoomState(roomCode, playerId);
                playerSocket.emit(SOCKET_EVENTS.VOTE_RESULT, {
                  ejectedPlayerId: voteResult.eliminated?.id || null,
                  ejectedName: voteResult.eliminated?.username || null,
                  votes: voteResult.tally,
                  players: pState.players,
                  roundNumber: pState.round,
                  tie: voteResult.tie,
                  currentTurnPlayerId: pState.currentTurnPlayerId,
                });
              }
            }

            broadcastRoomState(roomCode);

            if (voteResult.winResult?.gameOver) {
              const finalState = game.getRoomState(roomCode, null);
              for (const [playerId] of room.players) {
                const player = room.players.get(playerId);
                if (player?.isBot) continue;
                const playerSocket = io.sockets.sockets.get(playerId);
                if (playerSocket) {
                  playerSocket.emit(SOCKET_EVENTS.GAME_ENDED, {
                    winners: voteResult.winResult.survivors.map(s => ({ id: s.id, username: s.username })),
                    players: finalState.players,
                  });
                }
              }
            } else {
              // Start turn execution for the next round
              setTimeout(() => {
                handleTurnExecution(roomCode);
              }, 1200);
            }
          } catch (e) {
            console.warn('[test-vote] Error auto-ending vote:', e.message);
          }
        }, 1500);
      }

      if (typeof ack === 'function') ack({ ok: true, result });
    } catch (e) {
      emitError(e.message);
      if (typeof ack === 'function') ack({ ok: false, error: e.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // end_voting (host only)
  // ─────────────────────────────────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.END_VOTING, (_, ack) => {
    try {
      const roomCode = rooms.getRoomCode(id);
      if (!roomCode) throw new Error('Вы не в комнате');

      const result = game.endVoting(roomCode, id);
      const state = game.getRoomState(roomCode, null);

      io.to(roomCode).emit(SOCKET_EVENTS.VOTE_RESULT, {
        ejectedPlayerId: result.eliminated?.id || null,
        ejectedName: result.eliminated?.username || null,
        votes: result.tally,
        players: state.players,
        roundNumber: state.round,
        tie: result.tie,
        currentTurnPlayerId: state.currentTurnPlayerId,
      });

      if (result.winResult?.gameOver) {
        const finalState = game.getRoomState(roomCode, null);
        io.to(roomCode).emit(SOCKET_EVENTS.GAME_ENDED, {
          winners: result.winResult.survivors.map(s => ({ id: s.id, username: s.username })),
          players: finalState.players,
        });
      }

      broadcastRoomState(roomCode);
      if (typeof ack === 'function') ack({ ok: true, result });
    } catch (e) {
      emitError(e.message);
      if (typeof ack === 'function') ack({ ok: false, error: e.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // next_round (host only)
  // ─────────────────────────────────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.NEXT_ROUND, (_, ack) => {
    try {
      const roomCode = rooms.getRoomCode(id);
      if (!roomCode) throw new Error('Вы не в комнате');

      const room = game.nextRound(roomCode, id);
      io.to(roomCode).emit('round_started', { round: room.round });
      broadcastRoomState(roomCode);
      if (typeof ack === 'function') ack({ ok: true, round: room.round });
    } catch (e) {
      emitError(e.message);
      if (typeof ack === 'function') ack({ ok: false, error: e.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // use_special
  // ─────────────────────────────────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.USE_SPECIAL, ({ action, targetId } = {}, ack) => {
    try {
      const roomCode = rooms.getRoomCode(id);
      if (!roomCode) throw new Error('Вы не в комнате');

      const result = game.useSpecialCard(roomCode, id, action, targetId);

      if (result.privateOnly) {
        socket.emit('special_result', result);
      } else {
        io.to(roomCode).emit('special_result', result);
      }

      broadcastRoomState(roomCode);
      if (typeof ack === 'function') ack({ ok: true, result });
    } catch (e) {
      emitError(e.message);
      if (typeof ack === 'function') ack({ ok: false, error: e.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // player_cards_pose (broadcast card-holding state to room)
  // ─────────────────────────────────────────────────────────────────────────
  socket.on('player_cards_pose', ({ cardsRaised } = {}) => {
    try {
      const roomCode = rooms.getRoomCode(id);
      if (!roomCode) return;
      socket.to(roomCode).emit('player_cards_pose', {
        playerId: id,
        cardsRaised: Boolean(cardsRaised),
      });
    } catch {
      // Non-critical visual sync
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // head_rotation (broadcast look direction to other players)
  // ─────────────────────────────────────────────────────────────────────────
  socket.on('head_rotation', ({ yaw, pitch } = {}) => {
    try {
      const roomCode = rooms.getRoomCode(id);
      if (!roomCode) return;
      socket.to(roomCode).emit('head_rotation', {
        playerId: id,
        yaw: Number(yaw) || 0,
        pitch: Number(pitch) || 0,
      });
    } catch {
      // Non-critical visual sync
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // chat_message
  // ─────────────────────────────────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.CHAT_MESSAGE, ({ text } = {}, ack) => {
    try {
      const roomCode = rooms.getRoomCode(id);
      if (!roomCode) throw new Error('Вы не в комнате');
      if (!text?.trim()) throw new Error('Пустое сообщение');

      const msg = game.addChatMessage(roomCode, id, text.trim());
      io.to(roomCode).emit(SOCKET_EVENTS.CHAT_MESSAGE, msg);
      if (typeof ack === 'function') ack({ ok: true });
    } catch (e) {
      emitError(e.message);
      if (typeof ack === 'function') ack({ ok: false, error: e.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // get_room_state (re-sync)
  // ─────────────────────────────────────────────────────────────────────────
  socket.on('get_room_state', (_, ack) => {
    try {
      const state = rooms.getRoomState(id);
      if (!state) throw new Error('Вы не в комнате');
      socket.emit(SOCKET_EVENTS.ROOM_STATE, state);
      if (typeof ack === 'function') ack({ ok: true, state });
    } catch (e) {
      emitError(e.message);
      if (typeof ack === 'function') ack({ ok: false, error: e.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // disconnect
  // ─────────────────────────────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    console.log(`[-] Disconnected: ${id} (${reason})`);
    const roomCode = rooms.getRoomCode(id);
    const updatedRoom = rooms.removeSocket(id);

    if (updatedRoom && roomCode) {
      io.to(roomCode).emit(SOCKET_EVENTS.PLAYER_LEFT, { playerId: id });
      broadcastRoomState(roomCode);
    }
  });
});

// SPA fallback: any non-API route serves index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`\n🚀 Bunker server running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Env: ${process.env.NODE_ENV || 'development'}\n`);
});
