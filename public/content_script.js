'use strict';

async function getJSON(url) {
    return await (await fetch(url)).json()
}

(function () {
    // make sure the content script is only run once on the page
    if (window.netflixSkipperCSLoaded) {
        return;
    }
    window.netflixSkipperCSLoaded = true;

    const pageScript = document.createElement('script');
    pageScript.src = chrome.runtime.getURL('page.js');
    pageScript.onload = function () {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(pageScript);


    function sendVideoScenes(data) {
        document.dispatchEvent(new CustomEvent('NS-loadVideoScenes', {
            detail: data
        }));
    }

    document.addEventListener('NS-requestVideoScenes', async function (e) {
		const filename = e.detail.filename;
		try {
            const data = await getJSON(chrome.runtime.getURL(filename))

            console.debug('Loaded ' + data.name + ' (' + data.scenes.length + ' scenes) from extension.');
            sendVideoScenes({filename: filename, ...data});
        } catch (e) {
            const webData = await getJSON('https://gitcdn.xyz/repo/Nebual/netflix-skipper/master/' + filename)

            console.debug('Loaded ' + webData.name + ' (' + webData.scenes.length + ' scenes) from Web repo.');
            sendVideoScenes({filename: filename, ...webData});
        }
	});

    function reloadSettings() {
        chrome.storage.local.get(["enableSkipping", "sexThreshold", "bloodThreshold", "violenceThreshold", "suicideThreshold", "needleThreshold"], function (data) {
            document.dispatchEvent(
				new CustomEvent('NS-loadSettings', {
					detail: { ...data, extensionId: chrome.runtime.id },
				})
			);
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
