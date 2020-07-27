import React, { useState, useEffect } from 'react';

import './PopupWindow.css';
import { chromeStorageLocalGetPromise } from './storagePromises';
import { JumpButton, NowButton, SeekButton, Threshold } from './Buttons';

const chrome = window.chrome;

async function getJSON(url) {
	return await (await fetch(url)).json();
}

async function readScenes(videoId) {
	const filename = 'scenes/' + videoId + '.json';
	const cachedFilename = 'NS/' + filename;

	const cached = await chromeStorageLocalGetPromise([cachedFilename]);
	if (cached[cachedFilename]) {
		console.debug(
			'readScenes: using cached result',
			cachedFilename,
			cached
		);
		return JSON.parse(cached[cachedFilename]);
	}
	const data = await readScenesUncached(filename);
	chrome.storage.local.set({ [cachedFilename]: JSON.stringify(data) });
	return data;
}
async function readScenesUncached(filename) {
	try {
		return await getJSON(chrome.runtime.getURL(filename));
	} catch (e) {
		console.debug(
			`Failed to fetch scenes for ${filename} from extension, trying Github`,
			e
		);
		return await getJSON(
			'https://gitcdn.xyz/repo/Nebual/netflix-skipper/master/' + filename
		);
	}
}

export default function EditorTab({ sendMessage, setError }) {
	const [currentTime, setCurrentTime] = useState(0);
	const [videoId, setVideoId] = useState(0);
	const [sceneData, setSceneData] = useState({});

	useEffect(() => {
		if (!videoId) {
			return;
		}
		async function getScenes() {
			const data = await readScenes(videoId);
			setSceneData(data);
		}
		getScenes();
	}, [videoId]);

	function seekDelta(delta) {
		sendMessage('playerAction', { delta }, setError);
	}
	function seekTime(time, shouldSet = true) {
		if (shouldSet) {
			setCurrentTime(time);
		}
		sendMessage('playerAction', { time }, setError);
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
			if (message.videoId) {
				setVideoId(message.videoId);
			}
		}
		window.chrome.runtime.onMessageExternal.addListener(onMessageExternal);
		return () =>
			window.chrome.runtime.onMessageExternal.removeListener(
				onMessageExternal
			);
	}, []);

	useEffect(() => {
		sendMessage('playerAction', { getVideoId: true }, setError);
	}, []);

	return (
		<section className="editor-section">
			<div className="option-container">
				<label htmlFor="skip-to">Skip to (ms)</label>
				<div style={{ display: 'flex' }}>
					<input
						type="text"
						id="skip-to"
						value={currentTime / 1000}
						onChange={(event) =>
							setCurrentTime(event.target.value * 1000)
						}
					/>
					<button
						type="button"
						onClick={() => seekTime(currentTime, false)}
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
			<div>
				{(sceneData.scenes || []).map((scene, i) => {
					function updateScene(changes) {
						setSceneData((sceneData) => ({
							...sceneData,
							scenes: sceneData.scenes.map((scene2, i2) =>
								i === i2 ? { ...scene2, ...changes } : scene2
							),
						}));
					}
					return (
						<div key={`scene-${scene.time}`}>
							<div
								style={{
									display: 'inline-block',
									marginRight: '0.5rem',
								}}
							>
								<TimeDisplay
									time={scene.time}
									onChange={(value) =>
										updateScene({ time: value })
									}
									setNow={() =>
										updateScene({ time: currentTime })
									}
									seekTime={seekTime}
								/>
								{' - '}
								<TimeDisplay
									time={scene.next}
									next
									onChange={(value) =>
										updateScene({ next: value })
									}
									setNow={() =>
										updateScene({ next: currentTime })
									}
									seekTime={seekTime}
								/>
							</div>
							<Threshold
								value={scene.sex}
								setValue={(value) =>
									updateScene({ sex: value })
								}
								icon={<>&#127814;</>}
								label="Sex / Nudity"
							/>
							<Threshold
								value={scene.blood}
								setValue={(value) =>
									updateScene({ blood: value })
								}
								icon={<>&#129656;</>}
								label="Blood / Gore"
							/>
							<Threshold
								value={scene.violence}
								setValue={(value) =>
									updateScene({ violence: value })
								}
								icon={<>&#9876;&#65039;</>}
								label="Violence"
							/>
							<Threshold
								value={scene.suicide}
								setValue={(value) =>
									updateScene({ suicide: value })
								}
								icon={<>&#128128;</>}
								label="Suicide"
							/>
							<Threshold
								value={scene.needle}
								setValue={(value) =>
									updateScene({ needle: value })
								}
								icon={<>&#128137;</>}
								label="Use of Needles"
							/>
						</div>
					);
				})}
			</div>
		</section>
	);
}

function TimeDisplay({ time, onChange, setNow, seekTime, next = false }) {
	return (
		<>
			{!next && <NowButton onClick={setNow} />}
			{next && (
				<JumpButton
					onClick={() => seekTime(time)}
					icon={<>&#10145;&#65039;{/*Arrow Right*/}</>}
				/>
			)}
			<input
				type="text"
				className="TimeDisplay__Input"
				value={Math.round(time / 10) / 100}
				onChange={(event) => onChange(event.target.value * 1000)}
			/>
			{!next && (
				<JumpButton
					onClick={() => seekTime(time)}
					icon={<>&#11013;&#65039;{/*Arrow Left*/}</>}
				/>
			)}
			{next && <NowButton onClick={setNow} />}
		</>
	);
}
