import React, { useState, useEffect } from 'react';
import { socket } from '../socket.js';
import VotingPanel from './VotingPanel.jsx';
import Game3D from './Game3D.jsx';

const CARD_TYPES = ['profession', 'health', 'hobby', 'baggage', 'fact', 'biology'];

const CARD_LABELS = {
  profession: 'ПРОФЕССИЯ',
  health: 'ЗДОРОВЬЕ',
  hobby: 'ХОББИ',
  baggage: 'БАГАЖ',
  fact: 'ФАКТ',
  biology: 'БИОЛОГИЯ',
  special: 'СПЕЦКАРТА',
};

const CARD_SHORT = {
  profession: 'ПРОФ',
  health: 'ЗДОР',
  hobby: 'ХОББИ',
  baggage: 'БАГАЖ',
  fact: 'ФАКТ',
  biology: 'БИО',
  special: 'СПЕЦ',
};

export default function Game({ gameState, setGameState }) {
  const [is3DMode, setIs3DMode] = useState(true);
  const { myCards, catastrophe, bunker, players, phase, roundNumber, myId, testMode, isHost, packId, animeName } = gameState;
  const [seconds, setSeconds] = useState(0);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (gameState.ejectedName) {
      setNotification(`ИСКЛЮЧЁН: ${gameState.ejectedName.toUpperCase()}`);
      const t = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(t);
    }
  }, [gameState.ejectedPlayerId, gameState.ejectedName]);

  if (is3DMode) {
    return (
      <Game3D
        gameState={gameState}
        setGameState={setGameState}
        onToggle2D={() => setIs3DMode(false)}
      />
    );
  }

  const revealCard = (cardType) => {
    socket.emit('reveal_card', { cardType });
  };

  const startVoting = () => {
    socket.emit('start_voting');
  };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    socket.emit('chat_message', { text: chatInput.trim() });
    setChatInput('');
  };

  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');

  const myPlayer = players.find(p => p.id === myId);
  const myHand = myPlayer?.hand;
  const activePlayers = players.filter(p => !p.eliminated);

  return (
    <div style={styles.layout}>
      {notification && (
        <div style={styles.notification}>{notification}</div>
      )}

      {/* Top bar */}
      <div style={styles.topBar}>
        <div style={styles.topGroup}>
          <span style={styles.brandTitle}>БУНКЕР // 2D</span>
          <span style={styles.phaseTag(phase === 'voting')}>
            {phase === 'voting' ? 'ГОЛОСОВАНИЕ' : `РАУНД ${String(roundNumber).padStart(2, '0')}`}
          </span>
          <span style={styles.packTag}>
            {animeName ? `АНИМЕ: ${animeName.toUpperCase()}` : (packId ? packId.toUpperCase() : 'БАЗОВЫЙ')}
          </span>
        </div>

        <div style={styles.topGroup}>
          {testMode && <span style={styles.testBadge}>ТЕСТ</span>}
          <button onClick={() => setIs3DMode(true)} style={styles.modeBtn}>
            3D ВИД
          </button>
          <span style={styles.timer}>{m}:{s}</span>
        </div>
      </div>

      {/* Catastrophe & Bunker info */}
      <div style={styles.infoRow}>
        <div style={styles.infoCard('#c94a4a')}>
          <div style={styles.infoLabel}>КАТАСТРОФА</div>
          <div style={styles.infoText}>{catastrophe?.text || 'НЕИЗВЕСТНО'}</div>
          {catastrophe?.description && (
            <div style={styles.infoDesc}>{catastrophe.description}</div>
          )}
        </div>
        <div style={styles.infoCard('#d4a017')}>
          <div style={styles.infoLabel}>УБЕЖИЩЕ</div>
          <div style={styles.infoText}>{bunker?.text || 'НЕИЗВЕСТНО'}</div>
          {bunker?.capacity && (
            <div style={styles.infoMeta}>Вместимость: {bunker.capacity} чел.</div>
          )}
          {bunker?.description && (
            <div style={styles.infoDesc}>{bunker.description}</div>
          )}
        </div>
      </div>

      {/* My cards */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>МОИ ХАРАКТЕРИСТИКИ</div>
        <div style={styles.cardsGrid}>
          {CARD_TYPES.map(type => {
            const cardData = myCards[type];
            const isRevealed = myHand?.revealed?.[type] || false;
            const text = typeof cardData === 'string' ? cardData : (cardData?.text || '—');

            return (
              <div
                key={type}
                style={styles.myCard(isRevealed, false)}
                onClick={() => !isRevealed && revealCard(type)}
              >
                <div style={styles.cardHeader}>
                  <span style={styles.cardLabel}>{CARD_LABELS[type]}</span>
                  <span style={styles.cardState(isRevealed)}>
                    {isRevealed ? 'ОТКР.' : 'СКР.'}
                  </span>
                </div>
                {isRevealed ? (
                  <div style={styles.cardText}>{text}</div>
                ) : (
                  <div style={styles.cardHidden}>НАЖМИТЕ ДЛЯ РАСКРЫТИЯ</div>
                )}
              </div>
            );
          })}
          {myCards?.special && (
            <div
              style={styles.myCard(myHand?.revealed?.special || false, true)}
              onClick={() => !(myHand?.revealed?.special) && revealCard('special')}
            >
              <div style={styles.cardHeader}>
                <span style={{ ...styles.cardLabel, color: '#e0b030' }}>{CARD_LABELS.special}</span>
                <span style={styles.cardState(Boolean(myHand?.revealed?.special))}>
                  {myHand?.revealed?.special ? 'ОТКР.' : 'СКР.'}
                </span>
              </div>
              {myHand?.revealed?.special ? (
                <div style={styles.cardText}>
                  {typeof myCards.special === 'string' ? myCards.special : (myCards.special?.text || '—')}
                </div>
              ) : (
                <div style={styles.cardHidden}>НАЖМИТЕ ДЛЯ РАСКРЫТИЯ</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Host controls */}
      {(isHost || testMode) && phase === 'reveal' && (
        <div style={{ padding: '0 20px 12px' }}>
          <button style={styles.startVoteBtn} onClick={startVoting}>
            НАЧАТЬ ГОЛОСОВАНИЕ
          </button>
        </div>
      )}

      {/* Players list */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          УЧАСТНИКИ ({activePlayers.length}/{players.length})
        </div>
        <div style={styles.playersList}>
          {players.map((player, i) => {
            const hand = player.hand;
            const revealed = hand?.revealed || {};
            const isMe = player.id === myId;
            const isElim = player.eliminated;

            return (
              <div key={player.id || i} style={styles.playerRow(isMe, isElim)}>
                <div style={styles.playerHeader}>
                  <span style={styles.statusDot(isElim)} />
                  <span style={styles.playerName}>
                    {(player.username || 'UNKNOWN').toUpperCase()}
                  </span>
                  {isMe && <span style={styles.youBadge}>ВЫ</span>}
                  {player.isBot && <span style={styles.metaBadge}>БОТ</span>}
                  {player.isHost && <span style={styles.metaBadge}>ХОСТ</span>}
                  {isElim && <span style={styles.elimBadge}>ИЗГНАН</span>}
                </div>
                {hand && (
                  <div style={styles.revealedRow}>
                    {CARD_TYPES.map(type => {
                      if (!revealed[type]) return null;
                      const val = hand[type];
                      const text = typeof val === 'string' ? val : (val?.text || '—');
                      return (
                        <span key={type} style={styles.miniCard}>
                          <span style={styles.miniCardCode}>{CARD_SHORT[type]}</span> {text}
                        </span>
                      );
                    })}
                    {revealed.special && hand.special && (
                      <span key="special" style={{ ...styles.miniCard, borderColor: '#d4a017' }}>
                        <span style={{ ...styles.miniCardCode, color: '#d4a017' }}>СПЕЦ</span>{' '}
                        {typeof hand.special === 'string' ? hand.special : (hand.special?.text || '—')}
                      </span>
                    )}
                    {Object.values(revealed).every(v => !v) && (
                      <span style={styles.noRevealedText}>Нет раскрытых карт</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat */}
      <div style={{ padding: '0 20px 24px' }}>
        <button style={styles.chatToggleBtn} onClick={() => setShowChat(s => !s)}>
          {showChat ? 'СКРЫТЬ ЧАТ' : 'ОТКРЫТЬ ЧАТ'}
        </button>
        {showChat && (
          <div style={styles.chatBox}>
            <div style={styles.chatMessages}>
              {(gameState.chatMessages || []).map((msg, i) => (
                <div key={i} style={{ fontSize: 12, color: '#d6dbe2' }}>
                  <span style={{ color: '#d4a017', fontWeight: 700 }}>{msg.username}: </span>
                  <span>{msg.text}</span>
                </div>
              ))}
              {(gameState.chatMessages || []).length === 0 && (
                <div style={{ fontSize: 11, color: '#6b7482' }}>Сообщений пока нет</div>
              )}
            </div>
            <div style={{ display: 'flex', borderTop: '1px solid #262c35' }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Сообщение..."
                style={styles.chatInput}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
              />
              <button onClick={sendChat} style={styles.chatSendBtn}>
                ОТПРАВИТЬ
              </button>
            </div>
          </div>
        )}
      </div>

      {phase === 'voting' && (
        <VotingPanel players={players} myId={myId} />
      )}
    </div>
  );
}

const styles = {
  layout: {
    minHeight: '100vh',
    background: '#0b0d10',
    color: '#e4e7eb',
    display: 'flex',
    flexDirection: 'column',
  },
  topBar: {
    borderBottom: '1px solid #262c35',
    background: '#111418',
    padding: '10px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  topGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 2,
    color: '#e4e7eb',
  },
  phaseTag: (isVoting) => ({
    padding: '3px 10px',
    border: `1px solid ${isVoting ? '#c94a4a' : '#d4a017'}`,
    background: isVoting ? 'rgba(201,74,74,0.12)' : 'rgba(212,160,23,0.12)',
    color: isVoting ? '#e06c6c' : '#d4a017',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1.5,
  }),
  packTag: {
    fontSize: 11,
    color: '#8b95a5',
    letterSpacing: 1,
  },
  testBadge: {
    padding: '2px 8px',
    border: '1px solid #303741',
    fontSize: 10,
    letterSpacing: 1,
    color: '#8b95a5',
  },
  modeBtn: {
    padding: '5px 12px',
    border: '1px solid #3a424d',
    background: '#181c22',
    fontSize: 11,
    letterSpacing: 1,
    color: '#e4e7eb',
    cursor: 'pointer',
    borderRadius: 2,
  },
  timer: {
    fontSize: 13,
    letterSpacing: 1.5,
    color: '#8b95a5',
    fontVariantNumeric: 'tabular-nums',
  },
  notification: {
    position: 'fixed',
    top: 58,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9998,
    background: '#111418',
    border: '1px solid #c94a4a',
    borderLeft: '3px solid #c94a4a',
    padding: '10px 20px',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1.5,
    color: '#e4e7eb',
  },
  infoRow: {
    display: 'flex',
    gap: 12,
    padding: '16px 20px 8px',
    flexWrap: 'wrap',
  },
  infoCard: (accent) => ({
    flex: '1 1 280px',
    border: '1px solid #262c35',
    borderLeft: `3px solid ${accent}`,
    padding: '12px 16px',
    background: '#111418',
    borderRadius: 2,
  }),
  infoLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: '#7a8494',
    fontWeight: 700,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    fontWeight: 700,
    color: '#e4e7eb',
  },
  infoMeta: {
    fontSize: 11,
    color: '#d4a017',
    marginTop: 4,
  },
  infoDesc: {
    fontSize: 12,
    color: '#8b95a5',
    marginTop: 4,
    lineHeight: 1.45,
  },
  section: {
    padding: '12px 20px',
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: '#7a8494',
    fontWeight: 700,
    marginBottom: 10,
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
    gap: 8,
  },
  myCard: (revealed, isSpecial) => ({
    minHeight: 88,
    border: `1px solid ${revealed ? (isSpecial ? '#e0b030' : '#3a424d') : '#232830'}`,
    borderTop: `2px solid ${revealed ? (isSpecial ? '#e0b030' : '#d4a017') : '#303741'}`,
    background: revealed ? '#161a20' : '#111418',
    padding: '10px 12px',
    cursor: revealed ? 'default' : 'pointer',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    borderRadius: 2,
  }),
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1,
    color: '#8b95a5',
  },
  cardState: (revealed) => ({
    fontSize: 9,
    letterSpacing: 1,
    color: revealed ? '#4ea868' : '#5a6370',
  }),
  cardText: {
    fontSize: 12,
    color: '#e4e7eb',
    lineHeight: 1.35,
    wordBreak: 'break-word',
  },
  cardHidden: {
    fontSize: 10,
    color: '#5a6370',
    letterSpacing: 1,
    marginTop: 8,
  },
  startVoteBtn: {
    padding: '10px 20px',
    border: '1px solid #d4a017',
    background: '#d4a017',
    color: '#0d0f12',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1.5,
    cursor: 'pointer',
    borderRadius: 2,
  },
  playersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  playerRow: (isMe, isElim) => ({
    border: `1px solid ${isMe ? '#3d4654' : '#232830'}`,
    background: isMe ? '#151920' : '#111418',
    padding: '10px 14px',
    opacity: isElim ? 0.45 : 1,
    borderRadius: 2,
  }),
  playerHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
  },
  statusDot: (isElim) => ({
    width: 7,
    height: 7,
    borderRadius: 1,
    background: isElim ? '#c94a4a' : '#4ea868',
    flexShrink: 0,
  }),
  playerName: {
    fontWeight: 700,
    letterSpacing: 1,
    color: '#e4e7eb',
  },
  youBadge: {
    fontSize: 9,
    padding: '2px 6px',
    border: '1px solid #d4a017',
    color: '#d4a017',
    letterSpacing: 1,
  },
  metaBadge: {
    fontSize: 9,
    padding: '2px 6px',
    border: '1px solid #2b323b',
    color: '#7a8494',
    letterSpacing: 1,
  },
  elimBadge: {
    marginLeft: 'auto',
    fontSize: 10,
    color: '#c94a4a',
    letterSpacing: 1,
    fontWeight: 700,
  },
  revealedRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 8,
  },
  miniCard: {
    padding: '3px 8px',
    border: '1px solid #2a3038',
    background: '#181c22',
    fontSize: 11,
    color: '#d6dbe2',
    borderRadius: 2,
  },
  miniCardCode: {
    color: '#7a8494',
    fontWeight: 700,
    fontSize: 10,
    marginRight: 4,
  },
  noRevealedText: {
    fontSize: 11,
    color: '#5a6370',
  },
  chatToggleBtn: {
    padding: '7px 14px',
    border: '1px solid #2b323b',
    background: '#111418',
    color: '#8b95a5',
    fontSize: 11,
    letterSpacing: 1.2,
    cursor: 'pointer',
    borderRadius: 2,
  },
  chatBox: {
    marginTop: 8,
    border: '1px solid #2b323b',
    background: '#111418',
    maxWidth: 480,
    borderRadius: 2,
  },
  chatMessages: {
    maxHeight: 160,
    overflowY: 'auto',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  chatInput: {
    border: 'none',
    flex: 1,
    background: '#0d0f12',
    color: '#e4e7eb',
    padding: '8px 12px',
    fontSize: 12,
    textTransform: 'none',
  },
  chatSendBtn: {
    padding: '0 14px',
    background: '#181c22',
    borderLeft: '1px solid #262c35',
    color: '#d4a017',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
  },
};
