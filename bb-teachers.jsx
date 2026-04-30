// bb-teachers.jsx — Teacher management
const { useState: useStT } = React;

function Teachers() {
  const [db, setDB] = useStT(BB.getDB());
  const [modal, setModal] = useStT(null);
  const [selected, setSelected] = useStT(null);
  const [search, setSearch] = useStT('');

  const filtered = db.teachers.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.subject.toLowerCase().includes(search.toLowerCase())
  );

  function saveTeacher(form) {
    const ndb = { ...db, teachers: [...db.teachers] };
    if (selected) {
      const idx = ndb.teachers.findIndex(t => t.id === selected.id);
      ndb.teachers[idx] = { ...selected, ...form };
    } else {
      ndb.teachers.push({ ...form, id:'t'+Date.now(), initials: form.name.split(' ').filter(Boolean).slice(-2).map(w=>w[0].toUpperCase()).join('') });
    }
    window._bbDB = ndb; BB.commit(); setDB(ndb); setModal(null); setSelected(null);
  }

  const subjectColors = {
    'Giáo viên chủ nhiệm':'#7C3AED',
    'Giáo viên Thể chất':'#16A34A',
    'Giáo viên Âm nhạc':'#7C3AED',
    'Y tế học đường':'#06B6D4'
  };

  return (
    <div style={{ padding:'28px 36px' }}>
      {modal === 'add' && <TeacherModal db={db} onClose={() => setModal(null)} onSave={saveTeacher} />}
      {modal === 'edit' && <TeacherModal teacher={selected} db={db} onClose={() => { setModal(null); setSelected(null); }} onSave={saveTeacher} />}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:18, color:'#1E1B4B' }}>Quản lý giáo viên</div>
          <div style={{ fontSize:13, color:'#7C6D9B', marginTop:2 }}>{db.teachers.filter(t=>t.status==='active').length} giáo viên đang làm việc</div>
        </div>
        <button onClick={() => { setSelected(null); setModal('add'); }} style={{ padding:'10px 22px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#6D28D9,#8B5CF6)', color:'#fff', fontFamily:'Nunito,sans-serif', fontWeight:800, fontSize:14, cursor:'pointer', boxShadow:'0 2px 8px rgba(109,40,217,0.3)' }}>+ Thêm giáo viên</button>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Tìm giáo viên..."
        style={{ width:'100%', padding:'9px 14px', borderRadius:10, border:'1.5px solid #DDD6FE', fontFamily:'Nunito,sans-serif', fontSize:13, marginBottom:16, boxSizing:'border-box', outline:'none' }} />

      {/* Class assignments summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:20 }}>
        {db.classes.map(cls => {
          const teacher = db.teachers.find(t => t.id === cls.teacherId);
          const count = db.students.filter(s => s.classId === cls.id && s.status === 'active').length;
          return (
            <div key={cls.id} style={{ background:'#fff', borderRadius:14, padding:'16px 18px', boxShadow:'0 2px 14px rgba(109,40,217,0.07)', borderTop:`3px solid ${cls.color}` }}>
              <div style={{ fontWeight:800, fontSize:15, color:'#1E1B4B' }}>{cls.name}</div>
              <div style={{ fontSize:12, color:'#7C6D9B', marginBottom:10 }}>{cls.ageGroup}</div>
              {teacher ? (
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <Avatar initials={teacher.initials} size={32} />
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#1E1B4B' }}>{teacher.name}</div>
                    <div style={{ fontSize:11, color:'#7C6D9B' }}>{count} học sinh</div>
                  </div>
                </div>
              ) : <div style={{ fontSize:13, color:'#7C6D9B' }}>Chưa phân công GV</div>}
            </div>
          );
        })}
      </div>

      {/* Teacher cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:14 }}>
        {filtered.map(t => {
          const cls = db.classes.find(c => c.teacherId === t.id);
          const studentCount = cls ? db.students.filter(s => s.classId === cls.id && s.status === 'active').length : 0;
          const subCol = subjectColors[t.subject] || '#6B6494';
          return (
            <div key={t.id} style={{ background:'#fff', borderRadius:16, padding:'18px 20px', boxShadow:'0 2px 14px rgba(109,40,217,0.07)', display:'flex', gap:14, alignItems:'flex-start' }}>
              <Avatar initials={t.initials} size={48} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ fontWeight:800, fontSize:14, color:'#1E1B4B' }}>{t.name}</div>
                    <span style={{ fontSize:11, fontWeight:700, color:subCol, background:subCol+'18', borderRadius:6, padding:'2px 8px' }}>{t.subject}</span>
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, color:'#16A34A', background:'#F0FDF4', borderRadius:6, padding:'2px 8px' }}>Hoạt động</span>
                </div>
                <div style={{ marginTop:10, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  <div style={{ fontSize:12, color:'#6B6494' }}>📞 {t.phone}</div>
                  <div style={{ fontSize:12, color:'#6B6494' }}>📧 {t.email}</div>
                  <div style={{ fontSize:12, color:'#6B6494' }}>🎓 {t.degree}</div>
                  {cls && <div style={{ fontSize:12, color:'#6B6494' }}>🏫 {cls.name} · {studentCount} HS</div>}
                  <div style={{ fontSize:12, color:'#6B6494' }}>📅 Từ {BB.fmtDate(t.joinDate)}</div>
                </div>
              </div>
              <button onClick={() => { setSelected(t); setModal('edit'); }} style={{ padding:'5px 12px', borderRadius:8, border:'1.5px solid #DDD6FE', background:'#fff', color:'#6B6494', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'Nunito,sans-serif', flexShrink:0 }}>Sửa</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TeacherModal({ teacher, db, onClose, onSave }) {
  const [form, setForm] = useStT(teacher || {
    name:'', subject:'Giáo viên chủ nhiệm', classId:'', phone:'', email:'', joinDate: BB.todayStr(), status:'active', degree:''
  });
  const inputStyle = { width:'100%', padding:'8px 12px', borderRadius:8, border:'1.5px solid #DDD6FE', fontFamily:'Nunito,sans-serif', fontSize:13, color:'#1E1B4B', outline:'none', boxSizing:'border-box' };
  const labelStyle = { fontSize:12, fontWeight:700, color:'#6B6494', display:'block', marginBottom:4 };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#fff', borderRadius:20, width:500, padding:28, boxShadow:'0 20px 60px rgba(0,0,0,0.2)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ fontWeight:800, fontSize:17, color:'#1E1B4B', marginBottom:20 }}>
          {teacher ? 'Chỉnh sửa giáo viên' : 'Thêm giáo viên mới'}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={labelStyle}>Họ và tên *</label>
            <input style={inputStyle} value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="VD: Nguyễn Thị Hoa" />
          </div>
          <div>
            <label style={labelStyle}>Chức vụ / Bộ môn</label>
            <select style={inputStyle} value={form.subject} onChange={e => setForm({...form, subject:e.target.value})}>
              <option>Giáo viên chủ nhiệm</option>
              <option>Giáo viên Thể chất</option>
              <option>Giáo viên Âm nhạc</option>
              <option>Y tế học đường</option>
              <option>Giáo viên hỗ trợ</option>
              <option>Quản lý</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Phụ trách lớp</label>
            <select style={inputStyle} value={form.classId||''} onChange={e => setForm({...form, classId:e.target.value||null})}>
              <option value="">Không phụ trách lớp</option>
              {db.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Số điện thoại</label>
            <input style={inputStyle} value={form.phone} onChange={e => setForm({...form, phone:e.target.value})} placeholder="09xxxxxxxx" />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} value={form.email} onChange={e => setForm({...form, email:e.target.value})} placeholder="email@blackbird.edu.vn" />
          </div>
          <div>
            <label style={labelStyle}>Bằng cấp</label>
            <input style={inputStyle} value={form.degree} onChange={e => setForm({...form, degree:e.target.value})} placeholder="VD: Cử nhân GDMN" />
          </div>
          <div>
            <label style={labelStyle}>Ngày bắt đầu</label>
            <input type="date" style={inputStyle} value={form.joinDate} onChange={e => setForm({...form, joinDate:e.target.value})} />
          </div>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:22, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'9px 20px', borderRadius:10, border:'1.5px solid #DDD6FE', background:'#fff', fontFamily:'Nunito,sans-serif', fontSize:13, fontWeight:700, color:'#6B6494', cursor:'pointer' }}>Hủy</button>
          <button onClick={() => onSave(form)} style={{ padding:'9px 24px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#6D28D9,#8B5CF6)', color:'#fff', fontFamily:'Nunito,sans-serif', fontSize:13, fontWeight:700, cursor:'pointer' }}>Lưu</button>
        </div>
      </div>
    </div>
  );
}

window.Teachers = Teachers;
