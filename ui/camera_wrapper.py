"""
摄像头包装器 - 使用悬浮窗口绘制UI
"""

from PyQt5.QtWidgets import QWidget
from PyQt5.QtCore import Qt, QTimer
from ui.floating_overlay import FloatingUIOverlay


class CameraWithUI(QWidget):
    """摄像头包装器 - 使用悬浮窗口绘制UI"""
    
    def __init__(self, camera_preview, parent=None):
        super().__init__(parent)
        self.camera_preview = camera_preview
        self.scan_angle = 0
        self.pulse_alpha = 1.0
        
        # 摄像头作为子控件
        self.camera_preview.setParent(self)
        self.camera_preview.setGeometry(0, 0, 800, 600)
        self.camera_preview.show()
        
        # 创建悬浮UI窗口
        self.floating_ui = FloatingUIOverlay()
        
        # 动画定时器
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.update_animation)
        self.timer.start(16)  # ~60 FPS
        
        print("✅ CameraWithUI 初始化完成（悬浮窗口模式）")
    
    def update_animation(self):
        """更新动画"""
        self.scan_angle = (self.scan_angle + 2) % 360
        if self.floating_ui:
            self.floating_ui.scan_angle = self.scan_angle
            self.floating_ui.update()
    
    def showEvent(self, event):
        """窗口显示时定位悬浮UI"""
        super().showEvent(event)
        if self.floating_ui:
            # 悬浮窗口覆盖在主窗口上方
            geom = self.geometry()
            global_pos = self.mapToGlobal(geom.topLeft())
            self.floating_ui.setGeometry(global_pos.x(), global_pos.y(), 
                                        self.width(), self.height())
            self.floating_ui.show()
            self.floating_ui.raise_()
            print(f"📐 FloatingUI positioned: {self.width()}x{self.height()}")
    
    def resizeEvent(self, event):
        """调整大小时重新定位"""
        super().resizeEvent(event)
        self.camera_preview.setGeometry(0, 0, self.width(), self.height())
        
        if self.floating_ui and self.floating_ui.isVisible():
            geom = self.geometry()
            global_pos = self.mapToGlobal(geom.topLeft())
            self.floating_ui.setGeometry(global_pos.x(), global_pos.y(),
                                        self.width(), self.height())
            print(f"📐 Resized: {self.width()}x{self.height()}")
    
    def closeEvent(self, event):
        """关闭时清理悬浮窗口"""
        if self.floating_ui:
            self.floating_ui.close()
        super().closeEvent(event)
