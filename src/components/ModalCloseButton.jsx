export default function ModalCloseButton({ onClick, label = 'Đóng' }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={label}
            aria-label={label}
            style={{
                position: 'absolute',
                top: 12,
                right: 12,
                width: 34,
                height: 34,
                borderRadius: 10,
                border: '1.5px solid #DDD6FE',
                background: '#fff',
                color: '#4C1D95',
                fontSize: 18,
                fontWeight: 900,
                cursor: 'pointer',
                lineHeight: 1,
            }}
        >
            X
        </button>
    )
}
