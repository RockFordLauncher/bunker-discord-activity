import React, { useEffect, useRef, useState } from 'react';
import { CharacterPreviewScene } from '../3d/CharacterPreviewScene.js';
import {
  THEME_PRESETS,
  HAIR_STYLES,
  HAIR_COLORS,
  SKIN_TONES,
  FACE_FEATURES,
  TOP_TYPES,
  PANTS_TYPES,
  BOOTS_TYPES,
  HEADWEAR,
  BACK_ACCESSORIES,
  WRIST_DEVICES,
  getDefaultCustomization,
  getRandomCustomization,
} from '../3d/characterCustomizationData.js';
import { bunkerAudio } from '../audio/bunkerAudio.js';
import {
  parseBBModel,
  optimizeBBModel,
  getBBModelStats,
} from '../3d/bbmodelLoader.js';
import { BUILTIN_BBMODELS } from '../3d/builtinBBModels.js';

const TABS = [
  { id: 'presets', label: '01 ПРЕСЕТЫ' },
  { id: 'bbmodel', label: '02 .BBMODEL' },
];

const PRESET_THEMES = ['ВСЕ', 'Fallout', 'SAO', 'Resident Evil', 'Re:Zero', 'Cyberpunk'];

const BUILTIN_CATALOG = [
  { key: 'vault101', name: 'Выходец из Убежища', universe: 'FALLOUT', desc: 'Комбинезон Vault-Tec, бронежилет и Pip-Boy' },
  { key: 'raider', name: 'Рейдер Пустоши', universe: 'FALLOUT', desc: 'Шипованная броня, ремни и противогаз' },
  { key: 'wesker', name: 'Альберт Вескер', universe: 'RESIDENT EVIL', desc: 'Кожаный тренчкот, очки и кобура Umbrella' },
  { key: 'leon', name: 'Леон С. Кеннеди', universe: 'RESIDENT EVIL', desc: 'Тактический жилет R.P.D. и разгрузка' },
  { key: 'hunk', name: 'HUNK (Mr. Death)', universe: 'RESIDENT EVIL', desc: 'Шлем PASGT, противогаз S10 и броня Umbrella' },
  { key: 'kirito', name: 'Кирито (Черный Мечник)', universe: 'SAO', desc: 'Кожаный плащ и парные клинки' },
  { key: 'asuna', name: 'Асуна (Рыцари Крови)', universe: 'SAO', desc: 'Бело-красный мундир гильдии и рапира' },
  { key: 'rem', name: 'Рем', universe: 'RE:ZERO', desc: 'Костюм горничной особняка Розвааля' },
  { key: 'subaru', name: 'Субару Нацуки', universe: 'RE:ZERO', desc: 'Спортивная куртка и повседневная экипировка' },
  { key: 'cyborg', name: 'Киберпанк-наемник', universe: 'CYBERPUNK', desc: 'Импланты, визор и тактическая куртка' },
];

export default function CustomizationPanel({ currentCustomization, onSave, onClose }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('presets');
  const [themeFilter, setThemeFilter] = useState('ВСЕ');
  const [isDragging, setIsDragging] = useState(false);
  const [bbmodelError, setBbmodelError] = useState(null);
  const [cust, setCust] = useState(() => currentCustomization || getDefaultCustomization());

  useEffect(() => {
    if (!containerRef.current) return;
    const preview = new CharacterPreviewScene(containerRef.current, cust);
    sceneRef.current = preview;
    return () => {
      preview.destroy();
      sceneRef.current = null;
    };
  }, []);

  const updateCust = (updates) => {
    bunkerAudio.playPipBoySelect();
    setCust((prev) => {
      const next = { ...prev, ...updates, preset: updates.preset || 'custom' };
      sceneRef.current?.updateCharacter(next);
      return next;
    });
  };

  const handleSelectPreset = (preset) => {
    bunkerAudio.playPipBoySelect();
    const next = { ...preset.data, preset: preset.id, customBBModel: null, modelName: null };
    setCust(next);
    sceneRef.current?.updateCharacter(next);
  };

  const handleBBModelFile = async (file) => {
    if (!file) return;
    try {
      setBbmodelError(null);
      const text = await file.text();
      const raw = parseBBModel(text);
      const optimized = optimizeBBModel(raw);
      bunkerAudio.playPipBoySelect();
      const next = {
        ...cust,
        customBBModel: optimized,
        modelName: file.name.replace(/\.bbmodel$/i, ''),
        preset: 'custom_bbmodel',
      };
      setCust(next);
      sceneRef.current?.updateCharacter(next);
      setActiveTab('bbmodel');
    } catch (err) {
      console.error('Error loading .bbmodel:', err);
      setBbmodelError('Ошибка чтения .bbmodel: некорректный JSON или поврежденный файл.');
    }
  };

  const handleSelectBuiltinBBModel = (key, name) => {
    bunkerAudio.playPipBoySelect();
    const modelData = BUILTIN_BBMODELS[key];
    if (!modelData) return;
    const next = {
      ...cust,
      customBBModel: modelData,
      modelName: name,
      preset: key,
    };
    setCust(next);
    sceneRef.current?.updateCharacter(next);
  };

  const handleClearBBModel = () => {
    bunkerAudio.playPipBoySelect();
    const next = {
      ...cust,
      customBBModel: null,
      modelName: null,
      preset: 'vault101',
    };
    setCust(next);
    sceneRef.current?.updateCharacter(next);
  };

  const handleRandomize = () => {
    bunkerAudio.playPipBoySelect();
    const next = getRandomCustomization();
    next.customBBModel = null;
    next.modelName = null;
    setCust(next);
    sceneRef.current?.updateCharacter(next);
  };

  const handleReset = () => {
    bunkerAudio.playPipBoySelect();
    const next = getDefaultCustomization();
    setCust(next);
    sceneRef.current?.updateCharacter(next);
  };

  const handleSave = () => {
    bunkerAudio.playPipBoySelect();
    try {
      localStorage.setItem('bunker_customization', JSON.stringify(cust));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
    if (onSave) onSave(cust);
  };

  const filteredPresets = themeFilter === 'ВСЕ'
    ? THEME_PRESETS
    : THEME_PRESETS.filter(p => p.theme === themeFilter);

  const availableBuiltins = BUILTIN_CATALOG.filter(item => !!BUILTIN_BBMODELS[item.key]);

  const HeadScaleWidget = () => (
    <div style={styles.headScaleCard}>
      <div style={styles.headScaleTop}>
        <span style={styles.headScaleTitle}>
          МАСШТАБ ГОЛОВЫ: {Math.round((cust.headScale ?? 1.0) * 100)}% ({cust.headScale ?? 1.0}x)
        </span>
        <button
          className="btn-terminal"
          style={{ width: 'auto', fontSize: 10, padding: '3px 10px' }}
          onClick={() => updateCust({ headScale: 1.0 })}
        >
          СБРОС 1.0X
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>0.5x</span>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.05"
          value={cust.headScale ?? 1.0}
          onChange={(e) => updateCust({ headScale: parseFloat(e.target.value) })}
          style={styles.sliderInput}
        />
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>2.0x</span>
      </div>
      <div style={styles.headScalePills}>
        {[
          { label: '0.75x КОМПАКТ', val: 0.75 },
          { label: '1.0x СТАНДАРТ', val: 1.0 },
          { label: '1.25x АНИМЕ', val: 1.25 },
          { label: '1.5x ЧИБИ', val: 1.5 },
        ].map(pill => (
          <button
            key={pill.val}
            onClick={() => updateCust({ headScale: pill.val })}
            style={styles.headScalePill((cust.headScale ?? 1.0) === pill.val)}
          >
            {pill.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={styles.overlay}>
      <div style={styles.window}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.title}>РЕДАКТОР ОПЕРАТОРА</div>
            <div style={styles.subtitle}>НАСТРОЙКА 3D-МОДЕЛИ И ЭКИПИРОВКИ</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-terminal" onClick={handleReset} style={styles.headerBtn}>
              СБРОСИТЬ
            </button>
            <button className="btn-terminal" onClick={handleRandomize} style={styles.headerBtn}>
              СЛУЧАЙНЫЙ
            </button>
            <button className="btn-terminal primary" onClick={handleSave} style={styles.saveBtnTop}>
              СОХРАНИТЬ
            </button>
          </div>
        </div>

        {/* Main 2-column grid */}
        <div style={styles.mainGrid}>
          {/* Left: 3D Preview */}
          <div
            style={styles.previewPanel}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleBBModelFile(file);
            }}
          >
            <div ref={containerRef} style={styles.canvasContainer} />

            {isDragging && (
              <div style={styles.dragOverlay}>
                <div style={styles.dragOverlayContent}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--amber-bright)', letterSpacing: 1.5 }}>
                    ОТПУСТИТЕ .BBMODEL ФАЙЛ
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                    Модель загрузится на 3D-подиум автоматически
                  </div>
                </div>
              </div>
            )}

            <div style={styles.previewOverlayHint}>
              <span>ЛКМ: ВРАЩЕНИЕ</span>
              <span>/</span>
              <span>КОЛЕСО: МАСШТАБ</span>
            </div>

            <div style={styles.characterInfoBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: 1.5 }}>ТЕКУЩИЙ ОБРАЗ</span>
                <span style={cust.customBBModel ? styles.infoBBModelBadge : styles.infoThemeBadge}>
                  {cust.customBBModel ? 'BBMODEL' : (THEME_PRESETS.find(p => p.id === cust.preset)?.theme || 'КАСТОМ')}
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--amber-bright)', marginTop: 3 }}>
                {cust.customBBModel
                  ? (cust.modelName || 'Blockbench Модель')
                  : (THEME_PRESETS.find(p => p.id === cust.preset)?.name || 'Индивидуальный образ')}
              </div>

              {cust.customBBModel ? (
                <div style={{ marginTop: 8 }}>
                  {(() => {
                    const stats = getBBModelStats(cust.customBBModel);
                    return (
                      <div style={styles.bbStatsBox}>
                        <div>Элементов: <b>{stats?.elements ?? '—'}</b> | Текстур: <b>{stats?.textures ?? '—'}</b> ({stats?.resolution ?? '512x512'}) | Костей: <b>{stats?.groups ?? 0}</b></div>
                        <button
                          className="btn-terminal"
                          onClick={handleClearBBModel}
                          style={{ marginTop: 8, width: '100%', fontSize: 10, padding: '5px 10px' }}
                        >
                          ПЕРЕКЛЮЧИТЬ НА КОНСТРУКТОР ОДЕЖДЫ
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div style={styles.infoSpecsGrid}>
                  <div><b>Волосы:</b> {HAIR_STYLES.find(h => h.id === cust.hairStyle)?.name || cust.hairStyle}</div>
                  <div><b>Верх:</b> {TOP_TYPES.find(t => t.id === cust.topType)?.name || cust.topType}</div>
                  <div><b>Низ:</b> {PANTS_TYPES.find(p => p.id === cust.pantsType)?.name || cust.pantsType}</div>
                  <div><b>Голова:</b> {HEADWEAR.find(h => h.id === cust.headwear)?.name || 'Нет'}</div>
                  <div><b>Спина:</b> {BACK_ACCESSORIES.find(b => b.id === cust.backAccessory)?.name || 'Нет'}</div>
                  <div><b>Запястье:</b> {WRIST_DEVICES.find(w => w.id === cust.wristDevice)?.name || 'Нет'}</div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Controls */}
          <div style={styles.controlsPanel}>
            <div style={styles.tabsRow}>
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      bunkerAudio.playPipBoySelect();
                      setActiveTab(tab.id);
                    }}
                    style={styles.tabBtn(isActive)}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div style={styles.tabContentArea}>
              {/* 01. BBMODEL TAB */}
              {activeTab === 'bbmodel' && (
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".bbmodel,.json"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleBBModelFile(file);
                      e.target.value = '';
                    }}
                  />

                  <div
                    style={styles.bbDropZone}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'copy';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleBBModelFile(file);
                    }}
                  >
                    <div style={styles.bbDropTitle}>ИМПОРТ ПОЛЬЗОВАТЕЛЬСКОЙ .BBMODEL</div>
                    <div style={styles.bbDropSub}>
                      Перетащите файл Blockbench (.bbmodel) или нажмите для выбора с диска.
                    </div>
                    <button className="btn-terminal primary" style={{ marginTop: 12, width: 'auto', padding: '8px 20px' }}>
                      ВЫБРАТЬ ФАЙЛ
                    </button>
                  </div>

                  {bbmodelError && <div style={styles.bbErrorBox}>{bbmodelError}</div>}

                  {cust.customBBModel && (
                    <div style={styles.activeBBBox}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber-bright)' }}>
                          АКТИВНА МОДЕЛЬ: {cust.modelName || 'Blockbench'}
                        </span>
                        <span style={styles.infoBBModelBadge}>BBMODEL</span>
                      </div>
                      {(() => {
                        const stats = getBBModelStats(cust.customBBModel);
                        return (
                          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                            <span>Элементов: <b style={{ color: 'var(--text)' }}>{stats?.elements}</b></span>
                            <span>Текстур: <b style={{ color: 'var(--text)' }}>{stats?.textures}</b></span>
                            <span>Атлас: <b style={{ color: 'var(--text)' }}>{stats?.resolution}</b></span>
                          </div>
                        );
                      })()}
                      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                        <button
                          className="btn-terminal"
                          onClick={handleClearBBModel}
                          style={{ width: 'auto', fontSize: 11, padding: '6px 14px' }}
                        >
                          СБРОСИТЬ НА СТАНДАРТНУЮ
                        </button>
                        <button
                          className="btn-terminal"
                          onClick={() => {
                            const blob = new Blob([JSON.stringify(cust.customBBModel, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${cust.modelName || 'character'}.bbmodel`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          style={{ width: 'auto', fontSize: 11, padding: '6px 14px' }}
                        >
                          ЭКСПОРТ .BBMODEL
                        </button>
                      </div>
                    </div>
                  )}

                  <HeadScaleWidget />

                  <div style={{ marginTop: 18 }}>
                    <div style={styles.sectionHeader}>ВСТРОЕННЫЕ 3D-МОДЕЛИ ({availableBuiltins.length})</div>
                    <div style={styles.bbPresetsGrid}>
                      {availableBuiltins.map((item) => {
                        const isSelected = cust.preset === item.key && !!cust.customBBModel;
                        const stats = getBBModelStats(BUILTIN_BBMODELS[item.key]);
                        return (
                          <div
                            key={item.key}
                            style={styles.bbPresetCard(isSelected)}
                            onClick={() => handleSelectBuiltinBBModel(item.key, `${item.name} (${item.universe})`)}
                          >
                            <div style={styles.presetCardHeader}>
                              <span style={styles.presetThemeBadge}>{item.universe}</span>
                              <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{stats?.elements ?? '—'} ЭЛ.</span>
                            </div>
                            <div style={styles.presetCardTitle}>{item.name}</div>
                            <div style={styles.presetCardDesc}>{item.desc}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* 02. PRESETS TAB */}
              {activeTab === 'presets' && (
                <div>
                  <div style={styles.themeFilterBar}>
                    {PRESET_THEMES.map((theme) => (
                      <button
                        key={theme}
                        onClick={() => {
                          bunkerAudio.playPipBoySelect();
                          setThemeFilter(theme);
                        }}
                        style={styles.themeFilterBtn(themeFilter === theme)}
                      >
                        {theme}
                      </button>
                    ))}
                  </div>

                  <div style={styles.presetsGrid}>
                    {filteredPresets.map((preset) => {
                      const isSelected = cust.preset === preset.id && !cust.customBBModel;
                      return (
                        <div
                          key={preset.id}
                          onClick={() => handleSelectPreset(preset)}
                          style={styles.presetCard(isSelected)}
                        >
                          <div style={styles.presetCardHeader}>
                            <span style={styles.presetThemeBadge}>{preset.theme}</span>
                          </div>
                          <div style={styles.presetCardTitle}>{preset.name}</div>
                          <div style={styles.presetCardDesc}>{preset.desc}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 03. HAIR TAB */}
              {activeTab === 'hair' && (
                <div>
                  <div style={styles.sectionHeader}>СТИЛЬ ПРИЧЕСКИ</div>
                  <div style={styles.itemsGrid}>
                    {HAIR_STYLES.map((style, idx) => (
                      <div
                        key={style.id}
                        onClick={() => updateCust({ hairStyle: style.id })}
                        style={styles.gridItem(cust.hairStyle === style.id)}
                      >
                        <span style={styles.itemIdx}>{String(idx + 1).padStart(2, '0')}</span>
                        <div style={styles.gridItemName}>{style.name}</div>
                      </div>
                    ))}
                  </div>

                  <div style={styles.sectionHeader}>ЦВЕТ ВОЛОС</div>
                  <div style={styles.colorSwatchesGrid}>
                    {HAIR_COLORS.map((color) => (
                      <div
                        key={color.id}
                        onClick={() => updateCust({ hairColor: color.id })}
                        style={styles.colorSwatchBox(cust.hairColor === color.id)}
                      >
                        <div style={{ ...styles.colorCircle, background: color.hex }} />
                        <div style={styles.colorName}>{color.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 04. FACE & SKIN TAB */}
              {activeTab === 'face' && (
                <div>
                  <HeadScaleWidget />

                  <div style={styles.sectionHeader}>ОТТЕНОК КОЖИ</div>
                  <div style={styles.colorSwatchesGrid}>
                    {SKIN_TONES.map((skin) => (
                      <div
                        key={skin.id}
                        onClick={() => updateCust({ skinTone: skin.id })}
                        style={styles.colorSwatchBox(cust.skinTone === skin.id)}
                      >
                        <div style={{ ...styles.colorCircle, background: skin.hex }} />
                        <div style={styles.colorName}>{skin.name}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{skin.desc}</div>
                      </div>
                    ))}
                  </div>

                  <div style={styles.sectionHeader}>ЧЕРТЫ ЛИЦА И ГЛАЗ</div>
                  <div style={styles.itemsGrid}>
                    {FACE_FEATURES.map((feat, idx) => (
                      <div
                        key={feat.id}
                        onClick={() => updateCust({ faceFeature: feat.id })}
                        style={styles.gridItem(cust.faceFeature === feat.id)}
                      >
                        <span style={styles.itemIdx}>{String(idx + 1).padStart(2, '0')}</span>
                        <div style={styles.gridItemName}>{feat.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 05. TOP TAB */}
              {activeTab === 'top' && (
                <div>
                  <div style={styles.sectionHeader}>ВЕРХНЯЯ ОДЕЖДА И БРОНЯ</div>
                  <div style={styles.itemsGrid}>
                    {TOP_TYPES.map((top, idx) => (
                      <div
                        key={top.id}
                        onClick={() => updateCust({ topType: top.id })}
                        style={styles.gridItem(cust.topType === top.id)}
                      >
                        <span style={styles.itemIdx}>{String(idx + 1).padStart(2, '0')}</span>
                        <div style={styles.gridItemName}>{top.name}</div>
                        <span style={styles.itemThemeTag}>{top.theme}</span>
                      </div>
                    ))}
                  </div>

                  <div style={styles.sectionHeader}>ЦВЕТОВАЯ СХЕМА</div>
                  <div style={{ display: 'flex', gap: 24, marginTop: 10 }}>
                    <div>
                      <div style={styles.colorPickerLabel}>ОСНОВНОЙ ЦВЕТ</div>
                      <input
                        type="color"
                        value={cust.topColor || '#16345c'}
                        onChange={(e) => updateCust({ topColor: e.target.value })}
                        style={styles.colorPicker}
                      />
                    </div>
                    <div>
                      <div style={styles.colorPickerLabel}>АКЦЕНТ / ОТДЕЛКА</div>
                      <input
                        type="color"
                        value={cust.accentColor || '#e6a817'}
                        onChange={(e) => updateCust({ accentColor: e.target.value })}
                        style={styles.colorPicker}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 06. PANTS TAB */}
              {activeTab === 'pants' && (
                <div>
                  <div style={styles.sectionHeader}>ШТАНЫ И ПОНОЖИ</div>
                  <div style={styles.itemsGrid}>
                    {PANTS_TYPES.map((pants, idx) => (
                      <div
                        key={pants.id}
                        onClick={() => updateCust({ pantsType: pants.id })}
                        style={styles.gridItem(cust.pantsType === pants.id)}
                      >
                        <span style={styles.itemIdx}>{String(idx + 1).padStart(2, '0')}</span>
                        <div style={styles.gridItemName}>{pants.name}</div>
                      </div>
                    ))}
                  </div>

                  <div style={styles.sectionHeader}>ЦВЕТ</div>
                  <div style={{ marginTop: 10 }}>
                    <input
                      type="color"
                      value={cust.pantsColor || '#16345c'}
                      onChange={(e) => updateCust({ pantsColor: e.target.value })}
                      style={styles.colorPicker}
                    />
                  </div>
                </div>
              )}

              {/* 07. BOOTS TAB */}
              {activeTab === 'boots' && (
                <div>
                  <div style={styles.sectionHeader}>ОБУВЬ</div>
                  <div style={styles.itemsGrid}>
                    {BOOTS_TYPES.map((boot, idx) => (
                      <div
                        key={boot.id}
                        onClick={() => updateCust({ bootsType: boot.id })}
                        style={styles.gridItem(cust.bootsType === boot.id)}
                      >
                        <span style={styles.itemIdx}>{String(idx + 1).padStart(2, '0')}</span>
                        <div style={styles.gridItemName}>{boot.name}</div>
                      </div>
                    ))}
                  </div>

                  <div style={styles.sectionHeader}>ЦВЕТ</div>
                  <div style={{ marginTop: 10 }}>
                    <input
                      type="color"
                      value={cust.bootsColor || '#1a1814'}
                      onChange={(e) => updateCust({ bootsColor: e.target.value })}
                      style={styles.colorPicker}
                    />
                  </div>
                </div>
              )}

              {/* 08. HEADWEAR TAB */}
              {activeTab === 'headwear' && (
                <div>
                  <div style={styles.sectionHeader}>ГОЛОВНОЙ УБОР И МАСКИ</div>
                  <div style={styles.itemsGrid}>
                    {HEADWEAR.map((head, idx) => (
                      <div
                        key={head.id}
                        onClick={() => updateCust({ headwear: head.id })}
                        style={styles.gridItem(cust.headwear === head.id)}
                      >
                        <span style={styles.itemIdx}>{String(idx + 1).padStart(2, '0')}</span>
                        <div style={styles.gridItemName}>{head.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 09. BACK TAB */}
              {activeTab === 'back' && (
                <div>
                  <div style={styles.sectionHeader}>СНАРЯЖЕНИЕ ЗА СПИНОЙ</div>
                  <div style={styles.itemsGrid}>
                    {BACK_ACCESSORIES.map((acc, idx) => (
                      <div
                        key={acc.id}
                        onClick={() => updateCust({ backAccessory: acc.id })}
                        style={styles.gridItem(cust.backAccessory === acc.id)}
                      >
                        <span style={styles.itemIdx}>{String(idx + 1).padStart(2, '0')}</span>
                        <div style={styles.gridItemName}>{acc.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 10. WRIST TAB */}
              {activeTab === 'wrist' && (
                <div>
                  <div style={styles.sectionHeader}>НАРУЧНЫЕ УСТРОЙСТВА</div>
                  <div style={styles.itemsGrid}>
                    {WRIST_DEVICES.map((wrist, idx) => (
                      <div
                        key={wrist.id}
                        onClick={() => updateCust({ wristDevice: wrist.id })}
                        style={styles.gridItem(cust.wristDevice === wrist.id)}
                      >
                        <span style={styles.itemIdx}>{String(idx + 1).padStart(2, '0')}</span>
                        <div style={styles.gridItemName}>{wrist.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Action Bar */}
            <div style={styles.footerBar}>
              <button className="btn-terminal" onClick={onClose} style={{ width: 'auto', padding: '10px 20px' }}>
                ОТМЕНА
              </button>
              <button
                className="btn-terminal primary"
                onClick={handleSave}
                style={{ width: 'auto', padding: '10px 28px' }}
              >
                ПРИМЕНИТЬ ОБЛИК
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(6, 8, 11, 0.92)',
    backdropFilter: 'blur(6px)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    userSelect: 'none',
  },
  window: {
    position: 'relative',
    width: '95vw',
    maxWidth: 1280,
    height: '92vh',
    background: '#0f1318',
    border: '1px solid var(--border-strong)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 24px 64px rgba(0,0,0,0.8)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '14px 22px',
    borderBottom: '1px solid var(--border-dim)',
    background: 'rgba(0, 0, 0, 0.3)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: 2.5,
    color: 'var(--text)',
  },
  subtitle: {
    fontSize: 10,
    color: 'var(--text-dim)',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  headerBtn: {
    width: 'auto',
    padding: '7px 14px',
    fontSize: 11,
  },
  saveBtnTop: {
    width: 'auto',
    padding: '7px 18px',
    fontSize: 11,
  },
  mainGrid: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '40% 60%',
    overflow: 'hidden',
  },
  previewPanel: {
    position: 'relative',
    borderRight: '1px solid var(--border-dim)',
    background: '#090b0f',
    display: 'flex',
    flexDirection: 'column',
  },
  canvasContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  previewOverlayHint: {
    position: 'absolute',
    top: 12,
    left: 12,
    display: 'flex',
    gap: 8,
    fontSize: 10,
    color: 'var(--text-muted)',
    background: 'rgba(11, 13, 16, 0.8)',
    padding: '4px 10px',
    border: '1px solid var(--border-dim)',
    pointerEvents: 'none',
    letterSpacing: 1,
  },
  characterInfoBox: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    right: 14,
    background: 'rgba(13, 16, 21, 0.94)',
    border: '1px solid var(--border)',
    padding: '12px 14px',
  },
  infoThemeBadge: {
    fontSize: 9,
    padding: '2px 6px',
    background: 'rgba(217, 155, 38, 0.14)',
    border: '1px solid var(--amber-dim)',
    color: 'var(--amber-bright)',
    fontWeight: 700,
    letterSpacing: 1,
  },
  infoBBModelBadge: {
    fontSize: 9,
    padding: '2px 6px',
    background: 'rgba(70, 168, 112, 0.18)',
    border: '1px solid var(--success)',
    color: 'var(--success)',
    fontWeight: 700,
    letterSpacing: 1,
  },
  dragOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(9, 11, 15, 0.9)',
    border: '2px dashed var(--amber)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 25,
    pointerEvents: 'none',
  },
  dragOverlayContent: {
    textAlign: 'center',
    padding: '20px 28px',
    background: '#12161d',
    border: '1px solid var(--border)',
  },
  bbStatsBox: {
    fontSize: 11,
    color: 'var(--text-muted)',
    borderTop: '1px solid var(--border-dim)',
    paddingTop: 8,
  },
  infoSpecsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '4px 10px',
    fontSize: 10,
    color: 'var(--text-muted)',
    marginTop: 8,
    borderTop: '1px solid var(--border-dim)',
    paddingTop: 6,
  },
  controlsPanel: {
    display: 'flex',
    flexDirection: 'column',
    background: '#10141a',
    overflow: 'hidden',
  },
  tabsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    padding: '10px 16px',
    borderBottom: '1px solid var(--border-dim)',
    background: 'rgba(0, 0, 0, 0.25)',
  },
  tabBtn: (isActive) => ({
    padding: '6px 10px',
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: 600,
    border: `1px solid ${isActive ? 'var(--amber)' : 'var(--border-dim)'}`,
    background: isActive ? 'rgba(217, 155, 38, 0.16)' : '#141820',
    color: isActive ? 'var(--amber-bright)' : 'var(--text-muted)',
    cursor: 'pointer',
  }),
  tabContentArea: {
    flex: 1,
    padding: '16px 20px',
    overflowY: 'auto',
  },
  bbDropZone: {
    border: '1px dashed var(--border-strong)',
    background: '#0c0f14',
    padding: '22px 18px',
    textAlign: 'center',
    cursor: 'pointer',
    marginBottom: 14,
  },
  bbDropTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--amber-bright)',
    letterSpacing: 1.2,
  },
  bbDropSub: {
    fontSize: 11,
    color: 'var(--text-muted)',
    marginTop: 6,
  },
  bbErrorBox: {
    padding: '10px 14px',
    background: 'rgba(212, 77, 77, 0.14)',
    border: '1px solid var(--danger)',
    color: '#f29999',
    fontSize: 12,
    marginBottom: 14,
  },
  activeBBBox: {
    background: '#131820',
    border: '1px solid var(--border)',
    padding: '12px 14px',
    marginBottom: 14,
  },
  headScaleCard: {
    background: '#12161d',
    border: '1px solid var(--border-dim)',
    padding: '12px 14px',
    marginBottom: 14,
  },
  headScaleTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headScaleTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--amber-bright)',
    letterSpacing: 1,
  },
  sliderInput: {
    flex: 1,
    accentColor: 'var(--amber)',
    cursor: 'pointer',
    height: 4,
  },
  headScalePills: {
    display: 'flex',
    gap: 6,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  headScalePill: (isActive) => ({
    padding: '4px 10px',
    fontSize: 10,
    fontWeight: 600,
    border: `1px solid ${isActive ? 'var(--amber)' : 'var(--border-dim)'}`,
    background: isActive ? 'rgba(217, 155, 38, 0.18)' : '#0d1015',
    color: isActive ? 'var(--amber-bright)' : 'var(--text-muted)',
    cursor: 'pointer',
  }),
  bbPresetsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 10,
  },
  bbPresetCard: (isSelected) => ({
    padding: '12px 14px',
    border: `1px solid ${isSelected ? 'var(--amber)' : 'var(--border-dim)'}`,
    background: isSelected ? 'rgba(217, 155, 38, 0.12)' : '#0d1015',
    boxShadow: isSelected ? 'inset 3px 0 0 var(--amber)' : 'none',
    cursor: 'pointer',
  }),
  themeFilterBar: {
    display: 'flex',
    gap: 6,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  themeFilterBtn: (isActive) => ({
    padding: '5px 12px',
    fontSize: 10,
    fontWeight: 600,
    border: `1px solid ${isActive ? 'var(--amber)' : 'var(--border-dim)'}`,
    background: isActive ? 'rgba(217, 155, 38, 0.18)' : '#0d1015',
    color: isActive ? 'var(--amber-bright)' : 'var(--text-muted)',
    cursor: 'pointer',
  }),
  presetsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 10,
  },
  presetCard: (isSelected) => ({
    padding: '12px 14px',
    border: `1px solid ${isSelected ? 'var(--amber)' : 'var(--border-dim)'}`,
    background: isSelected ? 'rgba(217, 155, 38, 0.12)' : '#0d1015',
    boxShadow: isSelected ? 'inset 3px 0 0 var(--amber)' : 'none',
    cursor: 'pointer',
  }),
  presetCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  presetThemeBadge: {
    fontSize: 9,
    padding: '2px 6px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border-dim)',
    color: 'var(--amber)',
    letterSpacing: 1,
    fontWeight: 600,
  },
  presetCardTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text)',
    marginTop: 8,
  },
  presetCardDesc: {
    fontSize: 11,
    color: 'var(--text-muted)',
    marginTop: 4,
    lineHeight: 1.4,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--amber)',
    letterSpacing: 1.6,
    marginTop: 14,
    marginBottom: 10,
    borderBottom: '1px solid var(--border-dim)',
    paddingBottom: 5,
  },
  itemsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))',
    gap: 8,
  },
  gridItem: (isSelected) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    border: `1px solid ${isSelected ? 'var(--amber)' : 'var(--border-dim)'}`,
    background: isSelected ? 'rgba(217, 155, 38, 0.12)' : '#0d1015',
    boxShadow: isSelected ? 'inset 2px 0 0 var(--amber)' : 'none',
    cursor: 'pointer',
    position: 'relative',
  }),
  itemIdx: {
    fontSize: 10,
    color: 'var(--text-dim)',
    fontWeight: 700,
    flexShrink: 0,
  },
  gridItemName: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text)',
    lineHeight: 1.3,
  },
  itemThemeTag: {
    position: 'absolute',
    top: 4,
    right: 6,
    fontSize: 8,
    color: 'var(--text-dim)',
    letterSpacing: 0.8,
  },
  colorSwatchesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))',
    gap: 8,
  },
  colorSwatchBox: (isSelected) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: 10,
    border: `1px solid ${isSelected ? 'var(--amber)' : 'var(--border-dim)'}`,
    background: isSelected ? 'rgba(217, 155, 38, 0.12)' : '#0d1015',
    cursor: 'pointer',
    textAlign: 'center',
  }),
  colorCircle: {
    width: 26,
    height: 26,
    borderRadius: '50%',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    marginBottom: 6,
  },
  colorName: {
    fontSize: 11,
    color: 'var(--text)',
  },
  colorPickerLabel: {
    fontSize: 10,
    color: 'var(--text-muted)',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  colorPicker: {
    width: 60,
    height: 36,
    border: '1px solid var(--border)',
    background: '#0d1015',
    cursor: 'pointer',
  },
  footerBar: {
    padding: '12px 20px',
    borderTop: '1px solid var(--border-dim)',
    background: 'rgba(0, 0, 0, 0.35)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
};
