// bb-analytics.jsx — Analytics & charts (SVG-based)
const { useState: useStAn, useMemo: useSmAn } = React;

function BarChart({ data, color='#7C3AED', height=140, label='' }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const barW = Math.floor(400 / data.length) - 6;
  return (
    <div>
      {label && <div style={{ fontSize:12, fontWeight:700, color:'#7C6D9B', marginBottom:8 }}>{label}</div>}
      <svg viewBox={`0 0 400 ${height+24}`} style={{ width:'100%', height:height+24 }}>
        {data.map((d, i) => {
          const barH = Math.round((d.value / max) * height);
          const x = i * (barW + 6) + 2;
          return (
            <g key={i}>
              <rect x={x} y={height - barH} width={barW} height={barH} rx={4} fill={color} opacity={0.85} />
              <text x={x + barW/2} y={height + 14} textAnchor="middle" fontSize={8} fill="#7C6D9B" fontFamily="Nunito,sans-serif">{d.label}</text>
              {d.value > 0 && <text x={x + barW/2} y={height - barH - 3} textAnchor="middle" fontSize={9} fill={color} fontWeight="700" fontFamily="Nunito,sans-serif">{d.value}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function LineChart({ data, color='#7C3AED', height=120 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const W = 400, H = height;
  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - (d.value / max) * (H - 10)
  }));
  const pathD = pts.map((p,i) => `${i===0?'M':'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${pts[pts.length-1].x} ${H} L 0 ${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H+20}`} style={{ width:'100%', height:H+20 }}>
      <defs>
        <linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#lg1)" />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {pts.map((p,i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3.5} fill="#fff" stroke={color} strokeWidth={2} />
          <text x={p.x} y={H+14} textAnchor="middle" fontSize={8} fill="#7C6D9B" fontFamily="Nunito,sans-serif">{data[i].label}</text>
        </g>
      ))}
    </svg>
  );
}

function DonutChart({ data, size=120 }) {
  const total = data.reduce((s,d)=>s+d.value,0);
  if (total === 0) return null;
  let angle = -Math.PI / 2;
  const r = 40, cx = 60, cy = 60;
  const segments = data.map(d => {
    const sweep = (d.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle), y2 = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    return { ...d, path:`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z` };
  });
  return (
    <svg viewBox="0 0 120 120" style={{ width:size, height:size }}>
      {segments.map((s,i) => <path key={i} d={s.path} fill={s.color} />)}
      <circle cx={cx} cy={cy} r={24} fill="#fff" />
      <text x={cx} y={cy+4} textAnchor="middle" fontSize={11} fontWeight="800" fill="#1E1B4B" fontFamily="Nunito,sans-serif">{total}</text>
    </svg>
  );
}

function Analytics() {
  const db = BB.getDB();
  const [period, setPeriod] = useStAn('week');

  // Attendance trend last 7 days
  const attTrend = useSmAn(() => {
    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const ds = d.toISOString().split('T')[0];
      const recs = db.attendance.filter(a => a.date === ds);
      const pct = recs.length > 0 ? Math.round((recs.filter(a=>a.status==='present').length / recs.length)*100) : 0;
      days.push({ label: d.toLocaleDateString('vi-VN',{weekday:'short'}), value: pct });
    }
    return days;
  }, [db]);

  // Attendance by class today
  const attByClass = useSmAn(() => {
    const today = BB.todayStr();
    return db.classes.map(cls => {
      const students = db.students.filter(s => s.classId === cls.id && s.status === 'active');
      const present = db.attendance.filter(a => a.date === today && students.some(s=>s.id===a.studentId) && a.status==='present').length;
      return { label: cls.name, value: students.length > 0 ? Math.round(present/students.length*100) : 0, color: cls.color };
    });
  }, [db]);

  // Finance breakdown
  const finBreakdown = useSmAn(() => {
    const byType = {};
    db.finance.filter(f=>f.status==='paid').forEach(f => { byType[f.type] = (byType[f.type]||0) + f.amount; });
    const colors = { tuition:'#7C3AED', meal:'#A78BFA', material:'#34D399', other:'#7C3AED' };
    const labels = { tuition:'Học phí', meal:'Tiền ăn', material:'Học liệu', other:'Khác' };
    return Object.entries(byType).map(([k,v]) => ({ label:labels[k]||k, value:v, color:colors[k]||'#6B6494' }));
  }, [db]);

  // Monthly finance (simulated)
  const monthlyFin = [
    { label:'T1', value:42 }, { label:'T2', value:38 }, { label:'T3', value:45 },
    { label:'T4', value:52 }, { label:'T5', value:0 }, { label:'T6', value:0 }
  ];

  // Class size
  const classSize = db.classes.map(c => ({
    label: c.name,
    value: db.students.filter(s=>s.classId===c.id&&s.status==='active').length
  }));

  // Mood distribution today
  const moodCounts = useSmAn(() => {
    const today = BB.todayStr();
    const reps = db.dailyReports.filter(r=>r.date===today);
    const map = {};
    reps.forEach(r => { if(r.mood) map[r.mood] = (map[r.mood]||0)+1; });
    const moodColors = { 'Vui vẻ':'#16A34A','Hào hứng':'#7C3AED','Bình thường':'#6B6494','Mệt mỏi':'#7C3AED','Buồn ngủ':'#7C3AED' };
    return Object.entries(map).map(([k,v]) => ({ label:k, value:v, color:moodColors[k]||'#6B6494' }));
  }, [db]);

  const cardStyle = { background:'#fff', borderRadius:16, padding:'20px 22px', boxShadow:'0 2px 16px rgba(109,40,217,0.08)' };
  const titleStyle = { fontWeight:800, fontSize:14, color:'#1E1B4B', marginBottom:14 };

  const totalStudents = db.students.filter(s=>s.status==='active').length;
  const todayAtt = db.attendance.filter(a=>a.date===BB.todayStr());
  const todayPct = todayAtt.length>0 ? Math.round(todayAtt.filter(a=>a.status==='present').length/todayAtt.length*100) : 0;
  const totalRevenue = db.finance.filter(f=>f.status==='paid').reduce((s,f)=>s+f.amount,0);
  const outstandingFees = db.finance.filter(f=>f.status!=='paid').reduce((s,f)=>s+f.amount,0);

  return (
    <div style={{ padding:'28px 36px' }}>
      <div style={{ fontWeight:800, fontSize:18, color:'#1E1B4B', marginBottom:4 }}>Báo cáo & Phân tích</div>
      <div style={{ fontSize:13, color:'#7C6D9B', marginBottom:20 }}>Dữ liệu tổng hợp và biểu đồ thống kê</div>

      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        {[
          { label:'Tổng học sinh', value:totalStudents, icon:'👦', color:'#7C3AED' },
          { label:'Chuyên cần hôm nay', value:`${todayPct}%`, icon:'✅', color:'#16A34A' },
          { label:'Đã thu tháng này', value:BB.fmtMoney(totalRevenue), icon:'💰', color:'#A78BFA', small:true },
          { label:'Còn phải thu', value:BB.fmtMoney(outstandingFees), icon:'⏳', color:'#DC2626', small:true }
        ].map(k => (
          <div key={k.label} style={{ background:'#fff', borderRadius:14, padding:'16px 18px', boxShadow:'0 2px 14px rgba(109,40,217,0.07)', borderTop:`3px solid ${k.color}` }}>
            <div style={{ fontSize:24, marginBottom:6 }}>{k.icon}</div>
            <div style={{ fontWeight:900, fontSize:k.small?16:26, color:'#1E1B4B', lineHeight:1, marginBottom:4 }}>{k.value}</div>
            <div style={{ fontSize:12, color:'#7C6D9B', fontWeight:600 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        {/* Attendance trend */}
        <div style={cardStyle}>
          <div style={titleStyle}>📈 Chuyên cần tuần này (%)</div>
          <LineChart data={attTrend} color="#7C3AED" height={120} />
        </div>

        {/* Finance monthly */}
        <div style={cardStyle}>
          <div style={titleStyle}>💰 Thu phí theo tháng (triệu đồng)</div>
          <BarChart data={monthlyFin} color="#A78BFA" height={120} />
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16 }}>
        {/* Class attendance donut */}
        <div style={cardStyle}>
          <div style={titleStyle}>🏫 Chuyên cần theo lớp (hôm nay)</div>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <DonutChart data={attByClass.map(d=>({...d, value:d.value}))} size={110} />
            <div style={{ flex:1 }}>
              {attByClass.map(d => (
                <div key={d.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:8, height:8, borderRadius:2, background:d.color }}></div>
                    <span style={{ fontSize:12, color:'#6B6494' }}>{d.label}</span>
                  </div>
                  <span style={{ fontWeight:800, fontSize:13, color:d.color }}>{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Finance breakdown */}
        <div style={cardStyle}>
          <div style={titleStyle}>💳 Cơ cấu thu phí</div>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <DonutChart data={finBreakdown} size={110} />
            <div style={{ flex:1 }}>
              {finBreakdown.map(d => (
                <div key={d.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:8, height:8, borderRadius:2, background:d.color }}></div>
                    <span style={{ fontSize:12, color:'#6B6494' }}>{d.label}</span>
                  </div>
                  <span style={{ fontWeight:700, fontSize:11, color:'#1E1B4B' }}>{BB.fmtMoney(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mood */}
        <div style={cardStyle}>
          <div style={titleStyle}>😊 Tâm trạng bé hôm nay</div>
          {moodCounts.length > 0 ? (
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <DonutChart data={moodCounts} size={110} />
              <div style={{ flex:1 }}>
                {moodCounts.map(d => (
                  <div key={d.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ width:8, height:8, borderRadius:2, background:d.color }}></div>
                      <span style={{ fontSize:11, color:'#6B6494' }}>{d.label}</span>
                    </div>
                    <span style={{ fontWeight:800, fontSize:13, color:d.color }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign:'center', padding:'20px 0', color:'#7C6D9B', fontSize:13 }}>Chưa có dữ liệu hôm nay</div>
          )}
        </div>
      </div>
    </div>
  );
}

window.Analytics = Analytics;
