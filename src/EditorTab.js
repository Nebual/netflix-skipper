import React, { useState, useEffect, useRef } from 'react';

import './PopupWindow.css';
import { IconButton, NowButton, SeekButton, Threshold } from './Buttons';
import { downloadAsFile, sampleScene } from './util';

const chrome = window.chrome;

function prepareForSave(sceneData) {
	return {
		...sceneData,
		scenes: sceneData.scenes
			.sort((a, b) => a.time - b.time)
			.map(({ time, next, ...rest }) => ({ time, next, ...rest })),
	};
}

export default function EditorTab({ sendMessage, setError }) {
	const [currentTime, setCurrentTime] = useState(0);
	const [videoId, setVideoId] = useState(0);
	const [sceneData, setSceneData] = useState(
		chrome.runtime.getURL ? {} : sampleScene
	);
	const isLoadedRef = useRef(false);

	function sendPlayerAction(payload) {
		sendMessage('playerAction', payload, setError);
	}

	useEffect(() => {
		if (videoId && sceneData.scenes) {
			if (isLoadedRef.current) {
				sendPlayerAction({ sceneData: sceneData });
			} else {
				isLoadedRef.current = true;
			}
		} else {
			isLoadedRef.current = false;
		}
	}, [videoId, sceneData]);

	function seekDelta(delta) {
		sendPlayerAction({ delta });
	}
	function seekTime(time, shouldSet = true) {
		if (shouldSet) {
			setCurrentTime(time);
		}
		sendPlayerAction({ time });
	}

	useEffect(() => {
		if (!chrome || !chrome.runtime || !chrome.runtime.onMessageExternal) {
			return;
		}
		function onMessageExternal(message, sender, sendResponse) {
			if (message.currentTime) {
				setCurrentTime(message.currentTime);
			}
			if (message.videoId) {
				isLoadedRef.current = false;
				setVideoId(message.videoId);
			}
			if (message.sceneData) {
				setSceneData(message.sceneData);
			}
		}
		chrome.runtime.onMessageExternal.addListener(onMessageExternal);

		sendPlayerAction({
			getVideoId: true,
			getCurrentTime: true,
			getSceneData: true,
		});

		return () =>
			chrome.runtime.onMessageExternal.removeListener(onMessageExternal);
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
				<SeekButton seekDelta={seekDelta} amount={-60000} label="-1m" />
				<SeekButton seekDelta={seekDelta} amount={-5000} label="-5s" />
				<SeekButton seekDelta={seekDelta} amount={-1000} label="-1s" />
				<button
					type="button"
					onClick={() => sendPlayerAction({ playPauseToggle: true })}
				>
					Play
				</button>
				<SeekButton seekDelta={seekDelta} amount={1000} label="+1s" />
				<SeekButton seekDelta={seekDelta} amount={5000} label="+5s" />
				<SeekButton seekDelta={seekDelta} amount={60000} label="+1m" />
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
							&nbsp;&nbsp;
							{!(
								scene.sex ||
								scene.blood ||
								scene.violence ||
								scene.suicide ||
								scene.needle
							) && (
								<IconButton
									onClick={() =>
										setSceneData((sceneData) => ({
											...sceneData,
											scenes: sceneData.scenes.filter(
												(scene2, i2) => i !== i2
											),
										}))
									}
									icon={<>&#128465;&#65039;</>}
									label="Delete Scene"
								/>
							)}
						</div>
					);
				})}
				<div style={{ display: 'flex' }}>
					<IconButton
						onClick={() =>
							setSceneData((sceneData) => ({
								...sceneData,
								scenes: [
									...sceneData.scenes,
									{
										time: currentTime,
										next: currentTime + 5000,
									},
								],
							}))
						}
						icon={<>&#10133;{/* Plus */}</>}
						label="Create new Scene"
					/>
					<IconButton
						onClick={() => {
							const savable = prepareForSave(sceneData);
							console.log(
								`Downloading scene ${JSON.stringify(savable)}`
							);
							sendPlayerAction({ writeToUrlHash: savable });
							downloadAsFile(
								JSON.stringify(savable, null, 2),
								`${videoId}.json`
							);
						}}
						icon={<>&#128229;{/*Download Icon*/}</>}
						label="Download scene.json"
						style={{ marginLeft: 'auto' }}
					/>
				</div>
			</div>
		</section>
	);
}

function TimeDisplay({ time, onChange, setNow, seekTime, next = false }) {
	return (
		<>
			{!next && <NowButton onClick={setNow} />}
			{next && (
				<IconButton
					onClick={() => seekTime(time)}
					icon={<>&#10145;&#65039;{/*Arrow Right*/}</>}
					label="Jump to Scene Start"
				/>
			)}
			<input
				type="text"
				className="TimeDisplay__Input"
				value={Math.round(time / 10) / 100}
				onChange={(event) => onChange(event.target.value * 1000)}
			/>
			{!next && (
				<IconButton
					onClick={() => seekTime(time)}
					icon={<>&#11013;&#65039;{/*Arrow Left*/}</>}
					label="Jump to Scene End"
				/>
			)}
			{next && <NowButton onClick={setNow} />}
		</>
	);
}
