import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AnatomicalLayer, OrganInspectionInfo } from '../types/telemetry';
import { Eye, RotateCcw, Activity, Layers, Maximize2 } from 'lucide-react';

interface AnatomySimulationProps {
  spo2: number;
  hrv: number;
  hypoxemiaRisk: number;
  activeLayer: AnatomicalLayer;
  onLayerChange: (layer: AnatomicalLayer) => void;
}

export const AnatomySimulation3D: React.FC<AnatomySimulationProps> = ({
  spo2,
  hrv,
  hypoxemiaRisk,
  activeLayer,
  onLayerChange,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hoveredOrgan, setHoveredOrgan] = useState<OrganInspectionInfo | null>(null);
  const [isRotating, setIsRotating] = useState<boolean>(true);
  const [cameraView, setCameraView] = useState<'front' | 'side' | 'closeup' | 'top'>('front');

  // References for render loop mutable state
  const stateRef = useRef({
    spo2,
    hrv,
    hypoxemiaRisk,
    activeLayer,
    isRotating,
  });

  useEffect(() => {
    stateRef.current.spo2 = spo2;
    stateRef.current.hrv = hrv;
    stateRef.current.hypoxemiaRisk = hypoxemiaRisk;
    stateRef.current.activeLayer = activeLayer;
    stateRef.current.isRotating = isRotating;
  }, [spo2, hrv, hypoxemiaRisk, activeLayer, isRotating]);

  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x02060f, 0.04);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0.4, 7.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3.5;
    controls.maxDistance = 14.0;
    controls.target.set(0, 0.1, 0);
    controlsRef.current = controls;

    // 2. Lighting Setup (Warm/Cool Rim & Key)
    const ambientLight = new THREE.AmbientLight(0x0f1c32, 1.8);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0x38bdf8, 2.8);
    keyLight.position.set(4, 6, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xa855f7, 2.2);
    fillLight.position.set(-5, -3, -4);
    scene.add(fillLight);

    const frontPulseLight = new THREE.PointLight(0xff3366, 2.5, 8);
    frontPulseLight.position.set(0, -0.1, 2.2);
    scene.add(frontPulseLight);

    // 3. Anatomical Groups
    const masterGroup = new THREE.Group();
    scene.add(masterGroup);

    const heartGroup = new THREE.Group();
    const lungsGroup = new THREE.Group();
    const vesselsGroup = new THREE.Group();
    const particlesGroup = new THREE.Group();

    masterGroup.add(heartGroup);
    masterGroup.add(lungsGroup);
    masterGroup.add(vesselsGroup);
    masterGroup.add(particlesGroup);

    // Intersectable meshes for raycasting
    const interactiveMeshes: THREE.Mesh[] = [];

    // Helper: Material Creator
    const createOrganMaterial = (baseColor: number, emissiveColor: number, roughness = 0.25, transmission = 0) => {
      return new THREE.MeshPhysicalMaterial({
        color: baseColor,
        emissive: emissiveColor,
        emissiveIntensity: 0.35,
        roughness: roughness,
        metalness: 0.15,
        clearcoat: 0.8,
        clearcoatRoughness: 0.1,
        transmission: transmission,
        thickness: transmission > 0 ? 0.8 : 0,
        transparent: transmission > 0,
        opacity: transmission > 0 ? 0.75 : 0.95,
      });
    };

    // ------------------------------------------------------------------------
    // A. HEART ANATOMY MODEL (Procedural Chambers, Aorta, Ventricles, Sulcus)
    // ------------------------------------------------------------------------
    // 1. Left Ventricle (apex / muscular mass)
    const lvGeo = new THREE.SphereGeometry(0.75, 32, 28);
    lvGeo.scale(0.85, 1.25, 0.9);
    lvGeo.rotateZ(-0.25);
    lvGeo.rotateY(0.2);
    const lvMat = createOrganMaterial(0xd92d4b, 0x800820, 0.3, 0.05);
    const lvMesh = new THREE.Mesh(lvGeo, lvMat);
    lvMesh.position.set(-0.25, -0.4, 0.15);
    lvMesh.userData = {
      id: 'left_ventricle',
      name: 'Left Ventricle (LV)',
      system: 'Cardiovascular',
      description: 'Primary muscular pump propelling oxygenated blood through aortic valve into systemic circulation.',
      perfusionSat: 99,
      dynamicState: 'Systolic Ejection Fraction 62%',
      clinicalImplication: 'High stroke compliance; responsive to inotropic reserve.',
    };
    heartGroup.add(lvMesh);
    interactiveMeshes.push(lvMesh);

    // 2. Right Ventricle
    const rvGeo = new THREE.SphereGeometry(0.68, 30, 24);
    rvGeo.scale(0.9, 1.15, 0.75);
    rvGeo.rotateZ(0.18);
    const rvMat = createOrganMaterial(0xba2243, 0x5a0416, 0.35, 0.05);
    const rvMesh = new THREE.Mesh(rvGeo, rvMat);
    rvMesh.position.set(0.42, -0.32, 0.22);
    rvMesh.userData = {
      id: 'right_ventricle',
      name: 'Right Ventricle (RV)',
      system: 'Cardiovascular',
      description: 'Generates low-pressure pulmonary ejection to perfuse alveolar capillary beds.',
      perfusionSat: 74,
      dynamicState: 'Normal pulmonary systolic gradient',
      clinicalImplication: 'Vulnerable to acute pulmonary hypertension and hypoxemic vasoconstriction.',
    };
    heartGroup.add(rvMesh);
    interactiveMeshes.push(rvMesh);

    // 3. Atria & Auricles
    const atriaGeo = new THREE.SphereGeometry(0.55, 24, 20);
    atriaGeo.scale(1.4, 0.8, 0.9);
    const atriaMat = createOrganMaterial(0x9e1b38, 0x48081a, 0.4, 0.1);
    const atriaMesh = new THREE.Mesh(atriaGeo, atriaMat);
    atriaMesh.position.set(0.05, 0.45, -0.1);
    atriaMesh.userData = {
      id: 'atrial_syncytium',
      name: 'Bi-Atrial Chambers (LA/RA)',
      system: 'Cardiovascular',
      description: 'Venous conduits receiving systemic and pulmonary venous return.',
      perfusionSat: 92,
      dynamicState: 'Sinus pacing synchronized with autonomic tone',
      clinicalImplication: 'Displays beat-to-beat variability proportional to patient HRV.',
    };
    heartGroup.add(atriaMesh);
    interactiveMeshes.push(atriaMesh);

    // 4. Aortic Arch (Curved Torus Tube + Brachiocephalic Trunks)
    const aortaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.15, 0.35, 0.1),
      new THREE.Vector3(-0.1, 0.95, 0.15),
      new THREE.Vector3(0.18, 1.4, 0.05),
      new THREE.Vector3(0.55, 1.35, -0.2),
      new THREE.Vector3(0.65, 0.8, -0.35),
      new THREE.Vector3(0.6, -1.2, -0.4),
    ]);
    const aortaGeo = new THREE.TubeGeometry(aortaCurve, 40, 0.19, 18, false);
    const aortaMat = createOrganMaterial(0xef4444, 0xb91c1c, 0.2);
    const aortaMesh = new THREE.Mesh(aortaGeo, aortaMat);
    aortaMesh.userData = {
      id: 'aortic_arch',
      name: 'Aortic Arch & Thoracic Aorta',
      system: 'Systemic Vascular',
      description: 'High-compliance systemic conduit with Windkessel elastance dampening systolic pulse waves.',
      perfusionSat: 98,
      dynamicState: 'Mean Arterial Pressure 88 mmHg',
      clinicalImplication: 'Propagates rapid peripheral plethysmograph pulsatile waves to wearable SpO2 sensor.',
    };
    heartGroup.add(aortaMesh);
    interactiveMeshes.push(aortaMesh);

    // Supra-aortic Branches (Brachiocephalic, Carotid, Subclavian)
    const branchCurve1 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.12, 1.35, 0.05),
      new THREE.Vector3(0.18, 1.75, 0.1),
    ]);
    const branchCurve2 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.28, 1.38, 0.0),
      new THREE.Vector3(0.38, 1.8, 0.02),
    ]);
    const branchCurve3 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.44, 1.34, -0.08),
      new THREE.Vector3(0.6, 1.76, -0.05),
    ]);
    [branchCurve1, branchCurve2, branchCurve3].forEach((c) => {
      const geo = new THREE.TubeGeometry(c, 16, 0.055, 12, false);
      const m = new THREE.Mesh(geo, aortaMat);
      heartGroup.add(m);
    });

    // 5. Pulmonary Trunk & Arteries (Cyan/Teal tint for deoxygenated return)
    const ptCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.2, 0.2, 0.3),
      new THREE.Vector3(0.12, 0.8, 0.25),
      new THREE.Vector3(-0.05, 1.0, 0.05),
    ]);
    const ptGeo = new THREE.TubeGeometry(ptCurve, 24, 0.16, 16, false);
    const ptMat = createOrganMaterial(0x2563eb, 0x1d4ed8, 0.25);
    const ptMesh = new THREE.Mesh(ptGeo, ptMat);
    ptMesh.userData = {
      id: 'pulmonary_trunk',
      name: 'Pulmonary Trunk & Main Arteries',
      system: 'Cardiovascular',
      description: 'Channels mixed venous blood from RV directly into pulmonary vascular bed for gas exchange.',
      perfusionSat: 72,
      dynamicState: 'Pulmonary flow rate 5.2 L/min',
      clinicalImplication: 'Hypoxic pulmonary vasoconstriction triggered if alveolar pO2 drops below 60 mmHg.',
    };
    heartGroup.add(ptMesh);
    interactiveMeshes.push(ptMesh);

    // Left and Right Pulmonary Artery branches into lung hilum
    const rpaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.05, 1.0, 0.05),
      new THREE.Vector3(0.8, 0.9, -0.2),
      new THREE.Vector3(1.3, 0.65, -0.25),
    ]);
    const lpaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.05, 1.0, 0.05),
      new THREE.Vector3(-0.8, 0.95, -0.15),
      new THREE.Vector3(-1.3, 0.7, -0.2),
    ]);
    const rpaMesh = new THREE.Mesh(new THREE.TubeGeometry(rpaCurve, 20, 0.11, 14, false), ptMat);
    const lpaMesh = new THREE.Mesh(new THREE.TubeGeometry(lpaCurve, 20, 0.11, 14, false), ptMat);
    heartGroup.add(rpaMesh);
    heartGroup.add(lpaMesh);

    // 6. Superior and Inferior Vena Cava (Deep Blue)
    const svcCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.65, 1.7, -0.1),
      new THREE.Vector3(0.58, 0.9, -0.05),
      new THREE.Vector3(0.48, 0.35, -0.02),
    ]);
    const ivcCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.42, -0.4, -0.15),
      new THREE.Vector3(0.48, -1.2, -0.25),
    ]);
    const vcMat = createOrganMaterial(0x1e3a8a, 0x172554, 0.3);
    const svcMesh = new THREE.Mesh(new THREE.TubeGeometry(svcCurve, 20, 0.14, 14, false), vcMat);
    const ivcMesh = new THREE.Mesh(new THREE.TubeGeometry(ivcCurve, 20, 0.15, 14, false), vcMat);
    heartGroup.add(svcMesh);
    heartGroup.add(ivcMesh);

    // ------------------------------------------------------------------------
    // B. RESPIRATORY ANATOMY MODEL (Lungs Lobes, Trachea, Bronchial Tree)
    // ------------------------------------------------------------------------
    // Trachea with Cartilage Rings
    const tracheaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.0, 2.3, -0.12),
      new THREE.Vector3(0.0, 1.45, -0.1),
      new THREE.Vector3(0.0, 0.95, -0.08),
    ]);
    const tracheaGeo = new THREE.TubeGeometry(tracheaCurve, 24, 0.13, 16, false);
    const airwayMat = createOrganMaterial(0x38bdf8, 0x0284c7, 0.35, 0.35);
    const tracheaMesh = new THREE.Mesh(tracheaGeo, airwayMat);
    tracheaMesh.userData = {
      id: 'trachea',
      name: 'Trachea & Primary Bronchi',
      system: 'Pulmonary',
      description: 'Cartilaginous airway with mucociliary escalator conducting tidal airflow to bronchioles.',
      perfusionSat: 96,
      dynamicState: 'Airway resistance 1.4 cmH2O/L/s',
      clinicalImplication: 'Target of simulated bronchodilator therapy to reduce resistive work of breathing.',
    };
    lungsGroup.add(tracheaMesh);
    interactiveMeshes.push(tracheaMesh);

    // Bronchial bifurcations
    const rbCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.0, 0.95, -0.08),
      new THREE.Vector3(0.55, 0.65, -0.15),
      new THREE.Vector3(1.1, 0.35, -0.2),
    ]);
    const lbCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.0, 0.95, -0.08),
      new THREE.Vector3(-0.6, 0.7, -0.12),
      new THREE.Vector3(-1.15, 0.42, -0.18),
    ]);
    lungsGroup.add(new THREE.Mesh(new THREE.TubeGeometry(rbCurve, 16, 0.08, 12, false), airwayMat));
    lungsGroup.add(new THREE.Mesh(new THREE.TubeGeometry(lbCurve, 16, 0.075, 12, false), airwayMat));

    // Right Lung (3 Lobes: Superior, Middle, Inferior)
    const rightLungMat = createOrganMaterial(0x0284c7, 0x0369a1, 0.4, 0.55);
    rightLungMat.wireframe = false;

    // Right Superior Lobe
    const rLobeSupGeo = new THREE.ConeGeometry(0.85, 1.4, 20);
    rLobeSupGeo.scale(1.1, 1.0, 0.85);
    rLobeSupGeo.rotateZ(-0.15);
    const rLobeSup = new THREE.Mesh(rLobeSupGeo, rightLungMat);
    rLobeSup.position.set(1.5, 0.8, -0.05);
    rLobeSup.userData = {
      id: 'right_superior_lobe',
      name: 'Right Lung (Superior & Middle Lobes)',
      system: 'Pulmonary',
      description: 'Extensive alveolar capillary surface area responsible for rapid O2 diffusion and CO2 clearance.',
      perfusionSat: 97,
      dynamicState: 'Ventilation/Perfusion (V/Q) ratio 0.84',
      clinicalImplication: 'Maintains baseline arterial saturation; susceptible to mucus plugging in COPD.',
    };
    lungsGroup.add(rLobeSup);
    interactiveMeshes.push(rLobeSup);

    // Right Inferior Lobe (Base)
    const rLobeInfGeo = new THREE.SphereGeometry(0.95, 24, 20);
    rLobeInfGeo.scale(1.0, 1.15, 0.85);
    const rLobeInf = new THREE.Mesh(rLobeInfGeo, rightLungMat);
    rLobeInf.position.set(1.45, -0.4, -0.1);
    rLobeInf.userData = {
      id: 'right_inferior_lobe',
      name: 'Right Lung (Inferior Diaphragmatic Base)',
      system: 'Pulmonary',
      description: 'Dependent zone receiving highest perfusion fraction in upright/supine posture.',
      perfusionSat: 96,
      dynamicState: 'Expiratory alveolar volume 1450 mL',
      clinicalImplication: 'Primary site of gravity-dependent atelectasis during prolonged shallow breathing.',
    };
    lungsGroup.add(rLobeInf);
    interactiveMeshes.push(rLobeInf);

    // Left Lung (2 Lobes with Cardiac Notch)
    const leftLungMat = createOrganMaterial(0x0ea5e9, 0x0284c7, 0.4, 0.55);
    const lLobeSupGeo = new THREE.ConeGeometry(0.82, 1.35, 20);
    lLobeSupGeo.scale(1.05, 1.0, 0.8);
    lLobeSupGeo.rotateZ(0.18);
    const lLobeSup = new THREE.Mesh(lLobeSupGeo, leftLungMat);
    lLobeSup.position.set(-1.45, 0.82, -0.05);
    lLobeSup.userData = {
      id: 'left_superior_lobe',
      name: 'Left Lung (Superior Lobe & Lingula)',
      system: 'Pulmonary',
      description: 'Encompasses anterior segment and lingular tongue wrapping the pericardial margin.',
      perfusionSat: 97,
      dynamicState: 'Tidal compliance 58 mL/cmH2O',
      clinicalImplication: 'Exhibits reduced ventilation during cardiac dilation or pleural effusion.',
    };
    lungsGroup.add(lLobeSup);
    interactiveMeshes.push(lLobeSup);

    const lLobeInfGeo = new THREE.SphereGeometry(0.9, 24, 20);
    lLobeInfGeo.scale(0.95, 1.1, 0.8);
    const lLobeInf = new THREE.Mesh(lLobeInfGeo, leftLungMat);
    lLobeInf.position.set(-1.4, -0.42, -0.1);
    lLobeInf.userData = {
      id: 'left_inferior_lobe',
      name: 'Left Lung (Inferior Basilar Lobe)',
      system: 'Pulmonary',
      description: 'Inferior left parenchyma expanding caudally into diaphragmatic recess during inhalation.',
      perfusionSat: 95,
      dynamicState: 'Functional residual capacity preserved',
      clinicalImplication: 'Responsive to supplemental FiO2 titration under respiratory failure protocols.',
    };
    lungsGroup.add(lLobeInf);
    interactiveMeshes.push(lLobeInf);

    // ------------------------------------------------------------------------
    // C. SYSTEMIC & CORONARY VASCULATURE (Branching Arteriolar Web)
    // ------------------------------------------------------------------------
    const vesselMatRed = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const vesselMatBlue = new THREE.MeshBasicMaterial({ color: 0x818cf8 });

    // Procedural vascular tree branching outward
    const branches = [
      { start: [0.6, -1.2, -0.4], end: [1.2, -2.2, -0.3], mat: vesselMatRed },
      { start: [0.6, -1.2, -0.4], end: [-0.1, -2.3, -0.35], mat: vesselMatRed },
      { start: [0.48, -1.2, -0.25], end: [0.95, -2.15, -0.2], mat: vesselMatBlue },
      { start: [0.48, -1.2, -0.25], end: [0.05, -2.25, -0.25], mat: vesselMatBlue },
      // Intercostal & thoracic peripheral loops
      { start: [1.4, 0.2, 0.2], end: [2.1, 0.5, 0.1], mat: vesselMatRed },
      { start: [-1.4, 0.2, 0.2], end: [-2.1, 0.5, 0.1], mat: vesselMatRed },
      { start: [1.4, -0.6, 0.1], end: [2.0, -1.1, 0.0], mat: vesselMatBlue },
      { start: [-1.4, -0.6, 0.1], end: [-2.0, -1.1, 0.0], mat: vesselMatBlue },
    ];

    branches.forEach((b) => {
      const curve = new THREE.LineCurve3(
        new THREE.Vector3(...b.start),
        new THREE.Vector3(...b.end)
      );
      const tubeGeo = new THREE.TubeGeometry(curve, 10, 0.035, 8, false);
      const mesh = new THREE.Mesh(tubeGeo, b.mat);
      vesselsGroup.add(mesh);
    });

    // ------------------------------------------------------------------------
    // D. PULSATILE PHOTON/BLOOD CORPUSCLE PARTICLES
    // ------------------------------------------------------------------------
    const particleCount = 240;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const particleData: {
      pathIndex: number;
      progress: number;
      speed: number;
      isArterial: boolean;
    }[] = [];

    // Define 4 closed vascular loop pathways for moving particles
    const vascularLoop1 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.25, -0.4, 0.15), // LV
      new THREE.Vector3(0.18, 1.4, 0.05),   // Aorta
      new THREE.Vector3(0.6, -1.2, -0.4),   // Descending aorta
      new THREE.Vector3(1.2, -2.2, -0.3),   // Ilia
      new THREE.Vector3(0.95, -2.15, -0.2), // Venous
      new THREE.Vector3(0.48, 0.35, -0.02), // IVC
      new THREE.Vector3(0.42, -0.32, 0.22), // RV
      new THREE.Vector3(1.3, 0.65, -0.25),  // Pulmonary artery
      new THREE.Vector3(1.5, 0.2, -0.1),    // Lung cap
      new THREE.Vector3(-0.15, 0.35, 0.1),  // Pulmonary vein return
    ], true);

    const vascularLoop2 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.25, -0.4, 0.15),
      new THREE.Vector3(0.18, 1.75, 0.1),   // Carotid
      new THREE.Vector3(0.65, 1.7, -0.1),   // Jugular
      new THREE.Vector3(0.48, 0.35, -0.02), // SVC
      new THREE.Vector3(0.42, -0.32, 0.22),
      new THREE.Vector3(-1.3, 0.7, -0.2),   // L pulmonary
      new THREE.Vector3(-1.4, 0.2, -0.1),
      new THREE.Vector3(-0.15, 0.35, 0.1),
    ], true);

    const loops = [vascularLoop1, vascularLoop2];

    for (let i = 0; i < particleCount; i++) {
      const loopIdx = i % 2;
      const progress = Math.random();
      const isArterial = i % 3 !== 0;

      particleData.push({
        pathIndex: loopIdx,
        progress,
        speed: 0.0015 + Math.random() * 0.002,
        isArterial,
      });

      const pt = loops[loopIdx].getPointAt(progress);
      particlePositions[i * 3] = pt.x;
      particlePositions[i * 3 + 1] = pt.y;
      particlePositions[i * 3 + 2] = pt.z;

      // Color: Electric Cyan for O2-rich, Violet for deoxygenated
      if (isArterial) {
        particleColors[i * 3] = 0.22;
        particleColors[i * 3 + 1] = 0.74;
        particleColors[i * 3 + 2] = 0.97;
      } else {
        particleColors[i * 3] = 0.66;
        particleColors[i * 3 + 1] = 0.33;
        particleColors[i * 3 + 2] = 0.96;
      }
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.11,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particleSystem = new THREE.Points(particleGeo, particleMat);
    particlesGroup.add(particleSystem);

    // ------------------------------------------------------------------------
    // RAYCASTING FOR INTERACTION
    // ------------------------------------------------------------------------
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-999, -999);
    let currentHoveredMesh: THREE.Mesh | null = null;

    const handlePointerMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handlePointerLeave = () => {
      mouse.x = -999;
      mouse.y = -999;
      if (currentHoveredMesh) {
        (currentHoveredMesh.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.35;
        currentHoveredMesh = null;
        setHoveredOrgan(null);
      }
    };

    renderer.domElement.addEventListener('mousemove', handlePointerMove);
    renderer.domElement.addEventListener('mouseleave', handlePointerLeave);

    // ------------------------------------------------------------------------
    // ANIMATION LOOP (Heartbeat, Breathing, Hypoxia Glow, Particles, Rotation)
    // ------------------------------------------------------------------------
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      const {
        spo2: curSpo2,
        hrv: curHrv,
        hypoxemiaRisk: curRisk,
        activeLayer: curLayer,
        isRotating: curRot,
      } = stateRef.current;

      // Layer Visibility Control
      heartGroup.visible = curLayer === 'all' || curLayer === 'cardiac';
      lungsGroup.visible = curLayer === 'all' || curLayer === 'respiratory';
      vesselsGroup.visible = curLayer === 'all' || curLayer === 'vascular';
      particlesGroup.visible = curLayer === 'all' || curLayer === 'vascular' || curLayer === 'cardiac';

      // 1. Slow ambient turntable rotation
      if (curRot) {
        masterGroup.rotation.y += delta * 0.28;
      }

      // 2. Cardiac Pulse Kinematics (BPM modulated by HRV and physiological state)
      // Base heart rate around 72 bpm (1.2 Hz), modulated dynamically
      const bpm = Math.max(55, Math.min(130, 72 + (60 - curHrv) * 0.45 + (curRisk > 0.5 ? 20 : 0)));
      const pulseFrequency = (bpm / 60) * 2 * Math.PI;

      // Dual-peak contraction: atrial kick followed by sharp ventricular systole
      const phase = (elapsed * pulseFrequency) % (2 * Math.PI);
      let cardiacScale = 1.0;
      if (phase < 0.6) {
        cardiacScale = 1.0 + Math.sin((phase / 0.6) * Math.PI) * 0.07;
      } else if (phase > 0.9 && phase < 1.7) {
        cardiacScale = 1.0 - Math.sin(((phase - 0.9) / 0.8) * Math.PI) * 0.09;
      }
      heartGroup.scale.set(cardiacScale, cardiacScale, cardiacScale);

      // Pulse front light
      frontPulseLight.intensity = 2.0 + (cardiacScale - 1.0) * 15;

      // 3. Respiratory Cycle (Lungs Breathing In/Out)
      // Respiratory rate ~ 16 breaths per min
      const respFreq = (16 / 60) * 2 * Math.PI;
      const respPhase = Math.sin(elapsed * respFreq);
      const breathExpansion = 1.0 + respPhase * 0.08;
      lungsGroup.scale.set(breathExpansion, 1.0 + respPhase * 0.04, breathExpansion);

      // 4. Dynamic Hypoxia Tissue Glow
      // As SpO2 drops and risk increases, tissue shifts from healthy crimson/cyan to deep hypoxic amber/purple
      const hypoxiaFraction = Math.max(0, Math.min(1, (98 - curSpo2) / 16 + curRisk * 0.4));

      // Healthy vs Hypoxic Colors
      const healthyHeartEmissive = new THREE.Color(0x800820);
      const hypoxicHeartEmissive = new THREE.Color(0xb91c1c); // Dark ischemic flare
      const currentHeartEmissive = healthyHeartEmissive.clone().lerp(hypoxicHeartEmissive, hypoxiaFraction);
      lvMat.emissive.copy(currentHeartEmissive);
      rvMat.emissive.copy(currentHeartEmissive);

      const healthyLungEmissive = new THREE.Color(0x0284c7);
      const hypoxicLungEmissive = new THREE.Color(0x7c3aed); // Cyan shifts to purple-violet hypoxia
      const currentLungEmissive = healthyLungEmissive.clone().lerp(hypoxicLungEmissive, hypoxiaFraction);
      rightLungMat.emissive.copy(currentLungEmissive);
      leftLungMat.emissive.copy(currentLungEmissive);

      // 5. Vascular Particle Streaming
      const posAttr = particleGeo.getAttribute('position') as THREE.BufferAttribute;
      const posArray = posAttr.array as Float32Array;

      for (let i = 0; i < particleCount; i++) {
        const p = particleData[i];
        p.progress += p.speed * (bpm / 70);
        if (p.progress > 1) p.progress -= 1;

        const pt = loops[p.pathIndex].getPointAt(p.progress);
        posArray[i * 3] = pt.x;
        posArray[i * 3 + 1] = pt.y;
        posArray[i * 3 + 2] = pt.z;
      }
      posAttr.needsUpdate = true;

      // 6. Raycast Hover Inspection
      if (mouse.x !== -999 && mouse.y !== -999) {
        raycaster.setFromCamera(mouse, camera);
        const visibleInteractive = interactiveMeshes.filter((m) => m.parent && m.parent.visible);
        const intersects = raycaster.intersectObjects(visibleInteractive, false);

        if (intersects.length > 0) {
          const hit = intersects[0].object as THREE.Mesh;
          if (hit !== currentHoveredMesh) {
            if (currentHoveredMesh) {
              (currentHoveredMesh.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.35;
            }
            currentHoveredMesh = hit;
            (hit.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.95;

            const organData = hit.userData as OrganInspectionInfo;
            if (organData && organData.name) {
              setHoveredOrgan(organData);
            }
          }
        } else {
          if (currentHoveredMesh) {
            (currentHoveredMesh.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.35;
            currentHoveredMesh = null;
            setHoveredOrgan(null);
          }
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousemove', handlePointerMove);
      renderer.domElement.removeEventListener('mouseleave', handlePointerLeave);
      controls.dispose();

      // Clean up geometries and materials
      interactiveMeshes.forEach((m) => {
        m.geometry.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
        else m.material.dispose();
      });

      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Camera presets
  const setPresetView = (view: 'front' | 'side' | 'closeup' | 'top') => {
    setCameraView(view);
    const controls = controlsRef.current;
    if (!controls) return;

    if (view === 'front') {
      controls.object.position.set(0, 0.4, 7.5);
      controls.target.set(0, 0.1, 0);
    } else if (view === 'side') {
      controls.object.position.set(7.2, 0.6, 0.5);
      controls.target.set(0, 0.1, 0);
    } else if (view === 'closeup') {
      controls.object.position.set(0, 0.0, 4.4);
      controls.target.set(0, -0.1, 0);
    } else if (view === 'top') {
      controls.object.position.set(0.1, 8.0, 0.5);
      controls.target.set(0, 0.1, 0);
    }
    controls.update();
  };

  const resetView = () => {
    setPresetView('front');
  };

  return (
    <div className="relative w-full h-full min-h-[460px] flex flex-col select-none overflow-hidden rounded-2xl bg-[#030712]/70 border border-slate-700/50 backdrop-blur-xl">
      {/* 3D WebGL Canvas Mount Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing z-0" />

      {/* Top Header HUD */}
      <div className="relative z-10 p-4 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#38bdf8]" />
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-white uppercase flex items-center gap-2">
              Cardiopulmonary Twin Model
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-normal">
                REAL-TIME 3D
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Coupled systolic pulse ({Math.round(72 + (60 - hrv) * 0.45)} bpm) · SpO2 hypoxia tracking
            </p>
          </div>
        </div>

        {/* View Preset Controls */}
        <div className="flex items-center gap-1.5 pointer-events-auto bg-slate-900/80 p-1 rounded-xl border border-slate-700/60 backdrop-blur-md">
          <button
            onClick={() => setPresetView('front')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
              cameraView === 'front' ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/40' : 'text-slate-400 hover:text-white'
            }`}
          >
            Anterior
          </button>
          <button
            onClick={() => setPresetView('side')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
              cameraView === 'side' ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/40' : 'text-slate-400 hover:text-white'
            }`}
          >
            Lateral
          </button>
          <button
            onClick={() => setPresetView('closeup')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
              cameraView === 'closeup' ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/40' : 'text-slate-400 hover:text-white'
            }`}
          >
            Heart Focus
          </button>
          <button
            onClick={() => setIsRotating(!isRotating)}
            className={`p-1.5 text-xs rounded-lg transition-colors ${
              isRotating ? 'text-cyan-400 bg-cyan-500/20' : 'text-slate-400 hover:text-white'
            }`}
            title={isRotating ? 'Pause auto-rotation' : 'Resume auto-rotation'}
          >
            <Activity className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={resetView}
            className="p-1.5 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Reset view"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Floating Hover Inspection Tooltip Overlay */}
      {hoveredOrgan && (
        <div className="absolute top-16 left-4 z-20 max-w-sm p-4 rounded-xl bg-slate-950/90 border border-cyan-500/50 shadow-[0_8px_32px_rgba(6,182,212,0.25)] backdrop-blur-xl pointer-events-none transition-all duration-150">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px] uppercase tracking-wider text-cyan-400 font-mono font-medium">
              {hoveredOrgan.system}
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              Sat {hoveredOrgan.perfusionSat}%
            </span>
          </div>
          <h4 className="text-base font-bold text-white mb-1">{hoveredOrgan.name}</h4>
          <p className="text-xs text-slate-300 mb-2 leading-relaxed">{hoveredOrgan.description}</p>
          <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-1 text-[11px] font-mono text-slate-400">
            <div>
              <span className="text-cyan-300">Status: </span>
              {hoveredOrgan.dynamicState}
            </div>
            <div>
              <span className="text-amber-300">Clinical: </span>
              {hoveredOrgan.clinicalImplication}
            </div>
          </div>
        </div>
      )}

      {/* Physiological Feedback Pill (Hypoxia status) */}
      <div className="absolute bottom-18 left-4 z-10 pointer-events-none">
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-900/85 border border-slate-700/70 backdrop-blur-md shadow-lg">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              spo2 < 90
                ? 'bg-red-500 shadow-[0_0_8px_#ef4444]'
                : spo2 < 94
                ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]'
                : 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
            }`}
          />
          <span className="text-xs font-mono text-slate-200">
            Tissue Perfusion:{' '}
            <strong
              className={
                spo2 < 90 ? 'text-red-400 font-semibold' : spo2 < 94 ? 'text-amber-300 font-semibold' : 'text-emerald-400 font-semibold'
              }
            >
              {spo2 < 90 ? 'HYPOXIC ISCHEMIA' : spo2 < 94 ? 'BORDERLINE DESAT' : 'OPTIMAL EXCHANGE'}
            </strong>
          </span>
        </div>
      </div>

      {/* Bottom Layer Selector Dock */}
      <div className="mt-auto relative z-10 p-3 flex items-center justify-center">
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/85 border border-slate-700/80 rounded-xl backdrop-blur-xl shadow-2xl">
          <span className="text-[11px] font-medium text-slate-400 px-2 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            Layer:
          </span>
          <button
            onClick={() => onLayerChange('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeLayer === 'all'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            All Systems
          </button>
          <button
            onClick={() => onLayerChange('cardiac')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeLayer === 'cardiac'
                ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Cardiovascular
          </button>
          <button
            onClick={() => onLayerChange('respiratory')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeLayer === 'respiratory'
                ? 'bg-gradient-to-r from-sky-500 to-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Pulmonary & Airway
          </button>
          <button
            onClick={() => onLayerChange('vascular')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeLayer === 'vascular'
                ? 'bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            Microcirculation
          </button>
        </div>
      </div>
    </div>
  );
};
