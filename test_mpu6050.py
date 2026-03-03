#!/usr/bin/env python3
"""
MPU6050 陀螺儀測試腳本
正確軸映射（正面朝上，平放於機身底部）:
    X 軸 → 左右傾斜   → sin(θ) 線性變化 → 水平平移 dx  ✅
    Y 軸 → 前後傾斜   → sin(θ) 線性變化 → 垂直平移 dy  ✅ (修正：原 Z 過弱)
    Z 軸 → 重力方向   → cos(θ) 二次方變化 → 不使用 ❌ (平放時已達 1g)

按 Enter 重新校準，按 Ctrl+C 結束。
"""

import time
import sys
import threading

try:
    from mpu6050 import mpu6050
except ImportError:
    print("❌ 需要安裝 mpu6050 庫")
    print("   運行: pip3 install mpu6050-raspberrypi --break-system-packages")
    sys.exit(1)

print("🔄 MPU6050 陀螺儀測試")
print("=" * 65)
print("I2C:   SDA→GPIO2(Pin3)  SCL→GPIO3(Pin5)  addr=0x68")
print("軸映射: X→左右(dx)  Y→前後/上下傾斜(dy)  Z→重力(不用)")
print("操作:   按 Enter 重新校準 | Ctrl+C 結束")
print("=" * 65)

sensor = mpu6050(0x68)
print("✅ MPU6050 已初始化\n")

x_offset = 0.0
y_offset = 0.0

def calibrate():
    global x_offset, y_offset
    print("\n⏳ 校準中... 保持裝置靜止")
    time.sleep(0.8)
    accel = sensor.get_accel_data()
    x_offset = accel['x']
    y_offset = accel['y']
    print(f"✅ 校準完成  X={x_offset:+.3f}  Y={y_offset:+.3f}  Z={accel['z']:+.3f}(固定~1g)")
    print("   左右傾斜 → X 變化 | 前後傾斜（上下旋轉）→ Y 變化")
    print("-" * 65)

calibrate()

def wait_for_enter():
    while True:
        try:
            input()
            calibrate()
        except EOFError:
            break

threading.Thread(target=wait_for_enter, daemon=True).start()

DEAD_ZONE = 0.15

try:
    while True:
        accel = sensor.get_accel_data()
        temp  = sensor.get_temp()

        x_tilt = accel['x'] - x_offset
        y_tilt = accel['y'] - y_offset

        x_disp = 0.0 if abs(x_tilt) < DEAD_ZONE else x_tilt
        y_disp = 0.0 if abs(y_tilt) < DEAD_ZONE else y_tilt

        x_arrow = ("←" if x_disp < 0 else "→") if x_disp != 0 else " "
        y_arrow = ("↑" if y_disp > 0 else "↓") if y_disp != 0 else " "

        print(
            f"\r  X(左右){x_arrow}{x_tilt:+.3f}  │  "
            f"Y(傾斜){y_arrow}{y_tilt:+.3f}  │  "
            f"Z(重力){accel['z']:+.3f}  │  {temp:.1f}°C      ",
            end='', flush=True
        )
        time.sleep(0.1)

except KeyboardInterrupt:
    print("\n\n⏹️ 測試結束")
    print("  若 dx/dy 方向相反，在 gyro_controller.py 對應行加負號即可")
