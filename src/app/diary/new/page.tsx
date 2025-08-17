// app/diary/new/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Save, ArrowLeft, Calendar, BookOpen } from 'lucide-react';
import Link from 'next/link';

interface Diary {
  id: string;
  content: string;
  created_at: string;
}

export default function DiaryNewPage() {
  const [content, setContent] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingDiaries, setExistingDiaries] = useState<Diary[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchExistingDiaries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedDate]);

  const fetchExistingDiaries = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data } = await supabase
        .from('diaries')
        .select('id, content, created_at')
        .eq('user_id', user.id)
        .eq('diary_date', selectedDate)
        .order('created_at', { ascending: false });

      setExistingDiaries(data || []);
    } catch (error) {
      console.error('Error fetching diaries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !content.trim()) return;

    setSaving(true);
    try {
      const { error } = await supabase.from('diaries').insert({
        user_id: user.id,
        content: content.trim(),
        diary_date: selectedDate,
      });

      if (error) throw error;

      setContent('');
      await fetchExistingDiaries();

      // 成功メッセージを表示（簡単な実装）
      alert('日記を保存しました！');
    } catch (error) {
      console.error('Error saving diary:', error);
      alert('保存に失敗しました。もう一度お試しください。');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この日記を削除しますか？')) return;

    try {
      const { error } = await supabase.from('diaries').delete().eq('id', id);

      if (error) throw error;

      await fetchExistingDiaries();
    } catch (error) {
      console.error('Error deleting diary:', error);
      alert('削除に失敗しました。');
    }
  };

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
              <h1 className="text-3xl font-bold text-gray-900">日記投稿</h1>
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
            {format(new Date(selectedDate), 'yyyy年M月d日（EEEE）', { locale: ja })}の日記
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 新規投稿フォーム */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">新しい日記を書く</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="今日はどんな一日でしたか？&#10;感じたこと、学んだこと、印象に残った出来事など、自由に書いてください。"
                  className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  required
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{content.length} 文字</p>
                <button
                  type="submit"
                  disabled={saving || !content.trim()}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      保存中...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      保存
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* 既存の日記一覧 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <BookOpen className="w-5 h-5 text-gray-500 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900">
                {format(new Date(selectedDate), 'M月d日', { locale: ja })}の日記
              </h2>
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-4 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded"></div>
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : existingDiaries.length > 0 ? (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {existingDiaries.map((diary) => (
                  <div key={diary.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-500">
                        {format(new Date(diary.created_at), 'HH:mm')}
                      </p>
                      <button
                        onClick={() => handleDelete(diary.id)}
                        className="text-xs text-red-600 hover:text-red-800 transition-colors"
                      >
                        削除
                      </button>
                    </div>
                    <p className="text-gray-900 whitespace-pre-wrap text-sm leading-relaxed">
                      {diary.content}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  {format(new Date(selectedDate), 'M月d日', { locale: ja })}の日記はまだありません
                </p>
                <p className="text-sm text-gray-400 mt-1">左のフォームから日記を投稿してください</p>
              </div>
            )}
          </div>
        </div>

        {/* ヒント */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">💡 日記を書くヒント</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• 今日起きた出来事や感じたことを素直に書いてみましょう</li>
            <li>• 学んだことや気づいたことを記録すると、後で見返したときに役立ちます</li>
            <li>• 短くても大丈夫！一言でも継続することが大切です</li>
            <li>• 同じ日に複数の日記を投稿することもできます</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
