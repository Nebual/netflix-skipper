'use strict';

(function () {
    // make sure the content script is only run once on the page
    if (window.netflixSkipperCSLoaded) {
        return;
    }
    window.netflixSkipperCSLoaded = true;

    const pageScript = document.createElement('script');
    pageScript.src = chrome.runtime.getURL('src/page.js');
    pageScript.onload = function () {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(pageScript);


    function sendVideoScenes(data) {
        document.dispatchEvent(new CustomEvent('NS-loadVideoScenes', {
            detail: data
        }));
    }

    document.addEventListener('NS-requestVideoScenes', function (e) {
        const filename = e.detail.filename;
        $.getJSON(chrome.runtime.getURL(filename), function (data) {
            console.debug("Loaded " + data.name + " (" + data.scenes.length + " scenes) from extension.");
            sendVideoScenes({filename: filename, ...data});
        }).fail(function (data) {
            $.getJSON("https://gitcdn.xyz/repo/Nebual/netflix-skipper/master/" + filename, function (data) {
                console.debug("Loaded " + data.name + " (" + data.scenes.length + " scenes) from Web repo.");
                sendVideoScenes({filename: filename, ...data});
            });
        });
    });

    function reloadSettings() {
        chrome.storage.local.get(["enableSkipping", "sexThreshold", "bloodThreshold", "violenceThreshold", "suicideThreshold", "needleThreshold"], function (data) {
            document.dispatchEvent(new CustomEvent('NS-loadSettings', {
                detail: data
            }));
        });
    }

    document.addEventListener('NS-initializedPlayer', reloadSettings);

    // interaction with the popup
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.type === 'reloadSettings') {
            reloadSettings();

            sendResponse({});
            return;
        }
        if (request.type === 'skipTo') {
            document.dispatchEvent(new CustomEvent('NS-seek', {
                detail: request.data.time
            }));

            sendResponse({});
            return;
        }
    });
})();
