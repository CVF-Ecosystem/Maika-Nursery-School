# Review: Module Bảng Thu Tháng (TuitionAttendance)

**Phạm vi:** `src/pages/admin/TuitionAttendance.jsx` + `src/features/payments/tuitionFromAttendance.js`  
**Đánh giá từ:** Góc độ end-user (admin/kế toán nhà trẻ)  
**Ngày:** 2026-05-05

---

## 1. Logic tính toán — Vấn đề nghiệp vụ

### 1.1 Công thức hiện tại

```
amountDue = max(0, monthlyTuition − (previousCredit + permittedAbsences × refundPerPermittedAbsence))
```

### 1.2 Các giả định cứng cần xem xét lại

| #   | Vấn đề                                                                                                                                               | Tác động                                                                                        | Mức độ            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------- |
| 1   | **Học phí cố định 1.3tr cho toàn trường** (tuitionFromAttendance.js:3-7)<br>Không phân biệt lớp Nhà trẻ / Mầm / Chồi / Lá; không phân biệt CS1 / CS2 | Sai khi nhập hệ thống. Các lớp khác tuổi thường có học phí khác nhau.                           | 🔴 Cao            |
| 2   | **Vắng K (không phép) không trừ học phí**<br>Vắng P chỉ hoàn 20k/ngày (tuitionFromAttendance.js:181)                                                 | Khác chuẩn nhiều trường. Phụ huynh thắc mắc "vắng cả tuần vẫn đóng full?"                       | 🔴 Cao            |
| 3   | **Ngày L (nghỉ lễ) không hoàn tiền**                                                                                                                 | Trường nghỉ lễ mà phụ huynh vẫn đóng full. Cần làm rõ trong hợp đồng / QT.                      | 🟡 Trung bình     |
| 4   | **x/2 (nửa ngày) không hoàn tiền** (tuitionFromAttendance.js:90-93)                                                                                  | Đón sớm/đến muộn vẫn thu full. Bé học 4h vẫn = 8h.                                              | 🟡 Trung bình     |
| 5   | **Không pro-rate học sinh nhập giữa tháng**                                                                                                          | Bé nhập ngày 20 vẫn thu 1.3tr cả tháng.                                                         | 🟡 Trung bình     |
| 6   | **`previousCredit` (tiền thừa tháng trước) lưu localStorage** (TuitionAttendance.jsx:42-43)                                                          | Đổi máy / clear cache → mất sạch. Đây là dữ liệu kế toán, **không thể để localStorage**.        | 🔴 Cao            |
| 7   | **`monthlyTuition` lưu localStorage theo từng tháng**                                                                                                | Mỗi tháng lại nhập lại. Admin khác login không thấy cùng số.                                    | 🔴 Cao            |
| 8   | **Không cá nhân hoá học phí theo bé**                                                                                                                | Anh chị em giảm giá, học bổng, miễn giảm → không có cách config.                                | 🟠 Trung bình-cao |
| 9   | **Detect "vắng có phép" qua keyword tiếng Việt** (tuitionFromAttendance.js:67-78)<br>Parse: `co phep`, `xin phep`, `phu huynh bao`                   | Giáo viên ghi "PH báo", "ốm xin", "đi đám" → fail âm thầm, đếm thành K. **Rủi ro dữ liệu cao.** | 🔴 Cao            |
| 10  | **`actualDays` ra số thập phân (18.5)** khi có x/2                                                                                                   | Công thức ổn, nhưng admin nhìn "18.5 ngày" dễ bối rối.                                          | 🟢 Thấp           |
| 11  | **Tạo invoice trùng chỉ check `student_id + due_date`** (TuitionAttendance.jsx:401-403)                                                              | Sửa học phí rồi "Tạo khoản thu" lần 2 → bị skip. Phải xoá tay ở Invoices.                       | 🟠 Trung bình     |

### 1.3 Hành động ưu tiên

**Phải sửa trước production:**

- Đẩy `monthlyTuition` + `refundPerPermittedAbsence` vào DB (cấp độ lớp hoặc trường).
- Đẩy `previousCredit` vào DB (bảng `student_tuition_credits` chẳng hạn).
- **Thay field note free-text bằng enum `absence_type`** ở bảng `attendance`:
    ```sql
    ALTER TABLE attendance ADD COLUMN absence_type VARCHAR(20);
    -- Values: 'permitted' | 'unpermitted' | 'holiday' | NULL
    ```
- Thêm confirm dialog trước "Tạo khoản thu" + cho phép "Cập nhật" thay vì silently skip.

---

## 2. UX — Hướng dẫn thiết kế lại

Theo feedback "ưu tiên tick/checkbox, bớt remark không cần thiết", đây là đề xuất cụ thể:

### 2.1 Toolbar header — Đổi sang preset + toggle

**Hiện tại:** 4 input number rời rạc + 1 checkbox lẻ loi  
**Đề xuất:**

```
┌─────────────────────────────────────────┬──────────────────────┐
│ Tháng [input month] | Lớp [dropdown]    │ ⚙️ Quy tắc tính phí  │
├─────────────────────────────────────────┼──────────────────────┤
│                                         │ ☐ Tính thứ bảy       │
│ ⚡ Cấu hình học phí                     │ ☐ Hoàn vắng có phép  │
│ Preset: [Nhà trẻ] [Mầm] [Chồi] [Lá]    │ ☐ Pro-rate học sinh  │
│         [Tuỳ chỉnh ▼]                   │    mới               │
│                                         │ ☐ Trừ ngày nghỉ lễ  │
│ Hoàn tiền: [Có] [10k] [20k] [Tuỳ chỉnh]│                      │
└─────────────────────────────────────────┴──────────────────────┘
                            [Xuất Excel] [Tạo khoản thu]
```

**Lợi ích:**

- Tick preset nhanh hơn gõ "1300000".
- Một panel "Quy tắc tính phí" thay vì 4-5 input lan man.
- Cấu hình tiền thừa: shift từ inline input tháng sau sang **toggle ở header** + lấy từ DB.

### 2.2 Cột "Ghi chú" trong bảng học phí — Bỏ + dùng badge

**Hiện tại:**

```
| ... | Phải thu | Ghi chú                           |
| ... | 1.15tr   | Còn 3 ngày chưa điểm danh         |
```

**Đề xuất:**

```
| ... | Phải thu |
| ... | 1.15tr ⚠️  |    (icon tooltip: "Còn 3 ngày chưa điểm danh")
```

Cảnh báo tổng ở banner đầu trang:

```
⚠️  5 học sinh chưa hoàn thành điểm danh tháng 5.
    Vui lòng cập nhật trước khi tạo khoản thu.
    [Sang trang Điểm danh]
```

### 2.3 "Tiền thừa tháng trước" — Từ inline input sang toggle + DB

**Hiện tại:**

```
| STT | MSHS | Tên      | Phải thu | Thừa tháng trước |
| 1   | NT_01| Bé A     | 1.15tr   | [___________] (input)
```

👎 Phải gõ tay từng dòng, chỉ lưu localStorage.

**Đề xuất:**

```
Panel "Quy tắc" có toggle:
  ☑️ Áp dụng tiền thừa tháng trước
     [Từ database ↻] [Sửa chi tiết]

Bảng hiển thị:
| ... | Phải thu | Thừa tháng trước* |
| ... | 1.15tr   | 0.05tr            |
      * Từ hệ thống, bấm "Sửa chi tiết" để override
```

### 2.4 Module điểm danh — Đổi note → enum radio 3 lựa chọn

**Hiện tại:** Giáo viên gõ note `"có phép"` → parser phía sau định nghĩa  
**Rủi ro:** Ghi "có xin phép", "phép", "có giấy" → fail silent, tính thành K.

**Đề xuất:** Khi điểm danh, trên mỗi ô vắng (K hiện tại), click → popup 3 radio:

```
⚪ Vắng có phép (P)
⚪ Vắng không phép (K)
⚪ Nghỉ lễ (L)

[Lưu] [Hủy]
```

Hoặc dùng bottom-sheet trên mobile:

```
Loại vắng của Bé A ngày 5/5?
┌─────────────────┐
│ ⚪ Có phép   🟢  │
│ ⚪ Không phép 🔴  │
│ ⚪ Nghỉ lễ   ⚪  │
└─────────────────┘
    [Lưu] [Hủy]
```

### 2.5 Block "Quy ước" — Thu gọn thành icon

**Hiện tại:** Hiển thị 2 dòng dài trên trang

```
Quy ước: x đi học, x/2 nửa ngày, P vắng có phép, K vắng không phép.
```

**Đề xuất:**

```
┌─────────────────────────────────┐
│ ⓘ Tháng 5/2026 có 22 ngày học  │
│   (Chủ nhật × 4, Thứ 7 ✓)       │
└─────────────────────────────────┘
    [ⓘ Quy ước]: x = đi học | x/2 = nửa ngày | P = có phép | K = không phép | L = lễ
```

Quy ước gom thành 1 dòng nhỏ / collapsible, hoặc vào **Help page** dùng lâu dài.

### 2.6 Message toast — Tự ẩn + rút gọn

**Hiện tại:** "Đã xuất file Excel theo mẫu bảng điểm danh và bảng học phí."  
**Đề xuất:** "✓ Đã xuất Excel" → auto hide 2 giây.

---

## 3. Tóm tắt mức độ ưu tiên

### 🔴 Phải sửa trước production (Tier 0)

- [ ] Đẩy `monthlyTuition` + quy tắc tính phí lên DB (scope per-class hoặc per-student).
- [ ] Đẩy `previousCredit` lên DB, bỏ localStorage.
- [ ] Thay absent note-parsing thành **enum `absence_type`** ở bảng `attendance`.
- [ ] Thêm confirm dialog + preview khoản thu trước khi tạo hàng loạt.
- [ ] Cảnh báo tổng số học sinh chưa điểm danh đủ tháng.

### 🟠 Nên sửa sớm (Tier 1 — UX cải thiện)

- [ ] Refactor toolbar: preset chips học phí + toggle "Quy tắc tính phí".
- [ ] Bỏ cột "Ghi chú" dài, dùng badge icon ⚠️.
- [ ] Format số tiền với separator nghìn (1.300.000đ).
- [ ] Thu gọn "Quy ước" thành icon ⓘ hoặc collapsible.
- [ ] Toggle "Áp dụng tiền thừa" ở header, bỏ inline input từng dòng.
- [ ] Message toast auto-hide.

### 🟡 Có thể trì hoãn (Tier 2 — Feature request)

- [ ] Search + phân trang bảng học phí (khi > 100 bé).
- [ ] Sticky cột tên ở bảng điểm danh tháng.
- [ ] Lấy tên trường từ Settings cho mẫu Excel.
- [ ] Nút "Đánh dấu đã thu" inline ở bảng học phí.
- [ ] Pro-rate bé nhập giữa tháng.
- [ ] Cá nhân hoá học phí (giảm giá anh chị em, học bổng).

---

## 3.5 Yêu cầu MỚI: Bổ sung "Phiếu thông báo thu" cho phụ huynh

### 3.5.1 Vấn đề hiện tại

Hệ thống hiện chỉ có **Biên lai thu tiền** (sau khi đã thu, 1 dòng tổng `description + amount`). Thiếu **Phiếu thông báo thu** gửi PH trước kỳ thu để biết phải đóng những khoản gì, mỗi khoản bao nhiêu.

|            | Biên lai thu tiền (đã có)      | Phiếu thông báo thu (cần thêm)         |
| ---------- | ------------------------------ | -------------------------------------- |
| Thời điểm  | Sau khi thu — xác nhận đã nhận | Trước khi thu — báo PH                 |
| Nội dung   | 1 dòng tổng                    | **Breakdown nhiều khoản (line-items)** |
| Trạng thái | Paid                           | Pending → Paid (chuyển khi PH đóng)    |
| Mục đích   | Lưu trữ + đối soát             | Gửi Zalo / email cho PH xem trước      |

### 3.5.2 Yêu cầu nghiệp vụ (do chủ Maika xác nhận)

> **Cơ chế cốt lõi:**
>
> 1. Có sẵn **danh sách preset các khoản thu** (cấu hình 1 lần ở Settings).
> 2. Mỗi khoản admin **set sẵn số tiền thủ công** rồi **save** vào preset.
> 3. Khi tạo phiếu thông báo cho học sinh/lớp: **chỉ những khoản được tick** mới hiện trong bảng.
> 4. Khoản không tick → không liệt kê (không hiện = 0, ẩn hẳn dòng).

### 3.5.3 Schema đề xuất

```sql
-- 1. Bảng preset khoản thu (config 1 lần)
CREATE TABLE fee_items (
  id UUID PRIMARY KEY,
  facility_id UUID REFERENCES facilities(id),
  name VARCHAR(200) NOT NULL,           -- VD "Nước uống", "Tiền ăn bán trú"
  unit VARCHAR(50),                      -- "Tháng", "Ngày", "Buổi"
  default_amount BIGINT NOT NULL,        -- Số tiền admin set sẵn
  category VARCHAR(50),                  -- 'fixed' | 'optional' | 'auto'
  is_active BOOLEAN DEFAULT true,
  display_order INT,
  created_at, updated_at
);

-- 2. Bảng phiếu thông báo (header)
CREATE TABLE fee_notices (
  id UUID PRIMARY KEY,
  student_id UUID,
  year_month VARCHAR(7),                 -- "2026-05"
  status VARCHAR(20),                    -- 'draft' | 'sent' | 'paid' | 'cancelled'
  sent_at TIMESTAMP,
  paid_at TIMESTAMP,
  total_amount BIGINT,
  notes TEXT
);

-- 3. Bảng line-items của mỗi phiếu
CREATE TABLE fee_notice_items (
  id UUID PRIMARY KEY,
  notice_id UUID REFERENCES fee_notices(id),
  fee_item_id UUID REFERENCES fee_items(id),
  name VARCHAR(200),                     -- snapshot tên (phòng khi preset đổi)
  quantity NUMERIC,                      -- VD 19 (ngày), 1 (tháng)
  unit VARCHAR(50),
  unit_price BIGINT,                     -- snapshot giá
  amount BIGINT,                         -- = quantity × unit_price
  is_paid BOOLEAN DEFAULT false,         -- tick từng dòng được paid (nếu PH đóng từng phần)
  display_order INT
);
```

### 3.5.4 UI Flow

#### A. Trang Settings → Danh mục khoản thu (mới)

```
┌────────────────────────────────────────────────────────────┐
│ Danh mục các khoản thu                  [+ Thêm khoản]    │
├────────────────────────────────────────────────────────────┤
│ ☑️ Học phí cơ bản          1.300.000 đ / Tháng    [Sửa] │
│ ☑️ Tổ chức bán trú           270.000 đ / Tháng    [Sửa] │
│ ☑️ Tiền ăn bán trú            35.000 đ / Ngày     [Sửa] │
│ ☑️ Nước uống                  18.000 đ / Tháng    [Sửa] │
│ ☑️ Sổ liên lạc điện tử        11.500 đ / Tháng    [Sửa] │
│ ☑️ Tiếng Anh tăng cường       69.000 đ / Tháng    [Sửa] │
│ ☑️ Năng khiếu                 92.000 đ / Tháng    [Sửa] │
│ ☑️ Kỹ năng sống               92.000 đ / Tháng    [Sửa] │
│ ☑️ STEM                      100.000 đ / Tháng    [Sửa] │
│ ☐ Tin học tự chọn             50.000 đ / Tháng    [Sửa] │
│ ☐ Phần mềm LMS                10.000 đ / Tháng    [Sửa] │
└────────────────────────────────────────────────────────────┘
```

- Tick = active (hiện trong bảng tạo phiếu).
- Mỗi khoản có nút [Sửa] → modal đổi tên / số tiền / đơn vị / save.
- Có thể sắp xếp thứ tự (drag-drop hoặc display_order).

#### B. Trang Bảng thu tháng → khu vực mới "Tạo phiếu thông báo"

```
┌─────────────────────────────────────────────────────────────┐
│ ┌─ Chọn các khoản áp dụng cho [Bé Nguyễn A — lớp Mầm] ──┐  │
│ │                                                         │  │
│ │ ☑ Học phí cơ bản           1.300.000 đ                │  │
│ │ ☑ Tổ chức bán trú            270.000 đ                │  │
│ │ ☑ Tiền ăn (× 19 ngày)        665.000 đ  [auto]        │  │
│ │ ☑ Nước uống                   18.000 đ                │  │
│ │ ☑ Sổ liên lạc                 11.500 đ                │  │
│ │ ☐ Tiếng Anh tăng cường        69.000 đ                │  │
│ │ ☑ Năng khiếu                  92.000 đ                │  │
│ │ ☐ Kỹ năng sống                92.000 đ                │  │
│ │ ☐ STEM                       100.000 đ                │  │
│ │                                                         │  │
│ │ ─── Khấu trừ tự động ───                              │  │
│ │ • Hoàn vắng phép (-2 ngày)   -40.000 đ  [auto]        │  │
│ │ • Tiền thừa tháng trước      -50.000 đ  [auto từ DB]  │  │
│ │                                                         │  │
│ │ ─────────────────────────────────────                 │  │
│ │ TỔNG PHẢI THU              2.266.500 đ                │  │
│ │                                                         │  │
│ │  [Lưu nháp] [Áp dụng cho cả lớp] [Tạo phiếu + gửi]   │  │
│ └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Quy tắc UI (theo preference của user):**

- Khoản KHÔNG tick → ẩn hẳn khỏi bảng (không hiện 0đ).
- Số tiền lấy từ preset (đã save). Cho phép override inline cho từng phiếu.
- Auto-fill: "Tiền ăn × ngày học", "Hoàn vắng phép", "Tiền thừa" — không cho admin sửa, lấy từ logic điểm danh/credit DB.
- Có nút **"Áp dụng cho cả lớp"** = bulk tạo phiếu cho tất cả bé trong lớp với cùng cấu hình tick.

#### C. Phiếu in / PDF (gửi PH)

Layout giống ảnh tham khảo nhưng tone Maika 🌸 tím:

```
              🌸
        PHIẾU THÔNG BÁO THU
      Nhà Trẻ Tư Thục Maika
       Tháng 05/2026

─────────────────────────────────
Học sinh:    Nguyễn Thái Bảo Quỳnh
Lớp:         Mầm 1
Mã HS:       NT_01
─────────────────────────────────

Các khoản thu:
☐ 1. Học phí cơ bản                1.300.000 đ
☐ 2. Tổ chức bán trú                 270.000 đ
☐ 3. Tiền ăn (19 ngày)               665.000 đ
☐ 4. Nước uống                        18.000 đ
☐ 5. Sổ liên lạc điện tử              11.500 đ
☐ 6. Năng khiếu                       92.000 đ

Khấu trừ:
   Hoàn vắng phép (-2 ngày)          -40.000 đ
   Thừa tháng trước                  -50.000 đ
─────────────────────────────────
TỔNG SỐ TIỀN              2.266.500 đ
ĐÃ THANH TOÁN                       0 đ
CHƯA THANH TOÁN          2.266.500 đ
─────────────────────────────────

[QR chuyển khoản]    Hạn nộp: 10/05/2026

─────────────────────────────────
In ngày 5/5/2026 · Nhà Trẻ Maika
```

**Hai trạng thái phiếu:**
| Trạng thái | UI hiển thị |
|------------|-------------|
| `pending` (chưa đóng) | Số tiền đỏ, có QR + hạn nộp |
| `paid` (đã đóng) | Tick ✓ xanh từng dòng + dấu "ĐÃ THANH TOÁN" + ngày giờ |

### 3.5.5 Liên kết với Biên lai hiện có

**Đề xuất 2 cách:**

**Phương án A — Hợp nhất:** Phiếu thông báo và Biên lai = **1 document, 2 trạng thái**.

- `fee_notices.status = pending` → render template "Phiếu thông báo".
- `fee_notices.status = paid` → render template "Biên lai".
- Lợi: 1 nguồn dữ liệu, không trùng lặp.

**Phương án B — Tách rời:** Giữ `invoices` cũ (biên lai), thêm `fee_notices` (phiếu thông báo) song song.

- Khi PH đóng, copy data từ notice → invoice.
- Lợi: backward-compat với module Invoices hiện có.

**Khuyến nghị:** Phương án A — **migration `invoices` thành `fee_notices` + `fee_notice_items`**, refactor module Invoices hiện có. Sạch hơn lâu dài.

### 3.5.6 Câu hỏi cần Codex/chủ Maika làm rõ

1. **Danh mục khoản thu chính thức của Maika** là gì? (hiện trong review chỉ là gợi ý từ ảnh tham khảo)
2. **Phương án A hay B** ở trên?
3. **Tiền ăn theo ngày** lấy từ đâu? Số ngày `actualDays` của bảng điểm danh (full + half day) hay số ngày `fullDays` only?
4. Có cần **preset theo lớp** không (Nhà trẻ / Mầm / Chồi / Lá tick mặc định khác nhau)?
5. PH có cần **tự xem phiếu thông báo trên parent portal** không, hay chỉ admin gửi qua Zalo/email?
6. Có cần **xuất Excel/PDF nhiều phiếu cùng lúc** (bulk export cho cả lớp) không?

### 3.5.7 Bổ sung vào ưu tiên

**🔴 Tier 0 (phải sửa trước production):** không thay đổi.

**🟠 Tier 1 (sau Tier 0, ưu tiên cao):**

- [ ] Schema: `fee_items`, `fee_notices`, `fee_notice_items`.
- [ ] Trang Settings → Danh mục khoản thu (CRUD + tick active + sửa giá + save).
- [ ] Module Bảng thu tháng: thêm khu vực "Tạo phiếu thông báo" với checkbox per-item.
- [ ] Template phiếu in / PDF mới (kế thừa style biên lai).
- [ ] Workflow: tạo phiếu → gửi → đánh dấu đã thanh toán.

**🟡 Tier 2 (sau khi ổn):**

- [ ] Preset theo lớp.
- [ ] Bulk export PDF nhiều phiếu.
- [ ] Hiển thị phiếu trên parent portal.
- [ ] Tích hợp gửi Zalo / email tự động.

---

## 4. Đặc điểm tích cực

✅ Logic tính toán cơ bản rõ ràng, dễ hiểu.  
✅ Xuất Excel có format tiêu chuẩn, dễ in.  
✅ UI có responsive (mobile-stack, mobile-scroll-table).  
✅ Hai tab "Bảng học phí" / "Bảng điểm danh" phân tách logic tốt.  
✅ Color-coding (K đỏ, P cam, x xanh) intuitive.

---

## 5. Phản biện từ Codex

Yêu cầu Codex xem xét:

1. **Kỹ thuật:** Độ khả thi di chuyển dữ liệu từ localStorage lên DB; có breaking change không?
2. **Nghiệp vụ:** Có nên pro-rate / trừ ngày L không? (có thể liên quan hợp đồng Maika).
3. **Timeline:** Tier 0 cần hoàn trước cutover production (dự kiến bao giờ?).
4. **Giả định:** Mã sinh MSHS `NT_01`, `MC_01` sẽ trùng nếu nhiều lớp cùng prefix — cần scope theo CS không?

---

**Tài liệu:** [TuitionAttendance.jsx](src/pages/admin/TuitionAttendance.jsx) | [tuitionFromAttendance.js](src/features/payments/tuitionFromAttendance.js)  
**Contact:** nmtienctt@gmail.com

---

## 6. Phản biện & ý kiến từ Codex

### 6.1 Kết luận chung

Codex **đồng ý với hướng review**, đặc biệt ở các điểm liên quan đến dữ liệu kế toán, cấu hình học phí, và cách lưu loại vắng. Tuy nhiên, review hiện đang trộn 3 nhóm việc khác nhau:

1. **Lỗi / rủi ro cần sửa trước production**.
2. **Chính sách nghiệp vụ cần chủ Maika xác nhận**.
3. **Roadmap module mới** như Phiếu thông báo thu, preset khoản thu, PDF, Zalo.

Vì vậy không nên xem toàn bộ tài liệu này là danh sách bắt buộc phải làm ngay. Nên tách thành nhiều phase để tránh mở rộng scope quá lớn và làm rối module hiện tại.

### 6.2 Các điểm Codex đồng ý mạnh

#### A. Không nên lưu dữ liệu kế toán trong localStorage

Codex đồng ý với review rằng:

- `monthlyTuition`
- `refundPerPermittedAbsence`
- `previousCredit`

không nên lưu ở `localStorage` nếu đưa vào vận hành thật.

**Lý do:**

- `localStorage` phụ thuộc máy/browser của người dùng.
- Admin A nhập ở máy A thì admin B không thấy.
- Clear cache hoặc đổi thiết bị có thể mất dữ liệu.
- Đây là dữ liệu kế toán, cần audit được và phải có nguồn dữ liệu chung.

**Ý kiến Codex:**  
Với MVP nội bộ, localStorage có thể chấp nhận trong thời gian rất ngắn để thử luồng. Với production, cần chuyển lên DB.

Ưu tiên nên có:

- Bảng cấu hình học phí theo `facility_id`, `class_name` hoặc cấp học.
- Bảng lưu tiền thừa/khấu trừ theo học sinh và tháng.
- Audit trail tối thiểu: ai cập nhật, cập nhật lúc nào.

#### B. Không nên parse vắng có phép từ note lâu dài

Codex đồng ý với nhận xét: dùng free-text note để suy ra `P/K` là rủi ro.

Hiện tại hệ thống đã có cải thiện tạm:

- Khi giáo viên chọn vắng có phép, note được đánh dấu `[P]`.
- Khi chọn vắng không phép, note được đánh dấu `[K]`.
- Logic tính học phí ưu tiên marker `[P]` / `[K]` trước keyword.

Tuy nhiên đây vẫn là giải pháp tạm.

**Lý do cần DB enum:**

- Note là dữ liệu mô tả, không nên là dữ liệu nghiệp vụ chính.
- Giáo viên có thể nhập nhiều kiểu: "PH báo", "ốm xin", "có giấy", "bận việc nhà".
- Parser keyword luôn có khả năng sai âm thầm.
- Report tài chính cần dữ liệu có cấu trúc.

**Ý kiến Codex:**  
Nên thêm field như:

```sql
ALTER TABLE attendance
ADD COLUMN absence_type VARCHAR(20);
-- allowed: 'permitted' | 'unpermitted' | 'holiday' | NULL
```

Sau đó UI điểm danh dùng radio/select để lưu trực tiếp `absence_type`, còn `note` chỉ dùng làm ghi chú thêm.

#### C. Cần preview + confirm trước khi tạo khoản thu hàng loạt

Codex đồng ý đây là việc nên làm trước production.

**Lý do:**

- `Tạo khoản thu` là hành động ghi dữ liệu tài chính hàng loạt.
- Nếu tháng chưa điểm danh đủ, tạo khoản thu có thể sai.
- Nếu học phí hoặc hoàn/vắng phép nhập nhầm, sẽ tạo sai nhiều invoice cùng lúc.
- Nếu đã có invoice cũ, cần nói rõ sẽ bỏ qua, cập nhật, hay tạo bản mới.

**Ý kiến Codex:**  
Nên có modal preview trước khi tạo:

- Số học sinh sẽ tạo khoản thu.
- Số học sinh bị bỏ qua vì đã có khoản thu tháng đó.
- Tổng tiền phải thu.
- Cảnh báo còn bao nhiêu bé/ngày chưa điểm danh.
- Nút xác nhận rõ: `Xác nhận tạo khoản thu`.

#### D. Cần cảnh báo dữ liệu điểm danh chưa đủ

Codex đồng ý.

Hiện bảng có ghi chú theo từng dòng như `Còn 26 ngày chưa điểm danh`, nhưng user-facing chưa đủ rõ.

**Ý kiến Codex:**  
Nên thêm cảnh báo tổng ở đầu bảng:

```text
Tháng này còn 47 học sinh chưa đủ điểm danh. Nên hoàn tất điểm danh trước khi tạo khoản thu.
```

Nếu còn thiếu nhiều dữ liệu, có thể disable hoặc yêu cầu confirm mạnh hơn khi bấm tạo khoản thu.

### 6.3 Các điểm Codex đồng ý có điều kiện

#### A. Học phí cố định 1.300.000đ

Review nói đây là rủi ro cao. Codex đồng ý nếu xét production.

Tuy nhiên, đây không nhất thiết là bug của bản MVP nếu người dùng đang cần công cụ tính nhanh theo một mức học phí mặc định.

**Lý do cần hỏi thêm:**

- Maika có cùng học phí cho tất cả lớp không?
- CS1 và CS2 có học phí khác nhau không?
- Nhà trẻ / Mầm / Chồi / Lá có bảng giá riêng không?
- Có bé nào học nửa buổi, học thử, miễn giảm, học bổng không?

**Ý kiến Codex:**  
Không nên tự ý hard-code nhiều mức học phí nếu chưa có bảng giá chính thức. Cách đúng là chuyển thành cấu hình:

- Theo cơ sở.
- Theo lớp/cấp học.
- Cho phép override theo học sinh.

#### B. Vắng K, nghỉ lễ, x/2 có trừ tiền hay không

Review nêu các điểm:

- Vắng K không trừ học phí.
- Nghỉ lễ không hoàn tiền.
- x/2 không hoàn tiền.

Codex **không xem đây là bug kỹ thuật**. Đây là chính sách thu phí.

**Lý do:**

- Có trường vẫn thu full học phí khi vắng không phép.
- Có trường chỉ hoàn tiền ăn, không hoàn học phí.
- Có trường không hoàn ngày lễ vì đã tính trong học phí tháng.
- Có trường tính x/2 cho tiền ăn, nhưng không tính cho học phí.

**Ý kiến Codex:**  
Không nên Codex tự đổi công thức. Cần chủ Maika xác nhận quy định:

1. Vắng có phép hoàn khoản nào?
2. Vắng không phép hoàn khoản nào?
3. Nghỉ lễ có hoàn không?
4. Nửa ngày tính thế nào?
5. Hoàn học phí hay chỉ hoàn tiền ăn?

Sau khi có chính sách, hệ thống nên đưa vào `fee_rules`, không viết cứng trong component.

#### C. Skip invoice khi đã có khoản thu cùng học sinh + tháng

Review nói sửa học phí rồi bấm tạo lần 2 sẽ bị skip. Codex đồng ý đây là UX cần rõ hơn.

Hiện tại hệ thống đã sửa lỗi `duplicate invoice_number`, nhưng hành vi với invoice đã tồn tại vẫn là bỏ qua để tránh tạo trùng khoản thu.

**Lý do bỏ qua hiện tại:**

- An toàn hơn việc tự động ghi đè dữ liệu tài chính.
- Tránh tạo nhiều khoản học phí cùng tháng cho một bé.

**Điểm cần cải thiện:**

- Cho user biết rõ: đã tạo bao nhiêu, bỏ qua bao nhiêu.
- Cho lựa chọn:
    - Bỏ qua khoản đã có.
    - Cập nhật khoản chưa thanh toán.
    - Tạo khoản điều chỉnh.

Codex đề xuất phase tiếp theo thêm preview modal thay vì tự động update.

### 6.4 Các điểm Codex chưa đồng ý làm ngay

#### A. Module Phiếu thông báo thu là scope lớn riêng

Phần 3.5 trong review là ý tưởng đúng và có giá trị, nhưng không nên gộp vào việc sửa module `Bảng thu tháng` hiện tại.

**Lý do:**

- Cần schema mới: `fee_items`, `fee_notices`, `fee_notice_items`.
- Cần UI Settings quản lý danh mục khoản thu.
- Cần template in/PDF.
- Cần workflow gửi phụ huynh.
- Cần quyết định tích hợp hay thay thế module `Invoices`.

Đây là một module tài chính mới, không phải bugfix.

**Ý kiến Codex:**  
Nên tách thành epic riêng: **Phiếu thông báo thu**.

Module này có thể làm sau khi chốt:

1. Danh mục khoản thu chính thức.
2. Cách tính tiền ăn.
3. Cách xử lý tiền thừa.
4. Có gửi qua Parent Portal/Zalo không.
5. Có cần PDF hàng loạt không.

#### B. Migration `invoices` sang `fee_notices`

Review khuyến nghị phương án A: hợp nhất invoice và fee notice thành một document.

Codex thấy hướng này sạch về dài hạn, nhưng là thay đổi kiến trúc lớn.

**Rủi ro:**

- Module `Invoices` hiện có đang dùng bảng `invoices`.
- Parent portal / Zalo / receipt print có thể đang phụ thuộc cấu trúc invoice hiện tại.
- Migration sai có thể ảnh hưởng dữ liệu thu tiền thật.

**Ý kiến Codex:**  
Không nên migration ngay. Nên làm theo phương án B trong giai đoạn đầu:

- Thêm `fee_notices` song song.
- Khi phụ huynh đóng tiền, tạo hoặc liên kết sang invoice hiện có.
- Sau khi chạy ổn mới tính chuyện hợp nhất.

### 6.5 Tier ưu tiên Codex đề xuất

#### Tier 0 — Nên sửa trước production

- [x] Lưu cấu hình học phí và quy tắc tính phí vào DB.
- [x] Lưu tiền thừa/credit vào DB, không dùng localStorage.
- [x] Thêm `attendance.absence_type`.
- [~] Preview + confirm trước khi tạo khoản thu hàng loạt.
- [x] Cảnh báo tổng khi tháng chưa điểm danh đủ.
- [ ] Format số tiền dễ đọc trong input và bảng.

#### Tier 1 — Nên làm sớm sau Tier 0

- [x] Cấu hình học phí theo lớp/cấp học/cơ sở.
- [ ] Cho phép override học phí theo học sinh.
- [x] Cơ chế update hoặc tạo điều chỉnh nếu khoản thu tháng đã tồn tại.
- [ ] Sticky cột tên học sinh trong bảng điểm danh tháng.
- [x] Thu gọn giải thích/quy ước bằng tooltip hoặc help text ngắn.

#### Tier 2 — Module mới / roadmap

- [x] Danh mục khoản thu preset.
- [x] Phiếu thông báo thu có line-items.
- [ ] PDF/in hàng loạt.
- [ ] Hiển thị phiếu cho phụ huynh.
- [ ] Gửi Zalo/email.
- [ ] Migration/hợp nhất với invoice hiện có nếu thật sự cần.

### 6.6 Câu hỏi cần chủ Maika xác nhận

Trước khi sửa sâu, cần trả lời các câu hỏi sau:

1. Học phí chính thức theo từng lớp/cấp học/cơ sở là gì?
2. Vắng có phép hoàn học phí, tiền ăn, hay khoản nào khác?
3. Vắng không phép có hoàn khoản nào không?
4. Nghỉ lễ có hoàn không?
5. x/2 tính là nửa ngày cho học phí, tiền ăn, hay chỉ để báo cáo chuyên cần?
6. Bé nhập học giữa tháng tính pro-rate theo ngày học, ngày lịch, hay nhập tay?
7. Tiền thừa tháng trước lấy từ đâu và ai được chỉnh?
8. Khi đã có khoản thu tháng đó, bấm tạo lại thì muốn cập nhật, bỏ qua, hay tạo điều chỉnh?
9. Có cần phiếu thông báo thu gửi phụ huynh ngay trong phase này không?

### 6.7 Kết luận cuối

Codex xem module hiện tại là **MVP nội bộ để kiểm tra luồng điểm danh → tính học phí → tạo khoản thu**.

Module này chưa nên được coi là bản kế toán production hoàn chỉnh cho tới khi:

- Dữ liệu cấu hình được đưa vào DB.
- Loại vắng được lưu bằng enum.
- Tiền thừa/khấu trừ được quản lý có kiểm soát.
- Có bước preview/confirm trước khi tạo khoản thu.

Các đề xuất về Phiếu thông báo thu là hợp lý, nhưng nên tách thành module/phase riêng để không làm phình scope và gây rủi ro cho phần invoice hiện tại.

### 6.8 Quyết định đã được chủ Maika xác nhận

Các điểm dưới đây đã được xác nhận và sẽ là cơ sở triển khai tiếp theo:

1. **Học phí khác nhau theo cơ sở và lớp.**
    - Cơ sở ở khu vực khác nhau có mức học phí khác nhau.
    - Lớp theo độ tuổi cũng có mức học phí khác nhau.
    - Học phí cần được admin setup thủ công một lần trong Settings.
    - Các màn khác sẽ kế thừa cấu hình này.
    - Khi admin sửa cấu hình, bản mới ghi đè/áp dụng từ thời điểm chỉnh, không cần ngày hết hiệu lực ở phase đầu.

2. **Quy tắc vắng và hoàn tiền.**
    - `P` = vắng có phép, được hoàn tiền ăn theo mức admin cấu hình.
    - Mức hoàn có thể là 20.000đ, 30.000đ hoặc số khác tùy chính sách.
    - `K` = vắng không phép, không hoàn.
    - `L` = nghỉ lễ, không hoàn.
    - `x/2` = nửa ngày, không hoàn; chỉ dùng thống kê.
    - Với tiền ăn, `x/2` vẫn tính đủ 1 suất.

3. **Mức hoàn tiền ăn là cấu hình.**
    - Không hard-code 20.000đ.
    - Admin cấu hình trong Settings.

4. **Tiền thừa tháng trước.**
    - Cần lưu chính thức trong hệ thống để đưa vào phiếu thu và cấn trừ.
    - Chỉ admin/kế toán được chỉnh.

5. **Khi tạo khoản thu đã tồn tại.**
    - Nếu khoản chưa thanh toán: cập nhật khoản hiện có.
    - Nếu khoản đã thanh toán: tạo bản điều chỉnh mới.

6. **Nếu tháng chưa điểm danh đủ.**
    - Hệ thống cảnh báo và yêu cầu kiểm tra lại các ngày chưa điểm danh.
    - Vẫn cho admin xác nhận tạo khoản thu.
    - Nếu sau này phát hiện sai thì tạo bản điều chỉnh mới.

7. **Học sinh nhập học giữa tháng.**
    - Tháng đầu tiên tính theo số ngày học thực tế.
    - Admin vẫn có quyền nhập số tiền riêng theo thỏa thuận.

8. **Phiếu thông báo thu.**
    - Cần làm luôn.
    - Là module riêng nhưng liên kết với invoice/biên lai hiện có.
    - Không thay thế toàn bộ invoice ngay để tránh rủi ro và trùng chức năng.
    - Khi phiếu được thanh toán thì tạo/cập nhật invoice tương ứng.

9. **Danh mục khoản thu mặc định.**
    - Codex tạo bộ mặc định trước.
    - Admin có thể chỉnh sửa trong Settings.

10. **Nguyên tắc audit.**
    - Cần rà kỹ để không tạo chức năng trùng lắp với invoice hiện có.
    - Phiếu thông báo thu dùng cho giai đoạn trước thanh toán và breakdown nhiều khoản.
    - Invoice/biên lai dùng cho xác nhận sau thanh toán.

### 6.9 Trạng thái triển khai sau đợt sửa Codex

Ngày cập nhật: 2026-05-05  
Commit chính: `66bfe89`, `54dc8dc`, `9f98443`

#### Đã xong

1. **Schema Supabase**
    - Đã thêm `attendance.absence_type`.
    - Đã mở rộng `tuition_plans` với `facility_id`, `class_name`, `refund_per_permitted_absence`, `meal_price_per_day`.
    - Đã thêm bảng `student_tuition_credits`.
    - Đã thêm `fee_items`, `fee_notices`, `fee_notice_items`, `fee_notice_adjustments`.
    - Đã seed 10 khoản thu mặc định.
    - Migration `022_tuition_billing_rules_notices.sql` đã apply lên Supabase.

2. **Settings**
    - Admin cấu hình học phí theo cơ sở và lớp.
    - Admin cấu hình mức hoàn P/ngày.
    - Admin cấu hình tiền ăn/ngày.
    - Admin quản lý danh mục khoản thu mặc định.

3. **Điểm danh**
    - Modal chi tiết điểm danh đã có lựa chọn `K - Không phép` và `P - Có phép`.
    - Supabase lưu `absence_type` thật, không chỉ dựa vào text note.
    - Logic tính học phí ưu tiên `absence_type`, chỉ fallback note cũ khi dữ liệu cũ chưa có field.

4. **Bảng thu tháng**
    - Đọc học phí và mức hoàn từ Settings/DB.
    - Tiền thừa tháng trước lưu vào `student_tuition_credits`.
    - x/2 vẫn tính đủ một suất ăn trong thống kê.
    - Tạo/cập nhật phiếu báo thu thay vì chỉ tạo invoice thô.
    - Phiếu chưa thanh toán được cập nhật khi tính lại.
    - Phiếu/khoản đã thanh toán tạo bản điều chỉnh.
    - Có cảnh báo tổng nếu còn ngày chưa điểm danh, nhưng vẫn cho admin xác nhận tạo.
    - Đã dọn bớt ghi chú user-facing trên màn chính; quy tắc chuyển sang Hướng dẫn sử dụng.

5. **Kiểm tra**
    - Unit test liên quan pass.
    - Build pass.
    - Lint không có error, còn warning cũ của repo.

#### Làm một phần, cần Claude hoàn thiện tiếp

1. **Preview trước khi tạo phiếu**
    - Hiện đã có confirm khi thiếu điểm danh.
    - Chưa có màn preview đầy đủ trước khi tạo hàng loạt.
    - Nên làm: modal preview danh sách học sinh, số tiền, số P/K, tiền hoàn, tiền thừa, trạng thái tạo mới/cập nhật/điều chỉnh.

2. **Phiếu thông báo thu**
    - Backend/table/service đã có.
    - Chưa có màn quản lý riêng để xem chi tiết phiếu, line-items, trạng thái gửi/phụ huynh xem.
    - Nên làm: module hoặc tab `Phiếu báo thu` liên kết với `Bảng thu tháng` và `Học phí`.

3. **Khoản thu mặc định**
    - Đã có CRUD cơ bản trong Settings.
    - Chưa tích hợp UI để chọn thêm các khoản thu phụ vào từng phiếu/tháng/học sinh.
    - Nên làm: cho admin chọn khoản thu optional khi lập phiếu báo thu.

4. **Hướng dẫn sử dụng**
    - Đã chuyển quy tắc tính phí cơ bản vào tab Hướng dẫn.
    - Cần Claude viết lại gọn hơn, không emoji quá nhiều, tách rõ Admin/Kế toán/Giáo viên.

#### Chưa làm

1. **Override học phí theo từng học sinh**
    - Chưa có bảng/UI cho miễn giảm, học bổng, anh chị em, thỏa thuận riêng.
    - Gợi ý: bảng `student_tuition_overrides` hoặc tích hợp vào hồ sơ học sinh.

2. **Học sinh nhập học giữa tháng**
    - Chưa có pro-rate tự động theo ngày nhập học.
    - Chưa có field nhập số tiền thỏa thuận riêng cho tháng đầu.
    - Cần xác định nguồn ngày nhập học: thêm field vào `students` hoặc dùng lịch sử trạng thái.

3. **Format input tiền**
    - Bảng hiển thị tiền đã dùng `fmtMoney`.
    - Input số tiền vẫn là number input thô ở một số chỗ.
    - Cần component nhập tiền đồng bộ toàn app.

4. **Sticky cột trong bảng điểm danh tháng**
    - Chưa làm.
    - Nên sticky `STT`, `MSHS`, `Họ và tên` để dễ đối chiếu khi kéo ngang.

5. **PDF/in hàng loạt**
    - Chưa làm xuất/in phiếu báo thu theo mẫu gửi phụ huynh.

6. **Hiển thị phiếu cho phụ huynh**
    - Chưa có màn parent-facing cho `fee_notices`.
    - Parent hiện chủ yếu vẫn dựa vào invoice/học phí cũ.

7. **Gửi Zalo/email**
    - Chưa nối fee notice với Zalo/email.

8. **Audit trùng lắp với invoice**
    - Đã tách vai trò sơ bộ: fee notice trước thanh toán, invoice sau/xác nhận thu.
    - Chưa audit toàn bộ parent portal, Zalo ZNS, receipt print để đảm bảo không hiển thị trùng.

#### Gợi ý giao việc cho Claude

Ưu tiên đề xuất:

1. Làm modal preview trước khi tạo phiếu báo thu hàng loạt.
2. Làm màn quản lý `Phiếu báo thu` đọc `fee_notices` + `fee_notice_items`.
3. Tích hợp chọn khoản thu phụ/default fee items vào phiếu.
4. Làm override học phí theo học sinh và pro-rate tháng đầu.
5. Làm PDF/in phiếu báo thu.
6. Audit parent portal/Zalo/invoice để tránh hiển thị trùng hoặc gửi trùng thông báo.

### 6.10 Trạng thái triển khai bổ sung

Ngày cập nhật: 2026-05-05

#### Đã làm tiếp

1. **Chọn khoản thu phụ vào phiếu báo thu**
    - Bảng thu tháng đã đọc `fee_items` đang active.
    - Kế toán có thể áp dụng nhanh khoản phụ cho toàn bộ danh sách đang lọc.
    - Có modal chọn khoản phụ riêng cho từng học sinh.
    - Khoản không tick không được ghi vào `fee_notice_items`.

2. **Hướng dẫn sử dụng**
    - Tab Hướng dẫn đã viết lại theo vai trò: Admin, Kế toán, Giáo viên, Phụ huynh.
    - Quy tắc bảng thu tháng được tách riêng và viết ngắn gọn hơn.

3. **Format input tiền**
    - Thêm component `MoneyInput`.
    - Áp dụng cho input học phí, mức hoàn P/ngày, tiền ăn/ngày, khoản thu mặc định, tiền thừa và học phí riêng.

4. **Sticky cột bảng điểm danh/bảng thu**
    - Bảng thu tháng sticky `STT`, `MSHS`, `Họ và tên`.
    - Bảng điểm danh tháng sticky `STT`, `MSHS`, `Họ và tên`.

5. **Override học phí theo học sinh**
    - Thêm migration `023_tuition_student_overrides_proration.sql`.
    - Thêm bảng `student_tuition_overrides`.
    - Bảng thu tháng có ô nhập học phí riêng cho từng học sinh.

6. **Pro-rate học sinh nhập giữa tháng**
    - Thêm `students.enrollment_date`.
    - Hồ sơ học sinh Supabase có trường Ngày nhập học.
    - Nếu học sinh nhập trong tháng đang tính phí, học phí tháng đầu được pro-rate theo số ngày học còn lại trong tháng.

7. **PDF hàng loạt / phụ huynh xem phiếu / Zalo**
    - Màn Phiếu báo thu có nút in hàng loạt các phiếu đang lọc.
    - Cổng phụ huynh hiển thị phiếu báo thu và line-items trong tab Học phí.
    - Màn Phiếu báo thu có nút gửi Zalo cho phiếu chưa thanh toán nếu học sinh có số điện thoại phụ huynh.

#### Kiểm tra

- Đã apply migration `023_tuition_student_overrides_proration.sql` lên Supabase.
- `npm run test:run` pass.
- `npm run build` pass.
- `npm run lint` không có error; còn warning cũ của repo.
