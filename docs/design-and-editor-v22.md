# v22 — 참고 디자인 적용과 모바일 편집 탐색

## 디자인 방향

사용자가 제공한 MODO / EVORA / NORD 참고 화면에서 큰 편집형 제목,
사진 중심 첫 화면, 아이보리·짙은 색 대비, 얇은 구분선과 여백을 채택했다.
기존 찬양팀 기능과 교회별 자료·권한 모델은 유지한다.

- 가입과 이번 주 화면에 `PRAISE.` 대형 제목과 예배 공간 이미지를 적용했다.
- 모바일 주간 화면은 사진 영역을 짧게 하여 실제 곡 목록에 빠르게 접근한다.
- 악보도서관, 고정찬양, 프로필, 소통, 버튼과 탭의 색상·여백을 맞췄다.
- 말씀 카드는 짙은 배경과 밝은 본문으로 구분한다.
- 개발 요청과 전체 교회 관리는 기존 하단 공통 메뉴에 모으고,
  프로필 상단에 중복되던 진입 카드는 제거했다.
- 악보 편집 도구에는 큰 장식 제목이나 사진을 넣지 않았다.

## 모바일 편집 개선

- 곡·송폼 설정 ↔ 악보·구간 표시 전환 메뉴를 편집용 스크롤 영역 밖,
  대화상자의 마지막 고정 행으로 이동했다. 두 모드에서 같은 메뉴를 유지한다.
- 상단에는 간단한 돌아가기 버튼도 유지했다.
- 모바일 키보드·회전으로 보이는 영역이 변하면 편집 창의 높이와 위치를
  VisualViewport에 맞춘다. 기본 배율에서만 적용하며 네이티브 확대는 방해하지 않는다.
- 홈 표시줄 안전 영역을 확보하고, 짧은 화면에서는 편집 도구 영역을 스크롤한다.
- 설정 ↔ 악보 이동 시 각 영역의 스크롤 위치를 기억한다.
- 되돌리기/다시 실행은 현재 악보 페이지 ID를 유지하며, 삭제된 경우에만 유효한 페이지로 이동한다.
- 모든 찬양 추가 버튼은 동일한 30곡 제한을 사용한다.
- 악보 렌더링 실패 시 재시도하고, 다른 페이지의 오래된 위치 정보로 표시를 이동하지 않도록 막는다.

## 이미지 제작

기본 image_gen 도구로 새 장식 이미지를 생성했다. 특정 실제 교회의 사진이 아니며,
HTML에서 장식용 빈 alt로 제공한다. 생성 PNG를 WebP로 인코딩했다.

- `public/images/worship-dawn.webp`: 129,824 bytes
- `public/images/worship-dawn-mobile.webp`: 41,360 bytes
- 반응형 picture로 모바일 전송량을 줄이며 이미지 비율을 지정한다.

생성 프롬프트:
> Use case: photorealistic-natural. Asset type: wide editorial website hero background for a Korean Protestant worship team app, premium quiet design. Create a cinematic natural photograph of a modest modern timber chapel rehearsal corner, walnut piano and an understated music stand on the right, large floor to ceiling window overlooking dark forested mountain ridges and pale morning mist. A small simple cross integrated naturally into a distant wood wall, subtle not dominant. No people. Warm gentle dawn light touching the wood and dark ivory linen surfaces, rich charcoal evergreen shadows, soft film grain and restrained warm neutrals. 16:9 landscape composition, piano and architecture concentrated in right half, left half dark calm uninterrupted space for white live HTML headings; upper band also quiet enough for very large headline overlay. Premium architecture editorial photography, believable Protestant worship setting, intimate and contemplative, no kitsch, no artificial glow, no text, no logos, no watermarks. This is a new decorative background asset, not a screenshot or UI mockup.

## 검증 범위와 한계

- TypeScript, 프로덕션 빌드, 악보 이미지 생성 회귀 검사.
- 페이지 유지/순서 변경/페이지 삭제의 위치 복원 테스트.
- 모바일 키보드·회전·확대·PC의 viewport 계산 테스트.
- 실제 전환 메뉴와 hero 컴포넌트의 서버 렌더링 및 메뉴 구조 검사.
- 실제 가입 진입과 예배 저장 API 회귀 검사(독립된 로컬 테스트 데이터).
- 허용된 브라우저 QA 도구가 없어 실제 Safari/Chrome 화면 및 터치 동작은
  직접 검증하지 못했다. 코드·렌더링·API 검증을 실기기 검수로 표현하지 않는다.

API 참고: [MDN VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport),
[offsetTop](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport/offsetTop).
