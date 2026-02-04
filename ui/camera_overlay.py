"""
A.InSight - 摄像头叠加界面
将摄像头预览与圆形UI结合
"""

from PyQt5.QtWidgets import QWidget, QStackedLayout
from PyQt5.QtCore import Qt, QTimer
from PyQt5.QtGui import QPainter, QPen, QColor, QFont, QPainterPath
import math


class CircularOverlay(QWidget):
    """圆形叠加层（透明背景，绘制圆圈和遮罩）"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setAttribute(Qt.WA_TransparentForMouseEvents, False)
        
        self.scan_angle = 0
        self.pulse_alpha = 1.0
        self.pulse_direction = -1
    
    def paintEvent(self, event):
        """绘制叠加层"""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        width = self.width()
        height = self.height()
        center_x = width / 2
        center_y = height / 2
        radius = min(width, height) / 3
        
        # === 1. 绘制半透明黑色背景（整个屏幕）===
        painter.fillRect(0, 0, width, height, QColor(0, 0, 0, 180))
        
        # === 2. 创建圆形路径并"挖空"===
        path = QPainterPath()
        path.addRect(0, 0, width, height)  # 整个屏幕
        
        # 减去圆形区域
        circle_path = QPainterPath()
        circle_path.addEllipse(center_x - radius, center_y - radius, 
                              radius * 2, radius * 2)
        path = path.subtracted(circle_path)
        
        # 绘制挖空后的遮罩（圆形外部）
        painter.setCompositionMode(QPainter.CompositionMode_SourceOver)
        painter.fillPath(path, QColor(0, 0, 0, 180))
        
        # === 3. 绘制圆圈边框 ===
        pen = QPen(QColor(150, 100, 200, int(255 * self.pulse_alpha)))
        pen.setWidth(4)
        painter.setPen(pen)
        painter.setBrush(Qt.NoBrush)
        painter.drawEllipse(center_x - radius, center_y - radius, 
                          radius * 2, radius * 2)
        
        # === 4. 绘制刻度线 ===
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
        
        # === 5. 绘制扫描线 ===
        pen.setColor(QColor(255, 255, 255, 200))
        pen.setWidth(3)
        painter.setPen(pen)
        
        rad = math.radians(self.scan_angle)
        scan_x = center_x + math.cos(rad) * radius
        scan_y = center_y + math.sin(rad) * radius
        painter.drawLine(int(center_x), int(center_y), int(scan_x), int(scan_y))
        
        # === 6. 顶部品牌名 ===
        painter.setPen(QColor(255, 255, 255))
        font = QFont("Sans Serif", 14, QFont.Bold)
        painter.setFont(font)
        text_rect = painter.boundingRect(0, 0, 0, 0, 0, "A.InSight")
        painter.drawText(int(center_x - text_rect.width() / 2), 40, "A.InSight")
        
        # === 7. 底部状态文字 ===
        font.setPointSize(12)
        painter.setFont(font)
        status_text = "點擊鎖定目標"
        text_rect = painter.boundingRect(0, 0, 0, 0, 0, status_text)
        painter.drawText(int(center_x - text_rect.width() / 2), 
                        height - 30, status_text)


class CameraOverlayUI(QWidget):
    """摄像头预览 + 圆形叠加层的容器"""
    
    def __init__(self, camera_preview=None, parent=None):
        super().__init__(parent)
        
        # 堆叠布局
        self.layout = QStackedLayout(self)
        self.layout.setStackingMode(QStackedLayout.StackAll)
        
        # 底层：摄像头预览
        if camera_preview:
            self.camera_preview = camera_preview
            self.layout.addWidget(self.camera_preview)
        
        # 顶层：圆形叠加
        self.overlay = CircularOverlay(self)
        self.layout.addWidget(self.overlay)
    
    def set_scan_angle(self, angle):
        """设置扫描角度"""
        self.overlay.scan_angle = angle
        self.overlay.update()
    
    def set_pulse_alpha(self, alpha):
        """设置脉冲透明度"""
        self.overlay.pulse_alpha = alpha
        self.overlay.update()
    
    @property
    def scan_angle(self):
        return self.overlay.scan_angle
    
    @property
    def pulse_alpha(self):
        return self.overlay.pulse_alpha
    
    @pulse_alpha.setter
    def pulse_alpha(self, value):
        self.overlay.pulse_alpha = value
    
    @property
    def pulse_direction(self):
        return self.overlay.pulse_direction
    
    @pulse_direction.setter
    def pulse_direction(self, value):
        self.overlay.pulse_direction = value

