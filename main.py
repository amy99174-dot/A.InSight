"""
A.InSight Native Application
主程序入口
"""

from PyQt5.QtWidgets import QApplication, QMainWindow, QStackedWidget
from PyQt5.QtCore import Qt, QTimer
from core.state import StateMachine, AppState
from camera.capture import CameraManager
from ui.circle import CircularScanUI
from ui.qtpreview_overlay import QtPreviewOverlay


class AInSightApp(QMainWindow):
    """A.InSight 主应用"""
    
    def __init__(self):
        super().__init__()
        self.setWindowTitle("A.InSight")
        self.setGeometry(100, 100, 800, 600)
        
        # 初始化状态机
        self.state_machine = StateMachine()
        self.state_machine.state_changed.connect(self.on_state_changed)
        
        # 堆叠布局（多页面切换）
        self.stack = QStackedWidget()
        self.setCentralWidget(self.stack)
        
        # 圆形UI（BOOT等状态）
        self.circle_ui = CircularScanUI()
        # CircularScanUI 没有 clicked 信号，使用 mousePressEvent 代替
        self.stack.addWidget(self.circle_ui)
        
        # 初始化摄像头
        self.camera_manager = None
        self.camera_renderer = None
        self.init_camera()
        
        print("\n" + "="*50)
        print("🌟 A.InSight Native Application")
        print("="*50)
        print("\n操作说明：")
        print("- 鼠标点击: 进入下一状态")
        print("- 空格键: 进入下一状态")
        print("- R 键: 重置到初始状态")
        print("- ESC: 退出应用")
        print("\n" + "-"*50 + "\n")
    
    def init_camera(self):
        """初始化摄像头"""
        self.camera_manager = CameraManager()
        
        # 初始化摄像头
        if self.camera_manager.init_camera(resolution=(640, 480)):
            # 启动摄像头
            self.camera_manager.start()
            
            # 创建 QtPreview 叠加渲染器
            self.camera_renderer = QtPreviewOverlay(self.camera_manager)
            self.stack.addWidget(self.camera_renderer)
            
            print("✅ 摄像头系统初始化完成（QtPreview模式）")
        else:
            print("⚠️ 摄像头初始化失败")
            self.camera_manager = None
            self.camera_renderer = None
    
    def update_overlay_animation(self):
        """更新摄像头叠加层动画"""
        if hasattr(self, 'camera_renderer') and self.camera_renderer:
            # OpenCV渲染器内部已有动画定时器，这里不需要手动更新
            pass
    
    def handle_click(self):
        """处理点击事件"""
        current_state = self.state_machine.current_state
        
        if current_state == AppState.BOOT:
            self.state_machine.set_state(AppState.PROXIMITY)
        
        elif current_state == AppState.PROXIMITY:
            self.state_machine.set_state(AppState.FOCUSING)
        
        elif current_state == AppState.FOCUSING:
            self.state_machine.set_state(AppState.LOCKED)
        
        elif current_state == AppState.LOCKED:
            self.state_machine.set_state(AppState.SCANNING)
        
        elif current_state == AppState.SCANNING:
            # 扫描完成后自动进入REVEAL
            pass
        
        elif current_state == AppState.REVEAL:
            # 点击后重置
            self.state_machine.set_state(AppState.BOOT)
    
    def on_state_changed(self, old_state, new_state):
        """状态变化处理"""
        print(f"状态转换: {old_state.name.lower()} → {new_state.name.lower()}")
        
        # 根据状态更新UI
        if new_state == AppState.BOOT:
            self.handle_boot()
        elif new_state == AppState.PROXIMITY:
            self.handle_proximity()
        elif new_state == AppState.FOCUSING:
            self.handle_focusing()
        elif new_state == AppState.LOCKED:
            self.handle_locked()
        elif new_state == AppState.SCANNING:
            self.handle_scanning()
        elif new_state == AppState.REVEAL:
            self.handle_reveal()
    
    def handle_boot(self):
        """BOOT 状态"""
        self.circle_ui.set_text("A.InSight", "點擊開始")
        self.stack.setCurrentWidget(self.circle_ui)
    
    def handle_proximity(self):
        """PROXIMITY 状态：显示摄像头"""
        if self.camera_manager and hasattr(self, 'camera_renderer') and self.camera_renderer:
            self.stack.setCurrentWidget(self.camera_renderer)
            print("✅ 已切换到摄像头叠加预览")
        else:
            self.circle_ui.set_text("接近", "請靠近目標")
            self.stack.setCurrentWidget(self.circle_ui)
            print("⚠️ 摄像头不可用，使用圆形UI")
    
    def handle_focusing(self):
        """FOCUSING 状态"""
        # 保持摄像头界面
        if self.camera_manager and hasattr(self, 'camera_renderer') and self.camera_renderer:
            print("📷 保持摄像头预览 - FOCUSING")
        else:
            self.circle_ui.set_text("對焦中", "調整距離")
    
    def handle_locked(self):
        """LOCKED 状态"""
        # 保持在摄像头预览，不切换回圆形UI
        if self.camera_manager and hasattr(self, 'camera_renderer') and self.camera_renderer:
            # 已经在摄像头界面，不需要切换
            print("📷 保持摄像头预览 - LOCKED")
        else:
            self.circle_ui.set_text("目標鎖定", "點擊開始分析")
        # 等待用户点击
    
    def handle_scanning(self):
        """SCANNING 状态：分析历史讯息"""
        self.circle_ui.set_text("正在探測歷史訊息", "請稍候...")
        self.stack.setCurrentWidget(self.circle_ui)
        
        # 模拟扫描过程（3秒后自动转到 REVEAL）
        QTimer.singleShot(3000, lambda: self.state_machine.set_state(AppState.REVEAL))
    
    def handle_reveal(self):
        """REVEAL 状态：显示结果"""
        self.circle_ui.set_text("分析完成", "查看結果")
        self.circle_ui.set_style_green()
        self.stack.setCurrentWidget(self.circle_ui)
    
    def keyPressEvent(self, event):
        """键盘事件"""
        if event.key() == Qt.Key_Escape:
            self.close()
        elif event.key() == Qt.Key_Space:
            self.handle_click()
        elif event.key() == Qt.Key_R:
            self.state_machine.set_state(AppState.BOOT)
    
    def mousePressEvent(self, event):
        """鼠标点击"""
        self.handle_click()
    
    def closeEvent(self, event):
        """关闭应用"""
        if self.camera_manager:
            self.camera_manager.cleanup()
        event.accept()


def main():
    """主函数"""
    app = QApplication([])
    window = AInSightApp()
    window.show()
    app.exec_()


if __name__ == "__main__":
    main()
