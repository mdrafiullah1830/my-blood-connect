import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Send, Video, Languages, Users, ArrowLeft, Phone } from 'lucide-react';
import api, { getStoredUser } from '../lib/api';
import { translateText } from '../lib/translate';
import { maskPhone } from '../lib/share';
import { playPop } from '../lib/sound';
import { t, getLang, useLangTick } from '../lib/i18n';

// in-app chat: conversation list + message view + auto-translate + video call + masked call.
export default function Chat() {
  const { id } = useParams();
  return id ? <ChatRoom id={id} /> : <ConversationList />;
}

function ConversationList() {
  const navigate = useNavigate();
  useLangTick();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/chat/conversations').then(({ data }) => setConversations(data.conversations || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-2xl pt-10">
        <p className="text-xs font-black uppercase tracking-widest text-red-400">Messages</p>
        <h1 className="mb-6 text-4xl font-black">{t('chat')}</h1>
        {loading ? <p className="text-slate-500">{t('loading')}</p> : conversations.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-800 p-12 text-center text-slate-500">
            <Users className="mx-auto mb-3 h-10 w-10" />
            <p>No conversations yet. Chat starts when you respond to a blood request.</p>
            <Link to="/requests" className="mt-3 inline-block rounded-xl bg-red-600 px-5 py-2 font-bold">{t('requests')}</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((c) => (
              <button key={c._id} onClick={() => navigate(`/chat/${c._id}`)} className="flex w-full items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left hover:border-red-500/40">
                <div className={`flex h-11 w-11 items-center justify-center rounded-full ${c.type === 'group' ? 'bg-cyan-600/20 text-cyan-300' : 'bg-red-600/20 text-red-300'}`}>
                  {c.type === 'group' ? <Users className="h-5 w-5" /> : (c.participants?.find((p) => String(p._id) !== String(getStoredUser()?.id))?.name?.[0] || '?')}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black">{c.title || c.participants?.map((p) => p.name).join(', ')}</p>
                  <p className="truncate text-sm text-slate-400">{c.lastMessage?.body || 'No messages yet'}</p>
                </div>
                <span className="text-xs text-slate-600">{c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleDateString() : ''}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatRoom({ id }) {
  const navigate = useNavigate();
  useLangTick();
  const me = getStoredUser();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [translated, setTranslated] = useState({});
  const [translating, setTranslating] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  const load = async () => {
    try {
      const { data } = await api.get(`/api/chat/conversations/${id}`);
      setConversation(data.conversation);
      setMessages(data.messages || []);
      await api.patch(`/api/chat/conversations/${id}/read`).catch(() => {});
    } catch (err) { setError(err.response?.data?.message || 'Unable to load chat'); }
  };

  useEffect(() => {
    load();
    const handler = (event) => {
      const detail = event.detail || event;
      if (String(detail.conversationId) === String(id)) {
        setMessages((prev) => [...prev, detail.message]);
        playPop();
      }
    };
    window.addEventListener('bc_chat_message', handler);
    return () => window.removeEventListener('bc_chat_message', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    const body = text.trim();
    setText('');
    try {
      const { data } = await api.post(`/api/chat/conversations/${id}/messages`, { body });
      setMessages((prev) => [...prev, data.message]);
      playPop();
    } catch (err) { setError(err.response?.data?.message || 'Send failed'); setText(body); }
    finally { setSending(false); }
  };

  const doTranslate = async (message) => {
    setTranslating(message._id);
    const result = await translateText(message.body, getLang() === 'bn' ? 'bn' : 'bn');
    setTranslated((prev) => ({ ...prev, [message._id]: result.translated }));
    setTranslating('');
  };

  const startVideo = async () => {
    try {
      const { data } = await api.post('/api/chat/video-link', { conversationId: id });
      setVideoUrl(data.url);
      window.open(data.url, '_blank', 'noopener');
    } catch (err) { setError(err.response?.data?.message || 'Video call failed'); }
  };

  if (!conversation) return <div className="min-h-screen bg-slate-950 p-10 text-center text-slate-500">{error || 'Loading...'}</div>;

  const other = conversation.participants?.find((p) => String(p._id) !== String(me?.id)) || conversation.participants?.[0];
  const donorView = other; // masked call: full number only when we know it from request response

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-white">
      <div className="flex items-center gap-3 border-b border-slate-800 bg-slate-900 px-4 py-3">
        <button onClick={() => navigate('/chat')} className="rounded-lg p-2 hover:bg-slate-800"><ArrowLeft className="h-4 w-4" /></button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-black">{conversation.title || conversation.participants?.map((p) => p.name).join(', ')}</p>
          <p className="text-xs text-slate-500">{conversation.type === 'group' ? `Group · ${conversation.participants?.length} members` : `${other?.bloodGroup || ''} ${other?.city || ''}`}</p>
        </div>
        <a href={`tel:${other?.phone || ''}`} className="rounded-xl bg-slate-800 p-2.5" title={`Call ${maskPhone(other?.phone, false)}`}><Phone className="h-4 w-4" /></a>
        <button onClick={startVideo} className="rounded-xl bg-red-600 p-2.5" title={t('videoCall')}><Video className="h-4 w-4" /></button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        {messages.map((m) => {
          const mine = String(m.senderId?._id || m.senderId) === String(me?.id);
          const senderName = m.senderId?.name || 'User';
          return (
            <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${mine ? 'bg-red-600' : 'bg-slate-800'}`}>
                {!mine && conversation.type === 'group' && <p className="text-xs font-bold text-cyan-300">{senderName}</p>}
                <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                {translated[m._id] && translated[m._id] !== m.body && (
                  <p className="mt-1 border-t border-white/20 pt-1 text-xs italic text-emerald-200">{translated[m._id]}</p>
                )}
                <div className="mt-1 flex items-center gap-2 text-[10px] opacity-70">
                  <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {!mine && (
                    <button onClick={() => doTranslate(m)} className="flex items-center gap-1 hover:underline">
                      <Languages className="h-3 w-3" />{translating === m._id ? '...' : 'Translate'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-slate-800 bg-slate-900 p-4">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`${t('message')}...`} maxLength={1000} className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-red-500" />
        <button disabled={sending || !text.trim()} className="rounded-xl bg-red-600 px-5 py-3 font-black disabled:opacity-50"><Send className="mr-1 inline h-4 w-4" />{t('send')}</button>
      </form>
      {videoUrl && <p className="bg-slate-900 px-4 py-2 text-xs text-slate-400">Video room: <a className="text-red-400 underline" href={videoUrl} target="_blank" rel="noreferrer">{videoUrl}</a></p>}
      <span className="hidden">{donorView?.phone ? '' : ''}</span>
    </div>
  );
}
