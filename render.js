// 毛豆乐园 - 像素渲染公共库
// 像素小人 + 粒子 + HUD，全部 canvas 手绘像素风

export const PAL = {
  sky: '#7ec8e3', ground: '#5aa437', groundDark: '#3d7a26',
  skin: '#f4c18c', hair: '#4a2f1b', shirt: '#e23d3d', pants: '#3b5bb5',
  white: '#ffffff', black: '#1a1a1a', yellow: '#ffd93d', red: '#e23d3d',
  green: '#5aa437', purple: '#9b59b6', orange: '#ff9f43', cyan: '#3dd6d0'
};

// 画一个像素小人（火柴人风格，16px 逻辑像素放大）
// pose: {armL, armR, legL, legR, jump, lean} 各为 -1..1 角度系数
export function drawKid(ctx, x, y, scale, pose = {}, color = PAL.shirt) {
  const armL = pose.armL ?? 0, armR = pose.armR ?? 0;
  const legSpread = pose.legSpread ?? 1;
  const jump = pose.jump ?? 0;
  const s = scale;
  const px = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x + dx * s), Math.round(y + dy * s - jump * s * 6), Math.max(1, w * s), Math.max(1, h * s)); };
  // 腿
  px(-3 * legSpread - 2, 14, 3, 7, PAL.pants);
  px(2 * legSpread, 14, 3, 7, PAL.pants);
  px(-3 * legSpread - 2, 21, 3, 2, PAL.black);
  px(2 * legSpread, 21, 3, 2, PAL.black);
  // 身体
  px(-3, 7, 7, 7, color);
  // 手臂（简单摆动）
  px(-6, 8 + armL * 3, 3, 6, color);
  px(4, 8 + armR * 3, 3, 6, color);
  px(-6, 13 + armL * 5, 3, 2, PAL.skin);
  px(4, 13 + armR * 5, 3, 2, PAL.skin);
  // 头
  px(-3, -1, 7, 7, PAL.skin);
  px(-3, -2, 7, 2, PAL.hair);
  px(-1, 1, 1, 2, PAL.black); // 眼
  px(2, 1, 1, 2, PAL.black);
  px(0, 4, 2, 1, PAL.red);    // 嘴
}

export class Particles {
  constructor() { this.list = []; }
  burst(x, y, color, n = 12, power = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.list.push({ x, y, vx: Math.cos(a) * power * (0.5 + Math.random()), vy: Math.sin(a) * power * (0.5 + Math.random()) - 1, life: 1, color });
    }
  }
  update(dt) {
    this.list = this.list.filter(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= dt * 2;
      return p.life > 0;
    });
  }
  draw(ctx) {
    for (const p of this.list) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 4, 4);
    }
    ctx.globalAlpha = 1;
  }
}

// 画像素云和地面背景
export function drawScene(ctx, w, h, t) {
  ctx.fillStyle = PAL.sky; ctx.fillRect(0, 0, w, h);
  // 云
  const cloud = (cx, cy, s) => {
    ctx.fillStyle = PAL.white;
    ctx.fillRect(cx, cy, 16 * s, 6 * s);
    ctx.fillRect(cx + 3 * s, cy - 4 * s, 10 * s, 6 * s);
    ctx.fillRect(cx - 3 * s, cy + 2 * s, 22 * s, 3 * s);
  };
  cloud(((t * 12) % (w + 120)) - 100, 30, 2);
  cloud(((t * 20 + 300) % (w + 160)) - 130, 70, 3);
  // 地面
  const gy = h - 40;
  ctx.fillStyle = PAL.ground; ctx.fillRect(0, gy, w, 40);
  ctx.fillStyle = PAL.groundDark;
  for (let x = 0; x < w; x += 16) ctx.fillRect(x, gy, 8, 4);
  for (let x = 8; x < w; x += 24) ctx.fillRect(x, gy + 12, 4, 4);
}

export function drawText(ctx, text, x, y, size, color = PAL.black, align = 'left') {
  ctx.font = `${size}px "Press Start 2P", monospace`;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// 像素边框面板
export function drawPanel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(26,26,26,0.85)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PAL.yellow; ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
}
