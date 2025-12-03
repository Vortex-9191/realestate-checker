'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { Scene } from '@/types';

interface SettingsPanelProps {
  scenes: Scene[];
  onScenesChange: (scenes: Scene[]) => void;
  onClose: () => void;
}

export default function SettingsPanel({
  scenes,
  onScenesChange,
  onClose,
}: SettingsPanelProps) {
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    sceneType: '',
    subScene: '',
    projectName: '共通',
    category: '',
    checkItem: '',
    reason: '',
    autoCheck: '○' as '○' | '△' | '×',
    objectTags: '',
    notes: '',
  });

  const handleAdd = () => {
    setIsAdding(true);
    setFormData({
      sceneType: '',
      subScene: '',
      projectName: '共通',
      category: '',
      checkItem: '',
      reason: '',
      autoCheck: '○',
      objectTags: '',
      notes: '',
    });
  };

  const handleEdit = (scene: Scene) => {
    setEditingScene(scene);
    setFormData({
      sceneType: scene.sceneType,
      subScene: scene.subScene,
      projectName: scene.projectName,
      category: scene.category,
      checkItem: scene.checkItem,
      reason: scene.reason,
      autoCheck: scene.autoCheck,
      objectTags: scene.objectTags.join(', '),
      notes: scene.notes,
    });
  };

  const handleSave = () => {
    if (!formData.sceneType.trim() || !formData.checkItem.trim()) return;

    const tagsArray = formData.objectTags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t);

    if (isAdding) {
      const newScene: Scene = {
        id: Date.now().toString(),
        sceneType: formData.sceneType,
        subScene: formData.subScene,
        projectName: formData.projectName,
        category: formData.category,
        checkItem: formData.checkItem,
        reason: formData.reason,
        autoCheck: formData.autoCheck,
        objectTags: tagsArray,
        notes: formData.notes,
        createdAt: new Date(),
      };
      onScenesChange([...scenes, newScene]);
      setIsAdding(false);
    } else if (editingScene) {
      const updatedScenes = scenes.map((s) =>
        s.id === editingScene.id
          ? {
              ...s,
              sceneType: formData.sceneType,
              subScene: formData.subScene,
              projectName: formData.projectName,
              category: formData.category,
              checkItem: formData.checkItem,
              reason: formData.reason,
              autoCheck: formData.autoCheck,
              objectTags: tagsArray,
              notes: formData.notes,
            }
          : s
      );
      onScenesChange(updatedScenes);
      setEditingScene(null);
    }
    setFormData({
      sceneType: '',
      subScene: '',
      projectName: '共通',
      category: '',
      checkItem: '',
      reason: '',
      autoCheck: '○',
      objectTags: '',
      notes: '',
    });
  };

  const handleDelete = (id: string) => {
    onScenesChange(scenes.filter((s) => s.id !== id));
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingScene(null);
    setFormData({
      sceneType: '',
      subScene: '',
      projectName: '共通',
      category: '',
      checkItem: '',
      reason: '',
      autoCheck: '○',
      objectTags: '',
      notes: '',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-100">
          <div>
            <h2 className="text-xl font-bold text-black">チェック項目設定</h2>
            <p className="text-sm text-zinc-400 mt-1">
              判定対象のシーン・チェック項目を管理
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Add/Edit Form */}
          {(isAdding || editingScene) && (
            <div className="bg-zinc-50 rounded-2xl p-6 mb-6">
              <h3 className="font-bold text-sm mb-4">
                {isAdding ? '新規チェック項目追加' : 'チェック項目編集'}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">
                    シーン種別 *
                  </label>
                  <input
                    type="text"
                    value={formData.sceneType}
                    onChange={(e) =>
                      setFormData({ ...formData, sceneType: e.target.value })
                    }
                    placeholder="例: 外観"
                    className="w-full px-4 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">
                    サブシーン
                  </label>
                  <input
                    type="text"
                    value={formData.subScene}
                    onChange={(e) =>
                      setFormData({ ...formData, subScene: e.target.value })
                    }
                    placeholder="例: 南側外観"
                    className="w-full px-4 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">
                    案件名
                  </label>
                  <input
                    type="text"
                    value={formData.projectName}
                    onChange={(e) =>
                      setFormData({ ...formData, projectName: e.target.value })
                    }
                    placeholder="例: 共通"
                    className="w-full px-4 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">
                    カテゴリ
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    placeholder="例: 植栽"
                    className="w-full px-4 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-zinc-500 mb-1">
                    チェック項目 *
                  </label>
                  <input
                    type="text"
                    value={formData.checkItem}
                    onChange={(e) =>
                      setFormData({ ...formData, checkItem: e.target.value })
                    }
                    placeholder="例: 植栽が適切に配置されているか"
                    className="w-full px-4 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">
                    根拠
                  </label>
                  <input
                    type="text"
                    value={formData.reason}
                    onChange={(e) =>
                      setFormData({ ...formData, reason: e.target.value })
                    }
                    placeholder="例: 公正取引"
                    className="w-full px-4 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">
                    AI可否
                  </label>
                  <select
                    value={formData.autoCheck}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        autoCheck: e.target.value as '○' | '△' | '×',
                      })
                    }
                    className="w-full px-4 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                  >
                    <option value="○">○ AIで判定可能</option>
                    <option value="△">△ 補助的に判定</option>
                    <option value="×">× 人間のみ</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-zinc-500 mb-1">
                    AI用タグ（カンマ区切り）
                  </label>
                  <input
                    type="text"
                    value={formData.objectTags}
                    onChange={(e) =>
                      setFormData({ ...formData, objectTags: e.target.value })
                    }
                    placeholder="例: tree, plant, green"
                    className="w-full px-4 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-zinc-500 mb-1">
                    補足
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="運用コメントなど"
                    rows={2}
                    className="w-full px-4 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSave}
                  disabled={!formData.sceneType.trim() || !formData.checkItem.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-black rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  保存
                </button>
              </div>
            </div>
          )}

          {/* Scene List */}
          <div className="space-y-3">
            {scenes.length === 0 ? (
              <div className="text-center py-12 text-zinc-400">
                <p>チェック項目が登録されていません</p>
                <p className="text-sm mt-1">「追加」ボタンから登録してください</p>
              </div>
            ) : (
              scenes.map((scene) => (
                <div
                  key={scene.id}
                  className="flex items-start gap-4 p-4 bg-zinc-50 rounded-xl hover:bg-zinc-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 bg-white rounded text-zinc-600 border">
                        {scene.sceneType}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-white rounded text-zinc-600 border">
                        {scene.category}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          scene.autoCheck === '○'
                            ? 'bg-green-100 text-green-700'
                            : scene.autoCheck === '△'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {scene.autoCheck}
                      </span>
                    </div>
                    <h4 className="font-medium text-black">{scene.checkItem}</h4>
                    <p className="text-xs text-zinc-400 mt-1">
                      {scene.subScene} | {scene.reason}
                    </p>
                    {scene.objectTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {scene.objectTags.map((tag, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-1.5 py-0.5 bg-zinc-200 rounded text-zinc-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(scene)}
                      className="p-2 text-zinc-400 hover:text-black hover:bg-white rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(scene.id)}
                      className="p-2 text-zinc-400 hover:text-red-500 hover:bg-white rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-zinc-100 flex justify-between">
          <button
            onClick={handleAdd}
            disabled={isAdding || editingScene !== null}
            className="px-4 py-2 text-sm font-medium text-black bg-zinc-100 rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            チェック項目を追加
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-white bg-black rounded-xl hover:bg-zinc-800 transition-colors"
          >
            完了
          </button>
        </div>
      </div>
    </div>
  );
}
