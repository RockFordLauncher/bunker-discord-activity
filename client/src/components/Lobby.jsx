import React, { useState, useEffect } from 'react';
import { socket } from '../socket.js';
import CustomizationPanel from './CustomizationPanel.jsx';
import { getDefaultCustomization, THEME_PRESETS } from '../3d/characterCustomizationData.js';

const ALL_PACKS = [
  { id: 'base', label: 'БАЗОВЫЙ', desc: 'Классический набор карточек' },
  { id: 'extended', label: 'РАСШИРЕННЫЙ', desc: 'Увеличенный пул профессий и угроз' },
  { id: 'fantasy', label: 'ФЭНТЕЗИ', desc: 'Магия, гильдии и древние существа' },
  { id: 'kids', label: 'СЕМЕЙНЫЙ', desc: 'Облегченные сценарии без жестких тем' },
  { id: 'harry_potter', label: 'МАГИЧЕСКИЙ МИР', desc: 'Школа чародейства и темные искусства' },
  { id: 'fallout', label: 'FALLOUT', desc: 'Пустошь, радиация и убежища' },
  { id: 'ancient', label: 'ДРЕВНИЙ МИР', desc: 'Античность, империи и мифы' },
  { id: 'adult', label: '18+', desc: 'Взрослые сценарии и черный юмор' },
  { id: 'lotr', label: 'СРЕДИЗЕМЬЕ', desc: 'Кольца власти и походы' },
  { id: 'stalker', label: 'ЗОНА ОТЧУЖДЕНИЯ', desc: 'Аномалии, артефакты и группировки' },
  { id: 'jurassic', label: 'ПАРК ПЕРИОДА', desc: 'Биоинженерия и выживание' },
  { id: 'pirates', label: 'КОРСАРЫ', desc: 'Морские рейды и проклятия' },
  { id: 'anime', label: 'АНИМЕ', desc: 'Случайная вселенная (SAO / Re:Zero / др.)' },
];

export const BUNKER_THEMES = [
  { id: 'fallout', code: 'VT-101', label: 'Vault-Tec // Убежище', accent: '#d99b26', desc: 'Гермоблок, CRT-терминалы, вольфрамовый свет' },
  { id: 'resident_evil', code: 'UMB-04', label: 'Umbrella // Лаборатория', accent: '#46a870', desc: 'Криокамеры, биозащита, клинический свет' },
  { id: 'sao', code: 'AIN-75', label: 'Aincrad // Черный Замок', accent: '#3ba8d4', desc: 'Каменные своды, кристаллы и зал гильдии' },
  { id: 'rezero', code: 'RSW-02', label: 'Roswaal // Библиотека', accent: '#b86ed4', desc: 'Красное дерево, стеллажи и канделябры' },
  { id: 'cyberpunk', code: 'NC-2077', label: 'Night City // Нетраннер', accent: '#e04890', desc: 'Бетон, серверные стойки и неон' },
];

export default function Lobby({ gameState, setGameState }) {
  const { screen, discordUser } = gameState;
  const [nickname, setNickname] = useState(() => {
    if (discordUser?.username) return discordUser.username;
    try {
      return localStorage.getItem('bunker_nickname') || '';
    } catch {
      return '';
    }
  });
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPack, setSelectedPack] = useState('base');
  const [showCustomization, setShowCustomization] = useState(false);

  const [bunkerTheme, setBunkerTheme] = useState(() => {
    if (gameState?.bunkerTheme) return gameState.bunkerTheme;
    try {
      return localStorage.getItem('bunker_theme') || 'fallout';
    } catch {
      return 'fallout';
    }
  });

  const [customization, setCustomization] = useState(() => {
    try {
      const saved = localStorage.getItem('bunker_customization');
      return saved ? JSON.parse(saved) : getDefaultCustomization();
    } catch {
      return getDefaultCustomization();
    }
  });

  const displayName = discordUser?.username || nickname.trim() || 'Гость';
  const avatarUrl = discordUser?.avatarUrl || null;

  useEffect(() => {
    if (discordUser?.username) {
      setNickname(discordUser.username);
    }
  }, [discordUser]);

  const handleNicknameChange = (val) => {
    setNickname(val);
    try {
      localStorage.setItem('bunker_nickname', val);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (gameState?.bunkerTheme && gameState.bunkerTheme !== bunkerTheme) {
      setBunkerTheme(gameState.bunkerTheme);
    }
  }, [gameState?.bunkerTheme]);

  const handleSelectBunkerTheme = (themeId) => {
    setBunkerTheme(themeId);
    try {
      localStorage.setItem('bunker_theme', themeId);
    } catch {
      // ignore storage errors
    }
    setGameState(prev => ({ ...prev, bunkerTheme: themeId }));
  };

  const handleCreate = (testMode = false) => {
    const name = nickname.trim() || displayName;
    if (!name) {
      setGameState(prev => ({ ...prev, error: 'Введите позывной' }));
      return;
    }
    setLoading(true);
    setGameState(prev => ({ ...prev, bunkerTheme }));
    socket.emit('create_room', {
      username: name,
      avatarUrl,
      packId: selectedPack,
      testMode,
      customization,
      bunkerTheme,
    });
    setTimeout(() => setLoading(false), 3000);
  };

  const handleJoin = () => {
    const name = nickname.trim() || displayName;
    if (!name) {
      setGameState(prev => ({ ...prev, error: 'Введите позывной' }));
      return;
    }
    if (!joinCode.trim()) {
      setGameState(prev => ({ ...prev, error: 'Введите код убежища' }));
      return;
    }
    setLoading(true);
    setGameState(prev => ({ ...prev, bunkerTheme }));
    socket.emit('join_room', {
      roomCode: joinCode.trim().toUpperCase(),
      username: name,
      avatarUrl,
      customization,
    });
    setTimeout(() => setLoading(false), 3000);
  };

  const activeThemeObj = BUNKER_THEMES.find(t => t.id === bunkerTheme) || BUNKER_THEMES[0];
  const activeModelLabel = customization?.customBBModel
    ? (customization.modelName || 'BBMODEL // ПОЛЬЗОВАТЕЛЬСКАЯ')
    : (THEME_PRESETS.find(p => p.id === customization?.preset)?.name || 'СТАНДАРТНЫЙ ПЕРСОНАЖ');

  const isDiscordLinked = Boolean(discordUser?.id);

  const TopHeader = ({ subtitle }) => (
    <div style={styles.topBar}>
      <div style={styles.brandBlock}>
        <div style={styles.brandMark}>BP</div>
        <div>
          <div style={styles.brandTitle}>BUNKER PROTOCOL</div>
          <div style={styles.brandSub}>{subtitle}</div>
        </div>
      </div>

      <div style={styles.profilePill(isDiscordLinked)}>
        <div style={styles.profileAvatar(isDiscordLinked)}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span>{(displayName || 'Г')[0].toUpperCase()}</span>
          )}
          <span style={styles.avatarStatusRing(isDiscordLinked)} />
        </div>
        <div style={styles.profileInfo}>
          <div style={styles.profileNameRow}>
            <span style={styles.profileName}>{displayName}</span>
            <span style={styles.profileSourceTag(isDiscordLinked)}>
              {isDiscordLinked ? 'DISCORD' : 'ВЕБ'}
            </span>
          </div>
          <div style={styles.profileSub}>
            {isDiscordLinked ? 'Профиль синхронизирован' : 'Локальный профиль'}
          </div>
        </div>
      </div>
    </div>
  );

  const BunkerThemeSelector = ({ compact = false }) => (
    <div style={styles.sectionBlock}>
      <div style={styles.sectionHeaderRow}>
        <span style={styles.sectionTitle}>3D БУНКЕР (ТЕМА ЛОКАЦИИ)</span>
        <span style={styles.sectionCode}>{activeThemeObj.code}</span>
      </div>
      <div style={compact ? styles.themeGridCompact : styles.themeGrid}>
        {BUNKER_THEMES.map((t) => {
          const active = bunkerTheme === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleSelectBunkerTheme(t.id)}
              style={styles.themeCard(active, t.accent)}
            >
              <div style={styles.themeCardTop}>
                <span style={{ ...styles.themeDot, background: t.accent }} />
                <span style={styles.themeCode}>{t.code}</span>
              </div>
              <div style={styles.themeLabel}>{t.label}</div>
              {!compact && <div style={styles.themeDesc}>{t.desc}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );

  // ═══════════ MAIN MENU ═══════════
  if (screen === 'lobby') {
    return (
      <div style={styles.page}>
        <div style={styles.shell}>
          <TopHeader subtitle="ТАКТИЧЕСКИЙ СИМУЛЯТОР ВЫЖИВАНИЯ // V3.2" />

          <div style={styles.lobbyGrid}>
            {/* Left Navigation Column */}
            <div style={styles.navColumn}>
              <div style={styles.panelCaption}>НАВИГАЦИЯ</div>

              <div style={styles.menuStack}>
                <button
                  className="btn-terminal primary"
                  style={styles.menuBtn}
                  onClick={() => setGameState(prev => ({ ...prev, screen: 'create' }))}
                >
                  <span style={styles.menuIdx}>01</span>
                  <span style={styles.menuText}>СОЗДАТЬ УБЕЖИЩЕ</span>
                  <span style={styles.menuArrow}>→</span>
                </button>

                <button
                  className="btn-terminal"
                  style={styles.menuBtn}
                  onClick={() => setGameState(prev => ({ ...prev, screen: 'join' }))}
                >
                  <span style={styles.menuIdx}>02</span>
                  <span style={styles.menuText}>ВОЙТИ ПО КОДУ</span>
                  <span style={styles.menuArrow}>→</span>
                </button>

                <button
                  className="btn-terminal"
                  style={styles.menuBtn}
                  onClick={() => setShowCustomization(true)}
                >
                  <span style={styles.menuIdx}>03</span>
                  <span style={styles.menuText}>ВНЕШНОСТЬ ПЕРСОНАЖА</span>
                  <span style={styles.menuArrow}>→</span>
                </button>
              </div>

              <div style={styles.loadoutSummary}>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryKey}>ОБЛИК</span>
                  <span style={styles.summaryVal}>{activeModelLabel}</span>
                </div>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryKey}>ЛОКАЦИЯ</span>
                  <span style={{ ...styles.summaryVal, color: activeThemeObj.accent }}>
                    {activeThemeObj.label}
                  </span>
                </div>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryKey}>СЕРВЕР</span>
                  <span style={{ ...styles.summaryVal, color: 'var(--success)' }}>ГОТОВ</span>
                </div>
              </div>
            </div>

            {/* Right Briefing / 3D Bunker Selector */}
            <div style={styles.briefingColumn}>
              <BunkerThemeSelector />

              <div style={styles.briefingFooterNote}>
                Выбранная тема локации определяет 3D-архитектуру бункера, освещение и окружение за столом переговоров.
              </div>
            </div>
          </div>

          <div style={styles.bottomFooter}>
            <span>СЕКТОР-07 // ПРОТОКОЛ ИЗОЛЯЦИИ</span>
            <span>МАКС. ИГРОКОВ: 12</span>
          </div>
        </div>

        {showCustomization && (
          <CustomizationPanel
            currentCustomization={customization}
            onSave={(newCust) => {
              setCustomization(newCust);
              setShowCustomization(false);
            }}
            onClose={() => setShowCustomization(false)}
          />
        )}
      </div>
    );
  }

  // ═══════════ CREATE ROOM ═══════════
  if (screen === 'create') {
    return (
      <div style={styles.page}>
        <div style={styles.shell}>
          <TopHeader subtitle="КОНФИГУРАЦИЯ НОВОГО УБЕЖИЩА" />

          <div style={styles.subPageToolbar}>
            <button
              onClick={() => setGameState(prev => ({ ...prev, screen: 'lobby' }))}
              style={styles.backBtn}
            >
              ← МЕНЮ
            </button>
            <button
              className="btn-terminal"
              style={styles.inlineCustomizeBtn}
              onClick={() => setShowCustomization(true)}
            >
              ОБЛИК: {activeModelLabel}
            </button>
          </div>

          <div style={styles.createGrid}>
            {/* Left column: Callsign + Bunker 3D Theme */}
            <div style={styles.createLeft}>
              <div style={styles.fieldGroup}>
                <label style={styles.fieldLabel}>ИМЯ ИГРОКА</label>
                <input
                  value={nickname}
                  onChange={e => handleNicknameChange(e.target.value)}
                  placeholder={displayName}
                  maxLength={24}
                />
              </div>

              <BunkerThemeSelector compact />

              <div style={styles.actionStack}>
                <button
                  className="btn-terminal primary"
                  onClick={() => handleCreate(false)}
                  disabled={loading}
                >
                  {loading ? 'ИНИЦИАЛИЗАЦИЯ...' : 'СОЗДАТЬ КОМНАТУ'}
                </button>
                <button
                  className="btn-terminal"
                  onClick={() => handleCreate(true)}
                  disabled={loading}
                >
                  ТЕСТОВЫЙ ЗАПУСК С БОТАМИ
                </button>
              </div>
            </div>

            {/* Right column: Card Pack Selection */}
            <div style={styles.createRight}>
              <div style={styles.sectionHeaderRow}>
                <span style={styles.sectionTitle}>НАБОР КАРТОЧЕК (СЦЕНАРИЙ)</span>
                <span style={styles.sectionCode}>{selectedPack.toUpperCase()}</span>
              </div>
              <div style={styles.packGrid}>
                {ALL_PACKS.map(pack => {
                  const active = selectedPack === pack.id;
                  return (
                    <button
                      key={pack.id}
                      type="button"
                      onClick={() => setSelectedPack(pack.id)}
                      style={styles.packCard(active)}
                    >
                      <div style={styles.packCardTop}>
                        <span style={styles.packRadio(active)} />
                        <span style={styles.packLabel(active)}>{pack.label}</span>
                      </div>
                      <div style={styles.packDesc}>{pack.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={styles.bottomFooter}>
            <span>СОЗДАНИЕ СЕССИИ // ХОСТ УПРАВЛЯЕТ СТАРТОМ</span>
            <span>ЛОКАЦИЯ: {activeThemeObj.code}</span>
          </div>
        </div>

        {showCustomization && (
          <CustomizationPanel
            currentCustomization={customization}
            onSave={(newCust) => {
              setCustomization(newCust);
              setShowCustomization(false);
            }}
            onClose={() => setShowCustomization(false)}
          />
        )}
      </div>
    );
  }

  // ═══════════ JOIN ROOM ═══════════
  if (screen === 'join') {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.shell, maxWidth: 620 }}>
          <TopHeader subtitle="ПОДКЛЮЧЕНИЕ К СУЩЕСТВУЮЩЕМУ УБЕЖИЩУ" />

          <div style={styles.subPageToolbar}>
            <button
              onClick={() => setGameState(prev => ({ ...prev, screen: 'lobby' }))}
              style={styles.backBtn}
            >
              ← МЕНЮ
            </button>
            <button
              className="btn-terminal"
              style={styles.inlineCustomizeBtn}
              onClick={() => setShowCustomization(true)}
            >
              ОБЛИК: {activeModelLabel}
            </button>
          </div>

          <div style={styles.joinBody}>
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>ИМЯ ИГРОКА</label>
              <input
                value={nickname}
                onChange={e => handleNicknameChange(e.target.value)}
                placeholder={displayName}
                maxLength={24}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>КОД ДОСТУПА УБЕЖИЩА</label>
              <input
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="XXXXXX"
                maxLength={6}
                style={styles.codeInput}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
              />
            </div>

            <button
              className="btn-terminal primary"
              style={{ marginTop: 8 }}
              onClick={handleJoin}
              disabled={loading}
            >
              {loading ? 'ПОДКЛЮЧЕНИЕ...' : 'ВОЙТИ В УБЕЖИЩЕ'}
            </button>
          </div>

          <div style={styles.bottomFooter}>
            <span>ТРЕБУЕТСЯ 6-ЗНАЧНЫЙ КОД ХОСТА</span>
            <span>ЗАЩИЩЕННЫЙ КАНАЛ</span>
          </div>
        </div>

        {showCustomization && (
          <CustomizationPanel
            currentCustomization={customization}
            onSave={(newCust) => {
              setCustomization(newCust);
              setShowCustomization(false);
            }}
            onClose={() => setShowCustomization(false)}
          />
        )}
      </div>
    );
  }

  return null;
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '28px 20px',
  },
  shell: {
    width: '100%',
    maxWidth: 960,
    background: 'linear-gradient(180deg, #141820 0%, #0e1116 100%)',
    border: '1px solid var(--border-strong)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 60px rgba(0,0,0,0.7)',
    display: 'flex',
    flexDirection: 'column',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 24px',
    borderBottom: '1px solid var(--border-dim)',
    background: 'rgba(0, 0, 0, 0.25)',
    gap: 16,
    flexWrap: 'wrap',
  },
  brandBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  brandMark: {
    width: 42,
    height: 42,
    border: '1px solid var(--amber)',
    background: 'rgba(217, 155, 38, 0.12)',
    color: 'var(--amber-bright)',
    fontFamily: 'var(--font-display)',
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: 3,
    lineHeight: 1,
    color: 'var(--text)',
  },
  brandSub: {
    fontSize: 10,
    color: 'var(--text-dim)',
    letterSpacing: 2,
    marginTop: 5,
  },
  profilePill: (linked) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '7px 14px 7px 9px',
    borderRadius: 10,
    border: `1px solid ${linked ? 'rgba(88, 101, 242, 0.55)' : 'rgba(255, 255, 255, 0.12)'}`,
    background: linked
      ? 'linear-gradient(135deg, rgba(88, 101, 242, 0.14) 0%, rgba(16, 20, 28, 0.95) 100%)'
      : 'linear-gradient(135deg, rgba(28, 33, 44, 0.85) 0%, rgba(13, 16, 21, 0.95) 100%)',
    boxShadow: linked ? '0 2px 14px rgba(88, 101, 242, 0.18)' : 'none',
  }),
  profileAvatar: (linked) => ({
    position: 'relative',
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: `2px solid ${linked ? '#5865F2' : 'var(--amber)'}`,
    background: '#181c24',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--amber-bright)',
    overflow: 'hidden',
    flexShrink: 0,
  }),
  avatarStatusRing: (linked) => ({
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: linked ? '#23a55a' : '#d99b26',
    border: '2px solid #0d1015',
  }),
  profileInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  profileNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  profileName: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 0.4,
    color: 'var(--text)',
  },
  profileSourceTag: (linked) => ({
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1,
    padding: '2px 6px',
    borderRadius: 4,
    background: linked ? 'rgba(88, 101, 242, 0.28)' : 'rgba(255, 255, 255, 0.08)',
    color: linked ? '#b8c0ff' : 'var(--text-dim)',
  }),
  profileSub: {
    fontSize: 10,
    color: 'var(--text-dim)',
    letterSpacing: 0.3,
  },
  lobbyGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 360px) 1fr',
    gap: 0,
  },
  navColumn: {
    padding: '24px',
    borderRight: '1px solid var(--border-dim)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: 24,
  },
  panelCaption: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--text-dim)',
    letterSpacing: 2,
    marginBottom: 12,
  },
  menuStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  menuBtn: {
    justifyContent: 'space-between',
    padding: '14px 16px',
  },
  menuIdx: {
    fontSize: 11,
    color: 'var(--amber)',
    fontWeight: 700,
    minWidth: 24,
    textAlign: 'left',
  },
  menuText: {
    flex: 1,
    textAlign: 'left',
  },
  menuArrow: {
    color: 'var(--text-dim)',
    fontSize: 14,
  },
  loadoutSummary: {
    border: '1px solid var(--border-dim)',
    background: '#0d1015',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 11,
    gap: 10,
  },
  summaryKey: {
    color: 'var(--text-dim)',
    letterSpacing: 1.5,
  },
  summaryVal: {
    color: 'var(--text)',
    fontWeight: 600,
    textAlign: 'right',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  briefingColumn: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: 16,
  },
  briefingFooterNote: {
    fontSize: 11,
    color: 'var(--text-dim)',
    borderTop: '1px solid var(--border-dim)',
    paddingTop: 12,
    lineHeight: 1.5,
  },
  sectionBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  sectionHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border-dim)',
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1.8,
    color: 'var(--amber)',
  },
  sectionCode: {
    fontSize: 10,
    color: 'var(--text-dim)',
    letterSpacing: 1.5,
  },
  themeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 8,
  },
  themeGridCompact: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 6,
  },
  themeCard: (active, accent) => ({
    textAlign: 'left',
    padding: '10px 12px',
    border: `1px solid ${active ? accent : 'var(--border-dim)'}`,
    background: active ? 'rgba(255, 255, 255, 0.05)' : '#0d1015',
    boxShadow: active ? `inset 3px 0 0 ${accent}` : 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    textTransform: 'none',
    letterSpacing: 0.4,
  }),
  themeCardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  themeDot: {
    width: 7,
    height: 7,
    display: 'inline-block',
  },
  themeCode: {
    fontSize: 9,
    color: 'var(--text-dim)',
    letterSpacing: 1.5,
  },
  themeLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  themeDesc: {
    fontSize: 11,
    color: 'var(--text-muted)',
    lineHeight: 1.35,
  },
  subPageToolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 24px',
    borderBottom: '1px solid var(--border-dim)',
    background: 'rgba(0, 0, 0, 0.15)',
    gap: 12,
    flexWrap: 'wrap',
  },
  backBtn: {
    padding: '7px 14px',
    border: '1px solid var(--border)',
    background: '#12161d',
    fontSize: 11,
    color: 'var(--text-muted)',
  },
  inlineCustomizeBtn: {
    width: 'auto',
    padding: '7px 14px',
    fontSize: 11,
  },
  createGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(260px, 340px) 1fr',
    gap: 0,
  },
  createLeft: {
    padding: '20px 24px',
    borderRight: '1px solid var(--border-dim)',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  createRight: {
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--text-muted)',
    letterSpacing: 1.6,
  },
  actionStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 'auto',
  },
  packGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
    gap: 8,
    maxHeight: 380,
    overflowY: 'auto',
    paddingRight: 4,
  },
  packCard: (active) => ({
    textAlign: 'left',
    padding: '10px 12px',
    border: `1px solid ${active ? 'var(--amber)' : 'var(--border-dim)'}`,
    background: active ? 'rgba(217, 155, 38, 0.1)' : '#0d1015',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    textTransform: 'none',
    letterSpacing: 0.3,
  }),
  packCardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  packRadio: (active) => ({
    width: 8,
    height: 8,
    border: `1px solid ${active ? 'var(--amber-bright)' : 'var(--border-strong)'}`,
    background: active ? 'var(--amber-bright)' : 'transparent',
    display: 'inline-block',
    flexShrink: 0,
  }),
  packLabel: (active) => ({
    fontSize: 12,
    fontWeight: 600,
    color: active ? 'var(--amber-bright)' : 'var(--text)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  }),
  packDesc: {
    fontSize: 10,
    color: 'var(--text-muted)',
    lineHeight: 1.35,
  },
  joinBody: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  codeInput: {
    letterSpacing: 8,
    fontWeight: 700,
    fontSize: 22,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  bottomFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 24px',
    borderTop: '1px solid var(--border-dim)',
    background: 'rgba(0, 0, 0, 0.3)',
    fontSize: 10,
    color: 'var(--text-dim)',
    letterSpacing: 1.5,
  },
};
