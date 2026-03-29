const infoButtons = document.querySelectorAll("[data-info-target]");
const infoScreens = document.querySelectorAll(".screen");

function setActiveInfoScreen(screenId) {
    infoScreens.forEach(function (screen) {
        screen.classList.toggle("is-active", screen.id === screenId);
    });

    infoButtons.forEach(function (button) {
        button.classList.toggle("is-active", button.dataset.infoTarget === screenId);
    });

    const activeButton = document.querySelector("[data-info-target].is-active");
    document.title = activeButton ? "Informatik: " + activeButton.textContent.trim() : "Informatik";
}

infoButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        setActiveInfoScreen(button.dataset.infoTarget);
    });
});

setActiveInfoScreen("screen-algorithmen");
