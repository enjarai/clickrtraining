const SECOND = 1000;
let id = "";
let ws;
let errorMessage;
let clickTimeout;

function changeInput(e) {
    updateInput(e.target);
}

function updateInput(t) {
    id = t.value;
    // localStorage.setItem("id", id);
    document.querySelectorAll(".id-button").forEach(el => {
        el.disabled = id.length <= 0;
    });
}

function listenButton(e) {
    const info = document.querySelector("#listen-info var");

    if (!ws) {
        ws = new WebSocket(`api/${id}/listen`);
        ws.onopen = (event) => {
            ws.onmessage = (event) => {
                console.log(event.data);
                if (event.data === "c") {
                    let audio = new Audio('sound.ogg');
                    audio.play();
                }
            };

            ws.onclose = () => {
                ws = null;
                e.target.innerText = "Listen";
                info.innerText = "";
            }
            ws.onerror = () => {
                ws = null;
                e.target.innerText = "Listen";
                info.innerText = "";
            }
        };
        e.target.innerText = "Stop Listening";
        info.innerText = id;
    } else {
        ws.close();
        ws = null;
        e.target.innerText = "Listen";                
        info.innerText = "";
    }
}

async function clickButton(e) {
    /**
     * @param {response} response Fetch response.
     */
    let response;
    let errorText = "";

    try {
        response = await fetch(`api/${id}/click`)
    } catch (error) {
        console.error(error);
        return setError("Unable to reach the clicker. It seems out of interweb range…");
    }

    if (clickTimeout)
        clickTimeout = clearTimeout(clickTimeout)

    e.target.innerText = "Clicked!";

    clickTimeout = setTimeout(() => {
        e.target.innerText = "Click";
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

const idInput = document.querySelector("#id-input");

setInterval(() => {
    updateInput(idInput);
}, 500);

// document.querySelector("#id-input").value = "";
document.querySelectorAll(".id-button").forEach(el => {
    el.disabled = true;
});

/**
 * Set error message for user to auto-clear automatically.
 * 
 * @param {string} errorMessage message to display
 * @returns {void}
 */
function setError(errorMessage) {
    const statusError = document.querySelector("#action-error");

    statusError.innerHTML = errorMessage;

    if (errorMessage.length == 0)
        return;

    if (errorMessage)
        errorMessage = clearTimeout(errorMessage);

    errorMessage = setTimeout(() => {
        statusError.innerText = "";
        errorMessage = null;
    }, 6.66 * SECOND);
}
