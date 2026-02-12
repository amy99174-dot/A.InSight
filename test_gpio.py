#!/usr/bin/env python3
"""
GPIO 按钮测试脚本
测试三个按钮的输入是否正常
"""

from gpiozero import Button
from signal import pause
import sys

print("🎮 GPIO 按钮测试")
print("=" * 50)
print("请告诉我你接了哪三个按钮的 GPIO 引脚编号")
print("例如: 22 23 24")
print()

# 获取GPIO引脚
try:
    pins_input = input("输入三个GPIO引脚号（空格分隔）: ").strip()
    pins = [int(p) for p in pins_input.split()]
    
    if len(pins) != 3:
        print("❌ 需要输入3个引脚号")
        sys.exit(1)
    
    print(f"\n✅ 测试引脚: {pins}")
    print("=" * 50)
    
except ValueError:
    print("❌ 请输入有效的数字")
    sys.exit(1)

# 创建按钮对象（默认上拉配置）
buttons = []
for i, pin in enumerate(pins):
    try:
        btn = Button(pin)
        buttons.append(btn)
        print(f"✅ 按钮 {i+1} (GPIO {pin}) 已初始化")
    except Exception as e:
        print(f"❌ 按钮 {i+1} (GPIO {pin}) 初始化失败: {e}")
        sys.exit(1)

print("\n" + "=" * 50)
print("📋 测试说明:")
print("  - 按下任意按钮会显示消息")
print("  - 释放按钮也会显示消息")
print("  - 按 Ctrl+C 停止测试")
print("=" * 50 + "\n")

# 设置回调
def make_press_handler(num, pin):
    def handler():
        print(f"✅ 按钮 {num} (GPIO {pin}) 被按下")
    return handler

def make_release_handler(num, pin):
    def handler():
        print(f"↩️ 按钮 {num} (GPIO {pin}) 被释放")
    return handler

for i, (btn, pin) in enumerate(zip(buttons, pins)):
    btn.when_pressed = make_press_handler(i+1, pin)
    btn.when_released = make_release_handler(i+1, pin)

print("🎯 开始监听按钮事件...")
print("   请按下按钮测试...\n")

try:
    pause()
except KeyboardInterrupt:
    print("\n\n⏹️ 测试停止")
    print("=" * 50)
