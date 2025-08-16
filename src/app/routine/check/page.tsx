// app/routine/check/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Target,
  Plus,
  Sunrise,
  Sun,
  Moon,
  RotateCcw,
} from 'lucide-react';
import Link from 'next/link';

interface RoutineWithRecord {
  id: string;
  name: string;
  description: string | null;
  time_of_day: 'morning' | 'afternoon' | 'evening' | 'anytime';
  is_quantifiable: boolean;
  unit: string | null;
  target_value: number | null;
  record: {
    id?: string;
    is_completed: boolean;
    actual_value?: number | null;
    notes?: string | null;
  };
}

const timeOfDayIcons = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Moon,
  anytime: Clock,
};

const timeOfDayLabels = {
  morning: '朝',
  afternoon: '昼',
  evening: '夜',
  anytime: 'いつでも',
};

export default function RoutineCheckPage() {
  const [routines, setRoutines] = useState<RoutineWithRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchRoutines();
    }
  }, [user, selectedDate]);

  const fetchRoutines = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const selectedDateObj = new Date(selectedDate);
      const dayOfWeek = selectedDateObj.getDay();

      // その日のルーティンを取得
      const { data: routineData } = await supabase
        .from('routines')
        .select('*')
        .eq('user_id', user.id)
        .contains('days_of_week', [dayOfWeek])
        .order('time_of_day', { ascending: true });

      if (!routineData) {
        setRoutines([]);
        return;
      }

      // その日の記録を取得
      const routineIds = routineData.map((r) => r.id);
      const { data: recordData } = await supabase
        .from('routine_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('record_date', selectedDate)
        .in('routine_id', routineIds);

      // データを結合
      const routinesWithRecords = routineData.map((routine) => {
        const record = recordData?.find((r) => r.routine_id === routine.id);
        return {
          ...routine,
          record: {
            id: record?.id,
            is_completed: record?.is_completed || false,
            actual_value: record?.actual_value,
            notes: record?.notes,
          },
        };
      });

      setRoutines(routinesWithRecords);
    } catch (error) {
      console.error('Error fetching routines:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateRoutineRecord = async (
    routineId: string,
    isCompleted: boolean,
    actualValue?: number,
    notes?: string,
  ) => {
    if (!user) return;

    setUpdating(routineId);
    try {
      const routine = routines.find((r) => r.id === routineId);
      if (!routine) return;

      if (routine.record.id) {
        // 更新
        const { error } = await supabase
          .from('routine_records')
          .update({
            is_completed: isCompleted,
            actual_value: actualValue,
            notes: notes,
          })
          .eq('id', routine.record.id);

        if (error) throw error;
      } else {
        // 新規作成
        const { error } = await supabase.from('routine_records').insert({
          routine_id: routineId,
          user_id: user.id,
          record_date: selectedDate,
          is_completed: isCompleted,
          actual_value: actualValue,
          notes: notes,
        });

        if (error) throw error;
      }

      await fetchRoutines();
    } catch (error) {
      console.error('Error updating routine record:', error);
      alert('更新に失敗しました。もう一度お試しください。');
    } finally {
      setUpdating(null);
    }
  };

  const handleToggleComplete = (routineId: string, currentValue: boolean) => {
    updateRoutineRecord(routineId, !currentValue);
  };

  const handleQuantifiableUpdate = (routineId: string, value: number, notes?: string) => {
    const routine = routines.find((r) => r.id === routineId);
    if (!routine) return;

    const isCompleted = routine.target_value ? value >= routine.target_value : value > 0;
    updateRoutineRecord(routineId, isCompleted, value, notes);
  };

  const getCompletionStats = () => {
    const total = routines.length;
    const completed = routines.filter((r) => r.record.is_completed).length;
    return { total, completed, rate: total > 0 ? (completed / total) * 100 : 0 };
  };

  const stats = getCompletionStats();

  const groupedRoutines = routines.reduce(
    (groups, routine) => {
      const timeOfDay = routine.time_of_day;
      if (!groups[timeOfDay]) {
        groups[timeOfDay] = [];
      }
      groups[timeOfDay].push(routine);
      return groups;
    },
    {} as Record<string, RoutineWithRecord[]>,
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              <h1 className="text-3xl font-bold text-gray-900">ルーティンチェック</h1>
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <p className="text-gray-600 mt-2">
            {format(new Date(selectedDate), 'yyyy年M月d日（EEEE）', { locale: ja })}のルーティン
          </p>
        </div>

        {/* 統計カード */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">今日の進捗</h2>
              <p className="text-3xl font-bold text-blue-600 mt-1">{stats.rate.toFixed(0)}%</p>
              <p className="text-sm text-gray-500">
                {stats.completed} / {stats.total} 完了
              </p>
            </div>
            <div className="text-right">
              <Target className="w-12 h-12 text-blue-500 mx-auto" />
              <button
                onClick={fetchRoutines}
                className="flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors mt-2"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                更新
              </button>
            </div>
          </div>

          {/* プログレスバー */}
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${stats.rate}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* ルーティン一覧 */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
                <div className="flex items-center space-x-4">
                  <div className="w-6 h-6 bg-gray-200 rounded"></div>
                  <div className="flex-1">
                    <div className="h-5 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : routines.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">今日のルーティンはありません</h3>
            <p className="text-gray-500 mb-4">
              {format(new Date(selectedDate), 'M月d日（EEEE）', { locale: ja })}
              に設定されたルーティンがありません
            </p>
            <Link
              href="/routine/settings"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              ルーティンを追加
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedRoutines).map(([timeOfDay, timeRoutines]) => {
              const IconComponent = timeOfDayIcons[timeOfDay as keyof typeof timeOfDayIcons];
              return (
                <div key={timeOfDay} className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                    <div className="flex items-center">
                      <IconComponent className="w-5 h-5 text-gray-600 mr-2" />
                      <h3 className="text-lg font-semibold text-gray-900">
                        {timeOfDayLabels[timeOfDay as keyof typeof timeOfDayLabels]}
                      </h3>
                      <span className="ml-2 text-sm text-gray-500">
                        ({timeRoutines.filter((r) => r.record.is_completed).length}/
                        {timeRoutines.length})
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {timeRoutines.map((routine) => (
                      <RoutineItem
                        key={routine.id}
                        routine={routine}
                        updating={updating === routine.id}
                        onToggle={handleToggleComplete}
                        onQuantifiableUpdate={handleQuantifiableUpdate}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface RoutineItemProps {
  routine: RoutineWithRecord;
  updating: boolean;
  onToggle: (routineId: string, currentValue: boolean) => void;
  onQuantifiableUpdate: (routineId: string, value: number, notes?: string) => void;
}

function RoutineItem({ routine, updating, onToggle, onQuantifiableUpdate }: RoutineItemProps) {
  const [actualValue, setActualValue] = useState(routine.record.actual_value?.toString() || '');
  const [notes, setNotes] = useState(routine.record.notes || '');
  const [showDetails, setShowDetails] = useState(false);

  const handleQuantifiableSubmit = () => {
    const value = parseFloat(actualValue);
    if (!isNaN(value)) {
      onQuantifiableUpdate(routine.id, value, notes.trim() || undefined);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          {routine.is_quantifiable ? (
            <div className="flex items-center mt-1">
              {routine.record.is_completed ? (
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              ) : (
                <Circle className="w-6 h-6 text-gray-400" />
              )}
            </div>
          ) : (
            <button
              onClick={() => onToggle(routine.id, routine.record.is_completed)}
              disabled={updating}
              className="mt-1 focus:outline-none"
            >
              {updating ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              ) : routine.record.is_completed ? (
                <CheckCircle2 className="w-6 h-6 text-green-500 hover:text-green-600 transition-colors" />
              ) : (
                <Circle className="w-6 h-6 text-gray-400 hover:text-blue-500 transition-colors" />
              )}
            </button>
          )}

          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4
                className={`text-lg font-medium ${
                  routine.record.is_completed ? 'text-gray-600 line-through' : 'text-gray-900'
                }`}
              >
                {routine.name}
              </h4>
              {routine.is_quantifiable && (
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                >
                  {showDetails ? '閉じる' : '入力'}
                </button>
              )}
            </div>

            {routine.description && (
              <p className="text-sm text-gray-600 mt-1">{routine.description}</p>
            )}

            {routine.is_quantifiable && (
              <div className="mt-2 text-sm">
                <span className="text-gray-500">目標: </span>
                <span className="font-medium">
                  {routine.target_value} {routine.unit}
                </span>
                {routine.record.actual_value !== null && (
                  <>
                    <span className="text-gray-500 ml-4">実績: </span>
                    <span
                      className={`font-medium ${
                        routine.record.is_completed ? 'text-green-600' : 'text-orange-600'
                      }`}
                    >
                      {routine.record.actual_value} {routine.unit}
                    </span>
                  </>
                )}
              </div>
            )}

            {routine.record.notes && (
              <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">
                📝 {routine.record.notes}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 定量データ入力フォーム */}
      {routine.is_quantifiable && showDetails && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-end space-x-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">実績値</label>
              <div className="flex">
                <input
                  type="number"
                  step="0.1"
                  value={actualValue}
                  onChange={(e) => setActualValue(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
                <span className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 bg-gray-50 text-gray-500 rounded-r-md">
                  {routine.unit}
                </span>
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">メモ（任意）</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="メモを入力..."
              />
            </div>
            <button
              onClick={handleQuantifiableSubmit}
              disabled={updating || !actualValue.trim()}
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {updating ? '更新中...' : '更新'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
