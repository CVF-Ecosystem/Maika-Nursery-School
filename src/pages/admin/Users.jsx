import { useEffect, useMemo, useState } from 'react'
import { apiRequest, hasBackendAPI } from '../../data/api'
import { isSupabaseSession } from '../../data/backendMode'
import { getDB } from '../../data/store'
import { listFacilities } from '../../features/facilities/facilityService'
import { listParentLinks, listProfiles, replaceParentLink, saveProfile } from '../../features/profiles/profileService'
import { listStudents } from '../../features/students/studentService'

const ROLE_LABEL = { admin: 'Admin', teacher: 'Giáo viên', parent: 'Phụ huynh' }
const STATUS_LABEL = { active: 'Đang hoạt động', locked: 'Đã khóa' }

function UserModal({ user, students, onClose, onSave }) {
    const [form, setForm] = useState({
        role: user?.role || 'teacher',
        displayName: user?.display_name || user?.name || '',
        phone: user?.phone || '',
        email: user?.email || '',
        password: '',
        studentId: user?.student_id || user?.studentId || '',
        status: user?.status || 'active',
    })
    const is = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #DDD6FE', fontSize: 13, color: '#1E1B4B', boxSizing: 'border-box', background: '#fff' }
    const ls = { fontSize: 12, fontWeight: 700, color: '#6B6494', display: 'block', marginBottom: 4 }
    const id = user?.id || 'new'

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{ background: '#fff', borderRadius: 20, width: 520, maxHeight: '90vh', overflowY: 'auto', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: '#1E1B4B', marginBottom: 18 }}>{user ? 'Chỉnh sửa tài khoản' : 'Tạo tài khoản mới'}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                        <label htmlFor={`user-role-${id}`} style={ls}>Vai trò</label>
                        <select id={`user-role-${id}`} style={is} value={form.role} onChange={e => setForm({ ...form, role: e.target.value, studentId: e.target.value === 'parent' ? form.studentId : '' })}>
                            <option value="admin">Admin</option>
                            <option value="teacher">Giáo viên</option>
                            <option value="parent">Phụ huynh</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor={`user-status-${id}`} style={ls}>Trạng thái</label>
                        <select id={`user-status-${id}`} style={is} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                            <option value="active">Đang hoạt động</option>
                            <option value="locked">Đã khóa</option>
                        </select>
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                        <label htmlFor={`user-display-${id}`} style={ls}>Tên hiển thị *</label>
                        <input id={`user-display-${id}`} style={is} value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} />
                    </div>
                    <div>
                        <label htmlFor={`user-phone-${id}`} style={ls}>Điện thoại</label>
                        <input id={`user-phone-${id}`} style={is} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                    </div>
                    <div>
                        <label htmlFor={`user-email-${id}`} style={ls}>Email</label>
                        <input id={`user-email-${id}`} style={is} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                    </div>
                    {form.role === 'parent' && (
                        <div style={{ gridColumn: '1/-1' }}>
                            <label htmlFor={`user-student-${id}`} style={ls}>Liên kết học sinh</label>
                            <select id={`user-student-${id}`} style={is} value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })}>
                                <option value="">Chưa liên kết</option>
                                {students.map(s => <option key={s.id} value={s.id}>{s.name} · {s.parentPhone}</option>)}
                            </select>
                        </div>
                    )}
                    <div style={{ gridColumn: '1/-1' }}>
                        <label htmlFor={`user-password-${id}`} style={ls}>{user ? 'Mật khẩu mới' : 'Mật khẩu'}</label>
                        <input id={`user-password-${id}`} type="password" style={is} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={form.role === 'parent' ? 'Phụ huynh có thể đăng nhập bằng số điện thoại' : user ? 'Để trống nếu không đổi' : 'Nhập mật khẩu'} />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #DDD6FE', background: '#fff', fontSize: 13, fontWeight: 700, color: '#6B6494', cursor: 'pointer' }}>Hủy</button>
                    <button onClick={() => onSave(form)} style={{ padding: '9px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Lưu tài khoản</button>
                </div>
            </div>
        </div>
    )
}

function SupabaseUsers() {
    const [profiles, setProfiles] = useState([])
    const [students, setStudents] = useState([])
    const [facilities, setFacilities] = useState([])
    const [links, setLinks] = useState([])
    const [editing, setEditing] = useState(null)
    const [err, setErr] = useState('')
    const [query, setQuery] = useState('')

    async function reload() {
        setErr('')
        try {
            const [nextProfiles, nextStudents, nextFacilities, nextLinks] = await Promise.all([
                listProfiles(),
                listStudents({ status: 'active' }),
                listFacilities(),
                listParentLinks(),
            ])
            setProfiles(nextProfiles)
            setStudents(nextStudents)
            setFacilities(nextFacilities)
            setLinks(nextLinks)
        } catch (ex) {
            setErr(ex.message)
        }
    }

    useEffect(() => { reload() }, [])

    async function save(form) {
        try {
            await saveProfile(form)
            if (form.role === 'parent') {
                await replaceParentLink({ parentProfileId: form.id, studentId: form.studentId || '' })
            }
            setEditing(null)
            await reload()
        } catch (ex) {
            setErr(ex.message)
        }
    }

    const filtered = profiles.filter(profile => `${profile.fullName} ${profile.email} ${profile.phone} ${profile.role}`.toLowerCase().includes(query.toLowerCase()))
    const linkFor = profileId => links.find(link => link.parent_profile_id === profileId)

    return (
        <div style={{ padding: '28px 36px' }}>
            {editing && <SupabaseUserModal profile={editing} facilities={facilities} students={students} link={linkFor(editing.id)} onClose={() => setEditing(null)} onSave={save} />}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <div>
                    <div style={{ fontWeight: 900, fontSize: 18, color: '#1E1B4B' }}>Quản lý tài khoản</div>
                    <div style={{ fontSize: 13, color: '#7C6D9B', marginTop: 2 }}>Quản lý vai trò, trạng thái truy cập, cơ sở giáo viên và học sinh của phụ huynh.</div>
                </div>
            </div>
            <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', color: '#92400E', borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
                Tạo tài khoản đăng nhập mới hoặc đặt lại mật khẩu hiện được thực hiện trong trang quản trị tài khoản của hệ thống. Sau khi tạo, có thể cập nhật vai trò và liên kết học sinh tại đây.
            </div>
            {err && <div style={{ background: '#FEF2F2', color: '#DC2626', borderRadius: 12, padding: 12, fontWeight: 800, marginBottom: 14 }}>{err}</div>}
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm tên, email, vai trò..." style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #DDD6FE', marginBottom: 14 }} />
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(109,40,217,0.08)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: '#F8F7FF' }}>{['Tên', 'Role', 'Cơ sở/Con', 'Liên hệ', 'Trạng thái', ''].map(h => <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, color: '#7C6D9B' }}>{h}</th>)}</tr></thead>
                    <tbody>
                        {filtered.map(profile => {
                            const facility = facilities.find(f => f.id === profile.facilityId)
                            const link = linkFor(profile.id)
                            const student = students.find(s => s.id === link?.student_id)
                            return (
                                <tr key={profile.id} style={{ borderTop: '1px solid #EDE9FE' }}>
                                    <td style={{ padding: '12px 14px', fontWeight: 800 }}>{profile.fullName}</td>
                                    <td style={{ padding: '12px 14px' }}>{ROLE_LABEL[profile.role] || profile.role}</td>
                                    <td style={{ padding: '12px 14px', color: '#6B6494' }}>{profile.role === 'teacher' ? facility?.code || '—' : profile.role === 'parent' ? student?.name || 'Chưa liên kết' : 'Tất cả'}</td>
                                    <td style={{ padding: '12px 14px', color: '#6B6494' }}>{profile.email || profile.phone || '—'}</td>
                                    <td style={{ padding: '12px 14px' }}>{profile.isActive ? 'Đang hoạt động' : 'Đã khóa'}</td>
                                    <td style={{ padding: '12px 14px' }}><button onClick={() => setEditing(profile)} style={{ border: '1.5px solid #7C3AED', background: '#fff', color: '#7C3AED', borderRadius: 8, padding: '6px 12px', fontWeight: 800 }}>Sửa</button></td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function SupabaseUserModal({ profile, facilities, students, link, onClose, onSave }) {
    const [form, setForm] = useState({
        ...profile,
        studentId: link?.student_id || '',
        status: profile.isActive ? 'active' : 'locked',
    })
    const input = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #DDD6FE' }
    const label = { fontSize: 12, fontWeight: 800, color: '#6B6494', display: 'block', marginBottom: 4 }

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{ width: 540, background: '#fff', borderRadius: 18, padding: 24 }}>
                <div style={{ fontWeight: 900, color: '#1E1B4B', marginBottom: 16 }}>Cập nhật tài khoản</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ gridColumn: '1/-1' }}><label style={label}>Tên</label><input style={input} value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} /></div>
                    <div><label style={label}>Role</label><select style={input} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="admin">Admin</option><option value="teacher">Giáo viên</option><option value="parent">Phụ huynh</option></select></div>
                    <div><label style={label}>Trạng thái</label><select style={input} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="active">Đang hoạt động</option><option value="locked">Đã khóa</option></select></div>
                    <div><label style={label}>Email</label><input style={input} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                    <div><label style={label}>Điện thoại</label><input style={input} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                    {form.role === 'teacher' && <div style={{ gridColumn: '1/-1' }}><label style={label}>Cơ sở giáo viên</label><select style={input} value={form.facilityId} onChange={e => setForm({ ...form, facilityId: e.target.value })}>{facilities.map(f => <option key={f.id} value={f.id}>{f.code} - {f.name}</option>)}</select></div>}
                    {form.role === 'parent' && <div style={{ gridColumn: '1/-1' }}><label style={label}>Liên kết học sinh</label><select style={input} value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })}><option value="">Chưa liên kết</option>{students.map(s => <option key={s.id} value={s.id}>{s.name} · {s.className || 'chưa lớp'}</option>)}</select></div>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                    <button onClick={onClose} style={{ border: '1.5px solid #DDD6FE', background: '#fff', borderRadius: 10, padding: '9px 16px', fontWeight: 800 }}>Hủy</button>
                    <button onClick={() => onSave(form)} style={{ border: 'none', background: '#6D28D9', color: '#fff', borderRadius: 10, padding: '9px 18px', fontWeight: 900 }}>Lưu</button>
                </div>
            </div>
        </div>
    )
}

export default function Users() {
    if (isSupabaseSession()) return <SupabaseUsers />

    const [users, setUsers] = useState([])
    const [modal, setModal] = useState(null)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(hasBackendAPI())
    const [query, setQuery] = useState('')
    const db = getDB()

    async function loadUsers() {
        if (!hasBackendAPI()) return
        setLoading(true)
        setError('')
        try {
            const body = await apiRequest('/api/users')
            setUsers(body.data || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadUsers() }, [])

    const filtered = useMemo(() => users.filter(user => {
        const text = `${user.display_name} ${user.phone || ''} ${user.email || ''} ${ROLE_LABEL[user.role] || user.role}`.toLowerCase()
        return text.includes(query.toLowerCase())
    }), [users, query])

    async function saveUser(form) {
        const payload = {
            role: form.role,
            displayName: form.displayName.trim(),
            phone: form.phone.trim(),
            email: form.email.trim(),
            password: form.password || undefined,
            studentId: form.role === 'parent' ? form.studentId || null : null,
            status: form.status,
        }
        try {
            if (modal?.id) await apiRequest(`/api/users/${modal.id}`, { method: 'PUT', body: JSON.stringify(payload) })
            else await apiRequest('/api/users', { method: 'POST', body: JSON.stringify(payload) })
            setModal(null)
            await loadUsers()
        } catch (err) {
            setError(err.message)
        }
    }

    const sel = { padding: '9px 14px', borderRadius: 10, border: '1.5px solid #DDD6FE', fontSize: 13, color: '#1E1B4B', background: '#fff' }

    if (!hasBackendAPI()) {
        return (
            <div style={{ padding: '28px 36px' }}>
                <div style={{ background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 2px 16px rgba(109,40,217,0.08)' }}>
                    <div style={{ fontWeight: 800, fontSize: 18, color: '#1E1B4B', marginBottom: 8 }}>Quản lý tài khoản</div>
                    <div style={{ color: '#7C6D9B', fontSize: 14, lineHeight: 1.7 }}>Quản lý tài khoản đang được chuẩn bị cho môi trường vận hành chính thức.</div>
                </div>
            </div>
        )
    }

    return (
        <div style={{ padding: '28px 36px' }}>
            {modal && <UserModal user={modal === 'add' ? null : modal} students={db.students} onClose={() => setModal(null)} onSave={saveUser} />}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: '#1E1B4B' }}>Quản lý tài khoản</div>
                    <div style={{ fontSize: 13, color: '#7C6D9B', marginTop: 2 }}>{users.filter(u => u.status === 'active').length} đang hoạt động · {users.length} tổng cộng</div>
                </div>
                <button onClick={() => setModal('add')} style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 14px rgba(109,40,217,0.35)' }}>+ Tạo tài khoản</button>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm theo tên, SĐT, email, vai trò..." style={{ ...sel, flex: 1 }} />
            </div>
            {error && <div style={{ color: '#DC2626', background: '#FEF2F2', borderRadius: 10, padding: '10px 14px', fontSize: 12, fontWeight: 700, marginBottom: 16 }}>{error}</div>}
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(109,40,217,0.08)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: '#F8F7FF' }}>{['Tài khoản', 'Vai trò', 'Liên hệ', 'Liên kết', 'Trạng thái', ''].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#7C6D9B', borderBottom: '1.5px solid #DDD6FE' }}>{h}</th>)}</tr></thead>
                    <tbody>
                        {filtered.map(user => {
                            const student = db.students.find(s => s.id === user.student_id)
                            return (
                                <tr key={user.id} style={{ borderBottom: '1px solid #EDE9FE' }}>
                                    <td style={{ padding: '12px 16px' }}><div style={{ fontWeight: 800, fontSize: 13, color: '#1E1B4B' }}>{user.display_name}</div><div style={{ fontSize: 11, color: '#9B93C9' }}>{user.id}</div></td>
                                    <td style={{ padding: '12px 16px' }}><span style={{ fontSize: 12, fontWeight: 800, color: '#7C3AED', background: '#EDE9FE', borderRadius: 6, padding: '3px 9px' }}>{ROLE_LABEL[user.role] || user.role}</span></td>
                                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B6494' }}>{user.phone || user.email || '—'}</td>
                                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#1E1B4B', fontWeight: 700 }}>{student?.name || '—'}</td>
                                    <td style={{ padding: '12px 16px' }}><span style={{ fontSize: 12, fontWeight: 800, color: user.status === 'active' ? '#16A34A' : '#DC2626', background: user.status === 'active' ? '#F0FDF4' : '#FEF2F2', borderRadius: 6, padding: '3px 9px' }}>{STATUS_LABEL[user.status] || user.status}</span></td>
                                    <td style={{ padding: '12px 16px' }}><button onClick={() => setModal(user)} style={{ padding: '5px 12px', borderRadius: 8, border: '1.5px solid #7C3AED', background: '#fff', color: '#7C3AED', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Sửa</button></td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                {loading && <div style={{ textAlign: 'center', padding: 36, color: '#7C6D9B', fontSize: 14 }}>Đang tải tài khoản...</div>}
                {!loading && filtered.length === 0 && <div style={{ textAlign: 'center', padding: 36, color: '#7C6D9B', fontSize: 14 }}>Không tìm thấy tài khoản</div>}
            </div>
        </div>
    )
}
