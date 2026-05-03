#!/bin/bash
# A.InSight 啟動腳本 — 所有環境變數集中在此，不依賴 ecosystem.config.js

echo "🚀 啟動 A.InSight (with compositor)"

# ── Display / Session (必須在此設定，PM2 不繼承登入 session) ────────────────
export DISPLAY=":0"
export XDG_RUNTIME_DIR="/run/user/1000"
export DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/1000/bus"
export XAUTHORITY="/home/yeeeecheeeen/.Xauthority"
export PYTHON_KEYRING_BACKEND="keyring.backends.null.Keyring"

# ── API: 連接 Vercel 生產環境 ────────────────────────────────────────────────
export API_URL="https://a-in-sight.vercel.app/api/config"

# ── Audio: 路由到 MAX98357A (hifiberry, card 1) ──────────────────────────────
export SDL_AUDIODRIVER=alsa
export SDL_AUDIODEVICE=plughw:1,0

# ── 啟動 X11 Compositor (支援透明度) ────────────────────────────────────────
echo "啟動 X11 Compositor..."
killall xcompmgr 2>/dev/null
xcompmgr -c &
sleep 1

# ── 啟動應用 ─────────────────────────────────────────────────────────────────
echo "啟動應用..."
python3 launcher.py

# ── 清理 ─────────────────────────────────────────────────────────────────────
echo "關閉 Compositor..."
killall xcompmgr
