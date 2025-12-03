// シーン（撮影箇所）
export interface Scene {
  id: string;
  name: string;
  description: string;
  criteria: string; // 判定基準
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

// PDF解析結果
export interface PdfAnalysisResult {
  detectedType: AdType;
  confidence: number;
  extractedText: string;
}
