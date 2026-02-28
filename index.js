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
        pendingCategory: null,
        pendingYear: null,
        isAuthInitialized: false, // New flag
        portoneId: 'imp33124838' // Verified from user's V1 API tab
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
        const isPaid = localStorage.getItem('yt_user_status') === 'paid';
        const landing = get('user-type-overlay');
        const dashboard = get('app-container');

        if (!landing || !dashboard) return;

        // CRITICAL: DO NOT ROUTE UNTIL AUTH IS INITIALIZED
        if (!state.isAuthInitialized) {
            console.log("Routing deferred - Auth not initialized");
            // Show a simple loading if needed, or just stay put
            return;
        }

        console.log("Routing Execution - Hash:", hash, "User:", state.currentUser ? state.currentUser.email : 'null', "isPaid:", isPaid);

        if (hash === '#/dashboard' || hash.startsWith('#/dashboard')) {
            // If logged in, we are good
            if (state.currentUser) {
                landing.style.display = 'none';
                dashboard.style.display = 'flex';
                render();
            }
            // If not logged in but has "paid" flag, we might let them see the container
            // but the data will be restricted by Firestore rules anyway.
            else if (isPaid) {
                // If we're here, it means we don't have a user but have 'paid' flag
                // This might be a race where Firebase is slow.
                console.log("Showing dashboard with 'paid' flag but no user yet");
                landing.style.display = 'none';
                dashboard.style.display = 'flex';
                render();
            }
            // Otherwise, boot to landing
            else {
                alert("로그인이 필요합니다. (Routing: redirect to landing)");
                console.log("Access denied - Redirecting to landing");
                navigate('/');
            }
        }
        else {
            // On Landing Page (#/)
            // If already logged in, go to dashboard
            if (state.currentUser) {
                console.log("Already logged in - Redirecting to dashboard");
                navigate('/dashboard');
            } else {
                landing.style.display = 'flex';
                dashboard.style.display = 'none';
            }
        }
    };

    const init = async () => {
        alert("세무정석 엔진 시작 (v1022 - Features)");
        onAuthStateChanged(auth, (user) => {
            console.log("onAuthStateChanged:", user ? user.email : 'no user');
            state.currentUser = user;
            state.isAuthInitialized = true; // Mark as initialized

            if (user) {
                localStorage.setItem('yt_user_status', 'paid');
                const q = query(collection(db, "users", user.uid, "records"), orderBy("date", "desc"));
                onSnapshot(q, (snap) => {
                    console.log("Firestore Snapshot received, count:", snap.docs.length);
                    state.records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    render();
                }, (err) => {
                    console.error("Firestore Snapshot Error:", err);
                });
            }

            // Trigger routing now that we have a definitive answer from Firebase
            handleRouting();
        });

        window.addEventListener('hashchange', handleRouting);

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
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

                // If we got a final transcript, parse it even if it's short
                if (final) {
                    console.log("Final Transcription Received:", final);
                    state.lastDetected = parseVoiceText(final);
                    if (statusText) statusText.innerText = "인식 성공! ✅";
                    if (resultBox) resultBox.style.display = 'block';
                } else if (interim) {
                    if (statusText) statusText.innerText = "듣고 있습니다...";
                }
            };
            state.recognition.onstart = () => {
                console.log("Speech Recognition started");
                const statusText = get('voice-status-text');
                if (statusText) statusText.innerText = "듣고 있습니다... (연결됨)";
            };
            state.recognition.onerror = (event) => {
                console.error("Speech Recognition Error:", event.error);
                const statusText = get('voice-status-text');
                if (statusText) statusText.innerText = "인식 오류: " + event.error;
                alert("음성 인식 오류: " + event.error + "\n(마이크 권한 또는 브라우저 지원 확인 필요)");
            };
            state.recognition.onend = () => {
                console.log("Speech Recognition Ended");
            };
        }
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
        for (const cat of state.categories) {
            if (cat.keywords.some(k => lower.includes(k))) {
                category = cat.id;
                break;
            }
        }
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
        return {
            date: dateStr,
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

        // --- Calculate Dashboard Summaries (This Month) ---
        let incomeTotal = 0;
        let expenseTotal = 0;
        const now = new Date();
        const curMonth = (now.getMonth() + 1).toString().padStart(2, '0');
        const curYear = now.getFullYear().toString();

        state.records.forEach(r => {
            if (r.date && r.date.startsWith(`${curYear}-${curMonth}`)) {
                if (r.type === 'income') incomeTotal += (Number(r.amount) || 0);
                else expenseTotal += (Number(r.amount) || 0);
            }
        });

        const incomeEl = get('monthly-income-total');
        const expenseEl = get('monthly-expense-total');
        const profitEl = get('monthly-profit-total');

        if (incomeEl) incomeEl.innerText = formatCurrency(incomeTotal) + '원';
        if (expenseEl) expenseEl.innerText = formatCurrency(expenseTotal) + '원';
        if (profitEl) profitEl.innerText = formatCurrency(incomeTotal - expenseTotal) + '원';

        const list = get('history-list-mvp');
        if (!list) return;
        const filtered = state.records.slice(0, 10);
        if (filtered.length === 0) {
            list.innerHTML = '<tr><td colspan="5" class="empty-row">기록이 없습니다.</td></tr>';
        } else {
            list.innerHTML = filtered.map(r => `
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

    const setupCardInputs = () => {
        const ids = ['k-c1-v999', 'k-c2-v999', 'k-c3-v999', 'k-c4-v999', 'k-em-v999', 'k-ey-v999', 'k-cv-v999', 'k-p2-v999'];
        ids.forEach((id, i) => {
            const el = get(id);
            if (!el) return;
            el.addEventListener('input', (e) => {
                let v = e.target.value.replace(/\D/g, '');
                e.target.value = v;
                if (v.length >= e.target.maxLength && ids[i + 1]) get(ids[i + 1]).focus();
            });
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.value && ids[i - 1]) get(ids[i - 1]).focus();
            });
        });
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
            localStorage.setItem('yt_user_status', 'paid');
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
            localStorage.setItem('yt_user_status', 'paid');
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
                // Update state immediately to prevent routing race
                state.currentUser = result.user;
                state.isAuthInitialized = true;
                localStorage.setItem('yt_user_status', 'paid');
                console.log("Google Login success - Redirecting...");
                navigate('/dashboard');
            }
        } catch (error) {
            console.error("Google Login Error Details:", error);
            let msg = "구글 로그인 중 오류가 발생했습니다.";

            // Common Firebase Auth errors
            switch (error.code) {
                case 'auth/popup-blocked':
                    msg = "⚠️ 브라우저 팝업이 차단되었습니다. 주소창 옆의 팝업 허용 버튼을 눌러주세요.";
                    break;
                case 'auth/popup-closed-by-user':
                    return; // No alert needed if user closed it
                case 'auth/cancelled-popup-request':
                    return;
                case 'auth/unauthorized-domain':
                    msg = "⚠️ 현재 도메인이 승인되지 않았습니다. Firebase 콘솔에서 도메인을 추가해주세요.";
                    break;
                case 'auth/network-request-failed':
                    msg = "⚠️ 네트워크 연결이 불안정합니다. 인터넷 연결을 확인해주세요.";
                    break;
                case 'auth/internal-error':
                    msg = "⚠️ 서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
                    break;
                default:
                    msg += `\n코드: ${error.code}\n메시지: ${error.message}`;
            }
            alert(msg);
        }
    };

    const requestKakaoPay = () => {
        const { IMP } = window;
        if (!IMP) {
            alert("결제 모듈 로드 중입니다.");
            return;
        }
        IMP.init(state.portoneId);
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

    return {
        init,
        requestKakaoPay,
        finalizeSignUp,
        login,
        logout: async () => {
            if (confirm("로그아웃 하시겠습니까?")) {
                try {
                    await signOut(auth);
                    localStorage.removeItem('yt_user_status');
                    // Force a hard reload to clear all states and redirect to landing
                    window.location.href = window.location.pathname + '#/';
                    window.location.reload();
                } catch (e) {
                    console.error("Logout error:", e);
                    alert("로그아웃 중 오류가 발생했습니다.");
                }
            }
        },
        navigate,
        tryStartService: () => {
            get('payment-view-initial').style.display = 'block';
            get('payment-view-success').style.display = 'none';
            get('payment-view-final-success').style.display = 'none';
            get('payment-modal').style.display = 'flex';
        },
        startVoiceRecord: () => {
            console.log("startVoiceRecord clicked");

            // Check for HTTPS (Web Speech API requirement)
            if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
                alert("⚠️ 음성 기록은 보안 연결(HTTPS)에서만 작동합니다.\n현재: " + location.protocol);
            }

            const modal = get('voice-modal');
            if (!modal) {
                alert("오류: 음성 모달 요소를 찾을 수 없습니다.");
                return;
            }

            get('voice-transcribed-text').innerText = "";
            get('voice-result-box').style.display = 'none';
            get('voice-status-text').innerText = "마이크 초기화 중...";
            modal.style.display = 'flex';

            if (state.recognition) {
                try {
                    console.log("Calling recognition.start()...");
                    state.recognition.start();
                } catch (e) {
                    console.error("Recognition Start Error:", e);
                    // If already started, just ignore or re-sync UI
                    if (e.name !== 'InvalidStateError') {
                        alert("마이크 시작 오류: " + e.message);
                    }
                }
            } else {
                alert("이 브라우저나 기기에서는 음성 인식을 지원하지 않습니다.");
            }
        },
        confirmVoiceEntry: async () => {
            if (!state.lastDetected) {
                alert("인식된 내용이 없습니다.");
                return;
            }
            if (!state.currentUser) {
                alert("로그인 정보가 없습니다. 다시 로그인해 주세요.");
                navigate('/');
                return;
            }
            const saveBtn = document.querySelector('#voice-result-box .btn-primary');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerText = "저장 중...";
            }
            try {
                // OPTIMISTIC CLOSURE
                const recordToSave = { ...state.lastDetected };
                get('voice-modal').style.display = 'none';
                state.lastDetected = null;
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerText = "저장하기";
                }

                // Ensure recognition is stopped when saving
                if (state.recognition) {
                    try { state.recognition.stop(); } catch (e) { }
                }

                showToast("백그라운드 저장 중... ⏳");
                const savePromise = addDoc(collection(db, "users", state.currentUser.uid, "records"), recordToSave);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Firestore Timeout (20s)")), 20000));

                const docRef = await Promise.race([savePromise, timeoutPromise]);
                console.log("Firestore Save Success - ID:", docRef.id);
                showToast("심어두기가 완료되었습니다! 🎉");
            } catch (e) {
                console.error("Firestore Save Error/Timeout:", e);
                showToast("저장 응답이 지연되고 있습니다.", "error");
            }
        },
        cancelVoiceModal: () => {
            console.log("cancelVoiceModal clicked");
            if (state.recognition) {
                try { state.recognition.stop(); } catch (e) { }
            }
            state.lastDetected = null;
            get('voice-modal').style.display = 'none';
            get('voice-transcribed-text').innerText = "";
            get('voice-result-box').style.display = 'none';
            get('voice-status-text').innerText = "듣고 있습니다...";
        },
        clearVoiceTranscript: () => {
            if (state.recognition) state.recognition.start();
        },
        openAddModal: () => get('edit-modal').style.display = 'flex',
        saveManualEntry: async (e) => {
            if (e) e.preventDefault();
            if (!state.currentUser) {
                alert("로그인 정보가 없습니다.");
                navigate('/');
                return;
            }
            const rec = {
                date: get('edit-date').value || new Date().toISOString().split('T')[0],
                type: get('edit-type').value,
                category: get('edit-category').value,
                amount: parseInt(get('edit-amount').value) || 0,
                status: '준비'
            };
            try {
                await addDoc(collection(db, "users", state.currentUser.uid, "records"), rec);
                alert("내역이 수동으로 저장되었습니다.");
                get('edit-modal').style.display = 'none';
            } catch (e) {
                console.error("Manual Save Error:", e);
                alert("수동 저장 실패: " + e.message);
            }
        },
        deleteRecord: async (id) => {
            if (confirm("정말 삭제하시겠습니까?")) {
                await deleteDoc(doc(db, "users", state.currentUser.uid, "records", id));
            }
        },
        showYearlyCategorySummary: () => {
            const categories = {};
            state.records.forEach(r => {
                const cat = r.label || r.category;
                categories[cat] = (categories[cat] || 0) + (Number(r.amount) || 0);
            });
            let msg = "[카테고리별 실적]\n";
            for (const [cat, amt] of Object.entries(categories)) {
                msg += `${cat}: ${formatCurrency(amt)}원\n`;
            }
            alert(msg || "기록이 없습니다.");
        },
        showPrevYearSummary: () => {
            const yearlyTotal = state.records.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
            alert(`[데이터 기반 통합 리포트]\n현재까지 누적 합계: ${formatCurrency(yearlyTotal)}원\n(전년도 데이터 연동 준비 중)`);
        },
        openHometax: () => window.open('https://www.hometax.go.kr', '_blank'),
        loginWithGoogle
    };
})();

window.addEventListener('DOMContentLoaded', () => {
    window.kodaEngine.init().catch(console.error);
});
