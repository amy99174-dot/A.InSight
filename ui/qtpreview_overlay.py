"""
摄像头预览 + paintEvent叠加层
使用 Picamera2 的 QGlPicamera2 配合父窗口绘制
"""

from PyQt5.QtWidgets import QWidget
from PyQt5.QtCore import Qt, QTimer
from PyQt5.QtGui import QPainter, QPen, QColor, QFont, QImage
from picamera2.previews.qt import QGlPicamera2
import math


class QtPreviewOverlay(QWidget):
    """使用 QtPreview 的摄像头叠加方案"""
    
    def __init__(self, camera_manager, parent=None):
        super().__init__(parent)
        self.camera_manager = camera_manager
        self.scan_angle = 0
        self.pulse_alpha = 1.0
        self.pulse_direction = -1
        
        # 黑色背景
        self.setStyleSheet("background-color: black;")
        
        # 创建 Qt 预览组件（OpenGL加速）
        if camera_manager and camera_manager.camera:
            self.preview = QGlPicamera2(
                camera_manager.camera,
                width=800,
                height=600,
                keep_ar=False  # 填充整个区域
            )
            self.preview.setParent(self)
            self.preview.move(0, 0)
            self.preview.resize(800, 600)
            self.preview.show()
            print("✅ QGlPicamera2 预览创建成功")
            
            # QGlPicamera2 创建后启动摄像头
            camera_manager.start()
        else:
            self.preview = None
            print("⚠️ 无法创建预览，camera_manager 无效")
        
        # 准备透明UI画布
        self.ui_overlay = QImage(800, 600, QImage.Format_ARGB32)
        self.update_ui_canvas()
        
        # 动画定时器
        self.animation_timer = QTimer(self)
        self.animation_timer.timeout.connect(self.animate)
        self.animation_timer.start(16)  # ~60 FPS
        
        print("✅ QtPreviewOverlay 初始化完成")
    
    def update_ui_canvas(self):
        """更新UI画布（透明背景）"""
        self.ui_overlay.fill(Qt.transparent)  # 关键：透明背景
        
        painter = QPainter(self.ui_overlay)
        painter.setRenderHint(QPainter.Antialiasing)
        
        width = self.ui_overlay.width()
        height = self.ui_overlay.height()
        cx = width / 2
        cy = height / 2
        radius = min(width, height) / 3
        
        # 圆圈
        pen = QPen(QColor(150, 100, 200, int(255 * self.pulse_alpha)))
        pen.setWidth(5)
        painter.setPen(pen)
        painter.setBrush(Qt.NoBrush)
        painter.drawEllipse(int(cx - radius), int(cy - radius), 
                          int(radius * 2), int(radius * 2))
        
        # 刻度线
        pen.setColor(QColor(255, 255, 255, 150))
        pen.setWidth(2)
        painter.setPen(pen)
        
        for angle in range(0, 360, 30):
            rad = math.radians(angle)
            start_x = cx + math.cos(rad) * (radius - 15)
            start_y = cy + math.sin(rad) * (radius - 15)
            end_x = cx + math.cos(rad) * radius
            end_y = cy + math.sin(rad) * radius
            painter.drawLine(int(start_x), int(start_y), int(end_x), int(end_y))
        
        # 扫描线
        pen.setColor(QColor(255, 255, 255, 200))
        pen.setWidth(3)
        painter.setPen(pen)
        
        rad = math.radians(self.scan_angle)
        sx = cx + math.cos(rad) * radius
        sy = cy + math.sin(rad) * radius
        painter.drawLine(int(cx), int(cy), int(sx), int(sy))
        
        # 文字
        painter.setPen(QColor(255, 255, 255))
        font = QFont("Sans Serif", 20, QFont.Bold)
        painter.setFont(font)
        painter.drawText(20, 50, "A.InSight")
        
        font.setPointSize(14)
        painter.setFont(font)
        painter.drawText(20, int(height - 20), "點擊鎖定目標")
        
        painter.end()
    
    def animate(self):
        """动画更新"""
        # 扫描线旋转
        self.scan_angle = (self.scan_angle + 2) % 360
        
        # 脉冲效果
        self.pulse_alpha += self.pulse_direction * 0.02
        if self.pulse_alpha <= 0.3:
            self.pulse_direction = 1
        elif self.pulse_alpha >= 1.0:
            self.pulse_direction = -1
        
        # 更新UI画布
        self.update_ui_canvas()
        
        # 触发重绘
        self.update()
    
    def paintEvent(self, event):
        """在摄像头预览之上绘制UI"""
        painter = QPainter(self)
        # 将透明UI画布绘制在最上层
        painter.drawImage(0, 0, self.ui_overlay)
    
    def resizeEvent(self, event):
        """调整大小"""
        super().resizeEvent(event)
        if self.preview:
            self.preview.resize(self.width(), self.height())
        
        # 重新创建UI画布
        self.ui_overlay = QImage(self.width(), self.height(), QImage.Format_ARGB32)
        self.update_ui_canvas()
