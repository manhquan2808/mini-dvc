/**
 * DANH MỤC THỦ TỤC HÀNH CHÍNH — PHỤ LỤC QUYẾT ĐỊNH 2117/QĐ-BTP
 * ==================================================================
 * Nguồn: Phụ lục "Danh mục thủ tục hành chính thuộc phạm vi quản lý nhà nước
 *        của Bộ Tư pháp triển khai thực hiện trên Hệ thống thông tin giải quyết
 *        thủ tục hành chính tập trung của Bộ Tư pháp"
 *        (kèm theo Quyết định số 2117/QĐ-BTP ngày 23/9/2026 của Bộ trưởng Bộ Tư pháp).
 *
 * Phụ lục chia 255 TTHC thành 3 nhóm theo mức độ cung cấp dịch vụ công trực tuyến:
 *   I.   Toàn trình ................................ 197 TTHC
 *   II.  Một phần (kèm lý do) ....................... 30 TTHC
 *   III. Không cung cấp DVCTT hoặc không thực hiện
 *        trên Hệ thống tập trung của Bộ Tư pháp ..... 28 TTHC
 *
 * ------------------------------------------------------------------
 * CÁCH TỔ CHỨC DỮ LIỆU
 * ------------------------------------------------------------------
 * Dữ liệu gốc giữ ở dạng BẢNG — mỗi dòng là một dòng trong Phụ lục. Hàm
 * buildThuTuc() dựng ra object đầy đủ cho giao diện. Thêm/sửa/xoá một thủ tục
 * chỉ cần sửa đúng một dòng.
 *
 *   DANH_MUC_TOAN_TRINH       [ maTTHC, tên, lĩnh vực ]
 *   DANH_MUC_MOT_PHAN         [ maTTHC, tên, lĩnh vực, lý do cung cấp một phần ]
 *   DANH_MUC_KHONG_TRUC_TUYEN [ maTTHC, tên, lĩnh vực, ghi chú ]
 *
 * "Lý do cung cấp một phần" là object ứng với 4 cột con của Phụ lục:
 *   hienDien  Quy định tổ chức, cá nhân sử dụng dịch vụ phải hiện diện tại cơ quan nhà nước
 *   thamTra   Cơ quan nhà nước phải đi thẩm tra, xác minh tại hiện trường theo quy định pháp luật
 *   suCo      Sự cố kỹ thuật chưa thể khắc phục ngay
 *   khac      Các vấn đề kỹ thuật khác chưa thể xử lý được
 *
 * Object dựng ra gồm:
 *   id                mã nội bộ "dvc-001"…
 *   maTTHC            mã TTHC quốc gia
 *   ten               tên thủ tục
 *   linhVuc           lĩnh vực (dùng cho bộ lọc "Tất cả lĩnh vực")
 *   mucDoDVC          "toan-trinh" | "mot-phan" | "khong-truc-tuyen"
 *   lyDoMotPhan       mảng { nhan, noiDung } — chỉ có ở nhóm II
 *   ghiChu            ghi chú của Phụ lục — chỉ có ở nhóm III
 *   trangThai         = mucDoDVC, dùng cho bộ lọc của app.js
 *   capThucHien       THAM SỐ URL CapThucHien của cổng DVC (xem ghi chú dưới)
 *   portalBaseUrl     cổng DVC ngành Tư pháp
 *   coQuanThucHienList  danh sách nơi thực hiện để dựng link chuyển hướng
 *
 * ------------------------------------------------------------------
 * LƯU Ý — NHỮNG THỨ KHÔNG CÓ TRONG PHỤ LỤC NÀY
 * ------------------------------------------------------------------
 * 1) Phụ lục chỉ có 4 cột dữ liệu: Mã TTHC, Tên TTHC, Lĩnh vực, Mức độ DVCTT
 *    (+ lý do / ghi chú). KHÔNG có đối tượng thực hiện, cấp thực hiện, cơ quan
 *    thực hiện, thời gian triển khai thí điểm — các trường này có ở Quyết định
 *    658/QĐ-BTP nhưng không giữ lại ở đây để tránh trộn hai văn bản.
 *
 * 2) Phụ lục KHÔNG chứa mã cơ quan thực hiện theo tỉnh (vd "H29") và mã dịch vụ
 *    công (MaDVC). coQuanThucHienList sinh theo quy ước đang dùng của dự án:
 *       tinh = "Thành phố Hồ Chí Minh", maCoQuan = "H29", maDVC = maTTHC.
 *    => Có danh sách mã cơ quan thật thì chỉ cần sửa CO_QUAN_MAC_DINH.
 *
 * 3) `capThucHien` là THAM SỐ URL của cổng DVC (1=tỉnh, 2=huyện, 3=xã theo quan
 *    sát trước đây), giữ nguyên giá trị 2 như cấu hình đang chạy để không làm
 *    hỏng link chuyển hướng hiện tại.
 * ==================================================================
 */

const PORTAL_BASE_URL = "https://dichvucongnganhtuphap.moj.gov.vn/danh-sach-thu-tuc";

/** Tham số CapThucHien trên URL cổng DVC — xem ghi chú (3) ở trên. */
const CAP_THUC_HIEN_URL = 2;

/** Nơi thực hiện mặc định (Phụ lục không công bố mã cơ quan theo tỉnh). */
const CO_QUAN_MAC_DINH = [{ tinh: "Thành phố Hồ Chí Minh", maCoQuan: "H29" }];

// --------------------------------------------------------------------------
// TỪ ĐIỂN DÙNG CHUNG
// --------------------------------------------------------------------------

/** Lĩnh vực (đúng tên trong Phụ lục) */
const LV = {
  CHUNG_THUC: "Chứng thực",
  CONG_CHUNG: "Công chứng",
  DGTS: "Đấu giá tài sản",
  GDTP: "Giám định tư pháp",
  HGTM: "Hòa giải thương mại",
  LUAT_SU: "Luật sư",
  QTV: "Quản tài viên",
  TVPL: "Tư vấn pháp luật",
  TTTM: "Trọng tài thương mại",
  DKBPBD: "Đăng ký biện pháp bảo đảm",
  HO_TICH: "Hộ tịch",
  NUOI_CON_NUOI: "Nuôi con nuôi",
  QUOC_TICH: "Quốc tịch",
  HGCS: "Hòa giải ở cơ sở",
  TGPL: "Trợ giúp pháp lý",
  THV: "Thừa hành viên",
  THADS: "Thi hành án dân sự",
  HTPL_DN: "Hỗ trợ pháp lý cho doanh nghiệp nhỏ và vừa",
  TCTT: "Tiếp cận thông tin",
  BTNN: "Bồi thường nhà nước",
};

/** Mức độ cung cấp dịch vụ công trực tuyến */
const MUC_DO = {
  TT: "toan-trinh",
  MP: "mot-phan",
  KHONG: "khong-truc-tuyen",
};

/** Nhãn hiển thị cho mức độ dịch vụ công trực tuyến. */
const MUC_DO_LABEL = {
  "toan-trinh": "Trực tuyến toàn trình",
  "mot-phan": "Trực tuyến một phần",
  "khong-truc-tuyen": "Không cung cấp trực tuyến",
};

/** Nhãn 4 cột con của nhóm "Một phần" trong Phụ lục. */
const LY_DO_LABEL = {
  hienDien: "Tổ chức, cá nhân phải hiện diện tại cơ quan nhà nước",
  thamTra: "Cơ quan nhà nước phải thẩm tra, xác minh tại hiện trường",
  suCo: "Sự cố kỹ thuật chưa thể khắc phục ngay",
  khac: "Vấn đề kỹ thuật khác chưa thể xử lý được",
};

/** Căn cứ pháp lý lặp lại nhiều lần ở nhóm II. */
const CC = {
  ND23_D36: "Khoản 2, 3 Điều 36 Nghị định số 23/2015/NĐ-CP của Chính phủ, được sửa đổi, bổ sung bởi Nghị định số 280/2025/NĐ-CP",
  ND23_D20: "Điều 20 Nghị định số 23/2015/NĐ-CP của Chính phủ, được sửa đổi, bổ sung bởi Nghị định số 280/2025/NĐ-CP",
  ND23_D31: "Khoản 1, 2, 3 Điều 31 Nghị định số 23/2015/NĐ-CP của Chính phủ, được sửa đổi, bổ sung bởi Nghị định số 280/2025/NĐ-CP",
  ND23_D38: "Khoản 2 Điều 38 Nghị định số 23/2015/NĐ-CP của Chính phủ được sửa đổi, bổ sung bởi Nghị định số 280/2025/NĐ-CP",
  ND23_D24: "Khoản 2, 3 Điều 24 Nghị định số 23/2015/NĐ-CP của Chính phủ, được sửa đổi, bổ sung bởi Nghị định số 280/2025/NĐ-CP",
  YTNN: "TTHC liên quan đến yếu tố nước ngoài nên cần xác minh thông tin",
  DAU_GIA: "Khoản 2 Điều 6, Nghị định 172/2024/NĐ-CP của Chính phủ",
  BTNN_HIEN_DIEN: "Theo quy định tại Điều 46 Luật Trách nhiệm bồi thường của Nhà nước, việc thương lượng được tiến hành trực tiếp giữa người yêu cầu bồi thường và Cơ quan giải quyết bồi thường tại cơ quan giải quyết bồi thường hoặc trụ sở Ủy ban nhân dân cấp xã nơi người yêu cầu bồi thường cư trú",
  BTNN_THAM_TRA: "Theo quy định tại khoản 1 Điều 45 Luật Trách nhiệm bồi thường của Nhà nước; điểm c khoản 1 Điều 14 Nghị định số 68/2018/NĐ-CP của Chính phủ có quy định trong trường hợp cần thiết, người giải quyết bồi thường có thể yêu cầu người yêu cầu bồi thường cung cấp tài liệu hoặc trao đổi ý kiến trực tiếp trong quá trình xác minh thiệt hại.",
  BTNN_PHUC_HOI: "Theo quy định tại khoản 1 Điều 56 Luật Trách nhiệm bồi thường của Nhà nước, việc trực tiếp xin lỗi và cải chính công khai được thực hiện trực tiếp tại nơi cư trú của người bị thiệt hại hoặc nơi đặt trụ sở của pháp nhân bị thiệt hại",
  KET_HON_LAI: "Khoản 2, Điều 27 Nghị định 123/2015/NĐ-CP của Chính phủ; Khoản 2 Điều 5 Nghị định số 120/2025/NĐ-CP của Chính phủ",
  KET_HON: "Khoản 1 Điều 18 Luật Hộ tịch năm 2014; khoản 2 Điều 5 Nghị định số 120/2025/NĐ-CP của Chính phủ",
  KET_HON_NN: "Khoản 3 Điều 38 Luật Hộ tịch năm 2014; Khoản 2 Điều 5 Nghị định số 120/2025/NĐ-CP của Chính phủ.",
  TT04_D25: "Điều 25 Thông tư số 04/2020/TT-BTP của Bộ Tư pháp",
  TT04_D26: "Điều 26 Thông tư số 04/2020/TT-BTP của Bộ Tư pháp",
  NCN_HIEN_DIEN: "Điều 22 Luật Nuôi con nuôi 2010; Điều 10 Nghị định số 19/2011/NĐ-CP quy định chi tiết thi hành một số điều của Luật Nuôi con nuôi, được sửa đổi, bổ sung bởi Nghị định số 114/2016/NĐ-CP, Nghị định số 24/2019/NĐ-CP, Nghị định số 06/2025/NĐ-CP",
  NCN_THAM_TRA: "Điều 20, Điều 21 Luật Nuôi con nuôi 2010; Điều 8, 9 Nghị định số 19/2011/NĐ-CP quy định chi tiết thi hành một số điều của Luật Nuôi con nuôi, được sửa đổi, bổ sung bởi Nghị định số 114/2016/NĐ-CP, Nghị định số 24/2019/NĐ-CP, Nghị định số 06/2025/NĐ-CP",
  NCN_NN_HIEN_DIEN: "Điều 37 Luật Nuôi con nuôi 2010",
  NCN_NN_THAM_TRA: "Điều 21, Điều 33 Luật Nuôi con nuôi 2010; Điều 15 Nghị định số 19/2011/NĐ-CP quy định chi tiết thi hành một số điều của Luật Nuôi con nuôi, được sửa đổi, bổ sung bởi Nghị định số 114/2016/NĐ-CP, Nghị định số 24/2019/NĐ-CP, Nghị định số 06/2025/NĐ-CP",
  QUOC_TICH_NHAP: "- Khoản 1 Điều 21 Luật Quốc tịch Việt Nam và Khoản 1 Điều 5 Nghị định số 191/2025/NĐ-CP ngày 01/7/2025 quy định người có yêu cầu phải đến nộp hồ sơ trực tiếp tại cơ quan thụ lý. - Điều 16 Nghị định số 191/2025/NĐ-CP ngày 01/7/2025 quy định Sở Tư pháp phải tổ chức lễ trao Quyết định cho nhập quốc tịch Việt Nam theo nghi thức trang trọng, ý nghĩa",
};

/** Ghi chú lặp lại ở nhóm III. */
const GC = {
  CQDD_TRUC_TIEP: "Thực hiện trực tiếp tại Cơ quan đại diện do viên chức ngoại giao, viên chức lãnh sự của Cơ quan đại diện ngoại giao, Cơ quan đại diện lãnh sự và Cơ quan khác được ủy quyền thực hiện chức năng lãnh sự của Việt Nam ở nước ngoài (Điều 31 Nghị định số 23/2015/NĐ-CP được sửa đổi, bổ sung bởi Nghị định số 280/2025/NĐ-CP)",
  CHUA_DVCTT_GIAI_QUYET: "Chưa cung cấp DVCTT; tiếp nhận, giải quyết trực tiếp",
  CHUA_DVCTT_TIEP_NHAN: "Chưa cung cấp DVCTT; tiếp nhận trực tiếp",
  CQDD_KHONG_HE_THONG: "TTHC thực hiện tại Cơ quan đại diện Việt Nam ở nước ngoài, không triển khai trên Hệ thống",
  HT_NGOAI_GIAO: "Tiếp nhận, giải quyết trên hệ thống của Bộ Ngoại giao",
  HT_NN_MT: "Tiếp nhận, giải quyết trên hệ thống của Bộ Nông nghiệp và Môi trường",
  HT_XAY_DUNG: "Tiếp nhận, giải quyết trên hệ thống của Bộ Xây dựng",
};

// --------------------------------------------------------------------------
// I. TTHC CUNG CẤP DỊCH VỤ CÔNG TRỰC TUYẾN TOÀN TRÌNH (197 TTHC)
//    Cột: maTTHC | tên TTHC | lĩnh vực
// --------------------------------------------------------------------------

const DANH_MUC_TOAN_TRINH = [
  /*   1 */ ["2.000908", "Thủ tục cấp bản sao từ sổ gốc", LV.CHUNG_THUC],
  /*   2 */ ["2.000927", "Sửa lỗi sai sót trong giao dịch", LV.CHUNG_THUC],
  /*   3 */ ["3.000444", "Công nhận hoàn thành tập sự hành nghề công chứng", LV.CONG_CHUNG],
  /*   4 */ ["1.013859", "Cấp thẻ công chứng viên", LV.CONG_CHUNG],
  /*   5 */ ["1.013853", "Thay đổi nội dung đăng ký hoạt động của Văn phòng công chứng được bán", LV.CONG_CHUNG],
  /*   6 */ ["1.013856", "Công nhận Điều lệ của Văn phòng công chứng được thành lập trước ngày 01/7/2025", LV.CONG_CHUNG],
  /*   7 */ ["1.013849", "Chuyển đổi Văn phòng công chứng theo loại hình doanh nghiệp tư nhân thành Văn phòng công chứng theo loại hình công ty hợp danh", LV.CONG_CHUNG],
  /*   8 */ ["1.013843", "Thay đổi nội dung đăng ký hoạt động của Văn phòng công chứng nhận sáp nhập", LV.CONG_CHUNG],
  /*   9 */ ["1.013848", "Thay đổi nội dung đăng ký hoạt động của Văn phòng công chứng nhận chuyển nhượng vốn góp", LV.CONG_CHUNG],
  /*  10 */ ["1.013842", "Sáp nhập Văn phòng công chứng theo loại hình công ty hợp danh", LV.CONG_CHUNG],
  /*  11 */ ["1.013837", "Cấp lại Giấy đăng ký hoạt động cho Văn phòng công chứng do bị mất, hỏng", LV.CONG_CHUNG],
  /*  12 */ ["1.013846", "Chuyển nhượng toàn bộ phần vốn góp của toàn bộ thành viên hợp danh của Văn phòng công chứng", LV.CONG_CHUNG],
  /*  13 */ ["1.013836", "Thay đổi nội dung đăng ký hoạt động của Văn phòng công chứng", LV.CONG_CHUNG],
  /*  14 */ ["1.013839", "Hợp nhất Văn phòng công chứng theo loại hình công ty hợp danh", LV.CONG_CHUNG],
  /*  15 */ ["1.013852", "Bán Văn phòng công chứng theo loại hình doanh nghiệp tư nhân", LV.CONG_CHUNG],
  /*  16 */ ["1.013840", "Đăng ký hoạt động Văn phòng công chứng hợp nhất", LV.CONG_CHUNG],
  /*  17 */ ["1.013835", "Đăng ký hoạt động Văn phòng công chứng", LV.CONG_CHUNG],
  /*  18 */ ["1.013818", "Đăng ký tham dự kiểm tra kết quả tập sự hành nghề công chứng", LV.CONG_CHUNG],
  /*  19 */ ["1.013830", "Cấp lại Thẻ công chứng viên", LV.CONG_CHUNG],
  /*  20 */ ["1.013834", "Thành lập Văn phòng công chứng", LV.CONG_CHUNG],
  /*  21 */ ["1.013832", "Thu hồi Thẻ công chứng viên", LV.CONG_CHUNG],
  /*  22 */ ["1.013810", "Thay đổi nơi tập sự hành nghề công chứng từ tổ chức hành nghề công chứng này sang tổ chức hành nghề công chứng khác trong cùng một tỉnh, thành phố trực thuộc Trung ương", LV.CONG_CHUNG],
  /*  23 */ ["1.013807", "Đăng ký tập sự hành nghề công chứng", LV.CONG_CHUNG],
  /*  24 */ ["1.013812", "Thay đổi nơi tập sự hành nghề công chứng từ tổ chức hành nghề công chứng tại tỉnh, thành phố trực thuộc Trung ương này sang tổ chức hành nghề công chứng tại tỉnh, thành phố trực thuộc Trung ương khác", LV.CONG_CHUNG],
  /*  25 */ ["1.013806", "Công nhận tương đương đối với người được đào tạo nghề công chứng ở nước ngoài", LV.CONG_CHUNG],
  /*  26 */ ["1.013808", "Đăng ký tập sự lại hành nghề công chứng sau khi chấm dứt tập sự hành nghề công chứng", LV.CONG_CHUNG],
  /*  27 */ ["1.013816", "Chấm dứt tập sự hành nghề công chứng", LV.CONG_CHUNG],
  /*  28 */ ["1.013805", "Miễn nhiệm công chứng viên (trường hợp được miễn nhiệm)", LV.CONG_CHUNG],
  /*  29 */ ["1.013803", "Bổ nhiệm công chứng viên", LV.CONG_CHUNG],
  /*  30 */ ["1.013802", "Phê duyệt Điều lệ Hiệp hội công chứng viên Việt Nam", LV.CONG_CHUNG],
  /*  31 */ ["1.013804", "Bổ nhiệm lại công chứng viên", LV.CONG_CHUNG],
  /*  32 */ ["2.002139", "Đăng ký tham dự kiểm tra kết quả tập sự hành nghề đấu giá tài sản", LV.DGTS],
  /*  33 */ ["1.003915", "Cấp Chứng chỉ hành nghề đấu giá", LV.DGTS],
  /*  34 */ ["1.000802", "Cấp lại Chứng chỉ hành nghề đấu giá", LV.DGTS],
  /*  35 */ ["2.000894", "Miễn nhiệm và thu hồi thẻ giám định viên tư pháp", LV.GDTP],
  /*  36 */ ["2.000555", "Cấp Giấy đăng ký hoạt động của văn phòng giám định tư pháp trong trường hợp thay đổi tên gọi, địa chỉ trụ sở, người đại diện theo pháp luật, danh sách thành viên hợp danh của văn phòng giám định tư pháp", LV.GDTP],
  /*  37 */ ["2.000568", "Thay đổi, bổ sung lĩnh vực giám định của Văn phòng giám định tư pháp", LV.GDTP],
  /*  38 */ ["1.009832", "Cấp lại thẻ giám định viên tư pháp", LV.GDTP],
  /*  39 */ ["1.001216", "Chuyển đổi loại hình Văn phòng giám định tư pháp", LV.GDTP],
  /*  40 */ ["1.001122", "Bổ nhiệm và cấp thẻ giám định viên tư pháp cấp tỉnh", LV.GDTP],
  /*  41 */ ["1.001117", "Cấp lại Giấy đăng ký hoạt động của văn phòng giám định tư pháp trong trường hợp Giấy đăng ký hoạt động bị hư hỏng hoặc bị mất", LV.GDTP],
  /*  42 */ ["1.116546", "Bổ nhiệm lại và cấp thẻ giám định viên tư pháp", LV.GDTP],
  /*  43 */ ["1.116547", "Công nhận người giám định tư pháp theo vụ việc", LV.GDTP],
  /*  44 */ ["1.116548", "Hủy bỏ công nhận người giám định tư pháp theo vụ việc", LV.GDTP],
  /*  45 */ ["1.116549", "Công nhận tổ chức giám định tư pháp theo vụ việc", LV.GDTP],
  /*  46 */ ["1.116550", "Hủy bỏ công nhận tổ chức giám định tư pháp theo vụ việc", LV.GDTP],
  /*  47 */ ["1.116551", "Thành lập và đăng ký hoạt động của văn phòng giám định tư pháp", LV.GDTP],
  /*  48 */ ["1.116552", "Hợp nhất văn phòng giám định tư pháp được tổ chức và hoạt động dưới hình thức công ty hợp danh", LV.GDTP],
  /*  49 */ ["1.116553", "Sáp nhập văn phòng giám định tư pháp được tổ chức và hoạt động dưới hình thức công ty hợp danh", LV.GDTP],
  /*  50 */ ["1.116554", "Tạm ngừng hoạt động của văn phòng giám định tư pháp", LV.GDTP],
  /*  51 */ ["1.116555", "Chấm dứt hoạt động văn phòng giám định tư pháp", LV.GDTP],
  /*  52 */ ["2.001716", "Đăng ký hoạt động của Chi nhánh Trung tâm hòa giải thương mại", LV.HGTM],
  /*  53 */ ["2.000515", "Chấm dứt hoạt động Trung tâm hòa giải thương mại trong trường hợp Trung tâm hòa giải thương mại tự chấm dứt hoạt động", LV.HGTM],
  /*  54 */ ["1.009283", "Chấm dứt hoạt động của chi nhánh, văn phòng đại diện của tổ chức hòa giải thương mại nước ngoài tại Việt Nam trong trường hợp chi nhánh, văn phòng đại diện chấm dứt hoạt động theo quyết định của tổ chức hòa giải thương mại nước ngoài hoặc tổ chức hòa giải thương mại nước ngoài thành lập chi nhánh, văn phòng đại diện tại Việt Nam chấm dứt hoạt động ở nước ngoài (cấp tỉnh)", LV.HGTM],
  /*  55 */ ["1.009284", "Đăng ký làm hòa giải viên thương mại vụ việc", LV.HGTM],
  /*  56 */ ["1.008910", "Thay đổi tên gọi, địa chỉ trụ sở Trung tâm hòa giải thương mại sang tỉnh, thành phố trực thuộc Trung ương khác; đăng ký hoạt động Trung tâm hoà giải thương mại khi thay đổi địa chỉ trụ sở sang tỉnh, thành phố trực thuộc trung ương khác", LV.HGTM],
  /*  57 */ ["1.008916", "Thay đổi tên gọi, Trưởng chi nhánh, địa chỉ trụ sở sang tỉnh, thành phố trực thuộc trung ương khác của chi nhánh tổ chức hòa giải thương mại nước ngoài tại Việt Nam; đăng ký hoạt động của chi nhánh tổ chức hoà giải thương mại nước ngoài tại Việt Nam khi thay đổi tên gọi, Trưởng chi nhánh", LV.HGTM],
  /*  58 */ ["1.008914", "Cấp lại Giấy đăng ký hoạt động Trung tâm hòa giải thương mại, chi nhánh Trung tâm hòa giải thương mại, Giấy đăng ký hoạt động của chi nhánh tổ chức hòa giải thương mại nước ngoài tại Việt Nam", LV.HGTM],
  /*  59 */ ["1.008909", "Bổ sung hoạt động hòa giải thương mại cho Trung tâm trọng tài", LV.HGTM],
  /*  60 */ ["1.008915", "Đăng ký hoạt động của chi nhánh tổ chức hòa giải thương mại nước ngoài tại Việt Nam sau khi được cấp Giấy phép thành lập", LV.HGTM],
  /*  61 */ ["1.008911", "Cấp Giấy phép thành lập chi nhánh/văn phòng đại diện của tổ chức hòa giải thương mại nước ngoài tại Việt Nam", LV.HGTM],
  /*  62 */ ["1.008913", "Đăng ký hoạt động Trung tâm hòa giải thương mại sau khi được cấp Giấy phép thành lập", LV.HGTM],
  /*  63 */ ["1.008908", "Cấp lại Giấy phép thành lập Trung tâm hòa giải thương mại, Giấy phép thành lập chi nhánh, văn phòng đại diện của tổ chức hòa giải thương mại nước ngoài tại Việt Nam", LV.HGTM],
  /*  64 */ ["1.008907", "Cấp Giấy phép thành lập Trung tâm hòa giải thương mại", LV.HGTM],
  /*  65 */ ["1.002099", "Đăng ký hoạt động của chi nhánh của tổ chức hành nghề luật sư", LV.LUAT_SU],
  /*  66 */ ["2.000885", "Cấp Giấy phép thành lập chi nhánh của công ty luật nước ngoài tại Việt Nam", LV.LUAT_SU],
  /*  67 */ ["1.008624", "Cấp lại Chứng chỉ hành nghề luật sư trong trường hợp bị thu hồi Chứng chỉ hành nghề luật sư theo quy định tại Điều 18 của Luật Luật sư", LV.LUAT_SU],
  /*  68 */ ["1.008628", "Cấp lại Chứng chỉ hành nghề luật sư trong trường hợp bị mất, bị rách, bị cháy hoặc vì lý do khác không cố ý", LV.LUAT_SU],
  /*  69 */ ["1.008709", "Chuyển đổi công ty luật trách nhiệm hữu hạn và công ty luật hợp danh, chuyển đổi văn phòng luật sư thành công ty luật", LV.LUAT_SU],
  /*  70 */ ["1.008614", "Thu hồi chứng chỉ hành nghề luật sư", LV.LUAT_SU],
  /*  71 */ ["1.002943", "Chấm dứt hoạt động của chi nhánh, công ty luật nước ngoài trong trường hợp tự chấm dứt hoạt động", LV.LUAT_SU],
  /*  72 */ ["1.002563", "Sáp nhập công ty luật nước ngoài", LV.LUAT_SU],
  /*  73 */ ["1.002697", "Gia hạn Giấy phép hành nghề luật sư tại Việt Nam cho luật sư nước ngoài", LV.LUAT_SU],
  /*  74 */ ["1.002528", "Thay đổi nội dung giấy phép thành lập của chi nhánh, công ty luật nước ngoài tại Việt Nam", LV.LUAT_SU],
  /*  75 */ ["1.002676", "Thành lập cơ sở đào tạo nghề luật sư của Liên đoàn luật sư Việt Nam", LV.LUAT_SU],
  /*  76 */ ["1.002544", "Hợp nhất công ty luật nước ngoài", LV.LUAT_SU],
  /*  77 */ ["1.002649", "Chuyển đổi công ty luật nước ngoài thành công ty luật Việt Nam", LV.LUAT_SU],
  /*  78 */ ["1.002637", "Chuyển đổi chi nhánh của tổ chức hành nghề luật sư nước ngoài thành công ty luật trách nhiệm hữu hạn 100% vốn nước ngoài tại Việt Nam", LV.LUAT_SU],
  /*  79 */ ["1.002398", "Đăng ký hoạt động của công ty luật Việt Nam chuyển đổi từ công ty luật nước ngoài", LV.LUAT_SU],
  /*  80 */ ["1.002368", "Cấp lại Giấy đăng ký hoạt động của chi nhánh, công ty luật nước ngoài", LV.LUAT_SU],
  /*  81 */ ["1.002384", "Đăng ký hoạt động của chi nhánh của công ty luật nước ngoài tại Việt Nam", LV.LUAT_SU],
  /*  82 */ ["1.002181", "Đăng ký hoạt động của chi nhánh, công ty luật nước ngoài", LV.LUAT_SU],
  /*  83 */ ["1.002218", "Hợp nhất công ty luật", LV.LUAT_SU],
  /*  84 */ ["1.002198", "Thay đổi nội dung Giấy đăng ký hoạt động của chi nhánh, công ty luật nước ngoài", LV.LUAT_SU],
  /*  85 */ ["1.002234", "Sáp nhập công ty luật", LV.LUAT_SU],
  /*  86 */ ["1.002153", "Đăng ký hành nghề luật sư với tư cách cá nhân", LV.LUAT_SU],
  /*  87 */ ["1.002032", "Thay đổi nội dung đăng ký hoạt động của tổ chức hành nghề luật sư", LV.LUAT_SU],
  /*  88 */ ["1.002055", "Thay đổi người đại diện theo pháp luật của Văn phòng luật sư, công ty luật trách nhiệm hữu hạn một thành viên", LV.LUAT_SU],
  /*  89 */ ["1.002010", "Đăng ký hoạt động của tổ chức hành nghề luật sư", LV.LUAT_SU],
  /*  90 */ ["1.001979", "Cấp lại Giấy phép thành lập chi nhánh, công ty luật nước ngoài", LV.LUAT_SU],
  /*  91 */ ["1.002079", "Thay đổi người đại diện theo pháp luật của công ty luật trách nhiệm hữu hạn hai thành viên trở lên, công ty luật hợp danh", LV.LUAT_SU],
  /*  92 */ ["1.001928", "Công nhận đào tạo nghề luật sư ở nước ngoài", LV.LUAT_SU],
  /*  93 */ ["1.001993", "Cấp lại Giấy phép hành nghề tại Việt Nam của luật sư nước ngoài", LV.LUAT_SU],
  /*  94 */ ["1.000688", "Cấp Chứng chỉ hành nghề luật sư đối với người được miễn đào tạo nghề luật sư, miễn tập sự hành nghề luật sư", LV.LUAT_SU],
  /*  95 */ ["1.000828", "Cấp Chứng chỉ hành nghề luật sư đối với người đạt yêu cầu kiểm tra kết quả tập sự hành nghề luật sư", LV.LUAT_SU],
  /*  96 */ ["1.014966", "Cấp lại chứng chỉ hành nghề Quản tài viên trong trường hợp bị thu hồi chứng chỉ hành nghề", LV.QTV],
  /*  97 */ ["1.014965", "Thu hồi chứng chỉ hành nghề Quản tài viên trong trường hợp thôi hành nghề Quản tài viên theo nguyện vọng cá nhân", LV.QTV],
  /*  98 */ ["2.001130", "Cấp Chứng chỉ hành nghề Quản tài viên đối với luật sư, kiểm toán viên, người có trình độ cử nhân luật, kinh tế, kế toán, tài chính, ngân hàng và có thời gian công tác trong lĩnh vực được đào tạo từ 05 năm trở lên", LV.QTV],
  /*  99 */ ["2.001117", "Cấp lại chứng chỉ hành nghề Quản tài viên trong trường hợp chứng chỉ bị mất hoặc bị hư hỏng không thể sử dụng được", LV.QTV],
  /* 100 */ ["1.002626", "Đăng ký hành nghề quản lý, thanh lý tài sản với tư cách cá nhân", LV.QTV],
  /* 101 */ ["1.002681", "Cấp chứng chỉ hành nghề Quản tài viên đối với người đề nghị là luật sư nước ngoài, kiểm toán viên là người nước ngoài", LV.QTV],
  /* 102 */ ["1.001600", "Thay đổi thông tin đăng ký hành nghề của Quản tài viên", LV.QTV],
  /* 103 */ ["1.000627", "Đăng ký hoạt động của Trung tâm tư vấn pháp luật", LV.TVPL],
  /* 104 */ ["1.000614", "Đăng ký hoạt động cho chi nhánh của Trung tâm tư vấn pháp luật", LV.TVPL],
  /* 105 */ ["1.000588", "Thay đổi nội dung đăng ký hoạt động của Trung tâm tư vấn pháp luật, chi nhánh", LV.TVPL],
  /* 106 */ ["1.000426", "Cấp thẻ tư vấn viên pháp luật", LV.TVPL],
  /* 107 */ ["1.000390", "Cấp lại thẻ tư vấn viên pháp luật", LV.TVPL],
  /* 108 */ ["1.000404", "Thu hồi thẻ tư vấn viên pháp luật", LV.TVPL],
  /* 109 */ ["2.000819", "Thay đổi nội dung Giấy phép thành lập của Trung tâm Trọng tài", LV.TTTM],
  /* 110 */ ["2.000822", "Thành lập, đăng ký hoạt động Trung tâm trọng tài", LV.TTTM],
  /* 111 */ ["1.008889", "Đăng ký hoạt động Trung tâm trọng tài khi thay đổi địa điểm đặt trụ sở sang tỉnh, thành phố trực thuộc trung ương khác", LV.TTTM],
  /* 112 */ ["1.008905", "Thay đổi nội dung Giấy đăng ký hoạt động của Chi nhánh Trung tâm trọng tài khi thay đổi Trưởng Chi nhánh, địa điểm đặt trụ sở của Chi nhánh trong phạm vi tỉnh, thành phố trực thuộc trung ương", LV.TTTM],
  /* 113 */ ["1.008886", "Cấp Giấy phép thành lập Chi nhánh, Văn phòng đại diện của Tổ chức trọng tài nước ngoài tại Việt Nam", LV.TTTM],
  /* 114 */ ["1.008906", "Đăng ký hoạt động Chi nhánh của Tổ chức trọng tài nước ngoài tại Việt Nam sau khi được cấp Giấy phép thành lập; đăng ký hoạt động Chi nhánh của Tổ chức trọng tài nước ngoài tại Việt Nam trong trường hợp chuyển địa điểm trụ sở sang tỉnh, thành phố trực thuộc trung ương khác", LV.TTTM],
  /* 115 */ ["1.008890", "Đăng ký hoạt động của Chi nhánh Trung tâm trọng tài; đăng ký hoạt động của Chi nhánh Trung tâm trọng tài khi thay đổi địa điểm đặt trụ sở sang tỉnh, thành phố trực thuộc trung ương khác", LV.TTTM],
  /* 116 */ ["1.008888", "Cấp lại Giấy phép thành lập của Trung tâm trọng tài, Chi nhánh, Văn phòng đại diện của Tổ chức trọng tài nước ngoài tại Việt Nam", LV.TTTM],
  /* 117 */ ["1.008904", "Thay đổi nội dung Giấy đăng ký hoạt động của Trung tâm trọng tài; thay đổi nội dung Giấy đăng ký hoạt động của Chi nhánh Tổ chức trọng tài nước ngoài tại Việt Nam", LV.TTTM],
  /* 118 */ ["1.008887", "Chấm dứt hoạt động Chi nhánh, Văn phòng đại diện của Tổ chức trọng tài nước ngoài tại Việt Nam trong trường hợp Chi nhánh, Văn phòng đại diện của Tổ chức trọng tài nước ngoài bị chấm dứt hoạt động theo quyết định của Tổ chức trọng tài nước ngoài hoặc Tổ chức trọng tài nước ngoài thành lập Chi nhánh, Văn phòng đại diện tại Việt Nam đã chấm dứt hoạt động ở nước ngoài", LV.TTTM],
  /* 119 */ ["1.008885", "Chấm dứt hoạt động Trung tâm trọng tài theo Điều lệ của Trung tâm trọng tài", LV.TTTM],
  /* 120 */ ["1.001609", "Thay đổi nội dung Giấy phép thành lập của Chi nhánh của Tổ chức trọng tài nước ngoài tại Việt Nam", LV.TTTM],
  /* 121 */ ["1.001248", "Cấp lại Giấy đăng ký hoạt động của Trung tâm trọng tài, Chi nhánh Trung tâm trọng tài, Chi nhánh của Tổ chức trọng tài nước ngoài tại Việt Nam", LV.TTTM],
  /* 122 */ ["1.011435", "Đăng ký biện pháp bảo đảm bằng động sản (không phải là tàu bay, tàu biển, chứng khoán đã đăng ký tập trung), bằng cây hằng năm, công trình tạm", LV.DKBPBD],
  /* 123 */ ["1.011436", "Đăng ký thay đổi biện pháp bảo đảm bằng động sản (không phải là tàu bay, tàu biển, chứng khoán đã đăng ký tập trung), bằng cây hằng năm, công trình tạm", LV.DKBPBD],
  /* 124 */ ["1.011437", "Xóa đăng ký biện pháp bảo đảm bằng động sản (không phải là tàu bay, tàu biển, chứng khoán đã đăng ký tập trung), bằng cây hằng năm, công trình tạm", LV.DKBPBD],
  /* 125 */ ["1.011438", "Đăng ký thông báo xử lý tài sản bảo đảm, đăng ký thay đổi, xóa đăng ký thông báo xử lý tài sản bảo đảm là động sản (không phải là tàu bay, tàu biển, chứng khoán đã đăng ký tập trung), là cây hằng năm, công trình tạm", LV.DKBPBD],
  /* 126 */ ["1.011439", "Cung cấp thông tin về biện pháp bảo đảm bằng động sản (không phải là tàu bay, tàu biển, chứng khoán đã đăng ký tập trung), bằng cây hằng năm, công trình tạm", LV.DKBPBD],
  /* 127 */ ["1.011440", "Cấp bản sao văn bản chứng nhận đăng ký biện pháp bảo đảm bằng động sản (không phải là tàu bay, tàu biển, chứng khoán đã đăng ký tập trung), bằng cây hằng năm, công trình tạm", LV.DKBPBD],
  /* 128 */ ["3.000323", "Đăng ký giám sát việc giám hộ", LV.HO_TICH],
  /* 129 */ ["3.000322", "Đăng ký chấm dứt giám sát việc giám hộ", LV.HO_TICH],
  /* 130 */ ["2.002516", "Thủ tục xác nhận thông tin hộ tịch", LV.HO_TICH],
  /* 131 */ ["2.002189", "Thủ tục ghi vào Sổ hộ tịch việc kết hôn của công dân Việt Nam đã được giải quyết tại cơ quan có thẩm quyền của nước ngoài", LV.HO_TICH],
  /* 132 */ ["2.000756", "Thủ tục đăng ký chấm dứt giám hộ có yếu tố nước ngoài", LV.HO_TICH],
  /* 133 */ ["2.000748", "Thủ tục thay đổi, cải chính, bổ sung thông tin hộ tịch, xác định lại dân tộc có yếu tố nước ngoài", LV.HO_TICH],
  /* 134 */ ["2.000779", "Thủ tục đăng ký nhận cha, mẹ, con có yếu tố nước ngoài", LV.HO_TICH],
  /* 135 */ ["2.000635", "Cấp bản sao Trích lục hộ tịch, bản sao Giấy khai sinh", LV.HO_TICH],
  /* 136 */ ["2.000522", "Thủ tục đăng ký lại khai sinh có yếu tố nước ngoài", LV.HO_TICH],
  /* 137 */ ["2.000554", "Thủ tục ghi vào Sổ hộ tịch việc ly hôn, hủy việc kết hôn của công dân Việt Nam đã được giải quyết tại cơ quan có thẩm quyền của nước ngoài", LV.HO_TICH],
  /* 138 */ ["2.000528", "Thủ tục đăng ký khai sinh có yếu tố nước ngoài", LV.HO_TICH],
  /* 139 */ ["2.000547", "Thủ tục ghi vào Sổ hộ tịch việc hộ tịch khác của công dân Việt Nam đã được giải quyết tại cơ quan có thẩm quyền của nước ngoài (khai sinh; giám hộ; nhận cha, mẹ, con; xác định cha, mẹ, con; nuôi con nuôi; khai tử; thay đổi hộ tịch)", LV.HO_TICH],
  /* 140 */ ["2.000497", "Thủ tục đăng ký lại khai tử có yếu tố nước ngoài", LV.HO_TICH],
  /* 141 */ ["1.005461", "Đăng ký lại khai tử", LV.HO_TICH],
  /* 142 */ ["1.004873", "Thủ tục cấp Giấy xác nhận tình trạng hôn nhân", LV.HO_TICH],
  /* 143 */ ["1.004884", "Thủ tục đăng ký lại khai sinh", LV.HO_TICH],
  /* 144 */ ["1.004845", "Thủ tục đăng ký chấm dứt giám hộ", LV.HO_TICH],
  /* 145 */ ["1.004859", "Thủ tục thay đổi, cải chính, bổ sung thông tin hộ tịch, xác định lại dân tộc", LV.HO_TICH],
  /* 146 */ ["1.004837", "Thủ tục đăng ký giám hộ", LV.HO_TICH],
  /* 147 */ ["1.004772", "Thủ tục đăng ký khai sinh cho người đã có hồ sơ, giấy tờ cá nhân", LV.HO_TICH],
  /* 148 */ ["1.004827", "Thủ tục đăng ký khai tử có yếu tố nước ngoài tại khu vực biên giới", LV.HO_TICH],
  /* 149 */ ["1.001766", "Thủ tục đăng ký khai tử có yếu tố nước ngoài", LV.HO_TICH],
  /* 150 */ ["1.001695", "Thủ tục đăng ký khai sinh kết hợp đăng ký nhận cha, mẹ, con có yếu tố nước ngoài", LV.HO_TICH],
  /* 151 */ ["1.001193", "Thủ tục đăng ký khai sinh", LV.HO_TICH],
  /* 152 */ ["1.000893", "Thủ tục đăng ký khai sinh có yếu tố nước ngoài cho người đã có hồ sơ, giấy tờ cá nhân", LV.HO_TICH],
  /* 153 */ ["1.000689", "Thủ tục đăng ký khai sinh kết hợp đăng ký nhận cha, mẹ, con", LV.HO_TICH],
  /* 154 */ ["1.000656", "Thủ tục đăng ký khai tử", LV.HO_TICH],
  /* 155 */ ["1.001022", "Thủ tục đăng ký nhận cha, mẹ, con", LV.HO_TICH],
  /* 156 */ ["1.000080", "Thủ tục đăng ký nhận cha, mẹ, con có yếu tố nước ngoài tại khu vực biên giới", LV.HO_TICH],
  /* 157 */ ["1.000110", "Thủ tục đăng ký khai sinh có yếu tố nước ngoài tại khu vực biên giới", LV.HO_TICH],
  /* 158 */ ["1.001669", "Thủ tục đăng ký giám hộ có yếu tố nước ngoài", LV.HO_TICH],
  /* 159 */ ["2.002363", "Ghi vào Sổ đăng ký nuôi con nuôi việc nuôi con nuôi đã được giải quyết tại cơ quan có thẩm quyền của nước ngoài", LV.NUOI_CON_NUOI],
  /* 160 */ ["2.002349", "Cấp giấy xác nhận công dân Việt Nam thường trú ở khu vực biên giới đủ điều kiện nhận trẻ em của nước láng giềng cư trú ở khu vực biên giới làm con nuôi", LV.NUOI_CON_NUOI],
  /* 161 */ ["2.001255", "Đăng ký lại việc nuôi con nuôi trong nước", LV.NUOI_CON_NUOI],
  /* 162 */ ["1.003198", "Cấp giấy xác nhận công dân Việt Nam ở trong nước đủ điều kiện nhận trẻ em nước ngoài làm con nuôi", LV.NUOI_CON_NUOI],
  /* 163 */ ["1.003179", "Đăng ký lại việc nuôi con nuôi có yếu tố nước ngoài", LV.NUOI_CON_NUOI],
  /* 164 */ ["2.001895", "Cấp Giấy xác nhận là người gốc Việt Nam", LV.QUOC_TICH],
  /* 165 */ ["2.002036", "Thôi quốc tịch Việt Nam ở trong nước", LV.QUOC_TICH],
  /* 166 */ ["2.002038", "Trở lại quốc tịch Việt Nam ở trong nước", LV.QUOC_TICH],
  /* 167 */ ["1.005136", "Cấp Giấy xác nhận có quốc tịch Việt Nam ở trong nước", LV.QUOC_TICH],
  /* 168 */ ["2.002080", "Thủ tục thanh toán thù lao cho hòa giải viên", LV.HGCS],
  /* 169 */ ["2.000950", "Thủ tục công nhận tổ trưởng tổ hòa giải (cấp xã)", LV.HGCS],
  /* 170 */ ["2.000930", "Thủ tục thôi làm hòa giải viên (cấp xã)", LV.HGCS],
  /* 171 */ ["2.000424", "Thủ tục thực hiện hỗ trợ khi hòa giải viên gặp tai nạn hoặc rủi ro ảnh hưởng đến sức khỏe, tính mạng trong khi thực hiện hoạt động hòa giải", LV.HGCS],
  /* 172 */ ["1.002211", "Thủ tục công nhận hòa giải viên (cấp xã)", LV.HGCS],
  /* 173 */ ["2.001687", "Thủ tục thay đổi người thực hiện trợ giúp pháp lý", LV.TGPL],
  /* 174 */ ["2.001680", "Thủ tục rút yêu cầu trợ giúp pháp lý của người được trợ giúp pháp lý", LV.TGPL],
  /* 175 */ ["2.000970", "Thủ tục lựa chọn, ký hợp đồng với tổ chức hành nghề luật sư, tổ chức tư vấn pháp luật", LV.TGPL],
  /* 176 */ ["2.000977", "Thủ tục lựa chọn, ký hợp đồng với Luật sư", LV.TGPL],
  /* 177 */ ["2.000954", "Thủ tục cấp lại Giấy đăng ký tham gia trợ giúp pháp lý", LV.TGPL],
  /* 178 */ ["2.000829", "Thủ tục yêu cầu trợ giúp pháp lý", LV.TGPL],
  /* 179 */ ["2.000840", "Thủ tục chấm dứt tham gia trợ giúp pháp lý", LV.TGPL],
  /* 180 */ ["2.000596", "Thủ tục đăng ký tham gia trợ giúp pháp lý", LV.TGPL],
  /* 181 */ ["2.000587", "Thủ tục cấp thẻ cộng tác viên trợ giúp pháp lý", LV.TGPL],
  /* 182 */ ["2.000592", "Thủ tục giải quyết khiếu nại về trợ giúp pháp lý", LV.TGPL],
  /* 183 */ ["2.000518", "Thủ tục cấp lại thẻ cộng tác viên trợ giúp pháp lý", LV.TGPL],
  /* 184 */ ["1.001233", "Thủ tục thay đổi nội dung Giấy đăng ký tham gia trợ giúp pháp lý", LV.TGPL],
  /* 185 */ ["1.008928", "Cấp lại Thẻ Thừa hành viên", LV.THV],
  /* 186 */ ["1.008926", "Thay đổi nơi tập sự hành nghề Thừa hành viên", LV.THV],
  /* 187 */ ["1.008927", "Đăng ký hành nghề và cấp Thẻ Thừa hành viên", LV.THV],
  /* 188 */ ["1.008923", "Miễn nhiệm Thừa hành viên", LV.THV],
  /* 189 */ ["1.008924", "Bổ nhiệm lại Thừa hành viên", LV.THV],
  /* 190 */ ["1.008922", "Bổ nhiệm Thừa hành viên", LV.THV],
  /* 191 */ ["1.008921", "Công nhận tương đương đào tạo nghiệp vụ Thừa hành viên", LV.THV],
  /* 192 */ ["1.008925", "Đăng ký tập sự hành nghề Thừa hành viên", LV.THV],
  /* 193 */ ["1.003091", "Yêu cầu thi hành án dân sự", LV.THADS],
  /* 194 */ ["1.002270", "Xác nhận kết quả thi hành án", LV.THADS],
  /* 195 */ ["1.005464", "Đề nghị hỗ trợ chi phí tư vấn pháp luật cho doanh nghiệp nhỏ và vừa", LV.HTPL_DN],
  /* 196 */ ["1.116556", "Thủ tục cung cấp thông tin theo yêu cầu (dành cho cá nhân)", LV.TCTT],
  /* 197 */ ["1.116557", "Thủ tục cung cấp thông tin theo yêu cầu (dành cho công dân thông qua tổ chức, đoàn thể, doanh nghiệp)", LV.TCTT],
];

// --------------------------------------------------------------------------
// II. TTHC CUNG CẤP DỊCH VỤ CÔNG TRỰC TUYẾN MỘT PHẦN (30 TTHC)
//     Cột: maTTHC | tên TTHC | lĩnh vực | lý do { hienDien, thamTra, suCo, khac }
// --------------------------------------------------------------------------

const DANH_MUC_MOT_PHAN = [
  /*   1 */ ["2.001406", "Chứng thực văn bản phân chia di sản mà di sản là động sản, quyền sử dụng đất, nhà ở", LV.CHUNG_THUC, { hienDien: CC.ND23_D36 }],
  /*   2 */ ["2.001035", "Chứng thực giao dịch liên quan đến tài sản là động sản, quyền sử dụng đất, nhà ở", LV.CHUNG_THUC, { hienDien: CC.ND23_D36 }],
  /*   3 */ ["2.001019", "Chứng thực di chúc", LV.CHUNG_THUC, { hienDien: CC.ND23_D36 }],
  /*   4 */ ["2.001016", "Chứng thực văn bản từ chối nhận di sản", LV.CHUNG_THUC, { hienDien: CC.ND23_D36 }],
  /*   5 */ ["2.000942", "Cấp bản sao có chứng thực từ bản chính giao dịch đã được chứng thực", LV.CHUNG_THUC, { hienDien: CC.ND23_D20 }],
  /*   6 */ ["2.001008", "Chứng thực chữ ký người dịch mà người dịch không phải là cộng tác viên dịch thuật của Ủy ban nhân dân cấp xã, tổ chức hành nghề công chứng", LV.CHUNG_THUC, { hienDien: CC.ND23_D31 }],
  /*   7 */ ["2.000992", "Chứng thực chữ ký người dịch mà người dịch là cộng tác viên dịch thuật của Ủy ban nhân dân cấp xã, tổ chức hành nghề công chứng", LV.CHUNG_THUC, { hienDien: CC.ND23_D31 }],
  /*   8 */ ["2.000913", "Chứng thực việc sửa đổi, bổ sung, hủy bỏ giao dịch", LV.CHUNG_THUC, { hienDien: CC.ND23_D38 }],
  /*   9 */ ["2.000884", "Chứng thực chữ ký trong các giấy tờ, văn bản (áp dụng cho cả trường hợp chứng thực điểm chỉ và trường hợp người yêu cầu chứng thực không thể ký, không thể điểm chỉ được)", LV.CHUNG_THUC, { hienDien: CC.ND23_D24 }],
  /*  10 */ ["2.000815", "Chứng thực bản sao từ bản chính giấy tờ, văn bản do cơ quan, tổ chức có thẩm quyền của Việt Nam; cơ quan, tổ chức có thẩm quyền của nước ngoài; cơ quan, tổ chức có thẩm quyền của Việt Nam liên kết với cơ quan, tổ chức có thẩm quyền của nước ngoài cấp hoặc chứng nhận", LV.CHUNG_THUC, { hienDien: CC.ND23_D20 }],
  /*  11 */ ["2.001225", "Phê duyệt Trang thông tin đấu giá trực tuyến", LV.DGTS, { thamTra: CC.DAU_GIA }],
  /*  12 */ ["2.000854", "Cấp Giấy phép thành lập chi nhánh của tổ chức hành nghề luật sư nước ngoài tại Việt Nam", LV.LUAT_SU, { khac: CC.YTNN }],
  /*  13 */ ["2.000851", "Cấp giấy phép thành lập Công ty luật nước ngoài", LV.LUAT_SU, { khac: CC.YTNN }],
  /*  14 */ ["1.002911", "Cấp Giấy phép hành nghề tại Việt Nam của luật sư nước ngoài", LV.LUAT_SU, { khac: CC.YTNN }],
  /*  15 */ ["2.002195", "Giải quyết yêu cầu bồi thường tại cơ quan trực tiếp quản lý người thi hành công vụ gây thiệt hại (cấp trung ương)", LV.BTNN, { hienDien: CC.BTNN_HIEN_DIEN, thamTra: CC.BTNN_THAM_TRA }],
  /*  16 */ ["2.002192", "Giải quyết yêu cầu bồi thường tại cơ quan trực tiếp quản lý người thi hành công vụ gây thiệt hại (cấp tỉnh)", LV.BTNN, { hienDien: CC.BTNN_HIEN_DIEN, thamTra: CC.BTNN_THAM_TRA }],
  /*  17 */ ["2.002191", "Phục hồi danh dự (cấp tỉnh)", LV.BTNN, { hienDien: CC.BTNN_PHUC_HOI }],
  /*  18 */ ["2.002194", "Phục hồi danh dự (cấp trung ương)", LV.BTNN, { hienDien: CC.BTNN_PHUC_HOI }],
  /*  19 */ ["2.002165", "Giải quyết yêu cầu bồi thường tại cơ quan trực tiếp quản lý người thi hành công vụ gây thiệt hại (cấp xã)", LV.BTNN, { hienDien: CC.BTNN_HIEN_DIEN, thamTra: CC.BTNN_THAM_TRA }],
  /*  20 */ ["2.000513", "Thủ tục đăng ký lại kết hôn có yếu tố nước ngoài", LV.HO_TICH, { hienDien: CC.KET_HON_LAI }],
  /*  21 */ ["1.004746", "Thủ tục đăng ký lại kết hôn", LV.HO_TICH, { hienDien: CC.KET_HON_LAI }],
  /*  22 */ ["1.003583", "Thủ tục đăng ký khai sinh lưu động", LV.HO_TICH, { thamTra: CC.TT04_D25 }],
  /*  23 */ ["1.000894", "Thủ tục đăng ký kết hôn", LV.HO_TICH, { hienDien: CC.KET_HON }],
  /*  24 */ ["1.000593", "Thủ tục đăng ký kết hôn lưu động", LV.HO_TICH, { thamTra: CC.TT04_D26 }],
  /*  25 */ ["1.000419", "Thủ tục đăng ký khai tử lưu động", LV.HO_TICH, { thamTra: CC.TT04_D25 }],
  /*  26 */ ["2.000806", "Thủ tục đăng ký kết hôn có yếu tố nước ngoài", LV.HO_TICH, { hienDien: CC.KET_HON_NN }],
  /*  27 */ ["1.000094", "Thủ tục đăng ký kết hôn có yếu tố nước ngoài tại khu vực biên giới", LV.HO_TICH, { hienDien: CC.KET_HON_NN }],
  /*  28 */ ["2.001263", "Đăng ký việc nuôi con nuôi trong nước", LV.NUOI_CON_NUOI, { hienDien: CC.NCN_HIEN_DIEN, thamTra: CC.NCN_THAM_TRA }],
  /*  29 */ ["1.004878", "Giải quyết việc nuôi con nuôi có yếu tố nước ngoài đối với trường hợp cha dượng, mẹ kế nhận con riêng của vợ hoặc chồng; cô, cậu, dì, chú, bác ruột nhận cháu làm con nuôi", LV.NUOI_CON_NUOI, { hienDien: CC.NCN_NN_HIEN_DIEN, thamTra: CC.NCN_NN_THAM_TRA }],
  /*  30 */ ["2.002039", "Nhập quốc tịch Việt Nam ở trong nước", LV.QUOC_TICH, { hienDien: CC.QUOC_TICH_NHAP }],
];

// --------------------------------------------------------------------------
// III. TTHC KHÔNG CUNG CẤP DVCTT HOẶC KHÔNG THỰC HIỆN TRÊN HỆ THỐNG THÔNG TIN
//      TẬP TRUNG CỦA BỘ TƯ PHÁP (28 TTHC)
//      Cột: maTTHC | tên TTHC | lĩnh vực | ghi chú
// --------------------------------------------------------------------------

const DANH_MUC_KHONG_TRUC_TUYEN = [
  /*   1 */ ["2.000975", "Thủ tục chứng thực chữ ký người dịch không phải viên chức ngoại giao, viên chức lãnh sự", LV.CHUNG_THUC, GC.CQDD_TRUC_TIEP],
  /*   2 */ ["2.000988", "Chứng thực chữ ký người dịch mà người dịch là viên chức ngoại giao, viên chức lãnh sự", LV.CHUNG_THUC, GC.CQDD_TRUC_TIEP],
  /*   3 */ ["1.003976", "Giải quyết việc nuôi con nuôi có yếu tố nước ngoài đối với trẻ em sống ở cơ sở nuôi dưỡng", LV.NUOI_CON_NUOI, GC.CHUA_DVCTT_GIAI_QUYET],
  /*   4 */ ["1.005133", "Thủ tục Cấp giấy phép hoạt động của tổ chức con nuôi nước ngoài tại Việt Nam", LV.NUOI_CON_NUOI, GC.CHUA_DVCTT_TIEP_NHAN],
  /*   5 */ ["1.003236", "Thủ tục Sửa đổi giấy phép hoạt động của tổ chức con nuôi nước ngoài tại Việt Nam", LV.NUOI_CON_NUOI, GC.CHUA_DVCTT_TIEP_NHAN],
  /*   6 */ ["1.003160", "Giải quyết việc người nước ngoài thường trú ở Việt Nam nhận trẻ em Việt Nam làm con nuôi", LV.NUOI_CON_NUOI, GC.CHUA_DVCTT_TIEP_NHAN],
  /*   7 */ ["1.003005", "Giải quyết việc người nước ngoài cư trú ở khu vực biên giới nước láng giềng nhận trẻ em Việt Nam làm con nuôi", LV.NUOI_CON_NUOI, GC.CHUA_DVCTT_TIEP_NHAN],
  /*   8 */ ["1.000532", "Thủ tục Gia hạn giấy phép hoạt động của tổ chức con nuôi nước ngoài tại Việt Nam", LV.NUOI_CON_NUOI, GC.CHUA_DVCTT_TIEP_NHAN],
  /*   9 */ ["1.005141", "Thôi quốc tịch Việt Nam ở nước ngoài", LV.QUOC_TICH, GC.CQDD_KHONG_HE_THONG],
  /*  10 */ ["2.002797", "Nhập quốc tịch Việt Nam ở nước ngoài", LV.QUOC_TICH, GC.CQDD_KHONG_HE_THONG],
  /*  11 */ ["1.003213", "Thủ tục Đăng ký việc nuôi con nuôi tại Cơ quan đại diện Việt Nam ở nước ngoài", LV.NUOI_CON_NUOI, GC.HT_NGOAI_GIAO],
  /*  12 */ ["1.005137", "Cấp Giấy xác nhận có quốc tịch Việt Nam ở nước ngoài", LV.QUOC_TICH, GC.HT_NGOAI_GIAO],
  /*  13 */ ["1.004757", "Trở lại quốc tịch Việt Nam ở nước ngoài", LV.QUOC_TICH, GC.CQDD_KHONG_HE_THONG],
  /*  14 */ ["1.011441", "Đăng ký biện pháp bảo đảm bằng quyền sử dụng đất, tài sản gắn liền với đất", LV.DKBPBD, GC.HT_NN_MT],
  /*  15 */ ["1.011442", "Đăng ký thay đổi biện pháp bảo đảm bằng quyền sử dụng đất, tài sản gắn liền với đất", LV.DKBPBD, GC.HT_NN_MT],
  /*  16 */ ["1.011444", "Đăng ký thông báo xử lý tài sản bảo đảm, đăng ký thay đổi, xóa đăng ký thông báo xử lý tài sản bảo đảm là quyền sử dụng đất, tài sản gắn liền với đất", LV.DKBPBD, GC.HT_NN_MT],
  /*  17 */ ["1.011443", "Xóa đăng ký biện pháp bảo đảm bằng quyền sử dụng đất, tài sản gắn liền với đất", LV.DKBPBD, GC.HT_NN_MT],
  /*  18 */ ["1.011434", "Cấp bản sao văn bản chứng nhận đăng ký biện pháp bảo đảm bằng tàu biển", LV.DKBPBD, GC.HT_XAY_DUNG],
  /*  19 */ ["1.011445", "Chuyển tiếp đăng ký thế chấp quyền tài sản phát sinh từ hợp đồng mua bán nhà ở hoặc từ hợp đồng mua bán tài sản khác gắn liền với đất", LV.DKBPBD, GC.HT_NN_MT],
  /*  20 */ ["1.011431", "Xóa đăng ký biện pháp bảo đảm bằng tàu biển", LV.DKBPBD, GC.HT_XAY_DUNG],
  /*  21 */ ["1.011425", "Đăng ký thay đổi biện pháp bảo đảm bằng tàu bay", LV.DKBPBD, GC.HT_XAY_DUNG],
  /*  22 */ ["1.011432", "Đăng ký thông báo xử lý tài sản bảo đảm, đăng ký thay đổi, xóa đăng ký thông báo xử lý tài sản bảo đảm là tàu biển", LV.DKBPBD, GC.HT_XAY_DUNG],
  /*  23 */ ["1.011433", "Cung cấp thông tin về biện pháp bảo đảm bằng tàu biển", LV.DKBPBD, GC.HT_XAY_DUNG],
  /*  24 */ ["1.011429", "Đăng ký biện pháp bảo đảm bằng tàu biển", LV.DKBPBD, GC.HT_XAY_DUNG],
  /*  25 */ ["1.011430", "Đăng ký thay đổi biện pháp bảo đảm bằng tàu biển", LV.DKBPBD, GC.HT_XAY_DUNG],
  /*  26 */ ["1.011426", "Xóa đăng ký biện pháp bảo đảm bằng tàu bay", LV.DKBPBD, GC.HT_XAY_DUNG],
  /*  27 */ ["1.011423", "Đăng ký biện pháp bảo đảm bằng tàu bay", LV.DKBPBD, GC.HT_XAY_DUNG],
  /*  28 */ ["1.011427", "Đăng ký thông báo xử lý tài sản bảo đảm, đăng ký thay đổi, xóa đăng ký thông báo xử lý tài sản bảo đảm là tàu bay", LV.DKBPBD, GC.HT_XAY_DUNG],
];

// --------------------------------------------------------------------------
// DỰNG DỮ LIỆU CHO GIAO DIỆN
// --------------------------------------------------------------------------

/** Chuẩn hoá mã TTHC: bỏ dấu chấm thừa (vd "2.000.908" → "2.000908"). */
function chuanHoaMaTTHC(ma) {
  const parts = String(ma).split(".");
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : String(ma);
}

/** Đổi object lý do thành mảng { nhan, noiDung } theo đúng thứ tự cột Phụ lục. */
function chuanHoaLyDo(lyDo) {
  if (!lyDo) return [];
  return ["hienDien", "thamTra", "suCo", "khac"]
    .filter((key) => lyDo[key])
    .map((key) => ({ nhan: LY_DO_LABEL[key], noiDung: lyDo[key] }));
}

/** Dựng 1 object thủ tục từ 1 dòng bảng. */
function buildThuTuc(row, soThuTu, mucDoDVC) {
  const [maGoc, ten, linhVuc, phuLuc] = row;
  const maTTHC = chuanHoaMaTTHC(maGoc);

  return {
    id: `dvc-${String(soThuTu).padStart(3, "0")}`,
    maTTHC,
    ten,
    linhVuc,
    mucDoDVC,
    lyDoMotPhan: mucDoDVC === MUC_DO.MP ? chuanHoaLyDo(phuLuc) : [],
    ghiChu: mucDoDVC === MUC_DO.KHONG ? phuLuc || "" : "",
    trangThai: mucDoDVC,   // bộ lọc của app.js lọc theo mức độ DVC trực tuyến
    thoiGian: "",          // Phụ lục không có cột thời gian
    capThucHien: CAP_THUC_HIEN_URL,
    portalBaseUrl: PORTAL_BASE_URL,
    coQuanThucHienList: CO_QUAN_MAC_DINH.map((noi) => ({ ...noi, maDVC: maTTHC })),
  };
}

/** 255 TTHC của Phụ lục, giữ nguyên thứ tự nhóm I → II → III. */
const DICH_VU_CONG = (() => {
  const nhom = [
    [DANH_MUC_TOAN_TRINH, MUC_DO.TT],
    [DANH_MUC_MOT_PHAN, MUC_DO.MP],
    [DANH_MUC_KHONG_TRUC_TUYEN, MUC_DO.KHONG],
  ];
  let stt = 0;
  return nhom.flatMap(([bang, mucDo]) => bang.map((row) => buildThuTuc(row, ++stt, mucDo)));
})();

// --------------------------------------------------------------------------
// TÁC NGHIỆP NỘI BỘ (dữ liệu mẫu — không thuộc Phụ lục)
// --------------------------------------------------------------------------

const TAC_NGHIEP = [
  {
    id: "tn-001",
    ma: "TN-101",
    ten: "Tiếp nhận hồ sơ tại bộ phận một cửa",
    phongBan: "Bộ phận Một cửa",
    nguoiPhuTrach: "Nguyễn Thị Hạnh",
    han: "Hôm nay, 16:00",
    uuTien: "cao",
    trangThai: "dang-xu-ly",
    capNhat: "4 phút trước",
  },
  {
    id: "tn-002",
    ma: "TN-102",
    ten: "Thẩm định hồ sơ cấp phép xây dựng",
    phongBan: "Phòng Quản lý đô thị",
    nguoiPhuTrach: "Trần Văn Minh",
    han: "Hôm nay, 17:00",
    uuTien: "cao",
    trangThai: "qua-han",
    capNhat: "1 giờ trước",
  },
  {
    id: "tn-003",
    ma: "TN-103",
    ten: "Trình ký lãnh đạo - lô hồ sơ hộ tịch",
    phongBan: "Văn phòng UBND",
    nguoiPhuTrach: "Lê Thị Mai",
    han: "Ngày mai, 09:00",
    uuTien: "trung-binh",
    trangThai: "moi",
    capNhat: "15 phút trước",
  },
  {
    id: "tn-004",
    ma: "TN-104",
    ten: "Trả kết quả cho công dân",
    phongBan: "Bộ phận Một cửa",
    nguoiPhuTrach: "Phạm Đức Anh",
    han: "Hôm nay, 15:30",
    uuTien: "cao",
    trangThai: "phuong-xa",
    capNhat: "22 phút trước",
  },
  {
    id: "tn-005",
    ma: "TN-105",
    ten: "Lưu trữ và số hoá hồ sơ đã giải quyết",
    phongBan: "Văn phòng UBND",
    nguoiPhuTrach: "Đỗ Thanh Hà",
    han: "Thứ Sáu, 17:00",
    uuTien: "thap",
    trangThai: "dang-xu-ly",
    capNhat: "2 giờ trước",
  },
  {
    id: "tn-006",
    ma: "TN-106",
    ten: "Báo cáo tiến độ giải quyết hồ sơ tuần",
    phongBan: "Văn phòng UBND",
    nguoiPhuTrach: "Vũ Quốc Huy",
    han: "Thứ Sáu, 11:00",
    uuTien: "trung-binh",
    trangThai: "moi",
    capNhat: "40 phút trước",
  },
  {
    id: "tn-007",
    ma: "TN-107",
    ten: "Họp giao ban tuần - khối dịch vụ công",
    phongBan: "Văn phòng UBND",
    nguoiPhuTrach: "Lãnh đạo Văn phòng",
    han: "Thứ Hai, 08:00",
    uuTien: "trung-binh",
    trangThai: "moi",
    capNhat: "3 giờ trước",
  },
  {
    id: "tn-008",
    ma: "TN-108",
    ten: "Kiểm tra chéo hồ sơ lĩnh vực đất đai",
    phongBan: "Phòng Tài nguyên - Môi trường",
    nguoiPhuTrach: "Ngô Thị Lan",
    han: "Hôm nay, 16:30",
    uuTien: "cao",
    trangThai: "dang-xu-ly",
    capNhat: "10 phút trước",
  },
  {
    id: "tn-009",
    ma: "TN-109",
    ten: "Tập huấn nghiệp vụ một cửa điện tử",
    phongBan: "Phòng CNTT",
    nguoiPhuTrach: "Hoàng Văn Tùng",
    han: "Thứ Tư tuần sau",
    uuTien: "thap",
    trangThai: "moi",
    capNhat: "5 giờ trước",
  },
  {
    id: "tn-010",
    ma: "TN-110",
    ten: "Bảo trì hệ thống một cửa điện tử",
    phongBan: "Phòng CNTT",
    nguoiPhuTrach: "Hoàng Văn Tùng",
    han: "Tối nay, 22:00",
    uuTien: "trung-binh",
    trangThai: "dang-xu-ly",
    capNhat: "1 phút trước",
  },
  {
    id: "tn-011",
    ma: "TN-111",
    ten: "Cập nhật dữ liệu thủ tục mới ban hành",
    phongBan: "Phòng CNTT",
    nguoiPhuTrach: "Bùi Thu Trang",
    han: "Ngày mai, 12:00",
    uuTien: "trung-binh",
    trangThai: "dang-xu-ly",
    capNhat: "25 phút trước",
  },
  {
    id: "tn-012",
    ma: "TN-112",
    ten: "Rà soát quy trình xử lý hồ sơ trễ hạn",
    phongBan: "Văn phòng UBND",
    nguoiPhuTrach: "Vũ Quốc Huy",
    han: "Thứ Năm, 17:00",
    uuTien: "cao",
    trangThai: "qua-han",
    capNhat: "6 giờ trước",
  },
  {
    id: "tn-013",
    ma: "TN-113",
    ten: "Photocopy, sao y hồ sơ cho công dân",
    phongBan: "Bộ phận Một cửa",
    nguoiPhuTrach: "Phạm Đức Anh",
    han: "Hôm nay, 14:00",
    uuTien: "thap",
    trangThai: "phuong-xa",
    capNhat: "50 phút trước",
  },
  {
    id: "tn-014",
    ma: "TN-114",
    ten: "Tổng hợp khảo sát mức độ hài lòng",
    phongBan: "Văn phòng UBND",
    nguoiPhuTrach: "Đỗ Thanh Hà",
    han: "Thứ Sáu, 16:00",
    uuTien: "thap",
    trangThai: "moi",
    capNhat: "4 giờ trước",
  },
  {
    id: "tn-015",
    ma: "TN-115",
    ten: "Kiểm tra thiết bị ký số, máy lấy số",
    phongBan: "Phòng CNTT",
    nguoiPhuTrach: "Bùi Thu Trang",
    han: "Hôm nay, 08:30",
    uuTien: "trung-binh",
    trangThai: "phuong-xa",
    capNhat: "3 giờ trước",
  },
  {
    id: "tn-016",
    ma: "TN-116",
    ten: "Đối soát phí, lệ phí thu trong ngày",
    phongBan: "Bộ phận Một cửa",
    nguoiPhuTrach: "Nguyễn Thị Hạnh",
    han: "Hôm nay, 17:00",
    uuTien: "cao",
    trangThai: "dang-xu-ly",
    capNhat: "8 phút trước",
  },
];
