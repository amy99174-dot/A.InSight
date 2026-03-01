
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
// ...(TimeScale 1 的 MATERIAL_ORIGIN 與 CULTURAL_ORIGIN 保持你原本的優秀設定)...

- 若 2 (誕生/工藝製作)：
  **【強制實體考據】：無論 HistoryScale 設定為何，你都必須精確考據出該年代、該材質對應的「真實古代專用工具名詞與工法」**（例如：玉雕必須找出『木製水凳、砣輪、解玉砂』；瓷器需找出『拉胚機、匣鉢』；肉形石的表面處理需找出『染色、鑽孔』）。嚴禁憑空捏造工具。探索該時代的真實工作坊環境與光影。
*【專屬藝術流派與色彩考據】：你必須考據該文物所屬時代的「代表性畫派、經典名作或藝術家」（例如：宋代宮廷青綠山水、明代文人水墨、清代郎世寧中西合璧風格），並明確給出該風格的「色彩飽和度、筆觸特徵與畫面氛圍」（例如：高飽和度礦物彩、細膩工筆、低飽和水墨暈染）。這將作為後續繪圖的最高美學標準。**
- 若 3 (全盛)：
  **【場景與人物考據】：** 精確考據該物件在當時社會的「實際使用空間、周遭環境與人物互動」。(例如：汝窯茶盞應出現在宋代文人雅集的茶席或園林中；鐘錶盒應出現在清代皇帝的御書房，周圍有太監或西方使節；翠玉白菜可能被擺放在瑾妃的寢宮內閣)。這將作為建構「古代生活場景(風俗畫)」的基底劇本。
- 若 4 (流轉)：搜尋該類文物的出土紀錄、流失過程或隨時間風化的狀態。
- 若 5 (命運)：推論該物件若保存至科幻未來，其作為「古文明遺跡」的象徵意義。

二、請根據 HistoryScale (${historyScale}) 決定敘事視角與「資料屬性」：
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
Global Keywords: "${styleKeywords}"
你必須將 styleRef 結合 Global Keywords 轉換為英文繪圖指令。

二、畫面敘事結構由 TimeScale (${timeScale}) 決定
1: 起源 -> 系統目前的模式為【${originMode}】。
  ► 若為 MATERIAL_ORIGIN：CRITICAL:Force SHALLOW DEPTH OF FIELD (淺景深攝影) and MEDIUM SHOT.** DO NOT draw the final artifact shape. 
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
      - 【無臉環境敘事 (Faceless Storytelling)】：強烈展現該物件被使用的環境與時代氛圍，但【絕對禁止出現任何正臉或側面五官】！請強制 Agent 3 使用以下手法來構建英文指令：
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
