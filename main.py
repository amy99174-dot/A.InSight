#!/usr/bin/env python3
"""
A.InSight - QStackedLayout 图层方案
底层：OpenGL 相机
顶层：透明 UI
"""

from PyQt5.QtWidgets import QApplication, QMainWindow, QWidget, QStackedLayout
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QPainter, QColor, QFont
from picamera2 import Picamera2
from picamera2.previews.qt import QGlPicamera2
import sys


class TransparentUI(QWidget):
    """透明的 UI 覆盖层"""
    
    def __init__(self):
        super().__init__()
        # 设置透明背景
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setAttribute(Qt.WA_TransparentForMouseEvents, False)
        
    def paintEvent(self, event):
        """绘制 UI 元素"""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        # 绘制白色"测试"文字
        painter.setPen(QColor(255, 255, 255))
        painter.setFont(QFont("Sans", 30, QFont.Bold))
        painter.drawText(100, 100, "测试")
        
        painter.end()


class LayeredCameraApp(QMainWindow):
    """使用 QStackedLayout 的分层应用"""
    
    def __init__(self):
        super().__init__()
        self.setWindowTitle("A.InSight - Layered UI")
        self.setStyleSheet("background-color: black;")
        
        # 初始化摄像头
        print("📷 初始化摄像头（OpenGL）...")
        self.camera = Picamera2()
        config = self.camera.create_preview_configuration(
            main={"size": (640, 480), "format": "XRGB8888"}
        )
        self.camera.configure(config)
        
        # 创建中心容器
        container = QWidget()
        self.setCentralWidget(container)
        
        # 创建堆叠布局（关键！）
        layout = QStackedLayout(container)
        layout.setStackingMode(QStackedLayout.StackAll)  # 所有层同时显示
        
        # 底层：OpenGL 相机视图
        self.camera_view = QGlPicamera2(
            self.camera,
            width=640,
            height=480,
            keep_ar=False
        )
        layout.addWidget(self.camera_view)
        
        # 顶层：透明 UI
        self.ui_layer = TransparentUI()
        layout.addWidget(self.ui_layer)
        
        # 启动摄像头
        self.camera.start()
        print("✅ 摄像头已启动（图层模式）")
    
    def keyPressEvent(self, event):
        if event.key() == Qt.Key_Escape:
            self.close()
    
    def closeEvent(self, event):
        print("🛑 关闭摄像头...")
        self.camera.stop()
        self.camera.close()
        event.accept()


if __name__ == "__main__":
    print("🌟 A.InSight - QStackedLayout 测试")
    print("   底层：OpenGL 相机")
    print("   顶层：透明 UI + '测试' 文字")
    print("   按 ESC 退出")
    
    app = QApplication(sys.argv)
    window = LayeredCameraApp()
    window.showFullScreen()
    sys.exit(app.exec_())
