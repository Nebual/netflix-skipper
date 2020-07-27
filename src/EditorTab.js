import React, { useState, useEffect } from 'react';

import './PopupWindow.css';

function SeekButton({ seekDelta, amount, label }) {
	return (
		<button type="button" onClick={() => seekDelta(amount)}>
			{label}
		</button>
	);
}

export default function EditorTab({ sendMessage, setError }) {
	const [currentTime, setCurrentTime] = useState(0);

	function seekDelta(delta) {
		sendMessage('playerAction', { delta }, setError);
	}

	useEffect(() => {
		if (
			!window.chrome ||
			!window.chrome.runtime ||
			!window.chrome.runtime.onMessageExternal
		) {
			return;
		}
		function onMessageExternal(message, sender, sendResponse) {
			if (message.currentTime) {
				setCurrentTime(message.currentTime);
			}
		}
		window.chrome.runtime.onMessageExternal.addListener(onMessageExternal);
		return () =>
			window.chrome.runtime.onMessageExternal.removeListener(
				onMessageExternal
			);
	}, []);

	return (
		<section>
			<div className="option-container">
				<label htmlFor="skip-to">Skip to (ms)</label>
				<div style={{ display: 'flex' }}>
					<input
						type="text"
						id="skip-to"
						value={currentTime}
						onChange={(event) => setCurrentTime(event.target.value)}
					/>
					<button
						type="button"
						onClick={() =>
							sendMessage(
								'playerAction',
								{ time: currentTime },
								setError
							)
						}
					>
						Seek
					</button>
				</div>
			</div>
			<div
				className="option-container"
				style={{
					display: 'flex',
				}}
			>
				<SeekButton seekDelta={seekDelta} amount={-5000} label="-5s" />
				<SeekButton seekDelta={seekDelta} amount={-1000} label="-1s" />
				<button
					type="button"
					onClick={() =>
						sendMessage('playerAction', { playPauseToggle: true })
					}
				>
					Play
				</button>
				<SeekButton seekDelta={seekDelta} amount={1000} label="+1s" />
				<SeekButton seekDelta={seekDelta} amount={5000} label="+5s" />
			</div>
		</section>
	);
}
