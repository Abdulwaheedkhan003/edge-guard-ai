/**
 * EdgeGuard AI — Frontend Controller & Vision HUD Engine v2.1
 * Industrial SaaS Construction Safety Dashboard
 * Full rewrite — matched exactly to dashboard.html structure
 */
(function () {
    'use strict';

    // 1. STATE
    const state = {
        activeTab: 'dashboard',
        backendUrl: window.location.origin,
        pollingInterval: 1000,
        pollingTimer: null,
        enableAudio: true, enableGrid: true, enableVectors: true, enableAuroras: true,
        isFallbackMode: false,
        emuWorkers: 3, emuMachines: 2,
        telemetry: { workers: 0, machines: 0, risk: 0, status: 'SAFE', fps: 0, time: '' },
        history: { page: 1, limit: 8, search: '', total: 0, data: [] },
        selectedIncidentId: null,
        lastBeepTime: 0,
        displayedWorkers: 0, displayedMachines: 0, displayedRisk: 0,
        isCameraActive: false,
        cameraStream: null,
        videoEl: null,
        canvasEl: null,
        activeRequest: false
    };

    // 2. DOM CACHE
    const $ = id => document.getElementById(id);
    const $$ = sel => document.querySelectorAll(sel);
    const el = {
        navItems: $$('.nav-item'), tabPanels: $$('.tab-panel'),
        sidebarToggle: $('sidebar-toggle'), sidebar: $('app-sidebar'),
        liveClock: $('live-clock'), liveDate: $('live-date'),
        systemBeacon: $('system-beacon'), systemStatusText: $('system-status-text'),
        backendBadge: $('backend-status-badge'), backendBeacon: $('conn-beacon'), backendText: $('backend-status-text'),
        kpiWorkersVal: $('kpi-workers-val'), kpiWorkersTrend: $('kpi-workers-trend'),
        kpiMachinesVal: $('kpi-machines-val'), kpiMachinesTrend: $('kpi-machines-trend'),
        kpiRiskVal: $('kpi-risk-val'), kpiRiskIcon: $('kpi-risk-icon'), kpiFpsBadge: $('kpi-fps-badge'),
        kpiStatusVal: $('kpi-status-val'), kpiStatusIcon: $('kpi-status-icon'),
        kpiStatusSub: $('kpi-status-sub'), kpiStatusRing: $('kpi-status-ring'), kpiStatusCard: $('kpi-status'),
        lastUpdatedTs: $('last-updated-ts'),
        feedImg: $('edge-camera-feed'), feedFps: $('feed-fps'),
        hudWorker: $('hud-worker-count'), hudMachine: $('hud-machine-count'), hudFps: $('hud-fps'),
        hudLatency: $('hud-latency'), hudAlert: $('hud-alert-indicator'), hudAlertText: $('hud-alert-text'),
        riskPercentage: $('risk-value-percentage'), riskBar: $('risk-meter-bar'),
        safetyScoreVal: $('safety-score-val'), safetyScoreLabel: $('safety-score-label'), safetyScoreArc: $('safety-score-arc'),
        latestAlertCard: $('latest-alert-card'), alertIconWrap: $('alert-box-icon'),
        alertTitle: $('alert-summary-title'), alertDesc: $('alert-summary-desc'),
        monitorImg: $('monitoring-primary-feed'), monitorLatency: $('monitor-latency'), consoleLogs: $('realtime-console-logs'),
        historySearch: $('history-search-input'), historyTableBody: $('history-table-body'),
        btnRefreshHistory: $('btn-refresh-history'), btnExportCsv: $('btn-export-csv'),
        pageStart: $('pagination-start-index'), pageEnd: $('pagination-end-index'), pageTotal: $('pagination-total-records'),
        pageNumbers: $('pagination-page-numbers'), btnPageFirst: $('page-btn-first'),
        btnPagePrev: $('page-btn-prev'), btnPageNext: $('page-btn-next'), btnPageLast: $('page-btn-last'),
        metricAvgRisk: $('metric-avg-risk'), metricMaxRisk: $('metric-max-risk'),
        metricCriticalCount: $('metric-critical-count'), metricWarningCount: $('metric-warning-count'),
        metricSafeCount: $('metric-safe-count'), metricTotalIncidents: $('metric-total-incidents'),
        reportSourceList: $('report-source-list'), btnDownload: $('btn-download-report'),
        btnPrint: $('btn-print-report'), btnExportPdf: $('btn-export-pdf'),
        repId: $('rep-id'), repTime: $('rep-time'), repRisk: $('rep-risk'),
        repWorkers: $('rep-workers'), repMachines: $('rep-machines'),
        repSummary: $('rep-ai-summary'), repActionsList: $('rep-actions-list'), repRecsList: $('rep-recommendations-list'),
        setBackendUrl: $('setting-backend-url'), setPollingRate: $('setting-polling-rate'), setPollingVal: $('setting-polling-val'),
        setToggleGrid: $('setting-toggle-grid'), setToggleVectors: $('setting-toggle-vectors'),
        setToggleAuroras: $('setting-toggle-auroras'), setToggleAudio: $('setting-toggle-audio'),
        setEmuWorkers: $('setting-emu-workers'), setEmuMachines: $('setting-emu-machines'),
        btnClearDb: $('btn-clear-db'), btnRestoreDefaults: $('btn-restore-defaults'),
        btnToggleWebcam: $('btn-toggle-webcam'), webcamBtnText: $('webcam-btn-text'),
        btnToggleWebcamMon: $('btn-toggle-webcam-mon'), webcamBtnTextMon: $('webcam-btn-text-mon')
    };

    const charts = { riskTrend: null, objectsTrend: null, statusDist: null, freqDist: null };
    let audioCtx = null;
    let reportsCached = [];

    // 3. INIT
    function init() {
        updateClock();
        setInterval(updateClock, 1000);

        el.navItems.forEach(item => {
            item.addEventListener('click', function(e) { e.preventDefault(); switchTab(this.dataset.tab); });
        });

        if (el.sidebarToggle) el.sidebarToggle.addEventListener('click', () => el.sidebar.classList.toggle('open'));
        if (el.btnRefreshHistory) el.btnRefreshHistory.addEventListener('click', () => { if(el.historySearch) el.historySearch.value=''; state.history.search=''; loadHistory(1); });
        if (el.btnExportCsv) el.btnExportCsv.addEventListener('click', exportToCsv);
        if (el.btnPageFirst) el.btnPageFirst.addEventListener('click', () => loadHistory(1));
        if (el.btnPagePrev)  el.btnPagePrev.addEventListener('click',  () => loadHistory(state.history.page - 1));
        if (el.btnPageNext)  el.btnPageNext.addEventListener('click',  () => loadHistory(state.history.page + 1));
        if (el.btnPageLast)  el.btnPageLast.addEventListener('click',  () => loadHistory(Math.ceil(state.history.total / state.history.limit) || 1));

        if (el.historySearch) {
            let t; el.historySearch.addEventListener('input', function() { clearTimeout(t); t = setTimeout(() => { state.history.search = this.value; loadHistory(1); }, 300); });
        }
        if (el.btnPrint)     el.btnPrint.addEventListener('click',     () => window.print());
        if (el.btnExportPdf) el.btnExportPdf.addEventListener('click', () => window.print());
        if (el.btnDownload)  el.btnDownload.addEventListener('click',  downloadReport);

        bindSettingsEvents();

        // Webcam toggle bindings
        if (el.btnToggleWebcam) el.btnToggleWebcam.addEventListener('click', toggleWebcam);
        if (el.btnToggleWebcamMon) el.btnToggleWebcamMon.addEventListener('click', toggleWebcam);

        // Auto-start webcam for judge evaluations
        setTimeout(startBrowserCamera, 800);

        startPolling();
    }

    // 4. TAB NAVIGATION
    function switchTab(tabId) {
        if (!tabId) return;
        state.activeTab = tabId;
        el.navItems.forEach(i => i.classList.remove('active'));
        el.tabPanels.forEach(p => p.classList.remove('active'));
        const nav = Array.from(el.navItems).find(i => i.dataset.tab === tabId);
        if (nav) nav.classList.add('active');
        const panel = document.getElementById('tab-' + tabId);
        if (panel) {
            panel.classList.add('active');
            if (tabId === 'history')   loadHistory(1);
            if (tabId === 'analytics') loadAnalytics();
            if (tabId === 'reports')   loadReportList();
        }
    }

    // 5. CLOCK
    function updateClock() {
        const n = new Date();
        const p = v => String(v).padStart(2,'0');
        if (el.liveClock) el.liveClock.textContent = p(n.getHours())+':'+p(n.getMinutes())+':'+p(n.getSeconds());
        const m = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        if (el.liveDate)  el.liveDate.textContent  = p(n.getDate())+' '+m[n.getMonth()]+' '+n.getFullYear();
    }

    // 5.1 BROWSER WEBCAM CONTROL
    async function startBrowserCamera() {
        if (state.isCameraActive) return;
        pushSystemNotification("Requesting webcam access...");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: "user"
                }
            });
            state.cameraStream = stream;
            state.isCameraActive = true;
            pushSystemNotification("Webcam stream started. Initializing browser-side AI loop...");
            
            // Update button texts
            if (el.webcamBtnText) el.webcamBtnText.textContent = "Stop Webcam";
            if (el.webcamBtnTextMon) el.webcamBtnTextMon.textContent = "Stop Webcam";
            if (el.btnToggleWebcam) el.btnToggleWebcam.style.background = "linear-gradient(135deg, var(--red), #ff4d4d)";
            if (el.btnToggleWebcamMon) el.btnToggleWebcamMon.style.background = "linear-gradient(135deg, var(--red), #ff4d4d)";
            
            // Create hidden video element
            state.videoEl = document.createElement('video');
            state.videoEl.srcObject = stream;
            state.videoEl.setAttribute('playsinline', '');
            state.videoEl.muted = true;
            await state.videoEl.play();
            
            // Create offscreen canvas
            state.canvasEl = document.createElement('canvas');
            
            // Update top status bar
            if (el.systemStatusText) el.systemStatusText.textContent = "BROWSER WEBCAM · ACTIVE";
            if (el.systemBeacon) el.systemBeacon.className = "status-beacon online";

            // Stop standard database polling
            if (state.pollingTimer) {
                clearInterval(state.pollingTimer);
                state.pollingTimer = null;
            }

            // Start loop
            captureAndSendFrame();
        } catch(err) {
            console.error("Camera access failed:", err);
            pushSystemNotification("Camera access denied or unavailable. Running in server poll mode.");
            state.isCameraActive = false;
            if (el.webcamBtnText) el.webcamBtnText.textContent = "Start Webcam";
            if (el.webcamBtnTextMon) el.webcamBtnTextMon.textContent = "Start Webcam";
        }
    }

    function stopBrowserCamera() {
        if (!state.isCameraActive) return;
        pushSystemNotification("Stopping webcam stream...");
        state.isCameraActive = false;
        
        if (state.cameraStream) {
            state.cameraStream.getTracks().forEach(track => track.stop());
            state.cameraStream = null;
        }
        if (state.videoEl) {
            state.videoEl.pause();
            state.videoEl = null;
        }
        state.canvasEl = null;

        // Reset button states
        if (el.webcamBtnText) el.webcamBtnText.textContent = "Start Webcam";
        if (el.webcamBtnTextMon) el.webcamBtnTextMon.textContent = "Start Webcam";
        if (el.btnToggleWebcam) el.btnToggleWebcam.style.background = "linear-gradient(135deg, var(--blue), #00bfff)";
        if (el.btnToggleWebcamMon) el.btnToggleWebcamMon.style.background = "linear-gradient(135deg, var(--blue), #00bfff)";
        
        if (el.systemStatusText) el.systemStatusText.textContent = "YOLO ENGINE · DISCONNECTED";
        if (el.systemBeacon) el.systemBeacon.className = "status-beacon offline";
        
        // Reset image feeds to default endpoint
        if (el.feedImg) el.feedImg.src = state.backendUrl + "/video_feed";
        if (el.monitorImg) el.monitorImg.src = state.backendUrl + "/video_feed";

        // Restart polling
        startPolling();
    }

    function toggleWebcam(e) {
        if (e) e.preventDefault();
        if (state.isCameraActive) {
            stopBrowserCamera();
        } else {
            startBrowserCamera();
        }
    }

    async function captureAndSendFrame() {
        if (!state.isCameraActive) return;
        if (state.activeRequest) {
            requestAnimationFrame(captureAndSendFrame);
            return;
        }

        const vid = state.videoEl;
        const cvs = state.canvasEl;
        if (vid && vid.readyState === vid.HAVE_ENOUGH_DATA && cvs) {
            cvs.width = 640;
            cvs.height = 480;
            const ctx = cvs.getContext('2d');
            ctx.drawImage(vid, 0, 0, cvs.width, cvs.height);
            
            // Encode as JPEG base64 (quality 0.7 to optimize payload size)
            const dataUrl = cvs.toDataURL('image/jpeg', 0.7);
            
            state.activeRequest = true;
            const t0 = performance.now();
            try {
                const res = await fetch(state.backendUrl + '/detect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: dataUrl })
                });
                
                if (res.ok) {
                    const d = await res.json();
                    state.isFallbackMode = false;
                    state.telemetry = {
                        workers: d.workers || 0,
                        machines: d.machines || 0,
                        risk: d.risk || 0,
                        status: parseStatus(d.status, d.risk),
                        fps: d.fps || 0,
                        time: new Date().toISOString()
                    };
                    
                    // Render annotated frame base64 directly
                    if (d.frame) {
                        if (el.feedImg) el.feedImg.src = d.frame;
                        if (el.monitorImg) el.monitorImg.src = d.frame;
                    }
                    
                    updateTelemetry(Math.round(performance.now() - t0));
                    
                    // Auto-refresh reports list
                    if (d.risk >= 50 && d.id && state.selectedIncidentId !== d.id) {
                        state.selectedIncidentId = d.id;
                        loadReportList(true);
                    }
                } else {
                    throw new Error("HTTP error: " + res.status);
                }
            } catch(err) {
                console.error("Inference request failed:", err);
                state.isFallbackMode = true;
                pushSystemNotification("Detection failed. Retrying...");
            } finally {
                state.activeRequest = false;
            }

            // Real-time tab updates
            if (state.activeTab === 'history') {
                loadHistory(state.history.page, true);
            } else if (state.activeTab === 'analytics') {
                loadAnalytics();
            } else if (state.activeTab === 'reports') {
                loadReportList(true);
            }
        }
        
        // Dynamic wait depending on CPU load, safety default 150ms
        setTimeout(() => {
            requestAnimationFrame(captureAndSendFrame);
        }, 150);
    }

    // 6. POLLING
    function startPolling() {
        if (state.pollingTimer) clearInterval(state.pollingTimer);
        const poll = async () => {
            const t0 = performance.now();
            try {
                const res = await fetch(state.backendUrl + '/latest');
                if (!res.ok) throw new Error();
                const d = await res.json();
                state.isFallbackMode = false;
                state.telemetry = { workers: d.workers||0, machines: d.machines||0, risk: d.risk||0, status: parseStatus(d.status, d.risk), fps: d.fps||0, time: new Date().toISOString() };
                updateTelemetry(Math.round(performance.now() - t0));
                
                // Auto-refresh selected report to latest incident during critical/warning alert breach
                if (d.risk >= 50 && d.id && state.selectedIncidentId !== d.id) {
                    state.selectedIncidentId = d.id;
                    loadReportList(true);
                }
            } catch(_) {
                state.isFallbackMode = true;
                state.telemetry = { workers: 0, machines: 0, risk: 0, status: 'SAFE', fps: 0, time: new Date().toISOString() };
                updateTelemetry(0);
            }

            // Real-time tab updates
            if (state.activeTab === 'history') {
                loadHistory(state.history.page, true);
            } else if (state.activeTab === 'analytics') {
                loadAnalytics();
            } else if (state.activeTab === 'reports') {
                loadReportList(true);
            }
        };
        poll();
        state.pollingTimer = setInterval(poll, state.pollingInterval);
    }

    function parseStatus(raw, risk) {
        if (!raw || !raw.trim()) { return risk>=80?'CRITICAL':risk>=50?'WARNING':'SAFE'; }
        const u = raw.toUpperCase();
        if (u.includes('CRITICAL')) return 'CRITICAL';
        if (u.includes('WARNING'))  return 'WARNING';
        return 'SAFE';
    }

    // 7. DOM BINDING
    function updateTelemetry(latency) {
        const t = state.telemetry;

        // Connection badge
        if (el.backendBeacon) el.backendBeacon.className = state.isFallbackMode ? 'conn-beacon pulse-orange' : 'conn-beacon pulse-blue';
        if (el.backendText)   { el.backendText.textContent = state.isFallbackMode?'SIMULATOR ACTIVE':'EDGE CONNECTED'; el.backendText.style.color = state.isFallbackMode?'var(--orange)':'var(--blue)'; }
        if (el.backendBadge)  el.backendBadge.style.borderColor = state.isFallbackMode?'rgba(245,130,13,0.3)':'rgba(30,144,255,0.3)';
        if (el.systemStatusText) el.systemStatusText.textContent = state.isFallbackMode?'SIMULATION MODE · ACTIVE':'YOLO ENGINE · OPERATIONAL';
        if (el.systemBeacon)  el.systemBeacon.className = state.isFallbackMode?'status-beacon offline':'status-beacon online';
        if (el.lastUpdatedTs) el.lastUpdatedTs.textContent = 'Last synced: '+new Date().toLocaleTimeString();

        // HUD
        if (el.feedFps)   el.feedFps.textContent   = t.fps;
        if (el.hudWorker) el.hudWorker.textContent  = t.workers;
        if (el.hudMachine) el.hudMachine.textContent = t.machines;
        if (el.hudFps)    el.hudFps.textContent    = t.fps;
        if (el.hudLatency) el.hudLatency.textContent = latency+' ms';
        if (el.monitorLatency) el.monitorLatency.textContent = latency+' ms';

        // KPI animated counters
        animateCounter('kpiWorkersVal',  state.displayedWorkers,  t.workers,  v => { state.displayedWorkers=v; });
        animateCounter('kpiMachinesVal', state.displayedMachines, t.machines, v => { state.displayedMachines=v; });
        animateCounter('kpiRiskVal',     state.displayedRisk,     t.risk,     v => { state.displayedRisk=v; }, '%');
        if (el.kpiFpsBadge) el.kpiFpsBadge.textContent = t.fps+' FPS';

        if (el.kpiRiskIcon) el.kpiRiskIcon.className = t.risk>=80?'kpi-icon red':t.risk>=50?'kpi-icon yellow':'kpi-icon green';

        applyStatusKpi(t.status);
        updateRiskMeter(t.risk);

        // HUD overlay
        if (el.hudAlert) {
            if (t.status!=='SAFE') {
                el.hudAlert.classList.add('active');
                if (el.hudAlertText) el.hudAlertText.textContent = t.status==='CRITICAL'?'CRITICAL BREACH — CLEAR MACHINE RADIALS IMMEDIATELY':'WARNING — Worker approaching heavy equipment';
            } else { el.hudAlert.classList.remove('active'); }
        }

        updateAlertPanel(t);
        updateSafetyScore();
        pushConsoleLog(t);
        if (t.status!=='SAFE') triggerAlarm();
    }

    function animateCounter(key, from, to, onDone, suffix) {
        suffix = suffix||'';
        const el2 = el[key]; if(!el2) return;
        if(from===to){el2.innerHTML=to+(suffix?'<small>'+suffix+'</small>':'');return;}
        let step=0,steps=14;
        const iv=setInterval(()=>{
            step++;
            const v=Math.round(from+(to-from)*step/steps);
            el2.innerHTML=v+(suffix?'<small>'+suffix+'</small>':'');
            if(step>=steps){el2.innerHTML=to+(suffix?'<small>'+suffix+'</small>':'');onDone(to);clearInterval(iv);}
        },28);
    }

    function applyStatusKpi(status) {
        const m = {
            SAFE:     {icon:'fa-solid fa-shield-check',       cls:'kpi-icon green',  sub:'No hazards detected',       vc:''},
            WARNING:  {icon:'fa-solid fa-circle-exclamation', cls:'kpi-icon yellow', sub:'Worker near equipment',     vc:'text-yellow'},
            CRITICAL: {icon:'fa-solid fa-triangle-exclamation',cls:'kpi-icon red',   sub:'IMMEDIATE ACTION REQUIRED', vc:'text-red'}
        };
        const c = m[status]||m.SAFE;
        if (el.kpiStatusVal)  { el.kpiStatusVal.textContent=status; el.kpiStatusVal.className='kpi-value status-value '+c.vc; }
        if (el.kpiStatusIcon) { el.kpiStatusIcon.className=c.cls; const i=el.kpiStatusIcon.querySelector('i'); if(i) i.className=c.icon; }
        if (el.kpiStatusSub)  el.kpiStatusSub.textContent=c.sub;
        if (el.kpiStatusRing) el.kpiStatusRing.style.borderColor = status==='CRITICAL'?'rgba(255,51,51,0.5)':status==='WARNING'?'rgba(245,130,13,0.35)':'rgba(0,214,143,0.2)';
        if (el.kpiStatusCard) { el.kpiStatusCard.classList.remove('status-safe','status-warn','status-crit'); el.kpiStatusCard.classList.add(status==='CRITICAL'?'status-crit':status==='WARNING'?'status-warn':'status-safe'); }
    }

    function updateRiskMeter(risk) {
        if (el.riskPercentage) el.riskPercentage.textContent = risk+'%';
        if (el.riskBar) {
            el.riskBar.style.width = risk+'%';
            if (risk<50) { el.riskBar.style.background='var(--green)'; el.riskBar.style.boxShadow='0 0 12px rgba(0,214,143,0.6)'; }
            else if (risk<80) { el.riskBar.style.background='var(--orange)'; el.riskBar.style.boxShadow='0 0 12px rgba(245,130,13,0.6)'; }
            else { el.riskBar.style.background='var(--red)'; el.riskBar.style.boxShadow='0 0 16px rgba(255,51,51,0.7)'; }
        }
    }

    function updateAlertPanel(t) {
        if (!el.latestAlertCard) return;
        el.latestAlertCard.className = 'alert-card '+t.status.toLowerCase();
        if (el.alertIconWrap) {
            if (t.status==='CRITICAL') { el.alertIconWrap.innerHTML='<i class="fa-solid fa-circle-exclamation blink-animation"></i>'; el.alertIconWrap.className='alert-ic-wrap critical'; }
            else if (t.status==='WARNING') { el.alertIconWrap.innerHTML='<i class="fa-solid fa-triangle-exclamation"></i>'; el.alertIconWrap.className='alert-ic-wrap warning'; }
            else { el.alertIconWrap.innerHTML='<i class="fa-solid fa-circle-check"></i>'; el.alertIconWrap.className='alert-ic-wrap'; }
        }
        const titles = {SAFE:'SYSTEM SECURE',WARNING:'WARNING HAZARD',CRITICAL:'⚠ CRITICAL BREACH'};
        const descs  = {SAFE:'No hazards currently registered in the workspace area.',WARNING:'Worker has entered the safety margin around active equipment. Proceed with caution.',CRITICAL:'Immediate evacuation recommended. Machinery stop signal triggered.'};
        if (el.alertTitle) el.alertTitle.textContent = titles[t.status]||titles.SAFE;
        if (el.alertDesc)  el.alertDesc.textContent  = descs[t.status]||descs.SAFE;

        const recBox = $('alert-recommendation-box');
        if (recBox) {
            const risk = t.risk || 0;
            let recText = "SYSTEM RECOMMENDED ACTION: Maintain standard safety vigilance.";
            let borderColor = "var(--green)";
            
            if (risk > 0) {
                if (risk < 30) {
                    recText = "SYSTEM RECOMMENDED ACTION (Risk: " + risk + "%): Normal operations. Maintain safe pedestrian distances.";
                    borderColor = "var(--green)";
                } else if (risk < 50) {
                    recText = "SYSTEM RECOMMENDED ACTION (Risk: " + risk + "%): Minor encroachment. Alert worker to remain clear of machinery radial.";
                    borderColor = "var(--blue)";
                } else if (risk < 70) {
                    recText = "SYSTEM RECOMMENDED ACTION (Risk: " + risk + "%): Proximity warning! Operator must yield and worker step away immediately.";
                    borderColor = "var(--orange)";
                } else if (risk < 80) {
                    recText = "SYSTEM RECOMMENDED ACTION (Risk: " + risk + "%): High danger zone transition. Halt equipment transit until path is cleared.";
                    borderColor = "var(--orange)";
                } else if (risk < 90) {
                    recText = "SYSTEM RECOMMENDED ACTION (Risk: " + risk + "%): CRITICAL BOUNDARY BREACH! Stop heavy machinery. Evacuate zone.";
                    borderColor = "var(--red)";
                } else {
                    recText = "SYSTEM RECOMMENDED ACTION (Risk: " + risk + "%): IMMEDIATE COLLISION DANGER! Trigger emergency manual stop. Clear area.";
                    borderColor = "var(--red)";
                }
            }
            recBox.textContent = recText;
            recBox.style.borderLeftColor = borderColor;
        }
    }

    // 8. SAFETY SCORE
    function updateSafetyScore() {
        const t = state.telemetry;
        let score = parseInt(el.safetyScoreVal&&el.safetyScoreVal.textContent)||100;
        if (t.status==='CRITICAL') score=Math.max(30,score-4);
        else if (t.status==='WARNING') score=Math.max(60,score-1);
        else score=Math.min(100,score+1);
        if (el.safetyScoreVal) el.safetyScoreVal.textContent=score;
        let label='EXCELLENT', color='var(--green)';
        if (score<55){label='POOR';color='var(--red)';}
        else if(score<75){label='AVERAGE';color='var(--orange)';}
        else if(score<90){label='GOOD';color='var(--blue)';}
        if (el.safetyScoreLabel){el.safetyScoreLabel.textContent=label;el.safetyScoreLabel.style.color=color;}
        if (el.safetyScoreArc) {
            const circ=314.16;
            el.safetyScoreArc.style.stroke=color;
            el.safetyScoreArc.style.strokeDashoffset=String(circ-(circ*score/100));
        }
    }

    // 9. CONSOLE LOGS
    function pushConsoleLog(t) {
        if (!el.consoleLogs) return;
        const ts=new Date().toLocaleTimeString();
        let msg, cls;
        if (t.status==='CRITICAL'){msg='[CRITICAL] Proximity breach! Workers:'+t.workers+' Machines:'+t.machines+' Risk:'+t.risk+'%';cls='critical';}
        else if (t.status==='WARNING'){msg='[WARNING] Proximity margin reduced. Workers:'+t.workers+' Risk:'+t.risk+'%';cls='warning';}
        else {msg='[SAFE] Scan OK. Workers:'+t.workers+' Machines:'+t.machines+' FPS:'+t.fps;cls='safe';}
        const line=document.createElement('div');
        line.className='clog '+cls;
        line.innerHTML='<span class="clog-ts">['+ts+']</span> '+msg;
        el.consoleLogs.appendChild(line);
        el.consoleLogs.scrollTop=el.consoleLogs.scrollHeight;
        while(el.consoleLogs.children.length>60) el.consoleLogs.removeChild(el.consoleLogs.firstChild);
    }

    function pushSystemNotification(msg) {
        if (!el.consoleLogs) return;
        const ts=new Date().toLocaleTimeString();
        const line=document.createElement('div');
        line.className='clog system';
        line.innerHTML='<span class="clog-ts">['+ts+']</span> <strong style="color:var(--blue)">[SYSTEM]</strong> '+msg;
        el.consoleLogs.appendChild(line);
        el.consoleLogs.scrollTop=el.consoleLogs.scrollHeight;
    }

    // 10. LIVE FEED — Real MJPEG stream from /video_feed
    // The feed is rendered by the browser via <img src="/video_feed"> in HTML.
    // No canvas simulation. All bounding boxes and annotations come from OpenCV/YOLO in main.py.

    // 11. AUDIO
    function triggerAlarm() {
        if (!state.enableAudio) return;
        const now=Date.now(), cool=state.telemetry.status==='CRITICAL'?800:2000;
        if(now-state.lastBeepTime<cool) return;
        state.lastBeepTime=now;
        try {
            if (!audioCtx) audioCtx=new(window.AudioContext||window.webkitAudioContext)();
            if (audioCtx.state==='suspended') audioCtx.resume();
            const osc=audioCtx.createOscillator(), gain=audioCtx.createGain();
            osc.connect(gain); gain.connect(audioCtx.destination);
            if (state.telemetry.status==='CRITICAL') {
                osc.type='sawtooth'; osc.frequency.setValueAtTime(980,audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(1400,audioCtx.currentTime+0.15);
                gain.gain.setValueAtTime(0.12,audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01,audioCtx.currentTime+0.25);
                osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime+0.3);
            } else {
                osc.type='sine'; osc.frequency.setValueAtTime(650,audioCtx.currentTime);
                gain.gain.setValueAtTime(0.08,audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01,audioCtx.currentTime+0.15);
                osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime+0.2);
            }
        } catch(e){}
    }

    // 12. HISTORY
    async function loadHistory(page, isSilent) {
        state.history.page=Math.max(1,page||1);
        if (!isSilent && el.historyTableBody) {
            el.historyTableBody.innerHTML='<tr><td colspan="8" class="table-loader"><i class="fa-solid fa-spinner fa-spin"></i><span>Loading from SQLite\u2026</span></td></tr>';
        }
        try {
            const url=state.backendUrl+'/history?page='+state.history.page+'&limit='+state.history.limit+'&search='+encodeURIComponent(state.history.search);
            const res=await fetch(url); if(!res.ok) throw new Error();
            const data=await res.json();
            state.history.data=data.data; state.history.total=data.total;
            renderHistoryTable(); renderPagination();
        } catch(e) {
            console.error("Failed to load SQLite history:", e);
            if (!isSilent && el.historyTableBody) {
                el.historyTableBody.innerHTML='<tr><td colspan="8" class="table-loader"><i class="fa-solid fa-triangle-exclamation text-red"></i><span>Failed to connect to SQLite database.</span></td></tr>';
            }
        }
    }

    function renderHistoryTable() {
        if(!el.historyTableBody) return;
        const rows=state.history.data;
        if(!rows.length){el.historyTableBody.innerHTML='<tr><td colspan="8" class="table-loader"><i class="fa-solid fa-folder-open" style="color:var(--text-muted)"></i><span>No records match the current filter.</span></td></tr>';return;}
        let html='';
        rows.forEach(row=>{
            const st=parseStatus(row.status,row.risk),bc=st.toLowerCase(),rc=row.risk>=80?'high':row.risk>=50?'medium':'low';
            html+='<tr><td class="mono-cell">#'+row.id+'</td><td>'+fmtDate(row.time)+'</td><td class="mono-cell" style="text-align:center">'+row.workers+'</td><td class="mono-cell" style="text-align:center">'+row.machines+'</td><td class="risk-cell '+rc+'" style="text-align:center">'+row.risk+'%</td><td><span class="status-pill '+bc+'">'+st+'</span></td><td class="mono-cell">'+row.fps+'</td><td><button class="btn btn-ghost btn-gen-report" style="padding:5px 10px;font-size:11px" data-row-id="'+row.id+'"><i class="fa-solid fa-file-invoice"></i> Report</button></td></tr>';
        });
        el.historyTableBody.innerHTML=html;
        document.querySelectorAll('.btn-gen-report').forEach(btn=>{ btn.addEventListener('click',function(){state.selectedIncidentId=parseInt(this.dataset.rowId);switchTab('reports');}); });
    }

    function renderPagination() {
        const {total,page,limit}=state.history, tp=Math.ceil(total/limit)||1;
        if(el.btnPageFirst) el.btnPageFirst.disabled=page===1;
        if(el.btnPagePrev)  el.btnPagePrev.disabled=page===1;
        if(el.btnPageNext)  el.btnPageNext.disabled=page===tp;
        if(el.btnPageLast)  el.btnPageLast.disabled=page===tp;
        if(el.pageStart) el.pageStart.textContent=total===0?0:(page-1)*limit+1;
        if(el.pageEnd)   el.pageEnd.textContent=Math.min(page*limit,total);
        if(el.pageTotal) el.pageTotal.textContent=total;
        if(el.pageNumbers){
            let sp=Math.max(1,page-2),ep=Math.min(tp,sp+4);
            if(ep-sp<4) sp=Math.max(1,ep-4);
            let html='';
            for(let i=sp;i<=ep;i++) html+='<span class="pg-pill'+(i===page?' active':'')+'" data-pg="'+i+'">'+i+'</span>';
            el.pageNumbers.innerHTML=html;
            document.querySelectorAll('.pg-pill').forEach(p=>{ p.addEventListener('click',function(){loadHistory(parseInt(this.dataset.pg));}); });
        }
    }

    function fmtDate(iso) {
        if(!iso) return '\u2014';
        try{
            // Parse UTC timestamp stored in SQLite (format YYYY-MM-DD HH:MM:SS)
            const cleanStr = iso.replace(' ', 'T') + (iso.endsWith('Z') ? '' : 'Z');
            const d=new Date(cleanStr);
            if (isNaN(d.getTime())) return iso;
            // Format to Indian Standard Time (IST)
            return d.toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                hour12: true,
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }catch(_){return iso;}
    }

    function exportToCsv() {
        const rows=state.history.data; if(!rows.length) return;
        let csv='ID,Timestamp,Workers,Machines,Risk %,Status,FPS\n';
        rows.forEach(r=>{csv+=r.id+',"'+r.time+'",'+r.workers+','+r.machines+','+r.risk+','+r.status+','+r.fps+'\n';});
        const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),a=document.createElement('a');
        a.href=URL.createObjectURL(blob); a.download='edgeguard_'+new Date().toISOString().slice(0,10)+'.csv'; a.click();
    }

    // 13. ANALYTICS
    async function loadAnalytics() {
        let stats;
        try{const res=await fetch(state.backendUrl+'/analytics');if(!res.ok)throw new Error();stats=await res.json();}
        catch(e){console.error("Failed to load SQLite analytics:", e); return;}
        if(el.metricAvgRisk)       el.metricAvgRisk.textContent=stats.avg_risk+'%';
        if(el.metricMaxRisk)       el.metricMaxRisk.textContent=stats.max_risk_today+'%';
        if(el.metricCriticalCount) el.metricCriticalCount.textContent=stats.critical_count;
        if(el.metricWarningCount)  el.metricWarningCount.textContent=stats.warning_count;
        if(el.metricSafeCount)     el.metricSafeCount.textContent=stats.safe_count;
        if(el.metricTotalIncidents) el.metricTotalIncidents.textContent=stats.total_incidents;
        renderCharts(stats);
    }

    function renderCharts(stats) {
        Chart.defaults.color='#7b8fa8'; Chart.defaults.borderColor='rgba(255,255,255,0.05)'; Chart.defaults.font.family='Inter';
        const rCtx=$('chart-risk-trend');
        if(rCtx){
            if(charts.riskTrend){
                charts.riskTrend.data.labels = stats.trends.labels;
                charts.riskTrend.data.datasets[0].data = stats.trends.risk;
                charts.riskTrend.update('none');
            } else {
                charts.riskTrend=new Chart(rCtx,{type:'line',data:{labels:stats.trends.labels,datasets:[{label:'Risk %',data:stats.trends.risk,borderColor:'#1e90ff',backgroundColor:'rgba(30,144,255,0.06)',borderWidth:2,fill:true,tension:0.35,pointRadius:2,pointHoverRadius:6,pointBackgroundColor:'#1e90ff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{min:0,max:100,grid:{color:'rgba(255,255,255,0.04)'},ticks:{font:{family:'JetBrains Mono',size:10}}},x:{grid:{color:'rgba(255,255,255,0.03)'},ticks:{font:{family:'JetBrains Mono',size:9},maxTicksLimit:10}}}}});
            }
        }
        const oCtx=$('chart-objects-trend');
        if(oCtx){
            if(charts.objectsTrend){
                charts.objectsTrend.data.labels = stats.trends.labels;
                charts.objectsTrend.data.datasets[0].data = stats.trends.workers;
                charts.objectsTrend.data.datasets[1].data = stats.trends.machines;
                charts.objectsTrend.update('none');
            } else {
                charts.objectsTrend=new Chart(oCtx,{type:'line',data:{labels:stats.trends.labels,datasets:[{label:'Workers',data:stats.trends.workers,borderColor:'#00d68f',borderWidth:2,tension:0.1,fill:false,pointRadius:0},{label:'Machines',data:stats.trends.machines,borderColor:'#f5820d',borderWidth:2,tension:0.1,fill:false,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',align:'end',labels:{boxWidth:10,font:{size:10}}}},scales:{y:{min:0,max:8,ticks:{stepSize:1,font:{family:'JetBrains Mono'}},grid:{color:'rgba(255,255,255,0.04)'}},x:{ticks:{font:{family:'JetBrains Mono',size:9},maxTicksLimit:10},grid:{color:'rgba(255,255,255,0.03)'}}}}});
            }
        }
        const dCtx=$('chart-status-distribution');
        if(dCtx){
            if(charts.statusDist){
                charts.statusDist.data.datasets[0].data = [stats.status_distribution.safe, stats.status_distribution.warning, stats.status_distribution.critical];
                charts.statusDist.update('none');
            } else {
                charts.statusDist=new Chart(dCtx,{type:'doughnut',data:{labels:['Safe','Warning','Critical'],datasets:[{data:[stats.status_distribution.safe,stats.status_distribution.warning,stats.status_distribution.critical],backgroundColor:['rgba(0,214,143,0.82)','rgba(245,130,13,0.82)','rgba(255,51,51,0.82)'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:'72%',plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:10},padding:14}}}}});
            }
        }
        const fCtx=$('chart-frequency-distribution');
        if(fCtx && stats.hourly_frequency){
            if(charts.freqDist){
                charts.freqDist.data.labels = stats.hourly_frequency.labels;
                charts.freqDist.data.datasets[0].data = stats.hourly_frequency.warnings;
                charts.freqDist.data.datasets[1].data = stats.hourly_frequency.criticals;
                charts.freqDist.update('none');
            } else {
                charts.freqDist=new Chart(fCtx,{type:'bar',data:{labels:stats.hourly_frequency.labels,datasets:[{label:'Warnings',data:stats.hourly_frequency.warnings,backgroundColor:'rgba(245,130,13,0.7)'},{label:'Critical',data:stats.hourly_frequency.criticals,backgroundColor:'rgba(255,51,51,0.7)'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',align:'end',labels:{boxWidth:10,font:{size:10}}}},scales:{y:{stacked:true,ticks:{stepSize:1,font:{family:'JetBrains Mono'}},grid:{color:'rgba(255,255,255,0.04)'},ticks:{font:{family:'JetBrains Mono',size:10}}},x:{stacked:true,ticks:{font:{family:'JetBrains Mono',size:9}},grid:{display:false}}}}});
            }
        }
    }

    // 14. AI REPORTS
    // 14. AI REPORTS
    async function loadReportList(isSilent) {
        if (!el.reportSourceList) return;
        if (!isSilent) el.reportSourceList.innerHTML='<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i><span>Fetching reports from SQLite\u2026</span></div>';
        
        try {
            const url = state.backendUrl + '/reports_list';
            const res = await fetch(url);
            if (!res.ok) throw new Error();
            reportsCached = await res.json();
        } catch(e) {
            console.error("Failed to load reports list:", e);
            if (!isSilent) {
                el.reportSourceList.innerHTML='<div class="empty-state"><i class="fa-solid fa-triangle-exclamation text-red"></i><p>Failed to connect to SQLite reports endpoint.</p></div>';
            }
            return;
        }

        if (!reportsCached.length) {
            el.reportSourceList.innerHTML='<div class="empty-state"><i class="fa-solid fa-folder-open"></i><p>No hazard events recorded in the database.</p></div>';
            return;
        }
        
        let html='';
        reportsCached.forEach(row=>{
            const st=parseStatus(row.status,row.risk),cls=st.toLowerCase(),sel=state.selectedIncidentId===row.id?' active':'';
            html+='<div class="rep-item'+sel+'" data-rep-id="'+row.id+'"><div class="rep-item-meta"><span class="rep-item-time">'+fmtDate(row.time)+'</span><span class="rep-item-counts">Workers: '+row.workers+' &nbsp;|&nbsp; Machines: '+row.machines+'</span></div><span class="status-pill '+cls+'">'+row.risk+'% \u2014 '+st+'</span></div>';
        });
        el.reportSourceList.innerHTML=html;
        document.querySelectorAll('.rep-item').forEach(card=>{
            card.addEventListener('click',function(){
                state.selectedIncidentId=parseInt(this.dataset.repId);
                loadReportList(true);
                buildReport(state.selectedIncidentId);
            });
        });
        
        const defaultId = state.selectedIncidentId || (reportsCached[0] && reportsCached[0].id);
        if (defaultId) {
            buildReport(defaultId);
        }
    }

    function buildReport(id) {
        const item = reportsCached.find(r => r.id === id) || state.history.data.find(r => r.id === id);
        if(!item) return;
        
        state.selectedIncidentId = id;
        const dt=fmtDate(item.time);
        if(el.repId) el.repId.textContent=String(id).padStart(5,'0');
        if(el.repTime) el.repTime.textContent=dt;
        if(el.repRisk){el.repRisk.textContent=item.risk+'%';el.repRisk.style.color=item.risk>=80?'#dc2626':'#d97706';}
        if(el.repWorkers) el.repWorkers.textContent=item.workers;
        if(el.repMachines) el.repMachines.textContent=item.machines;
        
        const isCrit=item.risk>=80;
        const alertMsg = item.status && item.status.trim() ? item.status : (isCrit ? "CRITICAL BREACH" : "WARNING HAZARD");
        
        const summary = isCrit ? 
            'CRITICAL SAFETY EVENT — ' + dt + ' (IST): EdgeGuard AI detected a high-probability hazard vector. ' + item.workers + ' worker(s) logged at unsafe proximity to ' + item.machines + ' heavy machine(s) with FPS ' + item.fps + '. Dynamic risk registered at ' + item.risk + '%, exceeding the critical threshold. Alert level: ' + alertMsg + '.' :
            'WARNING INCIDENT — ' + dt + ' (IST): EdgeGuard AI flagged a safe-zone encroachment. ' + item.workers + ' worker(s) approached active machinery (' + item.machines + ' detected) with FPS ' + item.fps + '. Risk level: ' + item.risk + '%. Safety status: ' + alertMsg + '.';
            
        const actions = isCrit ? 
            ['Local hardware triggered audible safety sirens immediately.',
             'System dispatched hazard telemetry payloads to Flask SQLite buffer under record #' + id + '.',
             'Real-time alert banner overlaid on operator Vision HUD and safety control room terminals.',
             'Machinery emergency pause protocol signal broadcast via field interface.'] : 
            ['Dashboard transitioned to dynamic WARNING alert states.',
             'Proximity vectors overlaid on camera feed to guide operator attention.',
             'Logged proximity encroachment to SQLite incident repository.'];
             
        const recs = [];
        const risk = item.risk;
        if (risk < 30) {
            recs.push('Ensure standard pedestrian buffer zones are respected in active zones.');
            recs.push('Conduct standard visual verification of warning signage in the workspace.');
        } else if (risk < 50) {
            recs.push('Advise ground personnel to step back outside the warning radius of heavy equipment.');
            recs.push('Ensure reflective high-visibility safety jackets are correctly fastened and visible.');
        } else if (risk < 70) {
            recs.push('Calibrate YOLO hazard thresholds to match dynamic movement patterns of mobile machinery.');
            recs.push('Initiate field safety check on machinery proximity sensors and sound devices.');
        } else if (risk < 80) {
            recs.push('Enforce strict 3-metre clearance zones around active equipment corridors.');
            recs.push('Conduct on-site briefings with ground crew to address buffer zone violations.');
        } else if (risk < 90) {
            recs.push('Halt vehicle transit in zone until path clearances have been completely verified.');
            recs.push('Deploy smart helmet proximity transponders to improve worker positioning accuracy.');
        } else {
            recs.push('IMMEDIATE ACTION: Evacuate the heavy machinery operating radial immediately.');
            recs.push('Halt all localized construction activities until hazard investigation is complete.');
            recs.push('Implement physical physical barrier controls between pedestrian pathways and vehicle lanes.');
        }
        
        if(el.repSummary) el.repSummary.textContent=summary;
        if(el.repActionsList) el.repActionsList.innerHTML=actions.map(a=>'<li>'+a+'</li>').join('');
        if(el.repRecsList)    el.repRecsList.innerHTML=recs.map(r=>'<li>'+r+'</li>').join('');
    }

    function downloadReport() {
        if (!state.selectedIncidentId) return;
        const item = reportsCached.find(r => r.id === state.selectedIncidentId) || state.history.data.find(r => r.id === state.selectedIncidentId);
        if(!item) return;
        const dt=fmtDate(item.time);
        const txt='EdgeGuard AI Safety Report\nID: EG-REP-'+String(item.id).padStart(5,'0')+'\n\nTime: '+dt+' (IST)\nRisk: '+item.risk+'%\nWorkers: '+item.workers+'\nMachines: '+item.machines+'\nStatus: '+item.status+'\nFPS: '+item.fps;
        const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([txt],{type:'text/plain'})); a.download='edgeguard_report_'+item.id+'.txt'; a.click();
    }

    // 15. SETTINGS
    function bindSettingsEvents() {
        if(el.setBackendUrl){el.setBackendUrl.value=state.backendUrl;el.setBackendUrl.addEventListener('change',function(){state.backendUrl=this.value.trim();pushSystemNotification('Backend URL updated.');startPolling();});}
        if(el.setPollingRate){
            el.setPollingRate.value=state.pollingInterval;
            if(el.setPollingVal) el.setPollingVal.textContent=state.pollingInterval+'ms';
            el.setPollingRate.addEventListener('input',function(){state.pollingInterval=parseInt(this.value);if(el.setPollingVal)el.setPollingVal.textContent=state.pollingInterval+'ms';});
            el.setPollingRate.addEventListener('change',function(){pushSystemNotification('Polling: '+state.pollingInterval+'ms');startPolling();});
        }
        if(el.setToggleGrid){el.setToggleGrid.checked=state.enableGrid;el.setToggleGrid.addEventListener('change',()=>{state.enableGrid=el.setToggleGrid.checked;});}
        if(el.setToggleVectors){el.setToggleVectors.checked=state.enableVectors;el.setToggleVectors.addEventListener('change',()=>{state.enableVectors=el.setToggleVectors.checked;});}
        if(el.setToggleAuroras){
            el.setToggleAuroras.checked=state.enableAuroras;
            el.setToggleAuroras.addEventListener('change',function(){
                state.enableAuroras=this.checked;
                document.querySelectorAll('.ambient-orb,.grid-mesh').forEach(a=>{a.style.opacity=this.checked?'':'0';});
            });
        }
        if(el.setToggleAudio){el.setToggleAudio.checked=state.enableAudio;el.setToggleAudio.addEventListener('change',function(){state.enableAudio=this.checked;pushSystemNotification('Audio alarms '+(this.checked?'ENABLED':'MUTED')+'.');});}
        if(el.setEmuWorkers){el.setEmuWorkers.value=state.emuWorkers;el.setEmuWorkers.addEventListener('change',function(){state.emuWorkers=parseInt(this.value)||0;});}
        if(el.setEmuMachines){el.setEmuMachines.value=state.emuMachines;el.setEmuMachines.addEventListener('change',function(){state.emuMachines=parseInt(this.value)||0;});}
        if(el.btnClearDb){
            el.btnClearDb.addEventListener('click',async()=>{
                if(!confirm('Purge all SQLite incident logs? This cannot be undone.')) return;
                pushSystemNotification('Purging database\u2026');
                try{await fetch(state.backendUrl+'/history',{method:'DELETE'});pushSystemNotification('SQLite records purged.');}
                catch(_){pushSystemNotification('Simulation mode: logs cleared locally.');}
                loadHistory(1);
            });
        }
        if(el.btnRestoreDefaults){
            el.btnRestoreDefaults.addEventListener('click',()=>{
                state.backendUrl=window.location.origin; state.pollingInterval=1000;
                state.enableAudio=true;state.enableGrid=true;state.enableVectors=true;state.enableAuroras=true;
                state.emuWorkers=3;state.emuMachines=2;
                if(el.setBackendUrl) el.setBackendUrl.value=state.backendUrl;
                if(el.setPollingRate) el.setPollingRate.value=1000;
                if(el.setPollingVal) el.setPollingVal.textContent='1000ms';
                if(el.setToggleGrid) el.setToggleGrid.checked=true;
                if(el.setToggleVectors) el.setToggleVectors.checked=true;
                if(el.setToggleAuroras) el.setToggleAuroras.checked=true;
                if(el.setToggleAudio) el.setToggleAudio.checked=true;
                if(el.setEmuWorkers) el.setEmuWorkers.value=3;
                if(el.setEmuMachines) el.setEmuMachines.value=2;
                document.querySelectorAll('.ambient-orb,.grid-mesh').forEach(a=>a.style.opacity='');
                pushSystemNotification('Factory defaults restored.');
                startPolling();
            });
        }
    }

    // 16. BOOT
    window.addEventListener('DOMContentLoaded', init);

})();
