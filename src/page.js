'use strict';

(function () {
    // make sure the script is only run once on the page
    if (window.netflixSkipperLoaded) {
        return;
    }
    window.netflixSkipperLoaded = true;

    class NetflixController {
        constructor() {
            this.videoPlayer = netflix.appContext.state.playerApp.getAPI().videoPlayer;
            const enableTimer = setInterval(() => {
                this.sessionId = this.videoPlayer.getAllPlayerSessionIds()[0];
                this.player = this.videoPlayer.getVideoPlayerBySessionId(
                    this.sessionId
                );
                if (this.player) {
                    document.dispatchEvent(new CustomEvent('NS-initializedPlayer'));
                    clearInterval(enableTimer);
                }
            }, 50);
        }

        seek(time) {
            this.player.seek(time);
        }

        play() {
            this.player.play();
        }

        pause() {
            this.player.pause();
        }

        getCurrentTime() {
            return this.player.getCurrentTime();
        }

        getDuration() {
            return this.player.getDuration();
        }

        getMovieId() {
            return this.player.getMovieId();
        }

        isReady() {
            return this.player && this.player.isReady();
        }

        isLoading() {
            return this.player.isLoading();
        }

        isPaused() {
            return this.player.isPaused();
        }

        isPlaying() {
            return this.player.isPlaying();
        }
    }

    const player = new NetflixController();
    window.NSPlayer = player; // expose as debugging aid

    const checkInterval = 250;
    let enableSkipping = false;
    let thresholds = {};
    let videoId = null;
    let triggerScenes = {};
    let nextTriggerIndex = 0;
    let lastFrameTime = 0;

    function trySkip() {
        if (!enableSkipping || !player.isReady()) {
            return;
        }
        if (!player.isPlaying()) {
            return;
        }

        if (videoId !== player.getMovieId()) {
            resetVideoScenes();
            return;
        }

        var playTime = player.getCurrentTime();
        if (!lastFrameTime || lastFrameTime >= playTime) {
            // Sometimes state is "playing" when user pans back in time and triggers a load
            lastFrameTime = playTime;
            return;
        }

        while (nextTriggerIndex < triggerScenes.length) {
            const scene = triggerScenes[nextTriggerIndex];
            if (playTime >= scene.time) {
                if (playTime < scene.next && warningsAboveThreshold(scene)) {
                    console.info("NS: Seeking past scene", scene);
                    player.seek(scene.next);
                    player.play();
                    break;
                } else {
                    console.debug("Ignoring", scene);
                    nextTriggerIndex++;
                }
            } else {
                break;
            }
        }
    }

    function warningsAboveThreshold(scene) {
        if (scene.sex > thresholds.sexThreshold) return true;
        if (scene.blood > thresholds.bloodThreshold) return true;
        if (scene.violence > thresholds.violenceThreshold) return true;
        if (scene.suicide > thresholds.suicideThreshold) return true;
        if (scene.needle > thresholds.needleThreshold) return true;
        return false;
    }

    function mousedown(e) {
        if (e.which === 1) {
            console.debug("Current Playtime:", player.getCurrentTime());
        }
        if (enableSkipping) {
            // todo: I think this is only here so we reset on manual seek
            // might be better to auto reset if lastFrameTime has externally changed significantly
            resetVideoScenes();
        }
    }

    window.addEventListener('mousedown', mousedown);
    window.addEventListener('keydown', mousedown);

    function resetVideoScenes() {
        lastFrameTime = 0;
        nextTriggerIndex = 0;
        if (videoId !== player.getMovieId()) {
            videoId = player.getMovieId();
            triggerScenes = [];
            if (!videoId) return;
            const filename = "scenes/" + videoId + ".json";
            const cachedFile = localStorage.getItem('NS/' + filename);
            if (cachedFile) {
                const parsedFile = JSON.parse(cachedFile);
                triggerScenes = parsedFile.scenes;
                console.info("Loaded " + parsedFile.name + " (" + triggerScenes.length + " scenes) from cache.");
                if (editorMode) {
                    initializeEditor();
                }
            } else {
                document.dispatchEvent(new CustomEvent('NS-requestVideoScenes', {
                    detail: {filename: filename}
                }));
            }
        }
    }

    document.addEventListener('NS-initializedPlayer', resetVideoScenes);

    document.addEventListener('NS-loadVideoScenes', function (e) {
        triggerScenes = e.detail.scenes;
        lastFrameTime = 0;
        nextTriggerIndex = 0;
        console.info("NS: Loaded " + e.detail.name + " (" + triggerScenes.length + " scenes)");
        localStorage.setItem('NS/' + e.detail.filename, JSON.stringify(e.detail));
        if (editorMode) {
            initializeEditor();
        }
    });

    document.addEventListener('NS-seek', function (e) {
        player.seek(e.detail);
    });

    let syncTimer;
    let editorMode;
    let style = document.createElement('style');
    style.appendChild(document.createTextNode(`
        #ns-editor-container {
            position: fixed;
            right: 0;
            z-index: 1;
            background-color: rgba(255, 255, 255, 0.5);
            width: 20vw;
            height: 100vh;
            color: black;
        }
        .flex-grid {
            display: flex;
        }
        .flex-grid-vertical {
            display: flex;
            flex-direction: column;
        }
        .col {
            flex: 1;
        }
        
        .scene-cards {
            max-height: 95vh;
            overflow-y: auto;
        }
        .card {
            margin: 2px;
            padding: 4px;
            box-shadow: 0 2px 1px -1px rgba(0,0,0,.2), 0 1px 1px 0 rgba(0,0,0,.14), 0 1px 3px 0 rgba(0,0,0,.12);
            background-color: rgba(255, 255, 255, 0.5);
            border-radius: 4px;
        }
        .scene-card-current {
            border-top: red solid 1px;
            border-bottom: red solid 1px;
        }
        
        .scene-adjuster-top {
            flex: 1;
            flex-grow: 3;
        }
        .scene-adjuster-bottom {
            flex: 1
        }
        .scene-start-button,
        .scene-end-button {
            width: 100%;
        }
        .scene-start,
        .scene-end {
            width: 100%;
            box-sizing: border-box;
            color: black;
        }
        .scene-start-adjust,
        .scene-end-adjust {
            padding: 4px;
            font-size: 0.7em;
        }
        .scene-middle {
            font-size: 10px;
        }
        .pull-left {
            float: left;
        }
        .pull-right {
            float: right;
        }
        #save {
            font-family: Roboto,sans-serif;
            -webkit-font-smoothing: antialiased;
            font-size: .875rem;
            font-weight: 500;
            letter-spacing: .0892857143em;
            text-decoration: none;
            text-transform: uppercase;
            padding: 0 8px;
            display: inline-flex;
            position: relative;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            height: 36px;
            outline: none;
            user-select: none;
            -webkit-appearance: none;
            overflow: hidden;
            vertical-align: middle;
            border: none;
            border-radius: 4px;
            border-color: red;
            border-style: solid;
            border-width: 1px;
        }
    `));
    document.head.appendChild(style);

    let cardUpdateTimer;
    function initializeEditor() {
        let oldContainer = document.getElementById('ns-editor-container');
        if (oldContainer) {
            oldContainer.remove();
        }
        if (!editorMode) {
            return;
        }

        let container = document.createElement('div');
        container.id = 'ns-editor-container';
        function addOption(value, selectedValue) {
            return `<option value="${value}" ${value == selectedValue ? "selected" : ''}>${value}</option>`;
        }
        function addSceneRow({time: start, next: end, sex, blood, violence, suicide, needle}) {
            return `
            <form class="flex-grid card scene-card">
                <div class="col flex-grid-vertical" style="width: 5vw;">
                    <div class="scene-adjuster-top">
                        <input class="scene-start" name="time" type="number" value="${start}"/>
                        <div class="pull-left">
                            <button type="button" class="scene-start-adjust" value="-2000">&lt;&lt;</button
                            ><button type="button" class="scene-start-adjust" value="-500">&lt;</button>
                        </div>
                        <div class="pull-right">
                            <button type="button" class="scene-start-adjust" value="500">&gt;</button
                            ><button type="button" class="scene-start-adjust" value="2000">&gt;&gt;</button>
                        </div>
                    </div>
                    <div class="scene-adjuster-bottom">
                        <button class="scene-start-button" type="button">Start</button>
                    </div>
                </div>
                <div class="col scene-middle">
                    <div class="threshold">
                        <select class="threshold-select" name="sex">
                            <option></option>
                            ${addOption(1, sex)}
                            ${addOption(2, sex)}
                            ${addOption(3, sex)}
                        </select>
                        Nudity
                    </div>
                    <div class="threshold">
                        <select class="threshold-select" name="blood">
                            <option></option>
                            ${addOption(1, blood)}
                            ${addOption(2, blood)}
                            ${addOption(3, blood)}
                        </select>
                        Blood
                    </div>
                    <div class="threshold">
                        <select class="threshold-select" name="violence">
                            <option></option>
                            ${addOption(1, violence)}
                            ${addOption(2, violence)}
                            ${addOption(3, violence)}
                        </select>
                        Violence
                    </div>
                    <div class="threshold">
                        <select class="threshold-select" name="suicide">
                            <option></option>
                            ${addOption(1, suicide)}
                            ${addOption(2, suicide)}
                            ${addOption(3, suicide)}
                        </select>
                        Suicide
                    </div>
                    <div class="threshold">
                        <input type="checkbox" name="needle" value="1" ${!!needle ? 'checked' : ''}/>
                        Has Needles
                    </div>
                </div>
                <div class="col flex-grid-vertical" style="width: 5vw;">
                    <div class="scene-adjuster-top">
                        <input class="scene-end" name="next" type="number" value="${end}"/>
                        <div class="pull-left">
                            <button type="button" class="scene-end-adjust" value="-2000">&lt;&lt;</button
                            ><button type="button" class="scene-end-adjust" value="-500">&lt;</button>
                        </div>
                        <div class="pull-right">
                            <button type="button" class="scene-end-adjust" value="500">&gt;</button
                            ><button type="button" class="scene-end-adjust" value="2000">&gt;&gt;</button>
                        </div>
                    </div>
                    <div class="scene-adjuster-bottom">
                        <button class="scene-end-button" type="button">End</button>
                    </div>
                </div>
            </form>
            `;
        }
        container.innerHTML = `
            <div class="scene-cards">
                ${triggerScenes.map(scene => addSceneRow(scene)).join('')}
            </div>
            <div class="card">
                <button type="button" id="save">Save Scenes</button>
                <button type="button" id="new-scene" class="pull-right">+</button>
            </div>
        `;
        document.body.appendChild(container);

        let sceneCards = [...document.getElementsByClassName("scene-card")];
        clearInterval(cardUpdateTimer);
        cardUpdateTimer = setInterval(() => {
            let currentTime = player.getCurrentTime();
            console.log(sceneCards.length, nextTriggerIndex);
            for (let i=0; i<sceneCards.length; i++) {
                let elem = sceneCards[i];
                // todo: use currentTime instead
                if (nextTriggerIndex === i) {
                    elem.classList.add("scene-card-current");
                } else {
                    elem.classList.remove("scene-card-current");
                }
            }
        }, 1000);

        // todo: adjustments should immediately update triggerScenes
        // todo: delete scene button
        // todo: highlight most recently passed scene
        [...document.getElementsByClassName("scene-start-button")].map(elem => {
            elem.addEventListener("click", () => {
                // console.log(elem, elem.closest(".scene-card"), elem.closest(".scene-card").find(".scene-start"), elem.closest(".scene-card").find(".scene-start").value);
                let val = elem.closest(".scene-card").querySelector(".scene-start").value;
                player.seek(val);
            });
        });

        [...document.getElementsByClassName("scene-end-button")].map(elem => {
            elem.addEventListener("click", () => {
                let val = elem.closest(".scene-card").querySelector(".scene-end").value;
                player.seek(val);
            })
        });

        [...document.getElementsByClassName("scene-start-adjust")].map(elem => {
            elem.addEventListener("click", () => {
                let startElem = elem.closest(".scene-card").querySelector(".scene-start");
                startElem.value = Number(startElem.value) + Number(elem.value);
                player.seek(startElem.value);
            });
        });

        [...document.getElementsByClassName("scene-end-adjust")].map(elem => {
            elem.addEventListener("click", () => {
                let endElem = elem.closest(".scene-card").querySelector(".scene-end");
                endElem.value = Number(endElem.value) + Number(elem.value);
                player.seek(endElem.value);
            });
        });

        document.getElementById('save').addEventListener("click", () => {
            let scenes = sceneCards.map(elem =>
                Object.fromEntries([...new FormData(elem).entries()].map(([key, value]) => [key, Number(value)]))
            );
            scenes.sort((a, b) => {
                if (a.time < b.time) return -1;
                if (a.time > b.time) return 1;
                return 0;
            });
            console.log("savi", scenes);

            let cachedData = localStorage.getItem(`NS/scenes/${videoId}.json`);
            let episodeData = cachedData ? JSON.parse(cachedData) : {id: videoId};
            episodeData.scenes = scenes;
            triggerScenes = scenes;
            localStorage.setItem(`NS/scenes/${videoId}.json`, JSON.stringify(episodeData));
            initializeEditor();
        });
        document.getElementById('new-scene').addEventListener("click", () => {
            triggerScenes.push({time: player.getCurrentTime(), next: player.getCurrentTime() + 1000});
            initializeEditor();
        });
    }

    document.addEventListener('NS-loadSettings', function (e) {
        console.debug("NS: loaded settings", e.detail);
        thresholds = e.detail;
        editorMode = e.detail.editorMode;
        if (editorMode) {
            initializeEditor();
        } else {
            let container = document.getElementById('ns-editor-container');
            if (container) {
                container.remove();
            }
        }
        enableSkipping = e.detail.enableSkipping;
        clearInterval(syncTimer);
        if (enableSkipping) {
            syncTimer = setInterval(trySkip, checkInterval);
        }
    });
})();
