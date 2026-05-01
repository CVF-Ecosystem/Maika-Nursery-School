// src/data/store.js — Maika Data Layer (localStorage persistence)
// Migrated from bb-data.js to ES module

const BB_KEY = 'maika_v1';

export const defaultData = {
    students: [
        { id: 's1', name: 'Nguyễn Minh An', dob: '2020-03-15', classId: 'c1', parentName: 'Nguyễn Văn Hùng', parentPhone: '0901234567', parentEmail: 'hung.nv@email.com', enrollDate: '2023-09-01', status: 'active', initials: 'MA', gender: 'male' },
        { id: 's2', name: 'Trần Bảo Châu', dob: '2020-07-22', classId: 'c1', parentName: 'Trần Thị Mai', parentPhone: '0912345678', parentEmail: 'mai.tt@email.com', enrollDate: '2023-09-01', status: 'active', initials: 'BC', gender: 'female' },
        { id: 's3', name: 'Lê Hoàng Dũng', dob: '2020-01-10', classId: 'c1', parentName: 'Lê Văn Dũng', parentPhone: '0923456789', parentEmail: 'dung.lv@email.com', enrollDate: '2023-09-01', status: 'active', initials: 'HD', gender: 'male' },
        { id: 's4', name: 'Phạm Ngọc Hà', dob: '2019-11-05', classId: 'c2', parentName: 'Phạm Thị Lan', parentPhone: '0934567890', parentEmail: 'lan.pt@email.com', enrollDate: '2023-09-01', status: 'active', initials: 'NH', gender: 'female' },
        { id: 's5', name: 'Vũ Thành Khôi', dob: '2019-08-18', classId: 'c2', parentName: 'Vũ Quang Minh', parentPhone: '0945678901', parentEmail: 'minh.vq@email.com', enrollDate: '2023-09-01', status: 'active', initials: 'TK', gender: 'male' },
        { id: 's6', name: 'Đặng Phương Linh', dob: '2019-05-30', classId: 'c2', parentName: 'Đặng Văn Phúc', parentPhone: '0956789012', parentEmail: 'phuc.dv@email.com', enrollDate: '2023-09-01', status: 'active', initials: 'PL', gender: 'female' },
        { id: 's7', name: 'Hoàng Bảo Long', dob: '2019-02-14', classId: 'c2', parentName: 'Hoàng Thị Nga', parentPhone: '0967890123', parentEmail: 'nga.ht@email.com', enrollDate: '2024-01-15', status: 'active', initials: 'BL', gender: 'male' },
        { id: 's8', name: 'Ngô Thị Mỹ Linh', dob: '2018-12-25', classId: 'c3', parentName: 'Ngô Văn Tài', parentPhone: '0978901234', parentEmail: 'tai.nv@email.com', enrollDate: '2023-09-01', status: 'active', initials: 'ML', gender: 'female' },
        { id: 's9', name: 'Bùi Quốc Nam', dob: '2018-09-08', classId: 'c3', parentName: 'Bùi Thị Hương', parentPhone: '0989012345', parentEmail: 'huong.bt@email.com', enrollDate: '2023-09-01', status: 'active', initials: 'QN', gender: 'male' },
        { id: 's10', name: 'Đinh Thảo Nguyên', dob: '2018-06-20', classId: 'c3', parentName: 'Đinh Văn Hải', parentPhone: '0990123456', parentEmail: 'hai.dv@email.com', enrollDate: '2023-09-01', status: 'active', initials: 'TN', gender: 'female' },
        { id: 's11', name: 'Trương Gia Phát', dob: '2018-04-02', classId: 'c3', parentName: 'Trương Thị Bình', parentPhone: '0901234560', parentEmail: 'binh.tt@email.com', enrollDate: '2023-09-01', status: 'active', initials: 'GP', gender: 'male' },
        { id: 's12', name: 'Lý Thanh Quỳnh', dob: '2020-10-11', classId: 'c1', parentName: 'Lý Văn Sơn', parentPhone: '0912345670', parentEmail: 'son.lv@email.com', enrollDate: '2024-02-01', status: 'active', initials: 'TQ', gender: 'female' },
        { id: 's13', name: 'Mai Đức Huy', dob: '2019-12-05', classId: 'c2', parentName: 'Mai Thị Cúc', parentPhone: '0923456780', parentEmail: 'cuc.mt@email.com', enrollDate: '2024-01-10', status: 'active', initials: 'DH', gender: 'male' },
        { id: 's14', name: 'Cao Bảo Trân', dob: '2018-08-17', classId: 'c3', parentName: 'Cao Văn Tuấn', parentPhone: '0934567800', parentEmail: 'tuan.cv@email.com', enrollDate: '2023-09-01', status: 'active', initials: 'BT', gender: 'female' },
        { id: 's15', name: 'Phan Quang Vinh', dob: '2020-05-03', classId: 'c1', parentName: 'Phan Thị Thu', parentPhone: '0945678900', parentEmail: 'thu.pt@email.com', enrollDate: '2024-03-01', status: 'inactive', initials: 'QV', gender: 'male' }
    ],
    teachers: [
        { id: 't1', name: 'Nguyễn Thị Hoa', classId: 'c1', subject: 'Giáo viên chủ nhiệm', phone: '0901111111', email: 'hoa.nt@maika.edu.vn', joinDate: '2022-08-01', status: 'active', initials: 'TH', degree: 'Cử nhân Giáo dục Mầm non' },
        { id: 't2', name: 'Trần Thị Bích', classId: 'c2', subject: 'Giáo viên chủ nhiệm', phone: '0902222222', email: 'bich.tt@maika.edu.vn', joinDate: '2021-08-01', status: 'active', initials: 'TB', degree: 'Cử nhân Giáo dục Mầm non' },
        { id: 't3', name: 'Lê Thị Phương', classId: 'c3', subject: 'Giáo viên chủ nhiệm', phone: '0903333333', email: 'phuong.lt@maika.edu.vn', joinDate: '2020-08-01', status: 'active', initials: 'TP', degree: 'Thạc sĩ Giáo dục' },
        { id: 't4', name: 'Phạm Văn Toàn', classId: null, subject: 'Giáo viên Thể chất', phone: '0904444444', email: 'toan.pv@maika.edu.vn', joinDate: '2023-01-15', status: 'active', initials: 'VT', degree: 'Cử nhân Thể dục thể thao' },
        { id: 't5', name: 'Võ Thị Hạnh', classId: null, subject: 'Giáo viên Âm nhạc', phone: '0905555555', email: 'hanh.vt@maika.edu.vn', joinDate: '2022-03-01', status: 'active', initials: 'TH2', degree: 'Cử nhân Âm nhạc' },
        { id: 't6', name: 'Đỗ Thị Kim', classId: null, subject: 'Y tế học đường', phone: '0906666666', email: 'kim.dt@maika.edu.vn', joinDate: '2021-09-01', status: 'active', initials: 'TK', degree: 'Cử nhân Y tế' }
    ],
    classes: [
        { id: 'c1', name: 'Lớp Mầm', ageGroup: '3-4 tuổi', teacherId: 't1', color: '#F97316' },
        { id: 'c2', name: 'Lớp Chồi', ageGroup: '4-5 tuổi', teacherId: 't2', color: '#FBBF24' },
        { id: 'c3', name: 'Lớp Lá', ageGroup: '5-6 tuổi', teacherId: 't3', color: '#34D399' }
    ],
    attendance: (() => {
        const recs = [];
        const sids = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 's12', 's13', 's14'];
        const today = new Date();
        for (let d = 29; d >= 0; d--) {
            const dt = new Date(today); dt.setDate(today.getDate() - d);
            if (dt.getDay() === 0 || dt.getDay() === 6) continue;
            const dateStr = dt.toISOString().split('T')[0];
            sids.forEach(sid => {
                const rand = Math.random();
                const status = rand > 0.9 ? 'absent' : rand > 0.85 ? 'late' : 'present';
                recs.push({ id: `att-${dateStr}-${sid}`, studentId: sid, date: dateStr, status, note: '' });
            });
        }
        return recs;
    })(),
    finance: [
        { id: 'f1', studentId: 's1', type: 'tuition', desc: 'Học phí tháng 4/2026', amount: 2500000, date: '2026-04-01', status: 'paid', method: 'Chuyển khoản' },
        { id: 'f2', studentId: 's2', type: 'tuition', desc: 'Học phí tháng 4/2026', amount: 2500000, date: '2026-04-01', status: 'paid', method: 'Tiền mặt' },
        { id: 'f3', studentId: 's3', type: 'tuition', desc: 'Học phí tháng 4/2026', amount: 2500000, date: '2026-04-01', status: 'pending', method: '' },
        { id: 'f4', studentId: 's4', type: 'tuition', desc: 'Học phí tháng 4/2026', amount: 2800000, date: '2026-04-01', status: 'paid', method: 'Chuyển khoản' },
        { id: 'f5', studentId: 's5', type: 'tuition', desc: 'Học phí tháng 4/2026', amount: 2800000, date: '2026-04-01', status: 'paid', method: 'Chuyển khoản' },
        { id: 'f6', studentId: 's6', type: 'tuition', desc: 'Học phí tháng 4/2026', amount: 2800000, date: '2026-04-01', status: 'pending', method: '' },
        { id: 'f7', studentId: 's8', type: 'tuition', desc: 'Học phí tháng 4/2026', amount: 3200000, date: '2026-04-01', status: 'paid', method: 'Chuyển khoản' },
        { id: 'f8', studentId: 's9', type: 'tuition', desc: 'Học phí tháng 4/2026', amount: 3200000, date: '2026-04-01', status: 'overdue', method: '' },
        { id: 'f9', studentId: 's10', type: 'tuition', desc: 'Học phí tháng 4/2026', amount: 3200000, date: '2026-04-01', status: 'paid', method: 'Tiền mặt' },
        { id: 'f10', studentId: 's1', type: 'meal', desc: 'Tiền ăn tháng 4/2026', amount: 600000, date: '2026-04-01', status: 'paid', method: 'Chuyển khoản' },
        { id: 'f11', studentId: 's2', type: 'meal', desc: 'Tiền ăn tháng 4/2026', amount: 600000, date: '2026-04-01', status: 'paid', method: 'Tiền mặt' },
        { id: 'f12', studentId: 's3', type: 'material', desc: 'Học liệu Q2/2026', amount: 350000, date: '2026-04-01', status: 'pending', method: '' },
        { id: 'f13', studentId: 's11', type: 'tuition', desc: 'Học phí tháng 4/2026', amount: 3200000, date: '2026-04-01', status: 'paid', method: 'Chuyển khoản' },
        { id: 'f14', studentId: 's12', type: 'tuition', desc: 'Học phí tháng 4/2026', amount: 2500000, date: '2026-04-01', status: 'paid', method: 'Chuyển khoản' },
        { id: 'f15', studentId: 's13', type: 'tuition', desc: 'Học phí tháng 4/2026', amount: 2800000, date: '2026-04-01', status: 'overdue', method: '' },
    ],
    messages: [
        { id: 'm1', fromRole: 'parent', fromName: 'Nguyễn Văn Hùng', studentId: 's1', subject: 'Xin nghỉ học', content: 'Kính gửi cô, bé An ngày mai bị sốt nên xin nghỉ học. Kính nhờ cô thông báo. Xin cảm ơn!', date: '2026-04-27T08:30:00', read: false, replies: [] },
        { id: 'm2', fromRole: 'parent', fromName: 'Trần Thị Mai', studentId: 's2', subject: 'Hỏi về học phí', content: 'Cô ơi, cho mình hỏi học phí tháng 5 đóng vào ngày nào ạ? Và có thể chuyển khoản không ạ?', date: '2026-04-26T14:15:00', read: true, replies: [{ fromRole: 'admin', fromName: 'Maika School', content: 'Chào phụ huynh! Học phí tháng 5 nộp từ ngày 1-5/5. Nhà trường nhận chuyển khoản. Cảm ơn!', date: '2026-04-26T15:00:00' }] },
        { id: 'm3', fromRole: 'parent', fromName: 'Lê Văn Dũng', studentId: 's3', subject: 'Phản hồi về bữa ăn', content: 'Bé Dũng về có kể là hôm nay canh ngon lắm. Cảm ơn các cô đã chăm sóc bé tốt!', date: '2026-04-25T17:45:00', read: true, replies: [] },
        { id: 'm4', fromRole: 'admin', fromName: 'Maika School', studentId: null, subject: 'Thông báo nghỉ lễ 30/4 - 1/5', content: 'Kính gửi quý phụ huynh, nhà trường thông báo nghỉ lễ từ 30/4 đến 2/5. Các bé đi học lại ngày 5/5. Kính thông báo!', date: '2026-04-24T09:00:00', read: true, replies: [], broadcast: true },
        { id: 'm5', fromRole: 'parent', fromName: 'Hoàng Thị Nga', studentId: 's7', subject: 'Bé bị dị ứng', content: 'Cô ơi, bé Long bị dị ứng tôm và hải sản. Nhờ cô chú ý khi cho bé ăn. Xin cảm ơn!', date: '2026-04-23T11:20:00', read: false, replies: [] }
    ],
    events: [
        { id: 'e1', title: 'Lễ khai giảng năm học 2026-2027', date: '2026-09-05', type: 'school', desc: 'Lễ khai giảng năm học mới' },
        { id: 'e2', title: 'Ngày hội Thiếu nhi 1/6', date: '2026-06-01', type: 'celebration', desc: 'Tổ chức vui chơi, văn nghệ cho các bé' },
        { id: 'e3', title: 'Họp phụ huynh Q2', date: '2026-05-15', type: 'meeting', desc: 'Họp phụ huynh tổng kết học kỳ 2' },
        { id: 'e4', title: 'Khám sức khỏe định kỳ', date: '2026-05-08', type: 'health', desc: 'Khám sức khỏe cho toàn bộ học sinh' },
        { id: 'e5', title: 'Nộp học phí tháng 5', date: '2026-05-05', type: 'finance', desc: 'Hạn chót nộp học phí tháng 5' },
        { id: 'e6', title: 'Nghỉ lễ 30/4 - 1/5', date: '2026-04-30', type: 'holiday', desc: 'Nghỉ lễ Giải phóng miền Nam và Quốc tế Lao động' },
        { id: 'e7', title: 'Tập huấn giáo viên', date: '2026-05-20', type: 'training', desc: 'Tập huấn kỹ năng chăm sóc trẻ mầm non' },
        { id: 'e8', title: 'Tổng kết học kỳ 2', date: '2026-06-20', type: 'school', desc: 'Lễ tổng kết và phát thưởng học kỳ 2' }
    ],
    dailyReports: (() => {
        const reps = [];
        const sids = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10'];
        const today = new Date().toISOString().split('T')[0];
        const moods = ['Vui vẻ', 'Bình thường', 'Mệt mỏi', 'Hào hứng', 'Buồn ngủ'];
        const meals = ['Ăn hết suất', 'Ăn được 3/4', 'Ăn được 1/2', 'Ăn ít', 'Không ăn'];
        sids.forEach(sid => {
            reps.push({
                id: `dr-${today}-${sid}`, studentId: sid, date: today,
                breakfast: meals[Math.floor(Math.random() * 3)],
                lunch: meals[Math.floor(Math.random() * 3)],
                snack: meals[Math.floor(Math.random() * 4)],
                napDuration: [0, 60, 90, 120][Math.floor(Math.random() * 4)],
                mood: moods[Math.floor(Math.random() * 3)],
                activities: ['Vẽ tranh', 'Đọc sách', 'Hát nhạc', 'Vận động', 'Kể chuyện'].slice(0, Math.floor(Math.random() * 3) + 1),
                note: '',
                health: 'Bình thường'
            });
        });
        return reps;
    })(),
    resources: [
        { id: 'r1', title: 'Bài hát thiếu nhi tổng hợp', type: 'audio', category: 'music', url: '#', uploadDate: '2026-03-10', uploader: 'Võ Thị Hạnh', size: '45 MB' },
        { id: 'r2', title: 'Sách giáo khoa mầm non - Toán', type: 'pdf', category: 'math', url: '#', uploadDate: '2026-03-05', uploader: 'Nguyễn Thị Hoa', size: '12 MB' },
        { id: 'r3', title: 'Tranh tô màu động vật', type: 'pdf', category: 'art', url: '#', uploadDate: '2026-02-20', uploader: 'Trần Thị Bích', size: '8 MB' },
        { id: 'r4', title: 'Video học chữ cái A-Z', type: 'video', category: 'literacy', url: '#', uploadDate: '2026-02-15', uploader: 'Lê Thị Phương', size: '320 MB' },
        { id: 'r5', title: 'Kế hoạch tuần - Lớp Mầm', type: 'doc', category: 'plan', url: '#', uploadDate: '2026-04-21', uploader: 'Nguyễn Thị Hoa', size: '2 MB' },
        { id: 'r6', title: 'Trò chơi vận động trong lớp', type: 'video', category: 'physical', url: '#', uploadDate: '2026-04-10', uploader: 'Phạm Văn Toàn', size: '180 MB' }
    ],
    badges: [
        { id: 'b1', studentId: 's1', badge: 'star', name: 'Ngôi sao tuần', earnedDate: '2026-04-25', note: 'Chăm học và ngoan ngoãn' },
        { id: 'b2', studentId: 's2', badge: 'book', name: 'Sâu đọc sách', earnedDate: '2026-04-20', note: 'Đọc nhiều sách nhất lớp' },
        { id: 'b3', studentId: 's4', badge: 'music', name: 'Họa mi nhí', earnedDate: '2026-04-18', note: 'Hát hay nhất lớp' },
        { id: 'b4', studentId: 's8', badge: 'crown', name: 'Học sinh xuất sắc', earnedDate: '2026-04-15', note: 'Kết quả học tập tốt nhất tháng' },
        { id: 'b5', studentId: 's9', badge: 'heart', name: 'Bạn tốt của mọi người', earnedDate: '2026-04-10', note: 'Hay giúp đỡ bạn bè' },
        { id: 'b6', studentId: 's3', badge: 'star', name: 'Tiến bộ vượt bậc', earnedDate: '2026-04-22', note: 'Cố gắng học tập tốt hơn nhiều' }
    ]
};

function loadData() {
    try {
        if (hasApi()) {
            const cached = sessionStorage.getItem('maika_api_snapshot');
            if (cached) return JSON.parse(cached);
        }
        const raw = localStorage.getItem(BB_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) { }
    return JSON.parse(JSON.stringify(defaultData));
}

function saveData(data) {
    localStorage.setItem(BB_KEY, JSON.stringify(data));
}

let _db = null;

function hasApi() {
    return typeof import.meta !== 'undefined' && Boolean(import.meta.env?.VITE_API_URL);
}

function getApiToken() {
    try {
        return sessionStorage.getItem('maika_api_token') || '';
    } catch {
        return '';
    }
}

function apiUrl(path) {
    return `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}${path}`;
}

async function syncSnapshot(data) {
    const token = getApiToken();
    if (!hasApi() || !token) return;

    await fetch(apiUrl('/api/snapshot'), {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ data }),
    });
}

export function getDB() {
    if (!_db) _db = loadData();
    return _db;
}

export function commit() {
    if (hasApi()) {
        try { sessionStorage.setItem('maika_api_snapshot', JSON.stringify(_db)); } catch { }
        syncSnapshot(_db).catch(() => { });
    } else {
        saveData(_db);
    }
}

export function resetDB() {
    _db = JSON.parse(JSON.stringify(defaultData));
    saveData(_db);
}

export const todayStr = () => new Date().toISOString().split('T')[0];

export async function hydrateFromAPI() {
    const token = getApiToken();
    if (!hasApi() || !token) return getDB();

    const response = await fetch(apiUrl('/api/snapshot'), {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Không tải được dữ liệu.');

    const payload = await response.json();
    _db = payload.data;
    sessionStorage.setItem('maika_api_snapshot', JSON.stringify(_db));
    return _db;
}

export function clearApiSnapshot() {
    try { sessionStorage.removeItem('maika_api_snapshot'); } catch { }
    _db = null;
}
