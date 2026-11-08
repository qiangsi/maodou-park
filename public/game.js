// 毛豆乐园 - 游戏主控制器
import { startCamera, stopStream, MotionSensor, MicSensor, drawPreview } from './engine.js';
import { drawScene } from './render.js';
import { createFruitSlash, createJumpBean, createFreeze, createShoutBalloon } from './games.js';

const FACTORIES = { fruit: createFruitSlash, jump: createJumpBean, freeze: createFreeze, shout: createShoutBalloon };
const NAMES = { fruit: '切水果', jump: '跳跳豆', freeze: '木头人', shout: '大声喊气球' };

const stage = document.getElementById('stage');
const ctx = stage.getContext('2d');
const preview = document.getElementById('preview');
const camHint = document.getElementById('camHint');
const msg = document.getElementById('msg');
const startOverlay = document.getElementById('startOverlay');
const overOverlay = document.getElementById('overOverlay');

let video = null, sensor = null, mic = null, currentGame = null, currentKey = 'fruit';
let running = false, raf = 0, lastT = 0, playT = 0;
let lastResult = null;

function setGame(key) {
  currentKey = key;
  document.querySelectorAll('.gbtn').forEach(b => b.classList.toggle('active', b.dataset.g === key));
  if (running) { // 切换游戏即重开
    currentGame = FACTORIES[key]();
    currentGame.init();
    playT = 0;
    overOverlay.classList.add('hidden');
  }
  msg.textContent = `当前游戏：${NAMES[key]} —— ${FACTORIES[key]().desc}`;
}

document.querySelectorAll('.gbtn').forEach(b => b.addEventListener('click', () => setGame(b.dataset.g)));

// URL 参数选游戏
const urlG = new URLSearchParams(location.search).get('g');
setGame(FACTORIES[urlG] ? urlG : 'fruit');

document.getElementById('startBtn').addEventListener('click', async () => {
  msg.textContent = '正在开启摄像头…';
  try {
    video = document.createElement('video');
    video.muted = true; video.playsInline = true;
    const needMic = currentKey === 'shout';
    await startCamera(video, preview);
    if (needMic) {
      mic = new MicSensor();
      try { await mic.start(); msg.textContent = '摄像头+麦克风已就绪！'; }
      catch (e) { mic = null; msg.textContent = '麦克风没开，用音量按钮代替（游戏仍可玩，但没有声音输入）。'; }
    } else {
      msg.textContent = '摄像头已就绪！';
    }
    sensor = new MotionSensor(video);
    // 预热两帧
    for (let i = 0; i < 3; i++) { sensor.update(); await new Promise(r => setTimeout(r, 60)); }
    startOverlay.classList.add('hidden');
    currentGame = FACTORIES[currentKey]();
    currentGame.init();
    playT = 0;
    running = true;
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
  } catch (e) {
    msg.textContent = '摄像头开启失败：' + (e && e.name === 'NotAllowedError' ? '你拒绝了权限，请在浏览器地址栏重新允许。' : e.message);
  }
});

function endGame(result) {
  running = false;
  cancelAnimationFrame(raf);
  lastResult = { game: currentKey, score: Math.floor(result.score) };
  document.getElementById('overTitle').textContent = `${NAMES[currentKey]} — 游戏结束！`;
  document.getElementById('overScore').textContent = `${lastResult.score} 分`;
  document.getElementById('overExtra').textContent = result.best ? `最高连击/坚持：${result.best}` : '';
  overOverlay.classList.remove('hidden');
}

function loop(now) {
  if (!running) return;
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  playT += dt;

  sensor.update();
  if (mic) mic.update();

  const W = stage.width, H = stage.height;
  drawScene(ctx, W, H, playT);

  const result = currentGame.update(dt, sensor, W, H, mic);
  currentGame.draw(ctx, W, H, playT);

  drawPreview(sensor, preview);
  camHint.textContent = '📷 本机识别中';

  if (result && result.over) { endGame(result); return; }
  // 喊气球限时
  if (currentGame.timeLimit && playT > currentGame.timeLimit) { endGame({ score: currentGame ? 0 : 0 }); return; }

  raf = requestAnimationFrame(loop);
}

// 提交分数
document.getElementById('saveBtn').addEventListener('click', async () => {
  if (!lastResult) return;
  const name = document.getElementById('nameInput').value.trim() || '无名毛豆';
  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  try {
    const res = await fetch('/api/scores', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Website-Release': globalThis.__LIGHTVELA_RELEASE_ID__ },
      body: JSON.stringify({ game: lastResult.game, name, score: lastResult.score })
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.ok) { msg.textContent = '✅ 已提交到排行榜！'; btn.textContent = '✅ 已提交'; return; }
      if (res.status === 401) { msg.textContent = '需要登录或输入分享码后才能提交分数。'; return; }
    }
    msg.textContent = '提交失败，请稍后再试。';
  } catch (e) {
    msg.textContent = '网络错误，提交失败。';
  } finally { btn.disabled = false; }
});

document.getElementById('againBtn').addEventListener('click', () => {
  overOverlay.classList.add('hidden');
  currentGame = FACTORIES[currentKey]();
  currentGame.init();
  playT = 0;
  running = true;
  lastT = performance.now();
  raf = requestAnimationFrame(loop);
});
document.getElementById('homeBtn').addEventListener('click', () => location.href = './');

window.addEventListener('beforeunload', () => {
  stopStream(video && video.srcObject);
  if (mic) mic.stop();
});
