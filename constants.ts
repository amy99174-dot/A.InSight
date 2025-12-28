
import { ArtifactData } from './types';

export const THEME_COLORS = {
  primary: '#39ff14', // Neon Green / Fluorescent
  secondary: '#143b2a', // Deep Palace Jade Green
  accent: '#a83232', // Seal Red (for alerts/lock)
  bg: '#0c0c0c', // Almost Black
  glass: 'rgba(20, 59, 42, 0.3)', // Greenish glass
};

export const DEMO_ARTIFACT: ArtifactData = {
  id: 'A001',
  name: '翠玉白菜',
  // Original: Jadeite Cabbage
  originalImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Jadeite_Cabbage_with_Insects.jpg/800px-Jadeite_Cabbage_with_Insects.jpg', 
  // History: A simulated imperial concubine's chamber or varying angle
  historyImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Jadeite_Cabbage_peking_2.jpg/800px-Jadeite_Cabbage_peking_2.jpg', 
  description: '清代 瑾妃 永和宮'
};

export const UI_TEXT = {
  boot: "正在探測\n展館中的歷史故事...",
  proximity: "偵測到歷史痕跡\n請將裝置貼近感應區", // Short vibrate
  locked: "訊號已同步\n請扣下板機鎖定", // Long vibrate
  tuning: "調整時空共振頻率\n確認後開始解析", // New Text
  analyzing: "正在解析\n物件殘留記憶...",
  listen: "聲音檔案已解鎖\n請拿起聽筒聆聽",
  focus: "影像訊號模糊\n旋轉鏡頭進行手動對焦", // Updated Text
  reveal: "移動裝置窺視全貌\n[ 扣下板機 ] 繼續搜尋",
};
