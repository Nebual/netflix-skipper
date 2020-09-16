chrome.runtime.onInstalled.addListener(function() {
	chrome.declarativeContent.onPageChanged.addRules([
		{
			conditions: [
				new chrome.declarativeContent.PageStateMatcher({
					pageUrl: { hostEquals: 'www.netflix.com' },
				}),
				new chrome.declarativeContent.PageStateMatcher({
					pageUrl: { hostEquals: 'plex.nebtown.info' },
				}),
			],
			actions: [new chrome.declarativeContent.ShowPageAction()],
		},
	]);
});

// const tvdbBaseUrl = 'https://tvdbapiproxy.leonekmi.fr'; // proxy allowing CORS
const tvdbBaseUrl = 'https://api.thetvdb.com';
const tvdbApiKey = '8a' + 2 * 2 + '025841b1' + (774 + 1) + 'c4ef62d4f8b6c68217'; // confuse github crawlers a little

let tvdbJWT = '';

async function refreshTVDBJWT() {
	const response = await fetch(tvdbBaseUrl + '/login', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
		},
		body: JSON.stringify({
			apikey: tvdbApiKey,
		}),
	});
	const json = await response.json();
	tvdbJWT = json.token;
}

chrome.runtime.onMessageExternal.addListener(async function(
	request,
	sender,
	sendResponse
) {
	if (request.contentScriptQuery === 'queryTVDB') {
		await refreshTVDBJWT();

		const response = await fetch(
			tvdbBaseUrl + '/search/series?name=' + request.name,
			{
				method: 'GET',
				headers: {
					Accept: 'application/json',
					Authorization: 'Bearer ' + tvdbJWT,
				},
			}
		);
		const json = await response.json();

		console.log('background response', json);
		sendResponse(json);
		return;
	}
	if (request.contentScriptQuery === 'setIconStatus') {
		if (request.active) {
			chrome.pageAction.setIcon({ tabId: sender.tab.id, path: '/icon_128.png' });
		} else {
			chrome.pageAction.setIcon({ tabId: sender.tab.id, path: '/icon_inactive_128.png' });
		}
		sendResponse({});
		return;
	}
	console.debug("NS: background received unknown request", request, sender)
	sendResponse({ error: 'unknown request' });
});
