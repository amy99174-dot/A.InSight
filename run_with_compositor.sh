#!/bin/bash
# A.InSight 启动脚本 - 启用X11 Compositor支持透明度

echo "🚀 启动 A.InSight (with compositor)"

# 1. 启动X11 Compositor (如果未安装，请先运行：sudo apt install xcompmgr)
echo "启动 X11 Compositor..."
killall xcompmgr 2>/dev/null  # 如果已运行，先关闭
xcompmgr -c &  # -c 启用阴影效果
sleep 1

# 2. 启动应用
echo "启动应用..."
python3 main.py

# 3. 清理
echo "关闭 Compositor..."
killall xcompmgr
