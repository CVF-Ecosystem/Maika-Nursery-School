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

    it('renders unified login', () => {
        renderRoute('/login')
        expect(screen.getByText('Đăng nhập Maika')).toBeInTheDocument()
        expect(screen.getByLabelText('Mật khẩu')).toBeInTheDocument()
    })

    it('renders teacher login', () => {
        renderRoute('/teacher')
        expect(screen.getByText('Cổng Giáo Viên')).toBeInTheDocument()
        expect(screen.getByLabelText('Mật khẩu')).toBeInTheDocument()
    })

    it('renders teacher portal for teacher role', () => {
        sessionStorage.setItem('maika_role', 'teacher')
        sessionStorage.setItem('maika_data_backend', 'local')
        renderRoute('/teacher/app')
        expect(screen.getByText('Cổng giáo viên')).toBeInTheDocument()
        expect(screen.getByText('Công cụ hằng ngày cho giáo viên')).toBeInTheDocument()
    })
})
