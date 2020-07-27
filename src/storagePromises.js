export function chromeStorageLocalGetPromise(keys) {
	return new Promise((resolve, reject) => {
		window.chrome.storage.local.get(keys, (items) => {
			let err = window.chrome.runtime.lastError;
			if (err) {
				reject(err);
			} else {
				resolve(items);
			}
		});
	});
}
