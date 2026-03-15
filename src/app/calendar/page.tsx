// app/calendar/page.tsx
'use client';
import { useState, useEffect } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns';
import { ja } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  BookOpen,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';

interface DayData {
  date: string;
  diaryCount: number;
  routineStats: {
    total: number;
    completed: number;
    completionRate: number;
  };
}

interface SelectedDayDetail {
  date: string;
  diaries: Array<{
    id: string;
    content: string;
    created_at: string;
  }>;
  routines: Array<{
    id: string;
    name: string;
    is_completed: boolean;
    actual_value?: number;
    unit?: string;
  }>;
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthData, setMonthData] = useState<Map<string, DayData>>(new Map());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDayDetail, setSelectedDayDetail] = useState<SelectedDayDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchMonthData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentMonth]);

  const fetchMonthData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const startDate = format(monthStart, 'yyyy-MM-dd');
      const endDate = format(monthEnd, 'yyyy-MM-dd');

      // 日記データを取得
      const { data: diaries } = await supabase
        .from('diaries')
        .select('diary_date')
        .eq('user_id', user.id)
        .gte('diary_date', startDate)
        .lte('diary_date', endDate);

      // ルーティン記録データを取得
      const { data: routineRecords } = await supabase
        .from('routine_records')
        .select('record_date, is_completed, routine_id')
        .eq('user_id', user.id)
        .gte('record_date', startDate)
        .lte('record_date', endDate);

      // ルーティン定義を取得（曜日チェック用）
      const { data: routines } = await supabase
        .from('routines')
        .select('id, days_of_week, updated_at')
        .eq('user_id', user.id);

      // データをマップに整理
      const dataMap = new Map<string, DayData>();

      // 各日付についてデータを集計
      const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

      daysInMonth.forEach((day) => {
        const dateString = format(day, 'yyyy-MM-dd');
        const dayOfWeek = day.getDay();

        // その日の日記数
        const dayDiaries = diaries?.filter((d) => d.diary_date === dateString) || [];
        const diaryCount = dayDiaries.length;

        // その日に設定されているルーティン（有効日でフィルタリング）
        const dayRoutines =
          routines?.filter((r) => {
            const effectiveDate = format(new Date(r.updated_at), 'yyyy-MM-dd');
            return r.days_of_week.includes(dayOfWeek) && effectiveDate <= dateString;
          }) || [];

        // その日のルーティン記録（有効なルーティンのみ）
        const effectiveRoutineIds = new Set(dayRoutines.map((r) => r.id));
        const dayRecords =
          routineRecords?.filter(
            (r) => r.record_date === dateString && effectiveRoutineIds.has(r.routine_id),
          ) || [];

        const completedCount = dayRecords.filter((r) => r.is_completed).length;
        const totalRoutines = dayRoutines.length;
        const completionRate = totalRoutines > 0 ? (completedCount / totalRoutines) * 100 : 0;

        dataMap.set(dateString, {
          date: dateString,
          diaryCount,
          routineStats: {
            total: totalRoutines,
            completed: completedCount,
            completionRate,
          },
        });
      });

      setMonthData(dataMap);
    } catch (error) {
      console.error('Error fetching month data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDayDetail = async (date: string) => {
    if (!user) return;

    setDetailLoading(true);
    try {
      // 日記を取得
      const { data: diaries } = await supabase
        .from('diaries')
        .select('id, content, created_at')
        .eq('user_id', user.id)
        .eq('diary_date', date)
        .order('created_at', { ascending: false });

      // その日の曜日に設定されているルーティンを取得
      const selectedDay = new Date(date);
      const dayOfWeek = selectedDay.getDay();

      const { data: routines } = await supabase
        .from('routines')
        .select(
          `
          id,
          name,
          unit,
          updated_at,
          routine_records!inner(
            is_completed,
            actual_value
          )
        `,
        )
        .eq('user_id', user.id)
        .contains('days_of_week', [dayOfWeek])
        .eq('routine_records.record_date', date);

      // 有効日でフィルタリング
      const filteredRoutines = routines?.filter((r) => {
        const effectiveDate = format(new Date(r.updated_at), 'yyyy-MM-dd');
        return effectiveDate <= date;
      });

      const routineData =
        filteredRoutines?.map((r) => ({
          id: r.id,
          name: r.name,
          is_completed: r.routine_records[0]?.is_completed || false,
          actual_value: r.routine_records[0]?.actual_value,
          unit: r.unit,
        })) || [];

      setSelectedDayDetail({
        date,
        diaries: diaries || [],
        routines: routineData,
      });
    } catch (error) {
      console.error('Error fetching day detail:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDateClick = (date: string) => {
    setSelectedDate(date);
    fetchDayDetail(date);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth((prev) => (direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)));
  };

  const getDayColor = (dayData: DayData | undefined) => {
    if (!dayData) return 'text-gray-400';

    if (dayData.diaryCount > 0 || dayData.routineStats.completed > 0) {
      if (dayData.routineStats.completionRate >= 80) {
        return 'bg-green-100 text-green-800 border-green-200';
      } else if (dayData.routineStats.completionRate >= 50) {
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      } else {
        return 'bg-red-100 text-red-800 border-red-200';
      }
    }

    return 'text-gray-600 hover:bg-gray-50';
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              <h1 className="text-3xl font-bold text-gray-900">カレンダー</h1>
            </div>
          </div>
          <p className="text-gray-600 mt-2">日記とルーティンの記録を確認できます</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* カレンダー */}
          <div className="lg:col-span-2">
            {loading ? (
              <div className="flex items-center justify-center h-96">
                <span className="text-gray-500 text-lg">読み込み中...</span>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  {/* カレンダーヘッダー */}
                  <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {format(currentMonth, 'yyyy年M月', { locale: ja })}
                    </h2>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => navigateMonth('prev')}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => navigateMonth('next')}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* 曜日ヘッダー */}
                  <div className="grid grid-cols-7 border-b border-gray-200">
                    {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
                      <div key={day} className="p-3 text-center text-sm font-medium text-gray-500">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* カレンダー本体 */}
                  <div className="grid grid-cols-7">
                    {calendarDays.map((day) => {
                      const dateString = format(day, 'yyyy-MM-dd');
                      const dayData = monthData.get(dateString);
                      const isSelected = selectedDate === dateString;
                      const isTodayDate = isToday(day);

                      return (
                        <button
                          key={dateString}
                          onClick={() => handleDateClick(dateString)}
                          className={`
                            p-3 h-24 border-b border-r border-gray-200 text-left hover:bg-blue-50 transition-colors relative
                            ${getDayColor(dayData)}
                            ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
                            ${isTodayDate ? 'font-bold' : ''}
                            ${!isSameMonth(day, currentMonth) ? 'text-gray-300' : ''}
                          `}
                        >
                          <div className="text-sm font-medium">
                            {format(day, 'd')}
                            {isTodayDate && (
                              <span className="ml-1 text-xs bg-blue-500 text-white px-1 rounded">
                                今日
                              </span>
                            )}
                          </div>

                          {dayData && (
                            <div className="mt-1 space-y-1">
                              {dayData.diaryCount > 0 && (
                                <div className="flex items-center text-xs text-blue-600">
                                  <BookOpen className="w-3 h-3 mr-1" />
                                  <span>{dayData.diaryCount}</span>
                                </div>
                              )}
                              {dayData.routineStats.total > 0 && (
                                <div className="flex items-center text-xs">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  <span>
                                    {dayData.routineStats.completed}/{dayData.routineStats.total}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 凡例 */}
                <div className="mt-4 bg-white rounded-lg shadow p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">凡例</h3>
                  <div className="flex flex-wrap gap-4 text-xs">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-green-100 border border-green-200 rounded mr-2"></div>
                      <span>達成率80%以上</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-yellow-100 border border-yellow-200 rounded mr-2"></div>
                      <span>達成率50-79%</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-red-100 border border-red-200 rounded mr-2"></div>
                      <span>達成率50%未満</span>
                    </div>
                    <div className="flex items-center">
                      <BookOpen className="w-4 h-4 text-blue-600 mr-1" />
                      <span>日記</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle2 className="w-4 h-4 text-gray-600 mr-1" />
                      <span>ルーティン</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 詳細パネル */}
          <div className="lg:col-span-1">
            {selectedDate ? (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {format(new Date(selectedDate), 'M月d日（EEEE）', { locale: ja })}
                    </h3>
                    <CalendarIcon className="w-5 h-5 text-gray-400" />
                  </div>
                </div>

                {detailLoading ? (
                  <div className="p-6">
                    <div className="animate-pulse space-y-4">
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-4 bg-gray-200 rounded"></div>
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    </div>
                  </div>
                ) : selectedDayDetail ? (
                  <div className="divide-y divide-gray-200">
                    {/* 日記セクション */}
                    <div className="p-6">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">
                        📝 日記 ({selectedDayDetail.diaries.length})
                      </h4>
                      {selectedDayDetail.diaries.length > 0 ? (
                        <div className="space-y-3 max-h-40 overflow-y-auto">
                          {selectedDayDetail.diaries.map((diary) => (
                            <div
                              key={diary.id}
                              className="text-sm text-gray-600 bg-gray-50 p-3 rounded"
                            >
                              <p className="line-clamp-3">{diary.content}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                {format(new Date(diary.created_at), 'HH:mm')}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">日記はありません</p>
                      )}
                    </div>

                    {/* ルーティンセクション */}
                    <div className="p-6">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">
                        ✅ ルーティン ({selectedDayDetail.routines.length})
                      </h4>
                      {selectedDayDetail.routines.length > 0 ? (
                        <div className="space-y-2">
                          {selectedDayDetail.routines.map((routine) => (
                            <div
                              key={routine.id}
                              className="flex items-center justify-between text-sm"
                            >
                              <div className="flex items-center">
                                {routine.is_completed ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />
                                ) : (
                                  <div className="w-4 h-4 border-2 border-gray-300 rounded-full mr-2"></div>
                                )}
                                <span
                                  className={
                                    routine.is_completed
                                      ? 'line-through text-gray-500'
                                      : 'text-gray-900'
                                  }
                                >
                                  {routine.name}
                                </span>
                              </div>
                              {routine.actual_value !== null && (
                                <span className="text-xs text-gray-500">
                                  {routine.actual_value}
                                  {routine.unit}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">ルーティンはありません</p>
                      )}
                    </div>

                    {/* アクションボタン */}
                    <div className="p-6 bg-gray-50">
                      <div className="space-y-2">
                        <Link
                          href={`/diary/new?date=${selectedDate}`}
                          className="w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                        >
                          <BookOpen className="w-4 h-4 mr-2" />
                          日記を書く
                        </Link>
                        <Link
                          href={`/routine/check?date=${selectedDate}`}
                          className="w-full inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          ルーティンをチェック
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">日付を選択してください</h3>
                <p className="text-gray-500">
                  カレンダーの日付をクリックすると、その日の日記とルーティンの詳細が表示されます
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
