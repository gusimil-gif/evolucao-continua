import React, { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy, getDocs, addDoc, updateDoc, doc, arrayUnion, arrayRemove, increment, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../services/firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Heart, MessageCircle, Send, Image as ImageIcon, X, Loader2, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import type { CommunityPost, PostComment, UserData } from '../../types';

export const CommunityFeed: React.FC = () => {
  const { userData } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newImage, setNewImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentsData, setCommentsData] = useState<Record<string, PostComment[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPosts();
    fetchUsers();
  }, [userData]);

  const fetchUsers = async () => {
    const snap = await getDocs(collection(db, 'users'));
    setAllUsers(snap.docs.map(d => ({ ...d.data(), uid: d.id } as UserData)));
  };

  const fetchPosts = async () => {
    try {
      const q = query(collection(db, 'communityPosts'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as CommunityPost));
      setPosts(fetched);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem deve ter no máximo 5MB');
      return;
    }
    setNewImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handlePublish = async () => {
    if (!userData?.uid || (!newContent.trim() && !newImage)) {
      toast.error('Escreva algo ou adicione uma foto!');
      return;
    }

    setIsPosting(true);
    try {
      let imageUrl = '';
      if (newImage) {
        const storageRef = ref(storage, `community/${userData.uid}/${Date.now()}_${newImage.name}`);
        const upload = await uploadBytesResumable(storageRef, newImage);
        imageUrl = await getDownloadURL(upload.ref);
      }

      // Parse @mentions
      const mentionRegex = /@(\w+)/g;
      const mentionMatches = newContent.match(mentionRegex) || [];
      const mentionIds = mentionMatches
        .map(m => {
          const name = m.replace('@', '');
          const user = allUsers.find(u => u.nome.toLowerCase().includes(name.toLowerCase()));
          return user?.uid;
        })
        .filter(Boolean) as string[];

      const postData = {
        authorId: userData.uid,
        authorName: userData.nome,
        content: newContent,
        imageUrl: imageUrl || undefined,
        mentions: mentionIds,
        likes: [],
        likeCount: 0,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'communityPosts'), postData);

      // Optimistic UI
      setPosts(prev => [{
        ...postData,
        id: docRef.id,
        createdAt: { toDate: () => new Date() }
      }, ...prev]);

      setNewContent('');
      setNewImage(null);
      setImagePreview(null);
      setShowNewPost(false);
      toast.success('Publicação no ar! 🔥');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao publicar. Verifique as configurações de Storage no Firebase.');
    } finally {
      setIsPosting(false);
    }
  };

  const handleLike = async (post: CommunityPost) => {
    if (!userData?.uid || !post.id) return;
    const postRef = doc(db, 'communityPosts', post.id);
    const isLiked = post.likes.includes(userData.uid);

    // Optimistic
    setPosts(prev => prev.map(p =>
      p.id === post.id
        ? {
            ...p,
            likes: isLiked ? p.likes.filter(id => id !== userData.uid) : [...p.likes, userData.uid],
            likeCount: isLiked ? p.likeCount - 1 : p.likeCount + 1
          }
        : p
    ));

    try {
      await updateDoc(postRef, {
        likes: isLiked ? arrayRemove(userData.uid) : arrayUnion(userData.uid),
        likeCount: increment(isLiked ? -1 : 1)
      });
    } catch (e) {
      console.error(e);
    }
  };

  const toggleComments = async (postId: string) => {
    setExpandedComments(prev => ({ ...prev, [postId]: !prev[postId] }));
    if (!commentsData[postId]) {
      try {
        const q = query(collection(db, 'communityPosts', postId, 'comments'), orderBy('createdAt', 'asc'));
        const snap = await getDocs(q);
        setCommentsData(prev => ({
          ...prev,
          [postId]: snap.docs.map(d => ({ id: d.id, ...d.data() } as PostComment))
        }));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleComment = async (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!text || !userData?.uid) return;

    const commentData = {
      authorId: userData.uid,
      authorName: userData.nome,
      content: text,
      createdAt: serverTimestamp(),
    };

    try {
      const docRef = await addDoc(collection(db, 'communityPosts', postId, 'comments'), commentData);
      
      setCommentsData(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), { ...commentData, id: docRef.id, createdAt: { toDate: () => new Date() } }]
      }));
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    } catch (e) {
      console.error(e);
      toast.error('Erro ao comentar');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-[#8A8A7A] gap-4 min-h-[50vh] animate-in fade-in">
        <div className="w-12 h-12 border-4 border-[#D4A947]/20 border-t-[#D4A947] rounded-full animate-spin"></div>
        <p className="font-semibold tracking-wider">Carregando a Comunidade...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6 animate-in fade-in pb-24">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#D4A947]/10 flex items-center justify-center">
            <Users className="text-[#D4A947] w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#F0EDE6]">Comunidade</h1>
            <p className="text-xs text-[#8A8A7A]">Evolução Contínua</p>
          </div>
        </div>
        <Button onClick={() => setShowNewPost(!showNewPost)} size="sm">
          {showNewPost ? 'Cancelar' : 'Publicar'}
        </Button>
      </div>

      {/* NEW POST FORM */}
      {showNewPost && (
        <Card className="bg-[#1A1A1A] border-[#D4A947]/30 space-y-4 animate-in slide-in-from-top-4 duration-300">
          <textarea
            className="w-full h-28 bg-[#0D0D0D] border border-[#333333] rounded-xl p-4 text-sm text-[#F0EDE6] focus:border-[#D4A947] focus:ring-1 focus:ring-[#D4A947] outline-none resize-none transition-all"
            placeholder="Compartilhe sua evolução com a comunidade... Use @nome para marcar alguém!"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
          />
          
          {imagePreview && (
            <div className="relative">
              <img src={imagePreview} alt="Preview" className="w-full max-h-64 object-cover rounded-xl border border-[#333333]" />
              <button
                onClick={() => { setNewImage(null); setImagePreview(null); }}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 flex items-center justify-center text-white"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <input type="file" accept="image/*" className="hidden" ref={fileRef} onChange={handleImageSelect} />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 text-[#8A8A7A] hover:text-[#D4A947] transition-colors text-sm font-medium"
            >
              <ImageIcon size={18} /> Adicionar Foto
            </button>
            <Button onClick={handlePublish} disabled={isPosting} size="sm">
              {isPosting ? <Loader2 className="animate-spin w-4 h-4" /> : <><Send size={14} className="mr-1" /> Publicar</>}
            </Button>
          </div>
        </Card>
      )}

      {/* FEED */}
      {posts.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center bg-[#1A1A1A] border-dashed border-[#333333]">
          <Users size={48} className="text-[#333333] mb-4" />
          <p className="font-medium text-[#F0EDE6]">A comunidade está esperando por você!</p>
          <p className="text-sm text-[#8A8A7A] mt-1">Seja o primeiro a compartilhar sua evolução.</p>
        </Card>
      ) : (
        <div className="space-y-5">
          {posts.map(post => {
            const isLiked = userData?.uid ? post.likes.includes(userData.uid) : false;
            const postComments = commentsData[post.id!] || [];
            const isExpanded = expandedComments[post.id!];

            return (
              <Card key={post.id} className="bg-[#1A1A1A] border-[#333333] overflow-hidden p-0">
                {/* Post Header */}
                <div className="flex items-center gap-3 p-4 pb-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4A947] to-[#B8922E] flex items-center justify-center text-[#0D0D0D] font-bold text-sm shrink-0">
                    {post.authorName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-[#F0EDE6] truncate">{post.authorName}</p>
                    <p className="text-[10px] text-[#8A8A7A]">
                      {post.createdAt?.toDate ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true, locale: ptBR }) : 'agora'}
                    </p>
                  </div>
                </div>

                {/* Post Content */}
                {post.content && (
                  <p className="px-4 pt-3 text-sm text-[#F0EDE6] leading-relaxed whitespace-pre-wrap">
                    {post.content.split(/(@\w+)/g).map((part, i) =>
                      part.startsWith('@')
                        ? <span key={i} className="text-[#D4A947] font-semibold">{part}</span>
                        : part
                    )}
                  </p>
                )}

                {/* Post Image */}
                {post.imageUrl && (
                  <div className="mt-3">
                    <img src={post.imageUrl} alt="Post" className="w-full max-h-[500px] object-cover" />
                  </div>
                )}

                {/* Actions Bar */}
                <div className="flex items-center gap-6 px-4 py-3 border-t border-[#333333]/50 mt-3">
                  <button
                    onClick={() => handleLike(post)}
                    className={`flex items-center gap-2 text-sm font-medium transition-all active:scale-90 ${
                      isLiked ? 'text-red-500' : 'text-[#8A8A7A] hover:text-red-400'
                    }`}
                  >
                    <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} className={isLiked ? 'animate-in zoom-in duration-200' : ''} />
                    {post.likeCount > 0 && <span>{post.likeCount}</span>}
                  </button>

                  <button
                    onClick={() => toggleComments(post.id!)}
                    className="flex items-center gap-2 text-sm font-medium text-[#8A8A7A] hover:text-[#D4A947] transition-colors"
                  >
                    <MessageCircle size={20} />
                    <span>Comentar</span>
                  </button>
                </div>

                {/* Comments Section */}
                {isExpanded && (
                  <div className="bg-[#0D0D0D] border-t border-[#333333] animate-in slide-in-from-top-2 duration-200">
                    {postComments.length > 0 && (
                      <div className="px-4 pt-3 space-y-3">
                        {postComments.map(comment => (
                          <div key={comment.id} className="flex gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#252525] flex items-center justify-center text-[10px] font-bold text-[#8A8A7A] shrink-0 mt-0.5">
                              {comment.authorName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <p className="text-xs">
                                <span className="font-bold text-[#F0EDE6]">{comment.authorName}</span>{' '}
                                <span className="text-[#8A8A7A]">{comment.content}</span>
                              </p>
                              <p className="text-[9px] text-[#8A8A7A]/60 mt-0.5">
                                {comment.createdAt?.toDate ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true, locale: ptBR }) : 'agora'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 p-3">
                      <input
                        type="text"
                        className="flex-1 h-9 bg-[#1A1A1A] border border-[#333333] rounded-full px-4 text-xs text-[#F0EDE6] focus:border-[#D4A947] outline-none transition-all"
                        placeholder="Escreva um comentário..."
                        value={commentInputs[post.id!] || ''}
                        onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id!]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && handleComment(post.id!)}
                      />
                      <button
                        onClick={() => handleComment(post.id!)}
                        className="w-9 h-9 rounded-full bg-[#D4A947] flex items-center justify-center text-[#0D0D0D] hover:brightness-110 transition-all active:scale-90"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CommunityFeed;
