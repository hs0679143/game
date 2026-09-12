import * as THREE from 'three';

// OBJECT POOLING INTERFACES
interface PooledTracer {
  mesh: THREE.Line;
  geometry: THREE.BufferGeometry;
  positionAttr: THREE.BufferAttribute;
  start: THREE.Vector3;
  end: THREE.Vector3;
  progress: number;
  speed: number;
  distance: number;
  active: boolean;
}

interface SparkParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
  active: boolean;
}

interface PooledFloatingText {
  sprite: THREE.Sprite;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  material: THREE.SpriteMaterial;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
}

interface PooledCasing {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotVelocity: THREE.Vector3;
  bounces: number;
  life: number;
  active: boolean;
}

export class ParticleSystem {
  private scene: THREE.Scene;

  // 1. TRACER OBJECT POOL (Zero allocations during firing)
  private readonly MAX_TRACERS = 25;
  private tracerPool: PooledTracer[] = [];
  private tracerMaterial: THREE.LineBasicMaterial;

  // 2. SPARK PARTICLES (Single shared BufferGeometry, static allocation)
  private readonly MAX_SPARKS = 250;
  private sparkPool: SparkParticle[] = [];
  private sparkPoints: THREE.Points | null = null;
  private sparkGeo: THREE.BufferGeometry | null = null;
  private sparkPositions: Float32Array;
  private sparkColors: Float32Array;

  // 3. SPENT CASING OBJECT POOL (Zero allocations during ejection)
  private readonly MAX_CASINGS = 35;
  private casingPool: PooledCasing[] = [];
  private casingGeo: THREE.CylinderGeometry;
  private casingMat: THREE.MeshStandardMaterial;

  // 4. FLOATING TEXT OBJECT POOL (Zero dynamic texture allocations)
  private readonly MAX_FLOATING_TEXTS = 16;
  private floatingTextPool: PooledFloatingText[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // --- Tracer Pool Setup ---
    this.tracerMaterial = new THREE.LineBasicMaterial({
      color: 0xffe277,
      transparent: true,
      opacity: 0.9,
      linewidth: 2,
    });

    for (let i = 0; i < this.MAX_TRACERS; i++) {
      const positions = new Float32Array(6); // 2 points * 3 coords
      const geo = new THREE.BufferGeometry();
      const posAttr = new THREE.BufferAttribute(positions, 3);
      geo.setAttribute('position', posAttr);
      const line = new THREE.Line(geo, this.tracerMaterial);
      line.visible = false;
      line.frustumCulled = false;
      this.scene.add(line);

      this.tracerPool.push({
        mesh: line,
        geometry: geo,
        positionAttr: posAttr,
        start: new THREE.Vector3(),
        end: new THREE.Vector3(),
        progress: 0,
        speed: 200,
        distance: 1,
        active: false,
      });
    }

    // --- Sparks Particle Buffer Setup ---
    this.sparkGeo = new THREE.BufferGeometry();
    this.sparkPositions = new Float32Array(this.MAX_SPARKS * 3);
    this.sparkColors = new Float32Array(this.MAX_SPARKS * 3);

    // Initialize offscreen
    for (let i = 0; i < this.MAX_SPARKS; i++) {
      this.sparkPositions[i * 3 + 1] = -9999;
      this.sparkPool.push({
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0.35,
        size: 0.1,
        color: new THREE.Color(),
        active: false,
      });
    }

    this.sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));
    this.sparkGeo.setAttribute('color', new THREE.BufferAttribute(this.sparkColors, 3));

    const sparkMat = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.sparkPoints = new THREE.Points(this.sparkGeo, sparkMat);
    this.sparkPoints.frustumCulled = false;
    this.scene.add(this.sparkPoints);

    // --- Spent Casing Pool Setup ---
    this.casingGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.045, 6);
    this.casingMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.85,
      roughness: 0.25,
    });

    for (let i = 0; i < this.MAX_CASINGS; i++) {
      const casing = new THREE.Mesh(this.casingGeo, this.casingMat);
      casing.visible = false;
      casing.castShadow = false; // Disable casing shadow for performance
      casing.receiveShadow = false;
      this.scene.add(casing);

      this.casingPool.push({
        mesh: casing,
        velocity: new THREE.Vector3(),
        rotVelocity: new THREE.Vector3(),
        bounces: 0,
        life: 0,
        active: false,
      });
    }

    // --- Floating Text Pool Setup ---
    for (let i = 0; i < this.MAX_FLOATING_TEXTS; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
      });

      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      sprite.scale.set(1.6, 0.4, 1);
      this.scene.add(sprite);

      this.floatingTextPool.push({
        sprite,
        canvas,
        ctx,
        texture,
        material,
        velocity: new THREE.Vector3(0, 1.2, 0),
        life: 0,
        maxLife: 1.0,
        active: false,
      });
    }
  }

  // Pooled Tracer Activation (Zero GC)
  public createTracer(start: THREE.Vector3, end: THREE.Vector3) {
    let tracer: PooledTracer | null = null;
    for (let i = 0; i < this.tracerPool.length; i++) {
      if (!this.tracerPool[i].active) {
        tracer = this.tracerPool[i];
        break;
      }
    }
    // If all active, recycle oldest
    if (!tracer) {
      tracer = this.tracerPool[0];
    }

    tracer.start.copy(start);
    tracer.end.copy(end);
    tracer.distance = Math.max(0.1, start.distanceTo(end));
    tracer.progress = 0;
    tracer.speed = 220;
    tracer.active = true;
    tracer.mesh.visible = true;

    // Set initial zero segment
    const p = tracer.positionAttr.array as Float32Array;
    p[0] = start.x; p[1] = start.y; p[2] = start.z;
    p[3] = start.x; p[4] = start.y; p[5] = start.z;
    tracer.positionAttr.needsUpdate = true;
  }

  // Pooled Impact Sparks (Zero GC)
  public createImpact(point: THREE.Vector3, normal: THREE.Vector3, isFlesh: boolean = false, isSteel: boolean = false) {
    const count = isSteel ? 16 : isFlesh ? 6 : 10;
    let spawned = 0;

    for (let i = 0; i < this.sparkPool.length && spawned < count; i++) {
      const s = this.sparkPool[i];
      if (s.active) continue;

      s.active = true;
      s.life = 0.2 + Math.random() * 0.25;
      s.maxLife = s.life;

      // Position right at impact point
      s.position.copy(point).addScaledVector(normal, 0.04);

      // Random cone velocity
      const randX = (Math.random() - 0.5) * 1.6;
      const randY = (Math.random() - 0.5) * 1.6;
      const randZ = (Math.random() - 0.5) * 1.6;

      s.velocity.set(normal.x + randX, normal.y + randY, normal.z + randZ).normalize();
      s.velocity.multiplyScalar(3 + Math.random() * 7);

      if (isFlesh) {
        s.color.setHex(0xcc2222);
      } else if (isSteel) {
        s.color.setHex(0xfff0b0);
      } else {
        s.color.setHex(0xff9922);
      }

      spawned++;
    }
  }

  // Pooled Casing Ejection (Zero GC)
  public ejectCasing(pos: THREE.Vector3, gunForward: THREE.Vector3, gunRight: THREE.Vector3, gunUp: THREE.Vector3) {
    let casing: PooledCasing | null = null;
    for (let i = 0; i < this.casingPool.length; i++) {
      if (!this.casingPool[i].active) {
        casing = this.casingPool[i];
        break;
      }
    }
    if (!casing) {
      casing = this.casingPool[0]; // Recycle oldest
    }

    casing.active = true;
    casing.mesh.position.copy(pos);
    casing.mesh.visible = true;
    casing.bounces = 0;
    casing.life = 0;

    // Impulse
    casing.velocity
      .copy(gunRight).multiplyScalar(2.0 + Math.random() * 0.6)
      .addScaledVector(gunUp, 1.1 + Math.random() * 0.5)
      .addScaledVector(gunForward, -0.3 + Math.random() * 0.2);

    casing.rotVelocity.set(
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 30
    );
  }

  // Pooled Floating Text (Zero GC, reutilizing CanvasTextures)
  public spawnFloatingText(text: string, pos: THREE.Vector3, color: string = '#f59e0b') {
    let ft: PooledFloatingText | null = null;
    for (let i = 0; i < this.floatingTextPool.length; i++) {
      if (!this.floatingTextPool[i].active) {
        ft = this.floatingTextPool[i];
        break;
      }
    }
    if (!ft) {
      ft = this.floatingTextPool[0];
    }

    ft.active = true;
    ft.life = 0;
    ft.maxLife = 0.95;
    ft.sprite.position.copy(pos).add(new THREE.Vector3(0, 0.4, 0));
    ft.sprite.visible = true;
    ft.material.opacity = 1.0;

    // Draw on cached canvas
    const ctx = ft.ctx;
    ctx.clearRect(0, 0, ft.canvas.width, ft.canvas.height);
    ctx.font = 'bold 30px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, ft.canvas.width / 2, ft.canvas.height / 2);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.strokeText(text, ft.canvas.width / 2, ft.canvas.height / 2);

    ft.texture.needsUpdate = true;
  }

  // Frame update with Object Pool recycling & Frustum Culling support
  public update(dt: number, frustum?: THREE.Frustum) {
    // 1. Update Pooled Tracers
    for (let i = 0; i < this.tracerPool.length; i++) {
      const t = this.tracerPool[i];
      if (!t.active) continue;

      t.progress += (t.speed * dt) / t.distance;
      if (t.progress >= 1.0) {
        t.active = false;
        t.mesh.visible = false;
        continue;
      }

      // Frustum culling for tracers
      if (frustum && !frustum.containsPoint(t.start) && !frustum.containsPoint(t.end)) {
        t.mesh.visible = false;
        continue;
      }
      t.mesh.visible = true;

      const headProgress = Math.min(1.0, t.progress);
      const tailProgress = Math.max(0.0, t.progress - 0.22);

      const p = t.positionAttr.array as Float32Array;
      // Tail
      p[0] = t.start.x + (t.end.x - t.start.x) * tailProgress;
      p[1] = t.start.y + (t.end.y - t.start.y) * tailProgress;
      p[2] = t.start.z + (t.end.z - t.start.z) * tailProgress;
      // Head
      p[3] = t.start.x + (t.end.x - t.start.x) * headProgress;
      p[4] = t.start.y + (t.end.y - t.start.y) * headProgress;
      p[5] = t.start.z + (t.end.z - t.start.z) * headProgress;

      t.positionAttr.needsUpdate = true;
    }

    // 2. Update Pooled Sparks
    let activeSparkCount = 0;
    for (let i = 0; i < this.sparkPool.length; i++) {
      const s = this.sparkPool[i];
      if (!s.active) continue;

      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        continue;
      }

      s.velocity.y -= 9.8 * dt;
      s.velocity.multiplyScalar(0.95);
      s.position.addScaledVector(s.velocity, dt);

      // Frustum culling check
      if (frustum && !frustum.containsPoint(s.position)) {
        continue;
      }

      const idx = activeSparkCount * 3;
      this.sparkPositions[idx] = s.position.x;
      this.sparkPositions[idx + 1] = s.position.y;
      this.sparkPositions[idx + 2] = s.position.z;

      const alpha = Math.max(0, s.life / s.maxLife);
      this.sparkColors[idx] = s.color.r * alpha;
      this.sparkColors[idx + 1] = s.color.g * alpha;
      this.sparkColors[idx + 2] = s.color.b * alpha;

      activeSparkCount++;
    }

    // Hide inactive spark slots offscreen
    for (let i = activeSparkCount; i < this.MAX_SPARKS; i++) {
      const idx = i * 3;
      this.sparkPositions[idx + 1] = -9999;
    }

    if (this.sparkGeo) {
      this.sparkGeo.attributes.position.needsUpdate = true;
      this.sparkGeo.attributes.color.needsUpdate = true;
    }

    // 3. Update Pooled Casings
    for (let i = 0; i < this.casingPool.length; i++) {
      const c = this.casingPool[i];
      if (!c.active) continue;

      c.life += dt;
      // After 3.5s or 3 bounces, deactivate to pool
      if (c.life > 3.5 || c.bounces >= 3) {
        c.active = false;
        c.mesh.visible = false;
        continue;
      }

      c.velocity.y -= 9.8 * dt;
      c.mesh.position.addScaledVector(c.velocity, dt);
      c.mesh.rotation.x += c.rotVelocity.x * dt;
      c.mesh.rotation.y += c.rotVelocity.y * dt;
      c.mesh.rotation.z += c.rotVelocity.z * dt;

      // Floor bounce at y = 0.03
      if (c.mesh.position.y < 0.03) {
        c.mesh.position.y = 0.03;
        c.velocity.y = -c.velocity.y * 0.4;
        c.velocity.x *= 0.55;
        c.velocity.z *= 0.55;
        c.rotVelocity.multiplyScalar(0.4);
        c.bounces++;
      }

      // Frustum culling
      if (frustum) {
        c.mesh.visible = frustum.containsPoint(c.mesh.position);
      }
    }

    // 4. Update Pooled Floating Texts
    for (let i = 0; i < this.floatingTextPool.length; i++) {
      const ft = this.floatingTextPool[i];
      if (!ft.active) continue;

      ft.life += dt;
      const progress = ft.life / ft.maxLife;

      if (progress >= 1.0) {
        ft.active = false;
        ft.sprite.visible = false;
        continue;
      }

      ft.sprite.position.addScaledVector(ft.velocity, dt);
      ft.material.opacity = Math.max(0, 1.0 - progress);

      // Frustum culling
      if (frustum) {
        ft.sprite.visible = frustum.containsPoint(ft.sprite.position);
      }
    }
  }

  public dispose() {
    this.tracerPool.forEach((t) => {
      this.scene.remove(t.mesh);
      t.geometry.dispose();
    });
    this.casingPool.forEach((c) => this.scene.remove(c.mesh));
    this.floatingTextPool.forEach((ft) => {
      this.scene.remove(ft.sprite);
      ft.texture.dispose();
      ft.material.dispose();
    });
    if (this.sparkPoints) {
      this.scene.remove(this.sparkPoints);
      this.sparkGeo?.dispose();
    }
    this.tracerMaterial.dispose();
    this.casingGeo.dispose();
    this.casingMat.dispose();
  }
}
