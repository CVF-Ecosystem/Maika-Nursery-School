// bb-finance.jsx — Finance / tuition management
const { useState: useStF, useMemo: useSmF } = React;

function Finance() {
  const [db, setDB] = useStF(BB.getDB());
  const [modal, setModal] = useStF(null);
  const [search, setSearch] = useStF('');
  const [filterStatus, setFilterStatus] = useStF('all');
  const [filterType, setFilterType] = useStF('all');

  const filtered = useSmF(() => db.finance.filter(f => {
    if (filterStatus !== 'all' && f.status !== filterStatus) return false;
    if (filterType !== 'all' && f.type !== filterType) return false;
    if (search) {
      const s = db.students.find(st => st.id === f.studentId);
      if (!s || !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    }
    return true;
  }), [db, search, filterStatus, filterType]);

  function saveRecord(form) {
    const ndb = { ...db, finance: [...db.finance] };
    if (form.id) {
      const idx = ndb.finance.findIndex(f => f.id === form.id);
      ndb.finance[idx] = form;
    } else {
      ndb.finance.push({ ...form, id:'f'+Date.now() });
    }
    window._bbDB = ndb; BB.commit(); setDB(ndb); setModal(null);
  }

  function markPaid(id) {
    const ndb = { ...db, finance: db.finance.map(f => f.id === id ? {...f, status:'paid', method:'Chuyển khoản'} : f) };
    window._bbDB = ndb; BB.commit(); setDB(ndb);
  }

  const totalPaid = db.finance.filter(f=>f.status==='paid').reduce((s,f)=>s+f.amount,0);
  const totalPending = db.finance.filter(f=>f.status==='pending').reduce((s,f)=>s+f.amount,0);
  const totalOverdue = db.finance.filter(f=>f.status==='overdue').reduce((s,f)=>s+f.amount,0);

  const statusMap = { paid:['#16A34A','#F0FDF4','Đã thu'], pending:['#7C3AED','#F5F3FF','Chưa thu'], overdue:['#DC2626','#FEF2F2','Quá hạn'] };
  const typeMap = { tuition:'Học phí', meal:'Tiền ăn', material:'Học liệu', other:'Khác' };
  const selStyle = { padding:'8px 12px', borderRadius:10, border:'1.5px solid #DDD6FE', fontFamily:'Nunito,sans-serif', fontSize:13, color:'#1E1B4B', background:'#fff', cursor:'pointer' };

  return (
    <div style={{ padding:'28px 36px' }}>
      {modal && <FinanceModal db={db} record={modal === true ? null : modal} onClose={() => setModal(null)} onSave={saveRecord} />}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:18, color:'#1E1B4B' }}>Quản lý học phí</div>
          <div style={{ fontSize:13, color:'#7C6D9B', marginTop:2 }}>Theo dõi thu chi và tình trạng học phí</div>
        </div>
        <button onClick={() => setModal(true)} style={{ padding:'10px 22px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#6D28D9,#8B5CF6)', color:'#fff', fontFamily:'Nunito,sans-serif', fontWeight:800, fontSize:14, cursor:'pointer', boxShadow:'0 2px 8px rgba(109,40,217,0.3)' }}>+ Thêm phiếu thu</button>
      </div>

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:22 }}>
        <SummaryCard label="Đã thu" amount={totalPaid} color="#16A34A" bg="#F0FDF4" icon="✅" />
        <SummaryCard label="Chưa thu" amount={totalPending} color="#7C3AED" bg="#F5F3FF" icon="⏳" />
        <SummaryCard label="Quá hạn" amount={totalOverdue} color="#DC2626" bg="#FEF2F2" icon="🚨" />
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Tìm theo tên học sinh..." style={{ ...selStyle, flex:1, minWidth:180 }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selStyle}>
          <option value="all">Tất cả trạng thái</option>
          <option value="paid">Đã thu</option>
          <option value="pending">Chưa thu</option>
          <option value="overdue">Quá hạn</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selStyle}>
          <option value="all">Tất cả loại</option>
          <option value="tuition">Học phí</option>
          <option value="meal">Tiền ăn</option>
          <option value="material">Học liệu</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background:'#fff', borderRadius:16, boxShadow:'0 2px 16px rgba(109,40,217,0.08)', overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'#F8F7FF' }}>
              {['Học sinh','Loại','Mô tả','Số tiền','Ngày','Trạng thái','Phương thức',''].map(h => (
                <th key={h} style={{ padding:'12px 14px', textAlign:'left', fontSize:11, fontWeight:800, color:'#7C6D9B', borderBottom:'1.5px solid #DDD6FE', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(f => {
              const student = db.students.find(s => s.id === f.studentId);
              const [col, bg, label] = statusMap[f.status] || ['#6B6494','#F5F5F4','Không rõ'];
              return (
                <tr key={f.id} style={{ borderBottom:'1px solid #EDE9FE' }}
                  onMouseEnter={e => e.currentTarget.style.background='#F8F7FF'}
                  onMouseLeave={e => e.currentTarget.style.background=''}>
                  <td style={{ padding:'10px 14px' }}>
                    {student ? (
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <Avatar initials={student.initials} size={28} />
                        <span style={{ fontWeight:700, fontSize:13, color:'#1E1B4B' }}>{student.name}</span>
                      </div>
                    ) : <span style={{ fontSize:13, color:'#7C6D9B' }}>—</span>}
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ fontSize:11, fontWeight:700, color:'#7C3AED', background:'#EDE9FE', borderRadius:6, padding:'2px 8px' }}>{typeMap[f.type]||f.type}</span>
                  </td>
                  <td style={{ padding:'10px 14px', fontSize:13, color:'#6B6494' }}>{f.desc}</td>
                  <td style={{ padding:'10px 14px', fontWeight:800, fontSize:13, color:'#1E1B4B' }}>{BB.fmtMoney(f.amount)}</td>
                  <td style={{ padding:'10px 14px', fontSize:13, color:'#6B6494', whiteSpace:'nowrap' }}>{BB.fmtDate(f.date)}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ background:bg, color:col, borderRadius:6, fontSize:11, fontWeight:700, padding:'3px 9px' }}>{label}</span>
                  </td>
                  <td style={{ padding:'10px 14px', fontSize:13, color:'#6B6494' }}>{f.method||'—'}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <div style={{ display:'flex', gap:6 }}>
                      {f.status !== 'paid' && (
                        <button onClick={() => markPaid(f.id)} style={{ padding:'4px 10px', borderRadius:7, border:'1.5px solid #16A34A', background:'#F0FDF4', color:'#16A34A', fontWeight:700, fontSize:11, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>✓ Thu</button>
                      )}
                      <button onClick={() => setModal(f)} style={{ padding:'4px 10px', borderRadius:7, border:'1.5px solid #DDD6FE', background:'#fff', color:'#6B6494', fontWeight:700, fontSize:11, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>Sửa</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'40px', color:'#7C6D9B', fontSize:14 }}>Không tìm thấy bản ghi nào</div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, amount, color, bg, icon }) {
  return (
    <div style={{ background:bg, borderRadius:14, padding:'18px 20px', display:'flex', alignItems:'center', gap:14 }}>
      <span style={{ fontSize:30 }}>{icon}</span>
      <div>
        <div style={{ fontWeight:900, fontSize:20, color, lineHeight:1 }}>{BB.fmtMoney(amount)}</div>
        <div style={{ fontSize:13, color, fontWeight:700, marginTop:4 }}>{label}</div>
      </div>
    </div>
  );
}

function FinanceModal({ db, record, onClose, onSave }) {
  const [form, setForm] = useStF(record || {
    studentId:'s1', type:'tuition', desc:'', amount:0, date:BB.todayStr(), status:'pending', method:''
  });
  const inputStyle = { width:'100%', padding:'8px 12px', borderRadius:8, border:'1.5px solid #DDD6FE', fontFamily:'Nunito,sans-serif', fontSize:13, color:'#1E1B4B', outline:'none', boxSizing:'border-box' };
  const labelStyle = { fontSize:12, fontWeight:700, color:'#6B6494', display:'block', marginBottom:4 };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#fff', borderRadius:20, width:460, padding:28, boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ fontWeight:800, fontSize:17, color:'#1E1B4B', marginBottom:20 }}>{record ? 'Chỉnh sửa phiếu thu' : 'Thêm phiếu thu mới'}</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={labelStyle}>Học sinh</label>
            <select style={inputStyle} value={form.studentId} onChange={e => setForm({...form, studentId:e.target.value})}>
              {db.students.filter(s=>s.status==='active').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Loại khoản thu</label>
            <select style={inputStyle} value={form.type} onChange={e => setForm({...form, type:e.target.value})}>
              <option value="tuition">Học phí</option>
              <option value="meal">Tiền ăn</option>
              <option value="material">Học liệu</option>
              <option value="other">Khác</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Số tiền (VNĐ)</label>
            <input type="number" style={inputStyle} value={form.amount} onChange={e => setForm({...form, amount:+e.target.value})} />
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={labelStyle}>Mô tả</label>
            <input style={inputStyle} value={form.desc} onChange={e => setForm({...form, desc:e.target.value})} placeholder="VD: Học phí tháng 5/2026" />
          </div>
          <div>
            <label style={labelStyle}>Ngày</label>
            <input type="date" style={inputStyle} value={form.date} onChange={e => setForm({...form, date:e.target.value})} />
          </div>
          <div>
            <label style={labelStyle}>Trạng thái</label>
            <select style={inputStyle} value={form.status} onChange={e => setForm({...form, status:e.target.value})}>
              <option value="pending">Chưa thu</option>
              <option value="paid">Đã thu</option>
              <option value="overdue">Quá hạn</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Phương thức thanh toán</label>
            <select style={inputStyle} value={form.method} onChange={e => setForm({...form, method:e.target.value})}>
              <option value="">—</option>
              <option value="Tiền mặt">Tiền mặt</option>
              <option value="Chuyển khoản">Chuyển khoản</option>
            </select>
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

window.Finance = Finance;
