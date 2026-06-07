// ════════════════════════════════════════════════════════
// GEMINI API KEY + AI ĐỌC FILE → TỰ ĐIỀN FORM
// ════════════════════════════════════════════════════════
var _geminiKeys = []; // mảng key, luân phiên khi hết quota
var _geminiKey  = ''; // key hiện tại đang dùng (compat)
var _aiResult   = null;
var _pendingAiFiles = null;

// Hàm showToast nếu chưa có
if (typeof showToast !== 'function') {
  window.showToast = function(msg) {
    var n = document.getElementById('screenNotice');
    if (!n) {
      n = document.createElement('div');
      n.id = 'screenNotice';
      n.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fde68a;padding:8px 20px;border-radius:20px;font-size:12px;font-weight:700;z-index:9999;box-shadow:0 2px 12px rgba(0,0,0,.2);transition:opacity .4s;pointer-events:none;white-space:nowrap;max-width:90vw;overflow:hidden;text-overflow:ellipsis;font-family:"Be Vietnam Pro",sans-serif';
      document.body.appendChild(n);
    }
    n.textContent = msg;
    n.style.opacity = '1';
    clearTimeout(n._t);
    n._t = setTimeout(function() { n.style.opacity = '0'; }, 3000);
  };
}

async function loadApiKeyFromFirebase() {
  if (!fbDb || !currentUID) return;
  try {
    // Thử load mảng key trước (schema mới)
    var snap = await fbDb.ref('donvi/' + currentUID + '/config/geminiKeys').once('value');
    var val = snap.val();
    if (Array.isArray(val) && val.length) {
      _geminiKeys = val.filter(Boolean);
    } else {
      // Fallback: schema cũ (string đơn)
      var snapOld = await fbDb.ref('donvi/' + currentUID + '/config/geminiKey').once('value');
      if (snapOld.val()) _geminiKeys = [snapOld.val()];
    }
    _geminiKey = _geminiKeys[0] || '';
    var del = document.getElementById('btnDelApiKey');
    if (del) del.style.display = _geminiKeys.length ? 'inline-block' : 'none';
  } catch(e) { logWarn('loadApiKeyFromFirebase error', e); }
}

// Kiểm tra xem Gemini API key còn hoạt động không bằng cách gọi thử
async function _testGeminiKey(key) {
  try {
    var res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + key,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Say OK' }] }],
          generationConfig: { maxOutputTokens: 5 }
        })
      }
    );
    return res.status; // trả về status code để phân tích
  } catch(e) { return 0; }
}

// ════════════════════════════════════════
// MANAGE MENU dropdown (gộp các nút quản lý vào 1 menu)
// ════════════════════════════════════════
function toggleManageMenu(ev){
  if(ev){ev.stopPropagation();}
  var menu=document.getElementById('manageMenu');
  var btn=document.getElementById('btnManageMenu');
  if(!menu||!btn)return;
  var isOpen=menu.style.display==='block';
  if(isOpen){
    menu.style.display='none';
    return;
  }
  // Định vị menu ngay dưới button (dùng fixed để thoát overflow của toolbar)
  var rect=btn.getBoundingClientRect();
  menu.style.top=(rect.bottom+4)+'px';
  menu.style.left=rect.left+'px';
  menu.style.display='block';
  // Đóng menu khi click ngoài
  setTimeout(function(){
    document.addEventListener('click',_closeMenuOnOutsideClick,{once:true});
  },10);
}
function _closeMenuOnOutsideClick(e){
  var menu=document.getElementById('manageMenu');
  var btn=document.getElementById('btnManageMenu');
  if(menu&&!menu.contains(e.target)&&e.target!==btn){
    menu.style.display='none';
  }
}
function closeManageMenu(){
  var menu=document.getElementById('manageMenu');
  if(menu)menu.style.display='none';
}
// Đóng menu khi scroll/resize để tránh menu lệch khỏi button
window.addEventListener('scroll',closeManageMenu,true);
window.addEventListener('resize',closeManageMenu);

function openApiKeySetting() {
  var inp = document.getElementById('inputApiKey');
  var st  = document.getElementById('apiKeyStatus');
  var del = document.getElementById('btnDelApiKey');
  if (inp) inp.value = _geminiKeys.length ? _geminiKeys.join('\n') : '';
  if (st)  st.style.display = 'none';
  if (del) del.style.display = _geminiKeys.length ? 'inline-block' : 'none';
  document.getElementById('ovApiKey').classList.add('open');
}

function closeApiKeySetting() {
  document.getElementById('ovApiKey').classList.remove('open');
}

async function saveApiKey() {
  var raw = (document.getElementById('inputApiKey').value || '');
  var keys = raw.split(/[\n,]+/).map(function(k){ return k.trim(); }).filter(function(k){ return k.length > 0; });
  if (!keys.length) {
    showApiStatus('⚠️ Chưa nhập key', '#fff8e1', '#7a4f00');
    return;
  }
  var invalid = keys.filter(function(k){ return !k.startsWith('AIza'); });
  if (invalid.length) {
    showApiStatus('❌ Key không đúng định dạng (phải bắt đầu bằng AIza): ' + invalid[0], '#fdecea', '#c0392b');
    return;
  }
  showApiStatus('⏳ Đang lưu ' + keys.length + ' key...', '#eef4ff', '#1a4f7a');
  try {
    if (fbDb && currentUID) {
      await fbDb.ref('donvi/' + currentUID + '/config/geminiKeys').set(keys);
      await fbDb.ref('donvi/' + currentUID + '/config/geminiKey').remove().catch(function(){});
    }
    _geminiKeys = keys;
    _geminiKey  = keys[0];
    var del = document.getElementById('btnDelApiKey');
    if (del) del.style.display = 'inline-block';
    showApiStatus('✅ Đã lưu ' + keys.length + ' key! Tự động luân phiên khi hết quota.', '#e8f5e9', '#1b5e20');
    setTimeout(closeApiKeySetting, 2000);
  } catch(e) {
    showApiStatus('⚠️ Lưu thất bại: ' + e.message, '#fff8e1', '#7a4f00');
  }
}

async function deleteApiKey() {
  if (!confirm('Xoá toàn bộ API Key? Tính năng AI đọc file sẽ ngừng hoạt động.')) return;
  try {
    if (fbDb && currentUID) {
      await fbDb.ref('donvi/' + currentUID + '/config/geminiKeys').remove().catch(function(){});
      await fbDb.ref('donvi/' + currentUID + '/config/geminiKey').remove().catch(function(){});
    }
    _geminiKeys = [];
    _geminiKey  = '';
    var inp = document.getElementById('inputApiKey'); if (inp) inp.value = '';
    var del = document.getElementById('btnDelApiKey'); if (del) del.style.display = 'none';
    showApiStatus('🗑 Đã xoá tất cả key', '#f5f5f5', '#666');
    setTimeout(closeApiKeySetting, 1500);
  } catch(e) {
    showApiStatus('⚠️ Xoá thất bại: ' + e.message, '#fff8e1', '#7a4f00');
  }
}

function showApiStatus(msg, bg, color) {
  var st = document.getElementById('apiKeyStatus');
  if (!st) return;
  st.style.cssText = 'display:block;font-size:12px;padding:7px 11px;border-radius:7px;font-weight:600;background:' + bg + ';color:' + color + ';border:1.5px solid ' + color + '44';
  st.textContent = msg;
}

// ── AI đọc file ──
function aiReadFiles(files) {
  var fileList = Array.isArray(files) ? files : Array.from(files || []);
  if (!fileList.length) return;

  // Nhận tất cả định dạng mà AI có thể đọc được
  var supported = fileList.filter(function(f) {
    return /\.(pdf|jpe?g|png|gif|webp|bmp|tiff?|docx?|xlsx?|txt|csv|md)$/i.test(f.name);
  });
  if (supported.length === 0) return;

  // Nếu modal thêm lịch chưa mở thì không hiển thị bar
  var ovAdd = document.getElementById('ovAdd');
  if (!ovAdd || !ovAdd.classList.contains('open')) return;

  _aiResult = null;
  _pendingAiFiles = supported;

  var bar = document.getElementById('aiReadBar');
  var msg = document.getElementById('aiReadMsg');
  var btn = document.getElementById('aiReadBtn');
  var ico = document.getElementById('aiReadIco');

  if (bar) { bar.style.display = 'flex'; }
  if (ico) ico.textContent = '⏳';
  if (msg) msg.textContent = 'Đang chuẩn bị đọc file...';
  if (btn) { btn.style.display = 'none'; btn.onclick = null; }

  // Xử lý file đầu tiên
  aiExtractFromFile(supported[0]);
}

async function aiExtractFromFile(file) {
  var bar = document.getElementById('aiReadBar');
  var msg = document.getElementById('aiReadMsg');
  var btn = document.getElementById('aiReadBtn');
  var ico = document.getElementById('aiReadIco');

  // Helper cập nhật UI thanh AI
  function setUI(icon, text, btnText, btnAction) {
    if (bar && bar.style.display === 'none') bar.style.display = 'flex';
    if (ico) ico.textContent = icon;
    if (msg) msg.textContent = text;
    if (btn) {
      if (btnText && btnAction) {
        btn.textContent = btnText;
        btn.onclick = btnAction;
        btn.style.display = 'inline-block';
      } else {
        btn.style.display = 'none';
        btn.onclick = null;
      }
    }
  }

  try {
    // ── Bước 0: Kiểm tra kích thước file (tránh OOM/timeout)
    var MAX_SIZE = 15 * 1024 * 1024; // 15MB
    if (file.size > MAX_SIZE) {
      setUI('⚠️', 'File quá lớn (>' + Math.round(file.size/1024/1024) + 'MB). Vui lòng dùng file dưới 15MB.', null, null);
      return;
    }

    // ── Bước 1: Load API key nếu chưa có
    if (!_geminiKeys.length) {
      setUI('🔑', 'Đang tải API Key...', null, null);
      await loadApiKeyFromFirebase();
    }

    if (!_geminiKeys.length) {
      setUI('🔑', 'Chưa có Gemini API Key. Nhấn để cài đặt.', '⚙️ Cài đặt Key', function() {
        aiDismiss(); openApiKeySetting();
      });
      return;
    }

    // ── Bước 2: Đọc & chuẩn bị file — hỗ trợ PDF, ảnh, Word, Excel, TXT
    var isPdf   = /\.pdf$/i.test(file.name);
    var isImage = /\.(jpe?g|png|gif|webp|bmp|tiff?)$/i.test(file.name);
    var isDocx  = /\.docx?$/i.test(file.name);
    var isXlsx  = /\.xlsx?$/i.test(file.name);
    var isTxt   = /\.(txt|csv|md)$/i.test(file.name);

    var base64 = null;     // dùng cho PDF / ảnh → inline_data
    var mimeType = null;
    var extractedText = null; // dùng cho Word / Excel / TXT → text part

    setUI('📄', 'Đang đọc "' + file.name + '"...', null, null);

    if (isPdf) {
      // ── PDF: gửi trực tiếp base64
      mimeType = 'application/pdf';
      base64 = await new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function(e) {
          var result = e.target.result;
          if (!result || result.indexOf(',') === -1) { reject(new Error('Đọc PDF thất bại')); return; }
          resolve(result.split(',')[1]);
        };
        reader.onerror = function() { reject(new Error('Không đọc được file PDF')); };
        reader.readAsDataURL(file);
      });

    } else if (isImage) {
      // ── Ảnh: nén xuống tối đa 1400px, JPEG 85%
      mimeType = 'image/jpeg';
      base64 = await new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function(e) {
          var img = new Image();
          img.onload = function() {
            var MAX = 1400;
            var w = img.width, h = img.height;
            if (w > MAX && w >= h) { h = Math.round(h * MAX / w); w = MAX; }
            else if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
            var canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            if (!dataUrl || dataUrl.indexOf(',') === -1) { reject(new Error('Nén ảnh thất bại')); return; }
            resolve(dataUrl.split(',')[1]);
          };
          img.onerror = function() { reject(new Error('Không đọc được file ảnh')); };
          img.src = e.target.result;
        };
        reader.onerror = function() { reject(new Error('Lỗi đọc file ảnh')); };
        reader.readAsDataURL(file);
      });

    } else if (isDocx) {
      // ── Word (.doc/.docx): dùng mammoth để trích text
      setUI('📝', 'Đang trích xuất nội dung Word...', null, null);
      extractedText = await new Promise(function(resolve, reject) {
        _ensureMammoth(function() {
          if (typeof mammoth === 'undefined') { reject(new Error('Không tải được thư viện đọc Word')); return; }
          var reader = new FileReader();
          reader.onload = function(e) {
            mammoth.extractRawText({ arrayBuffer: e.target.result })
              .then(function(result) {
                var txt = (result.value || '').trim();
                if (!txt) { reject(new Error('File Word không có nội dung văn bản')); return; }
                resolve(txt);
              })
              .catch(function(err) { reject(new Error('Lỗi đọc Word: ' + (err.message || err))); });
          };
          reader.onerror = function() { reject(new Error('Không đọc được file Word')); };
          reader.readAsArrayBuffer(file);
        });
      });

    } else if (isXlsx) {
      // ── Excel (.xls/.xlsx): dùng SheetJS để trích text
      setUI('📊', 'Đang trích xuất nội dung Excel...', null, null);
      extractedText = await new Promise(function(resolve, reject) {
        _ensureXlsx(function() {
          if (typeof XLSX === 'undefined') { reject(new Error('Không tải được thư viện đọc Excel')); return; }
          var reader = new FileReader();
          reader.onload = function(e) {
            try {
              var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
              var lines = [];
              wb.SheetNames.forEach(function(sheetName) {
                var ws = wb.Sheets[sheetName];
                var csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
                if (csv.trim()) {
                  lines.push('=== Sheet: ' + sheetName + ' ===');
                  lines.push(csv.trim());
                }
              });
              var txt = lines.join('\n').trim();
              if (!txt) { reject(new Error('File Excel không có nội dung')); return; }
              // Giới hạn 8000 ký tự để tránh vượt token
              resolve(txt.length > 8000 ? txt.substring(0, 8000) + '\n...(đã cắt)' : txt);
            } catch(err) {
              reject(new Error('Lỗi đọc Excel: ' + (err.message || err)));
            }
          };
          reader.onerror = function() { reject(new Error('Không đọc được file Excel')); };
          reader.readAsArrayBuffer(file);
        });
      });

    } else if (isTxt) {
      // ── TXT / CSV / Markdown: đọc thẳng
      extractedText = await new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function(e) {
          var txt = (e.target.result || '').trim();
          if (!txt) { reject(new Error('File văn bản trống')); return; }
          resolve(txt.length > 8000 ? txt.substring(0, 8000) + '\n...(đã cắt)' : txt);
        };
        reader.onerror = function() { reject(new Error('Không đọc được file văn bản')); };
        reader.readAsText(file, 'utf-8');
      });

    } else {
      throw new Error('Định dạng "' + file.name.split('.').pop() + '" chưa được hỗ trợ. Vui lòng dùng PDF, ảnh, Word hoặc Excel.');
    }

    // Kiểm tra kết quả đọc
    if (!base64 && !extractedText) {
      throw new Error('Không thể đọc nội dung file');
    }
    if (base64 && base64.length < 10) {
      throw new Error('Dữ liệu file quá nhỏ, có thể bị lỗi khi đọc');
    }

    // ── Bước 3: Tạo prompt
    var today = new Date();
    var todayStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
    var todayVi = String(today.getDate()).padStart(2,'0') + '/' +
      String(today.getMonth() + 1).padStart(2, '0') + '/' + today.getFullYear();
    var dayNames = ['Chủ nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];

    var prompt = [
      'Bạn là trợ lý hành chính Việt Nam chuyên đọc và phân tích GIẤY MỜI, CÔNG VĂN, THÔNG BÁO của các cơ quan nhà nước.',
      'Nhiệm vụ: trích xuất CHÍNH XÁC thông tin của MỘT cuộc họp/sự kiện chính trong văn bản.',
      '',
      extractedText
        ? 'Đây là nội dung văn bản đã trích xuất từ file "' + file.name + '":'
        : 'Hãy đọc kỹ TOÀN BỘ nội dung văn bản/giấy mời trong file (kể cả phần in nghiêng, header, footer).',
      '',
      'NGÀY THAM CHIẾU: Hôm nay là ' + dayNames[today.getDay()] + ', ' + todayVi + ' (' + todayStr + ').',
      '',
      'CẤU TRÚC JSON BẮT BUỘC (đúng tên trường, không thêm/bớt):',
      '{',
      '  "title":    "Nội dung cuộc họp/sự kiện",',
      '  "date":     "YYYY-MM-DD",',
      '  "time":     "HH:MM",',
      '  "ses":      "sang | chieu | toi",',
      '  "location": "Địa điểm cụ thể",',
      '  "chair":    "Người chủ trì",',
      '  "member":   "Thành phần tham dự",',
      '  "prep":     "Đơn vị/người chuẩn bị",',
      '  "cat":      "hop | ldao | kt | nd | kh"',
      '}',
      '',
      '════════ QUY TẮC TRÍCH XUẤT CHI TIẾT ════════',
      '',
      '【title】 Nội dung họp/sự kiện',
      '- Tìm phần "V/v ...", "Về việc ...", "Họp ...", "Hội nghị ..." → đó là tiêu đề chính',
      '- Giữ NGUYÊN văn cách viết của văn bản, không tự diễn giải, không tóm tắt',
      '- Bỏ tiền tố không cần thiết: "Giấy mời", "Thông báo", "V/v", "Về việc"',
      '- Ví dụ: "V/v họp triển khai công tác phòng chống bão số 5" → "Họp triển khai công tác phòng chống bão số 5"',
      '',
      '【date】 Ngày diễn ra (YYYY-MM-DD)',
      '- Tìm cụm "vào hồi ... ngày ... tháng ... năm ..." hoặc "ngày DD/MM/YYYY"',
      '- "ngày 15/5/2026" → "2026-05-15"',
      '- "ngày 15 tháng 5 năm 2026" → "2026-05-15"',
      '- "ngày 15/5" (không có năm) → dùng năm ' + today.getFullYear() + ' → "' + today.getFullYear() + '-05-15"',
      '- "vào thứ Hai tuần tới" → TÍNH chính xác ngày thứ Hai tuần tới từ ngày hôm nay (' + todayStr + ')',
      '- "ngày mai" → ngày hôm nay + 1; "hôm nay" → ' + todayStr,
      '- CHÚ Ý: KHÔNG nhầm ngày KÝ văn bản (ở đầu/cuối) với NGÀY DIỄN RA SỰ KIỆN',
      '- Nếu thực sự không có ngày sự kiện → ""',
      '',
      '【time】 Giờ bắt đầu (HH:MM, 24h)',
      '- "7h" → "07:00"',
      '- "7h30" hoặc "7g30" hoặc "7 giờ 30" → "07:30"',
      '- "8 giờ" hoặc "8:00 sáng" → "08:00"',
      '- "14h" hoặc "2h chiều" → "14:00"',
      '- "2 giờ chiều" → "14:00"',
      '- "8h00 - 11h30" → lấy giờ BẮT ĐẦU → "08:00"',
      '- Nếu chỉ ghi "buổi sáng" không có giờ cụ thể → "" (để trống)',
      '',
      '【ses】 Buổi (CHỈ chọn 1 trong 3 giá trị: sang/chieu/toi)',
      '- Nếu có time: TỰ TÍNH từ time',
      '   • time < 12:00 → "sang"',
      '   • 12:00 ≤ time < 18:00 → "chieu"',
      '   • time ≥ 18:00 → "toi"',
      '- Nếu KHÔNG có time nhưng văn bản ghi "buổi sáng/sáng" → "sang"',
      '- "buổi chiều/chiều" → "chieu"',
      '- "buổi tối/tối" → "toi"',
      '- Nếu không có thông tin → "" (để trống)',
      '',
      '【location】 Địa điểm',
      '- Tìm "tại ...", "địa điểm: ...", "Hội trường ...", "Phòng họp ..."',
      '- Lấy địa điểm CỤ THỂ nhất, không lấy địa chỉ tỉnh/thành phố chung chung',
      '- Ví dụ: "Phòng họp tầng 2, UBND xã Tây Trà Bồng" → "Phòng họp tầng 2, UBND xã Tây Trà Bồng"',
      '',
      '【chair】 Người chủ trì',
      '- Tìm "chủ trì: ...", "do ... chủ trì", "đồng chí ... chủ trì"',
      '- Lấy ĐẦY ĐỦ chức danh + tên: "đ/c Nguyễn Văn A, Chủ tịch UBND xã" → "Nguyễn Văn A, Chủ tịch UBND xã"',
      '- Nếu chỉ có chức danh không tên: "Chủ tịch UBND xã" → giữ nguyên',
      '',
      '【member】 Thành phần tham dự',
      '- Tìm "thành phần:", "kính mời:", "tham dự:", "dự họp:"',
      '- Liệt kê ngắn gọn, cách nhau bằng dấu chấm phẩy hoặc dấu phẩy',
      '- Ưu tiên giữ nguyên văn các đối tượng được liệt kê',
      '- Ví dụ: "Lãnh đạo UBND xã; Các đồng chí Trưởng/Phó các phòng, ban; Bí thư các thôn"',
      '',
      '【prep】 Đơn vị/người chuẩn bị',
      '- Tìm "giao cho ... chuẩn bị", "đơn vị chuẩn bị nội dung: ...", "Văn phòng UBND chuẩn bị tài liệu"',
      '- Nếu không có → ""',
      '',
      '【cat】 Phân loại (CHỈ chọn 1 giá trị)',
      '- "hop" → họp / hội nghị / hội thảo / tập huấn / giao ban / sơ kết / tổng kết / triển khai',
      '- "ldao" → lãnh đạo đi công tác / làm việc tại địa phương / kiểm tra thực địa / dự sự kiện',
      '- "kt" → kiểm tra / giám sát / thẩm tra / thanh tra / kiểm toán',
      '- "nd" → tiếp công dân / tiếp dân / đối thoại với dân',
      '- "kh" → các sự kiện khác không thuộc 4 loại trên',
      '- Phân tích KỸ từ khóa trong title để chọn đúng',
      '',
      '════════ NGUYÊN TẮC CHUNG ════════',
      '1. KHÔNG bịa đặt — không có thông tin thì để chuỗi rỗng ""',
      '2. KHÔNG suy diễn — chỉ trích những gì văn bản viết rõ ràng',
      '3. KHÔNG nhầm ngày ký với ngày sự kiện',
      '4. ƯU TIÊN văn bản gốc — giữ nguyên cách viết, dấu câu, viết hoa',
      '5. Đọc kỹ TOÀN BỘ văn bản, kể cả phần phụ lục/lịch kèm theo',
      '',
      extractedText ? ('\n════════ NỘI DUNG VĂN BẢN ════════\n' + extractedText) : ''
    ].join('\n');

    // ── Bước 4: Gọi Gemini API, thử lần lượt từng key
    setUI('🤖', 'AI đang phân tích "' + file.name + '"...', null, null);

    // Tạo parts phù hợp với loại file
    var contentParts;
    if (base64 && mimeType) {
      // PDF hoặc ảnh: gửi qua inline_data
      contentParts = [
        { inline_data: { mime_type: mimeType, data: base64 } },
        { text: prompt }
      ];
    } else {
      // Word / Excel / TXT: chỉ gửi text (đã nhúng nội dung vào prompt)
      contentParts = [{ text: prompt }];
    }

    var response = null;
    var lastErrMsg = '';

    for (var ki = 0; ki < _geminiKeys.length; ki++) {
      var tryKey = _geminiKeys[ki];
      if (ki > 0) {
        setUI('🔄', 'Key ' + ki + ' hết quota, thử key ' + (ki + 1) + '/' + _geminiKeys.length + '...', null, null);
      }

      var fetchRes;
      try {
        fetchRes = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + tryKey,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: contentParts
              }],
              generationConfig: {
                temperature: 0,
                maxOutputTokens: 4096,
                responseMimeType: 'application/json',
                responseSchema: {
                  type: 'object',
                  properties: {
                    title:    { type: 'string' },
                    date:     { type: 'string' },
                    time:     { type: 'string' },
                    ses:      { type: 'string' },
                    location: { type: 'string' },
                    chair:    { type: 'string' },
                    member:   { type: 'string' },
                    prep:     { type: 'string' },
                    cat:      { type: 'string' }
                  },
                  required: ['title','date','time','ses','location','chair','member','prep','cat']
                }
              }
            })
          }
        );
      } catch(netErr) {
        lastErrMsg = 'Lỗi kết nối mạng: ' + (netErr.message || 'Không rõ');
        continue;
      }

      // 429 – hết quota hoặc chưa kích hoạt
      if (fetchRes.status === 429) {
        var body429 = null;
        try { body429 = await fetchRes.clone().json(); } catch(e) {}
        // Tìm "limit: 0" trong cả error.message lẫn error.details[]
        // (API thực tế trả trong mảng details, không chỉ trong message)
        var msg429    = (body429 && body429.error && body429.error.message) || '';
        var det429    = JSON.stringify((body429 && body429.error && body429.error.details) || []);
        var full429   = msg429 + ' ' + det429;
        logWarn('Key ' + (ki+1) + ' 429 full:', full429);
        var isLimit0  = full429.indexOf('limit: 0')              !== -1 ||
                        full429.indexOf('"limit":0')             !== -1 ||
                        full429.indexOf('"limit": 0')            !== -1 ||
                        full429.indexOf('free_tier_requests')    !== -1 ||
                        full429.indexOf('free_tier_input_token') !== -1;
        if (isLimit0) {
          // Key chưa kích hoạt (tạo từ Google Cloud Console) → thử key tiếp
          lastErrMsg = 'limit0:Key ' + (ki+1) + ' chưa kích hoạt — cần tạo key tại aistudio.google.com/apikey';
        } else {
          lastErrMsg = 'quota:Key ' + (ki+1) + ' hết quota hôm nay';
        }
        continue; // luôn thử key tiếp theo
      }

      // 401 / 403 – key sai hoặc hết hạn
      if (fetchRes.status === 401 || fetchRes.status === 403) {
        var bodyAuth = null;
        try { bodyAuth = await fetchRes.clone().json(); } catch(e) {}
        var msgAuth = (bodyAuth && bodyAuth.error && bodyAuth.error.message) || ('HTTP ' + fetchRes.status);
        logWarn('Key ' + (ki+1) + ' auth error:', msgAuth);
        setUI('🔑', 'Key ' + (ki+1) + ' không hợp lệ hoặc đã hết hạn. Vui lòng cập nhật.', '⚙️ Cập nhật Key', function() {
          aiDismiss(); openApiKeySetting();
        });
        return;
      }

      // Lỗi HTTP khác
      if (!fetchRes.ok) {
        var bodyErr = null;
        try { bodyErr = await fetchRes.clone().json(); } catch(e) {}
        var msgErr = (bodyErr && bodyErr.error && bodyErr.error.message) || ('HTTP ' + fetchRes.status);
        lastErrMsg = 'Lỗi API: ' + msgErr;
        logErr('Gemini key ' + (ki+1) + ' error:', msgErr);
        continue;
      }

      // Thành công
      response = fetchRes;
      break;
    }

    // Tất cả key đều thất bại
    if (!response) {
      var _hasLimit0 = lastErrMsg.indexOf('limit0:') !== -1;
      var _hasQuota  = lastErrMsg.indexOf('quota:')  !== -1;
      if (_hasLimit0 && !_hasQuota) {
        // Tất cả key đều chưa kích hoạt
        setUI('🔑',
          'API Key chưa kích hoạt (limit: 0). Hãy tạo key mới tại aistudio.google.com/apikey — KHÔNG dùng Google Cloud Console.',
          '⚙️ Cập nhật Key', function() { aiDismiss(); openApiKeySetting(); });
      } else if (_hasLimit0 && _hasQuota) {
        // Hỗn hợp: có key limit:0, có key hết quota
        setUI('🔑',
          'Một số key chưa kích hoạt (limit: 0), số còn lại hết quota. Tạo key mới tại aistudio.google.com/apikey.',
          '⚙️ Quản lý Key', function() { aiDismiss(); openApiKeySetting(); });
      } else if (_hasQuota) {
        // Tất cả hết quota
        setUI('⏰',
          'Tất cả ' + _geminiKeys.length + ' key đều hết quota hôm nay. Thêm key mới hoặc thử lại vào ngày mai.',
          '⚙️ Quản lý Key', function() { aiDismiss(); openApiKeySetting(); });
      } else {
        setUI('⚠️',
          lastErrMsg.replace(/^(limit0:|quota:)/, '') || 'Không kết nối được Gemini API. Kiểm tra mạng và API Key.',
          '🔄 Thử lại', function() { aiExtractFromFile(file); });
      }
      return;
    }

    // ── Bước 5: Parse JSON từ phản hồi Gemini
    var data;
    try {
      data = await response.json();
    } catch(e) {
      throw new Error('Phản hồi từ AI không hợp lệ (không parse được JSON)');
    }

    // Kiểm tra finish reason (SAFETY, RECITATION, ...)
    var candidate = (data.candidates || [])[0] || {};
    var finishReason = candidate.finishReason || '';
    if (finishReason === 'SAFETY') {
      throw new Error('Gemini từ chối đọc file này do chính sách an toàn. Thử file khác.');
    }
    if (finishReason === 'MAX_TOKENS') {
      // Vẫn có thể có nội dung dùng được, tiếp tục xử lý
      logWarn('Gemini hit MAX_TOKENS, may have truncated output');
    }

    var rawText = '';
    try {
      rawText = ((candidate.content || {}).parts || [])
        .map(function(p) { return p.text || ''; })
        .join('');
    } catch(e) {
      throw new Error('Không đọc được nội dung phản hồi từ AI');
    }

    if (!rawText.trim()) {
      // Kiểm tra có bị block toàn bộ không
      var promptFeedback = data.promptFeedback || {};
      if (promptFeedback.blockReason) {
        throw new Error('Gemini từ chối xử lý file: ' + promptFeedback.blockReason);
      }
      throw new Error('AI không trả về nội dung. Hãy thử lại hoặc dùng file khác.');
    }

    // Trích xuất JSON từ chuỗi (loại bỏ markdown nếu AI vẫn thêm vào)
    var cleaned = rawText
      .replace(/```json[\s\S]*?```/gi, function(m) { return m.replace(/```json\s*/i, '').replace(/\s*```$/, ''); })
      .replace(/```[\s\S]*?```/g, function(m) { return m.replace(/```\s*/g, ''); })
      .trim();

    var parsed = null;
    // Cách 1: parse trực tiếp (khi responseMimeType=application/json hoạt động đúng)
    try {
      parsed = JSON.parse(cleaned);
    } catch(e) {}

    // Cách 2: tìm {...} đầu tiên trong text
    if (!parsed) {
      var jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch(e) {}
      }
    }

    // Cách 3: thử sửa JSON bị lỗi nhẹ (trailing comma, single quotes...)
    if (!parsed) {
      var jsonMatch2 = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch2) {
        var fixed = jsonMatch2[0]
          .replace(/,(\s*[}\]])/g, '$1')              // xóa trailing comma
          .replace(/'/g, '"')                          // single → double quote
          .replace(/(\w+)\s*:/g, '"$1":')              // key không quote → có quote
          .replace(/""(\w+)"":/g, '"$1":');            // sửa lại quote bị double
        try { parsed = JSON.parse(fixed); } catch(e) {}
      }
    }

    if (!parsed) {
      logWarn('AI raw response (không parse được):', rawText);
      throw new Error('AI không trả về JSON đúng định dạng. Hãy thử lại hoặc dùng file khác.');
    }

    // ── Bước 6: Chuẩn hoá & lưu kết quả
    parsed = aiNormalizeResult(parsed);
    _aiResult = parsed;

    // Tạo preview ngắn để hiển thị
    var preview = [];
    if (parsed.title) preview.push('"' + parsed.title.substring(0, 28) + (parsed.title.length > 28 ? '…' : '') + '"');
    if (parsed.date) preview.push(parsed.date);
    if (parsed.time) preview.push(parsed.time);

    setUI('✅',
      'Đọc xong' + (preview.length ? ': ' + preview.join(' · ') : '') + '. Nhấn để điền vào form.',
      '✨ Điền vào form',
      aiDoFill
    );

  } catch(errCatch) {
    logErr('aiExtractFromFile error:', errCatch);
    var displayErr = (errCatch && errCatch.message) ? errCatch.message : 'Lỗi không xác định khi đọc file';
    if (displayErr.length > 130) displayErr = displayErr.substring(0, 130) + '...';
    setUI('⚠️', displayErr, '🔄 Thử lại', function() {
      aiExtractFromFile(file);
    });
  }
}

// ── Chuẩn hoá dữ liệu JSON trả về từ AI ──
function aiNormalizeResult(r) {
  log('[AI] Raw response from Gemini:', JSON.stringify(r, null, 2));
  var out = {};

  // title
  out.title = (r.title || '').trim()
    // Xóa tiền tố không cần thiết mà AI có thể giữ lại
    .replace(/^(GIẤY MỜI|GIAY MOI|THÔNG BÁO|THONG BAO|V\/v|Về việc|Ve viec)[:\s]+/i, '')
    .trim();

  // date: hỗ trợ YYYY-MM-DD, DD/MM/YYYY, và một số dạng tương đối
  var dateRaw = (r.date || '').trim();

  // Xử lý dạng tương đối (AI đôi khi trả "ngày mai", "thứ Hai", v.v.)
  var todayVN = new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Ho_Chi_Minh'}));
  todayVN.setHours(0,0,0,0);
  var fmtIso = function(d){
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  };
  var lowerDate = dateRaw.toLowerCase();
  if(/^h[ôo]m nay$/i.test(lowerDate)){
    out.date = fmtIso(todayVN);
  } else if(/^ng[àa]y mai$/i.test(lowerDate)){
    var d=new Date(todayVN);d.setDate(d.getDate()+1);out.date=fmtIso(d);
  } else if(/^ng[àa]y kia$/i.test(lowerDate)||/^ng[àa]y m[ốo]t$/i.test(lowerDate)){
    var d=new Date(todayVN);d.setDate(d.getDate()+2);out.date=fmtIso(d);
  }
  // Dạng chuẩn YYYY-MM-DD
  else if (/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
    out.date = dateRaw;
  }
  // DD/MM/YYYY hoặc DD-MM-YYYY
  else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(dateRaw)) {
    var dp = dateRaw.split(/[\/\-]/);
    out.date = dp[2] + '-' + dp[1].padStart(2, '0') + '-' + dp[0].padStart(2, '0');
  }
  // YYYY/MM/DD
  else if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(dateRaw)) {
    var dp2 = dateRaw.split(/[\/\-]/);
    out.date = dp2[0] + '-' + dp2[1].padStart(2, '0') + '-' + dp2[2].padStart(2, '0');
  }
  // DD/MM (không có năm) → dùng năm hiện tại
  else if (/^\d{1,2}[\/\-]\d{1,2}$/.test(dateRaw)) {
    var dp3 = dateRaw.split(/[\/\-]/);
    out.date = todayVN.getFullYear() + '-' + dp3[1].padStart(2, '0') + '-' + dp3[0].padStart(2, '0');
  }
  // "Ngày X tháng Y" hoặc "X tháng Y năm Z"
  else {
    var m = dateRaw.match(/(?:ng[àa]y\s+)?(\d{1,2})\s*(?:\/|th[áa]ng|-)\s*(\d{1,2})(?:\s*(?:\/|n[ăa]m|-)\s*(\d{4}))?/i);
    if(m){
      var dd = m[1].padStart(2,'0');
      var mm = m[2].padStart(2,'0');
      var yy = m[3] || String(todayVN.getFullYear());
      out.date = yy + '-' + mm + '-' + dd;
    } else {
      out.date = '';
    }
  }
  // Validate ngày hợp lệ
  if (out.date) {
    var dTest = new Date(out.date + 'T00:00:00');
    if (isNaN(dTest.getTime())) {
      logWarn('[AI] Ngày không hợp lệ, bỏ qua:', out.date);
      out.date = '';
    }
  }

  // time: hỗ trợ nhiều dạng viết
  var timeRaw = (r.time || '').trim();
  timeRaw = timeRaw.replace(/\s*(sáng|chiều|tối|buổi sáng|buổi chiều|am|pm)/gi, '').trim();
  var timeMatch =
    timeRaw.match(/^(\d{1,2})[hH:](\d{2})(?::\d{2})?$/) ||  // 7h30, 7:30, 07:30, 7:30:00
    timeRaw.match(/^(\d{1,2})[hH]\s*(\d{2})\s*[pP]?$/) ||   // 7h 30
    timeRaw.match(/^(\d{1,2})[hH]?$/);                        // 7h, 7, 14
  if (timeMatch) {
    var hh = parseInt(timeMatch[1], 10);
    var mm = timeMatch[2] !== undefined ? parseInt(timeMatch[2], 10) : 0;
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      out.time = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    } else {
      out.time = '';
    }
  } else {
    out.time = '';
  }

  // ses: tính lại từ time (không tin vào AI), fallback dùng AI value
  var sesValid = ['sang', 'chieu', 'toi'];
  if (out.time) {
    var hNum = parseInt(out.time.split(':')[0], 10);
    out.ses = hNum < 12 ? 'sang' : (hNum < 18 ? 'chieu' : 'toi');
  } else if (sesValid.indexOf(r.ses) >= 0) {
    out.ses = r.ses;
  } else {
    out.ses = '';
  }

  // cat: chỉ nhận giá trị hợp lệ, mặc định 'hop'
  var catValid = ['hop', 'ldao', 'kt', 'nd', 'kh'];
  out.cat = catValid.indexOf((r.cat || '').trim()) >= 0 ? r.cat.trim() : 'hop';

  // Các trường text - giữ nguyên nội dung
  out.location = (r.location || '').trim();
  out.chair    = (r.chair    || '').trim()
    // Loại bỏ tiền tố thông thường
    .replace(/^(đ\/c|đc|đồng chí|ông|bà|Mr\.?|Mrs\.?)\s+/i, function(m){return m;}); // giữ nguyên
  out.member   = (r.member   || '').trim();
  out.prep     = (r.prep     || '').trim();

  // Log kết quả để dễ debug
  log('[AI] Normalized result:', JSON.stringify(out, null, 2));

  return out;
}

// ── Điền dữ liệu AI vào form ──
function aiDoFill() {
  if (!_aiResult) {
    if (typeof showToast === 'function') showToast('⚠️ Chưa có dữ liệu AI để điền. Hãy upload lại file.');
    return;
  }
  var r = _aiResult;

  // Điền nếu field đang trống
  function setIfEmpty(id, val) {
    if (!val) return;
    var el = document.getElementById(id);
    if (el && !el.value.trim()) el.value = val;
  }

  // Điền bắt buộc (ghi đè)
  function setForce(id, val) {
    if (val === undefined || val === null || val === '') return;
    var el = document.getElementById(id);
    if (!el) return;
    // Nếu là select: kiểm tra option có tồn tại không
    if (el.tagName === 'SELECT') {
      for (var i = 0; i < el.options.length; i++) {
        if (el.options[i].value === val) { el.value = val; return; }
      }
      // Không tìm thấy option → không set (tránh reset về blank)
      return;
    }
    el.value = val;
  }

  // Ngày: AI trả về thì LUÔN ghi đè (form có default = Thứ Hai tuần này)
  if (r.date) {
    var fD = document.getElementById('fD');
    if (fD) {
      var dateFound = false;
      for (var di = 0; di < fD.options.length; di++) {
        if (fD.options[di].value === r.date) { dateFound = true; break; }
      }
      if (dateFound) {
        fD.value = r.date;
        log('[AI] Set ngày trong tuần hiện tại:', r.date);
      } else {
        // Tự động chuyển sang tuần chứa ngày AI trả về
        try {
          var targetDate = new Date(r.date + 'T00:00:00');
          var todayD = new Date(TODAY);
          var monday = function(d){
            var dt = new Date(d);
            var dow = dt.getDay();
            dt.setDate(dt.getDate() + (dow === 0 ? -6 : 1 - dow));
            dt.setHours(0,0,0,0);
            return dt;
          };
          var diffMs = monday(targetDate) - monday(todayD);
          var diffWeeks = Math.round(diffMs / (7 * 86400000));
          wkOff = diffWeeks;
          // Populate lại dropdown ngày theo tuần mới
          var ws = wkStart(wkOff);
          var vnDow = ['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
          fD.innerHTML = '';
          for (var i = 0; i < 7; i++) {
            var d = addDays(ws, i);
            var dIso = iso(d);
            var opt = document.createElement('option');
            opt.value = dIso;
            opt.textContent = vnDow[d.getDay()] + ' – ' + String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
            fD.appendChild(opt);
          }
          fD.value = r.date;
          if (typeof renderAllNoFetch === 'function') {
            try { renderAllNoFetch(); } catch(e) {}
          }
          log('[AI] Đã tự chuyển sang tuần chứa ngày', r.date, '(wkOff='+wkOff+')');
        } catch(e) {
          logWarn('[AI] Không chuyển được tuần:', e.message);
        }
      }
    }
  }

  // Tiêu đề - AI luôn ghi đè (form có thể rỗng hoặc còn nội dung cũ)
  setForce('fT', r.title);

  // Buổi, giờ, loại
  setForce('fSes', r.ses);
  setForce('fS',   r.time);
  setForce('fC',   r.cat);

  // Các trường text khác - AI ghi đè (form có default như "Hội trường UBND xã")
  setForce('fL',  r.location);
  setForce('fCh', r.chair);
  setForce('fMb', r.member);
  setForce('fPr', r.prep);

  // Highlight field còn rỗng để user biết cần bổ sung
  var checkFields = ['fT', 'fS', 'fL', 'fCh', 'fMb', 'fPr'];
  checkFields.forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('ai-empty');
    if (!el.value || !el.value.trim()) {
      el.classList.add('ai-empty');
      var onInput = function() {
        el.classList.remove('ai-empty');
        el.removeEventListener('input', onInput);
      };
      el.addEventListener('input', onInput);
    }
  });

  aiDismiss();
  if (typeof showToast === 'function') showToast('✅ Đã điền thông tin từ giấy mời!');
}

function aiDismiss() {
  var bar = document.getElementById('aiReadBar');
  if (bar) bar.style.display = 'none';
  _aiResult = null;
  _pendingAiFiles = null;
}

// ══════════════════════════════════════════════════
// THÔNG BÁO NHANH (Admin → Tất cả thiết bị)
// ══════════════════════════════════════════════════
var TB_ICON = { thongbao:'📢', baotri:'🔧', khan:'🚨', nhacnho:'🔔', khac:'📌' };
var TB_LABEL = { thongbao:'Thông báo', baotri:'Bảo trì hệ thống', khan:'🚨 KHẨN CẤP', nhacnho:'Nhắc nhở', khac:'Thông báo' };
var TB_DEFAULT_TITLE = {
  thongbao: 'Thông báo từ Ban lãnh đạo',
  baotri:   'Bảo trì hệ thống',
  khan:     '🚨 Thông báo khẩn',
  nhacnho:  'Nhắc nhở',
  khac:     'Thông báo'
};

function openThongBaoNhanh() {
  // Reset form
  var loai = document.getElementById('tbLoai');
  var tieuDe = document.getElementById('tbTieuDe');
  var noiDung = document.getElementById('tbNoiDung');
  var status = document.getElementById('tbStatus');
  var sendBtn = document.getElementById('tbSendBtn');
  if (loai) loai.value = 'thongbao';
  if (tieuDe) tieuDe.value = '';
  if (noiDung) noiDung.value = '';
  if (status) { status.style.display = 'none'; status.textContent = ''; }
  if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '📤 Gửi ngay'; }
  tbCountUpdate();
  tbLoaiChange();

  // Đếm số thiết bị đã đăng ký
  var devCount = document.getElementById('tbDevCount');
  if (devCount) {
    devCount.textContent = '...';
    if (fbDb && currentUID) {
      fbDb.ref('donvi/' + currentUID + '/devices').once('value').then(function(snap) {
        var n = 0;
        snap.forEach(function(child) {
          var d = child.val();
          if (d && (d.playerId || d.token)) n++;
        });
        if (devCount) devCount.textContent = n > 0 ? n + ' thiết bị' : 'Chưa có thiết bị nào';
      }).catch(function() {
        if (devCount) devCount.textContent = 'Không xác định';
      });
    } else {
      devCount.textContent = 'Không xác định';
    }
  }

  document.getElementById('ovThongBao').classList.add('open');
  setTimeout(function() {
    var el = document.getElementById('tbNoiDung');
    if (el) el.focus();
  }, 200);
}

function closeThongBaoNhanh() {
  document.getElementById('ovThongBao').classList.remove('open');
}

function tbLoaiChange() {
  var loai = (document.getElementById('tbLoai') || {}).value || 'thongbao';
  var tieuDeEl = document.getElementById('tbTieuDe');
  if (tieuDeEl && !tieuDeEl.value.trim()) {
    tieuDeEl.value = TB_DEFAULT_TITLE[loai] || '';
  }
}

function tbCountUpdate() {
  var nd = document.getElementById('tbNoiDung');
  var cnt = document.getElementById('tbCount');
  if (nd && cnt) cnt.textContent = nd.value.length;
}

async function guiThongBaoNhanh() {
  var loai    = (document.getElementById('tbLoai')    || {}).value || 'thongbao';
  var tieuDe  = ((document.getElementById('tbTieuDe') || {}).value || '').trim();
  var noiDung = ((document.getElementById('tbNoiDung')|| {}).value || '').trim();
  var sendBtn = document.getElementById('tbSendBtn');
  var status  = document.getElementById('tbStatus');

  if (!noiDung) {
    tbShowStatus('⚠️ Vui lòng nhập nội dung thông báo', '#fff8e1', '#7a4f00');
    return;
  }
  if (!tieuDe) tieuDe = TB_DEFAULT_TITLE[loai] || 'Thông báo';

  var icon = TB_ICON[loai] || '📢';
  var fullMsg = icon + ' ' + tieuDe + ': ' + noiDung;

  // Disable button, hiện trạng thái
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '⏳ Đang gửi...'; }
  tbShowStatus('⏳ Đang gửi thông báo...', '#eef4ff', '#1a4f7a');

  try {
    // Ghi vào Firebase push_trigger — tất cả viewer đang mở app sẽ nhận ngay
    if (fbDb && currentUID) {
      var payload = {
        ts:    Date.now(),
        msg:   fullMsg,
        count: 1,
        uid:   currentUID,
        type:  'admin_broadcast',
        loai:  loai
      };
      await fbDb.ref('push_trigger/latest').set(payload);
    }

    // Gọi GAS để push đến điện thoại (app đóng vẫn nhận được)
    if (typeof GAS_PUSH_URL !== 'undefined' && GAS_PUSH_URL) {
      await fetch(
        GAS_PUSH_URL + '?action=push&count=1&msg=' + encodeURIComponent(fullMsg),
        { method: 'GET', mode: 'no-cors' }
      ).catch(function(){});
    }

    // Thành công
    tbShowStatus('✅ Đã gửi thông báo thành công!', '#e8f5e9', '#1b5e20');
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '📤 Gửi ngay'; }

    // Tự đóng modal sau 2 giây
    setTimeout(function() {
      closeThongBaoNhanh();
    }, 2000);

  } catch(e) {
    tbShowStatus('❌ Gửi thất bại: ' + (e.message || 'Lỗi không xác định'), '#fdecea', '#c0392b');
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '📤 Gửi ngay'; }
  }
}

function tbShowStatus(msg, bg, color) {
  var st = document.getElementById('tbStatus');
  if (!st) return;
  st.style.cssText = 'display:block;padding:9px 13px;border-radius:8px;font-size:12px;font-weight:700;background:' + bg + ';color:' + color + ';border:1.5px solid ' + color + '44';
  st.textContent = msg;
}

// Đóng modal khi click overlay bên ngoài
(function() {
  var ov = document.getElementById('ovThongBao');
  if (ov) ov.addEventListener('click', function(e) {
    if (e.target === ov) closeThongBaoNhanh();
  });
})();
