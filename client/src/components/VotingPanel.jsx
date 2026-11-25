import React, { useState } from 'react';
import { socket } from '../socket.js';
import { bunkerAudio } from '../audio/bunkerAudio.js';

export default function VotingPanel({ players = [], myId }) {
  const [selected, setSelected] = useState(null);
  const [voted, setVoted] = useState(false);

  const myPlayer = players.find(p => p.id === myId);
  if (myPlayer?.eliminated) return null;

  const votablePlayers = players.filter(p => p.id !== myId && !p.eliminated && !p.isEliminated);

  const handleVote = () => {
    if (!selected) return;
    bunkerAudio.playCardSlap();
    socket.emit('vote', { targetId: selected });
    setVoted(true);
  };

  const selectPlayer = (id) => {
    bunkerAudio.playPipBoySelect();
    setSelected(id);
  };

  if (voted) {
    return (
      <div style={styles.overlay}>
        <div style={styles.panel}>
          <div style={styles.headerRow}>
            <span style={styles.tag}>БЮЛЛЕТЕНЬ</span>
            <span style={styles.statusOk}>ПРИНЯТ</span>
          </div>
          <div style={styles.title}>ГОЛОС ЗАСЧИТАН</div>
          <div style={styles.subtitle}>Ожидание решения остальных участников.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <div style={styles.headerRow}>
          <span style={styles.tag}>ГОЛОСОВАНИЕ</span>
          <span style={styles.count}>{votablePlayers.length} КАНД.</span>
        </div>

        <div style={styles.title}>ИСКЛЮЧЕНИЕ ИЗ БУНКЕРА</div>
        <div style={styles.subtitle}>Выберите одного участника для изгнания.</div>

        <div style={styles.playerList}>
          {votablePlayers.map(player => {
            const isSelected = selected === player.id;
            return (
              <button
                key={player.id}
                style={styles.playerBtn(isSelected)}
                onClick={() => selectPlayer(player.id)}
              >
                <span style={styles.radio(isSelected)} />
                <span style={styles.playerName}>
                  {(player.username || 'UNKNOWN').toUpperCase()}
                </span>
                {player.isBot && <span style={styles.botBadge}>БОТ</span>}
              </button>
            );
          })}
          {votablePlayers.length === 0 && (
            <div style={styles.emptyText}>Нет доступных кандидатов</div>
          )}
        </div>

        <button
          style={styles.confirmBtn(Boolean(selected))}
          onClick={handleVote}
          disabled={!selected}
        >
          ПОДТВЕРДИТЬ ВЫБОР
        </button>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(6, 8, 10, 0.86)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: 20,
  },
  panel: {
    border: '1px solid #303741',
    borderTop: '3px solid #c94a4a',
    background: '#111418',
    padding: '22px 24px',
    width: '100%',
    maxWidth: 420,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    borderRadius: 2,
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tag: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: '#c94a4a',
    fontWeight: 700,
  },
  statusOk: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: '#4ea868',
    fontWeight: 700,
  },
  count: {
    fontSize: 10,
    letterSpacing: 1.2,
    color: '#7a8494',
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 1.5,
    color: '#e4e7eb',
  },
  subtitle: {
    fontSize: 12,
    color: '#8b95a5',
    lineHeight: 1.4,
  },
  playerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    maxHeight: 280,
    overflowY: 'auto',
    marginTop: 4,
  },
  playerBtn: (selected) => ({
    padding: '10px 12px',
    border: `1px solid ${selected ? '#d4a017' : '#262c35'}`,
    background: selected ? 'rgba(212, 160, 23, 0.1)' : '#15191f',
    color: '#e4e7eb',
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 13,
    fontFamily: 'var(--font)',
    letterSpacing: 1,
    borderRadius: 2,
    textTransform: 'none',
  }),
  radio: (selected) => ({
    width: 10,
    height: 10,
    borderRadius: 1,
    border: `1px solid ${selected ? '#d4a017' : '#556070'}`,
    background: selected ? '#d4a017' : 'transparent',
    flexShrink: 0,
  }),
  playerName: {
    flex: 1,
    fontWeight: 600,
  },
  botBadge: {
    fontSize: 10,
    padding: '2px 6px',
    border: '1px solid #2b323b',
    color: '#7a8494',
    letterSpacing: 1,
  },
  emptyText: {
    textAlign: 'center',
    color: '#7a8494',
    fontSize: 12,
    padding: 12,
  },
  confirmBtn: (enabled) => ({
    marginTop: 6,
    padding: '12px 16px',
    border: `1px solid ${enabled ? '#c94a4a' : '#2b323b'}`,
    background: enabled ? '#c94a4a' : '#181c22',
    color: enabled ? '#0d0f12' : '#5a6370',
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: 1.5,
    cursor: enabled ? 'pointer' : 'not-allowed',
    borderRadius: 2,
    textAlign: 'center',
  }),
};
