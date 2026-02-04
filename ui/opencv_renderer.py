"""
OpenCV摄像头渲染器 - 使用软件渲染，稳定可靠
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
        
        # 黑色背景
        self.setStyleSheet("background-color: black;")
        
        # 摄像头画面显示标签
        self.camera_label = QLabel(self)
        self.camera_label.setAlignment(Qt.AlignCenter)
        self.camera_label.setStyleSheet("background-color: black;")
        
        # 调试计数器
        self._frame_count = 0
        self._warned_no_frame = False
        self._error_logged = False
        
        # 定时器：获取摄像头帧
        self.frame_timer = QTimer(self)
        self.frame_timer.timeout.connect(self.update_frame)
        self.frame_timer.start(33)  # ~30 FPS
        
        print("✅ OpenCVCameraRenderer 初始化完成（稳定模式）")
    
    def update_frame(self):
        """获取摄像头帧并更新"""
        if not self.camera_manager:
            if self._frame_count == 0:
                print("⚠️ camera_manager 不存在")
            return
        
        try:
            # 从摄像头管理器获取最新帧
            frame = self.camera_manager.get_current_frame()
            
            if frame is None:
                if not self._warned_no_frame:
                    print("⚠️ 获取摄像头帧失败 (frame is None)")
                    self._warned_no_frame = True
                return
            
            # 首次成功获取帧
            if self._frame_count == 0:
                print(f"✅ 首次获取摄像头帧！尺寸: {frame.shape}, 类型: {frame.dtype}")
            
            self._frame_count += 1
            if self._frame_count % 30 == 0:  # 每30帧打印一次
                print(f"🎬 已渲染 {self._frame_count} 帧")
            
            # 转换为QImage
            height, width, channel = frame.shape
            bytes_per_line = 3 * width
            
            # 确保数组是连续的
            if not frame.flags['C_CONTIGUOUS']:
                frame = np.ascontiguousarray(frame)
            
            # 创建QImage（使用tobytes()）
            q_image = QImage(frame.tobytes(), width, height, bytes_per_line, QImage.Format_RGB888)
            
            # 在图片上绘制UI
            pixmap = QPixmap.fromImage(q_image)
            painter = QPainter(pixmap)
            self.draw_ui(painter, width, height)
            painter.end()
            
            # 更新显示
            self.camera_label.setPixmap(pixmap)
            
            # 调试：检查pixmap是否设置成功
            if self._frame_count == 1:
                print(f"✅ Pixmap设置成功！尺寸: {pixmap.width()}x{pixmap.height()}")
                print(f"   Label尺寸: {self.camera_label.width()}x{self.camera_label.height()}")
                print(f"   Widget尺寸: {self.width()}x{self.height()}")
            
        except Exception as e:
            if not self._error_logged:
                print(f"❌ 渲染错误: {e}")
                import traceback
                traceback.print_exc()
                self._error_logged = True
    
    def draw_ui(self, painter, width, height):
        """在摄像头画面上绘制UI"""
        painter.setRenderHint(QPainter.Antialiasing)
        
        center_x = width / 2
        center_y = height / 2
        radius = min(width, height) / 3
        
        # 圆圈边框
        pen = QPen(QColor(150, 100, 200, int(255 * self.pulse_alpha)))
        pen.setWidth(4)
        painter.setPen(pen)
        painter.setBrush(Qt.NoBrush)
        painter.drawEllipse(int(center_x - radius), int(center_y - radius), 
                          int(radius * 2), int(radius * 2))
        
        # 刻度线
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
        
        # 扫描线
        pen.setColor(QColor(255, 255, 255, 200))
        pen.setWidth(3)
        painter.setPen(pen)
        
        rad = math.radians(self.scan_angle)
        scan_x = center_x + math.cos(rad) * radius
        scan_y = center_y + math.sin(rad) * radius
        painter.drawLine(int(center_x), int(center_y), int(scan_x), int(scan_y))
        
        # 更新扫描角度
        self.scan_angle = (self.scan_angle + 2) % 360
        
        # 文字
        painter.setPen(QColor(255, 255, 255))
        font = QFont("Sans Serif", 16, QFont.Bold)
        painter.setFont(font)
        painter.drawText(20, 50, "A.InSight")
        
        font.setPointSize(14)
        painter.setFont(font)
        painter.drawText(20, int(height - 20), "點擊鎖定目標")
    
    def resizeEvent(self, event):
        """调整大小"""
        super().resizeEvent(event)
        self.camera_label.setGeometry(self.rect())
