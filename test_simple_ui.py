"""
最简单的摄像头+UI测试 - 不要状态机，直接显示
"""

from PyQt5.QtWidgets import QApplication, QWidget, QLabel
from PyQt5.QtCore import Qt, QTimer
from PyQt5.QtGui import QImage, QPixmap, QPainter, QPen, QColor, QFont
from picamera2 import Picamera2
import numpy as np
import math
import sys


class SimpleCameraUI(QWidget):
    """最简单的摄像头UI"""
    
    def __init__(self):
        super().__init__()
        self.setWindowTitle("简单摄像头测试")
        self.setGeometry(0, 0, 800, 600)
        self.setStyleSheet("background-color: black;")
        
        # 摄像头初始化
        print("📷 初始化摄像头...")
        self.camera = Picamera2()
        config = self.camera.create_preview_configuration(
            main={"size": (640, 480), "format": "XRGB8888"}
        )
        self.camera.configure(config)
        self.camera.start()
        print("✅ 摄像头已启动")
        
        # 显示标签
        self.label = QLabel(self)
        self.label.setGeometry(0, 0, 800, 600)
        self.label.setAlignment(Qt.AlignCenter)
        self.label.setStyleSheet("background-color: red;")  # 红色背景便于调试
        
        # 动画参数
        self.scan_angle = 0
        self.frame_count = 0
        
        # 定时器
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.update_frame)
        self.timer.start(33)  # 30 FPS
        
        print("✅ UI初始化完成")
    
    def update_frame(self):
        """更新帧"""
        try:
            # 1. 获取帧
            frame = self.camera.capture_array("main")
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
            
            # 圆圈
            pen = QPen(QColor(255, 0, 0, 255))  # 红色
            pen.setWidth(5)
            painter.setPen(pen)
            painter.setBrush(Qt.NoBrush)
            cx, cy = width // 2, height // 2
            radius = min(width, height) // 3
            painter.drawEllipse(cx - radius, cy - radius, radius * 2, radius * 2)
            
            # 扫描线
            pen.setColor(QColor(255, 255, 255))
            pen.setWidth(3)
            painter.setPen(pen)
            rad = math.radians(self.scan_angle)
            sx = cx + math.cos(rad) * radius
            sy = cy + math.sin(rad) * radius
            painter.drawLine(cx, cy, int(sx), int(sy))
            self.scan_angle = (self.scan_angle + 2) % 360
            
            # 文字
            painter.setPen(QColor(255, 255, 255))
            font = QFont("Sans Serif", 20, QFont.Bold)
            painter.setFont(font)
            painter.drawText(20, 50, f"帧 {self.frame_count}")
            
            painter.end()
            
            # 5. 显示
            self.label.setPixmap(pixmap)
            
            if self.frame_count % 30 == 0:
                print(f"🎬 {self.frame_count} 帧")
            
        except Exception as e:
            print(f"❌ 错误: {e}")
            import traceback
            traceback.print_exc()
    
    def closeEvent(self, event):
        self.camera.stop()
        self.camera.close()
        event.accept()


if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = SimpleCameraUI()
    window.show()
    sys.exit(app.exec_())
