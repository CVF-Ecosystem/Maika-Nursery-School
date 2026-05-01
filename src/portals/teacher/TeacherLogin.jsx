import AdminLogin from '../../pages/admin/AdminLogin'

export default function TeacherLogin() {
    return (
        <AdminLogin
            defaultRole="teacher"
            lockedRole
            title="Cổng Giáo Viên"
            subtitle="Điểm danh · Nhật ký · Hình ảnh"
            backTo="/"
        />
    )
}
