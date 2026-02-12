#!/usr/bin/env python3
"""
EC11 旋转编码器测试脚本
测试编码器的旋转和按钮功能
"""

from gpiozero import RotaryEncoder, Button
from signal import pause
import sys

print("🔄 EC11 旋转编码器测试")
print("=" * 50)
print("引脚配置:")
print("  A引脚: GPIO 20")
print("  B引脚: GPIO 21")
print("  按钮:  GPIO 16")
print("=" * 50)

try:
    # 初始化旋转编码器
    encoder = RotaryEncoder(
        a=20,  # CLK
        b=21,  # DT
        wrap=False,  # 不循环
        max_steps=100  # 最大步数
    )
    
    # 初始化编码器按钮
    encoder_button = Button(16)
    
    print("✅ 旋转编码器已初始化")
    print("✅ 编码器按钮已初始化")
    
    print("\n" + "=" * 50)
    print("📋 测试说明:")
    print("  - 顺时针旋转编码器 → 数值增加")
    print("  - 逆时针旋转编码器 → 数值减小")
    print("  - 按下编码器按钮 → 显示消息")
    print("  - 按 Ctrl+C 停止测试")
    print("=" * 50 + "\n")
    
    # 回调函数
    def encoder_changed():
        print(f"🔄 编码器旋转: 当前值 = {encoder.value} (步数: {encoder.steps})")
    
    def button_pressed():
        print("🔘 编码器按钮被按下")
    
    def button_released():
        print("↩️ 编码器按钮被释放")
    
    # 连接事件
    encoder.when_rotated = encoder_changed
    encoder_button.when_pressed = button_pressed
    encoder_button.when_released = button_released
    
    print("🎯 开始监听编码器事件...")
    print("   请旋转编码器或按下按钮测试...\n")
    
    # 显示初始值
    print(f"初始值: {encoder.value}")
    
    pause()
    
except KeyboardInterrupt:
    print("\n\n⏹️ 测试停止")
    print("=" * 50)
except Exception as e:
    print(f"❌ 错误: {e}")
    sys.exit(1)
