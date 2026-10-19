# Universal Manual v4.6

현장에서 필요한 내용을 빠르게 찾고, 직접 정리하는 브라우저 매뉴얼입니다. 전역 매뉴얼·계층형 본문·용어 사전·재사용 참조를 함께 사용합니다.

**[웹에서 실행](https://nas306.github.io/Universal_Manual/)** · **[개발 문서](DEVELOPMENT.md)** · **[테마 개발 안내](src/themes/README.md)**

## 시작하기

[웹 버전](https://nas306.github.io/Universal_Manual/)을 열거나 [index.html](index.html)을 내려받아 브라우저에서 엽니다. 사용 시 서버 설치나 Node.js, npm 패키지는 필요 없습니다. 파일 버전은 오프라인으로 실행되며, 사용자가 외부 주소로 추가한 이미지는 인터넷 연결이 필요할 수 있습니다.

1. 본문 제목을 눌러 항목을 열고, 상단 검색으로 필요한 내용을 찾습니다.
2. 사전에 등록된 용어를 누르면 상세 설명이 열립니다.
3. [수정 모드 켜기]로 내용을 편집하고 [편집 완료]로 결과를 확인합니다.
4. [메뉴얼 관리]에서 작업본 선택·복사, 설정, JSON 백업 내보내기·불러오기를 사용합니다.

기본 [매뉴얼 사용 안내]에는 실제로 클릭하고 편집해 볼 수 있는 사전·참조·표 예제가 있습니다.

## v4.6의 주요 기능

- 전역 매뉴얼 탭과 계층형 본문, 각 영역의 독립 스크롤
- 사용자 정의 용어 사전과 본문 자동 연결, 편집 중 Tab 자동완성
- 사전 배치: 밀기, 3분할, 오른쪽/왼쪽 겹치기와 너비 조절
- 반복 내용을 한 번에 관리하는 참조 변수; 일반 본문·표에서 사용하는 참조 내용도 검색
- 본문·표·이미지·강조·기울임·리스트 편집, 최대 50단계 되돌리기와 화면 위치 유지
- 글자 크기 90~120%, 모션 줄이기, 선택 가능한 헤더 상단 정렬
- 기본·클래식·픽셀비트·관공서·매트릭스 테마와 확장 가능한 테마 등록 목록
- 기존 JSON 백업 불러오기, 선택 항목 불러오기, 참조·사전의 하단 고정

자료를 둘 때는 항상 보는 필수 내용은 전역, 단계별 할 일은 본문, 긴 설명과 이유는 사전, 반복 문구는 참조에 정리하면 됩니다. 참조·사전 원본은 검색에서 제외합니다.

## 저장과 백업

내용은 브라우저 localStorage에 저장됩니다. 계정이나 서버 동기화 기능은 없습니다. 중요한 자료는 메뉴의 [파일로 내보내기]로 JSON 백업을 보관하십시오. 브라우저·프로필·실행 주소가 바뀌면 별도의 저장 공간을 사용하므로 JSON 파일로 옮깁니다. 같은 웹 주소에서의 업데이트는 기존 작업본 저장 방식을 유지합니다.

되돌리기 이력은 최대 50단계이며 현재 세션에서 사용합니다. 작업본 전환·불러오기·새로고침 후까지 유지되는 백업은 아닙니다.

## 소스와 빌드

| 경로 | 역할 |
| --- | --- |
| [index.html](index.html) | 배포용 단일 HTML 및 GitHub Pages 진입점 |
| [build.js](build.js) | 소스 모듈을 index.html로 통합 |
| src/html · src/styles · src/js | 화면 구조, CSS, 역할별 기능 모듈 |
| [src/themes/catalog.json](src/themes/catalog.json) | 테마 이름·코드명·CSS·선택 효과 등록 |
| [lib/theme-catalog.js](lib/theme-catalog.js) | 빌드 시 테마 정보 검증 |
| test | 동작·저장·검색·기본 안내·테마 회귀 검증 |
| [DEVELOPMENT.md](DEVELOPMENT.md) | 데이터 원칙, 모듈 역할, 유지보수 방법 |
| [Universal_Manual_v3.1.md](Universal_Manual_v3.1.md) | 이전 v3.1 기술 문서 (역사 자료) |

개발할 때는 소스를 수정하고 Node.js로 빌드합니다. 추가 패키지 설치는 필요 없습니다.

~~~powershell
node build.js
~~~

기존 index.html은 빌드 전에 index_BU.html로 백업됩니다. 파일 수정 전에는 파일명_BU.확장자로 백업하고, _BU 파일은 Git 업로드에서 제외합니다. 이전 JSON 호환성을 유지하며, 배포 HTML을 직접 편집하지 않습니다.

## 검증

~~~powershell
node --test test/default-guide.test.js test/theme.test.js test/theme-catalog.test.js test/reading-preferences.test.js test/accordion-scroll.test.js test/optimization.test.js test/search.test.js test/dictionary.test.js test/markdown-editing.test.js test/storage-regressions.test.js
~~~

테마의 설정 선택지와 CSS/효과 포함은 catalog.json에서 생성합니다. 새 테마는 [테마 개발 안내](src/themes/README.md)의 템플릿과 등록 절차를 따르십시오. 브라우저에서 읽기·수정·검색·사전·백업·좁은 화면·인쇄도 확인합니다. 픽셀 글꼴의 라이선스는 [src/assets/fonts](src/assets/fonts)에 포함되어 있습니다.
