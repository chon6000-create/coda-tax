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

        if (hash === '#/dashboard' || hash.startsWith('#/dashboard')) {
            if (!state.currentUser && !isPaid) { navigate('/'); return; }
            landing.style.display = 'none';
            dashboard.style.display = 'flex';
            render();
        } else {
            landing.style.display = 'flex';
            dashboard.style.display = 'none';
        }
    };

    const init = () => {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                state.currentUser = user;
                localStorage.setItem('yt_user_status', 'paid');
                const q = query(collection(db, "users", user.uid, "records"), orderBy("date", "desc"));
                onSnapshot(q, (snap) => {
                    state.records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    render();
                });
                if (window.location.hash === '#/') navigate('/dashboard');
            } else {
                state.currentUser = null;
                localStorage.removeItem('yt_user_status');
                navigate('/');
                render();
            }
        });

        handleRouting();
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
                if (final) {
                    state.lastDetected = parseVoiceText(final);
                    if (statusText) statusText.innerText = "인식 성공! ✅";
                    if (resultBox) resultBox.style.display = 'block';
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
            label: text.split(/[0-9]|만|원/)[0].trim() || category,
            amount: amount,
            status: '준비'
        };
    };

    const render = () => {
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
        if (!id || !pw) { alert("아이디/비번을 입력해주세요."); return; }
        try {
            const email = id.includes('@') ? id : `${id}@coda-tax.com`;
            await createUserWithEmailAndPassword(auth, email, pw);
            alert("환영합니다! 가입이 완료되었습니다.");
            get('payment-modal').style.display = 'none';
            navigate('/dashboard');
        } catch (err) { alert("오류: " + err.message); }
    };

    const login = async (e) => {
        if (e) e.preventDefault();
        const id = get('login-id').value.trim();
        const pw = get('login-pw').value.trim();
        if (!id || !pw) return;
        try {
            const email = id.includes('@') ? id : `${id}@coda-tax.com`;
            await signInWithEmailAndPassword(auth, email, pw);
            navigate('/dashboard');
        } catch (err) { alert("아이디 또는 비밀번호가 틀렸습니다."); }
    };

    return {
        init,
        startVoiceRecord: () => {
            get('voice-transcribed-text').innerText = "";
            get('voice-result-box').style.display = 'none';
            get('voice-modal').style.display = 'flex';
            if (state.recognition) state.recognition.start();
        },
        clearVoiceTranscript: () => {
            if (state.recognition) state.recognition.start();
        },
        confirmVoiceEntry: async () => {
            if (!state.lastDetected || !state.currentUser) return;
            try {
                await addDoc(collection(db, "users", state.currentUser.uid, "records"), state.lastDetected);
                get('voice-modal').style.display = 'none';
                state.lastDetected = null;
            } catch (e) { alert("저장 실패"); }
        },
        deleteRecord: async (id) => {
            if (confirm("정말 삭제하시겠습니까?")) {
                await deleteDoc(doc(db, "users", state.currentUser.uid, "records", id));
            }
        },
        showCardInput: () => {
            get('payment-view-initial').style.display = 'none';
            get('payment-view-card').style.display = 'block';
            setupCardInputs();
        },
        confirmSubscription: () => {
            get('payment-view-card').style.display = 'none';
            get('payment-view-success').style.display = 'block';
        },
        finalizeSignUp,
        login,
        logout: () => signOut(auth),
        tryStartService: () => {
            get('payment-view-initial').style.display = 'block';
            get('payment-view-card').style.display = 'none';
            get('payment-view-success').style.display = 'none';
            get('payment-modal').style.display = 'flex';
        },
        openAddModal: () => get('edit-modal').style.display = 'flex',
        saveManualEntry: async (e) => {
            e.preventDefault();
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
        showYearlyCategorySummary: () => alert("상세 리포트 준비중입니다."),
        showPrevYearSummary: () => alert("전년도 환급금 계산 준비중입니다."),
        openHometax: () => window.open('https://www.hometax.go.kr', '_blank'),
        navigate
    };
})();
