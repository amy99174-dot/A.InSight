"""
A.InSight - 圆形扫描 UI
"""

from PyQt5.QtWidgets import QWidget
from PyQt5.QtCore import QTimer, Qt
from PyQt5.QtGui import QPainter, QPen, QColor, QFont, QBrush
import math
import time


class CircularScanUI(QWidget):
    """圆形扫描界面"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setStyleSheet("background-color: black;")
        
        # 动画参数
        self.scan_angle = 0  # 扫描线角度
        self.pulse_alpha = 1.0  # 脉冲透明度
        self.pulse_direction = -1  # 脉冲方向
        
        # 显示文本
        self.main_text = "正在探測歷史訊號"
        self.sub_text = "尋找中..."
        
        # 动画定时器
        self.anim_timer = QTimer(self)
        self.anim_timer.timeout.connect(self.update_animation)
        self.anim_timer.start(16)  # ~60 FPS
    
    def update_animation(self):
        """更新动画"""
        # 扫描线旋转
        self.scan_angle = (self.scan_angle + 2) % 360
        
        # 脉冲效果
        self.pulse_alpha += self.pulse_direction * 0.02
        if self.pulse_alpha <= 0.3:
            self.pulse_direction = 1
        elif self.pulse_alpha >= 1.0:
            self.pulse_direction = -1
        
        self.update()
    
    def set_text(self, main_text: str, sub_text: str = ""):
        """设置显示文本"""
        self.main_text = main_text
        self.sub_text = sub_text
        self.update()
    
    def paintEvent(self, event):
        """绘制事件"""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        # 获取窗口尺寸
        width = self.width()
        height = self.height()
        center_x = width // 2
        center_y = height // 2
        
        # 圆形半径（取较小的一边）
        radius = min(width, height) // 3
        
        # === 绘制圆圈 ===
        pen = QPen(QColor(150, 100, 200, int(255 * self.pulse_alpha)))  # 紫色
        pen.setWidth(3)
        painter.setPen(pen)
        painter.setBrush(Qt.NoBrush)
        painter.drawEllipse(center_x - radius, center_y - radius, 
                          radius * 2, radius * 2)
        
        # === 绘制刻度线 ===
        pen.setColor(QColor(255, 255, 255, 100))
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
        
        # === 绘制文本 ===
        painter.setPen(QColor(255, 255, 255))
        
        # 主标题
        font = QFont("Sans Serif", 20, QFont.Bold)
        painter.setFont(font)
        text_rect = painter.boundingRect(0, 0, width, height, 
                                        Qt.AlignCenter, self.main_text)
        painter.drawText(center_x - text_rect.width() // 2, 
                        center_y - 40, self.main_text)
        
        # 副标题
        font.setPointSize(14)
        font.setWeight(QFont.Normal)
        painter.setFont(font)
        painter.drawText(center_x - 50, center_y + 20, self.sub_text)
        
        # === 顶部品牌名 ===
        font.setPointSize(12)
        painter.setFont(font)
        painter.drawText(center_x - 40, 50, "A.InSight")
    
    def stop_animation(self):
        """停止动画"""
        self.anim_timer.stop()
    
    def start_animation(self):
        """开始动画"""
        if not self.anim_timer.isActive():
            self.anim_timer.start(16)
