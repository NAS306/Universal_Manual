# Universal Manual v4.7

전역 매뉴얼·계층형 본문·용어 사전·참조를 관리하는 오프라인 단일 HTML 매뉴얼입니다.

**[웹에서 실행](https://nas306.github.io/Universal_Manual/)** · **[개발 안내](DEVELOPMENT.md)**

## 이번 업데이트

- 표 기본 너비 유지: 기본 켜짐입니다. 720px과 열 수 × 180px 중 큰 값을 최소 너비로 사용하며, 좁은 화면에서는 표 안에서 가로 스크롤합니다. 설정 → 읽기에서 끌 수 있습니다.
- URL 자동 링크: 읽기 모드에서 http://·https:// 주소를 새 탭 링크로 표시합니다. 전역·본문·표·참조·사전에 적용하며 이미지 첨부와 원문 편집을 유지합니다.
- 본문 글자 크기: 원자 크기(70%), 아주 작게(80%), 작게(90%), 기본(100%), 크게(110%), 더 크게(120%). 설정 → 읽기에서 선택하고 브라우저에 저장합니다.
- 화면 구성: 전역만, 본문만, 전역+전역, 전역+본문, 본문+본문, 본문+전역. 두 칸은 데이터를 공유하며 탭·펼침·스크롤은 독립적으로 유지합니다.
- 모바일: 헤더를 줄이고 한 번에 한 섹션을 전체 영역에 표시합니다. 두 손가락 좌우 스와이프 또는 상단 1·2 버튼으로 전환합니다. 검색 버튼으로 검색창을 펼칩니다.
- 모바일 편집 버튼: 본문 헤더 오른쪽에 불투명도 50%로 겹쳐 표시합니다. 버튼용 두 번째 행을 없애 읽기·수정 모드에서 불필요한 높이를 차지하지 않습니다.

## 사용하기

[웹 버전](https://nas306.github.io/Universal_Manual/)을 열거나 [index.html](index.html)을 내려받아 브라우저에서 엽니다. 최종 사용자는 Node.js나 추가 패키지를 설치할 필요가 없습니다. 외부 URL로 넣은 이미지는 인터넷 연결이 필요할 수 있습니다.

자료는 브라우저의 localStorage에 저장합니다. JSON 내보내기·불러오기로 자료를 교환합니다. 기본 사용 안내, 본문·표·이미지 편집, 최대 50단계 되돌리기, 사전 자동 연결, 참조 재사용, 다섯 가지 테마를 제공합니다.

## 소스와 빌드

- `src/`: 역할별 HTML·CSS·JavaScript 소스
- `build.js`: 소스를 합쳐 `index.html` 한 파일로 생성
- `src/js/27-reading-preferences.js`: 글자 크기와 읽기 설정
- `src/js/31-readable-links.js`: 읽기 모드 URL 자동 링크
- `src/js/61-table-preferences.js`: 표 기준 너비와 브라우저 설정
- `src/js/54-layout-preferences.js`: 여섯 화면 구성
- `src/js/59-mobile-workspace.js`, `src/styles/mobile.css`: 모바일 섹션과 멀티터치
- `test/`: 동작과 저장 호환성 검증

```powershell
node build.js
node --test test/*.test.js
```

배포 HTML을 직접 수정하지 않습니다. 수정 전에는 `파일명_BU.확장자`로 백업하고, `src/`를 수정한 다음 빌드합니다. 백업 파일은 저장소에 게시하지 않습니다.

브라우저 검증은 개발 환경의 Playwright를 사용합니다. 필요하면 `PLAYWRIGHT_MODULE` 환경 변수로 설치 경로를 지정한 뒤 실행합니다.

```powershell
node test/panel-layout.browser.cjs
node test/mobile-workspace.browser.cjs
node test/table-preferences.browser.cjs
node test/readable-links.browser.cjs
```

모듈 순서와 유지보수 원칙은 [DEVELOPMENT.md](DEVELOPMENT.md), 테마 등록 방법은 [src/themes/README.md](src/themes/README.md)를 참고하십시오.
