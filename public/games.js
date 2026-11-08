// 毛豆乐园 - 四个体感游戏（互动强化版）
// 你在屏幕里：背景是像素化的你，手就是刀，跳跃实时驱动小人
import { PAL, drawKid, Particles, drawText, drawPanel } from './render.js';
import { drawHandCursor } from './engine.js';

let shake = 0; // 屏幕震动（全局，由各游戏触发）
export function addShake(v) { shake = Math.min(1, shake + v); }
export function applyShake(ctx, amount) {
  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * shake * 10, (Math.random() - 0.5) * shake * 10);
    shake -= amount;
    if (shake < 0) shake = 0;
  }
}
function slashing(S) { return S.handSeen && S.handSpeed > 1.2; }

// ---------- 1. 切水果：你的手就是刀 ----------
export function createFruitSlash() {
  const fruits = [];
  let score = 0, lives = 3, spawnT = 1, combo = 0, comboT = 0, bestCombo = 0;
  let lastHand = null;
  const particles = new Particles();
  const types = [{ c: PAL.red }, { c: PAL.orange }, { c: PAL.yellow }, { c: PAL.purple }];
  function spawn(W, H) {
    if (Math.random() < 0.15) {
      fruits.push({ x: W / 2, y: H + 20, vx: (Math.random() - 0.5) * 5, vy: -15 - Math.random() * 4, r: 18, bomb: true, rot: 0 });
    } else {
      const t = types[(Math.random() * types.length) | 0];
      fruits.push({ x: W / 2 + (Math.random() - 0.5) * W * 0.5, y: H + 20, vx: (Math.random() - 0.5) * 6, vy: -14 - Math.random() * 5, r: 16, bomb: false, rot: 0, color: t.c });
    }
  }
  return {
    name: '切水果', icon: '🍉', desc: '你的手就是刀！挥手划过去切开水果，炸弹别碰！', hands: true,
    init() { fruits.length = 0; score = 0; lives = 3; combo = 0; bestCombo = 0; lastHand = null; },
    update(dt, S, W, H) {
      spawnT -= dt;
      if (spawnT <= 0 && fruits.length < 5) { spawn(W, H); spawnT = 0.7 + Math.random() * 0.7; }
      for (let i = fruits.length - 1; i >= 0; i--) {
        const f = fruits[i];
        f.x += f.vx * 60 * dt; f.y += f.vy * 60 * dt; f.vy += 22 * dt; f.rot += 3 * dt;
        if (slashing(S)) {
          const hx = S.handX * W, hy = S.handY * H;
          const near = Math.hypot(f.x - hx, f.y - hy) < f.r + 32;
          let swept = false;
          if (lastHand) {
            swept = Math.hypot(lastHand.x * W - f.x, lastHand.y * H - f.y) < f.r + 32 && near;
          }
          if (near || swept) {
            if (f.bomb) {
              lives--; particles.burst(f.x, f.y, PAL.black, 24, 6); combo = 0;
              addShake(1);
              if (lives <= 0) return { over: true, score, bestCombo };
            } else {
              score += 10 * (1 + combo); combo++; comboT = 1.2;
              bestCombo = Math.max(bestCombo, combo);
              particles.burst(f.x, f.y, f.color, 16, 5);
              addShake(0.15);
            }
            fruits.splice(i, 1); continue;
          }
        }
        if (f.y > H + 40) { fruits.splice(i, 1); if (!f.bomb) combo = 0; }
      }
      lastHand = S.handSeen ? { x: S.handX, y: S.handY } : null;
      if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
      return false;
    },
    draw(ctx, W, H, t, S) {
      for (const f of fruits) {
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
        ctx.fillStyle = f.bomb ? PAL.black : f.color;
        ctx.fillRect(-f.r, -f.r, f.r * 2, f.r * 2);
        ctx.fillStyle = f.bomb ? PAL.red : PAL.white;
        ctx.fillRect(-f.r + 4, -f.r + 4, 5, 5);
        if (f.bomb) { ctx.fillStyle = PAL.orange; ctx.fillRect(f.r - 3, -f.r - 6, 4, 6); }
        ctx.restore();
      }
      particles.draw(ctx);
      drawHandCursor(ctx, S, W, H, slashing(S) ? PAL.red : PAL.yellow);
      drawPanel(ctx, 8, 8, 170, 26);
      drawText(ctx, `得分 ${score}`, 16, 26, 12, PAL.yellow);
      drawPanel(ctx, W - 118, 8, 110, 26);
      drawText(ctx, '❤'.repeat(Math.max(0, lives)), W - 110, 26, 14, PAL.red);
      if (combo > 1) drawText(ctx, `连击 x${combo}!`, W / 2, 56, 16, PAL.orange, 'center');
    }
  };
}

// ---------- 2. 跳跳豆：你的跳跃驱动毛豆小人 ----------
export function createJumpBean() {
  let score = 0, phase = 'ready', phaseT = 0, jumpCount = 0, airT = 0, msg = '', wasAir = false;
  let beanY = 0, beanSquash = 1, spikeX = -0.2, spikeSpeed = 0.35;
  const particles = new Particles();
  function startRound() { phase = 'go'; phaseT = 6; spikeX = -0.15; msg = '刺球来了——跳！'; }
  return {
    name: '跳跳豆', icon: '🟢', desc: '毛豆小人就是你！刺球滚过来，跳起来躲开！', hands: false,
    init() { score = 0; jumpCount = 0; phase = 'countdown'; phaseT = 2.5; msg = '准备…蹲下再跳！'; beanY = 0; spikeSpeed = 0.35; },
    update(dt, S, W, H) {
      const lower = S.regionMotion(0, 0.45, 1, 0.55);
      const jumping = lower > 6;
      if (jumping && !wasAir) {
        airT = 0.4; jumpCount++;
        particles.burst(W * 0.3, H - 30, PAL.groundDark, 8, 3);
      }
      wasAir = jumping;
      if (airT > 0) {
        airT -= dt;
        beanY = Math.max(beanY - 380 * dt, -90);
        beanSquash = 0.85;
      } else {
        beanY = Math.min(beanY + 500 * dt, 0);
        beanSquash = beanY >= 0 ? 1 : 1.15;
      }
      if (phase === 'countdown') { phaseT -= dt; if (phaseT <= 0) startRound(); return false; }
      if (phase === 'go') {
        phaseT -= dt;
        spikeX += spikeSpeed * dt;
        const bx = W * 0.3;
        if (spikeX > (bx - 24) / W && spikeX < (bx + 34) / W) {
          if (beanY > -25) {
            addShake(1); phase = 'over'; msg = '被扎到啦！';
            particles.burst(bx, H - 40, PAL.red, 24, 6);
            return { over: true, score: jumpCount * 10 + score, best: jumpCount };
          }
        }
        if (spikeX > 1.1) { spikeX = -0.15; score += 50; spikeSpeed += 0.06; msg = '躲开了！+50'; }
        if (phaseT <= 0) { score += 100; phase = 'countdown'; phaseT = 1.5; msg = '下一波…'; }
      }
      return false;
    },
    draw(ctx, W, H, t) {
      if (phase === 'go') {
        const sx = spikeX * W, sy = H - 20;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * 6);
        ctx.fillStyle = PAL.purple; ctx.fillRect(-10, -10, 20, 20);
        ctx.fillStyle = PAL.black;
        for (let a = 0; a < 4; a++) ctx.fillRect(-13 + a * 7, -14, 4, 4);
        ctx.restore();
      }
      const bx = W * 0.3, by = H - 14 + beanY;
      const sqw = 20 / beanSquash, sqh = 20 * beanSquash;
      ctx.fillStyle = PAL.green;
      ctx.fillRect(bx - sqw / 2, by - sqh, sqw, sqh);
      ctx.fillStyle = PAL.black;
      ctx.fillRect(bx - 6, by - sqh + 5, 4, 5); ctx.fillRect(bx + 2, by - sqh + 5, 4, 5);
      ctx.fillStyle = PAL.red; ctx.fillRect(bx - 3, by - sqh + 12, 6, 3);
      particles.draw(ctx);
      drawPanel(ctx, 8, 8, 200, 26);
      drawText(ctx, `跳了${jumpCount}次 ${score}分`, 16, 26, 11, PAL.yellow);
      drawText(ctx, msg, W / 2, 64, 15, PAL.yellow, 'center');
      drawText(ctx, phase === 'go' ? '跳——！' : '准备跳！', W / 2, H - 8, 11, PAL.white, 'center');
    }
  };
}

// ---------- 3. 木头人：星星罐子实时跟你的运动涨 ----------
export function createFreeze() {
  let phase = 'go', phaseT = 3, survived = 0, msg = '绿灯！使劲动！', jarFill = 0;
  const jarMax = 40;
  let caughtFlash = 0;
  const particles = new Particles();
  return {
    name: '木头人', icon: '🪵', desc: '绿灯动，罐子里的星星跟着涨；红灯一动就被抓！', hands: false,
    init() { survived = 0; jarFill = 0; phase = 'go'; phaseT = 2.5; msg = '绿灯！使劲动！'; },
    update(dt, S, W, H) {
      if (caughtFlash > 0) caughtFlash -= dt;
      if (phase === 'go') {
        phaseT -= dt;
        jarFill = Math.min(jarMax, jarFill + S.totalMotion * dt * 0.8);
        if (phaseT <= 0) { phase = 'freeze'; phaseT = 2 + Math.random() * 2; msg = '木！头！人！'; }
      } else if (phase === 'freeze') {
        phaseT -= dt;
        jarFill = Math.max(0, jarFill - dt * 2);
        if (S.totalMotion > 8 && phaseT > 0.2) {
          addShake(1); caughtFlash = 0.5;
          particles.burst(W / 2, H / 2, PAL.red, 30, 7);
          phase = 'over'; msg = '被抓到啦！';
          return { over: true, score: Math.floor(jarFill * 10) + Math.floor(survived), best: Math.floor(jarFill) };
        }
        if (phaseT <= 0) { survived += 10; phase = 'go'; phaseT = 1.5 + Math.random() * 2; msg = '绿灯！使劲动！'; }
      }
      return false;
    },
    draw(ctx, W, H, t) {
      // 星星罐子
      const jx = W - 100, jy = 44, jw = 64, jh = 96;
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(jx, jy, jw, jh);
      const fillH = (jarFill / jarMax) * (jh - 8);
      ctx.fillStyle = caughtFlash > 0 ? PAL.red : PAL.yellow;
      ctx.fillRect(jx + 4, jy + jh - 4 - fillH, jw - 8, fillH);
      ctx.strokeStyle = PAL.white; ctx.lineWidth = 3;
      ctx.strokeRect(jx, jy, jw, jh);
      drawText(ctx, '★罐', jx + jw / 2, jy + jh + 16, 10, PAL.white, 'center');
      // 红绿灯
      ctx.fillStyle = PAL.black; ctx.fillRect(W / 2 - 16, 40, 32, 64);
      ctx.fillStyle = phase === 'go' ? PAL.green : 'rgba(90,164,55,0.25)';
      ctx.fillRect(W / 2 - 9, 46, 18, 18);
      ctx.fillStyle = phase === 'freeze' ? PAL.red : 'rgba(226,61,61,0.25)';
      ctx.fillRect(W / 2 - 9, 74, 18, 18);
      const moving = phase === 'go';
      drawKid(ctx, W / 2, H - 80, 4, moving
        ? { armL: Math.sin(t * 10), armR: -Math.sin(t * 10), legSpread: 1 + Math.sin(t * 10) * 0.4 }
        : {});
      particles.draw(ctx);
      drawPanel(ctx, 8, 8, 220, 26);
      drawText(ctx, `星星${Math.floor(jarFill)} 坚持${Math.floor(survived)}`, 16, 26, 10, PAL.yellow);
      drawText(ctx, msg, W / 2, 150, 17, phase === 'freeze' ? PAL.red : PAL.green, 'center');
      drawText(ctx, phase === 'freeze' ? '定住！别动！！' : '越动星星越多！', W / 2, H - 8, 11, PAL.white, 'center');
    }
  };
}

// ---------- 4. 大声喊气球：你的音量实时吹气球 ----------
export function createShoutBalloon() {
  let score = 0, level = 1, balloons = [], msg = '大声喊——!';
  const particles = new Particles();
  let smoothVol = 0;
  function newBalloon(W) {
    balloons.push({ x: W * 0.5 + (Math.random() - 0.5) * W * 0.4, size: 10, hue: (Math.random() * 3) | 0 });
  }
  return {
    name: '大声喊气球', icon: '🎈', desc: '对麦克风喊，气球随你的音量变大，喊爆它！', hands: false, needsMic: true,
    getScore() { return score; },
    init() { score = 0; level = 1; balloons = []; newBalloon(800); msg = '大声喊——!'; },
    update(dt, S, W, H, mic) {
      const vol = mic ? mic.volume : 0;
      smoothVol = smoothVol * 0.7 + vol * 0.3;
      for (const b of balloons) {
        b.size += smoothVol * dt * 130;
        if (b.size > 52) {
          score += Math.floor(b.size * 2);
          particles.burst(b.x, H - 70 - b.size, [PAL.red, PAL.yellow, PAL.cyan][b.hue], 30, 7);
          addShake(0.6);
          b.done = true; level++;
          newBalloon(W);
          msg = '嘭！！爆了！';
        }
      }
      balloons = balloons.filter(b => !b.done);
      if (balloons.length === 0) newBalloon(W);
      if (msg.startsWith('嘭') && smoothVol < 0.05) msg = '再喊——!';
      return false;
    },
    timeLimit: 30,
    draw(ctx, W, H, t, S, mic) {
      const vol = mic ? mic.volume : 0;
      for (const b of balloons) {
        const col = [PAL.red, PAL.yellow, PAL.cyan][b.hue];
        const by = H - 70 - b.size;
        ctx.fillStyle = col;
        ctx.fillRect(b.x - b.size, by - b.size, b.size * 2, b.size * 2);
        ctx.fillRect(b.x - 2, by + b.size, 4, 10);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(b.x - b.size + 5, by - b.size + 5, 7, 7);
      }
      particles.draw(ctx);
      drawPanel(ctx, 8, 8, 170, 26);
      drawText(ctx, `得分 ${score}`, 16, 26, 12, PAL.yellow);
      drawPanel(ctx, W / 2 - 110, H - 34, 220, 20);
      ctx.fillStyle = vol > 0.7 ? PAL.red : PAL.green;
      ctx.fillRect(W / 2 - 106, H - 30, 212 * vol, 12);
      drawText(ctx, '🎤', W / 2 - 134, H - 19, 12);
      drawText(ctx, msg, W / 2, 64, 18, PAL.orange, 'center');
      drawText(ctx, '对麦克风喊：啊——！', W / 2, 92, 11, PAL.white, 'center');
    }
  };
}
