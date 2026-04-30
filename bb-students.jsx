// bb-students.jsx — Student management
const { useState: useSt, useMemo: useSm, useRef: useStRef } = React;

function exportCSV(students, classes) {
  const headers = ['Họ tên','Ngày sinh','Lớp','Giới tính','Phụ huynh','Điện thoại','Email PH','Ngày nhập học','Trạng thái'];
  const rows = students.map(s => {
    const cls = classes.find(c => c.id === s.classId);
    return [
      s.name, s.dob, cls?.name||'', s.gender==='male'?'Nam':'Nữ',
      s.parentName, s.parentPhone, s.parentEmail, s.enrollDate,
      s.status==='active'?'Đang học':'Nghỉ học'
    ];
  });
  const csv = [headers, ...rows].map(r => r.map(v => `"${(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'blackbird-hoc-sinh.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

function parseCSV(text) {
  const lines = text.trim().split('\n').slice(1); // skip header
  return lines.map(line => {
    const cols = line.split(',').map(v => v.replace(/^"|"$/g,'').replace(/""/g,'"').trim());
    const [name, dob, , gender, parentName, parentPhone, parentEmail, enrollDate] = cols;
    const initials = name.split(' ').filter(Boolean).slice(-2).map(w=>w[0].toUpperCase()).join('');
    return { id:'s'+Date.now()+Math.random(), name, dob, classId:'c1', gender: gender==='Nam'?'male':'female', parentName, parentPhone, parentEmail, enrollDate: enrollDate||BB.todayStr(), status:'active', initials };
  }).filter(s => s.name);
}

function Avatar({ initials, size=38, color='#7C3AED' }) {
  const colors = ['#7C3AED','#A78BFA','#34D399','#7C3AED','#06B6D4','#EC4899'];
  const c = colors[(initials.charCodeAt(0)||0) % colors.length];
  return (
    <div style={{
      width:size, height:size, borderRadius:999,
      background:`linear-gradient(135deg,${c},${c}99)`,
      display:'flex', alignItems:'center', justifyContent:'center',
      color:'#fff', fontWeight:800, fontSize:size*0.35, flexShrink:0
    }}>{initials}</div>
  );
}

function Badge({ status }) {
  const map = { active:['#16A34A','#F0FDF4','Đang học'], inactive:['#DC2626','#FEF2F2','Nghỉ học'] };
  const [col, bg, label] = map[status] || ['#6B6494','#F5F5F4','Không rõ'];
  return <span style={{ background:bg, color:col, borderRadius:6, fontSize:11, fontWeight:700, padding:'2px 8px' }}>{label}</span>;
}

function StudentModal({ student, db, onClose, onSave }) {
  const [form, setForm] = useSt(student || {
    name:'', dob:'', classId:'c1', gender:'male',
    parentName:'', parentPhone:'', parentEmail:'',
    enrollDate: BB.todayStr(), status:'active', initials:''
  });

  function handleChange(k, v) {
    const upd = { ...form, [k]:v };
    if (k === 'name') upd.initials = v.split(' ').filter(Boolean).slice(-2).map(w=>w[0].toUpperCase()).join('');
    setForm(upd);
  }

  const inputStyle = {
    width:'100%', padding:'8px 12px', borderRadius:8, border:'1.5px solid #DDD6FE',
    fontFamily:'Nunito,sans-serif', fontSize:13, color:'#1E1B4B', outline:'none',
    boxSizing:'border-box'
  };
  const labelStyle = { fontSize:12, fontWeight:700, color:'#6B6494', display:'block', marginBottom:4 };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#fff', borderRadius:20, width:540, maxHeight:'90vh', overflowY:'auto', padding:28, boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ fontWeight:800, fontSize:17, color:'#1E1B4B', marginBottom:20 }}>
          {student ? 'Chỉnh sửa học sinh' : 'Thêm học sinh mới'}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={labelStyle}>Họ và tên *</label>
            <input style={inputStyle} value={form.name} onChange={e => handleChange('name', e.target.value)} placeholder="VD: Nguyễn Minh An" />
          </div>
          <div>
            <label style={labelStyle}>Ngày sinh *</label>
            <input type="date" style={inputStyle} value={form.dob} onChange={e => handleChange('dob', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Giới tính</label>
            <select style={inputStyle} value={form.gender} onChange={e => handleChange('gender', e.target.value)}>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Lớp *</label>
            <select style={inputStyle} value={form.classId} onChange={e => handleChange('classId', e.target.value)}>
              {db.classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.ageGroup})</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Ngày nhập học</label>
            <input type="date" style={inputStyle} value={form.enrollDate} onChange={e => handleChange('enrollDate', e.target.value)} />
          </div>
          <div style={{ gridColumn:'1/-1', background:'#FFF7ED', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontWeight:700, fontSize:13, color:'#7C3AED', marginBottom:10 }}>Thông tin phụ huynh</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={labelStyle}>Tên phụ huynh *</label>
                <input style={inputStyle} value={form.parentName} onChange={e => handleChange('parentName', e.target.value)} placeholder="Họ tên phụ huynh" />
              </div>
              <div>
                <label style={labelStyle}>Số điện thoại</label>
                <input style={inputStyle} value={form.parentPhone} onChange={e => handleChange('parentPhone', e.target.value)} placeholder="09xxxxxxxx" />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input style={inputStyle} value={form.parentEmail} onChange={e => handleChange('parentEmail', e.target.value)} placeholder="email@example.com" />
              </div>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Trạng thái</label>
            <select style={inputStyle} value={form.status} onChange={e => handleChange('status', e.target.value)}>
              <option value="active">Đang học</option>
              <option value="inactive">Nghỉ học</option>
            </select>
          </div>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:22, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'9px 20px', borderRadius:10, border:'1.5px solid #DDD6FE', background:'#fff', fontFamily:'Nunito,sans-serif', fontSize:13, fontWeight:700, color:'#6B6494', cursor:'pointer' }}>Hủy</button>
          <button onClick={() => onSave(form)} style={{ padding:'9px 24px', borderRadius:10, border:'none', background:'linear-gradient(90deg,#7C3AED,#A78BFA)', color:'#fff', fontFamily:'Nunito,sans-serif', fontSize:13, fontWeight:700, cursor:'pointer' }}>Lưu</button>
        </div>
      </div>
    </div>
  );
}

function StudentDetail({ student, db, onClose, onEdit }) {
  const cls = db.classes.find(c => c.id === student.classId);
  const badges = db.badges.filter(b => b.studentId === student.id);
  const recentAtt = db.attendance.filter(a => a.studentId === student.id).slice(-10);
  const attRate = recentAtt.length > 0 ? Math.round((recentAtt.filter(a=>a.status==='present').length / recentAtt.length)*100) : 0;
  const fee = db.finance.filter(f => f.studentId === student.id);
  const badgeIcons = { star:'⭐', book:'📖', music:'🎵', crown:'👑', heart:'❤️' };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#fff', borderRadius:20, width:560, maxHeight:'90vh', overflowY:'auto', padding:28, boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:20 }}>
          <Avatar initials={student.initials} size={56} />
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:18, color:'#1E1B4B' }}>{student.name}</div>
            <div style={{ fontSize:13, color:'#6B6494' }}>{cls?.name} · {BB.getAge(student.dob)} tuổi · {student.gender==='male'?'Nam':'Nữ'}</div>
            <Badge status={student.status} />
          </div>
          <button onClick={() => onEdit(student)} style={{ padding:'7px 16px', borderRadius:10, border:'1.5px solid #7C3AED', background:'#fff', color:'#7C3AED', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>Chỉnh sửa</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
          <InfoRow label="Ngày sinh" value={BB.fmtDate(student.dob)} />
          <InfoRow label="Nhập học" value={BB.fmtDate(student.enrollDate)} />
          <InfoRow label="Phụ huynh" value={student.parentName} />
          <InfoRow label="Điện thoại" value={student.parentPhone} />
          <InfoRow label="Email PH" value={student.parentEmail} />
          <InfoRow label="Chuyên cần" value={`${attRate}% (10 ngày gần nhất)`} />
        </div>
        {badges.length > 0 && (
          <div style={{ background:'#F8F7FF', borderRadius:12, padding:'12px 14px', marginBottom:12 }}>
            <div style={{ fontWeight:700, fontSize:13, color:'#7C3AED', marginBottom:8 }}>🏆 Thành tích</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {badges.map(b => (
                <div key={b.id} style={{ display:'flex', alignItems:'center', gap:6, background:'#fff', border:'1.5px solid #DDD6FE', borderRadius:8, padding:'4px 10px' }}>
                  <span>{badgeIcons[b.badge]||'🌟'}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:'#1E1B4B' }}>{b.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ textAlign:'right', marginTop:16 }}>
          <button onClick={onClose} style={{ padding:'9px 20px', borderRadius:10, border:'1.5px solid #DDD6FE', background:'#fff', fontFamily:'Nunito,sans-serif', fontSize:13, fontWeight:700, color:'#6B6494', cursor:'pointer' }}>Đóng</button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ background:'#F8F7FF', borderRadius:8, padding:'8px 12px' }}>
      <div style={{ fontSize:10, fontWeight:700, color:'#7C6D9B', marginBottom:2 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize:13, fontWeight:600, color:'#1E1B4B' }}>{value || '—'}</div>
    </div>
  );
}

function Students() {
  const [db, setDB] = useSt(BB.getDB());
  const [search, setSearch] = useSt('');
  const [filterClass, setFilterClass] = useSt('all');
  const [filterStatus, setFilterStatus] = useSt('all');
  const [modal, setModal] = useSt(null);
  const [selected, setSelected] = useSt(null);
  const [importMsg, setImportMsg] = useSt('');
  const fileRef = useStRef();

  const filtered = useSm(() => db.students.filter(s => {
    if (filterClass !== 'all' && s.classId !== filterClass) return false;
    if (filterStatus !== 'all' && s.status !== filterStatus) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.parentName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [db, search, filterClass, filterStatus]);

  function saveStudent(form) {
    const ndb = { ...db, students: [...db.students] };
    if (selected) {
      const idx = ndb.students.findIndex(s => s.id === selected.id);
      ndb.students[idx] = { ...selected, ...form };
    } else {
      ndb.students.push({ ...form, id:'s'+Date.now() });
    }
    window._bbDB = ndb;
    BB.commit();
    setDB(ndb);
    setModal(null);
    setSelected(null);
  }

  const selBar = { padding:'9px 14px', borderRadius:10, border:'1.5px solid #DDD6FE', fontFamily:'Nunito,sans-serif', fontSize:13, color:'#1E1B4B', background:'#fff', cursor:'pointer' };

  return (
    <div style={{ padding:'28px 36px' }}>
      {modal === 'add' && <StudentModal db={db} onClose={() => setModal(null)} onSave={saveStudent} />}
      {modal === 'edit' && <StudentModal student={selected} db={db} onClose={() => { setModal(null); setSelected(null); }} onSave={saveStudent} />}
      {modal === 'detail' && <StudentDetail student={selected} db={db} onClose={() => { setModal(null); setSelected(null); }} onEdit={s => { setSelected(s); setModal('edit'); }} />}

      <input ref={fileRef} type="file" accept=".csv" style={{ display:'none' }} onChange={e => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          try {
            const imported = parseCSV(ev.target.result);
            const ndb = { ...db, students: [...db.students, ...imported] };
            window._bbDB = ndb; BB.commit(); setDB(ndb);
            setImportMsg(`✅ Đã import ${imported.length} học sinh!`);
            setTimeout(() => setImportMsg(''), 3000);
          } catch(err) { setImportMsg('❌ File không đúng định dạng'); setTimeout(() => setImportMsg(''), 3000); }
        };
        reader.readAsText(file, 'UTF-8');
        e.target.value = '';
      }} />

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:18, color:'#1E1B4B' }}>Quản lý học sinh</div>
          <div style={{ fontSize:13, color:'#7C6D9B', marginTop:2 }}>{db.students.filter(s=>s.status==='active').length} học sinh đang học · {db.students.length} tổng cộng</div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          {importMsg && <span style={{ fontSize:13, fontWeight:700, color:'#059669', background:'#ECFDF5', borderRadius:8, padding:'6px 12px' }}>{importMsg}</span>}
          <button onClick={() => fileRef.current?.click()} style={{ padding:'10px 18px', borderRadius:12, border:'1.5px solid #DDD6FE', background:'#fff', color:'#7C3AED', fontFamily:'Nunito,sans-serif', fontWeight:700, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>📥 Import CSV</button>
          <button onClick={() => exportCSV(filtered, db.classes)} style={{ padding:'10px 18px', borderRadius:12, border:'1.5px solid #DDD6FE', background:'#fff', color:'#7C3AED', fontFamily:'Nunito,sans-serif', fontWeight:700, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>📤 Export CSV</button>
          <button onClick={() => { setSelected(null); setModal('add'); }} style={{ padding:'10px 22px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#6D28D9,#8B5CF6)', color:'#fff', fontFamily:'Nunito,sans-serif', fontWeight:800, fontSize:14, cursor:'pointer', boxShadow:'0 4px 14px rgba(109,40,217,0.35)' }}>+ Thêm học sinh</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Tìm học sinh hoặc phụ huynh..." style={{ ...selBar, flex:1, minWidth:200 }} />
        <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={selBar}>
          <option value="all">Tất cả lớp</option>
          {db.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selBar}>
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang học</option>
          <option value="inactive">Nghỉ học</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background:'#fff', borderRadius:16, boxShadow:'0 2px 16px rgba(109,40,217,0.08)', overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'#F8F7FF' }}>
              {['Học sinh','Lớp','Ngày sinh','Phụ huynh','Điện thoại','Trạng thái',''].map(h => (
                <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontSize:11, fontWeight:800, color:'#7C6D9B', borderBottom:'1.5px solid #DDD6FE', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => {
              const cls = db.classes.find(c => c.id === s.classId);
              return (
                <tr key={s.id} style={{ borderBottom:'1px solid #EDE9FE', transition:'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background='#F8F7FF'}
                  onMouseLeave={e => e.currentTarget.style.background=''}>
                  <td style={{ padding:'12px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <Avatar initials={s.initials} size={32} />
                      <span style={{ fontWeight:700, fontSize:13, color:'#1E1B4B' }}>{s.name}</span>
                    </div>
                  </td>
                  <td style={{ padding:'12px 16px' }}>
                    <span style={{ fontSize:12, fontWeight:700, color: cls?.color||'#6B6494', background:(cls?.color||'#6B6494')+'18', borderRadius:6, padding:'2px 8px' }}>{cls?.name||'—'}</span>
                  </td>
                  <td style={{ padding:'12px 16px', fontSize:13, color:'#6B6494' }}>{BB.fmtDate(s.dob)}</td>
                  <td style={{ padding:'12px 16px', fontSize:13, color:'#1E1B4B', fontWeight:600 }}>{s.parentName}</td>
                  <td style={{ padding:'12px 16px', fontSize:13, color:'#6B6494' }}>{s.parentPhone}</td>
                  <td style={{ padding:'12px 16px' }}><Badge status={s.status} /></td>
                  <td style={{ padding:'12px 16px' }}>
                    <button onClick={() => { setSelected(s); setModal('detail'); }} style={{ padding:'5px 14px', borderRadius:8, border:'1.5px solid #7C3AED', background:'#fff', color:'#7C3AED', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>Xem</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'40px', color:'#7C6D9B', fontSize:14 }}>Không tìm thấy học sinh nào</div>
        )}
      </div>
    </div>
  );
}

window.Students = Students;
window.Avatar = Avatar;
