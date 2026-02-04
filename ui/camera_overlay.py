"""
A.InSight - 摄像头叠加界面
将摄像头预览与圆形UI结合
"""

from PyQt5.QtWidgets import QWidget, QVBoxLayout
from PyQt5.QtCore import Qt, QRect
from PyQt5.QtGui import QPainter, QPen, QColor, QFont, QRegion
from picamera2.previews.qt import QGlPicamera2
import math


class CameraOverlayUI(QWidget):
    """摄像头预览 + 圆形遮罩界面"""
    
    def __init__(self, camera_preview=None, parent=None):
        super().__init__(parent)
        self.camera_preview = camera_preview
        self.scan_angle = 0
        self.pulse_alpha = 1.0
        self.pulse_direction = -1
        
        self.setStyleSheet("background-color: black;")
        
        # 如果有摄像头预览，设置布局
        if self.camera_preview:
            layout = QVBoxLayout(self)
            layout.setContentsMargins(0, 0, 0, 0)
            layout.addWidget(self.camera_preview)
            self.camera_preview.lower()  # 放到底层
    
    def set_scan_angle(self, angle):
        """设置扫描角度"""
        self.scan_angle = angle
        self.update()
    
    def set_pulse_alpha(self, alpha):
        """设置脉冲透明度"""
        self.pulse_alpha = alpha
        self.update()
    
    def paintEvent(self, event):
        """绘制圆形叠加层"""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        width = self.width()
        height = self.height()
        center_x = width // 2
        center_y = height // 2
        radius = min(width, height) // 3
        
        # === 绘制半透明黑色背景（除圆形外）===
        painter.fillRect(0, 0, width, height, QColor(0, 0, 0, 180))
        
        # === 清除圆形区域（显示摄像头） ===
        painter.setCompositionMode(QPainter.CompositionMode_Clear)
        painter.setBrush(Qt.transparent)
        painter.setPen(Qt.NoPen)
        painter.drawEllipse(center_x - radius, center_y - radius, 
                          radius * 2, radius * 2)
        
        # === 恢复正常绘制模式 ===
        painter.setCompositionMode(QPainter.CompositionMode_SourceOver)
        
        # === 绘制圆圈边框 ===
        pen = QPen(QColor(150, 100, 200, int(255 * self.pulse_alpha)))
        pen.setWidth(4)
        painter.setPen(pen)
        painter.setBrush(Qt.NoBrush)
        painter.drawEllipse(center_x - radius, center_y - radius, 
                          radius * 2, radius * 2)
        
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
        painter.drawLine(center_x, center_y, int(scan_x), int(scan_y))
        
        # === 顶部品牌名 ===
        painter.setPen(QColor(255, 255, 255))
        font = QFont("Sans Serif", 14, QFont.Bold)
        painter.setFont(font)
        painter.drawText(center_x - 50, 40, "A.InSight")
        
        # === 底部状态文字 ===
        font.setPointSize(12)
        painter.setFont(font)
        painter.drawText(center_x - 80, height - 30, "點擊鎖定目標")
