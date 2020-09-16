chrome.runtime.onInstalled.addListener(function() {
	if (chrome.declarativeContent) {
		// Chrome only; Firefox doesn't have this API, but uses manifest.page_action.show_matches instead
		chrome.declarativeContent.onPageChanged.addRules([
			{
				conditions: [
					new chrome.declarativeContent.PageStateMatcher({
						pageUrl: {hostEquals: 'www.netflix.com'},
					}),
				],
				actions: [new chrome.declarativeContent.ShowPageAction()],
			},
		]);
	}
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	if (request.destination !== 'background') {
		return;
	}
	const detail = request.detail;

	if (detail.contentScriptQuery === 'setIconStatus') {
		if (detail.active) {
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