import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
        localStorage.clear()
        sessionStorage.clear()
    })
})

test('parent can log in and view the daily report', async ({ page }) => {
    await page.goto('/parent')
    await page.getByLabel('Số điện thoại').fill('0901234567')
    await page.getByRole('button', { name: /Đăng nhập/ }).click()

    await expect(page).toHaveURL(/\/parent\/portal$/)
    await page.getByRole('button', { name: /Nhật ký/ }).click()

    await expect(page.getByRole('heading', { name: 'Nhật ký hàng ngày' })).toBeVisible()
    await expect(page.getByText('Nguyễn Minh An', { exact: true })).toBeVisible()
    await expect(page.getByText(/Bữa sáng/)).toBeVisible()
})
