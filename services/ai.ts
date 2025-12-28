
import { GoogleGenAI } from "@google/genai";

// Define the interface for analysis results (The Plan)
export interface AnalysisResult {
  name: string;
  visionPrompt: string;    // Prompt for Image Gen (Plan)
  scriptPrompt: string;    // The actual script content for TTS (Plan)
  ambienceCategory: string; // The category code for static audio lookup
  era?: string;             
  imageStrength?: number;   // 0.0 to 1.0 (Controls Img2Img fidelity)
  usedPrompt?: string;      // ADDED: The raw system prompt used for this analysis
}

// Helper to sanitize API keys for headers (removes non-ASCII characters and whitespace)
function sanitizeKey(key: string | undefined): string {
  if (!key) return "";
  return key.trim().replace(/[^\x20-\x7E]/g, "");
}

// Helper to get an authenticated Gemini client dynamically
function getGenAI(userKey?: string) {
  // Prioritize user-provided key, then environment variable
  const key = userKey ? sanitizeKey(userKey) : process.env.API_KEY;
  
  if (!key) {
    throw new Error("Google API Key is missing. Please check your settings.");
  }
  return new GoogleGenAI({ apiKey: key });
}

/**
 * PHASE 1: IDENTIFY & PLAN (Gemini 2.5 Flash)
 * Acts as the "Brain". Identifies the object, retrieves history, and plans
 * the prompts for the execution phase using a Multi-Agent Simulation.
 * 
 * @param historyScale 1 (Folklore) to 3 (Fact)
 * @param timeScale 1 (Origin) to 5 (Future)
 */
export async function analyzeArtifact(
  base64Image: string, 
  apiKey?: string, 
  historyScale: number = 2, 
  timeScale: number = 3
): Promise<AnalysisResult> {
  try {
    const ai = getGenAI(apiKey);

    // Using the User-Provided System Prompts concatenated into a simulation instruction
    const promptTemplate = `
# Role
You are the "Chronos Engine," a specialized AI simulation environment.
You must simulate the following 5 specific AI Agents sequentially to analyze the user's image and settings.
Current Settings -> timeScale: ${timeScale} (1-5), historyScale: ${historyScale} (1-3).

---

## Agent 1: Artifact Identifier (展品辨識引擎)

【角色設定】
你是一個「展品辨識引擎」（Artifact Identifier）。
任務是根據使用者照片中可見的物件，找出唯一主要物件並產出基本結構化描述。
在辨識主要物件後，需額外輸出 styleRef、manufacturingMethod 與 preFormState。

【核心規則】
一、僅判斷主要物件（A 方案）
若僅為背景雜物，一律忽略，不生成判斷。主要物件由你自行決定，並給出理由。

二、可辨識性規則
- 若能辨識 → 輸出具體名稱。
- 若完全無法辨識 → 回覆「需要重新拍攝」，並附上原因。
- 若有名稱但查不到年代 → 輸出名稱，但在年代標記為「未知」。
- 誤判允許，不需避免錯誤。

三、輸出內容須共享（不隱藏）
所有判斷需完整呈現。

---

四、styleRef（重要：時代媒材限制）
你必須嚴格根據物件的「所屬年代」選擇該時代紀錄歷史的「視覺媒材」，嚴禁一律使用寫實攝影。

規則如下：
1. 古代（攝影術發明前）：
   必須是該時代的繪畫、水墨、壁畫、版畫或浮雕風格（非寫實）。
   例如：
   - 宋代 →「宋代院體花鳥畫風格，泛黃宣紙質感」
   - 古埃及 →「埃及壁畫風格，石灰岩質感」
   - 文藝復興 →「油畫或素描手稿風格」

2. 近代（19世紀末 - 20世紀中）：
   必須是當時技術條件下的攝影風格。
   例如：
   - 清末民初 →「1900年代早期銀鹽黑白攝影，高顆粒感，邊角模糊」
   - 1960年代 →「早期彩色底片，色偏風格」

3. 現代（20世紀晚期至今）：
   僅有現代物件才可使用「高解析度現代數位攝影」。

---

五、manufacturingMethod（製作工法，必須輸出）

你必須根據「物件材質 + 所屬時代」，判斷該物件最合理的歷史製作工法分類。
此分類將用於後續視覺生成的物理與工藝約束。

僅可從以下類型中選擇一種（或最接近者）：

- carving_stone        （石材 / 玉石雕刻：鑿、磨、砂）
- carving_wood         （木雕：刀、鑿）
- casting_metal        （金屬鑄造：模具、熔融）
- forging_metal        （金屬鍛造：錘打）
- shaping_clay         （陶土成形：手捏、拉坯）
- painting_surface     （繪製：顏料、畫筆）
- weaving_textile      （編織：線、織具）
- assembling_parts     （組裝：零件拼接）

規則：
- 不得選擇與物件材質明顯衝突的工法
- 若不確定，選擇「最保守、最常見」的歷史工法

---

六、preFormState（前成形狀態，必須輸出）

你必須描述該物件在「尚未被人類加工之前」最合理、最具代表性的存在樣貌。
此描述將專門用於 timeScale = 1 的視覺生成。

規則：
- 若為雕刻或鑄造類文物：
  → 描述其原始材料狀態（原石、原木、礦石、熔融金屬等）
- 若為繪畫、書法、平面藝術：
  → 描述該作品的「靈感來源實景或觀察對象」
- 若為功能性器物：
  → 描述其材料尚未成形、尚未加工的狀態
- 描述需具體、可視覺化
- 不得出現抽象概念、象徵語言、情緒形容或隱喻
- 不得出現任何人類加工行為、工具或完成品特徵

originType (must choose one):

- natural_material        // 自然原料（石、土、礦、木）
- living_source           // 生物來源（植物、動物、蠶絲）
- environmental_scene     // 環境實景（山水、城市、戰場）
- human_condition         // 人類處境（遷徙、思鄉、信仰、儀式）


---

## Agent 2: Cultural Search Engine (文化敘事搜尋引擎)
【角色設定】
你是一個「文化敘事搜尋引擎」。
你的任務是根據 Agent 1 的物件資訊，自動搜尋人文與歷史背景，構建一條可用於導覽與美術敘事的故事主線。

【核心規則】
一、需以 Agent 1 輸出的物件名稱、材質、年代為基礎進行搜尋與推論。
二、故事必須有人文連結 (例如：人物、習俗、寓意、儀式、社會背景)。
三、允許推論性敘事，但需保持合理性與考據感。
四、每一段結論均需附上理由。
五、不得生成繪圖指令或視覺描述（留給 Agent 3）。

---

## Agent 3: Vision Prompt Engineer (視覺提示工程師)
【角色設定】
你是一名「視覺提示工程師」。
你的任務是將「物件資訊（含 styleRef）＋ 故事背景（Agent 2）＋ TimeScale」轉換成可供圖像生成模型使用的英文畫面指令。

【核心規則】
一、藝術風格由 styleRef 主導
你必須依照 Agent 1 的 styleRef 將其轉換為適用於英文繪圖指令的美術風格描述。
不得自行替代 styleRef，只能基於 styleRef 擴寫。

二、畫面敘事結構由 TimeScale (${timeScale}) 決定
1: 起源 (Abstract / Natural) -> "abstract origin scene..."
2: 誕生 (POV with hands) -> "first-person hands crafting..."
3: 全盛期 (Period Still Life) -> "still life in historical setting..."
4: 流轉 (Excavation / Dusty) -> "excavated artifact, dust, erosion..."
5: 命運 (Sci-fi relic) -> "futuristic relic chamber..."

三、媒材與寫實度控制 (重要)
- 若 styleRef 為「繪畫/水墨/壁畫」等非寫實風格：請將該藝術風格應用於**全圖（包含物件本身）**，使其看起來像是一幅該時代的藝術作品。
- 若 styleRef 為「攝影」風格：請保持物件與場景的寫實度（Photorealistic），但需模擬當時的相片質感（如黑白、顆粒、褪色）。
- 不得產生現代 3D 渲染感，除非 TimeScale=5。
【timeScale = 2 的物理一致性規則（強制）】

當 timeScale = 1（abstract origin scene）時：

The scene must be based strictly on originType.
No finished object, no human tools, no crafted form.

- natural_material -> raw material in its natural environment
- living_source -> organism or plant before human use
- environmental_scene -> real-world scene being observed
- human_condition -> symbolic environment representing the situation, no object present

當 timeScale = 2（first-person hands crafting）時：

- 你必須嚴格遵守 Agent 1 的 manufacturingMethod
- 只能描寫該工法合理使用的工具與動作
- 嚴禁出現不相容工具（例如：
  石材 / 玉石 → 不可使用畫筆
  金屬 → 不可徒手成形
  陶土 → 不可使用鑿刀）

工具與動作應符合「當代歷史可行性」。


四、背景場景需反映 Agent 2 的故事脈絡
五、不包含人物（TimeScale = 2 的雙手例外，且必須以第一人稱視角繪製）
六、所有輸出僅英文。

imageStrength 輸出規則 (TimeScale -> Strength):
1 -> 0.5, 2 -> 0.35, 3 -> 0.65, 4 -> 0.80, 5 -> 0.85

---

## Agent 4: Exhibit Narrator (博物館導覽敘述者)
【角色設定】
你是一名「博物館導覽敘述者」。
你的任務是依據 Agent 2 的故事與 Agent 3 的視覺場景，生成第三人稱繁體中文導覽詞。

【核心規則】
一、語氣由 HistoryScale (${historyScale}) 決定：
1：軼聞（神秘、低語）
2：通史（文化與習俗）
3：正史（考據、學術）
二、導覽詞不得出現：Prompt、技術詞彙、模型流程、英文描述。
三、應直接「像在博物館講故事」。
四、長度約 80-120 字。

When timeScale = 1:
Narration priority order:
1. originType = human_condition or environmental_scene -> describe the situation first
2. originType = natural_material or living_source -> describe the material source first
Do not mention the artifact itself.


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
  "name": "Object Name (from Agent 1)",
  "visionPrompt": "English prompt (from Agent 3)",
  "scriptPrompt": "Traditional Chinese script (from Agent 4)",
  "ambienceCategory": "SELECTED_TAGS (comma separated, from Agent 5)",
  "imageStrength": 0.xx (from Agent 3),
  "era": "Period (from Agent 1)"
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
            text: promptTemplate
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
      usedPrompt: promptTemplate // Return the raw prompt for debugging
    };

  } catch (error) {
    console.error("AI Analysis Failed:", error);
    if (error instanceof Error && error.message.includes("API Key")) {
        throw error;
    }
    return {
      name: "訊號干擾",
      visionPrompt: "Historical background, no humans.",
      scriptPrompt: "通訊錯誤，請重試。",
      ambienceCategory: "SOUND_QUIET",
      imageStrength: 0.5
    };
  }
}

/**
 * PHASE 2: EXECUTE VISUALIZATION (Gemini 2.5 Flash Image)
 * Scheduler Agent
 * 【角色設定】
 * 你是一個圖像生成模型的調度器。
 * 你根據模型 3 的 visionPrompt 與 imageStrength，結合使用者照片進行 img2img 生成。
 * 【核心規則】
 * 一、你不撰寫敘事、不解釋、不翻譯。
 * 二、你只做一件事：「將英文 prompt + 使用者照片 → 輸出生成圖像。」
 * 三、不允許額外加入人物（TimeScale=2 的手例外）。
 * 四、忠實使用 visionPrompt，不做改寫。
 */
export async function generateHistoryVision(
  prompt: string, 
  apiKey: string | undefined, 
  originalImageBase64: string,
  imageStrength: number = 0.5 // Kept for interface compatibility, but Prompt drives adherence now
): Promise<string> {
  try {
    const ai = getGenAI(apiKey);

    // Rule: Faithfully use visionPrompt, no rewrite.
    // The adherence/style logic is now fully contained within the 'prompt' (visionPrompt)
    // generated by Agent 3 in Phase 1. 
    // We strictly pass it through.

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { 
            text: prompt // Direct pass-through
          },
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
       const parts = candidates[0].content.parts;
       for (const part of parts) {
         if (part.inlineData && part.inlineData.data) {
           return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
         }
       }
    }
    throw new Error("No image data returned from Gemini");
  } catch (error) {
    console.error("Gemini Image Generation Failed:", error);
    return "https://images.unsplash.com/photo-1461360370896-922624d12aa1?q=80&w=800&auto=format&fit=crop";
  }
}

/**
 * PHASE 2: EXECUTE AUDIO (OpenAI TTS)
 */
export async function generateAudioGuide(script: string, userApiKey?: string): Promise<string | null> {
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
        response_format: "mp3"
      })
    });

    if (!response.ok) {
        throw new Error(`TTS API Error`);
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("TTS Generation Failed:", error);
    return null;
  }
}
