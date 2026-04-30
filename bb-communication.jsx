// bb-communication.jsx — Messaging & notifications
const { useState: useStC, useMemo: useSmC } = React;

function Messages() {
  const [db, setDB] = useStC(BB.getDB());
  const [selected, setSelected] = useStC(null);
  const [compose, setCompose] = useStC(false);
  const [reply, setReply] = useStC('');
  const [tab, setTab] = useStC('inbox'); // inbox | broadcast

  const msgs = useSmC(() => {
    if (tab === 'broadcast') return db.messages.filter(m => m.broadcast);
    return db.messages.filter(m => !m.broadcast).sort((a,b) => b.date.localeCompare(a.date));
  }, [db, tab]);

  function markRead(msg) {
    if (!msg.read) {
      const ndb = { ...db, messages: db.messages.map(m => m.id===msg.id ? {...m, read:true} : m) };
      window._bbDB = ndb; BB.commit(); setDB(ndb);
      setSelected({...msg, read:true});
    } else {
      setSelected(msg);
    }
  }

  function sendReply() {
    if (!reply.trim() || !selected) return;
    const ndb = { ...db, messages: db.messages.map(m => m.id===selected.id ? {
      ...m, read:true,
      replies:[...(m.replies||[]), { fromRole:'admin', fromName:'Blackbird School', content:reply, date:new Date().toISOString() }]
    } : m) };
    window._bbDB = ndb; BB.commit(); setDB(ndb);
    const updated = ndb.messages.find(m => m.id===selected.id);
    setSelected(updated);
    setReply('');
  }

  function sendBroadcast(form) {
    const ndb = { ...db, messages: [{ id:'m'+Date.now(), fromRole:'admin', fromName:'Blackbird School', studentId:null, subject:form.subject, content:form.content, date:new Date().toISOString(), read:true, replies:[], broadcast:true }, ...db.messages] };
    window._bbDB = ndb; BB.commit(); setDB(ndb); setCompose(false);
  }

  const unread = db.messages.filter(m=>!m.read && m.fromRole==='parent').length;

  const typeIcon = { parent:'👨‍👩‍👧', admin:'📢' };

  return (
    <div style={{ padding:'28px 36px', height:'calc(100vh - 64px)', display:'flex', flexDirection:'column' }}>
      {compose && <ComposeModal db={db} onClose={() => setCompose(false)} onSend={sendBroadcast} />}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:18, color:'#1E1B4B' }}>Tin nhắn & Thông báo</div>
          <div style={{ fontSize:13, color:'#7C6D9B', marginTop:2 }}>{unread} tin chưa đọc</div>
        </div>
        <button onClick={() => setCompose(true)} style={{ padding:'10px 22px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#6D28D9,#8B5CF6)', color:'#fff', fontFamily:'Nunito,sans-serif', fontWeight:800, fontSize:14, cursor:'pointer', boxShadow:'0 2px 8px rgba(109,40,217,0.3)' }}>📢 Gửi thông báo</button>
      </div>

      <div style={{ display:'flex', gap:0, marginBottom:14 }}>
        {[['inbox','Hộp thư đến'], ['broadcast','Thông báo trường']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding:'8px 20px', border:'none', borderBottom:`2.5px solid ${tab===id?'#7C3AED':'transparent'}`, background:'none', fontFamily:'Nunito,sans-serif', fontWeight:700, fontSize:14, color:tab===id?'#7C3AED':'#6B6494', cursor:'pointer' }}>{label}</button>
        ))}
      </div>

      <div style={{ flex:1, display:'grid', gridTemplateColumns:'320px 1fr', gap:14, minHeight:0 }}>
        {/* Message list */}
        <div style={{ background:'#fff', borderRadius:16, boxShadow:'0 2px 14px rgba(109,40,217,0.07)', overflowY:'auto' }}>
          {msgs.length === 0 && <div style={{ textAlign:'center', padding:'40px', color:'#7C6D9B', fontSize:13 }}>Không có tin nhắn</div>}
          {msgs.map(m => {
            const student = m.studentId ? db.students.find(s=>s.id===m.studentId) : null;
            const isSelected = selected?.id === m.id;
            return (
              <div key={m.id} onClick={() => markRead(m)} style={{
                padding:'14px 16px', borderBottom:'1px solid #EDE9FE', cursor:'pointer',
                background: isSelected ? '#EDE9FE' : (!m.read && m.fromRole==='parent') ? '#F8F7FF' : '#fff',
                transition:'background 0.1s',
                borderLeft: isSelected ? '3px solid #7C3AED' : '3px solid transparent'
              }}>
                <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                  <div style={{ width:36, height:36, borderRadius:999, background:'linear-gradient(135deg,#7C3AED,#A78BFA)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:13, flexShrink:0 }}>
                    {m.fromRole==='admin' ? '🐦' : m.fromName.charAt(0)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontWeight: !m.read ? 800 : 600, fontSize:13, color:'#1E1B4B' }}>{m.fromName}</span>
                      <span style={{ fontSize:10, color:'#7C6D9B' }}>{new Date(m.date).toLocaleDateString('vi-VN')}</span>
                    </div>
                    <div style={{ fontSize:12, fontWeight:700, color:'#6B6494', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.subject}</div>
                    {student && <div style={{ fontSize:10, color:'#7C6D9B' }}>PH của {student.name}</div>}
                    {!m.read && m.fromRole==='parent' && <div style={{ width:8, height:8, borderRadius:999, background:'#7C3AED', display:'inline-block', marginTop:2 }}></div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Message detail */}
        {selected ? (
          <div style={{ background:'#fff', borderRadius:16, boxShadow:'0 2px 14px rgba(109,40,217,0.07)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'18px 20px', borderBottom:'1.5px solid #DDD6FE' }}>
              <div style={{ fontWeight:800, fontSize:16, color:'#1E1B4B', marginBottom:4 }}>{selected.subject}</div>
              <div style={{ fontSize:12, color:'#7C6D9B' }}>
                Từ: <strong>{selected.fromName}</strong> · {BB.fmtDateTime(selected.date)}
                {selected.studentId && (() => { const s = db.students.find(st=>st.id===selected.studentId); return s ? ` · Phụ huynh của ${s.name}` : ''; })()}
              </div>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'18px 20px', display:'flex', flexDirection:'column', gap:14 }}>
              {/* Original message */}
              <div style={{ background:'#F8F7FF', borderRadius:12, padding:'14px 16px' }}>
                <div style={{ fontSize:12, color:'#7C6D9B', fontWeight:700, marginBottom:6 }}>
                  {selected.fromRole==='parent'?'👨‍👩‍👧 Phụ huynh':'📢 Nhà trường'}
                </div>
                <div style={{ fontSize:14, color:'#1E1B4B', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{selected.content}</div>
              </div>
              {/* Replies */}
              {(selected.replies||[]).map((r, i) => (
                <div key={i} style={{ background: r.fromRole==='admin' ? '#EDE9FE' : '#F8F7FF', borderRadius:12, padding:'14px 16px', alignSelf: r.fromRole==='admin' ? 'flex-end' : 'flex-start', maxWidth:'80%' }}>
                  <div style={{ fontSize:12, color:'#7C6D9B', fontWeight:700, marginBottom:6 }}>
                    {r.fromRole==='admin'?'🐦 Nhà trường':'👨‍👩‍👧 Phụ huynh'} · {BB.fmtDateTime(r.date)}
                  </div>
                  <div style={{ fontSize:14, color:'#1E1B4B', lineHeight:1.6 }}>{r.content}</div>
                </div>
              ))}
            </div>
            {!selected.broadcast && (
              <div style={{ padding:'14px 16px', borderTop:'1.5px solid #DDD6FE', display:'flex', gap:10 }}>
                <textarea value={reply} onChange={e => setReply(e.target.value)}
                  placeholder="Nhập phản hồi..."
                  style={{ flex:1, padding:'10px 14px', borderRadius:10, border:'1.5px solid #DDD6FE', fontFamily:'Nunito,sans-serif', fontSize:13, resize:'none', height:60, outline:'none' }} />
                <button onClick={sendReply} style={{ padding:'10px 20px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#6D28D9,#8B5CF6)', color:'#fff', fontFamily:'Nunito,sans-serif', fontWeight:800, fontSize:13, cursor:'pointer', alignSelf:'flex-end' }}>Gửi</button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ background:'#fff', borderRadius:16, boxShadow:'0 2px 14px rgba(109,40,217,0.07)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:10 }}>
            <div style={{ fontSize:48 }}>💬</div>
            <div style={{ fontSize:14, color:'#7C6D9B', fontWeight:600 }}>Chọn tin nhắn để xem</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ComposeModal({ db, onClose, onSend }) {
  const [form, setForm] = useStC({ subject:'', content:'', type:'all' });
  const inputStyle = { width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #DDD6FE', fontFamily:'Nunito,sans-serif', fontSize:13, color:'#1E1B4B', outline:'none', boxSizing:'border-box' };
  const labelStyle = { fontSize:12, fontWeight:700, color:'#6B6494', display:'block', marginBottom:4 };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#fff', borderRadius:20, width:520, padding:28, boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ fontWeight:800, fontSize:17, color:'#1E1B4B', marginBottom:20 }}>📢 Gửi thông báo đến phụ huynh</div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={labelStyle}>Gửi đến</label>
            <select style={inputStyle} value={form.type} onChange={e => setForm({...form,type:e.target.value})}>
              <option value="all">Tất cả phụ huynh</option>
              {db.classes.map(c => <option key={c.id} value={c.id}>Phụ huynh lớp {c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Tiêu đề thông báo</label>
            <input style={inputStyle} value={form.subject} onChange={e => setForm({...form,subject:e.target.value})} placeholder="VD: Thông báo nghỉ lễ 30/4" />
          </div>
          <div>
            <label style={labelStyle}>Nội dung</label>
            <textarea style={{ ...inputStyle, resize:'vertical', minHeight:120 }} value={form.content} onChange={e => setForm({...form,content:e.target.value})} placeholder="Nhập nội dung thông báo..." />
          </div>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:22, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'9px 20px', borderRadius:10, border:'1.5px solid #DDD6FE', background:'#fff', fontFamily:'Nunito,sans-serif', fontSize:13, fontWeight:700, color:'#6B6494', cursor:'pointer' }}>Hủy</button>
          <button onClick={() => form.subject && form.content && onSend(form)} style={{ padding:'9px 24px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#6D28D9,#8B5CF6)', color:'#fff', fontFamily:'Nunito,sans-serif', fontSize:13, fontWeight:700, cursor:'pointer' }}>📤 Gửi thông báo</button>
        </div>
      </div>
    </div>
  );
}

window.Messages = Messages;
