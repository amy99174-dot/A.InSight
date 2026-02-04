#!/usr/bin/env python3
"""
A.InSight Native - 主应用
"""

import sys
from PyQt5.QtWidgets import QApplication, QMainWindow, QStackedWidget
from PyQt5.QtCore import Qt, QTimer
from core.state import StateMachine, AppState
from camera.capture import CameraManager
from ui.circle import CircularScanUI


class AInSightApp(QMainWindow):
    """A.InSight 主应用"""
    
    def __init__(self):
        super().__init__()
        self.init_ui()
        self.init_camera()
        self.init_state_machine()
        self.setup_state_handlers()
        
    def init_ui(self):
        """初始化UI"""
        self.setWindowTitle("A.InSight")
        self.setGeometry(0, 0, 800, 600)
        self.setStyleSheet("background-color: black;")
        
        # 堆叠窗口（用于切换不同状态的界面）
        self.stack = QStackedWidget(self)
        self.setCentralWidget(self.stack)
        
        # 圆形扫描界面
        self.circle_ui = CircularScanUI()
        self.stack.addWidget(self.circle_ui)
    
    def init_camera(self):
        """初始化摄像头"""
        self.camera_manager = CameraManager()
        
        # 初始化摄像头
        if self.camera_manager.init_camera(resolution=(640, 480)):
            # 创建预览窗口
            self.camera_preview = self.camera_manager.create_preview_widget(
                width=800, height=600
            )
            
            if self.camera_preview:
                # 添加到堆叠窗口但不显示
                self.stack.addWidget(self.camera_preview)
                
                # 启动摄像头
                self.camera_manager.start()
                print("✅ 摄像头系统初始化完成")
            else:
                print("⚠️ 预览窗口创建失败")
        else:
            print("⚠️ 摄像头初始化失败")
            self.camera_manager = None
        
    def init_state_machine(self):
        """初始化状态机"""
        self.state_machine = StateMachine()
        self.state_machine.state_changed.connect(self.on_state_changed)
        
    def setup_state_handlers(self):
        """设置状态处理器"""
        self.state_handlers = {
            AppState.BOOT: self.handle_boot,
            AppState.PROXIMITY: self.handle_proximity,
            AppState.LOCKED: self.handle_locked,
            AppState.TUNING: self.handle_tuning,
            AppState.ANALYZING: self.handle_analyzing,
            AppState.FOCUSING: self.handle_focusing,
            AppState.LISTEN: self.handle_listen,
            AppState.REVEAL: self.handle_reveal,
        }
        
        # 立即处理初始状态
        self.handle_boot()
    
    def on_state_changed(self, old_state, new_state):
        """状态变化回调"""
        print(f"✅ 状态变化: {old_state.value} → {new_state.value}")
        
        # 调用对应的状态处理器
        if new_state in self.state_handlers:
            self.state_handlers[new_state]()
    
    # === 状态处理器 ===
    
    def handle_boot(self):
        """BOOT 状态"""
        # 显示圆形UI
        self.stack.setCurrentWidget(self.circle_ui)
        self.circle_ui.set_text("正在探測歷史訊號", "尋找中...")
        self.circle_ui.start_animation()
        
        # 模拟启动检测，3秒后自动进入下一状态
        QTimer.singleShot(3000, self.state_machine.next)
    
    def handle_proximity(self):
        """PROXIMITY 状态"""
        # 切换到摄像头预览
        if self.camera_manager and self.camera_preview:
            self.stack.setCurrentWidget(self.camera_preview)
            print("✅ 已切换到摄像头预览")
        else:
            # 如果摄像头不可用，继续显示圆形UI
            self.circle_ui.set_text("發現目標", "請靠近...")
            print("⚠️ 摄像头不可用，使用圆形UI")
        # 等待用户点击
    
    def handle_locked(self):
        """LOCKED 状态"""
        self.circle_ui.set_text("目標鎖定", "點擊開始分析")
        # 等待用户点击
    
    def handle_tuning(self):
        """TUNING 状态"""
        self.circle_ui.set_text("調整參數", "使用方向鍵")
        # 等待用户调整
    
    def handle_analyzing(self):
        """ANALYZING 状态"""
        self.circle_ui.set_text("正在拍攝", "請保持靜止...")
        
        # 模拟拍照，2秒后自动进入下一状态
        QTimer.singleShot(2000, self.state_machine.next)
    
    def handle_focusing(self):
        """FOCUSING 状态"""
        self.circle_ui.set_text("對焦調整", "滾輪微調")
        # 等待用户调整
    
    def handle_listen(self):
        """LISTEN 状态"""
        self.circle_ui.set_text("AI 分析中", "請稍候...")
        
        # 模拟AI分析，5秒后自动进入下一状态
        QTimer.singleShot(5000, self.state_machine.next)
    
    def handle_reveal(self):
        """REVEAL 状态"""
        self.circle_ui.set_text("分析完成", "查看結果")
        self.circle_ui.stop_animation()
        # 等待用户查看，点击后重新开始
    
    # === 事件处理 ===
    
    def mousePressEvent(self, event):
        """鼠标点击事件"""
        current_state = self.state_machine.state
        
        # 某些状态需要点击才能进入下一状态
        if current_state in [AppState.PROXIMITY, AppState.LOCKED, 
                            AppState.TUNING, AppState.FOCUSING, AppState.REVEAL]:
            self.state_machine.next()
    
    def closeEvent(self, event):
        """关闭事件 - 清理资源"""
        print("🧹 清理资源...")
        if hasattr(self, 'camera_manager') and self.camera_manager:
            self.camera_manager.cleanup()
        event.accept()
    
    def keyPressEvent(self, event):
        """键盘事件"""
        if event.key() == Qt.Key_Escape:
            print("👋 退出应用")
            self.close()
        elif event.key() == Qt.Key_R:
            # R 键重置到初始状态
            print("🔄 重置状态")
            self.state_machine.reset()
        elif event.key() == Qt.Key_Space:
            # 空格键进入下一状态
            self.state_machine.next()


def main():
    print("=" * 50)
    print("🌟 A.InSight Native Application")
    print("=" * 50)
    print()
    print("操作说明：")
    print("- 鼠标点击: 进入下一状态")
    print("- 空格键: 进入下一状态")
    print("- R 键: 重置到初始状态")
    print("- ESC: 退出应用")
    print()
    print("-" * 50)
    print()
    
    app = QApplication(sys.argv)
    window = AInSightApp()
    window.showFullScreen()
    
    exit_code = app.exec_()
    
    print()
    print("=" * 50)
    print("👋 应用已退出")
    print("=" * 50)
    
    sys.exit(exit_code)


if __name__ == '__main__':
    main()
