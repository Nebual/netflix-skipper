'use strict';

(function () {
    // make sure the content script is only run once on the page
    if (window.netflixSkipperLoaded) {
        return;
    }
    window.netflixSkipperLoaded = true;

    //////////////////////////////////////////////////////////////////////////
    // Helpers                                                              //
    //////////////////////////////////////////////////////////////////////////

    // returns an action which delays for some time
    var delay = function (milliseconds) {
        return function (result) {
            return new Promise(function (resolve, reject) {
                setTimeout(function () {
                    resolve(result);
                }, milliseconds);
            });
        };
    };

    // returns an action which waits until the condition thunk returns true,
    // rejecting if maxDelay time is exceeded
    var delayUntil = function (condition, maxDelay) {
        return function (result) {
            var delayStep = 250;
            var startTime = (new Date()).getTime();
            var checkForCondition = function () {
                if (condition()) {
                    return Promise.resolve(result);
                }
                if (maxDelay !== null && (new Date()).getTime() - startTime > maxDelay) {
                    return Promise.reject(Error('delayUntil timed out'));
                }
                return delay(delayStep)().then(checkForCondition);
            };
            return checkForCondition();
        };
    };

    // add value to the end of array, and remove items from the beginning
    // such that the length does not exceed limit
    var shove = function (array, value, limit) {
        array.push(value);
        if (array.length > limit) {
            array.splice(0, array.length - limit);
        }
    };

    // compute the mean of an array of numbers
    var mean = function (array) {
        return array.reduce(function (a, b) {
                return a + b;
            }) / array.length;
    };

    // compute the median of an array of numbers
    var median = function (array) {
        return array.concat().sort()[Math.floor(array.length / 2)];
    };

    // swallow any errors from an action
    // and log them to the console
    var swallow = function (action) {
        return function (result) {
            return action(result).catch(function (e) {
                console.error(e);
            });
        };
    };

    // promise.ensure(fn) method
    // note that this method will not swallow errors
    Promise.prototype.ensure = function (fn) {
        return this.then(fn, function (e) {
            fn();
            throw e;
        });
    };

    //////////////////////////////////////////////////////////////////////////
    // Netflix API                                                          //
    //////////////////////////////////////////////////////////////////////////

    // how many simulated UI events are currently going on
    // don't respond to UI events unless this is 0, otherwise
    // we will mistake simulated actions for real ones
    var uiEventsHappening = 0;

    // video duration in milliseconds
    var lastDuration = 60 * 60 * 1000;
    var getDuration = function () {
        var video = jQuery('.player-video-wrapper video');
        if (video.length > 0) {
            lastDuration = Math.floor(video[0].duration * 1000);
        }
        return lastDuration;
    };

    // 'playing', 'paused', 'loading', or 'idle'
    var getState = function () {
        if (jQuery('.timeout-wrapper.player-active .icon-play').length > 0) {
            return 'idle';
        }
        if (jQuery('.player-progress-round.player-hidden').length === 0) {
            return 'loading';
        }
        if (jQuery('.player-control-button.player-play-pause.play').length === 0) {
            return 'playing';
        }
        else {
            return 'paused';
        }
    };

    // current playback position in milliseconds
    var getPlaybackPosition = function () {
        return Math.floor(jQuery('.player-video-wrapper video')[0].currentTime * 1000);
    };

    var getVideoID = function () {
        return parseInt(window.location.href.match(/^.*\/([0-9]+)\??.*/)[1])
    };

    // show the playback controls
    var showControls = function () {
        uiEventsHappening += 1;
        var scrubber = jQuery('#scrubber-component');
        var eventOptions = {
            'bubbles': true,
            'button': 0,
            'currentTarget': scrubber[0]
        };
        scrubber[0].dispatchEvent(new MouseEvent('mousemove', eventOptions));
        return delayUntil(function () {
            return scrubber.is(':visible');
        }, 1000)().ensure(function () {
            uiEventsHappening -= 1;
        });
    };

    // hide the playback controls
    var hideControls = function () {
        uiEventsHappening += 1;
        var player = jQuery('#netflix-player');
        var mouseX = 100; // relative to the document
        var mouseY = 100; // relative to the document
        var eventOptions = {
            'bubbles': true,
            'button': 0,
            'screenX': mouseX - jQuery(window).scrollLeft(),
            'screenY': mouseY - jQuery(window).scrollTop(),
            'clientX': mouseX - jQuery(window).scrollLeft(),
            'clientY': mouseY - jQuery(window).scrollTop(),
            'offsetX': mouseX - player.offset().left,
            'offsetY': mouseY - player.offset().top,
            'pageX': mouseX,
            'pageY': mouseY,
            'currentTarget': player[0]
        };
        player[0].dispatchEvent(new MouseEvent('mousemove', eventOptions));
        return delay(1)().ensure(function () {
            uiEventsHappening -= 1;
        });
    };

    var pause = function () {
        uiEventsHappening += 1;
        jQuery('.player-play-pause.pause').click();
        return delayUntil(function () {
            return getState() === 'paused';
        }, 1000)().then(hideControls).ensure(function () {
            uiEventsHappening -= 1;
        });
    };

    var play = function () {
        uiEventsHappening += 1;
        jQuery('.player-play-pause.play').click();
        return delayUntil(function () {
            return getState() === 'playing';
        }, 2500)().then(hideControls).ensure(function () {
            uiEventsHappening -= 1;
        });
    };

    // jump to a specific time in the video
    var seekErrorRecent = [];
    var seekErrorMean = 0;
    var seek = function (milliseconds) {
        return function () {
            uiEventsHappening += 1;
            var eventOptions, scrubber, oldPlaybackPosition, newPlaybackPosition;
            return showControls().then(function () {
                // compute the parameters for the mouse events
                scrubber = jQuery('#scrubber-component');
                var factor = (milliseconds - seekErrorMean) / getDuration();
                factor = Math.min(Math.max(factor, 0), 1);
                var mouseX = scrubber.offset().left + Math.round(scrubber.width() * factor); // relative to the document
                var mouseY = scrubber.offset().top + scrubber.height() / 2;                  // relative to the document
                eventOptions = {
                    'bubbles': true,
                    'button': 0,
                    'screenX': mouseX - jQuery(window).scrollLeft(),
                    'screenY': mouseY - jQuery(window).scrollTop(),
                    'clientX': mouseX - jQuery(window).scrollLeft(),
                    'clientY': mouseY - jQuery(window).scrollTop(),
                    'offsetX': mouseX - scrubber.offset().left,
                    'offsetY': mouseY - scrubber.offset().top,
                    'pageX': mouseX,
                    'pageY': mouseY,
                    'currentTarget': scrubber[0]
                };

                // make the trickplay preview show up
                scrubber[0].dispatchEvent(new MouseEvent('mouseover', eventOptions));
            }).then(delayUntil(function () {
                // wait for the trickplay preview to show up
                return jQuery('.trickplay-preview').is(':visible');
            }, 2500)).then(function () {
                // remember the old position
                oldPlaybackPosition = getPlaybackPosition();

                // simulate a click on the scrubber
                scrubber[0].dispatchEvent(new MouseEvent('mousedown', eventOptions));
                scrubber[0].dispatchEvent(new MouseEvent('mouseup', eventOptions));
                scrubber[0].dispatchEvent(new MouseEvent('mouseout', eventOptions));
            }).then(delayUntil(function () {
                // wait until the seeking is done
                newPlaybackPosition = getPlaybackPosition();
                return Math.abs(newPlaybackPosition - oldPlaybackPosition) >= 1;
            }, 5000)).then(function () {
                // compute mean seek error for next time
                var newSeekError = Math.min(Math.max(newPlaybackPosition - milliseconds, -10000), 10000);
                shove(seekErrorRecent, newSeekError, 5);
                seekErrorMean = mean(seekErrorRecent);
            }).then(hideControls).ensure(function () {
                uiEventsHappening -= 1;
            });
        };
    };

    //////////////////////////////////////////////////////////////////////////
    // Main logic                                                           //
    //////////////////////////////////////////////////////////////////////////

    var checkInterval = 250;
    var enableSkipping = false;
    var thresholds = {};
    var videoId = null;
    var triggerScenes = {};
    var nextTriggerIndex = 0;
    var lastFrameTime = 0;

    function trySkip() {
        if (!enableSkipping) {
            return Promise.resolve();
        }
        if (getState() !== 'playing') {
            return Promise.resolve();
        }

        if (videoId != getVideoID()) {
            resetVideoScenes();
            return Promise.resolve();
        }

        var playTime = getPlaybackPosition();
        if (!lastFrameTime || lastFrameTime >= playTime) {
            // Sometimes state is "playing" when user pans back in time and triggers a load
            lastFrameTime = playTime;
            return Promise.resolve();
        }

        while (nextTriggerIndex < triggerScenes.length) {
            var scene = triggerScenes[nextTriggerIndex];
            if (playTime >= scene.time) {
                if (playTime < scene.next && warningsAboveThreshold(scene)) {
                    console.info("Seeking past", scene);
                    return seek(scene.next)().then(function () {
                        return play();
                    });
                } else {
                    console.debug("Skipping", scene);
                    nextTriggerIndex++;
                }
            } else {
                break;
            }
        }
        return Promise.resolve();
    }

    // the following allows us to linearize all tasks in the program to avoid interference
    var tasks = null;
    var tasksInFlight = 0;

    var pushTask = function (task) {
        if (tasksInFlight === 0) {
            // why reset tasks here? in case the native promises implementation isn't
            // smart enough to garbage collect old completed tasks in the chain.
            tasks = Promise.resolve();
        }
        tasksInFlight += 1;
        tasks = tasks.then(swallow(task))
            .then(function () {
                tasksInFlight -= 1;
            });
    };

    jQuery(window).on('mouseup keydown', function (e) {
        if (uiEventsHappening === 0 && e.which === 1) {
            console.info("Current Playtime:", getPlaybackPosition());
        }
        if (enableSkipping && uiEventsHappening === 0) {
            resetVideoScenes();
        }
    });

    function resetVideoScenes() {
        lastFrameTime = 0;
        nextTriggerIndex = 0;
        if (videoId != getVideoID()) {
            videoId = getVideoID();
            triggerScenes = {};
            var filename = "scenes/" + videoId + ".json";
            chrome.storage.local.get(filename, function(data) {
                if (filename in data) {
                    triggerScenes = data[filename];
                } else {
                    $.getJSON(chrome.runtime.getURL(filename), function (data) {
                        triggerScenes = data.scenes;
                    }).fail(function (data) {
                        $.getJSON("https://gitcdn.xyz/repo/Nebual/netflix-skipper/master/" + filename, function (data) {
                            triggerScenes = data.scenes;
                            chrome.storage.local.set({filename: data.scenes});
                        });
                    });
                }
            });
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

    var syncTimer;
    function reloadSettings() {
        chrome.storage.local.get(["enableSkipping", "sexThreshold", "bloodThreshold", "violenceThreshold", "suicideThreshold", "needleThreshold"], function (data) {
            enableSkipping = data['enableSkipping'];
            thresholds = data;

            clearInterval(syncTimer);
            if (enableSkipping) {
                syncTimer = setInterval(function () {
                    if (tasksInFlight === 0) {
                        pushTask(trySkip);
                    }
                }, checkInterval);
            }
        });
    }
    reloadSettings();

    // interaction with the popup
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.type === 'reloadSettings') {
            reloadSettings();

            sendResponse({});
            return;
        }
        if (request.type === 'skipTo') {
            pushTask(seek(request.data.time));

            sendResponse({});
            return;
        }
    });
})();
