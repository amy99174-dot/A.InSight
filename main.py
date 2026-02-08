#!/usr/bin/env python3
"""
A.InSight - 软件渲染 + 圆形遮罩
380px 圆形视窗 + 中心文字
"""

from PyQt5.QtWidgets import QApplication, QWidget, QLabel
from PyQt5.QtCore import Qt, QTimer
from PyQt5.QtGui import QImage, QPixmap, QPainter, QColor, QFont, QPainterPath, QBrush
from picamera2 import Picamera2
import numpy as np
import sys


class SoftwareRenderCamera(QWidget):
    """纯软件渲染的相机显示"""
    
    def __init__(self):
        super().__init__()
        self.setStyleSheet("background-color: black;")
        
        # 显示标签
        self.label = QLabel(self)
        self.label.setAlignment(Qt.AlignCenter)
        
        # 圆形直径
        self.circle_diameter = 380
        
        # 状态常量
        self.STATE_P1 = 1
        self.STATE_P2 = 2
        self.STATE_P3_CAPTURE = 3  # 拍照页面
        self.STATE_P4 = 4
        self.STATE_P5 = 5
        self.STATE_SUCCESS = 99    # 拍照成功显示
        self.STATE_FAIL = -1       # 拍照失败显示
        
        self.current_state = self.STATE_P1
        self.captured_pixmap = None  # 存储拍摄的照片
        
        # 初始化摄像头
        print("📷 初始化摄像头（软件渲染）...")
        self.camera = Picamera2()
        config = self.camera.create_video_configuration(
            main={"size": (640, 480), "format": "RGB888"}
        )
        self.camera.configure(config)
        self.camera.start()
        print("✅ 摄像头已启动")
        
        # 定时器：捕获并渲染帧
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.update_frame)
        self.timer.start(33)  # ~30 FPS
    
    def mousePressEvent(self, event):
        """鼠标点击处理状态切换"""
        
        # 拍照成功或失败页面 -> 回到 P1
        if self.current_state == self.STATE_SUCCESS or self.current_state == self.STATE_FAIL:
            self.current_state = self.STATE_P1
            self.captured_pixmap = None
            print("🔄 重置到 P1")
            return

        # P3 页面 -> 执行拍照
        if self.current_state == self.STATE_P3_CAPTURE:
            print("📸 正在拍照...")
            self.capture_photo()
            return
            
        # 其他页面 (P1, P2, P4, P5) -> 切换到下一个
        self.current_state += 1
        if self.current_state > 5:
            self.current_state = 1
        print(f"🖱️ 状态切换: P{self.current_state}")

    def capture_photo(self):
        """执行拍照逻辑"""
        try:
            # 捕获高分辨率帧 (这里复用预览帧简单演示)
            frame = self.camera.capture_array("main")
            
            if frame is not None:
                # 转换并保存为 QPixmap
                height, width, channels = frame.shape
                if not frame.flags['C_CONTIGUOUS']:
                    frame = np.ascontiguousarray(frame)
                bytes_per_line = channels * width
                q_image = QImage(frame.tobytes(), width, height, bytes_per_line, QImage.Format_BGR888)
                self.captured_pixmap = QPixmap.fromImage(q_image)
                
                # 切换到成功页面
                self.current_state = self.STATE_SUCCESS
                print("✅ 拍照成功")
            else:
                raise Exception("Frame is None")
                
        except Exception as e:
            print(f"❌ 拍照失败: {e}")
            self.current_state = self.STATE_FAIL

    def update_frame(self):
        """渲染逻辑"""
        try:
            # 如果是成功页面，显示拍摄的照片
            if self.current_state == self.STATE_SUCCESS:
                if self.captured_pixmap:
                    # 在照片上绘制"拍照成功"
                    display_pixmap = self.captured_pixmap.copy()
                    painter = QPainter(display_pixmap)
                    painter.setPen(QColor(0, 255, 0)) # 绿色
                    painter.setFont(QFont("Sans", 40, QFont.Bold))
                    painter.drawText(200, 240, "拍照成功")
                    painter.end()
                    self.label.setPixmap(display_pixmap)
                return

            # 如果是失败页面，显示黑屏
            if self.current_state == self.STATE_FAIL:
                black_pixmap = QPixmap(640, 480)
                black_pixmap.fill(Qt.black)
                painter = QPainter(black_pixmap)
                painter.setPen(QColor(255, 0, 0)) # 红色
                painter.setFont(QFont("Sans", 40, QFont.Bold))
                painter.drawText(200, 240, "拍照失败")
                painter.end()
                self.label.setPixmap(black_pixmap)
                return

            # 正常预览模式 (P1-P5)
            # 1. 捕获帧
            frame = self.camera.capture_array("main")
            if frame is None:
                return
            
            # 2. 转换为 QImage
            height, width, channels = frame.shape
            if not frame.flags['C_CONTIGUOUS']:
                frame = np.ascontiguousarray(frame)
            
            bytes_per_line = channels * width
            q_image = QImage(frame.tobytes(), width, height, bytes_per_line, QImage.Format_BGR888)
            
            # 3. 转换为 QPixmap
            pixmap = QPixmap.fromImage(q_image)
            
            # 4. 绘制圆形遮罩
            painter = QPainter(pixmap)
            painter.setRenderHint(QPainter.Antialiasing)
            
            cx = width / 2
            cy = height / 2
            radius = self.circle_diameter / 2
            
            path_full = QPainterPath()
            path_full.addRect(0, 0, width, height)
            path_circle = QPainterPath()
            path_circle.addEllipse(cx - radius, cy - radius, 
                                  self.circle_diameter, self.circle_diameter)
            mask = path_full.subtracted(path_circle)
            painter.fillPath(mask, QBrush(Qt.black))
            
            # 5. 绘制状态文字
            painter.setPen(QColor(255, 255, 255))
            painter.setFont(QFont("Sans", 30, QFont.Bold))
            
            if self.current_state == self.STATE_P3_CAPTURE:
                text = "拍照测试"
                # P3 稍微调整文字位置以居中 (4个字)
                painter.drawText(int(cx - 80), int(cy + 10), text) 
            else:
                text = f"P{self.current_state}"
                painter.drawText(int(cx - 30), int(cy + 10), text)
            
            painter.end()
            
            # 6. 显示
            self.label.setPixmap(pixmap)
            
        except Exception as e:
            print(f"❌ 渲染错误: {e}")
    
    def keyPressEvent(self, event):
        if event.key() == Qt.Key_Escape:
            self.close()
    
    def closeEvent(self, event):
        print("🛑 关闭摄像头...")
        self.timer.stop()
        self.camera.stop()
        self.camera.close()
        event.accept()
    
    def resizeEvent(self, event):
        super().resizeEvent(event)
        self.label.setGeometry(0, 0, self.width(), self.height())


if __name__ == "__main__":
    print("🌟 A.InSight - 软件渲染 + 圆形遮罩")
    print("   380px 圆形视窗")
    print("   中心文字：测试")
    print("   按 ESC 退出")
    
    app = QApplication(sys.argv)
    window = SoftwareRenderCamera()
    window.showFullScreen()
    sys.exit(app.exec_())
