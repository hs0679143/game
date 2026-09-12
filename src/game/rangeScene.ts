import * as THREE from 'three';

export class RangeScene {
  public scene: THREE.Scene;
  public wallMeshes: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.buildEnvironment();
  }

  private buildEnvironment() {
    // 1. Fog & Background
    this.scene.background = new THREE.Color(0x0a0f18);
    this.scene.fog = new THREE.FogExp2(0x0a0f18, 0.008);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.2);
    dirLight.position.set(20, 35, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 120;
    dirLight.shadow.camera.left = -30;
    dirLight.shadow.camera.right = 30;
    dirLight.shadow.camera.top = 30;
    dirLight.shadow.camera.bottom = -30;
    this.scene.add(dirLight);

    // Booth overhead lamp
    const boothLight = new THREE.PointLight(0xffeedd, 1.8, 12);
    boothLight.position.set(0, 3.8, 0);
    this.scene.add(boothLight);

    // 3. Ground / Floor
    // Shooting booth concrete floor
    const boothFloorGeo = new THREE.PlaneGeometry(16, 12);
    boothFloorGeo.rotateX(-Math.PI / 2);
    const boothFloorMat = new THREE.MeshStandardMaterial({
      color: 0x1e2229,
      roughness: 0.8,
      metalness: 0.1,
    });
    const boothFloor = new THREE.Mesh(boothFloorGeo, boothFloorMat);
    boothFloor.position.set(0, 0, 2);
    boothFloor.receiveShadow = true;
    this.scene.add(boothFloor);

    // Firing Range Floor (Gravel & Earth extending 120m down range)
    const rangeFloorGeo = new THREE.PlaneGeometry(24, 110);
    rangeFloorGeo.rotateX(-Math.PI / 2);
    const rangeFloorMat = new THREE.MeshStandardMaterial({
      color: 0x141820,
      roughness: 0.95,
      metalness: 0.05,
    });
    const rangeFloor = new THREE.Mesh(rangeFloorGeo, rangeFloorMat);
    rangeFloor.position.set(0, 0, -55);
    rangeFloor.receiveShadow = true;
    this.scene.add(rangeFloor);

    // Distance Markings on floor (10m, 20m, 30m, 40m, 50m, 60m, 75m)
    const distances = [10, 20, 30, 40, 50, 60, 75];
    distances.forEach((dist) => {
      // Yellow / white marker stripe
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(18, 0.25),
        new THREE.MeshBasicMaterial({ color: 0xeab308 })
      );
      stripe.rotateX(-Math.PI / 2);
      stripe.position.set(0, 0.015, -dist);
      this.scene.add(stripe);

      // Distance sign on the side wall
      const signCanvas = document.createElement('canvas');
      signCanvas.width = 128;
      signCanvas.height = 64;
      const sctx = signCanvas.getContext('2d');
      if (sctx) {
        sctx.fillStyle = '#0f172a';
        sctx.fillRect(0, 0, 128, 64);
        sctx.fillStyle = '#eab308';
        sctx.font = 'bold 36px "Chakra Petch", sans-serif';
        sctx.textAlign = 'center';
        sctx.textBaseline = 'middle';
        sctx.fillText(`${dist}m`, 64, 32);
      }
      const signTex = new THREE.CanvasTexture(signCanvas);
      const signMeshL = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 0.8),
        new THREE.MeshBasicMaterial({ map: signTex })
      );
      signMeshL.position.set(-9.9, 1.8, -dist);
      signMeshL.rotation.y = Math.PI / 2;
      this.scene.add(signMeshL);

      const signMeshR = signMeshL.clone();
      signMeshR.position.set(9.9, 1.8, -dist);
      signMeshR.rotation.y = -Math.PI / 2;
      this.scene.add(signMeshR);
    });

    // 4. Side Walls & Baffles
    const wallGeo = new THREE.BoxGeometry(0.5, 8, 120);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x1f242e,
      roughness: 0.85,
      metalness: 0.2,
    });

    const leftWall = new THREE.Mesh(wallGeo, wallMat);
    leftWall.position.set(-10, 4, -50);
    leftWall.receiveShadow = true;
    this.scene.add(leftWall);
    this.wallMeshes.push(leftWall);

    const rightWall = new THREE.Mesh(wallGeo, wallMat);
    rightWall.position.set(10, 4, -50);
    rightWall.receiveShadow = true;
    this.scene.add(rightWall);
    this.wallMeshes.push(rightWall);

    // Backstop Berm (Rubber/Sand impact wall at 110m)
    const backstopGeo = new THREE.BoxGeometry(22, 10, 2);
    const backstopMat = new THREE.MeshStandardMaterial({
      color: 0x11141a,
      roughness: 0.95,
    });
    const backstop = new THREE.Mesh(backstopGeo, backstopMat);
    backstop.position.set(0, 5, -110);
    backstop.receiveShadow = true;
    this.scene.add(backstop);
    this.wallMeshes.push(backstop);

    // Overhead Acoustic Baffles (steel deflectors every 15 meters)
    for (let z = -15; z >= -95; z -= 15) {
      const baffle = new THREE.Mesh(
        new THREE.BoxGeometry(20, 1.4, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x272c36, metalness: 0.5, roughness: 0.5 })
      );
      baffle.position.set(0, 6.8, z);
      this.scene.add(baffle);

      // Hanging range lamp
      const lamp = new THREE.PointLight(0xfff5e0, 0.8, 18);
      lamp.position.set(0, 5.8, z);
      this.scene.add(lamp);
    }

    // 5. Firing Booth Construction
    this.buildFiringBooth();
  }

  private buildFiringBooth() {
    // Booth Bench / Counter Table (Placed on the left lane so center & right lanes have open walk path to range!)
    const benchTop = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.1, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x3b2d1d, roughness: 0.7 }) // dark tactical wood
    );
    benchTop.position.set(-2.0, 0.95, 0.5);
    benchTop.receiveShadow = true;
    benchTop.castShadow = true;
    this.scene.add(benchTop);

    // Metal legs
    const legGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.95, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
    const legPositions = [
      [-3.0, 0.475, 0.2],
      [-1.0, 0.475, 0.2],
      [-3.0, 0.475, 0.8],
      [-1.0, 0.475, 0.8],
    ];
    legPositions.forEach(([x, y, z]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(x, y, z);
      leg.castShadow = true;
      this.scene.add(leg);
    });

    // Firing Booth Partition Walls (Lanes) - spaced widely to allow free movement
    const partitionGeo = new THREE.BoxGeometry(0.12, 2.5, 2.4);
    const partitionMat = new THREE.MeshStandardMaterial({ color: 0x1e2430, roughness: 0.7 });

    const partL = new THREE.Mesh(partitionGeo, partitionMat);
    partL.position.set(-3.6, 1.25, 1.0);
    partL.castShadow = true;
    this.scene.add(partL);

    const partR = new THREE.Mesh(partitionGeo, partitionMat);
    partR.position.set(3.6, 1.25, 1.0);
    partR.castShadow = true;
    this.scene.add(partR);

    // Safety ballistic glass panel in partition
    const glassGeo = new THREE.BoxGeometry(0.04, 1.1, 1.5);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xa5b4fc,
      transparent: true,
      opacity: 0.25,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.9,
    });
    const glassL = new THREE.Mesh(glassGeo, glassMat);
    glassL.position.set(-3.6, 1.6, 0.8);
    this.scene.add(glassL);

    const glassR = new THREE.Mesh(glassGeo, glassMat);
    glassR.position.set(3.6, 1.6, 0.8);
    this.scene.add(glassR);

    // Ammo boxes on table
    this.createAmmoBox(-2.4, 1.05, 0.4);
    this.createAmmoBox(-1.6, 1.05, 0.55);

    // Shooting mat
    const matMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 })
    );
    matMesh.rotateX(-Math.PI / 2);
    matMesh.position.set(0, 0.01, 1.0);
    this.scene.add(matMesh);

    // Range roof over booth
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(16, 0.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x181e26, roughness: 0.8 })
    );
    roof.position.set(0, 3.8, 1);
    this.scene.add(roof);
  }

  private createAmmoBox(x: number, y: number, z: number) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.14, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x164e3b, roughness: 0.6, metalness: 0.4 }) // military olive drab
    );
    box.position.set(x, y, z);
    box.castShadow = true;
    this.scene.add(box);

    // Stencil text on ammo can
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#164e3b';
      ctx.fillRect(0, 0, 128, 64);
      ctx.fillStyle = '#eab308';
      ctx.font = 'bold 20px "Chakra Petch", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('5.56x45mm', 64, 25);
      ctx.fillText('M855 BALL', 64, 45);
    }
    const tex = new THREE.CanvasTexture(canvas);
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.1),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    decal.position.set(x, y, z + 0.176);
    this.scene.add(decal);
  }
}
