import { useState, useEffect } from 'react';

export function useExtensionStorage(id, def) {
	const [state, setState] = useState(def);
	useEffect(() => {
		if (window.chrome && window.chrome.storage) {
			window.chrome.storage.local.get({ [id]: -1 }, function (data) {
				if (data[id] === -1) {
					updateState(def);
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

export function useThresholdStorage(id, def) {
	const [state, setState] = useState(def);
	useEffect(() => {
		if (window.chrome && window.chrome.storage) {
			window.chrome.storage.local.get({ thresholds: {} }, function ({
				thresholds,
			}) {
				if (thresholds[id] === undefined) {
					thresholds[id] = def;
					if (window.chrome && window.chrome.storage) {
						window.chrome.storage.local.set({ thresholds });
					}
				}
				setState(thresholds[id]);
			});
		}
	}, [id, def]);

	function updateThreshold(newState) {
		setState(newState);
		if (window.chrome && window.chrome.storage) {
			window.chrome.storage.local.get({ thresholds: {} }, function ({
				thresholds,
			}) {
				thresholds[id] = newState;
				window.chrome.storage.local.set({ thresholds });
			});
		}
	}

	return [state, updateThreshold];
}
