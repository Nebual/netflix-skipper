'use strict';

async function getJSON(url) {
    return await (await fetch(url)).json()
}

function loadScript(scriptUrl) {
	const script = document.createElement('script');
	script.src = scriptUrl;
	script.onload = function () {
		this.remove();
	};
	(document.head || document.documentElement).appendChild(script);
}

(function () {
    // make sure the content script is only run once on the page
    if (window.netflixSkipperCSLoaded) {
        return;
    }
    window.netflixSkipperCSLoaded = true;

	loadScript(chrome.runtime.getURL('vendor/lz-string.js'));
	loadScript(chrome.runtime.getURL('page.js'));

	function sendVideoScenes(data) {
		document.dispatchEvent(
			new CustomEvent('NS-playerAction', {
				detail: { sceneData: data },
			})
		);
	}

    document.addEventListener('NS-requestVideoScenes', async function (e) {
		const filename = e.detail.filename;
		try {
            const data = await getJSON(chrome.runtime.getURL(filename))

            console.debug('Loaded ' + data.name + ' (' + data.scenes.length + ' scenes) from extension.');
            sendVideoScenes(data);
        } catch (e) {
            const webData = await getJSON('https://gitcdn.xyz/repo/Nebual/netflix-skipper/master/' + filename)

            console.debug('Loaded ' + webData.name + ' (' + webData.scenes.length + ' scenes) from Web repo.');
            sendVideoScenes(webData);
        }
	});

    function reloadSettings() {
        if (!chrome.storage.local) {
			console.warn('Failed to reloadSettings: no chrome.storage.local');
			return;
		}
        chrome.storage.local.get(["enableSkipping", "thresholds"], function (data) {
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
		if (request.type === 'playerAction') {
			document.dispatchEvent(
				new CustomEvent('NS-playerAction', {
					detail: request.data,
				})
			);

			sendResponse({});
			return;
		}
    });
})();
