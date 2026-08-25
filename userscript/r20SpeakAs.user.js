// ==UserScript==
// @name         Roll20 화자 목록 저널 순서 실시간 동기화
// @homepageURL  https://trpgdata.tistory.com/48
// @namespace    http://tampermonkey.net/
// @version      1.5.4
// @description  채팅창 화자 드롭다운을 저널의 캐릭터 정렬 순서대로 정렬 / 전체공개 #6b92c1, 특정 유저 #aaaaaa으로 표시 / 캐릭터 이미지 표시
// @match        https://app.roll20.net/editor*
// @grant        unsafeWindow
// @run-at       document-idle
// @updateURL    https://github.com/orzotea/TRPG_tools/raw/refs/heads/main/userscript/r20SpeakAs.user.js
// @downloadURL  https://github.com/orzotea/TRPG_tools/raw/refs/heads/main/userscript/r20SpeakAs.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ─────────────────────────────────────────────────────────
    // 색상 헬퍼
    // ─────────────────────────────────────────────────────────
    function matchesRGB(colorStr, r, g, b) {
        if (!colorStr) return false;
        const m = colorStr.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/i);
        if (!m) return false;
        return +m[1] === r && +m[2] === g && +m[3] === b;
    }
    function hexToRGB(hex) {
        const n = parseInt(hex.replace('#', ''), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    function matchesHex(colorStr, hex) {
        if (!colorStr) return false;
        const normalHex = hex.toLowerCase();
        const str = colorStr.toLowerCase().replace(/\s/g, '');
        if (str === normalHex) return true;
        const [r, g, b] = hexToRGB(normalHex);
        return matchesRGB(colorStr, r, g, b);
    }

    // ─────────────────────────────────────────────────────────
    // 저널에서 캐릭터 정보(권한 + 이미지 URL) 추출
    // ─────────────────────────────────────────────────────────
    function buildCharacterInfoMap() {
        const infoMap = new Map();
        const ALL_COLOR = '#3e88e7';
        const [AR, AG, AB] = hexToRGB(ALL_COLOR);

        document.querySelectorAll('#journal .character').forEach(item => {
            const nameEl = item.querySelector('.namecontainer') || item.querySelector('.name');
            if (!nameEl) return;
            const name = nameEl.textContent.trim();

            // 이미지 URL: Mixed Content 방지 http→https
            const tokenImg = item.querySelector('.token img');
            const rawSrc   = tokenImg ? tokenImg.src : null;
            const imgSrc   = rawSrc ? rawSrc.replace(/^http:\/\//i, 'https://') : null;

            // 권한 판별
            const dotsContainer = item.querySelector('.playerdots');
            const dot = dotsContainer
                ? dotsContainer.querySelector('.playerdot')
                : item.querySelector('.playerdot');

            let perm = 'gm';
            if (dot) {
                const inlineColor = dot.style.color || dot.style.backgroundColor || dot.style.background || '';
                const cs = window.getComputedStyle(dot);
                const computedColor = cs.color || cs.backgroundColor || '';
                perm = (matchesHex(inlineColor, ALL_COLOR) || matchesRGB(computedColor, AR, AG, AB))
                    ? 'all' : 'specific';
            }

            infoMap.set(name, { perm, imgSrc });
        });

        return infoMap;
    }

    // ─────────────────────────────────────────────────────────
    // 이름 매칭 헬퍼
    // ─────────────────────────────────────────────────────────
    function findJournalIndex(journalOrder, optName) {
        let idx = journalOrder.findIndex(n => n === optName);
        if (idx !== -1) return idx;
        idx = journalOrder.findIndex(n => n.includes(optName));
        if (idx !== -1) return idx;
        return journalOrder.findIndex(n => optName.includes(n));
    }

    function findInfoByName(infoMap, optName) {
        if (infoMap.has(optName)) return infoMap.get(optName);
        for (const [jName, info] of infoMap) {
            if (jName.includes(optName)) return info;
        }
        for (const [jName, info] of infoMap) {
            if (optName.includes(jName)) return info;
        }
        return null;
    }

    // ─────────────────────────────────────────────────────────
    // 커스텀 드롭다운 상태 (모듈 스코프 싱글톤)
    // ─────────────────────────────────────────────────────────
    const UI = {
        wrapper:  null,
        display:  null,
        list:     null,
        isOpen:   false,
        infoMap:  null,
        select:   null,
    };

    // ─────────────────────────────────────────────────────────
    // DOM 생성 (최초 1회)
    // ─────────────────────────────────────────────────────────
    function buildCustomUI(select) {
        // wrapper
        const wrapper = document.createElement('div');
        wrapper.id = 'r20speakas-wrapper';

        // display (선택된 값 표시, 항상 보임)
        const display = document.createElement('div');
        display.id = 'r20speakas-display';
        wrapper.appendChild(display);

        // 화살표
        const arrow = document.createElement('span');
        arrow.textContent = '▾';
        arrow.id = 'r20speakas-arrow';
        wrapper.appendChild(arrow);

        // list (열릴 때만 채워짐, body에 직접 부착 → overflow:hidden 클리핑 회피)
        const list = document.createElement('div');
        list.id = 'r20speakas-list';
        document.body.appendChild(list);

        // select 바로 앞에 wrapper 삽입, select 숨김
        select.parentNode.insertBefore(wrapper, select);
        select.style.display = 'none';

        // 스타일 적용
        applyStyles(wrapper, display, arrow, list, select);

        // 싱글톤에 등록
        UI.wrapper = wrapper;
        UI.display = display;
        UI.list    = list;
        UI.select  = select;

        // ── 이벤트 리스너 (최초 1회만 등록) ──

        // wrapper 클릭 → 토글
        wrapper.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (UI.isOpen) {
                closeList();
            } else {
                openList();
            }
        });

        // list 바깥 클릭 → 닫기
        document.addEventListener('mousedown', (e) => {
            if (UI.isOpen && !UI.wrapper.contains(e.target) && !UI.list.contains(e.target)) {
                closeList();
            }
        }, true);

        // Roll20이 select.value를 외부에서 바꿀 때 display 업데이트
        select.addEventListener('change', () => {
            renderDisplay();
        });
    }

    function applyStyles(wrapper, display, arrow, list, select) {
        const cs = window.getComputedStyle(select);

        Object.assign(wrapper.style, {
            position:      'relative',
            display:       'inline-flex',
            alignItems:    'center',
            cursor:        'pointer',
            background:    cs.backgroundColor || '#fff',
            border:        cs.border          || '1px solid #ccc',
            borderRadius:  cs.borderRadius    || '3px',
            width:         cs.width,
            height:        cs.height,
            minWidth:      cs.minWidth !== '0px' ? cs.minWidth : cs.width,
            boxSizing:     'border-box',
            userSelect:    'none',
            verticalAlign: cs.verticalAlign,
            margin:        cs.margin,
            overflow:      'visible',
        });

        Object.assign(display.style, {
            display:      'flex',
            alignItems:   'center',
            gap:          '5px',
            padding:      '0 18px 0 4px',
            width:        '100%',
            height:       '100%',
            overflow:     'hidden',
            whiteSpace:   'nowrap',
            fontSize:     cs.fontSize,
            fontFamily:   cs.fontFamily,
            fontWeight:   cs.fontWeight,
            lineHeight:   cs.lineHeight,
            boxSizing:    'border-box',
        });

        Object.assign(arrow.style, {
            position:      'absolute',
            right:         '4px',
            top:           '50%',
            transform:     'translateY(-50%)',
            fontSize:      cs.fontSize,
            color:         cs.color || '#555',
            pointerEvents: 'none',
        });

        Object.assign(list.style, {
            position:     'fixed',       // viewport 기준 고정
            zIndex:       '99999',
            background:   '#fff',
            border:       '1px solid #ccc',
            borderRadius: '3px 3px 0 0',
            maxHeight:    '260px',
            overflowY:    'auto',
            overflowX:    'hidden',
            boxShadow:    '0 -4px 10px rgba(0,0,0,0.18)',
            boxSizing:    'border-box',
            fontSize:     cs.fontSize,
            fontFamily:   cs.fontFamily,
            display:      'none',
        });
    }

    // ─────────────────────────────────────────────────────────
    // 목록 항목 생성
    // ─────────────────────────────────────────────────────────
    function createListItem(value, label, imgSrc, color) {
        const item = document.createElement('div');
        Object.assign(item.style, {
            display:    'flex',
            alignItems: 'center',
            gap:        '5px',
            padding:    '3px 8px',
            cursor:     'pointer',
            fontSize:   'inherit',
            fontFamily: 'inherit',
            color:      color || '#333',
            whiteSpace: 'nowrap',
            boxSizing:  'border-box',
        });

        // 이미지 or spacer
        if (imgSrc) {
            const img = document.createElement('img');
            img.src     = imgSrc;
            img.loading = 'lazy';
            Object.assign(img.style, {
                width:        '18px',
                height:       '18px',
                objectFit:    'cover',
                borderRadius: '2px',
                flexShrink:   '0',
            });
            item.appendChild(img);
        } else {
            const spacer = document.createElement('span');
            Object.assign(spacer.style, {
                display:    'inline-block',
                width:      '18px',
                height:     '18px',
                flexShrink: '0',
            });
            item.appendChild(spacer);
        }

        const text = document.createElement('span');
        text.textContent = label;
        item.appendChild(text);

        item.addEventListener('mouseenter', () => { item.style.background = '#e8f0fe'; });
        item.addEventListener('mouseleave', () => { item.style.background = ''; });

        // 항목 선택
        item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            UI.select.value = value;
            UI.select.dispatchEvent(new Event('change', { bubbles: true }));
            renderDisplay();
            closeList();
        });

        return item;
    }

    // ─────────────────────────────────────────────────────────
    // display 영역 렌더
    // ─────────────────────────────────────────────────────────
    function renderDisplay() {
        const display = UI.display;
        const select  = UI.select;
        const infoMap = UI.infoMap;
        if (!display || !select) return;

        display.innerHTML = '';
        const opt = select.options[select.selectedIndex];
        if (!opt) return;

        const label = opt.textContent.trim();
        const info  = findInfoByName(infoMap, label);

        if (info?.imgSrc) {
            const img = document.createElement('img');
            img.src = info.imgSrc;
            Object.assign(img.style, {
                width: '18px', height: '18px',
                objectFit: 'cover', borderRadius: '2px', flexShrink: '0',
            });
            display.appendChild(img);
        } else {
            const sp = document.createElement('span');
            Object.assign(sp.style, { display: 'inline-block', width: '18px', height: '18px', flexShrink: '0' });
            display.appendChild(sp);
        }

        const text = document.createElement('span');
        text.textContent = label;
        text.style.color = info?.perm === 'all'      ? '#6b92c1'
                         : info?.perm === 'specific' ? '#aaaaaa'
                         : (window.getComputedStyle(UI.select).color || '#333');
        display.appendChild(text);
    }

    // ─────────────────────────────────────────────────────────
    // 열기 / 닫기
    // ─────────────────────────────────────────────────────────
    function openList() {
        const list    = UI.list;
        const select  = UI.select;
        const infoMap = UI.infoMap;
        const wrapper = UI.wrapper;

        // 목록 새로 채우기
        list.innerHTML = '';
        Array.from(select.options).forEach(opt => {
            const label = opt.textContent.trim();
            const info  = findInfoByName(infoMap, label);
            const color = info?.perm === 'all'      ? '#6b92c1'
                        : info?.perm === 'specific' ? '#aaaaaa'
                        : '#333';
            const item = createListItem(opt.value, label, info?.imgSrc ?? null, color);
            if (opt.value === select.value) item.style.background = '#dce8ff';
            list.appendChild(item);
        });

        // wrapper 위치 계산 (fixed 배치)
        const rect = wrapper.getBoundingClientRect();
        list.style.display = 'block';
        list.style.left    = rect.left + 'px';
        list.style.width   = rect.width + 'px';

        // 렌더 후 실제 높이로 top 계산 (위로 펼쳐짐)
        requestAnimationFrame(() => {
            const h = Math.min(260, list.scrollHeight);
            list.style.maxHeight = '260px';
            list.style.top       = (rect.top - h) + 'px';
        });

        UI.isOpen = true;
    }

    function closeList() {
        UI.list.style.display = 'none';
        UI.list.innerHTML = ''; // 메모리 해제
        UI.isOpen = false;
    }

    // ─────────────────────────────────────────────────────────
    // 커스텀 UI 갱신 (sortSpeakingAs에서 호출)
    // ─────────────────────────────────────────────────────────
    function syncCustomUI(select, infoMap) {
        UI.infoMap = infoMap;
        UI.select  = select;

        if (!UI.wrapper) {
            // 최초 생성
            buildCustomUI(select);
        }

        // display 최신화
        renderDisplay();

        // 열려있으면 목록도 갱신
        if (UI.isOpen) {
            openList();
        }
    }

    // ─────────────────────────────────────────────────────────
    // 재진입 방지
    // ─────────────────────────────────────────────────────────
    let isSorting = false;

    function sortSpeakingAs() {
        if (isSorting) return;
        isSorting = true;
        try { _doSort(); }
        finally { isSorting = false; }
    }

    function _doSort() {
        const select = document.getElementById('speakingas');
        if (!select) return;

        // 저널 순서 추출
        const journalOrder = [];
        document.querySelectorAll('#journal .character').forEach(item => {
            const nameEl = item.querySelector('.namecontainer') || item.querySelector('.name');
            if (nameEl) journalOrder.push(nameEl.textContent.trim());
        });

        const infoMap      = buildCharacterInfoMap();
        const options      = Array.from(select.options);
        const currentValue = select.value;

        // 정렬
        if (journalOrder.length > 0) {
            options.sort((a, b) => {
                const nameA = a.textContent.trim();
                const nameB = b.textContent.trim();
                const isGMA = nameA.includes('(GM)');
                const isGMB = nameB.includes('(GM)');
                if (isGMA && !isGMB) return -1;
                if (!isGMA && isGMB) return 1;
                const idxA = findJournalIndex(journalOrder, nameA);
                const idxB = findJournalIndex(journalOrder, nameB);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return 0;
            });
        }

        // select 재구성 + 색상
        while (select.firstChild) select.removeChild(select.firstChild);
        options.forEach(opt => {
            const info = findInfoByName(infoMap, opt.textContent.trim());
            opt.style.color = info?.perm === 'all'      ? '#6b92c1'
                            : info?.perm === 'specific' ? '#aaaaaa'
                            : '';
            select.appendChild(opt);
        });
        if (select.value !== currentValue) select.value = currentValue;

        // 커스텀 UI 동기화
        syncCustomUI(select, infoMap);
    }

    // ─────────────────────────────────────────────────────────
    // Observer 초기화
    // ─────────────────────────────────────────────────────────
    function initObserver() {
        const journal = document.getElementById('journal');
        if (journal) {
            new MutationObserver(() => sortSpeakingAs())
                .observe(journal, { childList: true, subtree: true });

            function attachDotObservers() {
                document.querySelectorAll('#journal .character .playerdot').forEach(dot => {
                    if (dot._r20obs) return;
                    const obs = new MutationObserver(() => sortSpeakingAs());
                    obs.observe(dot, { attributes: true, attributeFilter: ['style'] });
                    dot._r20obs = obs;
                });
            }
            attachDotObservers();
            new MutationObserver(() => attachDotObservers())
                .observe(journal, { childList: true, subtree: true });
        }

        const chatRoot = document.getElementById('chatvariables')
                      || document.getElementById('chat-panel')
                      || document.body;

        new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    if (node.id === 'speakingas' || node.querySelector?.('#speakingas')) {
                        sortSpeakingAs();
                        return;
                    }
                }
            }
        }).observe(chatRoot, { childList: true, subtree: true });

        sortSpeakingAs();
    }

    // ─────────────────────────────────────────────────────────
    // 폴링 (최대 2분)
    // ─────────────────────────────────────────────────────────
    let waited = 0;
    const MAX_WAIT_MS = 120_000;
    const POLL_MS     = 1_000;

    const checkExist = setInterval(() => {
        waited += POLL_MS;
        if (document.getElementById('speakingas') && document.getElementById('journal')) {
            clearInterval(checkExist);
            initObserver();
            return;
        }
        if (waited >= MAX_WAIT_MS) {
            clearInterval(checkExist);
            console.warn('[r20SpeakAs] speakingas 또는 journal을 2분 내에 찾지 못해 종료합니다.');
        }
    }, POLL_MS);

})();
