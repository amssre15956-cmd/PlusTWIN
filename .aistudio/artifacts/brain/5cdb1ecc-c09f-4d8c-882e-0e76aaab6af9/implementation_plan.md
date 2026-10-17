# Implementation Plan — Advanced Clinical Enhancements & Responsive Audio

Integrate 6 clinical decision-support and visual simulation enhancements alongside a responsive Web Audio cardiac synthesis engine into the Pulse-Twin AI console.

---

## User-Confirmed Architecture Decisions
1. **Waveform Placement**: Integrated tabs (`[3D Organ Twin]`, `[Lead-II ECG]`, `[Mechanical Ventilator]`) positioned directly within the dedicated Digital Twin card, enabling rapid switching without cluttering the console layout.
2. **SBAR Voice Briefing Presentation**: Audio speech synthesis utilizing the browser's native `SpeechSynthesis` API with an animated, frosted glass synchronized text transcript banner showing real-time word highlights, play/pause, and replay controls.
3. **Audio Button Responsiveness**: Immediate audio feedback, audio context wake-up on click/pointerdown, clear visual state (`🔊 Active` vs `🔇 Muted`), pulse waves, and fallback test tone to ensure instantaneous response across all browser configurations.

---

## Proposed Changes & Enhancements

### 1. Responsive Web Audio API Engine & Feedback
- Refactor the Web Audio engine in `index.html` to guarantee instant initialization:
  - Immediate `audioCtx.resume()` and unlocking on pointerdown/click.
  - Generate an audible subtle acoustic confirmation chirp on unmuting so clinicians immediately confirm audio output.
  - Visual audio waves pulsing in sync with the heart rate on the `#btn-audio-toggle` element.
  - Volume slider and state retention.

### 2. Live Lead-II Phosphor ECG Rhythm Strip (Canvas Sweep Monitor)
- High-fidelity green/cyan phosphor sweep canvas embedded in the Digital Twin card tab.
- Procedural P-QRS-T mathematical generation synchronized precisely to cardiac systole and diastole.
- Real-time crisis morphing:
  - **Normal Baseline**: Clean P, sharp QRS spike, calibrated ST segment ($72\text{ bpm}$).
  - **Ventricular Tachycardia**: Wide, bizarre QRS complexes at $165\text{ bpm}$ with lost P-waves.
  - **Tension Pneumothorax**: Progressive electrical alternans and voltage dampening.
  - **Acute Hypoxemia**: ST-segment depression ($>2\text{ mm}$) and inverted T-waves.

### 3. Oxygenation-Gradient Blood Flow Velocity Vectors
- Enhance the Three.js particle system with bifurcated arterial and venous streams:
  - **Oxygenated Arterial Circulation** (Left Ventricle $\rightarrow$ Aortic Arch $\rightarrow$ Systemic Branches): High velocity ($1.8\times$), bright scarlet red (`#ef4444` / `#ff3344`), representing $99\%\ \text{SpO}_2$.
  - **Deoxygenated Venous Circulation** (Vena Cava $\rightarrow$ Right Ventricle $\rightarrow$ Pulmonary Trunk): Medium velocity, deep cobalt navy (`#2563eb`), representing $72\%\ \text{SvO}_2$.
  - **Hypoxic Desaturation**: When $\text{SpO}_2 < 90\%$ or crisis severity $> 0$, the arterial stream visibly desaturates to dark violet-crimson with turbulent speed irregularities.

### 4. Bedside Mechanical Ventilator Waveforms ($P_{\text{aw}}$, Flow, Volume)
- Dynamic ventilator scalar graphics running on an animated canvas:
  - **Airway Pressure ($P_{\text{aw}}$)**: Displays PEEP ($5\ \text{cmH}_2\text{O}$), Plateau Pressure ($P_{\text{plat}}$), and Peak Inspiratory Pressure ($P_{\text{peak}}$).
  - **Flow ($\text{L/min}$)**: Inspiratory ramp and expiratory decay curve.
  - **Tidal Volume ($V_t$)**: $500\ \text{mL}$ lung breath integration curve.
- Dynamic crisis coupling:
  - **Massive Bronchospasm**: $P_{\text{peak}}$ spikes to $38\ \text{cmH}_2\text{O}$ with expiratory flow limitation ("scooping").
  - **Tension Pneumothorax**: Dynamic compliance collapses, precipitous drop in delivered tidal volume.

### 5. SBAR Shift Handoff Audio Voice Briefing & Synchronized Transcript
- Dedicated *"🎙️ SBAR Audio Handoff"* trigger button in the clinical bar.
- Uses `window.speechSynthesis` with tailored medical prosody and fallback simulation.
- Generates a clinical SBAR briefing:
  - **Situation**: Bed ID, patient name, age, primary diagnosis.
  - **Background**: Baseline pulmonary condition (COPD, post-op recovery, ARDS).
  - **Assessment**: Current $\text{SpO}_2$, HRV, and 30-minute machine-learning hypoxemic deterioration risk.
  - **Recommendation**: Priority interventions (titrate $\text{FiO}_2$, nebulized albuterol, order stat ABG).
- Synchronized floating translucent transcript banner with live reading highlight and playback controls.

### 6. Holographic 3D Caliper & Chamber Measurement Tool in Cinema Mode
- In **Fullscreen Cinema Mode**, toggle a holographic caliper tool.
- Click two points on the 3D cardiopulmonary twin to render a glowing neon measurement beam with calculated anatomical dimensions:
  - LV Internal Diameter ($4.8\ \text{cm}$)
  - Aortic Root Caliber ($3.1\ \text{cm}$)
  - Tracheal Lumen ($1.8\ \text{cm}$)

### 7. ICU Ward Quick-Triage Heatmap (SOFA / MEWS Matrix)
- In the ICU Ward Multi-Bed View, add a comprehensive triage matrix table/grid.
- Calculates and visualizes:
  - Modified Early Warning Score (MEWS: 0–14)
  - Sequential Organ Failure Assessment (SOFA: 0–24)
  - Color-coded risk badges across all 8 ward beds, allowing immediate priority triage.

---

## Verification Plan
1. **Compilation Check**: Run `compile_applet` and `lint_applet` to verify zero build or syntax errors.
2. **Audio Button Verification**: Ensure audio starts reliably on the first click with clear unmuted audio feedback and responsive state indicator.
3. **Waveform Tab Switching**: Test seamless switching between `3D Organ Twin`, `Lead-II ECG`, and `Mechanical Ventilator`.
4. **Crisis Reaction**: Verify ECG wave morphing, ventilator pressure spikes, and particle desaturation when activating each crisis type.
5. **Speech Synthesis**: Confirm speech utterance triggers correctly with synchronized transcript banner.
6. **Ward Triage Matrix**: Confirm all 8 beds show accurate SOFA/MEWS scores and deep dive correctly.
