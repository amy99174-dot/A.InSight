"""
透明悬浮UI窗口 - 绕过OpenGL渲染问题
"""

from PyQt5.QtWidgets import QWidget
from PyQt5.QtCore import Qt, QTimer
from PyQt5.QtGui import QPainter, QPen, QColor, QFont, QRegion
import math


class FloatingUIOverlay(QWidget):
    """透明悬浮UI窗口 - 独立窗口，不受OpenGL影响"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        
        # 关键：设置为无边框、始终在最上层
        self.setWindowFlags(
            Qt.FramelessWindowHint |  # 无边框
            Qt.WindowStaysOnTopHint |  # 始终在最上层
            Qt.Tool                     # 工具窗口（不出现在任务栏）
        )
        
        # 测试：使用半透明黑色背景（而不是完全透明）
        self.setStyleSheet("background-color: rgba(0, 0, 0, 30);")  # 30/255 透明度
        self.setAttribute(Qt.WA_TransparentForMouseEvents)  # 鼠标事件穿透
        
        self.scan_angle = 0
        self.pulse_alpha = 1.0
        self.paint_count = 0
        
        print("✅ Floating UIOverlay 创建完成（半透明背景测试）")
    
    def paintEvent(self, event):
        """绘制UI元素"""
        # 调试输出
        self.paint_count += 1
        if self.paint_count == 1:
            print("🎨 FloatingUIOverlay paintEvent 首次调用！")
        if self.paint_count % 60 == 0:
            print(f"🎨 FloatingUIOverlay paintEvent 第 {self.paint_count} 次")
        
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        width = self.width()
        height = self.height()
        center_x = width / 2
        center_y = height / 2
        radius = min(width, height) / 3
        
        # 测试：绘制一个大红圈，确保可见
        test_pen = QPen(QColor(255, 0, 0, 255))  # 纯红色
        test_pen.setWidth(10)
        painter.setPen(test_pen)
        painter.setBrush(Qt.NoBrush)
        painter.drawEllipse(int(center_x - radius), int(center_y - radius), 
                          int(radius * 2), int(radius * 2))
        
        # 原有UI元素
        pen = QPen(QColor(150, 100, 200, int(255 * self.pulse_alpha)))
        pen.setWidth(4)
        painter.setPen(pen)
        painter.drawEllipse(int(center_x - radius + 10), int(center_y - radius + 10), 
                          int((radius - 10) * 2), int((radius - 10) * 2))
        
        # 扫描线
        pen.setColor(QColor(255, 255, 255, 200))
        pen.setWidth(3)
        painter.setPen(pen)
        
        rad = math.radians(self.scan_angle)
        scan_x = center_x + math.cos(rad) * radius
        scan_y = center_y + math.sin(rad) * radius
        painter.drawLine(int(center_x), int(center_y), int(scan_x), int(scan_y))
        
        # 文字
        painter.setPen(QColor(255, 255, 255))
        font = QFont("Sans Serif", 20, QFont.Bold)
        painter.setFont(font)
        painter.drawText(50, 60, "A.InSight - OVERLAY TEST")
