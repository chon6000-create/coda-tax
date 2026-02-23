(function(){const r=document.createElement("link").relList;if(r&&r.supports&&r.supports("modulepreload"))return;for(const d of document.querySelectorAll('link[rel="modulepreload"]'))g(d);new MutationObserver(d=>{for(const m of d)if(m.type==="childList")for(const h of m.addedNodes)h.tagName==="LINK"&&h.rel==="modulepreload"&&g(h)}).observe(document,{childList:!0,subtree:!0});function f(d){const m={};return d.integrity&&(m.integrity=d.integrity),d.referrerPolicy&&(m.referrerPolicy=d.referrerPolicy),d.crossOrigin==="use-credentials"?m.credentials="include":d.crossOrigin==="anonymous"?m.credentials="omit":m.credentials="same-origin",m}function g(d){if(d.ep)return;d.ep=!0;const m=f(d);fetch(d.href,m)}})();window.kodaEngine=(()=>{let o={isSubscribed:localStorage.getItem("yt_user_status")==="paid",currentUser:JSON.parse(localStorage.getItem("yt_current_user"))||null,accounts:JSON.parse(localStorage.getItem("yt_accounts"))||[],records:JSON.parse(localStorage.getItem("yt_tax_records"))||[],categories:[{id:"수입 합계",keywords:["애드센스","협찬","수입","입금","광고수익","도네","후원"],type:"income",box:"수입"},{id:"식대",keywords:["식대","밥","회식","미팅","커피"],type:"expense",box:"15"},{id:"여비교통비",keywords:["교통","차비","택시","버스","지하철","주유","기름"],type:"expense",box:"15"},{id:"촬영소품",keywords:["소품","배경","의상","분장"],type:"expense",box:"11"},{id:"장비비",keywords:["장비","카메라","마이크","조명","렌즈","컴퓨터","PC"],type:"expense",box:"22"},{id:"소프트웨어/구독",keywords:["구독","툴","프로그램","편집툴","클라우드","어도비","프리미어","라이선스"],type:"expense",box:"22"},{id:"외주/편집",keywords:["외주","편집","디자인","썸네일","컷편집"],type:"expense",box:"21"},{id:"통신비",keywords:["통신","인터넷","휴대폰"],type:"expense",box:"19"},{id:"소모품비",keywords:["소모품","사무용품","펜","종이","문구"],type:"expense",box:"22"},{id:"수선유지비",keywords:["수선","유지","수리","보수"],type:"expense",box:"22"},{id:"월세/임차료",keywords:["월세","임대료","임차료","관리비"],type:"expense",box:"13"},{id:"수도광열비",keywords:["수도","전기","가스","난방"],type:"expense",box:"18"},{id:"보험료",keywords:["보험","국민연금","건강보험","자동차보험"],type:"expense",box:"15"},{id:"세금과공과",keywords:["세금","면허세","재산세","공과금"],type:"expense",box:"20"},{id:"지급수수료",keywords:["수수료","뱅킹수수료","결제수수료"],type:"expense",box:"21"},{id:"기타필요경비",keywords:[],type:"expense",box:"22"}],lastDetected:null,recognition:null,pendingCategory:null,pendingYear:null};const r=e=>document.getElementById(e),f=e=>new Intl.NumberFormat("ko-KR").format(Math.floor(e)),g=e=>{window.location.hash=e==="/"?"#/":`#${e}`,d()},d=(e=!1)=>{const t=window.location.hash||"#/",n=localStorage.getItem("yt_user_status")==="paid",s=r("user-type-overlay"),i=r("app-container");if(!(!s||!i))if(t==="#/dashboard"||t.startsWith("#/dashboard")){if(!n){g("/");return}s.style.display="none",i.style.display="flex",x()}else{if(e&&n&&localStorage.getItem("yt_current_user")){g("/dashboard");return}s.style.display="flex",i.style.display="none"}},m=()=>{d(!0),window.addEventListener("hashchange",()=>d(!1));const e=window.SpeechRecognition||window.webkitSpeechRecognition;e&&(o.recognition=new e,o.recognition.continuous=!1,o.recognition.interimResults=!0,o.recognition.lang="ko-KR",o.recognition.onresult=t=>{const n=r("voice-transcribed-text"),s=r("voice-result-box"),i=r("voice-status-text");let a="",c="";for(let l=t.resultIndex;l<t.results.length;++l)t.results[l].isFinal?c+=t.results[l][0].transcript:a+=t.results[l][0].transcript;if(n){const l=c||a;l&&(n.innerText=l,n.style.display="flex")}c&&(r("voice-retry-btn")&&(r("voice-retry-btn").style.display="flex"),o.pendingCategory?I(c):(o.lastDetected=C(c),i&&(i.innerText="음성을 인식했습니다! ✅",i.style.color="var(--success)"),s&&(s.style.display="block")))})},h=(e,t)=>{o.pendingCategory=e,o.pendingYear=t;const n=r("voice-modal"),s=r("voice-status-text"),i=r("voice-transcribed-text"),a=r("voice-result-box");if(i&&(i.innerText="",i.style.display="none"),a&&(a.style.display="none"),r("voice-retry-btn")&&(r("voice-retry-btn").style.display="none"),s&&(s.innerText=`[${e}] 합계 금액을 말씀해 주세요...`,s.style.color="#fbbf24"),n&&(n.style.display="flex"),o.recognition)try{o.recognition.start()}catch{}},I=e=>{const t=k(e);if(t>0){const n=`${o.pendingYear}-12-31`,s=o.pendingCategory;o.records=o.records.filter(a=>!(a.status==="전년실적"&&a.category===s&&a.date.startsWith(o.pendingYear)));const i={date:n,type:s==="수입 합계"?"income":"expense",category:s,label:`[실적] ${s}`,amount:t,status:"전년실적",memo:`보이스 입력: ${e}`};o.records.push(i),v(),x(),r("voice-modal").style.display="none",S(),o.pendingCategory=null,o.pendingYear=null}else alert("금액을 정확히 인식하지 못했습니다. 다시 시도해 주세요.")},_=(e,t,n=!1)=>{if(confirm(`[${e}] 데이터를 삭제하고 초기화하시겠습니까?
(언제든지 다시 입력할 수 있습니다.)`)){const s=t.toString();o.records=o.records.filter(i=>{if(!i.date.startsWith(s))return!0;if(n){if(e==="수입 합계")return i.type!=="income";const c=o.categories.find(l=>l.id===i.category);return!c||c.box!==e}else return e==="수입 합계"?i.type!=="income":i.category!==e}),v(),x(),S()}},k=e=>{let t=0,n=e.replace(/[\s,]/g,"").replace(/원$/g,"");const s=n.match(/([\d\.]+)\s*억/);s&&(t+=parseFloat(s[1])*1e8);const i=n.match(/([\d\.]+)\s*천만/);i&&(t+=parseFloat(i[1])*1e7);const a=n.match(/([\d\.]+)\s*백만/);a&&(t+=parseFloat(a[1])*1e6);const c=n.match(/([\d\.]+)\s*(?!천만|백만)만/);if(c)t+=parseFloat(c[1])*1e4;else if(!s&&!i&&!a){const y=n.match(/([\d\.]+)\s*만/);y&&(t+=parseFloat(y[1])*1e4)}const l=n.match(/([\d\.]+)\s*천/);if(l&&(t+=parseFloat(l[1])*1e3),t===0){const y=n.replace(/[^0-9]/g,"");y&&(t=parseInt(y))}return t===0&&(e.includes("백만")?t=1e6:e.includes("오십만")?t=5e5:e.includes("십만")?t=1e5:e.includes("일억")&&(t=1e8)),t},$=()=>{o.pendingCategory=null;const e=r("voice-modal"),t=r("voice-status-text"),n=r("voice-transcribed-text"),s=r("voice-result-box");if(n&&(n.innerText="",n.style.display="none"),s&&(s.style.display="none"),r("voice-retry-btn")&&(r("voice-retry-btn").style.display="none"),t&&(t.innerHTML='<span class="rec-dot"></span>듣고 있습니다...',t.style.color="var(--accent)"),e&&(e.style.display="flex"),o.recognition)try{o.recognition.start()}catch{}},M=()=>{o.pendingCategory?h(o.pendingCategory,o.pendingYear):$()},z=()=>{o.lastDetected&&(o.records.unshift(o.lastDetected),v(),x(),r("voice-modal").style.display="none",o.lastDetected=null)},C=e=>{const t=k(e);let n="기타필요경비";const s=e.toLowerCase();for(const c of o.categories)if(c.keywords.some(l=>s.includes(l))){n=c.id;break}const i=new Date;return{date:`${i.getFullYear()}-${(i.getMonth()+1).toString().padStart(2,"0")}-${i.getDate().toString().padStart(2,"0")}`,type:n==="수입 합계"?"income":"expense",category:n,label:e.split(/[0-9]|만|원/)[0].trim()||n,amount:t,status:"준비",memo:e}},T={11:{label:"매입비용(촬영소품)",scope:"콘텐츠 촬영용 소품, 의상, 배경지, 촬영용 식재료 등 구매비"},12:{label:"상품/재료비",scope:"콘텐츠 제작에 소요되는 소모성 재료비 및 상품 구매비"},13:{label:"임차료(스튜디오)",scope:"사업장/작업실/스튜디오 월세 및 관리비"},14:{label:"접대비(미팅식대)",scope:"파트너사/브랜드 미팅 식대, 외부 협력자 선물 및 접찰비"},15:{label:"복리후생비(식대/음료)",scope:"본인 외 보조 인력 식대, 음료, 작업용 보험료 등"},16:{label:"세금과공과",scope:"사업 관련 협회비, 면허세, 상공회의소 회비 등"},17:{label:"여비교통비",scope:"촬영지 이동 택시비, 기차표, 대중교통 이용료"},18:{label:"수선비",scope:"촬영 장비 수리비, 스튜디오 시설 유지보수비"},19:{label:"통신비",scope:"인터넷 요금, 업무용 휴대폰, 클라우드 비용"},20:{label:"세금과공과",scope:"사업 관련 협회비, 면허세, 상공회의소 회비"},21:{label:"지급수수료(외주편집)",scope:"컴편집, 썸네일 제작, 자막 작업 등 외부 프리랜서 용역비"},22:{label:"장비/기타필요경비",scope:"카메라, 마이크, 편집툴 구독료, 클라우드, 소모품"}},S=()=>{const e=new Date().getFullYear()-1,t=o.records.filter(l=>l.date.startsWith(e.toString())),n={};t.forEach(l=>{const y=o.categories.find(p=>p.id===l.category),u=l.type==="income"?"수입":y?y.box:"22";n[u]=(n[u]||0)+l.amount});const s=r("summary-modal"),i=r("summary-modal-content");if(!s||!i)return;let a=`
            <div style="text-align:center; margin-bottom:1.5rem;">
                <h2 style="margin-bottom:0.3rem;">${e}년 수입·비용 실적</h2>
                <div style="display:inline-block; background:rgba(255,255,255,0.05); padding:4px 12px; border-radius:8px; font-size:0.85rem; border:1px solid rgba(255, 255, 255, 0.1);">
                    업종코드: <span style="color:var(--accent); font-weight:800;">940306</span> (1인 미디어 창작자)
                </div>
            </div>
            
            <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1rem; text-align:center;">
                홈택스 [간편장부 소득금액계산서 부표] 항목별 합계입니다.<br>번호별 총액을 홈택스에 그대로 입력하세요.
            </p>
        `;a+='<div class="summary-table-container"><table class="summary-table">',a+='<thead><tr><th>번호 / 항목 명세</th><th style="text-align:right">최종 합계</th><th style="width:40px"></th></tr></thead><tbody>',["수입","11","12","13","14","15","16","17","18","19","20","21","22"].forEach(l=>{const y=n[l]||0,u=l==="수입",p=T[l]||{label:"기타필요경비",scope:"기타 사업 관련 비용"};a+=`<tr class="${u?"row-income":""}">
                        <td style="padding: 1rem 0.5rem;">
                            <div style="display:flex; align-items:flex-start; gap:8px;">
                                <div style="flex:0 0 45px;">${u?"":`<span class="hometax-box-badge">${l}번</span>`}</div>
                                <div>
                                    <div style="font-size:0.85rem; font-weight:700; color:${u?"var(--income)":"var(--text-primary)"}">${p.label}</div>
                                    <div style="font-size:0.75rem; color:var(--text-muted); line-height:1.4; margin-top:2px;">• ${p.scope}</div>
                                </div>
                            </div>
                        </td>
                        <td style="text-align:right; font-weight:700; vertical-align:top; padding-top:1rem;">
                            <div style="display:inline-flex; align-items:center; gap:8px;">
                                ${f(y)}원
                                ${y>0?`<button class="delete-btn" style="position:static; opacity:0.6;" onclick="kodaEngine.clearCategoryAmount('${u?"수입 합계":l}', ${e}, true)">✕</button>`:""}
                            </div>
                        </td>
                        <td style="text-align:center; vertical-align:top; padding-top:0.8rem;">
                            <button class="btn-item-mic" onclick="kodaEngine.startCategoryVoice('${u?"수입 합계":p.label}', ${e})">🎙️</button>
                        </td>
                     </tr>`}),a+="</tbody></table></div>",a+=`<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:1rem;">
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
        </div>`,a+=`<div style="background:rgba(16, 185, 129, 0.05); padding:0.8rem; border-radius:12px; border:1px solid rgba(16, 185, 129, 0.2); margin-top:0.8rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                <h3 style="font-size:0.8rem; margin:0; color:#10b981;">✨ AI 대량 분류 (추천)</h3>
                <button style="background:#10b981; color:white; font-size:0.65rem; padding:4px 8px; border-radius:6px; border:none;" onclick="kodaEngine.copyPrompt()">프롬프트 복사</button>
            </div>
            <p style="font-size:0.7rem; color:var(--text-muted); margin:0; line-height:1.4;">
                카드 내역을 복사해서 **챗GPT, 제미나이**에 던지면 자동 분류해줍니다.
            </p>
        </div>`,i.innerHTML=a,s.style.display="flex"},O=()=>{const e=new Date().getFullYear().toString(),t=o.records.filter(p=>p.date.startsWith(e)),n={};t.forEach(p=>{const b=o.categories.find(D=>D.id===p.category),w=p.type==="income"?"수입":b?b.box:"22";n[w]=(n[w]||0)+p.amount});const s=r("summary-modal"),i=r("summary-modal-content");if(!s||!i)return;let a=`
            <div style="text-align:center; margin-bottom:1.5rem;">
                <h2 style="margin-bottom:0.3rem;">${e}년 누적 실적(번호별)</h2>
                <div style="display:inline-block; background:rgba(255,255,255,0.05); padding:4px 12px; border-radius:8px; font-size:0.85rem; border:1px solid rgba(255, 255, 255, 0.1);">
                    홈택스 <span style="color:var(--accent); font-weight:800;">입력 번호별 합계</span>입니다.
                </div>
            </div>
        `;a+='<div class="summary-table-container"><table class="summary-table">',a+='<thead><tr><th>번호 / 항목 명세</th><th style="text-align:right">최종 합계</th></tr></thead><tbody>';const c=n.수입||0;a+=`<tr class="row-income">
                    <td style="padding: 1.2rem 0.5rem; font-weight:700;">💰 수입 합계</td>
                    <td style="text-align:right; font-weight:800; color:var(--success); font-family:'JetBrains Mono';">${f(c)}원</td>
                 </tr>`,["11","12","13","14","15","16","17","18","19","20","21","22"].forEach(p=>{const b=n[p]||0;if(b===0)return;const w=T[p]||{label:"기타필요경비"};a+=`<tr>
                        <td style="padding: 1rem 0.5rem;"><span class="hometax-box-badge" style="margin-right:8px;">${p}번</span><span style="color:var(--text-muted);">${w.label}</span></td>
                        <td style="text-align:right; font-weight:700; font-family:'JetBrains Mono';">${f(b)}원</td>
                     </tr>`});const y=t.filter(p=>p.type==="expense").reduce((p,b)=>p+b.amount,0);a+=`<tr style="background:rgba(255,255,255,0.03);">
                    <td style="padding: 1.2rem 0.5rem; font-weight:700; color:#ef4444;">💸 총 필요경비</td>
                    <td style="text-align:right; font-weight:800; color:#ef4444; font-family:'JetBrains Mono';">${f(y)}원</td>
                 </tr>`;const u=c-y;a+=`<tr style="border-top:2px solid var(--accent); background:rgba(59,130,246,0.1);">
                    <td style="padding: 1.5rem 0.5rem; font-weight:800; font-size:1rem; color:white;">💎 예상 소득금액</td>
                    <td style="text-align:right; font-weight:900; font-size:1.2rem; color:var(--accent); font-family:'JetBrains Mono';">${f(u)}원</td>
                 </tr>`,a+="</tbody></table></div>",a+=`<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:0.8rem;">
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
        </div>`,a+=`<div style="background:rgba(16, 185, 129, 0.05); padding:0.8rem; border-radius:12px; border:1px solid rgba(16, 185, 129, 0.2); margin-top:0.8rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                <h3 style="font-size:0.8rem; margin:0; color:#10b981;">✨ AI 대량 분류 (추천)</h3>
                <button style="background:#10b981; color:white; font-size:0.65rem; padding:4px 8px; border-radius:6px; border:none;" onclick="kodaEngine.copyPrompt()">프롬프트 복사</button>
            </div>
            <p style="font-size:0.7rem; color:var(--text-muted); margin:0; line-height:1.4;">
                카드 내역을 복사해서 **챗GPT, 제미나이**에 던지면 자동 분류해줍니다.
            </p>
        </div>`,i.innerHTML=a,s.style.display="flex"},Y=()=>{const e=`아래 제공하는 나의 카드 사용 내역을 유튜버 세무 신고용(업종코드 940306)으로 분류 및 집계해줘.

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
[여기에 카드 내역을 붙여넣으세요]`;navigator.clipboard.writeText(e).then(()=>{alert("AI 분류 프롬프트가 복사되었습니다! 제미나이나 챗GPT에 카드 내역과 함께 붙여넣으세요.")}).catch(t=>{console.error("Failed to copy: ",t);const n=document.createElement("textarea");n.value=e,document.body.appendChild(n),n.select(),document.execCommand("copy"),document.body.removeChild(n),alert("프롬프트가 복사되었습니다.")})},E=()=>window.open("https://www.hometax.go.kr","_blank"),x=()=>{const e=new Date,t=e.getFullYear().toString(),n=(e.getMonth()+1).toString().padStart(2,"0"),s=`${t}-${n}`,i=o.records.filter(c=>c.date.startsWith(s)).sort((c,l)=>new Date(l.date)-new Date(c.date));o.currentUser?(r("user-status-indicator").style.display="block",r("logged-in-user-id").innerText=o.currentUser.id):r("user-status-indicator").style.display="none";const a=r("history-list-mvp");if(a){const c=i.slice(0,5);c.length===0?a.innerHTML='<tr><td colspan="5" class="empty-row">기록이 없습니다.</td></tr>':a.innerHTML=c.map((l,y)=>`
                    <tr>
                        <td class="cell-date">${l.date.slice(5).replace("-","/")}</td>
                        <td class="cell-type ${l.type}">${l.type==="income"?"수입":"경비"}</td>
                        <td class="cell-cat">${l.label||l.category}</td>
                        <td class="cell-amt">${f(l.amount)}</td>
                        <td style="text-align:right;"><button class="delete-btn" onclick="kodaEngine.deleteRecord(${y})">✕</button></td>
                    </tr>
                `).join("")}},v=()=>localStorage.setItem("yt_tax_records",JSON.stringify(o.records));return{init:m,startVoiceRecord:$,clearVoiceTranscript:M,confirmVoiceEntry:z,showPrevYearSummary:S,showYearlyCategorySummary:O,copyPrompt:Y,startCategoryVoice:h,clearCategoryAmount:_,openHometax:E,deleteRecord:e=>{confirm("삭제할까요?")&&(o.records.splice(e,1),v(),x())},goBack:()=>{g("/")},tryStartService:()=>{r("payment-view-initial").style.display="block",r("payment-view-card").style.display="none",r("payment-view-success").style.display="none",r("payment-modal").style.display="flex"},showCardInput:()=>{r("payment-view-initial").style.display="none",r("payment-view-card").style.display="block"},confirmSubscription:()=>{r("payment-view-card").style.display="none",r("payment-view-success").style.display="block"},finalizeSignUp:e=>{e&&e.preventDefault();const t=r("reg-id").value.trim(),n=r("reg-pw").value.trim();if(!t||!n){alert("아이디와 비밀번호를 입력해주세요.");return}if(o.accounts.some(i=>i.id===t)){alert("이미 존재하는 아이디입니다. 다른 아이디를 사용해주세요.");return}const s={id:t,pw:n,status:"paid"};o.accounts.push(s),o.currentUser=s,localStorage.setItem("yt_accounts",JSON.stringify(o.accounts)),localStorage.setItem("yt_current_user",JSON.stringify(s)),localStorage.setItem("yt_user_status","paid"),alert("가입 및 결제가 완료되었습니다! 환영합니다."),r("payment-modal").style.display="none",g("/dashboard")},login:e=>{e&&e.preventDefault();const t=r("login-id").value.trim(),n=r("login-pw").value.trim();if(!t||!n){alert("아이디와 비밀번호를 모두 입력해주세요.");return}const s=o.accounts.find(i=>i.id===t&&i.pw===n);if(s)o.currentUser=s,localStorage.setItem("yt_current_user",JSON.stringify(s)),localStorage.setItem("yt_user_status",s.status),g("/dashboard");else{const i=o.accounts.some(a=>a.id===t);alert(i?"비밀번호가 올바르지 않습니다.":"존재하지 않는 아이디거나 구독 정보가 없습니다.")}},logout:()=>{confirm("로그아웃 하시겠습니까?")&&(o.currentUser=null,o.isSubscribed=!1,localStorage.removeItem("yt_current_user"),localStorage.removeItem("yt_user_status"),alert("로그아웃 되었습니다."),g("/"))},loginWithStoredStatus:()=>{o.currentUser?g("/dashboard"):alert("로그인이 필요합니다.")},openAddModal:()=>r("edit-modal").style.display="flex",saveManualEntry:e=>{e.preventDefault();const t={date:r("edit-date").value||new Date().toISOString().split("T")[0],type:r("edit-type").value,category:r("edit-category").value,amount:parseInt(r("edit-amount").value)||0,status:"준비"};o.records.unshift(t),v(),x(),r("edit-modal").style.display="none"}}})();
