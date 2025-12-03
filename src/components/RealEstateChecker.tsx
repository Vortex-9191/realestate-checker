'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  ShieldAlert,
  FileSearch,
  Building2,
  LayoutTemplate,
  X,
  ArrowRight,
  Settings,
  LogOut,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { AppState, AdType, ChecklistItem, CheckResult, Message } from '@/types';

// タイプライター風テキスト表示コンポーネント
const TypewriterText = ({
  text,
  onComplete,
}: {
  text: string;
  onComplete?: () => void;
}) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    let index = 0;
    const intervalId = setInterval(() => {
      setDisplayedText((prev) => prev + text.charAt(index));
      index++;
      if (index === text.length) {
        clearInterval(intervalId);
        if (onComplete) onComplete();
      }
    }, 15);
    return () => clearInterval(intervalId);
  }, [text, onComplete]);

  return <span>{displayedText}</span>;
};

export default function RealEstateChecker() {
  const [appState, setAppState] = useState<AppState>('initial');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string>('');
  const [detectedType, setDetectedType] = useState<AdType | null>(null);
  const [typeSummary, setTypeSummary] = useState<string>('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [checkResults, setCheckResults] = useState<CheckResult[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedResult, setSelectedResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addMessage = useCallback(
    (role: 'user' | 'ai', text: string, isTyping = false) => {
      const newMessage: Message = {
        id: Date.now().toString(),
        role,
        text,
        timestamp: new Date(),
        isTyping,
      };
      setMessages((prev) => [...prev, newMessage]);
    },
    []
  );

  // PDFアップロード処理
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file || file.type !== 'application/pdf') {
        setError('PDFファイルを選択してください');
        return;
      }

      setError(null);
      setPdfFile(file);
      setAppState('uploading');
      addMessage('ai', `「${file.name}」を受け付けました。広告種別を解析中...`, true);

      try {
        // PDF解析API呼び出し
        const formData = new FormData();
        formData.append('pdf', file);

        setAppState('analyzing_type');

        const response = await fetch('/api/analyze', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('PDF解析に失敗しました');
        }

        const result = await response.json();
        setPdfBase64(result.pdfBase64);
        setDetectedType(result.detectedType);
        setTypeSummary(result.summary);
        setAppState('confirm_type');
      } catch (err) {
        setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました');
        setAppState('initial');
      }
    },
    [addMessage]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    disabled: appState !== 'initial',
  });

  // 種別確認
  const confirmType = async (confirmedType: AdType) => {
    addMessage('user', `はい、「${confirmedType}」で間違いありません。`);
    setAppState('fetching_checklist');

    try {
      // GASからチェックリスト取得
      const gasUrl = process.env.NEXT_PUBLIC_GAS_WEBAPP_URL;
      if (!gasUrl) {
        throw new Error('GAS_WEBAPP_URL is not configured');
      }

      addMessage(
        'ai',
        `「${confirmedType}」と確定しました。チェックリストを取得中...`,
        true
      );

      const checklistResponse = await fetch(
        `${gasUrl}?type=${encodeURIComponent(confirmedType)}`
      );

      if (!checklistResponse.ok) {
        throw new Error('チェックリストの取得に失敗しました');
      }

      const checklistData = await checklistResponse.json();
      setChecklist(checklistData.checklist);

      addMessage(
        'ai',
        `${checklistData.checklist.length}件のチェック項目を取得しました。広告内容を判定中...`,
        true
      );

      setAppState('checking');

      // 判定API呼び出し
      const checkResponse = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfBase64,
          checklist: checklistData.checklist,
          adType: confirmedType,
        }),
      });

      if (!checkResponse.ok) {
        throw new Error('判定処理に失敗しました');
      }

      const checkData = await checkResponse.json();
      setCheckResults(checkData.results);

      const ngCount = checkData.results.filter(
        (r: CheckResult) => r.status === 'NG'
      ).length;
      const warningCount = checkData.results.filter(
        (r: CheckResult) => r.status === '要確認'
      ).length;

      setAppState('complete');
      addMessage(
        'ai',
        `判定完了しました。\n\n【結果サマリー】\n・NG: ${ngCount}件\n・要確認: ${warningCount}件\n・OK: ${checkData.results.length - ngCount - warningCount}件\n\n詳細は左側の一覧からご確認ください。`,
        true
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました');
      setAppState('initial');
    }
  };

  // チャット送信
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || appState !== 'complete') return;

    const userMessage = input.trim();
    setInput('');
    addMessage('user', userMessage);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfBase64,
          checkResults,
          userMessage,
        }),
      });

      if (!response.ok) {
        throw new Error('回答生成に失敗しました');
      }

      const data = await response.json();
      addMessage('ai', data.response, true);
    } catch (err) {
      addMessage(
        'ai',
        'エラーが発生しました。もう一度お試しください。',
        false
      );
    }
  };

  // リセット
  const handleReset = () => {
    setAppState('initial');
    setPdfFile(null);
    setPdfBase64('');
    setDetectedType(null);
    setTypeSummary('');
    setChecklist([]);
    setCheckResults([]);
    setMessages([]);
    setSelectedResult(null);
    setError(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NG':
        return 'bg-red-500';
      case '要確認':
        return 'bg-amber-500';
      case 'OK':
        return 'bg-green-500';
      default:
        return 'bg-zinc-400';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'NG':
        return 'bg-red-50 border-red-200';
      case '要確認':
        return 'bg-amber-50 border-amber-200';
      case 'OK':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-zinc-50 border-zinc-200';
    }
  };

  return (
    <div className="flex h-screen w-full bg-white text-zinc-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 bg-zinc-50 border-r border-zinc-200 flex flex-col py-8 px-6 flex-shrink-0">
        <div className="mb-12 pt-2 pb-4 border-b border-zinc-200/50 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            <span className="text-lg font-bold text-zinc-800 tracking-tight">
              不動産広告チェッカー
            </span>
          </div>
          <span className="text-[10px] text-zinc-400 font-medium tracking-widest pl-8 uppercase">
            AI Compliance System
          </span>
        </div>

        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-4 pl-3">
          Main Menu
        </div>

        <nav className="flex flex-col gap-2 w-full">
          <button className="flex items-center gap-3 px-4 py-3 rounded-xl bg-black text-white shadow-lg transition-all">
            <LayoutTemplate strokeWidth={1.5} className="w-5 h-5" />
            <span className="text-sm font-medium">広告チェック</span>
            <ChevronRight className="w-4 h-4 ml-auto" />
          </button>

          <button className="flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-500 hover:text-black hover:bg-zinc-100 transition-all">
            <FileSearch strokeWidth={1.5} className="w-5 h-5" />
            <span className="text-sm font-medium">履歴</span>
          </button>

          <button className="flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-500 hover:text-black hover:bg-zinc-100 transition-all">
            <ShieldAlert strokeWidth={1.5} className="w-5 h-5" />
            <span className="text-sm font-medium">規約一覧</span>
          </button>

          <button className="flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-500 hover:text-black hover:bg-zinc-100 transition-all">
            <Settings strokeWidth={1.5} className="w-5 h-5" />
            <span className="text-sm font-medium">設定</span>
          </button>
        </nav>

        <div className="mt-auto border-t border-zinc-200 pt-6">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-600">
              U
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-zinc-800">User</span>
              <span className="text-xs text-zinc-400">広告担当者</span>
            </div>
            <button className="ml-auto text-zinc-400 hover:text-zinc-600">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Results Panel */}
        <div className="flex-1 bg-[#F5F5F7] p-8 flex flex-col overflow-hidden">
          <header className="flex justify-between items-end mb-6 flex-shrink-0">
            <div>
              <h2 className="text-2xl font-light tracking-tight text-black mb-1">
                広告 <span className="font-semibold">コンプライアンスチェック</span>
              </h2>
              <p className="text-xs text-zinc-400 font-mono uppercase">
                {pdfFile ? pdfFile.name : 'PDFファイルをアップロード'}
              </p>
            </div>
            {appState === 'complete' && (
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-white rounded-full shadow-sm border border-zinc-100 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <span className="text-xs font-medium text-zinc-600">
                    {checkResults.filter((r) => r.status === 'NG').length} NG
                  </span>
                </div>
                <div className="px-4 py-2 bg-white rounded-full shadow-sm border border-zinc-100 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                  <span className="text-xs font-medium text-zinc-600">
                    {checkResults.filter((r) => r.status === '要確認').length} 要確認
                  </span>
                </div>
                <div className="px-4 py-2 bg-white rounded-full shadow-sm border border-zinc-100 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-xs font-medium text-zinc-600">
                    {checkResults.filter((r) => r.status === 'OK').length} OK
                  </span>
                </div>
              </div>
            )}
          </header>

          <div className="flex-1 bg-white rounded-3xl shadow-lg border border-zinc-100 overflow-hidden relative">
            {/* Initial Upload State */}
            {appState === 'initial' && (
              <div
                {...getRootProps()}
                className={`absolute inset-0 flex flex-col items-center justify-center cursor-pointer transition-colors duration-300 ${
                  isDragActive ? 'bg-blue-50' : 'bg-white hover:bg-zinc-50'
                }`}
              >
                <input {...getInputProps()} />
                <div
                  className={`w-24 h-24 border-2 border-dashed rounded-3xl flex items-center justify-center mb-6 transition-all ${
                    isDragActive
                      ? 'border-blue-500 bg-blue-100'
                      : 'border-zinc-200 hover:border-black'
                  }`}
                >
                  <Upload
                    strokeWidth={1}
                    className={`w-10 h-10 transition-colors ${
                      isDragActive ? 'text-blue-500' : 'text-zinc-400'
                    }`}
                  />
                </div>
                <p className="text-2xl font-light text-zinc-900">
                  {isDragActive ? 'ドロップしてアップロード' : 'PDF広告をアップロード'}
                </p>
                <p className="text-zinc-400 mt-2 text-sm">
                  ドラッグ＆ドロップ または クリックして選択
                </p>
                {error && (
                  <div className="mt-4 px-4 py-2 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}
              </div>
            )}

            {/* Loading States */}
            {(appState === 'uploading' ||
              appState === 'analyzing_type' ||
              appState === 'fetching_checklist' ||
              appState === 'checking') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white">
                <Loader2 className="w-16 h-16 text-black animate-spin mb-6" />
                <p className="text-xl font-medium text-zinc-800">
                  {appState === 'uploading' && 'アップロード中...'}
                  {appState === 'analyzing_type' && '広告種別を解析中...'}
                  {appState === 'fetching_checklist' && 'チェックリスト取得中...'}
                  {appState === 'checking' && '広告内容を判定中...'}
                </p>
                <p className="text-zinc-400 mt-2 text-sm">
                  Gemini 2.5 Pro が分析しています
                </p>
              </div>
            )}

            {/* Results List */}
            {appState === 'complete' && (
              <div className="h-full overflow-y-auto p-6">
                <div className="space-y-3">
                  {checkResults.map((result, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedResult(result)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all hover:shadow-md ${
                        selectedResult === result
                          ? 'ring-2 ring-black'
                          : getStatusBgColor(result.status)
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-3 h-3 rounded-full mt-1 ${getStatusColor(
                            result.status
                          )}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-zinc-400">
                              [{result.checklistItem?.category}]
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded font-medium ${
                                result.status === 'NG'
                                  ? 'bg-red-100 text-red-700'
                                  : result.status === '要確認'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {result.status}
                            </span>
                          </div>
                          <p className="font-medium text-zinc-800 text-sm">
                            {result.checklistItem?.checkItem}
                          </p>
                          <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
                            {result.detail}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Result Detail */}
            {selectedResult && (
              <div className="absolute bottom-0 left-0 right-0 bg-black text-white p-6 rounded-t-3xl shadow-2xl">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-10 rounded-full ${getStatusColor(
                        selectedResult.status
                      )}`}
                    />
                    <div>
                      <h4 className="text-lg font-bold">
                        {selectedResult.checklistItem?.checkItem}
                      </h4>
                      <p className="text-xs text-zinc-400 font-mono">
                        {selectedResult.checklistItem?.regulation}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedResult(null)}
                    className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-zinc-300 leading-relaxed text-sm mb-4">
                  {selectedResult.detail}
                </p>
                {selectedResult.location && (
                  <p className="text-xs text-zinc-400">
                    該当箇所: {selectedResult.location}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Chat Panel */}
        <div className="w-[400px] bg-white flex flex-col border-l border-zinc-200 flex-shrink-0">
          <div className="h-20 border-b border-zinc-100 flex items-center justify-between px-8 flex-shrink-0">
            <div>
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                AI Assistant
              </span>
              <span className="font-bold text-black text-lg">広告チェック</span>
            </div>
            <button
              onClick={handleReset}
              className="p-2 text-zinc-300 hover:text-black transition-colors"
              title="リセット"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 && appState === 'initial' && (
              <div className="flex flex-col items-center justify-center h-full opacity-30 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center">
                  <ShieldAlert className="w-8 h-8 text-black" />
                </div>
                <p className="text-sm text-zinc-500 font-medium">
                  PDFをアップロードして開始
                </p>
              </div>
            )}

            {/* Type Confirmation */}
            {appState === 'confirm_type' && detectedType && (
              <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-lg">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-zinc-100 rounded-xl">
                    <FileSearch className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-black text-sm">種別確認</h4>
                    <p className="text-xs text-zinc-400">確認が必要です</p>
                  </div>
                </div>

                <div className="bg-zinc-50 p-4 rounded-xl mb-4 text-center">
                  <p className="text-xs text-zinc-400 mb-1">検出された種別</p>
                  <p className="font-bold text-black text-xl">{detectedType}</p>
                </div>

                <p className="text-sm text-zinc-600 mb-4">{typeSummary}</p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setAppState('initial')}
                    className="py-3 text-xs font-bold text-zinc-500 hover:bg-zinc-50 rounded-xl border border-zinc-200"
                  >
                    修正する
                  </button>
                  <button
                    onClick={() => confirmType(detectedType)}
                    className="py-3 text-xs font-bold text-white bg-black hover:bg-zinc-800 rounded-xl"
                  >
                    確定する
                  </button>
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest mb-2">
                  {m.role === 'user' ? 'You' : 'AI Assistant'}
                </span>
                <div
                  className={`max-w-[90%] p-4 rounded-2xl text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-black text-white rounded-tr-sm'
                      : 'bg-zinc-100 text-zinc-800 rounded-tl-sm'
                  }`}
                >
                  {m.isTyping ? (
                    <TypewriterText text={m.text} />
                  ) : (
                    m.text.split('\n').map((line, i) => (
                      <React.Fragment key={i}>
                        {line}
                        <br />
                      </React.Fragment>
                    ))
                  )}
                </div>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          <div className="p-6 border-t border-zinc-100 flex-shrink-0">
            <form onSubmit={handleSend} className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  appState === 'complete'
                    ? '質問を入力...'
                    : '処理中...'
                }
                disabled={appState !== 'complete'}
                className="w-full bg-zinc-50 border border-zinc-200 text-black text-sm rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || appState !== 'complete'}
                className="absolute right-2 top-2 p-2 bg-black text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
