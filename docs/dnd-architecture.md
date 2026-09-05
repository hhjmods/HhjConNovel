# Story Drag & Drop Architecture

이 문서는 현재 정상 동작이 확인된 원고 Drag & Drop 런타임을 리팩터링할 때 지켜야 할 기준을 기록한다.

## 안정 앵커

- Public: `hhjmods/HhjConNovel` `3a2c87fe89a510c915b220a4000d49d7716286d9`
- Dev: `hhjmods/HhjConNovel-Dev` `e7c92ab64f3abcc1d857c859328dfa7857a7afea`
- 두 저장소 모두 `stable-anchor-20260906` 브랜치가 위 커밋을 가리킨다.

리팩터링 중 회귀가 생기면 기능별 추측 롤백보다 이 앵커와 현재 변경분을 비교하는 것을 우선한다.

## 현재 이벤트 흐름

현재 DnD는 한 파일이 아니라 아래 계층이 협력한다.

1. `story-drag-guard.js`
   - 원고 콘 드래그의 `application/x-hhjstory-ids` payload를 capture 단계에서 먼저 고정한다.
   - `app.js` 재렌더 때문에 native drag source가 사라지는 문제를 막는다.
   - 원고 영역의 dragover를 기본적으로 허용한다.
2. `app.js`
   - 실제 원고 상태(`state.story.items`)의 추가/이동/저장을 담당한다.
   - 최종 변경 함수는 `addConBlocks()`와 `reorderStoryItems()`이다.
   - `renderStory()`는 원고 DOM 전체를 다시 생성한다.
3. `drag-start-fix.js`
   - 라이브러리 콘의 첫 press-drag가 선택 재렌더로 끊기는 문제를 capture 단계에서 우회한다.
4. `story-insertion.js`
   - 대사/줄바꿈 drag handle을 붙인다.
   - 실제 drop hit target인 `.story-insert-slot`을 만든다.
   - 줄바꿈 sentinel을 기존 text 블록 위에 구현한다.
5. `story-con-run-end-drop.js`
   - 같은 줄 마지막 콘 오른쪽 빈 공간을 fixed hit-zone으로 보완한다.
6. `story-slot-mode.js`
   - 현재 보이는 fixed 삽입 가이드의 위치와 방향을 계산한다.
   - moving row를 제외한 논리 순서로 boundary를 계산한다.
   - 필요한 경우 실제 DOM drop target으로 원본 `DataTransfer`를 재전달한다.
7. `story-drag-autoscroll.js`
   - native drag 중 원고 상하단 가장자리 자동 스크롤만 담당한다.
8. `story-drag-stability.js`
   - 자기 위치 drop no-op, block handle payload 보강, drag 종료 장식 정리를 담당한다.
9. `story-tail-blank-drop.js`
   - 마지막 실제 블록 아래의 빈 원고 배경을 append drop으로 연결한다.
10. `story-output-tools.js`
   - 이미지 마커를 text sentinel 위에 구현하고 이미지 마커 drag handle을 보강한다.

## 중요한 구조적 사실

### fixed guide와 실제 drop target은 다르다

`.story-drop-guide`는 시각 표시다. 실제 drop 처리는 아직 `.story-insert-slot`, `.story-tail-drop`, story row, run-end hit-zone과 `app.js`가 담당한다.

따라서 "가이드가 잘 보인다"와 "drop이 실제 상태 변경까지 도달한다"는 별개의 단계다.

### `renderStory()`는 DOM 전체를 교체한다

native drag 중 `renderStory()`가 실행되면 원래 drag source가 DOM에서 사라질 수 있다. dragstart 도중 선택 변경 때문에 렌더를 유발하는 수정은 금지한다.

### synthetic drop은 현재 호환 계층이다

현재 여러 보조 모듈은 새 상태 변경 API를 직접 호출하지 않고 `DataTransfer`를 유지한 synthetic `drop`을 기존 target으로 전달한다. 이것은 장기적으로 제거할 대상이지만, 직접 mutation API가 마련되기 전에는 한 번에 없애지 않는다.

## MIME 계약

- 라이브러리 콘: `application/x-hhjcon-ids`
- 원고 아이템: `application/x-hhjstory-ids`
- 대사/줄바꿈/이미지 마커 같은 block 표시: `application/x-hhjstory-block`

기본 동작은 다음과 같다.

- 원고 내부 이동: `effectAllowed = move`, `dropEffect = move`
- 라이브러리 → 원고 복사: `effectAllowed = copyMove`, `dropEffect = copy`

`dragover` 중 custom MIME의 `getData()`는 브라우저에 따라 비어 있을 수 있으므로, dragover 판정은 payload 본문보다 `DataTransfer.types`와 현재 drag session 상태를 우선한다.

## 현재 가이드 규칙

1. 콘-콘 사이 경계는 세로선.
2. 콘을 콘 run 앞/뒤에 넣을 때는 세로선.
3. 대사/줄바꿈/이미지 마커를 block 경계에 넣을 때는 가로선.
4. moving row는 boundary 계산에서 이미 제거된 것으로 취급한다.
5. 원고 맨 아래 append는 마지막 실제 story item 아래쪽만 인정한다.

## 리팩터링 순서

### 0. 안정 기준과 검증 고정

- 안정 앵커 브랜치 유지.
- DnD 파일 로드 순서와 금지된 실험 MIME을 CI에서 정적 검사.
- 각 단계는 Public에서 실제 Chrome DnD 확인 후 다음 단계로 진행.

### 1. payload/drag session 계약 통합

중복된 MIME 문자열, `read/write` 코드, drop effect 판정을 하나의 공통 모듈로 옮긴다. 동작은 변경하지 않는다.

### 2. 원고 mutation API 분리

`app.js` 내부의 `addConBlocks()`와 `reorderStoryItems()`를 DnD가 직접 호출할 수 있는 명시적 API로 분리한다. 이 단계가 끝나기 전에는 synthetic drop을 제거하지 않는다.

### 3. synthetic drop 제거

boundary가 `beforeStoryId`를 계산하면 직접 mutation API를 호출하도록 바꾼다. `.story-insert-slot`은 그 뒤 실제 필요성을 다시 평가한다.

### 4. DnD controller 통합

run-end/tail/stability/guide 중 같은 drag session 상태를 중복 관리하는 부분을 하나의 controller로 모은다. auto-scroll은 독립 모듈로 유지해도 된다.

### 5. observer 축소

`storyList`의 재렌더 후 각 모듈이 별도 MutationObserver로 후처리하는 구조를 줄이고, 명시적인 render/decorate hook으로 옮긴다.

## 회귀 확인 항목

리팩터링 각 단계에서 최소한 다음을 확인한다.

- 라이브러리 콘 1개/다중 선택 → 원고 중간 삽입
- 원고 콘 1개/다중 선택 위치 이동
- 대사 위치 이동
- 줄바꿈 위치 이동
- 이미지 마커 위치 이동
- 콘 run 마지막 오른쪽 빈 영역 drop
- 원고 마지막 블록 아래 빈 영역 append
- 자기 위치 drop이 맨 뒤 이동으로 오작동하지 않음
- 긴 원고에서 상하단 자동 스크롤
- 클릭 기반 `+ 대사`, `+ 줄바꿈`, `+ 이미지 마커` 동작 유지
