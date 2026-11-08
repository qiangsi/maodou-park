# 毛豆乐园 🟢

摄像头 + 麦克风体感游戏网站，像素风格。全部识别在本机浏览器完成，不录像不上传。

## 游戏

| 游戏 | 体感方式 |
|------|----------|
| 🍉 切水果 | 摄像头帧差识别挥手位置 |
| 🟢 跳跳豆 | 跳跃时画面下部运动骤增 |
| 🪵 木头人 | 红灯时全画面运动量超阈值判被抓 |
| 🎈 大声喊气球 | 麦克风实时音量吹爆气球，30 秒限时 |

## 结构

- `public/` 静态前端（index / game / leaderboard + engine.js 像素体感引擎 + games.js 游戏逻辑 + render.js 像素渲染）
- `backend/app.mjs` Vela fullstack 后端（fetch-v1 + rivet-sql-v1），排行榜持久 SQL

## 部署（Vela）

```bash
python3 "$HOME/.hermes/skills/website-builder/scripts/package_fullstack.py" \
  --static-dir ./public --backend ./backend/app.mjs --output ./artifacts/site.zip
```

## 本地预览

```bash
cd public && python3 -m http.server 8791
# 注意 /api 在本地不可用，排行榜会显示读取失败，属预期
```
