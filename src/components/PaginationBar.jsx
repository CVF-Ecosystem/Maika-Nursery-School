export default function PaginationBar({ page, pageSize, total, onPageChange, itemLabel = 'mục', compact = false }) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    if (total <= pageSize) return null

    const safePage = Math.min(Math.max(page, 1), totalPages)
    const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1
    const end = Math.min(total, safePage * pageSize)

    function go(nextPage) {
        onPageChange(Math.min(Math.max(nextPage, 1), totalPages))
    }

    return (
        <nav
            aria-label="Phân trang"
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
                padding: compact ? '6px 0' : '10px 0',
            }}
        >
            <span style={{ fontSize: compact ? 11 : 12, color: '#6B6494', fontWeight: 800 }}>
                {start}-{end}/{total} {itemLabel}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                    type="button"
                    onClick={() => go(safePage - 1)}
                    disabled={safePage === 1}
                    aria-label="Trang trước"
                    style={buttonStyle(safePage === 1, compact)}
                >
                    ‹
                </button>
                <span
                    style={{
                        minWidth: compact ? 56 : 68,
                        textAlign: 'center',
                        color: '#1E1B4B',
                        fontWeight: 900,
                        fontSize: compact ? 11 : 12,
                    }}
                >
                    Trang {safePage}/{totalPages}
                </span>
                <button
                    type="button"
                    onClick={() => go(safePage + 1)}
                    disabled={safePage === totalPages}
                    aria-label="Trang sau"
                    style={buttonStyle(safePage === totalPages, compact)}
                >
                    ›
                </button>
            </div>
        </nav>
    )
}

function buttonStyle(disabled, compact) {
    return {
        width: compact ? 30 : 34,
        height: compact ? 30 : 34,
        borderRadius: 10,
        border: '1.5px solid #DDD6FE',
        background: disabled ? '#F3F4F6' : '#fff',
        color: disabled ? '#9CA3AF' : '#6D28D9',
        fontWeight: 900,
        fontSize: compact ? 18 : 20,
        cursor: disabled ? 'not-allowed' : 'pointer',
        lineHeight: 1,
    }
}
