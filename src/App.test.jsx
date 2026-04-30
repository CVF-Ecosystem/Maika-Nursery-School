import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

function renderRoute(route) {
    return render(
        <MemoryRouter initialEntries={[route]}>
            <App />
        </MemoryRouter>
    )
}

describe('app routes', () => {
    beforeEach(() => {
        localStorage.clear()
        sessionStorage.clear()
    })

    it('renders the landing page', () => {
        renderRoute('/')
        expect(screen.getByRole('heading', { name: /Nơi mỗi đứa trẻ/i })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Đăng ký tham quan/i })).toBeInTheDocument()
    })

    it('renders parent login', () => {
        renderRoute('/parent')
        expect(screen.getByText('Cổng Phụ Huynh')).toBeInTheDocument()
        expect(screen.getByLabelText('Số điện thoại')).toBeInTheDocument()
    })

    it('renders admin login', () => {
        renderRoute('/admin')
        expect(screen.getByText('Chào mừng trở lại')).toBeInTheDocument()
        expect(screen.getByLabelText('Mật khẩu')).toBeInTheDocument()
    })
})
