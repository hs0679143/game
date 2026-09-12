import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WeaponState, FireMode } from './types';
import { audioManager } from './audio';
import { ParticleSystem } from './particles';

export class WeaponController {
  public group: THREE.Group;
  private camera: THREE.Camera;
  private particles: ParticleSystem;
  private loader: GLTFLoader;

  public weaponMesh: THREE.Group | null = null;
  public muzzleSocket: THREE.Object3D;
  private boltNode: THREE.Object3D | null = null;
  private magNode: THREE.Object3D | null = null;
  private muzzleFlashLight: THREE.PointLight;
  private muzzleFlashSprite: THREE.Sprite;

  public state: WeaponState = {
    ammoInMag: 30,
    magCapacity: 30,
    reserveAmmo: 180,
    maxReserve: 300,
    fireMode: 'SEMI',
    isReloading: false,
    isAiming: false,
    isFiring: false,
    canFire: true,
  };

  // Weapon Positions: Hipfire vs ADS
  // User requested: "ads halini bi 5 birim yukarı al"
  private hipPos = new THREE.Vector3(0.18, -0.22, -0.430);
  private adsPos = new THREE.Vector3(0.000, -0.161, -0.430);
  private currentPos = new THREE.Vector3();

  private hipRot = new THREE.Euler(0.04, -0.05, 0.02);
  private adsRot = new THREE.Euler(0, 0, 0);
  private currentRot = new THREE.Euler(0, 0, 0);

  // Recoil physics
  private recoilZ = 0;
  private recoilPitch = 0;
  private recoilYaw = 0;
  private recoilRecoverSpeed = 24;

  // Fire timing
  private lastFireTime = 0;
  private fireRate = 0.088; // ~680 RPM
  private burstRemaining = 0;
  private burstInterval = 0.075;
  private lastBurstShot = 0;

  // Sway & bobbing
  private walkBob = 0;
  private idleBob = 0;

  // Flash duration
  private flashTimer = 0;

  // Bolt & Mag initial pos
  private boltInitialPos = new THREE.Vector3();
  private magInitialPos = new THREE.Vector3();

  // Callbacks
  public onShootRay?: (ray: THREE.Ray, muzzleOrigin: THREE.Vector3) => void;
  public onStateChange?: (state: WeaponState) => void;

  constructor(camera: THREE.Camera, particles: ParticleSystem) {
    this.camera = camera;
    this.particles = particles;
    this.loader = new GLTFLoader();

    this.group = new THREE.Group();
    this.currentPos.copy(this.hipPos);
    this.group.position.copy(this.currentPos);
    this.group.rotation.copy(this.hipRot);

    // Muzzle Socket: Anchored at the true barrel tip
    this.muzzleSocket = new THREE.Object3D();
    this.muzzleSocket.position.set(0, 0.0385, -0.485);
    this.group.add(this.muzzleSocket);

    // Muzzle flash point light
    this.muzzleFlashLight = new THREE.PointLight(0xffaa22, 0, 8);
    this.muzzleSocket.add(this.muzzleFlashLight);

    // Muzzle flash visual sprite
    const flashCanvas = document.createElement('canvas');
    flashCanvas.width = 128;
    flashCanvas.height = 128;
    const fctx = flashCanvas.getContext('2d');
    if (fctx) {
      const grad = fctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, '#fbbf24');
      grad.addColorStop(0.7, '#f97316');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      fctx.fillStyle = grad;
      fctx.fillRect(0, 0, 128, 128);
    }
    const flashTex = new THREE.CanvasTexture(flashCanvas);
    this.muzzleFlashSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: flashTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0,
        depthWrite: false,
      })
    );
    this.muzzleFlashSprite.scale.set(0.35, 0.35, 0.35);
    this.muzzleSocket.add(this.muzzleFlashSprite);

    // Hand meshes removed as requested ("şu eli sil boşverdim")
  }

  public async loadModel(): Promise<void> {
    return new Promise((resolve) => {
      this.loader.load(
        '/models/low-poly_m4a1.glb',
        (gltf) => {
          const model = gltf.scene;

          // Model orientation:
          // In raw GLB, M4 points along +X. Rotating Y by +Math.PI/2 makes it point straight along -Z.
          model.rotation.set(0, Math.PI / 2, 0);

          // Scaling: model length is ~130 units, real M4 is ~0.84m
          const scale = 0.007;
          model.scale.set(scale, scale, scale);
          model.position.set(0, 0, 0);

          // Adjust materials for realistic matte gunmetal
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              if (mesh.material) {
                const mat = mesh.material as THREE.MeshStandardMaterial;
                mat.roughness = 0.42;
                mat.metalness = 0.78;
              }
            }
            if (child.name === 'bolt_02') {
              this.boltNode = child;
              this.boltInitialPos.copy(child.position);
            }
            if (child.name === 'mag_06') {
              this.magNode = child;
              this.magInitialPos.copy(child.position);
            }
          });

          this.weaponMesh = model;
          this.group.add(model);
          resolve();
        },
        undefined,
        (err) => {
          console.error('Failed to load M4A1 model:', err);
          this.createProceduralRifleFallback();
          resolve();
        }
      );
    });
  }

  private createProceduralRifleFallback() {
    const group = new THREE.Group();
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.65, 12), gunMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.04, -0.4);
    group.add(barrel);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.35), gunMat);
    body.position.set(0, 0.02, -0.15);
    group.add(body);

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.22), gunMat);
    stock.position.set(0, -0.01, 0.1);
    group.add(stock);

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.18, 0.07), gunMat);
    mag.position.set(0, -0.12, -0.16);
    mag.rotation.x = -0.15;
    group.add(mag);

    this.weaponMesh = group;
    this.group.add(group);
  }

  // Hands removed per user request ("şu eli sil boşverdim")
  private createTacticalHands() {
    // Hands deleted
  }

    public setAiming(aiming: boolean) {
    this.state.isAiming = aiming;
    this.notifyState();
  }

  public toggleAiming(): boolean {
    this.setAiming(!this.state.isAiming);
    return this.state.isAiming;
  }

  public cycleFireMode() {
    if (this.state.isReloading) return;
    const modes: FireMode[] = ['SEMI', 'BURST', 'AUTO'];
    const curIdx = modes.indexOf(this.state.fireMode);
    this.state.fireMode = modes[(curIdx + 1) % modes.length];
    audioManager.playFireModeSwitch();
    this.notifyState();
  }

  public setFireMode(mode: FireMode) {
    if (this.state.isReloading) return;
    this.state.fireMode = mode;
    audioManager.playFireModeSwitch();
    this.notifyState();
  }

  public startFiring() {
    this.state.isFiring = true;
    if (this.state.fireMode === 'SEMI') {
      this.tryShootSingle();
    } else if (this.state.fireMode === 'BURST') {
      if (this.burstRemaining <= 0) {
        this.burstRemaining = 3;
        this.lastBurstShot = 0;
      }
    }
  }

  public stopFiring() {
    this.state.isFiring = false;
  }

  public tryShootSingle(): boolean {
    if (this.state.isReloading) return false;

    if (this.state.ammoInMag <= 0) {
      audioManager.playDryFire();
      return false;
    }

    const now = performance.now() / 1000;
    if (now - this.lastFireTime < this.fireRate) return false;

    this.executeShot();
    return true;
  }

  private executeShot() {
    this.lastFireTime = performance.now() / 1000;
    this.state.ammoInMag--;
    this.notifyState();

    // 1. Audio
    audioManager.playGunshot();
    audioManager.playShellBounce();

    // 2. Visual Muzzle Flash directly at barrel tip
    this.flashTimer = 0.055;
    this.muzzleFlashLight.intensity = 5.0;
    this.muzzleFlashSprite.material.opacity = 1.0;
    this.muzzleFlashSprite.rotation.z = Math.random() * Math.PI * 2;

    // 3. Recoil Kick
    const kickMult = this.state.isAiming ? 0.35 : 1.0;
    this.recoilZ = 0.048 * kickMult;
    this.recoilPitch = (0.045 + Math.random() * 0.012) * kickMult;
    this.recoilYaw = (Math.random() - 0.5) * 0.014 * kickMult;

    // 4. Bolt cycling animation
    if (this.boltNode) {
      this.boltNode.position.x = this.boltInitialPos.x - 2.5;
    }

    // 5. Casing ejection directly from receiver
    const worldPos = new THREE.Vector3();
    const worldRot = new THREE.Quaternion();
    this.group.getWorldPosition(worldPos);
    this.group.getWorldQuaternion(worldRot);

    const gunForward = new THREE.Vector3(0, 0, -1).applyQuaternion(worldRot);
    const gunRight = new THREE.Vector3(1, 0, 0).applyQuaternion(worldRot);
    const gunUp = new THREE.Vector3(0, 1, 0).applyQuaternion(worldRot);

    const ejectionPos = worldPos.clone()
      .add(gunRight.clone().multiplyScalar(0.06))
      .add(gunUp.clone().multiplyScalar(0.03))
      .add(gunForward.clone().multiplyScalar(0.08));

    this.particles.ejectCasing(ejectionPos, gunForward, gunRight, gunUp);

    // 6. TRUE BARREL TIP ORIGIN (Ateş silahın ucundan çıksın)
    const muzzleTip = new THREE.Vector3();
    this.muzzleSocket.getWorldPosition(muzzleTip);

    // Aim target point in the distance (where sights are pointing)
    const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const targetDistance = 80; // Convergence distance
    const targetPoint = this.camera.position.clone().add(cameraForward.multiplyScalar(targetDistance));

    // Add slight ballistic spread
    const spread = this.state.isAiming ? 0.002 : 0.012;
    targetPoint.x += (Math.random() - 0.5) * spread * targetDistance;
    targetPoint.y += (Math.random() - 0.5) * spread * targetDistance;

    // Bullet direction begins strictly from the physical muzzle tip!
    const bulletDir = targetPoint.clone().sub(muzzleTip).normalize();
    const ray = new THREE.Ray(muzzleTip.clone(), bulletDir);

    // Tracer line from barrel tip forward
    const tracerEnd = muzzleTip.clone().add(bulletDir.clone().multiplyScalar(100));
    this.particles.createTracer(muzzleTip, tracerEnd);

    // Emit shot ray to scene
    this.onShootRay?.(ray, muzzleTip);

    // Auto reload prompt if empty
    if (this.state.ammoInMag === 0 && this.state.reserveAmmo > 0) {
      setTimeout(() => {
        if (this.state.ammoInMag === 0) this.reload();
      }, 350);
    }
  }

  // Reload mechanics & animation
  public reload() {
    if (this.state.isReloading) return;
    if (this.state.ammoInMag >= this.state.magCapacity) return;
    if (this.state.reserveAmmo <= 0) return;

    this.state.isReloading = true;
    this.state.isAiming = false; // exit ADS during reload
    this.notifyState();

    audioManager.playReloadSound();

    // User requested: "reload hızı reload sesi saniyesi kadar olsun aq ismi ReloadSound.wav"
    const reloadDuration = audioManager.getReloadDuration();
    const startTime = performance.now();

    const animateReload = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      const progress = elapsed / reloadDuration;

      if (this.magNode) {
        if (progress < 0.35) {
          const t = progress / 0.35;
          this.magNode.position.y = this.magInitialPos.y - t * 12;
        } else if (progress < 0.65) {
          this.magNode.position.y = this.magInitialPos.y - 12;
        } else if (progress < 0.85) {
          const t = (progress - 0.65) / 0.2;
          this.magNode.position.y = this.magInitialPos.y - 12 + t * 12;
        } else {
          this.magNode.position.copy(this.magInitialPos);
        }
      }

      if (progress < 1.0) {
        requestAnimationFrame(animateReload);
      } else {
        const needed = this.state.magCapacity - this.state.ammoInMag;
        const available = Math.min(needed, this.state.reserveAmmo);
        this.state.ammoInMag += available;
        this.state.reserveAmmo -= available;
        this.state.isReloading = false;
        if (this.magNode) this.magNode.position.copy(this.magInitialPos);
        this.notifyState();
      }
    };

    requestAnimationFrame(animateReload);
  }

  public replenishAmmo() {
    this.state.reserveAmmo = this.state.maxReserve;
    this.notifyState();
  }

  private notifyState() {
    this.onStateChange?.({ ...this.state });
  }

  // Frame update
  public update(dt: number, isMoving: boolean, moveSpeed: number) {
    // 1. Full-Auto Firing
    if (this.state.isFiring && this.state.fireMode === 'AUTO') {
      const now = performance.now() / 1000;
      if (now - this.lastFireTime >= this.fireRate) {
        this.tryShootSingle();
      }
    }

    // 2. Burst Firing
    if (this.burstRemaining > 0) {
      const now = performance.now() / 1000;
      if (now - this.lastBurstShot >= this.burstInterval) {
        if (this.tryShootSingle()) {
          this.burstRemaining--;
          this.lastBurstShot = now;
        } else {
          this.burstRemaining = 0;
        }
      }
    }

    // 3. Muzzle Flash Fade
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.muzzleFlashLight.intensity = 0;
        this.muzzleFlashSprite.material.opacity = 0;
      }
    }

    // 4. Return Bolt smoothly
    if (this.boltNode) {
      this.boltNode.position.x = THREE.MathUtils.lerp(
        this.boltNode.position.x,
        this.boltInitialPos.x,
        dt * 30
      );
    }

    // 5. Weapon Sway & Movement Bobbing
    this.idleBob += dt * 1.5;
    if (isMoving) {
      this.walkBob += dt * (moveSpeed * 2.8);
    } else {
      this.walkBob = THREE.MathUtils.lerp(this.walkBob, 0, dt * 5);
    }

    const bobX = Math.cos(this.walkBob) * (this.state.isAiming ? 0.0015 : 0.012) + Math.sin(this.idleBob * 0.7) * 0.002;
    const bobY = Math.abs(Math.sin(this.walkBob)) * (this.state.isAiming ? 0.0015 : 0.014) + Math.sin(this.idleBob) * 0.003;

    // 6. Recover Recoil
    this.recoilZ = THREE.MathUtils.lerp(this.recoilZ, 0, dt * this.recoilRecoverSpeed);
    this.recoilPitch = THREE.MathUtils.lerp(this.recoilPitch, 0, dt * this.recoilRecoverSpeed);
    this.recoilYaw = THREE.MathUtils.lerp(this.recoilYaw, 0, dt * this.recoilRecoverSpeed);

    // 7. Transition between Hip and ADS
    const targetPos = this.state.isAiming ? this.adsPos : this.hipPos;
    const targetRot = this.state.isAiming ? this.adsRot : this.hipRot;
    const lerpSpeed = this.state.isAiming ? 18 : 14;

    this.currentPos.x = THREE.MathUtils.lerp(this.currentPos.x, targetPos.x + bobX + this.recoilYaw, dt * lerpSpeed);
    this.currentPos.y = THREE.MathUtils.lerp(this.currentPos.y, targetPos.y + bobY + this.recoilPitch * 0.2, dt * lerpSpeed);
    this.currentPos.z = THREE.MathUtils.lerp(this.currentPos.z, targetPos.z + this.recoilZ, dt * lerpSpeed);

    this.group.position.copy(this.currentPos);

    // Angular orientation & recoil kick
    this.currentRot.x = THREE.MathUtils.lerp(this.currentRot.x, targetRot.x + this.recoilPitch, dt * lerpSpeed);
    this.currentRot.y = THREE.MathUtils.lerp(this.currentRot.y, targetRot.y + this.recoilYaw, dt * lerpSpeed);
    this.currentRot.z = THREE.MathUtils.lerp(this.currentRot.z, targetRot.z - this.recoilYaw * 1.2, dt * lerpSpeed);

    this.group.rotation.copy(this.currentRot);
  }
}
