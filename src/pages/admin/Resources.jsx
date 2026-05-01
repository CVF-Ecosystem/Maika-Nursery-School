import { useState } from 'react'
import { getDB, commit } from '../../data/store'

const TYPE_ICON = { audio: '🎵', pdf: '📄', video: '🎬', doc: '📝', image: '🖼️' }
const TYPE_COLOR = { audio: '#7C3AED', pdf: '#DC2626', video: '#EC4899', doc: '#0891B2', image: '#F59E0B' }

export default function Resources() {
    const [db, setDB] = useState(getDB())
    const [filter, setFilter] = useState('all')
    const [search, setSearch] = useState('')

    const filtered = db.resources.filter(r => {
        if (filter !== 'all' && r.type !== filter) return false
        if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false
        return true
    })

    function deleteResource(id) {
        if (!confirm('Xóa tài nguyên này?')) return
        const ndb = getDB(); ndb.resources = ndb.resources.filter(r => r.id !== id)
        commit(); setDB({ ...ndb })
    }

    const sel = { padding: '9px 14px', borderRadius: 10, border: '1.5px solid #DDD6FE', fontSize: 13, color: '#1E1B4B', background: '#fff' }

    return (
        <div className="admin-page-pad" style={{ padding: '28px 36px' }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Tìm tài nguyên..." style={{ ...sel, flex: 1 }} />
                <select value={filter} onChange={e => setFilter(e.target.value)} style={sel}>
                    <option value="all">Tất cả loại</option>
                    {['audio', 'pdf', 'video', 'doc', 'image'].map(t => <option key={t} value={t}>{TYPE_ICON[t]} {t.toUpperCase()}</option>)}
                </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,260px),1fr))', gap: 16 }}>
                {filtered.map(r => {
                    const col = TYPE_COLOR[r.type] || '#6B6494'; const icon = TYPE_ICON[r.type] || '📦'
                    return (
                        <div key={r.id} style={{ background: '#fff', borderRadius: 18, padding: '20px 22px', boxShadow: '0 2px 16px rgba(109,40,217,0.08)', border: '1.5px solid #EDE9FE' }}>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
                                <div style={{ width: 48, height: 48, borderRadius: 14, background: col + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>{icon}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1E1B4B', lineHeight: 1.3 }}>{r.title}</div>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: col, background: col + '18', padding: '2px 8px', borderRadius: 6, display: 'inline-block', marginTop: 4 }}>{r.type.toUpperCase()}</span>
                                </div>
                            </div>
                            <div style={{ fontSize: 12, color: '#6B6494', marginBottom: 12 }}>
                                <div>📚 {r.category}</div>
                                <div>👤 {r.uploader}</div>
                                <div>📅 {r.uploadDate} · {r.size}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <a href={r.url} style={{ flex: 1, padding: '8px', borderRadius: 10, border: '1.5px solid #7C3AED', background: '#fff', color: '#7C3AED', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'center', textDecoration: 'none' }}>⬇️ Tải xuống</a>
                                <button onClick={() => deleteResource(r.id)} style={{ padding: '8px 12px', borderRadius: 10, border: '1.5px solid #DC2626', background: '#fff', color: '#DC2626', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>🗑</button>
                            </div>
                        </div>
                    )
                })}
            </div>
            {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#7C6D9B', fontSize: 14 }}>Không tìm thấy tài nguyên nào</div>}
        </div>
    )
}
