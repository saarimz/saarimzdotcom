(() => {
  const canvas = document.getElementById("sound-visualizer");
  if (!(canvas instanceof HTMLCanvasElement)) {
    return;
  }

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );

  const state = {
    centerX: 0,
    centerY: 0,
    driftX: 0,
    driftY: 0,
    history: [],
    pointerActive: false,
    pointerEnergy: 0,
    pointerX: 0,
    pointerY: 0,
    seed: 7411,
    time: 0,
  };

  const frequencyBinCount = 132;
  const maxHistory = 26;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let lastFrame = performance.now();

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!state.centerX || !state.centerY) {
      state.centerX = width * 0.66;
      state.centerY = height * 0.36;
      state.pointerX = state.centerX;
      state.pointerY = state.centerY;
    }
  }

  function handlePointerMove(event) {
    state.pointerActive = true;
    state.pointerX = event.clientX;
    state.pointerY = event.clientY;
    state.pointerEnergy = Math.min(0.72, state.pointerEnergy + 0.035);
  }

  function handlePointerLeave() {
    state.pointerActive = false;
  }

  function syntheticFrequencyFrame(time) {
    const bins = new Float32Array(frequencyBinCount);
    const pulse = 0.5 + Math.sin(time * 0.82) * 0.5;
    const slowPulse = 0.5 + Math.sin(time * 0.26 + 1.8) * 0.5;
    const pointerLift = state.pointerEnergy * 0.22;

    for (let index = 0; index < bins.length; index += 1) {
      const position = index / bins.length;
      const bass = Math.exp(-Math.pow((position - 0.12) * 7.5, 2)) * pulse;
      const mids =
        Math.exp(-Math.pow((position - 0.44) * 5.4, 2)) *
        (0.35 + slowPulse * 0.65);
      const air =
        Math.exp(-Math.pow((position - 0.78) * 6.2, 2)) *
        (0.18 + Math.sin(time * 0.34 + index * 0.09) * 0.12);
      const jitter =
        pseudoNoise(state.seed + index * 19, time * 0.05, position) * 0.08;
      bins[index] = clamp01((bass * 0.48 + mids * 0.36 + air * 0.22 + jitter + pointerLift) * 0.62);
    }

    return bins;
  }

  function draw(now) {
    const delta = Math.min(48, now - lastFrame);
    lastFrame = now;
    state.time += delta * 0.001;
    state.pointerEnergy *= state.pointerActive ? 0.97 : 0.91;

    const reduceMotion = prefersReducedMotion.matches;
    const driftSpeed = reduceMotion ? 0.04 : 0.16;
    const targetDriftX =
      Math.sin(state.time * 0.09 + 0.8) * width * 0.07 +
      Math.sin(state.time * 0.035) * width * 0.035;
    const targetDriftY =
      Math.cos(state.time * 0.075 + 2.4) * height * 0.055 +
      Math.sin(state.time * 0.026) * height * 0.04;
    state.driftX += (targetDriftX - state.driftX) * 0.01 * driftSpeed;
    state.driftY += (targetDriftY - state.driftY) * 0.01 * driftSpeed;

    const homeX = width * 0.66 + state.driftX;
    const homeY = height * 0.37 + state.driftY;
    const pointerPull = state.pointerActive ? 0.08 : 0;
    const targetX = homeX * (1 - pointerPull) + state.pointerX * pointerPull;
    const targetY = homeY * (1 - pointerPull) + state.pointerY * pointerPull;
    state.centerX += (targetX - state.centerX) * 0.024;
    state.centerY += (targetY - state.centerY) * 0.024;

    const bins = syntheticFrequencyFrame(state.time);
    state.history.push(bins);
    while (state.history.length > maxHistory) {
      state.history.shift();
    }

    context.clearRect(0, 0, width, height);
    drawSpectralBloom();
    drawWaveformRibbon(bins);
    drawLooseParticles(bins);

    window.requestAnimationFrame(draw);
  }

  function drawSpectralBloom() {
    const minDimension = Math.min(width, height);
    const centerX = state.centerX;
    const centerY = state.centerY;
    const pointerBoost = 1 + state.pointerEnergy * 0.28;
    const rotation =
      state.time * 0.018 + Math.sin(state.time * 0.08) * 0.065;

    context.save();
    context.translate(centerX, centerY);
    context.rotate(rotation);
    context.globalCompositeOperation = "source-over";
    context.lineCap = "round";
    context.lineJoin = "round";

    state.history.forEach((layer, layerIndex) => {
      const freshness = (layerIndex + 1) / state.history.length;
      const age = 1 - freshness;
      const baseRadius =
        minDimension * (0.07 + age * 0.18) * pointerBoost;
      const alpha = 0.032 + freshness * 0.12 + state.pointerEnergy * 0.035;

      for (let repeat = 0; repeat < 4; repeat += 1) {
        context.save();
        context.rotate((repeat / 4) * Math.PI * 2 + age * 0.24);
        context.beginPath();

        for (let index = 0; index <= layer.length; index += 1) {
          const wrappedIndex = index % layer.length;
          const energy = Math.pow(layer[wrappedIndex] || 0, 0.66);
          const angle =
            (index / layer.length) * Math.PI * 2 +
            Math.sin(state.time * 0.24 + index * 0.071) * 0.014;
          const radius =
            baseRadius +
            energy * minDimension * (0.08 + freshness * 0.08) +
            Math.sin(index * 0.11 + state.time * 0.52) * minDimension * 0.003;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius * 0.74;

          if (index === 0) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        }

        context.closePath();
        context.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
        context.lineWidth = 0.34 + freshness * 1.35 + state.pointerEnergy * 0.6;
        context.stroke();
        context.restore();
      }
    });

    context.restore();
  }

  function drawWaveformRibbon(bins) {
    const lineCount = 3;
    const centerY = state.centerY + Math.sin(state.time * 0.18) * 9;
    const span = Math.min(width * 0.54, 620);
    const startX = state.centerX - span / 2;

    context.save();
    context.globalCompositeOperation = "source-over";
    context.lineCap = "round";
    context.lineJoin = "round";

    for (let line = 0; line < lineCount; line += 1) {
      context.beginPath();
      const offset = (line - (lineCount - 1) / 2) * 14;

      for (let index = 0; index < 160; index += 1) {
        const position = index / 159;
        const bin = bins[(index * 3 + line * 9) % bins.length] || 0;
        const x = startX + position * span;
        const wave =
          Math.sin(position * Math.PI * 5 + state.time * (0.36 + line * 0.05)) *
          14 *
          (0.2 + bin + state.pointerEnergy * 0.12);
        const y =
          centerY +
          offset +
          wave +
          Math.sin(index * 0.09 + state.time * 0.38) * 2.5;

        if (index === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }

      context.strokeStyle = `rgba(0, 0, 0, ${0.045 + line * 0.022})`;
      context.lineWidth = 0.55 + line * 0.18 + state.pointerEnergy * 0.36;
      context.stroke();
    }

    context.restore();
  }

  function drawLooseParticles(bins) {
    const count = 72;
    const minDimension = Math.min(width, height);

    context.save();
    context.globalCompositeOperation = "source-over";

    for (let index = 0; index < count; index += 1) {
      const bin = bins[index % bins.length] || 0;
      const seed = state.seed + index * 101;
      const angle =
        pseudoNoise(seed, 0.2, bin) * Math.PI * 2 +
        state.time * 0.022 +
        bin * 0.32;
      const radius =
        minDimension *
        (0.08 + pseudoNoise(seed + 7, 0.4, bin) * 0.36) *
        (0.82 + state.pointerEnergy * 0.12);
      const x = state.centerX + Math.cos(angle) * radius;
      const y = state.centerY + Math.sin(angle * 0.84) * radius;
      const dotRadius = Math.max(0.28, 0.55 + bin * 1.4);

      context.fillStyle = `rgba(0, 0, 0, ${0.032 + bin * 0.07})`;
      context.beginPath();
      context.arc(x, y, dotRadius, 0, Math.PI * 2);
      context.fill();
    }

    context.restore();
  }

  function pseudoNoise(seed, time, energy) {
    return Math.sin(seed * 12.9898 + time * 78.233 + energy * 37.719) * 0.5 + 0.5;
  }

  function clamp01(value) {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(1, value));
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  window.addEventListener("pointerleave", handlePointerLeave, { passive: true });

  resize();
  window.requestAnimationFrame(draw);
})();
