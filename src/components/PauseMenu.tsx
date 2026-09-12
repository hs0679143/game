import React from 'react';
import { Play, RotateCcw, Volume2, VolumeX, Shield, Clock, Sliders, X } from 'lucide-react';
import { GameMode, GameStats } from '../game/types';
import { audioManager } from '../game/audio';

interface PauseMenuProps {
  isOpen: boolean;
  gameMode: GameMode;
  stats: GameStats;
  mouseSensitivity: number;
  onClose: () => void;
  onSelectMode: (mode: GameMode) => void;
  onResetTargets: () => void;
  onResetStats: () => void;
  onSensitivityChange: (val: number) => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  isOpen,
  gameMode,
  stats,
  mouseSensitivity,
  onClose,
  onSelectMode,
  onResetTargets,
  onResetStats,
  onSensitivityChange,
}) => {
  if (!isOpen) return null;

  const isMuted = audioManager.getMuted();

  const toggleSound = () => {
    audioManager.toggleMute();
  };

  return (
    <div
      id="pause_menu_overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none"
    >
      <div
        id="pause_menu_card"
        className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden"
      >
        {/* Tactical corner brackets */}
        <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-amber-500/60" />
        <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-amber-500/60" />
        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-amber-500/60" />
        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-amber-500/60" />

        {/* Close Button */}
        <button
          id="btn_close_menu"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white transition-colors"
          title="Oyuna Dön (ESC)"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 mb-2 border border-amber-500/20">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold font-tactical tracking-wider text-neutral-100 uppercase">
            POLİGON DURAKLATILDI
          </h2>
          <p className="text-xs uppercase tracking-widest text-neutral-400 mt-0.5">
            M4A1 5.56x45mm & SWAT Birimi
          </p>
        </div>

        {/* Quick Stats Banner */}
        <div className="grid grid-cols-3 gap-2 bg-neutral-950/60 border border-neutral-800/80 p-3 rounded-xl mb-5 text-center font-tactical text-xs">
          <div>
            <span className="text-neutral-500 uppercase block text-[10px]">Puan</span>
            <span className="text-base font-bold text-amber-400">{stats.score}</span>
          </div>
          <div>
            <span className="text-neutral-500 uppercase block text-[10px]">İsabet</span>
            <span className="text-base font-bold text-emerald-400">{stats.accuracy}%</span>
          </div>
          <div>
            <span className="text-neutral-500 uppercase block text-[10px]">Headshot</span>
            <span className="text-base font-bold text-rose-400">{stats.headshots}</span>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="space-y-2.5 mb-5 font-tactical">
          <button
            id="btn_resume_game"
            onClick={onClose}
            className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold tracking-wider text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95"
          >
            <Play className="w-4 h-4 fill-neutral-950" />
            OYUNA DÖN (DEVAM ET)
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              id="btn_menu_mode_practice"
              onClick={() => {
                onSelectMode('PRACTICE');
                onClose();
              }}
              className={`py-2.5 px-3 rounded-xl border text-xs font-semibold tracking-wider flex items-center justify-center gap-1.5 transition-colors ${
                gameMode === 'PRACTICE'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-neutral-800/60 hover:bg-neutral-800 text-neutral-300 border-neutral-700/60'
              }`}
            >
              SERBEST ATIŞ
            </button>
            <button
              id="btn_menu_mode_timeattack"
              onClick={() => {
                onSelectMode('TIME_ATTACK');
                onClose();
              }}
              className={`py-2.5 px-3 rounded-xl border text-xs font-semibold tracking-wider flex items-center justify-center gap-1.5 transition-colors ${
                gameMode === 'TIME_ATTACK'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-neutral-800/60 hover:bg-neutral-800 text-neutral-300 border-neutral-700/60'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              60S MÜCADELE
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              id="btn_menu_reset_targets"
              onClick={() => {
                onResetTargets();
                onClose();
              }}
              className="py-2.5 px-3 rounded-xl bg-neutral-800/60 hover:bg-neutral-800 text-neutral-300 border border-neutral-700/60 text-xs tracking-wider flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              HEDEFLERİ DİK
            </button>
            <button
              id="btn_menu_reset_stats"
              onClick={() => {
                onResetStats();
              }}
              className="py-2.5 px-3 rounded-xl bg-neutral-800/60 hover:bg-neutral-800 text-neutral-300 border border-neutral-700/60 text-xs tracking-wider flex items-center justify-center gap-1.5 transition-colors"
            >
              SKORU SIFIRLA
            </button>
          </div>
        </div>

        {/* Settings: Sensitivity & Sound */}
        <div className="bg-neutral-950/60 border border-neutral-800/80 p-3 rounded-xl mb-5 font-tactical text-xs space-y-3">
          {/* Sensitivity Slider */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-neutral-400 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-500" /> Farenin Hassasiyeti
            </span>
            <input
              id="input_mouse_sensitivity"
              type="range"
              min="0.001"
              max="0.005"
              step="0.0002"
              value={mouseSensitivity}
              onChange={(e) => onSensitivityChange(parseFloat(e.target.value))}
              className="w-36 accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Sound Toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-neutral-800/60">
            <span className="text-neutral-400">Silah ve Poligon Sesleri</span>
            <button
              id="btn_menu_toggle_sound"
              onClick={toggleSound}
              className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-semibold transition-colors"
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-4 h-4 text-rose-400" />
                  <span className="text-rose-400">Kapalı</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  <span>Açık</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tactical Key Legend */}
        <div className="border-t border-neutral-800/80 pt-3 text-[11px] font-mono text-neutral-400 grid grid-cols-2 gap-1.5">
          <div><span className="text-amber-400 font-bold">[SOL TIK]</span> Ateş Et (Fire)</div>
          <div><span className="text-amber-400 font-bold">[SAĞ TIK]</span> Nişan Al (ADS)</div>
          <div><span className="text-neutral-200 font-bold">[R]</span> Şarjör Değiştir</div>
          <div><span className="text-neutral-200 font-bold">[B]</span> Atış Modu Değiştir</div>
          <div><span className="text-neutral-200 font-bold">[W, A, S, D]</span> Yürüme / Adım</div>
          <div><span className="text-neutral-200 font-bold">[Aşağı Bak]</span> Ayakları Gör</div>
        </div>
      </div>
    </div>
  );
};
