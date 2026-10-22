// ==UserScript==
// @name         롤20 채팅 툴
// @version      1.0.0
// @match        https://app.roll20.net/editor*
// @grant        none
// @updateURL    https://github.com/orzotea/TRPG_tools/raw/refs/heads/main/userscript/r20chattool.user.js
// @downloadURL  https://github.com/orzotea/TRPG_tools/raw/refs/heads/main/userscript/r20chattool.user.js
// ==/UserScript==

(function () {
"use strict";

const CONFIG={
    prefix: "/desc ",
    inactiveBg: "#ffffff", inactiveText: "#adadad", inactiveBorder: "#cccccc",
    activeBg: "#1867c7", activeText: "#ffffff", activeBorder: "#1867c7",
    sadamActiveBg: "#555555", sadamActiveText: "#ffffff", sadamActiveBorder: "#555555",
    charSadamActiveBg: "#555555", charSadamActiveText: "#ffffff", charSadamActiveBorder: "#555555"
};

let isDescMode = false;
let isSadamMode = false;
let activeCustomBtn = null;

let localSadam = localStorage.getItem("r20_show_sadam") !== "false";
let localCharSadam = localStorage.getItem("r20_show_charsadam") !== "false";
if (localSadam && localCharSadam) {
    localCharSadam = false;
    localStorage.setItem("r20_show_charsadam", "false");
}

const btnVisible = {
    desc:      localStorage.getItem("r20_show_desc")    !== "false",
    sadam:     localSadam,
    charsadam: localCharSadam,
    journal:   localStorage.getItem("r20_show_journal") !== "false"
};

const sharedBtnStyle = `
    border-radius: 4px !important;
    padding: 3px 6px !important;
    min-width: 36px !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    cursor: pointer !important;
    transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease !important;
    border-style: solid !important;
    border-width: 1px !important;
    line-height: normal !important;
`;

function getCustomBtns() {
    try { return JSON.parse(localStorage.getItem("r20_custom_btns") || "[]"); } catch(e) { return []; }
}
function saveCustomBtns(btns) {
    localStorage.setItem("r20_custom_btns", JSON.stringify(btns));
}

function updateCustomButtonStyles() {
    const group = document.getElementById("custom-left-group");
    if (!group) return;
    const domBtns = [...group.querySelectorAll("[data-custom-btn]")];
    const count = domBtns.length;
    const small = count > 3;
    domBtns.forEach(b => {
        const idx = parseInt(b.dataset.customBtn);
        const isActive = activeCustomBtn && activeCustomBtn._idx === idx;
        applyBtnColors(b, isActive, { bg: CONFIG.activeBg, text: CONFIG.activeText, border: CONFIG.activeBorder });
        b.style.setProperty("padding", small ? "2px 4px" : "3px 6px", "important");
        b.style.setProperty("font-size", small ? "10px" : "11px", "important");
        b.style.setProperty("min-width", small ? "28px" : "36px", "important");
    });
}

function renderCustomButtons() {
    const group = document.getElementById("custom-left-group");
    if (!group) return;
    group.querySelectorAll("[data-custom-btn]").forEach(b => b.remove());
    getCustomBtns().forEach((btn, i) => {
        if (btn.visible === false) return;
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.customBtn = String(i);
        b.textContent = btn.label;
        b.style.cssText = sharedBtnStyle;
        b.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            const ta = document.querySelector("#textchat-input textarea");
            if (!ta) return;
            const isSame = activeCustomBtn && activeCustomBtn._idx === i;
            if (isSame) {
                activeCustomBtn = null;
            } else {
                activeCustomBtn = { ...btn, _idx: i };
                isDescMode = false;
                isSadamMode = false;
                const hasPlaceholder = /\?\{[^}]*\}/.test(btn.content);
                if (!hasPlaceholder) {
                    ta.value = btn.content;
                    ta.dispatchEvent(new Event("input", { bubbles: true }));
                } else {
                    ta.value = "";
                }
                updateDescButtonStyle(document.getElementById("custom-desc-toggle"));
                updateSadamButtonStyle(document.getElementById("custom-sadam-toggle"));
            }
            updateCustomButtonStyles();
            ta.focus();
        };
        group.appendChild(b);
    });
    updateCustomButtonStyles();
}

if (!document.getElementById("custom-journal-style")) {
    const style = document.createElement("style");
    style.id = "custom-journal-style";
    style.innerHTML = `
        #custom-journal-popup { position:fixed; width:190px; background:#ffffff; border:1px solid #cccccc; border-radius:4px; box-shadow:0 4px 12px rgba(0,0,0,0.18); z-index:10002; display:none; flex-direction:column; overflow:hidden; font-family:sans-serif; color:#333; }
        #custom-journal-popup.show { display:flex; }
        .cj-header { display:flex; align-items:center; justify-content:space-between; padding:4px 8px; background:#f0f0f0; border-bottom:1px solid #e0e0e0; font-size:11px; font-weight:bold; color:#666; flex-shrink:0; cursor:move; user-select:none; }
        .cj-close-btn { background:none; border:none; cursor:pointer; font-size:13px; color:#999; padding:0 2px; line-height:1; }
        .cj-close-btn:hover { color:#333; }
        .cj-drag-handle { cursor:grab; color:#cccccc; font-size:11px; flex-shrink:0; padding:0 3px 0 0; line-height:1; user-select:none; }
        .cj-drag-handle:active { cursor:grabbing; }
        .cj-item.cj-drag-over-top { border-top:2px solid #1867c7 !important; }
        .cj-item.cj-drag-over-bottom { border-bottom:2px solid #1867c7 !important; }
        .cj-search-container { padding:5px 6px; border-bottom:1px solid #eeeeee; background:#f9f9f9; flex-shrink:0; }
        .cj-search-input { width:100%; box-sizing:border-box; padding:4px 6px; border:1px solid #cccccc; border-radius:3px; outline:none; font-size:12px; }
        .cj-list-container { overflow-y:auto; flex:1; min-height:0; }
        .cj-resize-handle { height:8px; cursor:se-resize; background:linear-gradient(135deg, transparent 40%, #ccc 40%, #ccc 50%, transparent 50%, transparent 60%, #ccc 60%, #ccc 70%, transparent 70%); background-size:8px 8px; background-position:bottom right; background-repeat:no-repeat; flex-shrink:0; }
        .cj-item { padding:3px 10px; cursor:pointer; border-bottom:1px solid #f0f0f0; font-size:12px; display:flex; align-items:center; gap:5px; transition:background-color 0.1s ease; white-space:nowrap; overflow:hidden; }
        .cj-item:hover { background-color:#e6f7ff; }
        .cj-item.cj-selected { background-color:#e8e8e8; }
        .cj-item span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .cj-avatar { width:16px; height:16px; min-width:16px; border-radius:50%; object-fit:cover; background-color:#eeeeee; }
        #custom-settings-popup { position:fixed; width:190px; background:#ffffff; border:1px solid #cccccc; border-radius:4px; box-shadow:0 4px 10px rgba(0,0,0,0.15); z-index:10003; display:none; flex-direction:column; font-family:sans-serif; font-size:12px; color:#333; overflow-y:auto; max-height:70vh; }
        #custom-settings-popup.show { display:flex; }
        .cs-header { padding:5px 8px; background:#f0f0f0; border-bottom:1px solid #e0e0e0; font-size:11px; font-weight:bold; color:#666; flex-shrink:0; }
        .cs-row { display:flex; align-items:center; justify-content:space-between; padding:6px 10px; border-bottom:1px solid #f5f5f5; }
        .cs-switch { position:relative; width:32px; height:18px; display:inline-block; cursor:pointer; }
        .cs-switch input { opacity:0; width:0; height:0; }
        .cs-slider { position:absolute; inset:0; background:#cccccc; border-radius:18px; transition:0.2s; }
        .cs-slider:before { content:""; position:absolute; width:12px; height:12px; left:3px; top:3px; background:white; border-radius:50%; transition:0.2s; }
        .cs-switch input:checked + .cs-slider { background:#1867c7; }
        .cs-switch input:checked + .cs-slider:before { transform:translateX(14px); }
        .cs-custom-row { display:flex; align-items:center; padding:5px 8px; border-bottom:1px solid #f5f5f5; gap:4px; }
        .cs-custom-row > span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; font-size:11px; }
        .cs-custom-icon-btn { background:none; border:none; cursor:pointer; color:#bbb; font-size:11px; padding:2px 3px; flex-shrink:0; line-height:1; }
        .cs-custom-icon-btn:hover { color:#555; }
        .cs-custom-del:hover { color:#e55 !important; }
        .cs-custom-add-btn { display:flex; align-items:center; justify-content:center; gap:4px; margin:6px 8px 8px; padding:5px 8px; background:#f5f5f5; border:1px solid #ddd; border-radius:3px; cursor:pointer; font-size:11px; color:#666; font-weight:normal; }
        .cs-custom-add-btn:hover { background:#ebebeb; color:#333; }
        #cs-side-panel { position:fixed; width:300px; background:#ffffff; border:1px solid #cccccc; border-radius:4px; box-shadow:0 4px 16px rgba(0,0,0,0.2); z-index:10004; display:none; flex-direction:column; font-family:sans-serif; font-size:12px; color:#333; }
        #cs-side-panel.show { display:flex; }
        .cs-side-header { display:flex; align-items:center; justify-content:space-between; padding:7px 10px; background:#f0f0f0; border-bottom:1px solid #e0e0e0; font-size:11px; font-weight:bold; color:#555; flex-shrink:0; }
        .cs-side-close { background:none; border:none; cursor:pointer; color:#999; font-size:13px; padding:0 2px; line-height:1; }
        .cs-side-close:hover { color:#333; }
        .cs-side-body { padding:12px; display:flex; flex-direction:column; gap:10px; }
        .cs-side-field { display:flex; flex-direction:column; gap:4px; }
        .cs-side-field label { font-size:10px; color:#888; font-weight:bold; text-transform:uppercase; letter-spacing:0.5px; }
        .cs-side-name { border:1px solid #ccc; border-radius:3px; padding:6px 8px; font-size:12px; outline:none; width:100%; box-sizing:border-box; }
        .cs-side-name:focus { border-color:#1867c7; }
        .cs-side-textarea { border:1px solid #ccc; border-radius:3px; padding:6px 8px; font-size:11px; outline:none; width:100%; box-sizing:border-box; resize:vertical; min-height:120px; font-family:monospace; line-height:1.5; }
        .cs-side-textarea:focus { border-color:#1867c7; }
        .cs-side-footer { display:flex; gap:6px; padding:0 12px 12px; }
        .cs-side-save { flex:1; background:#1867c7; color:white; border:none; border-radius:3px; padding:7px; cursor:pointer; font-size:12px; font-weight:bold; }
        .cs-side-save:hover { background:#1455a4; }
        .cs-side-cancel { flex:1; background:#eeeeee; color:#555; border:none; border-radius:3px; padding:7px; cursor:pointer; font-size:12px; }
        .cs-side-cancel:hover { background:#e0e0e0; }
    `;
    document.head.appendChild(style);
}

function applyBtnColors(btn, isActive, c) {
    if (!btn) return;
    btn.style.setProperty("background-color", isActive ? c.bg : CONFIG.inactiveBg, "important");
    btn.style.setProperty("color", isActive ? c.text : CONFIG.inactiveText, "important");
    btn.style.setProperty("border-color", isActive ? c.border : CONFIG.inactiveBorder, "important");
    btn.style.setProperty("box-shadow", "none", "important");
    btn.style.setProperty("outline", "none", "important");
}

function updateDescButtonStyle(btn) {
    if (!btn) return;
    btn.innerText = "desc";
    applyBtnColors(btn, isDescMode, { bg: CONFIG.activeBg, text: CONFIG.activeText, border: CONFIG.activeBorder });
}

function updateSadamButtonStyle(btn) {
    if (!btn) return;
    btn.innerText = "사담";
    if (btnVisible.charsadam) {
        btn.title = "캐릭터 사담";
        applyBtnColors(btn, isSadamMode, { bg: CONFIG.charSadamActiveBg, text: CONFIG.charSadamActiveText, border: CONFIG.charSadamActiveBorder });
    } else {
        btn.title = "오너 사담";
        applyBtnColors(btn, isSadamMode, { bg: CONFIG.sadamActiveBg, text: CONFIG.sadamActiveText, border: CONFIG.sadamActiveBorder });
    }
}

const _hoverEvts = ["mouseover","mouseout","mouseenter","mouseleave","mousedown","mouseup","focus","blur"];
function addStyleRefresh(btn, fn) {
    _hoverEvts.forEach(evt => btn.addEventListener(evt, () => fn(btn)));
}

function applyCocofoliaLayout() {
    const container = document.getElementById("textchat-input");
    const textarea = container?.querySelector("textarea");
    const sendBtn = document.getElementById("chatSendBtn");
    const speakingAsSelect = document.getElementById("speakingas");
    const speakingAsContainer = speakingAsSelect?.closest("div");

    if (!container || !textarea || !sendBtn || !speakingAsContainer) return;
    if (container.classList.contains("layout-applied-v11")) return;

    const chatLog = document.querySelector("#textchat .content");
    if (chatLog && !chatLog.dataset.cleanerAttached) {
        const chatCleaner = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && node.classList && node.classList.contains("message")) {
                        const walk = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null, false);
                        let textNode;
                        while ((textNode = walk.nextNode())) {
                            const match = textNode.nodeValue.match(/^\s*\/as\s+"([^"]+)"\s+(.*)/i);
                            if (match) {
                                textNode.nodeValue = " " + match[2];
                                const bySpan = node.querySelector(".by");
                                if (bySpan) bySpan.innerText = match[1] + ": ";
                            }
                        }
                    }
                });
            });
        });
        chatCleaner.observe(chatLog, { childList: true, subtree: true });
        chatLog.dataset.cleanerAttached = "true";
    }

    for (const [prop, val] of Object.entries({
        display: "flex", "flex-direction": "column", padding: "10px",
        "box-sizing": "border-box", overflow: "hidden", height: "auto"
    })) container.style.setProperty(prop, val, "important");

    if (!document.getElementById("custom-speaker-wrap")) {
        const wrap = document.createElement("div");
        wrap.id = "custom-speaker-wrap";
        wrap.style.cssText = "display: flex; width: 100%; height: 32px; margin-bottom: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; background: #fff; position: relative; align-items: stretch;";

        const visualSelect = document.createElement("div");
        visualSelect.id = "custom-select-visual";
        visualSelect.style.cssText = "width: 40px; min-width: 40px; display: flex; justify-content: center; align-items: center; position: relative; border-radius: 3px 0 0 3px; background-color: rgba(136, 136, 136, 0.1); color: #888888;";

        const iconBox = document.createElement("div");
        iconBox.id = "custom-icon-box";
        iconBox.style.cssText = "display: flex; justify-content: center; align-items: center; width: 100%; height: 100%; pointer-events: none;";

        speakingAsSelect.style.cssText = "position: absolute; left: 0; top: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; margin: 0; padding: 0;";
        visualSelect.appendChild(iconBox);
        visualSelect.appendChild(speakingAsSelect);

        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.id = "custom-speaker-name";
        nameInput.style.cssText = "flex-grow: 1; min-width: 0; border: none; border-left: 1px solid #ccc; padding: 0 10px; font-size: 13px; outline: none; box-sizing: border-box; background: transparent; height: 100%; line-height: normal;";

        const syncState = () => {
            const originalName = speakingAsSelect.options[speakingAsSelect.selectedIndex]?.text || "";
            const currentName = nameInput.value.trim();
            const isExtra = currentName !== "" && currentName !== originalName.trim();
            const selectedValue = speakingAsSelect.value;
            if (isExtra) {
                iconBox.innerHTML = "<span style='font-size: 14px; font-weight: bold;'>?</span>";
            } else {
                let avatarUrl = null;
                if (selectedValue && selectedValue.startsWith("character|")) {
                    const charId = selectedValue.split("|")[1];
                    const journalItem = document.querySelector(`li.character[data-itemid="${charId}"]`);
                    if (journalItem) {
                        const img = journalItem.querySelector("img");
                        if (img) {
                            const src = img.getAttribute("src") || img.getAttribute("data-src") || "";
                            if (src && !src.includes("images/character.png") && !src.includes("default")) avatarUrl = src;
                        }
                    }
                }
                iconBox.innerHTML = avatarUrl
                    ? `<img src="${avatarUrl}" style="width: 26px; height: 26px; border-radius: 50%; object-fit: cover;">`
                    : "<span style='font-size: 11px;'>▼</span>";
            }
        };
        const syncName = () => {
            nameInput.value = speakingAsSelect.options[speakingAsSelect.selectedIndex]?.text || "";
            syncState();
        };
        syncName();
        speakingAsSelect.addEventListener("change", syncName);
        speakingAsSelect.addEventListener("blur", syncName);
        nameInput.addEventListener("input", syncState);

        const settingsBtn = document.createElement("button");
        settingsBtn.id = "custom-settings-btn";
        settingsBtn.type = "button";
        settingsBtn.textContent = "⚙";
        settingsBtn.title = "버튼 표시 설정";
        settingsBtn.style.cssText = "width: 28px; min-width: 28px; border: none; border-left: 1px solid #ccc; background: rgba(136,136,136,0.07); color: #aaa; font-size: 13px; cursor: pointer; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 0 3px 3px 0; flex-shrink: 0;";

        // 사이드 패널
        const sidePanel = document.createElement("div");
        sidePanel.id = "cs-side-panel";

        const sidePanelHeader = document.createElement("div");
        sidePanelHeader.className = "cs-side-header";
        const sidePanelTitle = document.createElement("span");
        sidePanelTitle.textContent = "커스텀 버튼 추가";
        const sidePanelClose = document.createElement("button");
        sidePanelClose.className = "cs-side-close";
        sidePanelClose.textContent = "✕";
        sidePanelHeader.appendChild(sidePanelTitle);
        sidePanelHeader.appendChild(sidePanelClose);
        sidePanel.appendChild(sidePanelHeader);

        const sidePanelBody = document.createElement("div");
        sidePanelBody.className = "cs-side-body";

        const nameField = document.createElement("div");
        nameField.className = "cs-side-field";
        const nameLabel = document.createElement("label");
        nameLabel.textContent = "버튼 이름";
        const sideNameInp = document.createElement("input");
        sideNameInp.type = "text";
        sideNameInp.className = "cs-side-name";
        sideNameInp.placeholder = "예) 판정 매크로";
        nameField.appendChild(nameLabel);
        nameField.appendChild(sideNameInp);

        const contentField = document.createElement("div");
        contentField.className = "cs-side-field";
        const contentLabel = document.createElement("label");
        contentLabel.textContent = "매크로 내용";
        const sideContentTa = document.createElement("textarea");
        sideContentTa.className = "cs-side-textarea";
        sideContentTa.placeholder = '예) /desc [?{내용|}]........... 코드가 ?{}를 인식합니다.'
        contentField.appendChild(contentLabel);
        contentField.appendChild(sideContentTa);

        sidePanelBody.appendChild(nameField);
        sidePanelBody.appendChild(contentField);
        sidePanel.appendChild(sidePanelBody);

        const sidePanelFooter = document.createElement("div");
        sidePanelFooter.className = "cs-side-footer";
        const sideSaveBtn = document.createElement("button");
        sideSaveBtn.className = "cs-side-save";
        sideSaveBtn.textContent = "저장";
        const sideCancelBtn = document.createElement("button");
        sideCancelBtn.className = "cs-side-cancel";
        sideCancelBtn.textContent = "취소";
        sidePanelFooter.appendChild(sideSaveBtn);
        sidePanelFooter.appendChild(sideCancelBtn);
        sidePanel.appendChild(sidePanelFooter);

        [sideNameInp, sideContentTa].forEach(el => el.addEventListener("keydown", e => e.stopPropagation()));

        let sidePanelMode = "add";
        let sidePanelEditIdx = -1;

        const openSidePanel = (mode, idx = -1) => {
            sidePanelMode = mode;
            sidePanelEditIdx = idx;
            if (mode === "edit" && idx >= 0) {
                const btn = getCustomBtns()[idx];
                sidePanelTitle.textContent = "커스텀 버튼 수정";
                sideNameInp.value = btn.label;
                sideContentTa.value = btn.content;
            } else {
                sidePanelTitle.textContent = "커스텀 버튼 추가";
                sideNameInp.value = "";
                sideContentTa.value = "";
            }
            const spRect = settingsPopup.getBoundingClientRect();
            sidePanel.style.right = (window.innerWidth - spRect.left + 6) + "px";
            sidePanel.style.bottom = (window.innerHeight - spRect.bottom) + "px";
            sidePanel.style.left = "auto";
            sidePanel.style.top = "auto";
            sidePanel.classList.add("show");
            sideNameInp.focus();
        };

        const closeSidePanel = () => {
            sidePanel.classList.remove("show");
        };

        sidePanelClose.onclick = closeSidePanel;
        sideCancelBtn.onclick = closeSidePanel;

        sideSaveBtn.onclick = () => {
            const lbl = sideNameInp.value.trim();
            if (!lbl) { sideNameInp.focus(); return; }
            const btns = getCustomBtns();
            if (sidePanelMode === "edit" && sidePanelEditIdx >= 0) {
                btns[sidePanelEditIdx].label = lbl;
                btns[sidePanelEditIdx].content = sideContentTa.value;
            } else {
                btns.push({ label: lbl, content: sideContentTa.value, visible: true });
            }
            saveCustomBtns(btns);
            closeSidePanel();
            renderCustomList();
            renderCustomButtons();
        };

        document.body.appendChild(sidePanel);

        // 설정 팝업
        const settingsPopup = document.createElement("div");
        settingsPopup.id = "custom-settings-popup";

        const csHeader = document.createElement("div");
        csHeader.className = "cs-header";
        csHeader.textContent = "버튼 표시";
        settingsPopup.appendChild(csHeader);

        let sadamInp, charsadamInp;

        const makeRow = (label, key) => {
            const row = document.createElement("div");
            row.className = "cs-row";
            const labelSpan = document.createElement("span");
            labelSpan.textContent = label;
            const sw = document.createElement("label");
            sw.className = "cs-switch";
            const inp = document.createElement("input");
            inp.type = "checkbox";
            inp.checked = btnVisible[key];
            const slider = document.createElement("div");
            slider.className = "cs-slider";
            sw.appendChild(inp);
            sw.appendChild(slider);
            row.appendChild(labelSpan);
            row.appendChild(sw);

            if (key === "sadam") sadamInp = inp;
            if (key === "charsadam") charsadamInp = inp;

            inp.addEventListener("change", () => {
                if (key === "sadam" && inp.checked) {
                    btnVisible.sadam = true;
                    btnVisible.charsadam = false;
                    if (charsadamInp) charsadamInp.checked = false;
                    localStorage.setItem("r20_show_sadam", "true");
                    localStorage.setItem("r20_show_charsadam", "false");
                } else if (key === "charsadam" && inp.checked) {
                    btnVisible.charsadam = true;
                    btnVisible.sadam = false;
                    if (sadamInp) sadamInp.checked = false;
                    localStorage.setItem("r20_show_charsadam", "true");
                    localStorage.setItem("r20_show_sadam", "false");
                } else {
                    btnVisible[key] = inp.checked;
                    localStorage.setItem("r20_show_" + key, String(inp.checked));
                }

                const targets = {
                    desc: document.getElementById("custom-desc-toggle"),
                    journal: document.getElementById("custom-journal-toggle")
                };
                if (targets[key]) targets[key].style.display = inp.checked ? "" : "none";

                const sBtn = document.getElementById("custom-sadam-toggle");
                if (sBtn) {
                    sBtn.style.display = (btnVisible.sadam || btnVisible.charsadam) ? "" : "none";
                    updateSadamButtonStyle(sBtn);
                }

                if (!inp.checked && key === "journal") {
                    const jp = document.getElementById("custom-journal-popup");
                    if (jp) jp.classList.remove("show");
                }
                if (inp.checked && key === "journal") {
                    const jb = document.getElementById("custom-journal-toggle");
                    if (jb) {
                        jb.style.setProperty("background-color", CONFIG.inactiveBg, "important");
                        jb.style.setProperty("color", CONFIG.inactiveText, "important");
                        jb.style.setProperty("border-color", CONFIG.inactiveBorder, "important");
                    }
                }
            });
            return row;
        };
        settingsPopup.appendChild(makeRow("desc", "desc"));
        settingsPopup.appendChild(makeRow("오너 사담", "sadam"));
        settingsPopup.appendChild(makeRow("캐릭터 사담", "charsadam"));
        settingsPopup.appendChild(makeRow("저널", "journal"));

        // 커스텀 버튼 섹션
        const csCustomHeader = document.createElement("div");
        csCustomHeader.className = "cs-header";
        csCustomHeader.textContent = "커스텀 매크로";
        settingsPopup.appendChild(csCustomHeader);

        const customList = document.createElement("div");
        customList.id = "cs-custom-list";
        settingsPopup.appendChild(customList);

        const renderCustomList = () => {
            customList.innerHTML = "";
            getCustomBtns().forEach((btn, i) => {
                const row = document.createElement("div");
                row.className = "cs-custom-row";

                const labelSpan = document.createElement("span");
                labelSpan.textContent = btn.label;
                labelSpan.title = btn.content;

                // 표시 토글
                const sw = document.createElement("label");
                sw.className = "cs-switch";
                sw.style.flexShrink = "0";
                const inp = document.createElement("input");
                inp.type = "checkbox";
                inp.checked = btn.visible !== false;
                const slider = document.createElement("div");
                slider.className = "cs-slider";
                sw.appendChild(inp);
                sw.appendChild(slider);
                inp.addEventListener("change", () => {
                    const btns = getCustomBtns();
                    btns[i].visible = inp.checked;
                    saveCustomBtns(btns);
                    if (!inp.checked && activeCustomBtn && activeCustomBtn._idx === i) {
                        activeCustomBtn = null;
                    }
                    renderCustomButtons();
                });

                const editBtn = document.createElement("button");
                editBtn.className = "cs-custom-icon-btn";
                editBtn.textContent = "✎";
                editBtn.title = "수정";
                editBtn.onclick = () => openSidePanel("edit", i);

                const delBtn = document.createElement("button");
                delBtn.className = "cs-custom-icon-btn cs-custom-del";
                delBtn.textContent = "✕";
                delBtn.title = "삭제";
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    const btns = getCustomBtns();
                    btns.splice(i, 1);
                    saveCustomBtns(btns);
                    if (activeCustomBtn && activeCustomBtn._idx === i) activeCustomBtn = null;
                    renderCustomList();
                    renderCustomButtons();
                };

                row.appendChild(delBtn);
                row.appendChild(labelSpan);
                row.appendChild(sw);
                row.appendChild(editBtn);
                customList.appendChild(row);
            });
        };
        renderCustomList();

        const addBtnEl = document.createElement("div");
        addBtnEl.className = "cs-custom-add-btn";
        addBtnEl.textContent = "+ 추가";
        addBtnEl.onclick = () => openSidePanel("add");
        settingsPopup.appendChild(addBtnEl);

        settingsBtn.addEventListener("click", (e) => {
            e.preventDefault(); e.stopPropagation();
            if (settingsPopup.classList.contains("show")) {
                settingsPopup.classList.remove("show");
                closeSidePanel();
                return;
            }
            const r = settingsBtn.getBoundingClientRect();
            settingsPopup.style.right  = (window.innerWidth  - r.right)  + "px";
            settingsPopup.style.bottom = (window.innerHeight - r.top + 4) + "px";
            settingsPopup.style.left = "auto"; settingsPopup.style.top = "auto";
            settingsPopup.classList.add("show");
        });
        document.addEventListener("click", (e) => {
            if (!settingsPopup.contains(e.target) && e.target !== settingsBtn
                && !sidePanel.contains(e.target)) {
                settingsPopup.classList.remove("show");
                closeSidePanel();
            }
        });
        document.body.appendChild(settingsPopup);

        wrap.appendChild(visualSelect);
        wrap.appendChild(nameInput);
        wrap.appendChild(settingsBtn);

        Array.from(speakingAsContainer.childNodes).forEach(child => {
            if (child.style) child.style.display = "none";
        });
        speakingAsContainer.appendChild(wrap);
        speakingAsContainer.style.cssText = `
            float: none !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            margin: 0 0 4px 0 !important;
            padding: 0 !important;
        `;
    }

    const buttonRow = document.createElement("div");
    buttonRow.style.cssText = "display: flex !important; justify-content: space-between !important; align-items: center !important; margin-bottom: 4px !important; width: 100% !important;";

    const leftBtnGroup = document.createElement("div");
    leftBtnGroup.style.cssText = "display: flex !important; gap: 4px !important; align-items: center !important; position: relative !important; flex-wrap: wrap !important;";

    let toggleBtn = document.getElementById("custom-desc-toggle");
    if (!toggleBtn) {
        toggleBtn = document.createElement("button");
        toggleBtn.id = "custom-desc-toggle";
        toggleBtn.type = "button";
        toggleBtn.style.cssText = sharedBtnStyle;
        if (!btnVisible.desc) toggleBtn.style.display = "none";
        toggleBtn.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            isDescMode = !isDescMode;
            if (isDescMode) { isSadamMode = false; activeCustomBtn = null; updateCustomButtonStyles(); }
            updateDescButtonStyle(toggleBtn);
            updateSadamButtonStyle(sadamBtn);
            textarea.focus();
        };
        addStyleRefresh(toggleBtn, updateDescButtonStyle);
        updateDescButtonStyle(toggleBtn);
    }

    let sadamBtn = document.getElementById("custom-sadam-toggle");
    if (!sadamBtn) {
        sadamBtn = document.createElement("button");
        sadamBtn.id = "custom-sadam-toggle";
        sadamBtn.type = "button";
        sadamBtn.style.cssText = sharedBtnStyle;
        if (!btnVisible.sadam && !btnVisible.charsadam) sadamBtn.style.display = "none";
        sadamBtn.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            isSadamMode = !isSadamMode;
            if (isSadamMode) { isDescMode = false; activeCustomBtn = null; updateCustomButtonStyles(); }
            updateDescButtonStyle(toggleBtn);
            updateSadamButtonStyle(sadamBtn);
            textarea.focus();
        };
        addStyleRefresh(sadamBtn, updateSadamButtonStyle);
        updateSadamButtonStyle(sadamBtn);
    }

    let journalBtn = document.getElementById("custom-journal-toggle");
    let popup = document.getElementById("custom-journal-popup");
    let charList = [];

    if (!journalBtn) {
        journalBtn = document.createElement("button");
        journalBtn.id = "custom-journal-toggle";
        journalBtn.type = "button";
        journalBtn.innerText = "저널";
        journalBtn.style.cssText = sharedBtnStyle + `background-color: ${CONFIG.inactiveBg} !important; color: ${CONFIG.inactiveText} !important; border-color: ${CONFIG.inactiveBorder} !important;`;
        if (!btnVisible.journal) journalBtn.style.display = "none";

        popup = document.createElement("div");
        popup.id = "custom-journal-popup";

        const header = document.createElement("div");
        header.className = "cj-header";
        const titleSpan = document.createElement("span");
        titleSpan.textContent = "빠른 저널";
        const closeBtn = document.createElement("button");
        closeBtn.className = "cj-close-btn";
        closeBtn.textContent = "✕";
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            popup.classList.remove("show");
            journalBtn.style.setProperty("background-color", CONFIG.inactiveBg, "important");   // 이거 없으면 롤20이 자꾸 덮어씌우네요…….
            journalBtn.style.setProperty("color", CONFIG.inactiveText, "important");
        };
        header.appendChild(titleSpan);
        header.appendChild(closeBtn);
        popup.appendChild(header);

        header.addEventListener("mousedown", (e) => {
            if (e.target.classList.contains("cj-close-btn")) return;
            e.preventDefault();
            const r = popup.getBoundingClientRect();
            popup.style.left = r.left + "px"; popup.style.top = r.top + "px";
            popup.style.right = "auto"; popup.style.bottom = "auto";
            const sx = e.clientX, sy = e.clientY;
            const onMove = (e) => {
                popup.style.left = (r.left + e.clientX - sx) + "px";
                popup.style.top  = (r.top  + e.clientY - sy) + "px";
            };
            const onUp = () => {
                popup.dataset.userMoved = "true";
                localStorage.setItem("r20_popup_left", popup.style.left);
                localStorage.setItem("r20_popup_top",  popup.style.top);
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup",   onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup",   onUp);
        });

        const searchContainer = document.createElement("div");
        searchContainer.className = "cj-search-container";
        const searchInput = document.createElement("input");
        searchInput.type = "text";
        searchInput.className = "cj-search-input";
        searchInput.placeholder = "검색...";
        searchInput.addEventListener("keydown", (e) => e.stopPropagation());
        searchContainer.appendChild(searchInput);

        const listContainer = document.createElement("div");
        listContainer.className = "cj-list-container";
        popup.appendChild(searchContainer);
        popup.appendChild(listContainer);

        let dragSrcValue = null;

        const clearDragStyles = () => {
            listContainer.querySelectorAll(".cj-item").forEach(el =>
                el.classList.remove("cj-drag-over-top", "cj-drag-over-bottom"));
        };

        const updateList = (filterText = "") => {
            listContainer.innerHTML = "";
            charList.filter(c => c.name.toLowerCase().includes(filterText.toLowerCase()))
            .forEach(char => {
                const item = document.createElement("div");
                const currentVal = speakingAsSelect ? speakingAsSelect.value : "";
                item.className = "cj-item" + (char.value === currentVal ? " cj-selected" : "");
                item.dataset.charValue = char.value;

                const handle = document.createElement("span");
                handle.className = "cj-drag-handle";
                handle.textContent = "⠿";
                handle.addEventListener("mousedown", (e) => {
                    e.preventDefault(); e.stopPropagation();
                    dragSrcValue = char.value;
                    item.style.opacity = "0.5";
                    document.body.style.userSelect = "none";
                    const onMove = (ev) => {
                        clearDragStyles();
                        const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".cj-item[data-char-value]");
                        if (target && target.dataset.charValue !== dragSrcValue) {
                            const mid = target.getBoundingClientRect().top + target.offsetHeight / 2;
                            target.classList.add(ev.clientY < mid ? "cj-drag-over-top" : "cj-drag-over-bottom");
                        }
                    };
                    const onUp = (ev) => {
                        item.style.opacity = "";
                        document.body.style.userSelect = "";
                        const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".cj-item[data-char-value]");
                        clearDragStyles();
                        if (target && target.dataset.charValue !== dragSrcValue) {
                            const fromIdx = charList.findIndex(c => c.value === dragSrcValue);
                            const toIdx   = charList.findIndex(c => c.value === target.dataset.charValue);
                            if (fromIdx !== -1 && toIdx !== -1) {
                                const mid   = target.getBoundingClientRect().top + target.offsetHeight / 2;
                                const after = ev.clientY >= mid;
                                const removed = charList.splice(fromIdx, 1)[0];
                                const newTo   = charList.findIndex(c => c.value === target.dataset.charValue);
                                charList.splice(after ? newTo + 1 : newTo, 0, removed);
                                localStorage.setItem("r20_char_order", JSON.stringify(charList.map(c => c.value)));
                                updateList(searchInput.value);
                            }
                        }
                        dragSrcValue = null;
                        window.removeEventListener("mousemove", onMove);
                        window.removeEventListener("mouseup",   onUp);
                    };
                    window.addEventListener("mousemove", onMove);
                    window.addEventListener("mouseup",   onUp);
                });

                const jItem = char.id ? document.querySelector(`li.character[data-itemid="${char.id}"]`) : null;
                const img   = jItem?.querySelector("img");
                const src   = img ? (img.getAttribute("src") || img.getAttribute("data-src") || "") : "";
                let avatarEl;
                if (src && !src.includes("images/character.png") && !src.includes("default")) {
                    avatarEl = document.createElement("img");
                    avatarEl.src = src; avatarEl.className = "cj-avatar";
                } else {
                    avatarEl = document.createElement("div");
                    avatarEl.className = "cj-avatar";
                    avatarEl.style.cssText = "display:flex;justify-content:center;align-items:center;font-size:9px;color:#888;";
                    avatarEl.textContent = "▼";
                }

                const nameSpan = document.createElement("span");
                nameSpan.textContent = char.name;

                item.appendChild(handle);
                item.appendChild(avatarEl);
                item.appendChild(nameSpan);
                item.onclick = (e) => {
                    if (e.target === handle) return;
                    if (speakingAsSelect) {
                        speakingAsSelect.value = char.value;
                        speakingAsSelect.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                    updateList(searchInput.value);
                };
                listContainer.appendChild(item);
            });
        };

        const loadCharacters = () => {
            const raw = [];
            if (speakingAsSelect) {
                Array.from(speakingAsSelect.options).forEach(opt => {
                    const name = opt.text.trim(), val = opt.value;
                    if (!name || !val) return;
                    raw.push({ value: val, name, id: val.startsWith("character|") ? val.split("|")[1] : null });
                });
            }
            let order = null;
            try { order = JSON.parse(localStorage.getItem("r20_char_order") || "null"); } catch(e) {}
            if (order) {
                const ordered = [];
                order.forEach(v => { const c = raw.find(r => r.value === v); if (c) ordered.push(c); });
                raw.forEach(c => { if (!ordered.find(o => o.value === c.value)) ordered.push(c); });
                charList = ordered;
            } else {
                charList = raw;
            }
            updateList(searchInput.value);
        };

// DOM -”-

        journalBtn.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            if (popup.classList.contains("show")) {
                popup.classList.remove("show");
                journalBtn.style.setProperty("background-color", CONFIG.inactiveBg, "important");
                journalBtn.style.setProperty("color", CONFIG.inactiveText, "important");
                return;
            }
            loadCharacters();
            const savedL = localStorage.getItem("r20_popup_left");
            const savedT = localStorage.getItem("r20_popup_top");
            if (savedL && savedT) {
                popup.style.left = savedL; popup.style.top = savedT;
                popup.style.right = "auto"; popup.style.bottom = "auto";
            } else if (!popup.dataset.userMoved) {
                const rect = journalBtn.getBoundingClientRect();
                popup.style.right  = (window.innerWidth - rect.left + 210) + "px";
                popup.style.bottom = (window.innerHeight - rect.top + 8) + "px";
                popup.style.left   = "auto"; popup.style.top = "auto";
            }
            const savedW = localStorage.getItem("r20_popup_w");
            const savedH = localStorage.getItem("r20_popup_h");
            if (savedW) popup.style.width = savedW;
            if (savedH) popup.style.height = savedH;
            popup.classList.add("show");
            journalBtn.style.setProperty("background-color", "#444", "important");
            journalBtn.style.setProperty("color", "#fff", "important");
            searchInput.value = ""; updateList("");
            searchInput.focus();
        };

        searchInput.oninput = (e) => updateList(e.target.value);

        const resizeHandle = document.createElement("div");
        resizeHandle.className = "cj-resize-handle";
        resizeHandle.addEventListener("mousedown", (e) => {
            e.preventDefault(); e.stopPropagation();
            const startX = e.clientX, startY = e.clientY;
            const startW = popup.offsetWidth, startH = popup.offsetHeight;
            const onMove = (ev) => {
                popup.style.width  = Math.max(150, startW + (ev.clientX - startX)) + "px";
                popup.style.height = Math.max(120, startH + (ev.clientY - startY)) + "px";
            };
            const onUp = () => {
                localStorage.setItem("r20_popup_w", popup.style.width);
                localStorage.setItem("r20_popup_h", popup.style.height);
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
        });
        popup.appendChild(resizeHandle);

        document.body.appendChild(popup);
    }

    leftBtnGroup.id = "custom-left-group";
    leftBtnGroup.appendChild(toggleBtn);
    leftBtnGroup.appendChild(sadamBtn);
    leftBtnGroup.appendChild(journalBtn);

    buttonRow.appendChild(leftBtnGroup);
    buttonRow.appendChild(sendBtn);

    const resizer = document.createElement("div");
    resizer.id = "custom-resizer";
    resizer.style.cssText = `
        width: 100%;
        height: 6px;
        cursor: ns-resize;
        background: transparent;
        border-top: 1px solid #ddd;
        margin-bottom: 2px;
        z-index: 2000;
        position: relative;
    `;

    let targetHeight = 90;
    let isApplying = false;

    const applyTextareaHeight = () => {
        if (isApplying) return;
        isApplying = true;
        textarea.style.setProperty("height", targetHeight + "px", "important");
        textarea.style.setProperty("min-height", targetHeight + "px", "important");
        isApplying = false;
    };
    applyTextareaHeight();

    textarea.style.setProperty("resize", "none", "important");
    textarea.style.setProperty("width", "100%", "important");
    textarea.style.setProperty("margin", "0", "important");
    textarea.style.setProperty("box-sizing", "border-box", "important");

    new MutationObserver(applyTextareaHeight).observe(textarea, {
        attributes: true,
        attributeFilter: ["style"]
    });

    resizer.addEventListener("mousedown", function (e) {
        e.preventDefault();
        const startY = e.clientY;
        const startHeight = targetHeight;
        document.body.style.setProperty("user-select", "none", "important");
        function doDrag(e) {
            const newHeight = startHeight + (startY - e.clientY);
            if (newHeight > 50) { targetHeight = newHeight; applyTextareaHeight(); }
        }
        function stopDrag() {
            document.body.style.removeProperty("user-select");
            window.removeEventListener("mousemove", doDrag);
            window.removeEventListener("mouseup", stopDrag);
        }
        window.addEventListener("mousemove", doDrag);
        window.addEventListener("mouseup", stopDrag);
    });

    container.appendChild(buttonRow);
    container.appendChild(resizer);
    container.appendChild(textarea);
    container.classList.add("layout-applied-v11");
    renderCustomButtons();
}

function applyDescPrefix(text) {
    const stripped = text.startsWith(CONFIG.prefix) ? text.slice(CONFIG.prefix.length) : text;
    if (!stripped.trim() || stripped.startsWith("/")) return text;
    return CONFIG.prefix + stripped;
}

function applySadamPrefix(text) {
    const trimmed = text.trim();
    if (!trimmed || trimmed.startsWith("/")) return text;
    return `/o [${trimmed}](#"style="color:#8CADA6;")`; //사담 텍스트 컬러
}

function applyCharSadamPrefix(text) {
    const trimmed = text.trim();
    if (!trimmed || trimmed.startsWith("/")) return text;
    return `[${trimmed}](#"style="color:Gainsboro; text-decoration:none;")`;
}

function applyActivePrefix(text) {
	text = text.trimStart();
    if (activeCustomBtn) {
        const content = activeCustomBtn.content;
        const match = content.match(/^([\s\S]*?)\?\{[^}]*\}([\s\S]*)$/);
        if (match) return match[1] + text + match[2];
        return content;
    }

    let baseText = text;
    const asRegex = /^\/as\s+"[^"]+"\s*/i;
    if (asRegex.test(baseText)) baseText = baseText.replace(asRegex, "");

    if (isDescMode) return applyDescPrefix(baseText);
    if (isSadamMode) {
        if (btnVisible.charsadam) return applyCharSadamPrefix(baseText);
        else return applySadamPrefix(baseText);
    }

    const speakingAsSelect = document.getElementById("speakingas");
    const nameInput = document.getElementById("custom-speaker-name");
    if (speakingAsSelect && nameInput) {
        const originalName = speakingAsSelect.options[speakingAsSelect.selectedIndex]?.text || "";
        const customName = nameInput.value.trim();
        const trimmedText = baseText.trim();
        if (customName !== "" && customName !== originalName && !trimmedText.startsWith("/")) {
            return `/as "${customName}" ${baseText}`;
        }
    }
    return baseText;
}

document.addEventListener("keydown", (e) => {
    const target = e.target;
    if (target.tagName === "TEXTAREA" && target.classList.contains("ui-autocomplete-input")) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.stopImmediatePropagation();
            target.value = applyActivePrefix(target.value);
            target.dispatchEvent(new Event("input", { bubbles: true }));
            const sendBtn = document.getElementById("chatSendBtn");
            if (sendBtn) sendBtn.click();
        }
        if (e.key === "ArrowUp") {
            setTimeout(() => {
                let val = target.value;
                val = val.replace(/^\/as\s+"[^"]+"\s*/i, "");
                val = val.replace(/^\/desc\s+/i, "");

                const sadamMatch = val.match(/^\/o\s+\[(.*?)\]\(#"style="color:#aaaaaa;"\)/i);
                if (sadamMatch) {
                    val = sadamMatch[1];
                } else {
                    const charSadamMatch = val.match(/^\[(.*?)\]\(#"style="color:Gainsboro;\s*text-decoration:none;"\)/i);
                    if (charSadamMatch) val = charSadamMatch[1];
                }

                if (target.value !== val) target.value = val;
            }, 10);
        }
    }
}, true);

document.addEventListener("mousedown", (e) => {
    if (e.target.id === "chatSendBtn" || e.target.closest("#chatSendBtn")) {
        const textarea = document.querySelector("#textchat-input textarea");
        if (textarea) {
            textarea.value = applyActivePrefix(textarea.value);
            textarea.dispatchEvent(new Event("input", { bubbles: true }));
        }
    }
}, true);

let _layoutTimer = null;
const observer = new MutationObserver(() => {
    clearTimeout(_layoutTimer);
    _layoutTimer = setTimeout(applyCocofoliaLayout, 100);
});
observer.observe(document.body, { childList: true, subtree: true });
applyCocofoliaLayout();

})();
