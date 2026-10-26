/**
 * DANH MỤC THỦ TỤC HÀNH CHÍNH — QUYẾT ĐỊNH SỐ 658/QĐ-BTP
 * ==================================================================
 * Nguồn: Quyết định 658/QĐ-BTP ngày 27/02/2026 của Bộ trưởng Bộ Tư pháp
 *        công bố Danh mục TTHC thuộc phạm vi quản lý nhà nước của Bộ Tư
 *        pháp triển khai trên Hệ thống thông tin giải quyết TTHC tập trung
 *        của Bộ Tư pháp. Hiệu lực từ 01/3/2026.
 *
 * Tổng cộng 272 TTHC, trong đó:
 *   - 253 TTHC chạy trên Hệ thống của Bộ Tư pháp  → DANH_MUC_QD658
 *   -  19 TTHC thuộc thẩm quyền giải quyết của cơ quan nông nghiệp và môi
 *        trường, xây dựng, ngoại giao, chạy trên Hệ thống của các Bộ đó
 *        → DANH_MUC_BO_KHAC (xem Ghi chú cuối Quyết định)
 *
 * ------------------------------------------------------------------
 * CÁCH TỔ CHỨC DỮ LIỆU
 * ------------------------------------------------------------------
 * Thay vì hardcode từng object, dữ liệu gốc được giữ ở dạng BẢNG (mỗi dòng
 * = 1 dòng trong Phụ lục của Quyết định), rồi hàm buildThuTuc() dựng ra
 * object đầy đủ mà app.js đang dùng. Muốn thêm/sửa/xoá thủ tục thì chỉ cần
 * sửa đúng 1 dòng trong bảng.
 *
 * Mỗi dòng bảng có thứ tự cột y hệt Phụ lục Quyết định:
 *   [ maTTHC, tên TTHC, đối tượng, lĩnh vực, cấp thực hiện,
 *     cơ quan thực hiện, thời gian triển khai thí điểm, mức độ DVC trực tuyến ]
 *
 * Object dựng ra gồm:
 *   id                mã nội bộ "dvc-001"…
 *   maTTHC            mã TTHC quốc gia (đã chuẩn hoá bỏ dấu chấm thừa)
 *   ten               tên thủ tục
 *   doiTuong          đối tượng thực hiện
 *   linhVuc           lĩnh vực (dùng cho bộ lọc "Tất cả lĩnh vực")
 *   capQD             cấp thực hiện ghi trong Quyết định (chuỗi nguyên văn)
 *   coQuanThucHien    cơ quan thực hiện (chuỗi nguyên văn)
 *   thoiGianThiDiem   ngày bắt đầu triển khai thí điểm
 *   thoiGian          = thoiGianThiDiem (cột hiển thị trên danh sách)
 *   mucDoDVC          "toan-trinh" | "mot-phan" | "khong-du-dieu-kien"
 *   trangThai         slug cấp thực hiện chính, dùng cho bộ lọc của app.js
 *   capThucHien       THAM SỐ URL CapThucHien của cổng DVC (xem ghi chú dưới)
 *   portalBaseUrl     cổng DVC ngành Tư pháp
 *   coQuanThucHienList  danh sách nơi thực hiện để dựng link chuyển hướng
 *
 * ------------------------------------------------------------------
 * LƯU Ý QUAN TRỌNG — 2 THỨ KHÔNG CÓ TRONG QUYẾT ĐỊNH 658
 * ------------------------------------------------------------------
 * 1) Quyết định 658 KHÔNG chứa mã cơ quan thực hiện theo tỉnh (vd "H29")
 *    và cũng không chứa mã dịch vụ công (MaDVC). Vì vậy coQuanThucHienList
 *    được sinh theo đúng quy ước đang dùng trước đây của dự án:
 *       tinh = "Thành phố Hồ Chí Minh", maCoQuan = "H29", maDVC = maTTHC.
 *    => Khi có danh sách mã cơ quan thật theo từng tỉnh, chỉ cần sửa
 *       CO_QUAN_MAC_DINH hoặc truyền override trong bảng dữ liệu.
 *
 * 2) `capThucHien` là THAM SỐ CỦA URL CỔNG DVC (1=tỉnh, 2=huyện, 3=xã theo
 *    quan sát trước đây), KHÔNG phải cột "Cấp thực hiện" của Quyết định.
 *    Giá trị 2 được giữ nguyên như cấu hình đang chạy để không làm hỏng
 *    link chuyển hướng hiện tại. Cấp thực hiện theo Quyết định nằm ở
 *    trường `capQD` / `trangThai`.
 * ==================================================================
 */

const PORTAL_BASE_URL = "https://dichvucongnganhtuphap.moj.gov.vn/danh-sach-thu-tuc";

/** Tham số CapThucHien trên URL cổng DVC — xem ghi chú (2) ở trên. */
const CAP_THUC_HIEN_URL = 2;

/** Nơi thực hiện mặc định (Quyết định 658 không công bố mã cơ quan theo tỉnh). */
const CO_QUAN_MAC_DINH = [{ tinh: "Thành phố Hồ Chí Minh", maCoQuan: "H29" }];

// --------------------------------------------------------------------------
// TỪ ĐIỂN DÙNG CHUNG — viết tắt cho bảng dữ liệu bên dưới
// --------------------------------------------------------------------------

/** Lĩnh vực */
const LV = {
  TGPL: "Trợ giúp pháp lý",
  HGCS: "Hòa giải ở cơ sở",
  HTPL_DN: "Hỗ trợ pháp lý cho doanh nghiệp nhỏ và vừa",
  THADS: "Thi hành án dân sự",
  TPL: "Thừa phát lại",
  HO_TICH: "Hộ tịch",
  LUAT_SU: "Luật sư",
  QTV: "Quản tài viên",
  TVPL: "Tư vấn pháp luật",
  CHUNG_THUC: "Chứng thực",
  CONG_CHUNG: "Công chứng",
  DGTS: "Đấu giá tài sản",
  GDTP: "Giám định tư pháp",
  HGTM: "Hòa giải thương mại",
  TTTM: "Trọng tài thương mại",
  BTNN: "Bồi thường nhà nước",
  DKBPBD: "Đăng ký biện pháp bảo đảm",
  NUOI_CON_NUOI: "Nuôi con nuôi",
  QUOC_TICH: "Quốc tịch",
};

/** Cấp thực hiện (nguyên văn Quyết định) */
const CAP = {
  BO: "Cấp Bộ",
  TINH: "Cấp Tỉnh",
  XA: "Cấp Xã",
  KHAC: "Cơ quan khác",
  TINH_XA: "Cấp Tỉnh; Cấp Xã",
  BO_TINH: "Cấp Bộ; Cấp Tỉnh",
  XA_KHAC: "Cấp Xã; Cơ quan khác",
  BO_TINH_XA_KHAC: "Cấp Bộ; Cấp Tỉnh; Cấp Xã; Cơ quan khác",
};

/** Mức độ cung cấp dịch vụ công trực tuyến */
const MUC_DO = {
  TT: "toan-trinh",            // cột "Toàn trình"
  MP: "mot-phan",              // cột "Một phần"
  KHONG: "khong-du-dieu-kien", // dấu "-": không đủ điều kiện theo pháp luật chuyên ngành
};

/** Đối tượng thực hiện */
const DT = {
  CD: "Công dân Việt Nam",
  CD_HUU: "Công dân Việt Nam (Cán bộ, công chức, viên chức đã nghỉ hưu)",
  CD_CBCC: "Công dân Việt Nam; Cán bộ, công chức, viên chức",
  CD_NN: "Công dân Việt Nam; Người Việt Nam định cư ở nước ngoài",
  CD_NN_CBCC: "Công dân Việt Nam; Người Việt Nam định cư ở nước ngoài; Cán bộ, công chức, viên chức",
  CD_NN_NNG: "Công dân Việt Nam; Người Việt Nam định cư ở nước ngoài; Người nước ngoài",
  CD_NN_NNG_CBCC: "Công dân Việt Nam; Người Việt Nam định cư ở nước ngoài; Người nước ngoài; Cán bộ, công chức, viên chức",
  CD_TC: "Công dân Việt Nam; Tổ chức (không bao gồm doanh nghiệp, HTX)",
  CN: "Cá nhân",
  CN_TC: "Cá nhân, tổ chức",
  CN_PN: "Cá nhân, pháp nhân",
  TC_CN: "Tổ chức, cá nhân",
  CQ_TC_CN: "Cơ quan, tổ chức, cá nhân",
  TC: "Tổ chức (không bao gồm doanh nghiệp, HTX)",
  TC_TCNN: "Tổ chức (không bao gồm doanh nghiệp, HTX); Tổ chức nước ngoài",
  TCNN: "Tổ chức nước ngoài",
  DN: "Doanh nghiệp",
  DN_FDI: "Doanh nghiệp; Doanh nghiệp có vốn đầu tư nước ngoài",
  FDI_TCNN: "Doanh nghiệp có vốn đầu tư nước ngoài; Tổ chức nước ngoài",
  DN_FDI_TC_HTX: "Doanh nghiệp; Doanh nghiệp có vốn đầu tư nước ngoài; Tổ chức (không bao gồm doanh nghiệp, HTX); Hợp tác xã",
  NNG: "Người nước ngoài",
  NNG_KQT: "Người nước ngoài, người không quốc tịch",
  NNG_KQT_CU: "Người nước ngoài, người không quốc tịch (từng có quốc tịch Việt Nam)",
  NNG_TCNN: "Người nước ngoài; Tổ chức nước ngoài",
  VPCC: "Văn phòng công chứng",
  VPCC_DNTN: "Văn phòng công chứng theo loại hình doanh nghiệp tư nhân",
  VPCC_HD: "Văn phòng công chứng theo loại hình công ty hợp danh",
  VPCC_NHAN_CN: "Văn phòng công chứng nhận chuyển nhượng vốn góp",
  CCV_HD: "Công chứng viên hợp danh của Văn phòng công chứng",
  TCHN_CC: "Tổ chức hành nghề công chứng",
  HH_CCV: "Hiệp hội công chứng viên Việt Nam",
  TCCN_NN: "Tổ chức con nuôi nước ngoài",
  CBCC: "Cán bộ, công chức, viên chức",
  // Nhóm đối tượng dài của lĩnh vực Bồi thường nhà nước
  BTNN_TW: "Công dân Việt Nam; Cán bộ, công chức, viên chức; Doanh nghiệp; Doanh nghiệp có vốn đầu tư nước ngoài; Tổ chức (không bao gồm doanh nghiệp, HTX)",
  BTNN_TINH: "Công dân Việt Nam; Người Việt Nam định cư ở nước ngoài; Cán bộ, công chức, viên chức; Doanh nghiệp; Tổ chức (không bao gồm doanh nghiệp, HTX)",
  BTNN_XA: "Công dân Việt Nam; Người Việt Nam định cư ở nước ngoài; Người nước ngoài; Cán bộ, công chức, viên chức; Doanh nghiệp; Doanh nghiệp có vốn đầu tư nước ngoài; Tổ chức (không bao gồm doanh nghiệp, HTX); Tổ chức nước ngoài; Hợp tác xã",
  QT_XN: "Công dân Việt Nam; người nước ngoài; người chưa xác định được quốc tịch",
  TT_DN_TCNN: "Doanh nghiệp; Tổ chức (không bao gồm doanh nghiệp, HTX); Tổ chức nước ngoài",
};

/** Cơ quan thực hiện */
const CQ = {
  STP: "Sở Tư pháp",
  BTP: "Bộ Tư pháp",
  BTP_STP: "Bộ Tư pháp, Sở Tư pháp",
  BO_TRUONG: "Bộ trưởng",
  BO_NGANG_BO: "Bộ, cơ quan ngang Bộ, cơ quan thuộc Chính phủ",
  CUC_BTTP: "Cục Bổ trợ tư pháp",
  CUC_HCTP: "Cục Hành chính tư pháp",
  UBND_XA: "Ủy ban nhân dân cấp xã",
  UBND_XPD: "Ủy ban Nhân dân xã, phường, Đặc khu",
  UBND_TINH: "Ủy ban nhân dân cấp Tỉnh",
  UBND_TINH_STP: "Ủy ban nhân dân cấp Tỉnh, Sở Tư pháp",
  CT_TINH: "Chủ tịch Ủy ban nhân dân cấp tỉnh",
  CT_TINH_STP: "Chủ tịch Ủy ban nhân dân cấp tỉnh, Sở Tư pháp",
  STP_CT_TINH: "Sở Tư pháp, Chủ tịch Ủy ban nhân dân cấp tỉnh",
  STP_UBND_XA: "Sở Tư pháp; Ủy ban nhân dân cấp xã",
  UBND_XA_STP: "Ủy ban nhân dân cấp xã; Sở Tư pháp",
  TGPL_DAY_DU: "Trung tâm trợ giúp pháp lý nhà nước, Chi nhánh của Trung tâm/ Tổ chức tham gia trợ giúp pháp lý",
  TGPL_TT: "Trung tâm trợ giúp pháp lý nhà nước",
  TGPL_KHIEU_NAI: "Giám đốc Sở Tư pháp; Người đứng đầu của tổ chức thực hiện trợ giúp pháp lý",
  THADS: "Cục Thi hành án dân sự, Phòng thi hành án cấp quân khu",
  SO_GOC: "Cơ quan, tổ chức đang quản lý sổ gốc",
  CT_CHU_KY: "Tổ chức hành nghề công chứng, Cơ quan đại diện có thẩm quyền, Ủy ban nhân dân cấp xã",
  CT_BAN_SAO: "Ủy ban Nhân dân xã, phường, Đặc khu, Tổ chức hành nghề công chứng, Cơ quan đại diện có thẩm quyền",
  TT_DKGD: "Trung tâm đăng ký giao dịch, tài sản thuộc Cục Đăng ký giao dịch bảo đảm và Bồi thường Nhà nước",
  LIEN_THONG_KS: "Ủy ban nhân dân cấp xã, Công an xã, cơ quan BHXH",
  BTP_STP_UBND_TINH: "Bộ Tư pháp, Sở Tư pháp, Ủy ban nhân dân cấp Tỉnh",
  BTP_CQDD: "Bộ Tư pháp, Cơ quan đại diện Việt Nam ở nước ngoài",
  STP_CQDD: "Sở Tư pháp, Cơ quan đại diện Việt Nam ở nước ngoài",
  CQDD: "Cơ quan đại diện Việt Nam ở nước ngoài",
  CQDD_TQ: "Cơ quan đại diện có thẩm quyền",
  BTNN_TINH: "Cơ quan giải quyết bồi thường là cơ quan trực tiếp quản lý người thi hành công vụ gây thiệt hại trong hoạt động quản lý hành chính, tố tụng, thi hành án quy định từ Điều 33 đến Điều 39 của Luật TNBTCNN năm 2017 ở cấp tỉnh",
  BTNN_XA: "Cơ quan trực tiếp quản lý người thi hành công vụ gây thiệt hại trong hoạt động quản lý hành chính quy định tại Điều 33 của Luật TNBTCNN năm 2017 ở cấp xã",
  VPDKDD: "Văn phòng đăng ký đất đai trực thuộc Sở Nông nghiệp và Môi trường; Chi nhánh Văn phòng đăng ký đất đai",
  DK_TAU_BIEN: "Cơ quan đăng ký tàu biển Việt Nam",
  CUC_HK: "Cục Hàng không Việt Nam",
};

/** Mốc thời gian triển khai thí điểm */
const T1 = "01/3/2026";
const T2 = "15/3/2026";
const T3 = "30/3/2026";
const T4 = "01/4/2026";
const T5 = "30/4/2026";

// --------------------------------------------------------------------------
// BẢNG DỮ LIỆU GỐC — 253 TTHC trên Hệ thống của Bộ Tư pháp
// Cột: maTTHC | tên | đối tượng | lĩnh vực | cấp | cơ quan | thí điểm | mức độ
// (STT trong chú thích đầu dòng tương ứng STT của Phụ lục Quyết định 658)
// --------------------------------------------------------------------------

const DANH_MUC_QD658 = [
  // ---- Trợ giúp pháp lý (1–12) --------------------------------------------
  /*   1 */ ["2.001687", "Thủ tục thay đổi người thực hiện trợ giúp pháp lý", DT.CD, LV.TGPL, CAP.TINH, CQ.TGPL_DAY_DU, T1, MUC_DO.TT],
  /*   2 */ ["2.001680", "Thủ tục rút yêu cầu trợ giúp pháp lý của người được trợ giúp pháp lý", DT.CD, LV.TGPL, CAP.TINH, CQ.TGPL_DAY_DU, T1, MUC_DO.TT],
  /*   3 */ ["2.000977", "Thủ tục lựa chọn, ký hợp đồng với Luật sư", DT.CD, LV.TGPL, CAP.TINH, CQ.TGPL_TT, T1, MUC_DO.TT],
  /*   4 */ ["2.000970", "Thủ tục lựa chọn, ký hợp đồng với tổ chức hành nghề luật sư, tổ chức tư vấn pháp luật", DT.TC, LV.TGPL, CAP.TINH, CQ.STP, T1, MUC_DO.TT],
  /*   5 */ ["2.000954", "Thủ tục cấp lại Giấy đăng ký tham gia trợ giúp pháp lý", DT.TC, LV.TGPL, CAP.TINH, CQ.STP, T1, MUC_DO.TT],
  /*   6 */ ["2.000840", "Thủ tục chấm dứt tham gia trợ giúp pháp lý", DT.TC_TCNN, LV.TGPL, CAP.TINH, CQ.STP, T1, MUC_DO.TT],
  /*   7 */ ["2.000829", "Thủ tục yêu cầu trợ giúp pháp lý", DT.CD, LV.TGPL, CAP.TINH, CQ.TGPL_DAY_DU, T1, MUC_DO.TT],
  /*   8 */ ["2.000596", "Thủ tục đăng ký tham gia trợ giúp pháp lý", DT.TC, LV.TGPL, CAP.TINH, CQ.STP, T1, MUC_DO.TT],
  /*   9 */ ["1.001233", "Thủ tục thay đổi nội dung Giấy đăng ký tham gia trợ giúp pháp lý", DT.TC, LV.TGPL, CAP.TINH, CQ.STP, T1, MUC_DO.TT],
  /*  10 */ ["2.000592", "Thủ tục giải quyết khiếu nại về trợ giúp pháp lý", DT.CD, LV.TGPL, CAP.TINH, CQ.TGPL_KHIEU_NAI, T1, MUC_DO.TT],
  /*  11 */ ["2.000587", "Thủ tục cấp thẻ cộng tác viên trợ giúp pháp lý", DT.CD_HUU, LV.TGPL, CAP.TINH, CQ.STP, T1, MUC_DO.TT],
  /*  12 */ ["2.000518", "Thủ tục cấp lại thẻ cộng tác viên trợ giúp pháp lý", DT.CD_HUU, LV.TGPL, CAP.TINH, CQ.STP, T1, MUC_DO.TT],

  // ---- Hòa giải ở cơ sở (13–17) -------------------------------------------
  /*  13 */ ["2.002080", "Thủ tục thanh toán thù lao cho hòa giải viên", DT.CD, LV.HGCS, CAP.XA, CQ.UBND_XA, T1, MUC_DO.TT],
  /*  14 */ ["1.002211", "Thủ tục công nhận hòa giải viên (cấp xã)", DT.CD, LV.HGCS, CAP.XA, CQ.UBND_XA, T1, MUC_DO.TT],
  /*  15 */ ["2.000950", "Thủ tục công nhận tổ trưởng tổ hòa giải (cấp xã)", DT.CD, LV.HGCS, CAP.XA, CQ.UBND_XA, T1, MUC_DO.TT],
  /*  16 */ ["2.000930", "Thủ tục thôi làm hòa giải viên (cấp xã)", DT.CD, LV.HGCS, CAP.XA, CQ.UBND_XA, T1, MUC_DO.TT],
  /*  17 */ ["2.000424", "Thủ tục thực hiện hỗ trợ khi hòa giải viên gặp tai nạn hoặc rủi ro ảnh hưởng đến sức khỏe, tính mạng trong khi thực hiện hoạt động hòa giải ở cơ sở", DT.CD, LV.HGCS, CAP.XA, CQ.UBND_XA, T1, MUC_DO.TT],

  // ---- Hỗ trợ pháp lý DNNVV / Thi hành án dân sự (18–19) -------------------
  /*  18 */ ["1.005464", "Đề nghị hỗ trợ chi phí tư vấn pháp luật cho doanh nghiệp nhỏ và vừa", DT.DN, LV.HTPL_DN, CAP.TINH, CQ.UBND_TINH, T1, MUC_DO.TT],
  /*  19 */ ["1.003091", "Yêu cầu thi hành án dân sự (cấp tỉnh)", DT.CD_NN_CBCC, LV.THADS, CAP.TINH, CQ.THADS, T1, MUC_DO.TT],

  // ---- Thừa phát lại (20–36) ----------------------------------------------
  /*  20 */ ["1.008936", "Chuyển nhượng Văn phòng Thừa phát lại", DT.TC, LV.TPL, CAP.TINH, CQ.UBND_TINH_STP, T1, MUC_DO.TT],
  /*  21 */ ["1.008934", "Hợp nhất, sáp nhập Văn phòng Thừa phát lại", DT.TC, LV.TPL, CAP.TINH, CQ.UBND_TINH_STP, T1, MUC_DO.TT],
  /*  22 */ ["1.008932", "Chuyển đổi loại hình hoạt động Văn phòng Thừa phát lại", DT.TC, LV.TPL, CAP.TINH, CQ.UBND_TINH_STP, T1, MUC_DO.TT],
  /*  23 */ ["1.008937", "Thay đổi nội dung đăng ký hoạt động sau khi chuyển nhượng Văn phòng Thừa phát lại", DT.TC, LV.TPL, CAP.TINH, CQ.STP, T1, MUC_DO.TT],
  /*  24 */ ["1.008935", "Đăng ký hoạt động, thay đổi nội dung đăng ký hoạt động sau khi hợp nhất, sáp nhập Văn phòng Thừa phát lại", DT.TC, LV.TPL, CAP.TINH, CQ.STP, T1, MUC_DO.TT],
  /*  25 */ ["1.008933", "Đăng ký hoạt động sau khi chuyển đổi loại hình hoạt động Văn phòng Thừa phát lại", DT.TC, LV.TPL, CAP.TINH, CQ.STP, T1, MUC_DO.TT],
  /*  26 */ ["1.008931", "Thay đổi nội dung đăng ký hoạt động của Văn phòng Thừa phát lại", DT.TC, LV.TPL, CAP.TINH, CQ.STP, T1, MUC_DO.TT],
  /*  27 */ ["1.008930", "Đăng ký hoạt động Văn phòng Thừa phát lại", DT.TC, LV.TPL, CAP.TINH, CQ.STP, T1, MUC_DO.TT],
  /*  28 */ ["1.008929", "Thành lập Văn phòng Thừa phát lại", DT.CD, LV.TPL, CAP.TINH, CQ.UBND_TINH_STP, T1, MUC_DO.TT],
  /*  29 */ ["1.008926", "Thay đổi nơi tập sự hành nghề Thừa phát lại", DT.CD, LV.TPL, CAP.TINH, CQ.STP, T1, MUC_DO.TT],
  /*  30 */ ["1.008924", "Bổ nhiệm lại Thừa phát lại", DT.CD, LV.TPL, CAP.TINH, CQ.UBND_TINH_STP, T1, MUC_DO.TT],
  /*  31 */ ["1.008923", "Miễn nhiệm Thừa phát lại (trường hợp được miễn nhiệm)", DT.CD, LV.TPL, CAP.TINH, CQ.UBND_TINH_STP, T1, MUC_DO.TT],
  /*  32 */ ["1.008922", "Bổ nhiệm Thừa phát lại", DT.CD, LV.TPL, CAP.TINH, CQ.UBND_TINH_STP, T1, MUC_DO.TT],
  /*  33 */ ["1.008928", "Cấp lại Thẻ Thừa phát lại", DT.CD, LV.TPL, CAP.TINH, CQ.STP, T1, MUC_DO.TT],
  /*  34 */ ["1.008927", "Đăng ký hành nghề và cấp Thẻ Thừa phát lại", DT.TC, LV.TPL, CAP.TINH, CQ.STP, T1, MUC_DO.TT],
  /*  35 */ ["1.008925", "Đăng ký tập sự hành nghề Thừa phát lại", DT.CD, LV.TPL, CAP.TINH, CQ.STP, T1, MUC_DO.TT],
  /*  36 */ ["1.008921", "Công nhận tương đương đào tạo nghề Thừa phát lại ở nước ngoài", DT.CD, LV.TPL, CAP.TINH, CQ.UBND_TINH_STP, T1, MUC_DO.TT],

  // ---- Hộ tịch (37) --------------------------------------------------------
  /*  37 */ ["2.000635", "Cấp bản sao Trích lục hộ tịch, bản sao Giấy khai sinh", DT.CN_TC, LV.HO_TICH, CAP.TINH_XA, CQ.UBND_XA_STP, T1, MUC_DO.TT],

  // ---- Luật sư (38–64) -----------------------------------------------------
  /*  38 */ ["1.008709", "Chuyển đổi công ty luật trách nhiệm hữu hạn và công ty luật hợp danh, chuyển đổi văn phòng luật sư thành công ty luật", DT.TC, LV.LUAT_SU, CAP.TINH, CQ.STP, T2, MUC_DO.TT],
  /*  39 */ ["1.008628", "Cấp lại Chứng chỉ hành nghề luật sư trong trường hợp bị mất, bị rách, bị cháy hoặc vì lý do khác không cố ý", DT.CD, LV.LUAT_SU, CAP.TINH, CQ.CT_TINH, T2, MUC_DO.TT],
  /*  40 */ ["1.008624", "Cấp lại Chứng chỉ hành nghề luật sư trong trường hợp bị thu hồi Chứng chỉ hành nghề luật sư theo quy định tại Điều 18 của Luật Luật sư", DT.CD, LV.LUAT_SU, CAP.TINH, CQ.CT_TINH, T2, MUC_DO.TT],
  /*  41 */ ["1.008614", "Thu hồi chứng chỉ hành nghề luật sư", DT.CD, LV.LUAT_SU, CAP.TINH, CQ.CT_TINH, T2, MUC_DO.TT],
  /*  42 */ ["1.002943", "Chấm dứt hoạt động của chi nhánh, công ty luật nước ngoài trong trường hợp tự chấm dứt hoạt động", DT.FDI_TCNN, LV.LUAT_SU, CAP.BO, CQ.CUC_BTTP, T2, MUC_DO.TT],
  /*  43 */ ["1.002697", "Gia hạn Giấy phép hành nghề luật sư tại Việt Nam cho luật sư nước ngoài", DT.CD_NN_NNG, LV.LUAT_SU, CAP.BO, CQ.CUC_BTTP, T2, MUC_DO.TT],
  /*  44 */ ["1.002528", "Thay đổi nội dung giấy phép thành lập của chi nhánh, công ty luật nước ngoài tại Việt Nam", DT.TC, LV.LUAT_SU, CAP.BO, CQ.CUC_BTTP, T2, MUC_DO.TT],
  /*  45 */ ["1.002398", "Đăng ký hoạt động của công ty luật Việt Nam chuyển đổi từ công ty luật nước ngoài", DT.FDI_TCNN, LV.LUAT_SU, CAP.TINH, CQ.STP, T2, MUC_DO.TT],
  /*  46 */ ["1.002384", "Đăng ký hoạt động của chi nhánh của công ty luật nước ngoài tại Việt Nam", DT.TCNN, LV.LUAT_SU, CAP.TINH, CQ.STP, T2, MUC_DO.TT],
  /*  47 */ ["1.002368", "Cấp lại Giấy đăng ký hoạt động của chi nhánh, công ty luật nước ngoài", DT.TC, LV.LUAT_SU, CAP.TINH, CQ.STP, T2, MUC_DO.TT],
  /*  48 */ ["1.002234", "Sáp nhập công ty luật", DT.DN_FDI, LV.LUAT_SU, CAP.TINH, CQ.STP, T2, MUC_DO.TT],
  /*  49 */ ["1.002218", "Hợp nhất công ty luật", DT.DN_FDI, LV.LUAT_SU, CAP.TINH, CQ.STP, T2, MUC_DO.TT],
  /*  50 */ ["1.002198", "Thay đổi nội dung Giấy đăng ký hoạt động của chi nhánh, công ty luật nước ngoài", DT.TC, LV.LUAT_SU, CAP.TINH, CQ.STP, T2, MUC_DO.TT],
  /*  51 */ ["1.002181", "Đăng ký hoạt động của chi nhánh, công ty luật nước ngoài", DT.TC, LV.LUAT_SU, CAP.TINH, CQ.STP, T2, MUC_DO.TT],
  /*  52 */ ["1.002153", "Đăng ký hành nghề luật sư với tư cách cá nhân", DT.CD_NN_CBCC, LV.LUAT_SU, CAP.TINH, CQ.STP, T2, MUC_DO.TT],
  /*  53 */ ["1.002099", "Đăng ký hoạt động của chi nhánh của tổ chức hành nghề luật sư", DT.TC, LV.LUAT_SU, CAP.TINH, CQ.STP, T2, MUC_DO.TT],
  /*  54 */ ["1.002079", "Thay đổi người đại diện theo pháp luật của công ty luật trách nhiệm hữu hạn hai thành viên trở lên, công ty luật hợp danh", DT.DN, LV.LUAT_SU, CAP.TINH, CQ.STP, T2, MUC_DO.TT],
  /*  55 */ ["1.002055", "Thay đổi người đại diện theo pháp luật của Văn phòng luật sư, công ty luật trách nhiệm hữu hạn một thành viên", DT.TC, LV.LUAT_SU, CAP.TINH, CQ.STP, T2, MUC_DO.TT],
  /*  56 */ ["1.002032", "Thay đổi nội dung đăng ký hoạt động của tổ chức hành nghề luật sư", DT.TC, LV.LUAT_SU, CAP.TINH, CQ.STP, T2, MUC_DO.TT],
  /*  57 */ ["1.00201", "Đăng ký hoạt động của tổ chức hành nghề luật sư", DT.TC, LV.LUAT_SU, CAP.TINH, CQ.STP, T2, MUC_DO.TT],
  /*  58 */ ["2.000885", "Cấp Giấy phép thành lập chi nhánh của công ty luật nước ngoài tại Việt Nam", DT.DN_FDI_TC_HTX, LV.LUAT_SU, CAP.BO, CQ.CUC_BTTP, T2, MUC_DO.TT],
  /*  59 */ ["1.001993", "Cấp lại Giấy phép hành nghề tại Việt Nam của luật sư nước ngoài", DT.CD_NN_CBCC, LV.LUAT_SU, CAP.BO, CQ.CUC_BTTP, T2, MUC_DO.MP],
  /*  60 */ ["1.001979", "Cấp lại Giấy phép thành lập chi nhánh, công ty luật nước ngoài", DT.TC, LV.LUAT_SU, CAP.BO, CQ.CUC_BTTP, T2, MUC_DO.TT],
  /*  61 */ ["2.000851", "Cấp giấy phép thành lập Công ty luật nước ngoài", DT.DN_FDI_TC_HTX, LV.LUAT_SU, CAP.BO, CQ.CUC_BTTP, T2, MUC_DO.MP],
  /*  62 */ ["1.001928", "Công nhận đào tạo nghề luật sư ở nước ngoài", DT.CD_NN, LV.LUAT_SU, CAP.TINH, CQ.CT_TINH, T2, MUC_DO.TT],
  /*  63 */ ["1.000828", "Cấp Chứng chỉ hành nghề luật sư đối với người đạt yêu cầu kiểm tra kết quả tập sự hành nghề luật sư", DT.CD, LV.LUAT_SU, CAP.TINH, CQ.CT_TINH, T2, MUC_DO.TT],
  /*  64 */ ["1.000688", "Cấp Chứng chỉ hành nghề luật sư đối với người được miễn đào tạo nghề luật sư, miễn tập sự hành nghề luật sư", DT.CD, LV.LUAT_SU, CAP.TINH, CQ.CT_TINH, T2, MUC_DO.TT],

  // ---- Quản tài viên (65) --------------------------------------------------
  /*  65 */ ["1.0016", "Thay đổi thông tin đăng ký hành nghề của Quản tài viên", DT.CD, LV.QTV, CAP.TINH, CQ.STP, T2, MUC_DO.TT],

  // ---- Tư vấn pháp luật (66–71) -------------------------------------------
  /*  66 */ ["1.000627", "Đăng ký hoạt động của Trung tâm tư vấn pháp luật", DT.TC, LV.TVPL, CAP.TINH, CQ.STP, T2, MUC_DO.TT],
  /*  67 */ ["1.000614", "Đăng ký hoạt động cho chi nhánh của Trung tâm tư vấn pháp luật", DT.TC, LV.TVPL, CAP.TINH, CQ.STP, T2, MUC_DO.TT],
  /*  68 */ ["1.000588", "Thay đổi nội dung đăng ký hoạt động của Trung tâm tư vấn pháp luật, chi nhánh", DT.TC, LV.TVPL, CAP.TINH, CQ.STP, T2, MUC_DO.TT],
  /*  69 */ ["1.000426", "Cấp thẻ tư vấn viên pháp luật", DT.CD_CBCC, LV.TVPL, CAP.TINH, CQ.STP, T2, MUC_DO.TT],
  /*  70 */ ["1.000404", "Thu hồi thẻ tư vấn viên pháp luật", DT.TC, LV.TVPL, CAP.TINH, CQ.STP, T2, MUC_DO.TT],
  /*  71 */ ["1.00039", "Cấp lại thẻ tư vấn viên pháp luật", "Công dân Việt Nam; Cán bộ, công chức, viên chức; Tổ chức (không bao gồm doanh nghiệp, HTX)", LV.TVPL, CAP.TINH, CQ.STP, T2, MUC_DO.TT],

  // ---- Chứng thực (72–83) --------------------------------------------------
  /*  72 */ ["2.001406", "Chứng thực văn bản phân chia di sản mà di sản là động sản, quyền sử dụng đất, nhà ở", DT.CN_TC, LV.CHUNG_THUC, CAP.XA, CQ.UBND_XA, T3, MUC_DO.MP],
  /*  73 */ ["2.001035", "Chứng thực giao dịch liên quan đến tài sản là động sản, quyền sử dụng đất, nhà ở", DT.CN_TC, LV.CHUNG_THUC, CAP.XA, CQ.UBND_XA, T3, MUC_DO.MP],
  /*  74 */ ["2.001019", "Chứng thực di chúc", DT.CN, LV.CHUNG_THUC, CAP.XA, CQ.UBND_XA, T3, MUC_DO.MP],
  /*  75 */ ["2.001016", "Chứng thực văn bản từ chối nhận di sản", DT.CN_TC, LV.CHUNG_THUC, CAP.XA, CQ.UBND_XA, T3, MUC_DO.MP],
  /*  76 */ ["2.001008", "Chứng thực chữ ký người dịch mà người dịch không phải là cộng tác viên dịch thuật của Ủy ban nhân dân cấp xã, tổ chức hành nghề công chứng", DT.CN, LV.CHUNG_THUC, CAP.XA_KHAC, CQ.UBND_XA, T3, MUC_DO.KHONG],
  /*  77 */ ["2.000992", "Chứng thực chữ ký người dịch mà người dịch là cộng tác viên dịch thuật của Ủy ban nhân dân cấp xã, tổ chức hành nghề công chứng", DT.CN, LV.CHUNG_THUC, CAP.XA_KHAC, CQ.UBND_XA, T3, MUC_DO.KHONG],
  /*  78 */ ["2.000942", "Thủ tục cấp bản sao có chứng thực từ bản chính giao dịch đã được chứng thực", DT.CN_TC, LV.CHUNG_THUC, CAP.XA, CQ.UBND_XA, T3, MUC_DO.KHONG],
  /*  79 */ ["2.000927", "Sửa lỗi sai sót trong giao dịch", DT.CN_TC, LV.CHUNG_THUC, CAP.XA, CQ.UBND_XA, T3, MUC_DO.TT],
  /*  80 */ ["2.000913", "Chứng thực việc sửa đổi, bổ sung, hủy bỏ giao dịch", DT.CN_TC, LV.CHUNG_THUC, CAP.XA, CQ.UBND_XA, T3, MUC_DO.MP],
  /*  81 */ ["2.000908", "Thủ tục cấp bản sao từ sổ gốc", DT.CN_TC, LV.CHUNG_THUC, CAP.BO_TINH_XA_KHAC, CQ.SO_GOC, T3, MUC_DO.TT],
  /*  82 */ ["2.000884", "Thủ tục chứng thực chữ ký trong các giấy tờ, văn bản (áp dụng cho cả trường hợp chứng thực điểm chỉ và trường hợp người yêu cầu chứng thực không thể ký, không thể điểm chỉ được)", DT.CN, LV.CHUNG_THUC, CAP.XA_KHAC, CQ.CT_CHU_KY, T3, MUC_DO.KHONG],
  /*  83 */ ["2.000815", "Chứng thực bản sao từ bản chính giấy tờ, văn bản do cơ quan, tổ chức có thẩm quyền của Việt Nam; cơ quan, tổ chức có thẩm quyền của nước ngoài; cơ quan, tổ chức có thẩm quyền của Việt Nam liên kết với cơ quan, tổ chức có thẩm quyền của nước ngoài cấp hoặc chứng nhận", DT.CN_TC, LV.CHUNG_THUC, CAP.XA_KHAC, CQ.CT_BAN_SAO, T3, MUC_DO.KHONG],

  // ---- Công chứng (84–112) -------------------------------------------------
  /*  84 */ ["1.013859", "Cấp thẻ công chứng viên", DT.TC, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /*  85 */ ["1.013856", "Công nhận Điều lệ của Văn phòng công chứng được thành lập trước ngày 01/7/2025", DT.VPCC, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /*  86 */ ["1.013849", "Chuyển đổi Văn phòng công chứng theo loại hình doanh nghiệp tư nhân thành Văn phòng công chứng theo loại hình công ty hợp danh", DT.VPCC_DNTN, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /*  87 */ ["1.013852", "Bán Văn phòng công chứng theo loại hình doanh nghiệp tư nhân", DT.VPCC_DNTN, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /*  88 */ ["1.013846", "Chuyển nhượng toàn bộ phần vốn góp của toàn bộ thành viên hợp danh của Văn phòng công chứng", DT.CCV_HD, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /*  89 */ ["1.01384", "Đăng ký hoạt động Văn phòng công chứng hợp nhất", DT.VPCC, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /*  90 */ ["1.013848", "Thay đổi nội dung đăng ký hoạt động của Văn phòng công chứng nhận chuyển nhượng vốn góp", DT.VPCC_NHAN_CN, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /*  91 */ ["1.013836", "Thay đổi nội dung đăng ký hoạt động của Văn phòng công chứng", DT.TC, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /*  92 */ ["1.013853", "Thay đổi nội dung đăng ký hoạt động của Văn phòng công chứng được bán", DT.VPCC, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /*  93 */ ["1.013843", "Thay đổi nội dung đăng ký hoạt động của Văn phòng công chứng nhận sáp nhập", DT.VPCC, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /*  94 */ ["1.013832", "Thu hồi Thẻ công chứng viên", DT.TCHN_CC, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /*  95 */ ["1.013842", "Sáp nhập Văn phòng công chứng theo loại hình công ty hợp danh", DT.VPCC_HD, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /*  96 */ ["1.013837", "Cấp lại Giấy đăng ký hoạt động cho Văn phòng công chứng do bị mất, hỏng", DT.VPCC, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /*  97 */ ["1.013834", "Thành lập Văn phòng công chứng", DT.CN, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /*  98 */ ["1.013839", "Hợp nhất Văn phòng công chứng theo loại hình công ty hợp danh", DT.VPCC_HD, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /*  99 */ ["1.013835", "Đăng ký hoạt động Văn phòng công chứng", DT.VPCC, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /* 100 */ ["1.013818", "Đăng ký tham dự kiểm tra kết quả tập sự hành nghề công chứng", DT.CN, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /* 101 */ ["1.01383", "Cấp lại Thẻ công chứng viên", DT.CN, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /* 102 */ ["1.013816", "Chấm dứt tập sự hành nghề công chứng", DT.TCHN_CC, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /* 103 */ ["1.01381", "Thay đổi nơi tập sự hành nghề công chứng từ tổ chức hành nghề công chứng này sang tổ chức hành nghề công chứng khác trong cùng một tỉnh, thành phố trực thuộc Trung ương", DT.CN, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /* 104 */ ["1.013808", "Đăng ký tập sự lại hành nghề công chứng sau khi chấm dứt tập sự hành nghề công chứng", DT.CN, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /* 105 */ ["1.013806", "Công nhận tương đương đối với người được đào tạo nghề công chứng ở nước ngoài", DT.CN, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /* 106 */ ["1.013805", "Miễn nhiệm công chứng viên (trường hợp được miễn nhiệm)", DT.CN, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /* 107 */ ["3.000444", "Công nhận hoàn thành tập sự hành nghề công chứng", DT.CN, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /* 108 */ ["1.013807", "Đăng ký tập sự hành nghề công chứng", DT.CN, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /* 109 */ ["1.013804", "Bổ nhiệm lại công chứng viên", DT.CN, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /* 110 */ ["1.013802", "Phê duyệt Điều lệ Hiệp hội công chứng viên Việt Nam", DT.HH_CCV, LV.CONG_CHUNG, CAP.BO, CQ.BTP, T3, MUC_DO.MP],
  /* 111 */ ["1.013812", "Thay đổi nơi tập sự hành nghề công chứng từ tổ chức hành nghề công chứng tại tỉnh, thành phố trực thuộc Trung ương này sang tổ chức hành nghề công chứng tại tỉnh, thành phố trực thuộc Trung ương khác", DT.CN, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /* 112 */ ["1.013803", "Bổ nhiệm công chứng viên", DT.CN, LV.CONG_CHUNG, CAP.TINH, CQ.STP, T3, MUC_DO.TT],

  // ---- Đấu giá tài sản (113–122) ------------------------------------------
  /* 113 */ ["1.013635", "Cấp lại Giấy đăng ký hoạt động của chi nhánh doanh nghiệp đấu giá tài sản", DT.DN, LV.DGTS, CAP.TINH, CQ.STP, T3, MUC_DO.MP],
  /* 114 */ ["1.013634", "Thay đổi nội dung đăng ký hoạt động của chi nhánh doanh nghiệp đấu giá tài sản", DT.DN, LV.DGTS, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /* 115 */ ["2.002139", "Đăng ký tham dự kiểm tra kết quả tập sự hành nghề đấu giá tài sản", DT.CD, LV.DGTS, CAP.TINH, CQ.STP, T3, MUC_DO.MP],
  /* 116 */ ["1.003915", "Thủ tục cấp Chứng chỉ hành nghề đấu giá", DT.CD, LV.DGTS, CAP.TINH, CQ.STP, T3, MUC_DO.MP],
  /* 117 */ ["2.001395", "Đăng ký hoạt động của doanh nghiệp đấu giá tài sản", DT.DN, LV.DGTS, CAP.TINH, CQ.STP, T3, MUC_DO.MP],
  /* 118 */ ["2.001333", "Thay đổi nội dung đăng ký hoạt động của doanh nghiệp đấu giá tài sản", DT.DN, LV.DGTS, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /* 119 */ ["2.001258", "Cấp lại Giấy đăng ký hoạt động của doanh nghiệp đấu giá tài sản", DT.DN, LV.DGTS, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /* 120 */ ["2.001247", "Đăng ký hoạt động của Chi nhánh doanh nghiệp đấu giá tài sản", DT.DN, LV.DGTS, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /* 121 */ ["2.001225", "Phê duyệt Trang thông tin đấu giá trực tuyến", DT.DN, LV.DGTS, CAP.TINH, CQ.STP, T3, MUC_DO.MP],
  /* 122 */ ["1.000802", "Cấp lại Chứng chỉ hành nghề đấu giá", DT.CD_NN, LV.DGTS, CAP.TINH, CQ.STP, T3, MUC_DO.MP],

  // ---- Giám định tư pháp (123–134) ----------------------------------------
  /* 123 */ ["1.009832", "Cấp lại thẻ giám định viên tư pháp cấp tỉnh", DT.CD, LV.GDTP, CAP.TINH, CQ.CT_TINH, T3, MUC_DO.TT],
  /* 124 */ ["1.009831", "Cấp lại thẻ giám định viên tư pháp cấp Trung ương", DT.CD, LV.GDTP, CAP.BO, CQ.BO_NGANG_BO, T3, MUC_DO.TT],
  /* 125 */ ["2.000894", "Miễn nhiệm giám định viên tư pháp cấp tỉnh", DT.CD, LV.GDTP, CAP.TINH, CQ.UBND_TINH, T3, MUC_DO.TT],
  /* 126 */ ["2.00089", "Cấp phép thành lập văn phòng giám định tư pháp", DT.CD, LV.GDTP, CAP.TINH, CQ.STP, T3, MUC_DO.MP],
  /* 127 */ ["2.000823", "Đăng ký hoạt động văn phòng giám định tư pháp", DT.TC, LV.GDTP, CAP.TINH, CQ.STP, T3, MUC_DO.MP],
  /* 128 */ ["1.001216", "Chuyển đổi loại hình Văn phòng giám định tư pháp cấp tỉnh", DT.DN, LV.GDTP, CAP.TINH, CQ.CT_TINH, T3, MUC_DO.MP],
  /* 129 */ ["2.000581", "Bổ nhiệm và cấp thẻ giám định viên tư pháp", DT.CD_NN_CBCC, LV.GDTP, CAP.BO, CQ.BO_TRUONG, T3, MUC_DO.MP],
  /* 130 */ ["1.001162", "Miễn nhiệm giám định viên tư pháp", DT.CD_CBCC, LV.GDTP, CAP.BO, CQ.BO_TRUONG, T3, MUC_DO.TT],
  /* 131 */ ["2.000568", "Thay đổi, bổ sung lĩnh vực giám định của Văn phòng giám định tư pháp", DT.DN_FDI_TC_HTX, LV.GDTP, CAP.TINH, CQ.UBND_TINH, T3, MUC_DO.MP],
  /* 132 */ ["2.000555", "Cấp lại Giấy đăng ký hoạt động của Văn phòng giám định tư pháp trong trường hợp thay đổi tên gọi, địa chỉ trụ sở, người đại diện theo pháp luật, danh sách thành viên hợp danh của Văn phòng giám định tư pháp", DT.DN_FDI_TC_HTX, LV.GDTP, CAP.TINH, CQ.STP, T3, MUC_DO.MP],
  /* 133 */ ["1.001122", "Bổ nhiệm và cấp thẻ giám định viên tư pháp cấp tỉnh", DT.CD_NN_CBCC, LV.GDTP, CAP.TINH, CQ.UBND_TINH, T3, MUC_DO.MP],
  /* 134 */ ["1.001117", "Cấp lại Giấy đăng ký hoạt động của Văn phòng giám định tư pháp trong trường hợp Giấy đăng ký hoạt động bị hư hỏng hoặc bị mất", DT.DN_FDI_TC_HTX, LV.GDTP, CAP.TINH, CQ.STP, T3, MUC_DO.TT],

  // ---- Hòa giải thương mại (135–147) --------------------------------------
  /* 135 */ ["1.009284", "Đăng ký làm hòa giải viên thương mại vụ việc", DT.CD, LV.HGTM, CAP.TINH, CQ.STP, T3, MUC_DO.MP],
  /* 136 */ ["1.009283", "Chấm dứt hoạt động của chi nhánh, văn phòng đại diện của tổ chức hòa giải thương mại nước ngoài tại Việt Nam trong trường hợp chi nhánh, văn phòng đại diện chấm dứt hoạt động theo quyết định của tổ chức hòa giải thương mại nước ngoài hoặc tổ chức hòa giải thương mại nước ngoài thành lập chi nhánh, văn phòng đại diện tại Việt Nam chấm dứt hoạt động ở nước ngoài (cấp tỉnh)", DT.TCNN, LV.HGTM, CAP.TINH, CQ.CT_TINH_STP, T3, MUC_DO.TT],
  /* 137 */ ["1.008916", "Thay đổi tên gọi, Trưởng chi nhánh, địa chỉ trụ sở sang tỉnh, thành phố trực thuộc trung ương khác của chi nhánh tổ chức hòa giải thương mại nước ngoài tại Việt Nam; đăng ký hoạt động của chi nhánh tổ chức hoà giải thương mại nước ngoài tại Việt Nam khi thay đổi tên gọi, Trưởng chi nhánh", DT.TCNN, LV.HGTM, CAP.TINH, CQ.CT_TINH_STP, T3, MUC_DO.TT],
  /* 138 */ ["1.008915", "Đăng ký hoạt động của chi nhánh tổ chức hòa giải thương mại nước ngoài tại Việt Nam sau khi được cấp Giấy phép thành lập", DT.TCNN, LV.HGTM, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /* 139 */ ["1.008914", "Cấp lại Giấy đăng ký hoạt động Trung tâm hòa giải thương mại, chi nhánh Trung tâm hòa giải thương mại, Giấy đăng ký hoạt động của chi nhánh tổ chức hòa giải thương mại nước ngoài tại Việt Nam", DT.TC, LV.HGTM, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /* 140 */ ["1.00891", "Thay đổi tên gọi, địa chỉ trụ sở Trung tâm hòa giải thương mại sang tỉnh, thành phố trực thuộc Trung ương khác; đăng ký hoạt động Trung tâm hoà giải thương mại khi thay đổi địa chỉ trụ sở sang tỉnh, thành phố trực thuộc trung ương khác", DT.TC_TCNN, LV.HGTM, CAP.TINH, CQ.CT_TINH_STP, T3, MUC_DO.MP],
  /* 141 */ ["1.008909", "Bổ sung hoạt động hòa giải thương mại cho Trung tâm trọng tài", DT.TC, LV.HGTM, CAP.TINH, CQ.CT_TINH_STP, T3, MUC_DO.MP],
  /* 142 */ ["1.008908", "Cấp lại Giấy phép thành lập Trung tâm hòa giải thương mại, Giấy phép thành lập chi nhánh, văn phòng đại diện của tổ chức hòa giải thương mại nước ngoài tại Việt Nam", DT.TC_TCNN, LV.HGTM, CAP.TINH, CQ.CT_TINH_STP, T3, MUC_DO.TT],
  /* 143 */ ["1.008913", "Đăng ký hoạt động Trung tâm hòa giải thương mại sau khi được cấp Giấy phép thành lập", DT.TC, LV.HGTM, CAP.TINH, CQ.STP, T3, MUC_DO.MP],
  /* 144 */ ["1.008911", "Cấp Giấy phép thành lập chi nhánh/văn phòng đại diện của tổ chức hòa giải thương mại nước ngoài tại Việt Nam", DT.TCNN, LV.HGTM, CAP.TINH, CQ.CT_TINH_STP, T3, MUC_DO.MP],
  /* 145 */ ["1.008907", "Cấp Giấy phép thành lập Trung tâm hòa giải thương mại", DT.CD_CBCC, LV.HGTM, CAP.TINH, CQ.CT_TINH_STP, T3, MUC_DO.MP],
  /* 146 */ ["2.001716", "Đăng ký hoạt động của Chi nhánh Trung tâm hòa giải thương mại", DT.TC, LV.HGTM, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /* 147 */ ["2.000515", "Chấm dứt hoạt động Trung tâm hòa giải thương mại trong trường hợp Trung tâm hòa giải thương mại tự chấm dứt hoạt động", DT.TC, LV.HGTM, CAP.TINH, CQ.STP_CT_TINH, T3, MUC_DO.TT],

  // ---- Luật sư — đợt 30/3 (148–154) ---------------------------------------
  /* 148 */ ["1.002911", "Cấp Giấy phép hành nghề tại Việt Nam của luật sư nước ngoài", DT.CD_NN_NNG, LV.LUAT_SU, CAP.BO, CQ.CUC_BTTP, T3, MUC_DO.MP],
  /* 149 */ ["1.002676", "Thành lập cơ sở đào tạo nghề luật sư của Liên đoàn luật sư Việt Nam", DT.TC, LV.LUAT_SU, CAP.BO, CQ.BTP, T3, MUC_DO.TT],
  /* 150 */ ["1.002649", "Chuyển đổi công ty luật nước ngoài thành công ty luật Việt Nam", DT.TCNN, LV.LUAT_SU, CAP.BO, CQ.CUC_BTTP, T3, MUC_DO.TT],
  /* 151 */ ["1.002637", "Chuyển đổi chi nhánh của tổ chức hành nghề luật sư nước ngoài thành công ty luật trách nhiệm hữu hạn 100% vốn nước ngoài tại Việt Nam", DT.TCNN, LV.LUAT_SU, CAP.BO, CQ.CUC_BTTP, T3, MUC_DO.TT],
  /* 152 */ ["1.002563", "Sáp nhập công ty luật nước ngoài", DT.TCNN, LV.LUAT_SU, CAP.BO, CQ.CUC_BTTP, T3, MUC_DO.MP],
  /* 153 */ ["1.002544", "Hợp nhất công ty luật nước ngoài", DT.TCNN, LV.LUAT_SU, CAP.BO, CQ.CUC_BTTP, T3, MUC_DO.MP],
  /* 154 */ ["2.000854", "Cấp Giấy phép thành lập chi nhánh của tổ chức hành nghề luật sư nước ngoài tại Việt Nam", DT.DN_FDI_TC_HTX, LV.LUAT_SU, CAP.BO, CQ.CUC_BTTP, T3, MUC_DO.MP],

  // ---- Quản tài viên (155–161) --------------------------------------------
  /* 155 */ ["1.008727", "Thay đổi thành viên hợp danh của công ty hợp danh hoặc thay đổi chủ doanh nghiệp tư nhân của doanh nghiệp quản lý, thanh lý tài sản", DT.TC, LV.QTV, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /* 156 */ ["2.00113", "Cấp Chứng chỉ hành nghề Quản tài viên đối với luật sư, kiểm toán viên, người có trình độ cử nhân luật, kinh tế, kế toán, tài chính, ngân hàng và có thời gian công tác trong lĩnh vực được đào tạo từ 05 năm trở lên", DT.CD_NN_CBCC, LV.QTV, CAP.TINH, CQ.CT_TINH_STP, T3, MUC_DO.TT],
  /* 157 */ ["1.002681", "Cấp chứng chỉ hành nghề Quản tài viên đối với luật sư nước ngoài đã được cấp Giấy phép hành nghề luật sư tại Việt Nam theo quy định của pháp luật về luật sư, kiểm toán viên là người nước ngoài theo quy định của pháp luật về kiểm toán", DT.NNG, LV.QTV, CAP.TINH, CQ.STP_CT_TINH, T3, MUC_DO.TT],
  /* 158 */ ["2.001117", "Cấp lại chứng chỉ hành nghề Quản tài viên", DT.CD_NN_NNG_CBCC, LV.QTV, CAP.TINH, CQ.CT_TINH_STP, T3, MUC_DO.TT],
  /* 159 */ ["1.002626", "Đăng ký hành nghề quản lý, thanh lý tài sản với tư cách cá nhân", DT.CD_NN_CBCC, LV.QTV, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /* 160 */ ["1.001842", "Đăng ký hành nghề quản lý, thanh lý tài sản đối với doanh nghiệp quản lý, thanh lý tài sản", DT.TC, LV.QTV, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /* 161 */ ["1.001633", "Thay đổi tên, địa chỉ trụ sở, văn phòng đại diện, chi nhánh, người đại diện theo pháp luật, danh sách Quản tài viên hành nghề trong doanh nghiệp quản lý, thanh lý tài sản", DT.CD_NN_CBCC, LV.QTV, CAP.TINH, CQ.STP, T3, MUC_DO.TT],

  // ---- Trọng tài thương mại (162–174) -------------------------------------
  /* 162 */ ["1.008905", "Thay đổi nội dung Giấy đăng ký hoạt động của Chi nhánh Trung tâm trọng tài khi thay đổi Trưởng Chi nhánh, địa điểm đặt trụ sở của Chi nhánh trong phạm vi tỉnh, thành phố trực thuộc trung ương", DT.TC, LV.TTTM, CAP.TINH, CQ.STP, T3, MUC_DO.MP],
  /* 163 */ ["1.008906", "Đăng ký hoạt động Chi nhánh của Tổ chức trọng tài nước ngoài tại Việt Nam sau khi được cấp Giấy phép thành lập; đăng ký hoạt động Chi nhánh của Tổ chức trọng tài nước ngoài tại Việt Nam trong trường hợp chuyển địa điểm trụ sở sang tỉnh, thành phố trực thuộc trung ương khác", DT.TCNN, LV.TTTM, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /* 164 */ ["1.008904", "Thay đổi nội dung Giấy đăng ký hoạt động của Trung tâm trọng tài; thay đổi nội dung Giấy đăng ký hoạt động của Chi nhánh Tổ chức trọng tài nước ngoài tại Việt Nam", DT.TCNN, LV.TTTM, CAP.TINH, CQ.STP, T3, MUC_DO.MP],
  /* 165 */ ["1.00889", "Đăng ký hoạt động của Chi nhánh Trung tâm trọng tài; đăng ký hoạt động của Chi nhánh Trung tâm trọng tài khi thay đổi địa điểm đặt trụ sở sang tỉnh, thành phố trực thuộc trung ương khác", DT.TC, LV.TTTM, CAP.TINH, CQ.STP, T3, MUC_DO.MP],
  /* 166 */ ["1.008888", "Cấp lại Giấy phép thành lập của Trung tâm trọng tài, Chi nhánh, Văn phòng đại diện của Tổ chức trọng tài nước ngoài tại Việt Nam", DT.TCNN, LV.TTTM, CAP.TINH, CQ.CT_TINH_STP, T3, MUC_DO.TT],
  /* 167 */ ["1.008887", "Chấm dứt hoạt động Chi nhánh, Văn phòng đại diện của Tổ chức trọng tài nước ngoài tại Việt Nam trong trường hợp Chi nhánh, Văn phòng đại diện của Tổ chức trọng tài nước ngoài bị chấm dứt hoạt động theo quyết định của Tổ chức trọng tài nước ngoài hoặc Tổ chức trọng tài nước ngoài thành lập Chi nhánh, Văn phòng đại diện tại Việt Nam đã chấm dứt hoạt động ở nước ngoài", DT.TCNN, LV.TTTM, CAP.TINH, CQ.CT_TINH, T3, MUC_DO.TT],
  /* 168 */ ["1.008886", "Cấp Giấy phép thành lập Chi nhánh, Văn phòng đại diện của Tổ chức trọng tài nước ngoài tại Việt Nam", DT.TCNN, LV.TTTM, CAP.TINH, CQ.CT_TINH_STP, T3, MUC_DO.TT],
  /* 169 */ ["1.008889", "Đăng ký hoạt động Trung tâm trọng tài khi thay đổi địa điểm đặt trụ sở sang tỉnh, thành phố trực thuộc trung ương khác", DT.TC, LV.TTTM, CAP.TINH, CQ.STP, T3, MUC_DO.TT],
  /* 170 */ ["1.008885", "Chấm dứt hoạt động Trung tâm trọng tài theo Điều lệ của Trung tâm trọng tài", DT.TC, LV.TTTM, CAP.TINH, CQ.CT_TINH, T3, MUC_DO.MP],
  /* 171 */ ["2.000822", "Thành lập, đăng ký hoạt động Trung tâm trọng tài", DT.CD_TC, LV.TTTM, CAP.TINH, CQ.CT_TINH_STP, T3, MUC_DO.TT],
  /* 172 */ ["2.000819", "Thay đổi nội dung Giấy phép thành lập của Trung tâm Trọng tài", DT.TC, LV.TTTM, CAP.TINH, CQ.CT_TINH_STP, T3, MUC_DO.TT],
  /* 173 */ ["1.001609", "Thay đổi nội dung Giấy phép thành lập của Chi nhánh của Tổ chức trọng tài nước ngoài tại Việt Nam", DT.TC, LV.TTTM, CAP.TINH, CQ.CT_TINH_STP, T3, MUC_DO.TT],
  /* 174 */ ["1.001248", "Cấp lại Giấy đăng ký hoạt động của Trung tâm trọng tài, Chi nhánh Trung tâm trọng tài, Chi nhánh của Tổ chức trọng tài nước ngoài tại Việt Nam", DT.TT_DN_TCNN, LV.TTTM, CAP.TINH, CQ.STP, T3, MUC_DO.MP],

  // ---- Bồi thường nhà nước (175–181) --------------------------------------
  /* 175 */ ["2.002196", "Xác định cơ quan giải quyết bồi thường (cấp trung ương)", DT.BTNN_TW, LV.BTNN, CAP.BO, CQ.BTP, T3, MUC_DO.MP],
  /* 176 */ ["2.002195", "Giải quyết yêu cầu bồi thường tại cơ quan trực tiếp quản lý người thi hành công vụ gây thiệt hại (cấp trung ương)", DT.BTNN_TW, LV.BTNN, CAP.BO, CQ.BTP, T3, MUC_DO.MP],
  /* 177 */ ["2.002194", "Phục hồi danh dự (cấp trung ương)", DT.BTNN_TW, LV.BTNN, CAP.BO, CQ.BTP, T3, MUC_DO.MP],
  /* 178 */ ["2.002193", "Xác định cơ quan giải quyết bồi thường (cấp tỉnh)", DT.BTNN_TW, LV.BTNN, CAP.TINH, CQ.UBND_TINH_STP, T3, MUC_DO.MP],
  /* 179 */ ["2.002192", "Giải quyết yêu cầu bồi thường tại cơ quan trực tiếp quản lý người thi hành công vụ gây thiệt hại (cấp tỉnh)", DT.BTNN_TINH, LV.BTNN, CAP.TINH, CQ.BTNN_TINH, T3, MUC_DO.MP],
  /* 180 */ ["2.002191", "Phục hồi danh dự (cấp tỉnh)", DT.BTNN_TW, LV.BTNN, CAP.TINH, CQ.BTNN_TINH, T3, MUC_DO.MP],
  /* 181 */ ["2.002165", "Giải quyết yêu cầu bồi thường tại cơ quan trực tiếp quản lý người thi hành công vụ gây thiệt hại (cấp xã)", DT.BTNN_XA, LV.BTNN, CAP.XA, CQ.BTNN_XA, T3, MUC_DO.MP],

  // ---- Đăng ký biện pháp bảo đảm (182–187) --------------------------------
  /* 182 */ ["1.011439", "Cung cấp thông tin về biện pháp bảo đảm bằng động sản (không phải là tàu bay, tàu biển, chứng khoán đã đăng ký tập trung), bằng cây hằng năm, công trình tạm", DT.TC_CN, LV.DKBPBD, CAP.BO, CQ.TT_DKGD, T3, MUC_DO.TT],
  /* 183 */ ["1.011438", "Đăng ký thông báo xử lý tài sản bảo đảm, đăng ký thay đổi, xóa đăng ký thông báo xử lý tài sản bảo đảm là động sản (không phải là tàu bay, tàu biển, chứng khoán đã đăng ký tập trung), là cây hằng năm, công trình tạm", DT.TC_CN, LV.DKBPBD, CAP.BO, CQ.TT_DKGD, T3, MUC_DO.TT],
  /* 184 */ ["1.011437", "Xóa đăng ký biện pháp bảo đảm bằng động sản (không phải là tàu bay, tàu biển, chứng khoán đã đăng ký tập trung), bằng cây hằng năm, công trình tạm", DT.TC_CN, LV.DKBPBD, CAP.BO, CQ.TT_DKGD, T3, MUC_DO.TT],
  /* 185 */ ["1.011436", "Đăng ký thay đổi biện pháp bảo đảm bằng động sản (không phải là tàu bay, tàu biển, chứng khoán đã đăng ký tập trung), bằng cây hằng năm, công trình tạm", DT.TC_CN, LV.DKBPBD, CAP.BO, CQ.TT_DKGD, T3, MUC_DO.TT],
  /* 186 */ ["1.011440", "Cấp bản sao văn bản chứng nhận đăng ký biện pháp bảo đảm bằng động sản (không phải là tàu bay, tàu biển, chứng khoán đã đăng ký tập trung), bằng cây hằng năm, công trình tạm", DT.TC_CN, LV.DKBPBD, CAP.BO, CQ.TT_DKGD, T3, MUC_DO.TT],
  /* 187 */ ["1.011435", "Đăng ký biện pháp bảo đảm bằng động sản (không phải là tàu bay, tàu biển, chứng khoán đã đăng ký tập trung), bằng cây hằng năm, công trình tạm", DT.TC_CN, LV.DKBPBD, CAP.BO, CQ.TT_DKGD, T3, MUC_DO.TT],

  // ---- Hộ tịch (188–227) ---------------------------------------------------
  /* 188 */ ["3.000323", "Đăng ký giám sát việc giám hộ", DT.CN_PN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 189 */ ["3.000322", "Đăng ký chấm dứt giám sát việc giám hộ", DT.CN_PN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 190 */ ["2.002516", "Thủ tục xác nhận thông tin hộ tịch", DT.CQ_TC_CN, LV.HO_TICH, CAP.TINH_XA, CQ.STP_UBND_XA, T4, MUC_DO.TT],
  /* 191 */ ["2.002189", "Thủ tục ghi vào Sổ hộ tịch việc kết hôn của công dân Việt Nam đã được giải quyết tại cơ quan có thẩm quyền của nước ngoài", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 192 */ ["1.005461", "Đăng ký lại khai tử", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 193 */ ["1.004884", "Thủ tục đăng ký lại khai sinh", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 194 */ ["1.004873", "Thủ tục cấp Giấy xác nhận tình trạng hôn nhân", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 195 */ ["1.004859", "Thủ tục thay đổi, cải chính, bổ sung thông tin hộ tịch, xác định lại dân tộc", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 196 */ ["1.004845", "Thủ tục đăng ký chấm dứt giám hộ", DT.CN_PN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 197 */ ["1.004837", "Thủ tục đăng ký giám hộ", DT.CN_PN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 198 */ ["1.004827", "Thủ tục đăng ký khai tử có yếu tố nước ngoài tại khu vực biên giới", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 199 */ ["1.004772", "Thủ tục đăng ký khai sinh cho người đã có hồ sơ, giấy tờ cá nhân", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 200 */ ["1.004746", "Thủ tục đăng ký lại kết hôn", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.MP],
  /* 201 */ ["1.003583", "Thủ tục đăng ký khai sinh lưu động", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.MP],
  /* 202 */ ["2.001023", "Liên thông các thủ tục hành chính về đăng ký khai sinh, cấp Thẻ bảo hiểm y tế cho trẻ em dưới 6 tuổi", DT.CN, LV.HO_TICH, CAP.XA, CQ.LIEN_THONG_KS, T4, MUC_DO.TT],
  /* 203 */ ["2.000986", "Liên thông thủ tục hành chính về đăng ký khai sinh, đăng ký thường trú, cấp thẻ bảo hiểm y tế cho trẻ em dưới 6 tuổi", DT.CN, LV.HO_TICH, CAP.XA, CQ.LIEN_THONG_KS, T4, MUC_DO.TT],
  /* 204 */ ["2.000806", "Thủ tục đăng ký kết hôn có yếu tố nước ngoài", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.MP],
  /* 205 */ ["1.001766", "Thủ tục đăng ký khai tử có yếu tố nước ngoài", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 206 */ ["2.000779", "Thủ tục đăng ký nhận cha, mẹ, con có yếu tố nước ngoài", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 207 */ ["1.001695", "Thủ tục đăng ký khai sinh kết hợp đăng ký nhận cha, mẹ, con có yếu tố nước ngoài", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 208 */ ["1.001669", "Thủ tục đăng ký giám hộ có yếu tố nước ngoài", DT.CN_PN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 209 */ ["2.000756", "Thủ tục đăng ký chấm dứt giám hộ có yếu tố nước ngoài", DT.CN_PN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 210 */ ["2.000748", "Thủ tục thay đổi, cải chính, bổ sung thông tin hộ tịch, xác định lại dân tộc có yếu tố nước ngoài", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 211 */ ["1.001193", "Thủ tục đăng ký khai sinh", DT.CN_TC, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 212 */ ["2.000554", "Thủ tục ghi vào Sổ hộ tịch việc ly hôn, hủy việc kết hôn của công dân Việt Nam đã được giải quyết tại cơ quan có thẩm quyền của nước ngoài", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 213 */ ["2.000547", "Thủ tục ghi vào Sổ hộ tịch việc hộ tịch khác của công dân Việt Nam đã được giải quyết tại cơ quan có thẩm quyền của nước ngoài (khai sinh; giám hộ; nhận cha, mẹ, con; xác định cha, mẹ, con; nuôi con nuôi; khai tử; thay đổi hộ tịch)", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 214 */ ["2.000528", "Thủ tục đăng ký khai sinh có yếu tố nước ngoài", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 215 */ ["2.000522", "Thủ tục đăng ký lại khai sinh có yếu tố nước ngoài", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 216 */ ["2.000513", "Thủ tục đăng ký lại kết hôn có yếu tố nước ngoài", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.MP],
  /* 217 */ ["1.001022", "Thủ tục đăng ký nhận cha, mẹ, con", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 218 */ ["2.000497", "Thủ tục đăng ký lại khai tử có yếu tố nước ngoài", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 219 */ ["1.000894", "Thủ tục đăng ký kết hôn", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.MP],
  /* 220 */ ["1.000893", "Thủ tục đăng ký khai sinh có yếu tố nước ngoài cho người đã có hồ sơ, giấy tờ cá nhân", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 221 */ ["1.000689", "Thủ tục đăng ký khai sinh kết hợp đăng ký nhận cha, mẹ, con", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 222 */ ["1.000656", "Thủ tục đăng ký khai tử", DT.CN_TC, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 223 */ ["1.000593", "Thủ tục đăng ký kết hôn lưu động", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.MP],
  /* 224 */ ["1.000419", "Thủ tục đăng ký khai tử lưu động", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.MP],
  /* 225 */ ["1.000110", "Thủ tục đăng ký khai sinh có yếu tố nước ngoài tại khu vực biên giới", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 226 */ ["1.000094", "Thủ tục đăng ký kết hôn có yếu tố nước ngoài tại khu vực biên giới", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.MP],
  /* 227 */ ["1.000080", "Thủ tục đăng ký nhận cha, mẹ, con có yếu tố nước ngoài tại khu vực biên giới", DT.CN, LV.HO_TICH, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],

  // ---- Nuôi con nuôi (228–240) --------------------------------------------
  /* 228 */ ["2.002363", "Ghi vào Sổ đăng ký nuôi con nuôi việc nuôi con nuôi đã được giải quyết tại cơ quan có thẩm quyền của nước ngoài", DT.CD, LV.NUOI_CON_NUOI, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 229 */ ["2.002349", "Cấp giấy xác nhận công dân Việt Nam thường trú ở khu vực biên giới đủ điều kiện nhận trẻ em của nước láng giềng cư trú ở khu vực biên giới làm con nuôi", DT.CD, LV.NUOI_CON_NUOI, CAP.XA, CQ.UBND_XA, T4, MUC_DO.TT],
  /* 230 */ ["1.005133", "Thủ tục Cấp giấy phép hoạt động của tổ chức con nuôi nước ngoài tại Việt Nam", DT.TCCN_NN, LV.NUOI_CON_NUOI, CAP.BO, CQ.CUC_HCTP, T4, MUC_DO.KHONG],
  /* 231 */ ["1.004878", "Giải quyết việc nuôi con nuôi có yếu tố nước ngoài đối với trường hợp cha dượng, mẹ kế nhận con riêng của vợ hoặc chồng; cô, cậu, dì, chú, bác ruột nhận cháu làm con nuôi", DT.CD_NN, LV.NUOI_CON_NUOI, CAP.TINH, CQ.STP, T4, MUC_DO.MP, "Chỉ thực hiện được nếu đối tượng thực hiện TTHC đủ điều kiện cấp tài khoản truy cập Cổng Dịch vụ công quốc gia."],
  /* 232 */ ["1.003976", "Giải quyết việc nuôi con nuôi có yếu tố nước ngoài đối với trẻ em sống ở cơ sở nuôi dưỡng", DT.NNG_TCNN, LV.NUOI_CON_NUOI, CAP.TINH, CQ.BTP_STP_UBND_TINH, T4, MUC_DO.KHONG],
  /* 233 */ ["1.003236", "Thủ tục Sửa đổi giấy phép hoạt động của tổ chức con nuôi nước ngoài tại Việt Nam", DT.TCNN, LV.NUOI_CON_NUOI, CAP.BO, CQ.CUC_HCTP, T4, MUC_DO.KHONG],
  /* 234 */ ["1.003198", "Cấp giấy xác nhận công dân Việt Nam ở trong nước đủ điều kiện nhận trẻ em nước ngoài làm con nuôi", DT.CD, LV.NUOI_CON_NUOI, CAP.TINH, CQ.UBND_TINH, T4, MUC_DO.TT],
  /* 235 */ ["1.003179", "Đăng ký lại việc nuôi con nuôi có yếu tố nước ngoài", DT.CD_NN_NNG, LV.NUOI_CON_NUOI, CAP.TINH, CQ.STP, T4, MUC_DO.TT, "Chỉ thực hiện được nếu đối tượng thực hiện TTHC đủ điều kiện cấp tài khoản truy cập Cổng Dịch vụ công quốc gia."],
  /* 236 */ ["1.003160", "Giải quyết việc người nước ngoài thường trú ở Việt Nam nhận trẻ em Việt Nam làm con nuôi", DT.NNG, LV.NUOI_CON_NUOI, CAP.TINH, CQ.STP, T4, MUC_DO.KHONG],
  /* 237 */ ["2.001263", "Đăng ký việc nuôi con nuôi trong nước", DT.CD, LV.NUOI_CON_NUOI, CAP.XA, CQ.UBND_XPD, T4, MUC_DO.MP],
  /* 238 */ ["2.001255", "Đăng ký lại việc nuôi con nuôi trong nước", DT.CD, LV.NUOI_CON_NUOI, CAP.XA, CQ.UBND_XPD, T4, MUC_DO.TT],
  /* 239 */ ["1.003005", "Giải quyết việc người nước ngoài cư trú ở khu vực biên giới nước láng giềng nhận trẻ em Việt Nam làm con nuôi", DT.NNG, LV.NUOI_CON_NUOI, CAP.XA, CQ.UBND_XPD, T4, MUC_DO.KHONG],
  /* 240 */ ["1.000532", "Thủ tục Gia hạn giấy phép hoạt động của tổ chức con nuôi nước ngoài tại Việt Nam", DT.TCCN_NN, LV.NUOI_CON_NUOI, CAP.BO, CQ.CUC_HCTP, T4, MUC_DO.KHONG],

  // ---- Quốc tịch (241–248) -------------------------------------------------
  /* 241 */ ["2.002797", "Nhập quốc tịch Việt Nam ở nước ngoài", DT.NNG_KQT, LV.QUOC_TICH, CAP.BO, CQ.BTP_CQDD, T4, MUC_DO.MP],
  /* 242 */ ["1.005141", "Thủ tục thôi quốc tịch Việt Nam ở nước ngoài", DT.CD, LV.QUOC_TICH, CAP.BO, CQ.BTP_CQDD, T4, MUC_DO.TT],
  /* 243 */ ["2.002039", "Nhập quốc tịch Việt Nam ở trong nước", DT.NNG_KQT, LV.QUOC_TICH, CAP.TINH, CQ.BTP_STP, T4, MUC_DO.MP],
  /* 244 */ ["2.002038", "Trở lại quốc tịch Việt Nam ở trong nước", DT.NNG_KQT_CU, LV.QUOC_TICH, CAP.TINH, CQ.BTP_STP, T4, MUC_DO.TT],
  /* 245 */ ["2.002036", "Thôi quốc tịch Việt Nam ở trong nước", DT.CD, LV.QUOC_TICH, CAP.TINH, CQ.BTP_STP, T4, MUC_DO.TT],
  /* 246 */ ["1.005136", "Cấp Giấy xác nhận có quốc tịch Việt Nam ở trong nước", DT.QT_XN, LV.QUOC_TICH, CAP.TINH, CQ.STP, T4, MUC_DO.TT],
  /* 247 */ ["2.001895", "Thủ tục cấp Giấy xác nhận là người gốc Việt Nam", DT.NNG_KQT, LV.QUOC_TICH, CAP.BO_TINH, CQ.STP_CQDD, T4, MUC_DO.TT],
  /* 248 */ ["1.004757", "Thủ tục trở lại quốc tịch Việt Nam ở nước ngoài", DT.NNG_KQT_CU, LV.QUOC_TICH, CAP.BO, CQ.BTP_CQDD, T4, MUC_DO.TT],

  // ---- Thi hành án dân sự (249–253) ---------------------------------------
  /* 249 */ ["1.003201", "Yêu cầu thay đổi Chấp hành viên (cấp tỉnh)", DT.CD_TC, LV.THADS, CAP.TINH, CQ.THADS, T5, MUC_DO.MP],
  /* 250 */ ["1.003009", "Đề nghị nhận tài sản đã kê biên để trừ vào tiền được thi hành án (cấp tỉnh)", DT.BTNN_TINH, LV.THADS, CAP.TINH, CQ.THADS, T5, MUC_DO.MP],
  /* 251 */ ["1.002548", "Đề nghị miễn, giảm phí thi hành án (cấp tỉnh)", DT.CD, LV.THADS, CAP.TINH, CQ.THADS, T5, MUC_DO.MP],
  /* 252 */ ["1.002520", "Đề nghị miễn, giảm chi phí cưỡng chế thi hành án (cấp tỉnh)", DT.CD_TC, LV.THADS, CAP.TINH, CQ.THADS, T5, MUC_DO.MP],
  /* 253 */ ["1.002270", "Xác nhận kết quả thi hành án (cấp tỉnh)", DT.CD_TC, LV.THADS, CAP.TINH, CQ.THADS, T5, MUC_DO.MP],
];

// --------------------------------------------------------------------------
// BẢNG PHỤ — 19 TTHC thực hiện trên Hệ thống của Bộ khác
// (Ghi chú cuối Quyết định 658: Bộ Nông nghiệp và Môi trường, Bộ Xây dựng,
//  Bộ Ngoại giao). Không có cột thời gian thí điểm và mức độ DVC trực tuyến.
// Cột: maTTHC | tên | đối tượng | lĩnh vực | cấp | cơ quan
// --------------------------------------------------------------------------

const DANH_MUC_BO_KHAC = [
  /*  1 */ ["1.011443", "Xóa đăng ký biện pháp bảo đảm bằng quyền sử dụng đất, tài sản gắn liền với đất", DT.TC_CN, LV.DKBPBD, CAP.TINH, CQ.VPDKDD],
  /*  2 */ ["1.011434", "Cấp bản sao văn bản chứng nhận đăng ký biện pháp bảo đảm bằng tàu biển", DT.TC_CN, LV.DKBPBD, CAP.BO, CQ.DK_TAU_BIEN],
  /*  3 */ ["1.011433", "Cung cấp thông tin về biện pháp bảo đảm bằng tàu biển", DT.TC_CN, LV.DKBPBD, CAP.BO, CQ.DK_TAU_BIEN],
  /*  4 */ ["1.011430", "Đăng ký thay đổi biện pháp bảo đảm bằng tàu biển", DT.TC_CN, LV.DKBPBD, CAP.BO, CQ.DK_TAU_BIEN],
  /*  5 */ ["1.011427", "Đăng ký thông báo xử lý tài sản bảo đảm, đăng ký thay đổi, xóa đăng ký thông báo xử lý tài sản bảo đảm là tàu bay", DT.TC_CN, LV.DKBPBD, CAP.BO, CQ.CUC_HK],
  /*  6 */ ["1.011426", "Xóa đăng ký biện pháp bảo đảm bằng tàu bay", DT.TC_CN, LV.DKBPBD, CAP.BO, CQ.CUC_HK],
  /*  7 */ ["1.011425", "Đăng ký thay đổi biện pháp bảo đảm bằng tàu bay", DT.TC_CN, LV.DKBPBD, CAP.BO, CQ.CUC_HK],
  /*  8 */ ["1.011445", "Chuyển tiếp đăng ký thế chấp quyền tài sản phát sinh từ hợp đồng mua bán nhà ở hoặc từ hợp đồng mua bán tài sản khác gắn liền với đất", DT.TC_CN, LV.DKBPBD, CAP.TINH, CQ.VPDKDD],
  /*  9 */ ["1.011444", "Đăng ký thông báo xử lý tài sản bảo đảm, đăng ký thay đổi, xóa đăng ký thông báo xử lý tài sản bảo đảm là quyền sử dụng đất, tài sản gắn liền với đất", DT.TC_CN, LV.DKBPBD, CAP.TINH, CQ.VPDKDD],
  /* 10 */ ["1.011442", "Đăng ký thay đổi biện pháp bảo đảm bằng quyền sử dụng đất, tài sản gắn liền với đất", DT.TC_CN, LV.DKBPBD, CAP.TINH, CQ.VPDKDD],
  /* 11 */ ["1.011441", "Đăng ký biện pháp bảo đảm bằng quyền sử dụng đất, tài sản gắn liền với đất", DT.TC_CN, LV.DKBPBD, CAP.TINH, CQ.VPDKDD],
  /* 12 */ ["1.011432", "Đăng ký thông báo xử lý tài sản bảo đảm, đăng ký thay đổi, xóa đăng ký thông báo xử lý tài sản bảo đảm là tàu biển", DT.TC_CN, LV.DKBPBD, CAP.BO, CQ.DK_TAU_BIEN],
  /* 13 */ ["1.011431", "Xóa đăng ký biện pháp bảo đảm bằng tàu biển", DT.TC_CN, LV.DKBPBD, CAP.BO, CQ.DK_TAU_BIEN],
  /* 14 */ ["1.011429", "Đăng ký biện pháp bảo đảm bằng tàu biển", DT.TC_CN, LV.DKBPBD, CAP.BO, CQ.DK_TAU_BIEN],
  /* 15 */ ["1.011423", "Đăng ký biện pháp bảo đảm bằng tàu bay", DT.TC_CN, LV.DKBPBD, CAP.BO, CQ.CUC_HK],
  /* 16 */ ["1.005137", "Thủ tục cấp Giấy xác nhận có quốc tịch Việt Nam ở nước ngoài", DT.CD, LV.QUOC_TICH, CAP.BO, CQ.CQDD],
  /* 17 */ ["1.003213", "Thủ tục Đăng ký việc nuôi con nuôi tại Cơ quan đại diện Việt Nam ở nước ngoài", DT.CD, LV.NUOI_CON_NUOI, CAP.BO, CQ.CQDD],
  /* 18 */ ["2.000988", "Thủ tục chứng thực chữ ký người dịch là viên chức ngoại giao, viên chức lãnh sự", DT.CBCC, LV.CHUNG_THUC, CAP.KHAC, CQ.CQDD_TQ],
  /* 19 */ ["2.000975", "Thủ tục chứng thực chữ ký người dịch không phải viên chức ngoại giao, viên chức lãnh sự", DT.CD, LV.CHUNG_THUC, CAP.KHAC, CQ.CQDD_TQ],
];

// --------------------------------------------------------------------------
// DỰNG DỮ LIỆU CHO GIAO DIỆN
// --------------------------------------------------------------------------

/**
 * Quy đổi cột "Cấp thực hiện" của Quyết định sang slug dùng cho bộ lọc.
 * Khi một thủ tục có nhiều cấp, lấy cấp cao nhất làm cấp đại diện.
 */
function capToTrangThai(capQD) {
  if (capQD.includes("Cấp Bộ")) return "cap-bo";
  if (capQD.includes("Cấp Tỉnh")) return "cap-tinh";
  if (capQD.includes("Cấp Xã")) return "phuong-xa";
  return "co-quan-khac";
}

/** Chuẩn hoá mã TTHC: bỏ dấu chấm thừa (vd "2.000.908" → "2.000908"). */
function chuanHoaMaTTHC(ma) {
  const parts = String(ma).split(".");
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : String(ma);
}

/** Dựng 1 object thủ tục từ 1 dòng bảng. */
function buildThuTuc(row, index, prefix) {
  const [maGoc, ten, doiTuong, linhVuc, capQD, coQuanThucHien, thoiGianThiDiem, mucDoDVC, ghiChu] = row;
  const maTTHC = chuanHoaMaTTHC(maGoc);

  return {
    id: `${prefix}-${String(index + 1).padStart(3, "0")}`,
    maTTHC,
    ten,
    doiTuong,
    linhVuc,
    capQD,
    coQuanThucHien,
    thoiGianThiDiem: thoiGianThiDiem || "—",
    thoiGian: thoiGianThiDiem || "—",   // cột hiển thị trên danh sách
    mucDoDVC: mucDoDVC || MUC_DO.KHONG,
    ghiChu: ghiChu || "",
    trangThai: capToTrangThai(capQD),
    capThucHien: CAP_THUC_HIEN_URL,
    portalBaseUrl: PORTAL_BASE_URL,
    coQuanThucHienList: CO_QUAN_MAC_DINH.map((noi) => ({ ...noi, maDVC: maTTHC })),
  };
}

/** 253 TTHC trên Hệ thống thông tin giải quyết TTHC tập trung của Bộ Tư pháp. */
const DICH_VU_CONG = DANH_MUC_QD658.map((row, i) => buildThuTuc(row, i, "dvc"));

/** 19 TTHC thực hiện trên Hệ thống của Bộ Nông nghiệp và Môi trường / Xây dựng / Ngoại giao. */
const DICH_VU_CONG_BO_KHAC = DANH_MUC_BO_KHAC.map((row, i) => buildThuTuc(row, i, "bok"));

/** Nhãn hiển thị cho mức độ dịch vụ công trực tuyến. */
const MUC_DO_LABEL = {
  "toan-trinh": "Trực tuyến toàn trình",
  "mot-phan": "Trực tuyến một phần",
  "khong-du-dieu-kien": "Chưa đủ điều kiện trực tuyến",
};

// --------------------------------------------------------------------------
// TÁC NGHIỆP NỘI BỘ (dữ liệu mẫu — không thuộc Quyết định 658)
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
