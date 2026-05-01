import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Landing() {
    const navigate = useNavigate()
    const revealRefs = useRef([])

    useEffect(() => {
        const io = new IntersectionObserver(entries => {
            entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in') })
        }, { threshold: 0.1 })
        revealRefs.current.forEach(el => el && io.observe(el))
        return () => io.disconnect()
    }, [])

    const rv = (extra = '') => ({
        ref: el => revealRefs.current.push(el),
        className: `reveal ${extra}`
    })

    function handleCTA(e) {
        e.preventDefault()
        const phone = document.getElementById('cta-phone').value.trim()
        const msg = document.getElementById('cta-msg')
        if (!phone) { msg.textContent = 'Vui lòng nhập số điện thoại'; return }
        msg.textContent = 'Cảm ơn phụ huynh. Nhà trường sẽ liên hệ lại trong giờ làm việc.'
        document.getElementById('cta-phone').value = ''
        setTimeout(() => { if (msg) msg.textContent = '' }, 5000)
    }

    return (
        <div id="view-landing" style={{ background: '#fff' }}>
            {/* NAV */}
            <nav id="nav" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999, height: 68, display: 'flex', alignItems: 'center', padding: '0 6%', justifyContent: 'space-between', background: 'linear-gradient(135deg,#1E1B4B,#4C1D95)', boxShadow: '0 2px 16px rgba(109,40,217,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#6D28D9,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🌸</div>
                    <span style={{ fontWeight: 900, fontSize: 18, color: '#fff' }}>Maika</span>
                </div>
                <div className="landing-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                    <a href="#programs" style={{ fontWeight: 700, fontSize: 14, color: 'rgba(255,255,255,0.82)', textDecoration: 'none' }}>Chương trình</a>
                    <a href="#features" style={{ fontWeight: 700, fontSize: 14, color: 'rgba(255,255,255,0.82)', textDecoration: 'none' }}>Tiện ích</a>
                    <a href="#gallery" style={{ fontWeight: 700, fontSize: 14, color: 'rgba(255,255,255,0.82)', textDecoration: 'none' }}>Hình ảnh</a>
                    <a href="#testimonials" style={{ fontWeight: 700, fontSize: 14, color: 'rgba(255,255,255,0.82)', textDecoration: 'none' }}>Phụ huynh</a>
                    <button onClick={() => navigate('/parent')} style={{ fontWeight: 700, fontSize: 14, color: 'rgba(255,255,255,0.82)', background: 'none', border: 'none' }}>Cổng phụ huynh</button>
                    <button onClick={() => navigate('/login')} style={{ padding: '9px 20px', borderRadius: 50, background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontWeight: 800, fontSize: 13, border: 'none', boxShadow: '0 4px 14px rgba(109,40,217,0.4)' }}>Đăng nhập</button>
                </div>
            </nav>

            {/* HERO */}
            <section style={{ minHeight: '100vh', background: 'linear-gradient(145deg,#1E1B4B,#2D2870 40%,#4C1D95 72%,#6D28D9)', display: 'flex', alignItems: 'center', padding: '100px 6% 60px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', width: 650, height: 650, borderRadius: '50%', background: 'rgba(167,139,250,0.1)', top: -220, right: -200, pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'rgba(245,158,11,0.08)', bottom: -130, left: -100, pointerEvents: 'none' }} />
                <div {...rv()} style={{ maxWidth: 580, position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 50, padding: '7px 18px', color: '#C4B5FD', fontSize: 13, fontWeight: 700, marginBottom: 24 }}>Thông tin tuyển sinh và liên hệ</div>
                    <h1 style={{ fontSize: 'clamp(38px,5.5vw,66px)', fontWeight: 900, color: '#fff', lineHeight: 1.08, letterSpacing: -2, marginBottom: 20 }}>
                        Nhà trẻ<br /><span style={{ background: 'linear-gradient(90deg,#FBBF24,#F59E0B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Maika</span>
                    </h1>
                    <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.72)', lineHeight: 1.7, marginBottom: 36, maxWidth: 510, fontWeight: 600 }}>Môi trường chăm sóc, học tập và kết nối phụ huynh dành cho trẻ mầm non.</p>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                        <a href="#cta" style={{ padding: '15px 32px', borderRadius: 50, background: 'linear-gradient(135deg,#F59E0B,#FBBF24)', color: '#1E1B4B', fontWeight: 900, fontSize: 15, boxShadow: '0 6px 22px rgba(245,158,11,0.48)', display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>Đăng ký tham quan</a>
                        <button onClick={() => navigate('/login')} style={{ padding: '15px 32px', borderRadius: 50, background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.28)', color: '#fff', fontWeight: 700, fontSize: 15 }}>Đăng nhập hệ thống</button>
                    </div>
                </div>
                {/* Hero stats cards */}
                <div style={{ position: 'absolute', right: '6%', top: '50%', transform: 'translateY(-50%)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, width: 360, zIndex: 1 }} className="hide-mobile">
                    {[['👦', 'Học sinh', 'Hồ sơ và lớp học'], ['👩‍🏫', 'Giáo viên', 'Điểm danh hằng ngày'], ['⭐', 'Phụ huynh', 'Theo dõi trực tuyến'], ['🏆', 'Nhà trường', 'Quản lý tập trung']].map(([icon, num, lbl], i) => (
                        <div key={i} {...rv(`d${i}`)} style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 20, padding: 20, color: '#fff', textAlign: 'center', marginTop: i === 1 || i === 3 ? (i === 1 ? 26 : -18) : 0 }}>
                            <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
                            <div style={{ fontSize: 28, fontWeight: 900, color: '#FBBF24', lineHeight: 1 }}>{num}</div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 700, marginTop: 4 }}>{lbl}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* STATS STRIP */}
            <div className="landing-section-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', background: '#fff', boxShadow: '0 4px 28px rgba(109,40,217,0.08)' }}>
                {[['3', 'Nhóm lớp mầm non'], ['Hằng ngày', 'Điểm danh và nhật ký'], ['Riêng tư', 'Quyền truy cập theo vai trò'], ['Trực tuyến', 'Thông tin cho phụ huynh']].map(([num, lbl], i) => (
                    <div key={i} {...rv(`d${i}`)} style={{ textAlign: 'center', padding: '42px 20px', borderRight: i < 3 ? '1px solid #EDE9FE' : 'none', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 56, height: 3, background: 'linear-gradient(90deg,#6D28D9,#A78BFA)', borderRadius: '0 0 4px 4px' }} />
                        <div style={{ fontSize: 44, fontWeight: 900, color: '#6D28D9', letterSpacing: -2, lineHeight: 1 }}>{num}</div>
                        <div style={{ fontSize: 14, color: '#7C6D9B', fontWeight: 700, marginTop: 8 }}>{lbl}</div>
                    </div>
                ))}
            </div>

            {/* PROGRAMS */}
            <section id="programs" style={{ padding: '88px 6%', background: 'linear-gradient(135deg,#F8F7FF,#EDE9FE)' }}>
                <div {...rv()}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#EDE9FE', color: '#6D28D9', fontSize: 12, fontWeight: 800, padding: '5px 14px', borderRadius: 50, letterSpacing: .5, marginBottom: 14 }}>🎓 Chương trình học</div>
                    <h2 style={{ fontSize: 'clamp(28px,3.8vw,44px)', fontWeight: 900, color: '#1E1B4B', lineHeight: 1.12, letterSpacing: -1, marginBottom: 12 }}>Ba cấp độ học tập<br />phù hợp từng lứa tuổi</h2>
                    <p style={{ fontSize: 16, color: '#7C6D9B', lineHeight: 1.7, maxWidth: 540, fontWeight: 600 }}>Mỗi chương trình thiết kế riêng, phù hợp sự phát triển của trẻ.</p>
                </div>
                <div className="landing-section-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 22, marginTop: 50 }}>
                    {[
                        { icon: '🌱', age: '3–4 tuổi', cls: 'Lớp Mầm', desc: 'Làm quen môi trường học, phát triển ngôn ngữ và kỹ năng xã hội qua vui chơi.', feats: ['🎨 Vẽ và tô màu sáng tạo', '🎵 Học qua bài hát & vần điệu', '🤝 Kỹ năng sống căn bản'], bg: '#EDE9FE', col: '#6D28D9', delay: 'd1' },
                        { icon: '🌿', age: '4–5 tuổi', cls: 'Lớp Chồi', desc: 'Phát triển tư duy logic, tiền toán học và vốn từ vựng qua khám phá thế giới.', feats: ['🔢 Làm quen với con số', '📖 Nhận biết chữ cái', '🌍 Khám phá thiên nhiên'], bg: '#FEF3C7', col: '#D97706', delay: 'd2' },
                        { icon: '🌳', age: '5–6 tuổi', cls: 'Lớp Lá', desc: 'Chuẩn bị toàn diện vào lớp 1 với kỹ năng đọc viết, tính toán và tư duy độc lập.', feats: ['✏️ Tập viết chữ & số', '🧩 Tư duy logic & sáng tạo', '🎤 Tự tin giao tiếp'], bg: '#D1FAE5', col: '#059669', delay: 'd3' }
                    ].map((p, i) => (
                        <div key={i} {...rv(p.delay)} style={{ background: '#fff', borderRadius: 24, padding: 28, boxShadow: '0 4px 18px rgba(109,40,217,0.08)', transition: 'all .3s', position: 'relative', overflow: 'hidden', cursor: 'default' }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-7px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: i === 0 ? 'linear-gradient(90deg,#6D28D9,#A78BFA)' : i === 1 ? 'linear-gradient(90deg,#F59E0B,#FBBF24)' : 'linear-gradient(90deg,#059669,#34D399)' }} />
                            <div style={{ width: 58, height: 58, borderRadius: 16, background: p.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 16 }}>{p.icon}</div>
                            <span style={{ background: p.bg, color: p.col, fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 50, display: 'inline-block', marginBottom: 12 }}>{p.age}</span>
                            <h3 style={{ fontSize: 20, fontWeight: 900, color: '#1E1B4B', marginBottom: 10 }}>{p.cls}</h3>
                            <p style={{ fontSize: 14, color: '#7C6D9B', lineHeight: 1.7 }}>{p.desc}</p>
                            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {p.feats.map((f, j) => <div key={j} style={{ fontSize: 13, color: '#4B4899', fontWeight: 600 }}>{f}</div>)}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* FEATURES */}
            <section id="features" style={{ padding: '88px 6%' }}>
                <div {...rv()}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#EDE9FE', color: '#6D28D9', fontSize: 12, fontWeight: 800, padding: '5px 14px', borderRadius: 50, marginBottom: 14 }}>⭐ Vì sao chọn Maika</div>
                    <h2 style={{ fontSize: 'clamp(28px,3.8vw,44px)', fontWeight: 900, color: '#1E1B4B', lineHeight: 1.12, letterSpacing: -1, marginBottom: 12 }}>Chăm sóc, học tập<br />và kết nối gia đình</h2>
                </div>
                <div className="landing-section-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 18, marginTop: 50 }}>
                    {[
                        ['👩‍🏫', 'Giáo viên phụ trách', 'Theo dõi lớp học, điểm danh và ghi nhận tình hình của trẻ mỗi ngày.', ''],
                        ['🥗', 'Dinh dưỡng khoa học', 'Thực đơn cân bằng 4 nhóm chất. Cập nhật bữa ăn hàng ngày qua ứng dụng phụ huynh.', 'd1'],
                        ['🏃', 'Vận động phong phú', 'Sân chơi an toàn rộng rãi, hoạt động thể chất mỗi ngày phát triển thể lực toàn diện.', 'd2'],
                        ['📱', 'Ứng dụng phụ huynh', 'Nhật ký ngày, ảnh hoạt động, thông báo — tất cả trên cổng thông tin trực tuyến tiện lợi.', 'd1'],
                        ['🔒', 'Quản lý an toàn', 'Phân quyền truy cập, lưu lịch sử và bảo vệ dữ liệu nhạy cảm của trẻ.', 'd2'],
                        ['🎭', 'Nghệ thuật & Âm nhạc', 'Lớp âm nhạc, vẽ và múa mỗi tuần — khơi dậy tài năng và đam mê từ nhỏ.', 'd3'],
                    ].map(([icon, title, desc, delay], i) => (
                        <div key={i} {...rv(delay)} style={{ background: '#F8F7FF', border: '1.5px solid #EDE9FE', borderRadius: 20, padding: 26, transition: 'all .3s', cursor: 'default' }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#EDE9FE'; e.currentTarget.style.borderColor = '#A78BFA'; e.currentTarget.style.transform = 'translateY(-4px)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#F8F7FF'; e.currentTarget.style.borderColor = '#EDE9FE'; e.currentTarget.style.transform = 'none' }}>
                            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 14, boxShadow: '0 4px 14px rgba(109,40,217,0.3)' }}>{icon}</div>
                            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1E1B4B', marginBottom: 8 }}>{title}</h3>
                            <p style={{ fontSize: 14, color: '#7C6D9B', lineHeight: 1.7 }}>{desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* GALLERY */}
            <section id="gallery" style={{ background: '#1E1B4B', padding: '88px 6%' }}>
                <div {...rv()}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(167,139,250,0.18)', color: '#C4B5FD', fontSize: 12, fontWeight: 800, padding: '5px 14px', borderRadius: 50, marginBottom: 14 }}>📸 Hình ảnh hoạt động</div>
                    <h2 style={{ fontSize: 'clamp(28px,3.8vw,44px)', fontWeight: 900, color: '#fff', lineHeight: 1.12, letterSpacing: -1, marginBottom: 12 }}>Một ngày ở Maika</h2>
                    <p style={{ fontSize: 16, color: '#8B83C3', lineHeight: 1.7, maxWidth: 540, fontWeight: 600 }}>Các bé vui chơi, học tập và phát triển trong môi trường đầy màu sắc.</p>
                </div>
                <div {...rv()} className="landing-gallery-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gridTemplateRows: '200px 200px', gap: 14, marginTop: 46 }}>
                    {[
                        { bg: 'linear-gradient(135deg,#6D28D9,#A78BFA)', emoji: '🎨', label: 'Giờ vẽ sáng tạo', ov: 'Hoạt động mỹ thuật — Lớp Chồi', span: 'span 2', rspan: 'span 2', fs: 72 },
                        { bg: 'linear-gradient(135deg,#059669,#34D399)', emoji: '🏃', label: 'Thể dục ngoài trời', ov: 'Vận động sáng — toàn trường' },
                        { bg: 'linear-gradient(135deg,#F59E0B,#FBBF24)', emoji: '🍱', label: 'Bữa trưa ngon lành', ov: 'Cơm gà, canh rau, tráng miệng' },
                        { bg: 'linear-gradient(135deg,#EC4899,#F9A8D4)', emoji: '🎵', label: 'Lớp âm nhạc', ov: 'Học hát cùng cô Hạnh' },
                        { bg: 'linear-gradient(135deg,#0891B2,#38BDF8)', emoji: '😴', label: 'Giờ nghỉ trưa', ov: 'Giấc ngủ trưa an lành', span: 'span 2' },
                        { bg: 'linear-gradient(135deg,#7C3AED,#C4B5FD)', emoji: '📚', label: 'Giờ đọc sách', ov: 'Thư viện lớp học' },
                    ].map((item, i) => (
                        <div key={i} style={{ gridColumn: item.span, gridRow: item.rspan, borderRadius: 18, overflow: 'hidden', position: 'relative', cursor: 'pointer', transition: 'transform .25s' }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.querySelector('.ov').style.opacity = 1 }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.querySelector('.ov').style.opacity = 0 }}>
                            <div style={{ width: '100%', height: '100%', background: item.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: 14 }}>
                                <span style={{ fontSize: item.fs || 42 }}>{item.emoji}</span>
                                <span>{item.label}</span>
                            </div>
                            <div className="ov" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg,rgba(30,27,75,0.85),transparent 55%)', opacity: 0, transition: 'opacity .25s', display: 'flex', alignItems: 'flex-end', padding: 14 }}>
                                <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{item.ov}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div style={{ textAlign: 'center', marginTop: 28 }}>
                    <button onClick={() => navigate('/parent')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 26px', borderRadius: 50, background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.82)', fontWeight: 700, fontSize: 14 }}>📸 Xem thêm ảnh trên cổng phụ huynh →</button>
                </div>
            </section>

            {/* TESTIMONIALS */}
            <section id="testimonials" style={{ padding: '88px 6%', background: '#F8F7FF' }}>
                <div {...rv()}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#EDE9FE', color: '#6D28D9', fontSize: 12, fontWeight: 800, padding: '5px 14px', borderRadius: 50, marginBottom: 14 }}>Kết nối phụ huynh</div>
                    <h2 style={{ fontSize: 'clamp(28px,3.8vw,44px)', fontWeight: 900, color: '#1E1B4B', lineHeight: 1.12, letterSpacing: -1 }}>Thông tin rõ ràng<br />giữa nhà trường và gia đình</h2>
                </div>
                <div className="landing-section-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 22, marginTop: 50 }}>
                    {[
                        { stars: '', text: 'Phụ huynh xem thông báo, thực đơn, hình ảnh và học phí trong cùng một cổng thông tin.', av: '01', name: 'Theo dõi hằng ngày', role: 'Thông tin cập nhật theo từng học sinh', bg: 'linear-gradient(135deg,#6D28D9,#A78BFA)', delay: '' },
                        { stars: '', text: 'Nhà trường chủ động gửi thông báo quan trọng và ghi nhận trạng thái đã đọc của từng tài khoản.', av: '02', name: 'Thông báo tập trung', role: 'Sự kiện, học phí, sức khỏe và sự cố', bg: 'linear-gradient(135deg,#F59E0B,#FBBF24)', delay: 'd1' },
                        { stars: '', text: 'Quyền riêng tư hình ảnh và kênh liên hệ được quản lý rõ ràng cho từng học sinh.', av: '03', name: 'Quyền riêng tư', role: 'Cấu hình đồng ý của phụ huynh', bg: 'linear-gradient(135deg,#059669,#34D399)', delay: 'd2' },
                    ].map((t, i) => (
                        <div key={i} {...rv(t.delay)} style={{ background: '#fff', borderRadius: 22, padding: 26, boxShadow: '0 4px 18px rgba(109,40,217,0.08)', border: '1.5px solid #EDE9FE', position: 'relative' }}>
                            <div style={{ position: 'absolute', top: 14, right: 20, fontSize: 72, color: '#EDE9FE', fontFamily: 'Georgia,serif', lineHeight: 1, pointerEvents: 'none' }}>"</div>
                            {t.stars && <div style={{ marginBottom: 12, fontSize: 14, letterSpacing: 2 }}>{t.stars}</div>}
                            <p style={{ fontSize: 14, color: '#4B4899', lineHeight: 1.8, marginBottom: 16, position: 'relative', zIndex: 1 }}>{t.text}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 42, height: 42, borderRadius: 12, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14 }}>{t.av}</div>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: 13, color: '#1E1B4B' }}>{t.name}</div>
                                    <div style={{ fontSize: 12, color: '#7C6D9B', fontWeight: 600 }}>{t.role}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section id="cta" style={{ background: 'linear-gradient(135deg,#4C1D95,#6D28D9,#7C3AED)', padding: '96px 6%', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', width: 420, height: 420, borderRadius: '50%', background: 'rgba(167,139,250,0.12)', top: -160, left: -100, pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', background: 'rgba(245,158,11,0.1)', bottom: -90, right: -70, pointerEvents: 'none' }} />
                <h2 {...rv()} style={{ fontSize: 'clamp(28px,4.5vw,50px)', fontWeight: 900, color: '#fff', letterSpacing: -1, marginBottom: 14, position: 'relative', zIndex: 1 }}>Sẵn sàng cho bé<br />khởi đầu tốt đẹp?</h2>
                <p {...rv()} style={{ fontSize: 17, color: 'rgba(255,255,255,0.75)', marginBottom: 40, fontWeight: 600, position: 'relative', zIndex: 1 }}>Đăng ký tham quan hoàn toàn miễn phí. Chúng tôi sẽ liên hệ trong vòng 24 giờ.</p>
                <div {...rv()} className="landing-cta-form" style={{ display: 'flex', gap: 12, maxWidth: 480, margin: '0 auto', position: 'relative', zIndex: 1 }}>
                    <input id="cta-phone" type="text" placeholder="Số điện thoại phụ huynh" style={{ flex: 1, minWidth: 0, padding: '14px 20px', borderRadius: 50, border: 'none', fontSize: 14, color: '#1E1B4B' }} />
                    <button onClick={handleCTA} style={{ padding: '14px 24px', borderRadius: 50, background: 'linear-gradient(135deg,#F59E0B,#FBBF24)', color: '#1E1B4B', fontWeight: 900, fontSize: 14, border: 'none', whiteSpace: 'nowrap' }}>Đăng ký ngay</button>
                </div>
                <p id="cta-msg" style={{ fontSize: 14, color: '#FCD34D', fontWeight: 700, minHeight: 22, marginTop: 14, position: 'relative', zIndex: 1 }} />
                <div {...rv()} style={{ display: 'flex', justifyContent: 'center', gap: 44, flexWrap: 'wrap', marginTop: 48, position: 'relative', zIndex: 1 }}>
                    {[['📍', 'Tổ 23B, KP Trần Cao Vân\nPhường Dầu Giây, Đồng Nai'], ['📞', '0901 234 567\n0912 345 678'], ['⏰', '6:30 – 17:30\nThứ Hai – Thứ Sáu'], ['✉️', 'info@maika.edu.vn']].map(([icon, text], i) => (
                        <div key={i} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.8)' }}>
                            <div style={{ fontSize: 26, marginBottom: 6 }}>{icon}</div>
                            <p style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{text}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* FOOTER */}
            <footer style={{ background: '#0F0D2E', padding: '56px 6% 26px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 40, marginBottom: 44 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#6D28D9,#A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🌸</div>
                            <span style={{ fontWeight: 900, fontSize: 18, color: '#fff' }}>Maika</span>
                        </div>
                        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.72)', lineHeight: 1.8, maxWidth: 260 }}>Cổng thông tin giúp nhà trường, giáo viên và phụ huynh theo dõi hoạt động của trẻ.</p>
                    </div>
                    {[['Chương trình', ['Lớp Mầm (3–4 tuổi)', 'Lớp Chồi (4–5 tuổi)', 'Lớp Lá (5–6 tuổi)']], ['Phụ huynh', ['Cổng phụ huynh', 'Đăng nhập quản lý', 'Quy định nhà trường']], ['Liên hệ', ['0901 234 567', 'info@maika.edu.vn', 'Tổ 23B. KP Trần Cao Vân - Phường Dầu Giây - Đồng Nai']]].map(([title, links], i) => (
                        <div key={i}>
                            <h3 style={{ fontSize: 12, fontWeight: 800, color: '#C4B5FD', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 14 }}>{title}</h3>
                            {links.map((l, j) => <a key={j} href="#" style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,0.74)', marginBottom: 10, fontWeight: 600 }}>{l}</a>)}
                        </div>
                    ))}
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 22, display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(255,255,255,0.68)', flexWrap: 'wrap', gap: 8 }}>
                    <span>© 2026 Maika Nursery School.</span>
                    <span style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        <a href="/privacy" style={{ color: 'rgba(255,255,255,0.68)', textDecoration: 'underline', fontWeight: 700 }}>Chính sách dữ liệu</a>
                        <span>Bảo mật dữ liệu phụ huynh và trẻ</span>
                    </span>
                </div>
            </footer>
        </div>
    )
}
