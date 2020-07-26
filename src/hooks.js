import { useState, useEffect } from 'react';

export function useExtensionStorage(id, def) {
	const [state, setState] = useState(def);
	useEffect(() => {
		if (window.chrome && window.chrome.storage) {
			window.chrome.storage.local.get({[id]: -1}, function(data) {
				if (data[id] === -1) {
					updateState(def)
				} else {
					setState(data[id]);
				}
			});
		}
	}, [id, def]);

	function updateState(newState) {
		setState(newState);
		if (window.chrome && window.chrome.storage) {
			window.chrome.storage.local.set({
				[id]: newState,
			});
		}
	}

	return [state, updateState];
}
