import * as THREE from 'three';
import { createGlowSpriteTexture } from './proceduralTextures';

export interface EgoCarVisualState {
  wheelSpin: number;
  steerAngle: number;
  braking: boolean;
  reversing: boolean;
  turnSignal: 'off' | 'left' | 'right';
  headlightsOn: boolean;
  pitch: number;
  roll: number;
  blinkOn: boolean;
}

export interface EgoTeslaCarHandle {
  group: THREE.Group;
  setPaint: (hex: number, metalness: number, roughness: number) => void;
  updateVisuals: (state: EgoCarVisualState) => void;
}

/**
 * Builds a high-fidelity sculpted Tesla Model Y Juniper / Model 3 Highland 3D car.
 * Local coordinate convention: +Z = forward nose, -Z = rear bumper, +Y = up.
 */
export function createEgoTeslaCar(initialPaintHex = 0x3b424c): EgoTeslaCarHandle {
  const root = new THREE.Group();
  const bodyTiltGroup = new THREE.Group();
  root.add(bodyTiltGroup);

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: initialPaintHex,
    metalness: 0.72,
    roughness: 0.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.45,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b101b,
    metalness: 0.12,
    roughness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.8,
  });

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: 0x12141a,
    roughness: 0.55,
    metalness: 0.25,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x111317,
    roughness: 0.85,
    metalness: 0.05,
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x6b7280,
    roughness: 0.28,
    metalness: 0.88,
  });

  const caliperMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.35,
    metalness: 0.4,
  });

  // 1. Sculpted side-profile extruded chassis (length 4.72m, width 1.88m)
  const lowerProfile = new THREE.Shape();
  lowerProfile.moveTo(-2.34, 0.22);
  lowerProfile.lineTo(2.32, 0.22); // bottom sill
  lowerProfile.quadraticCurveTo(2.42, 0.34, 2.38, 0.56); // front splitter & bumper nose
  lowerProfile.quadraticCurveTo(2.15, 0.78, 1.32, 0.88); // aerodynamic hood slope
  lowerProfile.lineTo(-1.82, 0.94); // beltline rising subtly toward rear
  lowerProfile.quadraticCurveTo(-2.32, 0.92, -2.38, 0.62); // fastback tail deck
  lowerProfile.quadraticCurveTo(-2.4, 0.34, -2.34, 0.22);

  const lowerGeo = new THREE.ExtrudeGeometry(lowerProfile, {
    depth: 1.82,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.07,
    bevelSegments: 4,
    curveSegments: 16,
  });
  lowerGeo.translate(0, 0, -0.91);
  // Rotate so profile X -> local Z (+Z forward) and extrude Z -> local X
  lowerGeo.rotateY(-Math.PI / 2);

  const lowerMesh = new THREE.Mesh(lowerGeo, paintMat);
  lowerMesh.castShadow = true;
  lowerMesh.receiveShadow = true;
  bodyTiltGroup.add(lowerMesh);

  // 2. Sculpted upper cabin greenhouse (dark panoramic glass + painted roof rails)
  const cabinProfile = new THREE.Shape();
  cabinProfile.moveTo(-1.88, 0.86);
  cabinProfile.lineTo(1.22, 0.84);
  cabinProfile.quadraticCurveTo(0.75, 1.34, 0.18, 1.46); // swept windshield
  cabinProfile.quadraticCurveTo(-0.55, 1.49, -1.24, 1.34); // panoramic glass peak
  cabinProfile.quadraticCurveTo(-1.68, 1.12, -1.88, 0.86); // fastback rear glass

  const cabinGeo = new THREE.ExtrudeGeometry(cabinProfile, {
    depth: 1.44,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.06,
    bevelSegments: 4,
    curveSegments: 16,
  });
  cabinGeo.translate(0, 0, -0.72);
  cabinGeo.rotateY(-Math.PI / 2);

  const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
  cabinMesh.castShadow = true;
  bodyTiltGroup.add(cabinMesh);

  // Subtle painted A/B/C roof side arches framing the glass roof
  for (const side of [-1, 1]) {
    const railGeo = new THREE.BoxGeometry(0.08, 0.07, 2.18);
    const rail = new THREE.Mesh(railGeo, paintMat);
    rail.position.set(side * 0.72, 1.34, -0.28);
    rail.rotation.x = 0.06;
    bodyTiltGroup.add(rail);

    // Side wing mirrors
    const mirrorArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.06), darkTrimMat);
    mirrorArm.position.set(side * 0.96, 0.9, 0.68);
    bodyTiltGroup.add(mirrorArm);

    const mirrorCap = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.14), paintMat);
    mirrorCap.position.set(side * 1.05, 0.92, 0.67);
    mirrorCap.castShadow = true;
    bodyTiltGroup.add(mirrorCap);

    // Flush door handles
    for (const hz of [0.22, -0.58]) {
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, 0.16), darkTrimMat);
      handle.position.set(side * 0.99, 0.74, hz);
      bodyTiltGroup.add(handle);
    }
  }

  // Front aero lip & rear matte diffuser
  const lip = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.06, 0.16), darkTrimMat);
  lip.position.set(0, 0.21, 2.34);
  bodyTiltGroup.add(lip);

  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.14, 0.12), darkTrimMat);
  diffuser.position.set(0, 0.25, -2.38);
  bodyTiltGroup.add(diffuser);

  // 3. Signature Tesla Juniper full-width rear LED lightbar + brake boost + reverse bar
  const rearBarMat = new THREE.MeshStandardMaterial({
    color: 0xff1f38,
    emissive: 0xff1630,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });
  const rearBar = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.055, 0.06), rearBarMat);
  rearBar.position.set(0, 0.82, -2.38);
  bodyTiltGroup.add(rearBar);

  // Side wraparound tail pods
  for (const side of [-1, 1]) {
    const tailPod = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.11, 0.14), rearBarMat);
    tailPod.position.set(side * 0.78, 0.81, -2.33);
    bodyTiltGroup.add(tailPod);
  }

  // Reverse white bar
  const reverseMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xe2e8f0,
    emissiveIntensity: 0,
  });
  const reverseStrip = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.03, 0.04), reverseMat);
  reverseStrip.position.set(0, 0.67, -2.41);
  bodyTiltGroup.add(reverseStrip);

  // Red brake asphalt bounce glow behind rear bumper
  const brakeGlowTex = createGlowSpriteTexture('rgba(255, 32, 56, 1)');
  const brakeGlowMat = new THREE.MeshBasicMaterial({
    map: brakeGlowTex,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const brakeGlowPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.6), brakeGlowMat);
  brakeGlowPlane.rotation.x = -Math.PI / 2;
  brakeGlowPlane.position.set(0, 0.03, -3.25);
  root.add(brakeGlowPlane);

  // 4. Front Matrix LED headlights + Real SpotLights + Ground projection cones
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xe6f2ff,
    emissiveIntensity: 3.2,
  });
  const headGlowTex = createGlowSpriteTexture('rgba(218, 238, 255, 1)');
  const headConeMat = new THREE.MeshBasicMaterial({
    map: headGlowTex,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const headConePlane = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 16), headConeMat);
  headConePlane.rotation.x = -Math.PI / 2;
  headConePlane.position.set(0, 0.028, 10.0);
  root.add(headConePlane);

  for (const side of [-1, 1]) {
    const headlamp = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.1), headMat);
    headlamp.position.set(side * 0.68, 0.62, 2.36);
    headlamp.rotation.y = side * -0.18;
    bodyTiltGroup.add(headlamp);
  }

  const headlightSpot = new THREE.SpotLight(0xeef6ff, 42, 46, Math.PI / 4.8, 0.65, 1.3);
  headlightSpot.position.set(0, 0.72, 2.25);
  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(0, 0, 18);
  root.add(spotTarget);
  headlightSpot.target = spotTarget;
  root.add(headlightSpot);

  // 5. Amber Turn Signals (front + rear)
  const leftSigMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xff9800,
    emissiveIntensity: 0,
  });
  const rightSigMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xff9800,
    emissiveIntensity: 0,
  });

  const addSignalBars = (side: -1 | 1, mat: THREE.MeshStandardMaterial) => {
    const rearSig = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.05), mat);
    rearSig.position.set(side * 0.78, 0.74, -2.39);
    bodyTiltGroup.add(rearSig);
    const frontSig = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.05), mat);
    frontSig.position.set(side * 0.72, 0.56, 2.38);
    bodyTiltGroup.add(frontSig);
  };
  addSignalBars(-1, leftSigMat);
  addSignalBars(1, rightSigMat);

  // 6. 4 Sculpted Wheels (front wheels mounted on steering pivots)
  const wheelSpinGroups: THREE.Group[] = [];
  const frontSteerPivots: THREE.Group[] = [];

  const wheelPositions: Array<{ x: number; z: number; front: boolean }> = [
    { x: -0.88, z: 1.44, front: true },
    { x: 0.88, z: 1.44, front: true },
    { x: -0.89, z: -1.42, front: false },
    { x: 0.89, z: -1.42, front: false },
  ];

  for (const wp of wheelPositions) {
    const steerPivot = new THREE.Group();
    steerPivot.position.set(wp.x, 0.34, wp.z);
    root.add(steerPivot);
    if (wp.front) frontSteerPivots.push(steerPivot);

    const spinGroup = new THREE.Group();
    steerPivot.add(spinGroup);
    wheelSpinGroups.push(spinGroup);

    const tireGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 28);
    tireGeo.rotateZ(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;
    spinGroup.add(tire);

    const rimGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.245, 18);
    rimGeo.rotateZ(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    spinGroup.add(rim);

    // Turbine spokes
    for (let s = 0; s < 5; s++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.035, 0.41), darkTrimMat);
      spoke.rotation.x = (s * Math.PI) / 5;
      spinGroup.add(spoke);
    }

    // Performance Red Brake Caliper (fixed to steerPivot, doesn't spin!)
    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.11), caliperMat);
    caliper.position.set(Math.sign(wp.x) * 0.08, 0.06, -0.1);
    steerPivot.add(caliper);
  }

  // 7. Grounded Soft Contact Shadow under car
  const shadowTex = createGlowSpriteTexture('rgba(0,0,0,0.92)');
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.65, 5.45),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.015;
  root.add(contactShadow);

  return {
    group: root,
    setPaint: (hex, metalness, roughness) => {
      paintMat.color.setHex(hex);
      paintMat.metalness = metalness;
      paintMat.roughness = roughness;
    },
    updateVisuals: (s) => {
      bodyTiltGroup.rotation.x = s.pitch;
      bodyTiltGroup.rotation.z = s.roll;

      for (const pivot of frontSteerPivots) {
        pivot.rotation.y = s.steerAngle;
      }
      for (const wg of wheelSpinGroups) {
        wg.rotation.x = s.wheelSpin;
      }

      // Brake light bloom
      rearBarMat.emissiveIntensity = s.braking ? 5.2 : 1.9;
      brakeGlowMat.opacity = s.braking ? 0.62 : 0.16;

      // Reverse lights
      reverseMat.emissiveIntensity = s.reversing ? 4.0 : 0;

      // Headlights
      headMat.emissiveIntensity = s.headlightsOn ? 3.4 : 0.5;
      headlightSpot.intensity = s.headlightsOn ? 46 : 0;
      headConeMat.opacity = s.headlightsOn ? 0.32 : 0;

      // Turn signals (note: +Z is forward, so +X is car's LEFT side when facing +Z!)
      leftSigMat.emissiveIntensity = s.turnSignal === 'left' && s.blinkOn ? 4.5 : 0;
      rightSigMat.emissiveIntensity = s.turnSignal === 'right' && s.blinkOn ? 4.5 : 0;
    },
  };
}

export type TrafficStyle = 'sedan' | 'suv' | 'van';

export interface TrafficCarHandle {
  group: THREE.Group;
  setBraking: (braking: boolean) => void;
  setHeadlights: (on: boolean) => void;
}

export function createTrafficCar(style: TrafficStyle, colorHex: number): TrafficCarHandle {
  const group = new THREE.Group();
  const dims =
    style === 'van'
      ? { w: 1.95, h: 1.15, l: 4.9, cabH: 0.72, cabL: 3.4, cabZ: -0.35 }
      : style === 'suv'
        ? { w: 1.9, h: 0.74, l: 4.65, cabH: 0.58, cabL: 2.55, cabZ: -0.25 }
        : { w: 1.82, h: 0.62, l: 4.55, cabH: 0.48, cabL: 2.15, cabZ: -0.18 };

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: colorHex,
    metalness: 0.55,
    roughness: 0.28,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0e131f,
    roughness: 0.08,
    metalness: 0.15,
  });

  const lower = new THREE.Mesh(new THREE.BoxGeometry(dims.w, dims.h, dims.l), bodyMat);
  lower.position.y = 0.28 + dims.h / 2;
  lower.castShadow = true;
  lower.receiveShadow = true;
  group.add(lower);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(dims.w * 0.84, dims.cabH, dims.cabL),
    style === 'van' ? bodyMat : glassMat
  );
  cabin.position.set(0, 0.28 + dims.h + dims.cabH / 2 - 0.04, dims.cabZ);
  cabin.castShadow = true;
  group.add(cabin);

  // Wheels
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.85 });
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const wx of [-dims.w * 0.47, dims.w * 0.47]) {
    for (const wz of [dims.l * 0.31, -dims.l * 0.31]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(wx, 0.32, wz);
      group.add(w);
    }
  }

  // Headlights & Taillights
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xeef6ff,
    emissiveIntensity: 2.5,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xff2233,
    emissive: 0xff1122,
    emissiveIntensity: 1.6,
  });

  for (const sx of [-dims.w * 0.34, dims.w * 0.34]) {
    const hMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.09, 0.06), headMat);
    hMesh.position.set(sx, 0.62, dims.l / 2 + 0.01);
    group.add(hMesh);

    const tMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.06), tailMat);
    tMesh.position.set(sx, 0.66, -dims.l / 2 - 0.01);
    group.add(tMesh);
  }

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(dims.w * 1.35, dims.l * 1.15),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  group.add(shadow);

  return {
    group,
    setBraking: (b) => {
      tailMat.emissiveIntensity = b ? 4.4 : 1.5;
    },
    setHeadlights: (on) => {
      headMat.emissiveIntensity = on ? 2.8 : 0.25;
    },
  };
}

export function createPedestrian(shirtColor: number): THREE.Group {
  const g = new THREE.Group();
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.75 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd6b49c, roughness: 0.7 });

  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.78, 0.22), pantsMat);
  legs.position.y = 0.39;
  legs.castShadow = true;
  g.add(legs);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.62, 0.24), shirtMat);
  torso.position.y = 1.09;
  torso.castShadow = true;
  g.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), skinMat);
  head.position.y = 1.55;
  head.castShadow = true;
  g.add(head);

  return g;
}
