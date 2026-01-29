
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
Global Keywords: "${styleKeywords}"
你必須將 styleRef 結合 Global Keywords 轉換為英文繪圖指令。

二、畫面敘事結構由 TimeScale (${timeScale}) 決定
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
