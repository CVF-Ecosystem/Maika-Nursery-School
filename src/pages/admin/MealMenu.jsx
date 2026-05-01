import { useEffect, useState } from 'react'
import { hasBackendAPI } from '../../data/api'

const API = import.meta.env.VITE_API_URL || ''

async function apiFetch(path, opts = {}) {
    const token = sessionStorage.getItem('maika_api_token')
    const res = await fetch(API + path, {
        ...opts,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Lỗi server')
    return json.data
}

const DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật']
const MEAL_TYPES = [
    { value: 'breakfast', label: '🌅 Bữa sáng' },
    { value: 'lunch', label: '🍱 Bữa trưa' },
    { value: 'snack', label: '🍎 Bữa xế' },
]

function getMondayOf(date) {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    return d.toISOString().split('T')[0]
}

function offsetWeek(weekStart, n) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + n * 7)
    return d.toISOString().split('T')[0]
}

export default function MealMenu({ readOnly = false }) {
    const [weekStart, setWeekStart] = useState(() => getMondayOf(new Date()))
    const [menus, setMenus] = useState([])
    const [editCell, setEditCell] = useState(null)
    const [editForm, setEditForm] = useState({ dishes: [], ingredients: '', allergenNotes: '', isPublished: false })
    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState('')

    function reload() {
        if (!hasBackendAPI()) return
        apiFetch(`/api/meal-menus?weekStart=${weekStart}`)
            .then(setMenus)
            .catch(() => setErr('Lỗi tải dữ liệu'))
    }

    useEffect(reload, [weekStart])

    function getMenu(dayOfWeek, mealType) {
        return menus.find(m => m.day_of_week === dayOfWeek && m.meal_type === mealType)
    }

    function openEdit(dayOfWeek, mealType) {
        if (readOnly) return
        const menu = getMenu(dayOfWeek, mealType)
        setEditCell({ dayOfWeek, mealType })
        setEditForm({
            dishes: menu?.dishes || [],
            dishInput: '',
            ingredients: menu?.ingredients || '',
            allergenNotes: menu?.allergen_notes || '',
            isPublished: !!menu?.is_published,
        })
        setErr('')
    }

    async function handleSave() {
        setSaving(true)
        try {
            await apiFetch('/api/meal-menus', {
                method: 'PUT',
                body: JSON.stringify({
                    weekStart,
                    dayOfWeek: editCell.dayOfWeek,
                    mealType: editCell.mealType,
                    dishes: editForm.dishes,
                    ingredients: editForm.ingredients,
                    allergenNotes: editForm.allergenNotes,
                    isPublished: editForm.isPublished,
                }),
            })
            setEditCell(null)
            reload()
        } catch (ex) { setErr(ex.message) }
        setSaving(false)
    }

    function addDish() {
        const d = editForm.dishInput?.trim()
        if (!d) return
        setEditForm(f => ({ ...f, dishes: [...f.dishes, d], dishInput: '' }))
    }

    function removeDish(i) {
        setEditForm(f => ({ ...f, dishes: f.dishes.filter((_, idx) => idx !== i) }))
    }

    if (!hasBackendAPI()) {
        return (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: '#7C6D9B' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔌</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Thực đơn đang được chuẩn bị</div>
            </div>
        )
    }

    const weekLabel = `${weekStart} → ${offsetWeek(weekStart, 1).slice(5)}`

    return (
        <div>
            {/* Week navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                <button onClick={() => setWeekStart(w => offsetWeek(w, -1))} style={navBtn}>← Tuần trước</button>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#1E1B4B', flex: 1, textAlign: 'center' }}>📅 Tuần {weekLabel}</div>
                <button onClick={() => setWeekStart(w => offsetWeek(w, 1))} style={navBtn}>Tuần sau →</button>
                <button onClick={() => setWeekStart(getMondayOf(new Date()))} style={{ ...navBtn, background: '#EDE9FE', color: '#6D28D9' }}>Hôm nay</button>
            </div>

            {err && <div style={{ color: '#DC2626', fontSize: 13, marginBottom: 12 }}>{err}</div>}

            {/* Meal grid */}
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ background: '#F5F3FF' }}>
                            <th style={th}>Bữa ăn</th>
                            {DAYS.slice(0, 5).map((d, i) => (
                                <th key={i} style={th}>{d}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {MEAL_TYPES.map(mt => (
                            <tr key={mt.value} style={{ borderBottom: '1px solid #EDE9FE' }}>
                                <td style={{ ...td, fontWeight: 700, background: '#FAFAFA', color: '#5B5490', whiteSpace: 'nowrap' }}>{mt.label}</td>
                                {[1, 2, 3, 4, 5].map(day => {
                                    const menu = getMenu(day, mt.value)
                                    const isEditing = editCell?.dayOfWeek === day && editCell?.mealType === mt.value
                                    return (
                                        <td key={day} onClick={() => openEdit(day, mt.value)}
                                            style={{ ...td, cursor: readOnly ? 'default' : 'pointer', background: isEditing ? '#F5F3FF' : (menu?.is_published ? '#ECFDF5' : '#fff'), verticalAlign: 'top', minWidth: 120 }}>
                                            {menu?.dishes?.length > 0 ? (
                                                <div>
                                                    {menu.is_published && <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', marginBottom: 4, display: 'block' }}>✓ Đã đăng</span>}
                                                    <ul style={{ margin: 0, padding: '0 0 0 16px', color: '#1E1B4B' }}>
                                                        {menu.dishes.map((d, i) => <li key={i}>{d}</li>)}
                                                    </ul>
                                                    {menu.allergen_notes && <div style={{ fontSize: 11, color: '#D97706', marginTop: 4 }}>⚠ {menu.allergen_notes}</div>}
                                                </div>
                                            ) : (
                                                !readOnly && <div style={{ color: '#DDD6FE', fontSize: 12, textAlign: 'center', padding: '8px 0' }}>+ Thêm</div>
                                            )}
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Edit panel */}
            {editCell && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,27,75,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 500, padding: '24px 24px 32px', maxHeight: '85vh', overflowY: 'auto' }}>
                        <div style={{ fontWeight: 800, fontSize: 16, color: '#1E1B4B', marginBottom: 16 }}>
                            {MEAL_TYPES.find(m => m.value === editCell.mealType)?.label} — {DAYS[editCell.dayOfWeek - 1]}
                        </div>

                        <div style={{ marginBottom: 14 }}>
                            <label style={lbl}>Món ăn</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input value={editForm.dishInput || ''} onChange={e => setEditForm(f => ({ ...f, dishInput: e.target.value }))}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addDish())}
                                    placeholder="Nhập tên món rồi Enter..." style={{ ...inp, flex: 1 }} />
                                <button onClick={addDish} style={smallBtn}>+ Thêm</button>
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                                {editForm.dishes.map((d, i) => (
                                    <span key={i} style={{ background: '#EDE9FE', color: '#6D28D9', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                        {d}
                                        <button onClick={() => removeDish(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9333EA', fontWeight: 900, lineHeight: 1 }}>×</button>
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <label style={lbl}>Thành phần chính</label>
                            <input value={editForm.ingredients} onChange={e => setEditForm(f => ({ ...f, ingredients: e.target.value }))} placeholder="Gà, rau, tinh bột..." style={inp} />
                        </div>

                        <div style={{ marginBottom: 14 }}>
                            <label style={lbl}>Cảnh báo dị ứng</label>
                            <input value={editForm.allergenNotes} onChange={e => setEditForm(f => ({ ...f, allergenNotes: e.target.value }))} placeholder="Có tôm, lạc, sữa..." style={inp} />
                        </div>

                        <label style={{ fontSize: 13, color: '#059669', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, fontWeight: 700 }}>
                            <input type="checkbox" checked={editForm.isPublished} onChange={e => setEditForm(f => ({ ...f, isPublished: e.target.checked }))} />
                            Đăng thực đơn (phụ huynh xem được)
                        </label>

                        {err && <div style={{ color: '#DC2626', fontSize: 13, marginBottom: 10 }}>{err}</div>}

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={() => setEditCell(null)} style={{ flex: 1, padding: 12, borderRadius: 12, border: '1.5px solid #DDD6FE', background: '#fff', color: '#6D28D9', fontWeight: 700, cursor: 'pointer' }}>Hủy</button>
                            <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 12, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontWeight: 800, cursor: saving ? 'wait' : 'pointer' }}>
                                {saving ? 'Đang lưu...' : '💾 Lưu'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

const th = { padding: '12px 10px', textAlign: 'left', fontWeight: 700, color: '#5B5490', fontSize: 12 }
const td = { padding: '10px', border: '1px solid #EDE9FE' }
const lbl = { fontSize: 12, fontWeight: 700, color: '#5B5490', display: 'block', marginBottom: 4 }
const inp = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #DDD6FE', fontSize: 13, color: '#1E1B4B', boxSizing: 'border-box' }
const smallBtn = { padding: '10px 14px', borderRadius: 8, border: 'none', background: '#EDE9FE', color: '#6D28D9', fontWeight: 700, cursor: 'pointer' }
const navBtn = { padding: '8px 16px', borderRadius: 10, border: '1.5px solid #DDD6FE', background: '#fff', color: '#5B5490', fontWeight: 700, cursor: 'pointer', fontSize: 13 }
