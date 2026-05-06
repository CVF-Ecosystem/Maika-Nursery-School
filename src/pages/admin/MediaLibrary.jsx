import { useEffect, useMemo, useRef, useState } from 'react'
import { hasBackendAPI } from '../../data/api'
import { isSupabaseSession } from '../../data/backendMode'
import { getCurrentProfile } from '../../features/auth/authService'
import {
    deleteMediaAsset,
    listAlbums,
    listAssets,
    saveAlbum,
    updateAssetStatus,
    uploadMediaAsset,
} from '../../features/media/mediaService'
import PaginationBar from '../../components/PaginationBar'

const API = import.meta.env.VITE_API_URL || ''
const ASSETS_PER_PAGE = 12

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

function LegacyMediaLibrary({ readOnly = false, forParent = false }) {
    const [albums, setAlbums] = useState([])
    const [assets, setAssets] = useState([])
    const [activeAlbum, setActiveAlbum] = useState(null)
    const [showAlbumForm, setShowAlbumForm] = useState(false)
    const [albumForm, setAlbumForm] = useState({ title: '', description: '', status: 'draft' })
    const [uploading, setUploading] = useState(false)
    const [page, setPage] = useState(1)
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
        } catch (ex) {
            setErr(ex.message)
        }
    }

    async function publishAlbum(album) {
        try {
            await apiFetch(`/api/media-albums/${album.id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'published' }),
            })
            reloadAlbums()
        } catch (ex) {
            setErr(ex.message)
        }
    }

    async function handleFileUpload(e) {
        const files = Array.from(e.target.files || [])
        if (!files.length) return
        setUploading(true)
        setErr('')
        for (const file of files) {
            try {
                await uploadFile(file, activeAlbum?.id)
            } catch (ex) {
                setErr(ex.message)
            }
        }
        setUploading(false)
        reloadAssets(activeAlbum?.id || null)
        e.target.value = ''
    }

    async function publishAsset(asset) {
        try {
            await apiFetch(`/api/media-assets/${asset.id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'published' }),
            })
            reloadAssets(activeAlbum?.id || null)
        } catch (ex) {
            setErr(ex.message)
        }
    }

    async function archiveAsset(asset) {
        try {
            await apiFetch(`/api/media-assets/${asset.id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'archived' }),
            })
            reloadAssets(activeAlbum?.id || null)
        } catch (ex) {
            setErr(ex.message)
        }
    }

    const displayAssets = useMemo(
        () => (forParent ? assets.filter(a => a.status === 'published') : assets),
        [assets, forParent],
    )
    const pagedAssets = useMemo(
        () => displayAssets.slice((page - 1) * ASSETS_PER_PAGE, page * ASSETS_PER_PAGE),
        [displayAssets, page],
    )

    useEffect(() => {
        setPage(1)
    }, [activeAlbum?.id, displayAssets.length])

    if (!hasBackendAPI()) {
        return (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: '#7C6D9B' }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Thư viện ảnh chưa khả dụng</div>
            </div>
        )
    }

    return (
        <div
            className="mobile-two-col"
            style={{ display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr)', gap: 20 }}
        >
            {/* Album sidebar */}
            <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#1E1B4B', marginBottom: 10 }}>📁 Albums</div>
                {!readOnly && !forParent && (
                    <button
                        onClick={() => setShowAlbumForm(true)}
                        style={{
                            width: '100%',
                            marginBottom: 10,
                            padding: '8px 12px',
                            borderRadius: 10,
                            border: '1.5px dashed #DDD6FE',
                            background: '#F5F3FF',
                            color: '#6D28D9',
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: 'pointer',
                        }}
                    >
                        + Tạo album
                    </button>
                )}

                <div
                    onClick={() => selectAlbum(null)}
                    style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: 13,
                        background: !activeAlbum ? '#EDE9FE' : '#fff',
                        color: !activeAlbum ? '#6D28D9' : '#5B5490',
                        marginBottom: 4,
                    }}
                >
                    🖼️ Tất cả ảnh
                </div>

                {albums.map(a => {
                    const badge = STATUS_BADGE[a.status] || STATUS_BADGE.draft
                    return (
                        <div
                            key={a.id}
                            onClick={() => selectAlbum(a)}
                            style={{
                                padding: '10px 12px',
                                borderRadius: 10,
                                cursor: 'pointer',
                                background: activeAlbum?.id === a.id ? '#EDE9FE' : '#fff',
                                color: activeAlbum?.id === a.id ? '#6D28D9' : '#5B5490',
                                marginBottom: 4,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>{a.title}</div>
                                <span
                                    style={{
                                        fontSize: 10,
                                        fontWeight: 700,
                                        background: badge.bg,
                                        color: badge.color,
                                        borderRadius: 20,
                                        padding: '1px 6px',
                                    }}
                                >
                                    {badge.label}
                                </span>
                            </div>
                            {!readOnly && !forParent && a.status === 'draft' && (
                                <button
                                    onClick={e => {
                                        e.stopPropagation()
                                        publishAlbum(a)
                                    }}
                                    style={{
                                        fontSize: 10,
                                        background: '#ECFDF5',
                                        color: '#059669',
                                        border: 'none',
                                        borderRadius: 6,
                                        padding: '3px 7px',
                                        cursor: 'pointer',
                                        fontWeight: 700,
                                    }}
                                >
                                    Đăng
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Asset grid */}
            <div>
                <div
                    className="mobile-stack"
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 16,
                        gap: 10,
                    }}
                >
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1E1B4B' }}>
                        {activeAlbum ? `📁 ${activeAlbum.title}` : '🖼️ Tất cả ảnh'} ({displayAssets.length})
                    </div>
                    {!readOnly && !forParent && (
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/*"
                                multiple
                                style={{ display: 'none' }}
                                onChange={handleFileUpload}
                            />
                            <button
                                onClick={() => fileRef.current?.click()}
                                disabled={uploading}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: 10,
                                    border: 'none',
                                    background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)',
                                    color: '#fff',
                                    fontWeight: 700,
                                    fontSize: 13,
                                    cursor: uploading ? 'wait' : 'pointer',
                                }}
                            >
                                {uploading ? '⏳ Đang upload...' : '📤 Upload ảnh'}
                            </button>
                        </div>
                    )}
                </div>

                {err && <div style={{ color: '#DC2626', fontSize: 13, marginBottom: 10 }}>{err}</div>}
                <PaginationBar
                    page={page}
                    pageSize={ASSETS_PER_PAGE}
                    total={displayAssets.length}
                    onPageChange={setPage}
                    itemLabel="ảnh"
                />

                {/* Album form */}
                {showAlbumForm && (
                    <form
                        onSubmit={createAlbum}
                        style={{ background: '#F5F3FF', borderRadius: 12, padding: 16, marginBottom: 16 }}
                    >
                        <input
                            value={albumForm.title}
                            onChange={e => setAlbumForm(f => ({ ...f, title: e.target.value }))}
                            placeholder="Tên album..."
                            required
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: 8,
                                border: '1.5px solid #DDD6FE',
                                fontSize: 13,
                                marginBottom: 8,
                                boxSizing: 'border-box',
                            }}
                        />
                        <input
                            value={albumForm.description}
                            onChange={e => setAlbumForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Mô tả (tùy chọn)..."
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: 8,
                                border: '1.5px solid #DDD6FE',
                                fontSize: 13,
                                marginBottom: 8,
                                boxSizing: 'border-box',
                            }}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                type="submit"
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: '#6D28D9',
                                    color: '#fff',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                }}
                            >
                                Tạo
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowAlbumForm(false)}
                                style={{
                                    padding: '8px 14px',
                                    borderRadius: 8,
                                    border: '1.5px solid #DDD6FE',
                                    background: '#fff',
                                    color: '#6D28D9',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                }}
                            >
                                Hủy
                            </button>
                        </div>
                    </form>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
                    {pagedAssets.map(asset => {
                        const badge = STATUS_BADGE[asset.status] || STATUS_BADGE.draft
                        const imgUrl = API + asset.path
                        return (
                            <div
                                key={asset.id}
                                style={{
                                    borderRadius: 12,
                                    overflow: 'hidden',
                                    position: 'relative',
                                    border: '2px solid #EDE9FE',
                                    background: '#F5F3FF',
                                }}
                            >
                                <div
                                    style={{
                                        aspectRatio: '1',
                                        background: '#EDE9FE',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        overflow: 'hidden',
                                    }}
                                >
                                    {asset.mime_type?.startsWith('image/') ? (
                                        <img
                                            src={imgUrl}
                                            alt={asset.caption || asset.original_name}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            loading="lazy"
                                        />
                                    ) : (
                                        <span style={{ fontSize: 32 }}>📄</span>
                                    )}
                                </div>
                                <div style={{ padding: '8px 10px' }}>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: '#1E1B4B',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {asset.caption || asset.original_name}
                                    </div>
                                    <span
                                        style={{
                                            fontSize: 10,
                                            fontWeight: 700,
                                            background: badge.bg,
                                            color: badge.color,
                                            borderRadius: 20,
                                            padding: '1px 6px',
                                        }}
                                    >
                                        {badge.label}
                                    </span>
                                </div>
                                {!readOnly && !forParent && (
                                    <div style={{ display: 'flex', gap: 4, padding: '0 10px 8px' }}>
                                        {asset.status === 'draft' && (
                                            <button
                                                onClick={() => publishAsset(asset)}
                                                style={{
                                                    flex: 1,
                                                    fontSize: 10,
                                                    background: '#ECFDF5',
                                                    color: '#059669',
                                                    border: 'none',
                                                    borderRadius: 6,
                                                    padding: '4px',
                                                    cursor: 'pointer',
                                                    fontWeight: 700,
                                                }}
                                            >
                                                Đăng
                                            </button>
                                        )}
                                        {asset.status === 'published' && (
                                            <button
                                                onClick={() => archiveAsset(asset)}
                                                style={{
                                                    flex: 1,
                                                    fontSize: 10,
                                                    background: '#F3F4F6',
                                                    color: '#6B7280',
                                                    border: 'none',
                                                    borderRadius: 6,
                                                    padding: '4px',
                                                    cursor: 'pointer',
                                                    fontWeight: 700,
                                                }}
                                            >
                                                Lưu trữ
                                            </button>
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
                <PaginationBar
                    page={page}
                    pageSize={ASSETS_PER_PAGE}
                    total={displayAssets.length}
                    onPageChange={setPage}
                    itemLabel="ảnh"
                />
            </div>
        </div>
    )
}

export default function MediaLibrary({ readOnly = false, forParent = false, selectedFacilityId = '' }) {
    if (isSupabaseSession())
        return (
            <SupabaseMediaLibrary readOnly={readOnly} forParent={forParent} selectedFacilityId={selectedFacilityId} />
        )
    return <LegacyMediaLibrary readOnly={readOnly} forParent={forParent} />
}

function SupabaseMediaLibrary({ readOnly = false, forParent = false, selectedFacilityId = '' }) {
    const [profile, setProfile] = useState(null)
    const [albums, setAlbums] = useState([])
    const [assets, setAssets] = useState([])
    const [activeAlbum, setActiveAlbum] = useState('')
    const [albumTitle, setAlbumTitle] = useState('')
    const [err, setErr] = useState('')
    const [uploading, setUploading] = useState(false)
    const [page, setPage] = useState(1)
    const fileRef = useRef()

    async function reload(albumId = activeAlbum) {
        setErr('')
        try {
            const p = profile || (await getCurrentProfile())
            if (!profile) setProfile(p)
            const facilityId =
                p?.role === 'admin'
                    ? selectedFacilityId || undefined
                    : p?.role === 'parent'
                      ? undefined
                      : p?.facility_id
            const [nextAlbums, nextAssets] = await Promise.all([
                listAlbums({ facilityId }),
                listAssets({ albumId: albumId || undefined, facilityId }),
            ])
            setAlbums(forParent ? nextAlbums.filter(a => a.status === 'published') : nextAlbums)
            setAssets(forParent ? nextAssets.filter(a => a.status === 'published') : nextAssets)
        } catch (ex) {
            setErr(ex.message)
        }
    }

    useEffect(() => {
        setActiveAlbum('')
        reload('')
    }, [selectedFacilityId])

    async function createAlbum() {
        if (!albumTitle.trim()) return
        await saveAlbum({
            title: albumTitle,
            status: 'draft',
            facilityId: profile?.role === 'admin' ? selectedFacilityId : profile?.facility_id,
        })
        setAlbumTitle('')
        reload('')
    }

    async function publishAlbum(album) {
        await saveAlbum({ ...album, status: 'published' })
        reload(activeAlbum)
    }

    async function uploadFiles(e) {
        const files = Array.from(e.target.files || [])
        if (!files.length) return
        setUploading(true)
        setErr('')
        try {
            for (const file of files) {
                if (!file.type.startsWith('image/')) throw new Error(`${file.name}: chỉ nhận file ảnh.`)
                if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name}: vượt quá 5MB.`)
                await uploadMediaAsset({
                    file,
                    albumId: activeAlbum || null,
                    facilityId: profile?.role === 'admin' ? selectedFacilityId : profile?.facility_id,
                })
            }
            await reload(activeAlbum)
        } catch (ex) {
            setErr(ex.message)
        } finally {
            setUploading(false)
            e.target.value = ''
        }
    }

    const canWrite = !readOnly && !forParent && profile?.role !== 'parent'
    const canDelete = canWrite && profile?.role === 'admin'
    const pagedAssets = useMemo(
        () => assets.slice((page - 1) * ASSETS_PER_PAGE, page * ASSETS_PER_PAGE),
        [assets, page],
    )

    useEffect(() => {
        setPage(1)
    }, [activeAlbum, assets.length])

    async function downloadAsset(asset) {
        if (!asset.url) return
        const response = await fetch(asset.url)
        if (!response.ok) throw new Error('Không tải được ảnh.')
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = asset.originalName || 'maika-media'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    async function removeAsset(asset) {
        if (!confirm(`Xóa ảnh "${asset.caption || asset.originalName}" khỏi hệ thống?`)) return
        setErr('')
        try {
            await deleteMediaAsset(asset.id)
            await reload(activeAlbum)
        } catch (ex) {
            setErr(ex.message)
        }
    }

    return (
        <div
            className="mobile-two-col"
            style={{ display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr)', gap: 20 }}
        >
            <aside>
                <div style={{ fontWeight: 900, color: '#1E1B4B', marginBottom: 10 }}>Album ảnh</div>
                <button
                    onClick={() => {
                        setActiveAlbum('')
                        reload('')
                    }}
                    style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 10,
                        border: 'none',
                        background: !activeAlbum ? '#EDE9FE' : '#fff',
                        color: '#6D28D9',
                        fontWeight: 800,
                        marginBottom: 6,
                    }}
                >
                    Tất cả ảnh
                </button>
                {albums.map(album => (
                    <div
                        key={album.id}
                        style={{
                            background: activeAlbum === album.id ? '#EDE9FE' : '#fff',
                            borderRadius: 10,
                            padding: 10,
                            marginBottom: 6,
                        }}
                    >
                        <button
                            onClick={() => {
                                setActiveAlbum(album.id)
                                reload(album.id)
                            }}
                            style={{
                                width: '100%',
                                border: 'none',
                                background: 'transparent',
                                textAlign: 'left',
                                color: '#1E1B4B',
                                fontWeight: 800,
                            }}
                        >
                            {album.title}
                        </button>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginTop: 4,
                            }}
                        >
                            <span style={{ fontSize: 10, color: '#7C6D9B', fontWeight: 800 }}>{album.status}</span>
                            {canWrite && album.status === 'draft' && (
                                <button
                                    onClick={() => publishAlbum(album)}
                                    style={{
                                        border: 'none',
                                        borderRadius: 6,
                                        background: '#ECFDF5',
                                        color: '#059669',
                                        fontSize: 10,
                                        fontWeight: 900,
                                    }}
                                >
                                    Đăng
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                {canWrite && (
                    <div style={{ marginTop: 12, background: '#fff', borderRadius: 12, padding: 10 }}>
                        <input
                            value={albumTitle}
                            onChange={e => setAlbumTitle(e.target.value)}
                            placeholder="Tên album"
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: 8,
                                borderRadius: 8,
                                border: '1.5px solid #DDD6FE',
                                marginBottom: 8,
                            }}
                        />
                        <button
                            onClick={createAlbum}
                            style={{
                                width: '100%',
                                border: 'none',
                                borderRadius: 8,
                                padding: 8,
                                background: '#6D28D9',
                                color: '#fff',
                                fontWeight: 900,
                            }}
                        >
                            Tạo album
                        </button>
                    </div>
                )}
            </aside>
            <section>
                <div
                    className="mobile-stack"
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 14,
                        gap: 10,
                    }}
                >
                    <div style={{ fontWeight: 900, color: '#1E1B4B' }}>{assets.length} ảnh</div>
                    {canWrite && (
                        <>
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/*"
                                multiple
                                style={{ display: 'none' }}
                                onChange={uploadFiles}
                            />
                            <button
                                onClick={() => fileRef.current?.click()}
                                disabled={uploading}
                                style={{
                                    border: 'none',
                                    borderRadius: 10,
                                    padding: '9px 14px',
                                    background: '#6D28D9',
                                    color: '#fff',
                                    fontWeight: 900,
                                }}
                            >
                                {uploading ? 'Đang upload...' : 'Upload ảnh'}
                            </button>
                        </>
                    )}
                </div>
                {err && (
                    <div
                        style={{
                            background: '#FEF2F2',
                            color: '#DC2626',
                            borderRadius: 10,
                            padding: 10,
                            marginBottom: 12,
                            fontWeight: 800,
                        }}
                    >
                        {err}
                    </div>
                )}
                <PaginationBar
                    page={page}
                    pageSize={ASSETS_PER_PAGE}
                    total={assets.length}
                    onPageChange={setPage}
                    itemLabel="ảnh"
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
                    {pagedAssets.map(asset => (
                        <div
                            key={asset.id}
                            style={{
                                background: '#fff',
                                borderRadius: 12,
                                overflow: 'hidden',
                                border: '1px solid #EDE9FE',
                            }}
                        >
                            <div style={{ aspectRatio: '1', background: '#EDE9FE' }}>
                                <img
                                    src={asset.url}
                                    alt={asset.caption || asset.originalName}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    loading="lazy"
                                />
                            </div>
                            <div style={{ padding: 10 }}>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: '#1E1B4B',
                                        fontWeight: 800,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {asset.caption || asset.originalName}
                                </div>
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginTop: 6,
                                    }}
                                >
                                    <span style={{ fontSize: 10, color: '#7C6D9B', fontWeight: 900 }}>
                                        {asset.status}
                                    </span>
                                    <button
                                        onClick={() => downloadAsset(asset).catch(ex => setErr(ex.message))}
                                        style={{
                                            border: 'none',
                                            borderRadius: 6,
                                            background: '#F5F3FF',
                                            color: '#6D28D9',
                                            fontSize: 10,
                                            fontWeight: 900,
                                        }}
                                    >
                                        Tải
                                    </button>
                                    {canWrite && asset.status !== 'published' && (
                                        <button
                                            onClick={() =>
                                                updateAssetStatus(asset.id, 'published').then(() => reload(activeAlbum))
                                            }
                                            style={{
                                                border: 'none',
                                                borderRadius: 6,
                                                background: '#ECFDF5',
                                                color: '#059669',
                                                fontSize: 10,
                                                fontWeight: 900,
                                            }}
                                        >
                                            Đăng
                                        </button>
                                    )}
                                    {canWrite && asset.status !== 'archived' && (
                                        <button
                                            onClick={() =>
                                                updateAssetStatus(asset.id, 'archived').then(() => reload(activeAlbum))
                                            }
                                            style={{
                                                border: 'none',
                                                borderRadius: 6,
                                                background: '#F3F4F6',
                                                color: '#6B7280',
                                                fontSize: 10,
                                                fontWeight: 900,
                                            }}
                                        >
                                            Lưu trữ
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button
                                            onClick={() => removeAsset(asset)}
                                            style={{
                                                border: 'none',
                                                borderRadius: 6,
                                                background: '#FEF2F2',
                                                color: '#DC2626',
                                                fontSize: 10,
                                                fontWeight: 900,
                                            }}
                                        >
                                            Xóa
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {assets.length === 0 && (
                        <div
                            style={{
                                gridColumn: '1/-1',
                                padding: 42,
                                textAlign: 'center',
                                color: '#7C6D9B',
                                fontWeight: 800,
                            }}
                        >
                            Chưa có ảnh.
                        </div>
                    )}
                </div>
                <PaginationBar
                    page={page}
                    pageSize={ASSETS_PER_PAGE}
                    total={assets.length}
                    onPageChange={setPage}
                    itemLabel="ảnh"
                />
            </section>
        </div>
    )
}
