import React, { useState, useEffect } from 'react';
import {
  Crosshair as CrosshairIcon,
  RotateCcw,
  Sparkles,
  Menu,
  Clock,
  Compass
} from 'lucide-react';
import { GameStats, GameMode, HitResult, WeaponState, FireMode } from '../game/types';

interface HUDProps {
  stats: GameStats;
  weaponState: WeaponState;
  gameMode: GameMode;
  timeAttackLeft: number;
  hitResult: HitResult | null;
  rangefinderDistance: number | null;
  rangefinderTarget: string | null;
  isPointerLocked: boolean;
  isLoading: boolean;
  loadingStatus: string;
  onSelectMode: (mode: GameMode) => void;
  onResetTargets: () => void;
  onRequestLock: () => void;
  onToggleADS: () => void;
  onSelectFireMode: (mode: FireMode) => void;
  onReload: () => void;
  onTriggerPull: () => void;
  onTriggerRelease: () => void;
  onOpenMenu: () => void;
  onMoveKey?: (key: 'forward' | 'backward' | 'left' | 'right', active: boolean) => void;
}

export const HUD: React.FC<HUDProps> = ({
  stats,
  weaponState,
  gameMode,
  timeAttackLeft,
  hitResult,
  rangefinderDistance,
  rangefinderTarget,
  isPointerLocked,
  isLoading,
  loadingStatus,
  onResetTargets,
  onRequestLock,
  onToggleADS,
  onSelectFireMode,
  onReload,
  onTriggerPull,
  onTriggerRelease,
  onOpenMenu,
  onMoveKey,
}) => {
  const [showHitmarker, setShowHitmarker] = useState(false);
  const [isHeadshotHit, setIsHeadshotHit] = useState(false);
  const [recentHitText, setRecentHitText] = useState<string | null>(null);

  // Trigger hitmarker animation
  useEffect(() => {
    if (hitResult && hitResult.hit) {
      setShowHitmarker(true);
      setIsHeadshotHit(!!hitResult.isHeadshot);
      if (hitResult.isHeadshot) {
        setRecentHitText(`HEADSHOT! +${hitResult.points}`);
      } else if (hitResult.hitType === 'STEEL_GONG') {
        setRecentHitText(`ÇELİK GONG! +${hitResult.points}`);
      } else {
        setRecentHitText(`+${hitResult.points}`);
      }

      const timer = setTimeout(() => setShowHitmarker(false), 200);
      const textTimer = setTimeout(() => setRecentHitText(null), 600);

      return () => {
        clearTimeout(timer);
        clearTimeout(textTimer);
      };
    }
  }, [hitResult]);

  return (
    <div
      id="shooting_range_hud"
      className="pointer-events-none absolute inset-0 select-none overflow-hidden z-20 flex flex-col justify-between p-3 sm:p-5"
    >
      {/* 1. TOP HEADER & CONTROLS: Minimalist & Clean */}
      <div id="hud_top_bar" className="flex items-center justify-between w-full">
        {/* Left: Minimal Badge & Mode */}
        <div className="flex items-center gap-2">
          <div className="bg-neutral-950/70 backdrop-blur-md border border-neutral-800/60 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-md">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-tactical font-bold tracking-wider text-xs text-neutral-200">
              SWAT M4A1
            </span>
            <span className="text-neutral-600 text-[10px]">|</span>
            <span className="font-tactical text-[11px] text-amber-400 font-semibold uppercase">
              {gameMode === 'TIME_ATTACK' ? '60S MÜCADELE' : 'SERBEST ATIŞ'}
            </span>
          </div>

          {/* Time Attack Countdown */}
          {gameMode === 'TIME_ATTACK' && (
            <div
              id="challenge_timer_badge"
              className="bg-neutral-950/80 backdrop-blur-md border border-amber-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md"
            >
              <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '3s' }} />
              <span className={`font-tactical font-bold text-sm tabular-nums ${timeAttackLeft <= 10 ? 'text-rose-500 animate-pulse' : 'text-amber-400'}`}>
                {timeAttackLeft}s
              </span>
            </div>
          )}
        </div>

        {/* Right: Reset Targets & ESC Menu Button */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            id="btn_quick_reset_targets"
            onClick={onResetTargets}
            className="bg-neutral-950/70 hover:bg-neutral-800/80 text-neutral-300 hover:text-white border border-neutral-800/60 px-2.5 py-1.5 rounded-xl text-[11px] font-tactical tracking-wider flex items-center gap-1.5 transition-colors shadow-md active:scale-95"
            title="Hedefleri Dik"
          >
            <RotateCcw className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">HEDEFLER</span>
          </button>

          <button
            id="btn_open_esc_menu"
            onClick={onOpenMenu}
            className="bg-neutral-950/80 hover:bg-neutral-800/90 text-amber-400 hover:text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-xl text-[11px] font-tactical font-bold tracking-wider flex items-center gap-1.5 transition-all shadow-md active:scale-95"
            title="Menüyü Aç (ESC)"
          >
            <Menu className="w-3.5 h-3.5" />
            <span>MENÜ (ESC)</span>
          </button>
        </div>
      </div>

      {/* 2. CENTER RETICLE / CROSSHAIR & HITMARKER */}
      <div id="crosshair_viewport_center" className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* In ADS, hide/dim the 2D crosshair so player aims directly with the authentic 3D M4A1 iron sights! */}
        <div
          className={`relative transition-all duration-100 ${
            weaponState.isAiming ? 'opacity-0 scale-50' : 'opacity-85 scale-100'
          }`}
          style={{
            transform: `scale(${weaponState.isFiring ? 1.4 : 1})`,
          }}
        >
          {/* Center Amber Dot */}
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/60" />

          {/* 4 Crisp Crosshair Ticks */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 pointer-events-none">
            <div className="absolute left-1/2 -top-2.5 -translate-x-1/2 w-0.5 h-2 bg-neutral-200/90" />
            <div className="absolute left-1/2 -bottom-2.5 -translate-x-1/2 w-0.5 h-2 bg-neutral-200/90" />
            <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-2 h-0.5 bg-neutral-200/90" />
            <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-2 h-0.5 bg-neutral-200/90" />
          </div>
        </div>

        {/* Hitmarker animation overlay */}
        {showHitmarker && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 hitmarker-anim pointer-events-none">
            <svg viewBox="0 0 40 40" className="w-full h-full">
              <line x1="10" y1="10" x2="16" y2="16" stroke={isHeadshotHit ? '#ef4444' : '#fbbf24'} strokeWidth="2.5" strokeLinecap="round" />
              <line x1="30" y1="10" x2="24" y2="16" stroke={isHeadshotHit ? '#ef4444' : '#fbbf24'} strokeWidth="2.5" strokeLinecap="round" />
              <line x1="10" y1="30" x2="16" y2="24" stroke={isHeadshotHit ? '#ef4444' : '#fbbf24'} strokeWidth="2.5" strokeLinecap="round" />
              <line x1="30" y1="30" x2="24" y2="24" stroke={isHeadshotHit ? '#ef4444' : '#fbbf24'} strokeWidth="2.5" strokeLinecap="round" />
              {isHeadshotHit && (
                <circle cx="20" cy="20" r="8" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 3" />
              )}
            </svg>
          </div>
        )}

        {/* Floating Hit Text */}
        {recentHitText && (
          <div
            id="hit_score_popup"
            className={`absolute -translate-y-10 font-tactical font-bold text-xs tracking-wider px-2 py-0.5 rounded bg-neutral-950/80 backdrop-blur-sm border shadow-lg animate-bounce ${
              isHeadshotHit ? 'text-rose-400 border-rose-500/50' : 'text-amber-400 border-amber-500/50'
            }`}
          >
            {recentHitText}
          </div>
        )}

        {/* Compact Rangefinder */}
        {rangefinderDistance && !weaponState.isAiming && (
          <div
            id="hud_rangefinder"
            className="absolute translate-y-12 flex items-center gap-1.5 bg-neutral-950/60 backdrop-blur-sm border border-neutral-800/60 px-2.5 py-0.5 rounded-full text-[10px] font-tactical tracking-wider"
          >
            <Compass className="w-2.5 h-2.5 text-amber-500" />
            <span className="text-neutral-400">MESAFE:</span>
            <span className="font-bold text-amber-400">{rangefinderDistance}m</span>
            {rangefinderTarget && <span className="text-neutral-500">[{rangefinderTarget}]</span>}
          </div>
        )}
      </div>

      {/* 3. BOTTOM SECTION: Clean Minimalist HUD */}
      <div id="hud_bottom_bar" className="flex items-end justify-between w-full">
        {/* Left: Compact Telemetry & Virtual Walk Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2.5">
          {/* Virtual Walk D-Pad (works via click/touch and also reflects WASD) */}
          <div
            id="hud_virtual_wasd"
            className="pointer-events-auto bg-neutral-950/70 backdrop-blur-md border border-neutral-800/60 p-1.5 rounded-xl shadow-lg flex flex-col items-center gap-1 font-tactical select-none"
          >
            <button
              id="btn_walk_forward"
              onMouseDown={() => onMoveKey?.('forward', true)}
              onMouseUp={() => onMoveKey?.('forward', false)}
              onTouchStart={(e) => { e.preventDefault(); onMoveKey?.('forward', true); }}
              onTouchEnd={(e) => { e.preventDefault(); onMoveKey?.('forward', false); }}
              className="w-8 h-8 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 active:bg-amber-500 active:text-neutral-950 text-neutral-300 border border-neutral-700/60 flex items-center justify-center font-bold text-xs shadow-xs active:scale-95 transition-all"
              title="İleri Yürü (W / Yukarı Ok)"
            >
              W
            </button>
            <div className="flex items-center gap-1">
              <button
                id="btn_walk_left"
                onMouseDown={() => onMoveKey?.('left', true)}
                onMouseUp={() => onMoveKey?.('left', false)}
                onTouchStart={(e) => { e.preventDefault(); onMoveKey?.('left', true); }}
                onTouchEnd={(e) => { e.preventDefault(); onMoveKey?.('left', false); }}
                className="w-8 h-8 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 active:bg-amber-500 active:text-neutral-950 text-neutral-300 border border-neutral-700/60 flex items-center justify-center font-bold text-xs shadow-xs active:scale-95 transition-all"
                title="Sola Yürü (A / Sol Ok)"
              >
                A
              </button>
              <button
                id="btn_walk_backward"
                onMouseDown={() => onMoveKey?.('backward', true)}
                onMouseUp={() => onMoveKey?.('backward', false)}
                onTouchStart={(e) => { e.preventDefault(); onMoveKey?.('backward', true); }}
                onTouchEnd={(e) => { e.preventDefault(); onMoveKey?.('backward', false); }}
                className="w-8 h-8 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 active:bg-amber-500 active:text-neutral-950 text-neutral-300 border border-neutral-700/60 flex items-center justify-center font-bold text-xs shadow-xs active:scale-95 transition-all"
                title="Geri Yürü (S / Aşağı Ok)"
              >
                S
              </button>
              <button
                id="btn_walk_right"
                onMouseDown={() => onMoveKey?.('right', true)}
                onMouseUp={() => onMoveKey?.('right', false)}
                onTouchStart={(e) => { e.preventDefault(); onMoveKey?.('right', true); }}
                onTouchEnd={(e) => { e.preventDefault(); onMoveKey?.('right', false); }}
                className="w-8 h-8 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 active:bg-amber-500 active:text-neutral-950 text-neutral-300 border border-neutral-700/60 flex items-center justify-center font-bold text-xs shadow-xs active:scale-95 transition-all"
                title="Sağa Yürü (D / Sağ Ok)"
              >
                D
              </button>
            </div>
          </div>

          <div
            id="hud_stats_card"
            className="bg-neutral-950/70 backdrop-blur-md border border-neutral-800/60 px-3.5 py-2 rounded-xl shadow-lg font-tactical text-xs"
          >
            <div className="flex items-center gap-3">
              <div>
                <span className="text-[9px] uppercase text-neutral-500 block">Puan</span>
                <span className="text-base font-bold text-amber-400 tabular-nums">{stats.score}</span>
              </div>
              <div className="w-px h-6 bg-neutral-800" />
              <div>
                <span className="text-[9px] uppercase text-neutral-500 block">İsabet</span>
                <span className="text-base font-bold text-emerald-400 tabular-nums">{stats.accuracy}%</span>
              </div>
              <div className="w-px h-6 bg-neutral-800" />
              <div>
                <span className="text-[9px] uppercase text-neutral-500 block">Headshot</span>
                <span className="text-base font-bold text-rose-400 tabular-nums">{stats.headshots}</span>
              </div>
              {stats.currentStreak > 1 && (
                <>
                  <div className="w-px h-6 bg-neutral-800" />
                  <div>
                    <span className="text-[9px] uppercase text-amber-500 block">Seri</span>
                    <span className="text-base font-bold text-amber-400 tabular-nums">{stats.currentStreak}x</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Center: Mobile / Clickable Trigger Buttons */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* ADS Button */}
          <button
            id="btn_ads_toggle"
            onClick={onToggleADS}
            className={`p-2.5 rounded-xl font-tactical text-[11px] tracking-wider flex flex-col items-center justify-center gap-0.5 shadow-md transition-all active:scale-95 border ${
              weaponState.isAiming
                ? 'bg-amber-500 text-neutral-950 font-bold border-amber-400'
                : 'bg-neutral-950/70 text-neutral-300 hover:text-white border-neutral-800/60'
            }`}
            title="Nişan Al (Sağ Tık / ADS)"
          >
            <CrosshairIcon className="w-4 h-4" />
            <span>{weaponState.isAiming ? 'ADS' : 'NİŞAN'}</span>
          </button>

          {/* Fire Button: Left Click = Fire */}
          <button
            id="btn_fire_trigger"
            onMouseDown={onTriggerPull}
            onMouseUp={onTriggerRelease}
            onTouchStart={(e) => {
              e.preventDefault();
              onTriggerPull();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              onTriggerRelease();
            }}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 active:scale-95 text-white font-tactical font-bold text-[11px] tracking-wider flex flex-col items-center justify-center shadow-lg shadow-rose-600/30 border border-rose-400/40 select-none cursor-pointer"
            title="Ateş Et (Sol Tık)"
          >
            <Sparkles className="w-4 h-4" />
            <span>ATEŞ</span>
          </button>

          {/* Reload Button */}
          <button
            id="btn_reload"
            onClick={onReload}
            disabled={weaponState.isReloading || weaponState.ammoInMag >= weaponState.magCapacity}
            className="p-2.5 rounded-xl bg-neutral-950/70 hover:bg-neutral-800/80 disabled:opacity-40 text-neutral-300 hover:text-white border border-neutral-800/60 font-tactical text-[11px] tracking-wider flex flex-col items-center justify-center gap-0.5 shadow-md transition-all active:scale-95"
            title="Şarjör Değiştir (R)"
          >
            <RotateCcw className={`w-4 h-4 ${weaponState.isReloading ? 'animate-spin text-amber-400' : ''}`} />
            <span>{weaponState.isReloading ? '...' : 'ŞARJÖR'}</span>
          </button>
        </div>

        {/* Right: Weapon Ammo & Fire Mode HUD */}
        <div
          id="hud_weapon_card"
          className="bg-neutral-950/70 backdrop-blur-md border border-neutral-800/60 px-3.5 py-2 rounded-xl shadow-lg min-w-[190px] font-tactical"
        >
          <div className="flex items-center justify-between pb-1 mb-1 border-b border-neutral-800/60">
            <span className="text-[10px] font-semibold text-neutral-300 tracking-wider">
              M4A1 5.56
            </span>

            {/* Mode Cycle Selector */}
            <div className="pointer-events-auto flex items-center bg-neutral-900 rounded p-0.5 border border-neutral-800">
              {(['SEMI', 'BURST', 'AUTO'] as FireMode[]).map((mode) => (
                <button
                  key={mode}
                  id={`btn_firemode_${mode.toLowerCase()}`}
                  onClick={() => onSelectFireMode(mode)}
                  className={`px-1.5 py-0.5 text-[9px] font-bold rounded tracking-wider transition-colors ${
                    weaponState.fireMode === mode
                      ? 'bg-amber-500 text-neutral-950 shadow-xs'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Ammo Numbers */}
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span
                className={`text-3xl font-black tabular-nums tracking-tight ${
                  weaponState.ammoInMag <= 5 ? 'text-rose-500 animate-pulse' : 'text-neutral-100'
                }`}
              >
                {weaponState.isReloading ? '--' : weaponState.ammoInMag}
              </span>
              <span className="text-neutral-500 text-xs font-semibold">
                / {weaponState.reserveAmmo}
              </span>
            </div>

            <div className="text-right">
              {weaponState.isReloading ? (
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest animate-pulse">
                  DOLDURULUYOR...
                </span>
              ) : (
                <span className="text-[9px] uppercase text-neutral-400 tracking-wider">
                  STANAG 30
                </span>
              )}
            </div>
          </div>

          {/* Controls reminder */}
          <div className="flex flex-col gap-0.5 mt-1.5 pt-1 border-t border-neutral-800/60 text-[9px] text-neutral-400 font-mono">
            <div className="flex justify-between items-center">
              <span>[WASD] Yürü / Koş</span>
              <span className="text-amber-400/90">[SHIFT] Hızlı Koş</span>
            </div>
            <div className="flex justify-between items-center text-neutral-500">
              <span>[SOL TIK] Ateş</span>
              <span>[SAĞ TIK] ADS</span>
              <span>[ESC] Menü</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. LOADING OVERLAY */}
      {isLoading && (
        <div
          id="loading_overlay"
          className="absolute inset-0 bg-neutral-950/95 backdrop-blur-md flex flex-col items-center justify-center gap-4 z-40"
        >
          <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
          <div className="text-center font-tactical">
            <h3 className="text-base font-bold text-neutral-100 uppercase tracking-wider">
              {loadingStatus}
            </h3>
            <p className="text-xs text-neutral-400 mt-1">SWAT Askeri ve Poligon Hazırlanıyor...</p>
          </div>
        </div>
      )}
    </div>
  );
};
