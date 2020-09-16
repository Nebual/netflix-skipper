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

function sendToPage(eventId, detail) {
	window.postMessage(
		{
			direction: 'from-content-script',
			eventId,
			detail,
		},
		'https://www.netflix.com'
	);
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
		sendToPage('NS-playerAction', { sceneData: data });
	}

    document.addEventListener('NS-requestVideoScenes', async function (e) {
		const filename = e.detail.filename;
		try {
            const data = await getJSON(chrome.runtime.getURL(filename))

            console.debug('Loaded ' + data.name + ' (' + data.scenes.length + ' scenes) from extension.');
            sendVideoScenes(data);
        } catch (e) {
			try {
				const webData = await getJSON('https://gitcdn.xyz/repo/Nebual/netflix-skipper/master/' + filename)

				console.debug('Loaded ' + webData.name + ' (' + webData.scenes.length + ' scenes) from Web repo.');
				sendVideoScenes(webData);
			} catch (e) {
				console.debug('NS: Unable to find scene data', filename);
			}
        }
	});

    function reloadSettings() {
        if (!chrome.storage.local) {
			console.warn('Failed to reloadSettings: no chrome.storage.local');
			return;
		}
        chrome.storage.local.get(["enableSkipping", "thresholds"], function (data) {
			sendToPage('NS-loadSettings', {
				...data,
				extensionId: chrome.runtime.id,
			});
        });
    }

    document.addEventListener('NS-initializedPlayer', reloadSettings);

	// receiving from the page
	window.addEventListener("message", function(event) {
		if (event.source !== window || !event.data || event.data.direction !== "from-page-script") {
			return;
		}
		if (event.data.destination === 'background' || event.data.destination === "popupWindow") {
			chrome.runtime.sendMessage({...event.data});
		}
	})

    // interaction with the popup
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.type === 'reloadSettings') {
            reloadSettings();

            sendResponse({});
            return;
        }
		if (request.type === 'playerAction') {
			sendToPage('NS-playerAction', request.data);

			sendResponse({});
			return;
		}
    });
})();
