
import { GoogleGenAI } from "@google/genai";
import { AnalysisResult } from "../types";

function sanitizeKey(key: string | undefined): string {
  if (!key) return "";
  return key.trim().replace(/[^\x20-\x7E]/g, "");
}

function getGenAI(userKey?: string) {
  // USE PROCESS.ENV for SERVER SIDE
  const key = userKey ? sanitizeKey(userKey) : process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("Google API Key is missing.");
  }
  return new GoogleGenAI({ apiKey: key });
}

export async function analyzeArtifactServer(
  base64Image: string,
  apiKey?: string,
  historyScale: number = 2,
  timeScale: number = 3,
  aiConfig?: { role?: string; tone?: string; vision_style_keywords?: string; }
): Promise<AnalysisResult> {
  try {
    const ai = getGenAI(apiKey);

    // Dynamic Prompt Injection
    const roleId = aiConfig?.role || "展品辨識引擎 (Artifact Identifier)";
    const tone = aiConfig?.tone || "客觀、學術且帶有敬意";
    const styleKeywords = aiConfig?.vision_style_keywords || "cinematic lighting, high detail, historical archive style";
    const originMode = (timeScale === 1) ? (Math.random() > 0.5 ? "MATERIAL_ORIGIN" : "CULTURAL_ORIGIN") : "NONE";

    const fullPrompt = `
# Role
You are the "Chronos Engine," a specialized AI simulation environment.
You must simulate the following 5 specific AI Agents sequentially.

CUSTOM SETTINGS:
- Primary Role Identity: ${roleId}
- Required Tone: ${tone}
- Visual Style Guide: ${styleKeywords}

Current Settings -> timeScale: ${timeScale} (1-5), historyScale: ${historyScale} (1-3).

CRITICAL LANGUAGE RULES (MUST FOLLOW):
1. **Output Language**: STRICTLY Traditional Chinese (繁體中文 - Taiwan usage).
2. **NO English**: Do not include English translations, original names, or Romanization in the JSON output fields 'name' and 'era'.
3. **Field Specifics**:
   - 'name': Only the Chinese name. (e.g., "翠玉白菜" ✅, "Jadeite Cabbage" ❌)
   - 'era': Only the Chinese dynasty/period. (e.g., "清代" ✅, "Modern" ❌ -> use "現代")

---

## Agent 1: ${roleId} (Object Analysis)

【角色設定】
你是一個「${roleId}」。
你的語氣必須是：「${tone}」。
任務是根據使用者照片中可見的物件，找出唯一主要物件並產出基本結構化描述。

【核心規則】
1. 嚴格遵守設定的語氣 (${tone})。 
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
一、請根據 TimeScale (${timeScale}) 決定搜尋策略與敘事的「時間切入點」：
► 若為 MATERIAL_ORIGIN (物質文化溯源)：
    請挑選該物件最核心的原始礦物或植物原料（如：緬甸翡翠原石、天然金礦）。
    **【敘事比例控制】：**
    - **20% 簡述產地：** 簡單點出其地理起源（如：產自遙遠的緬甸）。除非開採方式具備極大文化意義，否則【絕對不要】詳細描述地形、挖掘或淘洗的物理過程。
    - **80% 物質文化意義：** 將焦點放在這項原料在該時代的「文化地位、權力象徵、貿易網絡、或社會價值」。探討它在當時社會代表了什麼？（例如：清宮對翡翠品味的轉變與進貢、大航海時代的物資壟斷、或作為貴族地位的象徵）。
    **【絕對禁令】：嚴禁提及任何後續的「製作過程、工坊、雕刻、燒製或工匠技藝」。**
- 若 2 (誕生/工藝製作)：(這裡才是你原本那段) 探索該時代的工匠環境、具體製作工具、藍圖設計與工法考據。
- 若 3 (全盛)：搜尋該物件在當時社會的實際使用場景、擁有者身分或儀式意義。
- 若 4 (流轉)：搜尋該類文物的出土紀錄、流失過程或隨時間風化的狀態。
- 若 5 (命運)：推論該物件若保存至科幻未來，其作為「古文明遺跡」的象徵意義。

二、請根據 HistoryScale (${historyScale}) 決定考據的「資料屬性」：
- 若 1 (軼聞)：側重民間傳說、神秘色彩、未經證實的野史。
- 若 2 (通史)：側重當時的社會風俗、大眾文化背景。
- 若 3 (正史)：側重嚴謹的考古學術資料、精確的工藝技術名詞。

三、容錯機制：若無法找到特定物件的精確史料，請以「同年代、同材質」的通用歷史背景進行合理推演，絕不捏造虛構人名。

---


## Agent 3: Vision Prompt Engineer (視覺提示工程師)
【角色設定】
你是一名「視覺提示工程師」。
你的任務是將「物件資訊（含 styleRef）＋ 故事背景（Agent 2）＋ TimeScale」轉換成可供圖像生成模型使用的英文畫面指令。

【核心規則】
一、藝術風格由 styleRef 與 Global Keywords 主導
Global Keywords: "${styleKeywords}"
你必須將 styleRef 結合 Global Keywords 轉換為英文繪圖指令。

二、畫面敘事結構由 TimeScale (${timeScale}) 決定
1: 起源 -> 系統目前的模式為【${originMode}】。
  ► 若為 MATERIAL_ORIGIN：CRITICAL:Force SHALLOW DEPTH OF FIELD (淺景深攝影) and MEDIUM SHOT.** DO NOT draw the final artifact shape. 
   Translate Agent 2's specific raw material into a realistic photograph of a **dense field or pile** of the raw mineral.
   **COMPOSITION RULE:** A **single, complete, recognizable chunk** of the raw material (e.g., raw jadeite stone, white kaolin rock) must be positioned in the **sharp center focus**. The entire surrounding frame must be filled with **more of the same raw materials**, but rendered with heavy **bokeh blur (散景)** to create a rich environmental texture without distracting from the central subject. Ensure the central sharp piece has enough margin to be fully visible in a circular crop.
  ► 若為 CULTURAL_ORIGIN：CRITICAL: Force Symbolic Macro Close-up. 畫出象徵該歷史事件的局部特寫（如穿著特定時代服飾的雙手交疊、泛黃的藍圖草稿），嚴禁畫出全身人物或展品本身。
2: 誕生 (Crafting Process) -> 
   **CRITICAL: Force ERA-SPECIFIC ART STYLE combined with EXTREME CLOSE-UP OF HANDS ONLY.**

   1. 視角與構圖的【絕對強制規則】(CRITICAL COMPOSITION RULES):
      - 在轉換為英文繪圖指令時，【必須】在句首加入這段強控詞："Extreme close-up macro shot of TWO HANDS ONLY working on the object, framing from the forearms down, looking down at the table." (極度特寫僅限雙手，從前臂往下取景，俯視桌面)。
      - 【禁用詞彙】：英文指令中【絕對禁止】出現 "artisan", "craftsman", "master", "person", "man" 等會觸發全身人像的單字！請一律替換為 "a pair of hands" 或 "hands".
      - 【強制排除】：加入 "NO faces, NO heads, NO bodies in the frame."

   2. 歷史與風格執行 (Style & Historical Execution):
      - 繼續保持朝代專屬藝術風格（如：Chinese traditional ink painting style）。
      - 將 Agent 2 查到的古代工具轉化為手部動作（如：hands using a traditional treadle-operated rotary tool）。
      - 嚴禁出現任何現代物品（如現代桌燈、電鑽），光源必須描述為 "ancient natural window light"（古代自然窗光）。
3: 全盛期 (Period Still Life) -> "still life in historical setting..."
4: 流轉 (Excavation / Dusty) -> "excavated artifact, dust, erosion..."
5: 命運 (Sci-fi relic) -> "futuristic relic chamber..."

三、媒材與寫實度控制（優先權聲明）
- **【最高優先級】**：若 TimeScale 為 1 且模式為 MATERIAL_ORIGIN，請絕對忽略 styleRef 的風格，【強制使用高畫質寫實攝影 (Hyper-realistic photography)】來呈現大自然原料的真實物理質感。
- **【常規優先級】**：針對其他階段（包含 CULTURAL_ORIGIN 及 TimeScale 2 到 5），請嚴格遵循 styleRef：
  * 若 styleRef 為「繪畫/水墨/插畫」：全圖風格化，符合該物件的藝術流派。
  * 若 styleRef 為「攝影/雕塑/實體物件」：保持寫實度，並結合 Global Keywords 模擬歷史檔案質感。


---

## Agent 4: Exhibit Narrator (博物館導覽敘述者)
【核心規則】
一、請先檢查 TimeScale (${timeScale})，這將決定你的「時空立足點」與 HistoryScale (${historyScale}) 的作用方式：

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
你的語氣必須是：「${tone}」。
你的任務是依據 Agent 2 的故事與 Agent 3 的視覺場景，生成第三人稱繁體中文導覽詞。


【核心規則】
一、語氣由 HistoryScale (${historyScale}) 決定：
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

{
  "name": "Object Name (from Agent 1, Traditional Chinese ONLY)",
  "visionPrompt": "English prompt (from Agent 3)",
  "scriptPrompt": "Traditional Chinese script (from Agent 4)",
  "ambienceCategory": "SELECTED_TAGS (comma separated, from Agent 5)",
  "imageStrength": 0.xx (from Agent 3),
  "era": "Period (from Agent 1, Traditional Chinese ONLY)"
}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      config: {
        responseMimeType: 'application/json'
      },
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image.split(',')[1]
            }
          },
          {
            text: fullPrompt
          }
        ]
      }
    });

    const text = response.text || "{}";
    const json = JSON.parse(text);

    return {
      name: json.name || "未知文物",
      visionPrompt: json.visionPrompt || "Historical artifact close up, photorealistic.",
      scriptPrompt: json.scriptPrompt || "訊號模糊，無法解析歷史數據。",
      ambienceCategory: json.ambienceCategory || "SOUND_QUIET",
      era: json.era,
      imageStrength: json.imageStrength || 0.65,
      usedPrompt: fullPrompt
    };
  } catch (error: any) {
    throw error;
  }
}

export async function generateHistoryVisionServer(
  prompt: string,
  apiKey: string | undefined,
  originalImageBase64: string,
): Promise<string> {
  try {
    const ai = getGenAI(apiKey);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: originalImageBase64.split(',')[1]
            }
          }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      const parts = candidates[0].content?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          }
        }
      }
    }
    throw new Error("No image data returned");
  } catch (error) {
    console.error("Vision Gen Failed", error);
    // Return placeholder
    return "https://images.unsplash.com/photo-1461360370896-922624d12aa1?q=80&w=800&auto=format&fit=crop";
  }
}

export async function generateAudioGuideServer(script: string, userApiKey?: string): Promise<ArrayBuffer | null> {
  const openAIKey = sanitizeKey(userApiKey || process.env.OPENAI_API_KEY);
  if (!openAIKey) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openAIKey}`
      },
      body: JSON.stringify({
        model: "tts-1",
        input: script,
        voice: "onyx",
        response_format: "mp3" // Default
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI TTS API Error:", response.status, response.statusText, errorText);
      throw new Error(`TTS API Error: ${response.status} ${errorText}`);
    }
    return await response.arrayBuffer();
  } catch (error) {
    console.error("Server TTS Failed Details:", error);
    return null;
  }
}
