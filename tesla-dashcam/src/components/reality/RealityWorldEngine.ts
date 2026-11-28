import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import {
  AtmospherePreset,
  CameraPreset,
  DriveTelemetry,
  FsdProfile,
  GamepadAction,
  PaintColor,
  TESLA_PAINTS,
  TurnDirection,
} from '../../types/realityView';
import { InputController } from '../../utils/gamepadController';
import {
  createAsphaltTextures,
  createBuildingFacadeTextures,
  createGlowSpriteTexture,
  createProceduralEnvMap,
  createSidewalkTexture,
} from './proceduralTextures';
import {
  createEgoTeslaCar,
  createPedestrian,
  createTrafficCar,
  EgoTeslaCarHandle,
  TrafficCarHandle,
  TrafficStyle,
} from './TeslaCarMesh';

const ROAD_COORDS = [-176, -88, 0, 88, 176];
const BLOCK_HALF = 37; // 88 - 14 = 74 -> half = 37m
const ROAD_WIDTH = 14;
const LANE_OFFSET = 3.5;
const WORLD_LIMIT = 212;

const STREET_NAMES_Z = ['世纪大道', 'Grant Ave', '南京西路', 'Market St', '延安西路'];
const STREET_NAMES_X = ['陆家嘴环路', 'Wellington St', '淮海中路', 'Howard St', '滨江大道'];

interface BuildingCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface TrafficAgent {
  handle: TrafficCarHandle;
  axis: 'x' | 'z';
  dir: 1 | -1;
  roadCoord: number;
  pos: number;
  speed: number;
  targetSpeed: number;
}

interface PedestrianAgent {
  mesh: THREE.Group;
  axis: 'x' | 'z';
  dir: 1 | -1;
  fixedCoord: number;
  pos: number;
  speed: number;
  phase: number;
}

interface TrafficLightCluster {
  x: number;
  z: number;
  zBulbs: THREE.MeshStandardMaterial[];
  xBulbs: THREE.MeshStandardMaterial[];
}

export interface EngineCallbacks {
  onTelemetry: (telemetry: DriveTelemetry) => void;
  onAction: (action: GamepadAction) => void;
  onGamepadChange: (connected: boolean, name: string) => void;
  onToast: (msg: string) => void;
}

export class RealityWorldEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private input: InputController;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private envMap: THREE.Texture | null = null;

  // Dynamic lights & atmosphere materials
  private hemiLight!: THREE.HemisphereLight;
  private sunLight!: THREE.DirectionalLight;
  private roadMat!: THREE.MeshStandardMaterial;
  private buildingMaterials: THREE.MeshStandardMaterial[] = [];
  private lampHalos: THREE.Sprite[] = [];
  private lampLights: THREE.PointLight[] = [];

  // Ego vehicle & physics state
  private egoCar!: EgoTeslaCarHandle;
  private egoX = -LANE_OFFSET;
  private egoZ = -88;
  private egoHeading = 0; // 0 = +Z
  private egoSpeed = 11.2; // m/s (~40 km/h)
  private egoSteerAngle = 0;
  private egoWheelSpin = 0;
  private egoPitch = 0;
  private egoRoll = 0;
  private gear: 'P' | 'R' | 'N' | 'D' = 'D';
  private braking = false;
  private powerNormalized = 0.25;
  private turnSignal: 'off' | 'left' | 'right' = 'off';
  private fsdActive = true;
  private fsdProfile: FsdProfile = 'Standard';
  private streakKm = 1.8;

  // FSD Navigation & Waypoint state
  private fsdPlan: {
    axis: 'x' | 'z';
    dir: 1 | -1;
    roadCoord: number;
    nextIntersection: number;
    nextTurn: TurnDirection;
  } = {
    axis: 'z',
    dir: 1,
    roadCoord: 0,
    nextIntersection: 0,
    nextTurn: 'right',
  };
  private customWaypoint: THREE.Vector3 | null = null;
  private waypointPin!: THREE.Group;

  // World collections
  private colliders: BuildingCollider[] = [];
  private traffic: TrafficAgent[] = [];
  private pedestrians: PedestrianAgent[] = [];
  private trafficLights: TrafficLightCluster[] = [];

  // FSD In-World AR Ribbon & Sky Chevrons
  private pathRibbonMesh!: THREE.Mesh;
  private pathRibbonMat!: THREE.MeshBasicMaterial;
  private skyChevrons: THREE.Group[] = [];

  // Camera & Orbit state
  private cameraPreset: CameraPreset = 'v15_chase';
  private atmosphere: AtmospherePreset = 'night_rain';
  private orbitYaw = 0;
  private orbitPitch = 0;
  private orbitZoom = 1;
  private lastOrbitInteractAt = 0;
  private isPointerDragging = false;
  private pointerDownPos = { x: 0, y: 0 };
  private pointerMoved = false;
  private camPosCurrent = new THREE.Vector3(0, 6, -98);
  private camLookCurrent = new THREE.Vector3(0, 1, -70);

  // Lifecycle
  private rafId: number | null = null;
  private lastFrameMs = 0;
  private paused = false;
  private lastTelemetryEmitMs = 0;
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.input = new InputController((connected, name) => {
      callbacks.onGamepadChange(connected, name);
      if (connected) {
        callbacks.onToast(`🎮 手柄已连接：${name.slice(0, 26)}`);
      }
    });

    const w = Math.max(320, container.clientWidth);
    const h = Math.max(240, container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, w / h, 0.3, 420);

    try {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.45, 0.42, 0.82);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
    } catch {
      this.composer = null;
    }

    this.buildLights();
    this.buildCityWorld();
    this.buildEgoAndAR();
    this.spawnTrafficAndPedestrians();
    this.applyAtmosphere('night_rain');

    // Bind pointer / resize listeners
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('resize', this.onResize);

    this.lastFrameMs = performance.now();
    this.loop(this.lastFrameMs);
  }

  private buildLights(): void {
    this.hemiLight = new THREE.HemisphereLight(0x8cb4ff, 0x1e2230, 0.65);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff0dd, 1.4);
    this.sunLight.position.set(55, 85, 45);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 220;
    const d = 65;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
  }

  private buildCityWorld(): void {
    // 1. Base textured Asphalt ground (520x520m)
    const { map, roughnessMap, bumpMap } = createAsphaltTextures(true);
    this.roadMat = new THREE.MeshStandardMaterial({
      map,
      roughnessMap,
      bumpMap,
      bumpScale: 0.035,
      metalness: 0.14,
      roughness: 0.65,
      envMapIntensity: 1.35,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), this.roadMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 2. Road Markings (Double-yellow centerlines + dashed white lanes + zebra crosswalks)
    const yellowMat = new THREE.MeshBasicMaterial({ color: 0xeab308 });
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });

    const betweenSegments = [-206, -132, -44, 44, 132, 206];
    const segLengths = [42, 72, 72, 72, 72, 42];

    for (const r of ROAD_COORDS) {
      betweenSegments.forEach((center, idx) => {
        const len = segLengths[idx];
        // Z-axis roads (at x = r)
        for (const offset of [-0.22, 0.22]) {
          const lineZ = new THREE.Mesh(new THREE.PlaneGeometry(0.14, len), yellowMat);
          lineZ.rotation.x = -Math.PI / 2;
          lineZ.position.set(r + offset, 0.015, center);
          this.scene.add(lineZ);

          const lineX = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.14), yellowMat);
          lineX.rotation.x = -Math.PI / 2;
          lineX.position.set(center, 0.015, r + offset);
          this.scene.add(lineX);
        }

        // Dashed white lane lines (at ±3.5m? No, lane centers are ±3.5, divider is ±0 and ±7, so ±3.5 is middle of direction -> actually 2 lanes per side? Let's place dashed white at ±0? Wait: double yellow is center; dashed white isn't needed if 1 lane/dir, or we have 14m road = 7m per side -> dashed divider at ±3.5m? Actually 3.5m is clean single wide lane or curb stripe! Let's put crisp white edge lines at ±6.6m and dashed arrows!)
        for (const side of [-1, 1]) {
          const edgeZ = new THREE.Mesh(new THREE.PlaneGeometry(0.12, len), whiteMat);
          edgeZ.rotation.x = -Math.PI / 2;
          edgeZ.position.set(r + side * 6.5, 0.015, center);
          this.scene.add(edgeZ);

          const edgeX = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.12), whiteMat);
          edgeX.rotation.x = -Math.PI / 2;
          edgeX.position.set(center, 0.015, r + side * 6.5);
          this.scene.add(edgeX);
        }
      });
    }

    // Zebra Crosswalks at every intersection
    for (const ix of ROAD_COORDS) {
      for (const iz of ROAD_COORDS) {
        for (const side of [-1, 1]) {
          for (let s = -5; s <= 5; s++) {
            const stripeZ = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 2.8), whiteMat);
            stripeZ.rotation.x = -Math.PI / 2;
            stripeZ.position.set(ix + s * 1.15, 0.016, iz + side * 8.4);
            this.scene.add(stripeZ);

            const stripeX = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.55), whiteMat);
            stripeX.rotation.x = -Math.PI / 2;
            stripeX.position.set(ix + side * 8.4, 0.016, iz + s * 1.15);
            this.scene.add(stripeX);
          }
        }
      }
    }

    // 3. City Blocks (Sidewalk slabs + multi-story textured buildings + neon signs + trees + V15 parking chevrons)
    const sidewalkTex = createSidewalkTexture();
    sidewalkTex.repeat.set(10, 10);
    const sidewalkMat = new THREE.MeshStandardMaterial({
      map: sidewalkTex,
      roughness: 0.85,
      metalness: 0.05,
    });

    const facadeStyles = [0, 1, 2, 3].map((idx) => {
      const { map: fMap, emissiveMap } = createBuildingFacadeTextures(idx, true);
      const mat = new THREE.MeshStandardMaterial({
        map: fMap,
        emissiveMap,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.9,
        roughness: 0.55,
        metalness: 0.2,
      });
      this.buildingMaterials.push(mat);
      return mat;
    });

    const roofMat = new THREE.MeshStandardMaterial({ color: 0x1e222b, roughness: 0.85 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3b2f26, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x1d472a, roughness: 0.85 });
    const chevronMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    });

    const blockCenters = [-132, -44, 44, 132];
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1a1e26, metalness: 0.7, roughness: 0.4 });
    const bulbGlowTex = createGlowSpriteTexture('rgba(255, 224, 165, 1)');

    blockCenters.forEach((bx, bi) => {
      blockCenters.forEach((bz, bj) => {
        // Raised concrete sidewalk pad
        const pad = new THREE.Mesh(new THREE.BoxGeometry(BLOCK_HALF * 2, 0.24, BLOCK_HALF * 2), sidewalkMat);
        pad.position.set(bx, 0.12, bz);
        pad.receiveShadow = true;
        this.scene.add(pad);

        // 4 buildings per block quadrant
        const quadOffsets = [
          [-14, -14],
          [14, -14],
          [-14, 14],
          [14, 14],
        ];
        quadOffsets.forEach(([ox, oz], qi) => {
          const seed = (bi * 17 + bj * 31 + qi * 13) % 100;
          const bw = 20 + (seed % 7);
          const bd = 20 + ((seed * 3) % 7);
          const bh = 16 + ((seed * 7) % 34);
          const mat = facadeStyles[(bi + bj + qi) % facadeStyles.length];
          const bMesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), [
            mat,
            mat,
            roofMat,
            roofMat,
            mat,
            mat,
          ]);
          bMesh.position.set(bx + ox, 0.24 + bh / 2, bz + oz);
          bMesh.castShadow = true;
          bMesh.receiveShadow = true;
          this.scene.add(bMesh);

          this.colliders.push({
            minX: bx + ox - bw / 2 - 1.2,
            maxX: bx + ox + bw / 2 + 1.2,
            minZ: bz + oz - bd / 2 - 1.2,
            maxZ: bz + oz + bd / 2 + 1.2,
          });

          // Vertical glowing neon sign blade on select buildings
          if (qi % 2 === 0) {
            const neonColors = [0x38bdf8, 0xf43f5e, 0xfbbf24, 0x22d3ee];
            const nc = neonColors[(bi + bj + qi) % neonColors.length];
            const signMat = new THREE.MeshStandardMaterial({
              color: nc,
              emissive: nc,
              emissiveIntensity: 2.6,
            });
            const sign = new THREE.Mesh(new THREE.BoxGeometry(0.45, 5.2, 1.3), signMat);
            const sideSign = ox < 0 ? -1 : 1;
            sign.position.set(bx + ox + sideSign * (bw / 2 + 0.45), 6.2, bz + oz);
            this.scene.add(sign);
          }
        });

        // Curbside trees & streetlamps around the perimeter of the block
        for (const [tx, tz] of [
          [bx - 33.5, bz - 16],
          [bx - 33.5, bz + 16],
          [bx + 33.5, bz - 16],
          [bx + 33.5, bz + 16],
          [bx - 16, bz - 33.5],
          [bx + 16, bz + 33.5],
        ]) {
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 2.2, 8), trunkMat);
          trunk.position.set(tx, 1.34, tz);
          trunk.castShadow = true;
          this.scene.add(trunk);

          const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(1.65, 1), leafMat);
          crown.position.set(tx, 3.2, tz);
          crown.castShadow = true;
          this.scene.add(crown);
        }

        // Streetlamps on 2 corners of each block
        for (const [lx, lz] of [
          [bx - 34.5, bz - 34.5],
          [bx + 34.5, bz + 34.5],
        ]) {
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 6.2, 8), poleMat);
          pole.position.set(lx, 3.3, lz);
          this.scene.add(pole);

          const sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: bulbGlowTex,
              transparent: true,
              opacity: 0.78,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            })
          );
          sprite.position.set(lx, 6.3, lz);
          sprite.scale.set(5.5, 5.5, 1);
          this.scene.add(sprite);
          this.lampHalos.push(sprite);
        }

        // Authentic Tesla V15 white floating 'V' parking stall chevrons along central block curb
        if (Math.abs(bx) === 44 && Math.abs(bz) === 44) {
          for (let p = -12; p <= 12; p += 6) {
            const chev = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.65, 3), chevronMat);
            chev.rotation.x = -Math.PI / 2;
            chev.position.set(bx - 38.6, 0.08, bz + p);
            this.scene.add(chev);
          }
        }
      });
    });

    // 4. Working 4-Way Traffic Light Gantries at central 3x3 intersections
    for (const ix of [-88, 0, 88]) {
      for (const iz of [-88, 0, 88]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 5.6, 8), poleMat);
        post.position.set(ix - 8.2, 2.8, iz - 8.2);
        this.scene.add(post);

        const arm = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.14, 0.14), poleMat);
        arm.position.set(ix - 4.6, 5.4, iz - 8.2);
        this.scene.add(arm);

        const zMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 3.2 });
        const xMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 3.2 });

        const boxZ = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.35), poleMat);
        boxZ.position.set(ix - 2.6, 5.2, iz - 8.2);
        this.scene.add(boxZ);

        const bulbZ = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), zMat);
        bulbZ.position.set(ix - 2.6, 5.1, iz - 8.0);
        this.scene.add(bulbZ);

        const bulbX = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), xMat);
        bulbX.position.set(ix - 8.0, 5.1, iz - 2.6);
        this.scene.add(bulbX);

        this.trafficLights.push({ x: ix, z: iz, zBulbs: [zMat], xBulbs: [xMat] });
      }
    }

    // 5. Real point lights near the center corridor for glossy wet pavement specular pools
    for (const pz of [-88, 0, 88]) {
      const pl = new THREE.PointLight(0xffd79b, 28, 42, 1.6);
      pl.position.set(0, 6.2, pz);
      this.scene.add(pl);
      this.lampLights.push(pl);
    }
  }

  private buildEgoAndAR(): void {
    this.egoCar = createEgoTeslaCar(TESLA_PAINTS[0].hex);
    this.egoCar.group.position.set(this.egoX, 0, this.egoZ);
    this.scene.add(this.egoCar.group);

    // 1. Glowing Electric-Blue FSD V15 Planned Path Ribbon
    const ribbonGeo = new THREE.BufferGeometry();
    const segCount = 32;
    const positions = new Float32Array((segCount + 1) * 2 * 3);
    const uvs = new Float32Array((segCount + 1) * 2 * 2);
    const indices: number[] = [];
    for (let i = 0; i <= segCount; i++) {
      const t = i / segCount;
      uvs[i * 4 + 0] = 0;
      uvs[i * 4 + 1] = t;
      uvs[i * 4 + 2] = 1;
      uvs[i * 4 + 3] = t;
      if (i < segCount) {
        const b = i * 2;
        indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
    ribbonGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    ribbonGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    ribbonGeo.setIndex(indices);

    // Custom soft-edge blue gradient canvas texture for authentic FSD ribbon glow
    const rc = document.createElement('canvas');
    rc.width = 128;
    rc.height = 256;
    const rCtx = rc.getContext('2d')!;
    const hGrad = rCtx.createLinearGradient(0, 0, 128, 0);
    hGrad.addColorStop(0, 'rgba(37, 130, 255, 0)');
    hGrad.addColorStop(0.18, 'rgba(37, 130, 255, 0.85)');
    hGrad.addColorStop(0.5, 'rgba(96, 185, 255, 0.98)');
    hGrad.addColorStop(0.82, 'rgba(37, 130, 255, 0.85)');
    hGrad.addColorStop(1, 'rgba(37, 130, 255, 0)');
    rCtx.fillStyle = hGrad;
    rCtx.fillRect(0, 0, 128, 256);

    // Fade out at far end (top of texture v=1)
    rCtx.globalCompositeOperation = 'destination-in';
    const vGrad = rCtx.createLinearGradient(0, 0, 0, 256);
    vGrad.addColorStop(0, 'rgba(255,255,255,0)');
    vGrad.addColorStop(0.28, 'rgba(255,255,255,0.85)');
    vGrad.addColorStop(1, 'rgba(255,255,255,0.95)');
    rCtx.fillStyle = vGrad;
    rCtx.fillRect(0, 0, 128, 256);

    const ribbonTex = new THREE.CanvasTexture(rc);
    ribbonTex.colorSpace = THREE.SRGBColorSpace;

    this.pathRibbonMat = new THREE.MeshBasicMaterial({
      map: ribbonTex,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.pathRibbonMesh = new THREE.Mesh(ribbonGeo, this.pathRibbonMat);
    this.pathRibbonMesh.frustumCulled = false;
    this.scene.add(this.pathRibbonMesh);

    // 2. Floating 3D AR Navigation Turn Chevrons (`> > >`)
    const chevMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < 6; i++) {
      const grp = new THREE.Group();
      const leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.18, 0.12), chevMat);
      leftWing.position.set(-0.34, 0.3, 0);
      leftWing.rotation.z = 0.58;
      const rightWing = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.18, 0.12), chevMat);
      rightWing.position.set(0.34, 0.3, 0);
      rightWing.rotation.z = -0.58;
      grp.add(leftWing, rightWing);
      grp.visible = false;
      this.scene.add(grp);
      this.skyChevrons.push(grp);
    }

    // 3. Tap-to-Navigate Glowing Destination Pin
    this.waypointPin = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.45, 32),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 9, 16),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 })
    );
    beam.position.y = 4.5;
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 3.5 })
    );
    orb.position.y = 2.1;
    this.waypointPin.add(ring, beam, orb);
    this.waypointPin.visible = false;
    this.scene.add(this.waypointPin);
  }

  private spawnTrafficAndPedestrians(): void {
    const carColors = [0xe2e8f0, 0x1e293b, 0x475569, 0x991b1b, 0x1d4ed8, 0x0f172a, 0xd4d4d8];
    const styles: TrafficStyle[] = ['sedan', 'suv', 'sedan', 'van', 'suv'];

    for (let i = 0; i < 28; i++) {
      const axis: 'x' | 'z' = i % 2 === 0 ? 'z' : 'x';
      const dir: 1 | -1 = i % 4 < 2 ? 1 : -1;
      const roadCoord = ROAD_COORDS[i % ROAD_COORDS.length];
      const pos = -170 + ((i * 37) % 340);
      // Avoid spawning right on top of ego start (0, -88)
      if (axis === 'z' && roadCoord === 0 && Math.abs(pos - this.egoZ) < 18) continue;

      const handle = createTrafficCar(styles[i % styles.length], carColors[i % carColors.length]);
      const speed = 8 + (i % 5) * 1.4;
      this.scene.add(handle.group);
      this.traffic.push({ handle, axis, dir, roadCoord, pos, speed, targetSpeed: speed });
    }

    const shirtColors = [0x64748b, 0x334155, 0x94a3b8, 0x1e3a8a, 0x7c2d12, 0xe2e8f0];
    for (let i = 0; i < 24; i++) {
      const axis: 'x' | 'z' = i % 2 === 0 ? 'z' : 'x';
      const dir: 1 | -1 = i % 4 < 2 ? 1 : -1;
      const road = ROAD_COORDS[i % ROAD_COORDS.length];
      const fixedCoord = road + (i % 2 === 0 ? 8.6 : -8.6);
      const pos = -160 + ((i * 29) % 320);
      const mesh = createPedestrian(shirtColors[i % shirtColors.length]);
      this.scene.add(mesh);
      this.pedestrians.push({
        mesh,
        axis,
        dir,
        fixedCoord,
        pos,
        speed: 1.15 + (i % 3) * 0.25,
        phase: i * 0.9,
      });
    }
  }

  public applyAtmosphere(preset: AtmospherePreset): void {
    this.atmosphere = preset;
    if (this.envMap) {
      this.envMap.dispose();
    }
    this.envMap = createProceduralEnvMap(this.renderer, preset);
    this.scene.environment = this.envMap;

    const isNight = preset === 'night_rain';
    if (preset === 'night_rain') {
      this.scene.background = new THREE.Color(0x060a14);
      this.scene.fog = new THREE.FogExp2(0x060a14, 0.0068);
      this.hemiLight.color.setHex(0x6d93d8);
      this.hemiLight.groundColor.setHex(0x161a26);
      this.hemiLight.intensity = 0.72;
      this.sunLight.color.setHex(0xcbd5e1);
      this.sunLight.intensity = 0.85;
      this.sunLight.position.set(-40, 65, 50);
      this.roadMat.roughness = 0.42;
      this.roadMat.envMapIntensity = 1.65;
      if (this.bloomPass) this.bloomPass.strength = 0.52;
    } else if (preset === 'sunset') {
      this.scene.background = new THREE.Color(0x2a1f36);
      this.scene.fog = new THREE.FogExp2(0x4b2f3d, 0.0052);
      this.hemiLight.color.setHex(0xffb580);
      this.hemiLight.groundColor.setHex(0x28212b);
      this.hemiLight.intensity = 0.95;
      this.sunLight.color.setHex(0xff9f59);
      this.sunLight.intensity = 2.25;
      this.sunLight.position.set(110, 26, 75);
      this.roadMat.roughness = 0.62;
      this.roadMat.envMapIntensity = 1.25;
      if (this.bloomPass) this.bloomPass.strength = 0.38;
    } else {
      this.scene.background = new THREE.Color(0x8bc3f2);
      this.scene.fog = new THREE.FogExp2(0xb7daf7, 0.0042);
      this.hemiLight.color.setHex(0xdbeafe);
      this.hemiLight.groundColor.setHex(0x475569);
      this.hemiLight.intensity = 1.25;
      this.sunLight.color.setHex(0xfffbeb);
      this.sunLight.intensity = 2.4;
      this.sunLight.position.set(70, 105, 55);
      this.roadMat.roughness = 0.84;
      this.roadMat.envMapIntensity = 0.85;
      if (this.bloomPass) this.bloomPass.strength = 0.18;
    }

    for (const mat of this.buildingMaterials) {
      mat.emissiveIntensity = isNight ? 0.95 : preset === 'sunset' ? 0.55 : 0.08;
    }
    for (const sp of this.lampHalos) {
      sp.visible = isNight || preset === 'sunset';
      (sp.material as THREE.SpriteMaterial).opacity = isNight ? 0.82 : 0.35;
    }
    for (const pl of this.lampLights) {
      pl.intensity = isNight ? 28 : preset === 'sunset' ? 12 : 0;
    }
    for (const tr of this.traffic) {
      tr.handle.setHeadlights(isNight || preset === 'sunset');
    }
  }

  public setPaint(paint: PaintColor): void {
    this.egoCar.setPaint(paint.hex, paint.metalness, paint.roughness);
  }

  public setCameraPreset(preset: CameraPreset): void {
    this.cameraPreset = preset;
    this.orbitYaw = 0;
    this.orbitPitch = 0;
    this.orbitZoom = 1;
  }

  public setFsdActive(active: boolean): void {
    this.fsdActive = active;
    if (active) {
      if (this.gear === 'P' || this.gear === 'R') this.gear = 'D';
      this.snapToNearestFsdPlan();
      this.input.rumble(0.25, 90);
    }
  }

  public setFsdProfile(profile: FsdProfile): void {
    this.fsdProfile = profile;
  }

  public clearWaypoint(): void {
    this.customWaypoint = null;
    this.waypointPin.visible = false;
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    this.input.setPaused(paused);
    if (!paused) {
      this.lastFrameMs = performance.now();
    }
  }

  private snapToNearestFsdPlan(): void {
    // Pick nearest road axis aligned closely to egoHeading
    const fx = Math.sin(this.egoHeading);
    const fz = Math.cos(this.egoHeading);
    const axis: 'x' | 'z' = Math.abs(fz) >= Math.abs(fx) ? 'z' : 'x';
    const dir: 1 | -1 = axis === 'z' ? (fz >= 0 ? 1 : -1) : fx >= 0 ? 1 : -1;

    const coordVal = axis === 'z' ? this.egoX : this.egoZ;
    let bestRoad = ROAD_COORDS[0];
    let bestDist = Infinity;
    for (const r of ROAD_COORDS) {
      const dist = Math.abs(coordVal - r);
      if (dist < bestDist) {
        bestDist = dist;
        bestRoad = r;
      }
    }

    const alongVal = axis === 'z' ? this.egoZ : this.egoX;
    let nextInter = ROAD_COORDS[0];
    let minInterDist = Infinity;
    for (const r of ROAD_COORDS) {
      const d = (r - alongVal) * dir;
      if (d > 6 && d < minInterDist) {
        minInterDist = d;
        nextInter = r;
      }
    }
    if (minInterDist === Infinity) {
      nextInter = dir > 0 ? 176 : -176;
    }

    this.fsdPlan = {
      axis,
      dir,
      roadCoord: bestRoad,
      nextIntersection: nextInter,
      nextTurn: this.chooseNextTurn(axis, dir, bestRoad, nextInter),
    };
  }

  private chooseNextTurn(
    axis: 'x' | 'z',
    dir: 1 | -1,
    roadCoord: number,
    nextInter: number
  ): TurnDirection {
    // If near city perimeter, force turn inward!
    if (Math.abs(nextInter) >= 176) {
      if (axis === 'z') {
        const inwardRight = dir > 0 ? roadCoord > -176 : roadCoord < 176;
        return inwardRight ? 'right' : 'left';
      } else {
        const inwardRight = dir > 0 ? roadCoord < 176 : roadCoord > -176;
        return inwardRight ? 'right' : 'left';
      }
    }

    // If user tapped a 3D destination waypoint, bias turn toward it!
    if (this.customWaypoint) {
      const ix = axis === 'z' ? roadCoord : nextInter;
      const iz = axis === 'z' ? nextInter : roadCoord;
      const dx = this.customWaypoint.x - ix;
      const dz = this.customWaypoint.z - iz;
      if (Math.hypot(dx, dz) < 16) return 'arrive';
      if (axis === 'z') {
        if (Math.abs(dx) > 20) {
          return dx * dir < 0 ? 'right' : 'left';
        }
        return 'straight';
      } else {
        if (Math.abs(dz) > 20) {
          return dz * dir > 0 ? 'right' : 'left';
        }
        return 'straight';
      }
    }

    const hash = Math.abs(Math.round(roadCoord * 7 + nextInter * 13)) % 4;
    if (hash === 0) return 'right';
    if (hash === 1) return 'left';
    return 'straight';
  }

  private loop = (nowMs: number): void => {
    this.rafId = requestAnimationFrame(this.loop);

    const rawDt = (nowMs - this.lastFrameMs) / 1000;
    this.lastFrameMs = nowMs;
    const dt = Math.min(0.05, Math.max(0.001, rawDt));

    const snap = this.input.poll();
    for (const act of snap.actions) {
      if (act === 'toggle_fsd') {
        this.setFsdActive(!this.fsdActive);
        this.callbacks.onToast(this.fsdActive ? 'FSD V15 自动驾驶已接管' : '已切换为手动驾驶模式');
      } else if (act === 'toggle_park') {
        if (Math.abs(this.egoSpeed) < 0.8) {
          this.gear = this.gear === 'P' ? 'D' : 'P';
          if (this.gear === 'P') this.fsdActive = false;
          this.callbacks.onToast(this.gear === 'P' ? '已挂入 P 驻车挡' : '已挂入 D 前进挡');
        }
      } else if (act === 'signal_left') {
        this.turnSignal = this.turnSignal === 'left' ? 'off' : 'left';
      } else if (act === 'signal_right') {
        this.turnSignal = this.turnSignal === 'right' ? 'off' : 'right';
      } else {
        this.callbacks.onAction(act);
      }
    }

    if (this.paused) return;

    this.updateTrafficLights(nowMs);
    this.updateEgoPhysics(dt, snap);
    this.updateTrafficAndPedestrians(dt);
    this.updateFsdVisuals(nowMs);
    this.updateCamera(dt, snap, nowMs);

    // Keep shadow frustum centered on ego car
    this.sunLight.target.position.set(this.egoX, 0, this.egoZ);
    this.sunLight.target.updateMatrixWorld();

    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    if (nowMs - this.lastTelemetryEmitMs >= 80) {
      this.lastTelemetryEmitMs = nowMs;
      this.emitTelemetry();
    }
  };

  private updateTrafficLights(nowMs: number): void {
    const cycle = (nowMs / 1000) % 14;
    const zState = cycle < 6 ? 'green' : cycle < 7.5 ? 'yellow' : 'red';
    const xState = cycle < 7.5 ? 'red' : cycle < 13 ? 'green' : 'yellow';

    const colorFor = (s: string) => (s === 'green' ? 0x22c55e : s === 'yellow' ? 0xf59e0b : 0xef4444);
    const zCol = colorFor(zState);
    const xCol = colorFor(xState);

    for (const tl of this.trafficLights) {
      for (const m of tl.zBulbs) {
        m.color.setHex(zCol);
        m.emissive.setHex(zCol);
      }
      for (const m of tl.xBulbs) {
        m.color.setHex(xCol);
        m.emissive.setHex(xCol);
      }
    }
  }

  private updateEgoPhysics(dt: number, snap: ReturnType<InputController['poll']>): void {
    // Manual override disengages FSD immediately (authentic Tesla feel)
    const manualInput = snap.throttle > 0.1 || snap.brake > 0.15 || Math.abs(snap.steer) > 0.15;
    if (manualInput && this.fsdActive) {
      this.fsdActive = false;
      this.callbacks.onToast('检测到手动操作，FSD 已退出');
    }

    let targetSteer = 0;
    let accel = 0;
    this.braking = false;

    if (this.fsdActive) {
      this.gear = 'D';
      const fsdOut = this.computeFsdControl();
      targetSteer = fsdOut.steer;
      accel = fsdOut.accel;
      this.braking = fsdOut.braking;
    } else if (this.gear === 'P') {
      this.egoSpeed *= Math.max(0, 1 - dt * 10);
      this.braking = true;
      this.powerNormalized = 0;
      if (snap.throttle > 0.15) {
        this.gear = 'D';
      }
    } else {
      targetSteer = -snap.steer * 0.5;
      if (snap.handbrake) {
        this.braking = true;
        accel = -Math.sign(this.egoSpeed) * 18;
        if (Math.abs(this.egoSpeed) < 0.35) this.egoSpeed = 0;
      } else if (snap.throttle > 0.05) {
        this.gear = 'D';
        accel = snap.throttle * 14.5;
      } else if (snap.brake > 0.05) {
        this.braking = true;
        if (this.egoSpeed > 0.45) {
          accel = -snap.brake * 20;
        } else {
          // Hold LT/S when stopped -> smoothly shift into R reverse!
          this.gear = 'R';
          accel = -snap.brake * 8.5;
        }
      } else {
        // Regenerative braking coasting
        if (Math.abs(this.egoSpeed) > 0.15) {
          accel = -Math.sign(this.egoSpeed) * 3.8;
          this.braking = Math.abs(this.egoSpeed) > 3;
        } else {
          this.egoSpeed = 0;
        }
      }
    }

    this.egoSteerAngle += (targetSteer - this.egoSteerAngle) * Math.min(1, dt * 10);
    const maxFwd = 34; // ~122 km/h
    const maxRev = -11; // ~40 km/h
    this.egoSpeed = Math.max(maxRev, Math.min(maxFwd, this.egoSpeed + accel * dt));
    if (Math.abs(this.egoSpeed) < 0.06 && snap.throttle < 0.05 && snap.brake < 0.05 && !this.fsdActive) {
      this.egoSpeed = 0;
    }

    this.powerNormalized = Math.max(-1, Math.min(1, accel / 14));

    // Bicycle kinematics
    const wheelBase = 2.86;
    if (Math.abs(this.egoSpeed) > 0.05) {
      const yawRate = (this.egoSpeed / wheelBase) * Math.tan(this.egoSteerAngle);
      this.egoHeading += yawRate * dt;
    }

    const nextX = this.egoX + Math.sin(this.egoHeading) * this.egoSpeed * dt;
    const nextZ = this.egoZ + Math.cos(this.egoHeading) * this.egoSpeed * dt;

    // Building & boundary collision check
    let blocked = false;
    if (Math.abs(nextX) > WORLD_LIMIT || Math.abs(nextZ) > WORLD_LIMIT) {
      blocked = true;
    } else {
      for (const c of this.colliders) {
        if (nextX > c.minX && nextX < c.maxX && nextZ > c.minZ && nextZ < c.maxZ) {
          blocked = true;
          break;
        }
      }
    }

    if (blocked) {
      if (Math.abs(this.egoSpeed) > 2.5) {
        this.input.rumble(0.65, 180);
      }
      this.egoSpeed = -this.egoSpeed * 0.25;
      this.egoX = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, this.egoX));
      this.egoZ = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, this.egoZ));
    } else {
      this.egoX = nextX;
      this.egoZ = nextZ;
    }

    this.streakKm += Math.abs(this.egoSpeed * dt) / 1000;
    this.egoWheelSpin += (this.egoSpeed * dt) / 0.34;

    // Subtle chassis pitch (squat on accel, dive on brake) & body roll on cornering
    const targetPitch = -this.powerNormalized * 0.025;
    const targetRoll = -this.egoSteerAngle * Math.min(1, Math.abs(this.egoSpeed) / 14) * 0.045;
    this.egoPitch += (targetPitch - this.egoPitch) * Math.min(1, dt * 8);
    this.egoRoll += (targetRoll - this.egoRoll) * Math.min(1, dt * 8);

    this.egoCar.group.position.set(this.egoX, 0, this.egoZ);
    this.egoCar.group.rotation.y = this.egoHeading;

    const blinkOn = Math.floor(performance.now() / 360) % 2 === 0;
    const sig =
      this.fsdActive && this.fsdPlan.nextTurn !== 'straight' && this.fsdPlan.nextTurn !== 'arrive'
        ? this.getDistanceToNextIntersection() < 26
          ? (this.fsdPlan.nextTurn as 'left' | 'right')
          : 'off'
        : this.turnSignal;

    this.egoCar.updateVisuals({
      wheelSpin: this.egoWheelSpin,
      steerAngle: this.egoSteerAngle,
      braking: this.braking,
      reversing: this.gear === 'R',
      turnSignal: sig,
      headlightsOn: this.atmosphere !== 'daylight',
      pitch: this.egoPitch,
      roll: this.egoRoll,
      blinkOn,
    });
  }

  private getDistanceToNextIntersection(): number {
    const along = this.fsdPlan.axis === 'z' ? this.egoZ : this.egoX;
    return Math.max(0, (this.fsdPlan.nextIntersection - along) * this.fsdPlan.dir);
  }

  private computeFsdControl(): { steer: number; accel: number; braking: boolean } {
    const distToInter = this.getDistanceToNextIntersection();
    const { axis, dir, roadCoord, nextIntersection, nextTurn } = this.fsdPlan;

    // Right-hand lane centerline target ahead of ego car
    const rightX = axis === 'z' ? -dir * LANE_OFFSET : 0;
    const rightZ = axis === 'x' ? dir * LANE_OFFSET : 0;
    let targetX = axis === 'z' ? roadCoord + rightX : this.egoX + dir * 14;
    let targetZ = axis === 'x' ? roadCoord + rightZ : this.egoZ + dir * 14;

    if (axis === 'z') {
      targetZ = this.egoZ + dir * 12;
    } else {
      targetX = this.egoX + dir * 12;
    }

    // Begin smooth intersection turn within 14m of intersection center
    if (distToInter < 14 && (nextTurn === 'left' || nextTurn === 'right')) {
      const turnSign = nextTurn === 'left' ? 1 : -1;
      // Compute new perpendicular road after turn
      if (axis === 'z') {
        const newDir: 1 | -1 = dir * turnSign > 0 ? 1 : -1;
        targetX = roadCoord + newDir * 14;
        targetZ = nextIntersection + newDir * LANE_OFFSET;
      } else {
        const newDir: 1 | -1 = dir * turnSign < 0 ? 1 : -1;
        targetZ = roadCoord + newDir * 14;
        targetX = nextIntersection - newDir * LANE_OFFSET;
      }
    }

    // Transition FSD plan once past the intersection
    if (distToInter <= 2.5) {
      if (nextTurn === 'arrive' && this.customWaypoint) {
        this.clearWaypoint();
        this.callbacks.onToast('已抵达选定目的地');
      }
      if (nextTurn === 'left' || nextTurn === 'right') {
        const turnSign = nextTurn === 'left' ? 1 : -1;
        const newAxis: 'x' | 'z' = axis === 'z' ? 'x' : 'z';
        const newDir: 1 | -1 =
          axis === 'z' ? (dir * turnSign > 0 ? 1 : -1) : dir * turnSign < 0 ? 1 : -1;
        const newRoad = nextIntersection;
        const curPos = newAxis === 'z' ? this.egoZ : this.egoX;
        const nextInter = this.findNextRoadAhead(curPos, newDir);
        this.fsdPlan = {
          axis: newAxis,
          dir: newDir,
          roadCoord: newRoad,
          nextIntersection: nextInter,
          nextTurn: this.chooseNextTurn(newAxis, newDir, newRoad, nextInter),
        };
      } else {
        const nextInter = this.findNextRoadAhead(nextIntersection, dir);
        this.fsdPlan = {
          ...this.fsdPlan,
          nextIntersection: nextInter,
          nextTurn: this.chooseNextTurn(axis, dir, roadCoord, nextInter),
        };
      }
    }

    const desiredAngle = Math.atan2(targetX - this.egoX, targetZ - this.egoZ);
    let angleDiff = desiredAngle - this.egoHeading;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const steer = Math.max(-0.52, Math.min(0.52, angleDiff * 1.45));

    // Speed control by FSD Profile + cornering slowdown + forward traffic radar
    let cruiseSpeed =
      this.fsdProfile === 'Mad Max' ? 18.5 : this.fsdProfile === 'Hurry' ? 14.5 : 11.5;
    if (distToInter < 20 && nextTurn !== 'straight') {
      cruiseSpeed = Math.min(cruiseSpeed, 6.8);
    }

    // Check forward radar against traffic vehicles
    const fx = Math.sin(this.egoHeading);
    const fz = Math.cos(this.egoHeading);
    for (const tr of this.traffic) {
      const dx = tr.handle.group.position.x - this.egoX;
      const dz = tr.handle.group.position.z - this.egoZ;
      const forwardDist = dx * fx + dz * fz;
      const lateralDist = Math.abs(dx * -fz + dz * fx);
      if (forwardDist > 0 && forwardDist < 22 && lateralDist < 2.5) {
        cruiseSpeed = Math.min(cruiseSpeed, forwardDist < 9 ? 0 : tr.speed * 0.85);
      }
    }

    const speedErr = cruiseSpeed - this.egoSpeed;
    const accel = Math.max(-14, Math.min(8.5, speedErr * 2.2));
    return { steer, accel, braking: accel < -1.5 };
  }

  private findNextRoadAhead(curCoord: number, dir: 1 | -1): number {
    let best = dir > 0 ? 176 : -176;
    let bestDist = Infinity;
    for (const r of ROAD_COORDS) {
      const d = (r - curCoord) * dir;
      if (d > 10 && d < bestDist) {
        bestDist = d;
        best = r;
      }
    }
    return best;
  }

  private updateTrafficAndPedestrians(dt: number): void {
    for (const tr of this.traffic) {
      // Slow down if approaching Ego car ahead
      const x = tr.axis === 'z' ? tr.roadCoord - tr.dir * LANE_OFFSET : tr.pos;
      const z = tr.axis === 'x' ? tr.roadCoord + tr.dir * LANE_OFFSET : tr.pos;
      const fx = tr.axis === 'x' ? tr.dir : 0;
      const fz = tr.axis === 'z' ? tr.dir : 0;
      const dxEgo = this.egoX - x;
      const dzEgo = this.egoZ - z;
      const fwdEgo = dxEgo * fx + dzEgo * fz;
      const latEgo = Math.abs(dxEgo * -fz + dzEgo * fx);

      let desired = tr.targetSpeed;
      if (fwdEgo > 0 && fwdEgo < 16 && latEgo < 2.6) {
        desired = fwdEgo < 8.5 ? 0 : Math.min(desired, Math.max(0, this.egoSpeed));
      }

      const prevSpeed = tr.speed;
      tr.speed += (desired - tr.speed) * Math.min(1, dt * 3.5);
      tr.handle.setBraking(desired < prevSpeed - 0.3 || tr.speed < 1.5);

      tr.pos += tr.dir * tr.speed * dt;
      if (tr.pos > 195) tr.pos = -195;
      if (tr.pos < -195) tr.pos = 195;

      const finalX = tr.axis === 'z' ? tr.roadCoord - tr.dir * LANE_OFFSET : tr.pos;
      const finalZ = tr.axis === 'x' ? tr.roadCoord + tr.dir * LANE_OFFSET : tr.pos;
      tr.handle.group.position.set(finalX, 0, finalZ);
      tr.handle.group.rotation.y =
        tr.axis === 'z' ? (tr.dir > 0 ? 0 : Math.PI) : tr.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }

    for (const ped of this.pedestrians) {
      ped.pos += ped.dir * ped.speed * dt;
      if (ped.pos > 170) ped.pos = -170;
      if (ped.pos < -170) ped.pos = 170;
      ped.phase += dt * 7;

      const px = ped.axis === 'z' ? ped.fixedCoord : ped.pos;
      const pz = ped.axis === 'x' ? ped.fixedCoord : ped.pos;
      ped.mesh.position.set(px, 0.24 + Math.abs(Math.sin(ped.phase)) * 0.04, pz);
      ped.mesh.rotation.y =
        ped.axis === 'z' ? (ped.dir > 0 ? 0 : Math.PI) : ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }

  private updateFsdVisuals(nowMs: number): void {
    const showFsd = this.fsdActive && this.gear !== 'P';
    this.pathRibbonMesh.visible = showFsd;

    if (showFsd) {
      const posAttr = this.pathRibbonMesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const segs = 32;
      const halfW = 0.96;
      const distInter = this.getDistanceToNextIntersection();
      const { axis, dir, nextTurn } = this.fsdPlan;

      for (let i = 0; i <= segs; i++) {
        const s = (i / segs) * 44; // 44m ahead
        let angle = this.egoHeading;
        let px = this.egoX + Math.sin(this.egoHeading) * (2.2 + s);
        let pz = this.egoZ + Math.cos(this.egoHeading) * (2.2 + s);

        if ((nextTurn === 'left' || nextTurn === 'right') && s > Math.max(0, distInter - 5)) {
          const intoTurn = Math.min(1, (s - Math.max(0, distInter - 5)) / 18);
          const turnAngle = (nextTurn === 'left' ? 1 : -1) * (Math.PI / 2) * intoTurn;
          const baseHeading =
            axis === 'z' ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          angle = baseHeading + turnAngle;
          const straightPart = Math.min(s, Math.max(0, distInter - 2));
          const extra = Math.max(0, s - straightPart);
          px =
            this.egoX +
            Math.sin(this.egoHeading) * (2.2 + straightPart) +
            Math.sin(angle) * extra;
          pz =
            this.egoZ +
            Math.cos(this.egoHeading) * (2.2 + straightPart) +
            Math.cos(angle) * extra;
        }

        const rx = -Math.cos(angle) * halfW;
        const rz = Math.sin(angle) * halfW;
        posAttr.setXYZ(i * 2, px - rx, 0.055, pz - rz);
        posAttr.setXYZ(i * 2 + 1, px + rx, 0.055, pz + rz);
      }
      posAttr.needsUpdate = true;

      // Update floating 3D AR Turn Chevrons (`> > >`) at upcoming intersection when within 45m
      const showChev = (nextTurn === 'left' || nextTurn === 'right') && distInter < 48;
      const { roadCoord, nextIntersection } = this.fsdPlan;
      const pulsePhase = (nowMs / 320) % 6;

      this.skyChevrons.forEach((grp, idx) => {
        grp.visible = showChev;
        if (!showChev) return;
        const t = idx / 5;
        const turnSign = nextTurn === 'left' ? 1 : -1;
        const baseHeading =
          axis === 'z' ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        const yaw = baseHeading + turnSign * (Math.PI / 2) * t;
        const ix = axis === 'z' ? roadCoord - dir * LANE_OFFSET : nextIntersection;
        const iz = axis === 'x' ? roadCoord + dir * LANE_OFFSET : nextIntersection;

        const r = 6.5;
        const cx = ix + Math.sin(yaw) * (t * 10 - 3);
        const cz = iz + Math.cos(yaw) * (t * 10 - 3) + (axis === 'z' ? -dir * 4 : 0);
        grp.position.set(cx, 2.3 + Math.sin((nowMs / 400) + idx) * 0.14, cz + (r * 0));
        grp.rotation.set(0, yaw, 0);
        const scale = Math.abs(pulsePhase - idx) < 1.2 ? 1.2 : 0.95;
        grp.scale.setScalar(scale);
      });
    } else {
      for (const grp of this.skyChevrons) grp.visible = false;
    }

    if (this.waypointPin.visible) {
      this.waypointPin.rotation.y = nowMs * 0.002;
    }
  }

  private updateCamera(
    dt: number,
    snap: ReturnType<InputController['poll']>,
    nowMs: number
  ): void {
    // Right stick orbit
    if (Math.abs(snap.lookX) > 0.01 || Math.abs(snap.lookY) > 0.01) {
      this.orbitYaw -= snap.lookX * 2.1 * dt;
      this.orbitPitch = Math.max(-0.32, Math.min(0.45, this.orbitPitch + snap.lookY * 1.4 * dt));
      this.lastOrbitInteractAt = nowMs;
    } else if (!this.isPointerDragging && Math.abs(this.egoSpeed) > 1.5 && nowMs - this.lastOrbitInteractAt > 2000) {
      // Smooth auto-recenter behind ego Tesla like GTA/Tesla V15
      this.orbitYaw *= Math.max(0, 1 - dt * 2.5);
      this.orbitPitch *= Math.max(0, 1 - dt * 2.5);
    }

    let dist = 9.0 * this.orbitZoom;
    let height = 5.4 * this.orbitZoom;
    let lookAhead = 14.0;
    let lookY = 1.1;

    if (this.cameraPreset === 'cinematic_low') {
      dist = 6.8 * this.orbitZoom;
      height = 2.4 * this.orbitZoom;
      lookAhead = 18.0;
      lookY = 1.05;
    } else if (this.cameraPreset === 'top_down') {
      dist = 4.2 * this.orbitZoom;
      height = 22.0 * this.orbitZoom;
      lookAhead = 6.0;
      lookY = 0;
    } else if (this.cameraPreset === 'hood') {
      dist = -0.35;
      height = 1.42;
      lookAhead = 24.0;
      lookY = 1.25;
    } else if (this.gear === 'R') {
      // Authentic FSD V15 reverse behavior: lift camera slightly higher so rear area is clearly framed
      dist = 10.6 * this.orbitZoom;
      height = 7.4 * this.orbitZoom;
      lookAhead = 7.0;
    }

    const camAngle = this.egoHeading + this.orbitYaw;
    const pitchLift = this.orbitPitch * dist * 0.7;

    const desiredPos = new THREE.Vector3(
      this.egoX - Math.sin(camAngle) * dist,
      Math.max(1.1, height + pitchLift),
      this.egoZ - Math.cos(camAngle) * dist
    );
    const desiredLook = new THREE.Vector3(
      this.egoX + Math.sin(camAngle) * lookAhead,
      lookY,
      this.egoZ + Math.cos(camAngle) * lookAhead
    );

    const smooth = this.cameraPreset === 'hood' ? 1 : Math.min(1, dt * 7.5);
    this.camPosCurrent.lerp(desiredPos, smooth);
    this.camLookCurrent.lerp(desiredLook, smooth);

    this.camera.position.copy(this.camPosCurrent);
    this.camera.lookAt(this.camLookCurrent);
  }

  private emitTelemetry(): void {
    const { axis, roadCoord } = this.fsdPlan;
    const roadIdx = Math.max(0, ROAD_COORDS.indexOf(roadCoord));
    const streetName =
      axis === 'z'
        ? STREET_NAMES_Z[roadIdx % STREET_NAMES_Z.length]
        : STREET_NAMES_X[roadIdx % STREET_NAMES_X.length];

    const distToInter = Math.round(this.getDistanceToNextIntersection());
    const remKm = this.customWaypoint
      ? Number((Math.hypot(this.customWaypoint.x - this.egoX, this.customWaypoint.z - this.egoZ) / 1000).toFixed(2))
      : 2.1;

    this.callbacks.onTelemetry({
      speedKmh: Math.round(Math.abs(this.egoSpeed) * 3.6),
      gear: this.gear,
      powerNormalized: this.powerNormalized,
      steerAngle: this.egoSteerAngle,
      fsdActive: this.fsdActive,
      fsdProfile: this.fsdProfile,
      turnSignal: this.turnSignal,
      braking: this.braking,
      speedLimitKmh: 50,
      nextTurnDir: this.fsdPlan.nextTurn,
      nextTurnDistM: distToInter,
      streetName,
      etaMinutes: Math.max(1, Math.round(remKm * 2.4)),
      remainingKm: remKm,
      streakKm: Number(this.streakKm.toFixed(1)),
      destinationName: this.customWaypoint ? '自选地图标点' : '陆家嘴国金中心',
      hasCustomWaypoint: Boolean(this.customWaypoint),
      egoX: this.egoX,
      egoZ: this.egoZ,
      egoHeading: this.egoHeading,
    });
  }

  private onPointerDown = (e: PointerEvent) => {
    this.isPointerDragging = true;
    this.pointerMoved = false;
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.isPointerDragging) return;
    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    if (Math.hypot(dx, dy) > 5) this.pointerMoved = true;

    this.orbitYaw -= dx * 0.0055;
    this.orbitPitch = Math.max(-0.3, Math.min(0.45, this.orbitPitch + dy * 0.0045));
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
    this.lastOrbitInteractAt = performance.now();
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.isPointerDragging) return;
    this.isPointerDragging = false;

    // Short click on 3D road -> Tesla V15 "Tap-to-Navigate" drops destination pin!
    if (!this.pointerMoved && e.target === this.renderer.domElement) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      this.raycaster.setFromCamera(ndc, this.camera);
      const hit = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.groundPlane, hit)) {
        if (Math.abs(hit.x) <= WORLD_LIMIT && Math.abs(hit.z) <= WORLD_LIMIT) {
          this.customWaypoint = hit.clone();
          this.waypointPin.position.set(hit.x, 0, hit.z);
          this.waypointPin.visible = true;
          this.fsdActive = true;
          this.gear = 'D';
          this.snapToNearestFsdPlan();
          this.callbacks.onToast('已设定 Tap-to-Navigate 目的地，FSD 正在前往');
        }
      }
    }
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.orbitZoom = Math.max(0.65, Math.min(1.85, this.orbitZoom + (e.deltaY > 0 ? 0.08 : -0.08)));
  };

  private onResize = () => {
    const w = Math.max(320, this.container.clientWidth);
    const h = Math.max(240, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
  };

  public dispose(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.input.dispose();
    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    dom.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('resize', this.onResize);
    this.envMap?.dispose();
    this.composer?.dispose();
    this.renderer.dispose();
    if (dom.parentElement === this.container) {
      this.container.removeChild(dom);
    }
  }
}
