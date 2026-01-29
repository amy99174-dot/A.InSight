
export const STEPS = {
    BOOT: 'BOOT',
    PROXIMITY: 'PROXIMITY',
    LOCKED: 'LOCKED',
    TUNING: 'TUNING',
    ANALYZING: 'ANALYZING',
    LISTEN: 'LISTEN',
    FOCUSING: 'FOCUSING',
    REVEAL: 'REVEAL',
};

export const TIME_SCALE_LABELS: Record<number, string> = {
    1: "起因 / 靈感 (抽象自然)",
    2: "鑄造 / 誕生 (工匠視角)",
    3: "使用 / 全盛 (歷史靜物)",
    4: "流轉 / 遺棄 (出土塵封)",
    5: "未來 / 命運 (科幻遺跡)"
};

export const HISTORY_SCALE_LABELS: Record<number, string> = {
    1: "軼聞 (神秘低語)",
    2: "通史 (文化習俗)",
    3: "正史 (考據學術)"
};

// Default Configuration (Can be fetched from DB later)
export const DEFAULT_CONFIG = {
    // Enums
    STEPS,
    TIME_SCALE_LABELS,
    HISTORY_SCALE_LABELS,

    // [New] UI Visual Theme
    ui_theme: {
        id: "default_dark",
        primary_color: "#ffffff", // Default White
        secondary_color: "#000000",
        accent_color: "#39ff14", // Neon Green for accents/audit
        camera_filter: "none",   // grayscale, sepia, contrast
        bg_overlay_opacity: 0.3,
        layout_mode: "classic" // classic, industrial
    },

    // [New] AI Narrative Brain
    ai_brain: {
        role: "Historical Archaeologist", // The persona
        tone: "Formal and Academic",      // The voice
        language: "Traditional Chinese (Taiwan)",
        constraints: [
            "no_modern_tech_mentions",
            "strict_historical_facts"
        ],
        vision_style_keywords: "cinematic lighting, high detail, museum quality"
    },

    // [Refactor] Text Content Group
    text_content: {
        title: "A.InSight",
        bootText: "正在探測歷史訊號",
        bootSubtext: "尋找中...",
        bootHint: "請在展區中隨意走動",
        proximityTitle: "訊號偵測",
        proximitySubtext: "接近目標中",
        lockedTitle: "鎖定目標",
        lockedSubtext: "[ 按下快門捕捉 ]",
        tuningRingOuter: "時間軸",
        tuningRingInner: "史實度",
        analyzingTitle: "解析中",
        listenHint: "點擊畫面繼續",
        focusTitle: "對焦",
        focusHint: "[ 旋轉對焦 ]",
        revealHint: "探測下一則歷史",
    }
};
