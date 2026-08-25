// ==UserScript==
// @name         Roll20 화자 목록 저널 순서 실시간 동기화
// @homepageURL  https://trpgdata.tistory.com/48
// @namespace    http://tampermonkey.net/
// @version      1.5
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
    function buildCharacterInfoMap() {
        const infoMap = new Map();
        const ALL_COLOR = '#3e88e7';
        const [AR, AG, AB] = hexToRGB(ALL_COLOR);

        document.querySelectorAll('#journal .character').forEach(item => {
            const nameEl = item.querySelector('.namecontainer') || item.querySelector('.name');
            if (!nameEl) return;
            const name = nameEl.textContent.trim();
            const tokenImg = item.querySelector('.token img');
            const rawSrc   = tokenImg ? tokenImg.src : null;
            const imgSrc   = rawSrc ? rawSrc.replace(/^http:\/\//i, 'https://') : null;
            const dotsContainer = item.querySelector('.playerdots');
            const dot = dotsContainer
                ? dotsContainer.querySelector('.playerdot')
                : item.querySelector('.playerdot');

            let perm = 'gm';
            if (dot) {
                const inlineColor = dot.style.color
                                 || dot.style.backgroundColor
                                 || dot.style.background
                                 || '';
                const cs = window.getComputedStyle(dot);
                const computedColor = cs.color || cs.backgroundColor || '';
                const isAll = matchesHex(inlineColor, ALL_COLOR)
                           || matchesRGB(computedColor, AR, AG, AB);
                perm = isAll ? 'all' : 'specific';
            }

            infoMap.set(name, { perm, imgSrc });
        });

        return infoMap;
    }
    
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

    const CUSTOM_ID = 'r20speakas-custom';

    function getOrCreateCustomUI(select) {
        let wrapper = document.getElementById(CUSTOM_ID);
        if (wrapper) return wrapper;
        wrapper = document.createElement('div');
        wrapper.id = CUSTOM_ID;
        const display = document.createElement('div');
        display.id = CUSTOM_ID + '-display';
        wrapper.appendChild(display);
        const list = document.createElement('div');
        list.id = CUSTOM_ID + '-list';
        list.style.display = 'none';
        wrapper.appendChild(list);
        select.parentNode.insertBefore(wrapper, select);

        applyWrapperStyles(wrapper, display, list, select);
        return wrapper;
    }

    function applyWrapperStyles(wrapper, display, list, select) {
        const cs = window.getComputedStyle(select);
        Object.assign(wrapper.style, {
            position:    'relative',
            display:     'inline-flex',
            alignItems:  'center',
            cursor:      'pointer',
            background:  cs.backgroundColor || '#fff',
            border:      cs.border          || '1px solid #ccc',
            borderRadius: cs.borderRadius   || '3px',
            width:       cs.width,
            height:      cs.height,
            minWidth:    cs.minWidth !== '0px' ? cs.minWidth : cs.width,
            boxSizing:   'border-box',
            userSelect:  'none',
            verticalAlign: cs.verticalAlign,
            margin:      cs.margin,
        });
        Object.assign(display.style, {
            display:      'flex',
            alignItems:   'center',
            gap:          '5px',
            padding:      '0 20px 0 4px',
            width:        '100%',
            height:       '100%',
            overflow:     'hidden',
            whiteSpace:   'nowrap',
            textOverflow: 'ellipsis',
            fontSize:     cs.fontSize,
            fontFamily:   cs.fontFamily,
            fontWeight:   cs.fontWeight,
            lineHeight:   cs.lineHeight,
            color:        cs.color || '#333',
            boxSizing:    'border-box',
        });
        const arrow = document.createElement('span');
        arrow.textContent = '▾';
        Object.assign(arrow.style, {
            position:      'absolute',
            right:         '4px',
            top:           '50%',
            transform:     'translateY(-50%)',
            fontSize:      cs.fontSize,
            color:         cs.color || '#555',
            pointerEvents: 'none',
        });
        wrapper.appendChild(arrow);
        
        Object.assign(list.style, {
            position:    'absolute',
            top:         '100%',
            left:        '0',
            zIndex:      '9999',
            background:  '#fff',
            border:      '1px solid #ccc',
            borderTop:   'none',
            borderRadius:'0 0 3px 3px',
            minWidth:    '100%',
            maxHeight:   '260px',
            overflowY:   'auto',
            boxShadow:   '0 4px 8px rgba(0,0,0,0.15)',
            boxSizing:   'border-box',
            fontSize:    cs.fontSize,
            fontFamily:  cs.fontFamily,
        });
    }

    
    function createListItem(value, label, imgSrc, color) {
        const item = document.createElement('div');
        Object.assign(item.style, {
            display:    'flex',
            alignItems: 'center',
            gap:        '5px',
            padding:    '3px 6px',
            cursor:     'pointer',
            fontSize:   'inherit',
            fontFamily: 'inherit',
            color:      color || '#333',
            whiteSpace: 'nowrap',
        });
        item.dataset.value = value;

        if (imgSrc) {
            const img = document.createElement('img');
            img.src = imgSrc;

            Object.assign(img.style, {
                width:        '18px',
                height:       '18px',
                objectFit:    'cover',
                borderRadius: '2px',
                flexShrink:   '0',
            });
            img.loading = 'lazy';
            item.appendChild(img);
        } else {
            const spacer = document.createElement('span');
            Object.assign(spacer.style, {
                display:  'inline-block',
                width:    '18px',
                height:   '18px',
                flexShrink: '0',
            });
            item.appendChild(spacer);
        }

        const text = document.createElement('span');
        text.textContent = label;
        Object.assign(text.style, {
            overflow:     'hidden',
            textOverflow: 'ellipsis',
        });
        item.appendChild(text);
        item.addEventListener('mouseenter', () => {
            item.style.background = '#e8f0fe';
        });
        item.addEventListener('mouseleave', () => {
            item.style.background = '';
        });

        return item;
    }
    function updateDisplay(display, select, infoMap) {
        display.innerHTML = '';
        const selectedOpt = select.options[select.selectedIndex];
        if (!selectedOpt) return;

        const label = selectedOpt.textContent.trim();
        const info  = findInfoByName(infoMap, label);

        if (info?.imgSrc) {
            const img = document.createElement('img');
            img.src = info.imgSrc;
            Object.assign(img.style, {
                width:        '18px',
                height:       '18px',
                objectFit:    'cover',
                borderRadius: '2px',
                flexShrink:   '0',
            });
            display.appendChild(img);
        } else {
            const spacer = document.createElement('span');
            Object.assign(spacer.style, {
                display: 'inline-block',
                width:   '18px',
                height:  '18px',
                flexShrink: '0',
            });
            display.appendChild(spacer);
        }

        const text = document.createElement('span');
        text.textContent = label;
        Object.assign(text.style, {
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            color: info?.perm === 'all'      ? '#6b92c1'
                 : info?.perm === 'specific' ? '#aaaaaa'
                 : '#333',
        });
        display.appendChild(text);
    }
    let isOpen = false;

    function openList(wrapper, list, select, infoMap) {
        list.innerHTML = '';

        Array.from(select.options).forEach(opt => {
            const label  = opt.textContent.trim();
            const value  = opt.value;
            const info   = findInfoByName(infoMap, label);
            const color  = info?.perm === 'all'      ? '#6b92c1'
                         : info?.perm === 'specific' ? '#aaaaaa'
                         : '#333';

            const item = createListItem(value, label, info?.imgSrc ?? null, color);
            if (opt.value === select.value) {
                item.style.background = '#dce8ff';
            }

            item.addEventListener('mousedown', (e) => {
                e.preventDefault(); 
                e.stopPropagation();
                select.value = value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                const display = document.getElementById(CUSTOM_ID + '-display');
                if (display) updateDisplay(display, select, infoMap);
                closeList(list);
            });

            list.appendChild(item);
        });

        list.style.display = 'block';
        isOpen = true;
    }

    function closeList(list) {
        list.style.display = 'none';
        list.innerHTML = '';
        isOpen = false;
    }

    function initCustomUI(select, infoMap) {
        const wrapper = getOrCreateCustomUI(select);
        const display = document.getElementById(CUSTOM_ID + '-display');
        const list    = document.getElementById(CUSTOM_ID + '-list');

        select.style.display = 'none';

        updateDisplay(display, select, infoMap);

        const newWrapper = wrapper.cloneNode(false);
        wrapper._r20toggle = function (e) {
            e.stopPropagation();
            if (isOpen) {
                closeList(list);
            } else {
                openList(wrapper, list, select, infoMap);
            }
        };
        wrapper.removeEventListener('mousedown', wrapper._r20toggle);
        wrapper.addEventListener('mousedown', wrapper._r20toggle);
        if (!document._r20outsideHandler) {
            document._r20outsideHandler = (e) => {
                if (isOpen && !wrapper.contains(e.target)) {
                    closeList(list);
                }
            };
            document.addEventListener('mousedown', document._r20outsideHandler, true);
        }
        if (!select._r20changeHandler) {
            select._r20changeHandler = () => {
                updateDisplay(display, select, infoMap);
            };
            select.addEventListener('change', select._r20changeHandler);
        }
    }

    let isSorting = false;

    function sortSpeakingAs() {
        if (isSorting) return;
        isSorting = true;
        try {
            _doSort();
        } finally {
            isSorting = false;
        }
    }

    function _doSort() {
        const select = document.getElementById('speakingas');
        if (!select) return;
        const journalOrder = [];
        document.querySelectorAll('#journal .character').forEach(item => {
            const nameEl = item.querySelector('.namecontainer') || item.querySelector('.name');
            if (nameEl) journalOrder.push(nameEl.textContent.trim());
        });

        const infoMap = buildCharacterInfoMap();
        const options     = Array.from(select.options);
        const currentValue = select.value;

        if (journalOrder.length > 0) {
            options.sort((a, b) => {
                const nameA = a.textContent.trim();
                const nameB = b.textContent.trim();

                // GM 항목 최상단 고정
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

        while (select.firstChild) select.removeChild(select.firstChild);
        options.forEach(opt => {
            const info = findInfoByName(infoMap, opt.textContent.trim());
            if (info?.perm === 'all')      opt.style.color = '#6b92c1';
            else if (info?.perm === 'specific') opt.style.color = '#aaaaaa';
            else                               opt.style.color = '';
            select.appendChild(opt);
        });

        if (select.value !== currentValue) select.value = currentValue;
        initCustomUI(select, infoMap);
    }
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
        document.addEventListener('mousedown', (e) => {
            if (e.target?.id === 'speakingas') sortSpeakingAs();
        }, true);

        sortSpeakingAs();
    }

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
