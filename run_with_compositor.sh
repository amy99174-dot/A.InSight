#!/bin/bash
# A.InSight 启动脚本 - 启用X11 Compositor支持透明度

echo "🚀 启动 A.InSight (with compositor)"

# 1. 启动X11 Compositor (如果未安装，请先运行：sudo apt install xcompmgr)
echo "启动 X11 Compositor..."
killall xcompmgr 2>/dev/null  # 如果已运行，先关闭
xcompmgr -c &  # -c 启用阴影效果
sleep 1

# 2. 螢幕旋轉 180°（因外殼線路需上下顛倒安裝）
echo "旋轉螢幕 180°..."
# 嘗試常見的輸出名稱; 若失敗可改為 HDMI-A-1 或 HDMI-1-1
DISPLAY=:0 xrandr --output HDMI-1 --rotate inverted 2>/dev/null || \
DISPLAY=:0 xrandr --output HDMI-A-1 --rotate inverted 2>/dev/null || \
DISPLAY=:0 xrandr --output HDMI-1-1 --rotate inverted 2>/dev/null || \
echo "⚠️  xrandr 旋轉失敗，請手動確認輸出名稱 (xrandr 列表)"

# ── Audio: Route to MAX98357A (hifiberry, card 1) ──────────────────────────
export SDL_AUDIODRIVER=alsa
export SDL_AUDIODEVICE=plughw:1,0

# ── OpenAI TTS Key (fill in your key for narration audio) ──────────────────
# export OPENAI_KEY="sk-..."   # Uncomment and paste your key to enable TTS

# 3. 启动应用
echo "启动应用..."
python3 main.py

# 3. 清理
echo "关闭 Compositor..."
killall xcompmgr
