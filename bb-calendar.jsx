// bb-calendar.jsx — Event calendar
const { useState: useStCal } = React;

const TYPE_META = {
  school:    { label:'Học đường', color:'#7C3AED', bg:'#EDE9FE' },
  celebration:{ label:'Lễ hội',   color:'#A78BFA', bg:'#F5F3FF' },
  meeting:   { label:'Họp',       color:'#7C3AED', bg:'#F5F3FF' },
  health:    { label:'Y tế',      color:'#16A34A', bg:'#F0FDF4' },
  finance:   { label:'Tài chính', color:'#DC2626', bg:'#FEF2F2' },
  holiday:   { label:'Nghỉ lễ',   color:'#06B6D4', bg:'#ECFEFF' },
  training:  { label:'Tập huấn',  color:'#8B5CF6', bg:'#F5F3FF' },
};

const WEEKDAYS = ['CN','T2','T3','T4','T5','T6','T7'];
const MONTHS_VN = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

function CalendarView() {
  const [db, setDB] = useStCal(BB.getDB());
  const now = new Date();
  const [year, setYear] = useStCal(now.getFullYear());
  const [month, setMonth] = useStCal(now.getMonth());
  const [modal, setModal] = useStCal(null);
  const [selDay, setSelDay] = useStCal(null);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m=>m-1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m=>m+1); }

  function getEventsForDay(d) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    return db.events.filter(e => e.date === dateStr);
  }

  function saveEvent(form) {
    const ndb = { ...db, events: [...db.events] };
    if (form.id) {
      const idx = ndb.events.findIndex(e => e.id === form.id);
      ndb.events[idx] = form;
    } else {
      ndb.events.push({ ...form, id:'e'+Date.now() });
    }
    window._bbDB = ndb; BB.commit(); setDB(ndb); setModal(null);
  }

  function deleteEvent(id) {
    const ndb = { ...db, events: db.events.filter(e => e.id !== id) };
    window._bbDB = ndb; BB.commit(); setDB(ndb); setModal(null);
  }

  const todayStr = BB.todayStr();
  const upcomingEvents = db.events.filter(e => e.date >= todayStr).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,6);

  return (
    <div style={{ padding:'28px 36px' }}>
      {modal === 'add' && <EventModal event={selDay ? { date:selDay } : null} onClose={() => setModal(null)} onSave={saveEvent} />}
      {modal && modal !== 'add' && <EventModal event={modal} onClose={() => setModal(null)} onSave={saveEvent} onDelete={deleteEvent} />}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:18, color:'#1E1B4B' }}>Lịch sự kiện</div>
          <div style={{ fontSize:13, color:'#7C6D9B', marginTop:2 }}>Quản lý lịch học và sự kiện nhà trường</div>
        </div>
        <button onClick={() => { setSelDay(null); setModal('add'); }} style={{ padding:'10px 22px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#6D28D9,#8B5CF6)', color:'#fff', fontFamily:'Nunito,sans-serif', fontWeight:800, fontSize:14, cursor:'pointer', boxShadow:'0 2px 8px rgba(109,40,217,0.3)' }}>+ Thêm sự kiện</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:18 }}>
        {/* Calendar grid */}
        <div style={{ background:'#fff', borderRadius:16, boxShadow:'0 2px 16px rgba(109,40,217,0.08)', overflow:'hidden' }}>
          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1.5px solid #DDD6FE' }}>
            <button onClick={prevMonth} style={{ width:32, height:32, borderRadius:8, border:'1.5px solid #DDD6FE', background:'#fff', cursor:'pointer', fontWeight:800, fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
            <div style={{ fontWeight:800, fontSize:16, color:'#1E1B4B' }}>{MONTHS_VN[month]} {year}</div>
            <button onClick={nextMonth} style={{ width:32, height:32, borderRadius:8, border:'1.5px solid #DDD6FE', background:'#fff', cursor:'pointer', fontWeight:800, fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
          </div>
          {/* Weekdays */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid #DDD6FE' }}>
            {WEEKDAYS.map(d => (
              <div key={d} style={{ textAlign:'center', padding:'8px 0', fontSize:11, fontWeight:800, color:'#7C6D9B' }}>{d}</div>
            ))}
          </div>
          {/* Days grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
            {Array.from({length: firstDay}).map((_,i) => <div key={'e'+i} style={{ minHeight:80, borderRight:'1px solid #EDE9FE', borderBottom:'1px solid #EDE9FE' }}></div>)}
            {Array.from({length: daysInMonth}, (_,i) => i+1).map(d => {
              const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
              const events = getEventsForDay(d);
              const isToday = dateStr === todayStr;
              return (
                <div key={d} onClick={() => { setSelDay(dateStr); setModal('add'); }}
                  style={{ minHeight:80, borderRight:'1px solid #EDE9FE', borderBottom:'1px solid #EDE9FE', padding:'6px 8px', cursor:'pointer', transition:'background 0.1s', position:'relative' }}
                  onMouseEnter={e => e.currentTarget.style.background='#F8F7FF'}
                  onMouseLeave={e => e.currentTarget.style.background=''}>
                  <div style={{ width:24, height:24, borderRadius:999, background:isToday?'#7C3AED':'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:isToday?800:600, fontSize:13, color:isToday?'#fff':'#1E1B4B', marginBottom:4 }}>{d}</div>
                  {events.slice(0,2).map(ev => {
                    const meta = TYPE_META[ev.type] || { color:'#6B6494', bg:'#F5F5F4', label:ev.type };
                    return (
                      <div key={ev.id} onClick={e => { e.stopPropagation(); setModal(ev); }}
                        style={{ background:meta.bg, color:meta.color, fontSize:10, fontWeight:700, borderRadius:4, padding:'2px 5px', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor:'pointer' }}>
                        {ev.title}
                      </div>
                    );
                  })}
                  {events.length > 2 && <div style={{ fontSize:10, color:'#7C6D9B', fontWeight:700 }}>+{events.length-2} nữa</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar: upcoming events */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* Legend */}
          <div style={{ background:'#fff', borderRadius:14, padding:'14px 16px', boxShadow:'0 2px 14px rgba(109,40,217,0.07)' }}>
            <div style={{ fontWeight:800, fontSize:13, color:'#1E1B4B', marginBottom:10 }}>Loại sự kiện</div>
            {Object.entries(TYPE_META).map(([key, meta]) => (
              <div key={key} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <div style={{ width:10, height:10, borderRadius:3, background:meta.color }}></div>
                <span style={{ fontSize:12, color:'#6B6494', fontWeight:600 }}>{meta.label}</span>
              </div>
            ))}
          </div>
          {/* Upcoming */}
          <div style={{ background:'#fff', borderRadius:14, padding:'14px 16px', boxShadow:'0 2px 14px rgba(109,40,217,0.07)', flex:1 }}>
            <div style={{ fontWeight:800, fontSize:13, color:'#1E1B4B', marginBottom:10 }}>Sắp diễn ra</div>
            {upcomingEvents.map(ev => {
              const meta = TYPE_META[ev.type] || { color:'#6B6494', bg:'#F5F5F4', label:ev.type };
              const dt = new Date(ev.date+'T00:00:00');
              return (
                <div key={ev.id} onClick={() => setModal(ev)} style={{ display:'flex', gap:10, marginBottom:10, cursor:'pointer', padding:'6px 8px', borderRadius:8, transition:'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background='#F8F7FF'}
                  onMouseLeave={e => e.currentTarget.style.background=''}>
                  <div style={{ width:36, textAlign:'center', flexShrink:0 }}>
                    <div style={{ fontSize:9, fontWeight:800, color:'#7C6D9B', textTransform:'uppercase' }}>{MONTHS_VN[dt.getMonth()].replace('Tháng ','Th')}</div>
                    <div style={{ fontSize:20, fontWeight:900, color:meta.color, lineHeight:1.1 }}>{dt.getDate()}</div>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'#1E1B4B', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.title}</div>
                    <span style={{ fontSize:10, fontWeight:700, color:meta.color, background:meta.bg, borderRadius:4, padding:'1px 5px' }}>{meta.label}</span>
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

function EventModal({ event, onClose, onSave, onDelete }) {
  const isEdit = event && event.id;
  const [form, setForm] = useStCal(event || { title:'', date:BB.todayStr(), type:'school', desc:'' });
  const inputStyle = { width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #DDD6FE', fontFamily:'Nunito,sans-serif', fontSize:13, color:'#1E1B4B', outline:'none', boxSizing:'border-box' };
  const labelStyle = { fontSize:12, fontWeight:700, color:'#6B6494', display:'block', marginBottom:4 };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#fff', borderRadius:20, width:440, padding:28, boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ fontWeight:800, fontSize:17, color:'#1E1B4B', marginBottom:20 }}>{isEdit ? 'Chi tiết sự kiện' : 'Thêm sự kiện mới'}</div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={labelStyle}>Tên sự kiện *</label>
            <input style={inputStyle} value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="VD: Họp phụ huynh cuối học kỳ" />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={labelStyle}>Ngày</label>
              <input type="date" style={inputStyle} value={form.date} onChange={e => setForm({...form,date:e.target.value})} />
            </div>
            <div>
              <label style={labelStyle}>Loại</label>
              <select style={inputStyle} value={form.type} onChange={e => setForm({...form,type:e.target.value})}>
                {Object.entries(TYPE_META).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Mô tả</label>
            <textarea style={{ ...inputStyle, resize:'vertical', minHeight:80 }} value={form.desc} onChange={e => setForm({...form,desc:e.target.value})} placeholder="Mô tả chi tiết sự kiện..." />
          </div>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:22, justifyContent:'space-between' }}>
          <div>
            {isEdit && onDelete && <button onClick={() => onDelete(form.id)} style={{ padding:'9px 16px', borderRadius:10, border:'1.5px solid #DC2626', background:'#FEF2F2', fontFamily:'Nunito,sans-serif', fontSize:13, fontWeight:700, color:'#DC2626', cursor:'pointer' }}>Xóa</button>}
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} style={{ padding:'9px 20px', borderRadius:10, border:'1.5px solid #DDD6FE', background:'#fff', fontFamily:'Nunito,sans-serif', fontSize:13, fontWeight:700, color:'#6B6494', cursor:'pointer' }}>Hủy</button>
            <button onClick={() => form.title && onSave(form)} style={{ padding:'9px 24px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#6D28D9,#8B5CF6)', color:'#fff', fontFamily:'Nunito,sans-serif', fontSize:13, fontWeight:700, cursor:'pointer' }}>Lưu</button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.CalendarView = CalendarView;
