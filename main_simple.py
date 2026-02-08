"""
A.InSight - 原生重写版 (单上下文混合渲染)
核心方案：继承 QGlPicamera2，在同一 OpenGL 上下文中绘制 UI
"""

import sys
import time
from PyQt5.QtWidgets import QApplication, QMainWindow, QWidget
from PyQt5.QtCore import Qt, QTimer
from PyQt5.QtGui import QPainter, QPen, QColor, QFont, QBrush, QPainterPath
from picamera2 import Picamera2
from picamera2.previews.qt import QGlPicamera2

class IntegratedCameraUI(QGlPicamera2):
    """
    集成式 UI 组件
    直接在 GL 预览控件上绘制，避免窗口层级冲突
    """
    def __init__(self, picamera, **kwargs):
        super().__init__(picamera, **kwargs)
        
        # 动画状态
        self.scan_angle = 0
        self.pulse_alpha = 1.0
        self.pulse_dir = -0.05
        
        # 定时器：驱动 UI 刷新 (30 FPS)
        self.anim_timer = QTimer(self)
        self.anim_timer.timeout.connect(self.update_animation)
        self.anim_timer.start(33)
        
        print("✅ IntegratedCameraUI 初始化完成")

    def update_animation(self):
        """更新动画状态并请求重绘"""
        # 旋转扫描线
        self.scan_angle = (self.scan_angle + 2) % 360
        
        # 呼吸灯效果
        self.pulse_alpha += self.pulse_dir
        if self.pulse_alpha <= 0.3:
            self.pulse_alpha = 0.3
            self.pulse_dir = 0.05
        elif self.pulse_alpha >= 1.0:
            self.pulse_alpha = 1.0
            self.pulse_dir = -0.05
            
        # 触发 paintEvent
        # update() 会安排一次重绘，Qt 会调用 paintEvent
        self.update()

    def paintEvent(self, event):
        """
        关键渲染逻辑：
        1. 父类 paintEvent 负责渲染摄像头画面 (OpenGL)
        2. QPainter 负责在之上绘制 UI (Qt)
        """
        # 1. 绘制摄像头底层 (这是 Picamera2 的 OpenGL 渲染)
        super().paintEvent(event)
        
        # 2. 绘制 UI 顶层 (這是 QPainter 的软件/混合绘制)
        try:
            painter = QPainter(self)
            painter.setRenderHint(QPainter.Antialiasing)
            
            # 绘制内容
            self.draw_mask(painter)
            self.draw_ui(painter)
            
            painter.end()
        except Exception as e:
            print(f"❌ 绘图错误: {e}")

    def draw_mask(self, painter):
        """绘制黑色遮罩（圆形视野）"""
        w, h = self.width(), self.height()
        cx, cy = w / 2, h / 2
        # 半径设为短边的 1/3
        radius = min(w, h) / 3
        
        # 路径运算：全屏 - 圆形
        path_bg = QPainterPath()
        path_bg.addRect(0, 0, w, h)
        
        path_circle = QPainterPath()
        path_circle.addEllipse(cx - radius, cy - radius, radius * 2, radius * 2)
        
        path_mask = path_bg.subtracted(path_circle)
        
        # 填充黑色
        painter.fillPath(path_mask, QBrush(Qt.black))
        
        # 保存半径供 UI 使用
        self.ui_radius = radius
        self.center_x = cx
        self.center_y = cy

    def draw_ui(self, painter):
        """绘制动态 UI"""
        if not hasattr(self, 'ui_radius'):
            return
            
        cx, cy = self.center_x, self.center_y
        r = self.ui_radius
        
        # 1. 绿色圆环 (带呼吸效果)
        alpha = int(255 * self.pulse_alpha)
        pen = QPen(QColor(0, 255, 0, alpha))
        pen.setWidth(3)
        painter.setPen(pen)
        painter.setBrush(Qt.NoBrush)
        painter.drawEllipse(int(cx - r), int(cy - r), int(r * 2), int(r * 2))
        
        # 2. 扫描线
        import math
        rad = math.radians(self.scan_angle)
        ex = cx + math.cos(rad) * r
        ey = cy + math.sin(rad) * r
        
        pen_scan = QPen(QColor(0, 255, 0, 200))
        pen_scan.setWidth(2)
        painter.setPen(pen_scan)
        painter.drawLine(int(cx), int(cy), int(ex), int(ey))
        
        # 3. 文字信息 (HUD)
        painter.setPen(QPen(QColor(255, 255, 255)))
        font = QFont("Monospace", 14, QFont.Bold)
        painter.setFont(font)
        painter.drawText(20, 40, "A.INSIGHT SYSTEM")
        painter.drawText(20, 70, "TARGET: SEARCHING...")


class AInSightNativeApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("A.InSight Native (Integrated Rendering)")
        self.setStyleSheet("background-color: black;")
        
        # 初始化 Picamera2
        print("📷 初始化 Picamera2...")
        self.picam2 = Picamera2()
        
        # 配置相机：使用 640x480 以确保性能
        config = self.picam2.create_preview_configuration(
            main={"size": (640, 480), "format": "XRGB8888"}
        )
        self.picam2.configure(config)
        
        # 创建集成式 View
        # keep_ar=False 让画面填满屏幕
        self.view = IntegratedCameraUI(self.picam2, width=640, height=480, keep_ar=False)
        self.setCentralWidget(self.view)
        
        # 启动相机
        self.picam2.start()
        print("✅ 相机已启动")

    def closeEvent(self, event):
        print("🛑 正在关闭...")
        self.picam2.stop()
        self.picam2.close()
        event.accept()

    def keyPressEvent(self, event):
        if event.key() == Qt.Key_Escape:
            self.close()


def main():
    app = QApplication(sys.argv)
    
    # Kiosk 模式通常隐藏光标
    # app.setOverrideCursor(Qt.BlankCursor)
    
    window = AInSightNativeApp()
    window.showFullScreen()
    
    sys.exit(app.exec_())

if __name__ == "__main__":
    main()
