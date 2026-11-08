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
