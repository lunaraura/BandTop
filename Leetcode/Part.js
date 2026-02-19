class Drawer {
  constructor(camera, canvas, sm) {
    this.camera = camera;
    this.canvas = canvas;
    this.sm = sm;
    this.cache = new RenderCache();

    // tweakables
    this.bgFps = 15;          // background refresh cap
    this.layerFps = 12;       // per-layer refresh cap (noise drift etc.)
    this._lastSkySig = "";
  }

  drawBackground(now) {
    const w = this.canvas.width, h = this.canvas.height;

    // --- SKY cache (gradient + sun). Depends on time/dayFactor only ---
    const sky = this.cache.get("bg:sky", w, h);
    const skySig = this._skySignature(now); // string or small number tuple
    if (sky.dirty || sky.last !== skySig || this._shouldRedraw(now, sky, this.bgFps)) {
      this._renderSky(sky.ctx, w, h, now);
      sky.last = skySig;
      sky.dirty = false;
    }
    ctx.drawImage(sky.canvas, 0, 0);

    // --- STARS cache (optional separate). Depends on time + settings ---
    if (backgroundSettings.stars.enabled) {
      const stars = this.cache.get("bg:stars", w, h);
      const starSig = this._starsSignature(now);
      if (stars.dirty || stars.last !== starSig || this._shouldRedraw(now, stars, this.bgFps)) {
        stars.ctx.clearRect(0, 0, w, h);
        this._renderStars(stars.ctx, w, h, now);
        stars.last = starSig;
        stars.dirty = false;
      }
      ctx.drawImage(stars.canvas, 0, 0);
    }

    // --- LAYERS cache (mountains/hills/trees silhouettes + noise overlay) ---
    for (const layerKey of ["mountains", "hills", "trees"]) {
      const layer = backgroundSettings[layerKey];
      if (!layer?.enabled) continue;

      const key = `bg:layer:${layerKey}`;
      const lay = this.cache.get(key, w, h);

      // signature should include the things that affect pixels:
      // time/dayFactor -> colors/opacity, plus "drift phase" if noise moves
      const sig = this._layerSignature(layerKey, now);

      if (lay.dirty || lay.last !== sig || this._shouldRedraw(now, lay, this.layerFps)) {
        lay.ctx.clearRect(0, 0, w, h);
        this._renderLayer(lay.ctx, layerKey, w, h, now);
        lay.last = sig;
        lay.dirty = false;
      }

      ctx.drawImage(lay.canvas, 0, 0);
    }
  }

  _shouldRedraw(now, cacheItem, fps) {
    // now is ms from rAF; cacheItem._t is last draw time in ms
    const every = 1000 / fps;
    const t = cacheItem._t ?? -1e9;
    if (now - t >= every) { cacheItem._t = now; return true; }
    return false;
  }

  _skySignature(now) {
    const time = (now * timeSettings.dayNightCycleSpeed) % 1;
    // quantize to reduce redraw churn
    const qt = (time * 240) | 0; // 240 steps per cycle
    return `t:${qt}`;
  }

  _starsSignature(now) {
    const time = (now * timeSettings.dayNightCycleSpeed) % 1;
    const qt = (time * 180) | 0;
    return `t:${qt}`;
  }

  _layerSignature(layerKey, now) {
    const time = (now * timeSettings.dayNightCycleSpeed) % 1;
    const qt = (time * 180) | 0;

    // if you drift noise by now, include a coarser drift phase:
    const driftPhase = ((now * 0.00008) * 120) | 0;

    // include settings that matter (frequency/panSpeed/baseHeight)
    const layer = backgroundSettings[layerKey];
    const f = layer.frequency ?? 0;
    const p = layer.panSpeed ?? 0;
    const b = layer.baseHeight ?? 0;

    return `${layerKey}|t:${qt}|d:${driftPhase}|f:${f}|p:${p}|b:${b}`;
  }

  _renderSky(g, w, h, now) {
    const time = (now * timeSettings.dayNightCycleSpeed) % 1;
    const dayFactor = 0.5 + 0.5 * Math.cos(time * Math.PI * 2);

    const topSkyColor = this.blendColors({
      midnight: backgroundSettings.sky.colors.midnight.top,
      noon: backgroundSettings.sky.colors.noon.top,
      sunset: backgroundSettings.sky.colors.sunset.top
    }, dayFactor);
    const bottomSkyColor = this.blendColors({
      midnight: backgroundSettings.sky.colors.midnight.bottom,
      noon: backgroundSettings.sky.colors.noon.bottom,
      sunset: backgroundSettings.sky.colors.sunset.bottom
    }, dayFactor);

    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, topSkyColor);
    grad.addColorStop(1, bottomSkyColor);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);

    if (backgroundSettings.sun.enabled) {
      const pivotPoint = { x: 0, y: h };
      const sunAngle = time * Math.PI * 2 - Math.PI / 2;

      g.save();
      g.filter = "blur(3px)";
      const sunColor = this.blendColors(backgroundSettings.sun.colors, dayFactor);
      g.fillStyle = sunColor;

      const sunX = pivotPoint.x + Math.cos(sunAngle) * (w + timeSettings.sunPathHeight);
      const sunY = pivotPoint.y + Math.sin(sunAngle) * (w + timeSettings.sunPathHeight);

      const alphaBase = timeSettings.timeOpacities.day.sun ?? 1.0;
      g.globalAlpha = alphaBase * ((dayFactor <= 0.5) ? (1 - dayFactor) / 0.5 : 1);

      g.beginPath();
      g.arc(sunX, sunY, timeSettings.sunSize, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }

  _renderStars(g, w, h, now) {
    const time = (now * timeSettings.dayNightCycleSpeed) % 1;
    const dayFactor = 0.5 + 0.5 * Math.cos(time * Math.PI * 2);
    const colorBlendFactor = dayFactor;

    const starAngle = (time * backgroundSettings.stars.panSpeed * Math.PI * 2) % (Math.PI * 2);
    g.fillStyle = this.blendColors(backgroundSettings.stars.colors, colorBlendFactor);

    // Important: don’t call Math.random() per star per frame if you want stable stars.
    // Use noise on i so positions are stable.
    const count = backgroundSettings.stars.frequency | 0;
    for (let i = 0; i < count; i++) {
      const starX = starAngle * 100 + (noise1D(i * 0.9, 1234) + 1) * w;
      const starY = starAngle * 1000 + (noise1D(i * 0.9, 4321) + 1) * h;

      const tw = 0.5 + 0.5 * Math.sin(time * 10 + i * 0.7);
      const starSize = Math.max(0.5, (noise1D(i * 0.1, 5557) * 1.5) * (0.6 + 1.0 * tw));

      g.beginPath();
      g.arc(starX, starY, starSize, 0, Math.PI * 2);
      g.fill();
    }
  }

  _renderLayer(g, layerKey, w, h, now) {
    const layer = backgroundSettings[layerKey];

    const time = (now * timeSettings.dayNightCycleSpeed) % 1;
    const dayFactor = 0.5 + 0.5 * Math.cos(time * Math.PI * 2);
    const layerColor = this.blendColors(layer.colors, dayFactor);

    const newGrad = g.createLinearGradient(0, 0, 0, h);
    newGrad.addColorStop(0, layerColor);
    newGrad.addColorStop(1, "black");
    g.fillStyle = newGrad;

    // Build + fill silhouette path
    this._buildParallaxPathInto(g, layerKey, layer.frequency, layer.panSpeed, w, h, layer.baseHeight);
    g.fill();

    // Clip + overlay material (cheap version: stamp pre-baked blob tile)
    g.save();
    g.clip();

    const strength = layerKey === "mountains" ? 0.22 : layerKey === "hills" ? 0.16 : 0.12;
    const scale    = layerKey === "mountains" ? 2.2  : layerKey === "hills" ? 1.7  : 1.3;
    this._drawBlobOverlayInto(g, w, h, now, strength, scale, "multiply");

    g.restore();
  }

  _buildParallaxPathInto(g, layerKey, frequency, panSpeed, w, h, baseH) {
    const offset = (panSpeed * 0.5) % w;
    g.beginPath();
    let y = h * 0.6 * baseH;

    for (let x = -w; x < w * 2; x += 10) {
      const noiseVal = noise2D((x + offset) * frequency, layerKey.charCodeAt(0));
      const waveY = y + noiseVal * 20;
      if (x === -w) g.moveTo(x, waveY);
      else g.lineTo(x, waveY);
    }

    g.lineTo(w * 2, h);
    g.lineTo(-w, h);
    g.closePath();
  }

  _ensureBlobNoise() {
    if (this._blob) return;
    const s = 192;
    const c = document.createElement("canvas");
    c.width = c.height = s;
    const g = c.getContext("2d");

    for (let i = 0; i < 220; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const r = 8 + Math.random() * 28;

      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, "rgba(0,0,0,0.22)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }

    this._blob = c;
  }

  _drawBlobOverlayInto(g, w, h, now, strength = 0.18, scale = 1.0, mode = "multiply") {
    this._ensureBlobNoise();
    const tile = this._blob;

    const tw = tile.width * scale;
    const th = tile.height * scale;

    const t = (now ?? 0) * 0.00008;
    const ox = (Math.cos(t) * tw) | 0;
    const oy = (Math.sin(t * 1.3) * th) | 0;

    const prevComp = g.globalCompositeOperation;
    const prevAlpha = g.globalAlpha;

    g.globalCompositeOperation = mode;
    g.globalAlpha = strength;

    for (let y = -th; y < h + th; y += th) {
      for (let x = -tw; x < w + tw; x += tw) {
        g.drawImage(tile, x - ox, y - oy, tw, th);
      }
    }

    g.globalAlpha = prevAlpha;
    g.globalCompositeOperation = prevComp;
  }
}
