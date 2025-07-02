// app/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Post {
  id: number;
  user_id: string;
  content: string;
  image_url?: string;
  created_at: string;
}

export default function Wall() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [charCount, setCharCount] = useState(280);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPosts();
    const channel = supabase
      .channel('realtime:posts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        (payload) => {
          setPosts((prev) => [payload.new as Post, ...prev]);
        }
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, []);

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setPosts(data);
  };

  const handleSubmit = async () => {
    if (!content || content.length > 280) return;
    setLoading(true);

    const { error } = await supabase.from('posts').insert([
      {
        user_id: null,
        content,
        image_url: imageUrl || null,
      },
    ]);

    if (!error) {
      setContent('');
      setImageUrl('');
      setCharCount(280);
    }
    setLoading(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;

    setUploading(true);
    const { data, error } = await supabase.storage.from('images').upload(`public/${file.name}`, file, {
      cacheControl: '3600',
      upsert: true,
    });
    setUploading(false);

    if (!error && data) {
      const { data: publicUrlData } = supabase.storage.from('images').getPublicUrl(data.path);
      if (publicUrlData?.publicUrl) setImageUrl(publicUrlData.publicUrl);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-100 px-4 sm:px-6 lg:px-8 py-10">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <aside className="hidden lg:block col-span-1">
          <Card className="shadow-md">
            <CardContent className="flex flex-col items-center space-y-4 py-6">
              <img src="/face.jpg" alt="Profile Image" className="w-24 h-24 rounded-full" />
              <div className="text-center">
                <h2 className="text-lg font-semibold text-gray-800">Tore Efurd</h2>
                <p className="text-sm text-gray-500">wall</p>
              </div>
              <div className="w-full space-y-2 text-sm text-gray-600">
                <div>
                  <strong>Networks</strong>
                  <p>Stanford Alum</p>
                </div>
                <div>
                  <strong>Current City</strong>
                  <p>Murrieta, CA</p>
                </div>
                <Button variant="outline" className="w-full mt-4">Information</Button>
              </div>
            </CardContent>
          </Card>
        </aside>

        <section className="lg:col-span-2 space-y-6">
          <Card className="shadow-md">
            <CardHeader>
              <h2 className="text-2xl font-semibold text-gray-800">Create a Post</h2>
              <p className="text-sm text-gray-500">Share what's on your mind with the world.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Type your message here..."
                value={content}
                maxLength={280}
                onChange={(e) => {
                  setContent(e.target.value);
                  setCharCount(280 - e.target.value.length);
                }}
              />
              <p className="text-right text-sm text-gray-400">{charCount} characters remaining</p>

              <div
                className={`w-full p-6 text-center border-2 border-dashed rounded-lg transition ${
                  dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <div className="flex justify-center items-center gap-2 text-sm text-blue-600">
                    <Loader2 className="animate-spin w-4 h-4" /> Uploading image...
                  </div>
                ) : imageUrl ? (
                  <img src={imageUrl} alt="Uploaded" className="mx-auto h-40 object-contain rounded-md" />
                ) : (
                  <p className="text-sm text-gray-400">Click or drag & drop an image</p>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleDrop({ dataTransfer: { files: [file] }, preventDefault: () => {}, stopPropagation: () => {} } as any);
                  }}
                />
              </div>

              <div className="text-right">
                <Button onClick={handleSubmit} disabled={loading || content.length === 0}>
                  {loading ? (
                    <span className="flex items-center justify-center gap-2"><Loader2 className="animate-spin w-4 h-4" /> Sharing...</span>
                  ) : 'Share'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {posts.length === 0 ? (
              <p className="text-center text-gray-400">No posts yet. Be the first to share!</p>
            ) : (
              posts.map((post) => (
                <Card key={post.id} className="shadow-sm">
                  <CardContent className="space-y-2 py-4">
                    <div className="flex justify-between items-center">
                      <p className="font-semibold text-gray-800">Tore Efurd</p>
                      <p className="text-sm text-gray-400">
                        {new Date(post.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>
                    {post.image_url && (
                      <img src={post.image_url} alt="attachment" className="rounded-md" />
                    )}
                    <p className="text-gray-700 whitespace-pre-line">{post.content}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
