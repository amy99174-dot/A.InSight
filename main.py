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
print(f"🔑 API Key Loaded: {API_KEY[:5]}...{API_KEY[-3:] if len(API_KEY)>10 else ''}")

# 列出可用模型 (Debug)
def list_models():
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={API_KEY}"
        resp = requests.get(url)
        if resp.status_code == 200:
            models = resp.json().get('models', [])
            print("\n📋 Available Models for this Key:")
            for m in models:
                if 'generateContent' in m.get('supportedGenerationMethods', []) or 'predict' in m.get('supportedGenerationMethods', []):
                    print(f" - {m['name']}")
            print("--------------------------------\n")
        else:
            print(f"❌ Failed to list models: {resp.status_code}")
    except Exception as e:
        print(f"❌ List models error: {e}")

# 啟動時列出一次
threading.Thread(target=list_models).start()

class GeminiWorker(QThread):
    """后台调用 API 的线程：文字分析 + 图像生成"""
    finished = pyqtSignal(dict)
    
    def __init__(self, image_data):
        super().__init__()
        self.image_data = image_data
        
    def run(self):
        try:
            # Step 1: 图像内容分析 (Gemini 1.5 Flash - 稳定版)
            # 注意：雖然使用者說是 2.5，但 API 可能不穩定，我們先用 1.5 確保文字分析成功
            # 這裡我們先嘗試 2.5，如果失敗會直接報錯，使用者堅持要用 2.5
            analyze_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={API_KEY}"
            headers = {"Content-Type": "application/json"}
            
            prompt = """
            Identify the main object in this image and return a JSON with:
            {
                "name": "Object Name (Traditional Chinese)",
                "era": "Period/Dynasty (Traditional Chinese)",
                "description": "Short description (Traditional Chinese)",
                "visionPrompt": "A detailed English prompt to regenerate this object in a historical style, photorealistic, 8k resolution."
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
            
            final_result = {}
            
            # 1. 呼叫分析 API
            print("🤖 [1/2] 正在分析圖片內容...")
            response = requests.post(analyze_url, headers=headers, json=data)
            
            if response.status_code != 200:
                print(f"❌ Analysis API Error: {response.text}")
                self.finished.emit({"name": "API Error", "era": str(response.status_code)})
                return

            result = response.json()
            text = result.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '{}')
            if "```json" in text:
                text = text.replace("```json", "").replace("```", "")
            
            final_result = json.loads(text)
            print(f"✅ 分析成功: {final_result.get('name')}")
            

            # Step 2: 圖像生成 (Gemini 2.5 Flash Image - Img2Img)
            vision_prompt = final_result.get("visionPrompt", "Historical artifact style illustration")
            print(f"🎨 [2/2] 正在生成圖片: {vision_prompt[:30]}...")

            try:
                # 使用 Gemini 2.5 Flash Image via generateContent
                # 這是 Web App 使用的正確模型 (圖生圖)
                image_gen_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key={API_KEY}"
                
                # 構造 Payload: 提示詞 + 原圖
                img_payload = {
                    "contents": [{
                        "parts": [
                            {"text": f"Generate a new image based on this prompt: {vision_prompt}"},
                            {
                                "inlineData": {
                                    "mimeType": "image/jpeg",
                                    "data": self.image_data  # 原圖 Base64
                                }
                            }
                        ]
                    }],
                    "generationConfig": {
                        "candidateCount": 1
                        # "aspectRatio": "1:1" # API 可能不支援此參數，視模型而定
                    }
                }
                
                print(f"📡 呼叫 Gemini Img2Img API ({image_gen_url})...")
                img_response = requests.post(image_gen_url, headers=headers, json=img_payload)
                
                if img_response.status_code == 200:
                    img_result = img_response.json()
                    # 解析 Gemini 回傳
                    # 格式: candidates[0].content.parts[].inlineData
                    candidates = img_result.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        generated_b64 = None
                        
                        # 尋找 inlineData
                        for part in parts:
                            if "inlineData" in part:
                                generated_b64 = part["inlineData"]["data"]
                                break
                        
                        # 如果沒有 inlineData，有些模型會回傳網址 (但 Gemini 通常回傳 inlineData)
                        
                        if generated_b64:
                            final_result["generated_image"] = generated_b64
                            print("✅ 圖片生成成功 (Gemini Img2Img)")
                        else:
                            print(f"⚠️ 生成回應中無圖片數據: {img_result}")
                            # 觸發 Fallback
                            raise Exception("No image data in response")
                    else:
                        print(f"⚠️ 無候選結果: {img_result}")
                        raise Exception("No candidates")
                else:
                    print(f"⚠️ API 失敗 (Code {img_response.status_code}): {img_response.text}")
                    raise Exception(f"API Error {img_response.status_code}")
            
            except Exception as img_err:
                print(f"❌ 圖片生成失敗，切換至本地濾鏡: {img_err}")
                print("🔄 啟動本地濾鏡 Fallback (Sepia)...")
                final_result["generated_image"] = self.apply_sepia_filter(self.image_data)

            self.finished.emit(final_result)

        except Exception as e:
            print(f"❌ Worker Error: {e}")
            self.finished.emit({"name": "System Error", "era": str(e)})

    def apply_sepia_filter(self, b64_data):
        """簡單的軟體濾鏡效果 (模擬生成變化)"""
        try:
            img_data = base64.b64decode(b64_data)
            qimg = QImage.fromData(img_data)
            width = qimg.width()
            height = qimg.height()
            
            # 遍歷像素修改顏色 (效率較低但無需 numpy/cv2)
            # 為了效率，我們用 QImage 的方法或簡單處理
            # 這裡簡單轉換為灰階 + 著色
            
            # 轉換為灰階
            gray_img = qimg.convertToFormat(QImage.Format_Grayscale8)
            # 轉換回 RGB 以便著色
            colored_img = gray_img.convertToFormat(QImage.Format_RGB888)
            
            # 使用 QPainter 疊加黃色層
            painter = QPainter(colored_img)
            painter.setCompositionMode(QPainter.CompositionMode_Overlay)
            painter.fillRect(0, 0, width, height, QColor(112, 66, 20, 100)) # 深褐色半透明
            painter.end()
            
            # 保存回 base64
            buffer = QBuffer()
            buffer.open(QBuffer.ReadWrite)
            colored_img.save(buffer, "JPG")
            return base64.b64encode(buffer.data()).decode()
            
        except Exception as e:
            print(f"Filter error: {e}")
            return b64_data



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
        self.generated_pixmap = None # 存儲 Agent 回傳的圖片
        
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
            self.generated_pixmap = None
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
        
        # 處理回傳圖片
        if "generated_image" in result:
            try:
                img_data = base64.b64decode(result["generated_image"])
                qimg = QImage.fromData(img_data)
                self.generated_pixmap = QPixmap.fromImage(qimg)
                print("🖼️ 已加載生成圖片")
            except Exception as e:
                print(f"❌ 圖片加載失敗: {e}")
                
        self.current_state = self.STATE_RESULT

    def update_frame(self):
        try:
            # 決定底圖：優先顯示生成的圖片，其次是原始照片，最後是相機預覽
            display_pixmap = None
            
            if self.current_state == self.STATE_RESULT and self.generated_pixmap:
                 display_pixmap = self.generated_pixmap.copy()
            elif self.captured_pixmap and self.current_state in [self.STATE_SUCCESS, self.STATE_ANALYZING, self.STATE_RESULT]:
                display_pixmap = self.captured_pixmap.copy()
            
            # 如果沒有圖片，抓取相機
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
                    # 調整文字位置到上方，不遮擋圖片
                    painter.drawText(int(cx - 80), int(cy - 100), name)
                    painter.setFont(QFont("Sans", 16))
                    painter.drawText(int(cx - 80), int(cy - 60), era)
                    
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
