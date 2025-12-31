const SECOND = 1000;
const MESSAGE_CONNECTION_ERROR = "Unable to reach the clicker. It seems out of interweb range…";

const idInputElement = document.querySelector("#id-input");
const listenKeyInfoElement = document.querySelector("#listen-info var");
const listenStateInfoElement = document.querySelector("#listen-info .state");
const listenButtonElement = document.querySelector("button.listen");

/**
 * @type {WebSocket | null} The active clicker listen socket.
 */
let listenSocket = null;
/**
 * @type {number} identifier of auto clear error message timeout.
 */
let errorTimeout;
/**
 * @type {number} identifier of click button state reset timeout.
 */
let clickTimeout;



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

    if (clickTimeout)
        clickTimeout = clearTimeout(clickTimeout)

    clickButton.innerText = "Clicked!";

    clickTimeout = setTimeout(() => {
        clickButton.innerText = "Click";
        clickTimeout = null;
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
 * @returns {void}
 */
function setError(errorMessage) {
    const errorElement = document.querySelector("#action-error");

    errorElement.innerHTML = errorMessage;

    if (errorMessage.length == 0)
        return;

    if (errorTimeout)
        errorTimeout = clearTimeout(errorTimeout);

    errorTimeout = setTimeout(() => {
        errorElement.innerText = "";
        errorTimeout = null;
    }, 6.66 * SECOND);
}

/**
 * Clears the currently active socket
 */
function clearListenSocket() {
    if (listenSocket != null)
        listenSocket.close();

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
    let hadOpened = reconnectCount == 0;

    listenButtonElement.innerText = "Stop Listening";
    listenKeyInfoElement.innerText = listenId;
    listenStateInfoElement.innerText = "Tuning into";

    thisSocket = new WebSocket(`api/${encodedId}/listen`);
    thisSocket.onclose = (event) => {
        if (event.wasClean){
            if (thisSocket === listenSocket)
                clearListenSocket(handleListenButton);
            return 
        }
        console.error(event);

        if (!hadOpened) {
            // This can be due to a 400, 500 or a network failure but can't
            // seem to know which one. Only getting the 1006 unusual disconnect.
            // Todo; might need to add a check end-point to see if the ID is a
            //      valid key to listen too first before connecting.
            setError(`${MESSAGE_CONNECTION_ERROR} but there might be other issues?`)
        }

        if (thisSocket !== listenSocket) {
            // This is not the active listen socket anymore, likely has been replaced
            // and not properly closed up until now. Nothing left to do.
            return;
        }

        // Disconnected for some reason
        // Todo: incremental back-off & disconnect error message
        startListenSocket(listenId, ++reconnectCount);
    }
    thisSocket.onopen = () => {
        hadOpened = true;
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
