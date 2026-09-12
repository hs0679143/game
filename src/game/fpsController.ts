import * as THREE from 'three';
import { WeaponController } from './weapons';
import { audioManager } from './audio';

export class FPSController {
  public camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private weapon: WeaponController;

  // Rotation Euler
  public euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private minPolarAngle = -Math.PI / 2.05; // Can look directly down at feet
  private maxPolarAngle = Math.PI / 2.2;

  // Pointer lock state
  public isLocked = false;
  public mouseSensitivity = 0.0022;

  // Movement keys
  private keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
  };
  private isSprinting = false;

  // Physical camera position in firing lane
  public velocity = new THREE.Vector3();
  public baseEyeHeight = 1.68; // SWAT soldier eye height in meters

  // Smooth dragging when not pointer locked
  private isPointerDown = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // FOV management (Hip vs ADS)
  private hipFOV = 75;
  private adsFOV = 40;
  private currentFOV = 75;

  // Menu state
  public isMenuOpen = false;

  // Callbacks
  public onLockChange?: (locked: boolean) => void;
  public onToggleMenu?: () => void;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement, weapon: WeaponController) {
    this.camera = camera;
    this.domElement = domElement;
    this.weapon = weapon;

    // Set camera near plane to 0.02 so looking down at own feet never clips!
    this.camera.near = 0.02;
    this.camera.updateProjectionMatrix();

    this.camera.position.set(0, this.baseEyeHeight, 1.2);
    this.euler.setFromQuaternion(this.camera.quaternion);

    this.setupEventListeners();
  }

  private setupEventListeners() {
    // 1. Pointer Lock Events
    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.domElement;
      this.onLockChange?.(this.isLocked);
    });

    // 2. Mouse Look via Pointer Lock
    window.addEventListener('mousemove', (e) => {
      if (this.isMenuOpen) return;

      if (this.isLocked) {
        this.rotateCamera(e.movementX, e.movementY);
      } else if (this.isPointerDown) {
        const dx = e.clientX - this.lastPointerX;
        const dy = e.clientY - this.lastPointerY;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
        this.rotateCamera(dx, dy);
      }
    });

    // 3. Canvas Mouse: User requested: Left Click = Fire, Right Click = ADS
    this.domElement.addEventListener('mousedown', (e) => {
      if (this.isMenuOpen) return;

      // Auto-lock mouse when clicking canvas if menu is closed
      if (!this.isLocked) {
        this.requestLock();
      }

      if (e.button === 0) {
        // LEFT CLICK: FIRE!
        e.preventDefault();
        this.weapon.startFiring();
      } else if (e.button === 2) {
        // RIGHT CLICK: AIM / ADS
        e.preventDefault();
        this.weapon.toggleAiming();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        // Release Left Click: Stop firing
        this.weapon.stopFiring();
        this.isPointerDown = false;
      }
    });

    // Prevent context menu anywhere on game canvas
    this.domElement.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    window.addEventListener('contextmenu', (e) => {
      // Prevent browser right-click menu so right-click fire works seamlessly
      if (this.isLocked) {
        e.preventDefault();
      }
    });

    // 4. Touch support for mobile / preview
    this.domElement.addEventListener(
      'touchstart',
      (e) => {
        if (this.isMenuOpen) return;
        if (e.touches.length === 1) {
          this.isPointerDown = true;
          this.lastPointerX = e.touches[0].clientX;
          this.lastPointerY = e.touches[0].clientY;
        }
      },
      { passive: true }
    );

    this.domElement.addEventListener(
      'touchmove',
      (e) => {
        if (this.isMenuOpen) return;
        if (this.isPointerDown && e.touches.length === 1) {
          const dx = e.touches[0].clientX - this.lastPointerX;
          const dy = e.touches[0].clientY - this.lastPointerY;
          this.lastPointerX = e.touches[0].clientX;
          this.lastPointerY = e.touches[0].clientY;
          this.rotateCamera(dx * 1.5, dy * 1.5);
        }
      },
      { passive: true }
    );

    this.domElement.addEventListener('touchend', () => {
      this.isPointerDown = false;
    });

    // 5. Keyboard Navigation & ESC Menu Toggle
    window.addEventListener('keydown', (e) => {
      // ESC Menu Toggle: "esc menü olsun ve menü kapalı olduğu sürece lock mouse olsun"
      if (e.code === 'Escape') {
        e.preventDefault();
        this.onToggleMenu?.();
        return;
      }

      if (this.isMenuOpen) return;

      const code = e.code;
      const key = e.key ? e.key.toLowerCase() : '';

      if (code === 'KeyW' || key === 'w' || code === 'ArrowUp') {
        this.keys.forward = true;
      } else if (code === 'KeyS' || key === 's' || code === 'ArrowDown') {
        this.keys.backward = true;
      } else if (code === 'KeyA' || key === 'a' || code === 'ArrowLeft') {
        this.keys.left = true;
      } else if (code === 'KeyD' || key === 'd' || code === 'ArrowRight') {
        this.keys.right = true;
      } else if (code === 'KeyR' || key === 'r') {
        this.weapon.reload();
      } else if (code === 'KeyB' || key === 'b') {
        this.weapon.cycleFireMode();
      } else if (code === 'ShiftLeft' || code === 'ShiftRight') {
        this.isSprinting = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      const code = e.code;
      const key = e.key ? e.key.toLowerCase() : '';

      if (code === 'KeyW' || key === 'w' || code === 'ArrowUp') {
        this.keys.forward = false;
      } else if (code === 'KeyS' || key === 's' || code === 'ArrowDown') {
        this.keys.backward = false;
      } else if (code === 'KeyA' || key === 'a' || code === 'ArrowLeft') {
        this.keys.left = false;
      } else if (code === 'KeyD' || key === 'd' || code === 'ArrowRight') {
        this.keys.right = false;
      } else if (code === 'ShiftLeft' || code === 'ShiftRight') {
        this.isSprinting = false;
      }
    });

    // Reset movement keys when window loses focus
    window.addEventListener('blur', () => {
      this.keys.forward = false;
      this.keys.backward = false;
      this.keys.left = false;
      this.keys.right = false;
      this.isSprinting = false;
      audioManager.stopRunningImmediate();
    });
  }

  public setMovementKey(key: 'forward' | 'backward' | 'left' | 'right', active: boolean) {
    this.keys[key] = active;
  }

  public requestLock() {
    if (this.isMenuOpen) return;
    try {
      this.domElement.requestPointerLock();
    } catch {
      // ignore
    }
  }

  public exitLock() {
    try {
      document.exitPointerLock();
    } catch {
      // ignore
    }
  }

  public rotateCamera(movementX: number, movementY: number) {
    const sens = this.weapon.state.isAiming ? this.mouseSensitivity * 0.45 : this.mouseSensitivity;
    this.euler.y -= movementX * sens;
    this.euler.x -= movementY * sens;

    // Clamp pitch (allow looking all the way down to boots)
    this.euler.x = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.euler.x));

    this.camera.quaternion.setFromEuler(this.euler);
  }

  public lookAtTarget(targetZ: number) {
    this.euler.x = 0;
    this.euler.y = 0;
    this.camera.quaternion.setFromEuler(this.euler);
  }

  public update(dt: number) {
    if (this.isMenuOpen) {
      this.weapon.stopFiring();
      audioManager.stopRunningImmediate();
      return;
    }

    // Running Sound Control:
    // User requested: "durduğumuzda ana sesi kes ve dur aq"
    const hasMoveInput = this.keys.forward || this.keys.backward || this.keys.left || this.keys.right;
    const isAiming = this.weapon.state.isAiming;

    if (hasMoveInput && !isAiming) {
      audioManager.startRunning();
    } else {
      audioManager.stopRunning();
    }

    // 1. WASD Walking & Running movement
    const moveVector = new THREE.Vector3();
    if (this.keys.forward) moveVector.z -= 1;
    if (this.keys.backward) moveVector.z += 1;
    if (this.keys.left) moveVector.x -= 1;
    if (this.keys.right) moveVector.x += 1;

    const isMoving = moveVector.lengthSq() > 0;
    if (isMoving) {
      moveVector.normalize();
      const yaw = this.euler.y;
      const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

      let walkSpeed = 3.8;
      if (this.weapon.state.isAiming) {
        walkSpeed = 1.8;
      } else if (this.isSprinting) {
        walkSpeed = 6.2;
      }

      const desiredVel = forward
        .multiplyScalar(-moveVector.z)
        .add(right.multiplyScalar(moveVector.x))
        .multiplyScalar(walkSpeed);

      this.velocity.lerp(desiredVel, dt * 9);
    } else {
      // User requested: "durduğundada öyle durmasın çok yavaşlasın öyle dursun"
      // Smooth gradual deceleration / inertia
      this.velocity.lerp(new THREE.Vector3(), dt * 3.5);
      if (this.velocity.lengthSq() < 0.001) {
        this.velocity.set(0, 0, 0);
      }
    }

    this.camera.position.addScaledVector(this.velocity, dt);

    // Full Range Boundaries: Can freely walk anywhere in the 110m polygon range!
    this.camera.position.x = Math.max(-8.5, Math.min(8.5, this.camera.position.x));
    this.camera.position.z = Math.max(-105.0, Math.min(5.5, this.camera.position.z));
    this.camera.position.y = this.baseEyeHeight;

    // 2. Smooth FOV transition for ADS zoom
    const targetFOV = this.weapon.state.isAiming ? this.adsFOV : this.hipFOV;
    this.currentFOV = THREE.MathUtils.lerp(this.currentFOV, targetFOV, dt * 16);
    if (Math.abs(this.camera.fov - this.currentFOV) > 0.05) {
      this.camera.fov = this.currentFOV;
      this.camera.updateProjectionMatrix();
    }

    // 3. Update weapon with movement state
    this.weapon.update(dt, isMoving, this.velocity.length());
  }
}
