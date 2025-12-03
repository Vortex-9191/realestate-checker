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
  FileImage,
} from 'lucide-react';
import { AppState, Scene, ImageCheckResult, Message } from '@/types';
import Logo from './Logo';

// Gemini API クライアント（クライアントサイド）
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '');

// GAS URL（マスターデータ）
const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL || '';

export default function RealEstateChecker() {
  const [appState, setAppState] = useState<AppState>('initial');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'image' | 'pdf' | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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

  // GASからシーン種別を取得する関数
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
        setGasError('シーン種別の取得に失敗しました');
      }
    } catch (err) {
      console.error('Failed to fetch scene types from GAS:', err);
      setGasError('接続エラー');
    } finally {
      setLoadingScenes(false);
    }
  };

  // GASから特定シーン種別のチェックリストを取得
  const fetchScenesFromGAS = async (sceneType: string) => {
    if (!GAS_URL) return [];

    setLoadingScenes(true);
    setGasError(null);
    try {
      const response = await fetch(`${GAS_URL}?action=getScenes&sceneType=${encodeURIComponent(sceneType)}`);
      const data = await response.json();
      if (data.success && data.data) {
        return data.data.map((s: Scene) => ({ ...s, createdAt: new Date() }));
      }
    } catch (err) {
      console.error('Failed to fetch scenes from GAS:', err);
      setGasError('チェックリストの取得に失敗しました');
    } finally {
      setLoadingScenes(false);
    }
    return [];
  };

  // 初期化: GASからシーン種別を読み込み
  useEffect(() => {
    fetchSceneTypesFromGAS();
  }, []);

  // シーン種別選択時にGASからチェックリストを取得
  const handleSceneTypeSelect = async (sceneType: string) => {
    setSelectedSceneType(sceneType);
    addMessage('user', `「${sceneType}」を選択`);

    const fetchedScenes = await fetchScenesFromGAS(sceneType);
    if (fetchedScenes.length > 0) {
      setScenes(fetchedScenes);
      addMessage('ai', `${fetchedScenes.length}件のチェック項目があります`, true);
    } else {
      addMessage('ai', 'チェック項目が見つかりませんでした', true);
    }
  };

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

  // ファイルアップロード処理
  const MAX_FILE_SIZE = 20 * 1024 * 1024;

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) {
        setError('ファイルを選択してください');
        return;
      }

      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';

      if (!isImage && !isPdf) {
        setError('画像またはPDFファイルを選択してください');
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setError(`ファイルサイズが大きすぎます（上限: 20MB）`);
        return;
      }

      setError(null);
      setUploadedFile(file);
      setFileType(isImage ? 'image' : 'pdf');

      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      setAppState('select_scene');
      addMessage('ai', `ファイルを受け付けました。シーンを選択してください。`, true);
    },
    [addMessage]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
      'application/pdf': ['.pdf'],
    },
    multiple: false,
    disabled: appState !== 'initial',
  });

  // ファイルをBase64に変換
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // シーン選択して判定実行
  const handleSceneSelect = async (scene: Scene) => {
    if (!uploadedFile) return;

    setSelectedScene(scene);
    addMessage('user', `「${scene.checkItem}」で判定`);
    setAppState('analyzing');

    try {
      const fileTypeText = fileType === 'pdf' ? 'PDF' : '画像';
      addMessage('ai', `判定中...`, true);

      const base64 = await fileToBase64(uploadedFile);
      const mimeType = uploadedFile.type || (fileType === 'pdf' ? 'application/pdf' : 'image/jpeg');

      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

      const prompt = `
あなたは不動産広告（CG・パース画像）の審査の専門家です。
添付された${fileTypeText}について、以下のチェック項目を判定してください。

【チェック情報】
- シーン種別: ${scene.sceneType}
- サブシーン: ${scene.subScene}
- カテゴリ: ${scene.category}
- チェック項目: ${scene.checkItem}
- 根拠: ${scene.reason}
- AI用タグ: ${scene.objectTags.join(', ')}
- 補足: ${scene.notes || 'なし'}

以下のJSON形式のみで回答してください（他のテキストは含めないでください）：
{
  "isAppropriate": true または false,
  "confidence": 0.0〜1.0の数値,
  "reason": "判定理由の詳細説明",
  "suggestions": ["改善提案1", "改善提案2"]
}

判定ポイント：
1. チェック項目「${scene.checkItem}」を満たしているか
2. AI用タグ（${scene.objectTags.join(', ')}）に関連するオブジェクトが適切に表現されているか
3. 不動産広告として誇大表現や誤解を招く表現がないか
4. 公正取引規約に準拠しているか
`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType,
            data: base64,
          },
        },
      ]);

      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('判定結果の解析に失敗しました');
      }

      const checkResultData = JSON.parse(jsonMatch[0]);
      const resultWithScene: ImageCheckResult = {
        scene,
        ...checkResultData,
      };

      setCheckResult(resultWithScene);
      setAppState('complete');

      const statusText = resultWithScene.isAppropriate ? '適切' : '要改善';
      const confidencePercent = Math.round(resultWithScene.confidence * 100);

      addMessage(
        'ai',
        `【${statusText}】確信度 ${confidencePercent}%\n\n${resultWithScene.reason}${
          resultWithScene.suggestions && resultWithScene.suggestions.length > 0
            ? `\n\n【改善提案】\n${resultWithScene.suggestions.map((s) => `・${s}`).join('\n')}`
            : ''
        }`,
        true
      );
    } catch (err) {
      console.error('Gemini API error:', err);
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
          checkResults: checkResult ? [checkResult] : [],
          userMessage,
        }),
      });

      if (!response.ok) {
        throw new Error('回答生成に失敗しました');
      }

      const data = await response.json();
      addMessage('ai', data.response, true);
    } catch {
      addMessage('ai', 'エラーが発生しました。', false);
    }
  };

  // リセット
  const handleReset = () => {
    setAppState('initial');
    setUploadedFile(null);
    setFileType(null);
    setPreviewUrl(null);
    setSelectedSceneType(null);
    setSelectedScene(null);
    setCheckResult(null);
    setMessages([]);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${sceneTypes.length > 0 ? 'bg-green-500' : gasError ? 'bg-red-500' : 'bg-yellow-500'}`} />
              <span className="text-xs text-gray-500">
                {sceneTypes.length > 0 ? '接続中' : gasError ? 'エラー' : '確認中'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Title Section */}
        <div className="mb-12">
          <h1 className="text-3xl font-light text-gray-900 mb-2">
            広告ガイドライン<span className="font-medium">チェックシステム</span>
          </h1>
          <p className="text-gray-500 text-sm">
            CG・パース画像のガイドライン適合性をAIが判定します
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left: Upload & Preview */}
          <div>
            {/* Upload Area */}
            {appState === 'initial' && (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all ${
                  isDragActive
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragActive ? 'text-red-500' : 'text-gray-300'}`} />
                <p className="text-lg text-gray-700 mb-2">
                  {isDragActive ? 'ドロップしてアップロード' : 'ファイルをアップロード'}
                </p>
                <p className="text-sm text-gray-400">
                  ドラッグ＆ドロップ または クリック
                </p>
                <p className="text-xs text-gray-300 mt-2">
                  対応形式: JPG, PNG, WebP, GIF, PDF
                </p>
                {error && (
                  <p className="mt-4 text-sm text-red-500">{error}</p>
                )}
              </div>
            )}

            {/* Preview */}
            {previewUrl && appState !== 'initial' && (
              <div className="relative">
                <div className="bg-gray-100 rounded-lg overflow-hidden">
                  {fileType === 'image' ? (
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-auto"
                    />
                  ) : (
                    <object
                      data={previewUrl}
                      type="application/pdf"
                      className="w-full h-[500px]"
                    >
                      <div className="flex items-center justify-center h-[500px] bg-gray-50">
                        <div className="text-center">
                          <FileImage className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500 text-sm">PDFプレビュー</p>
                          <p className="text-gray-400 text-xs mt-1">{uploadedFile?.name}</p>
                        </div>
                      </div>
                    </object>
                  )}
                </div>

                {/* Result Badge */}
                {checkResult && appState === 'complete' && (
                  <div className="absolute top-4 left-4">
                    <div
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                        checkResult.isAppropriate
                          ? 'bg-green-500 text-white'
                          : 'bg-red-500 text-white'
                      }`}
                    >
                      {checkResult.isAppropriate ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      {checkResult.isAppropriate ? '適切' : '要改善'}
                      <span className="opacity-75">
                        {Math.round(checkResult.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Loading Overlay */}
                {appState === 'analyzing' && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
                    <div className="text-center">
                      <Loader2 className="w-10 h-10 text-red-500 animate-spin mx-auto mb-3" />
                      <p className="text-gray-600">判定中...</p>
                    </div>
                  </div>
                )}

                {/* Reset Button */}
                <button
                  onClick={handleReset}
                  className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-md hover:bg-gray-50 transition-colors"
                >
                  <RotateCcw className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            )}

            {/* File Info */}
            {uploadedFile && (
              <div className="mt-4 flex items-center gap-3 text-sm text-gray-500">
                <FileImage className="w-4 h-4" />
                <span>{uploadedFile.name}</span>
              </div>
            )}
          </div>

          {/* Right: Selection & Chat */}
          <div className="flex flex-col">
            {/* Scene Type Selection */}
            {appState === 'select_scene' && !selectedSceneType && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-4">
                  シーン種別を選択
                </h3>
                {gasError ? (
                  <div className="text-center py-8">
                    <p className="text-red-500 text-sm mb-3">{gasError}</p>
                    <button
                      onClick={fetchSceneTypesFromGAS}
                      className="text-sm text-gray-600 hover:text-gray-900 underline"
                    >
                      再試行
                    </button>
                  </div>
                ) : loadingScenes ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-6 h-6 text-gray-400 animate-spin mx-auto" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sceneTypes.map((type) => (
                      <button
                        key={type}
                        onClick={() => handleSceneTypeSelect(type)}
                        className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-red-500 hover:bg-red-50 transition-all group"
                      >
                        <span className="text-gray-900">{type}</span>
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Check Item Selection */}
            {appState === 'select_scene' && selectedSceneType && (
              <div>
                <button
                  onClick={() => setSelectedSceneType(null)}
                  className="text-sm text-gray-500 hover:text-gray-900 mb-4 flex items-center gap-1"
                >
                  ← 戻る
                </button>
                <h3 className="text-sm font-medium text-gray-900 mb-4">
                  {selectedSceneType} のチェック項目
                </h3>
                {loadingScenes ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-6 h-6 text-gray-400 animate-spin mx-auto" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {scenes.filter(s => s.autoCheck !== '×').map((scene) => (
                      <button
                        key={scene.id}
                        onClick={() => handleSceneSelect(scene)}
                        className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-red-500 hover:bg-red-50 transition-all group"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">
                            {scene.category}
                          </span>
                          {scene.autoCheck === '○' && (
                            <span className="text-xs px-2 py-0.5 bg-green-100 rounded text-green-700">
                              AI推奨
                            </span>
                          )}
                        </div>
                        <p className="text-gray-900">{scene.checkItem}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {scene.subScene} | {scene.reason}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Chat / Result */}
            {(appState === 'analyzing' || appState === 'complete') && (
              <div className="flex-1 flex flex-col">
                <h3 className="text-sm font-medium text-gray-900 mb-4">
                  判定結果
                </h3>

                {/* Messages */}
                <div className="flex-1 space-y-4 mb-4 overflow-y-auto max-h-[400px]">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`${m.role === 'user' ? 'text-right' : ''}`}
                    >
                      <div
                        className={`inline-block max-w-[90%] p-4 rounded-lg text-sm ${
                          m.role === 'user'
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
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

                {/* Input */}
                {appState === 'complete' && (
                  <form onSubmit={handleSend} className="flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="質問を入力..."
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-red-500"
                    />
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      className="px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Initial State */}
            {appState === 'initial' && (
              <div className="flex-1 flex items-center justify-center text-center py-12">
                <div>
                  <FileImage className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-400">
                    画像をアップロードして<br />チェックを開始
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 mt-24">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <p className="text-xs text-gray-400 text-center">
            © Mitsubishi Estate Residence Co., Ltd. All Rights Reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
