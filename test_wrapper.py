#!/usr/bin/env python3
"""
测试摄像头包装器布局
"""

import sys
from PyQt5.QtWidgets import QApplication, QMainWindow
from camera.capture import CameraManager
from ui.camera_wrapper import CameraWithUI

app = QApplication(sys.argv)

# 初始化摄像头
camera = CameraManager()
if camera.init_camera(resolution=(640, 480)):
    preview = camera.create_preview_widget(width=800, height=600)
    if preview:
        camera.start()
        
        # 创建包装器
        wrapper = CameraWithUI(preview)
        
        # 创建窗口
        window = QMainWindow()
        window.setCentralWidget(wrapper)
        window.setGeometry(0, 0, 800, 600)
        window.show()
        
        print(f"✅ 窗口大小: {window.width()}x{window.height()}")
        print(f"✅ 包装器大小: {wrapper.width()}x{wrapper.height()}")
        print(f"✅ 摄像头大小: {preview.width()}x{preview.height()}")
        print(f"✅ 摄像头位置: ({preview.x()}, {preview.y()})")
        
        app.exec_()
    else:
        print("⚠️ 预览窗口创建失败")
else:
    print("⚠️ 摄像头初始化失败")
