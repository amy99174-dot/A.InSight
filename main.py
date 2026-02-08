#!/usr/bin/env python3
"""
A.InSight - 测试文字叠加
全屏相机 + "测试" 文字
"""

from PyQt5.QtWidgets import QApplication, QMainWindow
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QPainter, QColor, QFont
from picamera2 import Picamera2
from picamera2.previews.qt import QGlPicamera2
import sys


class CameraWithText(QGlPicamera2):
    """带文字叠加的相机视图"""
    
    def paintEvent(self, event):
        """绘制相机画面 + 文字"""
        # 1. 绘制相机画面（OpenGL）
        super().paintEvent(event)
        
        # 2. 绘制文字
        painter = QPainter(self)
        painter.setPen(QColor(255, 255, 255))  # 白色
        painter.setFont(QFont("Sans", 30, QFont.Bold))
        painter.drawText(100, 100, "测试")
        painter.end()


class SimpleCameraApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("A.InSight Camera Test")
        self.setStyleSheet("background-color: black;")
        
        # 初始化摄像头
        print("📷 初始化摄像头...")
        self.camera = Picamera2()
        
        # 配置：640x480
        config = self.camera.create_preview_configuration(
            main={"size": (640, 480), "format": "XRGB8888"}
        )
        self.camera.configure(config)
        
        # 创建带文字的视图
        self.preview = CameraWithText(
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
        if event.key() == Qt.Key_Escape:
            self.close()
    
    def closeEvent(self, event):
        print("🛑 关闭摄像头...")
        self.camera.stop()
        self.camera.close()
        event.accept()


if __name__ == "__main__":
    print("🌟 A.InSight - 文字叠加测试")
    print("   预期：全屏相机 + '测试' 文字")
    print("   按 ESC 退出")
    
    app = QApplication(sys.argv)
    window = SimpleCameraApp()
    window.showFullScreen()
    sys.exit(app.exec_())
