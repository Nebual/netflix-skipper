import React, { useState, useEffect, useRef } from 'react';

import './PopupWindow.css';
import { useExtensionStorage } from './hooks';
import EditorTab from './EditorTab';
import ThresholdsTab from './ThresholdsTab';
import { waitFor } from './util';

export default function PopupWindow() {
	const [error, setError] = useState('');
	const [editorMode, setEditorMode] = useExtensionStorage(
		'editorMode',
		false
	);
	const [enableSkipping, setEnableSkipping] = useExtensionStorage(
		'enableSkipping',
		true
	);

	useEffect(sendReload, [enableSkipping]);

	const tabRef = useRef();
	useEffect(() => {
		if (!window.chrome || !window.chrome.tabs) {
			return;
		}
		window.chrome.tabs.query(
			{
				active: true,
				currentWindow: true,
			},
			function (tabs) {
				tabRef.current = tabs[0];
			}
		);
	}, []);

	// send a message to the content script
	async function sendMessage(type, data, showError, callback) {
		const tab = await waitFor(() => tabRef.current);
		if (!window.chrome || !window.chrome.tabs || !tab) {
			return;
		}
		window.chrome.tabs.executeScript(
			tab.id,
			{ file: 'content_script.js' },
			() =>
				window.chrome.tabs.sendMessage(
					tab.id,
					{ type: type, data: data },
					(response) => {
						if (response && response.errorMessage) {
							showError(response.errorMessage);
							return;
						}
						if (callback) {
							// this is pretty limited in use as page.js can't return anything
							callback(response);
						}
					}
				)
		);
	}

	function sendReload() {
		sendMessage('reloadSettings', {}, setError);
	}

	return (
		<div className="App">
			<header className="header">
				<h2>
					Netflix Skipper Settings
					<span
						className={`IconButton ${
							editorMode && 'IconButton--active'
						}`}
						id="editor-mode-toggle"
						style={{ float: 'right' }}
						title="Toggle Editor Mode"
						onClick={() => setEditorMode(!editorMode)}
						role="img"
						aria-label="Toggle Editor Mode"
					>
						&#127912;
					</span>
				</h2>
				<p>
					<label>
						<input
							type="checkbox"
							id="enable-skipping"
							checked={enableSkipping}
							onChange={() => setEnableSkipping(!enableSkipping)}
						/>{' '}
						Enable Skipping
					</label>
				</p>
			</header>
			{error && (
				<section>
					<p className="error">{error}</p>
					<p>
						<button type="button" onClick={() => setError('')}>
							Dismiss
						</button>
					</p>
				</section>
			)}
			{!editorMode ? (
				<ThresholdsTab sendReload={sendReload} sendMessage={sendMessage} setError={setError} />
			) : (
				<EditorTab sendMessage={sendMessage} setError={setError} />
			)}
		</div>
	);
}
