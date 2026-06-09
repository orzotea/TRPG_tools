// ==UserScript==
// @name         Roll20 화자 목록 저널 순서 실시간 동기화
// @homepageURL  https://trpgdata.tistory.com/48
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  저널의 캐릭터 정렬 순서대로 채팅창 화자 드롭다운을 실시간 정렬
// @match        https://app.roll20.net/editor*
// @grant        none
// @run-at       document-idle
// @updateURL    https://github.com/orzotea/TRPG_tools/raw/refs/heads/main/r20SpeakAs.user.js
// @downloadURL  https://github.com/orzotea/TRPG_tools/raw/refs/heads/main/r20SpeakAs.user.js
// ==/UserScript==

(function() {
    'use strict';

        // 저널 순서를 읽어서 화자 드롭다운을 재정렬하는 함수
    function sortSpeakingAs() {
        const select = document.getElementById('speakingas');
        if (!select) return;

        // 저널 영역에서 캐릭터 이름들을 위에서부터 순서대로 읽음
        const characterElements = document.querySelectorAll('#journal .character .name');
        const journalOrder = [];
        characterElements.forEach(el => {
            journalOrder.push(el.textContent.trim());
        });

        // 저널에 캐릭터가 없으면 정렬하지 않고 종료
        if (journalOrder.length === 0) return;

        // 현재 드롭다운에 있는 선택지들을 배열로 부름
        const options = Array.from(select.options);
        const currentValue = select.value; // 현재 유저가 선택 중인 화자 기억하기

        // 저널 순서(journalOrder)를 기준으로 드롭다운 항목들을 정렬
        options.sort((a, b) => {
            const nameA = a.textContent.trim();
            const nameB = b.textContent.trim();

            //  GM 권한 항목은 저널 유무와 상관없이 무조건 최상단 고정
            const isGMA = nameA.includes('(GM)');
            const isGMB = nameB.includes('(GM)');
            if (isGMA && !isGMB) return -1;
            if (!isGMA && isGMB) return 1;

            // 노이즈가 있어도 글자가 포함되어 있으면 찾아내도록 개선 (findIndex 및 includes 활용)
            const indexA = journalOrder.findIndex(jName => jName.includes(nameA) || nameA.includes(jName));
            const indexB = journalOrder.findIndex(jName => jName.includes(nameB) || nameB.includes(jName));

            // 둘 다 저널에서 정상적으로 찾은 경우 -> 저널 순서대로 정렬
            if (indexA !== -1 && indexB !== -1) {
                return indexA - indexB;
            }
            // 저널에 없는 일반 항목이 있다면 최상단이 아닌 맨 아래로 밀어내기
            if (indexA !== -1 && indexB === -1) return -1;
            if (indexA === -1 && indexB !== -1) return 1;
            return 0;
        });

        // 정렬된 순서대로 드롭다운 메뉴를 새로고침
        select.innerHTML = '';
        options.forEach(opt => select.appendChild(opt));
        select.value = currentValue; // 원래 선택되어 있던 화자가 풀리지 않도록 복구
    }

    //  저널 변화를 감지
    function initObserver() {
        const journal = document.getElementById('journal');
        if (journal) {
            const journalObserver = new MutationObserver(() => {
                sortSpeakingAs(); // 순서 바뀜이 감지되면 즉시 재정렬 실행
            });
            journalObserver.observe(journal, { childList: true, subtree: true });
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
