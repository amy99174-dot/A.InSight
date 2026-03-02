#!/usr/bin/env python3
"""
MPU6050 陀螺儀測試腳本
實際軸映射（依硬體安裝方向）:
    X 軸 → 左右傾斜   (用於水平平移 dx)
    Y 軸 → 前後傾斜   (未使用)
    Z 軸 → 上下傾斜   (用於垂直平移 dy)

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
print("=" * 60)
print("I2C 配置:  SDA→GPIO2(Pin3)  SCL→GPIO3(Pin5)  addr=0x68")
print("軸映射:    X→左右(dx)   Z→上下(dy)   Y→前後(未用)")
print("操作:      按 Enter 重新校準  |  Ctrl+C 結束")
print("=" * 60)

sensor = mpu6050(0x68)
print("✅ MPU6050 已初始化\n")

# ── 校準 ─────────────────────────────────────────────────────────────────────
x_offset = 0.0
z_offset = 0.0

def calibrate():
    global x_offset, z_offset
    print("\n⏳ 校準中... 保持裝置靜止")
    time.sleep(0.8)
    accel = sensor.get_accel_data()
    x_offset = accel['x']   # 左右水平零點
    z_offset = accel['z']   # 上下垂直零點
    print(f"✅ 校準完成  X偏移={x_offset:+.3f}  Z偏移={z_offset:+.3f}")
    print("   左右傾斜 → X 變化 | 上下傾斜 → Z 變化")
    print("-" * 60)

calibrate()

# ── Enter 鍵監聽（背景執行緒）────────────────────────────────────────────────
def wait_for_enter():
    while True:
        try:
            input()
            calibrate()
        except EOFError:
            break

threading.Thread(target=wait_for_enter, daemon=True).start()

# ── 主迴圈 ────────────────────────────────────────────────────────────────────
DEAD_ZONE = 0.15

try:
    while True:
        accel = sensor.get_accel_data()
        temp  = sensor.get_temp()

        x_tilt = accel['x'] - x_offset   # 左右
        z_tilt = accel['z'] - z_offset   # 上下

        x_disp = 0.0 if abs(x_tilt) < DEAD_ZONE else x_tilt
        z_disp = 0.0 if abs(z_tilt) < DEAD_ZONE else z_tilt

        x_arrow = ("←" if x_disp < 0 else "→") if x_disp != 0 else " "
        z_arrow = ("↑" if z_disp < 0 else "↓") if z_disp != 0 else " "

        print(
            f"\r  X(左右) {x_arrow} {x_tilt:+.3f}  │  "
            f"Z(上下) {z_arrow} {z_tilt:+.3f}  │  "
            f"Y(前後) {accel['y']:+.3f}  │  {temp:.1f}°C      ",
            end='', flush=True
        )
        time.sleep(0.1)

except KeyboardInterrupt:
    print("\n\n⏹️ 測試結束")
    print("  若方向相反，在 gyro_controller.py 的對應軸加負號即可")
