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
        accounts: [], // No longer used for local storage
        records: [],
        categories: [
            { id: '수입 합계', keywords: ['애드센스', '협찬', '수입', '입금', '광고수익', '도네', '후원'], type: 'income', box: '수입' },
            // ... (rest of categories)
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
        pendingCategory: null, // For category-specific voice entry
        pendingYear: null      // For year-specific entry
    };

    const get = (id) => document.getElementById(id);
    const formatCurrency = (num) => new Intl.NumberFormat('ko-KR').format(Math.floor(num));

    // --- Routing & Navigation ---
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
            // Auto-redirect to dashboard only on INITIAL LOAD if already logged in and paid
            if (isInitialLoad && state.currentUser) {
                navigate('/dashboard');
                return;
            }
            landing.style.display = 'flex';
            dashboard.style.display = 'none';
        }
    };

    const init = () => {
        // Firebase Auth Listener
        onAuthStateChanged(auth, (user) => {
            if (user) {
                state.currentUser = user;
                state.isSubscribed = true; // Assume paid if logged in for now, or fetch from user profile
                localStorage.setItem('yt_user_status', 'paid');

                // Fetch Records from Firestore
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

        handleRouting(true); // Initial load check
        window.addEventListener('hashchange', () => handleRouting(false));


        // Initialize Speech Recognition
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
                    // Check if it's a category-specific entry
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

    // --- Voice Logic: Category-Specific (Previous Year) ---
    const startCategoryVoice = (cat, year) => {
        state.pendingCategory = cat;
        state.pendingYear = year;

        // Show the standard voice modal but with specific status
        const modal = get('voice-modal');
        const statusText = get('voice-status-text');
        const voiceText = get('voice-transcribed-text');
        const resultBox = get('voice-result-box');

        if (voiceText) { voiceText.innerText = ""; voiceText.style.display = 'none'; }
        if (resultBox) resultBox.style.display = 'none';
        if (get('voice-retry-btn')) get('voice-retry-btn').style.display = 'none';
        if (statusText) {
            statusText.innerText = `[${cat}] 합계 금액을 말씀해 주세요...`;
            statusText.style.color = "#fbbf24"; // Amber/Warn color
        }
        if (modal) modal.style.display = 'flex';

        if (state.recognition) {
            try { state.recognition.start(); } catch (e) { }
        }
    };

    const applyCategoryAmount = async (text) => {
        const amount = parseAmountOnly(text);
        if (amount > 0 && state.currentUser) {
            const finalCategory = state.pendingCategory;
            const newRec = {
                date: `${state.pendingYear}-12-31`,
                type: finalCategory === '수입 합계' ? 'income' : 'expense',
                category: finalCategory,
                label: `[실적] ${finalCategory}`,
                amount: amount,
                status: '전년실적',
                memo: `보이스 입력: ${text}`
            };

            try {
                await addDoc(collection(db, "users", state.currentUser.uid, "records"), newRec);
                get('voice-modal').style.display = 'none';
                showPrevYearSummary();
                state.pendingCategory = null;
                state.pendingYear = null;
            } catch (e) {
                console.error("Error adding document: ", e);
                alert("저장 중 오류가 발생했습니다.");
            }
        } else {
            alert("금액을 정확히 인식하지 못했습니다. 다시 시도해 주세요.");
        }
    };

    const clearCategoryAmount = async (target, year, isBox = false) => {
        if (!state.currentUser) return;
        if (confirm(`[${target}] 데이터를 삭제하고 초기화하시겠습니까?\n(언제든지 다시 입력할 수 있습니다.)`)) {
            const yearStr = year.toString();
            const toDelete = state.records.filter(r => {
                const matchesYear = r.date.startsWith(yearStr);
                if (!matchesYear) return false;

                if (isBox) {
                    if (target === '수입 합계') return r.type === 'income';
                    const catObj = state.categories.find(c => c.id === r.category);
                    return catObj && catObj.box === target;
                } else {
                    if (target === '수입 합계') return r.type === 'income';
                    return r.category === target;
                }
            });

            for (const r of toDelete) {
                if (r.id) await deleteDoc(doc(db, "users", state.currentUser.uid, "records", r.id));
            }
            showPrevYearSummary();
        }
    };

    const parseAmountOnly = (text) => {
        let amount = 0;

        // --- 1. CLEAN TEXT ---
        let cleanText = text.replace(/[\s,]/g, '').replace(/원$/g, '');

        // --- 2. MULTI-UNIT PARSING (억, 천만, 백만, 만, 천) ---
        // 억 (100,000,000)
        const eokMatch = cleanText.match(/([\d\.]+)\s*억/);
        if (eokMatch) amount += parseFloat(eokMatch[1]) * 100000000;

        // 천만 (10,000,000)
        const cheonmanMatch = cleanText.match(/([\d\.]+)\s*천만/);
        if (cheonmanMatch) amount += parseFloat(cheonmanMatch[1]) * 10000000;

        // 백만 (1,000,000)
        const baekmanMatch = cleanText.match(/([\d\.]+)\s*백만/);
        if (baekmanMatch) amount += parseFloat(baekmanMatch[1]) * 1000000;

        // 만 (10,000)
        const manMatch = cleanText.match(/([\d\.]+)\s*(?!천만|백만)만/); // Avoid double matching with 백만/천만
        if (manMatch) amount += parseFloat(manMatch[1]) * 10000;
        else if (!eokMatch && !cheonmanMatch && !baekmanMatch) { // Only try simple '만' if no higher units matched
            const simpleManMatch = cleanText.match(/([\d\.]+)\s*만/);
            if (simpleManMatch) amount += parseFloat(simpleManMatch[1]) * 10000;
        }

        // 천 (1,000)
        const cheonMatch = cleanText.match(/([\d\.]+)\s*천/);
        if (cheonMatch) amount += parseFloat(cheonMatch[1]) * 1000;

        // --- 3. FALLBACK: PURE NUMBERS ---
        if (amount === 0) {
            const rawNum = cleanText.replace(/[^0-9]/g, '');
            if (rawNum) amount = parseInt(rawNum);
        }

        // --- 4. KOREAN WORD MATCHING ---
        if (amount === 0) {
            if (text.includes('백만')) amount = 1000000;
            else if (text.includes('오십만')) amount = 500000;
            else if (text.includes('십만')) amount = 100000;
            else if (text.includes('일억')) amount = 100000000;
        }

        return amount;
    };

    // --- Standard Voice Entry ---
    const startVoiceRecord = () => {
        state.pendingCategory = null; // Regular entry
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

    const parseVoiceText = (text) => {
        const amount = parseAmountOnly(text);
        let category = '기타필요경비';
        const lowerText = text.toLowerCase();

        // Dynamic Mapping: Search all categories for keywords
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

    // --- Summary & Dashboard Actions ---
    const hometaxInfo = {
        '11': { label: '매입비용(촬영소품)', scope: '콘텐츠 촬영용 소품, 의상, 배경지, 촬영용 식재료 등 구매비' },
        '12': { label: '상품/재료비', scope: '콘텐츠 제작에 소요되는 소모성 재료비 및 상품 구매비' },
        '13': { label: '임차료(스튜디오)', scope: '사업장/작업실/스튜디오 월세 및 관리비' },
        '14': { label: '접대비(미팅식대)', scope: '파트너사/브랜드 미팅 식대, 외부 협력자 선물 및 접찰비' },
        '15': { label: '복리후생비(식대/음료)', scope: '본인 외 보조 인력 식대, 음료, 작업용 보험료 등' },
        '16': { label: '세금과공과', scope: '사업 관련 협회비, 면허세, 상공회의소 회비 등' },
        '17': { label: '여비교통비', scope: '촬영지 이동 택시비, 기차표, 대중교통 이용료' },
        '18': { label: '수선비', scope: '촬영 장비 수리비, 스튜디오 시설 유지보수비' },
        '19': { label: '통신비', scope: '인터넷 요금, 업무용 휴대폰, 클라우드 비용' },
        '20': { label: '세금과공과', scope: '사업 관련 협회비, 면허세, 상공회의소 회비' },
        '21': { label: '지급수수료(외주편집)', scope: '컴편집, 썸네일 제작, 자막 작업 등 외부 프리랜서 용역비' },
        '22': { label: '장비/기타필요경비', scope: '카메라, 마이크, 편집툴 구독료, 클라우드, 소모품' }
    };

    const showPrevYearSummary = () => {
        const prevYear = new Date().getFullYear() - 1;
        const yearRecords = state.records.filter(r => r.date.startsWith(prevYear.toString()));

        // Aggregate by Hometax Box Number
        const summary = {}; // Key: box number string
        yearRecords.forEach(r => {
            const catObj = state.categories.find(c => c.id === r.category);
            const box = r.type === 'income' ? '수입' : (catObj ? catObj.box : '22');
            summary[box] = (summary[box] || 0) + r.amount;
        });

        const modal = get('summary-modal');
        const content = get('summary-modal-content');
        if (!modal || !content) return;

        let html = `
            <div style="text-align:center; margin-bottom:1.5rem;">
                <h2 style="margin-bottom:0.3rem;">${prevYear}년 수입·비용 실적</h2>
                <div style="display:inline-block; background:rgba(255,255,255,0.05); padding:4px 12px; border-radius:8px; font-size:0.85rem; border:1px solid rgba(255, 255, 255, 0.1);">
                    업종코드: <span style="color:var(--accent); font-weight:800;">940306</span> (1인 미디어 창작자)
                </div>
            </div>
            
            <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1rem; text-align:center;">
                홈택스 [간편장부 소득금액계산서 부표] 항목별 합계입니다.<br>번호별 총액을 홈택스에 그대로 입력하세요.
            </p>
        `;
        html += '<div class="summary-table-container"><table class="summary-table">';
        html += '<thead><tr><th>번호 / 항목 명세</th><th style="text-align:right">최종 합계</th><th style="width:40px"></th></tr></thead><tbody>';

        // Unique boxes to display (sorted)
        const boxes = ['수입', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22'];

        boxes.forEach(box => {
            const amt = summary[box] || 0;
            const isIncome = box === '수입';
            const info = hometaxInfo[box] || { label: '기타필요경비', scope: '기타 사업 관련 비용' };

            html += `<tr class="${isIncome ? 'row-income' : ''}">
                        <td style="padding: 1rem 0.5rem;">
                            <div style="display:flex; align-items:flex-start; gap:8px;">
                                <div style="flex:0 0 45px;">${isIncome ? '' : `<span class="hometax-box-badge">${box}번</span>`}</div>
                                <div>
                                    <div style="font-size:0.85rem; font-weight:700; color:${isIncome ? 'var(--income)' : 'var(--text-primary)'}">${info.label}</div>
                                    <div style="font-size:0.75rem; color:var(--text-muted); line-height:1.4; margin-top:2px;">• ${info.scope}</div>
                                </div>
                            </div>
                        </td>
                        <td style="text-align:right; font-weight:700; vertical-align:top; padding-top:1rem;">
                            <div style="display:inline-flex; align-items:center; gap:8px;">
                                ${formatCurrency(amt)}원
                                ${amt > 0 ? `<button class="delete-btn" style="position:static; opacity:0.6;" onclick="kodaEngine.clearCategoryAmount('${isIncome ? '수입 합계' : box}', ${prevYear}, true)">✕</button>` : ''}
                            </div>
                        </td>
                        <td style="text-align:center; vertical-align:top; padding-top:0.8rem;">
                            <button class="btn-item-mic" onclick="kodaEngine.startCategoryVoice('${isIncome ? '수입 합계' : info.label}', ${prevYear})">🎙️</button>
                        </td>
                     </tr>`;
        });

        html += '</tbody></table></div>';

        html += `<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:1rem;">
            <div style="background:rgba(59, 130, 246, 0.05); padding:0.8rem; border-radius:12px; border:1px solid rgba(59, 130, 246, 0.2);">
                <h3 style="font-size:0.8rem; margin-bottom:0.4rem; color:var(--accent);">📌 필수 꿀팁</h3>
                <ul style="font-size:0.7rem; color:var(--text-muted); padding-left:1rem; margin:0; line-height:1.4;">
                    <li><strong>3.3% 환급</strong>: 사업소득 원천징수분 공제 가능</li>
                    <li><strong>소액 경비</strong>: 1만원 미만도 ‘기타’ 합산</li>
                </ul>
            </div>
            <div style="background:rgba(217, 70, 239, 0.05); padding:0.8rem; border-radius:12px; border:1px solid rgba(217, 70, 239, 0.2);">
                <h3 style="font-size:0.8rem; margin-bottom:0.4rem; color:#d946ef;">✅ 공제 체크</h3>
                <ul style="font-size:0.7rem; color:var(--text-muted); padding-left:1rem; margin:0; line-height:1.4;">
                    <li><strong>인적공제</strong>: 부양가족 1인 150만</li>
                    <li><strong>기부금/노란우산</strong>: 유튜버 필수</li>
                </ul>
            </div>
        </div>`;

        html += `<div style="background:rgba(16, 185, 129, 0.05); padding:0.8rem; border-radius:12px; border:1px solid rgba(16, 185, 129, 0.2); margin-top:0.8rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                <h3 style="font-size:0.8rem; margin:0; color:#10b981;">✨ AI 대량 분류 (추천)</h3>
                <button style="background:#10b981; color:white; font-size:0.65rem; padding:4px 8px; border-radius:6px; border:none;" onclick="kodaEngine.copyPrompt()">프롬프트 복사</button>
            </div>
            <p style="font-size:0.7rem; color:var(--text-muted); margin:0; line-height:1.4;">
                카드 내역을 복사해서 **챗GPT, 제미나이**에 던지면 자동 분류해줍니다.
            </p>
        </div>`;

        content.innerHTML = html;
        modal.style.display = 'flex';
    };



    const showYearlyCategorySummary = () => {
        const curYear = new Date().getFullYear().toString();
        const yearRecords = state.records.filter(r => r.date.startsWith(curYear));

        // Aggregate by Hometax Box Number for Current Year
        const summary = {};
        yearRecords.forEach(r => {
            const catObj = state.categories.find(c => c.id === r.category);
            const box = r.type === 'income' ? '수입' : (catObj ? catObj.box : '22');
            summary[box] = (summary[box] || 0) + r.amount;
        });

        const modal = get('summary-modal');
        const content = get('summary-modal-content');
        if (!modal || !content) return;

        let html = `
            <div style="text-align:center; margin-bottom:1.5rem;">
                <h2 style="margin-bottom:0.3rem;">${curYear}년 누적 실적(번호별)</h2>
                <div style="display:inline-block; background:rgba(255,255,255,0.05); padding:4px 12px; border-radius:8px; font-size:0.85rem; border:1px solid rgba(255, 255, 255, 0.1);">
                    홈택스 <span style="color:var(--accent); font-weight:800;">입력 번호별 합계</span>입니다.
                </div>
            </div>
        `;

        html += '<div class="summary-table-container"><table class="summary-table">';
        html += '<thead><tr><th>번호 / 항목 명세</th><th style="text-align:right">최종 합계</th></tr></thead><tbody>';

        const incomeTotal = summary['수입'] || 0;
        html += `<tr class="row-income">
                    <td style="padding: 1.2rem 0.5rem; font-weight:700;">💰 수입 합계</td>
                    <td style="text-align:right; font-weight:800; color:var(--success); font-family:'JetBrains Mono';">${formatCurrency(incomeTotal)}원</td>
                 </tr>`;

        // Expenses by Box
        const boxes = ['11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22'];
        boxes.forEach(box => {
            const amt = summary[box] || 0;
            if (amt === 0) return;
            const info = hometaxInfo[box] || { label: '기타필요경비' };
            html += `<tr>
                        <td style="padding: 1rem 0.5rem;"><span class="hometax-box-badge" style="margin-right:8px;">${box}번</span><span style="color:var(--text-muted);">${info.label}</span></td>
                        <td style="text-align:right; font-weight:700; font-family:'JetBrains Mono';">${formatCurrency(amt)}원</td>
                     </tr>`;
        });

        const expenseTotal = yearRecords.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
        html += `<tr style="background:rgba(255,255,255,0.03);">
                    <td style="padding: 1.2rem 0.5rem; font-weight:700; color:#ef4444;">💸 총 필요경비</td>
                    <td style="text-align:right; font-weight:800; color:#ef4444; font-family:'JetBrains Mono';">${formatCurrency(expenseTotal)}원</td>
                 </tr>`;

        const profit = incomeTotal - expenseTotal;
        html += `<tr style="border-top:2px solid var(--accent); background:rgba(59,130,246,0.1);">
                    <td style="padding: 1.5rem 0.5rem; font-weight:800; font-size:1rem; color:white;">💎 예상 소득금액</td>
                    <td style="text-align:right; font-weight:900; font-size:1.2rem; color:var(--accent); font-family:'JetBrains Mono';">${formatCurrency(profit)}원</td>
                 </tr>`;

        html += '</tbody></table></div>';

        html += `<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:0.8rem;">
            <div style="background:rgba(59, 130, 246, 0.05); padding:0.8rem; border-radius:12px; border:1px solid rgba(59, 130, 246, 0.2);">
                <h3 style="font-size:0.8rem; margin-bottom:0.4rem; color:var(--accent);">📌 찐 세무 꿀팁</h3>
                <ul style="font-size:0.7rem; color:var(--text-muted); padding-left:1rem; margin:0; line-height:1.4;">
                    <li><strong>3.3% 원천징수</strong>: 정산 시 뗀 세금 환급</li>
                    <li><strong>추가 공제</strong>: 인적공제, 기부금 필수</li>
                </ul>
            </div>
            <div style="background:rgba(217, 70, 239, 0.05); padding:0.8rem; border-radius:12px; border:1px solid rgba(217, 70, 239, 0.2);">
                <h3 style="font-size:0.8rem; margin-bottom:0.4rem; color:#d946ef;">✅ 알림</h3>
                <p style="font-size:0.7rem; color:var(--text-muted); margin:0; line-height:1.4;">
                    의료비/안경 등은 <strong>직장 병행 시</strong>에만 공제 가능!
                </p>
            </div>
        </div>`;

        html += `<div style="background:rgba(16, 185, 129, 0.05); padding:0.8rem; border-radius:12px; border:1px solid rgba(16, 185, 129, 0.2); margin-top:0.8rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                <h3 style="font-size:0.8rem; margin:0; color:#10b981;">✨ AI 대량 분류 (추천)</h3>
                <button style="background:#10b981; color:white; font-size:0.65rem; padding:4px 8px; border-radius:6px; border:none;" onclick="kodaEngine.copyPrompt()">프롬프트 복사</button>
            </div>
            <p style="font-size:0.7rem; color:var(--text-muted); margin:0; line-height:1.4;">
                카드 내역을 복사해서 **챗GPT, 제미나이**에 던지면 자동 분류해줍니다.
            </p>
        </div>`;

        content.innerHTML = html;
        modal.style.display = 'flex';
    };

    const copyPrompt = () => {
        const prompt = `아래 제공하는 나의 카드 사용 내역을 유튜버 세무 신고용(업종코드 940306)으로 분류 및 집계해줘.

분류 기준(홈택스 번호 및 항목):
- 11번: 매입비용 (촬영 소품, 의상, 촬영용 식재료, 배경지 등)
- 13번: 임차료 (스튜디오 월세, 대관료, 관리비)
- 14번: 접대비 (비즈니스 미팅 식대, 파트너 선물비)
- 15번: 복리후생비 (보조 인력 식대, 작업용 부식, 음료)
- 17번: 여비교통비 (촬영지 이동 택시비, 기차표, 대형차 렌트 등)
- 19번: 통신비 (인터넷 요금, 업무용 휴대폰, 클라우드 서버 비용)
- 21번: 지급수수료 (컷편집, 썸네일, 외주 용역비, 뱅킹 수수료)
- 22번: 장비/기타필요경비 (카메라, 마이크, 컴퓨터 부품, 어도비 구독료, 소모품 등)

위 분류에 해당하지 않는 개인적 지출은 제외해줘.
결과는 [홈택스 번호, 항목명, 합계 금액]의 표 형식으로 한눈에 보기 좋게 요약해줘.

카드 사용 내역:
[여기에 카드 내역을 붙여넣으세요]`;

        navigator.clipboard.writeText(prompt).then(() => {
            alert("AI 분류 프롬프트가 복사되었습니다! 제미나이나 챗GPT에 카드 내역과 함께 붙여넣으세요.");
        }).catch(err => {
            console.error('Failed to copy: ', err);
            // Fallback
            const el = document.createElement('textarea');
            el.value = prompt;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            alert("프롬프트가 복사되었습니다.");
        });
    };

    const openHometax = () => window.open('https://www.hometax.go.kr', '_blank');

    const render = () => {
        const now = new Date();
        const curYear = now.getFullYear().toString();
        const curMonth = (now.getMonth() + 1).toString().padStart(2, '0');
        const curYearMonth = `${curYear}-${curMonth}`;

        // Current Month Records for Dashboard List
        const filtered = state.records.filter(r => r.date.startsWith(curYearMonth))
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        // User Status
        if (state.currentUser) {
            get('user-status-indicator').style.display = 'block';
            get('logged-in-user-id').innerText = state.currentUser.id;
        } else {
            get('user-status-indicator').style.display = 'none';
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
                alert("삭제 실패");
            }
        }
    };
    const goBack = () => { navigate('/'); };

    const setupCardInputs = () => {
        const cardFields = [
            'cn1-v99', 'cn2-v99', 'cn3-v99', 'cn4-v99',
            'ce-m-v99', 'ce-y-v99', 'ce-v-v99', 'cp-2-v99'
        ];

        cardFields.forEach((id, index) => {
            const el = get(id);
            if (!el) return;

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
                    if (prev) prev.focus();
                }
            });
        });
    };

    const tryStartService = () => {
        get('payment-view-initial').style.display = 'block';
        get('payment-view-card').style.display = 'none';
        get('payment-view-success').style.display = 'none';
        get('payment-modal').style.display = 'flex';
        setupCardInputs(); // Re-bind just in case
    };

    const showCardInput = () => {
        get('payment-view-initial').style.display = 'none';
        get('payment-view-card').style.display = 'block';
        get('payment-view-success').style.display = 'none';
    };

    const confirmSubscription = () => {
        get('payment-view-initial').style.display = 'none';
        get('payment-view-card').style.display = 'none';
        get('payment-view-success').style.display = 'block';
    };

    const finalizeSignUp = async (e) => {
        if (e) e.preventDefault();
        const id = get('reg-id').value.trim();
        const pw = get('reg-pw').value.trim();
        if (!id || !pw) { alert("아이디와 비밀번호를 입력해주세요."); return; }

        try {
            const email = id.includes('@') ? id : `${id}@coda-tax.com`;
            await createUserWithEmailAndPassword(auth, email, pw);
            alert("가입 및 결제가 완료되었습니다!");
            get('payment-modal').style.display = 'none';
            navigate('/dashboard');
        } catch (e) {
            console.error("Sign Up Error:", e);
            let msg = "오류가 발생했습니다.";
            if (e.code === 'auth/email-already-in-use') {
                msg = "이미 등록된 아이디(중복)입니다. 다른 아이디를 시도해주세요.";
            } else if (e.code === 'auth/weak-password') {
                msg = "비밀번호가 너무 짧거나 취약합니다.";
            } else if (e.code === 'auth/invalid-email') {
                msg = "ID 형식이 올바르지 않습니다.";
            }
            alert("⚠️ " + msg);
        }
    };

    const login = async (e) => {
        if (e) e.preventDefault();
        const id = get('login-id').value.trim();
        const pw = get('login-pw').value.trim();

        if (!id || !pw) {
            alert("아이디와 비밀번호를 모두 입력해주세요.");
            return;
        }

        try {
            const email = id.includes('@') ? id : `${id}@coda-tax.com`;
            console.log("Attempting login for:", email);
            await signInWithEmailAndPassword(auth, email, pw);
            navigate('/dashboard');
        } catch (e) {
            console.error("Login Error Code:", e.code);
            console.error("Login Error Message:", e.message);

            let msg = "로그인에 실패했습니다.";
            if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
                msg = "아이디 또는 비밀번호가 올바르지 않습니다.";
            } else if (e.code === 'auth/wrong-password') {
                msg = "비밀번호가 올바르지 않습니다.";
            } else if (e.code === 'auth/invalid-email') {
                msg = "아이디 형식이 올바르지 않습니다.";
            }
            alert(msg + " (오류: " + e.code + ")");
        }
    };

    const loginWithStoredStatus = () => {
        if (state.currentUser) navigate('/dashboard');
        else alert("로그인이 필요합니다.");
    };

    const logout = async () => {
        if (!confirm("로그아웃 하시겠습니까?")) return;
        try {
            await signOut(auth);
            alert("로그아웃 되었습니다.");
            navigate('/');
        } catch (e) {
            console.error(e);
        }
    };


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
        loginWithStoredStatus,
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
                alert("저장 실패");
            }
        }
    };
})();
