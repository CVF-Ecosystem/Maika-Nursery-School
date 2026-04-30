// bb-resources.jsx — Resource library
const { useState: useStR } = React;

const RES_TYPES = { pdf:'📄', video:'🎬', audio:'🎵', doc:'📝', image:'🖼️', link:'🔗' };
const RES_CATS  = { music:'Âm nhạc', math:'Toán học', art:'Nghệ thuật', literacy:'Chữ & đọc', plan:'Kế hoạch', physical:'Thể chất', other:'Khác' };

function Resources() {
  const [db, setDB] = useStR(BB.getDB());
  const [search, setSearch] = useStR('');
  const [filterCat, setFilterCat] = useStR('all');
  const [modal, setModal] = useStR(false);

  const filtered = db.resources.filter(r => {
    if (filterCat !== 'all' && r.category !== filterCat) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function saveResource(form) {
    const ndb = { ...db, resources: [{ ...form, id:'r'+Date.now(), uploadDate:BB.todayStr() }, ...db.resources] };
    window._bbDB = ndb; BB.commit(); setDB(ndb); setModal(false);
  }

  function deleteResource(id) {
    const ndb = { ...db, resources: db.resources.filter(r => r.id !== id) };
    window._bbDB = ndb; BB.commit(); setDB(ndb);
  }

  const selStyle = { padding:'8px 12px', borderRadius:10, border:'1.5px solid #DDD6FE', fontFamily:'Nunito,sans-serif', fontSize:13, color:'#1E1B4B', background:'#fff', cursor:'pointer' };

  return (
    <div style={{ padding:'28px 36px' }}>
      {modal && <ResourceModal onClose={() => setModal(false)} onSave={saveResource} />}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:18, color:'#1E1B4B' }}>Thư viện tài nguyên</div>
          <div style={{ fontSize:13, color:'#7C6D9B', marginTop:2 }}>{db.resources.length} tài liệu · Giáo cụ và học liệu</div>
        </div>
        <button onClick={() => setModal(true)} style={{ padding:'10px 22px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#6D28D9,#8B5CF6)', color:'#fff', fontFamily:'Nunito,sans-serif', fontWeight:800, fontSize:14, cursor:'pointer', boxShadow:'0 2px 8px rgba(109,40,217,0.3)' }}>+ Thêm tài liệu</button>
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Tìm tài liệu..." style={{ ...selStyle, flex:1 }} />
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={selStyle}>
          <option value="all">Tất cả danh mục</option>
          {Object.entries(RES_CATS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Category pills */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:18 }}>
        {['all', ...Object.keys(RES_CATS)].map(cat => (
          <button key={cat} onClick={() => setFilterCat(cat)} style={{
            padding:'5px 14px', borderRadius:20, border:'none', cursor:'pointer', fontFamily:'Nunito,sans-serif', fontWeight:700, fontSize:12,
            background: filterCat===cat ? '#7C3AED' : '#DDD6FE',
            color: filterCat===cat ? '#fff' : '#6B6494', transition:'all 0.15s'
          }}>{cat === 'all' ? 'Tất cả' : RES_CATS[cat]}</button>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px,1fr))', gap:14 }}>
        {filtered.map(r => (
          <ResourceCard key={r.id} resource={r} onDelete={deleteResource} />
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'60px', color:'#7C6D9B', fontSize:14 }}>
            <div style={{ fontSize:48, marginBottom:12 }}>📚</div>
            <div>Chưa có tài liệu nào</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResourceCard({ resource: r, onDelete }) {
  const catColors = { music:'#7C3AED', math:'#7C3AED', art:'#EC4899', literacy:'#16A34A', plan:'#06B6D4', physical:'#7C3AED', other:'#6B6494' };
  const col = catColors[r.category] || '#6B6494';
  return (
    <div style={{ background:'#fff', borderRadius:14, padding:'16px 18px', boxShadow:'0 2px 14px rgba(109,40,217,0.07)', display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
        <div style={{ width:44, height:44, borderRadius:12, background:col+'18', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
          {RES_TYPES[r.type]||'📁'}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:13, color:'#1E1B4B', lineHeight:1.3 }}>{r.title}</div>
          <div style={{ display:'flex', gap:6, marginTop:4, flexWrap:'wrap' }}>
            <span style={{ fontSize:10, fontWeight:700, color:col, background:col+'18', borderRadius:5, padding:'1px 7px' }}>{RES_CATS[r.category]||r.category}</span>
            <span style={{ fontSize:10, fontWeight:700, color:'#6B6494', background:'#F5F5F4', borderRadius:5, padding:'1px 7px' }}>{r.type?.toUpperCase()}</span>
          </div>
        </div>
      </div>
      <div style={{ fontSize:11, color:'#7C6D9B', display:'flex', justifyContent:'space-between' }}>
        <span>👤 {r.uploader}</span>
        <span>📅 {BB.fmtDate(r.uploadDate)}</span>
        {r.size && <span>💾 {r.size}</span>}
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button style={{ flex:1, padding:'7px 0', borderRadius:8, border:'none', background:'linear-gradient(135deg,#6D28D9,#8B5CF6)', color:'#fff', fontFamily:'Nunito,sans-serif', fontWeight:700, fontSize:12, cursor:'pointer' }}>⬇ Tải xuống</button>
        <button onClick={() => onDelete(r.id)} style={{ padding:'7px 12px', borderRadius:8, border:'1.5px solid #DDD6FE', background:'#fff', color:'#DC2626', fontFamily:'Nunito,sans-serif', fontWeight:700, fontSize:12, cursor:'pointer' }}>🗑</button>
      </div>
    </div>
  );
}

function ResourceModal({ onClose, onSave }) {
  const [form, setForm] = useStR({ title:'', type:'pdf', category:'other', uploader:'', size:'' });
  const inputStyle = { width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #DDD6FE', fontFamily:'Nunito,sans-serif', fontSize:13, color:'#1E1B4B', outline:'none', boxSizing:'border-box' };
  const labelStyle = { fontSize:12, fontWeight:700, color:'#6B6494', display:'block', marginBottom:4 };
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#fff', borderRadius:20, width:440, padding:28, boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ fontWeight:800, fontSize:17, color:'#1E1B4B', marginBottom:20 }}>Thêm tài liệu mới</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={labelStyle}>Tên tài liệu *</label>
            <input style={inputStyle} value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="VD: Bài hát thiếu nhi Q2" />
          </div>
          <div>
            <label style={labelStyle}>Loại file</label>
            <select style={inputStyle} value={form.type} onChange={e => setForm({...form,type:e.target.value})}>
              {Object.entries(RES_TYPES).map(([k,v]) => <option key={k} value={k}>{v} {k.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Danh mục</label>
            <select style={inputStyle} value={form.category} onChange={e => setForm({...form,category:e.target.value})}>
              {Object.entries(RES_CATS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Người tải lên</label>
            <input style={inputStyle} value={form.uploader} onChange={e => setForm({...form,uploader:e.target.value})} placeholder="Tên giáo viên" />
          </div>
          <div>
            <label style={labelStyle}>Kích thước</label>
            <input style={inputStyle} value={form.size} onChange={e => setForm({...form,size:e.target.value})} placeholder="VD: 5 MB" />
          </div>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:22, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'9px 20px', borderRadius:10, border:'1.5px solid #DDD6FE', background:'#fff', fontFamily:'Nunito,sans-serif', fontSize:13, fontWeight:700, color:'#6B6494', cursor:'pointer' }}>Hủy</button>
          <button onClick={() => form.title && onSave(form)} style={{ padding:'9px 24px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#6D28D9,#8B5CF6)', color:'#fff', fontFamily:'Nunito,sans-serif', fontSize:13, fontWeight:700, cursor:'pointer' }}>Lưu</button>
        </div>
      </div>
    </div>
  );
}

// ---- Gamification ----
const BADGE_META = {
  star:   { icon:'⭐', label:'Ngôi sao', color:'#A78BFA', desc:'Học sinh xuất sắc trong tuần' },
  book:   { icon:'📖', label:'Sâu đọc sách', color:'#7C3AED', desc:'Đọc nhiều sách nhất' },
  music:  { icon:'🎵', label:'Họa mi nhí', color:'#EC4899', desc:'Năng khiếu âm nhạc' },
  crown:  { icon:'👑', label:'Học sinh xuất sắc', color:'#7C3AED', desc:'Kết quả tốt nhất tháng' },
  heart:  { icon:'❤️', label:'Bạn tốt', color:'#DC2626', desc:'Hay giúp đỡ bạn bè' },
  rocket: { icon:'🚀', label:'Tiến bộ nhanh', color:'#06B6D4', desc:'Tiến bộ vượt bậc' },
};

function Gamification() {
  const [db, setDB] = useStR(BB.getDB());
  const [modal, setModal] = useStR(false);

  function awardBadge(form) {
    const ndb = { ...db, badges: [{ ...form, id:'b'+Date.now(), earnedDate:BB.todayStr() }, ...db.badges] };
    window._bbDB = ndb; BB.commit(); setDB(ndb); setModal(false);
  }

  function removeBadge(id) {
    const ndb = { ...db, badges: db.badges.filter(b => b.id !== id) };
    window._bbDB = ndb; BB.commit(); setDB(ndb);
  }

  // Leaderboard: students with most badges
  const leaderboard = db.students.filter(s=>s.status==='active').map(s => ({
    ...s, badges: db.badges.filter(b=>b.studentId===s.id)
  })).filter(s=>s.badges.length>0).sort((a,b)=>b.badges.length-a.badges.length);

  return (
    <div style={{ padding:'28px 36px' }}>
      {modal && <BadgeModal db={db} onClose={() => setModal(false)} onSave={awardBadge} />}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:18, color:'#1E1B4B' }}>Thành tích & Khen thưởng</div>
          <div style={{ fontSize:13, color:'#7C6D9B', marginTop:2 }}>Ghi nhận và tạo động lực cho các bé</div>
        </div>
        <button onClick={() => setModal(true)} style={{ padding:'10px 22px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#6D28D9,#8B5CF6)', color:'#fff', fontFamily:'Nunito,sans-serif', fontWeight:800, fontSize:14, cursor:'pointer', boxShadow:'0 2px 8px rgba(109,40,217,0.3)' }}>🏅 Trao huy hiệu</button>
      </div>

      {/* Badge type legend */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:10, marginBottom:24 }}>
        {Object.entries(BADGE_META).map(([key, m]) => (
          <div key={key} style={{ background:'#fff', borderRadius:12, padding:'12px 10px', textAlign:'center', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize:28, marginBottom:4 }}>{m.icon}</div>
            <div style={{ fontSize:11, fontWeight:800, color:m.color }}>{m.label}</div>
            <div style={{ fontSize:10, color:'#7C6D9B', marginTop:2 }}>{db.badges.filter(b=>b.badge===key).length} lần trao</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:18 }}>
        {/* Recent badges */}
        <div>
          <div style={{ fontWeight:800, fontSize:14, color:'#1E1B4B', marginBottom:12 }}>Huy hiệu gần đây</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
            {db.badges.sort((a,b)=>b.earnedDate.localeCompare(a.earnedDate)).map(b => {
              const student = db.students.find(s=>s.id===b.studentId);
              const meta = BADGE_META[b.badge] || { icon:'🌟', label:b.badge, color:'#6B6494' };
              const cls = db.classes.find(c=>c.id===student?.classId);
              return (
                <div key={b.id} style={{ background:'#fff', borderRadius:14, padding:'14px 16px', boxShadow:'0 2px 14px rgba(109,40,217,0.07)', display:'flex', gap:12, alignItems:'center' }}>
                  <div style={{ width:48, height:48, borderRadius:12, background:meta.color+'18', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0 }}>{meta.icon}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:800, fontSize:13, color:meta.color }}>{meta.label}</div>
                    {student && <div style={{ fontWeight:700, fontSize:12, color:'#1E1B4B' }}>{student.name}</div>}
                    {cls && <div style={{ fontSize:10, color:'#7C6D9B' }}>{cls.name}</div>}
                    {b.note && <div style={{ fontSize:11, color:'#6B6494', fontStyle:'italic', marginTop:2 }}>"{b.note}"</div>}
                    <div style={{ fontSize:10, color:'#7C6D9B', marginTop:2 }}>{BB.fmtDate(b.earnedDate)}</div>
                  </div>
                  <button onClick={() => removeBadge(b.id)} style={{ padding:'4px 8px', borderRadius:6, border:'none', background:'#FEF2F2', color:'#DC2626', fontSize:12, cursor:'pointer' }}>✕</button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leaderboard */}
        <div>
          <div style={{ fontWeight:800, fontSize:14, color:'#1E1B4B', marginBottom:12 }}>🏆 Bảng xếp hạng</div>
          <div style={{ background:'#fff', borderRadius:16, boxShadow:'0 2px 14px rgba(109,40,217,0.07)', overflow:'hidden' }}>
            {leaderboard.length === 0 && <div style={{ padding:'30px', textAlign:'center', color:'#7C6D9B', fontSize:13 }}>Chưa có thành tích nào</div>}
            {leaderboard.map((s, i) => {
              const cls = db.classes.find(c=>c.id===s.classId);
              const medals = ['🥇','🥈','🥉'];
              return (
                <div key={s.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:'1px solid #EDE9FE' }}>
                  <div style={{ width:28, textAlign:'center', fontSize:18, flexShrink:0 }}>{medals[i]||`#${i+1}`}</div>
                  <Avatar initials={s.initials} size={34} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:'#1E1B4B' }}>{s.name}</div>
                    <div style={{ fontSize:11, color:'#7C6D9B' }}>{cls?.name}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontWeight:900, fontSize:18, color:'#7C3AED' }}>{s.badges.length}</div>
                    <div style={{ fontSize:10, color:'#7C6D9B' }}>huy hiệu</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function BadgeModal({ db, onClose, onSave }) {
  const [form, setForm] = useStR({ studentId:'s1', badge:'star', name:'', note:'' });
  const inputStyle = { width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #DDD6FE', fontFamily:'Nunito,sans-serif', fontSize:13, color:'#1E1B4B', outline:'none', boxSizing:'border-box' };
  const labelStyle = { fontSize:12, fontWeight:700, color:'#6B6494', display:'block', marginBottom:4 };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#fff', borderRadius:20, width:440, padding:28, boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ fontWeight:800, fontSize:17, color:'#1E1B4B', marginBottom:20 }}>🏅 Trao huy hiệu</div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={labelStyle}>Học sinh</label>
            <select style={inputStyle} value={form.studentId} onChange={e => setForm({...form,studentId:e.target.value})}>
              {db.students.filter(s=>s.status==='active').map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Loại huy hiệu</label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {Object.entries(BADGE_META).map(([key,m]) => (
                <button key={key} onClick={() => setForm({...form, badge:key, name:m.label})} style={{
                  padding:'10px 6px', borderRadius:10, border:`2px solid ${form.badge===key?m.color:'#DDD6FE'}`,
                  background: form.badge===key ? m.color+'18' : '#fff', cursor:'pointer', textAlign:'center',
                  fontFamily:'Nunito,sans-serif', transition:'all 0.15s'
                }}>
                  <div style={{ fontSize:22 }}>{m.icon}</div>
                  <div style={{ fontSize:10, fontWeight:700, color:m.color, marginTop:2 }}>{m.label}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Lý do / Ghi chú</label>
            <input style={inputStyle} value={form.note} onChange={e => setForm({...form,note:e.target.value})} placeholder="VD: Ngoan ngoãn và học giỏi tháng 4" />
          </div>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:22, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'9px 20px', borderRadius:10, border:'1.5px solid #DDD6FE', background:'#fff', fontFamily:'Nunito,sans-serif', fontSize:13, fontWeight:700, color:'#6B6494', cursor:'pointer' }}>Hủy</button>
          <button onClick={() => onSave(form)} style={{ padding:'9px 24px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#6D28D9,#8B5CF6)', color:'#fff', fontFamily:'Nunito,sans-serif', fontSize:13, fontWeight:700, cursor:'pointer' }}>🏅 Trao huy hiệu</button>
        </div>
      </div>
    </div>
  );
}

window.Resources = Resources;
window.Gamification = Gamification;
