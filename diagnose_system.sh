#!/bin/bash
# 系统诊断脚本 - 找出崩溃原因

echo "🔍 系统诊断开始..."
echo ""

echo "1️⃣ 检查Python进程残留"
ps aux | grep python | grep -v grep
echo ""

echo "2️⃣ 检查摄像头占用"
lsof /dev/video* 2>/dev/null || echo "摄像头未被占用"
echo ""

echo "3️⃣ 检查compositor进程"
ps aux | grep -E 'xcompmgr|compton|picom' | grep -v grep
echo ""

echo "4️⃣ 检查内存使用"
free -h
echo ""

echo "5️⃣ 检查GPU内存"
vcgencmd get_mem gpu
echo ""

echo "6️⃣ 检查最近的系统日志"
sudo journalctl -n 50 --no-pager | grep -i 'error\|segfault\|killed'
echo ""

echo "✅ 诊断完成！"
echo ""
echo "🔧 清理命令（如果需要）："
echo "   pkill -f python3"
echo "   pkill -f xcompmgr"
