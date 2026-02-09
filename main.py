#!/usr/bin/env python3
"""
A.InSight - 软件渲染 + 圆形遮罩
380px 圆形视窗 + 中心文字
"""

from PyQt5.QtWidgets import QApplication, QWidget, QLabel
from PyQt5.QtCore import Qt, QTimer, QThread, pyqtSignal, QBuffer, QRectF, QRect
from PyQt5.QtGui import QImage, QPixmap, QPainter, QColor, QFont, QPainterPath, QBrush, QPen, QRadialGradient
from picamera2 import Picamera2
import requests
import json
import base64
import threading
import sys
import traceback
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
        
        # 移除舊式 Style 與 Label，改用 paintEvent 完全接管
        self.setAttribute(Qt.WA_OpaquePaintEvent, True)

        # --------------------------------------------------------
        # [DEBUG] 確保全螢幕 (強制覆蓋)
        # --------------------------------------------------------
        pass
        
        # 圆形直径
        self.circle_diameter = 380
        self.circle_radius = 190  # 380px / 2
        
        # 掃描線動畫變數 (Phase 1)
        self.scan_line_y = 0
        self.scan_direction = 1
        
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
        """
        [Phase 1] 架構重構：
        不再於此處建立 QPixmap，僅發出重繪請求。
        繪圖邏輯全部移至 paintEvent 以利用硬體加速與流暢動畫。
        """
        self.update()

    def paintEvent(self, event):
        """
        [Phase 1] 繪圖核心
        """
        try:
            # [DEBUG LOG] 每 30 幀印一次，避免洗版
            if not hasattr(self, '_debug_frame_count'):
                self._debug_frame_count = 0
            self._debug_frame_count += 1
            
            should_log = (self._debug_frame_count % 30 == 0)

            if should_log:
                print(f"[DEBUG] paintEvent: Size={self.width()}x{self.height()}, Radius={self.circle_radius}, State={self.current_state}")

            painter = QPainter(self)
            painter.setRenderHint(QPainter.Antialiasing)

            # 1. 繪製背景 (藍色測試 - 用於確認 paintEvent 是否生效)
            painter.fillRect(self.rect(), Qt.blue)

            w = self.width()
            h = self.height()
            center_x = w // 2
            center_y = h // 2
            
            # 定義圓形遮罩路徑 (視窗)
            path_window = QPainterPath()
            path_window.addEllipse(center_x - self.circle_radius, center_y - self.circle_radius, 
                                   self.circle_radius * 2, self.circle_radius * 2)

            # -------------------------------------------------------------------------
            # A. 繪製內容層 (Content Layer) - 限制在圓形視窗內
            # -------------------------------------------------------------------------
            # ... (中略) ...

            # -------------------------------------------------------------------------
            # [Phase 1 驗證標記] - 放大置中顯示
            # -------------------------------------------------------------------------
            painter.setPen(QColor("#FFFFFF"))
            painter.setFont(QFont("Arial", 40, QFont.Bold))
            painter.drawText(QRect(0, 0, w, h), Qt.AlignCenter, "[DEBUG: BLUE SCREEN TEST]")

            # -------------------------------------------------------------------------
            # A. 繪製內容層 (Content Layer) - 限制在圓形視窗內
            # -------------------------------------------------------------------------
            painter.save()
            painter.setClipPath(path_window)

            # [狀態分流]
            # (1) 結果展示 (STATE_RESULT)
            if self.current_state == self.STATE_RESULT and self.generated_pixmap:
                if should_log:
                    print(f"[DEBUG] Generated Pixmap: {self.generated_pixmap.width()}x{self.generated_pixmap.height()}")
                # 目前先簡單置中繪製 (Phase 2 會改為放大與平移)
                # 保持原始比例縮放至蓋滿視窗
                scaled = self.generated_pixmap.scaled(
                    self.circle_radius * 2, self.circle_radius * 2,
                    Qt.KeepAspectRatioByExpanding, Qt.SmoothTransformation
                )
                sx = center_x - (scaled.width() / 2)
                sy = center_y - (scaled.height() / 2)
                painter.drawPixmap(int(sx), int(sy), scaled)

            # (2) 靜態預覽 (STATE_ANALYZING, SUCCESS, FAIL)
            elif self.captured_pixmap and self.current_state in [self.STATE_ANALYZING, self.STATE_SUCCESS, self.STATE_FAIL]:
                scaled = self.captured_pixmap.scaled(
                    self.circle_radius * 2, self.circle_radius * 2,
                    Qt.KeepAspectRatioByExpanding, Qt.SmoothTransformation
                )
                sx = center_x - (scaled.width() / 2)
                sy = center_y - (scaled.height() / 2)
                painter.drawPixmap(int(sx), int(sy), scaled)

                # 分析中疊加黃色濾鏡
                if self.current_state == self.STATE_ANALYZING:
                    painter.fillRect(self.rect(), QColor(255, 255, 0, 50))

            # (3) 實時相機 (Live Camera)
            else:
                try:
                    if hasattr(self, 'camera') and self.camera: # 確保相機存在
                        # 注意：self.camera.capture_array 仍可能阻塞，
                        # 但在 Phase 1我們先維持原樣，只驗證繪圖架構。
                        # 如果覺得卡頓，後續可移至 Thread。
                        image = self.camera.capture_array("main")
                        if image is not None:
                            if should_log:
                                print(f"[DEBUG] Camera Image Shape: {image.shape}")
                            # Picamera2 回傳的是 BGR (RGB888 setting) 或其他，需注意
                            # 這裡假設配置為 RGB888
                            # 如果是 RGB888 (h, w, 3)
                            h_img, w_img, ch = image.shape
                            bytes_per_line = ch * w_img
                            qimg = QImage(image.data, w_img, h_img, bytes_per_line, QImage.Format_RGB888)
                            
                            scaled_qimg = qimg.scaled(
                                int(self.circle_radius * 2), int(self.circle_radius * 2),
                                Qt.KeepAspectRatioByExpanding, Qt.SmoothTransformation
                            )
                            sx = center_x - (scaled_qimg.width() / 2)
                            sy = center_y - (scaled_qimg.height() / 2)
                            painter.drawImage(int(sx), int(sy), scaled_qimg)

                except Exception as e:
                    # 錯誤時保持黑色，但印出 Log 以便除錯
                    print(f"❌ 相機渲染錯誤: {e}") 
                    pass

            painter.restore() # 解除 Clip

            # -------------------------------------------------------------------------
            # B. 繪製 UI 層 (Overlay Layer) - 覆蓋在上面
            # -------------------------------------------------------------------------
            
            # 1. 圓形邊框
            border_color = QColor("white")
            if self.current_state == self.STATE_ANALYZING:
                border_color = QColor("yellow")
            elif self.current_state == self.STATE_RESULT:
                border_color = QColor("#39ff14") # Neon Green
                
            painter.setPen(QPen(border_color, 4))
            painter.setBrush(Qt.NoBrush)
            painter.drawEllipse(center_x - self.circle_radius, center_y - self.circle_radius, 
                                self.circle_radius * 2, self.circle_radius * 2)

            # 2. 掃描線動畫 (非結果頁)
            if self.current_state not in [self.STATE_RESULT]:
                self.scan_line_y += 5 * self.scan_direction
                # 邊界檢查
                if self.scan_line_y > self.circle_radius * 2:
                    self.scan_direction = -1
                elif self.scan_line_y < 0:
                    self.scan_direction = 1
                
                scan_y_abs = (center_y - self.circle_radius) + self.scan_line_y
                
                # 使用 Clip 確保線只在圓內
                painter.save()
                painter.setClipPath(path_window)
                painter.setPen(QPen(QColor(0, 255, 0, 150), 2))
                painter.drawLine(int(center_x - self.circle_radius), int(scan_y_abs), 
                                 int(center_x + self.circle_radius), int(scan_y_abs))
                painter.restore()

            # 3. 文字資訊
            if self.current_state == self.STATE_RESULT and self.analysis_result:
                name = self.analysis_result.get("name", "")
                era = self.analysis_result.get("era", "")
                painter.setPen(QColor("#39ff14"))
                painter.setFont(QFont("Arial", 16, QFont.Bold))
                painter.drawText(QRect(0, h - 80, w, 50), Qt.AlignCenter, f"{name} | {era}")
                
            elif self.current_state == self.STATE_ANALYZING:
                painter.setPen(QColor("yellow"))
                painter.setFont(QFont("Arial", 16, QFont.Bold))
                painter.drawText(QRect(0, h - 80, w, 50), Qt.AlignCenter, "AI 分析中...")
                
            elif self.current_state == self.STATE_SUCCESS:
                painter.setPen(QColor("green"))
                painter.setFont(QFont("Arial", 16, QFont.Bold))
                painter.drawText(QRect(0, h - 80, w, 50), Qt.AlignCenter, "點擊畫面查看")

            # -------------------------------------------------------------------------
            # [Phase 1 驗證標記]
            # -------------------------------------------------------------------------
            painter.setPen(QColor("#00FF00"))
            painter.setFont(QFont("Courier New", 12, QFont.Bold))
            painter.drawText(10, 20, "[Phase 1: GPU 渲染模式啟動]")
            painter.drawText(10, 40, f"FPS: 約 {1000/33:.1f}")
            
        except Exception as e:
            print("❌ paintEvent 發生嚴重錯誤:")
            traceback.print_exc()

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
