import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HitResult } from './types';
import { audioManager } from './audio';
import { ParticleSystem } from './particles';

export interface TargetDummy {
  id: string;
  group: THREE.Group;
  dummyModel: THREE.Group;
  lod?: THREE.LOD;
  distance: number;
  health: number;
  maxHealth: number;
  isDown: boolean;
  isMoving: boolean;
  moveSpeed: number;
  moveRange: number;
  moveCenter: number;
  moveDir: number;
  isPopUp: boolean;
  popUpTimer: number;
  isHiding: boolean;
  downTimer: number;
  wobbleAngle: number;
  wobbleVelocity: number;
  hitMeshes: THREE.Mesh[];
  type: 'DUMMY' | 'STEEL_GONG';
  gongMesh?: THREE.Mesh;
  boundingSphere: THREE.Sphere;
}

export class TargetManager {
  private scene: THREE.Scene;
  private loader: GLTFLoader;
  private particles: ParticleSystem;
  private dummyTemplate: THREE.Group | null = null;
  public targets: TargetDummy[] = [];
  private raycaster: THREE.Raycaster;
  public onHitCallback?: (result: HitResult) => void;

  // Shared Materials for LOD levels to save draw calls & memory
  private medDummyMat: THREE.MeshStandardMaterial;
  private lowDummyMat: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene, particles: ParticleSystem) {
    this.scene = scene;
    this.particles = particles;
    this.loader = new GLTFLoader();
    this.raycaster = new THREE.Raycaster();

    this.medDummyMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      roughness: 0.6,
      metalness: 0.1,
    });

    this.lowDummyMat = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      roughness: 0.7,
      metalness: 0.05,
    });
  }

  public async loadModels(): Promise<void> {
    return new Promise((resolve) => {
      this.loader.load(
        '/models/low-poly_test_dummy.glb',
        (gltf) => {
          const dummy = gltf.scene;

          dummy.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              mesh.frustumCulled = true;
              if (mesh.material) {
                const mat = mesh.material as THREE.MeshStandardMaterial;
                mat.roughness = 0.65;
                mat.metalness = 0.15;
              }
            }
          });

          // Scale dummy so its height is roughly 1.85 meters tall
          const box = new THREE.Box3().setFromObject(dummy);
          const size = new THREE.Vector3();
          box.getSize(size);
          const targetHeight = 1.85;
          const scale = targetHeight / (size.y || 8.8);
          dummy.scale.set(scale, scale, scale);

          // Center dummy horizontally, feet on y=0
          box.setFromObject(dummy);
          dummy.position.y = -box.min.y;

          const wrapper = new THREE.Group();
          wrapper.add(dummy);
          this.dummyTemplate = wrapper;

          this.spawnAllTargets();
          resolve();
        },
        undefined,
        (err) => {
          console.error('Failed to load dummy model:', err);
          this.createFallbackDummyTemplate();
          this.spawnAllTargets();
          resolve();
        }
      );
    });
  }

  // Fallback high-detail procedural dummy
  private createFallbackDummyTemplate() {
    const wrapper = new THREE.Group();
    const dummy = new THREE.Group();

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 })
    );
    head.position.set(0, 1.6, 0);
    head.castShadow = true;
    dummy.add(head);

    // Torso
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.65, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.6 })
    );
    torso.position.set(0, 1.15, 0);
    torso.castShadow = true;
    dummy.add(torso);

    // Pelvis & Legs
    const legs = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.8, 8),
      new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.7 })
    );
    legs.position.set(0, 0.4, 0);
    legs.castShadow = true;
    dummy.add(legs);

    wrapper.add(dummy);
    this.dummyTemplate = wrapper;
  }

  // LOD Level 1: Medium Detail Dummy (25m - 50m distance)
  // 65% fewer polygons, optimized boxes and cylinders
  private createMediumDetailDummy(): THREE.Group {
    const group = new THREE.Group();

    // Low-segment head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.22), this.medDummyMat);
    head.position.set(0, 1.6, 0);
    head.castShadow = true;
    group.add(head);

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.65, 0.24), this.medDummyMat);
    torso.position.set(0, 1.15, 0);
    torso.castShadow = true;
    group.add(torso);

    // Single consolidated leg block
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.8, 0.22), this.medDummyMat);
    legs.position.set(0, 0.4, 0);
    legs.castShadow = true;
    group.add(legs);

    return group;
  }

  // LOD Level 2: Low Detail Dummy (> 50m distance)
  // Single silhouette box, minimal vertex count for distance rendering
  private createLowDetailDummy(): THREE.Group {
    const group = new THREE.Group();

    const silhouette = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 1.82, 0.22),
      this.lowDummyMat
    );
    silhouette.position.set(0, 0.91, 0);
    group.add(silhouette);

    return group;
  }

  private spawnAllTargets() {
    // Clear existing
    this.targets.forEach((t) => this.scene.remove(t.group));
    this.targets = [];

    // 1. Station 1: 15m Close Static Target
    this.createDummyStation({
      id: 'dummy_15m',
      position: new THREE.Vector3(-3.5, 0, -15),
      distance: 15,
      isMoving: false,
    });

    // 2. Station 2: 25m Center Static Target
    this.createDummyStation({
      id: 'dummy_25m',
      position: new THREE.Vector3(0, 0, -25),
      distance: 25,
      isMoving: false,
    });

    // 3. Station 3: 40m Moving Rail Target
    this.createDummyStation({
      id: 'dummy_40m_moving',
      position: new THREE.Vector3(3.5, 0, -40),
      distance: 40,
      isMoving: true,
      moveSpeed: 2.8,
      moveRange: 5.5,
    });

    // 4. Station 4: 55m Tactical Pop-Up Target
    this.createDummyStation({
      id: 'dummy_55m_popup',
      position: new THREE.Vector3(-4.5, 0, -55),
      distance: 55,
      isMoving: false,
      isPopUp: true,
    });

    // 5. Station 5: 75m Long Distance Sniper Dummy
    this.createDummyStation({
      id: 'dummy_75m',
      position: new THREE.Vector3(2.5, 0, -75),
      distance: 75,
      isMoving: false,
    });

    // 6. Steel Gong / Popper Targets at 20m, 35m, 60m
    this.createSteelGong({
      id: 'gong_20m',
      position: new THREE.Vector3(4.2, 1.4, -20),
      radius: 0.35,
      distance: 20,
    });

    this.createSteelGong({
      id: 'gong_35m',
      position: new THREE.Vector3(-4.8, 1.5, -35),
      radius: 0.3,
      distance: 35,
    });

    this.createSteelGong({
      id: 'gong_60m',
      position: new THREE.Vector3(-1.5, 1.6, -60),
      radius: 0.25,
      distance: 60,
    });
  }

  private createDummyStation(params: {
    id: string;
    position: THREE.Vector3;
    distance: number;
    isMoving?: boolean;
    moveSpeed?: number;
    moveRange?: number;
    isPopUp?: boolean;
  }) {
    if (!this.dummyTemplate) return;

    const group = new THREE.Group();
    group.position.copy(params.position);

    // Platform / Stand base
    const baseGeo = new THREE.BoxGeometry(1.2, 0.15, 1.2);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x262626, roughness: 0.8 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = 0.075;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    // Distance Sign on the stand
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 128;
    signCanvas.height = 64;
    const sctx = signCanvas.getContext('2d');
    if (sctx) {
      sctx.fillStyle = '#0f172a';
      sctx.fillRect(0, 0, 128, 64);
      sctx.fillStyle = '#f59e0b';
      sctx.font = 'bold 32px "Chakra Petch", sans-serif';
      sctx.textAlign = 'center';
      sctx.textBaseline = 'middle';
      sctx.fillText(`${params.distance}M`, 64, 32);
    }
    const signTexture = new THREE.CanvasTexture(signCanvas);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.4),
      new THREE.MeshBasicMaterial({ map: signTexture })
    );
    sign.position.set(0, 0.3, 0.61);
    group.add(sign);

    // Target mounting hinge pivot (allows dummy to fall/wobble smoothly)
    const hingePivot = new THREE.Group();
    hingePivot.position.set(0, 0.25, 0);
    group.add(hingePivot);

    // ==========================================
    // THREE.LOD (Level of Detail Integration)
    // Level 0: 0m - 28m -> High Detail Model
    // Level 1: 28m - 52m -> Medium Detail Model
    // Level 2: > 52m -> Low Detail Silhouette
    // ==========================================
    const lod = new THREE.LOD();

    // High detail level
    const highDetail = this.dummyTemplate.clone(true);
    highDetail.position.set(0, 0.2, 0);
    lod.addLevel(highDetail, 0);

    // Medium detail level
    const medDetail = this.createMediumDetailDummy();
    medDetail.position.set(0, 0.2, 0);
    lod.addLevel(medDetail, 28);

    // Low detail level
    const lowDetail = this.createLowDetailDummy();
    lowDetail.position.set(0, 0.2, 0);
    lod.addLevel(lowDetail, 52);

    hingePivot.add(lod);

    // If moving, add rail track visual
    if (params.isMoving) {
      const railGeo = new THREE.BoxGeometry((params.moveRange || 5) * 2 + 1, 0.08, 0.4);
      const railMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7 });
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(0, 0.04, 0);
      group.add(rail);
    }

    // Collect all hit candidate meshes from all LOD levels for continuous hit detection
    const hitMeshes: THREE.Mesh[] = [];
    lod.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.frustumCulled = true;
        hitMeshes.push(m);
      }
    });

    const target: TargetDummy = {
      id: params.id,
      group,
      dummyModel: hingePivot,
      lod,
      distance: params.distance,
      health: 100,
      maxHealth: 100,
      isDown: false,
      isMoving: !!params.isMoving,
      moveSpeed: params.moveSpeed || 2.0,
      moveRange: params.moveRange || 4.0,
      moveCenter: params.position.x,
      moveDir: 1,
      isPopUp: !!params.isPopUp,
      popUpTimer: 0,
      isHiding: false,
      downTimer: 0,
      wobbleAngle: 0,
      wobbleVelocity: 0,
      hitMeshes,
      type: 'DUMMY',
      boundingSphere: new THREE.Sphere(params.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 1.5),
    };

    this.scene.add(group);
    this.targets.push(target);
  }

  private createSteelGong(params: {
    id: string;
    position: THREE.Vector3;
    radius: number;
    distance: number;
  }) {
    const group = new THREE.Group();
    group.position.copy(params.position);

    // Support frame
    const legMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.4 });
    const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.8, 8);

    const legL = new THREE.Mesh(legGeo, legMat);
    legL.position.set(-params.radius - 0.35, -0.4, 0);
    legL.rotation.z = -0.18;
    group.add(legL);

    const legR = new THREE.Mesh(legGeo, legMat);
    legR.position.set(params.radius + 0.35, -0.4, 0);
    legR.rotation.z = 0.18;
    group.add(legR);

    const topBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, params.radius * 2 + 1.1, 8),
      legMat
    );
    topBar.rotation.z = Math.PI / 2;
    topBar.position.y = 0.55;
    group.add(topBar);

    // Gong Steel Plate
    const gongGeo = new THREE.CylinderGeometry(params.radius, params.radius, 0.04, 24);
    gongGeo.rotateX(Math.PI / 2);
    const gongMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.8,
      roughness: 0.3,
    });
    const gongMesh = new THREE.Mesh(gongGeo, gongMat);
    gongMesh.position.set(0, 0, 0);
    gongMesh.castShadow = true;
    gongMesh.frustumCulled = true;
    group.add(gongMesh);

    // Gong bullseye decal
    const bullseye = new THREE.Mesh(
      new THREE.CircleGeometry(params.radius * 0.35, 16),
      new THREE.MeshBasicMaterial({ color: 0xd97706 })
    );
    bullseye.position.set(0, 0, 0.022);
    gongMesh.add(bullseye);

    const target: TargetDummy = {
      id: params.id,
      group,
      dummyModel: group,
      distance: params.distance,
      health: 9999,
      maxHealth: 9999,
      isDown: false,
      isMoving: false,
      moveSpeed: 0,
      moveRange: 0,
      moveCenter: 0,
      moveDir: 1,
      isPopUp: false,
      popUpTimer: 0,
      isHiding: false,
      downTimer: 0,
      wobbleAngle: 0,
      wobbleVelocity: 0,
      hitMeshes: [gongMesh],
      type: 'STEEL_GONG',
      gongMesh,
      boundingSphere: new THREE.Sphere(params.position.clone(), 1.2),
    };

    this.scene.add(group);
    this.targets.push(target);
  }

  // Fast Raycast with Frustum & Distance Pre-filtering
  public checkHit(ray: THREE.Ray, frustum?: THREE.Frustum): HitResult {
    this.raycaster.ray = ray;

    // Collect candidate meshes only from active, unhidden, standing targets
    const candidates: { mesh: THREE.Mesh; target: TargetDummy }[] = [];
    for (let i = 0; i < this.targets.length; i++) {
      const target = this.targets[i];
      if (target.isDown && target.type === 'DUMMY') continue;
      if (target.isHiding) continue;

      // Frustum culling filter: if target sphere is entirely outside frustum, skip raycast!
      if (frustum && !frustum.intersectsSphere(target.boundingSphere)) {
        continue;
      }

      for (let j = 0; j < target.hitMeshes.length; j++) {
        const m = target.hitMeshes[j];
        if (m.visible && m.parent && m.parent.visible) {
          candidates.push({ mesh: m, target });
        }
      }
    }

    if (candidates.length === 0) return { hit: false };

    const meshes = candidates.map((c) => c.mesh);
    const intersects = this.raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const candidate = candidates.find((c) => c.mesh === hit.object);
      if (!candidate) return { hit: false };

      const target = candidate.target;
      const hitPoint = hit.point;
      const hitNormal = hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 0, 1);

      if (target.type === 'STEEL_GONG') {
        target.wobbleVelocity = -6.5;
        audioManager.playHitSound('STEEL_GONG');
        this.particles.createImpact(hitPoint, hitNormal, false, true);
        this.particles.spawnFloatingText(`+75 STEEL!`, hitPoint, '#f59e0b');

        const result: HitResult = {
          hit: true,
          hitType: 'STEEL_GONG',
          distance: target.distance,
          points: 75,
          damage: 100,
          point: [hitPoint.x, hitPoint.y, hitPoint.z],
        };
        this.onHitCallback?.(result);
        return result;
      }

      // DUMMY Hit zone classification
      const localPoint = target.dummyModel.worldToLocal(hitPoint.clone());
      let hitType: 'HEAD' | 'TORSO' | 'LIMB' = 'TORSO';
      let damage = 50;
      let points = 50;
      let isHeadshot = false;

      if (localPoint.y >= 1.38) {
        hitType = 'HEAD';
        damage = 100;
        points = 100;
        isHeadshot = true;
      } else if (localPoint.y >= 0.7) {
        hitType = 'TORSO';
        damage = 50;
        points = 50;
      } else {
        hitType = 'LIMB';
        damage = 25;
        points = 25;
      }

      if (target.distance > 20) {
        points += Math.floor(target.distance - 20);
      }

      audioManager.playHitSound(hitType);
      this.particles.createImpact(hitPoint, hitNormal, true, false);

      const label = isHeadshot ? `HEADSHOT! +${points}` : `${hitType} +${points}`;
      this.particles.spawnFloatingText(label, hitPoint, isHeadshot ? '#ef4444' : '#f59e0b');

      target.wobbleVelocity = -3.5;
      target.health -= damage;
      if (target.health <= 0) {
        this.knockdownTarget(target);
      }

      const result: HitResult = {
        hit: true,
        hitType,
        distance: target.distance,
        damage,
        points,
        isHeadshot,
        point: [hitPoint.x, hitPoint.y, hitPoint.z],
      };

      this.onHitCallback?.(result);
      return result;
    }

    return { hit: false };
  }

  private knockdownTarget(target: TargetDummy) {
    if (target.isDown) return;
    target.isDown = true;
    target.downTimer = 3.2;
    audioManager.playTargetKnockdown();
  }

  public resetAllTargets() {
    this.targets.forEach((t) => {
      t.isDown = false;
      t.health = t.maxHealth;
      t.wobbleAngle = 0;
      t.wobbleVelocity = 0;
      t.downTimer = 0;
      t.dummyModel.rotation.x = 0;
    });
  }

  // Frame update with LOD and Frustum Culling
  public update(dt: number, camera?: THREE.Camera, frustum?: THREE.Frustum) {
    for (let i = 0; i < this.targets.length; i++) {
      const target = this.targets[i];

      // Update bounding sphere position for moving targets
      target.boundingSphere.center.copy(target.group.position).add(new THREE.Vector3(0, 1.2, 0));

      // Frustum Culling check
      const inFrustum = frustum ? frustum.intersectsSphere(target.boundingSphere) : true;

      // If outside frustum, hide and avoid heavy animation computation
      if (!inFrustum) {
        target.group.visible = false;
        // Still advance basic moving position so it's accurate when re-entering view
        if (target.isMoving && !target.isDown) {
          target.group.position.x += target.moveDir * target.moveSpeed * dt;
          const offset = target.group.position.x - target.moveCenter;
          if (Math.abs(offset) > target.moveRange) {
            target.moveDir *= -1;
            target.group.position.x = target.moveCenter + Math.sign(offset) * target.moveRange;
          }
        }
        continue;
      }

      target.group.visible = true;

      // Update THREE.LOD for target if camera is provided
      if (camera && target.lod) {
        target.lod.update(camera);
      }

      // 1. Moving Targets
      if (target.isMoving && !target.isDown) {
        target.group.position.x += target.moveDir * target.moveSpeed * dt;
        const offset = target.group.position.x - target.moveCenter;
        if (Math.abs(offset) > target.moveRange) {
          target.moveDir *= -1;
          target.group.position.x = target.moveCenter + Math.sign(offset) * target.moveRange;
        }
      }

      // 2. Pop-up Targets
      if (target.isPopUp && !target.isDown) {
        target.popUpTimer += dt;
        if (!target.isHiding && target.popUpTimer > 4.5) {
          target.isHiding = true;
          target.popUpTimer = 0;
        } else if (target.isHiding && target.popUpTimer > 2.0) {
          target.isHiding = false;
          target.popUpTimer = 0;
        }

        const targetRot = target.isHiding ? -Math.PI / 2 : 0;
        target.dummyModel.rotation.x = THREE.MathUtils.lerp(
          target.dummyModel.rotation.x,
          targetRot,
          dt * 9
        );
      }

      // 3. Fallen / Knockdown physics
      if (target.isDown && target.type === 'DUMMY') {
        target.dummyModel.rotation.x = THREE.MathUtils.lerp(
          target.dummyModel.rotation.x,
          -Math.PI / 2,
          dt * 12
        );

        target.downTimer -= dt;
        if (target.downTimer <= 0) {
          target.isDown = false;
          target.health = target.maxHealth;
        }
      } else if (!target.isPopUp && target.type === 'DUMMY') {
        target.wobbleVelocity += -target.wobbleAngle * 45 * dt;
        target.wobbleVelocity *= 0.88;
        target.wobbleAngle += target.wobbleVelocity * dt;
        target.dummyModel.rotation.x = target.wobbleAngle;
      }

      // 4. Steel Gong pendulum swinging
      if (target.type === 'STEEL_GONG' && target.gongMesh) {
        target.wobbleVelocity += -target.wobbleAngle * 30 * dt;
        target.wobbleVelocity *= 0.92;
        target.wobbleAngle += target.wobbleVelocity * dt;
        target.gongMesh.rotation.x = target.wobbleAngle;
      }
    }
  }

  public dispose() {
    this.targets.forEach((t) => this.scene.remove(t.group));
    this.targets = [];
    this.medDummyMat.dispose();
    this.lowDummyMat.dispose();
  }
}
