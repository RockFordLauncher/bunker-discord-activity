import React, { useState } from 'react';
import { socket } from '../socket.js';
import { BUNKER_THEMES } from './Lobby.jsx';

const MAX_SLOTS = 12;

const RULES = [
  'Каждый участник получает случайный набор характеристик.',
  'Задача — убедить группу в своей ценности для выживания.',
  'В каждом раунде игроки по очереди раскрывают по одной карте.',
  'По итогам обсуждения проходит голосование за исключение.',
  'Мест в бункере обычно вдвое меньше стартового состава.',
];

export default function WaitingRoom({ gameState, setGameState }) {
  const { roomCode, players = [], isHost, packId, animeName, testMode } = gameState;
  const [copied, setCopied] = useState(false);

  const bunkerTheme = gameState?.bunkerTheme || (() => {
    try {
      return localStorage.getItem('bunker_theme') || 'fallout';
    } catch {
      return 'fallout';
    }
  })();

  const handleSelectBunkerTheme = (themeId) => {
    try {
      localStorage.setItem('bunker_theme', themeId);
    } catch {
      // ignore storage errors
    }
    setGameState(prev => ({ ...prev, bunkerTheme: themeId }));
  };

  const copyCode = () => {
    if (navigator.clipboard && roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  const startGame = () => {
    socket.emit('start_game');
  };

  const leaveRoom = () => {
    socket.disconnect();
    socket.connect();
    setGameState(prev => ({
      ...prev,
      screen: 'lobby',
      roomCode: null,
      players: [],
      isHost: false,
    }));
  };

  const slots = [];
  for (let i = 0; i < MAX_SLOTS; i++) {
    slots.push(players[i] || null);
  }

  const activeTheme = BUNKER_THEMES.find(t => t.id === bunkerTheme) || BUNKER_THEMES[0];
  const packTitle = (animeName ? `АНИМЕ — ${animeName}` : (packId || 'БАЗОВЫЙ')).toUpperCase();

  return (
    <div style={styles.page}>
      {/* Top Bar */}
      <div style={styles.topBar}>
        <div style={styles.topLeft}>
          <button onClick={leaveRoom} style={styles.backBtn}>← ВЫХОД</button>
          <div>
            <div style={styles.roomTitle}>СБОР ГРУППЫ</div>
            <div style={styles.roomMeta}>
              НАБОР: {packTitle}
              {testMode ? ' // ТЕСТ-РЕЖИМ' : ''}
            </div>
          </div>
        </div>

        <div style={styles.topRight}>
          <div style={styles.codeBlock} onClick={copyCode} title="Нажмите, чтобы скопировать">
            <div style={styles.metaLabel}>
              {copied ? 'СКОПИРОВАНО' : 'КОД ДОСТУПА'}
            </div>
            <div style={styles.codeDisplay}>{roomCode || '------'}</div>
          </div>

          <div style={styles.statusBlock}>
            <div style={styles.metaLabel}>УЧАСТНИКИ</div>
            <div style={styles.countDisplay}>
              {players.length} / {MAX_SLOTS}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.content}>
        {/* Left Column: Protocol & 3D Bunker Theme */}
        <div style={styles.leftColumn}>
          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <span>ПРОТОКОЛ ИГРЫ</span>
              <span style={styles.panelCode}>SEC-07</span>
            </div>
            <div style={styles.rulesList}>
              {RULES.map((rule, i) => (
                <div key={i} style={styles.ruleItem}>
                  <span style={styles.ruleIndex}>0{i + 1}</span>
                  <span>{rule}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <span>3D БУНКЕР (ТЕМА ЛОКАЦИИ)</span>
              <span style={{ ...styles.panelCode, color: activeTheme.accent }}>{activeTheme.code}</span>
            </div>
            <div style={styles.themeList}>
              {BUNKER_THEMES.map((t) => {
                const active = bunkerTheme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectBunkerTheme(t.id)}
                    style={styles.themeBtn(active, t.accent)}
                  >
                    <span style={{ ...styles.themeIndicator, background: active ? t.accent : 'var(--border)' }} />
                    <span style={styles.themeName}>{t.label}</span>
                    <span style={styles.themeShortCode}>{t.code}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Operator Grid */}
        <div style={styles.gridPanel}>
          <div style={styles.playerGrid}>
            {slots.map((player, i) => (
              <div key={i} style={styles.slot(!!player)}>
                {player ? (
                  <>
                    <div style={styles.slotTopRow}>
                      <span style={styles.slotIndex}>#{String(i + 1).padStart(2, '0')}</span>
                      <span style={styles.roleTag(player.isHost, player.isBot)}>
                        {player.isHost ? 'HOST' : (player.isBot ? 'BOT' : 'LIVE')}
                      </span>
                    </div>

                    <div style={styles.slotAvatar}>
                      {player.avatarUrl ? (
                        <img src={player.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={styles.avatarFallback}>
                          {player.isBot ? 'AI' : (player.username || '?')[0].toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div style={styles.slotName}>
                      {(player.username || 'UNKNOWN').toUpperCase()}
                    </div>
                    <div style={styles.slotRole}>
                      {player.isHost ? 'ЛИДЕР' : (player.isBot ? 'БОТ' : 'ОПЕРАТОР')}
                    </div>
                  </>
                ) : (
                  <div style={styles.emptySlot}>
                    <div style={styles.emptyIndex}>#{String(i + 1).padStart(2, '0')}</div>
                    <div style={styles.emptyLabel}>СВОБОДНО</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div style={styles.bottomBar}>
        <div style={styles.bottomLeft}>
          МИНИМУМ 2 УЧАСТНИКА ДЛЯ СТАРТА.{' '}
          {isHost ? 'ВЫ МОЖЕТЕ ЗАПУСТИТЬ СЕССИЮ.' : 'ОЖИДАНИЕ РЕШЕНИЯ ЛИДЕРА.'}
        </div>
        <div>
          {isHost ? (
            <button
              className="btn-terminal primary"
              style={{ padding: '12px 32px', width: 'auto' }}
              onClick={startGame}
              disabled={players.length < 2}
            >
              ЗАКРЫТЬ ГЕРМОЗАТВОР
            </button>
          ) : (
            <div style={styles.waitingText}>ОЖИДАНИЕ ЛИДЕРА...</div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg)',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid var(--border-dim)',
    background: 'rgba(0, 0, 0, 0.35)',
    gap: 16,
    flexWrap: 'wrap',
  },
  topLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  topRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
  },
  backBtn: {
    padding: '8px 14px',
    border: '1px solid var(--border)',
    background: '#12161d',
    color: 'var(--text-muted)',
    fontSize: 11,
  },
  roomTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: 2.5,
    lineHeight: 1.1,
  },
  roomMeta: {
    fontSize: 11,
    color: 'var(--amber)',
    letterSpacing: 1.5,
    marginTop: 3,
  },
  codeBlock: {
    cursor: 'pointer',
    padding: '6px 14px',
    border: '1px solid var(--border)',
    background: '#0d1015',
    textAlign: 'right',
  },
  statusBlock: {
    textAlign: 'right',
  },
  metaLabel: {
    fontSize: 9,
    color: 'var(--text-dim)',
    letterSpacing: 1.5,
  },
  codeDisplay: {
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: 5,
    color: 'var(--amber-bright)',
    lineHeight: 1.2,
  },
  countDisplay: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 2,
    color: 'var(--text)',
  },
  content: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '320px 1fr',
    gap: 20,
    padding: '20px 24px',
    minHeight: 0,
  },
  leftColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  panel: {
    border: '1px solid var(--border-dim)',
    background: '#11151b',
    padding: '14px 16px',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1.6,
    color: 'var(--amber)',
    borderBottom: '1px solid var(--border-dim)',
    paddingBottom: 8,
    marginBottom: 12,
  },
  panelCode: {
    fontSize: 10,
    color: 'var(--text-dim)',
  },
  rulesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  ruleItem: {
    display: 'flex',
    gap: 10,
    fontSize: 12,
    color: 'var(--text-muted)',
    lineHeight: 1.45,
  },
  ruleIndex: {
    color: 'var(--amber)',
    fontWeight: 700,
    fontSize: 11,
    flexShrink: 0,
  },
  themeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  themeBtn: (active, accent) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    border: `1px solid ${active ? accent : 'var(--border-dim)'}`,
    background: active ? 'rgba(255, 255, 255, 0.05)' : '#0c0f14',
    textAlign: 'left',
    width: '100%',
    textTransform: 'none',
    letterSpacing: 0.4,
  }),
  themeIndicator: {
    width: 6,
    height: 16,
    flexShrink: 0,
  },
  themeName: {
    flex: 1,
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  themeShortCode: {
    fontSize: 9,
    color: 'var(--text-dim)',
    letterSpacing: 1,
  },
  gridPanel: {
    minWidth: 0,
  },
  playerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))',
    gap: 10,
  },
  slot: (filled) => ({
    border: `1px solid ${filled ? 'var(--border)' : 'var(--border-dim)'}`,
    background: filled ? 'linear-gradient(180deg, #161b23 0%, #11151b 100%)' : 'rgba(13, 16, 21, 0.5)',
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minHeight: 142,
    justifyContent: 'space-between',
  }),
  slotTopRow: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  slotIndex: {
    fontSize: 9,
    color: 'var(--text-dim)',
    letterSpacing: 1,
  },
  roleTag: (isHost, isBot) => ({
    fontSize: 9,
    fontWeight: 700,
    padding: '1px 5px',
    letterSpacing: 1,
    background: isHost ? 'var(--amber)' : (isBot ? '#28303d' : 'rgba(70, 168, 112, 0.2)'),
    color: isHost ? '#0b0d10' : (isBot ? 'var(--text-muted)' : 'var(--success)'),
    border: `1px solid ${isHost ? 'var(--amber)' : (isBot ? 'var(--border)' : 'var(--success)')}`,
  }),
  slotAvatar: {
    width: 54,
    height: 54,
    border: '1px solid var(--border)',
    background: '#0d1015',
    overflow: 'hidden',
    marginBottom: 6,
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--text-muted)',
  },
  slotName: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.8,
    textAlign: 'center',
    wordBreak: 'break-word',
    color: 'var(--text)',
  },
  slotRole: {
    fontSize: 9,
    color: 'var(--text-dim)',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  emptySlot: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyIndex: {
    fontSize: 11,
    color: 'var(--border)',
    letterSpacing: 1.5,
  },
  emptyLabel: {
    fontSize: 9,
    color: 'var(--text-dim)',
    letterSpacing: 1.5,
  },
  bottomBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 24px',
    borderTop: '1px solid var(--border-dim)',
    background: 'rgba(0, 0, 0, 0.35)',
    gap: 16,
    flexWrap: 'wrap',
  },
  bottomLeft: {
    fontSize: 11,
    color: 'var(--text-muted)',
    letterSpacing: 1,
  },
  waitingText: {
    fontSize: 12,
    color: 'var(--amber)',
    letterSpacing: 2,
    fontWeight: 600,
  },
};
