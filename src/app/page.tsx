// app/page.tsx
'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  PenTool,
  CheckSquare,
  Calendar,
  TrendingUp,
  Settings,
  BookOpen,
  Target,
  Clock,
} from 'lucide-react';

interface TodayStats {
  totalRoutines: number;
  completedRoutines: number;
  completionRate: number;
  diaryCount: number;
}

export default function HomePage() {
  const { user } = useAuth();
  const [todayStats, setTodayStats] = useState<TodayStats>({
    totalRoutines: 0,
    completedRoutines: 0,
    completionRate: 0,
    diaryCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const todayString = format(today, 'yyyy-MM-dd');

  useEffect(() => {
    if (user) {
      fetchTodayStats();
    }
  }, [user]);

  const fetchTodayStats = async () => {
    if (!user) return;

    try {
      // 今日の曜日（0=日曜日）
      const dayOfWeek = today.getDay();

      // 今日のルーティン統計を取得
      const { data: routines } = await supabase
        .from('routines')
        .select('id, name')
        .eq('user_id', user.id)
        .contains('days_of_week', [dayOfWeek]);

      const routineIds = routines?.map((r) => r.id) || [];

      let completedCount = 0;
      if (routineIds.length > 0) {
        const { data: records } = await supabase
          .from('routine_records')
          .select('id')
          .eq('user_id', user.id)
          .eq('record_date', todayString)
          .eq('is_completed', true)
          .in('routine_id', routineIds);

        completedCount = records?.length || 0;
      }

      // 今日の日記数を取得
      const { data: diaries } = await supabase
        .from('diaries')
        .select('id')
        .eq('user_id', user.id)
        .eq('diary_date', todayString);

      const totalRoutines = routines?.length || 0;
      const completionRate = totalRoutines > 0 ? (completedCount / totalRoutines) * 100 : 0;

      setTodayStats({
        totalRoutines,
        completedRoutines: completedCount,
        completionRate,
        diaryCount: diaries?.length || 0,
      });
    } catch (error) {
      console.error('Error fetching today stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const menuItems = [
    {
      title: '日記投稿',
      description: '今日の出来事を記録',
      href: '/diary/new',
      icon: PenTool,
      color: 'bg-blue-500',
    },
    {
      title: 'ルーティンチェック',
      description: '今日のタスクを確認',
      href: '/routine/check',
      icon: CheckSquare,
      color: 'bg-green-500',
    },
    {
      title: 'カレンダー',
      description: '過去の記録を確認',
      href: '/calendar',
      icon: Calendar,
      color: 'bg-purple-500',
    },
    {
      title: 'ルーティン達成',
      description: '達成度をグラフで確認',
      href: '/routine/achievement',
      icon: TrendingUp,
      color: 'bg-orange-500',
    },
    {
      title: 'ルーティン設定',
      description: 'ルーティンを管理',
      href: '/routine/settings',
      icon: Settings,
      color: 'bg-gray-500',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">おはようございます！</h1>
          <p className="text-lg text-gray-600">
            {format(today, 'yyyy年M月d日（EEEE）', { locale: ja })}
          </p>
        </div>

        {/* 今日の統計 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Target className="w-8 h-8 text-green-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">ルーティン達成率</p>
                {loading ? (
                  <div className="w-16 h-6 bg-gray-200 rounded animate-pulse"></div>
                ) : (
                  <p className="text-2xl font-bold text-gray-900">
                    {todayStats.completionRate.toFixed(0)}%
                  </p>
                )}
                {loading ? (
                  <div className="text-xs text-gray-500 w-20 h-4 bg-gray-200 rounded animate-pulse"></div>
                ) : (
                  <p className="text-xs text-gray-500">
                    {`${todayStats.completedRoutines}/${todayStats.totalRoutines} 完了`}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BookOpen className="w-8 h-8 text-blue-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">今日の日記</p>
                {loading ? (
                  <div className="w-12 h-6 bg-gray-200 rounded animate-pulse"></div>
                ) : (
                  <p className="text-2xl font-bold text-gray-900">{todayStats.diaryCount}</p>
                )}
                <p className="text-xs text-gray-500">投稿済み</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Clock className="w-8 h-8 text-orange-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">継続日数</p>
                <p className="text-2xl font-bold text-gray-900">-</p>
                <p className="text-xs text-gray-500">準備中</p>
              </div>
            </div>
          </div>
        </div>

        {/* メニューグリッド */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="bg-white rounded-lg shadow hover:shadow-md transition-shadow duration-200 p-6 group"
            >
              <div className="flex items-center mb-4">
                <div className={`flex-shrink-0 p-3 ${item.color} rounded-lg`}>
                  <item.icon className="w-6 h-6 text-white" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {item.title}
                  </h3>
                </div>
              </div>
              <p className="text-gray-600 text-sm">{item.description}</p>
            </Link>
          ))}
        </div>

        {/* 今日のクイックアクション */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">クイックアクション</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/diary/new"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <PenTool className="w-4 h-4 mr-2" />
              日記を書く
            </Link>
            <Link
              href="/routine/check"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <CheckSquare className="w-4 h-4 mr-2" />
              ルーティンをチェック
            </Link>
            <Link
              href="/routine/settings"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <Settings className="w-4 h-4 mr-2" />
              ルーティンを追加
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
