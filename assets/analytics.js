/* 사이트 전체가 함께 쓰는 측정 스크립트.
 *
 * 여기 ID 하나만 채우면 15개 페이지 전부가 한 번에 측정되기 시작한다.
 * 비어 있는 동안은 아무 요청도 보내지 않는다 (완전 무동작).
 *
 * 받는 법: analytics.google.com → 관리 → 데이터 스트림 → 웹 스트림 추가
 *          → 측정 ID(G-XXXXXXXXXX) 복사 → 아래 한 줄에 붙여넣기 → 커밋.
 *
 * 쓰는 법: 어느 페이지에서든 track('이벤트이름', { 키: 값 })
 */
(function () {
  'use strict';

  var MEASUREMENT_ID = '';   // ← 여기에 G-XXXXXXXXXX 를 넣으세요

  // ID 가 없어도 track() 은 정의해 둔다. 페이지마다 "측정을 켰나" 를 따지지 않게 하려는 것.
  // 다만 이 파일 자체가 안 불려올 수도 있으니, 호출부에서는 window.track 유무를 한 번 본다.
  if (!MEASUREMENT_ID) {
    window.track = function () {};
    return;
  }

  // 어느 도구가 사람을 데려오는지 보려고 경로 첫 칸을 묶어서 보낸다.
  // (/m7/aapl/ 과 /m7/nvda/ 를 따로 세면 m7 전체 기여도가 안 보인다)
  var section = (location.pathname.split('/')[1] || 'home').toLowerCase();

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  gtag('js', new Date());
  gtag('config', MEASUREMENT_ID, { section: section });

  window.track = function (name, params) {
    gtag('event', name, Object.assign({ section: section }, params || {}));
  };

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(MEASUREMENT_ID);
  document.head.appendChild(s);
})();
