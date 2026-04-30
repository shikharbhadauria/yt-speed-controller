(() => {
    "use strict";

    // ─── Config ────────────────────────────────────────────────────────────────
    const SPEEDS = [
        0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75,
        4,
    ];
    const NUDGE = 0.25;
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

    function formatSpeed(s) {
        return s + "x";
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
        badge.textContent = formatSpeed(currentSpeed);
        btn.appendChild(badge);

        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            togglePopup();
        });

        return btn;
    }

    function buildPopup() {
        // No YouTube classes on the container — YouTube's JS hides/controls those.
        // Appended to document.body with position:fixed so nothing clips it.
        const popup = document.createElement("div");
        popup.id = POPUP_ID;

        const menu = document.createElement("div");
        menu.className = "ytp-panel-menu";
        menu.setAttribute("role", "menu");

        SPEEDS.forEach((s) => {
            const item = document.createElement("div");
            item.className = "ytp-menuitem";
            item.setAttribute("role", "menuitemradio");
            item.setAttribute("aria-checked", String(s === currentSpeed));
            item.dataset.speed = s;
            item.tabIndex = 0;

            const label = document.createElement("div");
            label.className = "ytp-menuitem-label";
            label.textContent = s;

            item.appendChild(label);

            item.addEventListener("click", (e) => {
                e.stopPropagation();
                setSpeed(s);
                closePopup();
            });

            menu.appendChild(item);
        });

        popup.appendChild(menu);
        return popup;
    }

    // ─── Popup open / close ────────────────────────────────────────────────────
    function openPopup() {
        const popup = document.getElementById(POPUP_ID);
        const trigger = document.getElementById(TRIGGER_ID);
        if (!popup || !trigger) return;

        // Use viewport-relative fixed positioning so parent overflow can't clip us
        const r = trigger.getBoundingClientRect();
        popup.style.bottom = window.innerHeight - r.top + 16 + "px";
        popup.style.right = window.innerWidth - r.right + "px";

        popup.classList.add("ytsp-open");
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
        if (popup.classList.contains("ytsp-open")) {
            closePopup();
        } else {
            openPopup();
        }
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
        if (badge) badge.textContent = formatSpeed(currentSpeed);

        document
            .querySelectorAll("#" + POPUP_ID + " .ytp-menuitem")
            .forEach((item) => {
                item.setAttribute(
                    "aria-checked",
                    String(parseFloat(item.dataset.speed) === currentSpeed),
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
        document.body.appendChild(buildPopup()); // body, not player

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
