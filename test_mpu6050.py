#!/usr/bin/env python3
"""
MPU6050 陀螺仪测试脚本
测试加速度计和陀螺仪数据读取
"""

import time
import sys

try:
    from mpu6050 import mpu6050
except ImportError:
    print("❌ 需要安装 mpu6050 库")
    print("   运行: sudo pip3 install mpu6050-raspberrypi")
    sys.exit(1)

print("🔄 MPU6050 陀螺仪测试")
print("=" * 60)
print("I2C 配置:")
print("  SDA: GPIO 2 (物理Pin 3)")
print("  SCL: GPIO 3 (物理Pin 5)")
print("  地址: 0x68 (默认)")
print("=" * 60)

try:
    # 初始化 MPU6050 (默认I2C地址 0x68)
    sensor = mpu6050(0x68)
    print("✅ MPU6050 已初始化\n")
    
    print("=" * 60)
    print("📋 测试说明:")
    print("  - 倾斜设备左右 → X轴变化 (控制水平移动)")
    print("  - 倾斜设备前后 → Y轴变化 (控制垂直移动)")
    print("  - 数值范围: -1.0 到 +1.0 (重力加速度)")
    print("  - 按 Ctrl+C 停止测试")
    print("=" * 60 + "\n")
    
    print("🎯 开始读取数据...\n")
    
    # 读取初始数据校准
    print("⏳ 校准中... 请保持设备水平静止")
    time.sleep(1)
    
    accel_data = sensor.get_accel_data()
    x_offset = accel_data['x']
    y_offset = accel_data['y']
    print(f"✅ 校准完成 (X偏移: {x_offset:.3f}, Y偏移: {y_offset:.3f})\n")
    
    print("开始实时监测 (每秒更新 10 次):")
    print("-" * 60)
    
    while True:
        # 读取加速度计数据 (单位: g)
        accel_data = sensor.get_accel_data()
        
        # 读取陀螺仪数据 (单位: deg/s)
        gyro_data = sensor.get_gyro_data()
        
        # 读取温度
        temp = sensor.get_temp()
        
        # 计算相对于校准位置的偏移
        x_accel = accel_data['x'] - x_offset
        y_accel = accel_data['y'] - y_offset
        z_accel = accel_data['z']
        
        # 归一化到 -1.0 到 +1.0 范围
        x_normalized = max(-1.0, min(1.0, x_accel))
        y_normalized = max(-1.0, min(1.0, y_accel))
        
        # 显示数据
        print(f"\r加速度 X: {x_normalized:+.3f} | Y: {y_normalized:+.3f} | Z: {z_accel:+.3f} | "
              f"温度: {temp:.1f}°C", end='', flush=True)
        
        time.sleep(0.1)  # 10Hz 更新频率
        
except KeyboardInterrupt:
    print("\n\n⏹️ 测试停止")
    print("=" * 60)
    print("\n💡 提示:")
    print("  - 如果数值稳定变化，说明传感器工作正常")
    print("  - X/Y 数值将用于控制结果页面的图片移动")
    print("  - 倾斜角度越大，移动速度越快")
    
except Exception as e:
    print(f"\n❌ 错误: {e}")
    print("\n🔧 故障排查:")
    print("  1. 检查I2C是否启用: sudo raspi-config → Interface Options → I2C")
    print("  2. 检查设备连接: i2cdetect -y 1")
    print("  3. 检查接线:")
    print("     - VCC → 5V (物理Pin 2/4)")
    print("     - GND → GND (物理Pin 6/9/14...)")
    print("     - SDA → GPIO 2 (物理Pin 3)")
    print("     - SCL → GPIO 3 (物理Pin 5)")
    sys.exit(1)
