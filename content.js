(() => {
    "use strict";

    // ─── Config ────────────────────────────────────────────────────────────────
    const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4];
    const NUDGE = 0.25; // amount to change speed with keyboard shortcut
    const WIDGET_ID = "ytsp-widget";

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

    // ─── Widget ────────────────────────────────────────────────────────────────
    function buildWidget() {
        const widget = document.createElement("div");
        widget.id = WIDGET_ID;
        widget.setAttribute("data-speed", currentSpeed);

        // Label showing active speed (always visible)
        const label = document.createElement("span");
        label.className = "ytsp-label";
        label.textContent = formatSpeed(currentSpeed);
        widget.appendChild(label);

        // Buttons row (visible on hover via CSS)
        const buttons = document.createElement("div");
        buttons.className = "ytsp-buttons";

        SPEEDS.forEach((s) => {
            const btn = document.createElement("button");
            btn.className = "ytsp-btn";
            btn.textContent = formatSpeed(s);
            btn.dataset.speed = s;
            if (s === currentSpeed) btn.classList.add("active");
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                setSpeed(s);
            });
            buttons.appendChild(btn);
        });

        widget.appendChild(buttons);
        return widget;
    }

    function formatSpeed(s) {
        // "1" → "1×", "1.5" → "1.5×", "3.25" → "3.25×"
        return (Number.isInteger(s) ? s : s) + "×";
    }

    function refreshWidget() {
        const widget = document.getElementById(WIDGET_ID);
        if (!widget) return;

        // Update label
        const label = widget.querySelector(".ytsp-label");
        if (label) label.textContent = formatSpeed(currentSpeed);

        // Update active button
        widget.querySelectorAll(".ytsp-btn").forEach((btn) => {
            btn.classList.toggle(
                "active",
                parseFloat(btn.dataset.speed) === currentSpeed,
            );
        });
    }

    function injectWidget() {
        // Already injected?
        if (document.getElementById(WIDGET_ID)) return;

        const rightControls = getRightControls();
        if (!rightControls) return;

        // Sync current speed from the video element
        const video = getVideo();
        if (video) currentSpeed = video.playbackRate || 1;

        const widget = buildWidget();

        // Insert as the FIRST child of right controls (leftmost item on right side)
        rightControls.insertBefore(widget, rightControls.firstChild);

        // Listen for external speed changes (e.g. YouTube's own menu)
        if (video) {
            video.addEventListener("ratechange", () => {
                currentSpeed = video.playbackRate;
                refreshWidget();
            });
        }
    }

    function removeWidget() {
        document.getElementById(WIDGET_ID)?.remove();
    }

    // ─── Keyboard shortcuts ────────────────────────────────────────────────────
    // > or ] → speed up | < or [ → slow down | \ or 0 → reset 1×
    document.addEventListener(
        "keydown",
        (e) => {
            // Don't fire if user is typing in an input / textarea
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
            } else if (
                e.key === "\\" ||
                (e.key === "0" && !e.ctrlKey && !e.metaKey)
            ) {
                // \ resets to 1× (avoid overriding Ctrl+0)
                if (e.key === "\\") {
                    e.preventDefault();
                    setSpeed(1);
                }
            }
        },
        true,
    );

    // ─── Observer — re-inject after YouTube SPA navigation ────────────────────
    let retryTimer = null;

    function tryInject() {
        if (document.getElementById(WIDGET_ID)) return; // already there
        if (getRightControls()) {
            injectWidget();
        } else {
            // Player not ready yet — retry
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = setTimeout(tryInject, 300);
        }
    }

    // YouTube fires this on every SPA page transition
    window.addEventListener("yt-navigate-finish", () => {
        removeWidget();
        retryTimer = setTimeout(tryInject, 500);
    });

    // Also observe DOM in case the player mounts after page load
    const observer = new MutationObserver(() => {
        if (!document.getElementById(WIDGET_ID) && getRightControls()) {
            tryInject();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Initial inject on page load
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", tryInject);
    } else {
        tryInject();
    }
})();
