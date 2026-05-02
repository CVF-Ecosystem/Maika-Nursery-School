import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getInitialPublicLandingData, loadPublicLandingData, submitTourRequest } from '../../data/publicLanding'

export default function Landing() {
    const navigate = useNavigate()
    const revealRefs = useRef([])
    const [landingData, setLandingData] = useState(() => getInitialPublicLandingData())
    const [ctaForm, setCtaForm] = useState({ parentName: '', phone: '', childAge: '', note: '', website: '' })
    const [ctaStatus, setCtaStatus] = useState({ type: '', message: '' })
    const [ctaSubmitting, setCtaSubmitting] = useState(false)

    useEffect(() => {
        const io = new IntersectionObserver(
            entries => {
                entries.forEach(e => {
                    if (e.isIntersecting) e.target.classList.add('in')
                })
            },
            { threshold: 0.1 },
        )
        revealRefs.current.forEach(el => el && io.observe(el))
        return () => io.disconnect()
    }, [landingData])

    useEffect(() => {
        let alive = true
        loadPublicLandingData()
            .then(data => {
                if (alive) setLandingData(data)
            })
            .catch(() => {})
        return () => {
            alive = false
        }
    }, [])

    const rv = (extra = '') => ({
        ref: el => {
            if (el && !revealRefs.current.includes(el)) revealRefs.current.push(el)
        },
        className: `reveal ${extra}`,
    })

    function setCtaField(field, value) {
        setCtaForm(current => ({ ...current, [field]: value }))
    }

    async function handleCTA(e) {
        e.preventDefault()
        if (!ctaForm.parentName.trim()) {
            setCtaStatus({ type: 'error', message: 'Vui lòng nhập tên phụ huynh.' })
            return
        }
        if (!ctaForm.phone.trim()) {
            setCtaStatus({ type: 'error', message: 'Vui lòng nhập số điện thoại.' })
            return
        }

        try {
            setCtaSubmitting(true)
            await submitTourRequest(ctaForm)
            setCtaForm({ parentName: '', phone: '', childAge: '', note: '', website: '' })
            setCtaStatus({ type: 'success', message: 'Cảm ơn phụ huynh. Yêu cầu tham quan đã được ghi nhận.' })
        } catch (error) {
            setCtaStatus({ type: 'error', message: error.message || 'Chưa gửi được đăng ký, vui lòng thử lại.' })
        } finally {
            setCtaSubmitting(false)
        }
    }

    return (
        <div id="view-landing" style={{ background: '#fff' }}>
            {/* NAV */}
            <nav
                id="nav"
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 999,
                    height: 68,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 6%',
                    justifyContent: 'space-between',
                    background: 'linear-gradient(135deg,#1E1B4B,#4C1D95)',
                    boxShadow: '0 2px 16px rgba(109,40,217,0.2)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            background: 'linear-gradient(135deg,#6D28D9,#A78BFA)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 22,
                        }}
                    >
                        🌸
                    </div>
                    <span style={{ fontWeight: 900, fontSize: 18, color: '#fff' }}>Maika</span>
                </div>
                <div className="landing-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                    <a
                        href="#programs"
                        style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: 'rgba(255,255,255,0.82)',
                            textDecoration: 'none',
                        }}
                    >
                        Chương trình
                    </a>
                    <a
                        href="#features"
                        style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: 'rgba(255,255,255,0.82)',
                            textDecoration: 'none',
                        }}
                    >
                        Tiện ích
                    </a>
                    <a
                        href="#gallery"
                        style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: 'rgba(255,255,255,0.82)',
                            textDecoration: 'none',
                        }}
                    >
                        Hình ảnh
                    </a>
                    <a
                        href="#testimonials"
                        style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: 'rgba(255,255,255,0.82)',
                            textDecoration: 'none',
                        }}
                    >
                        Kết nối gia đình
                    </a>
                    <button
                        onClick={() => navigate('/parent')}
                        style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: 'rgba(255,255,255,0.82)',
                            background: 'none',
                            border: 'none',
                        }}
                    >
                        Phụ huynh đăng nhập
                    </button>
                    <button
                        onClick={() => navigate('/login')}
                        style={{
                            padding: '9px 20px',
                            borderRadius: 50,
                            background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)',
                            color: '#fff',
                            fontWeight: 800,
                            fontSize: 13,
                            border: 'none',
                            boxShadow: '0 4px 14px rgba(109,40,217,0.4)',
                        }}
                    >
                        Admin / Giáo viên
                    </button>
                </div>
            </nav>

            {/* HERO */}
            <section
                style={{
                    minHeight: '100vh',
                    background: 'linear-gradient(145deg,#1E1B4B,#2D2870 40%,#4C1D95 72%,#6D28D9)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '100px 6% 60px',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        width: 650,
                        height: 650,
                        borderRadius: '50%',
                        background: 'rgba(167,139,250,0.1)',
                        top: -220,
                        right: -200,
                        pointerEvents: 'none',
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        width: 400,
                        height: 400,
                        borderRadius: '50%',
                        background: 'rgba(245,158,11,0.08)',
                        bottom: -130,
                        left: -100,
                        pointerEvents: 'none',
                    }}
                />
                <div {...rv()} style={{ maxWidth: 580, position: 'relative', zIndex: 1 }}>
                    <div
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            background: 'rgba(255,255,255,0.12)',
                            border: '1px solid rgba(255,255,255,0.22)',
                            borderRadius: 50,
                            padding: '7px 18px',
                            color: '#C4B5FD',
                            fontSize: 13,
                            fontWeight: 700,
                            marginBottom: 24,
                        }}
                    >
                        Thông tin tuyển sinh và liên hệ
                    </div>
                    <h1
                        style={{
                            fontSize: 'clamp(38px,5.5vw,66px)',
                            fontWeight: 900,
                            color: '#fff',
                            lineHeight: 1.08,
                            letterSpacing: -2,
                            marginBottom: 20,
                        }}
                    >
                        Nhà trẻ
                        <br />
                        <span
                            style={{
                                background: 'linear-gradient(90deg,#FBBF24,#F59E0B)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            Maika
                        </span>
                    </h1>
                    <p
                        style={{
                            fontSize: 17,
                            color: 'rgba(255,255,255,0.72)',
                            lineHeight: 1.7,
                            marginBottom: 36,
                            maxWidth: 510,
                            fontWeight: 600,
                        }}
                    >
                        Môi trường chăm sóc, học tập và kết nối phụ huynh dành cho trẻ mầm non.
                    </p>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                        <a
                            href="#cta"
                            style={{
                                padding: '15px 32px',
                                borderRadius: 50,
                                background: 'linear-gradient(135deg,#F59E0B,#FBBF24)',
                                color: '#1E1B4B',
                                fontWeight: 900,
                                fontSize: 15,
                                boxShadow: '0 6px 22px rgba(245,158,11,0.48)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                textDecoration: 'none',
                            }}
                        >
                            Đăng ký tham quan
                        </a>
                    </div>
                </div>
                {/* Hero stats cards */}
                <div
                    style={{
                        position: 'absolute',
                        right: '6%',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 14,
                        width: 390,
                        zIndex: 1,
                    }}
                    className="hide-mobile"
                >
                    {landingData.heroCards.map(([icon, num, lbl], i) => (
                        <div
                            key={lbl}
                            {...rv(`d${i}`)}
                            style={{
                                minHeight: 150,
                                background: 'rgba(255,255,255,0.1)',
                                backdropFilter: 'blur(16px)',
                                border: '1px solid rgba(255,255,255,0.16)',
                                borderRadius: 20,
                                padding: 20,
                                color: '#fff',
                                textAlign: 'center',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
                            <div style={{ fontSize: 30, fontWeight: 900, color: '#FBBF24', lineHeight: 1.05 }}>
                                {num}
                            </div>
                            <div
                                style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 700, marginTop: 4 }}
                            >
                                {lbl}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* STATS STRIP */}
            <div
                className="landing-section-grid"
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
                    background: '#fff',
                    boxShadow: '0 4px 28px rgba(109,40,217,0.08)',
                }}
            >
                {landingData.statStrip.map(([num, lbl], i) => (
                    <div
                        key={i}
                        {...rv(`d${i}`)}
                        style={{
                            textAlign: 'center',
                            padding: '42px 20px',
                            borderRight: i < 3 ? '1px solid #EDE9FE' : 'none',
                            position: 'relative',
                        }}
                    >
                        <div
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: 56,
                                height: 3,
                                background: 'linear-gradient(90deg,#6D28D9,#A78BFA)',
                                borderRadius: '0 0 4px 4px',
                            }}
                        />
                        <div
                            style={{
                                fontSize: 44,
                                fontWeight: 900,
                                color: '#6D28D9',
                                letterSpacing: -2,
                                lineHeight: 1,
                            }}
                        >
                            {num}
                        </div>
                        <div style={{ fontSize: 14, color: '#7C6D9B', fontWeight: 700, marginTop: 8 }}>{lbl}</div>
                    </div>
                ))}
            </div>

            {/* PROGRAMS */}
            <section
                id="programs"
                style={{ padding: '88px 6%', background: 'linear-gradient(135deg,#F8F7FF,#EDE9FE)' }}
            >
                <div {...rv()}>
                    <div
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            background: '#EDE9FE',
                            color: '#6D28D9',
                            fontSize: 12,
                            fontWeight: 800,
                            padding: '5px 14px',
                            borderRadius: 50,
                            letterSpacing: 0.5,
                            marginBottom: 14,
                        }}
                    >
                        🎓 Chương trình học
                    </div>
                    <h2
                        style={{
                            fontSize: 'clamp(28px,3.8vw,44px)',
                            fontWeight: 900,
                            color: '#1E1B4B',
                            lineHeight: 1.12,
                            letterSpacing: -1,
                            marginBottom: 12,
                        }}
                    >
                        Ba cấp độ học tập
                        <br />
                        phù hợp từng lứa tuổi
                    </h2>
                    <p style={{ fontSize: 16, color: '#7C6D9B', lineHeight: 1.7, maxWidth: 540, fontWeight: 600 }}>
                        Mỗi chương trình thiết kế riêng, phù hợp sự phát triển của trẻ.
                    </p>
                </div>
                <div
                    className="landing-section-grid"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
                        gap: 22,
                        marginTop: 50,
                    }}
                >
                    {landingData.programs.map((p, i) => (
                        <div
                            key={p.id}
                            {...rv(p.delay)}
                            style={{
                                background: '#fff',
                                borderRadius: 24,
                                padding: 28,
                                boxShadow: '0 4px 18px rgba(109,40,217,0.08)',
                                transition: 'all .3s',
                                position: 'relative',
                                overflow: 'hidden',
                                cursor: 'default',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-7px)')}
                            onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
                        >
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: 4,
                                    background:
                                        i === 0
                                            ? 'linear-gradient(90deg,#6D28D9,#A78BFA)'
                                            : i === 1
                                              ? 'linear-gradient(90deg,#F59E0B,#FBBF24)'
                                              : 'linear-gradient(90deg,#059669,#34D399)',
                                }}
                            />
                            <div
                                style={{
                                    width: 58,
                                    height: 58,
                                    borderRadius: 16,
                                    background: p.bg,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 28,
                                    marginBottom: 16,
                                }}
                            >
                                {p.icon}
                            </div>
                            <span
                                style={{
                                    background: p.bg,
                                    color: p.col,
                                    fontSize: 11,
                                    fontWeight: 800,
                                    padding: '4px 12px',
                                    borderRadius: 50,
                                    display: 'inline-block',
                                    marginBottom: 12,
                                }}
                            >
                                {p.age}
                            </span>
                            <h3 style={{ fontSize: 20, fontWeight: 900, color: '#1E1B4B', marginBottom: 10 }}>
                                {p.cls}
                            </h3>
                            <p style={{ fontSize: 14, color: '#7C6D9B', lineHeight: 1.7 }}>{p.desc}</p>
                            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {p.feats.map((f, j) => (
                                    <div key={j} style={{ fontSize: 13, color: '#4B4899', fontWeight: 600 }}>
                                        {f}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* FEATURES */}
            <section id="features" style={{ padding: '88px 6%' }}>
                <div {...rv()}>
                    <div
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            background: '#EDE9FE',
                            color: '#6D28D9',
                            fontSize: 12,
                            fontWeight: 800,
                            padding: '5px 14px',
                            borderRadius: 50,
                            marginBottom: 14,
                        }}
                    >
                        ⭐ Vì sao chọn Maika
                    </div>
                    <h2
                        style={{
                            fontSize: 'clamp(28px,3.8vw,44px)',
                            fontWeight: 900,
                            color: '#1E1B4B',
                            lineHeight: 1.12,
                            letterSpacing: -1,
                            marginBottom: 12,
                        }}
                    >
                        Chăm sóc, học tập
                        <br />
                        và kết nối gia đình
                    </h2>
                </div>
                <div
                    className="landing-section-grid"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
                        gap: 18,
                        marginTop: 50,
                    }}
                >
                    {[
                        [
                            '👩‍🏫',
                            'Giáo viên phụ trách',
                            'Theo dõi lớp học, điểm danh và ghi nhận tình hình của trẻ mỗi ngày.',
                            '',
                        ],
                        [
                            '🥗',
                            'Dinh dưỡng khoa học',
                            'Thực đơn cân bằng 4 nhóm chất. Cập nhật bữa ăn hằng ngày qua ứng dụng.',
                            'd1',
                        ],
                        [
                            '🏃',
                            'Vận động phong phú',
                            'Sân chơi an toàn rộng rãi, hoạt động thể chất mỗi ngày phát triển thể lực toàn diện.',
                            'd2',
                        ],
                        [
                            '📱',
                            'Cổng phụ huynh',
                            'Nhật ký ngày, ảnh hoạt động, thông báo — tất cả trên cổng thông tin trực tuyến tiện lợi.',
                            'd1',
                        ],
                        [
                            '🔒',
                            'Quản lý an toàn',
                            'Phân quyền truy cập, lưu lịch sử và bảo vệ dữ liệu nhạy cảm của trẻ.',
                            'd2',
                        ],
                        [
                            '🎭',
                            'Nghệ thuật & Âm nhạc',
                            'Lớp âm nhạc, vẽ và múa mỗi tuần — khơi dậy tài năng và đam mê từ nhỏ.',
                            'd3',
                        ],
                    ].map(([icon, title, desc, delay], i) => (
                        <div
                            key={i}
                            {...rv(delay)}
                            style={{
                                background: '#F8F7FF',
                                border: '1.5px solid #EDE9FE',
                                borderRadius: 20,
                                padding: 26,
                                transition: 'all .3s',
                                cursor: 'default',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = '#EDE9FE'
                                e.currentTarget.style.borderColor = '#A78BFA'
                                e.currentTarget.style.transform = 'translateY(-4px)'
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = '#F8F7FF'
                                e.currentTarget.style.borderColor = '#EDE9FE'
                                e.currentTarget.style.transform = 'none'
                            }}
                        >
                            <div
                                style={{
                                    width: 52,
                                    height: 52,
                                    borderRadius: 16,
                                    background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 26,
                                    marginBottom: 14,
                                    boxShadow: '0 4px 14px rgba(109,40,217,0.3)',
                                }}
                            >
                                {icon}
                            </div>
                            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1E1B4B', marginBottom: 8 }}>
                                {title}
                            </h3>
                            <p style={{ fontSize: 14, color: '#7C6D9B', lineHeight: 1.7 }}>{desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* GALLERY */}
            <section id="gallery" style={{ background: '#1E1B4B', padding: '88px 6%' }}>
                <div {...rv()}>
                    <div
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            background: 'rgba(167,139,250,0.18)',
                            color: '#C4B5FD',
                            fontSize: 12,
                            fontWeight: 800,
                            padding: '5px 14px',
                            borderRadius: 50,
                            marginBottom: 14,
                        }}
                    >
                        📸 Hình ảnh hoạt động
                    </div>
                    <h2
                        style={{
                            fontSize: 'clamp(28px,3.8vw,44px)',
                            fontWeight: 900,
                            color: '#fff',
                            lineHeight: 1.12,
                            letterSpacing: -1,
                            marginBottom: 12,
                        }}
                    >
                        Một ngày ở Maika
                    </h2>
                    <p style={{ fontSize: 16, color: '#8B83C3', lineHeight: 1.7, maxWidth: 540, fontWeight: 600 }}>
                        Các bé vui chơi, học tập và phát triển trong môi trường đầy màu sắc.
                    </p>
                </div>
                <div
                    {...rv()}
                    className="landing-gallery-grid"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4,1fr)',
                        gridTemplateRows: '200px 200px',
                        gap: 14,
                        marginTop: 46,
                    }}
                >
                    {[
                        {
                            bg: 'linear-gradient(135deg,#6D28D9,#A78BFA)',
                            emoji: '🎨',
                            label: 'Giờ vẽ sáng tạo',
                            ov: 'Hoạt động mỹ thuật — Lớp Chồi',
                            span: 'span 2',
                            rspan: 'span 2',
                            fs: 72,
                        },
                        {
                            bg: 'linear-gradient(135deg,#059669,#34D399)',
                            emoji: '🏃',
                            label: 'Thể dục ngoài trời',
                            ov: 'Vận động sáng — toàn trường',
                        },
                        {
                            bg: 'linear-gradient(135deg,#F59E0B,#FBBF24)',
                            emoji: '🍱',
                            label: 'Bữa trưa ngon lành',
                            ov: 'Cơm gà, canh rau, tráng miệng',
                        },
                        {
                            bg: 'linear-gradient(135deg,#EC4899,#F9A8D4)',
                            emoji: '🎵',
                            label: 'Lớp âm nhạc',
                            ov: 'Học hát cùng cô Hạnh',
                        },
                        {
                            bg: 'linear-gradient(135deg,#0891B2,#38BDF8)',
                            emoji: '😴',
                            label: 'Giờ nghỉ trưa',
                            ov: 'Giấc ngủ trưa an lành',
                            span: 'span 2',
                        },
                        {
                            bg: 'linear-gradient(135deg,#7C3AED,#C4B5FD)',
                            emoji: '📚',
                            label: 'Giờ đọc sách',
                            ov: 'Thư viện lớp học',
                        },
                    ].map((item, i) => (
                        <div
                            key={i}
                            style={{
                                gridColumn: item.span,
                                gridRow: item.rspan,
                                borderRadius: 18,
                                overflow: 'hidden',
                                position: 'relative',
                                cursor: 'pointer',
                                transition: 'transform .25s',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.transform = 'scale(1.04)'
                                e.currentTarget.querySelector('.ov').style.opacity = 1
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.transform = 'none'
                                e.currentTarget.querySelector('.ov').style.opacity = 0
                            }}
                        >
                            <div
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    background: item.bg,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 10,
                                    color: 'rgba(255,255,255,0.9)',
                                    fontWeight: 700,
                                    fontSize: 14,
                                }}
                            >
                                <span style={{ fontSize: item.fs || 42 }}>{item.emoji}</span>
                                <span>{item.label}</span>
                            </div>
                            <div
                                className="ov"
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'linear-gradient(0deg,rgba(30,27,75,0.85),transparent 55%)',
                                    opacity: 0,
                                    transition: 'opacity .25s',
                                    display: 'flex',
                                    alignItems: 'flex-end',
                                    padding: 14,
                                }}
                            >
                                <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{item.ov}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div style={{ textAlign: 'center', marginTop: 28 }}>
                    <button
                        onClick={() => navigate('/parent')}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '12px 26px',
                            borderRadius: 50,
                            background: 'rgba(255,255,255,0.1)',
                            border: '1.5px solid rgba(255,255,255,0.2)',
                            color: 'rgba(255,255,255,0.82)',
                            fontWeight: 700,
                            fontSize: 14,
                        }}
                    >
                        📸 Xem thêm ảnh trên cổng phụ huynh →
                    </button>
                </div>
            </section>

            {/* TESTIMONIALS */}
            <section id="testimonials" style={{ padding: '88px 6%', background: '#F8F7FF' }}>
                <div {...rv()}>
                    <div
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            background: '#EDE9FE',
                            color: '#6D28D9',
                            fontSize: 12,
                            fontWeight: 800,
                            padding: '5px 14px',
                            borderRadius: 50,
                            marginBottom: 14,
                        }}
                    >
                        Kết nối phụ huynh
                    </div>
                    <h2
                        style={{
                            fontSize: 'clamp(28px,3.8vw,44px)',
                            fontWeight: 900,
                            color: '#1E1B4B',
                            lineHeight: 1.12,
                            letterSpacing: -1,
                        }}
                    >
                        Thông tin giữa nhà trường và gia đình
                    </h2>
                </div>
                <div
                    className="landing-section-grid"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
                        gap: 22,
                        marginTop: 50,
                    }}
                >
                    {[
                        {
                            stars: '',
                            text: 'Thông báo, thực đơn, hình ảnh đầy đủ trên cổng thông tin.',
                            av: '01',
                            name: 'Theo dõi hằng ngày',
                            role: 'Thông tin cập nhật theo học sinh',
                            bg: 'linear-gradient(135deg,#6D28D9,#A78BFA)',
                            delay: '',
                        },
                        {
                            stars: '',
                            text: 'Nhà trường gửi thông báo quan trọng đến phụ huynh.',
                            av: '02',
                            name: 'Thông báo tập trung',
                            role: 'Sự kiện, học phí, sức khỏe',
                            bg: 'linear-gradient(135deg,#F59E0B,#FBBF24)',
                            delay: 'd1',
                        },
                        {
                            stars: '',
                            text: 'Quyền riêng tư hình ảnh học sinh được quản lý chặt chẽ.',
                            av: '03',
                            name: 'Quyền riêng tư',
                            role: 'Được sự đồng ý của phụ huynh',
                            bg: 'linear-gradient(135deg,#059669,#34D399)',
                            delay: 'd2',
                        },
                    ].map((t, i) => (
                        <div
                            key={i}
                            {...rv(t.delay)}
                            style={{
                                background: '#fff',
                                borderRadius: 22,
                                padding: 26,
                                boxShadow: '0 4px 18px rgba(109,40,217,0.08)',
                                border: '1.5px solid #EDE9FE',
                                position: 'relative',
                            }}
                        >
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 14,
                                    right: 20,
                                    fontSize: 72,
                                    color: '#EDE9FE',
                                    fontFamily: 'Georgia,serif',
                                    lineHeight: 1,
                                    pointerEvents: 'none',
                                }}
                            >
                                &ldquo;
                            </div>
                            {t.stars && (
                                <div style={{ marginBottom: 12, fontSize: 14, letterSpacing: 2 }}>{t.stars}</div>
                            )}
                            <p
                                style={{
                                    fontSize: 14,
                                    color: '#4B4899',
                                    lineHeight: 1.8,
                                    marginBottom: 16,
                                    position: 'relative',
                                    zIndex: 1,
                                }}
                            >
                                {t.text}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div
                                    style={{
                                        width: 42,
                                        height: 42,
                                        borderRadius: 12,
                                        background: t.bg,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#fff',
                                        fontWeight: 800,
                                        fontSize: 14,
                                    }}
                                >
                                    {t.av}
                                </div>
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
            <section
                id="cta"
                style={{
                    background: 'linear-gradient(135deg,#4C1D95,#6D28D9,#7C3AED)',
                    padding: '96px 6%',
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        width: 420,
                        height: 420,
                        borderRadius: '50%',
                        background: 'rgba(167,139,250,0.12)',
                        top: -160,
                        left: -100,
                        pointerEvents: 'none',
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        width: 320,
                        height: 320,
                        borderRadius: '50%',
                        background: 'rgba(245,158,11,0.1)',
                        bottom: -90,
                        right: -70,
                        pointerEvents: 'none',
                    }}
                />
                <h2
                    {...rv()}
                    style={{
                        fontSize: 'clamp(28px,4.5vw,50px)',
                        fontWeight: 900,
                        color: '#fff',
                        letterSpacing: -1,
                        marginBottom: 14,
                        position: 'relative',
                        zIndex: 1,
                    }}
                >
                    Sẵn sàng cho bé
                    <br />
                    khởi đầu tốt đẹp?
                </h2>
                <p
                    {...rv()}
                    style={{
                        fontSize: 17,
                        color: 'rgba(255,255,255,0.75)',
                        marginBottom: 40,
                        fontWeight: 600,
                        position: 'relative',
                        zIndex: 1,
                    }}
                >
                    Đăng ký tham quan hoàn toàn miễn phí. Chúng tôi sẽ liên hệ trong vòng 24 giờ.
                </p>
                <form
                    {...rv()}
                    className="landing-cta-form"
                    onSubmit={handleCTA}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 12,
                        maxWidth: 720,
                        margin: '0 auto',
                        position: 'relative',
                        zIndex: 1,
                        textAlign: 'left',
                    }}
                >
                    <input
                        value={ctaForm.website}
                        onChange={e => setCtaField('website', e.target.value)}
                        tabIndex={-1}
                        autoComplete="off"
                        aria-hidden="true"
                        style={{ display: 'none' }}
                    />
                    <input
                        value={ctaForm.parentName}
                        onChange={e => setCtaField('parentName', e.target.value)}
                        type="text"
                        placeholder="Tên phụ huynh"
                        aria-label="Tên phụ huynh"
                        style={{
                            minWidth: 0,
                            padding: '14px 18px',
                            borderRadius: 16,
                            border: '1px solid rgba(255,255,255,0.24)',
                            fontSize: 14,
                            color: '#1E1B4B',
                        }}
                    />
                    <input
                        value={ctaForm.phone}
                        onChange={e => setCtaField('phone', e.target.value)}
                        id="cta-phone"
                        type="tel"
                        placeholder="Số điện thoại"
                        aria-label="Số điện thoại phụ huynh"
                        style={{
                            minWidth: 0,
                            padding: '14px 18px',
                            borderRadius: 16,
                            border: '1px solid rgba(255,255,255,0.24)',
                            fontSize: 14,
                            color: '#1E1B4B',
                        }}
                    />
                    <select
                        value={ctaForm.childAge}
                        onChange={e => setCtaField('childAge', e.target.value)}
                        aria-label="Độ tuổi của bé"
                        style={{
                            minWidth: 0,
                            padding: '14px 18px',
                            borderRadius: 16,
                            border: '1px solid rgba(255,255,255,0.24)',
                            fontSize: 14,
                            color: '#1E1B4B',
                            background: '#fff',
                        }}
                    >
                        <option value="">Độ tuổi của bé</option>
                        <option value="3-4 tuổi">3-4 tuổi</option>
                        <option value="4-5 tuổi">4-5 tuổi</option>
                        <option value="5-6 tuổi">5-6 tuổi</option>
                    </select>
                    <input
                        value={ctaForm.note}
                        onChange={e => setCtaField('note', e.target.value)}
                        type="text"
                        placeholder="Ghi chú thêm nếu có"
                        aria-label="Ghi chú thêm"
                        style={{
                            minWidth: 0,
                            padding: '14px 18px',
                            borderRadius: 16,
                            border: '1px solid rgba(255,255,255,0.24)',
                            fontSize: 14,
                            color: '#1E1B4B',
                        }}
                    />
                    <button
                        type="submit"
                        disabled={ctaSubmitting}
                        style={{
                            gridColumn: '1 / -1',
                            justifySelf: 'center',
                            padding: '14px 28px',
                            borderRadius: 50,
                            background: 'linear-gradient(135deg,#F59E0B,#FBBF24)',
                            color: '#1E1B4B',
                            fontWeight: 900,
                            fontSize: 14,
                            border: 'none',
                            whiteSpace: 'nowrap',
                            opacity: ctaSubmitting ? 0.72 : 1,
                        }}
                    >
                        {ctaSubmitting ? 'Đang gửi...' : 'Đăng ký ngay'}
                    </button>
                </form>
                <p
                    aria-live="polite"
                    style={{
                        fontSize: 14,
                        color: ctaStatus.type === 'error' ? '#FCA5A5' : '#FCD34D',
                        fontWeight: 700,
                        minHeight: 22,
                        marginTop: 14,
                        position: 'relative',
                        zIndex: 1,
                    }}
                >
                    {ctaStatus.message}
                </p>
                <div
                    {...rv()}
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: 44,
                        flexWrap: 'wrap',
                        marginTop: 48,
                        position: 'relative',
                        zIndex: 1,
                    }}
                >
                    {[
                        ['📍', 'Tổ 23B, KP Trần Cao Vân\nPhường Dầu Giây, Đồng Nai'],
                        ['📞', '0348326733\n0348326733'],
                        ['⏰', '6:30 – 17:30\nThứ Hai – Thứ Sáu'],
                        ['✉️', 'info@maika.edu.vn'],
                    ].map(([icon, text], i) => (
                        <div key={i} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.8)' }}>
                            <div style={{ fontSize: 26, marginBottom: 6 }}>{icon}</div>
                            <p style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                                {text}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* FOOTER */}
            <footer style={{ background: '#0F0D2E', padding: '56px 6% 26px' }}>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
                        gap: 40,
                        marginBottom: 44,
                    }}
                >
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <div
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 12,
                                    background: 'linear-gradient(135deg,#6D28D9,#A78BFA)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 22,
                                }}
                            >
                                🌸
                            </div>
                            <span style={{ fontWeight: 900, fontSize: 18, color: '#fff' }}>Maika</span>
                        </div>
                        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.72)', lineHeight: 1.8, maxWidth: 260 }}>
                            Cổng thông tin giúp nhà trường, giáo viên và phụ huynh theo dõi hoạt động của trẻ.
                        </p>
                    </div>
                    {[
                        ['Chương trình', ['Lớp Mầm (3–4 tuổi)', 'Lớp Chồi (4–5 tuổi)', 'Lớp Lá (5–6 tuổi)']],
                        ['Gia đình', ['Cổng phụ huynh', 'Lịch tham quan', 'Quy định nhà trường']],
                        [
                            'Liên hệ',
                            ['0348326733', 'info@maika.edu.vn', 'Tổ 23B. KP Trần Cao Vân - Phường Dầu Giây - Đồng Nai'],
                        ],
                    ].map(([title, links], i) => (
                        <div key={i}>
                            <h3
                                style={{
                                    fontSize: 12,
                                    fontWeight: 800,
                                    color: '#C4B5FD',
                                    letterSpacing: 1.5,
                                    textTransform: 'uppercase',
                                    marginBottom: 14,
                                }}
                            >
                                {title}
                            </h3>
                            {links.map((l, j) => (
                                <a
                                    key={j}
                                    href="#"
                                    style={{
                                        display: 'block',
                                        fontSize: 14,
                                        color: 'rgba(255,255,255,0.74)',
                                        marginBottom: 10,
                                        fontWeight: 600,
                                    }}
                                >
                                    {l}
                                </a>
                            ))}
                        </div>
                    ))}
                </div>
                <div
                    style={{
                        borderTop: '1px solid rgba(255,255,255,0.12)',
                        paddingTop: 22,
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 13,
                        color: 'rgba(255,255,255,0.68)',
                        flexWrap: 'wrap',
                        gap: 8,
                    }}
                >
                    <span>© 2026 Maika Nursery School.</span>
                    <span style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        <a
                            href="/privacy"
                            style={{ color: 'rgba(255,255,255,0.68)', textDecoration: 'underline', fontWeight: 700 }}
                        >
                            Chính sách dữ liệu
                        </a>
                        <span>Bảo mật dữ liệu phụ huynh và trẻ</span>
                    </span>
                </div>
            </footer>
        </div>
    )
}
