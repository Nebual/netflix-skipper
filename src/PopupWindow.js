import React, {useState, useEffect, useRef} from 'react';
import Select from 'react-select';

import './PopupWindow.css';
import { useExtensionStorage } from './hooks';

const sexOptions = [
	{ value: '0', label: 'No nude content (you prude)' },
	{ value: '1', label: 'Softcore (eg. nudity)' },
	{ value: '2', label: 'Semi-hardcore (eg. off-camera sex)' },
	{ value: '3', label: 'Hardcore' },
];
const bloodOptions = [
	{ value: '0', label: 'No blood' },
	{ value: '1', label: 'Mild (eg. obviously fake)' },
	{ value: '2', label: 'Moderate (implied severe injury, medical)' },
	{ value: '3', label: 'High (graphic surgery, graphic severe injury)' },
];
const violenceOptions = [
	{ value: '0', label: 'No violence (possibly some name calling)' },
	{ value: '1', label: 'Mild (eg. comic book punches, shooting off camera)' },
	{ value: '2', label: 'Moderate (eg. large shootout)' },
	{ value: '3', label: 'High' },
];
const suicideOptions = [
	{ value: '0', label: 'No mention' },
	{ value: '1', label: 'Mild (eg. discussion of)' },
	{ value: '2', label: 'Moderate (eg. non-graphic failed attempt)' },
	{ value: '3', label: 'High' },
];
const needleOptions = [
	{ value: '0', label: 'No needles' },
	{ value: '3', label: 'Show use of needles' },
];

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
	const [sex, setSex] = useExtensionStorage('sexThreshold', '2');
	const [blood, setBlood] = useExtensionStorage('bloodThreshold', '2');
	const [violence, setViolence] = useExtensionStorage('violenceThreshold', '2');
	const [suicide, setSuicide] = useExtensionStorage('suicideThreshold', '2');
	const [needle, setNeedle] = useExtensionStorage('needleThreshold', '0');

	useEffect(() => {
		sendMessage('reloadSettings', {}, setError);
	}, [enableSkipping, sex, blood, violence, suicide, needle]);

	const tabRef = useRef()
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
				tabRef.current = tabs[0]
			}
		);
	}, []);

// send a message to the content script
	function sendMessage(type, data, showError, callback) {
		const tab = tabRef.current;
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
						if (response.errorMessage) {
							showError(response.errorMessage);
							return;
						}
						if (callback) {
							callback(response);
						}
					}
				)
		);
	}

	return (
		<div className="App">
			<header className="header">
				<h2>
					Netflix Skipper Settings
					<span
						className="IconButton"
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
			{error ? (
				<section>
					<p className="error">{error}</p>
					<p>
						<button type="button" onClick={() => setError('')}>
							Dismiss
						</button>
					</p>
				</section>
			) : (
				<section>
					<h3>Content Thresholds</h3>
					<div className="option-container">
						<label htmlFor="sex-threshold">Sex + Nudity</label>
						<Select
							id="sex-threshold"
							className="select"
							options={sexOptions}
							value={sexOptions.find(({value}) => value === sex)}
							onChange={({ value }) => setSex(value)}
						/>
					</div>
					<div className="option-container">
						<label htmlFor="blood-threshold">Blood</label>
						<Select
							id="blood-threshold"
							className="select"
							options={bloodOptions}
							value={bloodOptions.find(({value}) => value === blood)}
							onChange={({ value }) => setBlood(value)}
						/>
					</div>
					<div className="option-container">
						<label htmlFor="violence-threshold">Violence</label>
						<Select
							id="violence-threshold"
							className="select"
							options={violenceOptions}
							value={violenceOptions.find(({value}) => value === violence)}
							onChange={({ value }) => setViolence(value)}
						/>
					</div>
					<div className="option-container">
						<label htmlFor="suicide-threshold">Suicide</label>
						<Select
							id="suicide-threshold"
							className="select"
							options={suicideOptions}
							value={suicideOptions.find(({value}) => value === suicide)}
							onChange={({ value }) => setSuicide(value)}
						/>
					</div>
					<div className="option-container">
						<label htmlFor="needle-threshold">Needles</label>
						<Select
							id="needle-threshold"
							className="select"
							options={needleOptions}
							value={needleOptions.find(({value}) => value === needle)}
							onChange={({ value }) => setNeedle(value)}
						/>
					</div>

					{editorMode && (
						<>
							<div className="option-container">
								<label htmlFor="skip-to">Skip to (ms)</label>
								<input
									type="text"
									id="skip-to"
									onChange={(value) => {
										sendMessage(
											'skipTo',
											{ time: value },
											setError
										);
									}}
								/>
							</div>
						</>
					)}
				</section>
			)}
		</div>
	);
}
