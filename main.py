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
    
    def __init__(self, image_data, time_scale=3, history_scale=2):
        super().__init__()
        self.image_data = image_data
        self.time_scale = time_scale
        self.history_scale = history_scale
        
    def run(self):
        try:
            # Step 1: 图像内容分析 (Gemini 1.5 Flash - 稳定版)
            # 注意：雖然使用者說是 2.5，但 API 可能不穩定，我們先用 1.5 確保文字分析成功
            # 這裡我們先嘗試 2.5，如果失敗會直接報錯，使用者堅持要用 2.5
            analyze_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={API_KEY}"
            headers = {"Content-Type": "application/json"}
            
            # [Phase 3] Full 5-Agent Prompt Logic (From lib/ai-server.ts)
            role_id = "展品辨識引擎 (Artifact Identifier)"
            tone = "客觀、學術且帶有敬意"
            style_keywords = "cinematic lighting, high detail, historical archive style"
            
            prompt = f"""
# Role
You are the "Chronos Engine," a specialized AI simulation environment.
You must simulate the following 5 specific AI Agents sequentially.

CUSTOM SETTINGS:
- Primary Role Identity: {role_id}
- Required Tone: {tone}
- Visual Style Guide: {style_keywords}

Current Settings -> timeScale: {self.time_scale} (1-5), historyScale: {self.history_scale} (1-3).

CRITICAL LANGUAGE RULES (MUST FOLLOW):
1. **Output Language**: STRICTLY Traditional Chinese (繁體中文 - Taiwan usage).
2. **NO English**: Do not include English translations, original names, or Romanization in the JSON output fields 'name' and 'era'.
3. **Field Specifics**:
   - 'name': Only the Chinese name. (e.g., "翠玉白菜" ✅, "Jadeite Cabbage" ❌)
   - 'era': Only the Chinese dynasty/period. (e.g., "清代" ✅, "Modern" ❌ -> use "現代")

---

## Agent 1: {role_id} (Object Analysis)

【角色設定】
你是一個「{role_id}」。
你的語氣必須是：「{tone}」。
任務是根據使用者照片中可見的物件，找出唯一主要物件並產出基本結構化描述。

【核心規則】
1. 嚴格遵守設定的語氣 ({tone})。
2. 若能辨識 → 輸出具體名稱。
3. 若完全無法辨識 → 回覆「無法解析」，並附上原因。
4. 誤判允許，不需避免錯誤。

需額外輸出 styleRef, manufacturingMethod, preFormState, 以及 category。

(Reference Constraints for Agent 1):
- styleRef: Must match the era (Ancient=Painting, Modern=Photo).
- manufacturingMethod: Must match material (Carving, Casting, etc).
- preFormState: Must describe raw material for TimeScale 1.

---

## Agent 2: Cultural Search Engine (文化敘事搜尋引擎)
【角色設定】
你是一個「文化敘事搜尋引擎」。
你的任務是根據 Agent 1 的物件資訊，自動搜尋人文與歷史背景，構建一條可用於導覽與美術敘事的故事主線。

【核心規則】
一、需以 Agent 1 輸出的物件名稱、材質、年代為基礎進行搜尋與推論。
二、故事必須有人文連結 (例如：人物、習俗、寓意、儀式、社會背景)。
三、允許推論性敘事，但需保持合理性與考據感。

---

## Agent 3: Vision Prompt Engineer (視覺提示工程師)
【角色設定】
你是一名「視覺提示工程師」。
你的任務是將「物件資訊（含 styleRef）＋ 故事背景（Agent 2）＋ TimeScale」轉換成可供圖像生成模型使用的英文畫面指令。

【核心規則】
一、藝術風格由 styleRef 與 Global Keywords 主導
Global Keywords: "{style_keywords}"
你必須將 styleRef 結合 Global Keywords 轉換為英文繪圖指令。

二、畫面敘事結構由 TimeScale ({self.time_scale}) 決定
1: 起源 (Abstract / Natural) -> "abstract origin scene..."
2: 誕生 (POV with hands) -> "first-person hands crafting..."
3: 全盛期 (Period Still Life) -> "still life in historical setting..."
4: 流轉 (Excavation / Dusty) -> "excavated artifact, dust, erosion..."
5: 命運 (Sci-fi relic) -> "futuristic relic chamber..."

三、媒材與寫實度控制
- 若 styleRef 為「繪畫/水墨」：全圖風格化。
- 若 styleRef 為「攝影」：保持寫實度但模擬底片質感。

---

## Agent 4: Exhibit Narrator (博物館導覽敘述者)
【角色設定】
你是一名「博物館導覽敘述者」。
你的語氣必須是：「{tone}」。
你的任務是依據 Agent 2 的故事與 Agent 3 的視覺場景，生成第三人稱繁體中文導覽詞。

【核心規則】
一、語氣由 HistoryScale ({self.history_scale}) 決定：
1：軼聞（神秘、低語）
2：通史（文化與習俗）
3：正史（考據、學術）
二、導覽詞不得出現：Prompt、技術詞彙、模型流程、英文描述。
三、應直接「像在博物館講故事」。
四、長度約 80-120 字。

---

## Agent 5: Soundscape Curator (音效策展人)
【角色設定】
你是一名「音效策展人」。
你根據 Agent 2 的故事與 Agent 3 的圖像描述，從資料庫中選擇適合的音效。

【核心規則】
一、必須匹配故事情境與圖像描述，選擇 1-2 個代碼：
SOUND_WIND, SOUND_WATER, SOUND_CLANK, SOUND_CROWD, SOUND_QUIET, SOUND_LOW, SOUND_HUM, SOUND_FIRE, SOUND_SCREAM
二、輸出指令，讓系統播放被選擇的音效。

---

# FINAL OUTPUT FORMAT (JSON ONLY)
Combine the results from all agents into this exact JSON structure:

{{
  "name": "Object Name (from Agent 1, Traditional Chinese ONLY)",
  "visionPrompt": "English prompt (from Agent 3)",
  "scriptPrompt": "Traditional Chinese script (from Agent 4)",
  "ambienceCategory": "SELECTED_TAGS (comma separated, from Agent 5)",
  "imageStrength": 0.xx (from Agent 3),
  "era": "Period (from Agent 1, Traditional Chinese ONLY)"
}}
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
            print(f"🤖 [1/2] 正在分析圖片內容 (TimeScale={{self.time_scale}}, HistoryScale={{self.history_scale}})...")
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
            
            # [Phase 3] Fallback/Default values matching lib/ai-server.ts
            if not final_result.get("name"): final_result["name"] = "未知文物"
            if not final_result.get("visionPrompt"): final_result["visionPrompt"] = "Historical artifact close up, photorealistic."
            if not final_result.get("scriptPrompt"): final_result["scriptPrompt"] = "訊號模糊，無法解析歷史數據。"
            if not final_result.get("ambienceCategory"): final_result["ambienceCategory"] = "SOUND_QUIET"
            if not final_result.get("imageStrength"): final_result["imageStrength"] = 0.65
            if not final_result.get("era"): final_result["era"] = "未知年代"
            

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
        self.STATE_PARAMETER = 98   # [Phase 3] 參數調整頁面
        self.STATE_FAIL = -1        # 拍照失败
        self.STATE_ANALYZING = 100  # AI 分析中
        self.STATE_RESULT = 101     # 显示结果
        
        # [Phase 3] AI 參數
        self.time_scale = 3     # 1-5
        self.history_scale = 2  # 1-3
        
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
        
        # 拍照成功 -> 進入參數調整頁面 [Phase 3]
        if self.current_state == self.STATE_SUCCESS:
            self.current_state = self.STATE_PARAMETER
            print("⚙️ 進入參數調整模式 (Time/History Scale)")
            return

        # [Phase 3] 參數調整頁面互動
        if self.current_state == self.STATE_PARAMETER:
            x = event.x()
            y = event.y()
            w = self.width()
            h = self.height()
            
            # 定義區域與按鈕 (需與 paintEvent 對齊)
            # 這裡簡單劃分區域
            # Time Scale (1-5): y=100~200, x 分 5 等分
            if 100 <= y <= 200:
                step_w = w // 5
                val = (x // step_w) + 1
                if 1 <= val <= 5:
                    self.time_scale = val
                    print(f"Set TimeScale: {val}")
                    self.update()
                    return

            # History Scale (1-3): y=250~350, x 分 3 等分
            if 250 <= y <= 350:
                step_w = w // 3
                val = (x // step_w) + 1
                if 1 <= val <= 3:
                    self.history_scale = val
                    print(f"Set HistoryScale: {val}")
                    self.update()
                    return
            
            # Confirm Button: Bottom area (y > h-100)
            if y > h - 100:
                self.start_analysis()
                return
            
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
            traceback.print_exc()

    def start_analysis(self):
        """启动 AI 分析"""
        self.current_state = self.STATE_ANALYZING
        print(f"🤖 开始 AI 分析 (T={self.time_scale}, H={self.history_scale})...")
        
        # 将 QPixmap 转为 Base64
        image = self.captured_pixmap.toImage()
        buffer = QBuffer()
        buffer.open(QBuffer.ReadWrite)
        image.save(buffer, "JPG")
        b64_data = base64.b64encode(buffer.data()).decode()
        
        # 启动后台线程 [Phase 3: Pass Scales]
        self.worker = GeminiWorker(b64_data, self.time_scale, self.history_scale)
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

            # 1. 繪製背景 (全黑)
            painter.fillRect(self.rect(), Qt.black)

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
            painter.save()
            painter.setClipPath(path_window)

            # [狀態分流]
            # (1) 結果展示 (STATE_RESULT)
            if self.current_state == self.STATE_RESULT and self.generated_pixmap:
                if should_log:
                    print(f"[DEBUG] Generated Pixmap: {self.generated_pixmap.width()}x{self.generated_pixmap.height()}")
                
                # [Phase 2] 靜態放大 3.5 倍 (Pan Effect 準備)
                # 目標：將圖片放大到視窗直徑的 3.5 倍，並保持置中
                target_size = self.circle_radius * 2 * 3.5
                scaled = self.generated_pixmap.scaled(
                    int(target_size), int(target_size),
                    Qt.KeepAspectRatioByExpanding, Qt.SmoothTransformation
                )
                
                # 計算置中座標 (大圖中心點對齊視窗中心點)
                sx = center_x - (scaled.width() / 2)
                sy = center_y - (scaled.height() / 2)
                painter.drawPixmap(int(sx), int(sy), scaled)

            # (2) 靜態預覽 (STATE_ANALYZING, SUCCESS, FAIL, PARAMETER)
            elif self.captured_pixmap and self.current_state in [self.STATE_ANALYZING, self.STATE_SUCCESS, self.STATE_FAIL, self.STATE_PARAMETER]:
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
                
                # [Phase 3] 參數調整頁面 UI
                elif self.current_state == self.STATE_PARAMETER:
                    # 半透明黑色遮罩，讓文字更清楚
                    painter.fillRect(self.rect(), QColor(0, 0, 0, 150))
                    
                    font_title = QFont("Arial", 16, QFont.Bold)
                    font_label = QFont("Arial", 12)
                    painter.setPen(Qt.white)
                    
                    # Title
                    painter.setFont(font_title)
                    painter.drawText(QRect(0, 20, w, 40), Qt.AlignCenter, "調整參數 (Adjust Parameters)")
                    
                    # 1. Time Scale (1-5)
                    painter.setFont(font_label)
                    painter.drawText(QRect(20, 70, w, 30), Qt.AlignLeft, "Time Scale (起源 -> 未來):")
                    
                    # Draw 5 boxes
                    step_w = w // 5
                    for i in range(1, 6):
                        x_rect = (i-1) * step_w + 10
                        y_rect = 110
                        w_rect = step_w - 20
                        h_rect = 60
                        
                        # Selected Highlight
                        if i == self.time_scale:
                            painter.setBrush(QColor("#39ff14")) # Neon Green
                            painter.setPen(Qt.black)
                        else:
                            painter.setBrush(Qt.NoBrush)
                            painter.setPen(Qt.white)
                        
                        painter.drawRect(x_rect, y_rect, w_rect, h_rect)
                        painter.drawText(QRect(x_rect, y_rect, w_rect, h_rect), Qt.AlignCenter, str(i))
                        
                    # 2. History Scale (1-3)
                    painter.setPen(Qt.white)
                    painter.drawText(QRect(20, 210, w, 30), Qt.AlignLeft, "History Scale (軼聞 -> 正史):")
                    
                    # Draw 3 boxes
                    step_w = w // 3
                    for i in range(1, 4):
                        x_rect = (i-1) * step_w + 10
                        y_rect = 250
                        w_rect = step_w - 20
                        h_rect = 60
                        
                        # Selected Highlight
                        if i == self.history_scale:
                            painter.setBrush(QColor("#00ffff")) # Cyan
                            painter.setPen(Qt.black)
                        else:
                            painter.setBrush(Qt.NoBrush)
                            painter.setPen(Qt.white)
                            
                        painter.drawRect(x_rect, y_rect, w_rect, h_rect)
                        painter.drawText(QRect(x_rect, y_rect, w_rect, h_rect), Qt.AlignCenter, str(i))

                    # 3. Confirm Button
                    btn_rect = QRect(w//4, h - 80, w//2, 50)
                    painter.setBrush(QColor("white"))
                    painter.setPen(Qt.black)
                    painter.drawRoundedRect(btn_rect, 10, 10)
                    painter.drawText(btn_rect, Qt.AlignCenter, "開始分析 (Start Analysis)")

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
                            
                            # [Phase 2 Fix] 修正顏色對調問題 (BGR -> RGB)
                            # Picamera2 預設回傳 BGR 格式，使用 Format_BGR888 讓 Qt 正確解讀
                            h_img, w_img, ch = image.shape
                            bytes_per_line = ch * w_img
                            qimg = QImage(image.data, w_img, h_img, bytes_per_line, QImage.Format_BGR888)
                            
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
            
            # 恢復舊的 P1, P2, P3 狀態文字邏輯 (對應 current_state)
            state_text = f"P{self.current_state}"
            if self.current_state == self.STATE_RESULT:
                state_text = "RESULT"
            elif self.current_state == self.STATE_ANALYZING:
                state_text = "ANALYZING"
            elif self.current_state == self.STATE_SUCCESS:
                state_text = "SUCCESS"

            painter.setPen(QPen(border_color, 4))
            painter.setBrush(Qt.NoBrush)
            painter.drawEllipse(center_x - self.circle_radius, center_y - self.circle_radius, 
                                self.circle_radius * 2, self.circle_radius * 2)

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
            
            # [狀態顯示 - 恢復原始邏輯]
            elif self.current_state not in [self.STATE_ANALYZING, self.STATE_SUCCESS, self.STATE_FAIL, self.STATE_RESULT]:
                 painter.setPen(QColor("white"))
                 painter.setFont(QFont("Arial", 14, QFont.Bold))
                 # 簡單顯示狀態碼，取代掉之前的 label
                 painter.drawText(10, h - 20, f"State: P{self.current_state}")

            # -------------------------------------------------------------------------
            # [Phase 1 驗證標記]
            # -------------------------------------------------------------------------
            painter.setPen(QColor("#00FF00"))
            painter.setFont(QFont("Courier New", 12, QFont.Bold))
            painter.drawText(10, 20, "[Phase 1 Verified]")
            
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


if __name__ == "__main__":
    print("🌟 A.InSight - 软件渲染 + 圆形遮罩")
    print("   380px 圆形视窗")
    print("   中心文字：测试")
    print("   按 ESC 退出")
    
    app = QApplication(sys.argv)
    window = SoftwareRenderCamera()
    window.showFullScreen()
    sys.exit(app.exec_())
