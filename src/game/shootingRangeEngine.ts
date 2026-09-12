import * as THREE from 'three';
import { RangeScene } from './rangeScene';
import { WeaponController } from './weapons';
import { TargetManager } from './targets';
import { ParticleSystem } from './particles';
import { FPSController } from './fpsController';
import { PlayerCharacter } from './playerCharacter';
import { GameStats, GameMode, HitResult, WeaponState } from './types';
import { audioManager } from './audio';

export interface EngineCallbacks {
  onWeaponChange: (state: WeaponState) => void;
  onStatsChange: (stats: GameStats) => void;
  onHitmarker: (result: HitResult) => void;
  onRangefinder: (distance: number | null, targetName: string | null) => void;
  onTimeAttackTick?: (timeLeft: number) => void;
  onTimeAttackEnd?: (finalStats: GameStats) => void;
  onLockChange?: (locked: boolean) => void;
  onLoadingProgress?: (isLoading: boolean, status: string) => void;
  onToggleMenu?: () => void;
}

export class ShootingRangeEngine {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  public weapon: WeaponController;
  public targets: TargetManager;
  public particles: ParticleSystem;
  public controller: FPSController;
  public rangeScene: RangeScene;
  public playerCharacter: PlayerCharacter;

  private clock = new THREE.Clock();
  private animFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // Stats & State
  public stats: GameStats = {
    score: 0,
    shotsFired: 0,
    shotsHit: 0,
    headshots: 0,
    targetKnockdowns: 0,
    longestShot: 0,
    currentStreak: 0,
    bestStreak: 0,
    accuracy: 0,
  };

  public gameMode: GameMode = 'PRACTICE';
  public timeAttackLeft = 60;
  private isTimeAttackRunning = false;

  private callbacks: EngineCallbacks;
  private rangefinderRay = new THREE.Raycaster();

  // Frustum Culling and LOD update matrices
  private frustum = new THREE.Frustum();
  private projScreenMatrix = new THREE.Matrix4();

  constructor(container: HTMLElement, canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.canvas = canvas;
    this.callbacks = callbacks;

    // 1. Scene & Camera
    this.scene = new THREE.Scene();
    const aspect = (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.02, 300);

    // 2. WebGL Renderer (Optimized pixel ratio to eliminate high-DPI browser lag)
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    // 3. Sub-systems
    this.particles = new ParticleSystem(this.scene);
    this.weapon = new WeaponController(this.camera, this.particles);
    this.camera.add(this.weapon.group);
    this.scene.add(this.camera);

    this.playerCharacter = new PlayerCharacter();
    this.scene.add(this.playerCharacter.group);

    this.rangeScene = new RangeScene(this.scene);
    this.targets = new TargetManager(this.scene, this.particles);
    this.controller = new FPSController(this.camera, this.canvas, this.weapon);

    // Link events
    this.controller.onLockChange = (locked) => {
      this.callbacks.onLockChange?.(locked);
    };

    this.controller.onToggleMenu = () => {
      this.callbacks.onToggleMenu?.();
    };

    this.weapon.onStateChange = (wState) => {
      this.callbacks.onWeaponChange(wState);
    };

    this.weapon.onShootRay = (ray, _muzzleOrigin) => {
      this.handleShot(ray);
    };

    this.targets.onHitCallback = (hitRes) => {
      this.handleHit(hitRes);
    };

    // Responsive Canvas Resizing with ResizeObserver
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          this.camera.aspect = width / height;
          this.camera.updateProjectionMatrix();
          this.renderer.setSize(width, height);
        }
      }
    });
    this.resizeObserver.observe(this.container);

    // Start load sequence
    this.initAsync();
  }

  private async initAsync() {
    this.callbacks.onLoadingProgress?.(true, 'SWAT Askeri ve Poligon Yükleniyor...');

    try {
      await Promise.all([
        this.targets.loadModels(),
        this.weapon.loadModel(),
        this.playerCharacter.loadModel(),
      ]);
    } catch (e) {
      console.error('Error during model load:', e);
    }

    this.callbacks.onLoadingProgress?.(false, 'Ready');
    this.callbacks.onWeaponChange(this.weapon.state);
    this.callbacks.onStatsChange(this.stats);

    // Start render loop
    this.clock.start();
    this.loop();
  }

  public setMenuState(isOpen: boolean) {
    this.controller.isMenuOpen = isOpen;
    if (isOpen) {
      this.controller.exitLock();
    } else {
      this.controller.requestLock();
    }
  }

  private handleShot(ray: THREE.Ray) {
    this.stats.shotsFired++;

    // Check hit against targets with Frustum Culling pre-filter
    const hitRes = this.targets.checkHit(ray, this.frustum);
    if (!hitRes.hit) {
      this.checkEnvironmentHit(ray);
      this.stats.currentStreak = 0;
    }

    this.updateAccuracy();
    this.callbacks.onStatsChange({ ...this.stats });
  }

  private checkEnvironmentHit(ray: THREE.Ray) {
    this.rangefinderRay.ray = ray;
    const intersects = this.rangefinderRay.intersectObjects(this.rangeScene.wallMeshes, false);
    if (intersects.length > 0) {
      const hit = intersects[0];
      const normal = hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 0, 1);
      this.particles.createImpact(hit.point, normal, false, false);
    }
  }

  private handleHit(result: HitResult) {
    this.stats.shotsHit++;
    this.stats.currentStreak++;
    if (this.stats.currentStreak > this.stats.bestStreak) {
      this.stats.bestStreak = this.stats.currentStreak;
    }

    this.stats.score += result.points || 50;

    if (result.isHeadshot) {
      this.stats.headshots++;
    }

    if (result.distance && result.distance > this.stats.longestShot) {
      this.stats.longestShot = Math.round(result.distance);
    }

    this.callbacks.onHitmarker(result);
    this.updateAccuracy();
    this.callbacks.onStatsChange({ ...this.stats });
  }

  private updateAccuracy() {
    if (this.stats.shotsFired > 0) {
      this.stats.accuracy = Math.round((this.stats.shotsHit / this.stats.shotsFired) * 100);
    } else {
      this.stats.accuracy = 100;
    }
  }

  // Rangefinder down-crosshair ray
  private updateRangefinder() {
    this.rangefinderRay.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const candidateMeshes: THREE.Mesh[] = [...this.rangeScene.wallMeshes];
    for (const t of this.targets.targets) {
      candidateMeshes.push(...t.hitMeshes);
    }

    const hits = this.rangefinderRay.intersectObjects(candidateMeshes, false);
    if (hits.length > 0) {
      const hit = hits[0];
      const dist = parseFloat(hit.distance.toFixed(1));

      const target = this.targets.targets.find((t) => t.hitMeshes.includes(hit.object as THREE.Mesh));
      const targetName = target ? (target.type === 'STEEL_GONG' ? 'Steel Gong' : `Target Dummy (${target.distance}m)`) : 'Backstop';

      this.callbacks.onRangefinder(dist, targetName);
    } else {
      this.callbacks.onRangefinder(null, null);
    }
  }

  // Start 60s Time Attack
  public startTimeAttack() {
    this.gameMode = 'TIME_ATTACK';
    this.timeAttackLeft = 60;
    this.isTimeAttackRunning = true;
    this.resetStats();
    this.targets.resetAllTargets();
    audioManager.playCountdownBeep(true);
  }

  public stopTimeAttack() {
    this.isTimeAttackRunning = false;
    this.callbacks.onTimeAttackEnd?.({ ...this.stats });
  }

  public resetStats() {
    this.stats = {
      score: 0,
      shotsFired: 0,
      shotsHit: 0,
      headshots: 0,
      targetKnockdowns: 0,
      longestShot: 0,
      currentStreak: 0,
      bestStreak: 0,
      accuracy: 0,
    };
    this.callbacks.onStatsChange({ ...this.stats });
  }

  public setGameMode(mode: GameMode) {
    this.gameMode = mode;
    if (mode === 'TIME_ATTACK') {
      this.startTimeAttack();
    } else {
      this.isTimeAttackRunning = false;
      this.resetStats();
    }
  }

  private loop = () => {
    this.animFrameId = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);

    // 1. Update Controller & Camera
    this.controller.update(dt);

    // Calculate Camera Frustum for Culling & LOD Updates
    this.projScreenMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projScreenMatrix);

    // 2. Update SWAT Player Character Body & Animations
    const isMoving = this.controller.velocity.lengthSq() > 0.01;
    this.playerCharacter.update(
      dt,
      this.camera.position,
      this.controller.euler.y,
      this.controller.euler.x,
      isMoving,
      this.controller.velocity.length()
    );

    // 3. Update Targets with LOD & Frustum Culling
    this.targets.update(dt, this.camera, this.frustum);

    // 4. Update Particles with Object Pooling & Frustum Culling
    this.particles.update(dt, this.frustum);

    // 5. Update Rangefinder (throttled)
    if (Math.random() < 0.35) {
      this.updateRangefinder();
    }

    // 6. Time Attack countdown
    if (this.isTimeAttackRunning) {
      this.timeAttackLeft -= dt;
      this.callbacks.onTimeAttackTick?.(Math.max(0, Math.ceil(this.timeAttackLeft)));

      if (this.timeAttackLeft <= 0) {
        this.stopTimeAttack();
      }
    }

    // 7. Render
    this.renderer.render(this.scene, this.camera);
  };

  public dispose() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.particles.dispose();
    this.targets.dispose();
    this.renderer.dispose();
  }
}
