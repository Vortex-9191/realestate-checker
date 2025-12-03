'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  ChevronRight,
  RotateCcw,
  Upload,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowRight,
  FileText,
  CheckSquare,
  Square,
  Play,
} from 'lucide-react';
import { AppState, Scene, ImageCheckResult, Message, BatchCheckProgress } from '@/types';
import Logo from './Logo';
import PdfViewer from './PdfViewer';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '');
const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL || '';

export default function RealEstateChecker() {
  const [appState, setAppState] = useState<AppState>('initial');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [sceneTypes, setSceneTypes] = useState<string[]>([]);
  const [selectedSceneType, setSelectedSceneType] = useState<string | null>(null);
  const [selectedScenes, setSelectedScenes] = useState<Scene[]>([]);
  const [checkResults, setCheckResults] = useState<ImageCheckResult[]>([]);
  const [batchProgress, setBatchProgress] = useState<BatchCheckProgress | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadingScenes, setLoadingScenes] = useState(false);
  const [gasError, setGasError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchSceneTypesFromGAS = async () => {
    if (!GAS_URL) {
      setGasError('GAS URLが設定されていません');
      return;
    }
    setLoadingScenes(true);
    setGasError(null);
    try {
      const response = await fetch(`${GAS_URL}?action=getSceneTypes`);
      const data = await response.json();
      if (data.success && data.data) {
        setSceneTypes(data.data);
      } else {
        setGasError('取得失敗');
      }
    } catch {
      setGasError('接続エラー');
    } finally {
      setLoadingScenes(false);
    }
  };

  const fetchScenesFromGAS = async (sceneType: string) => {
    if (!GAS_URL) return [];
    setLoadingScenes(true);
    try {
      const response = await fetch(`${GAS_URL}?action=getScenes&sceneType=${encodeURIComponent(sceneType)}`);
      const data = await response.json();
      if (data.success && data.data) {
        const scenes = data.data.map((s: Scene) => ({ ...s, createdAt: new Date() }));
        // 重複排除（checkItem + category をキーに）
        const seen = new Set<string>();
        return scenes.filter((s: Scene) => {
          const key = `${s.category}:${s.checkItem}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
    } catch {
      setGasError('取得失敗');
    } finally {
      setLoadingScenes(false);
    }
    return [];
  };

  useEffect(() => {
    fetchSceneTypesFromGAS();
  }, []);

  const handleSceneTypeSelect = async (sceneType: string) => {
    setSelectedSceneType(sceneType);
    const fetchedScenes = await fetchScenesFromGAS(sceneType);
    if (fetchedScenes.length > 0) {
      setScenes(fetchedScenes);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addMessage = useCallback((role: 'user' | 'ai', text: string) => {
    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      role,
      text,
      timestamp: new Date(),
    }]);
  }, []);

  const MAX_FILE_SIZE = 20 * 1024 * 1024;

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('PDFファイルを選択してください');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('ファイルサイズが大きすぎます（上限: 20MB）');
      return;
    }
    setError(null);
    setUploadedFile(file);
    setAppState('select_scene');
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    disabled: appState !== 'initial',
  });

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 複数選択のトグル
  const toggleSceneSelection = (scene: Scene) => {
    setSelectedScenes(prev => {
      const exists = prev.find(s => s.id === scene.id);
      if (exists) {
        return prev.filter(s => s.id !== scene.id);
      }
      return [...prev, scene];
    });
  };

  // 全選択/全解除
  const toggleSelectAll = () => {
    const availableScenes = scenes.filter(s => s.autoCheck !== '×');
    if (selectedScenes.length === availableScenes.length) {
      setSelectedScenes([]);
    } else {
      setSelectedScenes(availableScenes);
    }
  };

  // 単一チェック実行（バッチ用）
  const checkSingleScene = async (scene: Scene, base64: string): Promise<ImageCheckResult> => {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
あなたは不動産広告（CG・パース画像）の審査の専門家です。
添付されたPDFについて、以下のチェック項目を判定してください。

【チェック情報】
- シーン種別: ${scene.sceneType}
- サブシーン: ${scene.subScene}
- カテゴリ: ${scene.category}
- チェック項目: ${scene.checkItem}
- 根拠: ${scene.reason}
- AI用タグ: ${scene.objectTags.join(', ')}

以下のJSON形式のみで回答してください：
{
  "isAppropriate": true または false,
  "confidence": 0.0〜1.0の数値,
  "reason": "判定理由の詳細説明（50文字以内）",
  "suggestions": ["改善提案1"]
}
`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType: 'application/pdf', data: base64 } },
    ]);

    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('解析失敗');

    const checkResultData = JSON.parse(jsonMatch[0]);
    return { scene, ...checkResultData };
  };

  // 一括判定実行
  const handleBatchCheck = async () => {
    if (!uploadedFile || selectedScenes.length === 0) return;

    setAppState('analyzing');
    setCheckResults([]);
    setBatchProgress({
      total: selectedScenes.length,
      current: 0,
      currentScene: null,
      results: [],
    });

    try {
      const base64 = await fileToBase64(uploadedFile);
      const results: ImageCheckResult[] = [];

      for (let i = 0; i < selectedScenes.length; i++) {
        const scene = selectedScenes[i];
        setBatchProgress({
          total: selectedScenes.length,
          current: i + 1,
          currentScene: scene,
          results,
        });

        try {
          const result = await checkSingleScene(scene, base64);
          results.push(result);
        } catch (err) {
          console.error(`Error checking scene ${scene.id}:`, err);
          results.push({
            scene,
            isAppropriate: false,
            confidence: 0,
            reason: '判定エラー',
            suggestions: [],
          });
        }
      }

      setCheckResults(results);
      setBatchProgress(null);
      setAppState('complete');

      // サマリーメッセージ
      const okCount = results.filter(r => r.isAppropriate).length;
      const ngCount = results.length - okCount;
      addMessage('ai', `【判定完了】\n全${results.length}項目中\n✓ 適切: ${okCount}件\n✗ 要改善: ${ngCount}件`);
    } catch (err) {
      console.error(err);
      setError('判定に失敗しました');
      setAppState('select_scene');
      setBatchProgress(null);
    }
  };

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
        body: JSON.stringify({ checkResults, userMessage }),
      });
      const data = await response.json();
      addMessage('ai', data.response);
    } catch {
      addMessage('ai', 'エラーが発生しました');
    }
  };

  const handleReset = () => {
    setAppState('initial');
    setUploadedFile(null);
    setSelectedSceneType(null);
    setSelectedScenes([]);
    setCheckResults([]);
    setBatchProgress(null);
    setMessages([]);
    setError(null);
  };

  const availableScenes = scenes.filter(s => s.autoCheck !== '×');

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <header className="border-b border-gray-100 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <Logo />
          <div className="border-l border-gray-200 pl-4">
            <h1 className="text-sm font-semibold text-gray-900">不動産広告チェッカー</h1>
            <p className="text-[10px] text-gray-500">AI Guideline Check System</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${sceneTypes.length > 0 ? 'bg-green-500' : gasError ? 'bg-red-500' : 'bg-yellow-500'}`} />
            <span className="text-xs text-gray-500">
              {sceneTypes.length > 0 ? '接続中' : gasError ? 'エラー' : '確認中'}
            </span>
          </div>
          {appState !== 'initial' && (
            <button onClick={handleReset} className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1">
              <RotateCcw className="w-3 h-3" /> リセット
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: PDF Preview */}
        <div className="flex-1 bg-gray-50 p-4 flex flex-col overflow-hidden">
          {appState === 'initial' ? (
            <div
              {...getRootProps()}
              className={`flex-1 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all ${
                isDragActive ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className={`w-10 h-10 mb-3 ${isDragActive ? 'text-red-500' : 'text-gray-300'}`} />
              <p className="text-gray-600 mb-1">PDFをアップロード</p>
              <p className="text-xs text-gray-400">ドラッグ＆ドロップ または クリック</p>
              {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
            </div>
          ) : (
            <div className="flex-1 relative overflow-hidden rounded-lg">
              {uploadedFile && <PdfViewer file={uploadedFile} />}

              {/* Loading Overlay for Batch */}
              {appState === 'analyzing' && batchProgress && (
                <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-10">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 text-red-500 animate-spin mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-900 mb-1">
                      判定中... {batchProgress.current} / {batchProgress.total}
                    </p>
                    {batchProgress.currentScene && (
                      <p className="text-xs text-gray-500 max-w-xs truncate">
                        {batchProgress.currentScene.checkItem}
                      </p>
                    )}
                    <div className="mt-3 w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 transition-all duration-300"
                        style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* File name */}
          {uploadedFile && (
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              <FileText className="w-3.5 h-3.5" />
              <span className="truncate">{uploadedFile.name}</span>
            </div>
          )}
        </div>

        {/* Right: Selection & Results */}
        <div className="w-96 border-l border-gray-100 flex flex-col overflow-hidden">
          {/* Scene Selection */}
          {appState === 'select_scene' && (
            <div className="flex-1 overflow-y-auto p-4">
              {!selectedSceneType ? (
                <>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">シーン種別を選択</h3>
                  {gasError ? (
                    <div className="text-center py-6">
                      <p className="text-red-500 text-sm mb-2">{gasError}</p>
                      <button onClick={fetchSceneTypesFromGAS} className="text-xs text-gray-600 underline">再試行</button>
                    </div>
                  ) : loadingScenes ? (
                    <div className="text-center py-6">
                      <Loader2 className="w-5 h-5 text-gray-400 animate-spin mx-auto" />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {sceneTypes.map((type) => (
                        <button
                          key={type}
                          onClick={() => handleSceneTypeSelect(type)}
                          className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-red-500 hover:bg-red-50 transition-all text-sm"
                        >
                          <span>{type}</span>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <button onClick={() => { setSelectedSceneType(null); setSelectedScenes([]); }} className="text-xs text-gray-500 hover:text-gray-900">
                      ← 戻る
                    </button>
                    <button
                      onClick={toggleSelectAll}
                      className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                    >
                      {selectedScenes.length === availableScenes.length ? (
                        <><CheckSquare className="w-3.5 h-3.5" /> 全解除</>
                      ) : (
                        <><Square className="w-3.5 h-3.5" /> 全選択</>
                      )}
                    </button>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">{selectedSceneType}</h3>
                  {loadingScenes ? (
                    <div className="text-center py-6">
                      <Loader2 className="w-5 h-5 text-gray-400 animate-spin mx-auto" />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {availableScenes.map((scene) => {
                        const isSelected = selectedScenes.some(s => s.id === scene.id);
                        return (
                          <button
                            key={scene.id}
                            onClick={() => toggleSceneSelection(scene)}
                            className={`w-full text-left p-3 border rounded-lg transition-all ${
                              isSelected
                                ? 'border-red-500 bg-red-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <div className="mt-0.5">
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-red-500" />
                                ) : (
                                  <Square className="w-4 h-4 text-gray-300" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{scene.category}</span>
                                  {scene.autoCheck === '○' && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-green-100 rounded text-green-700">AI推奨</span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-900">{scene.checkItem}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5 truncate">{scene.subScene}</p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* 一括判定ボタン */}
                  {selectedScenes.length > 0 && (
                    <div className="sticky bottom-0 pt-3 mt-3 border-t border-gray-100 bg-white">
                      <button
                        onClick={handleBatchCheck}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                      >
                        <Play className="w-4 h-4" />
                        {selectedScenes.length}項目をチェック
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Results & Chat */}
          {(appState === 'analyzing' || appState === 'complete') && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-sm font-medium text-gray-900">判定結果</h3>
                {checkResults.length > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {checkResults.filter(r => r.isAppropriate).length}件適切 / {checkResults.filter(r => !r.isAppropriate).length}件要改善
                  </p>
                )}
              </div>

              {/* Results List */}
              {checkResults.length > 0 && (
                <div className="flex-1 overflow-y-auto">
                  <div className="divide-y divide-gray-100">
                    {checkResults.map((result, idx) => (
                      <div key={idx} className="p-3 hover:bg-gray-50">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5">
                            {result.isAppropriate ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                                {result.scene.category}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {Math.round(result.confidence * 100)}%
                              </span>
                            </div>
                            <p className="text-xs font-medium text-gray-900 mb-0.5">{result.scene.checkItem}</p>
                            <p className="text-[10px] text-gray-500 line-clamp-2">{result.reason}</p>
                            {result.suggestions && result.suggestions.length > 0 && !result.isAppropriate && (
                              <p className="text-[10px] text-red-600 mt-1">
                                → {result.suggestions[0]}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat Messages */}
              {messages.length > 0 && checkResults.length === 0 && (
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((m) => (
                    <div key={m.id} className={m.role === 'user' ? 'text-right' : ''}>
                      <div className={`inline-block max-w-[90%] p-3 rounded-lg text-sm ${
                        m.role === 'user' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {m.text.split('\n').map((line, i) => (
                          <React.Fragment key={i}>
                            {line}
                            {i < m.text.split('\n').length - 1 && <br />}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}

              {appState === 'complete' && (
                <form onSubmit={handleSend} className="p-4 border-t border-gray-100 flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="質問を入力..."
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-red-500"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Initial State */}
          {appState === 'initial' && (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center">
                <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">PDFをアップロードして<br />チェックを開始</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
