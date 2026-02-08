#!/usr/bin/env python3
"""
A.InSight - 软件渲染 + 圆形遮罩
380px 圆形视窗 + 中心文字
"""

from PyQt5.QtWidgets import QApplication, QWidget, QLabel
from PyQt5.QtCore import Qt, QTimer
from PyQt5.QtGui import QImage, QPixmap, QPainter, QColor, QFont, QPainterPath, QBrush
from picamera2 import Picamera2
import requests
import json
import base64
import threading
import sys
from PyQt5.QtCore import QThread, pyqtSignal, QBuffer

# 简单的 API Key 读取
def get_api_key():
    try:
        with open(".env.local", "r") as f:
            for line in f:
                if line.startswith("GEMINI_API_KEY="):
                    return line.strip().split("=")[1]
    except:
        pass
    return "YOUR_API_KEY_HERE"

API_KEY = get_api_key()

class GeminiWorker(QThread):
    """后台调用 API 的线程，避免卡死 UI"""
    finished = pyqtSignal(dict)
    
    def __init__(self, image_data):
        super().__init__()
        self.image_data = image_data
        
    def run(self):
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={API_KEY}"
            headers = {"Content-Type": "application/json"}
            
            # 使用简化的 Prompt 提取主要信息
            prompt = """
            Identify the main object in this image and return a JSON with:
            {
                "name": "Object Name (Traditional Chinese)",
                "era": "Period/Dynasty (Traditional Chinese)",
                "description": "Short description (Traditional Chinese)"
            }
            Output JSON ONLY.
            """
            
            data = {
                "contents": [{
                    "parts": [
                        {"text": prompt},
                        {"inline_data": {
                            "mime_type": "image/jpeg",
                            "data": self.image_data
                        }}
                    ]
                }]
            }
            
            response = requests.post(url, headers=headers, json=data)
            if response.status_code == 200:
                result = response.json()
                try:
                    text = result.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '{}')
                    # 清理 markdown code block
                    if "```json" in text:
                        text = text.replace("```json", "").replace("```", "")
                    self.finished.emit(json.loads(text))
                except:
                    self.finished.emit({"name": "Analysis Error", "era": "Parse Fail"})
            else:
                self.finished.emit({"name": "API Error", "era": str(response.status_code)})
                
        except Exception as e:
            self.finished.emit({"name": "Network Error", "era": str(e)})


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
        self.STATE_P3_CAPTURE = 3
        self.STATE_P4 = 4
        self.STATE_P5 = 5
        self.STATE_SUCCESS = 99     # 拍照成功 (点击 -> API)
        self.STATE_FAIL = -1        # 拍照失败
        self.STATE_ANALYZING = 100  # AI 分析中
        self.STATE_RESULT = 101     # 显示结果
        
        self.current_state = self.STATE_P1
        self.captured_pixmap = None
        self.analysis_result = None
        
        # 初始化摄像头
        print("📷 初始化摄像头（软件渲染）...")
        self.camera = Picamera2()
        config = self.camera.create_video_configuration(
            main={"size": (640, 480), "format": "RGB888"}
        )
        self.camera.configure(config)
        self.camera.start()
        print("✅ 摄像头已启动")
        
        # 定时器
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.update_frame)
        self.timer.start(33)
    
    def mousePressEvent(self, event):
        """处理点击事件"""
        
        # 拍照成功 -> 触发 API 分析
        if self.current_state == self.STATE_SUCCESS:
            self.start_analysis()
            return

        # 结果页面/失败页面 -> 回到 P1
        if self.current_state in [self.STATE_RESULT, self.STATE_FAIL]:
            self.current_state = self.STATE_P1
            self.captured_pixmap = None
            self.analysis_result = None
            print("🔄 重置到 P1")
            return

        # P3 -> 拍照
        if self.current_state == self.STATE_P3_CAPTURE:
            self.capture_photo()
            return

        # 分析中 -> 禁止操作
        if self.current_state == self.STATE_ANALYZING:
            return
            
        # P1-P5 循环
        self.current_state += 1
        if self.current_state > 5:
            self.current_state = 1
        print(f"🖱️ 状态切换: P{self.current_state}")

    def capture_photo(self):
        try:
            frame = self.camera.capture_array("main")
            if frame is not None:
                height, width, channels = frame.shape
                if not frame.flags['C_CONTIGUOUS']:
                    frame = np.ascontiguousarray(frame)
                bytes_per_line = channels * width
                q_image = QImage(frame.tobytes(), width, height, bytes_per_line, QImage.Format_BGR888)
                self.captured_pixmap = QPixmap.fromImage(q_image)
                self.current_state = self.STATE_SUCCESS
                print("✅ 拍照成功")
            else:
                self.current_state = self.STATE_FAIL
        except Exception as e:
            print(f"❌ 拍照失败: {e}")
            self.current_state = self.STATE_FAIL

    def start_analysis(self):
        """启动 AI 分析"""
        self.current_state = self.STATE_ANALYZING
        print("🤖 开始 AI 分析...")
        
        # 将 QPixmap 转为 Base64
        image = self.captured_pixmap.toImage()
        buffer = QBuffer()
        buffer.open(QBuffer.ReadWrite)
        image.save(buffer, "JPG")
        b64_data = base64.b64encode(buffer.data()).decode()
        
        # 启动后台线程
        self.worker = GeminiWorker(b64_data)
        self.worker.finished.connect(self.on_analysis_finished)
        self.worker.start()
        
    def on_analysis_finished(self, result):
        """API 返回处理"""
        print("🤖 分析完成:", result)
        self.analysis_result = result
        self.current_state = self.STATE_RESULT

    def update_frame(self):
        try:
            # 绘制通用背景（如果有捕获图）
            display_pixmap = None
            if self.captured_pixmap and self.current_state in [self.STATE_SUCCESS, self.STATE_ANALYZING, self.STATE_RESULT]:
                display_pixmap = self.captured_pixmap.copy()
            
            # 如果没有捕获图（预览模式），就抓取新帧
            if display_pixmap is None and self.current_state <= 5:
                frame = self.camera.capture_array("main")
                if frame is not None:
                    height, width, channels = frame.shape
                    if not frame.flags['C_CONTIGUOUS']:
                        frame = np.ascontiguousarray(frame)
                    q_image = QImage(frame.tobytes(), width, height, channels * width, QImage.Format_BGR888)
                    display_pixmap = QPixmap.fromImage(q_image)
            
            if display_pixmap is None:
                return # 还没准备好

            # 开始绘制
            painter = QPainter(display_pixmap)
            painter.setRenderHint(QPainter.Antialiasing)
            
            # 遮罩
            width = display_pixmap.width()
            height = display_pixmap.height()
            cx = width / 2
            cy = height / 2
            radius = self.circle_diameter / 2
            
            path_full = QPainterPath()
            path_full.addRect(0, 0, width, height)
            path_circle = QPainterPath()
            path_circle.addEllipse(cx - radius, cy - radius, self.circle_diameter, self.circle_diameter)
            mask = path_full.subtracted(path_circle)
            painter.fillPath(mask, QBrush(Qt.black))
            
            # 文字设置
            painter.setPen(QColor(255, 255, 255))
            painter.setFont(QFont("Sans", 30, QFont.Bold))
            
            # 根据状态绘制内容
            if self.current_state == self.STATE_SUCCESS:
                painter.setPen(QColor(0, 255, 0))
                painter.drawText(int(cx - 80), int(cy + 10), "拍照成功")
                painter.setFont(QFont("Sans", 15))
                painter.drawText(int(cx - 60), int(cy + 50), "点击开始分析")
                
            elif self.current_state == self.STATE_ANALYZING:
                painter.setPen(QColor(255, 255, 0)) # 黄色
                painter.drawText(int(cx - 80), int(cy + 10), "AI 分析中...")
                
            elif self.current_state == self.STATE_RESULT:
                if self.analysis_result:
                    name = self.analysis_result.get("name", "未知")
                    era = self.analysis_result.get("era", "未知")
                    painter.setPen(QColor(0, 255, 255)) # 青色
                    painter.setFont(QFont("Sans", 20, QFont.Bold))
                    painter.drawText(int(cx - 80), int(cy - 20), name)
                    painter.setFont(QFont("Sans", 16))
                    painter.drawText(int(cx - 80), int(cy + 20), era)
                    
            elif self.current_state == self.STATE_P3_CAPTURE:
                painter.drawText(int(cx - 80), int(cy + 10), "拍照测试")
            elif self.current_state <= 5:
                painter.drawText(int(cx - 30), int(cy + 10), f"P{self.current_state}")
            
            painter.end()
            self.label.setPixmap(display_pixmap)
            
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
