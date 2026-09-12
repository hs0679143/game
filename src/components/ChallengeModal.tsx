import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { GameStats } from '../game/types';
import { Trophy, Crosshair, Award, RotateCcw, X } from 'lucide-react';

interface ChallengeModalProps {
  stats: GameStats;
  onRestart: () => void;
  onClose: () => void;
}

export const ChallengeModal: React.FC<ChallengeModalProps> = ({ stats, onRestart, onClose }) => {
  useEffect(() => {
    // Fire celebratory confetti on finish
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f59e0b', '#fbbf24', '#3b82f6', '#10b981'],
    });
  }, []);

  const getRank = (score: number, accuracy: number) => {
    if (score >= 1800 && accuracy >= 75) return { title: 'MASTER MARKSMAN', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
    if (score >= 1200 && accuracy >= 60) return { title: 'SHARPSHOOTER', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40' };
    if (score >= 700) return { title: 'MARKSMAN', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
    return { title: 'RECRUIT', badge: 'bg-neutral-500/20 text-neutral-300 border-neutral-500/40' };
  };

  const rank = getRank(stats.score, stats.accuracy);

  return (
    <div id="challenge_debrief_overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div id="challenge_debrief_card" className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        {/* Corner tech accents */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-amber-500/60" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-amber-500/60" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-amber-500/60" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-amber-500/60" />

        <button
          id="btn_close_debrief"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-100 transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/10 text-amber-400 mb-3 border border-amber-500/20">
            <Trophy className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold font-tactical tracking-wider text-neutral-100">
            MISSION DEBRIEF
          </h2>
          <p className="text-xs uppercase tracking-widest text-neutral-400 mt-0.5">
            60s Tactical Assessment Complete
          </p>
          <div className="mt-3">
            <span className={`inline-block px-3 py-1 text-xs font-bold font-tactical tracking-widest uppercase rounded-full border ${rank.badge}`}>
              RANK: {rank.title}
            </span>
          </div>
        </div>

        {/* Score Highlights */}
        <div className="grid grid-cols-2 gap-3 mb-6 font-tactical">
          <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-3 text-center">
            <span className="text-xs uppercase text-neutral-400 block tracking-wider">Final Score</span>
            <span className="text-3xl font-bold text-amber-400">{stats.score.toLocaleString()}</span>
          </div>
          <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-3 text-center">
            <span className="text-xs uppercase text-neutral-400 block tracking-wider">Accuracy</span>
            <span className="text-3xl font-bold text-emerald-400">{stats.accuracy}%</span>
          </div>
        </div>

        {/* Stat Rows */}
        <div className="space-y-2 mb-6 text-sm font-tactical text-neutral-300 bg-neutral-950/40 p-4 rounded-xl border border-neutral-800/60">
          <div className="flex justify-between items-center py-1 border-b border-neutral-800/50">
            <span className="flex items-center gap-2 text-neutral-400">
              <Crosshair className="w-4 h-4 text-amber-500" /> Total Hits
            </span>
            <span className="font-semibold text-neutral-100">{stats.shotsHit} / {stats.shotsFired}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-neutral-800/50">
            <span className="flex items-center gap-2 text-neutral-400">
              <Award className="w-4 h-4 text-rose-500" /> Headshots
            </span>
            <span className="font-semibold text-rose-400">{stats.headshots}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-neutral-800/50">
            <span className="text-neutral-400">Best Hit Streak</span>
            <span className="font-semibold text-amber-400">{stats.bestStreak}</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-neutral-400">Longest Shot</span>
            <span className="font-semibold text-blue-400">{stats.longestShot}m</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            id="btn_retry_challenge"
            onClick={onRestart}
            className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold font-tactical tracking-wider text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            RETRY CHALLENGE
          </button>
          <button
            id="btn_return_practice"
            onClick={onClose}
            className="py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-tactical tracking-wider text-sm transition-colors active:scale-95"
          >
            PRACTICE
          </button>
        </div>
      </div>
    </div>
  );
};
