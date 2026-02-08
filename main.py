#!/usr/bin/env python3
"""
A.InSight - 软件渲染 + 圆形遮罩
380px 圆形视窗 + 中心文字
"""

from PyQt5.QtWidgets import QApplication, QWidget, QLabel
from PyQt5.QtCore import Qt, QTimer
from PyQt5.QtGui import QImage, QPixmap, QPainter, QColor, QFont, QPainterPath, QBrush
from picamera2 import Picamera2
import numpy as np
import sys


class SoftwareRenderCamera(QWidget):
    """纯软件渲染的相机显示"""
    
    def __init__(self):
        super().__init__()
        self.setStyleSheet("background-color: black;")
        
        # 显示标签
        self.label = QLabel(self)
        self.label.setAlignment(Qt.AlignCenter)
        
        # 圆形直径
        self.circle_diameter = 380
        
        # 初始化摄像头
        print("📷 初始化摄像头（软件渲染）...")
        self.camera = Picamera2()
        config = self.camera.create_video_configuration(
            main={"size": (640, 480), "format": "RGB888"}
        )
        self.camera.configure(config)
        self.camera.start()
        print("✅ 摄像头已启动")
        
        # 定时器：捕获并渲染帧
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.update_frame)
        self.timer.start(33)  # ~30 FPS
    
    def update_frame(self):
        """捕获帧并绘制遮罩+文字"""
        try:
            # 1. 捕获帧
            frame = self.camera.capture_array("main")
            if frame is None:
                return
            
            # 2. 转换为 QImage
            height, width, channels = frame.shape
            if not frame.flags['C_CONTIGUOUS']:
                frame = np.ascontiguousarray(frame)
            
            bytes_per_line = channels * width
            q_image = QImage(frame.tobytes(), width, height, bytes_per_line, QImage.Format_RGB888)
            
            # 3. 转换为 QPixmap
            pixmap = QPixmap.fromImage(q_image)
            
            # 4. 绘制圆形遮罩
            painter = QPainter(pixmap)
            painter.setRenderHint(QPainter.Antialiasing)
            
            # 计算中心点
            cx = width / 2
            cy = height / 2
            radius = self.circle_diameter / 2  # 190px
            
            # 创建路径：全屏 - 圆形
            path_full = QPainterPath()
            path_full.addRect(0, 0, width, height)
            
            path_circle = QPainterPath()
            path_circle.addEllipse(cx - radius, cy - radius, 
                                  self.circle_diameter, self.circle_diameter)
            
            # 遮罩 = 全屏 - 圆形
            mask = path_full.subtracted(path_circle)
            
            # 填充黑色
            painter.fillPath(mask, QBrush(Qt.black))
            
            # 5. 绘制中心文字
            painter.setPen(QColor(255, 255, 255))  # 白色
            painter.setFont(QFont("Sans", 30, QFont.Bold))
            painter.drawText(int(cx - 40), int(cy), "测试")
            
            painter.end()
            
            # 6. 显示
            self.label.setPixmap(pixmap)
            
        except Exception as e:
            print(f"❌ 渲染错误: {e}")
    
    def keyPressEvent(self, event):
        if event.key() == Qt.Key_Escape:
            self.close()
    
    def closeEvent(self, event):
        print("🛑 关闭摄像头...")
        self.timer.stop()
        self.camera.stop()
        self.camera.close()
        event.accept()
    
    def resizeEvent(self, event):
        super().resizeEvent(event)
        self.label.setGeometry(0, 0, self.width(), self.height())


if __name__ == "__main__":
    print("🌟 A.InSight - 软件渲染 + 圆形遮罩")
    print("   380px 圆形视窗")
    print("   中心文字：测试")
    print("   按 ESC 退出")
    
    app = QApplication(sys.argv)
    window = SoftwareRenderCamera()
    window.showFullScreen()
    sys.exit(app.exec_())
