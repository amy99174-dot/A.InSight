"""
A.InSight - 极简版本（带事件处理 + 遮罩）
只显示摄像头，UI遮罩（圆形外全黑）
"""

from PyQt5.QtWidgets import QApplication, QWidget
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QPainter, QBrush, QColor, QPainterPath
from picamera2 import Picamera2
from picamera2.previews.qt import QGlPicamera2
import sys


class OverlayPreview(QGlPicamera2):
    """带遮罩的预览组件"""
    
    def paintEvent(self, event):
        """重写绘制事件，在摄像头画面上绘制遮罩"""
        # 1. 绘制摄像头画面 (调用父类方法)
        super().paintEvent(event)
        
        # 2. 绘制遮罩
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        width = self.width()
        height = self.height()
        cx = width / 2
        cy = height / 2
        
        # 计算圆形半径 (取短边的1/3作为半径，即直径为2/3)
        radius = min(width, height) / 3
        
        # 创建路径：全屏矩形 - 中间圆形
        path = QPainterPath()
        path.addRect(0, 0, width, height)  # 全屏
        
        circle_path = QPainterPath()
        circle_path.addEllipse(cx - radius, cy - radius, radius * 2, radius * 2)
        
        # 减去圆形 (相减)
        path = path.subtracted(circle_path)
        
        # 填充黑色
        painter.fillPath(path, QBrush(Qt.black))
        
        # 绘制圆形边框 (可选，为了更好看先画个白圈)
        painter.setPen(Qt.white)
        painter.setBrush(Qt.NoBrush)
        painter.drawEllipse(cx - radius, cy - radius, radius * 2, radius * 2)


class SimpleCameraWindow(QWidget):
    """简单的摄像头窗口"""
    
    def __init__(self, camera):
        super().__init__()
        self.camera = camera
        
        # 窗口设置
        self.setWindowTitle("A.InSight Camera")
        # 初始大小，后面会全屏
        self.setGeometry(0, 0, 1280, 720)
        self.setStyleSheet("background-color: black;")
        
        # 创建带遮罩的预览
        # keep_ar=False 让画面拉伸填满，或者True保持比例
        # 用户通常希望全屏填满，这里设为False试一下
        self.preview = OverlayPreview(camera, width=1280, height=720, keep_ar=False)
        self.preview.setParent(self)
        self.preview.show()
        
        print("✅ 窗口创建成功")
    
    def mousePressEvent(self, event):
        """处理鼠标点击"""
        print(f"🖱️ 鼠标点击: {event.pos()}")
        # 点击任意位置，可以打印信息，暂时不退出
    
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
    print("🌟 A.InSight - 极简摄像头预览 (全屏 + 遮罩)")
    
    try:
        # 1. 初始化摄像头
        print("📷 初始化摄像头...")
        camera = Picamera2()
        # 使用较高的分辨率
        config = camera.create_preview_configuration(main={"size": (1280, 720)})
        camera.configure(config)
        
        # 2. 创建Qt应用
        app = QApplication(sys.argv)
        
        # 3. 创建窗口
        print("📺 创建窗口...")
        window = SimpleCameraWindow(camera)
        # 全屏显示！
        window.showFullScreen()
        
        # 4. 启动摄像头
        print("✅ 启动摄像头...")
        camera.start()
        
        print("✅ 成功！")
        print("   - ESC 或 Q：退出")
        
        # 5. 运行
        sys.exit(app.exec_())
        
    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
