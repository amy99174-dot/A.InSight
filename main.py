#!/usr/bin/env python3
"""
A.InSight - 最简单的相机预览
只显示相机画面，无额外UI
"""

from PyQt5.QtWidgets import QApplication, QMainWindow
from PyQt5.QtCore import Qt
from picamera2 import Picamera2
from picamera2.previews.qt import QGlPicamera2
import sys

class SimpleCameraApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("A.InSight Camera")
        self.setStyleSheet("background-color: black;")
        
        # 初始化摄像头
        print("📷 初始化摄像头...")
        self.camera = Picamera2()
        
        # 配置：640x480，XRGB8888格式
        config = self.camera.create_preview_configuration(
            main={"size": (640, 480), "format": "XRGB8888"}
        )
        self.camera.configure(config)
        
        # 创建OpenGL预览（GPU加速）
        self.preview = QGlPicamera2(
            self.camera,
            width=640,
            height=480,
            keep_ar=False
        )
        self.setCentralWidget(self.preview)
        
        # 启动摄像头
        self.camera.start()
        print("✅ 摄像头已启动")
    
    def keyPressEvent(self, event):
        """按ESC退出"""
        if event.key() == Qt.Key_Escape:
            self.close()
    
    def closeEvent(self, event):
        """清理资源"""
        print("🛑 关闭摄像头...")
        self.camera.stop()
        self.camera.close()
        event.accept()

if __name__ == "__main__":
    print("🌟 A.InSight - 简单相机预览")
    print("   按 ESC 退出")
    
    app = QApplication(sys.argv)
    window = SimpleCameraApp()
    window.showFullScreen()
    sys.exit(app.exec_())
