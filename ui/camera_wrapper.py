"""
摄像头包装器 - 在摄像头预览上直接绘制UI
"""

from PyQt5.QtWidgets import QWidget
from PyQt5.QtCore import Qt, QTimer
from PyQt5.QtGui import QPainter, QPen, QColor, QFont
import math


class CameraWithUI(QWidget):
    """摄像头包装器 - 在 OpenGL 摄像头上绘制 UI"""
    
    def __init__(self, camera_preview, parent=None):
        super().__init__(parent)
        self.camera_preview = camera_preview
        self.scan_angle = 0
        self.pulse_alpha = 1.0
        
        # 摄像头作为子控件
        self.camera_preview.setParent(self)
        
        # 强制设置初始大小（填充800x600）
        self.camera_preview.setGeometry(0, 0, 800, 600)
        self.camera_preview.show()
        self.camera_preview.lower()
        
        # 定时器触发重绘
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.update)
        self.timer.start(16)  # ~60 FPS
    
    def showEvent(self, event):
        """窗口显示时确保摄像头正确定位"""
        super().showEvent(event)
        print(f"📐 CameraWithUI showEvent: {self.width()}x{self.height()}")
        self.camera_preview.setGeometry(0, 0, self.width(), self.height())
        self.camera_preview.lower()
    
    def resizeEvent(self, event):
        """调整摄像头大小"""
        super().resizeEvent(event)
        print(f"📐 CameraWithUI resizeEvent: {self.width()}x{self.height()}")
        # 摄像头填充整个 widget
        self.camera_preview.setGeometry(0, 0, self.width(), self.height())
        self.camera_preview.lower()
    
    def paintEvent(self, event):
        """在摄像头上绘制UI"""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        width = self.width()
        height = self.height()
        center_x = width / 2
        center_y = height / 2
        radius = min(width, height) / 2
        
        # === 绘制圆圈边框 ===
        pen = QPen(QColor(150, 100, 200, int(255 * self.pulse_alpha)))
        pen.setWidth(4)
        painter.setPen(pen)
        painter.setBrush(Qt.NoBrush)
        painter.drawEllipse(int(center_x - radius), int(center_y - radius), 
                          int(radius * 2), int(radius * 2))
        
        # === 绘制刻度线 ===
        pen.setColor(QColor(255, 255, 255, 150))
        pen.setWidth(2)
        painter.setPen(pen)
        
        for angle in range(0, 360, 30):
            rad = math.radians(angle)
            start_x = center_x + math.cos(rad) * (radius - 15)
            start_y = center_y + math.sin(rad) * (radius - 15)
            end_x = center_x + math.cos(rad) * radius
            end_y = center_y + math.sin(rad) * radius
            painter.drawLine(int(start_x), int(start_y), int(end_x), int(end_y))
        
        # === 绘制扫描线 ===
        pen.setColor(QColor(255, 255, 255, 200))
        pen.setWidth(3)
        painter.setPen(pen)
        
        rad = math.radians(self.scan_angle)
        scan_x = center_x + math.cos(rad) * radius
        scan_y = center_y + math.sin(rad) * radius
        painter.drawLine(int(center_x), int(center_y), int(scan_x), int(scan_y))
        
        # === 顶部品牌名 ===
        painter.setPen(QColor(255, 255, 255))
        font = QFont("Sans Serif", 16, QFont.Bold)
        painter.setFont(font)
        painter.drawText(20, 50, "A.InSight")
        
        # === 底部状态文字 ===
        font.setPointSize(14)
        painter.setFont(font)
        painter.drawText(20, int(height - 20), "點擊鎖定目標")
