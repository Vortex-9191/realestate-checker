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
} from 'lucide-react';
import { AppState, Scene, ImageCheckResult, Message } from '@/types';
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
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [checkResult, setCheckResult] = useState<ImageCheckResult | null>(null);
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
        return data.data.map((s: Scene) => ({ ...s, createdAt: new Date() }));
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

  const handleSceneSelect = async (scene: Scene) => {
    if (!uploadedFile) return;
    setSelectedScene(scene);
    setAppState('analyzing');
    addMessage('ai', '判定中...');

    try {
      const base64 = await fileToBase64(uploadedFile);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

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
  "reason": "判定理由の詳細説明",
  "suggestions": ["改善提案1", "改善提案2"]
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
      const resultWithScene: ImageCheckResult = { scene, ...checkResultData };

      setCheckResult(resultWithScene);
      setAppState('complete');
      setMessages([]);

      const statusText = resultWithScene.isAppropriate ? '適切' : '要改善';
      addMessage('ai', `【${statusText}】確信度 ${Math.round(resultWithScene.confidence * 100)}%\n\n${resultWithScene.reason}${
        resultWithScene.suggestions?.length ? `\n\n【改善提案】\n${resultWithScene.suggestions.map(s => `・${s}`).join('\n')}` : ''
      }`);
    } catch (err) {
      console.error(err);
      setError('判定に失敗しました');
      setAppState('select_scene');
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
        body: JSON.stringify({ checkResults: checkResult ? [checkResult] : [], userMessage }),
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
    setSelectedScene(null);
    setCheckResult(null);
    setMessages([]);
    setError(null);
  };

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <header className="border-b border-gray-100 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <Logo />
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

              {/* Result Badge */}
              {checkResult && appState === 'complete' && (
                <div className="absolute top-3 left-3 z-10">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                    checkResult.isAppropriate ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                  }`}>
                    {checkResult.isAppropriate ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {checkResult.isAppropriate ? '適切' : '要改善'}
                    <span className="opacity-75">{Math.round(checkResult.confidence * 100)}%</span>
                  </div>
                </div>
              )}

              {/* Loading Overlay */}
              {appState === 'analyzing' && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 text-red-500 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-gray-600">判定中...</p>
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

        {/* Right: Selection & Chat */}
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
                  <button onClick={() => setSelectedSceneType(null)} className="text-xs text-gray-500 hover:text-gray-900 mb-3">
                    ← 戻る
                  </button>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">{selectedSceneType}</h3>
                  {loadingScenes ? (
                    <div className="text-center py-6">
                      <Loader2 className="w-5 h-5 text-gray-400 animate-spin mx-auto" />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {scenes.filter(s => s.autoCheck !== '×').map((scene) => (
                        <button
                          key={scene.id}
                          onClick={() => handleSceneSelect(scene)}
                          className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-red-500 hover:bg-red-50 transition-all"
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{scene.category}</span>
                            {scene.autoCheck === '○' && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-green-100 rounded text-green-700">AI推奨</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-900">{scene.checkItem}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{scene.subScene} | {scene.reason}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Result & Chat */}
          {(appState === 'analyzing' || appState === 'complete') && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-sm font-medium text-gray-900">判定結果</h3>
                {selectedScene && (
                  <p className="text-xs text-gray-500 mt-0.5">{selectedScene.checkItem}</p>
                )}
              </div>

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
