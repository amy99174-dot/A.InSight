"""
A.InSight - 摄像头圆形界面
摄像头在底层 + 独立UI叠加层在顶层
"""

from PyQt5.QtWidgets import QWidget
from PyQt5.QtCore import Qt, QRect
from PyQt5.QtGui import QPainter, QPen, QColor, QFont, QRegion, QPainterPath
import math


class UIOverlay(QWidget):
    """独立的UI叠加层 - 绘制所有UI元素"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        
        # 关键：设置为完全透明背景
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setAttribute(Qt.WA_NoSystemBackground)
        self.setAutoFillBackground(False)
        
        self.scan_angle = 0
        self.pulse_alpha = 1.0
    
    def paintEvent(self, event):
        """绘制UI元素"""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        width = self.width()
        height = self.height()
        center_x = width / 2
        center_y = height / 2
        radius = min(width, height) / 3
        
        # === 1. 绘制圆圈边框 ===
        pen = QPen(QColor(150, 100, 200, int(255 * self.pulse_alpha)))
        pen.setWidth(4)
        painter.setPen(pen)
        painter.setBrush(Qt.NoBrush)
        painter.drawEllipse(int(center_x - radius), int(center_y - radius), 
                          int(radius * 2), int(radius * 2))
        
        # === 2. 绘制刻度线 ===
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
        
        # === 3. 绘制扫描线 ===
        pen.setColor(QColor(255, 255, 255, 200))
        pen.setWidth(3)
        painter.setPen(pen)
        
        rad = math.radians(self.scan_angle)
        scan_x = center_x + math.cos(rad) * radius
        scan_y = center_y + math.sin(rad) * radius
        painter.drawLine(int(center_x), int(center_y), int(scan_x), int(scan_y))
        
        # === 4. 顶部品牌名 ===
        painter.setPen(QColor(255, 255, 255))
        font = QFont("Sans Serif", 16, QFont.Bold)
        painter.setFont(font)
        text_rect = painter.boundingRect(0, 0, 0, 0, 0, "A.InSight")
        painter.drawText(int(center_x - text_rect.width() / 2), 50, "A.InSight")
        
        # === 5. 底部状态文字 ===
        font.setPointSize(14)
        painter.setFont(font)
        status_text = "點擊鎖定目標"
        text_rect = painter.boundingRect(0, 0, 0, 0, 0, status_text)
        painter.drawText(int(center_x - text_rect.width() / 2), 
                        int(height - 40), status_text)


class CameraOverlayUI(QWidget):
    """摄像头圆形界面 - 摄像头在底层 + UI叠加层在顶层"""
    
    def __init__(self, camera_preview=None, parent=None):
        super().__init__(parent)
        
        self.camera_preview = camera_preview
        self.scan_angle = 0
        self.pulse_alpha = 1.0
        self.pulse_direction = -1
        
        # 黑色背景
        self.setStyleSheet("background-color: black;")
        
        # 摄像头在底层
        if self.camera_preview:
            self.camera_preview.setParent(self)
            self.camera_preview.lower()
        
        # UI叠加层在顶层
        self.ui_overlay = UIOverlay(self)
        # 暂时隐藏UI叠加层来测试摄像头
        self.ui_overlay.hide()
        # self.ui_overlay.raise_()  # 确保在最上层
    
    def resizeEvent(self, event):
        """窗口大小变化时重新计算位置"""
        super().resizeEvent(event)
        
        width = self.width()
        height = self.height()
        
        # 圆形直径
        diameter = min(width, height) * 2 // 3
        center_x = width // 2
        center_y = height // 2
        
        # 设置摄像头位置和遮罩
        if self.camera_preview:
            camera_x = center_x - diameter // 2
            camera_y = center_y - diameter // 2
            self.camera_preview.setGeometry(camera_x, camera_y, diameter, diameter)
            
            region = QRegion(0, 0, diameter, diameter, QRegion.Ellipse)
            self.camera_preview.setMask(region)
            self.camera_preview.lower()  # 确保在底层
        
        # UI叠加层覆盖整个窗口
        self.ui_overlay.setGeometry(0, 0, width, height)
        self.ui_overlay.raise_()  # 确保在最上层
    
    def set_scan_angle(self, angle):
        """设置扫描角度"""
        self.scan_angle = angle
        self.ui_overlay.scan_angle = angle
        self.ui_overlay.update()
    
    def set_pulse_alpha(self, alpha):
        """设置脉冲透明度"""
        self.pulse_alpha = alpha
        self.ui_overlay.pulse_alpha = alpha
        self.ui_overlay.update()
