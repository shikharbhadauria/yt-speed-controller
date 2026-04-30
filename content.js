(() => {
    "use strict";

    // ─── Config ────────────────────────────────────────────────────────────────
    const PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4];
    const NUDGE = 0.25;
    const SLIDER_STEP = 0.05;
    const TRIGGER_ID = "ytsp-trigger";
    const POPUP_ID = "ytsp-popup";

    // ─── State ─────────────────────────────────────────────────────────────────
    let currentSpeed = 1;

    // ─── Helpers ───────────────────────────────────────────────────────────────
    function getVideo() {
        return (
            document.querySelector("video.html5-main-video") ||
            document.querySelector("video")
        );
    }

    function getRightControls() {
        return document.querySelector(".ytp-right-controls");
    }

    function fmt(s) {
        return parseFloat(s.toFixed(2)) + "x";
    }

    // ─── Speed control ─────────────────────────────────────────────────────────
    function setSpeed(speed) {
        speed = Math.max(0.1, Math.min(16, +speed.toFixed(2)));
        const video = getVideo();
        if (video) {
            video.playbackRate = speed;
            currentSpeed = speed;
            refreshWidget();
        }
    }

    function nudgeSpeed(delta) {
        setSpeed(currentSpeed + delta);
    }

    // ─── Build UI ──────────────────────────────────────────────────────────────
    function buildTrigger() {
        const btn = document.createElement("button");
        btn.id = TRIGGER_ID;
        btn.className = "ytp-button";
        btn.title = "Playback speed";
        btn.setAttribute("aria-label", "Playback speed");

        const badge = document.createElement("span");
        badge.className = "ytsp-badge";
        badge.textContent = fmt(currentSpeed);
        btn.appendChild(badge);

        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            togglePopup();
        });

        return btn;
    }

    function buildPopup() {
        const popup = document.createElement("div");
        popup.id = POPUP_ID;

        // ── Header
        const header = document.createElement("div");
        header.className = "ytsp-header";

        const title = document.createElement("span");
        title.className = "ytsp-title";
        title.textContent = "Playback speed";

        const closeBtn = document.createElement("button");
        closeBtn.className = "ytsp-close";
        closeBtn.textContent = "✕";
        closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            closePopup();
        });

        header.appendChild(title);
        header.appendChild(closeBtn);

        // ── Speed display
        const display = document.createElement("div");
        display.className = "ytsp-display";
        display.textContent = fmt(currentSpeed);

        // ── Slider row
        const sliderRow = document.createElement("div");
        sliderRow.className = "ytsp-slider-row";

        const minusBtn = document.createElement("button");
        minusBtn.className = "ytsp-step-btn";
        minusBtn.textContent = "−";
        minusBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            setSpeed(currentSpeed - SLIDER_STEP);
        });

        const slider = document.createElement("input");
        slider.type = "range";
        slider.className = "ytsp-slider";
        slider.min = "0.25";
        slider.max = "4";
        slider.step = String(SLIDER_STEP);
        slider.value = String(Math.min(4, Math.max(0.25, currentSpeed)));
        slider.addEventListener("input", (e) => {
            e.stopPropagation();
            setSpeed(parseFloat(e.target.value));
        });

        const plusBtn = document.createElement("button");
        plusBtn.className = "ytsp-step-btn";
        plusBtn.textContent = "+";
        plusBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            setSpeed(currentSpeed + SLIDER_STEP);
        });

        sliderRow.appendChild(minusBtn);
        sliderRow.appendChild(slider);
        sliderRow.appendChild(plusBtn);

        // ── Preset pills
        const presets = document.createElement("div");
        presets.className = "ytsp-presets";

        PRESETS.forEach((s) => {
            const btn = document.createElement("button");
            btn.className = "ytsp-preset" + (s === currentSpeed ? " ytsp-active" : "");
            btn.dataset.speed = s;

            const top = document.createElement("span");
            top.textContent = s === 1 ? "1.0" : String(s);
            btn.appendChild(top);

            if (s === 1) {
                const sub = document.createElement("small");
                sub.textContent = "Normal";
                btn.appendChild(sub);
            }

            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                setSpeed(s);
            });

            presets.appendChild(btn);
        });

        popup.appendChild(header);
        popup.appendChild(display);
        popup.appendChild(sliderRow);
        popup.appendChild(presets);
        return popup;
    }

    // ─── Slider fill ───────────────────────────────────────────────────────────
    function updateSliderFill(slider) {
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        const pct = ((Math.min(max, Math.max(min, currentSpeed)) - min) / (max - min)) * 100;
        slider.style.background = `linear-gradient(to right,#ff4444 ${pct}%,rgba(255,255,255,0.2) ${pct}%)`;
    }

    // ─── Popup open / close ────────────────────────────────────────────────────
    function openPopup() {
        const popup = document.getElementById(POPUP_ID);
        const trigger = document.getElementById(TRIGGER_ID);
        if (!popup || !trigger) return;

        const r = trigger.getBoundingClientRect();
        popup.style.bottom = window.innerHeight - r.top + 16 + "px";
        popup.style.right = window.innerWidth - r.right + "px";

        popup.classList.add("ytsp-open");

        // Sync slider fill on open
        const slider = popup.querySelector(".ytsp-slider");
        if (slider) updateSliderFill(slider);

        setTimeout(() => {
            document.addEventListener("click", handleOutsideClick, { capture: true });
        }, 0);
    }

    function closePopup() {
        document.getElementById(POPUP_ID)?.classList.remove("ytsp-open");
        document.removeEventListener("click", handleOutsideClick, { capture: true });
    }

    function togglePopup() {
        const popup = document.getElementById(POPUP_ID);
        if (!popup) return;
        popup.classList.contains("ytsp-open") ? closePopup() : openPopup();
    }

    function handleOutsideClick(e) {
        if (
            !e.target.closest("#" + POPUP_ID) &&
            !e.target.closest("#" + TRIGGER_ID)
        ) {
            closePopup();
        }
    }

    // ─── Refresh ───────────────────────────────────────────────────────────────
    function refreshWidget() {
        const badge = document.querySelector("#" + TRIGGER_ID + " .ytsp-badge");
        if (badge) badge.textContent = fmt(currentSpeed);

        const display = document.querySelector("#" + POPUP_ID + " .ytsp-display");
        if (display) display.textContent = fmt(currentSpeed);

        const slider = document.querySelector("#" + POPUP_ID + " .ytsp-slider");
        if (slider) {
            slider.value = String(Math.min(4, Math.max(0.25, currentSpeed)));
            updateSliderFill(slider);
        }

        document.querySelectorAll("#" + POPUP_ID + " .ytsp-preset").forEach((btn) => {
            btn.classList.toggle("ytsp-active", parseFloat(btn.dataset.speed) === currentSpeed);
        });
    }

    // ─── Inject / remove ───────────────────────────────────────────────────────
    function injectWidget() {
        if (document.getElementById(TRIGGER_ID)) return;

        const rightControls = getRightControls();
        if (!rightControls) return;

        const video = getVideo();
        if (video) currentSpeed = video.playbackRate || 1;

        rightControls.insertBefore(buildTrigger(), rightControls.firstChild);
        document.body.appendChild(buildPopup());

        if (video) {
            video.addEventListener("ratechange", () => {
                currentSpeed = video.playbackRate;
                refreshWidget();
            });
        }
    }

    function removeWidget() {
        closePopup();
        document.getElementById(TRIGGER_ID)?.remove();
        document.getElementById(POPUP_ID)?.remove();
    }

    // ─── Keyboard shortcuts ────────────────────────────────────────────────────
    // > or ] → speed up | < or [ → slow down | \ → reset to 1×
    document.addEventListener(
        "keydown",
        (e) => {
            const tag = document.activeElement?.tagName?.toLowerCase();
            if (
                tag === "input" ||
                tag === "textarea" ||
                document.activeElement?.isContentEditable
            )
                return;

            if (e.key === ">" || e.key === "]") {
                e.preventDefault();
                nudgeSpeed(+NUDGE);
            } else if (e.key === "<" || e.key === "[") {
                e.preventDefault();
                nudgeSpeed(-NUDGE);
            } else if (e.key === "\\") {
                e.preventDefault();
                setSpeed(1);
            }
        },
        true,
    );

    // ─── SPA navigation ────────────────────────────────────────────────────────
    let retryTimer = null;

    function tryInject() {
        if (document.getElementById(TRIGGER_ID)) return;
        if (getRightControls()) {
            injectWidget();
        } else {
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = setTimeout(tryInject, 300);
        }
    }

    window.addEventListener("yt-navigate-finish", () => {
        removeWidget();
        retryTimer = setTimeout(tryInject, 500);
    });

    const observer = new MutationObserver(() => {
        if (!document.getElementById(TRIGGER_ID) && getRightControls()) {
            tryInject();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", tryInject);
    } else {
        tryInject();
    }
})();
