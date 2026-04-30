// src/utils/format.js — Utility helpers (migrated from bb-data.js)

export function fmtDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('vi-VN');
}

export function fmtMoney(n) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
}

export function fmtDateTime(d) {
    if (!d) return '';
    return new Date(d).toLocaleString('vi-VN');
}

export function getAge(dob) {
    const d = new Date(dob), now = new Date();
    return now.getFullYear() - d.getFullYear();
}

export function todayStr() {
    return new Date().toISOString().split('T')[0];
}
