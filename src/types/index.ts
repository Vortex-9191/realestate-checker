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
  | 'analyzing_type'    // 種別解析中
  | 'confirm_type'      // 種別確認待ち
  | 'fetching_checklist'// チェックリスト取得中
  | 'checking'          // 判定中
  | 'complete';         // 完了

// PDF解析結果
export interface PdfAnalysisResult {
  detectedType: AdType;
  confidence: number;
  extractedText: string;
}
