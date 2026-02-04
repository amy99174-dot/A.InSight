"""
A.InSight - 摄像头圆形界面
使用几何布局而非叠加层
"""

from PyQt5.QtWidgets import QWidget
from PyQt5.QtCore import Qt, QTimer, QRect
from PyQt5.QtGui import QPainter, QPen, QColor, QFont, QPainterPath, QRegion
import math


class TransparentOverlay(QWidget):
    """透明叠加层 - 绘制圆圈、扫描线等UI元素"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setAttribute(Qt.WA_TransparentForMouseEvents)
        self.setAttribute(Qt.WA_TranslucentBackground)
        
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


class CameraOverlayUI(QWidget):
    """摄像头圆形界面 - 使用固定尺寸圆形摄像头"""
    
    def __init__(self, camera_preview=None, parent=None):
        super().__init__(parent)
        
        self.camera_preview = camera_preview
        self.scan_angle = 0
        self.pulse_alpha = 1.0
        self.pulse_direction = -1
        
        # 黑色背景
        self.setStyleSheet("background-color: black;")
        
        # 如果有摄像头预览
        if self.camera_preview:
            self.camera_preview.setParent(self)
        
        # 创建透明叠加层（在摄像头之后创建会自动在上层）
        self.overlay = TransparentOverlay(self)
        # 不使用 raise_()，让 Qt 自动管理 z-order
    
    def resizeEvent(self, event):
        """窗口大小变化时重新计算摄像头位置"""
        super().resizeEvent(event)
        
        width = self.width()
        height = self.height()
        
        # 圆形直径（屏幕较小边的 2/3）
        diameter = min(width, height) * 2 // 3
        
        # 计算圆形中心位置
        center_x = width // 2
        center_y = height // 2
        
        if self.camera_preview:
            # 摄像头预览位置和大小
            camera_x = center_x - diameter // 2
            camera_y = center_y - diameter // 2
            
            # 设置摄像头预览的几何位置
            self.camera_preview.setGeometry(camera_x, camera_y, diameter, diameter)
            
            # 应用圆形遮罩到摄像头预览
            region = QRegion(0, 0, diameter, diameter, QRegion.Ellipse)
            self.camera_preview.setMask(region)
        
        # 叠加层覆盖整个窗口
        self.overlay.setGeometry(0, 0, width, height)
        self.overlay.show()
        self.overlay.raise_()  # 在 resize 时确保在最上层
    
    def paintEvent(self, event):
        """绘制文字（在背景层）"""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        width = self.width()
        height = self.height()
        center_x = width / 2
        
        # === 顶部品牌名 ===
        painter.setPen(QColor(255, 255, 255))
        font = QFont("Sans Serif", 16, QFont.Bold)
        painter.setFont(font)
        text_rect = painter.boundingRect(0, 0, 0, 0, 0, "A.InSight")
        painter.drawText(int(center_x - text_rect.width() / 2), 50, "A.InSight")
        
        # === 底部状态文字 ===
        font.setPointSize(14)
        painter.setFont(font)
        status_text = "點擊鎖定目標"
        text_rect = painter.boundingRect(0, 0, 0, 0, 0, status_text)
        painter.drawText(int(center_x - text_rect.width() / 2), 
                        int(height - 40), status_text)
    
    def set_scan_angle(self, angle):
        """设置扫描角度"""
        self.scan_angle = angle
        self.overlay.scan_angle = angle
        self.overlay.update()
    
    def set_pulse_alpha(self, alpha):
        """设置脉冲透明度"""
        self.pulse_alpha = alpha
        self.overlay.pulse_alpha = alpha
        self.overlay.update()

