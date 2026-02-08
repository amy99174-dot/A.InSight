"""
A.InSight - 稳定版 (软件渲染 + 遮罩)
使用 Picamera2 捕获帧 -> QPainter 绘制遮罩 -> QLabel 显示
解决 OpenGL 兼容性和交互崩溃问题
"""

from PyQt5.QtWidgets import QApplication, QWidget, QLabel
from PyQt5.QtCore import Qt, QTimer, QRect
from PyQt5.QtGui import QImage, QPixmap, QPainter, QBrush, QColor, QPainterPath
from picamera2 import Picamera2
import numpy as np
import sys


class SoftwareCameraMasked(QWidget):
    """纯软件渲染的摄像头窗口 (带遮罩)"""
    
    def __init__(self):
        super().__init__()
        
        # 窗口设置
        self.setWindowTitle("A.InSight Camera (Software Render)")
        # 初始大小
        self.setGeometry(0, 0, 1280, 720)
        self.setStyleSheet("background-color: black;")
        
        # 显示标签
        self.label = QLabel(self)
        self.label.setAlignment(Qt.AlignCenter)
        # 让 Label 填满窗口
        self.label.setGeometry(0, 0, 1280, 720)
        
        # 初始化摄像头
        print("📷 初始化摄像头 (软件渲染模式)...")
        self.camera = Picamera2()
        # 使用 1280x720 分辨率
        config = self.camera.create_video_configuration(main={"size": (1280, 720), "format": "RGB888"})
        self.camera.configure(config)
        self.camera.start()
        print("✅ 摄像头已启动")
        
        # 帧计数
        self.frame_count = 0
        
        # 定时器：捕获帧 (30 FPS)
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.update_frame)
        self.timer.start(33)
        
        print("✅ 窗口创建成功")
    
    def update_frame(self):
        """更新帧并绘制遮罩"""
        try:
            # 1. 捕获帧
            frame = self.camera.capture_array("main")
            
            if frame is None:
                return
            
            # 2. 转换为 QImage
            height, width, channels = frame.shape
            
            # 确保连续内存
            if not frame.flags['C_CONTIGUOUS']:
                frame = np.ascontiguousarray(frame)
            
            bytes_per_line = channels * width
            q_image = QImage(frame.tobytes(), width, height, bytes_per_line, QImage.Format_RGB888)
            
            # 3. 转换为 QPixmap
            pixmap = QPixmap.fromImage(q_image)
            
            # 4. 绘制遮罩 (软件绘制，绝对可靠)
            painter = QPainter(pixmap)
            painter.setRenderHint(QPainter.Antialiasing)
            
            # 计算圆形遮罩
            cx = width / 2
            cy = height / 2
            # 设定半径：高度的1/3 (直径为高度的2/3)
            # 或者如果是全屏体验，可能希望圆更大一点？先保持原来的比例
            radius = min(width, height) / 3   
            
            # 创建路径：全屏矩形
            path_bg = QPainterPath()
            path_bg.addRect(0, 0, width, height)
            
            # 创建路径：中间圆形
            path_circle = QPainterPath()
            path_circle.addEllipse(cx - radius, cy - radius, radius * 2, radius * 2)
            
            # 路径相减 = 黑色遮罩区域 (中间挖空)
            path_mask = path_bg.subtracted(path_circle)
            
            # 绘制黑色遮罩
            painter.fillPath(path_mask, QBrush(Qt.black))
            
            # 绘制白色边框
            pen = painter.pen()
            pen.setColor(Qt.white)
            pen.setWidth(2)
            painter.setPen(pen)
            painter.setBrush(Qt.NoBrush)
            painter.drawEllipse(cx - radius, cy - radius, radius * 2, radius * 2)
            
            # 调试信息 (左上角)
            # painter.drawText(20, 40, f"Frame: {self.frame_count}")
            
            painter.end()
            
            # 5. 显示
            self.label.setPixmap(pixmap)
            self.frame_count += 1
            
        except Exception as e:
            if self.frame_count == 0:
                print(f"❌ 渲染错误: {e}")
                import traceback
                traceback.print_exc()
    
    def mousePressEvent(self, event):
        """处理鼠标点击 - 避免崩溃"""
        print(f"🖱️ 点击: {event.pos()}")
        # 可以在这里添加交互逻辑，比如切换全屏/窗口
    
    def keyPressEvent(self, event):
        """处理键盘事件"""
        if event.key() in (Qt.Key_Escape, Qt.Key_Q):
            print("👋 退出...")
            self.close()
    
    def closeEvent(self, event):
        """关闭资源"""
        print("🛑 资源清理...")
        try:
            self.timer.stop()
            self.camera.stop()
            self.camera.close()
        except:
            pass
        event.accept()
    
    def resizeEvent(self, event):
        """确保 Label 始终填满窗口"""
        super().resizeEvent(event)
        self.label.setGeometry(0, 0, self.width(), self.height())


def main():
    print("🌟 A.InSight - 软件渲染稳定版 (Fullscreen + Mask)")
    
    try:
        app = QApplication(sys.argv)
        
        # 隐藏鼠标光标 (Kiosk模式常用)
        # app.setOverrideCursor(Qt.BlankCursor)
        
        window = SoftwareCameraMasked()
        
        # 全屏显示
        window.showFullScreen()
        
        print("✅ 启动成功！按 ESC 退出")
        
        sys.exit(app.exec_())
        
    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
