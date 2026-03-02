import { auth, db } from "./firebase-config.js";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    GoogleAuthProvider,
    signInWithPopup
} from "firebase/auth";
import {
    collection,
    addDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    where,
    orderBy
} from "firebase/firestore";

window.kodaEngine = (() => {
    // --- State ---
    let state = {
        isSubscribed: false,
        currentUser: null,
        records: [],
        categories: [
            { id: '수입 합계', keywords: ['애드센스', '협찬', '수입', '입금', '광고수익', '도네', '후원', '정산'], type: 'income', box: '수입' },
            { id: '식대', keywords: ['식대', '밥', '회식', '미팅', '커피', '편의점', '식사', '음식', '음식비', '외식', '식사비'], type: 'expense', box: '15' },
            { id: '여비교통비', keywords: ['교통', '차비', '택시', '버스', '지하철', '주유', '기름', '톨게이트', '주차'], type: 'expense', box: '15' },
            { id: '촬영소품', keywords: ['소품', '배경', '의상', '분장', '액세서리', '가발'], type: 'expense', box: '11' },
            { id: '장비비', keywords: ['장비', '카메라', '마이크', '조명', '렌즈', '컴퓨터', 'PC', '모니터', '삼각대'], type: 'expense', box: '22' },
            { id: '소프트웨어/구독', keywords: ['구독', '툴', '프로그램', '편집툴', '클라우드', '어도비', '프리미어', '라이선스', '폰트'], type: 'expense', box: '22' },
            { id: '외주/편집', keywords: ['외주', '편집', '디자인', '썸네일', '컷편집', '제작비'], type: 'expense', box: '21' },
            { id: '통신비', keywords: ['통신', '인터넷', '휴대폰', '요금제'], type: 'expense', box: '19' },
            { id: '소모품비', keywords: ['소모품', '사무용품', '펜', '종이', '문구', '건전지'], type: 'expense', box: '22' },
            { id: '수선유지비', keywords: ['수선', '유지', '수리', '보수', '수리비'], type: 'expense', box: '22' },
            { id: '월세/임차료', keywords: ['월세', '임대료', '임차료', '관리비', '스튜디오'], type: 'expense', box: '13' },
            { id: '수도광열비', keywords: ['수도', '전기', '가스', '난방', '냉난방'], type: 'expense', box: '18' },
            { id: '보험료', keywords: ['보험', '국민연금', '건강보험', '자동차보험', '산재'], type: 'expense', box: '15' },
            { id: '세금과공과', keywords: ['세금', '면허세', '재산세', '공과금', '범칙금'], type: 'expense', box: '20' },
            { id: '지급수수료', keywords: ['수수료', '뱅킹수수료', '결제수수료', '이체수수료'], type: 'expense', box: '21' },
            { id: '광고선전비', keywords: ['광고', '홍보', '마케팅'], type: 'expense', box: '22' },
            { id: '기타필요경비', keywords: [], type: 'expense', box: '22' }
        ],
        lastDetected: null,
        recognition: null,
        isAuthInitialized: false,
        voiceTargetYear: null,
        currentYear: 2026,
        allRecords: [],
        activeReportType: null
    };

    const get = (id) => document.getElementById(id);
    const formatCurrency = (num) => new Intl.NumberFormat('ko-KR').format(Math.floor(num));

    const showToast = (msg, type = 'success') => {
        let toast = get('app-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'app-toast';
            document.body.appendChild(toast);
        }
        toast.innerText = msg;
        toast.className = `toast-visible ${type}`;
        setTimeout(() => toast.className = '', 3000);
    };

    const hometaxInfo = {
        '11': { label: '매입비용(촬영소품)', scope: '콘텐츠 촬영용 소품, 의상, 배경지 등' },
        '13': { label: '임차료(스튜디오)', scope: '사업장/스튜디오 월세 및 관리비' },
        '14': { label: '접대비(미팅식대)', scope: '비즈니스 식대 및 협력자 선물' },
        '15': { label: '복리후생비(식대)', scope: '본인 외 인력 식대, 음료' },
        '17': { label: '여비교통비', scope: '택시비, 기차표, 대중교통' },
        '19': { label: '통신비', scope: '인터넷 요금, 업무용 휴대폰' },
        '21': { label: '지급수수료', scope: '컷편집, 썸네일 제작 외주비' },
        '22': { label: '장비/광고/기타', scope: '카메라, 광고비, 어도비 구독료, 소모품' }
    };

    const navigate = (path) => {
        window.location.hash = path === '/' ? '#/' : `#${path}`;
        handleRouting();
    };

    const handleRouting = () => {
        const hash = window.location.hash || '#/';
        const landing = get('user-type-overlay');
        const dashboard = get('app-container');
        if (!landing || !dashboard) return;
        if (!state.isAuthInitialized) return;

        if (hash === '#/dashboard' || hash.startsWith('#/dashboard')) {
            if (state.currentUser) {
                landing.style.display = 'none';
                dashboard.style.display = 'flex';
                render();
            } else {
                navigate('/');
            }
        } else {
            landing.style.display = 'flex';
            dashboard.style.display = 'none';
        }
    };

    const render = () => {
        if (state.currentUser) {
            const statusIndicator = get('user-status-indicator');
            const userIdDisplay = get('logged-in-user-id');
            if (statusIndicator) statusIndicator.style.display = 'block';
            if (userIdDisplay) userIdDisplay.innerText = state.currentUser.email.split('@')[0];
        }
        const historyList = get('history-list-mvp');
        if (!historyList) return;
        const filtered = state.records.slice(0, 10);
        if (filtered.length === 0) {
            historyList.innerHTML = '<tr><td colspan="5" class="empty-row">기록이 없습니다.</td></tr>';
        } else {
            historyList.innerHTML = filtered.map(r => `
                <tr>
                    <td class="cell-date">${r.date.slice(5).replace('-', '/')}</td>
                    <td class="cell-type ${r.type}">${r.type === 'income' ? '수입' : '경비'}</td>
                    <td class="cell-cat">${r.label || r.category}</td>
                    <td class="cell-amt">${formatCurrency(r.amount)}원</td>
                    <td style="text-align:right;"><button class="delete-btn" onclick="kodaEngine.deleteRecord('${r.id}')">✕</button></td>
                </tr>
            `).join('');
        }
    };

    const init = async () => {
        console.log("유튜버 종합소득세 신고앱 시작");
        if (localStorage.getItem('app_v') !== 'final') {
            localStorage.setItem('app_v', 'final');
            console.log("App Reset");
        }
        if (window.location.hash !== '#/') window.location.hash = '#/';
        onAuthStateChanged(auth, (user) => {
            state.currentUser = user;
            state.isAuthInitialized = true;
            if (user) {
                const q = query(collection(db, "users", user.uid, "records"), orderBy("date", "desc"));
                onSnapshot(q, (snap) => {
                    const allRecords = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    state.allRecords = allRecords;
                    state.records = allRecords.filter(r => r.date && r.date.startsWith(state.currentYear.toString() + '-'));
                    render();
                    if (state.activeReportType === 'current') window.kodaEngine.showYearlyCategorySummary();
                    else if (state.activeReportType === 'prev') window.kodaEngine.showPrevYearSummary();
                });
            }
            handleRouting();
        });
        window.addEventListener('hashchange', handleRouting);
    };

    const parseAmountOnly = (text) => {
        let amount = 0;
        let cleanText = text.replace(/[\s,]/g, '').replace(/원$/g, '');
        const eokMatch = cleanText.match(/([\d\.]+)\s*억/);
        if (eokMatch) amount += parseFloat(eokMatch[1]) * 100000000;
        const cheonmanMatch = cleanText.match(/([\d\.]+)\s*천만/);
        if (cheonmanMatch) amount += parseFloat(cheonmanMatch[1]) * 10000000;
        const baekmanMatch = cleanText.match(/([\d\.]+)\s*백만/);
        if (baekmanMatch) amount += parseFloat(baekmanMatch[1]) * 1000000;
        const manMatch = cleanText.match(/([\d\.]+)\s*(?!천만|백만)만/);
        if (manMatch) amount += parseFloat(manMatch[1]) * 10000;
        if (amount === 0) {
            const raw = cleanText.replace(/[^0-9]/g, '');
            if (raw) amount = parseInt(raw);
        }
        return amount;
    };

    const parseVoiceText = (text) => {
        const amount = parseAmountOnly(text);
        let category = '기타필요경비';
        const lower = text.toLowerCase();

        // 전체 카테고리에서 키워드 매칭 시도
        for (const cat of state.categories) {
            if (cat.keywords.some(k => lower.includes(k))) {
                category = cat.id;
                break;
            }
        }

        // 특정 번호 직접 언급 대응
        if (lower.includes("22번")) category = "광고선전비";
        else if (lower.includes("15번")) category = "식대";
        else if (lower.includes("17번")) category = "여비교통비";
        else if (lower.includes("13번")) category = "월세/임차료";
        else if (lower.includes("11번")) category = "촬영소품";

        return {
            type: category === '수입 합계' ? 'income' : 'expense',
            category: category,
            label: text.split(/[0-9]|만|원|억/)[0].trim() || category,
            amount: amount,
            status: '준비'
        };
    };

    const closeVoiceModal = () => {
        if (state.recognition) {
            state.recognition.stop();
        }
        get('voice-modal').style.display = 'none';
        state.lastDetected = null;
    };

    return {
        init,
        login: async (e) => {
            if (e) e.preventDefault();
            const id = get('login-id').value.trim();
            const email = id.includes('@') ? id : `${id}@coda-tax.com`;
            const pwInput = get('login-pw');
            await signInWithEmailAndPassword(auth, email, pwInput.value.trim());
            navigate('/dashboard');
        },
        loginWithGoogle: async () => {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            navigate('/dashboard');
        },
        logout: async () => { if (confirm("로그아웃?")) { await signOut(auth); window.location.reload(); } },
        startVoiceRecord: (targetYear = null) => {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                alert("이 브라우저는 음성 인식을 지원하지 않습니다.");
                return;
            }

            const modal = get('voice-modal');
            if (modal) modal.style.display = 'flex';

            const statusText = get('voice-status-text');
            const textDisplay = get('voice-transcribed-text');
            const resultBox = get('voice-result-box');

            if (statusText) statusText.innerText = "듣고 있습니다...";
            if (textDisplay) textDisplay.innerText = "...";
            if (resultBox) resultBox.style.display = 'none';

            state.voiceTargetYear = targetYear || (state.activeReportType === 'prev' ? state.currentYear - 1 : state.currentYear);

            if (!state.recognition) {
                state.recognition = new SpeechRecognition();
                state.recognition.lang = 'ko-KR';
                state.recognition.interimResults = true;
                state.recognition.continuous = false;

                state.recognition.onstart = () => {
                    if (statusText) statusText.innerText = "말씀해 주세요...";
                };

                state.recognition.onresult = (event) => {
                    const text = event.results[event.results.length - 1][0].transcript;
                    if (textDisplay) textDisplay.innerText = text;
                    if (event.results[event.results.length - 1].isFinal) {
                        state.lastDetected = parseVoiceText(text);
                        if (resultBox) resultBox.style.display = 'block';
                        if (statusText) statusText.innerText = "인식 완료!";
                    }
                };

                state.recognition.onend = () => {
                    if (!state.lastDetected && statusText) {
                        statusText.innerText = "다시 시도해 주세요.";
                    }
                };

                state.recognition.onerror = (event) => {
                    if (statusText) statusText.innerText = `오류: ${event.error}`;
                };
            }

            try {
                if (state.recognition && state.recognition.state !== 'active') {
                    state.recognition.start();
                }
            } catch (e) {
                if (state.recognition) state.recognition.stop();
                setTimeout(() => {
                    try { state.recognition.start(); } catch (err) { }
                }, 400);
            }
        },
        closeVoiceModal,
        confirmVoiceEntry: async () => {
            if (!state.lastDetected) return;
            const rec = { ...state.lastDetected };
            rec.date = state.voiceTargetYear ? `${state.voiceTargetYear}-12-31` : new Date().toISOString().split('T')[0];
            await addDoc(collection(db, "users", state.currentUser.uid, "records"), rec);
            closeVoiceModal();
            showToast("실적이 성공적으로 기록되었습니다! 🎉");
        },
        deleteRecord: async (id) => { if (confirm("삭제?")) await deleteDoc(doc(db, "users", state.currentUser.uid, "records", id)); },
        showYearlyCategorySummary: () => {
            state.activeReportType = 'current';
            const records = state.records;
            const boxGroups = {};
            records.forEach(r => {
                const cat = state.categories.find(c => c.id === r.category) || { box: '22' };
                const label = `[${cat.box}] ${hometaxInfo[cat.box]?.label || '기타'}`;
                boxGroups[label] = (boxGroups[label] || 0) + Number(r.amount);
            });
            let html = '<div style="font-size:0.9rem; position:relative;">';
            html += `<div style="background:rgba(59,130,246,0.1); padding:20px; border-radius:16px; margin-bottom:20px; text-align:center;">
                <button onclick="kodaEngine.openBulkModal('${state.currentYear}')" class="btn-primary" style="padding:10px 20px; font-weight:700;">🤖 AI 요약 가이드 열기</button>
            </div>`;
            Object.keys(boxGroups).forEach(k => { html += `<div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border-color);"><span>${k}</span><span>${formatCurrency(boxGroups[k])}원</span></div>`; });
            html += '</div>';
            get('report-title').innerText = `${state.currentYear}년 실적 (항목별)`;
            get('report-content').innerHTML = html;
            get('report-modal').style.display = 'flex';
        },
        showPrevYearSummary: () => {
            state.activeReportType = 'prev';
            const py = 2025; // 전년도 고정
            const records = state.allRecords.filter(r => r.date.startsWith(py + '-'));
            const boxGroups = {};
            records.forEach(r => {
                const cat = state.categories.find(c => c.id === r.category) || { box: '22' };
                const label = `[${cat.box}] ${hometaxInfo[cat.box]?.label || '기타'}`;
                boxGroups[label] = (boxGroups[label] || 0) + Number(r.amount);
            });
            let html = '<div style="font-size:0.9rem; position:relative;">';
            html += `<div style="background:rgba(59,130,246,0.1); padding:20px; border-radius:16px; margin-bottom:20px; text-align:center;">
                <p style="font-size:0.8rem; margin-bottom:10px; color:var(--accent);">2025년 카드 내역 분석이 필요하신가요?</p>
                <button onclick="kodaEngine.openBulkModal('2025')" class="btn-primary" style="padding:10px 20px; font-weight:700;">🤖 2025년 AI 요약 가이드</button>
            </div>`;
            Object.keys(boxGroups).forEach(k => { html += `<div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border-color);"><span>${k}</span><span>${formatCurrency(boxGroups[k])}원</span></div>`; });
            html += '</div>';
            get('report-title').innerText = `2025년 실적 (전년도)`;
            get('report-content').innerHTML = html;
            get('report-modal').style.display = 'flex';
        },
        closeReportModal: () => {
            const modal = get('report-modal');
            if (modal) modal.style.display = 'none';
        },
        openBulkModal: (year) => {
            state.voiceTargetYear = year;
            get('bulk-modal').style.display = 'flex';
            get('bulk-input-area').style.display = 'block';
        },
        copyGeminiPrompt: () => {
            const prompt = `내가 결제한 1년 치 내역을 줄게. 아래 홈택스 경비 번호별로 각각 합계를 계산해서 요약해줘...`;
            navigator.clipboard.writeText(prompt);
            alert("AI 요약용 프롬프트가 복사되었습니다! 🤖");
        }
    };
})();

window.addEventListener('DOMContentLoaded', () => {
    window.kodaEngine.init().catch(console.error);

    document.querySelectorAll('[id^="close-"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = e.target.id.replace('close-', '');
            const modal = document.getElementById(modalId + '-modal');
            if (modal) modal.style.display = 'none';
        });
    });

    get('close-report-modal')?.addEventListener('click', () => window.kodaEngine.closeReportModal());
    get('close-voice-modal-btn')?.addEventListener('click', () => window.kodaEngine.closeVoiceModal());
});
