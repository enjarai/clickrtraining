const SECOND = 1000;
let id = "";
let ws;
let errTimeout;
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
    const statusError = document.querySelector("#action-error")
    const response = await fetch(`api/${id}/click`);
    let errorText = "";

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

    statusError.innerHTML = errorText;

    if (errorText.length == 0)
        return
    if (errTimeout)
        errTimeout = clearTimeout(err)

    errTimeout = setTimeout(() => {
        statusError.innerText = "";
        errTimeout = null;
    }, 6.66 * SECOND);
}

const idInput = document.querySelector("#id-input");

setInterval(() => {
    updateInput(idInput);
}, 500);

// document.querySelector("#id-input").value = "";
document.querySelectorAll(".id-button").forEach(el => {
    el.disabled = true;
});
