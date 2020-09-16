chrome.runtime.onInstalled.addListener(function() {
	chrome.declarativeContent.onPageChanged.addRules([
		{
			conditions: [
				new chrome.declarativeContent.PageStateMatcher({
					pageUrl: { hostEquals: 'www.netflix.com' },
				}),
			],
			actions: [new chrome.declarativeContent.ShowPageAction()],
		},
	]);
});

chrome.runtime.onMessageExternal.addListener(async function(
	request,
	sender,
	sendResponse
) {
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
