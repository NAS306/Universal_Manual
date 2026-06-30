# Universal Manual v3.1 기술 문서

## 1. 프로그램 정의

`Universal_Manual_v3.1.html`은 서버, 빌드 과정, 외부 라이브러리 없이 브라우저에서 단독 실행하는 **로컬 매뉴얼 작성·열람 프로그램**이다. 사용자는 계층형 아코디언 문서, 공통 안내문, 표, 이미지, 재사용 참조값을 편집하고 브라우저 `localStorage` 또는 JSON 파일로 보관한다.

주요 실행 환경은 최신 데스크톱/모바일 브라우저다. 네트워크 API, 인증, 백엔드는 사용하지 않으며, 데이터의 영속성은 실행한 브라우저와 origin에 종속된다.

## 2. 화면과 주요 기능

| 영역 | 역할 |
| --- | --- |
| 좌측 공통 매뉴얼 | 문서 제목, 전체 안내문, 전체 검색 |
| 우측 아코디언 | 계층형 항목의 제목·본문·표 열람/편집 |
| 좌측 상단 메뉴 | 작업본 선택/복사, 읽기·수정 모드 전환, JSON 내보내기·불러오기, 현재 작업본 초기화 |

### 모드

- `read`: Markdown 일부와 참조 토큰을 해석해 표시한다. 항목 헤더를 클릭하면 같은 계층의 다른 열린 항목은 닫히며, 상위 항목을 닫으면 모든 하위 항목도 닫힌다.
- `edit`: 제목·공통 안내문·본문·표 셀을 직접 편집하고, 항목/표 조작 버튼을 표시한다. 헤더를 400ms 이상 길게 눌러 항목을 이동할 수 있다.

### 되돌리기

수정 모드에서 `Ctrl+Z`(macOS는 `Cmd+Z`)를 누르면 변경 직전의 전체 `manualData` 스냅샷으로 돌아간다. 최대 100개까지 메모리에 보관하므로 본문, 표, 항목 구조, 드래그 이동을 되돌릴 수 있다.

되돌리기 기록은 현재 페이지가 열려 있는 동안의 메모리 상태다. 작업본 전환, 복사, JSON 불러오기, 초기화 시 새로 시작하며, 새로고침하거나 브라우저를 닫은 뒤에는 이전 기록을 복원하지 않는다.

### 검색

검색 대상은 각 아코디언 항목의 `title`, `content`, 모든 표의 원본 `cells` 값이다. 공통 안내문은 하이라이트만 적용되며 검색 결과 항목에는 포함하지 않는다. 입력 후 700ms 디바운스로 검색하고, 이전/다음 버튼 또는 편집 영역 밖에서 좌우 방향키로 결과를 순환한다.

## 3. 데이터 모델

런타임의 단일 원본은 전역 변수 `manualData`다. 기본값은 `DEFAULT_DATA`이며, 저장·백업 시 이 객체 전체를 JSON으로 직렬화한다.

```ts
interface ManualData {
  manualName?: string;
  globalManual?: string;
  globalImages?: StoredImage[];
  menu: ManualItem[];
  descriptionSectionMigrated?: boolean;
}

interface ManualItem {
  title: string;
  content: string;
  images?: StoredImage[];
  tables?: ManualTable[];
  children?: ManualItem[];
  isReferenceSection?: boolean;
  isDescriptionSection?: boolean;
}

interface ManualTable {
  rows: number;
  cols: number;
  cells: string[][];
  cellColors?: ('' | 'blue' | 'red' | 'green')[][];
  cellMerges?: Record<`${number}:${number}`, { rows: number; cols: number }>;
  cellImages?: StoredImage[][][];
}

interface StoredImage {
  id: string;
  url: string;
  width: number;  // 부모 요소 너비 대비 %, 10~100
  offset: number; // 연결된 텍스트 안의 문자 위치
}
```

항목 위치는 `path: number[]`로 표현한다. 예를 들어 `[2, 0]`은 `manualData.menu[2].children[0]`이며, DOM에는 `data-path="2.0"` 형태로 연결된다.

### 시스템 항목

`ensureSystemSections()`는 렌더링과 저장 전 다음 조건을 보정한다.

1. `참조` 루트 항목은 반드시 존재하고 항상 `menu[0]`에 위치한다.
2. `참조` 루트 자체에는 표가 없고, 자식은 한 단계까지만 허용한다.
3. 설명 섹션 마이그레이션 표식이 없으면 첫 번째 일반 루트 항목에 `isDescriptionSection: true`를 부여하고 `descriptionSectionMigrated`를 기록한다.
4. 이미지 목록과 표 구조를 정규화해 이전 데이터와 새 데이터가 같은 렌더링 경로를 타도록 한다.

## 4. 텍스트, 참조, 표

### 본문 Markdown

완전한 Markdown 구현은 아니며 다음 규칙만 적용한다.

- `**텍스트**` -> `<strong>`
- `*텍스트*` -> `<em>`
- 줄 시작의 `숫자. 공백` -> 들여쓴 블록
- 줄바꿈 -> `<br>`

렌더링 전 HTML 특수문자를 이스케이프하므로 일반 본문 HTML은 실행되지 않는다.

수정 모드에서도 Markdown 강조 표시는 즉시 시각화한다. 이때 `**`와 `*` 기호를 제거하지 않고 기호까지 포함한 원문 전체에 스타일을 적용한다. 저장 데이터는 원문 문자열 그대로 유지되며, `appendEditableMarkdownText()`와 `refreshEditableMarkdown()`이 편집 중 표시와 커서 복원을 담당한다.

### 참조 토큰

`참조` 루트의 직계 자식 제목이 참조 키이고, 그 자식의 본문·표·이미지가 참조값이다. 본문이나 표에 `{{키}}`를 쓰면 읽기 모드에서 해당 값으로 치환한다.

없는 키는 빨간 `{{키}}`로 남는다. 순환 참조는 `seenReferences` 집합으로 탐지해 빨간 순환 참조 표기로 멈춘다. 같은 키가 중복되면 `Map.set` 특성상 나중 자식이 이전 값을 덮어쓴다.

### 표

표는 모든 셀 내용을 `cells[row][col]`에 저장한다. 병합 정보는 `cellMerges`, 배경색은 `cellColors`, 셀 이미지는 `cellImages`에 별도 메타데이터로 저장한다.

이전 버전 백업에 남아 있는 셀 앞부분의 `<rN>`, `<cN>`, `<tint>` 표기는 로드 또는 import 시 한 번 메타데이터로 이관하고 셀 본문에서 제거한다. 새 표에는 이 태그를 해석하거나 생성하지 않는다.

## 5. 저장과 작업본

### localStorage

현재 작업본 key는 `activeStorageKey`이며 기본값은 `manualData()`다. URL fragment가 있으면 `decodeURIComponent(location.hash.slice(1))`를 현재 key로 사용한다. 선택/생성한 key는 `history.replaceState`로 URL hash에도 기록되어 같은 URL을 다시 열 때 해당 작업본을 우선 로드한다.

| 동작 | 결과 |
| --- | --- |
| 일반 입력 저장 | 400ms 디바운스 후 현재 key에 `JSON.stringify(manualData)` 저장 |
| 즉시 저장 | 작업본 전환, import, reset, blur/pagehide/hidden 등에 사용 |
| 작업본 선택 | 기존 작업본을 즉시 저장한 뒤 선택 key를 로드·렌더링 |
| 작업본 복사 | 현재 객체를 새 `manualData(이름)` key로 저장하고 그 복사본으로 전환 |
| 제목 확정 | 현재 key를 `manualData(문서 제목)`으로 변경; 대상 key가 있으면 취소 |

`manualName`이 비어 있으면 표시명과 key명에는 `무제`를 사용한다. 백업 파일명에서는 `\ / : * ? " < > |`를 `_`로 치환한다.

### JSON 백업

- 내보내기: 현재 `manualData`를 들여쓰기 2칸 JSON으로 내려받는다. 파일명은 `메뉴얼_백업_{안전한 제목}_{YYYY-MM-DD}.json`이다.
- 불러오기: `.json` 파일을 `FileReader.readAsText`로 읽고, `menu` 배열이 있는 객체인지 확인한 뒤 선택 불러오기 모달을 연다.
- 초기화: 이중 확인 후 현재 active key만 `DEFAULT_DATA`로 되돌린다. 다른 작업본은 유지한다.

### v3.1 선택 불러오기

v3.1의 `importBackup()`은 JSON 전체를 즉시 `manualData`에 대입하지 않는다. 대신 `openBackupImportModal()`을 호출해 백업 파일의 `menu`를 항목 이름만 보이는 트리로 표시한다.

모달 구성:

- 항목별 체크박스: 체크한 항목만 가져온다.
- 전체 선택 체크박스: 트리의 모든 항목을 선택/해제한다.
- 중복 항목 처리 라디오: 같은 이름·같은 계층 항목을 만났을 때의 병합 방식을 정한다.
- 취소/선택 항목 불러오기 버튼
- 바깥 클릭 또는 `Esc`로 닫기

선택 트리의 체크 상태는 하위 항목으로 전파되고, 부모 항목은 하위 선택 상태에 따라 checked/indeterminate 상태를 갱신한다.

#### 중복 항목 처리 규칙

중복 판단 기준은 **같은 부모 배열 안에서 `title`이 같은 항목**이다. 즉 같은 이름이라도 계층이 다르면 중복으로 보지 않는다.

| 모드 값 | UI 표시 | 처리 |
| --- | --- | --- |
| `overwrite` | 덮어씌우기 우선 | 같은 항목의 본문, 표, 이미지 등 `children` 외 속성을 백업 값으로 갱신하고 하위 항목은 같은 규칙으로 병합한다. 기본값이다. |
| `importAll` | 중복 무시하고 전부 불러오기 | 같은 이름이 있어도 백업 항목 전체를 새 형제 항목으로 추가한다. |
| `newOnly` | 새로운 것만 불러오기 | 같은 항목 자체는 기존 값을 유지하고, 그 하위에서 아직 없는 항목만 추가한다. |

관련 함수:

| 함수 | 책임 |
| --- | --- |
| `openBackupImportModal` | 선택 불러오기 모달 생성과 이벤트 연결 |
| `createBackupTreeList` | 백업 `menu`를 체크박스 트리 DOM으로 변환 |
| `setBackupTreeChecked` / `updateBackupTreeAncestors` | 선택 상태 전파와 부모 indeterminate 갱신 |
| `cloneManualItemForImport` | 선택된 path에 해당하는 항목만 복제 |
| `mergeImportedItem` | 중복 처리 모드에 따라 현재 메뉴얼에 병합 |
| `importSelectedBackupItems` | 선택 항목 검증, 병합, 정규화, 저장, 렌더링 |

## 6. 렌더링과 상태 흐름

```text
초기 로드
  URL hash -> activeStorageKey 결정 -> localStorage 로드(없으면 기본값 저장)
  -> ensureSystemSections -> renderAll

사용자 편집
  DOM input -> manualData 갱신 -> saveToLocalStorage(대개 400ms 지연)

구조 변경/모드 전환
  열린 항목 객체 참조 수집 -> 데이터 변경 -> 전체/아코디언 리렌더링
  -> 변경 전 경로를 다시 찾아 이전에 열려 있던 항목 재개방

JSON 선택 불러오기
  파일 선택 -> JSON 파싱 -> 선택 모달 표시
  -> 선택 path와 중복 처리 모드 수집 -> mergeImportedItem
  -> ensureSystemSections/normalizeAllTables -> 저장/렌더링

수정 모드 우클릭
  본문/표 셀/이미지 우클릭 -> showUnifiedContextMenu
  -> 현재 위치와 기능 가능 여부에 따라 버튼 활성/비활성
  -> 이미지 추가/삭제, 참조 삽입, 표 색상, 셀 병합/해제 수행
```

`renderAll()`은 `renderGlobal()`, `renderAccordion()`, 검색 하이라이트 갱신, 모드 버튼 및 작업본 목록 갱신을 수행한다.

## 7. 항목 조작과 드래그

수정 모드에서 항목 위/아래 삽입, 자식 추가, 제목 변경, 삭제를 지원한다. 삭제는 해당 항목과 전체 하위 트리를 제거한다.

드래그는 헤더를 400ms 길게 눌러 시작한다. 대상 헤더의 세로 영역을 3등분해 위/가운데/아래에 따라 앞 형제, 마지막 자식, 뒤 형제로 이동한다. 자기 자신, 자기 하위, 참조 루트는 드롭 대상으로 거부한다.

## 8. 이미지 삽입·배치·크기 조절

이미지는 본문 문자열 안에 직접 삽입하지 않고 `StoredImage` 메타데이터로 저장한다. 본문 항목은 `ManualItem.images`, 표 셀은 `ManualTable.cellImages[row][col]`에 이미지 목록을 보관한다.

- 수정 모드에서 본문, 표 셀, 이미지 위를 우클릭하면 동일한 `editor-context-menu` 기반 편집 메뉴가 표시된다.
- 사용할 수 없는 기능은 숨기지 않고 비활성화한다. 예를 들어 본문에서는 셀 병합/색상 버튼이 비활성화되고, 이미지 위에서는 이미지 삭제 버튼이 활성화된다.
- URL을 입력하면 커서 위치에 이미지가 삽입되고, 저장 시 텍스트 기준 `offset`이 기록된다.
- 읽기 모드에서는 `offset` 순서대로 텍스트와 이미지를 다시 조합한다.
- 수정 모드에서 이미지 핸들을 드래그하면 `width` 비율을 10~100 범위로 갱신한다. 드래그 중에는 핸들과 `document` 양쪽에 `pointermove/up/cancel`을 연결해 포인터가 핸들 밖으로 나가도 크기 조절이 이어지도록 한다.
- 크기 조절 종료 시 편집 영역에 `input` 이벤트를 발생시켜 이미지 메타데이터가 재직렬화되고 저장되도록 한다.
- 읽기 모드에서 이미지를 더블 클릭하면 확대 레이어를 열고, 배경 클릭·이미지 더블 클릭·`Esc`로 닫는다.

### 통합 편집 메뉴

v3.1 안정화 버전의 우클릭 메뉴는 `showUnifiedContextMenu()`가 단일 진입점이다. 본문, 표 셀, 이미지 우클릭은 모두 이 함수로 들어오며, 위치별 컨텍스트만 다르게 전달한다.

| 컨텍스트 | 활성 기능 |
| --- | --- |
| 본문 | 이미지 추가, 참조 삽입 |
| 표 셀 | 이미지 추가, 참조 삽입, 셀 색상, 셀 병합/해제 |
| 이미지 | 이미지 삭제, 참조 삽입 |

메뉴 바깥 클릭은 `pointerdown` 캡처 단계에서 감지해 닫는다. `Esc`도 편집 메뉴와 참조 자동완성 팝업을 함께 닫는다.

## 9. 구현 경계와 유지보수 주의점

- 단일 HTML과 전역 함수, 인라인 `onclick`에 의존한다. 모듈 시스템이나 패키지 관리는 없다.
- `localStorage`는 브라우저 데이터 삭제, 시크릿 모드, 다른 origin/브라우저에서 공유되지 않는다. 중요한 문서는 JSON 백업이 필요하다.
- JSON import는 `menu` 배열 존재 여부만 최소 검증한다. 외부 백업을 신뢰 경계로 다룬다면 스키마 검증을 추가해야 한다.
- 선택 불러오기에서 중복 기준은 제목 문자열이다. 같은 부모 아래 같은 제목을 의도적으로 여러 개 쓰는 문서에서는 `overwrite`와 `newOnly`가 첫 번째 일치 항목을 기준으로 동작한다.
- 편집 우클릭 메뉴는 `editor-context-menu` 하나로 통합되어 있다. 새 우클릭 기능을 추가할 때는 별도 메뉴를 만들기보다 `showUnifiedContextMenu()`의 컨텍스트 옵션과 버튼 활성 조건을 확장한다.
- 이미지 크기 조절은 드래그 이벤트를 `document`에도 등록한다. 이 로직을 수정할 때는 핸들 밖 드래그, 저장 반영, `pointercancel` 정리를 함께 검증해야 한다.
- 검색은 렌더된 텍스트 노드를 직접 `<mark>`로 교체했다가 복원한다. 검색 상태에서 렌더링 구조를 바꾸는 기능을 추가할 때는 `clearSearchHighlights()` 호출 순서를 유지해야 한다.
- 되돌리기 이력은 메모리 전용이다. 세션을 넘어 보존하려면 별도의 저장 정책과 용량 제한이 필요하다.

## 10. 핵심 함수 색인

| 함수 | 책임 |
| --- | --- |
| `loadFromLocalStorage` / `saveToLocalStorage` | 현재 작업본의 로드·디바운스 저장 |
| `ensureSystemSections` | 참조/설명 시스템 항목과 이미지 구조 보정 |
| `renderAll` | 전체 화면 리렌더링 진입점 |
| `markdownToHtml` / `replaceReferenceTokens` | 제한 Markdown과 참조 치환 |
| `normalizeTable` | 표 데이터의 호환성 정규화 |
| `createItem` / `createTableElement` | 아코디언과 표 DOM 생성 및 이벤트 연결 |
| `applyManualSearch` / `moveSearchResult` | 검색 결과 계산·순회·하이라이트 |
| `moveItemToDropTarget` | 드롭 규칙에 따른 트리 재배치 |
| `createStorageKey` / `selectStorageKey` | 다중 작업본 생성·전환 |
| `exportBackup` / `importBackup` | JSON 파일 내보내기와 선택 불러오기 진입점 |
| `openBackupImportModal` / `mergeImportedItem` | v3.1 선택 불러오기 UI와 중복 병합 처리 |
| `showUnifiedContextMenu` / `closeEditorContextMenu` | 본문·표 셀·이미지 공통 우클릭 메뉴 생성과 닫기 |
| `normalizeImageList` / `renderContentWithImages` / `serializeContentWithImages` | 이미지 메타데이터 정규화·렌더링·저장 |
| `createStoredImageElement` | 이미지 DOM, 삭제 메뉴 연결, 크기 조절 핸들 이벤트 연결 |
