"""
A.InSight - 完全重写版
使用 Gemini 提供的 QtGLWidget + start_preview 方案
"""

import sys
from PyQt5.QtWidgets import QApplication, QMainWindow
from PyQt5.QtCore import Qt, QTimer
from PyQt5.QtGui import QPainter, QPen, QColor, QFont, QBrush, QPainterPath
from picamera2 import Picamera2
from picamera2.previews.qt import QGlPicamera2


class IntegratedUIWidget(QGlPicamera2):
    """
    這是一個集成的 OpenGL Widget。
    它同時負責顯示相機畫面，並在同一畫布上繪製 UI。
    """
    def __init__(self, picam2, width, height, keep_ar=True):
        super().__init__(picam2, width=width, height=height, keep_ar=keep_ar)
        
        # 動畫狀態
        self.scan_angle = 0
        
        # 建立定時器強制刷新 UI (例如掃描線動畫)
        self.update_timer = QTimer(self)
        self.update_timer.timeout.connect(self.on_timer)
        self.update_timer.start(33)  # 保持約 30 FPS 的 UI 更新
        
        print("✅ IntegratedUIWidget 初始化完成")

    def on_timer(self):
        """定時器回調：更新動畫狀態"""
        self.scan_angle = (self.scan_angle + 3) % 360
        self.update()

    def paintEvent(self, event):
        """
        關鍵渲染邏輯：
        步驟 1: 呼叫父類別的 paintEvent
        這會驅動 Picamera2 內部的 OpenGL 邏輯，將相機幀繪製到 Widget 背景
        
        步驟 2: 立即開啟 QPainter 在同一個 Widget 上繪圖
        由於這是在同一個 OpenGL Context 下，UI 會被繪製在相機畫面「之上」
        """
        # 1. 繪製相機畫面
        super().paintEvent(event)

        # 2. 繪製 UI 覆蓋層
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        self.draw_mask(painter)
        self.draw_overlay(painter)
        
        painter.end()

    def draw_mask(self, painter):
        """繪製黑色遮罩（圓形視野）"""
        w, h = self.width(), self.height()
        cx, cy = w / 2, h / 2
        radius = min(w, h) / 3
        
        # 路徑運算：全屏 - 圓形
        path_bg = QPainterPath()
        path_bg.addRect(0, 0, w, h)
        
        path_circle = QPainterPath()
        path_circle.addEllipse(cx - radius, cy - radius, radius * 2, radius * 2)
        
        path_mask = path_bg.subtracted(path_circle)
        
        # 填充黑色
        painter.fillPath(path_mask, QBrush(Qt.black))
        
        # 保存參數
        self.ui_cx = cx
        self.ui_cy = cy
        self.ui_radius = radius

    def draw_overlay(self, painter):
        """繪製動態 UI 元素"""
        if not hasattr(self, 'ui_radius'):
            return
            
        w, h = self.width(), self.height()
        cx, cy = self.ui_cx, self.ui_cy
        radius = self.ui_radius

        # --- 繪製半透明 UI 元素 ---
        # 綠色掃描圈
        pen = QPen(QColor(50, 255, 50, 180))
        pen.setWidth(3)
        painter.setPen(pen)
        painter.setBrush(Qt.NoBrush)
        painter.drawEllipse(int(cx - radius), int(cy - radius), int(radius * 2), int(radius * 2))

        # 掃描線
        import math
        rad = math.radians(self.scan_angle)
        ex = cx + math.cos(rad) * radius
        ey = cy + math.sin(rad) * radius
        painter.drawLine(int(cx), int(cy), int(ex), int(ey))

        # 轉角裝飾 (HUD 風格)
        margin = 50
        length = 40
        # 左上角
        painter.drawLine(margin, margin, margin + length, margin)
        painter.drawLine(margin, margin, margin, margin + length)
        # 右上角
        painter.drawLine(w - margin, margin, w - margin - length, margin)
        painter.drawLine(w - margin, margin, w - margin, margin + length)
        # 左下角
        painter.drawLine(margin, h - margin, margin + length, h - margin)
        painter.drawLine(margin, h - margin, margin, h - margin - length)
        # 右下角
        painter.drawLine(w - margin, h - margin, w - margin - length, h - margin)
        painter.drawLine(w - margin, h - margin, w - margin, h - margin - length)

        # 狀態文字
        painter.setFont(QFont("Monospace", 12, QFont.Bold))
        painter.setPen(QColor(0, 255, 0))
        painter.drawText(margin, h - margin + 20, "A.INSIGHT | TARGET: SEARCHING...")


class CameraApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("A.InSight Native - Integrated Rendering")
        self.setStyleSheet("background-color: black;")
        
        # 初始化 Picamera2
        print("📷 初始化 Picamera2...")
        self.picamera2 = Picamera2()
        
        # 配置相機 (針對 Zero 2 W，建議不要跑太高解析度以維持流暢)
        config = self.picamera2.create_preview_configuration(
            main={"format": "XRGB8888", "size": (640, 480)}
        )
        self.picamera2.configure(config)
        
        # 設置為主視窗的中心元件
        self.camera_view = IntegratedUIWidget(self.picamera2, width=640, height=480, keep_ar=False)
        self.setCentralWidget(self.camera_view)
        
        # 啟動相機
        self.picamera2.start()
        print("✅ 相機已啟動")

    def keyPressEvent(self, event):
        if event.key() == Qt.Key_Escape:
            self.close()

    def closeEvent(self, event):
        print("🛑 正在關閉...")
        self.picamera2.stop()
        self.picamera2.close()
        event.accept()


if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = CameraApp()
    # 在樹莓派原生螢幕上，全螢幕模式效能最好
    window.showFullScreen()
    sys.exit(app.exec_())
