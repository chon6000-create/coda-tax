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
            { id: '기타필요경비', keywords: [], type: 'expense', box: '22' }
        ],
        lastDetected: null,
        recognition: null,
        isAuthInitialized: false, // New flag
        voiceTargetYear: null,
        currentYear: new Date().getFullYear(),
        allRecords: [],
        activeReportType: null,
        bulkSavedCount: 0 // v1040
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
        '22': { label: '장비/기타', scope: '카메라, 어도비 구독료, 소모품' }
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

        // CRITICAL: DO NOT ROUTE UNTIL AUTH IS INITIALIZED
        if (!state.isAuthInitialized) {
            console.log("Routing deferred - Auth not initialized");
            return;
        }

        console.log("Routing Execution - Hash:", hash, "User:", state.currentUser ? state.currentUser.email : 'null');

        if (hash === '#/dashboard' || hash.startsWith('#/dashboard')) {
            // If strictly logged in, show dashboard
            if (state.currentUser) {
                landing.style.display = 'none';
                dashboard.style.display = 'flex';
                render();
            }
            // Otherwise, boot to landing
            else {
                console.log("Access denied - Redirecting to landing");
                navigate('/');
            }
        }
        else {
            // On Landing Page (#/)
            // v1025: DO NOT AUTO-REDIRECT to dashboard if logged in.
            // Let the user click Login/Start to proceed.
            landing.style.display = 'flex';
            dashboard.style.display = 'none';
        }
    };

    const init = async () => {
        console.log("유튜버 종합소득세 신고앱 시작 (v1042)");

        // v1028: Force hash to landing on cold load to prevent auto-redirect skip
        if (window.location.hash !== '#/') {
            console.log("Forcing landing page on load");
            window.location.hash = '#/';
        }

        onAuthStateChanged(auth, (user) => {
            console.log("onAuthStateChanged:", user ? user.email : 'no user');
            state.currentUser = user;
            state.isAuthInitialized = true; // Mark as initialized

            if (user) {
                // Ensure no yt_user_status is used for routing decisions
                const q = query(collection(db, "users", user.uid, "records"), orderBy("date", "desc"));
                onSnapshot(q, (snap) => {
                    console.log("Firestore Snapshot received, count:", snap.docs.length);
                    const allRecords = snap.docs.map(d => ({ id: d.id, ...d.data() }));

                    // Dashboard filter: Only show current year records
                    const currentYear = state.currentYear.toString();
                    state.records = allRecords.filter(r => r.date && r.date.startsWith(currentYear + '-'));
                    state.allRecords = allRecords; // v1039: Ensure this is set before re-rendering reports

                    render();

                    // v1038/v1039: Trigger report refresh if modal is open
                    if (state.activeReportType === 'current') {
                        window.kodaEngine.showYearlyCategorySummary();
                    } else if (state.activeReportType === 'prev') {
                        window.kodaEngine.showPrevYearSummary();
                    }
                }, (err) => {
                    console.error("Firestore Snapshot Error:", err);
                });
            }

            // Trigger routing now that we have a definitive answer from Firebase
            handleRouting();
        });

        window.addEventListener('hashchange', handleRouting);

        // Moved Speech Recognition setup into startVoiceRecord to allow targetYear parameter
    };

    const parseAmountOnly = (text) => {
        let amount = 0;
        let cleanText = text.replace(/[\s,]/g, '').replace(/원$/g, '');

        // 1. Digit-based parsing (20만, 1억 2천만, etc.)
        const eokMatch = cleanText.match(/([\d\.]+)\s*억/);
        if (eokMatch) amount += parseFloat(eokMatch[1]) * 100000000;
        const cheonmanMatch = cleanText.match(/([\d\.]+)\s*천만/);
        if (cheonmanMatch) amount += parseFloat(cheonmanMatch[1]) * 10000000;
        const baekmanMatch = cleanText.match(/([\d\.]+)\s*백만/);
        if (baekmanMatch) amount += parseFloat(baekmanMatch[1]) * 1000000;
        const manMatch = cleanText.match(/([\d\.]+)\s*(?!천만|백만)만/);
        if (manMatch) amount += parseFloat(manMatch[1]) * 10000;
        else if (!eokMatch && !cheonmanMatch && !baekmanMatch) {
            const simpleManMatch = cleanText.match(/([\d\.]+)\s*만/);
            if (simpleManMatch) amount += parseFloat(simpleManMatch[1]) * 10000;
        }

        // 2. Korean word-based parsing (이십, 오만, etc.)
        if (amount === 0) {
            const korMap = { '일': 1, '이': 2, '삼': 3, '사': 4, '오': 5, '육': 6, '칠': 7, '팔': 8, '구': 9, '십': 10, '백': 100, '천': 1000, '만': 10000, '억': 100000000 };
            const unitMap = { '십': 10, '백': 100, '천': 1000, '만': 10000, '억': 100000000 };

            let result = 0;
            let temp = 0;
            let lastNum = 0;

            for (let i = 0; i < cleanText.length; i++) {
                const char = cleanText[i];
                const num = korMap[char];
                if (num === undefined) continue;

                if (unitMap[char]) {
                    if (num >= 10000) {
                        result += (temp + (lastNum || 1)) * num;
                        temp = 0;
                        lastNum = 0;
                    } else {
                        temp += (lastNum || 1) * num;
                        lastNum = 0;
                    }
                } else {
                    lastNum = num;
                }
            }
            amount = result + temp + lastNum;
        }

        // 3. Fallback to raw digits
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

        // v1040: Greatly enhanced keywords for better HomeTax categorization
        if (lower.includes("식비") || lower.includes("커피") || lower.includes("간식") || lower.includes("밥값") || lower.includes("식사")) {
            category = "식비/접대비"; // Box 14/15
        } else if (lower.includes("월세") || lower.includes("임대료") || lower.includes("자리세") || lower.includes("스튜디오")) {
            category = "월세/임차료"; // Box 13
        } else if (lower.includes("카메라") || lower.includes("조명") || lower.includes("마이크") || lower.includes("삼각대") || lower.includes("렌즈") || lower.includes("장비") || lower.includes("기기") || lower.includes("컴퓨터") || lower.includes("모니터")) {
            category = "장비비"; // Box 22
        } else if (lower.includes("기름") || lower.includes("주유") || lower.includes("택시") || lower.includes("버스") || lower.includes("지하철") || lower.includes("교통") || lower.includes("주차")) {
            category = "여비교통비"; // Box 15/17
        } else if (lower.includes("소모품") || lower.includes("배터리") || lower.includes("케이블") || lower.includes("메모리")) {
            category = "소모품비"; // Box 22
        } else {
            for (const cat of state.categories) {
                if (cat.keywords.some(k => lower.includes(k))) {
                    category = cat.id;
                    break;
                }
            }
        }

        return {
            type: category === '수입 합계' ? 'income' : 'expense',
            category: category,
            label: text.split(/[0-9]|만|원/)[0].trim() || (amount === 0 ? text : category),
            amount: amount,
            status: '준비'
        };
    };

    const render = () => {
        // Update User Header
        if (state.currentUser) {
            const statusIndicator = get('user-status-indicator');
            const userIdDisplay = get('logged-in-user-id');
            if (statusIndicator) statusIndicator.style.display = 'block';
            if (userIdDisplay) userIdDisplay.innerText = state.currentUser.email.split('@')[0];
        } else {
            const statusIndicator = get('user-status-indicator');
            if (statusIndicator) statusIndicator.style.display = 'none';
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

    const finalizeSignUp = async (e) => {
        if (e) e.preventDefault();
        const id = get('reg-id').value.trim();
        const pw = get('reg-pw').value.trim();
        const submitBtn = get('reg-submit-btn');

        if (!id || !pw) {
            alert("아이디와 비밀번호를 모두 입력해주세요.");
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = "결제 및 가입 처리 중...";
            submitBtn.style.opacity = "0.7";
        }

        try {
            const email = id.includes('@') ? id : `${id}@coda-tax.com`;
            await createUserWithEmailAndPassword(auth, email, pw);
            get('payment-view-success').style.display = 'none';
            get('payment-view-final-success').style.display = 'block';
        } catch (err) {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = "시작하기";
                submitBtn.style.opacity = "1";
            }
            console.error("Auth Error Detail:", err.code, err.message);
            let userMsg = "가입 오류가 발생했습니다. ";
            if (err.code === 'auth/configuration-not-found') {
                userMsg = "Firebase 설정 오류: 'Email/Password' 인증을 활성화해 주세요.";
            } else if (err.code === 'auth/email-already-in-use') {
                userMsg = "이미 존재하는 아이디입니다.";
            } else if (err.code === 'auth/weak-password') {
                userMsg = "비밀번호는 6자리 이상이어야 합니다.";
            } else if (err.code === 'auth/invalid-email') {
                userMsg = "아이디 형식이 올바르지 않습니다.";
            }
            alert("⚠️ " + userMsg);
        }
    };

    const login = async (e) => {
        if (e) e.preventDefault();
        const id = get('login-id').value.trim();
        const pw = get('login-pw').value.trim();
        if (!id || !pw) return;
        try {
            const email = id.includes('@') ? id : `${id}@coda-tax.com`;
            const result = await signInWithEmailAndPassword(auth, email, pw);
            alert("로그인 성공! (UID: " + result.user.uid.slice(0, 5) + ")");
            state.currentUser = result.user;
            state.isAuthInitialized = true;
            navigate('/dashboard');
        } catch (err) {
            console.error("Login Error:", err);
            alert("로그인 오류: " + err.message);
        }
    };

    const loginWithGoogle = async () => {
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            if (result.user) {
                state.currentUser = result.user;
                state.isAuthInitialized = true;
                navigate('/dashboard');
            }
        } catch (error) {
            console.error("Google Login Error:", error);
            alert("구글 로그인 중 오류가 발생했습니다.");
        }
    };

    const requestKakaoPay = () => {
        const { IMP } = window;
        if (!IMP) {
            alert("결제 모듈 로드 중입니다.");
            return;
        }
        IMP.init("imp78556637");
        IMP.request_pay({
            pg: "kakaopay.TC0ONETIME",
            pay_method: "card",
            merchant_uid: "merchant_" + new Date().getTime(),
            name: "세무정석 프리미엄 멤버십",
            amount: 5900,
            buyer_email: "test@example.com",
            buyer_name: "테스트유저",
            buyer_tel: "010-1234-5678",
        }, (rsp) => {
            if (rsp.success) {
                get('payment-view-initial').style.display = 'none';
                get('payment-view-success').style.display = 'block';
            } else {
                alert("결제에 실패했습니다: " + rsp.error_msg);
            }
        });
    };

    const startVoiceRecord = (targetYear = null) => {
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
            alert("⚠️ 음성 기록은 보안 연결(HTTPS)에서만 작동합니다.");
            return;
        }
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("이 브라우저에서는 음성 인식을 지원하지 않습니다.");
            return;
        }
        state.voiceTargetYear = targetYear;
        const modal = get('voice-modal');
        get('voice-transcribed-text').innerText = "";
        get('voice-result-box').style.display = 'none';
        get('voice-status-text').innerText = "듣고 있습니다...";
        modal.style.display = 'flex';

        if (!state.recognition) {
            state.recognition = new SpeechRecognition();
            state.recognition.continuous = false;
            state.recognition.interimResults = true;
            state.recognition.lang = 'ko-KR';
            state.recognition.onresult = (event) => {
                const voiceText = get('voice-transcribed-text');
                const resultBox = get('voice-result-box');
                const statusText = get('voice-status-text');
                let interim = '', final = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) final += event.results[i][0].transcript;
                    else interim += event.results[i][0].transcript;
                }
                if (voiceText) voiceText.innerText = final || interim;
                if (final) {
                    state.lastDetected = parseVoiceText(final);
                    if (statusText) statusText.innerText = "인식 성공! ✅";
                    if (resultBox) resultBox.style.display = 'block';
                }
            };
        }
        try { state.recognition.start(); } catch (e) { }
    };

    const confirmVoiceEntry = async () => {
        if (!state.lastDetected) return;
        const recordToSave = { ...state.lastDetected };
        const isPastYear = state.voiceTargetYear && Number(state.voiceTargetYear) < state.currentYear;
        recordToSave.date = isPastYear ? `${state.voiceTargetYear}-12-31` : new Date().toISOString().split('T')[0];

        get('voice-modal').style.display = 'none';
        state.lastDetected = null;
        state.voiceTargetYear = null;
        if (state.recognition) try { state.recognition.stop(); } catch (e) { }

        await addDoc(collection(db, "users", state.currentUser.uid, "records"), recordToSave);
        showToast("심어두기가 완료되었습니다! 🎉");
    };

    return {
        init,
        requestKakaoPay,
        finalizeSignUp,
        login,
        logout: async () => {
            if (confirm("로그아웃 하시겠습니까?")) {
                await signOut(auth);
                window.location.reload();
            }
        },
        navigate,
        tryStartService: () => {
            get('payment-view-initial').style.display = 'block';
            get('payment-modal').style.display = 'flex';
        },
        startVoiceRecord,
        confirmVoiceEntry,
        cancelVoiceModal: () => {
            if (state.recognition) try { state.recognition.stop(); } catch (e) { }
            get('voice-modal').style.display = 'none';
        },
        clearVoiceTranscript: () => { if (state.recognition) state.recognition.start(); },
        openAddModal: () => get('edit-modal').style.display = 'flex',
        saveManualEntry: async (e) => {
            if (e) e.preventDefault();
            const rec = {
                date: get('edit-date').value || new Date().toISOString().split('T')[0],
                type: get('edit-type').value,
                category: get('edit-category').value,
                amount: parseInt(get('edit-amount').value) || 0,
                status: '준비'
            };
            await addDoc(collection(db, "users", state.currentUser.uid, "records"), rec);
            get('edit-modal').style.display = 'none';
        },
        deleteRecord: async (id) => {
            if (confirm("정말 삭제하시겠습니까?")) {
                await deleteDoc(doc(db, "users", state.currentUser.uid, "records", id));
            }
        },
        showYearlyCategorySummary: () => {
            state.activeReportType = 'current';
            const currentYear = state.currentYear;
            const recordsCurrentYear = state.records.filter(r => r.date && r.date.startsWith(currentYear + '-'));
            const boxGroups = {};
            recordsCurrentYear.forEach(r => {
                const catId = r.category || '기타필요경비';
                const catMeta = state.categories.find(c => c.id === catId) || { id: '기타필요경비', box: '22' };
                const box = catMeta.box || '22';
                const boxInfo = hometaxInfo[box] || { label: '기타필요경비' };
                const boxLabel = `[${box}] ${boxInfo.label}`;
                if (!boxGroups[boxLabel]) boxGroups[boxLabel] = 0;
                boxGroups[boxLabel] += (Number(r.amount) || 0);
            });

            let html = '<div style="font-size:0.9rem; position:relative;">';
            html += `<div style="position:absolute; top:-40px; right:0; font-size:10px; opacity:0.3; color:white;">v1042</div>`;
            html += `
                <div style="background:rgba(59,130,246,0.1); padding:20px; border-radius:16px; margin-bottom:20px; text-align:center;">
                    <div style="font-size:0.8rem; color:var(--primary); margin-bottom:10px; font-weight:700;">🎤 ${currentYear}년 내역 항목별 입력</div>
                    <button onclick="kodaEngine.startVoiceRecord('${currentYear}')"
                        style="width:50px; height:50px; border-radius:50%; background:var(--primary); border:none; color:white; font-size:1.2rem; cursor:pointer; box-shadow:0 8px 16px rgba(59,130,246,0.3);">🎙️</button>
                    <div style="margin-top:10px; font-size:0.75rem; color:var(--text-muted);">"교통비 20만원" 처럼 말씀해 주세요.</div>
                    
                    <button onclick="kodaEngine.openBulkModal('${currentYear}')" 
                        style="margin-top:15px; background:rgba(255,255,255,0.05); border:1px solid rgba(59,130,246,0.5); color:white; padding:8px 15px; border-radius:10px; font-size:0.8rem; cursor:pointer; display:flex; align-items:center; gap:8px; margin-left:auto; margin-right:auto;">
                        <span style="font-size:1rem;">🤖</span> 텍스트 일괄 입력
                    </button>
                </div>
            `;
            html += `<div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:12px; margin-bottom:15px; color:var(--text-primary); font-weight:700; text-align:center; font-size:0.95rem;">${currentYear}년 종합소득세 신고용</div>`;

            if (recordsCurrentYear.length === 0) {
                html += '<div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.85rem;">기록된 데이터가 없습니다.</div>';
            } else {
                const sortedKeys = Object.keys(boxGroups).sort();
                for (const label of sortedKeys) {
                    html += `<div style="display:flex; justify-content:space-between; padding:12px 0; border-bottom:1px solid var(--border-color);"><span style="font-weight:700;">${label}</span><span style="font-weight:700;">${formatCurrency(boxGroups[label])}원</span></div>`;
                }
            }
            html += '</div>';
            get('report-title').innerText = `${currentYear}년 실적`;
            get('report-content').innerHTML = html;
            get('report-modal').style.display = 'flex';
        },
        showPrevYearSummary: () => {
            state.activeReportType = 'prev';
            const prevYear = state.currentYear - 1;
            const recordsPrevYear = (state.allRecords || state.records).filter(r => r.date && r.date.startsWith(prevYear + '-'));
            const boxGroups = {};
            recordsPrevYear.forEach(r => {
                const catId = r.category || '기타필요경비';
                const catMeta = state.categories.find(c => c.id === catId) || { id: '기타필요경비', box: '22' };
                const box = catMeta.box || '22';
                if (r.type === 'income') {
                    const label = "[매출] 유튜브 수익";
                    if (!boxGroups[label]) boxGroups[label] = 0;
                    boxGroups[label] += (Number(r.amount) || 0);
                } else {
                    const boxInfo = hometaxInfo[box] || { label: '기타필요경비' };
                    const boxLabel = `[${box}] ${boxInfo.label}`;
                    if (!boxGroups[boxLabel]) boxGroups[boxLabel] = 0;
                    boxGroups[boxLabel] += (Number(r.amount) || 0);
                }
            });

            let html = '<div style="font-size:0.9rem; position:relative;">';
            html += `<div style="position:absolute; top:-40px; right:0; font-size:10px; opacity:0.3; color:white;">v1042</div>`;
            html += `
                <div style="background:rgba(59,130,246,0.1); padding:20px; border-radius:16px; margin-bottom:20px; text-align:center;">
                    <div style="font-size:0.8rem; color:var(--primary); margin-bottom:10px; font-weight:700;">🎤 전년도(${prevYear}년) 내역 항목별 입력</div>
                    <button onclick="kodaEngine.startVoiceRecord('${prevYear}')"
                        style="width:50px; height:50px; border-radius:50%; background:var(--primary); border:none; color:white; font-size:1.2rem; cursor:pointer; box-shadow:0 8px 16px rgba(59,130,246,0.3);">🎙️</button>
                    <div style="margin-top:10px; font-size:0.75rem; color:var(--text-muted);">"교통비 20만원" 처럼 말씀해 주세요.</div>
                    
                    <button onclick="kodaEngine.openBulkModal('${prevYear}')" 
                        style="margin-top:15px; background:rgba(255,255,255,0.05); border:1px solid rgba(59,130,246,0.5); color:white; padding:8px 15px; border-radius:10px; font-size:0.8rem; cursor:pointer; display:flex; align-items:center; gap:8px; margin-left:auto; margin-right:auto;">
                        <span style="font-size:1rem;">🤖</span> 텍스트 일괄 입력
                    </button>
                </div>
            `;
            html += `<div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:12px; margin-bottom:15px; color:var(--text-primary); font-weight:700; text-align:center; font-size:0.95rem;">전년도(${prevYear}년) 종합소득세 신고용</div>`;

            if (recordsPrevYear.length === 0) {
                html += '<div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.85rem;">기록된 데이터가 없습니다.</div>';
            } else {
                const sortedKeys = Object.keys(boxGroups).sort((a, b) => a.includes('[매출]') ? -1 : b.includes('[매출]') ? 1 : a.localeCompare(b));
                for (const label of sortedKeys) {
                    html += `<div style="display:flex; justify-content:space-between; padding:12px 0; border-bottom:1px solid var(--border-color);"><span style="font-weight:700;">${label}</span><span style="font-weight:700;">${formatCurrency(boxGroups[label])}원</span></div>`;
                }
            }
            html += '</div>';
            get('report-title').innerText = "전년도 실적";
            get('report-content').innerHTML = html;
            get('report-modal').style.display = 'flex';
        },
        closeReportModal: () => { get('report-modal').style.display = 'none'; },
        openHometax: () => window.open('https://www.hometax.go.kr', '_blank'),
        loginWithGoogle,
        openBulkModal: (year) => {
            console.log("v1042: Opening Bulk Modal for year", year);
            state.voiceTargetYear = year;
            get('bulk-modal').style.display = 'flex';
        },
        copyGeminiPrompt: () => {
            const year = state.voiceTargetYear || state.currentYear;
            const prompt = `카드/은행 결제 내역 텍스트를 분석해서 아래 JSON 형식의 배열로만 답변해줘.

분류 가이드 (CategoryID):
- '식대': 식당, 카페, 편의점, 배달
- '장비비': 카메라, 조명, 마이크, 컴퓨터, 렌즈
- '소모품비': 배터리, 케이블, 메모리, 문구
- '여비교통비': 택시, 버스, 지하철, 주유, 주차
- '월세/임차료': 월세, 스튜디오 대관
- '광고선전비': 광고비, 마케팅
- '세금과공과': 공과금, 협회비

JSON 형식 예시:
[
  {"date": "${year}-01-15", "label": "항목명", "category": "CategoryID", "amount": 50000},
  {"date": "${year}-02-10", "label": "항목명", "category": "CategoryID", "amount": 120000}
]

답변에는 JSON 코드 블록만 포함해야 해. 이제 내가 내역을 줄게:`;
            navigator.clipboard.writeText(prompt);
            alert("제미나이에 붙여넣을 프롬프트가 복사되었습니다!");
        },
        saveBulkRecords: async () => {
            const input = get('bulk-json-input').value.trim();
            if (!input) return;
            try {
                const data = JSON.parse(input.replace(/```json|```/g, '').trim());
                for (const item of data) {
                    await addDoc(collection(db, "users", state.currentUser.uid, "records"), {
                        date: item.date,
                        label: item.label || "일괄 입력",
                        category: item.category || "기타필요경비",
                        amount: Number(item.amount),
                        type: 'expense'
                    });
                }
                showToast("일괄 저장이 완료되었습니다! 🤖");
                get('bulk-modal').style.display = 'none';
                get('bulk-json-input').value = "";
            } catch (e) { alert("데이터 형식이 올바르지 않습니다."); }
        }
    };
})();

window.addEventListener('DOMContentLoaded', () => {
    window.kodaEngine.init().catch(console.error);
    get('close-bulk-modal')?.addEventListener('click', () => get('bulk-modal').style.display = 'none');
    get('save-bulk-btn')?.addEventListener('click', () => window.kodaEngine.saveBulkRecords());
});
