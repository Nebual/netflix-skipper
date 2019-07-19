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
            triggerScenes = {};
            if (!videoId) return;
            const filename = "scenes/" + videoId + ".json";
            const cachedFile = localStorage.getItem('NS/' + filename);
            if (cachedFile) {
                const parsedFile = JSON.parse(cachedFile);
                triggerScenes = parsedFile.scenes;
                console.info("Loaded " + parsedFile.name + " (" + triggerScenes.length + " scenes) from cache.");
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
    });

    document.addEventListener('NS-seek', function (e) {
        player.seek(e.detail);
    });

    let syncTimer;
    document.addEventListener('NS-loadSettings', function (e) {
        console.debug("NS: loaded settings", e.detail);
        thresholds = e.detail;
        enableSkipping = e.detail.enableSkipping;
        clearInterval(syncTimer);
        if (enableSkipping) {
            syncTimer = setInterval(trySkip, checkInterval);
        }
    });
})();
