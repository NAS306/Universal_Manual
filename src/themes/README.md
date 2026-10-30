# 테마 추가 방법

테마는 표시 기능입니다. 매뉴얼 데이터, 백업 형식, 편집·검색·스크롤은 공통 구현을 사용합니다.

## CSS 테마를 추가하는 세 단계

1. templates/theme.css를 src/styles/themes/yourTheme.css로 복사하고 yourTheme을 영구 코드명으로 바꿉니다. 기존 테마 CSS를 출발점으로 삼아도 됩니다.
2. catalog.json 배열 끝에 다음 항목을 추가합니다.

```json
{
  "id": "yourTheme",
  "label": "새 테마",
  "styles": ["styles/themes/yourTheme.css"]
}
```

3. v4.6 폴더에서 node build.js를 실행합니다. 설정의 라디오, 코드명, 허용 ID, CSS 포함은 자동 생성됩니다. 배포 파일은 Universal_Manual_v4.6.html 하나입니다. body.html·29-theme.js·build.js의 테마별 목록을 따로 수정하지 않습니다.

id는 저장값이므로 출시 후 유지합니다. 이름만 바꿀 때는 label을 바꾸고, 구형 저장값을 지원할 때는 aliases 배열에 추가합니다. 기본 테마 modern은 첫 항목을 유지합니다. styles 경로는 src 기준이며 순서대로 합칩니다. 누락 파일, 중복 ID/별칭, 필드 오타는 빌드에서 오류로 알려 줍니다.

## 선택 사항: 장식 효과

효과가 필요한 테마에만 script 필드를 추가합니다. 예: "script": "themes/yourTheme.js". CSS만으로 표현할 수 있으면 JS를 만들지 않습니다.

```js
let decoration = null;
registerManualThemeEffect('yourTheme', {
  refresh({motionEnabled, hidden}) {
    // 여러 번 호출해도 중복 DOM·타이머가 생기지 않도록 합니다.
    // motionEnabled가 false이면 움직이는 장식을 제거하거나 정지합니다.
    // hidden이 true이면 진행 중 작업을 일시 정지합니다.
  },
  dispose() {
    decoration?.remove();
    decoration = null;
    // 자신이 만든 타이머·리스너·Observer도 여기서 정리합니다.
  }
});
```

refresh는 테마 진입·모션 설정 변경·탭 표시 변경·영역 크기 변경·글꼴 로드 때 호출됩니다. 테마 이탈 시 dispose가 먼저 호출됩니다. 열린 헤더 전용 효과는 선택적으로 updateHeader(header, expanded)를 구현할 수 있습니다. 기존 아코디언 제목 장식 앵커는 호환성을 위해 유지합니다. 별도의 enter/exit API나 런타임 외부 플러그인 로더는 없습니다.

pixel.js는 반복 띠, matrix.js는 문자 비의 실제 예제입니다. 테마 ID를 판별하는 분기를 공통 모션/편집/검색 코드에 추가하지 않습니다. 관공서처럼 모션을 잠가야 한다면 catalog.json에 motionLockReason을 지정합니다. 저장된 사용자 모션 설정은 덮어쓰지 않습니다.

## 스타일과 에셋 규칙

- 화면 규칙은 @media screen과 html[data-theme="yourTheme"] 안에 한정합니다. 인쇄·다른 테마로 새지 않도록 합니다.
- 공통 변수는 --canvas, --surface, --ink, --muted, --line, --accent, --accent-soft, --radius, --shadow입니다. 필요한 컴포넌트 색상은 테마 CSS에서 덮어씁니다. 배치와 기능 DOM을 복제하지 않습니다.
- 장식 DOM에는 aria-hidden/inert/pointer-events:none을 적용하고 검색·복사·편집 본문 밖에 둡니다. 정리 방법이 없는 무한 타이머는 사용하지 않습니다.
- 외부 CDN에 의존하지 않습니다. 새 폰트/이미지를 추가한다면 단일 HTML에 포함하는 빌드 처리와 라이선스도 함께 검토합니다. 현재 픽셀 폰트의 포함 처리는 build.js의 readStyle과 assets/fonts/에 있습니다.
- 수정 전 파일명_BU.확장자로 백업합니다. 빌드는 이전 배포 HTML도 _BU로 백업합니다.

## 확인

node --test test/theme.test.js test/theme-catalog.test.js test/reading-preferences.test.js

브라우저에서 읽기/수정, 검색 강조, 표 색상, 사전 네 배치, 설정·백업 모달, 좁은 화면, 글자 크기, 테마 왕복 전환과 위치 유지, 모션 줄이기, 인쇄를 확인합니다. 효과가 있다면 반복 전환 후 장식/리스너 중복도 확인합니다. 기본 매뉴얼의 테마 소개를 고칠 때는 사용자 수정 보존 규칙을 따릅니다.
