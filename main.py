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
import os
import math
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
# 啟動時列出一次
threading.Thread(target=list_models).start()

class ConfigManager(QThread):
    """
    后台同步 Web 编辑器配置的管理器
    每 2 秒轮询一次 API
    """
    config_updated = pyqtSignal(dict)
    
    
    def __init__(self, api_url="http://localhost:3000/api/config"):
        super().__init__()
        self.api_url = api_url
        self.current_config = {}
        self.running = True
        self.first_fetch = True  # Flag for initial fetch
        
    def run(self):
        print(f"🔄 ConfigManager Started: Polling {self.api_url}")
        print(f"   Interval: 2 seconds")
        
        while self.running:
            try:
                print(f"📡 Fetching config from API...")
                resp = requests.get(self.api_url, timeout=1)
                print(f"   Status Code: {resp.status_code}")
                
                if resp.status_code == 200:
                    new_config = resp.json()
                    
                    # On first fetch, always print the config
                    if self.first_fetch:
                        print(f"✅ Initial Config Loaded:")
                        print(f"   bootText: {new_config.get('text_content', {}).get('bootText', 'N/A')}")
                        print(f"   primary_color: {new_config.get('ui_theme', {}).get('primary_color', 'N/A')}")
                        self.current_config = new_config
                        self.config_updated.emit(new_config)
                        self.first_fetch = False
                    else:
                        # Simple comparison to avoid unnecessary repaints
                        if json.dumps(new_config, sort_keys=True) != json.dumps(self.current_config, sort_keys=True):
                            self.current_config = new_config
                            print("✨ Config Updated from Web!")
                            print(f"   bootText: {new_config.get('text_content', {}).get('bootText', 'N/A')}")
                            print(f"   primary_color: {new_config.get('ui_theme', {}).get('primary_color', 'N/A')}")
                            self.config_updated.emit(new_config)
                else:
                    print(f"⚠️ API Error: Status {resp.status_code}")
                    
            except requests.exceptions.Timeout:
                print(f"⏱️ Timeout: Could not reach {self.api_url}")
            except requests.exceptions.ConnectionError as e:
                print(f"🔌 Connection Error: {str(e)[:100]}")
            except Exception as e:
                print(f"❌ ConfigManager Error: {type(e).__name__}: {str(e)[:100]}")
            
            # Sleep for 2 seconds
            self.msleep(2000)
            
    def stop(self):
        self.running = False
        self.wait()

        
    def get_text(self, key, default=""):
        """Safely get text from config.text_content"""
        try:
            return self.current_config.get("text_content", {}).get(key, default)
        except:
            return default
            
    def get_color(self, key, default="#ffffff"):
        """Safely get color from config.ui_theme"""
        try:
            return self.current_config.get("ui_theme", {}).get(key, default)
        except:
            return default

    def get_theme_value(self, key, default=None):
        try:
            return self.current_config.get("ui_theme", {}).get(key, default)
        except:
            return default


class GeminiWorker(QThread):
    """后台调用 API 的线程：文字分析 + 图像生成"""
    finished = pyqtSignal(dict)
    
    def __init__(self, image_data, time_scale=3, history_scale=2):
        super().__init__()
        # Convert QPixmap to base64 for API
        if isinstance(image_data, QPixmap):
            buffer = QBuffer()
            buffer.open(QBuffer.WriteOnly)
            image_data.save(buffer, "JPEG", 95)
            self.image_data = base64.b64encode(buffer.data()).decode('utf-8')
        else:
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




class ConfigManager(QThread):
    """
    后台同步 Web 编辑器配置的管理器
    每 2 秒轮询一次 API
    """
    config_updated = pyqtSignal(dict)
    
    def __init__(self, api_url="http://localhost:3000/api/config"):
        super().__init__()
        self.api_url = api_url
        self.current_config = {}
        self.running = True
        
    def run(self):
        print(f"🔄 ConfigManager Started: Polling {self.api_url}")
        while self.running:
            try:
                resp = requests.get(self.api_url, timeout=1)
                if resp.status_code == 200:
                    new_config = resp.json()
                    # Simple comparison to avoid unnecessary repaints
                    if json.dumps(new_config, sort_keys=True) != json.dumps(self.current_config, sort_keys=True):
                        self.current_config = new_config
                        print("✨ Config Updated from Web!")
                        self.config_updated.emit(new_config)
            except Exception as e:
                # Silently fail on network error to avoid spamming console
                pass
            
            # Sleep for 2 seconds
            self.msleep(2000)
            
    def stop(self):
        self.running = False
        self.wait()
        
    def get_text(self, key, default=""):
        """Safely get text from config.text_content"""
        try:
            return self.current_config.get("text_content", {}).get(key, default)
        except:
            return default
            
    def get_color(self, key, default="#ffffff"):
        """Safely get color from config.ui_theme"""
        try:
            return self.current_config.get("ui_theme", {}).get(key, default)
        except:
            return default

    def get_theme_value(self, key, default=None):
        try:
            return self.current_config.get("ui_theme", {}).get(key, default)
        except:
            return default


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
        
        # 状態常量 (Align with Web App STEPS)
        self.STATE_BOOT = 1
        self.STATE_PROXIMITY = 2
        self.STATE_LOCKED = 3        # 原 P3_CAPTURE
        self.STATE_TUNING = 4        # 原 PARAMETER
        self.STATE_ANALYZING = 5
        self.STATE_LISTEN = 6        # [New]
        self.STATE_FOCUSING = 7      # [New]
        self.STATE_REVEAL = 8        # 原 RESULT
        
        # 輔助狀態
        self.STATE_SUCCESS = 99      # 拍照完到 TUNING 的過渡 (可選)
        self.STATE_FAIL = -1
        
        # [Phase 3] AI 參數
        self.time_scale = 3     # 1-5
        self.history_scale = 2  # 1-3
        
        # [Phase 2] 滑鼠互動
        self.setMouseTracking(True)
        self.pan_offset_x = 0
        self.pan_offset_y = 0
        
        
        self.current_state = self.STATE_BOOT
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
        
        # [Phase 4.4] Config Manager - Sync with Web Editor
        # Read API host from environment variable or default to Mac IP
        api_host = os.environ.get('API_HOST', '192.168.1.118')
        api_url = f"http://{api_host}:3000/api/config"
        print(f"🌐 Config API: {api_url}")
        
        self.config_manager = ConfigManager(api_url=api_url)
        self.config_manager.config_updated.connect(self.on_config_update)
        self.config_manager.start()
        
        # 定时器
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.update_frame)
        self.timer.start(33)
    
    def on_config_update(self, new_config):
        """Web 端的設定更新了，重新繪製 UI"""
        self.update()
    
    def mousePressEvent(self, event):
        """处理点击事件 (Aligned with Web App Flow)"""
        
        # 1. BOOT -> PROXIMITY -> LOCKED
        if self.current_state in [self.STATE_BOOT, self.STATE_PROXIMITY]:
            self.current_state += 1
            print(f"🖱️ 狀態切換: {self.get_state_name()}")
            return

        # 2. LOCKED (拍照)
        if self.current_state == self.STATE_LOCKED:
            self.capture_photo()
            # capture_photo 會跳到 STATE_SUCCESS
            return

        # 3. SUCCESS (拍照完) -> 跳轉到 TUNING
        if self.current_state == self.STATE_SUCCESS:
            self.current_state = self.STATE_TUNING
            print("⚙️ 進入 TUNING 模式 (參數調整)")
            return

        # 4. TUNING (參數調整互動)
        if self.current_state == self.STATE_TUNING:
            x = event.x()
            y = event.y()
            w = self.width()
            h = self.height()
            
            # Time Scale (1-5): y=100~200
            if 100 <= y <= 200:
                step_w = w // 5
                val = (x // step_w) + 1
                if 1 <= val <= 5:
                    self.time_scale = val
                    self.update()
                    return

            # History Scale (1-3): y=250~350
            if 250 <= y <= 350:
                step_w = w // 3
                val = (x // step_w) + 1
                if 1 <= val <= 3:
                    self.history_scale = val
                    self.update()
                    return
            
            # Confirm Button
            if y > h - 100:
                self.start_analysis()
                return
            return

        # 5. ANALYZING (分析中禁止手動點擊切換)
        if self.current_state == self.STATE_ANALYZING:
            return

        # 6. LISTEN (閱讀劇本) -> 跳轉到 FOCUSING
        if self.current_state == self.STATE_LISTEN:
            self.current_state = self.STATE_FOCUSING
            print("👁️ 進入 FOCUSING 模式")
            return

        # 7. FOCUSING (對焦) -> 跳轉到 REVEAL
        if self.current_state == self.STATE_FOCUSING:
            self.current_state = self.STATE_REVEAL
            print("✨ 進入 REVEAL 模式 (結果展示)")
            return

        # 8. REVEAL / FAIL -> 回到 BOOT
        if self.current_state in [self.STATE_REVEAL, self.STATE_FAIL]:
            self.current_state = self.STATE_BOOT
            self.captured_pixmap = None
            self.analysis_result = None
            self.generated_pixmap = None
            print("🔄 重置到 BOOT")
            return

    def get_state_name(self):
        """獲取當前狀態名稱"""
        mapping = {
            self.STATE_BOOT: "BOOT",
            self.STATE_PROXIMITY: "PROXIMITY",
            self.STATE_LOCKED: "LOCKED",
            self.STATE_TUNING: "TUNING",
            self.STATE_ANALYZING: "ANALYZING",
            self.STATE_LISTEN: "LISTEN",
            self.STATE_FOCUSING: "FOCUSING",
            self.STATE_REVEAL: "REVEAL",
            self.STATE_SUCCESS: "SUCCESS",
            self.STATE_FAIL: "FAIL"
        }
        return mapping.get(self.current_state, "UNKNOWN")

    def mouseMoveEvent(self, event):
        """
        [Phase 2] 滑鼠平移邏輯 (Pan Effect)
        當滑鼠在圓形視窗內移動時，計算相對位移並更新圖片位置。
        邏輯：Mouse Right -> Image Right -> See Left (Reveal)
        """
        if self.current_state == self.STATE_REVEAL:
            w = self.width()
            h = self.height()
            center_x = w // 2
            center_y = h // 2
            
            # 計算滑鼠相對於中心的偏移量
            mx = event.x()
            my = event.y()
            dx = mx - center_x
            dy = my - center_y
            
            # [Pan Factor] 調整靈敏度
            # 這裡簡單設定為 1.5 倍的滑鼠移動量，讓效果更明顯
            factor = 1.5
            self.pan_offset_x = dx * factor
            self.pan_offset_y = dy * factor
            
            # 強制重繪以即時更新
            self.update()

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
                
        self.current_state = self.STATE_LISTEN

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
            # (1) 結果展示 (STATE_REVEAL)
            if self.current_state == self.STATE_REVEAL and self.generated_pixmap:
                if should_log:
                    print(f"[DEBUG] Generated Pixmap: {self.generated_pixmap.width()}x{self.generated_pixmap.height()}")
                
                # [Phase 2] 靜態放大 3.5 倍 (Pan Effect 準備)
                # 目標：將圖片放大到視窗直徑的 3.5 倍，並保持置中
                target_size = self.circle_radius * 2 * 3.5
                scaled = self.generated_pixmap.scaled(
                    int(target_size), int(target_size),
                    Qt.KeepAspectRatioByExpanding, Qt.SmoothTransformation
                )
                
                # 計算置中座標 (大圖中心點對齊視窗中心點) + [Phase 2] Pan Offset
                sx = center_x - (scaled.width() / 2) + self.pan_offset_x
                sy = center_y - (scaled.height() / 2) + self.pan_offset_y
                painter.drawPixmap(int(sx), int(sy), scaled)

            # (2) 靜態預覽 (STATE_ANALYZING, SUCCESS, FAIL, TUNING, LISTEN, FOCUSING)
            elif self.captured_pixmap and self.current_state in [self.STATE_ANALYZING, self.STATE_SUCCESS, self.STATE_FAIL, self.STATE_TUNING, self.STATE_LISTEN, self.STATE_FOCUSING]:
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
            # B. 繪製 UI 層 (Global HUD & Overlay) - 覆蓋在上面
            # -------------------------------------------------------------------------
            
            # [Phase 4.3 Refinement] Scan Line Texture (Transparent BG)
            # Web: background-size: 100% 4px; linear-gradient...
            # Native: Use a pattern brush
            painter.save()
            painter.setOpacity(0.1) # Web is opacity-10
            # Create a pattern for scanlines
            # Simple approach: draw lines every 4 pixels
            for y in range(0, h, 4):
                painter.fillRect(0, y, w, 2, QColor(0, 0, 0, 128)) # Semi-transparent black lines
            painter.restore()
            
            # [Phase 4.3] Global HUD (Rings & Ticks) - Always visible
            self.draw_global_hud(painter, center_x, center_y)

            # -------------------------------------------------------------------------
            # C. 狀態特定 UI Overlays
            # -------------------------------------------------------------------------
            
            # 1. 圓形邊框 (Use dynamic color for all states)
            primary_hex = self.config_manager.get_color("primary_color", "#ffffff")
            border_color = QColor(primary_hex)
            # No state-specific overrides - all use theme color
            # [Phase 3 Fix] UI 參數頁面也需要特殊邊框嗎？其實不需要，因為有全螢幕遮罩

            # [Phase 4.2] STATE_BOOT UI (Visual Parity)
            if self.current_state == self.STATE_BOOT:
                # Get dynamic primary color
                primary_hex = self.config_manager.get_color("primary_color", "#ffffff")
                text_color = QColor(primary_hex)
                
                # 1. Main Text: "正在探測歷史訊號" (25pt Bold)
                painter.setPen(text_color)
                painter.setFont(QFont("Arial", 25, QFont.Bold)) # Adjusted to 25pt
                # User requested move down by 3px: -60 -> -57. Now another 4px: -53
                text_rect_1 = QRect(0, center_y - 53, w, 50)
                txt_main = self.config_manager.get_text("bootText", "正在探測歷史訊號")
                painter.drawText(text_rect_1, Qt.AlignCenter, txt_main)

                # 2. Sub Text: "尋找中..." (11pt Bold)
                painter.setPen(text_color)
                painter.setFont(QFont("Arial", 11, QFont.Bold)) # Adjusted to 11pt
                # User requested move down by 3px: 0 -> +3. Now another 4px: +7
                text_rect_2 = QRect(0, center_y + 7, w, 30)
                txt_sub = self.config_manager.get_text("bootSubtext", "尋找中...")
                painter.drawText(text_rect_2, Qt.AlignCenter, txt_sub)

                # 3. Hint Text: "請在展區中隨意走動" (8pt opacity 0.6)
                painter.save()
                painter.setPen(text_color)
                painter.setOpacity(0.6)
                painter.setFont(QFont("Arial", 8)) # Adjusted to 8pt
                # User requested move down by 3px: +40 -> +43. Now another 4px: +47
                text_rect_3 = QRect(0, center_y + 47, w, 20)
                txt_hint = self.config_manager.get_text("bootHint", "請在展區中隨意走動")
                painter.drawText(text_rect_3, Qt.AlignCenter, txt_hint)
                painter.restore()

            # [Phase 4.4] STATE_PROXIMITY UI (Pulsing Ring + Text)
            if self.current_state == self.STATE_PROXIMITY:
                self.draw_proximity_state(painter, center_x, center_y)
                
            # [Phase 4.4] STATE_LOCKED UI (Brackets + Text)
            if self.current_state == self.STATE_LOCKED:
                self.draw_locked_state(painter, center_x, center_y)
            
            # [Phase 5A] STATE_ANALYZING UI (Dotted Circle Animation)
            if self.current_state == self.STATE_ANALYZING:
                self.draw_analyzing_state(painter, center_x, center_y)
            
            # 2. [Phase 3] 參數調整頁面 UI (Overlay Layer - Unclipped)
            # 2. [Phase 5A] TUNING State - Circular Conic Gradients
            # Matching Web: ClassicSkinV2.tsx lines 220-254
            if self.current_state == self.STATE_TUNING:
                # Get dynamic primary color
                primary_hex = self.config_manager.get_color("primary_color", "#ffffff")
                theme_color = QColor(primary_hex)
                
                # Semi-transparent black overlay (bg-black/60)
                painter.fillRect(self.rect(), QColor(0, 0, 0, 153))
                
                # Container: 260px x 260px centered
                container_size = 260
                cx_tuning = center_x
                cy_tuning = center_y
                
                painter.save()
                painter.setRenderHint(QPainter.Antialiasing)
                
                # 1. Outer Ring (Time Scale 1-5) - 260px diameter
                # Web: border-white/20 + conic-gradient(color 0deg XXXdeg)
                # XXX = timeScale * 72 degrees (72° per level, 5 levels = 360°)
                
                # Base circle border
                base_border = QColor(theme_color)
                base_border.setAlpha(51)  # 20% opacity
                painter.setPen(QPen(base_border, 1))
                painter.setBrush(Qt.NoBrush)
                painter.drawEllipse(cx_tuning - 130, cy_tuning - 130, 260, 260)
                
                # Filled arc (conic gradient simulation using thick stroke)
                fill_angle = self.time_scale * 72  # 1-5 maps to 72-360°
                if fill_angle > 0:
                    fill_color = QColor(theme_color)
                    fill_color.setAlpha(204)  # 80% opacity
                    
                    # Use thick pen (30px) with flat cap to create ring effect
                    pen = QPen(fill_color, 30)
                    pen.setCapStyle(Qt.FlatCap)  # Prevent rounded ends
                    painter.setPen(pen)
                    painter.setBrush(Qt.NoBrush)
                    # Draw arc from top (90°) clockwise
                    painter.drawArc(cx_tuning - 130, cy_tuning - 130, 260, 260, 90 * 16, -fill_angle * 16)
                
                # 2. Inner Ring (History Scale 1-3) - 200px diameter (inset 30px)
                # Web: border-white/20 + conic-gradient(color 0deg XXXdeg)
                # XXX = historyScale * 120 degrees (120° per level, 3 levels = 360°)
                
                # Base circle border
                inner_border = QColor(theme_color)
                inner_border.setAlpha(51)  # 20% opacity
                painter.setPen(QPen(inner_border, 1))
                painter.setBrush(Qt.NoBrush)
                painter.drawEllipse(cx_tuning - 100, cy_tuning - 100, 200, 200)
                
                # Filled arc (conic gradient simulation using thick stroke)
                inner_fill_angle = self.history_scale * 120  # 1-3 maps to 120-360°
                if inner_fill_angle > 0:
                    inner_fill_color = QColor(theme_color)
                    inner_fill_color.setAlpha(128)  # 50% opacity
                    
                    # Use thick pen (30px) with flat cap to create ring effect
                    pen_inner = QPen(inner_fill_color, 30)
                    pen_inner.setCapStyle(Qt.FlatCap)
                    painter.setPen(pen_inner)
                    painter.setBrush(Qt.NoBrush)
                    painter.drawArc(cx_tuning - 100, cy_tuning - 100, 200, 200, 90 * 16, -inner_fill_angle * 16)
                
                painter.restore()
                
                # 3. Center Display - Labels and Values (ensure visibility on top)
                painter.save()
                painter.setRenderHint(QPainter.TextAntialiasing)
                
                # Time Scale Section (Top)
                txt_outer_label = self.config_manager.get_text("tuningRingOuter", "時間軸")
                label_color = QColor(255, 255, 255, 153)  # opacity-60
                painter.setPen(label_color)
                painter.setFont(QFont("Arial", 8))
                painter.drawText(QRect(cx_tuning - 50, cy_tuning - 40, 100, 15), Qt.AlignCenter, txt_outer_label)
                
                # Time value "L-0X"
                painter.setPen(Qt.white)
                painter.setFont(QFont("Arial", 20, QFont.Bold))
                time_value_text = f"L-0{self.time_scale}"
                painter.drawText(QRect(cx_tuning - 50, cy_tuning - 22, 100, 25), Qt.AlignCenter, time_value_text)
                
                # Divider line
                divider_y = cy_tuning + 5
                divider_color = QColor(255, 255, 255, 51)  # white/20
                painter.setPen(QPen(divider_color, 1))
                painter.drawLine(cx_tuning - 40, divider_y, cx_tuning + 40, divider_y)
                
                # History Scale Section (Bottom)
                txt_inner_label = self.config_manager.get_text("tuningRingInner", "史實度")
                painter.setPen(label_color)
                painter.setFont(QFont("Arial", 8))
                painter.drawText(QRect(cx_tuning - 50, cy_tuning + 10, 100, 15), Qt.AlignCenter, txt_inner_label)
                
                # History label
                history_labels = {1: "低度", 2: "中度", 3: "高度"}
                history_label = history_labels.get(self.history_scale, "低度")
                painter.setPen(Qt.white)
                painter.setFont(QFont("Arial", 18, QFont.Bold))
                painter.drawText(QRect(cx_tuning - 50, cy_tuning + 23, 100, 25), Qt.AlignCenter, history_label)
                
                painter.restore()

            
            # 恢復舊的 P1, P2, P3 狀態文字邏輯 (對應 current_state)
            state_text = self.get_state_name()
        







            painter.setPen(QPen(border_color, 4))
            painter.setBrush(Qt.NoBrush)
            painter.drawEllipse(center_x - self.circle_radius, center_y - self.circle_radius, 
                                self.circle_radius * 2, self.circle_radius * 2)

            # 3. 文字資訊 (Use dynamic theme color)
            primary_hex_bottom = self.config_manager.get_color("primary_color", "#ffffff")
            status_color = QColor(primary_hex_bottom)
            
            if self.current_state == self.STATE_REVEAL and self.analysis_result:
                name = self.analysis_result.get("name", "")
                era = self.analysis_result.get("era", "")
                painter.setPen(status_color)
                painter.setFont(QFont("Arial", 16, QFont.Bold))
                painter.drawText(QRect(0, h - 80, w, 50), Qt.AlignCenter, f"{name} | {era}")
            
            elif self.current_state == self.STATE_ANALYZING:
                painter.setPen(status_color)
                painter.setFont(QFont("Arial", 16, QFont.Bold))
                painter.drawText(QRect(0, h - 80, w, 50), Qt.AlignCenter, "AI 分析中...")
                
            elif self.current_state == self.STATE_SUCCESS:
                painter.setPen(status_color)
                painter.setFont(QFont("Arial", 16, QFont.Bold))
                painter.drawText(QRect(0, h - 80, w, 50), Qt.AlignCenter, "點擊畫面查看")
            
            # [狀態顯示 - 統一使用 get_state_name]
            elif self.current_state not in [self.STATE_ANALYZING, self.STATE_SUCCESS, self.STATE_FAIL, self.STATE_REVEAL]:
                 painter.setPen(status_color)
                 painter.setFont(QFont("Arial", 14, QFont.Bold))
                 # 簡單顯示狀態碼，取代掉之前的 label
                 painter.drawText(10, h - 20, f"State: {state_text}")

            # -------------------------------------------------------------------------
            # [Phase 1 驗證標記] (Use dynamic color)
            # -------------------------------------------------------------------------
            painter.setPen(status_color)
            painter.setFont(QFont("Courier New", 12, QFont.Bold))
            painter.drawText(10, 20, "[Phase 1 Verified]")
            
        except Exception as e:
            print("❌ paintEvent 發生嚴重錯誤:")
            traceback.print_exc()

    def draw_proximity_state(self, painter, cx, cy):
        """
        [Phase 4.4] 繪製 PROXIMITY 狀態 UI
        包含：脈衝圓環、中心文字、底部距離數值
        """
        painter.save()
        
        # 動畫與樣式參數
        # Cycle: 3000ms. 0.1 -> 0.5 -> 1.0 -> 0.1
        # Simplified breathing curve: sin wave moved to 0.1-1.0 range
        import time
        t = (time.time() * 1000) % 3000
        # Manual stepped logic from CSS:
        # 0% (0ms) -> 0.1
        # 33% (1000ms) -> 0.5
        # 66% (2000ms) -> 1.0
        # 100% (3000ms) -> 0.1
        # Linear interpolation between opacity points
        opacity = 0.1
        if t < 1000:
            # 0.1 -> 0.5
            opacity = 0.1 + (t / 1000.0) * 0.4
        elif t < 2000:
            # 0.5 -> 1.0
            opacity = 0.5 + ((t - 1000) / 1000.0) * 0.5
        else:
            # 1.0 -> 0.1
            opacity = 1.0 - ((t - 2000) / 1000.0) * 0.9
            
        # 1. Pulsing Ring (180px)
        primary_hex = self.config_manager.get_color("primary_color", "#ffffff")
        ring_color = QColor(primary_hex)
        ring_color.setAlphaF(opacity)
        painter.setPen(QPen(ring_color, 1))
        painter.setBrush(Qt.NoBrush)
        painter.drawEllipse(cx - 90, cy - 90, 180, 180)
        
        # 2. Center Content (Circle BG + Text)
        # Web: bg-black/80, border-white/10, p-6
        # Size? Content driven or fixed? Web says p-6 around content.
        # Let's assume a roughly 140px-150px circle or just draw background for text area.
        # Actually Web Structure: top div 180px ring. inner div (sibling?) center-xy ...
        # Inner div looks like a contained circle. Let's make it 140px fixed.
        bg_radius = 70
        painter.setPen(QPen(QColor(255, 255, 255, 25), 1)) # Border white/10
        painter.setBrush(QColor(0, 0, 0, 204)) # Black 80%
        painter.drawEllipse(cx - bg_radius, cy - bg_radius, bg_radius * 2, bg_radius * 2)
        
        # Text 1: "訊號偵測" (25pt Bold)
        painter.setPen(Qt.white)
        painter.setFont(QFont("Arial", 25, QFont.Bold))
        text_rect_1 = QRect(0, cy - 40, self.width(), 40)
        txt_prox_title = self.config_manager.get_text("proximityTitle", "訊號偵測")
        painter.drawText(text_rect_1, Qt.AlignCenter, txt_prox_title)
        
        # Separator Line
        painter.setPen(QPen(QColor(255, 255, 255, 128), 1))
        painter.drawLine(cx - 50, cy + 5, cx + 50, cy + 5)
        
        # Text 2: "接近目標中" (11pt Bold)
        painter.setPen(Qt.white)
        painter.setFont(QFont("Arial", 11, QFont.Bold))
        text_rect_2 = QRect(0, cy + 10, self.width(), 20)
        txt_prox_sub = self.config_manager.get_text("proximitySubtext", "接近目標中")
        painter.drawText(text_rect_2, Qt.AlignCenter, txt_prox_sub)
        
        # 3. Bottom Distance Indicator
        # Position: Bottom 64px.
        # "0.8" (25pt), "M" (8pt)
        # Draw them together centered?
        # Let's draw "0.8" then "M" next to it.
        # Total width approx 60px?
        # Let's draw "0.8" at center-left offset, "M" at center-right.
        
        bottom_y = self.height() - 64
        
        # "0.8"
        painter.setFont(QFont("Arial", 25, QFont.Bold)) # Mono? Web says font-mono. Let's stick to Arial for consistency or Courier. User asked for 25pt.
        # Let's use Arial 25pt.
        painter.drawText(QRect(0, bottom_y - 40, self.width() - 30, 40), Qt.AlignRight | Qt.AlignVCenter, "0.8")
        
        # "M"
        painter.setFont(QFont("Arial", 8))
        painter.drawText(QRect(self.width() // 2 + 5, bottom_y - 25, 50, 25), Qt.AlignLeft | Qt.AlignBottom, "M")

        painter.restore()

    def draw_locked_state(self, painter, cx, cy):
        """
        [Phase 4.4] 繪製 LOCKED 狀態 UI
        包含：四個角落括號 (Arc Segments)、中心點、上下文字
        """
        painter.save()
        
        # 動畫與樣式參數
        # Cycle: 3000ms. Stepped opacity: 0.1 -> 0.5 -> 1.0 -> 0.1
        # Web CSS: animation: stepped-opacity 3s steps(1) infinite
        import time
        t = time.time() % 3  # 3 second cycle
        
        # Stepped animation (instant transitions, not smooth)
        if t < 1:
            opacity = 0.1
        elif t < 2:
            opacity = 0.5
        else:
            opacity = 1.0
            
        primary_hex = self.config_manager.get_color("primary_color", "#ffffff")
        ring_color = QColor(primary_hex)
        ring_color.setAlphaF(opacity)
        
        # 1. 括號/Arc Segments (200px square -> 100px radius)
        # Web uses 4 divs with borders and clip-paths.
        # Implies a ring where segments are visible. 
        # Let's draw 4 arcs of 90 degrees? Or 4 corner brackets 'L' shapes?
        # Web clip-paths suggest segments of a circle (rounded-full divs).
        # Top div: clipPath inset(0 20% 80% 20%) -> Top part of ring.
        # Let's draw 4 arcs, each maybe 60 degrees, leaving gaps?
        # Or just 4 corners. 
        # Let's simple draw a circle with dashed line? Or 4 drawArc calls.
        
        # Radius 100px (200px diameter)
        r = 100
        
        painter.setPen(QPen(ring_color, 2))
        painter.setBrush(Qt.NoBrush)
        
        # Top Arc (Top-Center approx)
        # Web: clip-path inset(0 20% 80% 20%) -> Keeps top 20% of box. 
        # This yields an arc at the very top.
        # Let's draw 4 arcs at cardinal directions (Top, Bottom, Left, Right) based on Web div structure.
        # Div 1: border-t-2 (Top)
        # Div 2: border-b-2 (Bottom)
        # Div 3: border-l-2 (Left)
        # Div 4: border-r-2 (Right)
        
        span_angle = 60 * 16 # 60 degrees in 1/16th degrees
        # Top (90 deg) -> Start at 60, span 60?
        # Qt angles: 0 is 3 o'clock. 90 is 12 o'clock.
        # Top arc: 90 +/- 30 -> 60 to 120. Start angle 60? 
        # drawArc(rect, startAngle, spanAngle)
        # startAngle 60*16, span 60*16.
        
        # Top
        painter.drawArc(cx - r, cy - r, 200, 200, 60 * 16, 60 * 16)
        # Bottom (270 deg)
        painter.drawArc(cx - r, cy - r, 200, 200, 240 * 16, 60 * 16)
        # Left (180 deg)
        painter.drawArc(cx - r, cy - r, 200, 200, 150 * 16, 60 * 16)
        # Right (0 deg)
        painter.drawArc(cx - r, cy - r, 200, 200, -30 * 16, 60 * 16)
        
        # 2. Center Dot (2px, same color as brackets)
        dot_color = QColor(primary_hex)
        painter.setPen(Qt.NoPen)
        painter.setBrush(dot_color)
        painter.drawEllipse(cx - 1, cy - 1, 2, 2)
        
        # 3. Title Box: "鎖定目標" 
        # Web: top-[35%], bg-black/90, border (dynamic color), rounded-sm, text-[10px]
        txt_locked = self.config_manager.get_text("lockedTitle", "鎖定目標")
        painter.setFont(QFont("Arial", 10, QFont.Bold))
        fm = painter.fontMetrics()
        tw = fm.horizontalAdvance(txt_locked)
        th = fm.height()
        
        # Create box with padding
        padding_x = 6
        padding_y = 3
        box_width = tw + padding_x * 2
        box_height = th + padding_y * 2
        box_rect = QRect(cx - box_width // 2, cy - 80, box_width, box_height)
        
        # Draw background and border (border uses primary color)
        title_bg = QColor(0, 0, 0, 230)  # black/90%
        title_border = QColor(primary_hex)
        painter.setBrush(title_bg)
        painter.setPen(QPen(title_border, 1))
        painter.drawRoundedRect(box_rect, 2, 2)
        
        # Draw text (also uses primary color)
        text_color = QColor(primary_hex)
        painter.setPen(text_color)
        painter.drawText(box_rect, Qt.AlignCenter, txt_locked)
        
        # 4. Bottom Subtext: "[ 按下快門捕捉 ]" (Web: text-[10px] white)
        painter.setFont(QFont("Arial", 10))
        painter.setPen(Qt.white)  # Web shows white text, not themed
        text_rect_2 = QRect(0, cy + 120, self.width(), 30)
        txt_locked_sub = self.config_manager.get_text("lockedSubtext", "[ 按下快門捕捉 ]")
        painter.drawText(text_rect_2, Qt.AlignCenter, txt_locked_sub)
        
        painter.restore()

    def draw_global_hud(self, painter, cx, cy):
        """
        [Phase 4.3] 繪製全域 HUD 裝飾 (外圈圓環 + 刻度)
        對應 ClassicSkinV2 的 Layer 1
        """
        painter.save()
        painter.setRenderHint(QPainter.Antialiasing)
        
        # 1. External Decoration Ring (370px)
        # Web: border-white/10 (unless REVEAL)
        # Native Refinement: 80% Opacity (204/255) as requested by User
        primary_hex = self.config_manager.get_color("primary_color", "#ffffff")
        base_color = QColor(primary_hex)
        
        ring_color = QColor(base_color)
        ring_color.setAlpha(204) # 80%
        
        if self.current_state == self.STATE_REVEAL:
            ring_color = QColor(255, 255, 255, 255) # Full white in REVEAL
            
        # Native Refinement: 80% Opacity (204/255) as requested by User
        # ring_color = QColor(255, 255, 255, 204) 
        
        painter.setPen(QPen(ring_color, 1))
        painter.setBrush(Qt.NoBrush)
        # 370px diameter = 185px radius
        painter.drawEllipse(cx - 185, cy - 185, 370, 370)
        
        # 2. Scale Ring Ticks (350px)
        # Web: 12 ticks, 30 degrees each.
        # Radius = 175px (half of 350)
        # Ticks: Longer at 0, 90, 180, 270.
        
        tick_color = QColor(base_color)  # Use theme color
        tick_color.setAlpha(204)  # 80% opacity
        
        radius = 175
        for i in range(12):
            angle_deg = (i * 30) - 90 # Start from top
            angle_rad = math.radians(angle_deg)
            
            # Tick length
            is_cardinal = (i % 3 == 0) # 0, 3, 6, 9
            tick_len = 12 if is_cardinal else 8
            tick_width = 2 if is_cardinal else 1
            
            # Calculate start and end points
            # Start logic from Web: transform: translateY(-radius)
            # This means the tick is at the circle edge pointing inwards? 
            # Web: height: tickLength. 
            # visual: The tick is ON the circle circumference.
            
            # Line start (at circle edge)
            p1_x = cx + radius * math.cos(angle_rad)
            p1_y = cy + radius * math.sin(angle_rad)
            
            # Line end (inwards)
            p2_x = cx + (radius - tick_len) * math.cos(angle_rad)
            p2_y = cy + (radius - tick_len) * math.sin(angle_rad)
            
            painter.setPen(QPen(tick_color, tick_width))
            painter.drawLine(int(p1_x), int(p1_y), int(p2_x), int(p2_y))
            
        # 3. Top Label "A.InSight" (9pt)
        # Position: Cy - 190 (Top of container) + 24 + 4px (User request)
        title_text = self.config_manager.get_text("title", "A.InSight")
        title_color = QColor(base_color)  # Use theme color
        title_color.setAlpha(200)  # 80% opacity
        painter.setPen(title_color)
        painter.setFont(QFont("Arial", 9)) # Modified to 9pt
        text_y = int(cy - 190 + 28)
        painter.drawText(QRect(0, text_y, self.width(), 20), Qt.AlignCenter, title_text)

        painter.restore()

    def keyPressEvent(self, event):
        # [Phase 5A] TUNING State Keyboard Controls
        if self.current_state == self.STATE_TUNING:
            if event.key() == Qt.Key_Left:
                # Decrease time_scale (min 1)
                if self.time_scale > 1:
                    self.time_scale -= 1
                    self.update()
            elif event.key() == Qt.Key_Right:
                # Increase time_scale (max 5)
                if self.time_scale < 5:
                    self.time_scale += 1
                    self.update()
            elif event.key() == Qt.Key_Up:
                # Increase history_scale (max 3)
                if self.history_scale < 3:
                    self.history_scale += 1
                    self.update()
            elif event.key() == Qt.Key_Down:
                # Decrease history_scale (min 1)
                if self.history_scale > 1:
                    self.history_scale -= 1
                    self.update()
            elif event.key() == Qt.Key_Return or event.key() == Qt.Key_Enter:
                # Confirm and start analyzing
                print(f"✅ Parameters confirmed: time={self.time_scale}, history={self.history_scale}")
                self.current_state = self.STATE_ANALYZING
                self.gemini_worker = GeminiWorker(self.captured_pixmap, self.time_scale, self.history_scale)
                self.gemini_worker.finished.connect(self.on_analysis_finished)
                self.gemini_worker.start()
                self.update()
        
        # Global ESC to quit
        if event.key() == Qt.Key_Escape:
            self.close()
    
    def closeEvent(self, event):
        print("🛑 关闭摄像头...")
        self.timer.stop()
        self.camera.stop()
        self.camera.close()
        event.accept()
        # Stop Config Sync
        if hasattr(self, 'config_manager'):
            self.config_manager.stop()
        # Stop Config Sync
        if hasattr(self, 'config_manager'):
            self.config_manager.stop()


if __name__ == "__main__":
    print("🌟 A.InSight - 软件渲染 + 圆形遮罩")
    print("   380px 圆形视窗")
    print("   中心文字：测试")
    print("   按 ESC 退出")
    
    app = QApplication(sys.argv)
    window = SoftwareRenderCamera()
    window.showFullScreen()
    sys.exit(app.exec_())

    def draw_analyzing_state(self, painter, cx, cy):
        """[Phase 5A] ANALYZING state with dotted circle animation"""
        painter.save()
        painter.setRenderHint(QPainter.Antialiasing)
        
        primary_hex = self.config_manager.get_color("primary_color", "#ffffff")
        theme_color = QColor(primary_hex)
        
        # Outer Circle Border (280px)
        outer_border = QColor(theme_color)
        outer_border.setAlpha(26)
        painter.setPen(QPen(outer_border, 1))
        painter.setBrush(Qt.NoBrush)
        painter.drawEllipse(cx - 140, cy - 140, 280, 280)
        
        # Dotted Circle Animation (200px)
        import time
        t = time.time() % 2
        opacity = 0.2 if t < 0.67 else (0.6 if t < 1.33 else 1.0)
        
        dotted_color = QColor(theme_color)
        dotted_color.setAlphaF(opacity)
        dotted_pen = QPen(dotted_color, 2)
        dotted_pen.setDashPattern([10, 15])
        painter.setPen(dotted_pen)
        painter.drawEllipse(cx - 100, cy - 100, 200, 200)
        
        # Center Text
        painter.setPen(Qt.white)
        txt_title = self.config_manager.get_text("analyzingTitle", "解析中")
        painter.setFont(QFont("Arial", 14, QFont.Bold))
        painter.drawText(QRect(cx - 60, cy - 20, 120, 20), Qt.AlignCenter, txt_title)
        
        txt_analysis = self.config_manager.get_text("analyzingText", "正在分析歷史資料")
        label_color = QColor(255, 255, 255, 179)
        painter.setPen(label_color)
        painter.setFont(QFont("Arial", 9))
        painter.drawText(QRect(cx - 80, cy + 5, 160, 20), Qt.AlignCenter, txt_analysis)
        
        painter.restore()

    def draw_focusing_state(self, painter, cx, cy):
        """[Phase 5B] FOCUSING state with 3 concentric blinking circles"""
        painter.save()
        painter.setRenderHint(QPainter.Antialiasing)
        
        primary_hex = self.config_manager.get_color("primary_color", "#ffffff")
        theme_color = QColor(primary_hex)
        
        # Outer Circle Border
        outer_border = QColor(theme_color)
        outer_border.setAlpha(51)
        painter.setPen(QPen(outer_border, 1))
        painter.setBrush(Qt.NoBrush)
        painter.drawEllipse(cx - 140, cy - 140, 280, 280)
        
        # Three Concentric Circles with Sequential Blink
        import time
        t = time.time() % 3
        circles = [(120, 240), (90, 180), (60, 120)]
        
        for i, (radius, diameter) in enumerate(circles):
            opacity = 0.8 if int(t) == i else 0.2
            circle_color = QColor(theme_color)
            circle_color.setAlpha(int(opacity * 255))
            painter.setPen(QPen(circle_color, 2))
            painter.setBrush(Qt.NoBrush)
            painter.drawEllipse(cx - radius, cy - radius, diameter, diameter)
        
        # Center Circle with Info
        center_bg = QColor(0, 0, 0, 230)
        painter.setBrush(center_bg)
        painter.setPen(QPen(theme_color, 1))
        painter.drawEllipse(cx - 50, cy - 50, 100, 100)
        
        txt_title = self.config_manager.get_text("focusingTitle", "對焦")
        painter.setPen(Qt.white)
        painter.setFont(QFont("Arial", 12, QFont.Bold))
        painter.drawText(QRect(cx - 40, cy - 15, 80, 20), Qt.AlignCenter, txt_title)
        
        painter.setFont(QFont("Arial", 16, QFont.Bold))
        painter.drawText(QRect(cx - 40, cy + 5, 80, 20), Qt.AlignCenter, "100%")
        
        txt_hint = self.config_manager.get_text("focusingHint", "[ 旋轉對焦 ]")
        label_color = QColor(255, 255, 255, 153)
        painter.setPen(label_color)
        painter.setFont(QFont("Arial", 9))
        painter.drawText(QRect(cx - 80, cy + 160, 160, 20), Qt.AlignCenter, txt_hint)
        
        painter.restore()

