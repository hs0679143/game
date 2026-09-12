export type FireMode = 'SEMI' | 'BURST' | 'AUTO';

export type GameMode = 'PRACTICE' | 'TIME_ATTACK' | 'ACCURACY_DRILL';

export interface WeaponState {
  ammoInMag: number;
  magCapacity: number;
  reserveAmmo: number;
  maxReserve: number;
  fireMode: FireMode;
  isReloading: boolean;
  isAiming: boolean;
  isFiring: boolean;
  canFire: boolean;
}

export interface HitResult {
  hit: boolean;
  hitType?: 'HEAD' | 'TORSO' | 'LIMB' | 'STEEL_GONG' | 'WALL';
  distance?: number;
  damage?: number;
  points?: number;
  point?: [number, number, number];
  isHeadshot?: boolean;
}

export interface GameStats {
  score: number;
  shotsFired: number;
  shotsHit: number;
  headshots: number;
  targetKnockdowns: number;
  longestShot: number;
  currentStreak: number;
  bestStreak: number;
  accuracy: number;
}

export interface ChallengeState {
  isActive: boolean;
  timeLeft: number;
  totalTime: number;
  finalStats?: GameStats;
}
