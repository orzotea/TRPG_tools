// ==UserScript==
// @name         Roll20 화자 목록 저널 순서 실시간 동기화
// @homepageURL  https://trpgdata.tistory.com/48
// @namespace    http://tampermonkey.net/
// @version      1.4.1
// @description  채팅창 화자 드롭다운을 저널의 캐릭터 정렬 순서대로 정렬 / 전체공개 #6b92c1, 특정 유저 #aaaaaa으로 표시
// @match        https://app.roll20.net/editor*
// @grant        none
// @run-at       document-idle
// @updateURL    https://github.com/orzotea/TRPG_tools/raw/refs/heads/main/userscript/r20SpeakAs.user.js
// @downloadURL  https://github.com/orzotea/TRPG_tools/raw/refs/heads/main/userscript/r20SpeakAs.user.js
// ==/UserScript==

(function () {
    'use strict';
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
    function getCharacterPermissionMap() {
        const permMap = new Map();
        const ALL_COLOR = '#3e88e7';
        const [AR, AG, AB] = hexToRGB(ALL_COLOR);

        document.querySelectorAll('#journal .character').forEach(item => {
            const nameEl = item.querySelector('.namecontainer') || item.querySelector('.name');
            if (!nameEl) return;
            const name = nameEl.textContent.trim();

            const dotsContainer = item.querySelector('.playerdots');
            const dot = dotsContainer
                ? dotsContainer.querySelector('.playerdot')
                : item.querySelector('.playerdot');

            if (!dot) {
                permMap.set(name, 'gm');
                return;
            }

            // inline style: color → backgroundColor → background 순으로 확인
            const inlineColor = dot.style.color
                             || dot.style.backgroundColor
                             || dot.style.background
                             || '';

            // computed style도 동일 순서로 확인
            const cs = window.getComputedStyle(dot);
            const computedColor = cs.color || cs.backgroundColor || '';

            const isAll = matchesHex(inlineColor, ALL_COLOR)
                       || matchesRGB(computedColor, AR, AG, AB);

            permMap.set(name, isAll ? 'all' : 'specific');
        });

        return permMap;
    }
    function findJournalIndex(journalOrder, optName) {
        let idx = journalOrder.findIndex(n => n === optName);
        if (idx !== -1) return idx;
        idx = journalOrder.findIndex(n => n.includes(optName));
        if (idx !== -1) return idx;
        return journalOrder.findIndex(n => optName.includes(n));
    }

    function findPermByName(permMap, optName) {
        if (permMap.has(optName)) return permMap.get(optName);
        for (const [jName, p] of permMap) {
            if (jName.includes(optName)) return p;
        }
        for (const [jName, p] of permMap) {
            if (optName.includes(jName)) return p;
        }
        return null;
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
        const permMap = getCharacterPermissionMap();
        const options = Array.from(select.options);
        const currentValue = select.value;

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
        while (select.firstChild) select.removeChild(select.firstChild);

        options.forEach(opt => {
            const perm = findPermByName(permMap, opt.textContent.trim());
            if (perm === 'all') {
                
        // 전체 공개 권한 컬러_연파랑
                opt.style.color = '#6b92c1';
            } else if (perm === 'specific') {
        // 특정 플레이어 전용 컬러_연회색
                opt.style.color = '#aaaaaa';
            } else {
                opt.style.color = '';
            }
            select.appendChild(opt);
        });

        if (select.value !== currentValue) {
            select.value = currentValue;
        }
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
    const POLL_MS = 1_000;

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
