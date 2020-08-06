import React, { useState, useEffect, useRef } from 'react';

import './PopupWindow.css';
import { IconButton, NowButton, SeekButton, Threshold } from './Buttons';
import { downloadAsFile, sampleScene } from './util';
import TextInput from './TextInput';

const chrome = window.chrome;

const baseThresholds = [
	{
		id: 'sex',
		icon: <>&#127814;</>,
		label: 'Sex / Nudity',
	},
	{
		id: 'blood',
		icon: <>&#129656;</>,
		label: 'Blood / Gore',
	},
	{
		id: 'violence',
		icon: <>&#9876;&#65039;</>,
		label: 'Violence',
	},
	{
		id: 'suffering',
		icon: <>&#128560;</>,
		label: 'Suffering',
	},
	{
		id: 'suicide',
		icon: <>&#128128;</>,
		label: 'Suicide',
	},
	{
		id: 'needle',
		icon: <>&#128137;</>,
		label: 'Use of Needles',
	},
];
const baseThresholdIds = baseThresholds.map(({ id }) => id);

function prepareForSave({ id, scenes, ...sceneData }) {
	return {
		id,
		...sceneData,
		scenes: scenes
			.sort((a, b) => a.time - b.time)
			.map(({ time, next, ...rest }) => ({ time, next, ...rest })),
	};
}

export default function EditorTab({ sendMessage, setError }) {
	const [currentTime, setCurrentTime] = useState(0);
	const [videoId, setVideoId] = useState(0);
	const [sceneData, setSceneData] = useState(
		chrome.runtime.getURL ? { scenes: [] } : sampleScene
	);
	const [newTag, setNewTag] = useState('');
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

	const customThresholds = [
		...new Set([
			...(sceneData.scenes || []).flatMap((scene) =>
				Object.keys(scene.thresholds).filter(
					(thresholdId) => !baseThresholdIds.includes(thresholdId)
				)
			),
			...(newTag && [newTag]),
		]),
	];

	return (
		<section className="editor-section">
			<div className="option-container" style={{ display: 'flex' }}>
				<div style={{ marginLeft: 'auto' }}>
					<label htmlFor="skip-to">Skip to: </label>
					<TextInput
						id="skip-to"
						value={currentTime / 1000}
						setValue={(value) => setCurrentTime(value * 1000)}
						isNumeric
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
				<SeekButton
					seekDelta={seekDelta}
					amount={-15000}
					label="-15s"
				/>
				<SeekButton seekDelta={seekDelta} amount={-5000} label="-5s" />
				<SeekButton seekDelta={seekDelta} amount={-1000} label="-1s" />
				<button
					type="button"
					onClick={() => sendPlayerAction({ playPauseToggle: true })}
					style={{ marginLeft: '1rem', marginRight: '1rem' }}
				>
					Play
				</button>
				<SeekButton seekDelta={seekDelta} amount={1000} label="+1s" />
				<SeekButton seekDelta={seekDelta} amount={5000} label="+5s" />
				<SeekButton seekDelta={seekDelta} amount={15000} label="+15s" />
				<SeekButton seekDelta={seekDelta} amount={60000} label="+1m" />
			</div>
			<div className="scenes-list">
				{(sceneData.scenes || []).map((scene, i) => {
					function updateScene(changes) {
						setSceneData((sceneData) => ({
							...sceneData,
							scenes: sceneData.scenes.map((scene2, i2) =>
								i === i2 ? { ...scene2, ...changes } : scene2
							),
						}));
					}
					function updateThreshold(changes) {
						setSceneData((sceneData) => ({
							...sceneData,
							scenes: sceneData.scenes.map((scene2, i2) =>
								i === i2
									? {
											...scene2,
											thresholds: {
												...scene2.thresholds,
												...changes,
											},
									  }
									: scene2
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
							{baseThresholds.map(({ id, icon, label }) => (
								<Threshold
									key={`baseThreshold-${id}`}
									value={scene.thresholds[id]}
									setValue={(value) =>
										updateThreshold({ [id]: value })
									}
									icon={icon}
									label={label}
								/>
							))}
							{customThresholds.map((id) => (
								<Threshold
									key={`customThreshold-${id}`}
									value={scene.thresholds[id]}
									setValue={(value) =>
										updateThreshold({ [id]: value })
									}
									icon={
										<span
											style={{
												fontSize: '9px',
												margin: '2px',
											}}
										>
											{id.substr(0, 3)}
										</span>
									}
									label={id}
								/>
							))}
							&nbsp;&nbsp;
							{Object.values(scene.thresholds).filter(
								(value) => value > 0
							).length === 0 && (
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
					<span style={{ fontSize: '10px' }}>
						<IconButton
							onClick={() =>
								setSceneData((sceneData) => ({
									...sceneData,
									scenes: [
										...sceneData.scenes,
										{
											time: currentTime,
											next: currentTime + 5000,
											thresholds: {},
										},
									],
								}))
							}
							icon={<>&#10133;{/* Plus */}</>}
							label="Create new Scene"
						/>{' '}
						New Scene
					</span>
					<span
						style={{
							marginLeft: 'auto',
							marginRight: '2rem',
							fontSize: '10px',
						}}
					>
						New Custom Tag:&nbsp;
						<input
							type="text"
							value={newTag}
							onChange={(e) => setNewTag(e.target.value)}
							style={{ width: '7rem' }}
						/>
					</span>
					<IconButton
						onClick={() => {
							const savable = prepareForSave({
								...sceneData,
								id: videoId,
							});
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
					/>
				</div>
			</div>
		</section>
	);
}

function TimeDisplay({ time, onChange, setNow, seekTime, next = false }) {
	return (
		<>
			{!next && <NowButton onClick={setNow} next={next} />}
			{next && (
				<IconButton
					onClick={() => seekTime(time)}
					icon={<>&#10145;&#65039;{/*Arrow Right*/}</>}
					label="Jump to Scene End"
				/>
			)}
			<TextInput
				className="TimeDisplay__Input"
				value={Math.round(time / 10) / 100}
				setValue={(value) => onChange(value * 1000)}
				isNumeric
			/>
			{!next && (
				<IconButton
					onClick={() => seekTime(time)}
					icon={<>&#11013;&#65039;{/*Arrow Left*/}</>}
					label="Jump to Scene Start"
				/>
			)}
			{next && <NowButton onClick={setNow} next={next} />}
		</>
	);
}
