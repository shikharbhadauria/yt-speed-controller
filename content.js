(() => {
    "use strict";

    // ─── Config ────────────────────────────────────────────────────────────────
    const PRESETS = [0.5, 1, 1.25, 1.5, 2, 3];
    const NUDGE = 0.25;
    const SLIDER_STEP = 0.05;
    const SLIDER_MIN = 0.25;
    const SLIDER_MAX = 16;

    // ─── Log-scale helpers ─────────────────────────────────────────────────────
    // Map speed → 0-1000 integer for the range input
    function speedToSlider(speed) {
        const clamped = Math.max(SLIDER_MIN, Math.min(SLIDER_MAX, speed));
        return Math.round(
            ((Math.log(clamped) - Math.log(SLIDER_MIN)) /
                (Math.log(SLIDER_MAX) - Math.log(SLIDER_MIN))) *
                1000,
        );
    }

    // Map 0-1000 integer back to speed
    function sliderToSpeed(value) {
        return parseFloat(
            Math.exp(
                Math.log(SLIDER_MIN) +
                    (value / 1000) *
                        (Math.log(SLIDER_MAX) - Math.log(SLIDER_MIN)),
            ).toFixed(2),
        );
    }
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
        return s.toFixed(2) + "x";
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
        btn.title = "Playback Speed";
        btn.setAttribute("aria-label", "Playback Speed");

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

        // ── Our header (not in YouTube's DOM — needed for standalone popup)
        const header = document.createElement("div");
        header.className = "ytsp-header";

        const title = document.createElement("span");
        title.className = "ytsp-title";
        title.textContent = "Playback Speed";

        header.appendChild(title);

        // ── YouTube's exact panel structure — styled by YouTube's own stylesheet
        const content = document.createElement("div");
        content.className = "ytp-variable-speed-panel-content";

        // Speed display
        const displayContainer = document.createElement("div");
        displayContainer.className = "ytp-speed-display-container";
        const displayInner = document.createElement("div");
        displayInner.className = "ytp-variable-speed-panel-display";
        displayInner.setAttribute("aria-live", "polite");
        const displaySpan = document.createElement("span");
        displaySpan.textContent = fmt(currentSpeed);
        displayInner.appendChild(displaySpan);
        displayContainer.appendChild(displayInner);

        // Slider container
        const sliderContainer = document.createElement("div");
        sliderContainer.className = "ytp-variable-speed-panel-slider-container";

        const minusBtn = document.createElement("button");
        minusBtn.className =
            "ytp-button ytp-variable-speed-panel-button ytp-variable-speed-panel-increment-button";
        minusBtn.setAttribute("aria-label", "Decrease playback speed 0.05");
        minusBtn.innerHTML = "<span>-</span>";
        minusBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            setSpeed(currentSpeed - SLIDER_STEP);
        });

        const sliderSection = document.createElement("div");
        sliderSection.className = "ytp-input-slider-section";

        const slider = document.createElement("input");
        slider.className =
            "ytp-input-slider ytp-speedslider ytp-varispeed-input-slider";
        slider.type = "range";
        slider.setAttribute("role", "slider");
        slider.min = "0";
        slider.max = "1000";
        slider.step = "1";
        slider.value = String(speedToSlider(currentSpeed));
        slider.setAttribute("aria-valuemin", String(SLIDER_MIN));
        slider.setAttribute("aria-valuemax", String(SLIDER_MAX));
        slider.setAttribute("aria-valuenow", String(currentSpeed));
        slider.addEventListener("input", (e) => {
            e.stopPropagation();
            setSpeed(sliderToSpeed(parseFloat(e.target.value)));
        });

        sliderSection.appendChild(slider);

        const plusBtn = document.createElement("button");
        plusBtn.className =
            "ytp-button ytp-variable-speed-panel-button ytp-variable-speed-panel-increment-button";
        plusBtn.setAttribute("aria-label", "Increase playback speed 0.05");
        plusBtn.innerHTML = "<span>+</span>";
        plusBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            setSpeed(currentSpeed + SLIDER_STEP);
        });

        sliderContainer.appendChild(minusBtn);
        sliderContainer.appendChild(sliderSection);
        sliderContainer.appendChild(plusBtn);

        // Chips (presets) — matches ytp-variable-speed-panel-chips structure
        const chips = document.createElement("div");
        chips.className = "ytp-variable-speed-panel-chips";

        PRESETS.forEach((s) => {
            const wrapper = document.createElement("div");
            wrapper.className =
                "ytp-variable-speed-panel-preset-button-wrapper";

            const btn = document.createElement("button");
            btn.className =
                "ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button" +
                (s === currentSpeed ? " ytsp-active" : "");
            btn.dataset.speed = s;
            const span = document.createElement("span");
            span.textContent = s === 1 ? "1.0" : String(s);
            btn.appendChild(span);
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                setSpeed(s);
            });

            wrapper.appendChild(btn);

            if (s === 1) {
                const label = document.createElement("div");
                label.className =
                    "ytp-variable-speed-panel-preset-button-label-text";
                label.textContent = "Normal";
                wrapper.appendChild(label);
            }

            chips.appendChild(wrapper);
        });

        content.appendChild(displayContainer);
        content.appendChild(sliderContainer);
        content.appendChild(chips);

        popup.appendChild(header);
        popup.appendChild(content);
        return popup;
    }

    // ─── Slider fill ───────────────────────────────────────────────────────────
    function updateSliderFill(slider) {
        const pct = speedToSlider(currentSpeed) / 10; // 0-1000 → 0-100%
        slider.style.setProperty("--yt-slider-shape-gradient-percent", pct + "%");
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
        const slider = popup.querySelector(".ytp-speedslider");
        if (slider) updateSliderFill(slider);

        setTimeout(() => {
            document.addEventListener("click", handleOutsideClick, {
                capture: true,
            });
        }, 0);
    }

    function closePopup() {
        document.getElementById(POPUP_ID)?.classList.remove("ytsp-open");
        document.removeEventListener("click", handleOutsideClick, {
            capture: true,
        });
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

        const display = document.querySelector(
            "#" + POPUP_ID + " .ytp-variable-speed-panel-display span",
        );
        if (display) display.textContent = fmt(currentSpeed);

        const slider = document.querySelector(
            "#" + POPUP_ID + " .ytp-speedslider",
        );
        if (slider) {
            slider.value = String(speedToSlider(currentSpeed));
            slider.setAttribute("aria-valuenow", String(currentSpeed));
            updateSliderFill(slider);
        }

        document
            .querySelectorAll(
                "#" + POPUP_ID + " .ytp-variable-speed-panel-preset-button",
            )
            .forEach((btn) => {
                btn.classList.toggle(
                    "ytsp-active",
                    parseFloat(btn.dataset.speed) === currentSpeed,
                );
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
