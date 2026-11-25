import React, { useState, useEffect } from 'react';
import './index.css';
import { socket } from './socket.js';
import { setupDiscord } from './discord.js';
import Lobby from './components/Lobby.jsx';
import WaitingRoom from './components/WaitingRoom.jsx';
import Game from './components/Game.jsx';
import GameOver from './components/GameOver.jsx';

const initialState = {
  screen: 'lobby',    // lobby | create | join | waiting | game | ended
  roomCode: null,
  myId: (typeof socket !== 'undefined' && socket?.id) || null,
  players: [],
  myCards: {},
  catastrophe: null,
  bunker: null,
  roundNumber: 1,
  phase: 'reveal',
  votes: {},
  chatMessages: [],
  isHost: false,
  packId: 'base',
  bunkerTheme: 'fallout',
  animeName: null,
  testMode: false,
  currentTurnPlayerId: null,
  turnQueue: [],
  revealedThisRound: [],
  error: null,
  winners: [],
  discordUser: null,  // { id, username, avatar, avatarUrl }
};

export default function App() {
  const [gameState, setGameState] = useState(() => ({
    ...initialState,
    myId: (typeof socket !== 'undefined' && socket?.id) || null,
  }));

  // Try Discord SDK on mount
  useEffect(() => {
    setupDiscord().then(result => {
      if (result && result.user) {
        console.log('[Discord] User authenticated:', result.user);
        setGameState(prev => ({
          ...prev,
          discordUser: result.user,
          players: prev.players.map(p => (p.id === prev.myId ? { ...p, username: result.user.username, avatarUrl: result.user.avatarUrl } : p)),
        }));
      }
    }).catch(err => console.error('[Discord] setupDiscord error:', err));
  }, []);

  useEffect(() => {
    if (socket.connected && socket.id) {
      setGameState(prev => ({ ...prev, myId: prev.myId || socket.id }));
    }

    socket.on('connect', () => {
      setGameState(prev => ({ ...prev, myId: socket.id }));
    });

    socket.on('room_created', (data) => {
      setGameState(prev => ({
        ...prev,
        screen: 'waiting',
        roomCode: data.roomCode,
        players: data.players || [],
        isHost: true,
        myId: prev.myId || socket.id || null,
        packId: data.packId || prev.packId,
        bunkerTheme: data.bunkerTheme || prev.bunkerTheme || 'fallout',
        animeName: data.animeName || null,
        testMode: data.testMode || false,
        error: null,
      }));
    });

    socket.on('room_joined', (data) => {
      setGameState(prev => ({
        ...prev,
        screen: 'waiting',
        roomCode: data.roomCode,
        players: data.players || [],
        isHost: false,
        myId: prev.myId || socket.id || null,
        packId: data.packId || prev.packId,
        bunkerTheme: data.bunkerTheme || prev.bunkerTheme || 'fallout',
        error: null,
      }));
    });

    socket.on('room_state', (data) => {
      setGameState(prev => ({
        ...prev,
        myId: prev.myId || socket.id || null,
        players: data.players || prev.players,
        currentTurnPlayerId: data.currentTurnPlayerId !== undefined ? data.currentTurnPlayerId : prev.currentTurnPlayerId,
        turnQueue: data.turnQueue || prev.turnQueue,
        revealedThisRound: data.revealedThisRound || prev.revealedThisRound,
        phase: data.phase || prev.phase,
        roundNumber: data.round !== undefined ? data.round : (data.roundNumber !== undefined ? data.roundNumber : prev.roundNumber),
        round: data.round !== undefined ? data.round : (data.roundNumber !== undefined ? data.roundNumber : prev.roundNumber),
        bunkerTheme: data.bunkerTheme || prev.bunkerTheme || 'fallout',
      }));
    });

    socket.on('game_started', (data) => {
      setGameState(prev => ({
        ...prev,
        screen: 'game',
        myId: prev.myId || socket.id || null,
        myCards: data.myCards || {},
        catastrophe: data.catastrophe,
        bunker: data.bunker,
        players: data.players || prev.players,
        roundNumber: data.roundNumber || data.round || 1,
        round: data.roundNumber || data.round || 1,
        phase: 'reveal',
        votes: {},
        testMode: data.testMode || prev.testMode,
        animeName: data.animeName || prev.animeName,
        packId: data.packId || prev.packId,
        bunkerTheme: data.bunkerTheme || prev.bunkerTheme || 'fallout',
        currentTurnPlayerId: data.currentTurnPlayerId || null,
        error: null,
      }));
    });

    socket.on('card_revealed', (data) => {
      setGameState(prev => ({
        ...prev,
        players: data.players || prev.players,
        revealedThisRound: data.playerId
          ? Array.from(new Set([...(prev.revealedThisRound || []), data.playerId]))
          : prev.revealedThisRound,
      }));
    });

    socket.on('turn_advanced', (data) => {
      setGameState(prev => ({
        ...prev,
        currentTurnPlayerId: data.nextTurnPlayerId !== undefined ? data.nextTurnPlayerId : prev.currentTurnPlayerId,
        roundNumber: data.roundNumber || data.round || prev.roundNumber,
        round: data.roundNumber || data.round || prev.roundNumber,
      }));
    });

    socket.on('round_advanced', (data) => {
      setGameState(prev => {
        const nextR = (data && data.roundNumber !== undefined)
          ? data.roundNumber
          : ((data && data.round !== undefined)
            ? data.round
            : ((prev.roundNumber || prev.round || 1) + 1));
        return {
          ...prev,
          roundNumber: nextR,
          round: nextR,
          revealedThisRound: [],
          phase: 'reveal',
          roundMessage: data?.message || null,
          currentTurnPlayerId: data?.nextTurnPlayerId !== undefined
            ? data.nextTurnPlayerId
            : (data?.turnQueue ? data.turnQueue[0] : prev.currentTurnPlayerId),
        };
      });
    });

    socket.on('round_started', (data) => {
      setGameState(prev => {
        const nextR = (data && data.roundNumber !== undefined)
          ? data.roundNumber
          : ((data && data.round !== undefined)
            ? data.round
            : ((prev.roundNumber || prev.round || 1) + 1));
        return {
          ...prev,
          roundNumber: nextR,
          round: nextR,
          revealedThisRound: [],
          phase: 'reveal',
        };
      });
    });

    socket.on('voting_started', (data) => {
      setGameState(prev => ({
        ...prev,
        phase: 'voting',
        roundNumber: data?.roundNumber || data?.round || prev.roundNumber || prev.round || 1,
        round: data?.roundNumber || data?.round || prev.roundNumber || prev.round || 1,
        votes: {},
        currentTurnPlayerId: null,
      }));
    });

    socket.on('vote_result', (data) => {
      setGameState(prev => {
        const rNum = data?.roundNumber || data?.round || prev.roundNumber || prev.round || 2;
        return {
          ...prev,
          phase: 'reveal',
          votes: data?.votes || {},
          players: data?.players || prev.players,
          roundNumber: rNum,
          round: rNum,
          ejectedPlayerId: data?.ejectedPlayerId,
          ejectedName: data?.ejectedName,
          currentTurnPlayerId: data?.currentTurnPlayerId !== undefined ? data.currentTurnPlayerId : prev.currentTurnPlayerId,
          revealedThisRound: [],
        };
      });
    });

    socket.on('game_ended', (data) => {
      setGameState(prev => ({
        ...prev,
        screen: 'ended',
        players: data.players || prev.players,
        winners: data.winners || [],
      }));
    });

    socket.on('chat_message', (data) => {
      setGameState(prev => ({
        ...prev,
        chatMessages: [...prev.chatMessages, { username: data.username, text: data.text, timestamp: data.ts }],
      }));
    });

    socket.on('player_joined', (data) => {
      setGameState(prev => ({ ...prev, players: data.players || prev.players }));
    });

    socket.on('player_left', (data) => {
      setGameState(prev => ({
        ...prev,
        players: (data.players || prev.players).filter(p => p.id !== data.playerId && p.connected !== false),
      }));
    });

    socket.on('error', (data) => {
      setGameState(prev => ({ ...prev, error: data.message || 'Ошибка' }));
    });

    return () => {
      socket.off('connect');
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('room_state');
      socket.off('game_started');
      socket.off('card_revealed');
      socket.off('turn_advanced');
      socket.off('round_advanced');
      socket.off('round_started');
      socket.off('voting_started');
      socket.off('vote_result');
      socket.off('game_ended');
      socket.off('chat_message');
      socket.off('player_joined');
      socket.off('player_left');
      socket.off('error');
    };
  }, []);

  const handleNewGame = () => {
    socket.disconnect();
    socket.connect();
    setGameState(prev => ({ ...initialState, myId: socket.id || prev.myId || null, discordUser: prev.discordUser }));
  };

  const { screen, error } = gameState;

  return (
    <div className="terminal-flicker" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {error && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          background: 'var(--bg)', border: '1px solid var(--border)', padding: '10px 20px',
          maxWidth: 400, fontSize: 13, color: 'var(--text)',
        }}>
          ⚠ {error}
          <button
            onClick={() => setGameState(prev => ({ ...prev, error: null }))}
            style={{ marginLeft: 16, color: 'var(--text)', fontSize: 14 }}
          >[ X ]</button>
        </div>
      )}

      {(screen === 'lobby' || screen === 'create' || screen === 'join') && (
        <Lobby gameState={gameState} setGameState={setGameState} />
      )}
      {screen === 'waiting' && <WaitingRoom gameState={gameState} setGameState={setGameState} />}
      {screen === 'game' && <Game gameState={gameState} setGameState={setGameState} />}
      {screen === 'ended' && <GameOver gameState={gameState} onNewGame={handleNewGame} />}
    </div>
  );
}
