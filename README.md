# Điều phối DVC & Tác nghiệp nội bộ (bản clone giao diện + chức năng)

Bản clone giao diện và chức năng tìm kiếm/lọc của dashboard điều phối thủ tục
hành chính. Là **trang tĩnh thuần HTML/CSS/JS** — không cần build, không cần
framework, deploy được ngay.

## Chạy thử ở máy bạn

Chỉ cần mở `index.html` bằng trình duyệt, hoặc chạy server tĩnh:

```bash
npx serve .
# hoặc
python3 -m http.server 8080
```

## Deploy lên Netlify

**Cách 1 — kéo thả:** vào https://app.netlify.com/drop, kéo cả thư mục này vào.

**Cách 2 — qua Git:**
```bash
git init
git add .
git commit -m "Init"
# tạo repo trên GitHub rồi:
git remote add origin <link-repo-cua-ban>
git push -u origin main
```
Sau đó vào Netlify → "Add new site" → "Import an existing project" → chọn repo.
File `netlify.toml` đã cấu hình sẵn `publish = "."` nên không cần chỉnh gì thêm.

## Deploy lên Vercel

```bash
npm i -g vercel
vercel
```
File `vercel.json` đã chỉ định đây là site tĩnh, không có build step.

## Cấu trúc project

```
.
├── index.html          # khung trang, các thành phần UI
├── css/styles.css       # toàn bộ style (theme sáng/tối, responsive)
├── js/data.js           # DỮ LIỆU MẪU — thay bằng dữ liệu thật ở đây
├── js/app.js            # toàn bộ logic: tìm kiếm, lọc, tab, đồng hồ, drawer
├── assets/logo.svg      # logo placeholder (tự thiết kế, không trùng ai)
├── netlify.toml
└── vercel.json
```

## Nối dữ liệu thật

### Tác nghiệp nội bộ
Vẫn đơn giản như cũ: sửa mảng `TAC_NGHIEP` trong `js/data.js`, mỗi item có
`ma`, `ten`, `phongBan`, `nguoiPhuTrach`, `han`, `uuTien`, `trangThai`, `capNhat`.

### Dịch vụ công — luồng 3 cấp + chuyển hướng cổng DVC

Đây là phần lõi mô phỏng đúng hành vi của trang gốc:

```
Dịch vụ công  →  Lĩnh vực (lọc/tìm)  →  Thủ tục  →  Cơ quan thực hiện (theo tỉnh)  →  chuyển hướng
```

Mỗi thủ tục trong mảng `DICH_VU_CONG` (file `js/data.js`) có cấu trúc:

```js
{
  id: "dvc-001",
  maTTHC: "2.000815",        // mã thủ tục hành chính quốc gia
  ten: "Chứng thực bản sao...",
  linhVuc: "Chứng thực",
  capThucHien: 2,            // 1 = tỉnh, 2 = huyện, 3 = xã (ước lượng — kiểm tra lại)
  mucPhi: "2.000đ/bản",
  thoiGian: "Trong ngày",
  portalBaseUrl: "https://dichvucongnganhtuphap.moj.gov.vn/danh-sach-thu-tuc",
  trangThai: "phuong-xa",
  capNhat: "7 phút trước",
  coQuanThucHienList: [
    { tinh: "Khánh Hòa", maCoQuan: "H32.219", maDVC: "2.000815.01" },
    // có thể thêm nhiều tỉnh/cơ quan khác cùng thực hiện thủ tục này
  ],
}
```

Khi người dùng bấm vào 1 thủ tục → drawer hiện danh sách `coQuanThucHienList`
→ bấm 1 tỉnh sẽ build URL và mở cổng DVC ở tab mới. URL được build bởi hàm
`buildPortalUrl()` trong `js/app.js`:

```js
function buildPortalUrl(procedure, agency) {
  const params = new URLSearchParams({
    vneid: "1",
    MaTTHCDP: procedure.maTTHC,
    MaTTHC: procedure.maTTHC,
    MaDVC: agency.maDVC,
    MaCoQuanThucHien: agency.maCoQuan,
    keyword: "",
    CapThucHien: String(procedure.capThucHien ?? ""),
  });
  return `${procedure.portalBaseUrl}?${params.toString()}`;
}
```

Khuôn tham số này (`vneid, MaTTHCDP, MaTTHC, MaDVC, MaCoQuanThucHien, keyword,
CapThucHien`) đã được kiểm chứng khớp 100% với ví dụ thật:

```
https://dichvucongnganhtuphap.moj.gov.vn/danh-sach-thu-tuc?vneid=1&MaTTHCDP=2.000815&MaTTHC=2.000815&MaDVC=2.000815.01&MaCoQuanThucHien=H32.219&keyword=&CapThucHien=2
```

**Lưu ý quan trọng:**
- Mục `dvc-001` (Chứng thực bản sao, Khánh Hòa) là **ví dụ thật** bạn cung cấp,
  dùng để kiểm chứng URL build đúng — giữ nguyên để tự kiểm tra mỗi khi sửa code.
- 7 mục còn lại trong `DICH_VU_CONG` là **dữ liệu mẫu/minh hoạ** — mã TTHC,
  mã cơ quan, và domain cổng của các ngành khác (đất đai, xây dựng, công an...)
  đều là **bịa để demo giao diện**, chưa được xác minh là đúng thật. Trước khi
  dùng thật, bạn cần thay bằng dữ liệu chính xác — đặc biệt là domain
  `portalBaseUrl` của từng ngành, vì các bộ/ngành khác có thể dùng tên tham số
  khác với mẫu trên (chỉ có ngành Tư pháp/Hộ tịch là đã kiểm chứng).
- Nếu một ngành khác dùng tên tham số khác (ví dụ không có `MaTTHCDP`, hoặc có
  thêm tham số khác), sửa trực tiếp trong `buildPortalUrl()` — có thể cần
  thêm field `paramsTemplate` riêng cho từng ngành nếu khuôn không đồng nhất.
- Hiện tại nút "Mở cổng dịch vụ công" mở **tab mới** (không điều hướng mất
  trang hiện tại) — khác một chút so với hành vi "chuyển hướng" của trang gốc,
  để người dùng không bị mất vị trí đang xem trong danh sách. Nếu muốn điều
  hướng thẳng (rời khỏi trang), đổi `target="_blank"` thành điều hướng bằng
  `window.location.href = url` trong `js/app.js`.

**Để nối API thật** thay vì sửa tay mảng tĩnh, sửa 2 hàm đầu file `js/app.js`:

```js
function getDichVuCong() { return DICH_VU_CONG; }
function getTacNghiep() { return TAC_NGHIEP; }
```

thành dạng gọi API + cache, rồi gọi lại `render()` khi có dữ liệu mới — xem
comment chi tiết ngay trên 2 hàm đó trong code.

## Tính năng đã có

- Đồng hồ thời gian thực + chỉ báo "đồng bộ X giây trước"
- Nút làm mới (mô phỏng đồng bộ lại dữ liệu)
- Chuyển đổi giao diện sáng / tối (lưu lựa chọn vào `localStorage`)
- 2 tab: Dịch vụ công / Tác nghiệp nội bộ, có đếm số lượng
- Tìm kiếm theo mã thủ tục, tên, lĩnh vực, tỉnh/cơ quan thực hiện
- Lọc theo lĩnh vực (hoặc phòng ban) và theo trạng thái
- Trạng thái rỗng khi không có kết quả, có nút xoá bộ lọc
- **Luồng 3 cấp cho Dịch vụ công**: bấm vào 1 thủ tục → drawer hiện danh sách
  tỉnh/cơ quan có thể thực hiện → bấm 1 nơi → tự build URL và mở cổng DVC
  của ngành đó ở tab mới (xem chi tiết & cách nối dữ liệu thật ở mục trên)
- Tác nghiệp nội bộ vẫn giữ drawer chi tiết đơn giản (không có bước chuyển hướng)
- Responsive cho di động
