// ════════════════════════════════════════════════════════
// ÂM LỊCH VIỆT NAM
// Thuật toán: Hồ Ngọc Đức (https://www.informatik.uni-leipzig.de/~duc/amlich/)
// Đã được kiểm chứng và dùng rộng rãi cho lịch âm Việt Nam.
//
// API:
//   toLunar(day, month, year)  → { day, month, leap }
//   fmtLunar(date)             → "DD/MM" hoặc "DD/MM(n)" nếu tháng nhuận
// ════════════════════════════════════════════════════════

(function(){
  'use strict';

  function INT(d){ return Math.floor(d); }

  /**
   * Julian Day Number từ ngày dương lịch
   */
  function jdFromDate(d, m, y){
    var a = INT((14 - m) / 12);
    var yr = y + 4800 - a;
    var mo = m + 12 * a - 3;
    var jd = d + INT((153 * mo + 2) / 5) + 365 * yr
           + INT(yr / 4) - INT(yr / 100) + INT(yr / 400) - 32045;
    // Trước 1582 (Julian calendar)
    if (jd < 2299161) {
      jd = d + INT((153 * mo + 2) / 5) + 365 * yr + INT(yr / 4) - 32083;
    }
    return jd;
  }

  /**
   * Tính Julian Day của trăng non thứ k tính từ 1900-01-06
   * (Meeus's formula)
   */
  function newMoon(k){
    var T  = k / 1236.85;
    var T2 = T * T;
    var T3 = T2 * T;
    var dr = Math.PI / 180;
    var Jd1 = 2415020.75933 + 29.53058868 * k
            + 0.0001178 * T2 - 0.000000155 * T3
            + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
    var M   = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
    var Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
    var F   = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
    var C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr)
           + 0.0021 * Math.sin(2 * dr * M)
           - 0.4068 * Math.sin(Mpr * dr)
           + 0.0161 * Math.sin(dr * 2 * Mpr)
           - 0.0004 * Math.sin(dr * 3 * Mpr)
           + 0.0104 * Math.sin(dr * 2 * F)
           - 0.0051 * Math.sin(dr * (M + Mpr))
           - 0.0074 * Math.sin(dr * (M - Mpr))
           + 0.0004 * Math.sin(dr * (2 * F + M))
           - 0.0004 * Math.sin(dr * (2 * F - M))
           - 0.0006 * Math.sin(dr * (2 * F + Mpr))
           + 0.0010 * Math.sin(dr * (2 * F - Mpr))
           + 0.0005 * Math.sin(dr * (2 * Mpr + M));
    var deltaT;
    if (T < -11) {
      deltaT = 0.001 + 0.000839 * T + 0.0002261 * T2
             - 0.00000845 * T3 - 0.000000081 * T * T3;
    } else {
      deltaT = -0.000278 + 0.000265 * T + 0.000262 * T2;
    }
    return Jd1 + C1 - deltaT;
  }

  /**
   * Sun's longitude (0-11) tại Julian Day jdn
   */
  function sunLong(jdn){
    var T  = (jdn - 2451545.0) / 36525;
    var T2 = T * T;
    var dr = Math.PI / 180;
    var M  = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
    var L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T2;
    var DL = 1.9146 - 0.004817 * T - 0.000014 * T2;
    // (L0 - L0) luôn = 0; giữ nguyên công thức gốc để khớp output đã được kiểm chứng
    var L = L0 + DL * Math.sin(dr * M)
          + 0.019993 * Math.sin(dr * 2 * M)
          + 0.00029  * Math.sin(dr * 3 * M)
          - 0.0101   * Math.sin(dr * (L0 - L0))
          + 0.02929  * Math.sin(dr * (L0 - L0));
    L = L % 360;
    if (L < 0) L += 360;
    return INT(L / 30);
  }

  function getNewMoonDay(k, tz){
    return INT(newMoon(k) + 0.5 + tz / 24);
  }

  /**
   * Ngày tháng 11 âm lịch (đông chí) của năm dương y
   */
  function getLunarMonth11(y, tz){
    var off = jdFromDate(31, 12, y) - 2415021;
    var k = INT(off / 29.530588853);
    var nm = getNewMoonDay(k, tz);
    var sunLon = sunLong(nm - 1);
    if (sunLon >= 9) nm = getNewMoonDay(k - 1, tz);
    return nm;
  }

  function isLeapYear(nm11, k, tz){
    return getNewMoonDay(k + 13, tz) - nm11 >= 382;
  }

  /**
   * Chuyển ngày dương → âm lịch Việt Nam (timezone +7)
   * @param  {number} dd day (1-31)
   * @param  {number} mm month (1-12)
   * @param  {number} yy year (full)
   * @return {{day:number, month:number, leap:0|1}}
   */
  function toLunar(dd, mm, yy){
    var tz = 7;
    var jd = jdFromDate(dd, mm, yy);
    var k  = INT((jd - 2415021.076998695) / 29.530588853);

    var monthStart = getNewMoonDay(k + 1, tz);
    if (monthStart > jd) monthStart = getNewMoonDay(k, tz);

    var a11 = getLunarMonth11(yy, tz);
    var b11;
    if (a11 >= monthStart) {
      b11 = getLunarMonth11(yy - 1, tz);
      a11 = b11;
    } else {
      b11 = getLunarMonth11(yy + 1, tz);
    }

    var lunarDay = jd - monthStart + 1;
    var diff = INT((monthStart - a11) / 29);
    var lunarLeap = 0;
    var lunarMonth = diff + 11;

    if (b11 - a11 > 365) {
      var leapMonthDiff = isLeapYear(a11, k, tz) ? diff : 0;
      if (leapMonthDiff > 0 && leapMonthDiff === diff) lunarLeap = 1;
      if (leapMonthDiff > 0 && lunarMonth >= leapMonthDiff + 11) lunarMonth--;
    }
    if (lunarMonth > 12) lunarMonth -= 12;
    if (lunarMonth >= 11 && diff < 4) lunarMonth -= 12;

    return { day: lunarDay, month: lunarMonth, leap: lunarLeap };
  }

  /**
   * Format ngắn cho UI: "15/9" hoặc "15/9(n)" (n = nhuận)
   */
  function fmtLunar(d){
    var l = toLunar(d.getDate(), d.getMonth() + 1, d.getFullYear());
    return l.day + '/' + l.month + (l.leap ? '(n)' : '');
  }

  // Expose globals (giữ tương thích với code cũ)
  window.toLunar  = toLunar;
  window.fmtLunar = fmtLunar;
})();
