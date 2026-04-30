import { expect, test } from '@playwright/test'

const studentName = `E2E Bé Test ${Date.now()}`
const updatedName = `${studentName} Updated`

test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
        localStorage.clear()
        sessionStorage.clear()
    })
})

test('admin can create, edit, and delete a student', async ({ page }) => {
    page.on('dialog', dialog => dialog.accept())

    await page.goto('/admin')
    await page.getByLabel('Mật khẩu').fill('123456')
    await page.getByRole('button', { name: /Đăng nhập/ }).click()

    await expect(page).toHaveURL(/\/admin\/app$/)
    await page.getByRole('button', { name: /Học sinh/ }).click()
    await expect(page.getByText('Quản lý học sinh').first()).toBeVisible()

    await page.getByRole('button', { name: /\+ Thêm học sinh/ }).click()
    await page.getByLabel('Họ và tên *').fill(studentName)
    await page.getByLabel('Ngày sinh *').fill('2021-02-03')
    await page.getByLabel('Tên phụ huynh *').fill('Phụ huynh E2E')
    await page.getByLabel('Số điện thoại').fill('0900000001')
    await page.getByLabel('Email').fill('e2e@example.com')
    await page.getByRole('button', { name: 'Lưu', exact: true }).click()

    await page.getByPlaceholder(/Tìm học sinh/).fill(studentName)
    await expect(page.getByText(studentName)).toBeVisible()

    await page.getByRole('button', { name: 'Sửa' }).click()
    await page.getByLabel('Họ và tên *').fill(updatedName)
    await page.getByRole('button', { name: 'Lưu', exact: true }).click()

    await page.getByPlaceholder(/Tìm học sinh/).fill(updatedName)
    await expect(page.getByText(updatedName)).toBeVisible()

    await page.getByRole('button', { name: 'Xóa' }).click()
    await expect(page.getByText(updatedName)).toHaveCount(0)
})
