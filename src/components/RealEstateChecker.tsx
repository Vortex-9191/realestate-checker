'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  ShieldAlert,
  Building2,
  LayoutTemplate,
  X,
  ArrowRight,
  Settings,
  LogOut,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  Camera,
} from 'lucide-react';
import { AppState, Scene, ImageCheckResult, Message } from '@/types';
import SettingsPanel from './SettingsPanel';

// デフォルトシーン
const DEFAULT_SCENES: Scene[] = [
  {
    id: '1',
    name: 'バルコニー',
    description: 'バルコニー・ベランダの写真',
    criteria: 'バルコニーが明確に写っていること、洗濯物や私物が映り込んでいないこと',
    createdAt: new Date(),
  },
  {
    id: '2',
    name: 'リビング',
    description: 'リビング・居間の写真',
    criteria: '部屋全体が見渡せること、明るく清潔感があること',
    createdAt: new Date(),
  },
  {
    id: '3',
    name: '外観',
    description: '建物外観の写真',
    criteria: '建物全体が写っていること、天候が良いこと',
    createdAt: new Date(),
  },
  {
    id: '4',
    name: 'キッチン',
    description: 'キッチン・台所の写真',
    criteria: 'キッチン設備が確認できること、清潔感があること',
    createdAt: new Date(),
  },
];

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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [checkResult, setCheckResult] = useState<ImageCheckResult | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // localStorageからシーンを読み込み
  useEffect(() => {
    const savedScenes = localStorage.getItem('realestate-scenes');
    if (savedScenes) {
      try {
        const parsed = JSON.parse(savedScenes);
        setScenes(parsed.map((s: Scene) => ({ ...s, createdAt: new Date(s.createdAt) })));
      } catch {
        setScenes(DEFAULT_SCENES);
      }
    } else {
      setScenes(DEFAULT_SCENES);
    }
  }, []);

  // シーンをlocalStorageに保存
  const handleScenesChange = (newScenes: Scene[]) => {
    setScenes(newScenes);
    localStorage.setItem('realestate-scenes', JSON.stringify(newScenes));
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

  // 画像アップロード処理
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file || !file.type.startsWith('image/')) {
        setError('画像ファイルを選択してください');
        return;
      }

      setError(null);
      setImageFile(file);

      // プレビュー生成
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      setAppState('select_scene');
      addMessage('ai', `画像「${file.name}」を受け付けました。\n判定するシーンを選択してください。`, true);
    },
    [addMessage]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif'] },
    multiple: false,
    disabled: appState !== 'initial',
  });

  // シーン選択して判定実行
  const handleSceneSelect = async (scene: Scene) => {
    if (!imageFile) return;

    setSelectedScene(scene);
    addMessage('user', `「${scene.name}」で判定します。`);
    setAppState('analyzing');

    try {
      addMessage('ai', `「${scene.name}」の基準で画像を判定中...`, true);

      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('scene', JSON.stringify(scene));

      const response = await fetch('/api/check-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('画像判定に失敗しました');
      }

      const result: ImageCheckResult = await response.json();
      setCheckResult(result);
      setAppState('complete');

      const statusText = result.isAppropriate ? '適切' : '要改善';
      const confidencePercent = Math.round(result.confidence * 100);

      addMessage(
        'ai',
        `判定完了しました。\n\n【結果】${statusText}（確信度: ${confidencePercent}%）\n\n【理由】\n${result.reason}${
          result.suggestions && result.suggestions.length > 0
            ? `\n\n【改善提案】\n${result.suggestions.map((s) => `・${s}`).join('\n')}`
            : ''
        }`,
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
      addMessage('ai', 'エラーが発生しました。もう一度お試しください。', false);
    }
  };

  // リセット
  const handleReset = () => {
    setAppState('initial');
    setImageFile(null);
    setImagePreview(null);
    setSelectedScene(null);
    setCheckResult(null);
    setMessages([]);
    setError(null);
  };

  return (
    <div className="flex h-screen w-full bg-white text-zinc-900 font-sans overflow-hidden">
      {/* Settings Modal */}
      {showSettings && (
        <SettingsPanel
          scenes={scenes}
          onScenesChange={handleScenesChange}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Sidebar */}
      <div className="w-72 bg-zinc-50 border-r border-zinc-200 flex flex-col py-8 px-6 flex-shrink-0">
        <div className="mb-12 pt-2 pb-4 border-b border-zinc-200/50 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-red-600" />
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
            <span className="text-sm font-medium">画像チェック</span>
            <ChevronRight className="w-4 h-4 ml-auto" />
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-500 hover:text-black hover:bg-zinc-100 transition-all"
          >
            <Settings strokeWidth={1.5} className="w-5 h-5" />
            <span className="text-sm font-medium">シーン設定</span>
            <span className="ml-auto text-xs bg-zinc-200 text-zinc-600 px-2 py-0.5 rounded-full">
              {scenes.length}
            </span>
          </button>

          <button className="flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-500 hover:text-black hover:bg-zinc-100 transition-all">
            <ShieldAlert strokeWidth={1.5} className="w-5 h-5" />
            <span className="text-sm font-medium">履歴</span>
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
        {/* Image Preview Panel */}
        <div className="flex-1 bg-[#F5F5F7] p-8 flex flex-col overflow-hidden">
          <header className="flex justify-between items-end mb-6 flex-shrink-0">
            <div>
              <h2 className="text-2xl font-light tracking-tight text-black mb-1">
                画像 <span className="font-semibold">コンプライアンスチェック</span>
              </h2>
              <p className="text-xs text-zinc-400 font-mono uppercase">
                {imageFile ? imageFile.name : '画像ファイルをアップロード'}
              </p>
            </div>
            {checkResult && (
              <div className="flex items-center gap-3">
                <div
                  className={`px-4 py-2 rounded-full shadow-sm border flex items-center gap-2 ${
                    checkResult.isAppropriate
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      checkResult.isAppropriate ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  ></div>
                  <span
                    className={`text-xs font-medium ${
                      checkResult.isAppropriate ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {checkResult.isAppropriate ? '適切' : '要改善'}
                  </span>
                </div>
                <div className="px-4 py-2 bg-white rounded-full shadow-sm border border-zinc-100 flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-600">
                    確信度: {Math.round(checkResult.confidence * 100)}%
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
                  <Camera
                    strokeWidth={1}
                    className={`w-10 h-10 transition-colors ${
                      isDragActive ? 'text-blue-500' : 'text-zinc-400'
                    }`}
                  />
                </div>
                <p className="text-2xl font-light text-zinc-900">
                  {isDragActive ? 'ドロップしてアップロード' : '画像をアップロード'}
                </p>
                <p className="text-zinc-400 mt-2 text-sm">
                  ドラッグ＆ドロップ または クリックして選択
                </p>
                <p className="text-zinc-300 mt-1 text-xs">
                  JPG, PNG, WebP, GIF に対応
                </p>
                {error && (
                  <div className="mt-4 px-4 py-2 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}
              </div>
            )}

            {/* Image Preview */}
            {imagePreview && appState !== 'initial' && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 p-8">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-w-full max-h-full object-contain rounded-xl shadow-lg"
                />
              </div>
            )}

            {/* Loading State */}
            {appState === 'analyzing' && (
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
                <Loader2 className="w-16 h-16 text-white animate-spin mb-6" />
                <p className="text-xl font-medium text-white">判定中...</p>
                <p className="text-white/70 mt-2 text-sm">
                  Gemini 2.5 Pro が分析しています
                </p>
              </div>
            )}

            {/* Result Overlay */}
            {checkResult && appState === 'complete' && (
              <div className="absolute bottom-0 left-0 right-0 bg-black text-white p-6 rounded-t-3xl shadow-2xl">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-10 rounded-full ${
                        checkResult.isAppropriate ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    <div>
                      <h4 className="text-lg font-bold">
                        {selectedScene?.name} - {checkResult.isAppropriate ? '適切' : '要改善'}
                      </h4>
                      <p className="text-xs text-zinc-400">
                        確信度: {Math.round(checkResult.confidence * 100)}%
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-zinc-300 leading-relaxed text-sm mb-4">
                  {checkResult.reason}
                </p>
                {checkResult.suggestions && checkResult.suggestions.length > 0 && (
                  <div className="bg-zinc-900 rounded-xl p-4">
                    <p className="text-xs text-zinc-400 mb-2">改善提案</p>
                    <ul className="space-y-1">
                      {checkResult.suggestions.map((s, i) => (
                        <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                          <span className="text-amber-500">•</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
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
              <span className="font-bold text-black text-lg">画像チェック</span>
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
                  <ImageIcon className="w-8 h-8 text-black" />
                </div>
                <p className="text-sm text-zinc-500 font-medium">
                  画像をアップロードして開始
                </p>
              </div>
            )}

            {/* Scene Selection */}
            {appState === 'select_scene' && (
              <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-lg">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-zinc-100 rounded-xl">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-black text-sm">シーン選択</h4>
                    <p className="text-xs text-zinc-400">判定基準を選んでください</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {scenes.length === 0 ? (
                    <div className="text-center py-4 text-zinc-400 text-sm">
                      <p>シーンが登録されていません</p>
                      <button
                        onClick={() => setShowSettings(true)}
                        className="mt-2 text-black underline"
                      >
                        設定から追加
                      </button>
                    </div>
                  ) : (
                    scenes.map((scene) => (
                      <button
                        key={scene.id}
                        onClick={() => handleSceneSelect(scene)}
                        className="w-full text-left p-4 rounded-xl border border-zinc-200 hover:border-black hover:bg-zinc-50 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-black">{scene.name}</p>
                            {scene.description && (
                              <p className="text-xs text-zinc-400 mt-0.5">
                                {scene.description}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-zinc-400" />
                        </div>
                      </button>
                    ))
                  )}
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
                placeholder={appState === 'complete' ? '質問を入力...' : '処理中...'}
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
