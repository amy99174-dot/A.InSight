#!/usr/bin/env python3
"""
A.InSight - 相机预览（圆形视窗）
显示相机画面在 380px 直径的圆形内，外部黑色
"""

from PyQt5.QtWidgets import QApplication, QMainWindow
from PyQt5.QtCore import Qt, QTimer
from PyQt5.QtGui import QPainter, QPainterPath, QBrush, QColor
from picamera2 import Picamera2
from picamera2.previews.qt import QGlPicamera2
import sys


class CircularCameraView(QGlPicamera2):
    """带圆形遮罩的相机视图"""
    
    def __init__(self, camera, **kwargs):
        super().__init__(camera, **kwargs)
        
        # 圆形直径（与Web应用一致）
        self.circle_diameter = 380
        
        # 定时器：强制刷新遮罩
        self.update_timer = QTimer(self)
        self.update_timer.timeout.connect(self.update)
        self.update_timer.start(33)  # ~30 FPS
    
    def paintEvent(self, event):
        """绘制相机画面 + 圆形遮罩"""
        # 1. 绘制相机画面（OpenGL）
        super().paintEvent(event)
        
        # 2. 绘制黑色遮罩
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        width = self.width()
        height = self.height()
        cx = width / 2
        cy = height / 2
        radius = self.circle_diameter / 2  # 190px
        
        # 创建路径：全屏矩形 - 圆形
        path_full = QPainterPath()
        path_full.addRect(0, 0, width, height)
        
        path_circle = QPainterPath()
        path_circle.addEllipse(cx - radius, cy - radius, 
                              self.circle_diameter, self.circle_diameter)
        
        # 遮罩 = 全屏 - 圆形
        mask = path_full.subtracted(path_circle)
        
        # 填充黑色
        painter.fillPath(mask, QBrush(Qt.black))
        
        painter.end()


class SimpleCameraApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("A.InSight Camera (380px Circle)")
        self.setStyleSheet("background-color: black;")
        
        # 初始化摄像头
        print("📷 初始化摄像头...")
        self.camera = Picamera2()
        
        # 配置：640x480，XRGB8888格式
        config = self.camera.create_preview_configuration(
            main={"size": (640, 480), "format": "XRGB8888"}
        )
        self.camera.configure(config)
        
        # 创建带遮罩的视图
        self.preview = CircularCameraView(
            self.camera,
            width=640,
            height=480,
            keep_ar=False
        )
        self.setCentralWidget(self.preview)
        
        # 启动摄像头
        self.camera.start()
        print("✅ 摄像头已启动（380px 圆形视窗）")
    
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
    print("🌟 A.InSight - 圆形相机预览 (380px)")
    print("   按 ESC 退出")
    
    app = QApplication(sys.argv)
    window = SimpleCameraApp()
    window.showFullScreen()
    sys.exit(app.exec_())
