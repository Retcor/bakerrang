# Sign vendor assets

- MediaPipe Tasks Vision 0.10.34 — Apache-2.0. Build copies its required WASM runtime from the installed package.
- MediaPipe Hand Landmarker float16 v1 — downloaded from `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task` on 2026-09-25. SHA-256: `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1` (7,819,105 bytes).
- fingerpose 0.1.0 — MIT.

The generated `public/vendor/` directory is deliberately ignored. `vendor-vision.cjs` verifies the model before it is served.
