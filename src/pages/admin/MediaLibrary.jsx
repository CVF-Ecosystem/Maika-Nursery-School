import { useEffect, useRef, useState } from 'react'
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

async function uploadFile(file, albumId, opts = {}) {
    const token = sessionStorage.getItem('maika_api_token')
    const fd = new FormData()
    fd.append('file', file)
    if (albumId) fd.append('albumId', albumId)
    const res = await fetch(API + '/api/media-assets/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Upload thất bại')
    return json.data
}

const STATUS_BADGE = {
    draft: { label: 'Nháp', bg: '#F3F4F6', color: '#6B7280' },
    published: { label: 'Đã đăng', bg: '#ECFDF5', color: '#059669' },
    archived: { label: 'Lưu trữ', bg: '#F9FAFB', color: '#9CA3AF' },
}

export default function MediaLibrary({ readOnly = false, forParent = false }) {
    const [albums, setAlbums] = useState([])
    const [assets, setAssets] = useState([])
    const [activeAlbum, setActiveAlbum] = useState(null)
    const [showAlbumForm, setShowAlbumForm] = useState(false)
    const [albumForm, setAlbumForm] = useState({ title: '', description: '', status: 'draft' })
    const [uploading, setUploading] = useState(false)
    const [err, setErr] = useState('')
    const fileRef = useRef()

    function reloadAlbums() {
        apiFetch(`/api/media-albums${forParent ? '' : ''}`)
            .then(setAlbums)
            .catch(() => setErr('Lỗi tải album'))
    }

    function reloadAssets(albumId) {
        const qs = albumId ? `?albumId=${albumId}` : ''
        apiFetch(`/api/media-assets${qs}`)
            .then(setAssets)
            .catch(() => setErr('Lỗi tải ảnh'))
    }

    useEffect(() => {
        if (!hasBackendAPI()) return
        reloadAlbums()
        reloadAssets(null)
    }, [])

    function selectAlbum(album) {
        setActiveAlbum(album)
        reloadAssets(album?.id || null)
    }

    async function createAlbum(e) {
        e.preventDefault()
        try {
            await apiFetch('/api/media-albums', { method: 'POST', body: JSON.stringify(albumForm) })
            setShowAlbumForm(false)
            setAlbumForm({ title: '', description: '', status: 'draft' })
            reloadAlbums()
        } catch (ex) { setErr(ex.message) }
    }

    async function publishAlbum(album) {
        try {
            await apiFetch(`/api/media-albums/${album.id}`, { method: 'PUT', body: JSON.stringify({ status: 'published' }) })
            reloadAlbums()
        } catch (ex) { setErr(ex.message) }
    }

    async function handleFileUpload(e) {
        const files = Array.from(e.target.files || [])
        if (!files.length) return
        setUploading(true)
        setErr('')
        for (const file of files) {
            try {
                await uploadFile(file, activeAlbum?.id)
            } catch (ex) { setErr(ex.message) }
        }
        setUploading(false)
        reloadAssets(activeAlbum?.id || null)
        e.target.value = ''
    }

    async function publishAsset(asset) {
        try {
            await apiFetch(`/api/media-assets/${asset.id}`, { method: 'PUT', body: JSON.stringify({ status: 'published' }) })
            reloadAssets(activeAlbum?.id || null)
        } catch (ex) { setErr(ex.message) }
    }

    async function archiveAsset(asset) {
        try {
            await apiFetch(`/api/media-assets/${asset.id}`, { method: 'PUT', body: JSON.stringify({ status: 'archived' }) })
            reloadAssets(activeAlbum?.id || null)
        } catch (ex) { setErr(ex.message) }
    }

    if (!hasBackendAPI()) {
        return (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: '#7C6D9B' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔌</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Cần kết nối Backend API</div>
            </div>
        )
    }

    const displayAssets = forParent ? assets.filter(a => a.status === 'published') : assets

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20 }}>
            {/* Album sidebar */}
            <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#1E1B4B', marginBottom: 10 }}>📁 Albums</div>
                {!readOnly && !forParent && (
                    <button onClick={() => setShowAlbumForm(true)} style={{ width: '100%', marginBottom: 10, padding: '8px 12px', borderRadius: 10, border: '1.5px dashed #DDD6FE', background: '#F5F3FF', color: '#6D28D9', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        + Tạo album
                    </button>
                )}

                <div onClick={() => selectAlbum(null)} style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13, background: !activeAlbum ? '#EDE9FE' : '#fff', color: !activeAlbum ? '#6D28D9' : '#5B5490', marginBottom: 4 }}>
                    🖼️ Tất cả ảnh
                </div>

                {albums.map(a => {
                    const badge = STATUS_BADGE[a.status] || STATUS_BADGE.draft
                    return (
                        <div key={a.id} onClick={() => selectAlbum(a)}
                            style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', background: activeAlbum?.id === a.id ? '#EDE9FE' : '#fff', color: activeAlbum?.id === a.id ? '#6D28D9' : '#5B5490', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>{a.title}</div>
                                <span style={{ fontSize: 10, fontWeight: 700, background: badge.bg, color: badge.color, borderRadius: 20, padding: '1px 6px' }}>{badge.label}</span>
                            </div>
                            {!readOnly && !forParent && a.status === 'draft' && (
                                <button onClick={e => { e.stopPropagation(); publishAlbum(a) }}
                                    style={{ fontSize: 10, background: '#ECFDF5', color: '#059669', border: 'none', borderRadius: 6, padding: '3px 7px', cursor: 'pointer', fontWeight: 700 }}>
                                    Đăng
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Asset grid */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1E1B4B' }}>
                        {activeAlbum ? `📁 ${activeAlbum.title}` : '🖼️ Tất cả ảnh'} ({displayAssets.length})
                    </div>
                    {!readOnly && !forParent && (
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileUpload} />
                            <button onClick={() => fileRef.current?.click()} disabled={uploading}
                                style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: uploading ? 'wait' : 'pointer' }}>
                                {uploading ? '⏳ Đang upload...' : '📤 Upload ảnh'}
                            </button>
                        </div>
                    )}
                </div>

                {err && <div style={{ color: '#DC2626', fontSize: 13, marginBottom: 10 }}>{err}</div>}

                {/* Album form */}
                {showAlbumForm && (
                    <form onSubmit={createAlbum} style={{ background: '#F5F3FF', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                        <input value={albumForm.title} onChange={e => setAlbumForm(f => ({ ...f, title: e.target.value }))} placeholder="Tên album..." required style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #DDD6FE', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }} />
                        <input value={albumForm.description} onChange={e => setAlbumForm(f => ({ ...f, description: e.target.value }))} placeholder="Mô tả (tùy chọn)..." style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #DDD6FE', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }} />
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button type="submit" style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#6D28D9', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Tạo</button>
                            <button type="button" onClick={() => setShowAlbumForm(false)} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #DDD6FE', background: '#fff', color: '#6D28D9', fontWeight: 700, cursor: 'pointer' }}>Hủy</button>
                        </div>
                    </form>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
                    {displayAssets.map(asset => {
                        const badge = STATUS_BADGE[asset.status] || STATUS_BADGE.draft
                        const imgUrl = API + asset.path
                        return (
                            <div key={asset.id} style={{ borderRadius: 12, overflow: 'hidden', position: 'relative', border: '2px solid #EDE9FE', background: '#F5F3FF' }}>
                                <div style={{ aspectRatio: '1', background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                    {asset.mime_type?.startsWith('image/') ? (
                                        <img src={imgUrl} alt={asset.caption || asset.original_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                                    ) : (
                                        <span style={{ fontSize: 32 }}>📄</span>
                                    )}
                                </div>
                                <div style={{ padding: '8px 10px' }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#1E1B4B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.caption || asset.original_name}</div>
                                    <span style={{ fontSize: 10, fontWeight: 700, background: badge.bg, color: badge.color, borderRadius: 20, padding: '1px 6px' }}>{badge.label}</span>
                                </div>
                                {!readOnly && !forParent && (
                                    <div style={{ display: 'flex', gap: 4, padding: '0 10px 8px' }}>
                                        {asset.status === 'draft' && (
                                            <button onClick={() => publishAsset(asset)} style={{ flex: 1, fontSize: 10, background: '#ECFDF5', color: '#059669', border: 'none', borderRadius: 6, padding: '4px', cursor: 'pointer', fontWeight: 700 }}>Đăng</button>
                                        )}
                                        {asset.status === 'published' && (
                                            <button onClick={() => archiveAsset(asset)} style={{ flex: 1, fontSize: 10, background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 6, padding: '4px', cursor: 'pointer', fontWeight: 700 }}>Lưu trữ</button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                    {displayAssets.length === 0 && (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 48, color: '#7C6D9B' }}>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>🖼️</div>
                            <div style={{ fontWeight: 700 }}>Chưa có ảnh nào</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
