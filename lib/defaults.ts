
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

    // Text Content
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

    // Visual Theme (Defaults match original hardcoded values)
    primaryColor: "text-white", // Default text class for primary elements
    // Note: Since 'primaryColor' is used for borders too, if I pass a class 'text-white', 
    // my helper might add it as a class. 'text-white' on a div usually doesn't affect border color unless 'border-current' is used.
    // However, the helper is used like: getDynamicStyle(primary, 'border-white', 'borderColor')
    // If I pass 'text-white', it returns class 'text-white'. 
    // <div className="... text-white"> 
    // Ideally, for semantic clarity, primaryColor should probably be a color VALUE (hex) or specific classes if split.
    // Given the helper usage: 
    //   getDynamicStyle(config.primaryColor, 'border-white', 'borderColor')
    // If I pass '#39ff14' (Neon Green), style becomes { borderColor: '#39ff14' }. Correct.
    // If I pass '' or undefined, it uses 'border-white'. Correct.
    // So for DEFAULT, I can just leave it undefined or empty string to use the defaults I set in the component!
    // BUT the user asked to "replace hardcoded values".
    // Let's set it to undefined to prove the defaults work? 
    // No, user said "Pass current default config".
    // I will pass `undefined` for colors so the component defaults (white) take over, OR specific white hex.
    // Actually, to be safe and explicit, let's use the explicit classes that match the original code if we want to override.
    // But the original code had 'border-white' and 'text-white'. 
    // If I set primaryColor = 'white', helper returns className 'white' (not valid tailwind).
    // If I set primaryColor = '#FFFFFF', style is set.
    // Let's use Hex #FFFFFF for white to verify the "Color Mixing" logic works (style injection).
    // Wait, if I use style injection, I lose Tailwind utility benefits? No, style overrides class.

    // DECISION: Leave colors undefined in DEFAULT_CONFIG to allow `ScannerDisplay.tsx`'s own fallbacks to work?
    // No, `ScannerDisplay` uses fallbacks like `defaultClass`.
    // So if config.primaryColor is undefined, it uses 'border-white'.
    // That is PERFECT for "Default Config" - use the code defaults.
    // But I will add the keys for clarity.
    // primaryColor: undefined, // Duplicated key removed
    secondaryColor: undefined,
    alertColor: undefined
};
