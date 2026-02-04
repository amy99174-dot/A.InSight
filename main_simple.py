"""
A.InSight - 纯软件渲染版本
完全避开OpenGL，使用 Picamera2 捕获 + QLabel 显示
最稳定的方案
"""

from PyQt5.QtWidgets import QApplication, QWidget, QLabel
from PyQt5.QtCore import Qt, QTimer
from PyQt5.QtGui import QImage, QPixmap
from picamera2 import Picamera2
import numpy as np
import sys


class SoftwareRenderCamera(QWidget):
    """纯软件渲染的摄像头窗口"""
    
    def __init__(self):
        super().__init__()
        
        # 窗口设置
        self.setWindowTitle("A.InSight Camera (Software Render)")
        self.setGeometry(0, 0, 1280, 720)
        self.setStyleSheet("background-color: black;")
        
        # 显示标签
        self.label = QLabel(self)
        self.label.setGeometry(0, 0, 1280, 720)
        self.label.setAlignment(Qt.AlignCenter)
        self.label.setScaledContents(True)
        
        # 初始化摄像头
        print("📷 初始化摄像头...")
        self.camera = Picamera2()
        config = self.camera.create_video_configuration(main={"size": (1280, 720), "format": "RGB888"})
        self.camera.configure(config)
        self.camera.start()
        print("✅ 摄像头已启动")
        
        # 帧计数
        self.frame_count = 0
        
        # 定时器：捕获帧
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.update_frame)
        self.timer.start(33)  # ~30 FPS
        
        print("✅ 窗口创建成功")
    
    def update_frame(self):
        """更新帧"""
        try:
            # 1. 捕获帧
            frame = self.camera.capture_array("main")
            
            if frame is None:
                return
            
            # 2. 处理帧格式
            # 如果是RGBA，转换为RGB
            if len(frame.shape) == 3 and frame.shape[2] == 4:
                frame = frame[:, :, :3]
            
            self.frame_count += 1
            if self.frame_count == 1:
                print(f"✅ 首帧捕获成功！尺寸: {frame.shape}")
            
            # 3. 转换为QImage
            height, width, channels = frame.shape
            
            # 确保连续内存
            if not frame.flags['C_CONTIGUOUS']:
                frame = np.ascontiguousarray(frame)
            
            bytes_per_line = channels * width
            q_image = QImage(frame.tobytes(), width, height, bytes_per_line, QImage.Format_RGB888)
            
            # 4. 转换为QPixmap并显示
            pixmap = QPixmap.fromImage(q_image)
            self.label.setPixmap(pixmap)
            
            # 5. 定期打印
            if self.frame_count % 30 == 0:
                print(f"🎬 已渲染 {self.frame_count} 帧")
            
        except Exception as e:
            if self.frame_count == 0:
                print(f"❌ 渲染错误: {e}")
                import traceback
                traceback.print_exc()
    
    def mousePressEvent(self, event):
        """处理鼠标点击"""
        print(f"🖱️ 点击: {event.pos()}")
    
    def keyPressEvent(self, event):
        """处理键盘事件"""
        if event.key() in (Qt.Key_Escape, Qt.Key_Q):
            print("👋 退出...")
            self.close()
    
    def closeEvent(self, event):
        """关闭窗口"""
        print("🛑 关闭摄像头...")
        try:
            self.timer.stop()
            self.camera.stop()
            self.camera.close()
        except:
            pass
        event.accept()
    
    def resizeEvent(self, event):
        """窗口大小改变"""
        super().resizeEvent(event)
        self.label.setGeometry(0, 0, self.width(), self.height())


def main():
    print("🌟 A.InSight - 纯软件渲染摄像头")
    print("   特点：无OpenGL，完全CPU渲染，最稳定")
    
    try:
        app = QApplication(sys.argv)
        window = SoftwareRenderCamera()
        window.show()
        
        print("✅ 启动成功！")
        print("   - 点击鼠标：查看坐标")
        print("   - ESC 或 Q：退出")
        
        sys.exit(app.exec_())
        
    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
