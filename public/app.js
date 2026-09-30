/**
 * Photo Booth 前端状态机
 *
 * 完整流程（触发后总时长 5 + 3 + 15 = 23 秒）：
 *   1. intro 阶段：动画 3 单独循环播放 5 秒（背景层）
 *   2. seq 阶段：前景层依次播放动画 1 -> 2（倒计时画面由动画呈现），
 *      动画 3 作为背景保持不变继续循环；2 播完立即拍照
 *   3. result 阶段：显示照片 + QR 码 25 秒（圆环显示剩余时间），动画 3 仍在背景继续播放
 *   4. 回到 idle：随机从 idle 清单某个文件开始播放，
 *      之后按文件名顺序 1 -> 2 -> 3 循环
 *
 * 触发：回车键 或 鼠标点击
 */
(() => {
  const INTRO_SECONDS = 5;     // 动画 3 单独播放时长
  const COUNTDOWN_SECONDS = 3; // 数字倒数（同步播放 1->2）
  const RESULT_SECONDS = 25;   // QR 展示时长

  const cam = document.getElementById('cam');
  const animBg = document.getElementById('animBg');
  const anim = document.getElementById('anim');
  const fallbackAnim = document.getElementById('fallbackAnim');
  const countdownEl = document.getElementById('countdown');
  const flash = document.getElementById('flash');
  const resultEl = document.getElementById('result');
  const resultPhoto = document.getElementById('resultPhoto');
  const qrImg = document.getElementById('qrImg');
  const qrTimerBar = document.getElementById('qrTimerBar');
  // 圆环周长（r=34），用 dashoffset 从 0 -> C 表现"剩余时间耗尽"
  const RING_C = 2 * Math.PI * 34;
  let ringStart = 0;
  const camError = document.getElementById('camError');

  let state = 'idle'; // idle | countdown | result
  let phase = 'idle'; // idle | intro | seq | result
  let idleList = [];   // assets/idle/*
  let introSrc = null; // countdown 中 3 开头的文件（背景层）
  let seqList = [];    // countdown 中 1、2 开头的文件（前景层，按文件名排序）
  let idleIndex = 0;
  let seqIndex = 0;
  let introTimer = null;
  let countdownTimer = null;
  let resultTimer = null;

  // ---------- 摄像头 ----------
  async function initCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      cam.srcObject = stream;
    } catch (e) {
      console.error('camera error', e);
      camError.classList.remove('hidden');
    }
  }

  // ---------- countdown 文件按文件名分轴 ----------
  function splitCountdown(files) {
    const intro = files.find(f => /\/3[^/]*\.webm$/i.test(f)); // 3 开头 -> 背景
    introSrc = intro || null;
    seqList = files.filter(f => /\/[12][^/]*\.webm$/i.test(f)); // 1/2 开头 -> 前景
  }

  function showFallback() {
    anim.classList.add('hidden');
    fallbackAnim.classList.remove('hidden');
  }
  function showFg() {
    fallbackAnim.classList.add('hidden');
    anim.classList.remove('hidden');
  }
  function stopFg() {
    anim.pause();
    anim.removeAttribute('src');
    anim.load();
    anim.classList.add('hidden');
  }
  function stopBg() {
    animBg.pause();
    animBg.muted = true; // 恢复静音，回到 idle 后背景层不再出声
    animBg.removeAttribute('src');
    animBg.load();
    animBg.classList.add('hidden');
  }

  // ---------- idle：随机起点，之后按 1->2->3 顺序循环 ----------
  function playIdle() {
    phase = 'idle';
    stopBg();
    if (idleList.length === 0) { showFallback(); return; }
    showFg();
    // 随机从某个文件开始；播放完后按顺序循环
    idleIndex = Math.floor(Math.random() * idleList.length);
    playIdleCurrent();
  }

  function playIdleCurrent() {
    anim.src = idleList[idleIndex];
    anim.loop = idleList.length === 1; // 单文件时原地循环
    anim.play().catch(() => {});
  }

  // ---------- 触发 ----------
  function trigger() {
    if (state !== 'idle') return;
    state = 'countdown';
    stopFg(); // idle 前景动画停掉
    fallbackAnim.classList.add('hidden');
    startIntro();
  }

  // ---------- 阶段 1：动画 3 单独播放 5 秒 ----------
  function startIntro() {
    phase = 'intro';
    if (introSrc) {
      animBg.src = introSrc;
      animBg.loop = true; // 循环，整个 countdown+result 期间保持不变
      // 动画 3 播放声音：30% 音量。trigger 由真实按键/点击触发，
      // 存在 user activation，浏览器允许带声音播放
      animBg.muted = false;
      animBg.volume = 0.3;
      animBg.classList.remove('hidden');
      animBg.play().catch(() => {});
    }
    introTimer = setTimeout(startSeq, INTRO_SECONDS * 1000);
  }

  // ---------- 阶段 2：前景同步播放 1 -> 2（动画自带倒计时画面） ----------
  function startSeq() {
    phase = 'seq';
    seqIndex = 0;
    if (seqList.length > 0) {
      showFg();
      playSeqCurrent();
      // 倒计时数字由动画呈现，不再叠加 HTML 数字（避免双重倒计时）
    } else {
      // 没有 1/2 动画文件时，退化为 HTML 数字倒计时
      runCountdown(COUNTDOWN_SECONDS);
    }
  }

  function playSeqCurrent() {
    anim.src = seqList[seqIndex];
    anim.loop = false;
    anim.play().catch(() => {});
  }

  function runCountdown(n) {
    if (n <= 0) {
      countdownEl.classList.add('hidden');
      if (seqList.length === 0) capture(); // 没有 1/2 动画时倒数完直接拍
      return;
    }
    countdownEl.textContent = n;
    countdownEl.classList.remove('hidden', 'pop');
    void countdownEl.offsetWidth; // 重启动画
    countdownEl.classList.add('pop');
    countdownTimer = setTimeout(() => runCountdown(n - 1), 1000);
  }

  // 前景动画播放结束：1 -> 2，2 -> 拍照
  anim.addEventListener('ended', () => {
    if (phase === 'idle') {
      idleIndex = (idleIndex + 1) % idleList.length; // 顺序循环
      playIdleCurrent();
    } else if (phase === 'seq') {
      seqIndex++;
      if (seqIndex < seqList.length) {
        playSeqCurrent();
      } else {
        capture(); // 动画 2 播完 -> 拍照
      }
    }
  });

  // ---------- 截图（合成屏幕上可见的全部画面：摄像头 + 背景动画 + 前景动画） ----------
  function compositeScreenshot() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(window.innerWidth * dpr);
    const H = Math.round(window.innerHeight * dpr);
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // 按 CSS object-fit 的规则把视频层画进画布（与屏幕显示一致）
    // mirror 仅用于摄像头（自拍镜像），动画层保持原始方向
    const drawLayer = (video, fit, mirror) => {
      if (!video || !video.videoWidth || video.readyState < 2) return;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const s = fit === 'cover'
        ? Math.max(W / vw, H / vh)
        : Math.min(W / vw, H / vh);
      const dw = vw * s;
      const dh = vh * s;
      const dx = (W - dw) / 2;
      const dy = (H - dh) / 2;
      ctx.save();
      if (mirror) {
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, dx, dy, dw, dh);
      ctx.restore();
    };

    drawLayer(cam, 'cover', true);      // 摄像头：cover 全屏 + 镜像
    drawLayer(animBg, 'contain', false); // 背景动画 3：contain 叠加
    drawLayer(anim, 'contain', false);   // 前景动画 2 的最后一帧：contain 叠加
    return canvas.toDataURL('image/png');
  }

  // ---------- 截图 ----------
  async function capture() {
    if (state !== 'countdown') return; // 防止重复触发
    state = 'result';
    phase = 'result';
    clearTimeout(countdownTimer);
    countdownEl.classList.add('hidden');

    flash.classList.remove('on');
    void flash.offsetWidth;
    flash.classList.add('on');

    const dataUrl = compositeScreenshot(); // 先合成画面（此时动画 2 停在最后一帧）
    stopFg(); // 前景 1/2 停掉，背景动画 3 保持不变继续播放

    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'save failed');
      resultPhoto.src = dataUrl;
      qrImg.src = data.qr;
      resultEl.classList.remove('hidden');
      startRing(); // 剩余时间环开始耗尽
    } catch (e) {
      console.error(e);
      backToIdle();
      return;
    }
    resultTimer = setTimeout(backToIdle, RESULT_SECONDS * 1000); // QR 显示 25 秒
  }

  // ---------- QR 剩余时间环 ----------
  function startRing() {
    ringStart = performance.now();
    qrTimerBar.style.strokeDasharray = String(RING_C);
    qrTimerBar.style.strokeDashoffset = '0';
    requestAnimationFrame(tickRing);
  }

  function tickRing(now) {
    if (state !== 'result') return; // 离开结果页即停止
    const frac = Math.min((now - ringStart) / 1000 / RESULT_SECONDS, 1);
    qrTimerBar.style.strokeDashoffset = String(RING_C * frac);
    if (frac < 1) requestAnimationFrame(tickRing);
  }

  function backToIdle() {
    clearTimeout(resultTimer);
    resultEl.classList.add('hidden');
    state = 'idle';
    playIdle(); // 随机起点重新进入 idle
  }

  // ---------- 事件 ----------
  window.addEventListener('keydown', e => {
    // Enter 或空格（USB 按钮实测为空格键）均可触发
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      trigger();
    }
  });
  window.addEventListener('click', trigger);

  // ---------- 启动 ----------
  (async function start() {
    initCamera();
    try {
      const res = await fetch('/api/config');
      const cfg = await res.json();
      idleList = cfg.idle || [];
      splitCountdown(cfg.countdown || []);
    } catch (e) {
      console.warn('config load failed', e);
    }
    playIdle();
  })();
})();
