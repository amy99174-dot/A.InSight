#!/usr/bin/env python3
"""
A.InSight - 软件渲染 + 圆形遮罩
380px 圆形视窗 + 中心文字
"""

from PyQt5.QtWidgets import QApplication, QWidget, QLabel
from PyQt5.QtCore import Qt, QTimer, QThread, pyqtSignal, QBuffer, QRectF, QRect
from PyQt5.QtGui import QImage, QPixmap, QPainter, QColor, QFont, QPainterPath, QBrush, QPen, QRadialGradient, QFontMetrics
from picamera2 import Picamera2
import requests
import json
import base64
import numpy as np

# Audio Manager for TTS
from audio_manager import AudioManager

# GPIO Controller for physical buttons
try:
    from gpio_controller import GPIOController
    GPIO_AVAILABLE = True
except ImportError:
    print("⚠️ gpiozero not available, GPIO disabled")
    GPIO_AVAILABLE = False

# Gyroscope Controller for image panning
try:
    from gyro_controller import GyroController
    GYRO_AVAILABLE = True
except ImportError:
    print("⚠️ mpu6050 not available, gyroscope disabled")
    GYRO_AVAILABLE = False

# Supabase Client for database logging (uses requests, no extra install needed)
try:
    from supabase_client import log_history as supabase_log_history
    SUPABASE_AVAILABLE = True
    print("✅ Supabase client loaded")
except ImportError as e:
    print(f"⚠️ supabase_client not available: {e}")
    SUPABASE_AVAILABLE = False

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
            
            import random
            origin_mode = ("MATERIAL_ORIGIN" if random.random() > 0.5 else "CULTURAL_ORIGIN") if self.time_scale == 1 else "NONE"

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
2. **強制觀察步驟 (Chain of Observation)**：在給出最終名稱前，請先掃描圖片中的「材質組合」、「特殊結構（如錶盤、指針、把手）」以及「任何可見的外文標記或文字」。
3. 根據上述細節推斷精確名稱。若為複合功能物件（如又是盒子又是鐘），名稱需包含兩者特徵（例如：「嵌寶石鐘錶盒」）。
4. 若完全無法辨識 → 回覆「無法解析」，並附上原因。

需額外輸出 styleRef, manufacturingMethod, preFormState, 以及 category。

(Reference Constraints for Agent 1):
- styleRef: Must match the era (Ancient=Painting, Modern=Photo).
- manufacturingMethod: Must match material (Carving, Casting, etc).
- preFormState: Must describe raw material for TimeScale 1.

---

## Agent 2: Cultural Search Engine (文化敘事搜尋引擎)
【角色設定】
你是一個「文化敘事搜尋引擎」。
你的任務是根據 Agent 1 的物件資訊，結合時間與歷史深度設定，搜尋人文與歷史背景，構建一條可用於導覽與美術敘事的故事主線。

【核心規則】
一、請根據 TimeScale ({self.time_scale}) 決定搜尋策略與敘事的「時間切入點」：
// ...(TimeScale 1 的 MATERIAL_ORIGIN 與 CULTURAL_ORIGIN 保持你原本的優秀設定)...

- 若 2 (誕生/工藝製作)：
  **【強制實體考據】：無論 HistoryScale 設定為何，你都必須精確考據出該年代、該材質對應的「真實古代專用工具名詞與工法」**（例如：玉雕必須找出『木製水凳、砣輪、解玉砂』；瓷器需找出『拉胚機、匣鉢』；肉形石的表面處理需找出『染色、鑽孔』）。嚴禁憑空捏造工具。探索該時代的真實工作坊環境與光影。
*【專屬藝術流派與色彩考據】：你必須考據該文物所屬時代的「代表性畫派、經典名作或藝術家」（例如：宋代宮廷青綠山水、明代文人水墨、清代郎世寧中西合璧風格），並明確給出該風格的「色彩飽和度、筆觸特徵與畫面氛圍」（例如：高飽和度礦物彩、細膩工筆、低飽和水墨暈染）。這將作為後續繪圖的最高美學標準。**
- 若 3 (全盛)：
  **【場景與人物考據】：** 精確考據該物件在當時社會的「實際使用空間、周遭環境與人物互動」。(例如：汝窯茶盞應出現在宋代文人雅集的茶席或園林中；鐘錶盒應出現在清代皇帝的御書房，周圍有太監或西方使節；翠玉白菜可能被擺放在瑾妃的寢宮內閣)。這將作為建構「古代生活場景(風俗畫)」的基底劇本。
- 若 4 (流轉)：搜尋該類文物的出土紀錄、流失過程或隨時間風化的狀態。
- 若 5 (命運)：推論該物件若保存至科幻未來，其作為「古文明遺跡」的象徵意義。

二、請根據 HistoryScale ({self.history_scale}) 決定敘事視角與「資料屬性」：
  **【全域絕對規則】：HistoryScale 僅改變 Agent 4 (導覽詞) 的故事焦點與氛圍，【絕對不可】改變或扭曲 TimeScale 所考據出的「真實物理工具與環境」。**
- 若 1 (軼聞 - Myth/Folklore)：故事焦點放在民間傳說、匠人秘辛、神秘色彩或未經證實的野史（例如：傳說原石帶有靈性、工匠夢中得神仙指點）。
- 若 2 (通史 - Social History)：故事焦點放在當時的社會風俗、大眾文化背景、工匠的真實勞動狀態與市場貿易環境。
- 若 3 (正史 - Academic History)：故事焦點放在嚴謹的考古學術資料、皇室官方檔案（如清宮造辦處紀錄）、精確的典章制度與工藝名詞。

三、容錯機制：若無法找到特定物件的精確史料，請以「同年代、同材質」的通用歷史背景進行合理推演，絕不捏造虛構人名。

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
1: 起源 -> 系統目前的模式為【{origin_mode}】。
  ► 若為 MATERIAL_ORIGIN：CRITICAL: Force SHALLOW DEPTH OF FIELD (淺景深攝影) and MEDIUM SHOT. DO NOT draw the final artifact shape.
   Translate Agent 2's specific raw material into a realistic photograph of a **dense field or pile** of the raw mineral.
   **COMPOSITION RULE:** A **single, complete, recognizable chunk** of the raw material (e.g., raw jadeite stone, white kaolin rock) must be positioned in the **sharp center focus**. The entire surrounding frame must be filled with **more of the same raw materials**, but rendered with heavy **bokeh blur (散景)** to create a rich environmental texture without distracting from the central subject. Ensure the central sharp piece has enough margin to be fully visible in a circular crop.
  ► 若為 CULTURAL_ORIGIN：CRITICAL: Force Symbolic Macro Close-up. 畫出象徵該歷史事件的局部特寫（如穿著特定時代服飾的雙手交疊、泛黃的藍圖草稿），嚴禁畫出全身人物或展品本身。
2: 誕生 (Crafting Process) ->
   **CRITICAL: Force ERA-SPECIFIC ART STYLE combined with EXTREME CLOSE-UP OF HANDS ONLY. DO NOT DRAW THE FINISHED ARTIFACT.**

   1. 視角與【半成品】的絕對強制規則 (CRITICAL COMPOSITION & W.I.P RULES):
      - 【半成品狀態 (Work-in-Progress)】：絕對禁止畫出該文物的「最終完成品」！你必須在英文指令中將該物件描述為「雕刻到一半的毛胚、粗糙的半成品、尚未成形的石塊或初稿」(例如："a rough, half-carved block of jade", "an unpolished semi-finished artifact")。
      - 【強制句型】：轉換為英文繪圖指令時，【必須】將 Agent 2 考據出的「藝術風格與名作參考」放在句首，並強烈指定色彩飽和度。請嚴格套用此格式：
        "Artwork strictly in the style of [填入 Agent 2 查出的名作/藝術家與朝代風格，例如 Song Dynasty court painting, highly saturated mineral pigments, meticulous brushstrokes], close-up painted view of TWO HANDS ONLY working on a [填入半成品描述], framing from the forearms down, looking down at the table."
      - 【禁用詞彙】：絕對禁止出現 "artisan", "craftsman", "person"。一律替換為 "a pair of hands"。強制加入 "NO faces, NO heads, NO bodies in the frame."

   2. 歷史工法與物理姿態 (Historical Physics & Posture):
      - 【動態姿態轉換 (Dynamic Posture)】：仔細閱讀 Agent 2 查考出的「古代專用工具」。你必須根據該材質的物理特性，將其轉換為精確的英文動作描述。
        *(邏輯範例：若為玉石/硬物，工匠通常是「雙手緊握物件，依靠在固定的木製旋轉設備上打磨」；若為陶瓷/書畫，則是「手持軟毛筆懸腕繪製」；若為青銅/金屬，則是「操作泥模或澆築」)*。
      - 【嚴禁現代機械 (Ban Modern Mechanisms)】：英文指令中【絕對禁止】出現任何現代手持動力工具的暗示！請在 Prompt 中加入防呆詞彙："NO electric tools, NO Dremel, NO modern handles. Use ancient, hand-powered or treadle-operated wooden/iron mechanisms."
      - 【畫風保護鎖 (Style Protection)】：為了對抗 Global Keywords 中的寫實詞彙，你【必須】在英文指令的結尾強制加上這段風格宣告："Must be an authentic traditional painting with visible brushwork and historical art texture. NOT a photograph, NO cinematic lighting, NO photorealistic, NO 3D render."

   3: 全盛期 (Period Usage Scene) ->
   **CRITICAL: Force ERA-SPECIFIC ART STYLE combined with WIDE ENVIRONMENTAL SHOT. DO NOT draw human faces.**

   1. 尋寶構圖與【無臉】意境限制 (Composition & Faceless Mechanics):
      - 【取消特寫】：絕對禁止將展品畫在畫面正中央或佔據極大比例！展品必須以「真實世界的物理比例」自然地放置在宏大的歷史場景中，作為環境的一部份。
      - 【無臉環境敘事 (Faceless Storytelling)】：強烈展現該物件被使用的環境與時代氛圍，但【絕對禁止出現任何正臉或側面五官】！請強制使用以下手法來構建英文指令：
        a. 物是人非的空景（例如：剛倒滿茶的宋代茶几、硯台旁正冒著輕煙的清代御書房，暗示主人剛離開座位）。
        b. 局部肢體入鏡（例如：畫面邊緣僅伸出一雙穿著古裝衣袖的手，正準備拿起該物件）。
        c. 純背影（若場景中必須有人，所有人物必須完全背對鏡頭）。

   2. 強制句型與風格保護 (Prompt Structure & Style Protection):
      - 轉換為英文繪圖指令時，請嚴格套用此格式：
        "Artwork strictly in the style of [填入 Agent 2 查出的名作/朝代風格], wide-angle environmental scene of [填入古代生活場景, 並強調 empty room, back view only, or hands only]. The [展品半成品或成品] is proportionally scaled and seamlessly painted in the EXACT SAME 2D brushwork and medium as the environment, acting as a natural prop."
      - 【物件同化與畫風保護鎖】：句尾強制加上這段最強防護罩："Must be an authentic traditional painting. The artifact MUST NOT look like a photorealistic 3D render pasted into the painting. NO close-up, NO faces, NO heads, NO photography."
4: 流轉 (Relocation / Excavation / Flow) ->
   **CRITICAL: TIME JUMP AWARENESS (時代跨越認知) combined with STYLIZED PAINTING (維持藝術風格畫).**

   1. 【時代服飾與場景強制校正】：仔細閱讀 Agent 2 提供的流轉故事。此階段發生的時間通常遠晚於文物誕生的朝代。你【必須】在英文指令中強制設定符合「該事件發生年代」的場景與服裝（例如：1949年南遷，人物應穿著民國時期的粗布襯衫、工作服，場景為老舊木板箱、火車或倉庫）。絕對禁止出現展品原朝代的古裝！
   2. 【維持繪畫媒材 (No Photos)】：嚴禁產出寫實攝影或黑白老照片！即使場景是近現代，轉換為英文指令時，【必須】在句首宣告這是一幅「風格化的藝術畫作」（例如："Stylized historical illustration", "Traditional ink wash painting of a modern scene"），確保畫面保有筆觸感與藝術濾鏡。
   3. 【無臉與局部意境】：依然嚴禁出現人臉 (NO faces)。展品不應完美呈現，請描述其被防護材料半包裹、裝在木箱中，或半掩埋於塵土中，與畫作背景的筆觸完美同化。
5: 命運 (Sci-fi relic) -> "futuristic relic chamber..."

三、HistoryScale 視覺氛圍聯動與場景重構 (Atmospheric Override)
針對 TimeScale 3，你【必須】深度閱讀 Agent 2 產出的故事，提取出「最具視覺張力的核心情境」，並將其轉化為畫面的【絕對主體】，絕不能只套用標準的房間或桌子公式：

- 若故事偏向「軼聞/神話 (HistoryScale 1)」：
  【強制場景重構】：找出故事中的神話、夢境或極端情境（如：窯邊禱告、仙人指點、夜觀星空）。
  - 若故事提及「窯火/燒製/禱告」：場景必須切換至幽暗的古代磚窯 (ancient brick kiln)，充滿火光漫射、飛舞的火星 (glowing embers, flying sparks)，展品半成品在火光中隱約透出神秘色澤。
  - 若故事提及「月光/夢境/靈感」：場景必須極度幽暗，僅以一束戲劇性的月光 (dramatic single beam of moonlight) 聚焦在展品上，周圍以流動的輕煙或雲氣暗示夢境，徹底捨棄繁雜的室內家具。

- 若故事偏向「通史/常民生活 (HistoryScale 2)」：
  【強制加入世俗與勞動痕跡】：不要畫整潔的空房間。必須加入充滿生活氣息的物件（如：散落的銅幣、商人的帳本、茶漬），光源必須是溫暖且充滿塵埃的斜陽 (warm, dusty lively sunlight)，呈現真實的歷史厚度。

- 若故事偏向「正史/皇家檔案 (HistoryScale 3)」：
  【強調莊嚴、秩序與權力】：場景必須是極度對稱、冰冷宏偉的宮廷內閣。加入御用黃色絲綢帷幕、官方印章或宮廷檔案，光影必須冷峻且具備儀式感。

四、媒材與藝術風格控制（絕對優先權）
1. 【TimeScale 1 物質溯源 特例】：若 TimeScale 為 1 且模式為 MATERIAL_ORIGIN，【絕對忽略朝代風格與 styleRef】，強制使用「高解析寫實微距攝影 (Hyper-realistic macro photography)」。

2. 【全面藝術繪畫化 (Total Painting Stylization)】：針對 TimeScale 2, 3, 4, 5，以及 TimeScale 1 的 CULTURAL_ORIGIN，【絕對禁止任何寫實攝影、黑白老照片、3D渲染】！
   - 針對 TimeScale 2 與 3：強制根據展品「原產朝代」轉換為該朝代最具代表性的傳統繪畫流派。
   - 針對 TimeScale 4 與 5：場景中的物件、人物服裝必須符合「故事發生的年代（如近代或未來）」，但【視覺媒材】必須保持高度風格化的藝術繪畫形式（如水墨筆觸、復古插畫質感），以確保整個系統的藝術調性統一。
   【最嚴格警告】：展品本身絕對不能像是一張被貼上去的 3D 照片，必須被完全轉化為該畫面的繪畫筆觸與顏料質感！

---

## Agent 4: Exhibit Narrator (博物館導覽敘述者)
【核心規則】
一、請先檢查 TimeScale ({self.time_scale})，這將決定你的「時空立足點」與 HistoryScale ({self.history_scale}) 的作用方式：

► 狀況 A：當 TimeScale 為 1 到 4 時（過去與現代場景）
HistoryScale (1-3) 決定歷史的嚴謹度：
1：軼聞（神秘、低語、野史傳說）
2：通史（文化、習俗、平易近人）
3：正史（考據、學術、嚴肅工藝解析）

► 狀況 B：當 TimeScale 為 5 時（科幻未來場景）
請扮演「未來世代的觀察者」，此時 HistoryScale (1-3) 決定科幻的風格：
1：末日神話（神秘、廢土傳說、超自然現象）
2：未來社會（賽博龐克、反烏托邦、物件的未來日常用途）
3：未來學術（硬科幻、未來博物館的嚴肅考據、對古代物件的理性誤解與重新定義）

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
五、寫作風格禁令：
1. **禁用客套開場白**：絕對不要使用「各位觀眾」、「諸位貴賓」等無意義的稱呼，請直接切入敘事。
2. **禁用通用地質廢話**：刪除「歷經億萬年地質變遷」、「大自然的鬼斧神工」等缺乏資訊量的陳腔濫調。
3. **禁用空泛的詠嘆調結尾**：不要幫觀眾下「大地的恩賜」、「對天地的敬畏」等空泛的結論，請用具體的歷史或文化價值來作結。

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
        
        # 圓形直徑 - 動態計算，填滿螢幕 95%
        # 初始值會在 showEvent 或 resizeEvent 中根據視窗大小更新
        self.circle_diameter = 380  # placeholder, will be recalculated
        self.circle_radius = 190    # placeholder, will be recalculated
        
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
        self.tuning_selected_param = 0  # 0 = time_scale, 1 = history_scale
        
        # [Phase 5B] FOCUSING 參數
        self.focus_percentage = 0  # 0-100
        
        # [Phase 2] 滑鼠互動
        self.setMouseTracking(True)
        self.pan_offset_x = 0
        self.pan_offset_y = 0
        
        # [Phase 5] 分析結果
        self.analysis_result = {}
        self.script_page = 0  # Current page index for LISTEN state
        
        # [Supabase] Session ID: UUID generated once per app startup
        import random
        self.session_id = random.randint(100000, 999999)  # bigint-compatible
        print(f"📎 Session ID: {self.session_id}")
        
        # [Analytics] Interaction tracking
        self.interaction_count = 0        # How many analyses this boot
        self.interaction_start_time = None  # When PROXIMITY started
        self.listen_start_time = None       # When LISTEN started
        
        # [Audio] Initialize Audio Manager
        openai_key = os.environ.get("OPENAI_KEY", "")
        if openai_key:
            try:
                self.audio_manager = AudioManager(openai_key)
                print("🔊 Audio Manager initialized")
            except Exception as e:
                print(f"⚠️ Audio Manager init failed: {e}")
                self.audio_manager = None
        else:
            print("⚠️ OPENAI_KEY not set, audio disabled")
            self.audio_manager = None
        
        # [GPIO] Initialize GPIO Controller
        if GPIO_AVAILABLE:
            try:
                self.gpio_controller = GPIOController(
                    confirm_pin=17,  # GPIO 17 (Pin 11)
                    left_pin=19,    # GPIO 19
                    right_pin=26    # GPIO 26
                )
                # Connect GPIO signals to handlers
                self.gpio_controller.confirm_pressed.connect(self.on_gpio_confirm)
                self.gpio_controller.left_pressed.connect(self.on_gpio_left)
                self.gpio_controller.right_pressed.connect(self.on_gpio_right)
                self.gpio_controller.encoder_rotated_cw.connect(self.on_encoder_cw)
                self.gpio_controller.encoder_rotated_ccw.connect(self.on_encoder_ccw)
            except Exception as e:
                print(f"⚠️ GPIO Controller init failed: {e}")
                self.gpio_controller = None
        else:
            self.gpio_controller = None
        
        # [Gyro] Initialize Gyroscope Controller
        if GYRO_AVAILABLE:
            try:
                self.gyro_controller = GyroController(
                    address=0x68,
                    sensitivity=8.0,
                    dead_zone=0.15,
                    poll_ms=50
                )
                self.gyro_controller.pan_update.connect(self.on_gyro_pan)
                self.gyro_controller.set_active(False)  # Only active in REVEAL
            except Exception as e:
                print(f"⚠️ Gyro Controller init failed: {e}")
                self.gyro_controller = None
        else:
            self.gyro_controller = None
        
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
        api_host = os.environ.get('API_HOST', '10.130.205.184')
        api_url = f"http://{api_host}:3000/api/config"
        print(f"🌐 Config API: {api_url}")
        
        self.config_manager = ConfigManager(api_url=api_url)
        self.config_manager.config_updated.connect(self.on_config_update)
        self.config_manager.start()
        
        # 定时器
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.update_frame)
        self.timer.start(33)

    def _recalculate_circle_size(self):
        """根據目前視窗大小，重新計算圓形尺寸（等比例填滿螢幕 95%）"""
        w = self.width()
        h = self.height()
        if w > 0 and h > 0:
            shorter_side = min(w, h)
            self.circle_diameter = int(shorter_side * 0.95)
            self.circle_radius = self.circle_diameter // 2
            print(f"🔵 Circle resized: diameter={self.circle_diameter}px (screen {w}x{h})")

    def resizeEvent(self, event):
        """視窗大小改變時重新計算圓形尺寸"""
        super().resizeEvent(event)
        self._recalculate_circle_size()

    def showEvent(self, event):
        """視窗顯示時重新計算圓形尺寸（全螢幕後觸發）"""
        super().showEvent(event)
        self._recalculate_circle_size()
    
    def on_config_update(self, new_config):
        """Web 端的設定更新了，重新繪製 UI"""
        self.update()
    
    def mousePressEvent(self, event):
        """处理点击事件 (Aligned with Web App Flow)"""
        
        # 1. BOOT -> PROXIMITY -> LOCKED
        if self.current_state in [self.STATE_BOOT, self.STATE_PROXIMITY]:
            # Record interaction start when entering PROXIMITY
            if self.current_state == self.STATE_BOOT:
                import time as _time
                self.interaction_start_time = _time.time()
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
            
            # No matching area, ignore click
            return

        # 5. ANALYZING (分析中禁止手動點擊切換)
        if self.current_state == self.STATE_ANALYZING:
            return

        # 6. LISTEN (閱讀劇本) -> 翻頁或跳到 FOCUSING
        if self.current_state == self.STATE_LISTEN:
            # Check if there are more pages
            script = self.analysis_result.get("scriptPrompt", "")
            pages = self.split_text_into_pages(script, max_chars=55)
            
            if self.script_page < len(pages) - 1:
                # Next page
                self.script_page += 1
                print(f"📄 翻頁: {self.script_page + 1}/{len(pages)}")
                self.update()
            else:
                # Last page, transition to FOCUSING
                # Stop both TTS and ambience before leaving LISTEN state
                if hasattr(self, 'audio_manager') and self.audio_manager:
                    self.audio_manager.stop_all()
                
                self.current_state = self.STATE_FOCUSING
                self.focus_percentage = 0  # Reset focus
                print("👁️ 進入 FOCUSING 模式")
            return

        # 7. FOCUSING (對焦) -> 跳轉到 REVEAL
        if self.current_state == self.STATE_FOCUSING:
            self.current_state = self.STATE_REVEAL
            if hasattr(self, 'gyro_controller') and self.gyro_controller:
                self.gyro_controller.set_active(True)
            print("✨ 進入 REVEAL 模式 (結果展示)")
            return
        
        # 8. REVEAL (結果展示) -> 返回 BOOT (重新開始)
        if self.current_state == self.STATE_REVEAL:
            if hasattr(self, 'gyro_controller') and self.gyro_controller:
                self.gyro_controller.set_active(False)
            # 清理狀態，重新初始化
            self.current_state = self.STATE_BOOT
            self.captured_pixmap = None
            self.generated_pixmap = None
            self.analysis_result = {}
            self.pan_offset_x = 0
            self.pan_offset_y = 0
            print(f"🔄 返回初始狀態 (場次: {self.session_id})")
            self.update()
            return
    
    # ========== GPIO Button Handlers ==========
    
    def on_gpio_confirm(self):
        """Handle GPIO confirm button press - state-aware confirmation"""
        print("🔘 GPIO: Confirm button")
        
        # Ignore during ANALYZING state
        if self.current_state == self.STATE_ANALYZING:
            print("⚠️ Ignoring confirm during analysis")
            return
        
        # Special handling for TUNING state - directly start analysis
        if self.current_state == self.STATE_TUNING:
            print("✅ GPIO: Confirming parameters")
            self.start_analysis()
            return
        
        # For other states, simulate mouse click at center
        from PyQt5.QtCore import QEvent, QPoint
        from PyQt5.QtGui import QMouseEvent
        
        event = QMouseEvent(
            QEvent.MouseButtonPress,
            QPoint(self.width() // 2, self.height() // 2),
            Qt.LeftButton,
            Qt.LeftButton,
            Qt.NoModifier
        )
        self.mousePressEvent(event)
    
    def on_gpio_left(self):
        """Handle GPIO left button - switch param in TUNING or prev page in LISTEN"""
        print("⬅️ GPIO: Left button")
        
        # In TUNING state: select previous parameter
        if self.current_state == self.STATE_TUNING:
            self.tuning_selected_param = 0  # Select time_scale
            print(f"🔘 Selected: 時間軸 (time_scale)")
            self.update()
            return
        
        # In LISTEN state: previous page
        if self.current_state == self.STATE_LISTEN:
            if self.script_page > 0:
                self.script_page -= 1
                print(f"📄 上一頁: {self.script_page + 1}")
                self.update()
    
    def on_gpio_right(self):
        """Handle GPIO right button - switch param in TUNING or next page in LISTEN"""
        print("➡️ GPIO: Right button")
        
        # In TUNING state: select next parameter
        if self.current_state == self.STATE_TUNING:
            self.tuning_selected_param = 1  # Select history_scale
            print(f"🔘 Selected: 史實度 (history_scale)")
            self.update()
            return
        
        # In LISTEN state: next page
        if self.current_state == self.STATE_LISTEN:
            script = self.analysis_result.get("scriptPrompt", "")
            pages = self.split_text_into_pages(script, max_chars=55)
            if self.script_page < len(pages) - 1:
                self.script_page += 1
                print(f"📄 下一頁: {self.script_page + 1}/{len(pages)}")
                self.update()
    
    def on_encoder_cw(self):
        """Handle rotary encoder clockwise rotation"""
        print("🔄 GPIO: Encoder CW")
        
        # In TUNING state: increase selected parameter
        if self.current_state == self.STATE_TUNING:
            if self.tuning_selected_param == 0:
                if self.time_scale < 5:
                    self.time_scale += 1
                    print(f"⬆️ Time Scale: {self.time_scale}/5")
                    self.update()
            else:
                if self.history_scale < 3:
                    self.history_scale += 1
                    print(f"⬆️ History Scale: {self.history_scale}/3")
                    self.update()
        
        # In FOCUSING state: increase focus percentage
        elif self.current_state == self.STATE_FOCUSING:
            if self.focus_percentage < 100:
                self.focus_percentage = min(100, self.focus_percentage + 5)
                print(f"🔍 Focus: {self.focus_percentage}%")
                self.update()
                
                # Auto-transition to REVEAL when reaching 100%
                if self.focus_percentage >= 100:
                    self.current_state = self.STATE_REVEAL
                    if hasattr(self, 'gyro_controller') and self.gyro_controller:
                        self.gyro_controller.set_active(True)
                    print("✨ 進入 REVEAL 模式 (結果展示)")
    
    def on_encoder_ccw(self):
        """Handle rotary encoder counter-clockwise rotation"""
        print("🔄 GPIO: Encoder CCW")
        
        # In TUNING state: decrease selected parameter
        if self.current_state == self.STATE_TUNING:
            if self.tuning_selected_param == 0:
                if self.time_scale > 1:
                    self.time_scale -= 1
                    print(f"⬇️ Time Scale: {self.time_scale}/5")
                    self.update()
            else:
                if self.history_scale > 1:
                    self.history_scale -= 1
                    print(f"⬇️ History Scale: {self.history_scale}/3")
                    self.update()
        
        # In FOCUSING state: decrease focus percentage
        elif self.current_state == self.STATE_FOCUSING:
            if self.focus_percentage > 0:
                self.focus_percentage = max(0, self.focus_percentage - 5)
                print(f"🔍 Focus: {self.focus_percentage}%")
                self.update()


    def on_gyro_pan(self, dx, dy):
        """Handle gyroscope pan update - move image in REVEAL state"""
        if self.current_state == self.STATE_REVEAL:
            self.pan_offset_x += dx
            self.pan_offset_y += dy
            
            # Clamp pan offset so image stays within circle
            # Image is scaled to 3.5x circle diameter, max pan = (3.5 - 1) * radius
            max_pan = self.circle_radius * 2.5  # (3.5 - 1.0) * radius
            self.pan_offset_x = max(-max_pan, min(max_pan, self.pan_offset_x))
            self.pan_offset_y = max(-max_pan, min(max_pan, self.pan_offset_y))
            
            self.update()

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
                
        # Reset to first page
        self.script_page = 0
        self.current_state = self.STATE_LISTEN
        self.interaction_count += 1
        
        # Record listen start time
        import time as _time
        self.listen_start_time = _time.time()
        
        # Calculate interaction duration
        duration_seconds = None
        if self.interaction_start_time:
            duration_seconds = round(_time.time() - self.interaction_start_time)
        
        # [Supabase] Log analysis result to database
        if SUPABASE_AVAILABLE:
            supabase_log_history(
                result=result,
                time_scale=self.time_scale,
                history_scale=self.history_scale,
                session_id=self.session_id,
                duration_seconds=duration_seconds,
                completed=True,
                interaction_count=self.interaction_count
            )
        
        # Play audio: ambience + TTS narration
        if self.audio_manager:
            # 1. Play background ambience (looping)
            ambience_category = result.get("ambienceCategory", "SOUND_QUIET")
            if ambience_category:
                print(f"🎵 Starting ambience: {ambience_category}")
                self.audio_manager.play_ambience(ambience_category)
            
            # 2. Play TTS narration (on top of ambience)
            if "scriptPrompt" in result:
                script_text = result["scriptPrompt"]
                if script_text:
                    print("🔊 Generating audio narration...")
                    success = self.audio_manager.generate_and_play_audio(script_text)
                    if not success:
                        print("❌ Audio generation failed, continuing without audio")

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

            # 180° rotation (for upside-down mounted screen)
            # Controlled by ROTATE_180 env variable: set to "0" to disable
            if os.environ.get('ROTATE_180', '1') != '0':
                painter.translate(self.width() / 2, self.height() / 2)
                painter.rotate(180)
                painter.translate(-self.width() / 2, -self.height() / 2)

            # 1. 繪製背景 (全黑)
            painter.fillRect(self.rect(), Qt.black)

            w = self.width()
            h = self.height()
            center_x = w // 2
            center_y = h // 2

            # 字體縮放比例 (原始設計基於 190px 半徑)
            fs = self.circle_radius / 190.0
            
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
            elif self.captured_pixmap and self.current_state in [self.STATE_ANALYZING, self.STATE_SUCCESS, self.STATE_FAIL, self.STATE_TUNING, self.STATE_FOCUSING]:
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

                    
            # (3) LISTEN state - solid black background for readability
            elif self.current_state == self.STATE_LISTEN:
                painter.fillRect(self.rect(), QColor(0, 0, 0, 255))

            # (4) 實時相機 (Live Camera)
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
                            
                            # [Camera Filter] Apply real-time filter from UI editor config
                            cam_filter = self.config_manager.get_theme_value("camera_filter", "none")
                            if cam_filter == "grayscale":
                                gray = np.mean(image, axis=2, keepdims=True).astype(np.uint8)
                                image = np.repeat(gray, 3, axis=2)
                            elif cam_filter == "sepia":
                                b = image[:, :, 0].astype(np.float32)
                                g = image[:, :, 1].astype(np.float32)
                                r = image[:, :, 2].astype(np.float32)
                                new_b = np.clip(b * 0.131 + g * 0.534 + r * 0.272, 0, 255)
                                new_g = np.clip(b * 0.168 + g * 0.686 + r * 0.349, 0, 255)
                                new_r = np.clip(b * 0.189 + g * 0.769 + r * 0.393, 0, 255)
                                image = np.stack([new_b, new_g, new_r], axis=2).astype(np.uint8)
                            elif cam_filter == "contrast":
                                image = np.clip((image.astype(np.float32) - 128) * 1.5 + 128, 0, 255).astype(np.uint8)

                            # [Phase 2 Fix] 修正顏色對調問題 (BGR -> RGB)
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
            
            # [Phase 4.3] Global HUD — skin-aware
            skin = self.config_manager.get_theme_value("layout_mode", "classic")
            if skin == "industrial":
                self.draw_industrial_hud(painter, center_x, center_y, fs)
            else:
                self.draw_global_hud(painter, center_x, center_y, fs)

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
                
                # 1. Main Text: "正在探測歷史訊號"
                painter.setPen(text_color)
                painter.setFont(QFont("Arial", int(25 * fs), QFont.Bold))
                text_rect_1 = QRect(0, int(center_y - 53 * fs), w, int(50 * fs))
                txt_main = self.config_manager.get_text("bootText", "正在探測歷史訊號")
                painter.drawText(text_rect_1, Qt.AlignCenter, txt_main)

                # 2. Sub Text: "尋找中..."
                painter.setPen(text_color)
                painter.setFont(QFont("Arial", int(11 * fs), QFont.Bold))
                text_rect_2 = QRect(0, int(center_y + 7 * fs), w, int(30 * fs))
                txt_sub = self.config_manager.get_text("bootSubtext", "尋找中...")
                painter.drawText(text_rect_2, Qt.AlignCenter, txt_sub)

                # 3. Hint Text: "請在展區中隨意走動" (opacity 0.6)
                painter.save()
                painter.setPen(text_color)
                painter.setOpacity(0.6)
                painter.setFont(QFont("Arial", int(8 * fs)))
                text_rect_3 = QRect(0, int(center_y + 47 * fs), w, int(20 * fs))
                txt_hint = self.config_manager.get_text("bootHint", "請在展區中隨意走動")
                painter.drawText(text_rect_3, Qt.AlignCenter, txt_hint)
                painter.restore()

            # [Phase 4.4] STATE_PROXIMITY UI (Pulsing Ring + Text)
            if self.current_state == self.STATE_PROXIMITY:
                self.draw_proximity_state(painter, center_x, center_y, fs)
                
            # [Phase 4.4] STATE_LOCKED UI
            if self.current_state == self.STATE_LOCKED:
                if skin == "industrial":
                    self.draw_industrial_locked(painter, center_x, center_y, fs)
                else:
                    self.draw_locked_state(painter, center_x, center_y, fs)
            
            # [Phase 5A] STATE_ANALYZING UI (Dotted Circle Animation)
            if self.current_state == self.STATE_ANALYZING:
                self.draw_analyzing_state(painter, center_x, center_y, fs)
            
            # [Phase 5B] STATE_FOCUSING UI (3 Concentric Blinking Circles)
            if self.current_state == self.STATE_FOCUSING:
                self.draw_focusing_state(painter, center_x, center_y, fs)

            # [Phase 6] STATE_LISTEN UI — always classic layout
            if self.current_state == self.STATE_LISTEN:
                self.draw_listen_state(painter, center_x, center_y, fs)
            
            # --- End of Circular Clipping ---
            painter.setClipping(False)  # Remove clipping for overlay UI
            
            # [Phase 6] LISTEN Bottom Overlay (Outside Circular Clip)
            if self.current_state == self.STATE_LISTEN:
                # Bottom Black Overlay (opacity 20%)
                painter.setPen(Qt.NoPen)
                painter.setBrush(QColor(0, 0, 0, 51))  # 51 = 20% of 255
                bottom_overlay_rect = QRect(0, h - 100, w, 100)
                painter.fillRect(bottom_overlay_rect, QColor(0, 0, 0, 51))
                
                # Bottom hint text removed — dots inside circle are sufficient
            
            # [Phase 5A] STATE_TUNING UI — skin-aware
            if self.current_state == self.STATE_TUNING:
                if skin == "industrial":
                    self.draw_industrial_tuning(painter, center_x, center_y, fs)
                else:
                    primary_hex = self.config_manager.get_color("primary_color", "#ffffff")
                    theme_color = QColor(primary_hex)
                    selected = self.tuning_selected_param
                    painter.fillRect(self.rect(), QColor(0, 0, 0, 153))
                    cx_tuning = center_x
                    cy_tuning = center_y
                    painter.save()
                    painter.setRenderHint(QPainter.Antialiasing)
                    outer_r = int(130 * fs)
                    outer_alpha = 204 if selected == 0 else 50
                    base_border = QColor(theme_color); base_border.setAlpha(51)
                    painter.setPen(QPen(base_border, 1)); painter.setBrush(Qt.NoBrush)
                    painter.drawEllipse(cx_tuning - outer_r, cy_tuning - outer_r, outer_r * 2, outer_r * 2)
                    fill_angle = self.time_scale * 72
                    if fill_angle > 0:
                        fill_color = QColor(theme_color); fill_color.setAlpha(outer_alpha)
                        pen = QPen(fill_color, int(30 * fs)); pen.setCapStyle(Qt.FlatCap)
                        painter.setPen(pen); painter.setBrush(Qt.NoBrush)
                        painter.drawArc(cx_tuning - outer_r, cy_tuning - outer_r, outer_r * 2, outer_r * 2, 90 * 16, -fill_angle * 16)
                    inner_r = int(100 * fs)
                    inner_alpha = 128 if selected == 1 else 30
                    inner_border = QColor(theme_color); inner_border.setAlpha(51)
                    painter.setPen(QPen(inner_border, 1)); painter.setBrush(Qt.NoBrush)
                    painter.drawEllipse(cx_tuning - inner_r, cy_tuning - inner_r, inner_r * 2, inner_r * 2)
                    inner_fill_angle = self.history_scale * 120
                    if inner_fill_angle > 0:
                        inner_fill_color = QColor(theme_color); inner_fill_color.setAlpha(inner_alpha)
                        pen_inner = QPen(inner_fill_color, int(30 * fs)); pen_inner.setCapStyle(Qt.FlatCap)
                        painter.setPen(pen_inner); painter.setBrush(Qt.NoBrush)
                        painter.drawArc(cx_tuning - inner_r, cy_tuning - inner_r, inner_r * 2, inner_r * 2, 90 * 16, -inner_fill_angle * 16)
                    painter.restore()
                    painter.save()
                    painter.setRenderHint(QPainter.TextAntialiasing)
                    hl = int(50 * fs); lh = int(15 * fs); vh = int(25 * fs)
                    time_text_alpha = 255 if selected == 0 else 80
                    txt_outer_label = self.config_manager.get_text("tuningRingOuter", "時間軸")
                    painter.setPen(QColor(255, 255, 255, 153 if selected == 0 else 50))
                    painter.setFont(QFont("Arial", int(8 * fs)))
                    painter.drawText(QRect(cx_tuning - hl, int(cy_tuning - 40 * fs), hl * 2, lh), Qt.AlignCenter, txt_outer_label)
                    painter.setPen(QColor(255, 255, 255, time_text_alpha))
                    painter.setFont(QFont("Arial", int(20 * fs), QFont.Bold))
                    painter.drawText(QRect(cx_tuning - hl, int(cy_tuning - 22 * fs), hl * 2, vh), Qt.AlignCenter, f"L-0{self.time_scale}")
                    if selected == 0:
                        painter.setPen(QColor(255, 255, 255, 200))
                        painter.setFont(QFont("Arial", int(12 * fs)))
                        painter.drawText(QRect(int(cx_tuning - 80 * fs), int(cy_tuning - 22 * fs), int(25 * fs), vh), Qt.AlignCenter, "◀")
                    painter.setPen(QPen(QColor(255, 255, 255, 51), 1))
                    painter.drawLine(int(cx_tuning - 40 * fs), int(cy_tuning + 5 * fs), int(cx_tuning + 40 * fs), int(cy_tuning + 5 * fs))
                    hist_text_alpha = 255 if selected == 1 else 80
                    txt_inner_label = self.config_manager.get_text("tuningRingInner", "史實度")
                    painter.setPen(QColor(255, 255, 255, 153 if selected == 1 else 50))
                    painter.setFont(QFont("Arial", int(8 * fs)))
                    painter.drawText(QRect(cx_tuning - hl, int(cy_tuning + 10 * fs), hl * 2, lh), Qt.AlignCenter, txt_inner_label)
                    history_labels = {1: "低度", 2: "中度", 3: "高度"}
                    painter.setPen(QColor(255, 255, 255, hist_text_alpha))
                    painter.setFont(QFont("Arial", int(18 * fs), QFont.Bold))
                    painter.drawText(QRect(cx_tuning - hl, int(cy_tuning + 23 * fs), hl * 2, vh), Qt.AlignCenter, history_labels.get(self.history_scale, "低度"))
                    if selected == 1:
                        painter.setPen(QColor(255, 255, 255, 200))
                        painter.setFont(QFont("Arial", int(12 * fs)))
                        painter.drawText(QRect(int(cx_tuning + 55 * fs), int(cy_tuning + 23 * fs), int(25 * fs), vh), Qt.AlignCenter, "▶")
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
            
            # REVEAL state: no bottom title shown (image speaks for itself)
            # ANALYZING state: no bottom text
            if self.current_state == self.STATE_SUCCESS:
                painter.setPen(QColor(255, 255, 255))  # fixed white
                painter.setFont(QFont("Arial", int(10 * fs)))
                painter.drawText(QRect(0, int(h - 80 * fs), w, int(50 * fs)), Qt.AlignCenter, "點擊畫面查看")
            
            # Corner debug labels hidden
            # painter.drawText(10, 20, "[Phase 1 Verified]")
            # painter.drawText(10, h - 20, f"State: {state_text}")
            
        except Exception as e:
            print("❌ paintEvent 發生嚴重錯誤:")
            traceback.print_exc()

    def draw_proximity_state(self, painter, cx, cy, fs=1.0):
        """
        [Phase 4.4] 繪製 PROXIMITY 狀態 UI
        """
        painter.save()
        
        import time
        t = (time.time() * 1000) % 3000
        opacity = 0.1
        if t < 1000:
            opacity = 0.1 + (t / 1000.0) * 0.4
        elif t < 2000:
            opacity = 0.5 + ((t - 1000) / 1000.0) * 0.5
        else:
            opacity = 1.0 - ((t - 2000) / 1000.0) * 0.9
            
        primary_hex = self.config_manager.get_color("primary_color", "#ffffff")
        skin = self.config_manager.get_theme_value("layout_mode", "classic")

        if skin != "industrial":
            # 1. Pulsing Ring
            ring_r = int(90 * fs)
            ring_color = QColor(primary_hex); ring_color.setAlphaF(opacity)
            painter.setPen(QPen(ring_color, 1)); painter.setBrush(Qt.NoBrush)
            painter.drawEllipse(cx - ring_r, cy - ring_r, ring_r * 2, ring_r * 2)
            # 2. Center BG circle
            bg_radius = int(70 * fs)
            painter.setPen(QPen(QColor(255, 255, 255, 25), 1))
            painter.setBrush(QColor(0, 0, 0, 204))
            painter.drawEllipse(cx - bg_radius, cy - bg_radius, bg_radius * 2, bg_radius * 2)
        
        # Text 1: title — follow primary_color
        primary_color_obj = QColor(primary_hex)
        painter.setPen(primary_color_obj)
        painter.setFont(QFont("Arial", int(18 * fs), QFont.Bold))
        text_rect_1 = QRect(0, int(cy - 35 * fs), self.width(), int(35 * fs))
        txt_prox_title = self.config_manager.get_text("proximityTitle", "訊號偵測")
        painter.drawText(text_rect_1, Qt.AlignCenter, txt_prox_title)
        
        # Separator Line
        sep_color = QColor(primary_hex)
        sep_color.setAlpha(128)
        painter.setPen(QPen(sep_color, 1))
        painter.drawLine(int(cx - 50 * fs), int(cy + 5 * fs), int(cx + 50 * fs), int(cy + 5 * fs))
        
        # Text 2: subtext — follow primary_color
        painter.setFont(QFont("Arial", int(10 * fs), QFont.Bold))
        txt_prox_sub = self.config_manager.get_text("proximitySubtext", "接近目標中")
        sub_color = QColor(primary_hex)
        sub_color.setAlpha(200)
        painter.setPen(sub_color)
        text_rect_2 = QRect(0, int(cy + 12 * fs), self.width(), int(20 * fs))
        painter.drawText(text_rect_2, Qt.AlignCenter, txt_prox_sub)
        
        # Distance indicator removed

        painter.restore()

    def draw_locked_state(self, painter, cx, cy, fs=1.0):
        """
        [Phase 4.4] 繪製 LOCKED 狀態 UI
        """
        painter.save()
        
        import time
        t = time.time() % 3
        if t < 1:
            opacity = 0.1
        elif t < 2:
            opacity = 0.5
        else:
            opacity = 1.0
            
        primary_hex = self.config_manager.get_color("primary_color", "#ffffff")
        ring_color = QColor(primary_hex)
        ring_color.setAlphaF(opacity)
        
        # Arc segments (radius scales with circle)
        r = int(100 * fs)
        painter.setPen(QPen(ring_color, 2))
        painter.setBrush(Qt.NoBrush)
        span_angle = 60 * 16
        painter.drawArc(cx - r, cy - r, r * 2, r * 2, 60 * 16, span_angle)
        painter.drawArc(cx - r, cy - r, r * 2, r * 2, 240 * 16, span_angle)
        painter.drawArc(cx - r, cy - r, r * 2, r * 2, 150 * 16, span_angle)
        painter.drawArc(cx - r, cy - r, r * 2, r * 2, -30 * 16, span_angle)
        
        # Center dot
        dot_color = QColor(primary_hex)
        painter.setPen(Qt.NoPen)
        painter.setBrush(dot_color)
        painter.drawEllipse(cx - 1, cy - 1, 2, 2)
        
        # Title text — follow primary_color
        txt_locked = self.config_manager.get_text("lockedTitle", "鎖定目標")
        painter.setFont(QFont("Arial", int(18 * fs), QFont.Bold))
        painter.setPen(QColor(primary_hex))
        painter.drawText(QRect(0, int(cy - 45 * fs), self.width(), int(30 * fs)), Qt.AlignCenter, txt_locked)
        
        # Bottom subtext — fixed white
        painter.setFont(QFont("Arial", int(10 * fs)))
        painter.setPen(QColor(255, 255, 255, 200))
        painter.drawText(QRect(0, int(cy + 30 * fs), self.width(), int(30 * fs)), Qt.AlignCenter,
                         self.config_manager.get_text("lockedSubtext", "[ 按下快門捕捉 ]"))
        
        painter.restore()

    def draw_global_hud(self, painter, cx, cy, fs=1.0):
        """
        [Phase 4.3] 繪製全域 HUD 裝飾 (外圈圓環 + 刻度)
        """
        painter.save()
        painter.setRenderHint(QPainter.Antialiasing)
        
        primary_hex = self.config_manager.get_color("primary_color", "#ffffff")
        base_color = QColor(primary_hex)
        
        ring_color = QColor(base_color)
        ring_color.setAlpha(204)
        
        if self.current_state == self.STATE_REVEAL:
            ring_color = QColor(255, 255, 255, 255)
            
        painter.setPen(QPen(ring_color, 1))
        painter.setBrush(Qt.NoBrush)
        # Outer decoration ring: 185/190 of circle_radius
        outer_r = int(self.circle_radius * 0.97)
        painter.drawEllipse(cx - outer_r, cy - outer_r, outer_r * 2, outer_r * 2)
        
        # Tick marks
        tick_color = QColor(base_color)
        tick_color.setAlpha(204)
        
        radius = outer_r
        for i in range(12):
            angle_deg = (i * 30) - 90
            angle_rad = math.radians(angle_deg)
            
            is_cardinal = (i % 3 == 0)
            tick_len = int(12 * fs) if is_cardinal else int(8 * fs)
            tick_width = 2 if is_cardinal else 1
            
            p1_x = cx + radius * math.cos(angle_rad)
            p1_y = cy + radius * math.sin(angle_rad)
            p2_x = cx + (radius - tick_len) * math.cos(angle_rad)
            p2_y = cy + (radius - tick_len) * math.sin(angle_rad)
            
            painter.setPen(QPen(tick_color, tick_width))
            painter.drawLine(int(p1_x), int(p1_y), int(p2_x), int(p2_y))
            
        # Top Label "A.InSight" — always white regardless of theme
        title_text = self.config_manager.get_text("title", "A.InSight")
        title_color = QColor(255, 255, 255, 200)  # Fixed white
        painter.setPen(title_color)
        painter.setFont(QFont("Arial", int(9 * fs)))
        text_y = int(cy - self.circle_radius * 0.97 + 28 * fs)
        painter.drawText(QRect(0, text_y, self.width(), int(20 * fs)), Qt.AlignCenter, title_text)

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
    
    
    def wheelEvent(self, event):
        """[Phase 5B] Mouse wheel event for FOCUSING state"""
        if self.current_state == self.STATE_FOCUSING:
            delta = event.angleDelta().y()
            if delta > 0:
                self.focus_percentage = min(100, self.focus_percentage + 5)
            else:
                self.focus_percentage = max(0, self.focus_percentage - 5)
            self.update()
            if self.focus_percentage >= 100:
                print("✅ Focus complete! Transitioning to LISTEN state.")
                QTimer.singleShot(500, lambda: self.transition_to_listen())
    
    def transition_to_listen(self):
        """Helper to transition from FOCUSING to REVEAL state"""
        if self.focus_percentage >= 100:
            self.current_state = self.STATE_REVEAL
            # Reset pan so image starts centered
            self.pan_offset_x = 0
            self.pan_offset_y = 0
            # Activate gyroscope for panning
            if hasattr(self, 'gyro_controller') and self.gyro_controller:
                self.gyro_controller.set_active(True)
            print("✨ 對焦完成！進入 REVEAL 狀態")
            self.update()
    
    def draw_analyzing_state(self, painter, cx, cy, fs=1.0):
        """[Phase 5A] ANALYZING state with dotted circle animation"""
        painter.save()
        painter.setRenderHint(QPainter.Antialiasing)
        
        painter.fillRect(self.rect(), QColor(0, 0, 0, 204))
        primary_hex = self.config_manager.get_color("primary_color", "#ffffff")
        theme_color = QColor(primary_hex)
        outer_border = QColor(theme_color)
        outer_border.setAlpha(26)
        painter.setPen(QPen(outer_border, 1))
        painter.setBrush(Qt.NoBrush)
        outer_r = int(140 * fs)
        painter.drawEllipse(cx - outer_r, cy - outer_r, outer_r * 2, outer_r * 2)
        import time
        t = time.time() % 2
        opacity = 0.2 if t < 0.67 else (0.6 if t < 1.33 else 1.0)
        dotted_color = QColor(theme_color)
        dotted_color.setAlphaF(opacity)
        dotted_pen = QPen(dotted_color, 2)
        dotted_pen.setDashPattern([3, 6])
        painter.setPen(dotted_pen)
        painter.setBrush(Qt.NoBrush)
        dot_r = int(100 * fs)
        painter.drawEllipse(cx - dot_r, cy - dot_r, dot_r * 2, dot_r * 2)
        painter.setPen(Qt.white)
        txt_title = self.config_manager.get_text("analyzingTitle", "解析中")
        painter.setFont(QFont("Arial", int(14 * fs), QFont.Bold))
        painter.drawText(QRect(cx - int(60 * fs), int(cy - 20 * fs), int(120 * fs), int(20 * fs)), Qt.AlignCenter, txt_title)
        txt_analysis = self.config_manager.get_text("analyzingText", "正在分析歷史資料")
        label_color = QColor(255, 255, 255, 179)
        painter.setPen(label_color)
        painter.setFont(QFont("Arial", int(9 * fs)))
        painter.drawText(QRect(cx - int(80 * fs), int(cy + 5 * fs), int(160 * fs), int(20 * fs)), Qt.AlignCenter, txt_analysis)
        painter.restore()

    def draw_focusing_state(self, painter, cx, cy, fs=1.0):
        """[Phase 5B] FOCUSING state with 3 concentric blinking circles and result image"""
        painter.save()
        painter.setRenderHint(QPainter.Antialiasing)
        
        primary_hex = self.config_manager.get_color("primary_color", "#ffffff")
        theme_color = QColor(primary_hex)
        
        # 1. Draw Result Image with progressive blur (scales with circle)
        if self.generated_pixmap:
            painter.save()
            clip_path = QPainterPath()
            clip_path.addEllipse(cx - self.circle_radius, cy - self.circle_radius,
                                 self.circle_radius * 2, self.circle_radius * 2)
            painter.setClipPath(clip_path)
            opacity = self.focus_percentage / 100.0
            painter.setOpacity(0.3 + (opacity * 0.7))
            d = self.circle_radius * 2
            scaled_pixmap = self.generated_pixmap.scaled(
                d, d, Qt.KeepAspectRatioByExpanding, Qt.SmoothTransformation
            )
            offset_x = (scaled_pixmap.width() - d) // 2
            offset_y = (scaled_pixmap.height() - d) // 2
            painter.drawPixmap(cx - self.circle_radius, cy - self.circle_radius,
                               scaled_pixmap, offset_x, offset_y, d, d)
            painter.restore()
        
        # 2. Outer Circle Border
        outer_r = int(140 * fs)
        outer_border = QColor(theme_color)
        outer_border.setAlpha(51)
        painter.setPen(QPen(outer_border, 1))
        painter.setBrush(Qt.NoBrush)
        painter.drawEllipse(cx - outer_r, cy - outer_r, outer_r * 2, outer_r * 2)
        
        import time
        t = time.time() % 3
        radii = [int(120 * fs), int(90 * fs), int(60 * fs)]
        for i, r in enumerate(radii):
            opacity = 0.8 if int(t) == i else 0.2
            circle_color = QColor(theme_color)
            circle_color.setAlpha(int(opacity * 255))
            painter.setPen(QPen(circle_color, 2))
            painter.setBrush(Qt.NoBrush)
            painter.drawEllipse(cx - r, cy - r, r * 2, r * 2)
        
        center_r = int(50 * fs)
        center_bg = QColor(0, 0, 0, 230)
        painter.setBrush(center_bg)
        painter.setPen(QPen(theme_color, 1))
        painter.drawEllipse(cx - center_r, cy - center_r, center_r * 2, center_r * 2)
        txt_title = self.config_manager.get_text("focusingTitle", "對焦")
        painter.setPen(Qt.white)
        painter.setFont(QFont("Arial", int(12 * fs), QFont.Bold))
        painter.drawText(QRect(cx - center_r, int(cy - 15 * fs), center_r * 2, int(20 * fs)), Qt.AlignCenter, txt_title)
        painter.setFont(QFont("Arial", int(16 * fs), QFont.Bold))
        focus_text = f"{self.focus_percentage}%"
        painter.drawText(QRect(cx - 40, cy + 5, 80, 20), Qt.AlignCenter, focus_text)
        txt_hint = self.config_manager.get_text("focusingHint", "[ 旋轉對焦 ]")
        label_color = QColor(255, 255, 255, 153)
        painter.setPen(label_color)
        painter.setFont(QFont("Arial", 9))
        painter.drawText(QRect(cx - 80, cy + 160, 160, 20), Qt.AlignCenter, txt_hint)
        painter.restore()

    def draw_listen_state(self, painter, cx, cy, fs=1.0):
        """
        [Phase 6] LISTEN state UI matching Web format
        """
        painter.save()
        painter.setRenderHint(QPainter.Antialiasing)
        
        # Data from analysis result
        name = self.analysis_result.get("name", "Unknown")
        script = self.analysis_result.get("scriptPrompt", "No description available.")
        
        # Split script into pages (55 chars per page, matching Web)
        pages = self.split_text_into_pages(script, max_chars=55)
        current_page = pages[self.script_page] if self.script_page < len(pages) else "..."
        
        # 1. Top Divider (Rounded Rect) - Hidden/Optional
        # Since title is now inside circle, divider may not be needed
        # Commenting out for cleaner look
        # painter.setPen(Qt.NoPen)
        # painter.setBrush(QColor(255, 255, 255, 51))
        # top_bar_rect = QRect(cx - 64, 48, 128, 4)
        # painter.drawRoundedRect(top_bar_rect, 2, 2)
        
        # 2. Artifact Name (Inside Circle)
        # User requested: Move down one line and add underline
        painter.setPen(Qt.white)
        font_name = QFont("Arial", int(18 * fs), QFont.Bold)
        painter.setFont(font_name)
        
        fm = QFontMetrics(font_name)
        name_width = fm.horizontalAdvance(name)
        text_height = fm.height()
        
        # Position inside circle: 68% up from center (scales with circle size)
        name_offset = int(self.circle_radius * 0.68)
        text_y = cy - name_offset
        half_w = int(self.circle_radius * 0.68)
        rect_name = QRect(cx - half_w, text_y, half_w * 2, text_height)
        painter.drawText(rect_name, Qt.AlignHCenter | Qt.AlignTop, name)
        
        # Add underline
        underline_y = text_y + text_height + 2
        underline_start_x = cx - (name_width // 2)
        underline_width = name_width
        painter.setPen(QPen(Qt.white, 1))
        painter.drawLine(underline_start_x, underline_y, underline_start_x + underline_width, underline_y)
        
        # 3. Script Text (Center) - width scales with circle
        script_half_w = int(self.circle_radius * 0.68)
        script_h = int(self.circle_radius * 1.05)
        rect_script = QRect(cx - script_half_w, cy - script_h // 2, script_half_w * 2, script_h)
        painter.setPen(QColor(255, 255, 255, 230))
        font_script = QFont("Arial", int(14 * fs))
        painter.setFont(font_script)
        
        # Draw with word wrap
        painter.drawText(rect_script, Qt.AlignCenter | Qt.TextWordWrap, current_page)
        
        # 4. Dot pagination (like web version)
        n_pages = len(pages)
        if n_pages > 1:
            primary_hex = self.config_manager.get_color("primary_color", "#ffffff")
            dot_r = int(5 * fs)
            dot_gap = int(14 * fs)
            total_dot_w = n_pages * dot_r * 2 + (n_pages - 1) * (dot_gap - dot_r * 2)
            dot_start_x = cx - total_dot_w // 2
            dot_y = cy + int(self.circle_radius * 0.72)
            for i in range(n_pages):
                dot_x = dot_start_x + i * dot_gap
                if i == self.script_page:
                    # Active dot: filled white
                    painter.setPen(Qt.NoPen)
                    painter.setBrush(QColor(255, 255, 255, 230))
                else:
                    # Inactive dot: primary_color at 35% opacity
                    inactive = QColor(primary_hex)
                    inactive.setAlpha(90)
                    painter.setPen(Qt.NoPen)
                    painter.setBrush(inactive)
                painter.drawEllipse(dot_x, dot_y - dot_r, dot_r * 2, dot_r * 2)
        
        painter.restore()

    # =========================================================================
    # INDUSTRIAL SKIN — Draw Functions
    # =========================================================================

    def draw_industrial_hud(self, painter, cx, cy, fs):
        """
        Industrial HUD: outer ring + tick marks (same as classic)
        + central Gemini four-petal star (background element)
        + 8 blinking mini-stars (4 corners + 4 cardinals)
        + top status bar (Activity icon + title)
        """
        import time
        import math
        primary_hex = self.config_manager.get_color("primary_color", "#00ff41")
        pc = QColor(primary_hex)

        # --- 1. Outer ring only (no ticks — replaced by blinking stars below) ---
        ring_color = QColor(pc)
        ring_color.setAlpha(204)
        painter.setPen(QPen(ring_color, 1))
        painter.setBrush(Qt.NoBrush)
        outer_r = int(self.circle_radius * 0.97)
        painter.drawEllipse(cx - outer_r, cy - outer_r, outer_r * 2, outer_r * 2)

        # --- 2. Central Gemini star background (20% opacity, hidden in SUCCESS/LISTEN/REVEAL) ---
        hide_star_states = [self.STATE_SUCCESS, self.STATE_LISTEN, self.STATE_REVEAL,
                            self.STATE_ANALYZING, self.STATE_FOCUSING]
        if self.current_state not in hide_star_states:
            star_size = int(self.circle_radius * 1.9)
            star_c = QColor(pc); star_c.setAlpha(51)  # 20%
            painter.setPen(Qt.NoPen)
            painter.setBrush(star_c)
            star_path = QPainterPath()
            s = star_size
            x0, y0 = cx - s // 2, cy - s // 2
            star_path.moveTo(x0 + s * 0.50, y0)
            star_path.cubicTo(x0 + s * 0.50, y0 + s * 0.25,
                              x0 + s * 0.25, y0 + s * 0.50,
                              x0,            y0 + s * 0.50)
            star_path.cubicTo(x0 + s * 0.25, y0 + s * 0.50,
                              x0 + s * 0.50, y0 + s * 0.75,
                              x0 + s * 0.50, y0 + s)
            star_path.cubicTo(x0 + s * 0.50, y0 + s * 0.75,
                              x0 + s * 0.75, y0 + s * 0.50,
                              x0 + s,        y0 + s * 0.50)
            star_path.cubicTo(x0 + s * 0.75, y0 + s * 0.50,
                              x0 + s * 0.50, y0 + s * 0.25,
                              x0 + s * 0.50, y0)
            painter.drawPath(star_path)

        # --- 3. 8 blinking mini-stars at 45° intervals (same diamond shape as background) ---
        t = time.time()
        r = self.circle_radius
        msz = int(8 * fs)  # mini-star size

        def draw_mini_gemini(mx, my, size, alpha):
            """Same 4-petal diamond path as the central Gemini star, scaled small."""
            c = QColor(pc); c.setAlpha(alpha)
            painter.setPen(Qt.NoPen); painter.setBrush(c)
            p = QPainterPath()
            # Draw centered at (mx, my)
            p.moveTo(mx,          my - size)
            p.cubicTo(mx,         my - size * 0.5,
                      mx - size * 0.5, my,
                      mx - size,  my)
            p.cubicTo(mx - size * 0.5, my,
                      mx,          my + size * 0.5,
                      mx,          my + size)
            p.cubicTo(mx,          my + size * 0.5,
                      mx + size * 0.5, my,
                      mx + size,   my)
            p.cubicTo(mx + size * 0.5, my,
                      mx,          my - size * 0.5,
                      mx,          my - size)
            painter.drawPath(p)

        def blink_alpha(offset):
            phase = (t + offset) % 3.0
            if phase < 1.0:   return int(0.1 * 255)
            elif phase < 2.0: return int(0.3 * 255)
            else:             return int(0.6 * 255)

        # 8 stars at 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°
        for i in range(8):
            angle_deg = i * 45  # 0, 45, 90 ... 315
            angle_rad = math.radians(angle_deg)
            sx = cx + outer_r * math.cos(angle_rad)
            sy = cy + outer_r * math.sin(angle_rad)
            draw_mini_gemini(int(sx), int(sy), msz, blink_alpha(i * (3.0 / 8.0)))


        # --- 4. Top status bar: ⚡ A.InSight ---
        title_text = self.config_manager.get_text("title", "A.InSight")
        bar_c = QColor(pc); bar_c.setAlpha(204)
        painter.setPen(bar_c)
        painter.setFont(QFont("Arial", int(9 * fs)))
        painter.drawText(QRect(0, int(cy - r + int(18 * fs)), self.width(), int(18 * fs)),
                         Qt.AlignCenter, f"⚡ {title_text}")

    def draw_industrial_locked(self, painter, cx, cy, fs):
        """
        Industrial LOCKED: just text — title + subtext, both centered, no box.
        """
        primary_hex = self.config_manager.get_color("primary_color", "#00ff41")
        pc = QColor(primary_hex)

        # Title: "鎖定目標" centered at cy - 12px (just above center)
        txt_locked = self.config_manager.get_text("lockedTitle", "鎖定目標")
        painter.save()
        painter.setPen(pc)
        painter.setFont(QFont("Arial", int(18 * fs), QFont.Bold))
        painter.drawText(QRect(0, int(cy - int(28 * fs)), self.width(), int(30 * fs)),
                         Qt.AlignCenter, txt_locked)

        # Subtext: "[ 按下快門捕捉 ]" just below title
        txt_sub = self.config_manager.get_text("lockedSubtext", "[ 按下快門捕捉 ]")
        painter.setPen(QColor(255, 255, 255, 200))
        painter.setFont(QFont("Arial", int(10 * fs)))
        painter.drawText(QRect(0, int(cy + int(8 * fs)), self.width(), int(22 * fs)),
                         Qt.AlignCenter, txt_sub)
        painter.restore()

    def draw_industrial_tuning(self, painter, cx, cy, fs):
        """
        Industrial TUNING: two vertical bar sliders (TIME / DATA) side by side.
        """
        primary_hex = self.config_manager.get_color("primary_color", "#00ff41")
        pc = QColor(primary_hex)

        # Black overlay
        painter.fillRect(self.rect(), QColor(0, 0, 0, 230))

        bar_w   = int(32 * fs)
        bar_h   = int(128 * fs)
        gap     = int(56 * fs)
        bar_y   = cy - bar_h // 2

        selected = self.tuning_selected_param  # 0=time, 1=history

        for idx, (label, value, max_v, display_segs, fmt) in enumerate([
            (self.config_manager.get_text("tuningRingOuter", "TIME"), self.time_scale, 5, 5,
             lambda v: f"0{v}" if v < 10 else str(v)),
            (self.config_manager.get_text("tuningRingInner", "DATA"), self.history_scale, 3, 3,
             lambda v: {1: "LO", 2: "MID", 3: "HI"}.get(v, "?")),
        ]):
            bar_x = cx + (idx * 2 - 1) * (gap // 2 + bar_w // 2)  # left or right of center
            fill_ratio = value / max_v

            # Fade inactive slider
            alpha_mul = 1.0 if idx == selected else 0.3

            # Border rect
            border_c = QColor(pc); border_c.setAlpha(int(80 * alpha_mul))
            painter.setPen(QPen(border_c, 1)); painter.setBrush(Qt.NoBrush)
            painter.drawRect(bar_x - bar_w // 2, bar_y, bar_w, bar_h)

            # Fill — segmented blocks (display_segs equal visual cells)
            seg_h = bar_h // display_segs
            gap_px = max(1, int(2 * fs))
            fill_c = QColor(pc); fill_c.setAlpha(int(153 * alpha_mul))  # 60%
            empty_c = QColor(pc); empty_c.setAlpha(int(20 * alpha_mul))  # dim
            filled_segs = round(value / max_v * display_segs)
            painter.setPen(Qt.NoPen)
            for seg in range(display_segs):
                seg_y = bar_y + bar_h - (seg + 1) * seg_h + gap_px // 2
                seg_rect_h = seg_h - gap_px
                if seg_rect_h < 1: seg_rect_h = 1
                painter.setBrush(fill_c if seg < filled_segs else empty_c)
                painter.drawRect(bar_x - bar_w // 2 + 1, seg_y, bar_w - 2, seg_rect_h)

            # Indicator line removed (segmented fills make it redundant)

            # Label above bar
            label_c = QColor(pc); label_c.setAlpha(int(180 * alpha_mul))
            painter.setPen(label_c)
            painter.setFont(QFont("Arial", int(8 * fs)))
            painter.drawText(QRect(bar_x - bar_w, bar_y - int(20 * fs), bar_w * 2, int(16 * fs)),
                             Qt.AlignCenter, label)

            # Value below bar
            val_c = QColor(pc); val_c.setAlpha(int(255 * alpha_mul))
            painter.setPen(val_c)
            painter.setFont(QFont("Courier New", int(20 * fs), QFont.Bold))
            painter.drawText(QRect(bar_x - bar_w, bar_y + bar_h + int(8 * fs), bar_w * 2, int(28 * fs)),
                             Qt.AlignCenter, fmt(value))

    def draw_industrial_listen(self, painter, cx, cy, fs):
        """
        Industrial LISTEN: same layout as Classic but with square pagination dots.
        """
        if not self.analysis_result:
            return
        painter.save()

        r = self.circle_radius
        w = self.width()
        primary_hex = self.config_manager.get_color("primary_color", "#ffffff")
        pc = QColor(primary_hex)

        # Black background
        painter.fillRect(self.rect(), QColor(0, 0, 0, 220))

        # Artifact name + underline
        artifact_name = self.analysis_result.get("name", "")
        painter.setPen(pc)
        painter.setFont(QFont("Arial", int(20 * fs), QFont.Bold))
        title_y = int(cy - r * 0.62)
        painter.drawText(QRect(0, title_y, w, int(32 * fs)), Qt.AlignCenter, artifact_name)
        line_y = title_y + int(34 * fs)
        painter.setPen(QPen(pc, 1))
        painter.drawLine(int(cx - r * 0.55), line_y, int(cx + r * 0.55), line_y)

        # Script text
        script_text = self.analysis_result.get("scriptPrompt", "")
        pages = self.split_text_into_pages(script_text, max_chars=55)
        n_pages = len(pages)
        page_text = pages[min(self.script_page, n_pages - 1)] if pages else "..."

        painter.setPen(QColor(255, 255, 255, 230))
        painter.setFont(QFont("Arial", int(12 * fs)))
        text_rect = QRect(int(cx - r * 0.78), line_y + int(12 * fs),
                          int(r * 1.56), int(r * 0.95))
        painter.drawText(text_rect, Qt.AlignCenter | Qt.TextWordWrap, page_text)

        # Square pagination dots
        if n_pages > 1:
            dot_sz = int(4 * fs)       # square side length
            gap = int(6 * fs)
            total_w = n_pages * dot_sz + (n_pages - 1) * gap
            dot_y = int(cy + r * 0.72) - dot_sz // 2
            for i in range(n_pages):
                dot_x = cx - total_w // 2 + i * (dot_sz + gap)
                if i == self.script_page:
                    painter.setPen(Qt.NoPen)
                    painter.setBrush(QColor(255, 255, 255))
                else:
                    c = QColor(pc); c.setAlpha(80)
                    painter.setPen(Qt.NoPen); painter.setBrush(c)
                painter.drawRect(dot_x, dot_y, dot_sz, dot_sz)

        painter.restore()

    def split_text_into_pages(self, text, max_chars=55):
        """
        Split text into pages (max 55 chars per page, matching Web)
        Splits on sentence boundaries (。！？\n)
        """
        if not text:
            return ["..."]
        
        # Split by sentence delimiters
        import re
        sentences = re.split(r'([。！？\n])', text)
        sentences = [s for s in sentences if s]  # Remove empty
        
        pages = []
        current_page = ""
        
        for part in sentences:
            if len(current_page + part) > max_chars and len(current_page) > 0:
                pages.append(current_page)
                current_page = part
            else:
                current_page += part
        
        if current_page:
            pages.append(current_page)
        
        return pages if pages else [text]

    def closeEvent(self, event):
        print("🛑 关闭应用...")
        
        # Cleanup audio
        if hasattr(self, 'audio_manager') and self.audio_manager:
            self.audio_manager.cleanup()
        
        # Cleanup GPIO
        if hasattr(self, 'gpio_controller') and self.gpio_controller:
            self.gpio_controller.cleanup()
        
        # Cleanup Gyro
        if hasattr(self, 'gyro_controller') and self.gyro_controller:
            self.gyro_controller.cleanup()
        
        # Stop camera
        self.timer.stop()
        self.camera.stop()
        self.camera.close()
        
        # Stop Config Sync
        if hasattr(self, 'config_manager'):
            self.config_manager.stop()
        
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

