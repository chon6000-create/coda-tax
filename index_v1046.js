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
            { id: '식대', keywords: ['식대', '밥', '회식', '미팅', '커피', '편의점', '식사'], type: 'expense', box: '15' },
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
        currentYear: new Date().getFullYear(),
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
        console.log("유튜버 종합소득세 신고앱 시작 (v1046)");
        if (localStorage.getItem('app_v') !== 'v1046') {
            localStorage.setItem('app_v', 'v1046');
            console.log("v1046 Reset");
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

        // Match specific category names or box numbers
        if (lower.includes("광고") || lower.includes("마케팅") || lower.includes("22번")) category = "광고선전비";
        else if (lower.includes("식대") || lower.includes("식비") || lower.includes("15번")) category = "식대";
        else if (lower.includes("교통") || lower.includes("택시") || lower.includes("17번")) category = "여비교통비";
        else if (lower.includes("월세") || lower.includes("임차") || lower.includes("13번")) category = "월세/임차료";
        else if (lower.includes("장비") || lower.includes("촬영") || lower.includes("11번")) category = "촬영소품";

        return {
            type: category === '수입 합계' ? 'income' : 'expense',
            category: category,
            label: text.split(/[0-9]|만|원/)[0].trim() || category,
            amount: amount,
            status: '준비'
        };
    };

    return {
        init,
        login: async (e) => {
            if (e) e.preventDefault();
            const id = get('login-id').value.trim();
            const pw = get('login-pw').value.trim();
            const email = id.includes('@') ? id : `${id}@coda-tax.com`;
            await signInWithEmailAndPassword(auth, email, pw);
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
            if (!SpeechRecognition) return;
            state.voiceTargetYear = targetYear;
            get('voice-modal').style.display = 'flex';
            get('voice-transcribed-text').innerText = "...기다리는 중";
            get('voice-result-box').style.display = 'none';

            if (!state.recognition) {
                state.recognition = new SpeechRecognition();
                state.recognition.lang = 'ko-KR';
                state.recognition.onresult = (event) => {
                    const text = event.results[event.results.length - 1][0].transcript;
                    get('voice-transcribed-text').innerText = text;
                    state.lastDetected = parseVoiceText(text);
                    get('voice-result-box').style.display = 'block';
                };
            }
            state.recognition.start();
        },
        confirmVoiceEntry: async () => {
            if (!state.lastDetected) return;
            const rec = { ...state.lastDetected };
            rec.date = state.voiceTargetYear ? `${state.voiceTargetYear}-12-31` : new Date().toISOString().split('T')[0];
            await addDoc(collection(db, "users", state.currentUser.uid, "records"), rec);
            get('voice-modal').style.display = 'none';
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
            html += `<div style="position:absolute; top:-40px; right:0; font-size:10px; opacity:0.3; color:white;">v1046</div>`;
            html += `<div style="background:rgba(59,130,246,0.1); padding:20px; border-radius:16px; margin-bottom:20px; text-align:center;">
                <button onclick="kodaEngine.openBulkModal('${state.currentYear}')" class="btn-primary" style="padding:10px 20px; font-weight:700;">🤖 AI 요약 가이드 열기</button>
            </div>`;
            Object.keys(boxGroups).forEach(k => { html += `<div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border-color);"><span>${k}</span><span>${formatCurrency(boxGroups[k])}원</span></div>`; });
            html += '</div>';
            get('report-title').innerText = `${state.currentYear}년 실적`;
            get('report-content').innerHTML = html;
            get('report-modal').style.display = 'flex';
        },
        showPrevYearSummary: () => {
            state.activeReportType = 'prev';
            const py = state.currentYear - 1;
            const records = state.allRecords.filter(r => r.date.startsWith(py + '-'));
            const boxGroups = {};
            records.forEach(r => {
                const cat = state.categories.find(c => c.id === r.category) || { box: '22' };
                const label = `[${cat.box}] ${hometaxInfo[cat.box]?.label || '기타'}`;
                boxGroups[label] = (boxGroups[label] || 0) + Number(r.amount);
            });
            let html = '<div style="font-size:0.9rem; position:relative;">';
            html += `<div style="position:absolute; top:-40px; right:0; font-size:10px; opacity:0.3; color:white;">v1046</div>`;
            html += `<div style="background:rgba(59,130,246,0.1); padding:20px; border-radius:16px; margin-bottom:20px; text-align:center;">
                <button onclick="kodaEngine.openBulkModal('${py}')" class="btn-primary" style="padding:10px 20px; font-weight:700;">🤖 AI 요약 가이드 열기</button>
            </div>`;
            Object.keys(boxGroups).forEach(k => { html += `<div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border-color);"><span>${k}</span><span>${formatCurrency(boxGroups[k])}원</span></div>`; });
            html += '</div>';
            get('report-title').innerText = `${py}년 실적`;
            get('report-content').innerHTML = html;
            get('report-modal').style.display = 'flex';
        },
        closeReportModal: () => get('report-modal').style.display = 'none',
        openBulkModal: (year) => {
            state.voiceTargetYear = year;
            get('bulk-modal').style.display = 'flex';
            get('bulk-input-area').style.display = 'block';
        },
        copyGeminiPrompt: () => {
            const prompt = `내가 결제한 1년 치 내역을 줄게. 아래 홈택스 경비 번호별로 각각 합계를 계산해서 요약해줘.
(단, 사적 지출, 의상비, 개인 식대 등 업무 무관 지출은 반드시 제외하고 계산해줘)

[경비 분류 번호]
- 11번: 촬영소품, 배경지
- 13번: 스튜디오 임차료, 월세
- 15번: 복리후생비(본인 외 식대)
- 17번: 여비교통비(택시, 주차)
- 19번: 업무용 통신비
- 21번: 지급수수료(편집 외주)
- 22번: 장비 구입비, 광고선전비, 기타

답변 형식:
광고비 22번: [합계]원
식대 15번: [합계]원
...`;
            navigator.clipboard.writeText(prompt);
            alert("AI 요약용 프롬프트가 복사되었습니다! 🤖\nChatGPT나 Gemini에 붙여넣으세요.");
        }
    };
})();

window.addEventListener('DOMContentLoaded', () => {
    window.kodaEngine.init().catch(console.error);
    get('close-bulk-modal')?.addEventListener('click', () => get('bulk-modal').style.display = 'none');
});
