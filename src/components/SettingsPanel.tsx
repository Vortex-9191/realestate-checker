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
    name: '',
    description: '',
    criteria: '',
  });

  const handleAdd = () => {
    setIsAdding(true);
    setFormData({ name: '', description: '', criteria: '' });
  };

  const handleEdit = (scene: Scene) => {
    setEditingScene(scene);
    setFormData({
      name: scene.name,
      description: scene.description,
      criteria: scene.criteria,
    });
  };

  const handleSave = () => {
    if (!formData.name.trim()) return;

    if (isAdding) {
      const newScene: Scene = {
        id: Date.now().toString(),
        name: formData.name,
        description: formData.description,
        criteria: formData.criteria,
        createdAt: new Date(),
      };
      onScenesChange([...scenes, newScene]);
      setIsAdding(false);
    } else if (editingScene) {
      const updatedScenes = scenes.map((s) =>
        s.id === editingScene.id
          ? { ...s, name: formData.name, description: formData.description, criteria: formData.criteria }
          : s
      );
      onScenesChange(updatedScenes);
      setEditingScene(null);
    }
    setFormData({ name: '', description: '', criteria: '' });
  };

  const handleDelete = (id: string) => {
    onScenesChange(scenes.filter((s) => s.id !== id));
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingScene(null);
    setFormData({ name: '', description: '', criteria: '' });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-100">
          <div>
            <h2 className="text-xl font-bold text-black">シーン設定</h2>
            <p className="text-sm text-zinc-400 mt-1">
              判定対象のシーン（撮影箇所）を管理
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
        <div className="p-8 overflow-y-auto max-h-[calc(80vh-180px)]">
          {/* Add/Edit Form */}
          {(isAdding || editingScene) && (
            <div className="bg-zinc-50 rounded-2xl p-6 mb-6">
              <h3 className="font-bold text-sm mb-4">
                {isAdding ? '新規シーン追加' : 'シーン編集'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">
                    シーン名 *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="例: バルコニー"
                    className="w-full px-4 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">
                    説明
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="例: バルコニーの写真"
                    className="w-full px-4 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">
                    判定基準
                  </label>
                  <textarea
                    value={formData.criteria}
                    onChange={(e) =>
                      setFormData({ ...formData, criteria: e.target.value })
                    }
                    placeholder="例: バルコニーが明確に写っていること、洗濯物が映り込んでいないこと"
                    rows={3}
                    className="w-full px-4 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 resize-none"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 text-sm text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!formData.name.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-black rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    保存
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Scene List */}
          <div className="space-y-3">
            {scenes.length === 0 ? (
              <div className="text-center py-12 text-zinc-400">
                <p>シーンが登録されていません</p>
                <p className="text-sm mt-1">「追加」ボタンから登録してください</p>
              </div>
            ) : (
              scenes.map((scene) => (
                <div
                  key={scene.id}
                  className="flex items-start gap-4 p-4 bg-zinc-50 rounded-xl hover:bg-zinc-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-black">{scene.name}</h4>
                    {scene.description && (
                      <p className="text-sm text-zinc-500 mt-0.5">
                        {scene.description}
                      </p>
                    )}
                    {scene.criteria && (
                      <p className="text-xs text-zinc-400 mt-2 line-clamp-2">
                        判定基準: {scene.criteria}
                      </p>
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
            シーンを追加
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
