"""
A.InSight - 极简版本
只显示摄像头，没有任何UI叠加
"""

from PyQt5.QtWidgets import QApplication
from picamera2 import Picamera2
from picamera2.previews.qt import QGlPicamera2
import sys


def main():
    print("🌟 A.InSight - 极简摄像头预览")
    
    # 1. 初始化摄像头
    print("📷 初始化摄像头...")
    camera = Picamera2()
    config = camera.create_preview_configuration(main={"size": (1280, 720)})
    camera.configure(config)
    
    # 2. 创建Qt应用
    app = QApplication(sys.argv)
    
    # 3. 创建预览窗口
    print("📺 创建预览窗口...")
    preview = QGlPicamera2(camera, width=1280, height=720, keep_ar=False)
    preview.setWindowTitle("A.InSight Camera")
    preview.show()
    
    # 4. 启动摄像头
    print("✅ 启动摄像头...")
    camera.start()
    
    print("✅ 成功！按 ESC 或关闭窗口退出")
    
    # 5. 运行
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
