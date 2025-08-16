// app/routine/achievement/page.tsx
'use client';
import { useState, useEffect } from 'react';
import {
  format,
  subDays,
  subWeeks,
  subMonths,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
} from 'date-fns';
import { ja } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, TrendingUp, Calendar, Target, Award, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface ChartData {
  date: string;
  completionRate: number;
  completed: number;
  total: number;
}

interface RoutineStats {
  id: string;
  name: string;
  totalDays: number;
  completedDays: number;
  completionRate: number;
  averageValue?: number;
  unit?: string;
}

type PeriodType = 'week' | 'month' | '3months';

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6b7280'];

export default function RoutineAchievementPage() {
  const [period, setPeriod] = useState<PeriodType>('week');
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [routineStats, setRoutineStats] = useState<RoutineStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [overallStats, setOverallStats] = useState({
    totalRoutines: 0,
    averageCompletionRate: 0,
    bestStreak: 0,
    currentStreak: 0,
  });
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchAchievementData();
    }
  }, [user, period]);

  const getPeriodDates = () => {
    const today = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = startOfWeek(subWeeks(today, 1));
        break;
      case 'month':
        startDate = subMonths(today, 1);
        break;
      case '3months':
        startDate = subMonths(today, 3);
        break;
      default:
        startDate = subWeeks(today, 1);
    }

    return { startDate, endDate: today };
  };

  const fetchAchievementData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { startDate, endDate } = getPeriodDates();
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');

      // ルーティン定義を取得
      const { data: routines } = await supabase
        .from('routines')
        .select('id, name, unit')
        .eq('user_id', user.id);

      if (!routines || routines.length === 0) {
        setChartData([]);
        setRoutineStats([]);
        setOverallStats({
          totalRoutines: 0,
          averageCompletionRate: 0,
          bestStreak: 0,
          currentStreak: 0,
        });
        setLoading(false);
        return;
      }

      // 期間内のルーティン記録を取得
      const { data: records } = await supabase
        .from('routine_records')
        .select('record_date, routine_id, is_completed, actual_value')
        .eq('user_id', user.id)
        .gte('record_date', startDateStr)
        .lte('record_date', endDateStr)
        .in(
          'routine_id',
          routines.map((r) => r.id),
        );

      // 日別のチャートデータを作成
      const dailyData: ChartData[] = [];
      const days = eachDayOfInterval({ start: startDate, end: endDate });

      for (const day of days) {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayOfWeek = day.getDay();

        // その日に設定されているルーティンを取得
        const { data: dayRoutines } = await supabase
          .from('routines')
          .select('id')
          .eq('user_id', user.id)
          .contains('days_of_week', [dayOfWeek]);

        const totalForDay = dayRoutines?.length || 0;
        const completedForDay =
          records?.filter((r) => r.record_date === dateStr && r.is_completed).length || 0;

        const completionRate = totalForDay > 0 ? (completedForDay / totalForDay) * 100 : 0;

        dailyData.push({
          date: format(day, period === 'week' ? 'M/d' : 'M/d'),
          completionRate: Math.round(completionRate),
          completed: completedForDay,
          total: totalForDay,
        });
      }

      setChartData(dailyData);

      // ルーティン別統計を作成
      const routineStatsData: RoutineStats[] = [];

      for (const routine of routines) {
        const routineRecords = records?.filter((r) => r.routine_id === routine.id) || [];
        const completedDays = routineRecords.filter((r) => r.is_completed).length;
        const totalDays = routineRecords.length;
        const completionRate = totalDays > 0 ? (completedDays / totalDays) * 100 : 0;

        // 定量的データの平均値を計算
        const quantifiableRecords = routineRecords.filter((r) => r.actual_value !== null);
        const averageValue =
          quantifiableRecords.length > 0
            ? quantifiableRecords.reduce((sum, r) => sum + (r.actual_value || 0), 0) /
              quantifiableRecords.length
            : undefined;

        routineStatsData.push({
          id: routine.id,
          name: routine.name,
          totalDays,
          completedDays,
          completionRate: Math.round(completionRate),
          averageValue: averageValue ? Math.round(averageValue * 10) / 10 : undefined,
          unit: routine.unit,
        });
      }

      routineStatsData.sort((a, b) => b.completionRate - a.completionRate);
      setRoutineStats(routineStatsData);

      // 全体統計を計算
      const avgCompletionRate =
        routineStatsData.length > 0
          ? Math.round(
              routineStatsData.reduce((sum, r) => sum + r.completionRate, 0) /
                routineStatsData.length,
            )
          : 0;

      // 連続達成日数を計算（簡単な実装）
      let currentStreak = 0;
      let bestStreak = 0;
      let tempStreak = 0;

      const reversedDailyData = [...dailyData].reverse();
      for (let i = 0; i < reversedDailyData.length; i++) {
        if (reversedDailyData[i].completionRate >= 80) {
          tempStreak++;
          if (i === 0) currentStreak = tempStreak;
        } else {
          bestStreak = Math.max(bestStreak, tempStreak);
          tempStreak = 0;
        }
      }
      bestStreak = Math.max(bestStreak, tempStreak);

      setOverallStats({
        totalRoutines: routines.length,
        averageCompletionRate: avgCompletionRate,
        bestStreak,
        currentStreak,
      });
    } catch (error) {
      console.error('Error fetching achievement data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'week':
        return '過去1週間';
      case 'month':
        return '過去1ヶ月';
      case '3months':
        return '過去3ヶ月';
      default:
        return '過去1週間';
    }
  };

  const getCompletionColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 60) return 'text-yellow-600';
    if (rate >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getCompletionBadge = (rate: number) => {
    if (rate >= 90) return { text: '優秀', color: 'bg-green-500' };
    if (rate >= 70) return { text: '良好', color: 'bg-blue-500' };
    if (rate >= 50) return { text: '普通', color: 'bg-yellow-500' };
    return { text: '要改善', color: 'bg-red-500' };
  };

  // パイチャート用データ
  const pieData = [
    {
      name: '90%以上',
      value: routineStats.filter((r) => r.completionRate >= 90).length,
      color: '#10b981',
    },
    {
      name: '70-89%',
      value: routineStats.filter((r) => r.completionRate >= 70 && r.completionRate < 90).length,
      color: '#3b82f6',
    },
    {
      name: '50-69%',
      value: routineStats.filter((r) => r.completionRate >= 50 && r.completionRate < 70).length,
      color: '#f59e0b',
    },
    {
      name: '50%未満',
      value: routineStats.filter((r) => r.completionRate < 50).length,
      color: '#ef4444',
    },
  ].filter((item) => item.value > 0);

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
              <h1 className="text-3xl font-bold text-gray-900">ルーティン達成度</h1>
            </div>
            <div className="flex items-center space-x-2">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as PeriodType)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="week">過去1週間</option>
                <option value="month">過去1ヶ月</option>
                <option value="3months">過去3ヶ月</option>
              </select>
            </div>
          </div>
          <p className="text-gray-600 mt-2">{getPeriodLabel()}のルーティン達成状況を確認できます</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* 統計カード */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Target className="w-8 h-8 text-blue-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">平均達成率</p>
                    <p
                      className={`text-2xl font-bold ${getCompletionColor(overallStats.averageCompletionRate)}`}
                    >
                      {overallStats.averageCompletionRate}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <BarChart3 className="w-8 h-8 text-green-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">登録ルーティン数</p>
                    <p className="text-2xl font-bold text-gray-900">{overallStats.totalRoutines}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <TrendingUp className="w-8 h-8 text-orange-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">現在の連続日数</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {overallStats.currentStreak}日
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Award className="w-8 h-8 text-purple-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">最高連続日数</p>
                    <p className="text-2xl font-bold text-gray-900">{overallStats.bestStreak}日</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* 日別達成率グラフ */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">日別達成率</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 12 }}
                        label={{ value: '達成率(%)', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip
                        formatter={(value: any, name: string) => [
                          name === 'completionRate' ? `${value}%` : value,
                          name === 'completionRate' ? '達成率' : name,
                        ]}
                        labelFormatter={(label) => `${label}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="completionRate"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 達成率分布 */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">ルーティン達成率分布</h3>
                {pieData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    データがありません
                  </div>
                )}
              </div>
            </div>

            {/* ルーティン別詳細統計 */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">ルーティン別統計</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {getPeriodLabel()}の各ルーティンの達成状況
                </p>
              </div>

              {routineStats.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          ルーティン名
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          実行日数
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          達成率
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          平均値
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          評価
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {routineStats.map((stat) => {
                        const badge = getCompletionBadge(stat.completionRate);
                        return (
                          <tr key={stat.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {stat.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {stat.completedDays} / {stat.totalDays}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`text-sm font-medium ${getCompletionColor(stat.completionRate)}`}
                              >
                                {stat.completionRate}%
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {stat.averageValue ? `${stat.averageValue} ${stat.unit || ''}` : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${badge.color}`}
                              >
                                {badge.text}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">データがありません</h4>
                  <p className="text-gray-500 mb-4">ルーティンを設定して記録を始めましょう</p>
                  <Link
                    href="/routine/settings"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                  >
                    ルーティンを設定
                  </Link>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
