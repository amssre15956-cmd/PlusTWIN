# 3D Cardiopulmonary Digital Twin Component Card

Moves the 3D Real-Life Lung and Heart Simulator from the full-screen background into a dedicated compact glassmorphic component card positioned alongside the patient and vitals panels, restoring the full-viewport cinematic background video and veil.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> **Summary of Confirmed Choices:**
> - **Card Placement**: Dedicated 3D cardiopulmonary digital twin component card positioned cleanly alongside the virtual patient vitals and forecast panels.
> - **Background Video**: Restores the cinematic background video loop as the full-viewport backdrop behind all frosted glassmorphic cards with the subtle veil gradient.
> - **Self-Contained 3D Simulator Inside Card**: The Three.js WebGL canvas is mounted strictly inside the component card with OrbitControls constrained to the card's boundary.
> - **Embedded Controls & Telemetry**: Includes card-level system filter tabs (`All Systems`, `Cardio`, `Pulmonary`, `Vascular`), mini diagnostic telemetry overlay, organ hover inspection, cardiac beating, out-of-sync breathing, and alveolar gas exchange color shifting.

---

### 1. Overview & Core Concept

Transitioning the 3D simulator into a dedicated component card elevates dashboard usability:
- The physician can view the patient's quantitative vitals, AI hypoxemia predictions, and 3D organ simulation concurrently in structured visual zones.
- The cinematic background video and subtle veil once again provide atmospheric depth without competing for GPU canvas clicks.

---

### 2. User Experience & Visual Design

#### A. Dedicated 3D Twin Card Layout
- **Container**: Glassmorphic panel with moving Web3 chromatic aura light border (`.aura-active`) and subtle inner reflections.
- **Header**:
  - Title: `3D Cardiopulmonary Twin` with live heartbeat icon.
  - Telemetry badge: Dynamic heart rate / respiration frequency synced to patient data.
  - Quick action controls: Camera reset, view rotation toggle.
- **Embedded WebGL Viewport**:
  - Contained Three.js canvas with OrbitControls (drag to rotate, scroll to zoom inside card).
  - Procedural 3D Heart (left & right ventricles, aorta with branches, superior/inferior vena cava, pulmonary trunk) beating rhythmically.
  - Transparent paired lungs wrapping around the heart, expanding/contracting out-of-sync with alveolar gas exchange color shifts.
  - Microcirculation corpuscle flow particles.
- **Bottom Filter Dock**:
  - Embedded segmented filter pills: `All Systems`, `Cardio`, `Pulmonary`, `Vascular` to isolate organs directly inside the card.
- **Diagnostic Tag**:
  - Non-intrusive HUD overlay displaying airway status, cardiac ejection, and tissue oxygenation.

#### B. Dashboard Harmony
- **Patient Panel & Forecast Panel**: Side-by-side with the 3D Twin Card.
- **Alert & Simulation Panels**: Dedicated action and trajectory modeling.
- **History & Evaluation Panels**: SVG trendlines and model performance metrics.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision: Scoped Card Canvas vs. Full-Viewport Canvas**
  - *Chosen Approach*: Bind the Three.js renderer and raycasting strictly to the container bounds of the 3D Twin card (`parent.clientWidth` × `parent.clientHeight`).
  - *Why*: Prevents mouse drags on other clinical panels from inadvertently rotating the 3D model, and allows clean scrolling on mobile/tablet viewports while preserving desktop 1536×1024 locked coordinates.

---

### 4. Technical Architecture & System Flow

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          PULSE-TWIN CONSOLE DOM                           │
└───────────────────────────────────────────────────────────────────────────┘
                                     │
      ┌──────────────────────────────┴──────────────────────────────┐
      ▼                                                             ▼
┌───────────────────────────┐                         ┌─────────────────────┐
│  Full-Viewport Background │                         │  Dashboard Console  │
│  • Cinematic Video Loop   │                         │  • Top Navigation   │
│  • Subtle Dual Veil       │                         │  • Clinical Grid    │
└───────────────────────────┘                         └──────────┬──────────┘
                                                                 │
                 ┌───────────────────────────────────────────────┴──────────────────────┐
                 ▼                                                                      ▼
    ┌──────────────────────────┐                                           ┌──────────────────────────┐
    │  3D Twin Component Card  │                                           │  Clinical Telemetry HUD  │
    │  • Card-Scoped WebGL     │                                           │  • Virtual Patient Vitals│
    │  • Heartbeat & Breathing │ ◄──── Telemetry Sync (SpO2 & HRV) ─────── │  • 30m Forecast & Alert  │
    │  • Gas Exchange Glow     │                                           │  • SVG History & Sim     │
    │  • Embedded Filter Dock  │                                           │  • Model Evaluation KPIs │
    │  • Aura Light Border     │                                           │  • Web3 Aura Glass Cards │
    └──────────────────────────┘                                           └──────────────────────────┘
```
