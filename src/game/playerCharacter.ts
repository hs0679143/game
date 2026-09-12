import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class PlayerCharacter {
  public group: THREE.Group;
  private loader: GLTFLoader;
  public isLoaded = false;

  // Bones for procedural animation
  private pelvisBone: THREE.Object3D | null = null;
  private spineBone: THREE.Object3D | null = null;
  private spine1Bone: THREE.Object3D | null = null;
  private spine2Bone: THREE.Object3D | null = null;
  private headBone: THREE.Object3D | null = null;
  private neckBone: THREE.Object3D | null = null;

  // Legs
  private leftThigh: THREE.Object3D | null = null;
  private leftCalf: THREE.Object3D | null = null;
  private leftFoot: THREE.Object3D | null = null;

  private rightThigh: THREE.Object3D | null = null;
  private rightCalf: THREE.Object3D | null = null;
  private rightFoot: THREE.Object3D | null = null;

  // Arms
  private leftUpperArm: THREE.Object3D | null = null;
  private leftForearm: THREE.Object3D | null = null;
  private leftHand: THREE.Object3D | null = null;

  private rightUpperArm: THREE.Object3D | null = null;
  private rightForearm: THREE.Object3D | null = null;
  private rightHand: THREE.Object3D | null = null;

  // Initial bone transforms
  private initialTransforms = new Map<
    string,
    { pos: THREE.Vector3; rot: THREE.Euler }
  >();

  // Animation state
  private walkCycle = 0;
  private idleTime = 0;
  private basePelvisY = 89.5; // Raw pelvis translation in SWAT model

  constructor() {
    this.group = new THREE.Group();
    this.loader = new GLTFLoader();
  }

  public async loadModel(): Promise<void> {
    return new Promise((resolve) => {
      this.loader.load(
        '/models/swat.glb',
        (gltf) => {
          const model = gltf.scene;

          // SWAT model is ~185 cm tall in raw coordinates.
          // Scale down to meters: 0.0102 gives realistic 1.88m height
          const scale = 0.0102;
          model.scale.set(scale, scale, scale);

          // Position at player feet level
          model.position.set(0, 0, 0);

          // Find bones and adjust meshes/materials
          model.traverse((child) => {
            // Check meshes
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;

              // Hide default machinegun and shotgun so player holds the real M4A1
              if (
                mesh.name.includes('machinegun') ||
                mesh.name.includes('shotgun') ||
                child.name === 'Object_8' ||
                child.name === 'Object_11'
              ) {
                mesh.visible = false;
                return;
              }

              // Hide head and helmet meshes for first-person camera so they don't clip the eye,
              // while keeping tactical vest, belt, legs, knees and boots 100% visible!
              if (
                mesh.name.includes('head') ||
                mesh.name.includes('helmet') ||
                child.name === 'Object_7' ||
                child.name === 'Object_10'
              ) {
                // Keep head invisible in FPS view so looking forward doesn't clip
                mesh.visible = false;
                return;
              }

              // Enhance materials with tactical SWAT colors
              const matName = (mesh.material as THREE.Material)?.name || '';
              if (matName.includes('body') || child.name === 'Object_6') {
                // SWAT uniform & tactical combat pants/boots
                mesh.material = new THREE.MeshStandardMaterial({
                  color: new THREE.Color(0x232832),
                  roughness: 0.75,
                  metalness: 0.15,
                });
              } else if (matName.includes('equipment') || child.name === 'Object_9') {
                // Ballistic Kevlar tactical vest & gear
                mesh.material = new THREE.MeshStandardMaterial({
                  color: new THREE.Color(0x181b22),
                  roughness: 0.6,
                  metalness: 0.25,
                });
              } else if (matName.includes('pistol') || child.name === 'Object_12') {
                // Holstered sidearm
                mesh.material = new THREE.MeshStandardMaterial({
                  color: new THREE.Color(0x12141a),
                  roughness: 0.5,
                  metalness: 0.4,
                });
              } else if (matName.includes('opacity') || child.name === 'Object_13') {
                mesh.material = new THREE.MeshStandardMaterial({
                  color: new THREE.Color(0x28303e),
                  roughness: 0.5,
                  metalness: 0.2,
                });
              }
            }

            // Identify skeleton bones
            const name = child.name;
            if (name === 'Bip01 Pelvis_02') this.pelvisBone = child;
            if (name === 'Bip01 Spine_03') this.spineBone = child;
            if (name === 'Bip01 Spine1_04') this.spine1Bone = child;
            if (name === 'Bip01 Spine2_05') this.spine2Bone = child;
            if (name === 'Bip01 Head_07') this.headBone = child;
            if (name === 'Bip01 Neck_06') this.neckBone = child;

            // Legs
            if (name === 'Bip01 L Thigh_073') this.leftThigh = child;
            if (name === 'Bip01 L Calf_074') this.leftCalf = child;
            if (name === 'Bip01 L Foot_075') this.leftFoot = child;

            if (name === 'Bip01 R Thigh_077') this.rightThigh = child;
            if (name === 'Bip01 R Calf_078') this.rightCalf = child;
            if (name === 'Bip01 R Foot_079') this.rightFoot = child;

            // Arms
            if (name === 'Bip01 L UpperArm_037') this.leftUpperArm = child;
            if (name === 'Bip01 L Forearm_038') this.leftForearm = child;
            if (name === 'Bip01 L Hand_039') this.leftHand = child;

            if (name === 'Bip01 R UpperArm_055') this.rightUpperArm = child;
            if (name === 'Bip01 R Forearm_056') this.rightForearm = child;
            if (name === 'Bip01 R Hand_057') this.rightHand = child;

            // Save initial bone rotation/position
            if (child.isObject3D) {
              this.initialTransforms.set(name, {
                pos: child.position.clone(),
                rot: child.rotation.clone(),
              });
            }
          });

          // Save initial bone rotation/position
          model.traverse((child) => {
            if ((child as THREE.Object3D).isObject3D) {
              this.initialTransforms.set(child.name, {
                pos: child.position.clone(),
                rot: child.rotation.clone(),
              });
            }
          });

          // Set default tactical stance for body
          this.poseTacticalReady();

          this.group.add(model);
          this.isLoaded = true;
          resolve();
        },
        undefined,
        (err) => {
          console.error('Failed to load SWAT model:', err);
          resolve();
        }
      );
    });
  }

  // Pre-pose arms into tactical rifle handling stance without destroying bone quaternions
  private poseTacticalReady() {
    // Keep upper arms raised forward to support weapon ready stance
    if (this.rightUpperArm) {
      this.rightUpperArm.rotation.set(-0.35, -0.2, 0.2);
    }
    if (this.rightForearm) {
      this.rightForearm.rotation.set(-0.4, 0, 0);
    }
    if (this.leftUpperArm) {
      this.leftUpperArm.rotation.set(-0.4, 0.3, -0.15);
    }
    if (this.leftForearm) {
      this.leftForearm.rotation.set(-0.5, 0, 0);
    }
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    cameraYaw: number,
    cameraPitch: number,
    isMoving: boolean,
    moveSpeed: number
  ) {
    if (!this.isLoaded) return;

    // 1. Position body directly under the player camera
    // Offset backward (0.22m) along camera direction so the camera is comfortably in front of the neck/eyes
    const backward = new THREE.Vector3(
      Math.sin(cameraYaw),
      0,
      Math.cos(cameraYaw)
    );

    this.group.position.x = playerPos.x + backward.x * 0.22;
    this.group.position.z = playerPos.z + backward.z * 0.22;
    this.group.position.y = 0; // Ground floor

    // 2. Rotate body to match player yaw
    // The SWAT model naturally faces +Z; camera forward is -Z.
    // Adding Math.PI turns the model around to face the EXACT direction the player is looking!
    this.group.rotation.y = cameraYaw + Math.PI;

    // 3. Spine pitch bending: when looking down, upper chest tilts down
    if (this.spine1Bone) {
      // Pitch forward/backward with camera angle
      this.spine1Bone.rotation.x = THREE.MathUtils.lerp(
        this.spine1Bone.rotation.x,
        cameraPitch * 0.35,
        dt * 10
      );
    }

    // 4. Idle breathing animation
    this.idleTime += dt * 2.0;
    const breathe = Math.sin(this.idleTime) * 0.015;
    if (this.spineBone) {
      this.spineBone.rotation.z = breathe * 0.5;
    }

    // 5. Walking stride animation (Moving legs and boots)
    if (isMoving && moveSpeed > 0.1) {
      this.walkCycle += dt * (moveSpeed * 3.5);

      const legSwing = Math.sin(this.walkCycle) * 0.55;
      const kneeBend = Math.max(0, -Math.sin(this.walkCycle)) * 0.65;
      const altKneeBend = Math.max(0, Math.sin(this.walkCycle)) * 0.65;

      // Left leg
      if (this.leftThigh) {
        this.leftThigh.rotation.x = legSwing;
      }
      if (this.leftCalf) {
        this.leftCalf.rotation.x = kneeBend;
      }
      if (this.leftFoot) {
        this.leftFoot.rotation.x = -legSwing * 0.4;
      }

      // Right leg (opposite phase)
      if (this.rightThigh) {
        this.rightThigh.rotation.x = -legSwing;
      }
      if (this.rightCalf) {
        this.rightCalf.rotation.x = altKneeBend;
      }
      if (this.rightFoot) {
        this.rightFoot.rotation.x = legSwing * 0.4;
      }

      // Subtle pelvis walking bounce
      if (this.pelvisBone) {
        this.pelvisBone.position.y =
          this.basePelvisY + Math.abs(Math.sin(this.walkCycle * 2)) * 1.8;
      }
    } else {
      // Idle: smoothly return legs and feet to stationary ready stance
      const recoverSpeed = dt * 10;
      if (this.leftThigh) this.leftThigh.rotation.x = THREE.MathUtils.lerp(this.leftThigh.rotation.x, 0, recoverSpeed);
      if (this.leftCalf) this.leftCalf.rotation.x = THREE.MathUtils.lerp(this.leftCalf.rotation.x, 0, recoverSpeed);
      if (this.leftFoot) this.leftFoot.rotation.x = THREE.MathUtils.lerp(this.leftFoot.rotation.x, 0, recoverSpeed);

      if (this.rightThigh) this.rightThigh.rotation.x = THREE.MathUtils.lerp(this.rightThigh.rotation.x, 0, recoverSpeed);
      if (this.rightCalf) this.rightCalf.rotation.x = THREE.MathUtils.lerp(this.rightCalf.rotation.x, 0, recoverSpeed);
      if (this.rightFoot) this.rightFoot.rotation.x = THREE.MathUtils.lerp(this.rightFoot.rotation.x, 0, recoverSpeed);

      if (this.pelvisBone) {
        this.pelvisBone.position.y = THREE.MathUtils.lerp(this.pelvisBone.position.y, this.basePelvisY, recoverSpeed);
      }
    }
  }
}
