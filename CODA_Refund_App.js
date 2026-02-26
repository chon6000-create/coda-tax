import { auth, db } from "./firebase-config.js";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut
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
            { id: '수입 합계', keywords: ['애드센스', '협찬', '수입', '입금', '광고수익', '도네', '후원'], type: 'income', box: '수입' },
            { id: '식대', keywords: ['식대', '밥', '회식', '미팅', '커피'], type: 'expense', box: '15' },
            { id: '여비교통비', keywords: ['교통', '차비', '택시', '버스', '지하철', '주유', '기름'], type: 'expense', box: '15' },
            { id: '촬영소품', keywords: ['소품', '배경', '의상', '분장'], type: 'expense', box: '11' },
            { id: '장비비', keywords: ['장비', '카메라', '마이크', '조명', '렌즈', '컴퓨터', 'PC'], type: 'expense', box: '22' },
            { id: '소프트웨어/구독', keywords: ['구독', '툴', '프로그램', '편집툴', '클라우드', '어도비', '프리미어', '라이선스'], type: 'expense', box: '22' },
            { id: '외주/편집', keywords: ['외주', '편집', '디자인', '썸네일', '컷편집'], type: 'expense', box: '21' },
            { id: '통신비', keywords: ['통신', '인터넷', '휴대폰'], type: 'expense', box: '19' },
            { id: '소모품비', keywords: ['소모품', '사무용품', '펜', '종이', '문구'], type: 'expense', box: '22' },
            { id: '수선유지비', keywords: ['수선', '유지', '수리', '보수'], type: 'expense', box: '22' },
            { id: '월세/임차료', keywords: ['월세', '임대료', '임차료', '관리비'], type: 'expense', box: '13' },
            { id: '수도광열비', keywords: ['수도', '전기', '가스', '난방'], type: 'expense', box: '18' },
            { id: '보험료', keywords: ['보험', '국민연금', '건강보험', '자동차보험'], type: 'expense', box: '15' },
            { id: '세금과공과', keywords: ['세금', '면허세', '재산세', '공과금'], type: 'expense', box: '20' },
            { id: '지급수수료', keywords: ['수수료', '뱅킹수수료', '결제수수료'], type: 'expense', box: '21' },
            { id: '기타필요경비', keywords: [], type: 'expense', box: '22' }
        ],
        lastDetected: null,
        recognition: null,
        pendingCategory: null,
        pendingYear: null
    };

    const get = (id) => document.getElementById(id);
    const formatCurrency = (num) => new Intl.NumberFormat('ko-KR').format(Math.floor(num));

    const navigate = (path) => {
        window.location.hash = path === '/' ? '#/' : `#${path}`;
        handleRouting();
    };

    const handleRouting = (isInitialLoad = false) => {
        const hash = window.location.hash || '#/';
        const isPaid = localStorage.getItem('yt_user_status') === 'paid';
        const landing = get('user-type-overlay');
        const dashboard = get('app-container');

        if (!landing || !dashboard) return;

        if (hash === '#/dashboard' || hash.startsWith('#/dashboard')) {
            if (!state.currentUser && !isPaid) { navigate('/'); return; }
            landing.style.display = 'none';
            dashboard.style.display = 'flex';
            render();
        } else {
            if (isInitialLoad && state.currentUser) {
                navigate('/dashboard');
                return;
            }
            landing.style.display = 'flex';
            dashboard.style.display = 'none';
        }
    };

    const init = () => {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                state.currentUser = user;
                state.isSubscribed = true;
                localStorage.setItem('yt_user_status', 'paid');

                const q = query(
                    collection(db, "users", user.uid, "records"),
                    orderBy("date", "desc")
                );

                onSnapshot(q, (snapshot) => {
                    state.records = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    render();
                });

                if (window.location.hash === '#/') {
                    navigate('/dashboard');
                }
            } else {
                state.currentUser = null;
                state.isSubscribed = false;
                state.records = [];
                localStorage.removeItem('yt_user_status');
                navigate('/');
                render();
            }
        });

        handleRouting(true);
        window.addEventListener('hashchange', () => handleRouting(false));

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

                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                if (voiceText) {
                    const currentText = finalTranscript || interimTranscript;
                    if (currentText) {
                        voiceText.innerText = currentText;
                        voiceText.style.display = 'flex';
                    }
                }

                if (finalTranscript) {
                    if (get('voice-retry-btn')) get('voice-retry-btn').style.display = 'flex';
                    if (state.pendingCategory) {
                        applyCategoryAmount(finalTranscript);
                    } else {
                        state.lastDetected = parseVoiceText(finalTranscript);
                        if (statusText) {
                            statusText.innerText = "음성을 인식했습니다! ✅";
                            statusText.style.color = "var(--success)";
                        }
                        if (resultBox) resultBox.style.display = 'block';
                    }
                }
            };
        }
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
        else if (!eokMatch && !cheonmanMatch && !baekmanMatch) {
            const simpleManMatch = cleanText.match(/([\d\.]+)\s*만/);
            if (simpleManMatch) amount += parseFloat(simpleManMatch[1]) * 10000;
        }
        const cheonMatch = cleanText.match(/([\d\.]+)\s*천/);
        if (cheonMatch) amount += parseFloat(cheonMatch[1]) * 1000;
        if (amount === 0) {
            const rawNum = cleanText.replace(/[^0-9]/g, '');
            if (rawNum) amount = parseInt(rawNum);
        }
        return amount;
    };

    const parseVoiceText = (text) => {
        const amount = parseAmountOnly(text);
        let category = '기타필요경비';
        const lowerText = text.toLowerCase();
        for (const cat of state.categories) {
            if (cat.keywords.some(k => lowerText.includes(k))) {
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
            label: text.split(/[0-9]|만|원/)[0].trim() || category,
            amount,
            status: '준비',
            memo: text
        };
    };

    const startVoiceRecord = () => {
        state.pendingCategory = null;
        const modal = get('voice-modal');
        const statusText = get('voice-status-text');
        const voiceText = get('voice-transcribed-text');
        const resultBox = get('voice-result-box');
        if (voiceText) { voiceText.innerText = ""; voiceText.style.display = 'none'; }
        if (resultBox) resultBox.style.display = 'none';
        if (get('voice-retry-btn')) get('voice-retry-btn').style.display = 'none';
        if (statusText) {
            statusText.innerHTML = '<span class="rec-dot"></span>듣고 있습니다...';
            statusText.style.color = "var(--accent)";
        }
        if (modal) modal.style.display = 'flex';
        if (state.recognition) {
            try { state.recognition.start(); } catch (e) { }
        }
    };

    const clearVoiceTranscript = () => {
        if (state.pendingCategory) {
            startCategoryVoice(state.pendingCategory, state.pendingYear);
        } else {
            startVoiceRecord();
        }
    };

    const confirmVoiceEntry = async () => {
        if (!state.lastDetected || !state.currentUser) return;
        try {
            await addDoc(collection(db, "users", state.currentUser.uid, "records"), state.lastDetected);
            get('voice-modal').style.display = 'none';
            state.lastDetected = null;
        } catch (e) {
            console.error(e);
            alert("저장 실패");
        }
    };

    const setupCardInputs = () => {
        const cardFields = [
            'k-c1-v777', 'k-c2-v777', 'k-c3-v777', 'k-c4-v777',
            'k-em-v777', 'k-ey-v777', 'k-cv-v777', 'k-p2-v777'
        ];
        cardFields.forEach((id, index) => {
            const el = get(id);
            if (!el) return;
            ['focus', 'click', 'touchstart'].forEach(evt => {
                el.addEventListener(evt, () => {
                    if (/\D/.test(el.value)) el.value = '';
                });
            });
            el.addEventListener('input', (e) => {
                let val = e.target.value.replace(/\D/g, '');
                e.target.value = val;
                if (val.length >= e.target.maxLength) {
                    const next = get(cardFields[index + 1]);
                    if (next) {
                        next.focus();
                        if (next.tagName === 'INPUT') next.select();
                    }
                }
            });
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && e.target.value.length === 0) {
                    const prev = get(cardFields[index - 1]);
                    if (prev) {
                        prev.focus();
                        if (prev.tagName === 'INPUT') prev.select();
                    }
                }
            });
        });
    };

    const showCardInput = () => {
        get('payment-view-initial').style.display = 'none';
        get('payment-view-card').style.display = 'block';
        get('payment-view-success').style.display = 'none';
        setupCardInputs();
    };

    const confirmSubscription = () => {
        const btn = get('btn-pay-v777');
        if (btn) btn.style.opacity = '0.5';
        get('payment-view-initial').style.display = 'none';
        get('payment-view-card').style.display = 'none';
        const success = get('payment-view-success');
        success.style.display = 'block';
        setTimeout(() => { if (btn) btn.style.opacity = '1'; }, 1000);
    };

    const finalizeSignUp = async (e) => {
        if (e) e.preventDefault();
        const id = get('reg-id').value.trim();
        const pw = get('reg-pw').value.trim();
        if (!id || !pw) { alert("아이디와 비밀번호를 입력해주세요."); return; }
        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = "잠시만 기다려주세요...";
        }
        try {
            const email = id.includes('@') ? id : `${id}@coda-tax.com`;
            await createUserWithEmailAndPassword(auth, email, pw);
            alert("가입 및 결제가 완료되었습니다!");
            get('payment-modal').style.display = 'none';
            navigate('/dashboard');
        } catch (err) {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = "계정 생성 및 시작하기";
            }
            alert("⚠️ " + (err.message || "오류가 발생했습니다."));
        }
    };

    const login = async (e) => {
        if (e) e.preventDefault();
        const id = get('login-id').value.trim();
        const pw = get('login-pw').value.trim();
        if (!id || !pw) { alert("아이디와 비밀번호를 모두 입력해주세요."); return; }
        try {
            const email = id.includes('@') ? id : `${id}@coda-tax.com`;
            await signInWithEmailAndPassword(auth, email, pw);
            navigate('/dashboard');
        } catch (e) {
            alert("로그인에 실패했습니다.");
        }
    };

    const logout = async () => {
        if (!confirm("로그아웃 하시겠습니까?")) return;
        try {
            await signOut(auth);
            navigate('/');
        } catch (e) {
            console.error(e);
        }
    };

    const render = () => {
        const now = new Date();
        const curYearMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        const filtered = state.records.filter(r => r.date.startsWith(curYearMonth))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        if (state.currentUser) {
            get('user-status-indicator').style.display = 'block';
            get('logged-in-user-id').innerText = state.currentUser.email.split('@')[0];
        }
        const list = get('history-list-mvp');
        if (list) {
            const display = filtered.slice(0, 10);
            if (display.length === 0) {
                list.innerHTML = '<tr><td colspan="5" class="empty-row">기록이 없습니다.</td></tr>';
            } else {
                list.innerHTML = display.map((r) => `
                    <tr>
                        <td class="cell-date">${r.date.slice(5).replace('-', '/')}</td>
                        <td class="cell-type ${r.type}">${r.type === 'income' ? '수입' : '경비'}</td>
                        <td class="cell-cat">${r.label || r.category}</td>
                        <td class="cell-amt">${formatCurrency(r.amount)}</td>
                        <td style="text-align:right;"><button class="delete-btn" onclick="kodaEngine.deleteRecord('${r.id}')">✕</button></td>
                    </tr>
                `).join('');
            }
        }
    };

    const deleteRecord = async (id) => {
        if (!state.currentUser) return;
        if (confirm("삭제할까요?")) {
            try {
                await deleteDoc(doc(db, "users", state.currentUser.uid, "records", id));
            } catch (e) {
                console.error(e);
            }
        }
    };

    const tryStartService = () => {
        get('payment-view-initial').style.display = 'block';
        get('payment-view-card').style.display = 'none';
        get('payment-view-success').style.display = 'none';
        get('payment-modal').style.display = 'flex';
    };

    const goBack = () => navigate('/');
    const openHometax = () => window.open('https://www.hometax.go.kr', '_blank');
    const showPrevYearSummary = () => alert("지원 준비중입니다.");
    const showYearlyCategorySummary = () => alert("지원 준비중입니다.");
    const copyPrompt = () => alert("지원 준비중입니다.");
    const startCategoryVoice = () => alert("지원 준비중입니다.");
    const clearCategoryAmount = () => alert("지원 준비중입니다.");

    return {
        init,
        startVoiceRecord,
        clearVoiceTranscript,
        confirmVoiceEntry,
        showPrevYearSummary,
        showYearlyCategorySummary,
        copyPrompt,
        startCategoryVoice,
        clearCategoryAmount,
        openHometax,
        deleteRecord,
        goBack,
        tryStartService,
        showCardInput,
        confirmSubscription,
        finalizeSignUp,
        login,
        logout,
        openAddModal: () => get('edit-modal').style.display = 'flex',
        saveManualEntry: async (e) => {
            e.preventDefault();
            if (!state.currentUser) return;
            const rec = {
                date: get('edit-date').value || new Date().toISOString().split('T')[0],
                type: get('edit-type').value,
                category: get('edit-category').value,
                amount: parseInt(get('edit-amount').value) || 0,
                status: '준비'
            };
            try {
                await addDoc(collection(db, "users", state.currentUser.uid, "records"), rec);
                get('edit-modal').style.display = 'none';
            } catch (e) {
                console.error(e);
            }
        }
    };
})();
