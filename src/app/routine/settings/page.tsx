// app/routine/settings/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  ArrowLeft,
  Plus,
  Settings,
  Edit3,
  Trash2,
  Save,
  X,
  Clock,
  Target,
  Calendar,
  Sunrise,
  Sun,
  Moon,
} from 'lucide-react';
import Link from 'next/link';
import { Routine } from '@/types/database';

interface RoutineFormData {
  name: string;
  description: string;
  days_of_week: number[];
  time_of_day: 'morning' | 'afternoon' | 'evening' | 'anytime';
  is_quantifiable: boolean;
  unit: string;
  target_value: string;
}

const initialFormData: RoutineFormData = {
  name: '',
  description: '',
  days_of_week: [0, 1, 2, 3, 4, 5, 6], // 毎日
  time_of_day: 'anytime',
  is_quantifiable: false,
  unit: '',
  target_value: '',
};

const dayLabels = ['日', '月', '火', '水', '木', '金', '土'];
const timeOptions = [
  { value: 'morning', label: '朝', icon: Sunrise },
  { value: 'afternoon', label: '昼', icon: Sun },
  { value: 'evening', label: '夜', icon: Moon },
  { value: 'anytime', label: 'いつでも', icon: Clock },
];

export default function RoutineSettingsPage() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [formData, setFormData] = useState<RoutineFormData>(initialFormData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchRoutines();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchRoutines = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('routines')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRoutines(data || []);
    } catch (error) {
      console.error('Error fetching routines:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    try {
      const routineData = {
        user_id: user.id,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        days_of_week: formData.days_of_week,
        time_of_day: formData.time_of_day,
        is_quantifiable: formData.is_quantifiable,
        unit: formData.is_quantifiable ? formData.unit.trim() || null : null,
        target_value:
          formData.is_quantifiable && formData.target_value
            ? parseFloat(formData.target_value)
            : null,
      };

      if (editingRoutine) {
        // 更新
        const { error } = await supabase
          .from('routines')
          .update(routineData)
          .eq('id', editingRoutine.id);

        if (error) throw error;
      } else {
        // 新規作成
        const { error } = await supabase.from('routines').insert(routineData);

        if (error) throw error;
      }

      await fetchRoutines();
      handleCloseForm();
    } catch (error) {
      console.error('Error saving routine:', error);
      alert('保存に失敗しました。もう一度お試しください。');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (routine: Routine) => {
    setEditingRoutine(routine);
    setFormData({
      name: routine.name,
      description: routine.description || '',
      days_of_week: routine.days_of_week,
      time_of_day: routine.time_of_day,
      is_quantifiable: routine.is_quantifiable,
      unit: routine.unit || '',
      target_value: routine.target_value?.toString() || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (routine: Routine) => {
    if (!confirm(`「${routine.name}」を削除しますか？関連する記録もすべて削除されます。`)) {
      return;
    }

    try {
      const { error } = await supabase.from('routines').delete().eq('id', routine.id);

      if (error) throw error;
      await fetchRoutines();
    } catch (error) {
      console.error('Error deleting routine:', error);
      alert('削除に失敗しました。');
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingRoutine(null);
    setFormData(initialFormData);
  };

  const handleDayToggle = (dayIndex: number) => {
    setFormData((prev) => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(dayIndex)
        ? prev.days_of_week.filter((d) => d !== dayIndex)
        : [...prev.days_of_week, dayIndex].sort((a, b) => a - b),
    }));
  };

  const getTimeIcon = (timeOfDay: string) => {
    const timeOption = timeOptions.find((opt) => opt.value === timeOfDay);
    return timeOption ? timeOption.icon : Clock;
  };

  const getDaysText = (daysOfWeek: number[]) => {
    if (daysOfWeek.length === 7) return '毎日';
    if (daysOfWeek.length === 0) return 'なし';
    return daysOfWeek.map((d) => dayLabels[d]).join('、');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 mr-1" />
                戻る
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">ルーティン設定</h1>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              新しいルーティンを追加
            </button>
          </div>
          <p className="text-gray-600 mt-2">日々のルーティンを管理できます</p>
        </div>

        {/* ルーティン一覧 */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                  <div className="flex space-x-2">
                    <div className="w-8 h-8 bg-gray-200 rounded"></div>
                    <div className="w-8 h-8 bg-gray-200 rounded"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : routines.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {routines.map((routine) => {
              const TimeIcon = getTimeIcon(routine.time_of_day);
              return (
                <div
                  key={routine.id}
                  className="bg-white rounded-lg shadow hover:shadow-md transition-shadow"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">{routine.name}</h3>
                        {routine.description && (
                          <p className="text-sm text-gray-600">{routine.description}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => handleEdit(routine)}
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(routine)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                        <span>{getDaysText(routine.days_of_week)}</span>
                      </div>

                      <div className="flex items-center">
                        <TimeIcon className="w-4 h-4 mr-2 text-gray-400" />
                        <span>
                          {timeOptions.find((opt) => opt.value === routine.time_of_day)?.label}
                        </span>
                      </div>

                      {routine.is_quantifiable && (
                        <div className="flex items-center">
                          <Target className="w-4 h-4 mr-2 text-gray-400" />
                          <span>
                            目標: {routine.target_value} {routine.unit}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Settings className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">ルーティンがまだありません</h3>
            <p className="text-gray-500 mb-6">最初のルーティンを追加して習慣作りを始めましょう</p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              ルーティンを追加
            </button>
          </div>
        )}

        {/* ルーティン追加/編集フォームモーダル */}
        {showForm && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div
                className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                onClick={handleCloseForm}
              ></div>

              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <form onSubmit={handleSubmit}>
                  <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        {editingRoutine ? 'ルーティンを編集' : '新しいルーティンを追加'}
                      </h3>
                      <button
                        type="button"
                        onClick={handleCloseForm}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* ルーティン名 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ルーティン名 *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, name: e.target.value }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="例: 朝のストレッチ"
                        />
                      </div>

                      {/* 説明 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          説明（任意）
                        </label>
                        <textarea
                          value={formData.description}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, description: e.target.value }))
                          }
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="ルーティンの詳細や目的を入力..."
                        />
                      </div>

                      {/* 実行曜日 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          実行曜日
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {dayLabels.map((label, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => handleDayToggle(index)}
                              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                                formData.days_of_week.includes(index)
                                  ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                                  : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <div className="mt-2 flex space-x-2">
                          <button
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                days_of_week: [0, 1, 2, 3, 4, 5, 6],
                              }))
                            }
                            className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
                          >
                            すべて選択
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({ ...prev, days_of_week: [1, 2, 3, 4, 5] }))
                            }
                            className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
                          >
                            平日のみ
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, days_of_week: [] }))}
                            className="text-xs text-gray-600 hover:text-gray-700 transition-colors"
                          >
                            すべて解除
                          </button>
                        </div>
                      </div>

                      {/* 時間帯 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          実行時間帯
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {timeOptions.map((option) => {
                            const IconComponent = option.icon;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    time_of_day: option.value as RoutineFormData['time_of_day'],
                                  }))
                                }
                                className={`flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                                  formData.time_of_day === option.value
                                    ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                                    : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                                }`}
                              >
                                <IconComponent className="w-4 h-4 mr-2" />
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 定量的データ */}
                      <div>
                        <div className="flex items-center mb-2">
                          <input
                            type="checkbox"
                            id="is_quantifiable"
                            checked={formData.is_quantifiable}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                is_quantifiable: e.target.checked,
                                unit: e.target.checked ? prev.unit : '',
                                target_value: e.target.checked ? prev.target_value : '',
                              }))
                            }
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label
                            htmlFor="is_quantifiable"
                            className="ml-2 block text-sm font-medium text-gray-700"
                          >
                            数値で記録する（体重、勉強時間など）
                          </label>
                        </div>

                        {formData.is_quantifiable && (
                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                目標値
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                value={formData.target_value}
                                onChange={(e) =>
                                  setFormData((prev) => ({ ...prev, target_value: e.target.value }))
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                単位
                              </label>
                              <input
                                type="text"
                                value={formData.unit}
                                onChange={(e) =>
                                  setFormData((prev) => ({ ...prev, unit: e.target.value }))
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="例: kg, 分, ページ"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button
                      type="submit"
                      disabled={
                        saving || !formData.name.trim() || formData.days_of_week.length === 0
                      }
                      className="w-full inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {saving ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          保存中...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          {editingRoutine ? '更新' : '追加'}
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseForm}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                    >
                      キャンセル
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
