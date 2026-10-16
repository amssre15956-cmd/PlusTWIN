import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { VitalsData, PatientProfile, OrganId, OrganDetail } from '../types/clinical.ts';
import { getOrganDiagnostics } from '../logic/clinicalEngine.ts';
import {
  Activity,
  Heart,
  Wind,
  Layers,
  ZoomIn,
  RotateCcw,
  Sparkles,
  Info,
  Maximize2
} from 'lucide-react';

interface AnatomicalTwin3DProps {
  vitals: VitalsData;
  profile: PatientProfile;
  intervention: string | null;
  onSelectOrgan?: (organ: OrganDetail) => void;
}

export type ViewMode = 'all' | 'cardiac' | 'pulmonary' | 'vessels' | 'intervention';

export const AnatomicalTwin3D: React.FC<AnatomicalTwin3DProps> = ({
  vitals,
  profile,
  intervention,
  onSelectOrgan
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [activeView, setActiveView] = useState<ViewMode>('all');
  const [hoveredOrgan, setHoveredOrgan] = useState<string | null>(null);
  const [selectedOrganDetail, setSelectedOrganDetail] = useState<OrganDetail | null>(null);
  const [isRotating, setIsRotating] = useState(true);

  // References for render loop
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsTargetRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0.2, z: 0 });
  const cameraTargetPosRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0.5, z: 3.8 });

  // Mesh refs for animated kinematics
  const heartGroupRef = useRef<THREE.Group | null>(null);
  const leftLungRef = useRef<THREE.Group | null>(null);
  const rightLungRef = useRef<THREE.Group | null>(null);
  const vesselsGroupRef = useRef<THREE.Group | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const o2ParticlesRef = useRef<THREE.Points | null>(null);
  const interactiveMeshesRef = useRef<{ mesh: THREE.Object3D; organId: OrganId; name: string }[]>([]);

  // State refs to avoid recreation in animation tick
  const vitalsRef = useRef(vitals);
  vitalsRef.current = vitals;
  const interventionRef = useRef(intervention);
  interventionRef.current = intervention;
  const isRotatingRef = useRef(isRotating);
  isRotatingRef.current = isRotating;

  // Camera preset handlers
  const setCameraPreset = useCallback((mode: ViewMode) => {
    setActiveView(mode);
    switch (mode) {
      case 'cardiac':
        cameraTargetPosRef.current = { x: -0.2, y: 0.1, z: 1.8 };
        controlsTargetRef.current = { x: -0.15, y: 0.05, z: 0 };
        break;
      case 'pulmonary':
        cameraTargetPosRef.current = { x: 0, y: 0.35, z: 2.6 };
        controlsTargetRef.current = { x: 0, y: 0.25, z: 0 };
        break;
      case 'vessels':
        cameraTargetPosRef.current = { x: 0.1, y: 0.1, z: 2.2 };
        controlsTargetRef.current = { x: 0, y: 0.1, z: 0 };
        break;
      case 'intervention':
        cameraTargetPosRef.current = { x: 0, y: 0.25, z: 2.4 };
        controlsTargetRef.current = { x: 0, y: 0.15, z: 0 };
        break;
      case 'all':
      default:
        cameraTargetPosRef.current = { x: 0, y: 0.4, z: 3.8 };
        controlsTargetRef.current = { x: 0, y: 0.2, z: 0 };
        break;
    }
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 450;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0.4, 3.8);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Studio Environment map
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 2. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0x0e1726, 1.2);
    scene.add(ambientLight);

    // Warm Key Light (focused on organ depth)
    const keyLight = new THREE.DirectionalLight(0xfff5ea, 2.4);
    keyLight.position.set(4, 5, 4);
    scene.add(keyLight);

    // Cool Fill Light (Web3 Cyan/Neon glow)
    const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.8);
    fillLight.position.set(-4, -2, -3);
    scene.add(fillLight);

    // Rim / Backlight for specular rim definition
    const rimLight = new THREE.DirectionalLight(0xa855f7, 2.0);
    rimLight.position.set(0, 4, -4);
    scene.add(rimLight);

    // Subtle Ground Glow Plane
    const groundGeo = new THREE.PlaneGeometry(6, 6);
    const groundMat = new THREE.MeshBasicMaterial({
      color: 0x061121,
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.2;
    scene.add(ground);

    // Root Assembly Group
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // ==========================================
    // 3. ANATOMICAL HEART (Multi-component Group)
    // ==========================================
    const heartGroup = new THREE.Group();
    heartGroup.position.set(-0.16, 0.06, 0.12);
    heartGroup.scale.set(0.68, 0.68, 0.68);
    rootGroup.add(heartGroup);
    heartGroupRef.current = heartGroup;

    // Heart Myocardium (Ventricular apex body)
    const heartBodyGeo = new THREE.SphereGeometry(0.52, 32, 28);
    // Deform sphere toward cardiac apex
    const posAttr = heartBodyGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const y = posAttr.getY(i);
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      // Taper apex downwards & tilt left
      if (y < 0) {
        const factor = 1 + y * 0.7;
        posAttr.setX(i, x * factor - y * 0.15);
        posAttr.setZ(i, z * factor);
      }
    }
    heartBodyGeo.computeVertexNormals();

    const heartMat = new THREE.MeshPhysicalMaterial({
      color: 0xbe123c, // Rich cardiac ruby
      emissive: 0x4c0519,
      roughness: 0.28,
      metalness: 0.12,
      clearcoat: 0.8,
      clearcoatRoughness: 0.2
    });
    const heartMesh = new THREE.Mesh(heartBodyGeo, heartMat);
    heartMesh.rotation.z = 0.22;
    heartGroup.add(heartMesh);

    // Left & Right Atria bulges
    const atriumGeo = new THREE.SphereGeometry(0.24, 20, 16);
    const atriumMat = new THREE.MeshPhysicalMaterial({
      color: 0x9f1239,
      roughness: 0.35,
      metalness: 0.1
    });
    const leftAtrium = new THREE.Mesh(atriumGeo, atriumMat);
    leftAtrium.position.set(0.22, 0.42, -0.05);
    heartGroup.add(leftAtrium);

    const rightAtrium = new THREE.Mesh(atriumGeo, atriumMat);
    rightAtrium.position.set(-0.25, 0.38, 0.02);
    heartGroup.add(rightAtrium);

    // Ascending Aorta Root & Arch
    const aortaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.04, 0.35, 0),
      new THREE.Vector3(0.02, 0.75, 0.05),
      new THREE.Vector3(-0.06, 0.95, -0.04),
      new THREE.Vector3(-0.16, 0.85, -0.15),
      new THREE.Vector3(-0.18, 0.3, -0.18)
    ]);
    const aortaGeo = new THREE.TubeGeometry(aortaCurve, 32, 0.1, 16, false);
    const aortaMat = new THREE.MeshPhysicalMaterial({
      color: 0xef4444, // Bright arterial red
      emissive: 0x7f1d1d,
      roughness: 0.2,
      metalness: 0.3,
      clearcoat: 0.9
    });
    const aortaMesh = new THREE.Mesh(aortaGeo, aortaMat);
    heartGroup.add(aortaMesh);

    // 3 Brachiocephalic branch arches off the top of Aorta
    const branchOffsets = [-0.02, 0.03, 0.08];
    branchOffsets.forEach((bx) => {
      const bCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(bx, 0.9, -0.02),
        new THREE.Vector3(bx * 1.5, 1.12, -0.04)
      ]);
      const bGeo = new THREE.TubeGeometry(bCurve, 12, 0.032, 10, false);
      const bMesh = new THREE.Mesh(bGeo, aortaMat);
      heartGroup.add(bMesh);
    });

    // Pulmonary Trunk (crossing anteriorly to aorta)
    const pulmoCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.08, 0.35, 0.14),
      new THREE.Vector3(-0.04, 0.65, 0.12),
      new THREE.Vector3(0.12, 0.72, 0.02)
    ]);
    const pulmoGeo = new THREE.TubeGeometry(pulmoCurve, 24, 0.085, 14, false);
    const pulmoMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7, // Pulmonary artery blue
      roughness: 0.25,
      metalness: 0.25,
      clearcoat: 0.8
    });
    const pulmoMesh = new THREE.Mesh(pulmoGeo, pulmoMat);
    heartGroup.add(pulmoMesh);

    // Superior Vena Cava
    const svcCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.28, 0.45, -0.08),
      new THREE.Vector3(-0.28, 1.0, -0.08)
    ]);
    const svcGeo = new THREE.TubeGeometry(svcCurve, 16, 0.075, 12, false);
    const svcMesh = new THREE.Mesh(svcGeo, pulmoMat);
    heartGroup.add(svcMesh);

    // ==========================================
    // 4. ANATOMICAL LUNGS (Bilateral Pulmonary Lobes)
    // ==========================================
    const lungMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8, // Holographic / Clinical cyan lung
      emissive: 0x082f49,
      roughness: 0.32,
      metalness: 0.15,
      transmission: 0.3,
      transparent: true,
      opacity: 0.88,
      clearcoat: 0.6
    });

    // Right Lung (3 lobes: superior, middle, inferior)
    const rightLung = new THREE.Group();
    rightLung.position.set(0.68, 0.35, 0);
    rootGroup.add(rightLung);
    rightLungRef.current = rightLung;

    const rSupGeo = new THREE.SphereGeometry(0.48, 28, 24);
    rSupGeo.scale(0.72, 1.35, 0.82);
    const rLungMesh = new THREE.Mesh(rSupGeo, lungMat);
    rightLung.add(rLungMesh);

    // Left Lung (2 lobes, with cardiac notch concave imprint)
    const leftLung = new THREE.Group();
    leftLung.position.set(-0.76, 0.35, -0.02);
    rootGroup.add(leftLung);
    leftLungRef.current = leftLung;

    const lSupGeo = new THREE.SphereGeometry(0.46, 28, 24);
    lSupGeo.scale(0.68, 1.32, 0.78);
    // Add cardiac notch indentation on inner lower medial surface
    const lPos = lSupGeo.attributes.position;
    for (let i = 0; i < lPos.count; i++) {
      const x = lPos.getX(i);
      const y = lPos.getY(i);
      const z = lPos.getZ(i);
      if (x > 0 && y < 0 && z > 0) {
        lPos.setX(i, x * 0.62);
      }
    }
    lSupGeo.computeVertexNormals();

    const lLungMesh = new THREE.Mesh(lSupGeo, lungMat);
    leftLung.add(lLungMesh);

    // ==========================================
    // 5. TRACHEOBRONCHIAL TREE (Conducting Airways)
    // ==========================================
    const airwayMat = new THREE.MeshPhysicalMaterial({
      color: 0xe2e8f0,
      emissive: 0x1e293b,
      roughness: 0.3,
      metalness: 0.35
    });

    // Trachea Main Stem
    const tracheaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.45, -0.05),
      new THREE.Vector3(0, 0.75, -0.06)
    ]);
    const tracheaGeo = new THREE.TubeGeometry(tracheaCurve, 16, 0.065, 12, false);
    const tracheaMesh = new THREE.Mesh(tracheaGeo, airwayMat);
    rootGroup.add(tracheaMesh);

    // Carina bifurcation into Left & Right Main Bronchus
    const rBronchusCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.75, -0.06),
      new THREE.Vector3(0.35, 0.52, -0.04),
      new THREE.Vector3(0.55, 0.35, 0.02)
    ]);
    const rBronchus = new THREE.Mesh(
      new THREE.TubeGeometry(rBronchusCurve, 16, 0.045, 10, false),
      airwayMat
    );
    rootGroup.add(rBronchus);

    const lBronchusCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.75, -0.06),
      new THREE.Vector3(-0.35, 0.54, -0.04),
      new THREE.Vector3(-0.58, 0.35, 0.02)
    ]);
    const lBronchus = new THREE.Mesh(
      new THREE.TubeGeometry(lBronchusCurve, 16, 0.042, 10, false),
      airwayMat
    );
    rootGroup.add(lBronchus);

    // ==========================================
    // 6. SYSTEMIC VESSELS & DESCENDING AORTA
    // ==========================================
    const vesselsGroup = new THREE.Group();
    rootGroup.add(vesselsGroup);
    vesselsGroupRef.current = vesselsGroup;

    // Descending Thoracic Aorta
    const descAortaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.16, 0.3, -0.15),
      new THREE.Vector3(-0.1, -0.4, -0.12),
      new THREE.Vector3(-0.06, -0.95, -0.08),
      new THREE.Vector3(0.12, -1.35, 0)
    ]);
    const descAortaGeo = new THREE.TubeGeometry(descAortaCurve, 24, 0.07, 12, false);
    const descAortaMesh = new THREE.Mesh(descAortaGeo, aortaMat);
    vesselsGroup.add(descAortaMesh);

    // Inferior Vena Cava
    const ivcCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.08, 0.1, -0.12),
      new THREE.Vector3(0.12, -0.5, -0.1),
      new THREE.Vector3(0.14, -1.2, -0.06)
    ]);
    const ivcGeo = new THREE.TubeGeometry(ivcCurve, 20, 0.075, 12, false);
    const ivcMesh = new THREE.Mesh(ivcGeo, pulmoMat);
    vesselsGroup.add(ivcMesh);

    // ==========================================
    // 7. HOLOGRAPHIC TORSO SILHOUETTE & MATRIX GRID
    // ==========================================
    const ribGroup = new THREE.Group();
    rootGroup.add(ribGroup);

    // Translucent rib cage arcs
    const ribMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x075985,
      transparent: true,
      opacity: 0.18,
      roughness: 0.4,
      metalness: 0.8,
      wireframe: true
    });

    for (let r = 0; r < 7; r++) {
      const yLvl = 0.9 - r * 0.24;
      const widthFactor = 0.95 + Math.sin((r / 6) * Math.PI) * 0.45;
      const ribGeo = new THREE.TorusGeometry(widthFactor, 0.02, 8, 36, Math.PI * 1.55);
      const ribMesh = new THREE.Mesh(ribGeo, ribMat);
      ribMesh.rotation.x = Math.PI / 2 + 0.12;
      ribMesh.rotation.z = -Math.PI * 0.78;
      ribMesh.position.set(0, yLvl, 0);
      ribGroup.add(ribMesh);
    }

    // Outer cyber-torso contour silhouette
    const torsoGeo = new THREE.CylinderGeometry(1.2, 0.95, 2.8, 24, 16, true);
    const torsoMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      emissive: 0x0284c7,
      transparent: true,
      opacity: 0.08,
      roughness: 0.1,
      metalness: 0.9,
      transmission: 0.85,
      ior: 1.2,
      depthWrite: false
    });
    const torsoMesh = new THREE.Mesh(torsoGeo, torsoMat);
    torsoMesh.position.set(0, 0.2, 0);
    rootGroup.add(torsoMesh);

    // ==========================================
    // 8. FLOWING HEMODYNAMICS PARTICLES
    // ==========================================
    const particleCount = 280;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const particleProgress = new Float32Array(particleCount);

    const cArterial = new THREE.Color(0xf43f5e);
    const cVenous = new THREE.Color(0x38bdf8);

    for (let i = 0; i < particleCount; i++) {
      particleProgress[i] = Math.random();
      const isArt = i % 2 === 0;
      const col = isArt ? cArterial : cVenous;
      particleColors[i * 3] = col.r;
      particleColors[i * 3 + 1] = col.g;
      particleColors[i * 3 + 2] = col.b;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.065,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    rootGroup.add(particles);
    particlesRef.current = particles;

    // Simulated O2 Therapy Flow Particles (active during intervention)
    const o2Count = 120;
    const o2Geo = new THREE.BufferGeometry();
    const o2Pos = new Float32Array(o2Count * 3);
    o2Geo.setAttribute('position', new THREE.BufferAttribute(o2Pos, 3));
    const o2Mat = new THREE.PointsMaterial({
      color: 0x34d399, // Glowing emerald O2 diffusion
      size: 0.08,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    const o2Particles = new THREE.Points(o2Geo, o2Mat);
    rootGroup.add(o2Particles);
    o2ParticlesRef.current = o2Particles;

    // Register interactive targets for raycasting
    interactiveMeshesRef.current = [
      { mesh: heartMesh, organId: 'heart', name: 'Anatomical Heart' },
      { mesh: rLungMesh, organId: 'lungs', name: 'Right Pulmonary Lobe' },
      { mesh: lLungMesh, organId: 'lungs', name: 'Left Pulmonary Lobe' },
      { mesh: aortaMesh, organId: 'aorta', name: 'Aortic Arch' },
      { mesh: tracheaMesh, organId: 'airways', name: 'Trachea & Airways' },
      { mesh: descAortaMesh, organId: 'vessels', name: 'Vascular Network' }
    ];

    // ==========================================
    // 9. RAYCASTING & INTERACTION
    // ==========================================
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-999, -999);

    const onPointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const candidates = interactiveMeshesRef.current.map((item) => item.mesh);
      const hits = raycaster.intersectObjects(candidates, false);

      if (hits.length > 0) {
        const found = interactiveMeshesRef.current.find((item) => item.mesh === hits[0].object);
        if (found) {
          setHoveredOrgan(found.name);
          container.style.cursor = 'pointer';
          return;
        }
      }
      setHoveredOrgan(null);
      container.style.cursor = 'grab';
    };

    const onClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const candidates = interactiveMeshesRef.current.map((item) => item.mesh);
      const hits = raycaster.intersectObjects(candidates, false);

      if (hits.length > 0) {
        const found = interactiveMeshesRef.current.find((item) => item.mesh === hits[0].object);
        if (found) {
          const detail = getOrganDiagnostics(found.organId, vitalsRef.current, profile);
          setSelectedOrganDetail(detail);
          if (onSelectOrgan) onSelectOrgan(detail);

          // Focus camera toward clicked item
          if (found.organId === 'heart') setCameraPreset('cardiac');
          else if (found.organId === 'lungs' || found.organId === 'airways') setCameraPreset('pulmonary');
          else setCameraPreset('vessels');
        }
      }
    };

    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('click', onClick);

    // Manual Orbit drag
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };
    const onMouseUp = () => {
      isDragging = false;
    };
    const onMouseMoveOrbit = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouseX;
      const dy = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      rootGroup.rotation.y += dx * 0.008;
      rootGroup.rotation.x = Math.max(-0.6, Math.min(0.6, rootGroup.rotation.x + dy * 0.006));
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mousemove', onMouseMoveOrbit);

    // ==========================================
    // 10. ANIMATION TICK (KINEMATICS & DYNAMICS)
    // ==========================================
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // Current live vitals
      const currVitals = vitalsRef.current;
      const hr = currVitals.heart_rate || 72;
      const spo2 = currVitals.spo2 || 96;
      const rr = currVitals.respiration_rate || 16;
      const isCrit = spo2 < 90;

      // Smooth camera interpolation
      const targetPos = cameraTargetPosRef.current;
      camera.position.x = THREE.MathUtils.damp(camera.position.x, targetPos.x, 3.5, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, targetPos.y, 3.5, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, targetPos.z, 3.5, delta);

      const lookTarget = controlsTargetRef.current;
      camera.lookAt(lookTarget.x, lookTarget.y, lookTarget.z);

      // Subtle slow auto-rotation if user enables
      if (isRotatingRef.current && !isDragging) {
        rootGroup.rotation.y += delta * 0.15;
      }

      // Cardiac pumping rhythm (Systole/Diastole)
      // Heart rate frequency in rad/s: (BPM / 60) * 2 * PI
      const hrFreq = (hr / 60) * Math.PI * 2;
      const cardiacPhase = Math.sin(elapsedTime * hrFreq);
      const beatScale = 1.0 + Math.pow(Math.max(0, cardiacPhase), 3) * 0.14;

      if (heartGroupRef.current) {
        heartGroupRef.current.scale.set(0.68 * beatScale, 0.68 * beatScale, 0.68 * beatScale);

        // Shift heart emissive warning when hypoxemic
        if (heartMesh && heartMesh.material) {
          const mat = heartMesh.material as THREE.MeshPhysicalMaterial;
          if (isCrit) {
            mat.emissive.setHex(0x991b1b);
            mat.color.setHex(0xdc2626);
          } else {
            mat.emissive.setHex(0x4c0519);
            mat.color.setHex(0xbe123c);
          }
        }
      }

      // Respiratory expansion / contraction (Lungs breathing cycle)
      // Respiration rate frequency: (RR / 60) * 2 * PI
      const rrFreq = (rr / 60) * Math.PI * 2;
      const breathPhase = (Math.sin(elapsedTime * rrFreq) + 1) * 0.5; // 0 to 1
      const lungExpansion = 1.0 + breathPhase * 0.18;

      if (leftLungRef.current && rightLungRef.current) {
        leftLungRef.current.scale.set(lungExpansion, lungExpansion * 1.05, lungExpansion);
        rightLungRef.current.scale.set(lungExpansion, lungExpansion * 1.05, lungExpansion);

        // Adjust lung color tint: healthy cyan vs hypoxemic cyanosis warning
        const lMat = lungMesh.material as THREE.MeshPhysicalMaterial;
        if (isCrit) {
          lMat.color.setHex(0x0284c7); // Deep desaturated cyanosis
          lMat.emissive.setHex(0x450a0a); // Red alert inner distress
        } else {
          lMat.color.setHex(0x38bdf8);
          lMat.emissive.setHex(0x082f49);
        }
      }

      // Update Hemodynamics particles along vascular track
      if (particlesRef.current) {
        const pos = particlesRef.current.geometry.attributes.position.array as Float32Array;
        const speed = (hr / 70) * 0.45;

        for (let i = 0; i < particleCount; i++) {
          particleProgress[i] = (particleProgress[i] + delta * speed) % 1.0;
          const t = particleProgress[i];

          // Blood circulation track loop
          let px = 0, py = 0, pz = 0;
          if (i % 2 === 0) {
            // Arterial flow down aorta
            py = 0.9 - t * 2.2;
            px = -0.12 + Math.sin(t * Math.PI * 2) * 0.08;
            pz = -0.1 + Math.cos(t * Math.PI) * 0.06;
          } else {
            // Venous return flow up Vena Cava
            py = -1.2 + t * 2.1;
            px = 0.12 - Math.sin(t * Math.PI * 2) * 0.06;
            pz = -0.08 + Math.sin(t * 4) * 0.05;
          }

          pos[i * 3] = px;
          pos[i * 3 + 1] = py;
          pos[i * 3 + 2] = pz;
        }
        particlesRef.current.geometry.attributes.position.needsUpdate = true;
      }

      // Update Simulated Intervention particles (Supplemental O2 / Bronchodilator)
      if (o2ParticlesRef.current) {
        const hasIntervention = Boolean(interventionRef.current);
        o2ParticlesRef.current.visible = hasIntervention;

        if (hasIntervention) {
          const oPos = o2ParticlesRef.current.geometry.attributes.position.array as Float32Array;
          for (let k = 0; k < o2Count; k++) {
            const phase = (elapsedTime * 1.2 + k * 0.08) % 1.0;
            // Diffuse down trachea into bronchial lobes
            const isRight = k % 2 === 0;
            const branchX = isRight ? 0.55 : -0.55;
            oPos[k * 3] = THREE.MathUtils.lerp(0, branchX, Math.pow(phase, 1.4)) + (Math.sin(k + elapsedTime * 2) * 0.08);
            oPos[k * 3 + 1] = 1.3 - phase * 1.1;
            oPos[k * 3 + 2] = -0.05 + Math.sin(k * 2) * 0.12;
          }
          o2ParticlesRef.current.geometry.attributes.position.needsUpdate = true;
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // Window resize handler
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', onResize);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('click', onClick);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('mousemove', onMouseMoveOrbit);

      renderer.dispose();
      groundGeo.dispose();
      groundMat.dispose();
      heartBodyGeo.dispose();
      heartMat.dispose();
      rSupGeo.dispose();
      lSupGeo.dispose();
      lungMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
    };
  }, [profile, onSelectOrgan, setCameraPreset]);

  return (
    <div className="relative w-full h-full min-h-[460px] flex flex-col rounded-2xl overflow-hidden select-none bg-radial from-slate-950 via-[#030712] to-[#01040a]">
      {/* 3D WebGL Canvas Mount */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top HUD Overlay: Active Digital Twin Status */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-900/80 border border-cyan-500/30 backdrop-blur-md shadow-lg pointer-events-auto">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-xs font-semibold tracking-wider text-cyan-200 uppercase">
            3D Anatomical Twin — {profile.name}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono">
            {vitals.spo2}% SpO2
          </span>
        </div>

        {/* Hovered Organ Tag */}
        {hoveredOrgan && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-violet-950/80 border border-violet-400/40 text-violet-200 text-xs font-medium shadow-md animate-fade-in pointer-events-auto">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span>Hover: {hoveredOrgan}</span>
            <span className="text-[10px] text-violet-300 opacity-75">(Click to inspect)</span>
          </div>
        )}

        {/* Rotation & View reset controls */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            onClick={() => setIsRotating(!isRotating)}
            className={`p-2 rounded-lg text-xs font-medium border transition-colors ${
              isRotating
                ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300'
                : 'bg-slate-900/70 border-slate-700/60 text-slate-400 hover:text-white'
            }`}
            title={isRotating ? 'Pause rotation' : 'Resume auto-rotation'}
            type="button"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCameraPreset('all')}
            className="p-2 rounded-lg text-xs font-medium bg-slate-900/70 border border-slate-700/60 text-slate-300 hover:text-white transition-colors"
            title="Reset to full view"
            type="button"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Intervention Glow Indicator */}
      {intervention && (
        <div className="absolute top-16 left-4 z-10 px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-400/50 backdrop-blur-md text-emerald-300 text-xs flex items-center gap-2 animate-pulse shadow-lg pointer-events-none">
          <Wind className="w-3.5 h-3.5 text-emerald-400" />
          <span>Simulating: {intervention === 'administer_o2' ? 'High-Flow O2 Diffusion' : 'Inhaled Bronchodilator Delivery'}</span>
        </div>
      )}

      {/* Selected Organ Diagnostics HUD Modal */}
      {selectedOrganDetail && (
        <div className="absolute top-16 right-4 z-20 w-80 p-4 rounded-xl bg-slate-950/90 border border-cyan-500/40 backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-right-4">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">{selectedOrganDetail.name}</h4>
            </div>
            <button
              onClick={() => setSelectedOrganDetail(null)}
              className="text-slate-400 hover:text-white text-sm font-bold px-1"
            >
              ✕
            </button>
          </div>
          <p className="text-[11px] text-slate-300 mb-3">{selectedOrganDetail.summary}</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {selectedOrganDetail.metrics.map((m, idx) => (
              <div key={idx} className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">{m.label}</span>
                <span className="text-xs font-bold text-cyan-300 font-mono">
                  {m.value} {m.unit && <span className="text-[10px] text-slate-400 font-normal">{m.unit}</span>}
                </span>
              </div>
            ))}
          </div>
          <div className="p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/20 text-[10px] text-cyan-200">
            <strong>Clinical Note:</strong> {selectedOrganDetail.clinicalNote}
          </div>
        </div>
      )}

      {/* Collapsible Unified Bottom Control Dock */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-950/85 border border-cyan-500/30 backdrop-blur-xl shadow-2xl max-w-[94vw] overflow-x-auto">
        <button
          onClick={() => setCameraPreset('all')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            activeView === 'all'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/30'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
          type="button"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Twin Overview</span>
        </button>

        <button
          onClick={() => setCameraPreset('cardiac')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            activeView === 'cardiac'
              ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-md shadow-rose-500/30'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
          type="button"
        >
          <Heart className="w-3.5 h-3.5" />
          <span>Heart ({vitals.heart_rate} BPM)</span>
        </button>

        <button
          onClick={() => setCameraPreset('pulmonary')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            activeView === 'pulmonary'
              ? 'bg-gradient-to-r from-sky-500 to-cyan-600 text-white shadow-md shadow-sky-500/30'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
          type="button"
        >
          <Wind className="w-3.5 h-3.5" />
          <span>Lungs ({vitals.spo2}%)</span>
        </button>

        <button
          onClick={() => setCameraPreset('vessels')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            activeView === 'vessels'
              ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/30'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
          type="button"
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Vascular Flow</span>
        </button>

        <button
          onClick={() => setCameraPreset('intervention')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            activeView === 'intervention'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
          type="button"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Intervention Simulation</span>
        </button>
      </div>
    </div>
  );
};
