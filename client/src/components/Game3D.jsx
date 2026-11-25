import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { socket } from '../socket.js';
import { Bunker3DScene } from '../3d/BunkerScene.js';
import { bunkerAudio } from '../audio/bunkerAudio.js';
import VotingPanel from './VotingPanel.jsx';

const BUNKER_THEMES = [
  { id: 'fallout', label: 'VAULT-101' },
  { id: 'resident_evil', label: 'UMBRELLA' },
  { id: 'sao', label: 'AINCRAD' },
  { id: 'rezero', label: 'РОЗВААЛ' },
  { id: 'cyberpunk', label: 'NIGHT CITY' },
];

const CARD_LABELS = {
  profession: 'ПРОФЕССИЯ',
  health: 'ЗДОРОВЬЕ',
  hobby: 'ХОББИ',
  baggage: 'БАГАЖ',
  fact: 'ФАКТ',
  biology: 'БИОЛОГИЯ',
  special: 'СПЕЦКАРТА',
};

const SPECIAL_EXPLANATIONS = {
  'Абсолютный иммунитет': 'Вы неприкосновенны на текущем голосовании. Любые голоса против вас аннулируются.',
  'Принудительный допрос': 'Выберите игрока: он обязан немедленно открыть одну скрытую карту по вашему указанию.',
  'Обмен судьбами': 'Поменяйтесь любой одной нераскрытой картой с выбранным игроком.',
  'Разведка и шпионаж': 'Тайно посмотрите все скрытые карты любого одного игрока. Информация видна только вам.',
  'Вето на голосование': 'В этом раунде голосование отменяется. Никто не покидает бункер.',
  'Двойной голос': 'Ваш голос считается за два на текущем голосовании.',
  'Возрождение изгнанного': 'Возвращает одного из ранее изгнаннных игроков обратно за стол бункера.',
  'Скрытый саботаж': 'Тайно подбрасывает 2 штрафных голоса против выбранного кандидата на следующем голосовании.',
  'Ультиматум лидера': 'Отменяет результаты голосования и изгоняет выбранного вами кандидата.',
};

export default function Game3D({ gameState, setGameState, onToggle2D }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);

  const {
    myCards = {},
    catastrophe,
    bunker,
    players = [],
    phase,
    roundNumber,
    round,
    myId: propMyId,
    testMode,
    packId,
    animeName,
    currentTurnPlayerId,
    bunkerTheme: propTheme,
  } = gameState;

  const myId = propMyId || socket?.id || null;
  const currentRound = Math.max(Number(roundNumber) || 0, Number(round) || 0, 1);

  const [activeTheme, setActiveTheme] = useState(propTheme || 'fallout');
  const [showIntro, setShowIntro] = useState(true);
  const [hoveredTableCard, setHoveredTableCard] = useState(null);
  const [hoveredHandCard, setHoveredHandCard] = useState(null);
  const [cardsRaised, setCardsRaised] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (propTheme && propTheme !== activeTheme) {
      setActiveTheme(propTheme);
    }
  }, [propTheme]);

  const myPlayer = players.find(p => p.id === myId);
  const revealedRaw = myPlayer?.hand?.revealed;
  const revealedKey = revealedRaw ? JSON.stringify(revealedRaw) : '';
  const myRevealed = useMemo(() => revealedRaw || {}, [revealedKey]);
  const isMyTurn = currentTurnPlayerId === myId;
  const currentTurnPlayer = players.find(p => p.id === currentTurnPlayerId);

  const hasRevealedThisRound = Boolean(
    (Array.isArray(gameState.revealedThisRound) && gameState.revealedThisRound.includes(myId)) ||
    (currentRound === 1 && myRevealed['profession']) ||
    isExplaining
  );

  const showToast = useCallback((msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  }, []);

  const handleCardPlay = useCallback((cardType) => {
    if (phase !== 'reveal' && phase !== 'playing') {
      showToast('Карты можно выкладывать только в фазе раскрытия.');
      return;
    }

    if (!isMyTurn) {
      const turnName = currentTurnPlayer?.username || 'другого участника';
      showToast(`Сейчас ходит ${turnName}. Дождитесь своей очереди.`);
      return;
    }

    if (hasRevealedThisRound) {
      showToast('Вы уже выложили карту в этом раунде. Завершите ход.');
      return;
    }

    const isRound1ProfessionRequired = currentRound === 1 && !myRevealed['profession'];
    if (isRound1ProfessionRequired && cardType !== 'profession') {
      showToast('В 1-м раунде все обязаны раскрыть Профессию.');
      return;
    }

    if (myRevealed[cardType]) {
      showToast('Эта карта уже раскрыта на столе.');
      return;
    }

    bunkerAudio.playCardSlap();
    socket.emit('reveal_card', { cardType });
  }, [phase, isMyTurn, currentTurnPlayer, hasRevealedThisRound, currentRound, myRevealed, showToast]);

  const handleCardPlayRef = useRef(handleCardPlay);
  useEffect(() => { handleCardPlayRef.current = handleCardPlay; });

  useEffect(() => {
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && terminalOpen) {
        bunkerAudio.playPipBoySelect();
        setTerminalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [terminalOpen]);

  // Initialize Three.js Scene with bunkerTheme
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new Bunker3DScene(containerRef.current, {
      myId,
      theme: activeTheme,
      onCardClick: (cardType) => {
        handleCardPlayRef.current(cardType);
      },
      onTableCardHover: (cardData) => {
        setHoveredTableCard(cardData);
      },
      onHandCardHover: (cardData) => {
        setHoveredHandCard(cardData);
      },
      onCardsToggle: (raised) => {
        setCardsRaised(raised);
        socket.emit('player_cards_pose', { cardsRaised: raised });
      },
      onHeadMove: (yaw, pitch) => {
        socket.emit('head_rotation', { yaw, pitch });
      },
      onTerminalClick: () => {
        bunkerAudio.playTerminalBeep();
        setTerminalOpen(true);
      },
    });
    sceneRef.current = scene;

    if (catastrophe) {
      scene.playCatastropheRoulette(catastrophe);
    }

    return () => {
      scene.destroy();
      sceneRef.current = null;
    };
  }, []);

  // Apply theme changes live when activeTheme updates
  useEffect(() => {
    if (sceneRef.current && typeof sceneRef.current.setTheme === 'function') {
      sceneRef.current.setTheme(activeTheme);
    }
  }, [activeTheme]);

  // Sync Players & Table Cards
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.updatePlayers(players, myId);
    }
  }, [players, myId]);

  // Sync Current Turn Player for speaking/leaning animation
  useEffect(() => {
    if (sceneRef.current && typeof sceneRef.current.setCurrentTurnPlayer === 'function') {
      sceneRef.current.setCurrentTurnPlayer(currentTurnPlayerId);
    }
  }, [currentTurnPlayerId]);

  // Sync Local Player's Hand Cards
  useEffect(() => {
    if (sceneRef.current && myCards) {
      sceneRef.current.setLocalHandCards(myCards, myRevealed, myPlayer?.eliminated);
    }
  }, [myCards, myRevealed, myPlayer?.eliminated]);

  // Handle Ejection Effect
  useEffect(() => {
    if (gameState.ejectedName) {
      setNotification(`ИСКЛЮЧЁН: ${gameState.ejectedName.toUpperCase()}`);
      if (sceneRef.current) {
        sceneRef.current.playEjectionEffect(gameState.ejectedName);
      }
      const t = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(t);
    }
  }, [gameState.ejectedPlayerId, gameState.ejectedName]);

  // Socket events for card reveal / turn / round
  useEffect(() => {
    const handleCardRevealed = (data) => {
      if (data) {
        const typeNames = {
          profession: 'Профессия',
          health: 'Здоровье',
          hobby: 'Хобби',
          baggage: 'Багаж',
          fact: 'Факт',
          biology: 'Биология',
          special: 'Спецкарта',
        };
        const cText = typeof data.cardData === 'string' ? data.cardData : (data.cardData?.text || '—');
        const pName = data.username || (players.find(x => x.id === data.playerId)?.username) || 'Участник';

        setNotification(`${pName.toUpperCase()} — ${typeNames[data.cardType] || 'Карта'}: ${cText}`);
        bunkerAudio.playGeigerClick();
        bunkerAudio.playCardSlap();

        if (data.playerId === myId) {
          setIsExplaining(true);
        }

        setTimeout(() => setNotification(null), 4500);
      }
    };

    const handleTurnAdvanced = () => setIsExplaining(false);

    const handleRoundAdvanced = (data) => {
      setIsExplaining(false);
      if (data?.message) {
        setNotification(data.message);
        setTimeout(() => setNotification(null), 5000);
      }
    };

    const handlePlayerCardsPose = (data) => {
      if (data && data.playerId && sceneRef.current && typeof sceneRef.current.setPlayerCardsPose === 'function') {
        sceneRef.current.setPlayerCardsPose(data.playerId, Boolean(data.cardsRaised));
      }
    };

    const handlePlayerHeadRotation = (data) => {
      if (data && data.playerId && sceneRef.current && typeof sceneRef.current.setPlayerHeadRotation === 'function') {
        sceneRef.current.setPlayerHeadRotation(data.playerId, data.yaw, data.pitch);
      }
    };

    socket.on('card_revealed', handleCardRevealed);
    socket.on('turn_advanced', handleTurnAdvanced);
    socket.on('round_advanced', handleRoundAdvanced);
    socket.on('player_cards_pose', handlePlayerCardsPose);
    socket.on('head_rotation', handlePlayerHeadRotation);

    return () => {
      socket.off('card_revealed', handleCardRevealed);
      socket.off('turn_advanced', handleTurnAdvanced);
      socket.off('round_advanced', handleRoundAdvanced);
      socket.off('player_cards_pose', handlePlayerCardsPose);
      socket.off('head_rotation', handlePlayerHeadRotation);
    };
  }, [players, myId]);

  const handleFinishExplanation = () => {
    bunkerAudio.playPipBoySelect();
    setIsExplaining(false);
    socket.emit('finish_explanation');
  };

  const handleThemeChange = (e) => {
    const nextTheme = e.target.value;
    bunkerAudio.playPipBoySelect();
    setActiveTheme(nextTheme);
    if (setGameState) {
      setGameState(prev => ({ ...prev, bunkerTheme: nextTheme }));
    }
  };

  const toggleSound = () => {
    const muted = bunkerAudio.toggleMute();
    setIsMuted(muted);
  };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    socket.emit('chat_message', { text: chatInput });
    setChatInput('');
  };

  const closeIntro = () => {
    bunkerAudio.playPipBoySelect();
    setShowIntro(false);
  };

  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');

  const handDesc = hoveredHandCard
    ? (hoveredHandCard.description || SPECIAL_EXPLANATIONS[hoveredHandCard.text] || '')
    : '';

  return (
    <div style={styles.fullscreen}>
      <div ref={containerRef} style={styles.canvasContainer} />

      {/* 1. BRIEFING INTRO MODAL */}
      {showIntro && (
        <div style={styles.introOverlay}>
          <div style={styles.introBox}>
            <div style={styles.introHeader}>
              <div style={styles.introTag}>БРИФИНГ // ВХОДНОЙ ШЛЮЗ</div>
              <div style={styles.introTitle}>ПРОТОКОЛ ОТБОРА В БУНКЕР</div>
            </div>

            <div style={styles.introBody}>
              <div style={styles.introSection('#c94a4a')}>
                <div style={styles.introLabel}>УГРОЗА</div>
                <div style={styles.introHighlight}>{catastrophe?.text || 'Глобальная катастрофа'}</div>
                <div style={styles.introDesc}>
                  {catastrophe?.description || 'Поверхность непригодна для жизни. Выживание возможно только в убежище.'}
                </div>
              </div>

              <div style={styles.introSection('#d4a017')}>
                <div style={styles.introLabel}>ОБЪЕКТ</div>
                <div style={styles.introHighlight}>{bunker?.text || 'Герметичный отсек'}</div>
                <div style={styles.introCapacity}>
                  Мест в бункере: 2 из {players.length}
                </div>
              </div>

              <div style={styles.introRules}>
                <div style={styles.introRulesTitle}>РЕГЛАМЕНТ</div>
                <div>1. В убежище останутся ровно 2 участника.</div>
                <div>2. Раунд 1: все по очереди открывают Профессию (без изгнания).</div>
                <div>3. Раунд 2+: ход по очереди и голосование за исключение.</div>
              </div>
            </div>

            <button style={styles.introStartBtn} onClick={closeIntro}>
              НАЧАТЬ РАУНД 1
            </button>
          </div>
        </div>
      )}

      {/* 2. TOP TACTICAL HUD */}
      <div style={styles.topHud}>
        <div style={styles.hudGroup}>
          <span style={styles.logoTitle}>БУНКЕР</span>
          <span style={styles.phaseBadge(phase === 'voting')}>
            {phase === 'voting' ? 'ГОЛОСОВАНИЕ' : `РАУНД ${String(currentRound).padStart(2, '0')}`}
          </span>
          <span style={styles.packBadge}>
            {animeName ? animeName.toUpperCase() : (packId ? packId.toUpperCase() : 'БАЗА')}
          </span>
        </div>

        <div style={styles.turnBanner(isMyTurn)}>
          {isMyTurn ? (
            hasRevealedThisRound
              ? 'ВАШ ХОД — ЗАВЕРШИТЕ ОБЪЯСНЕНИЕ'
              : `ВАШ ХОД — ВЫЛОЖИТЕ ${currentRound === 1 ? 'ПРОФЕССИЮ' : 'КАРТУ'}`
          ) : (
            `ХОДИТ: ${(currentTurnPlayer?.username || 'ОЖИДАНИЕ').toUpperCase()}`
          )}
        </div>

        <div style={styles.hudGroup}>
          {testMode && <span style={styles.testBadge}>ТЕСТ</span>}
          <select
            value={activeTheme}
            onChange={handleThemeChange}
            style={styles.themeSelect}
            title="Тема 3D-бункера"
          >
            {BUNKER_THEMES.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <button
            style={styles.hudBtn}
            onClick={() => {
              bunkerAudio.playTerminalBeep();
              setTerminalOpen(true);
            }}
          >
            ТЕРМИНАЛ
          </button>
          <button style={styles.hudBtn} onClick={toggleSound}>
            {isMuted ? 'ЗВУК: ВЫКЛ' : 'ЗВУК: ВКЛ'}
          </button>
          <button style={styles.hudBtn} onClick={onToggle2D}>
            2D
          </button>
          <span style={styles.timer}>{m}:{s}</span>
        </div>
      </div>

      {/* 3. NOTIFICATION BANNER */}
      {notification && (
        <div style={styles.notificationToast}>{notification}</div>
      )}

      {/* 4. TABLE CARD INSPECTION TOOLTIP */}
      {hoveredTableCard && (
        <div style={styles.cardTooltip}>
          <div style={styles.tableTooltipMeta}>
            {(hoveredTableCard.player?.username || 'УЧАСТНИК').toUpperCase()} // {hoveredTableCard.type.toUpperCase()}
          </div>
          <div style={styles.tableTooltipTitle}>{hoveredTableCard.text}</div>
          {hoveredTableCard.description && (
            <div style={styles.tableTooltipDesc}>{hoveredTableCard.description}</div>
          )}
        </div>
      )}

      {/* 5. HAND CARD DOSSIER INSPECTOR (Bottom Right) */}
      {hoveredHandCard && (
        <div style={styles.handInspectionTooltip}>
          <div style={styles.inspectorHeader}>
            <span style={styles.tooltipCategory}>
              {CARD_LABELS[hoveredHandCard.type] || hoveredHandCard.type.toUpperCase()}
            </span>
            <button
              onClick={() => setHoveredHandCard(null)}
              style={styles.closeTooltipBtn}
              title="Закрыть"
            >
              [X]
            </button>
          </div>

          <div style={styles.tooltipTitle}>{hoveredHandCard.text}</div>
          {handDesc && (
            <div style={styles.tooltipDescription}>{handDesc}</div>
          )}

          {isMyTurn && (
            <div style={{ marginTop: 12 }}>
              {hasRevealedThisRound ? (
                <div style={styles.lockHint}>
                  Карта уже выложена. Завершите объяснение.
                </div>
              ) : (currentRound === 1 && !myRevealed['profession']) && hoveredHandCard.type !== 'profession' ? (
                <div style={styles.lockHint}>
                  В 1-м раунде открывается только Профессия.
                </div>
              ) : (
                <button
                  style={styles.playCardBtn}
                  onClick={() => handleCardPlay(hoveredHandCard.type)}
                >
                  ВЫЛОЖИТЬ {(currentRound === 1 && !myRevealed['profession']) ? 'ПРОФЕССИЮ' : 'КАРТУ'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 6. FINISH EXPLANATION BAR (Bottom Left above chat) */}
      {isMyTurn && hasRevealedThisRound && (
        <div style={styles.finishExplanationContainer}>
          <div style={styles.finishLabel}>КАРТА НА СТОЛЕ // ЗАВЕРШИТЕ РЕЧЬ</div>
          <button style={styles.finishBtn} onClick={handleFinishExplanation}>
            ПЕРЕДАТЬ ХОД
          </button>
        </div>
      )}

      {/* 7. CARD ELEVATION TOGGLE (Bottom Center) */}
      {!myPlayer?.eliminated && (
        <div style={styles.cardToggleContainer}>
          <button
            style={styles.cardToggleBtn(cardsRaised)}
            onClick={() => {
              bunkerAudio.playPipBoySelect();
              sceneRef.current?.toggleCardsRaised();
            }}
          >
            {cardsRaised ? 'СКРЫТЬ КАРТЫ [ПРОБЕЛ]' : 'ПОКАЗАТЬ КАРТЫ [ПРОБЕЛ]'}
          </button>
        </div>
      )}

      {/* 8. SPECTATOR BANNER */}
      {myPlayer?.eliminated && (
        <div style={styles.spectatorBanner}>
          <div style={styles.spectatorTitle}>ВЫ ИСКЛЮЧЕНЫ // РЕЖИМ НАБЛЮДАТЕЛЯ</div>
          <div style={styles.spectatorSubtitle}>
            Доступ к столу закрыт. Вы можете следить за ходом обсуждения.
          </div>
        </div>
      )}

      {/* 9. COMMS CHAT (Bottom Left) */}
      <div style={styles.chatSection}>
        <button style={styles.chatToggleBtn} onClick={() => setShowChat(s => !s)}>
          {showChat ? 'СКРЫТЬ ЧАТ' : 'ЧАТ'}
        </button>
        {showChat && (
          <div style={styles.chatPanel}>
            <div style={styles.chatMessages}>
              {(gameState.chatMessages || []).map((msg, i) => (
                <div key={i} style={{ fontSize: 12, lineHeight: 1.4, color: '#d6dbe2' }}>
                  <span style={{ color: '#d4a017', fontWeight: 700 }}>{msg.username}: </span>
                  <span>{msg.text}</span>
                </div>
              ))}
              {(gameState.chatMessages || []).length === 0 && (
                <div style={{ fontSize: 11, color: '#6b7482' }}>Канал связи пуст</div>
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
                &gt;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 10. BUNKER TERMINAL MODAL */}
      {terminalOpen && (
        <div style={styles.terminalOverlay} onClick={() => setTerminalOpen(false)}>
          <div style={styles.terminalModal} onClick={e => e.stopPropagation()}>
            <div style={styles.terminalHeader}>
              <div>
                <span style={{ color: '#52d178', fontWeight: 700, letterSpacing: 1.5 }}>
                  ТЕРМИНАЛ УБЕЖИЩА
                </span>
                <span style={{ fontSize: 11, color: '#398a52', marginLeft: 10 }}>
                  SYS // 4.02
                </span>
              </div>
              <button
                style={styles.terminalCloseBtn}
                onClick={() => {
                  bunkerAudio.playPipBoySelect();
                  setTerminalOpen(false);
                }}
              >
                ЗАКРЫТЬ [ESC]
              </button>
            </div>

            <div style={styles.terminalContent}>
              <div style={styles.terminalAlertBox}>
                <div style={{ color: '#e06c6c', fontWeight: 700, fontSize: 11, letterSpacing: 1.5 }}>
                  УГРОЗА
                </div>
                <div style={{ fontSize: 16, color: '#e4e7eb', fontWeight: 700, marginTop: 4 }}>
                  {catastrophe?.text || 'Неизвестная катастрофа'}
                </div>
                <div style={{ fontSize: 12, color: '#9aa89e', marginTop: 4, lineHeight: 1.4 }}>
                  {catastrophe?.description || 'Поверхность непригодна для жизни.'}
                </div>
              </div>

              <div style={styles.terminalSection}>
                <div style={styles.terminalSecTitle}>ПАРАМЕТРЫ ОБЪЕКТА</div>
                <div style={{ color: '#e4e7eb', fontSize: 14, fontWeight: 600 }}>
                  {bunker?.text || 'Распределительный шлюз'}
                </div>
                <div style={{ color: '#9aa89e', fontSize: 12, marginTop: 4 }}>
                  {bunker?.description || 'Автономный бункер с базовыми системами жизнеобеспечения.'}
                </div>
                <div style={{ color: '#d4a017', fontWeight: 700, fontSize: 12, marginTop: 8 }}>
                  ВМЕСТИМОСТЬ: 2 ЧЕЛОВЕКА
                </div>
              </div>

              <div style={styles.terminalSection}>
                <div style={styles.terminalSecTitle}>СПИСОК УЧАСТНИКОВ</div>
                <div style={styles.terminalPlayersGrid}>
                  {players.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        padding: '8px 10px',
                        border: `1px solid ${p.eliminated ? '#5c2b2b' : '#264d32'}`,
                        background: p.eliminated ? '#170d0d' : '#0b170f',
                        color: p.eliminated ? '#e06c6c' : '#52d178',
                        fontSize: 12,
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>
                        {p.username} {p.id === myId ? '(ВЫ)' : ''}
                      </div>
                      <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>
                        {p.eliminated ? 'ИЗГНАН' : 'В ШЛЮЗЕ'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 11. VOTING OVERLAY */}
      {phase === 'voting' && !myPlayer?.eliminated && (
        <VotingPanel players={players} myId={myId} />
      )}
    </div>
  );
}

const styles = {
  fullscreen: {
    position: 'relative',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    background: '#0a0c0e',
    userSelect: 'none',
  },
  canvasContainer: {
    width: '100%',
    height: '100%',
    display: 'block',
  },
  introOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(7, 9, 12, 0.88)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  introBox: {
    maxWidth: 560,
    width: '100%',
    border: '1px solid #303741',
    borderTop: '3px solid #d4a017',
    background: '#111418',
    padding: '24px 28px',
    borderRadius: 2,
  },
  introHeader: {
    borderBottom: '1px solid #222830',
    paddingBottom: 12,
    marginBottom: 16,
  },
  introTag: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: '#d4a017',
    fontWeight: 700,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: 1.5,
    color: '#e4e7eb',
    marginTop: 4,
  },
  introBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  introSection: (accent) => ({
    background: '#15191f',
    border: '1px solid #262c35',
    borderLeft: `3px solid ${accent}`,
    padding: '10px 14px',
  }),
  introLabel: {
    fontSize: 10,
    color: '#7a8494',
    letterSpacing: 1.5,
    fontWeight: 700,
  },
  introHighlight: {
    fontSize: 15,
    fontWeight: 700,
    color: '#e4e7eb',
    marginTop: 4,
  },
  introDesc: {
    fontSize: 12,
    color: '#8b95a5',
    marginTop: 4,
    lineHeight: 1.4,
  },
  introCapacity: {
    fontSize: 12,
    color: '#d4a017',
    fontWeight: 700,
    marginTop: 4,
  },
  introRules: {
    border: '1px solid #262c35',
    background: '#0e1116',
    padding: '10px 14px',
    fontSize: 12,
    color: '#a8b1bd',
    lineHeight: 1.6,
  },
  introRulesTitle: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.5,
    color: '#7a8494',
    marginBottom: 4,
  },
  introStartBtn: {
    width: '100%',
    marginTop: 18,
    padding: '12px 16px',
    background: '#d4a017',
    color: '#0d0f12',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 1.5,
    cursor: 'pointer',
    borderRadius: 2,
  },
  topHud: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: '10px 18px',
    background: 'rgba(13, 16, 20, 0.92)',
    borderBottom: '1px solid #252b34',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    zIndex: 20,
    pointerEvents: 'auto',
  },
  hudGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  logoTitle: {
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 2,
    color: '#e4e7eb',
  },
  phaseBadge: (isVoting) => ({
    padding: '3px 10px',
    border: `1px solid ${isVoting ? '#c94a4a' : '#d4a017'}`,
    background: isVoting ? 'rgba(201,74,74,0.14)' : 'rgba(212,160,23,0.12)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1.5,
    color: isVoting ? '#e06c6c' : '#d4a017',
  }),
  packBadge: {
    fontSize: 11,
    color: '#7a8494',
    letterSpacing: 1,
  },
  turnBanner: (isMyTurn) => ({
    padding: '5px 14px',
    border: `1px solid ${isMyTurn ? '#d4a017' : '#2b323b'}`,
    background: isMyTurn ? 'rgba(212,160,23,0.14)' : '#14181e',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1.2,
    color: isMyTurn ? '#f0c040' : '#8b95a5',
    borderRadius: 2,
  }),
  testBadge: {
    fontSize: 10,
    padding: '3px 7px',
    border: '1px solid #2b323b',
    color: '#7a8494',
    letterSpacing: 1,
  },
  themeSelect: {
    padding: '4px 8px',
    border: '1px solid #2b323b',
    background: '#14181e',
    color: '#e4e7eb',
    fontSize: 11,
    fontFamily: 'var(--font)',
    letterSpacing: 1,
    cursor: 'pointer',
    outline: 'none',
    borderRadius: 2,
  },
  hudBtn: {
    padding: '4px 10px',
    border: '1px solid #2b323b',
    background: '#14181e',
    fontSize: 11,
    letterSpacing: 1,
    color: '#d6dbe2',
    cursor: 'pointer',
    borderRadius: 2,
  },
  timer: {
    fontSize: 13,
    color: '#8b95a5',
    letterSpacing: 1.5,
    fontVariantNumeric: 'tabular-nums',
  },
  notificationToast: {
    position: 'absolute',
    top: 60,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 50,
    background: '#111418',
    border: '1px solid #d4a017',
    borderLeft: '3px solid #d4a017',
    padding: '10px 20px',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 1,
    textAlign: 'center',
    color: '#e4e7eb',
    pointerEvents: 'none',
    borderRadius: 2,
  },
  cardTooltip: {
    position: 'absolute',
    top: 104,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 30,
    background: '#111418',
    border: '1px solid #303741',
    borderTop: '2px solid #d4a017',
    padding: '10px 18px',
    pointerEvents: 'none',
    textAlign: 'center',
    maxWidth: 460,
    borderRadius: 2,
  },
  tableTooltipMeta: {
    fontSize: 10,
    color: '#8b95a5',
    letterSpacing: 1.2,
  },
  tableTooltipTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#e4e7eb',
    marginTop: 3,
  },
  tableTooltipDesc: {
    fontSize: 11,
    color: '#8b95a5',
    marginTop: 4,
  },
  handInspectionTooltip: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    zIndex: 35,
    background: '#111418',
    border: '1px solid #303741',
    borderTop: '3px solid #d4a017',
    padding: '14px 18px',
    textAlign: 'left',
    maxWidth: 380,
    minWidth: 280,
    borderRadius: 2,
  },
  inspectorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeTooltipBtn: {
    background: 'transparent',
    border: 'none',
    color: '#7a8494',
    fontSize: 11,
    cursor: 'pointer',
    padding: '0 4px',
  },
  tooltipCategory: {
    fontSize: 10,
    color: '#d4a017',
    letterSpacing: 1.5,
    fontWeight: 700,
  },
  tooltipTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#e4e7eb',
    marginTop: 6,
  },
  tooltipDescription: {
    fontSize: 12,
    color: '#9aa3b0',
    marginTop: 8,
    lineHeight: 1.4,
    borderTop: '1px solid #222830',
    paddingTop: 8,
  },
  lockHint: {
    fontSize: 11,
    color: '#c98a36',
    letterSpacing: 0.5,
  },
  playCardBtn: {
    width: '100%',
    padding: '9px 14px',
    background: '#d4a017',
    color: '#0d0f12',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1.2,
    cursor: 'pointer',
    borderRadius: 2,
  },
  finishExplanationContainer: {
    position: 'absolute',
    bottom: 68,
    left: 20,
    zIndex: 40,
    background: '#111418',
    padding: '12px 16px',
    border: '1px solid #303741',
    borderLeft: '3px solid #d4a017',
    maxWidth: 320,
    borderRadius: 2,
  },
  finishLabel: {
    fontSize: 10,
    color: '#8b95a5',
    marginBottom: 8,
    letterSpacing: 1.2,
    fontWeight: 700,
  },
  finishBtn: {
    width: '100%',
    padding: '9px 16px',
    background: '#d4a017',
    color: '#0d0f12',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1.5,
    cursor: 'pointer',
    borderRadius: 2,
  },
  cardToggleContainer: {
    position: 'absolute',
    bottom: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 30,
  },
  cardToggleBtn: (raised) => ({
    padding: '9px 20px',
    border: `1px solid ${raised ? '#d4a017' : '#303741'}`,
    background: raised ? '#1d1a11' : '#111418',
    color: raised ? '#f0c040' : '#d6dbe2',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1.5,
    cursor: 'pointer',
    borderRadius: 2,
  }),
  spectatorBanner: {
    position: 'absolute',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 35,
    background: '#161112',
    border: '1px solid #5c2b2b',
    borderLeft: '3px solid #c94a4a',
    padding: '12px 24px',
    textAlign: 'center',
    maxWidth: 520,
    borderRadius: 2,
  },
  spectatorTitle: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 1.5,
    color: '#e06c6c',
  },
  spectatorSubtitle: {
    fontSize: 11,
    color: '#a38282',
    marginTop: 4,
  },
  chatSection: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    zIndex: 30,
  },
  chatToggleBtn: {
    padding: '6px 14px',
    border: '1px solid #2b323b',
    background: '#111418',
    fontSize: 11,
    letterSpacing: 1.2,
    color: '#8b95a5',
    cursor: 'pointer',
    borderRadius: 2,
  },
  chatPanel: {
    position: 'absolute',
    bottom: 38,
    left: 0,
    width: 310,
    height: 210,
    background: '#111418',
    border: '1px solid #303741',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 2,
  },
  chatMessages: {
    flex: 1,
    padding: 10,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  chatInput: {
    border: 'none',
    flex: 1,
    background: '#0d0f12',
    color: '#e4e7eb',
    padding: '8px 10px',
    fontSize: 12,
    textTransform: 'none',
  },
  chatSendBtn: {
    padding: '0 12px',
    background: '#181c22',
    borderLeft: '1px solid #262c35',
    color: '#d4a017',
    fontWeight: 700,
    cursor: 'pointer',
  },
  terminalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(5, 8, 6, 0.88)',
    zIndex: 90,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  terminalModal: {
    position: 'relative',
    maxWidth: 680,
    width: '100%',
    maxHeight: '88vh',
    overflowY: 'auto',
    background: '#08100a',
    border: '1px solid #2e6f40',
    borderTop: '3px solid #52d178',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 24px',
    color: '#52d178',
    borderRadius: 2,
  },
  terminalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #1e4529',
    paddingBottom: 10,
    marginBottom: 14,
  },
  terminalCloseBtn: {
    background: 'transparent',
    border: '1px solid #2e6f40',
    color: '#52d178',
    padding: '4px 10px',
    fontSize: 11,
    cursor: 'pointer',
    letterSpacing: 1,
  },
  terminalContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  terminalAlertBox: {
    background: '#140c0c',
    border: '1px solid #5c2b2b',
    borderLeft: '3px solid #c94a4a',
    padding: '10px 14px',
  },
  terminalSection: {
    background: '#0b160e',
    border: '1px solid #1e4529',
    padding: '10px 14px',
  },
  terminalSecTitle: {
    fontSize: 10,
    color: '#398a52',
    letterSpacing: 1.5,
    marginBottom: 6,
    fontWeight: 700,
  },
  terminalPlayersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 8,
    marginTop: 6,
  },
};
