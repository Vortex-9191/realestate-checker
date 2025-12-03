// シーン（チェック項目）
export interface Scene {
  id: string;
  sceneType: string;       // A: シーン種別（外観/内観/バルコニー等）
  subScene: string;        // B: サブシーン（南側外観/エントランス外観等）
  projectName: string;     // C: 案件名
  category: string;        // D: カテゴリ（植栽/照明/外構等）
  checkItem: string;       // E: チェック項目
  reason: string;          // F: 根拠（公正取引/PDF内コメント等）
  autoCheck: '○' | '△' | '×'; // G: AI可否
  objectTags: string[];    // H: AI用タグ
  notes: string;           // I: 補足
  createdAt: Date;
}

// 広告種別
export type AdType =
  | '売買（新築）'
  | '売買（中古）'
  | '賃貸（居住用）'
  | '賃貸（事業用）'
  | 'その他';

// チェックリスト項目
export interface ChecklistItem {
  id: string;
  category: string;
  checkItem: string;
  regulation: string;
  severity: 'high' | 'medium' | 'low';
}

// 画像判定結果
export interface ImageCheckResult {
  scene: Scene;
  isAppropriate: boolean;
  confidence: number;
  reason: string;
  suggestions?: string[];
}

// 判定結果
export interface CheckResult {
  checklistItem: ChecklistItem;
  status: 'OK' | 'NG' | '要確認';
  detail: string;
  location?: string;
}

// チャットメッセージ
export interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: Date;
  isTyping?: boolean;
}

// アプリの状態
export type AppState =
  | 'initial'           // 初期状態（アップロード待ち）
  | 'uploading'         // アップロード中
  | 'select_scene'      // シーン選択
  | 'analyzing'         // 判定中
  | 'complete';         // 完了

// 一括判定の進捗状態
export interface BatchCheckProgress {
  total: number;
  current: number;
  currentScene: Scene | null;
  results: ImageCheckResult[];
}

// PDF解析結果
export interface PdfAnalysisResult {
  detectedType: AdType;
  confidence: number;
  extractedText: string;
}
