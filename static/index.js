const SECOND = 1000;
const MESSAGE_CONNECTION_ERROR = "Unable to reach the clicker. It seems out of interweb range…";
const MESSAGE_LISTEN_DISCONNECT = "Lost connection to The Clickrnet™ ૮ ⚆ﻌ⚆ა";

const idInputElement = document.querySelector("#id-input");
const listenKeyInfoElement = document.querySelector("#listen-info var");
const listenStateInfoElement = document.querySelector("#listen-info .state");
const listenButtonElement = document.querySelector("button.listen");
const errorMessageElement = document.querySelector("#action-error");

/**
 * @type {WebSocket | null} The active clicker listen socket.
 */
let listenSocket = null;
/**
 * @type {number?} The timeout ID of the schedule to reconnect.
 */
let reconnectScheduleId;
/**
 * @type {number?} identifier of auto clear error message timeout.
 */
let errorMessageTimeout;
/**
 * @type {number?} identifier of click button state reset timeout.
 */
let clickMessageTimeout;



setInterval(() => {
    updateButtons();
}, 500);



function updateButtons() {
    const id = idInputElement.value;

    document.querySelectorAll(".id-button").forEach(el => {
        el.disabled = id.length <= 0;
    });
}

function handleListenButton() {
    const id = idInputElement.value;

    if (listenSocket != null) {
        clearListenSocket();
        return;
    }
    startListenSocket(id);
}

async function handleClickButton(e) {
    const id = idInputElement.value;
    const encodedId = encodeURIComponent(id);
    const clickButton = e.target;
    /**
     * @type {Response} Fetch response.
     */
    let response;
    let errorText = "";

    clickButton.classList.add("thinking");
    clickButton.innerText = "Click…";

    try {
        response = await fetch(`api/${encodedId}/click`)
    } catch (error) {
        console.error(error);
        return setError(MESSAGE_CONNECTION_ERROR);
    } finally {
        clickButton.classList.remove("thinking");
    }

    if (clickMessageTimeout)
        clickMessageTimeout = clearTimeout(clickMessageTimeout)

    clickButton.innerText = "Clicked!";

    clickMessageTimeout = setTimeout(() => {
        clickButton.innerText = "Click";
        clickMessageTimeout = null;
    }, SECOND);

    switch (response.status) {
        case 200:
            break;
        case 404:
            errorText = "The click echoed around but did not seem to reach anybody…";
            break;
        case 500:
            errorText = "The clicker seems unable to be clicked and makes a crunch noise instead. Something seems broken inside…";
            break;
        default:
            errorText = `[${response.status}] ${response.statusText}`;
    }

    setError(errorText)
}

/**
 * Set error message for user to auto-clear automatically.
 * 
 * @param {string} errorMessage message to display
 * @param {number} clearAfter Amount of milliseconds to wait before clearing 
 *                      the error message if not overwritten by another shown with
 *                      this function.
 * @returns {void}
 */
function setError(errorMessage, clearAfter = 6.66 * SECOND) {
    if (errorMessageTimeout)
        errorMessageTimeout = clearTimeout(errorMessageTimeout);

    errorMessageElement.innerHTML = errorMessage;

    if (errorMessage.length == 0)
        return;

    errorMessageTimeout = setTimeout(() => {
        errorMessageElement.innerText = "";
        errorMessageTimeout = null;
    }, clearAfter);
}

/**
 * Clears the currently active socket
 */
function clearListenSocket() {
    if (listenSocket != null)
        listenSocket.close();

    if (reconnectScheduleId) {
        clearInterval(reconnectScheduleId);
        reconnectScheduleId = null;
        
        if (errorMessageElement.innerText == MESSAGE_LISTEN_DISCONNECT)
            setError("");
    }

    listenSocket = null;
    listenButtonElement.innerText = "Listen";
    listenKeyInfoElement.innerText = "";
}

/**
 * @param {string} listenId The clicker ID to listen to.
 * @param {number} reconnectCount 
 */
function startListenSocket(listenId, reconnectCount = 0) {
    const encodedId = encodeURIComponent(listenId);
    let wasOpened = reconnectCount != 0;

    listenButtonElement.innerText = "Stop Listening";
    listenKeyInfoElement.innerText = listenId;
    listenStateInfoElement.innerText = "Tuning into";

    const thisSocket = new WebSocket(`api/${encodedId}/listen`);
    thisSocket.onclose = (event) => {
        if (event.wasClean) {
            if (thisSocket === listenSocket)
                clearListenSocket();
            return
        }
        console.error(event);

        if (!wasOpened) {
            // This can be due to a 400, 500 or a network failure but can't
            // seem to know which one. Only getting the 1006 unusual disconnect.
            setError(`${MESSAGE_CONNECTION_ERROR} but there might be other issues?`);

            clearListenSocket();
            return;
        }

        if (thisSocket !== listenSocket) {
            // This is not the active listen socket anymore, likely has been replaced
            // and not properly closed up until now. Nothing left to do.
            return;
        }

        // -- Disconnected for some reason
        let reconnectInMilliSeconds = calculateBackoffDelaySeconds(reconnectCount) * SECOND;

        // Extra time for error to prevent blinking with repeated connection failures (hopefully)
        setError(MESSAGE_LISTEN_DISCONNECT, reconnectInMilliSeconds + SECOND);

        reconnectScheduleId = setTimeout(() => {
            startListenSocket(listenId, ++reconnectCount);
            reconnectScheduleId = null;
        }, reconnectInMilliSeconds);

        setReconnectMessage(Date.now() + reconnectInMilliSeconds, reconnectScheduleId)
    }
    thisSocket.onopen = () => {
        wasOpened = true;
        reconnectCount = 0;
        listenStateInfoElement.innerText = "Listening on";
    }
    thisSocket.onmessage = (event) => {
        console.log(event.data);
        if (event.data === "c") {
            let audio = new Audio('sound.ogg');
            audio.play();
        }
    };
    listenSocket = thisSocket;
}

/**
 * Calculates the back-off delay in seconds based on the formula
 * $\frac{1}{scalingFactor}*2^{reconnectionCount}$ limited by maxDelay
 * 
 * @param {number} reconnectionCount whole number of total reconnection since successfully
 *                  established connection.
 * @return a float of seconds to wait before re-connecting
 */
function calculateBackoffDelaySeconds(reconnectionCount) {
    const maxDelaySeconds = 300
    /**
     * factor by which to reduce the scaling effect.
     */
    const scalingFactor = 2;

    return Math.min(
        (1 / scalingFactor) * Math.pow(2, reconnectionCount),
        maxDelaySeconds
    );
};

/**
 * Sets the listen state to the reconnect message which dynamically shows in how much
 * time it will try and reconnect to the server. This only updates after initial set
 * with animation frames aka when the page is being viewed.
 * 
 * @param {number} reconnectOnTimestamp millisecond unix timestamp since midnight,
 *                  January 1, 1970 Universal Coordinated Time (UTC) on which time it will
 *                  try reconnecting.
 * @param {number} referenceSchedulerId ID of the scheduled timeout as reference for
 *                  seeing if this message is still relevant to update or if another
 *                  connection has surpassed it.
 * @returns {void}
 */
function setReconnectMessage(reconnectOnTimestamp, referenceSchedulerId) {
    const secondsLeft = (reconnectOnTimestamp - Date.now()) / SECOND;
    let detail = 0
    let updateInMs = SECOND;

    if (reconnectScheduleId !== referenceSchedulerId)
        return;

    if (secondsLeft.toFixed(1) < 10) {
        detail = 1;
        updateInMs = 100;
    }

    listenStateInfoElement.innerHTML =
        `Waiting <var>${secondsLeft.toFixed(detail)}</var> seconds before retuning into`;

    setTimeout(() => requestAnimationFrame(() =>
        setReconnectMessage(reconnectOnTimestamp, referenceSchedulerId)
    ), updateInMs);
}
