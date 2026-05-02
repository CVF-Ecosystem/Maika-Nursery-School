import { useNavigate } from 'react-router-dom'

const CONTACT_EMAIL = 'info@maika.edu.vn'
const CONTACT_PHONE = '0348326733'
const EFFECTIVE_DATE = '01/05/2026'

export default function Privacy() {
    const navigate = useNavigate()
    return (
        <div
            style={{
                minHeight: '100vh',
                background: '#F5F3FF',
                padding: '32px 16px',
                fontFamily: 'Nunito, system-ui, sans-serif',
            }}
        >
            <div
                style={{
                    maxWidth: 780,
                    margin: '0 auto',
                    background: '#fff',
                    borderRadius: 20,
                    padding: '40px 36px',
                    boxShadow: '0 18px 48px rgba(109,40,217,0.10)',
                }}
            >
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        border: 'none',
                        background: 'none',
                        color: '#6D28D9',
                        fontWeight: 800,
                        fontSize: 14,
                        cursor: 'pointer',
                        marginBottom: 24,
                        padding: 0,
                    }}
                >
                    ← Quay lại
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <div
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 13,
                            background: 'linear-gradient(135deg,#6D28D9,#A78BFA)',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: 22,
                        }}
                    >
                        🌸
                    </div>
                    <span style={{ fontWeight: 900, fontSize: 22, color: '#1E1B4B' }}>Maika Nursery School</span>
                </div>
                <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1E1B4B', margin: '16px 0 4px' }}>
                    Chính Sách Bảo Vệ Dữ Liệu Cá Nhân
                </h1>
                <p style={{ color: '#7C6D9B', fontWeight: 700, marginBottom: 32 }}>
                    Có hiệu lực từ: {EFFECTIVE_DATE} · Cập nhật lần cuối: {EFFECTIVE_DATE}
                </p>

                <Section title="1. Phạm vi áp dụng">
                    <p>
                        Chính sách này áp dụng cho toàn bộ dữ liệu cá nhân mà <strong>Nhà trẻ Maika</strong> thu thập,
                        lưu trữ và xử lý trong quá trình cung cấp dịch vụ chăm sóc, giáo dục trẻ em tại các cơ sở của
                        chúng tôi. Phụ huynh và người giám hộ hợp pháp của trẻ là chủ thể dữ liệu theo quy định tại Nghị
                        định 13/2023/NĐ-CP.
                    </p>
                </Section>

                <Section title="2. Dữ liệu chúng tôi thu thập">
                    <p>
                        <strong>Dữ liệu của trẻ em (dữ liệu nhạy cảm theo Điều 9 NĐ 13/2023):</strong>
                    </p>
                    <ul>
                        <li>Họ tên, ngày sinh, giới tính, lớp học, cơ sở theo học</li>
                        <li>Hình ảnh trong các hoạt động tại trường (ảnh bữa ăn, sinh hoạt nhóm)</li>
                        <li>Hồ sơ sức khỏe: dị ứng, thuốc đang dùng, bác sĩ phụ trách, liên hệ khẩn cấp</li>
                        <li>Hồ sơ điểm danh hàng ngày, giờ đón/trả, người đón</li>
                        <li>Báo cáo sự cố (nếu có) trong quá trình học tại trường</li>
                    </ul>
                    <p>
                        <strong>Dữ liệu của phụ huynh/người giám hộ:</strong>
                    </p>
                    <ul>
                        <li>Họ tên, số điện thoại, địa chỉ email</li>
                        <li>Thông tin tài chính học phí (số tiền, ngày nộp, hình thức thanh toán)</li>
                        <li>Tùy chọn đồng ý nhận thông báo và chia sẻ hình ảnh</li>
                    </ul>
                </Section>

                <Section title="3. Mục đích thu thập và sử dụng">
                    <ul>
                        <li>Quản lý hồ sơ học sinh và theo dõi sự phát triển của trẻ</li>
                        <li>Thông báo cho phụ huynh về tình trạng sức khỏe, điểm danh, học phí</li>
                        <li>Xử lý học phí và phát hành biên lai</li>
                        <li>Lập kế hoạch thực đơn phù hợp với tình trạng dị ứng của trẻ</li>
                        <li>Đảm bảo an toàn và xử lý tình huống khẩn cấp</li>
                        <li>Tuân thủ các yêu cầu pháp lý về giáo dục mầm non</li>
                    </ul>
                    <p>
                        Chúng tôi <strong>không</strong> sử dụng dữ liệu cho mục đích quảng cáo thương mại hoặc chia sẻ
                        với bên thứ ba ngoài mục đích vận hành trường học.
                    </p>
                </Section>

                <Section title="4. Cơ sở pháp lý xử lý dữ liệu">
                    <ul>
                        <li>Thực hiện hợp đồng dịch vụ giáo dục giữa nhà trường và phụ huynh</li>
                        <li>Đồng ý rõ ràng của phụ huynh/người giám hộ khi đăng ký nhập học</li>
                        <li>Nghĩa vụ pháp lý theo quy định của Bộ Giáo dục và Đào tạo</li>
                        <li>Lợi ích thiết yếu của trẻ em (sức khỏe, an toàn)</li>
                    </ul>
                </Section>

                <Section title="5. Lưu trữ và bảo mật dữ liệu">
                    <p>
                        Dữ liệu được lưu trữ trên hệ thống Supabase (máy chủ đặt tại Singapore, đáp ứng tiêu chuẩn SOC 2
                        Type II và ISO 27001). Toàn bộ dữ liệu được mã hóa khi truyền (TLS 1.2+) và khi lưu trữ. Quyền
                        truy cập được kiểm soát chặt chẽ theo vai trò (admin, giáo viên, phụ huynh) thông qua Row Level
                        Security (RLS).
                    </p>
                    <p>
                        <strong>Thời gian lưu trữ:</strong> Dữ liệu hồ sơ học sinh được lưu trong thời gian học tại
                        trường và tối đa 3 năm sau khi trẻ thôi học. Hình ảnh lưu tối đa 2 năm hoặc theo đồng ý của phụ
                        huynh. Dữ liệu tài chính lưu theo quy định pháp luật kế toán (tối thiểu 5 năm).
                    </p>
                </Section>

                <Section title="6. Chia sẻ dữ liệu">
                    <p>
                        Chúng tôi không bán hoặc cho thuê dữ liệu cá nhân. Dữ liệu có thể được chia sẻ trong các trường
                        hợp sau:
                    </p>
                    <ul>
                        <li>
                            <strong>Nhân viên nội bộ:</strong> Giáo viên và nhân viên nhà trường chỉ được truy cập dữ
                            liệu thuộc cơ sở mình phụ trách
                        </li>
                        <li>
                            <strong>Yêu cầu pháp lý:</strong> Cơ quan nhà nước có thẩm quyền khi có quyết định/yêu cầu
                            hợp pháp
                        </li>
                        <li>
                            <strong>Tình huống khẩn cấp:</strong> Cơ sở y tế, cứu thương khi cần xử lý sự cố sức khỏe
                            của trẻ
                        </li>
                    </ul>
                </Section>

                <Section title="7. Quyền của phụ huynh/người giám hộ">
                    <p>
                        Theo Nghị định 13/2023/NĐ-CP, phụ huynh có các quyền sau đây và có thể thực hiện bằng cách liên
                        hệ với chúng tôi:
                    </p>
                    <ul>
                        <li>
                            <strong>Quyền truy cập:</strong> Yêu cầu xem toàn bộ dữ liệu cá nhân của con
                        </li>
                        <li>
                            <strong>Quyền chỉnh sửa:</strong> Yêu cầu sửa thông tin không chính xác
                        </li>
                        <li>
                            <strong>Quyền xóa:</strong> Yêu cầu xóa dữ liệu (trừ dữ liệu bắt buộc giữ theo pháp luật)
                        </li>
                        <li>
                            <strong>Quyền rút đồng ý:</strong> Rút đồng ý chia sẻ hình ảnh bất kỳ lúc nào qua Cổng Phụ
                            Huynh → mục Quyền Riêng Tư
                        </li>
                        <li>
                            <strong>Quyền phản đối:</strong> Phản đối việc xử lý dữ liệu không cần thiết
                        </li>
                        <li>
                            <strong>Quyền khiếu nại:</strong> Khiếu nại đến Cục An toàn thông tin, Bộ TT&TT nếu quyền bị
                            vi phạm
                        </li>
                    </ul>
                    <p>
                        Chúng tôi sẽ phản hồi trong vòng <strong>72 giờ làm việc</strong> kể từ khi nhận được yêu cầu
                        hợp lệ.
                    </p>
                </Section>

                <Section title="8. Thông báo vi phạm dữ liệu">
                    <p>
                        Trong trường hợp xảy ra sự cố bảo mật ảnh hưởng đến dữ liệu cá nhân, chúng tôi sẽ thông báo đến
                        phụ huynh bị ảnh hưởng và cơ quan có thẩm quyền trong vòng 72 giờ theo quy định tại Điều 23 Nghị
                        định 13/2023/NĐ-CP.
                    </p>
                </Section>

                <Section title="9. Cookie và công nghệ theo dõi">
                    <p>
                        Ứng dụng web của chúng tôi sử dụng sessionStorage và localStorage của trình duyệt chỉ để lưu
                        trạng thái đăng nhập và tùy chọn giao diện. Chúng tôi không dùng cookie theo dõi bên thứ ba hoặc
                        công nghệ quảng cáo.
                    </p>
                </Section>

                <Section title="10. Liên hệ">
                    <p>Mọi yêu cầu về dữ liệu cá nhân, khiếu nại hoặc câu hỏi về chính sách này, vui lòng liên hệ:</p>
                    <div style={{ background: '#F5F3FF', borderRadius: 12, padding: '16px 20px', marginTop: 12 }}>
                        <p style={{ margin: '4px 0', fontWeight: 800, color: '#1E1B4B' }}>
                            Nhà trẻ Maika — Bộ phận Bảo vệ Dữ liệu
                        </p>
                        <p style={{ margin: '4px 0', color: '#5B5490' }}>
                            Email:{' '}
                            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#6D28D9', fontWeight: 700 }}>
                                {CONTACT_EMAIL}
                            </a>
                        </p>
                        <p style={{ margin: '4px 0', color: '#5B5490' }}>
                            Điện thoại:{' '}
                            <a
                                href={`tel:${CONTACT_PHONE.replace(/\s/g, '')}`}
                                style={{ color: '#6D28D9', fontWeight: 700 }}
                            >
                                {CONTACT_PHONE}
                            </a>
                        </p>
                        <p style={{ margin: '4px 0', color: '#5B5490' }}>
                            Địa chỉ: Tổ 23B, KP Trần Cao Vân, Phường Dầu Giây, Đồng Nai
                        </p>
                    </div>
                </Section>

                <p style={{ marginTop: 36, fontSize: 13, color: '#9CA3AF', textAlign: 'center' }}>
                    Chính sách này tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân tại Việt Nam.
                </p>
            </div>
        </div>
    )
}

function Section({ title, children }) {
    return (
        <div style={{ marginBottom: 28 }}>
            <h2
                style={{
                    fontSize: 17,
                    fontWeight: 900,
                    color: '#1E1B4B',
                    marginBottom: 10,
                    paddingBottom: 8,
                    borderBottom: '2px solid #EDE9FE',
                }}
            >
                {title}
            </h2>
            <div style={{ color: '#374151', lineHeight: 1.8, fontWeight: 600, fontSize: 15 }}>{children}</div>
        </div>
    )
}
