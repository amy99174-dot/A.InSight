"""
A.InSight - 极简版本（带事件处理）
只显示摄像头，没有任何UI叠加
"""

from PyQt5.QtWidgets import QApplication, QWidget
from PyQt5.QtCore import Qt
from picamera2 import Picamera2
from picamera2.previews.qt import QGlPicamera2
import sys


class SimpleCameraWindow(QWidget):
    """简单的摄像头窗口"""
    
    def __init__(self, camera):
        super().__init__()
        self.camera = camera
        
        # 窗口设置
        self.setWindowTitle("A.InSight Camera")
        self.setGeometry(0, 0, 1280, 720)
        
        # 创建预览
        self.preview = QGlPicamera2(camera, width=1280, height=720, keep_ar=False)
        self.preview.setParent(self)
        self.preview.move(0, 0)
        self.preview.resize(1280, 720)
        self.preview.show()
        
        print("✅ 窗口创建成功")
    
    def mousePressEvent(self, event):
        """处理鼠标点击"""
        print(f"🖱️ 鼠标点击: {event.pos()}")
        # 不做任何处理，只记录
    
    def keyPressEvent(self, event):
        """处理键盘事件"""
        if event.key() == Qt.Key_Escape:
            print("👋 ESC键按下，退出...")
            self.close()
        elif event.key() == Qt.Key_Q:
            print("👋 Q键按下，退出...")
            self.close()
    
    def closeEvent(self, event):
        """关闭窗口"""
        print("🛑 关闭摄像头...")
        try:
            self.camera.stop()
            self.camera.close()
        except:
            pass
        event.accept()
    
    def resizeEvent(self, event):
        """窗口大小改变"""
        super().resizeEvent(event)
        if hasattr(self, 'preview'):
            self.preview.resize(self.width(), self.height())


def main():
    print("🌟 A.InSight - 极简摄像头预览")
    
    try:
        # 1. 初始化摄像头
        print("📷 初始化摄像头 (软件渲染模式 - 640x480)...")
        camera = Picamera2()
        # 使用 640x480 分辨率以提高稳定性
        config = camera.create_video_configuration(main={"size": (640, 480), "format": "RGB888"})
        camera.configure(config)
        
        # 2. 创建Qt应用
        app = QApplication(sys.argv)
        
        # 3. 创建窗口
        print("📺 创建窗口...")
        window = SimpleCameraWindow(camera)
        window.show()
        
        # 4. 启动摄像头
        print("✅ 启动摄像头...")
        camera.start()
        
        print("✅ 成功！")
        print("   - 点击鼠标：查看坐标")
        print("   - ESC 或 Q：退出")
        
        # 5. 运行
        sys.exit(app.exec_())
        
    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
