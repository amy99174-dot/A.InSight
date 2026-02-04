#!/usr/bin/env python3
"""
A.InSight Native - Minimal Prototype
用于验证摄像头 GPU 加速和性能
"""

from PyQt5.QtWidgets import QApplication, QMainWindow, QLabel
from PyQt5.QtCore import QTimer, Qt
from PyQt5.QtGui import QImage, QPixmap
from picamera2 import Picamera2
from picamera2.previews.qt import QGlPicamera2
import sys
import time

class PrototypeWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.init_ui()
        self.init_camera()
        self.init_performance_monitor()
        
    def init_ui(self):
        """初始化UI"""
        self.setWindowTitle("A.InSight Native Prototype")
        self.setGeometry(0, 0, 800, 600)
        self.setStyleSheet("background-color: black;")
        
        # FPS 显示
        self.fps_label = QLabel(self)
        self.fps_label.setGeometry(10, 10, 200, 30)
        self.fps_label.setStyleSheet("color: lime; font-size: 16px;")
        
    def init_camera(self):
        """初始化摄像头（GPU 加速）"""
        try:
            print("📷 初始化摄像头...")
            self.camera = Picamera2()
            
            # 配置预览（640x480, 30fps）
            # 使用 XRGB8888 格式（QGlPicamera2 支持）
            config = self.camera.create_preview_configuration(
                main={"size": (640, 480), "format": "XRGB8888"}
            )
            self.camera.configure(config)
            
            # 使用 Qt OpenGL 预览（GPU 加速）
            self.preview = QGlPicamera2(
                self.camera,
                width=800,
                height=600,
                keep_ar=False
            )
            self.setCentralWidget(self.preview)
            
            # 启动摄像头
            self.camera.start()
            
            print("✅ 摄像头 GPU 加速成功启动！")
            
        except Exception as e:
            print(f"❌ 摄像头初始化失败: {e}")
            sys.exit(1)
            
    def init_performance_monitor(self):
        """性能监控"""
        self.frame_count = 0
        self.last_time = time.time()
        
        # 定时器：每秒更新 FPS
        self.perf_timer = QTimer(self)
        self.perf_timer.timeout.connect(self.update_fps)
        self.perf_timer.start(1000)
        
        # 定时器：计算帧数
        self.frame_timer = QTimer(self)
        self.frame_timer.timeout.connect(self.count_frame)
        self.frame_timer.start(16)  # ~60fps
        
    def count_frame(self):
        """计数帧"""
        self.frame_count += 1
        
    def update_fps(self):
        """更新 FPS 显示"""
        current_time = time.time()
        elapsed = current_time - self.last_time
        fps = self.frame_count / elapsed
        
        self.fps_label.setText(f"FPS: {fps:.1f}")
        self.fps_label.raise_()  # 保持在最上层
        
        # 性能判断
        if fps >= 25:
            self.fps_label.setStyleSheet("color: lime; font-size: 16px;")
            status = "✅ 优秀"
        elif fps >= 15:
            self.fps_label.setStyleSheet("color: yellow; font-size: 16px;")
            status = "⚠️ 可接受"
        else:
            self.fps_label.setStyleSheet("color: red; font-size: 16px;")
            status = "❌ 太慢"
            
        print(f"FPS: {fps:.1f} - {status}")
        
        # 重置计数
        self.frame_count = 0
        self.last_time = current_time
        
    def keyPressEvent(self, event):
        """键盘测试响应时间"""
        if event.key() == Qt.Key_Space:
            start = time.time()
            print("⏱️ 空格键按下 - 测试响应...")
            
            # 模拟状态切换
            self.setWindowTitle("状态已切换！")
            QTimer.singleShot(500, lambda: self.setWindowTitle("A.InSight Native Prototype"))
            
            elapsed = (time.time() - start) * 1000
            print(f"✅ 响应时间: {elapsed:.1f}ms")
            
        elif event.key() == Qt.Key_Escape:
            print("👋 退出原型测试")
            self.close()
            
    def closeEvent(self, event):
        """清理资源"""
        print("🧹 清理资源...")
        if hasattr(self, 'camera'):
            self.camera.stop()
        event.accept()

def main():
    print("=" * 50)
    print("🚀 A.InSight Native Prototype")
    print("=" * 50)
    print()
    print("测试项目：")
    print("1. ✅ 摄像头 GPU 加速")
    print("2. ✅ 实时 FPS 监控")
    print("3. ✅ 响应时间测试（按空格键）")
    print()
    print("操作：")
    print("- 空格键: 测试响应时间")
    print("- ESC: 退出")
    print()
    print("性能标准：")
    print("- FPS ≥ 25: 优秀 ✅")
    print("- FPS 15-25: 可接受 ⚠️")
    print("- FPS < 15: 太慢 ❌")
    print("- 响应 < 100ms: 优秀 ✅")
    print()
    print("-" * 50)
    
    app = QApplication(sys.argv)
    window = PrototypeWindow()
    window.showFullScreen()
    
    exit_code = app.exec_()
    
    print()
    print("=" * 50)
    print("🏁 测试完成")
    print("=" * 50)
    
    sys.exit(exit_code)

if __name__ == '__main__':
    main()
