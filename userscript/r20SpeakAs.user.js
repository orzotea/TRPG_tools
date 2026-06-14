// ==UserScript==
// @name         Roll20 화자 목록 커스텀
// @homepageURL  https://trpgdata.tistory.com/48
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  채팅창 화자 드롭다운을 저널의 캐릭터 정렬 순서대로 정렬합니다 / 전체공개 캐릭터는 #6b92c1, 특정 유저 캐릭터는 #c6c6c6으로 표시합니다
// @match        https://app.roll20.net/editor*
// @grant        none
// @run-at       document-idle
// @updateURL    https://github.com/orzotea/TRPG_tools/raw/refs/heads/main/userscript/r20SpeakAs.user.js
// @downloadURL  https://github.com/orzotea/TRPG_tools/raw/refs/heads/main/userscript/r20SpeakAs.user.js
// ==/UserScript==

(function() {
    'use strict';
    function getCharacterPermissionMap() {
        const permMap = new Map();
        const characterItems = document.querySelectorAll('#journal .character');
        characterItems.forEach(item => {
            const nameEl = item.querySelector('.name');
            if (!nameEl) return;
            const name = nameEl.textContent.trim();

            const dot = item.querySelector('.playerdot');

            if (!dot) {
                permMap.set(name, 'gm');
                return;
            }
            const inlineColor = dot.style.color
                             || dot.style.backgroundColor
                             || dot.style.background
                             || '';
            const computed = getComputedStyle(dot);
            const computedColor = computed.color || computed.backgroundColor || '';
            const isAllPlayersColor =
                matchesHex(inlineColor, '#3e88e7') ||
                matchesRGB(computedColor, 62, 136, 231);

            if (isAllPlayersColor) {
                permMap.set(name, 'all');
            } else {
                permMap.set(name, 'specific');
            }
        });

        return permMap;
    }
    function matchesHex(colorStr, hex) {
        if (!colorStr) return false;
        const normalHex = hex.toLowerCase();
        const str = colorStr.toLowerCase().replace(/\s/g, '');

        if (str === normalHex) return true;
        const [r, g, b] = hexToRGB(normalHex);
        return matchesRGB(colorStr, r, g, b);
    }
    function matchesRGB(colorStr, r, g, b) {
        if (!colorStr) return false;
        const match = colorStr.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/i);
        if (!match) return false;
        return parseInt(match[1]) === r &&
               parseInt(match[2]) === g &&
               parseInt(match[3]) === b;
    }
    function hexToRGB(hex) {
        const clean = hex.replace('#', '');
        const num = parseInt(clean, 16);
        return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }
    function sortSpeakingAs() {
        const select = document.getElementById('speakingas');
        if (!select) return;
        
        const characterElements = document.querySelectorAll('#journal .character .name');
        const journalOrder = [];
        characterElements.forEach(el => {
            journalOrder.push(el.textContent.trim());
        });

        if (journalOrder.length === 0) return;

        const permMap = getCharacterPermissionMap();
        const options = Array.from(select.options);
        const currentValue = select.value;

        options.sort((a, b) => {
            const nameA = a.textContent.trim();
            const nameB = b.textContent.trim();
            const isGMA = nameA.includes('(GM)');
            const isGMB = nameB.includes('(GM)');
            if (isGMA && !isGMB) return -1;
            if (!isGMA && isGMB) return 1;

            const indexA = journalOrder.findIndex(jName => jName.includes(nameA) || nameA.includes(jName));
            const indexB = journalOrder.findIndex(jName => jName.includes(nameB) || nameB.includes(jName));

            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1 && indexB === -1) return -1;
            if (indexA === -1 && indexB !== -1) return 1;
            return 0;
        });
        select.innerHTML = '';
        options.forEach(opt => {
            const optName = opt.textContent.trim();
            let perm = null;
            for (const [journalName, p] of permMap.entries()) {
                if (journalName.includes(optName) || optName.includes(journalName)) {
                    perm = p;
                    break;
                }
            }

            // 권한별 색상 적용
            //   'all'      (전체공개, dot #3e88e7) → #6b92c1
            //   'specific' (특정 유저 지정)         → #c6c6c6
            //   'gm' / null (GM 전용 또는 미매칭)   → 기본값 복원
            if (perm === 'all') {
                opt.style.color = '#6b92c1';
            } else if (perm === 'specific') {
                opt.style.color = '#c6c6c6';
            } else {
                opt.style.color = ''; 
            }

            select.appendChild(opt);
        });

        select.value = currentValue;
    }
    function initObserver() {
        const journal = document.getElementById('journal');
        if (journal) {
            const journalObserver = new MutationObserver(() => {
                sortSpeakingAs();
            });
            journalObserver.observe(journal, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
        }
        const chatArea = document.getElementById('chatvariables');
        if (chatArea) {
            const chatObserver = new MutationObserver((mutations) => {
                for (let mutation of mutations) {
                    if (mutation.addedNodes.length > 0) {
                        if (document.getElementById('speakingas')) {
                            sortSpeakingAs();
                            break;
                        }
                    }
                }
            });
            chatObserver.observe(chatArea, { childList: true, subtree: true });
        }
        document.addEventListener('mousedown', function(e) {
            if (e.target && e.target.id === 'speakingas') {
                sortSpeakingAs();
            }
        }, true);
        sortSpeakingAs();
    }
    
    const checkExist = setInterval(function() {
        if (document.getElementById('speakingas') && document.getElementById('journal')) {
            clearInterval(checkExist);
            initObserver();
        }
    }, 1000);

})();
