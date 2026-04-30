// bb-attendance.jsx — Attendance tracking
const { useState: useStA, useMemo: useSmA } = React;

function Attendance() {
  const [db, setDB] = useStA(BB.getDB());
  const [selDate, setSelDate] = useStA(BB.todayStr());
  const [filterClass, setFilterClass] = useStA('all');

  const students = useSmA(() => {
    let s = db.students.filter(st => st.status === 'active');
    if (filterClass !== 'all') s = s.filter(st => st.classId === filterClass);
    return s;
  }, [db, filterClass]);

  const attMap = useSmA(() => {
    const map = {};
    db.attendance.filter(a => a.date === selDate).forEach(a => { map[a.studentId] = a; });
    return map;
  }, [db, selDate]);

  function setStatus(studentId, status) {
    const ndb = { ...db, attendance: [...db.attendance] };
    const existIdx = ndb.attendance.findIndex(a => a.date === selDate && a.studentId === studentId);
    const rec = { id:`att-${selDate}-${studentId}`, studentId, date:selDate, status, note:'' };
    if (existIdx >= 0) ndb.attendance[existIdx] = rec;
    else ndb.attendance.push(rec);
    window._bbDB = ndb; BB.commit(); setDB(ndb);
  }

  function markAll(status) {
    const ndb = { ...db, attendance: db.attendance.filter(a => !(a.date === selDate && students.some(s => s.id === a.studentId))) };
    students.forEach(s => ndb.attendance.push({ id:`att-${selDate}-${s.id}`, studentId:s.id, date:selDate, status, note:'' }));
    window._bbDB = ndb; BB.commit(); setDB(ndb);
  }

  const present = students.filter(s => attMap[s.id]?.status === 'present').length;
  const absent = students.filter(s => attMap[s.id]?.status === 'absent').length;
  const late = students.filter(s => attMap[s.id]?.status === 'late').length;
  const unmarked = students.length - (present + absent + late);

  const btnStyle = (active, color) => ({
    padding:'5px 12px', borderRadius:8, border:`1.5px solid ${active ? color : '#DDD6FE'}`,
    background: active ? color : '#fff', color: active ? '#fff' : '#6B6494',
    fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'Nunito,sans-serif', transition:'all 0.15s'
  });

  const selStyle = { padding:'8px 12px', borderRadius:10, border:'1.5px solid #DDD6FE', fontFamily:'Nunito,sans-serif', fontSize:13, color:'#1E1B4B', background:'#fff', cursor:'pointer' };

  return (
    <div style={{ padding:'28px 36px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:18, color:'#1E1B4B' }}>Điểm danh</div>
          <div style={{ fontSize:13, color:'#7C6D9B', marginTop:2 }}>Ghi chép chuyên cần hàng ngày</div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={selStyle}>
            <option value="all">Tất cả lớp</option>
            {db.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="date" value={selDate} onChange={e => setSelDate(e.target.value)} style={selStyle} />
        </div>
      </div>

      {/* Summary row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Có mặt', count:present, color:'#16A34A', bg:'#F0FDF4', icon:'✅' },
          { label:'Đi trễ', count:late, color:'#7C3AED', bg:'#F5F3FF', icon:'⏰' },
          { label:'Vắng mặt', count:absent, color:'#DC2626', bg:'#FEF2F2', icon:'❌' },
          { label:'Chưa điểm danh', count:unmarked, color:'#6B6494', bg:'#F5F5F4', icon:'⬜' }
        ].map(item => (
          <div key={item.label} style={{ background:item.bg, borderRadius:12, padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:24 }}>{item.icon}</span>
            <div>
              <div style={{ fontWeight:900, fontSize:24, color:item.color, lineHeight:1 }}>{item.count}</div>
              <div style={{ fontSize:12, color:item.color, fontWeight:700 }}>{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick mark all */}
      <div style={{ display:'flex', gap:10, marginBottom:14, alignItems:'center' }}>
        <span style={{ fontSize:13, color:'#6B6494', fontWeight:700 }}>Điểm danh nhanh:</span>
        <button onClick={() => markAll('present')} style={{ ...btnStyle(false,'#16A34A'), background:'#F0FDF4', color:'#16A34A', border:'1.5px solid #16A34A' }}>✅ Điểm danh tất cả</button>
        <button onClick={() => markAll('absent')} style={{ ...btnStyle(false,'#DC2626'), background:'#FEF2F2', color:'#DC2626', border:'1.5px solid #DC2626' }}>❌ Vắng hết</button>
      </div>

      {/* Attendance table */}
      <div style={{ background:'#fff', borderRadius:16, boxShadow:'0 2px 16px rgba(109,40,217,0.08)', overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'#F8F7FF' }}>
              <th style={{ padding:'12px 16px', textAlign:'left', fontSize:11, fontWeight:800, color:'#7C6D9B', borderBottom:'1.5px solid #DDD6FE' }}>Học sinh</th>
              <th style={{ padding:'12px 16px', textAlign:'left', fontSize:11, fontWeight:800, color:'#7C6D9B', borderBottom:'1.5px solid #DDD6FE' }}>Lớp</th>
              <th style={{ padding:'12px 16px', textAlign:'center', fontSize:11, fontWeight:800, color:'#7C6D9B', borderBottom:'1.5px solid #DDD6FE' }}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {students.map(s => {
              const att = attMap[s.id];
              const cls = db.classes.find(c => c.id === s.classId);
              return (
                <tr key={s.id} style={{ borderBottom:'1px solid #EDE9FE' }}>
                  <td style={{ padding:'10px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <Avatar initials={s.initials} size={32} />
                      <span style={{ fontWeight:700, fontSize:13, color:'#1E1B4B' }}>{s.name}</span>
                    </div>
                  </td>
                  <td style={{ padding:'10px 16px' }}>
                    <span style={{ fontSize:11, fontWeight:700, color:cls?.color||'#6B6494', background:(cls?.color||'#6B6494')+'18', borderRadius:6, padding:'2px 8px' }}>{cls?.name}</span>
                  </td>
                  <td style={{ padding:'10px 16px' }}>
                    <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
                      <button onClick={() => setStatus(s.id,'present')} style={btnStyle(att?.status==='present','#16A34A')}>✅ Có mặt</button>
                      <button onClick={() => setStatus(s.id,'late')} style={btnStyle(att?.status==='late','#7C3AED')}>⏰ Trễ</button>
                      <button onClick={() => setStatus(s.id,'absent')} style={btnStyle(att?.status==='absent','#DC2626')}>❌ Vắng</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Daily Reports ----
function DailyReports() {
  const [db, setDB] = useStA(BB.getDB());
  const [selDate, setSelDate] = useStA(BB.todayStr());
  const [filterClass, setFilterClass] = useStA('all');
  const [editing, setEditing] = useStA(null);

  const students = useSmA(() => {
    let s = db.students.filter(st => st.status === 'active');
    if (filterClass !== 'all') s = s.filter(st => st.classId === filterClass);
    return s;
  }, [db, filterClass]);

  const reportMap = useSmA(() => {
    const map = {};
    db.dailyReports.filter(r => r.date === selDate).forEach(r => { map[r.studentId] = r; });
    return map;
  }, [db, selDate]);

  function saveReport(studentId, data) {
    const ndb = { ...db, dailyReports: [...db.dailyReports] };
    const idx = ndb.dailyReports.findIndex(r => r.date === selDate && r.studentId === studentId);
    const rec = { id:`dr-${selDate}-${studentId}`, studentId, date:selDate, ...data };
    if (idx >= 0) ndb.dailyReports[idx] = rec;
    else ndb.dailyReports.push(rec);
    window._bbDB = ndb; BB.commit(); setDB(ndb); setEditing(null);
  }

  const moodColors = { 'Vui vẻ':'#16A34A','Hào hứng':'#7C3AED','Bình thường':'#6B6494','Mệt mỏi':'#7C3AED','Buồn ngủ':'#7C3AED' };
  const selStyle = { padding:'8px 12px', borderRadius:10, border:'1.5px solid #DDD6FE', fontFamily:'Nunito,sans-serif', fontSize:13, color:'#1E1B4B', background:'#fff', cursor:'pointer' };

  return (
    <div style={{ padding:'28px 36px' }}>
      {editing && (
        <ReportEditModal
          student={db.students.find(s => s.id === editing)}
          report={reportMap[editing]}
          onClose={() => setEditing(null)}
          onSave={(data) => saveReport(editing, data)}
        />
      )}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:18, color:'#1E1B4B' }}>Nhật ký ngày</div>
          <div style={{ fontSize:13, color:'#7C6D9B', marginTop:2 }}>Ghi chú bữa ăn, giấc ngủ và tâm trạng của bé</div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={selStyle}>
            <option value="all">Tất cả lớp</option>
            {db.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="date" value={selDate} onChange={e => setSelDate(e.target.value)} style={selStyle} />
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(340px, 1fr))', gap:14 }}>
        {students.map(s => {
          const r = reportMap[s.id];
          const cls = db.classes.find(c => c.id === s.classId);
          return (
            <div key={s.id} style={{ background:'#fff', borderRadius:16, padding:'16px 18px', boxShadow:'0 2px 14px rgba(109,40,217,0.07)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <Avatar initials={s.initials} size={36} />
                  <div>
                    <div style={{ fontWeight:700, fontSize:13, color:'#1E1B4B' }}>{s.name}</div>
                    <span style={{ fontSize:10, fontWeight:700, color:cls?.color||'#6B6494' }}>{cls?.name}</span>
                  </div>
                </div>
                <button onClick={() => setEditing(s.id)} style={{ padding:'5px 12px', borderRadius:8, border:'1.5px solid #7C3AED', background:'#fff', color:'#7C3AED', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                  {r ? 'Sửa' : 'Ghi nhật ký'}
                </button>
              </div>
              {r ? (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <ReportChip icon="🍳" label="Sáng" value={r.breakfast} />
                  <ReportChip icon="🍱" label="Trưa" value={r.lunch} />
                  <ReportChip icon="🍎" label="Xế" value={r.snack} />
                  <ReportChip icon="😴" label="Ngủ" value={r.napDuration > 0 ? `${r.napDuration} phút` : 'Không ngủ'} />
                  <div style={{ gridColumn:'1/-1' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:11, color:'#6B6494', fontWeight:700 }}>Tâm trạng:</span>
                      <span style={{ fontSize:12, fontWeight:800, color: moodColors[r.mood]||'#6B6494' }}>{r.mood}</span>
                    </div>
                    {r.note && <div style={{ fontSize:11, color:'#6B6494', marginTop:4, fontStyle:'italic' }}>💬 {r.note}</div>}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign:'center', padding:'16px 0', color:'#7C6D9B', fontSize:13 }}>Chưa có nhật ký hôm nay</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReportChip({ icon, label, value }) {
  return (
    <div style={{ background:'#F8F7FF', borderRadius:8, padding:'6px 10px' }}>
      <div style={{ fontSize:10, color:'#7C6D9B', fontWeight:700 }}>{icon} {label}</div>
      <div style={{ fontSize:12, fontWeight:700, color:'#1E1B4B', marginTop:1 }}>{value||'—'}</div>
    </div>
  );
}

function ReportEditModal({ student, report, onClose, onSave }) {
  const [form, setForm] = useStA(report || {
    breakfast:'Ăn hết suất', lunch:'Ăn hết suất', snack:'Ăn hết suất',
    napDuration:90, mood:'Vui vẻ', activities:[], note:'', health:'Bình thường'
  });
  const inputStyle = { width:'100%', padding:'8px 12px', borderRadius:8, border:'1.5px solid #DDD6FE', fontFamily:'Nunito,sans-serif', fontSize:13, color:'#1E1B4B', outline:'none', boxSizing:'border-box' };
  const labelStyle = { fontSize:12, fontWeight:700, color:'#6B6494', display:'block', marginBottom:4 };
  const mealOpts = ['Ăn hết suất','Ăn được 3/4','Ăn được 1/2','Ăn ít','Không ăn'];
  const moodOpts = ['Vui vẻ','Hào hứng','Bình thường','Mệt mỏi','Buồn ngủ','Khó chịu'];
  const actOpts = ['Vẽ tranh','Đọc sách','Hát nhạc','Vận động','Kể chuyện','Chơi cát','Làm thủ công'];

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#fff', borderRadius:20, width:480, padding:28, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ fontWeight:800, fontSize:16, color:'#1E1B4B', marginBottom:4 }}>Nhật ký: {student?.name}</div>
        <div style={{ fontSize:12, color:'#7C6D9B', marginBottom:18 }}>Ngày {BB.fmtDate(BB.todayStr())}</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {[['breakfast','🍳 Bữa sáng'], ['lunch','🍱 Bữa trưa'], ['snack','🍎 Bữa xế']].map(([key,lbl]) => (
            <div key={key}>
              <label style={labelStyle}>{lbl}</label>
              <select style={inputStyle} value={form[key]} onChange={e => setForm({...form, [key]:e.target.value})}>
                {mealOpts.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
          <div>
            <label style={labelStyle}>😴 Giấc ngủ (phút)</label>
            <input type="number" min={0} max={180} step={15} style={inputStyle} value={form.napDuration} onChange={e => setForm({...form, napDuration:+e.target.value})} />
          </div>
          <div>
            <label style={labelStyle}>😊 Tâm trạng</label>
            <select style={inputStyle} value={form.mood} onChange={e => setForm({...form, mood:e.target.value})}>
              {moodOpts.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>🏥 Sức khỏe</label>
            <select style={inputStyle} value={form.health} onChange={e => setForm({...form, health:e.target.value})}>
              {['Bình thường','Sốt nhẹ','Ho','Đau bụng','Dị ứng'].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={labelStyle}>🎨 Hoạt động trong ngày</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {actOpts.map(a => {
                const active = (form.activities||[]).includes(a);
                return (
                  <button key={a} onClick={() => {
                    const acts = form.activities||[];
                    setForm({...form, activities: active ? acts.filter(x=>x!==a) : [...acts,a]});
                  }} style={{ padding:'4px 12px', borderRadius:20, border:`1.5px solid ${active?'#7C3AED':'#DDD6FE'}`, background:active?'#EDE9FE':'#fff', color:active?'#7C3AED':'#6B6494', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>{a}</button>
                );
              })}
            </div>
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={labelStyle}>💬 Ghi chú thêm</label>
            <textarea style={{ ...inputStyle, resize:'vertical', minHeight:60 }} value={form.note} onChange={e => setForm({...form, note:e.target.value})} placeholder="Ghi chú cho phụ huynh..." />
          </div>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'9px 20px', borderRadius:10, border:'1.5px solid #DDD6FE', background:'#fff', fontFamily:'Nunito,sans-serif', fontSize:13, fontWeight:700, color:'#6B6494', cursor:'pointer' }}>Hủy</button>
          <button onClick={() => onSave(form)} style={{ padding:'9px 24px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#6D28D9,#8B5CF6)', color:'#fff', fontFamily:'Nunito,sans-serif', fontSize:13, fontWeight:700, cursor:'pointer' }}>Lưu nhật ký</button>
        </div>
      </div>
    </div>
  );
}

window.Attendance = Attendance;
window.DailyReports = DailyReports;
