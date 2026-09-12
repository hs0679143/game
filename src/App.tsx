import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ShootingRangeEngine } from './game/shootingRangeEngine';
import { HUD } from './components/HUD';
import { PauseMenu } from './components/PauseMenu';
import { ChallengeModal } from './components/ChallengeModal';
import { GameStats, GameMode, HitResult, WeaponState, FireMode } from './game/types';

export const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ShootingRangeEngine | null>(null);

  // Game Stats
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    shotsFired: 0,
    shotsHit: 0,
    headshots: 0,
    targetKnockdowns: 0,
    longestShot: 0,
    currentStreak: 0,
    bestStreak: 0,
    accuracy: 0,
  });

  // Weapon State
  const [weaponState, setWeaponState] = useState<WeaponState>({
    ammoInMag: 30,
    magCapacity: 30,
    reserveAmmo: 180,
    maxReserve: 300,
    fireMode: 'SEMI',
    isReloading: false,
    isAiming: false,
    isFiring: false,
    canFire: true,
  });

  // UI & Menu States
  const [gameMode, setGameMode] = useState<GameMode>('PRACTICE');
  const [timeAttackLeft, setTimeAttackLeft] = useState<number>(60);
  const [hitResult, setHitResult] = useState<HitResult | null>(null);
  const [rangefinderDist, setRangefinderDist] = useState<number | null>(null);
  const [rangefinderTarget, setRangefinderTarget] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingStatus, setLoadingStatus] = useState<string>('Yükleniyor...');
  const [showChallengeModal, setShowChallengeModal] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [mouseSensitivity, setMouseSensitivity] = useState<number>(0.0022);

  // Initialize Engine
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const engine = new ShootingRangeEngine(containerRef.current, canvasRef.current, {
      onWeaponChange: (ws) => setWeaponState({ ...ws }),
      onStatsChange: (st) => setStats({ ...st }),
      onHitmarker: (hr) => setHitResult(hr),
      onRangefinder: (dist, target) => {
        setRangefinderDist(dist);
        setRangefinderTarget(target);
      },
      onTimeAttackTick: (tl) => setTimeAttackLeft(tl),
      onTimeAttackEnd: (finalSt) => {
        setStats({ ...finalSt });
        setShowChallengeModal(true);
      },
      onLockChange: (locked) => setIsLocked(locked),
      onLoadingProgress: (loading, status) => {
        setIsLoading(loading);
        setLoadingStatus(status);
      },
      onToggleMenu: () => {
        setIsMenuOpen((prev) => {
          const next = !prev;
          engineRef.current?.setMenuState(next);
          return next;
        });
      },
    });

    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Handlers
  const handleOpenMenu = useCallback(() => {
    setIsMenuOpen(true);
    engineRef.current?.setMenuState(true);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setIsMenuOpen(false);
    engineRef.current?.setMenuState(false);
  }, []);

  const handleSelectMode = useCallback((mode: GameMode) => {
    setGameMode(mode);
    setShowChallengeModal(false);
    engineRef.current?.setGameMode(mode);
  }, []);

  const handleResetTargets = useCallback(() => {
    engineRef.current?.targets.resetAllTargets();
  }, []);

  const handleResetStats = useCallback(() => {
    engineRef.current?.resetStats();
  }, []);

  const handleRequestLock = useCallback(() => {
    if (isMenuOpen) return;
    engineRef.current?.controller.requestLock();
  }, [isMenuOpen]);

  const handleToggleADS = useCallback(() => {
    engineRef.current?.weapon.toggleAiming();
  }, []);

  const handleSelectFireMode = useCallback((mode: FireMode) => {
    engineRef.current?.weapon.setFireMode(mode);
  }, []);

  const handleReload = useCallback(() => {
    engineRef.current?.weapon.reload();
  }, []);

  const handleTriggerPull = useCallback(() => {
    engineRef.current?.weapon.startFiring();
  }, []);

  const handleTriggerRelease = useCallback(() => {
    engineRef.current?.weapon.stopFiring();
  }, []);

  const handleSensitivityChange = useCallback((val: number) => {
    setMouseSensitivity(val);
    if (engineRef.current) {
      engineRef.current.controller.mouseSensitivity = val;
    }
  }, []);

  const handleMoveKey = useCallback((key: 'forward' | 'backward' | 'left' | 'right', active: boolean) => {
    engineRef.current?.controller.setMovementKey(key, active);
  }, []);

  return (
    <div
      id="shooting_range_root"
      ref={containerRef}
      className="relative w-screen h-screen overflow-hidden bg-neutral-950 font-sans"
    >
      {/* 3D WebGL Canvas */}
      <canvas
        id="range_3d_canvas"
        ref={canvasRef}
        tabIndex={0}
        className="w-full h-full block cursor-crosshair outline-none"
        onClick={() => {
          canvasRef.current?.focus();
          if (!isMenuOpen && !isLocked) {
            handleRequestLock();
          }
        }}
      />

      {/* Heads Up Display Overlay (Clean & Sleek) */}
      <HUD
        stats={stats}
        weaponState={weaponState}
        gameMode={gameMode}
        timeAttackLeft={timeAttackLeft}
        hitResult={hitResult}
        rangefinderDistance={rangefinderDist}
        rangefinderTarget={rangefinderTarget}
        isPointerLocked={isLocked}
        isLoading={isLoading}
        loadingStatus={loadingStatus}
        onSelectMode={handleSelectMode}
        onResetTargets={handleResetTargets}
        onRequestLock={handleRequestLock}
        onToggleADS={handleToggleADS}
        onSelectFireMode={handleSelectFireMode}
        onReload={handleReload}
        onTriggerPull={handleTriggerPull}
        onTriggerRelease={handleTriggerRelease}
        onOpenMenu={handleOpenMenu}
        onMoveKey={handleMoveKey}
      />

      {/* ESC Pause & Settings Menu */}
      <PauseMenu
        isOpen={isMenuOpen}
        gameMode={gameMode}
        stats={stats}
        mouseSensitivity={mouseSensitivity}
        onClose={handleCloseMenu}
        onSelectMode={handleSelectMode}
        onResetTargets={handleResetTargets}
        onResetStats={handleResetStats}
        onSensitivityChange={handleSensitivityChange}
      />

      {/* 60s Challenge Debriefing Modal */}
      {showChallengeModal && (
        <ChallengeModal
          stats={stats}
          onRestart={() => {
            setShowChallengeModal(false);
            engineRef.current?.startTimeAttack();
          }}
          onClose={() => {
            setShowChallengeModal(false);
            engineRef.current?.setGameMode('PRACTICE');
          }}
        />
      )}
    </div>
  );
};

export default App;
