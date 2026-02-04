"""
OpenCV摄像头渲染器 - 使用软件渲染，稳定可靠
基于 test_simple_ui.py 的成功实现
"""

from PyQt5.QtWidgets import QWidget, QLabel
from PyQt5.QtCore import Qt, QTimer
from PyQt5.QtGui import QImage, QPixmap, QPainter, QPen, QColor, QFont
import numpy as np
import math


class OpenCVCameraRenderer(QWidget):
    """使用OpenCV渲染摄像头 - 稳定方案"""
    
    def __init__(self, camera_manager, parent=None):
        super().__init__(parent)
        self.camera_manager = camera_manager
        self.scan_angle = 0
        self.pulse_alpha = 1.0
        self.pulse_direction = -1
        
        # 黑色背景
        self.setStyleSheet("background-color: black;")
        
        # 摄像头画面显示标签 - 关键：明确设置geometry
        self.camera_label = QLabel(self)
        self.camera_label.setGeometry(0, 0, 800, 600)
        self.camera_label.setAlignment(Qt.AlignCenter)
        self.camera_label.setScaledContents(True)  # 自动缩放内容
        
        # 帧计数器
        self.frame_count = 0
        
        # 定时器：获取摄像头帧
        self.frame_timer = QTimer(self)
        self.frame_timer.timeout.connect(self.update_frame)
        self.frame_timer.start(33)  # ~30 FPS
        
        print("✅ OpenCVCameraRenderer 初始化完成（简化模式）")
    
    def update_frame(self):
        """获取摄像头帧并更新"""
        try:
            # 1. 获取帧
            frame = self.camera_manager.get_current_frame()
            if frame is None:
                return
            
            # RGBA -> RGB
            if len(frame.shape) == 3 and frame.shape[2] == 4:
                frame = frame[:, :, :3]
            
            self.frame_count += 1
            if self.frame_count == 1:
                print(f"✅ 首帧！尺寸: {frame.shape}")
            
            # 2. 转QImage
            height, width, _ = frame.shape
            if not frame.flags['C_CONTIGUOUS']:
                frame = np.ascontiguousarray(frame)
            
            q_image = QImage(frame.tobytes(), width, height, 3 * width, QImage.Format_RGB888)
            
            # 3. 转QPixmap
            pixmap = QPixmap.fromImage(q_image)
            
            # 4. 绘制UI
            painter = QPainter(pixmap)
            painter.setRenderHint(QPainter.Antialiasing)
            
            cx, cy = width / 2, height / 2
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
            self.scan_angle = (self.scan_angle + 2) % 360
            
            # 脉冲效果
            self.pulse_alpha += self.pulse_direction * 0.02
            if self.pulse_alpha <= 0.3:
                self.pulse_direction = 1
            elif self.pulse_alpha >= 1.0:
                self.pulse_direction = -1
            
            # 文字
            painter.setPen(QColor(255, 255, 255))
            font = QFont("Sans Serif", 20, QFont.Bold)
            painter.setFont(font)
            painter.drawText(20, 50, "A.InSight")
            
            font.setPointSize(14)
            painter.setFont(font)
            painter.drawText(20, int(height - 20), "點擊鎖定目標")
            
            painter.end()
            
            # 5. 显示
            self.camera_label.setPixmap(pixmap)
            
            if self.frame_count % 30 == 0:
                print(f"🎬 {self.frame_count} 帧")
            
        except Exception as e:
            print(f"❌ 错误: {e}")
            import traceback
            traceback.print_exc()
    
    def resizeEvent(self, event):
        """调整窗口大小"""
        super().resizeEvent(event)
        # 让label填满整个widget
        self.camera_label.setGeometry(0, 0, self.width(), self.height())
