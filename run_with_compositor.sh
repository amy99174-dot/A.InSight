#!/bin/bash
# A.InSight 启动脚本 - 启用X11 Compositor支持透明度

echo "🚀 启动 A.InSight (with compositor)"

# 1. 启动X11 Compositor (如果未安装，请先运行：sudo apt install xcompmgr)
echo "启动 X11 Compositor..."
killall xcompmgr 2>/dev/null  # 如果已运行，先关闭
xcompmgr -c &  # -c 启用阴影效果
sleep 1

# 螢幕旋轉由 /boot/firmware/config.txt 的 display_rotate=2 處理（GPU 層），不需要 xrandr

# ── Audio: Route to MAX98357A (hifiberry, card 1) ──────────────────────────
export SDL_AUDIODRIVER=alsa
export SDL_AUDIODEVICE=plughw:1,0

# ── OpenAI TTS Key (fill in your key for narration audio) ──────────────────
# export OPENAI_KEY="sk-..."   # ← 不要把 key 放這裡，在 Pi 上設定（見下方說明）

# 3. 启动应用
echo "启动应用..."
python3 main.py

# 3. 清理
echo "关闭 Compositor..."
killall xcompmgr
