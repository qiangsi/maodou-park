// 毛豆乐园 - 像素体感引擎：摄像头动作识别 + 麦克风音量
// 全部本地识别，不录像不上传。

export function startCamera(video, previewCanvas) {
  return navigator.mediaDevices.getUserMedia({
    video: { width: 320, height: 240, facingMode: 'user' }, audio: false
  }).then(stream => {
    video.srcObject = stream;
    video.play();
    return stream;
  });
}

export function stopStream(stream) {
  if (stream) stream.getTracks().forEach(t => t.stop());
}

// ---------- 摄像头动作识别（帧差法） ----------
export class MotionSensor {
  constructor(video, gw = 32, gh = 24) {
    this.video = video;
    this.gw = gw; this.gh = gh;
    this.canvas = document.createElement('canvas');
    this.canvas.width = gw; this.canvas.height = gh;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.prev = null;      // 上一帧灰度
    this.cur = null;       // 当前帧灰度
    this.motionGrid = new Float32Array(gw * gh); // 每格运动量 0..1
    this.totalMotion = 0;
    this.movingPixels = 0;
    this.ready = false;
    // 手部跟踪：运动质心 + 速度（归一化坐标）
    this.handX = 0.5; this.handY = 0.5;
    this.handVX = 0; this.handVY = 0;
    this.handSpeed = 0;
    this.handSeen = false;
    this.handTrail = []; // 最近若干个手位置 {x,y,t}
  }
  update() {
    if (!this.video || this.video.readyState < 2) return;
    const { ctx, gw, gh } = this;
    ctx.save();
    ctx.translate(gw, 0); ctx.scale(-1, 1); // 镜像，符合直觉
    try { ctx.drawImage(this.video, 0, 0, gw, gh); } catch (e) { ctx.restore(); return; }
    ctx.restore();
    const d = ctx.getImageData(0, 0, gw, gh).data;
    const gray = new Uint8Array(gw * gh);
    for (let i = 0; i < gw * gh; i++) {
      gray[i] = (d[i * 4] * 3 + d[i * 4 + 1] * 4 + d[i * 4 + 2]) >> 3;
    }
    this.prev = this.cur; this.cur = gray;
    if (!this.prev) { this.ready = true; return; }
    const grid = this.motionGrid;
    let total = 0, moving = 0;
    grid.fill(0);
    for (let i = 0; i < gw * gh; i++) {
      const diff = Math.abs(this.cur[i] - this.prev[i]);
      if (diff > 18) {
        const m = Math.min(1, diff / 80);
        grid[i] = m; total += m; moving++;
      }
    }
    this.totalMotion = total;
    this.movingPixels = moving;
    // 质心 = 手的位置（取运动最集中的上半身区域加权质心）
    if (moving > 2) {
      let sx = 0, sy = 0, sw = 0;
      for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
        const m = grid[gy * gw + gx];
        if (m > 0.1) { sx += gx * m; sy += gy * m; sw += m; }
      }
      if (sw > 0) {
        const nx = sx / sw / gw, ny = sy / sw / gh;
        if (this.handSeen) {
          // 平滑 + 限速（防跳动）：位置突变过大时认为是另一只手，直接跟
          const dx = nx - this.handX, dy = ny - this.handY;
          const dist = Math.hypot(dx, dy);
          const k = dist > 0.3 ? 1 : 0.5;
          this.handVX = dx * k / 0.033; this.handVY = dy * k / 0.033; // 近似每秒速度
          this.handX = this.handX + dx * k; this.handY = this.handY + dy * k;
          this.handSpeed = Math.hypot(this.handVX, this.handVY);
        } else {
          this.handX = nx; this.handY = ny; this.handSeen = true;
        }
        this.handTrail.push({ x: this.handX, y: this.handY, t: performance.now() });
        if (this.handTrail.length > 14) this.handTrail.shift();
      }
    } else {
      this.handSpeed *= 0.8;
    }
    this.ready = true;
  }
  // 某个区域(归一化 x,y,w,h)的运动量
  regionMotion(x, y, w, h) {
    let s = 0;
    const x0 = Math.max(0, Math.floor(x * this.gw)), x1 = Math.min(this.gw, Math.ceil((x + w) * this.gw));
    const y0 = Math.max(0, Math.floor(y * this.gh)), y1 = Math.min(this.gh, Math.ceil((y + h) * this.gh));
    for (let gy = y0; gy < y1; gy++) for (let gx = x0; gx < x1; gx++) s += this.motionGrid[gy * this.gw + gx];
    return s;
  }
}

// 把像素化的你自己画进游戏背景（镜像、半透明，让玩家看到自己在屏幕里）
export function drawSelfBehind(ctx, sensor, W, H, alpha = 0.45) {
  if (!sensor.ready || !sensor.cur) return;
  const { gw, gh } = sensor;
  const cw = W / gw, ch = H / gh;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const g = sensor.cur[y * gw + x];
    ctx.globalAlpha = alpha * (0.5 + 0.5 * g / 255);
    ctx.fillStyle = `rgb(${(g * 0.9) | 0},${(g * 0.95) | 0},${(g * 1.1) | 0})`;
    ctx.fillRect(x * cw, y * ch, cw + 1, ch + 1);
  }
  ctx.globalAlpha = 1;
}

// 画手部轨迹刀光（切水果用）：手的位置 + 最近轨迹 + 速度
export function drawHandCursor(ctx, sensor, W, H, color = PAL.yellow) {
  if (!sensor.handSeen) return;
  const hx = sensor.handX * W, hy = sensor.handY * H;
  // 刀光轨迹
  for (let i = 1; i < sensor.handTrail.length; i++) {
    const a = sensor.handTrail[i - 1], b = sensor.handTrail[i];
    const age = i / sensor.handTrail.length;
    ctx.globalAlpha = age * 0.7;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, age * 8);
    ctx.beginPath();
    ctx.moveTo(a.x * W, a.y * H);
    ctx.lineTo(b.x * W, b.y * H);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // 手准星
  const s = 10 + Math.min(14, sensor.handSpeed * 20);
  ctx.fillStyle = color;
  ctx.fillRect(hx - s / 2, hy - 2, s, 4);
  ctx.fillRect(hx - 2, hy - s / 2, 4, s);
  ctx.fillStyle = PAL.white;
  ctx.fillRect(hx - 2, hy - 2, 4, 4);
}

// 把摄像头小图（网格级）画到预览画布上，叠加运动高亮
export function drawPreview(sensor, previewCanvas, highlightFn) {
  if (!sensor.ready) return;
  const c = previewCanvas.getContext('2d');
  const { gw, gh } = sensor;
  c.imageSmoothingEnabled = false;
  const cw = previewCanvas.width, ch = previewCanvas.height;
  const px = cw / gw, py = ch / gh;
  c.clearRect(0, 0, cw, ch);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const i = y * gw + x;
    const g = sensor.cur ? sensor.cur[i] : 0;
    c.fillStyle = `rgb(${g},${g},${g})`;
    c.fillRect(x * px, y * py, px + 1, py + 1);
    if (sensor.motionGrid[i] > 0.05) {
      c.fillStyle = 'rgba(80,255,120,0.55)';
      c.fillRect(x * px, y * py, px + 1, py + 1);
    }
  }
  if (highlightFn) highlightFn(c, px, py);
}

// ---------- 麦克风音量 ----------
export class MicSensor {
  constructor() { this.volume = 0; this.ready = false; }
  start() {
    return navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      this.stream = stream;
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ac = new AC();
      const src = this.ac.createMediaStreamSource(stream);
      this.analyser = this.ac.createAnalyser();
      this.analyser.fftSize = 512;
      src.connect(this.analyser);
      this.buf = new Uint8Array(this.analyser.fftSize);
      this.ready = true;
    });
  }
  update() {
    if (!this.ready) return;
    this.analyser.getByteTimeDomainData(this.buf);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i++) {
      const v = (this.buf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.buf.length);
    this.volume = Math.min(1, rms * 6); // 0..1，喊叫≈1
  }
  stop() {
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.ac) this.ac.close();
    this.ready = false; this.volume = 0;
  }
}
