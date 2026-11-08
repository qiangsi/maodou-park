// 毛豆乐园 - 四个体感游戏逻辑
import { PAL, drawKid, Particles, drawText, drawPanel } from './render.js';

// ---------- 1. 切水果（挥手） ----------
export function createFruitSlash() {
  const fruits = [];
  let score = 0, lives = 3, spawnT = 0, combo = 0, comboT = 0, bestCombo = 0;
  const particles = new Particles();
  const types = [
    { c: PAL.red, name: '苹果' }, { c: PAL.orange, name: '橙子' },
    { c: PAL.yellow, name: '香蕉' }, { c: PAL.purple, name: '葡萄' }
  ];
  function spawn(W, H) {
    if (Math.random() < 0.15) {
      fruits.push({ x: W / 2, y: H - 30, vx: (Math.random() - 0.5) * 6, vy: -14 - Math.random() * 4, r: 16, bomb: true, rot: 0 });
    } else {
      const t = types[(Math.random() * types.length) | 0];
      fruits.push({ x: W / 2 + (Math.random() - 0.5) * 200, y: H - 30, vx: (Math.random() - 0.5) * 7, vy: -13 - Math.random() * 5, r: 14, bomb: false, rot: 0, color: t.c });
    }
  }
  return {
    name: '切水果', icon: '🍉', desc: '挥手切开飞起的水果，炸弹别碰！', hands: true,
    init() { fruits.length = 0; score = 0; lives = 3; combo = 0; bestCombo = 0; },
    update(dt, S, W, H) {
      spawnT -= dt;
      if (spawnT <= 0) { spawn(W, H); spawnT = 0.9 + Math.random() * 0.8; }
      for (let i = fruits.length - 1; i >= 0; i--) {
        const f = fruits[i];
        f.x += f.vx; f.y += f.vy; f.vy += 0.35; f.rot += 0.1;
        // 挥手判定：水果位置附近有运动
        const nx = f.x / W, ny = f.y / H;
        const m = S.regionMotion(nx - 0.12, ny - 0.12, 0.24, 0.24);
        if (m > 0.8 && f.y < H - 60) {
          if (f.bomb) {
            lives--; particles.burst(f.x, f.y, PAL.black, 20, 5); combo = 0;
            if (lives <= 0) return { over: true, score, bestCombo };
          } else {
            score += 10 * (1 + combo); combo++; comboT = 1.2;
            bestCombo = Math.max(bestCombo, combo);
            particles.burst(f.x, f.y, f.color, 14, 4);
          }
          fruits.splice(i, 1); continue;
        }
        if (f.y > H + 30) { fruits.splice(i, 1); if (!f.bomb) { combo = 0; } }
      }
      if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
      return false;
    },
    draw(ctx, W, H, t) {
      for (const f of fruits) {
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
        ctx.fillStyle = f.bomb ? PAL.black : f.color;
        ctx.fillRect(-f.r, -f.r, f.r * 2, f.r * 2);
        ctx.fillStyle = f.bomb ? PAL.red : PAL.white;
        ctx.fillRect(-f.r + 3, -f.r + 3, 4, 4);
        if (f.bomb) { ctx.fillStyle = PAL.orange; ctx.fillRect(f.r - 2, -f.r - 5, 3, 5); }
        ctx.restore();
      }
      particles.draw(ctx);
      drawPanel(ctx, 8, 8, 150, 26);
      drawText(ctx, `得分 ${score}`, 16, 26, 12, PAL.yellow);
      drawPanel(ctx, W - 118, 8, 110, 26);
      drawText(ctx, '❤'.repeat(Math.max(0, lives)), W - 110, 26, 14, PAL.red);
      if (combo > 1) drawText(ctx, `连击 x${combo}!`, W / 2, 50, 14, PAL.orange, 'center');
      drawText(ctx, '挥手切水果！', W / 2, H - 8, 10, PAL.white, 'center');
    }
  };
}

// ---------- 2. 跳跳豆（跳跃检测：画面下部运动骤增） ----------
export function createJumpBean() {
  let score = 0, phase = 'ready', phaseT = 0, jumpCount = 0, wasAir = false, airT = 0, msg = '';
  const particles = new Particles();
  let beanY = 0, beanVy = 0, spikeX = 0, spikeActive = false;
  function startRound() { phase = 'go'; phaseT = 3; spikeX = Math.random(); spikeActive = true; msg = '跳！'; }
  return {
    name: '跳跳豆', icon: '🟢', desc: '刺球来了就跳起来躲开！', hands: false,
    init() { score = 0; jumpCount = 0; phase = 'countdown'; phaseT = 2; msg = '准备…'; beanY = 0; },
    update(dt, S, W, H) {
      // 跳跃检测：画面下半部运动量大幅上升
      const lower = S.regionMotion(0, 0.45, 1, 0.55);
      const jumping = lower > 6;
      if (jumping && !wasAir) { airT = 0.35; jumpCount++; }
      wasAir = jumping;
      if (airT > 0) { airT -= dt; beanVy = -1; } else beanVy = 0;
      // 简单物理展示
      if (airT > 0) beanY = Math.max(beanY - 6, -50); else beanY = Math.min(beanY + 6, 0);
      if (phase === 'countdown') { phaseT -= dt; if (phaseT <= 0) startRound(); return false; }
      if (phase === 'go') {
        phaseT -= dt;
        spikeX += dt * 0.25;
        // 刺球到达小人位置时检查是否在空中
        if (spikeX > 0.42 && spikeX < 0.55) {
          if (beanY > -18) {
            phase = 'over'; msg = '被扎到啦！';
            particles.burst(W * 0.48, H - 60, PAL.red, 20, 5);
            return { over: true, score: jumpCount * 10, best: jumpCount };
          }
        }
        if (spikeX > 1.1) { spikeX = -0.1; score += 50; }
        if (phaseT <= 0) { score += 100; phase = 'countdown'; phaseT = 1.2; msg = '下一波…'; spikeActive = false; }
      }
      return false;
    },
    draw(ctx, W, H, t) {
      // 刺球
      if (phase === 'go') {
        const sx = spikeX * W, sy = H - 46;
        ctx.fillStyle = PAL.purple;
        ctx.fillRect(sx - 8, sy - 8, 16, 16);
        ctx.fillStyle = PAL.black;
        for (let a = 0; a < 4; a++) ctx.fillRect(sx - 10 + a * 6, sy - 12, 3, 4);
      }
      // 小豆
      const bx = W * 0.48, by = H - 34 + beanY;
      ctx.fillStyle = PAL.green; ctx.fillRect(bx - 10, by - 20, 20, 20);
      ctx.fillStyle = PAL.black; ctx.fillRect(bx - 5, by - 15, 3, 4); ctx.fillRect(bx + 2, by - 15, 3, 4);
      ctx.fillStyle = PAL.red; ctx.fillRect(bx - 2, by - 9, 4, 2);
      particles.draw(ctx);
      drawPanel(ctx, 8, 8, 170, 26);
      drawText(ctx, `躲开 ${score}`, 16, 26, 12, PAL.yellow);
      drawText(ctx, msg, W / 2, 60, 16, PAL.yellow, 'center');
      drawText(ctx, '刺球来了就跳！', W / 2, H - 8, 10, PAL.white, 'center');
    }
  };
}

// ---------- 3. 木头人（动 = 失败） ----------
export function createFreeze() {
  let phase = 'go', phaseT = 3, survived = 0, msg = '随便动！', best = 0;
  const particles = new Particles();
  let flash = 0;
  return {
    name: '木头人', icon: '🪵', desc: '绿灯使劲动，木头人马上不许动！', hands: false,
    init() { survived = 0; phase = 'go'; phaseT = 2.5; msg = '随便动！'; },
    update(dt, S, W, H) {
      if (flash > 0) flash -= dt;
      if (phase === 'go') {
        phaseT -= dt;
        if (phaseT <= 0) { phase = 'freeze'; phaseT = 2 + Math.random() * 2; msg = '木头人！'; flash = 0.3; }
      } else if (phase === 'freeze') {
        phaseT -= dt;
        // 全画面运动量超阈值 = 被抓
        if (S.totalMotion > 10 && phaseT > 0.25) {
          phase = 'over'; msg = '被抓到啦！';
          particles.burst(W / 2, H / 2, PAL.red, 24, 5);
          return { over: true, score: Math.floor(survived), best: Math.floor(survived) };
        }
        if (phaseT <= 0) { survived += 10; phase = 'go'; phaseT = 1.5 + Math.random() * 2; msg = '随便动！'; }
      }
      return false;
    },
    draw(ctx, W, H, t) {
      // 红绿灯
      const lightY = 60;
      ctx.fillStyle = PAL.black; ctx.fillRect(W / 2 - 14, lightY - 10, 28, 56);
      ctx.fillStyle = phase === 'go' ? PAL.green : 'rgba(90,164,55,0.25)';
      ctx.fillRect(W / 2 - 8, lightY - 4, 16, 16);
      ctx.fillStyle = phase === 'freeze' ? PAL.red : 'rgba(226,61,61,0.25)';
      ctx.fillRect(W / 2 - 8, lightY + 22, 16, 16);
      drawKid(ctx, W / 2, H - 78, 4, phase === 'freeze' ? {} : { armL: Math.sin(t * 8), armR: -Math.sin(t * 8) });
      particles.draw(ctx);
      drawPanel(ctx, 8, 8, 190, 26);
      drawText(ctx, `坚持 ${Math.floor(survived)}`, 16, 26, 12, PAL.yellow);
      drawText(ctx, msg, W / 2, 140, 18, phase === 'freeze' ? PAL.red : PAL.green, 'center');
      drawText(ctx, phase === 'freeze' ? '定住别动！！' : '绿灯随便动～', W / 2, H - 8, 10, PAL.white, 'center');
    }
  };
}

// ---------- 4. 大声喊气球（麦克风） ----------
export function createShoutBalloon() {
  let score = 0, best = 0, level = 1, balloons = [], inflT = 0, msg = '大声喊——!';
  const particles = new Particles();
  function newBalloon(W) {
    balloons.push({ x: W / 2 + (Math.random() - 0.5) * (W * 0.5), y: 0, size: 8, hue: (Math.random() * 3) | 0 });
  }
  return {
    name: '大声喊气球', icon: '🎈', desc: '对着麦克风喊，把气球喊爆！', hands: false, needsMic: true,
    init() { score = 0; level = 1; balloons = []; newBalloon(800); msg = '大声喊——!'; },
    update(dt, S, W, H, mic) {
      const vol = mic ? mic.volume : 0;
      for (const b of balloons) {
        b.size += vol * dt * 120;
        if (b.size > 46) {
          score += Math.floor(b.size * 2);
          particles.burst(b.x, H - 60 - b.size, [PAL.red, PAL.yellow, PAL.cyan][b.hue], 26, 6);
          b.done = true; level++;
          newBalloon(W);
          msg = '嘭！！';
        }
      }
      balloons = balloons.filter(b => !b.done);
      if (balloons.length === 0) newBalloon(W);
      // 音量表
      if (msg === '嘭！！' && vol < 0.05) msg = '大声喊——!';
      return false;
    },
    // 这个游戏需要自己的超时结束：30秒
    timeLimit: 30,
    draw(ctx, W, H, t) {
      for (const b of balloons) {
        const col = [PAL.red, PAL.yellow, PAL.cyan][b.hue];
        const by = H - 70 - b.size;
        ctx.fillStyle = col;
        ctx.fillRect(b.x - b.size, by - b.size, b.size * 2, b.size * 2);
        ctx.fillRect(b.x - 2, by + b.size, 4, 8);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(b.x - b.size + 4, by - b.size + 4, 6, 6);
      }
      particles.draw(ctx);
      drawPanel(ctx, 8, 8, 150, 26);
      drawText(ctx, `得分 ${score}`, 16, 26, 12, PAL.yellow);
      drawPanel(ctx, W - 148, 8, 140, 20);
      ctx.fillStyle = PAL.red; ctx.fillRect(W - 144, 11, 132 * (mic ? mic.volume : 0), 14);
      drawText(ctx, '🎤', W - 144, 25, 10);
      drawText(ctx, msg, W / 2, 60, 18, PAL.orange, 'center');
      drawText(ctx, '对麦克风喊：啊——！', W / 2, H - 8, 10, PAL.white, 'center');
    }
  };
}
