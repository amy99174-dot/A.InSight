"""
最简单的摄像头测试 - 确认能获取帧
"""

from picamera2 import Picamera2
import time

print("📷 测试摄像头帧捕获...")

# 初始化
camera = Picamera2()
config = camera.create_preview_configuration(
    main={"size": (640, 480), "format": "XRGB8888"}
)
camera.configure(config)
camera.start()

print("✅ 摄像头已启动，等待1秒...")
time.sleep(1)

# 测试不同的捕获方法
print("\n测试1: capture_array()")
try:
    frame1 = camera.capture_array()
    print(f"  ✅ 成功! 尺寸: {frame1.shape}, 类型: {frame1.dtype}")
except Exception as e:
    print(f"  ❌ 失败: {e}")

print("\n测试2: capture_array('main')")
try:
    frame2 = camera.capture_array("main")
    print(f"  ✅ 成功! 尺寸: {frame2.shape}, 类型: {frame2.dtype}")
except Exception as e:
    print(f"  ❌ 失败: {e}")

print("\n测试3: 连续获取10帧")
for i in range(10):
    try:
        frame = camera.capture_array("main")
        print(f"  帧 {i+1}: {frame.shape}")
        time.sleep(0.1)
    except Exception as e:
        print(f"  帧 {i+1} 失败: {e}")
        break

camera.stop()
camera.close()
print("\n✅ 测试完成")
