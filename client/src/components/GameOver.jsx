import React from 'react';

export default function GameOver({ gameState, onNewGame }) {
  const { players = [], winners = [] } = gameState;
  const winnerIds = new Set(winners.map(w => w.id || w));
  const winnerPlayers = players.filter(p => winnerIds.has(p.id));
  const loserPlayers = players.filter(p => !winnerIds.has(p.id));

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.statusTag}>РАПОРТ // ИТОГИ СЕССИИ</div>
          <div style={styles.title}>БУНКЕР ЗАГЕРМЕТИЗИРОВАН</div>
          <div style={styles.subtitle}>Окончательный состав выживших утверждён.</div>
        </div>

        {winnerPlayers.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionLabel}>ДОПУЩЕНЫ В БУНКЕР ({winnerPlayers.length})</div>
            <div style={styles.list}>
              {winnerPlayers.map((p, i) => (
                <div key={p.id || i} style={styles.winnerRow}>
                  <span style={styles.winnerMark}>ВЫЖИЛ</span>
                  <span style={styles.playerName}>{(p.username || p.name || 'UNKNOWN').toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {loserPlayers.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionLabel}>ИСКЛЮЧЕНЫ ({loserPlayers.length})</div>
            <div style={styles.list}>
              {loserPlayers.map((p, i) => (
                <div key={p.id || i} style={styles.loserRow}>
                  <span style={styles.loserMark}>ВЫБЫЛ</span>
                  <span>{(p.username || p.name || 'UNKNOWN').toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {winnerPlayers.length === 0 && (
          <div style={styles.noSurvivors}>
            Выживших не осталось. Бункер законсервирован.
          </div>
        )}

        <button style={styles.newGameBtn} onClick={onNewGame}>
          ВЕРНУТЬСЯ В ЛОББИ
        </button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0b0d10',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    border: '1px solid #2b323b',
    borderTop: '3px solid #d4a017',
    background: '#111418',
    padding: '28px 30px',
    width: '100%',
    maxWidth: 480,
    borderRadius: 2,
  },
  header: {
    borderBottom: '1px solid #222830',
    paddingBottom: 16,
  },
  statusTag: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: '#d4a017',
    fontWeight: 700,
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: 1.5,
    color: '#e4e7eb',
  },
  subtitle: {
    fontSize: 12,
    color: '#8b95a5',
    marginTop: 6,
  },
  section: {
    marginTop: 20,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: '#7a8494',
    fontWeight: 700,
    marginBottom: 8,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  winnerRow: {
    padding: '10px 12px',
    border: '1px solid #3d5a45',
    borderLeft: '3px solid #4ea868',
    background: '#141c17',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 13,
    color: '#e4e7eb',
    borderRadius: 2,
  },
  winnerMark: {
    fontSize: 10,
    fontWeight: 700,
    color: '#4ea868',
    letterSpacing: 1,
  },
  playerName: {
    fontWeight: 600,
    letterSpacing: 1,
  },
  loserRow: {
    padding: '8px 12px',
    border: '1px solid #232830',
    background: '#14171c',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 12,
    color: '#7a8494',
    borderRadius: 2,
  },
  loserMark: {
    fontSize: 10,
    color: '#c94a4a',
    letterSpacing: 1,
  },
  noSurvivors: {
    textAlign: 'center',
    color: '#8b95a5',
    fontSize: 13,
    marginTop: 24,
    padding: 16,
    border: '1px solid #232830',
    background: '#14171c',
  },
  newGameBtn: {
    marginTop: 24,
    width: '100%',
    padding: '12px 16px',
    border: '1px solid #d4a017',
    background: '#d4a017',
    color: '#0d0f12',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1.5,
    cursor: 'pointer',
    borderRadius: 2,
  },
};
