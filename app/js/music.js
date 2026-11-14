/* 音乐（issue #3「Telegram Music」，2026-10-26）：整首下下来、做成 blob: 地址交给 <audio>。
 * 为什么不边下边放：电视自己的播放器放网上的 MP4 会出错（video.src，见 CLAUDE.md「archive.org 规则」），而 deploy.sh --music 在电视上
 * 量过：MP3 / M4A / Opus / WAV 做成 blob 给 <audio> 都放得了、跳得动（下载完 0.5 秒出声）。一首 MP3 几 MB，按 Telegram ~2MB/s
 * 几秒；放着这首就把下一首下好，切歌不用等。内存里最多留 3 首（这首、下一首、上一首）。
 * FLAC 电视解不了（<audio>、MP4、MSE 都试过），app 下的时候交给 flac.js 边下边解成 WAV（stage "decode" 是在等它解完）。
 * 别的放起来不报错、一直不走的，12 秒不走就当放不了，3 秒后放下一首。
 *
 * 有些电视的 <audio> 不认 blob:（或者 blob 里没有文件名时嗅探不出来），视频那边却放得了。所以一首歌放不了时按顺序换
 * 四种放法再放弃：<audio> + blob → <audio> + data: → 隐藏的 <video> + blob → <video> + data:。每次换法都写进诊断日志，
 * 屏幕上是最后那句原话（audio error 4 … canPlayType=…），用户照着念就能知道这台电视卡在哪一步。
 *
 *   var m = Music.create(audio元素, { report, onState(phase, info), load(item, onProgress(got, total, stage), signal) → Promise<Blob> })
 *   m.play(list, i)   从 list 的第 i 首放起，放完一首接下一首
 *   m.next() / m.prev() / m.toggle() / m.seek(秒) / m.stop()
 *   m.current() / m.index() / m.list() / m.time() / m.duration() / m.paused()
 *   onState："track" {item, index}（换了一首）、"loading" {got, total, stage}、"playing"、"paused"、"error" {msg}、"done"（整串放完）
 */
var Music = (function () {
    "use strict";
    var tx = typeof I18n !== "undefined" ? I18n.t : function (s) { var a = arguments; return String(s).replace(/\{(\d)\}/g, function (m, i) { return a[+i + 1]; }); };
    var MIME = { mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", flac: "audio/flac", ogg: "audio/ogg", oga: "audio/ogg", opus: "audio/ogg", wav: "audio/wav" };
    var KEEP = 3, STUCK_MS = 12000, SKIP_MS = 3000, MAX_FAILS = 5, DATA_MAX = 32 * 1048576;

    function errStr(e) { return (e && (e.message || e.name)) || String(e); }
    function mb(n) { return (n / 1048576).toFixed(1) + "MB"; }

    /* blob → data: 地址。有的电视的媒体元素不认 blob:（没有文件名、嗅探不出格式），data: 带 MIME 头就认。
     * 大文件不转：data: 是 base64，字符串比文件大三分之一，老电视的内存吃不消。 */
    function toDataUrl(blob) {
        return new Promise(function (res, rej) {
            try {
                var fr = new FileReader();
                fr.onload = function () { res(String(fr.result)); };
                fr.onerror = function () { rej(fr.error || new Error("FileReader")); };
                fr.readAsDataURL(blob);
            } catch (e) { rej(e); }
        });
    }

    function create(audio, o) {
        var R = function (s) { if (o.report) { o.report(s); } };
        var list = [], idx = -1, token = 0, cache = {}, order = [], fails = 0, watch = 0, skip = 0, pre = 0;
        var el = audio, alt = null, errStep = null;

        function mimeOf(it) { return it.mime || MIME[it.ext] || "audio/mpeg"; }

        /* 下载（同一首正在下就等它）。缓存按最近用过留 KEEP 首，挤出去的放掉 blob 地址 */
        function fetchTrack(it, onProgress) {
            var k = it.fileKey, c = cache[k];
            touch(k);
            if (c) {
                c.onProgress = onProgress;
                return c.url ? Promise.resolve({ url: c.url, blob: c.blob }) : c.p;
            }
            var ctl = new AbortController(), t0 = performance.now();
            c = cache[k] = { ctl: ctl, onProgress: onProgress, url: "", blob: null };
            c.p = o.load(it, function (got, total, stage) { if (c.onProgress) { c.onProgress(got, total, stage); } }, ctl.signal).then(function (blob) {
                if (!blob.type) { blob = new Blob([blob], { type: mimeOf(it) }); }
                c.blob = blob;
                c.url = URL.createObjectURL(blob);
                c.p = null;
                R("下载完 " + mb(blob.size) + " " + Math.round(performance.now() - t0) + "ms（" + (it.ext || it.mime) + "）");
                return { url: c.url, blob: blob };
            }, function (e) {
                if (cache[k] === c) { delete cache[k]; }
                throw e;
            });
            return c.p;
        }
        function touch(k) {
            order = order.filter(function (x) { return x !== k; });
            order.push(k);
            while (order.length > KEEP) { drop(order.shift()); }
        }
        function drop(k) {
            var c = cache[k];
            if (!c) { return; }
            delete cache[k];
            if (c.url) { URL.revokeObjectURL(c.url); } else { try { c.ctl.abort(); } catch (e) {} }
        }

        /* 隐藏的 <video>：视频这条路在这台电视上一定是通的（视频都放得了），<audio> 不行的时候拿它当退路。 */
        function useAlt() {
            if (!alt) {
                alt = document.createElement("video");
                alt.setAttribute("playsinline", "");
                alt.style.cssText = "position:absolute;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none";
                document.body.appendChild(alt);
                bind(alt);
            }
            if (el !== alt) {
                try { el.pause(); } catch (e) {}
                el.oncanplay = null;
                el = alt;
            }
        }
        function resetEl() {
            try { audio.pause(); } catch (e) {}
            if (alt) { try { alt.pause(); } catch (e) {} }
            audio.oncanplay = null;
            if (alt) { alt.oncanplay = null; }
            el = audio;
            errStep = null;
        }
        function stopEl() {
            try { el.pause(); } catch (e) {}
            el.oncanplay = null;
        }

        function bind(m) {
            m.addEventListener("playing", function (e) {
                if (e.target !== el) { return; }
                fails = 0;
                o.onState("playing");
                /* 放起来 3 秒后下下一首 */
                clearTimeout(pre);
                var my = token;
                pre = setTimeout(function () {
                    if (my === token && list[idx + 1]) { fetchTrack(list[idx + 1]).catch(function (e) { R("预先下一首出错：" + errStr(e)); }); }
                }, 3000);
            });
            m.addEventListener("pause", function (e) { if (e.target === el && !el.ended && idx >= 0 && el.src) { o.onState("paused"); } });
            m.addEventListener("ended", function (e) {
                if (e.target !== el) { return; }
                if (idx + 1 < list.length) { start(idx + 1); }
                else { R("一串放完了（" + list.length + " 首）"); o.onState("done"); }
            });
            m.addEventListener("error", function (e) {
                if (e.target !== el || !el.getAttribute("src")) { return; }
                var er = el.error;
                /* 2026-10-28 Tizen 6.0 上一首 FLAC 解成 50 MB 的 WAV 报 Format error，放成过的 WAV 都在 16 MB 以下：分不开「不认 WAV」和「太大」 */
                var it = list[idx] || {}, mime = it.ext === "flac" ? "audio/wav" : mimeOf(it);
                var msg = "audio error " + (er ? er.code + (er.message ? " " + er.message : "") : "?") +
                          "（" + mime + " canPlayType=" + (el.canPlayType(mime) || "空") + "）";
                R(msg);
                if (errStep) { errStep(msg); }
            });
        }
        bind(audio);

        function start(i) {
            var my = ++token, it = list[i];
            idx = i;
            clearInterval(watch);
            clearTimeout(skip);
            clearTimeout(pre);
            resetEl();
            /* 切得快的时候，别的歌还在下的就停掉（这首和下一首除外） */
            Object.keys(cache).forEach(function (k) {
                if (!cache[k].url && k !== it.fileKey && !(list[i + 1] && k === list[i + 1].fileKey)) { drop(k); order = order.filter(function (x) { return x !== k; }); }
            });
            o.onState("track", { item: it, index: i });
            o.onState("loading", { got: 0, total: it.size });
            fetchTrack(it, function (got, total, stage) { if (my === token) { o.onState("loading", { got: got, total: total, stage: stage }); } }).then(function (r) {
                if (my !== token) { return; }
                var blob = r.blob, url = r.url, tries = [], step = 0, dataP = null, retried = false, blocked = false, started = false, failing = false;
                /* 换着放：先照老样子（blob 给 <audio>），不行再换 data:、换 <video>。大文件不试 data: */
                var steps = [{ src: "blob", el: "audio" }, { src: "data", el: "audio" }, { src: "blob", el: "video" }, { src: "data", el: "video" }];
                if (blob.size > DATA_MAX || typeof FileReader === "undefined") {
                    steps = steps.filter(function (s) { return s.src !== "data"; });
                }

                function dataUrl() {
                    if (!dataP) { dataP = toDataUrl(blob); }
                    return dataP;
                }
                function attempt() {
                    if (my !== token || started) { return; }
                    started = true;
                    var p = el.play();
                    if (p && p.catch) {
                        p.catch(function (e) {
                            started = false;
                            if (my !== token || (e && e.name === "AbortError")) { return; }
                            /* 浏览器/电视要求用户按一下才出声：不当作放不了，等确认键 */
                            if (e && e.name === "NotAllowedError") { blocked = true; o.onState("blocked", {}); return; }
                            R("play() " + errStr(e) + "，等 canplay 再试");
                        });
                    }
                }
                function nextStep(why) {
                    if (my !== token) { return; }
                    clearInterval(watch);
                    if (why) { tries.push(why); R("这一步放不了：" + why); }
                    errStep = null;
                    stopEl();
                    retried = false;
                    run();
                }
                function run() {
                    if (my !== token) { return; }
                    if (step >= steps.length) {
                        errStep = null;
                        fail(my, tries.join(" · ") || tx("{0} 秒没放起来", STUCK_MS / 1000));
                        return;
                    }
                    var n = step++, st = steps[n];
                    if (st.el === "video") { useAlt(); }
                    var srcP = st.src === "blob" ? Promise.resolve(url) : dataUrl();
                    srcP.then(function (u) {
                        if (my !== token) { return; }
                        el.src = u;
                        el.muted = false;
                        if (!el.volume) { el.volume = 1; }
                        /* 电视上给 <audio> 换了 blob 地址后，有的引擎要 load() 一下才认；先 load 再等 canplay 播 */
                        try { el.load(); } catch (e) {}
                        started = false;
                        blocked = false;
                        failing = false;
                        errStep = function (msg) { if (my === token && !failing) { failing = true; nextStep(msg); } };
                        el.oncanplay = attempt;
                        attempt();
                        /* 放不起来也不报错的（FLAC）：播放头不动就先 load+play 重试一次，再不行换下一种放法 */
                        var limit = n === 0 ? STUCK_MS : 6000, t0 = Date.now();
                        clearInterval(watch);
                        watch = setInterval(function tick() {
                            if (my !== token) { clearInterval(watch); return; }
                            if (el.currentTime > 0.3) { clearInterval(watch); return; }
                            if (blocked) { clearInterval(watch); return; }
                            if (Date.now() - t0 <= limit) { return; }
                            clearInterval(watch);
                            if (n === 0 && !retried) {
                                retried = true;
                                R("音乐 12 秒没放起来，load()+play() 重试一次");
                                try { el.load(); } catch (e) {}
                                started = false;
                                attempt();
                                t0 = Date.now();
                                watch = setInterval(tick, 500);
                                return;
                            }
                            nextStep("(" + st.el + " " + st.src + ") " + tx("{0} 秒没放起来", limit / 1000));
                        }, 500);
                    }, function (e) {
                        if (my !== token) { return; }
                        nextStep("(" + st.el + " " + st.src + ") " + errStr(e));
                    });
                }
                run();
            }, function (e) {
                if (my !== token || e.name === "AbortError") { return; }
                if (e.known) { fail(my, e.message, true); return; }      // 电视解不了的编码（ALAC），app 下的时候看出来的
                fail(my, tx("下载出错：{0}", errStr(e)));
            });
        }

        function fail(my, msg, known) {
            if (my !== token) { return; }
            errStep = null;
            fails++;
            R("放不了（第 " + (idx + 1) + "/" + list.length + " 首，" + (list[idx].ext || list[idx].mime) + "）：" + msg);
            o.onState("error", { msg: msg, known: !!known });
            /* 3 秒后放下一首；连着 5 首都放不了就停（一整串 FLAC 别一直跳） */
            if (idx + 1 < list.length && fails < MAX_FAILS) { skip = setTimeout(function () { if (my === token) { start(idx + 1); } }, SKIP_MS); }
        }

        var api = {};
        api.play = function (l, i) { list = l.slice(); fails = 0; start(i); };
        api.next = function () { if (idx + 1 < list.length) { start(idx + 1); return true; } return false; };
        /* 上一首：这首放了 5 秒以上先回到开头（和手机上的播放器一样） */
        api.prev = function () {
            if (el.currentTime > 5) { el.currentTime = 0; return true; }
            if (idx > 0) { start(idx - 1); return true; }
            return false;
        };
        api.toggle = function () {
            if (!el.getAttribute("src")) { return false; }
            if (el.paused) {
                var p = el.play();
                if (p && p.catch) { p.catch(function (e) { if (e && e.name !== "AbortError") { R("toggle play() " + errStr(e)); } }); }
            } else { el.pause(); }
            return !el.paused;
        };
        api.seek = function (sec) {
            if (!el.getAttribute("src") || !isFinite(el.duration)) { return; }
            el.currentTime = Math.max(0, Math.min(sec, el.duration - 0.5));
        };
        api.stop = function () {
            token++;
            clearInterval(watch);
            clearTimeout(skip);
            clearTimeout(pre);
            resetEl();
            audio.removeAttribute("src");
            try { audio.load(); } catch (e) {}
            if (alt) { alt.removeAttribute("src"); try { alt.load(); } catch (e) {} }
            Object.keys(cache).forEach(drop);
            order = [];
            list = [];
            idx = -1;
        };
        api.current = function () { return idx >= 0 ? list[idx] : null; };
        api.index = function () { return idx; };
        api.list = function () { return list; };
        api.time = function () { return el.currentTime || 0; };
        api.duration = function () { return isFinite(el.duration) ? el.duration : 0; };
        api.paused = function () { return el.paused; };
        return api;
    }

    return { create: create };
})();
