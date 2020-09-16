import React, { useState, useEffect } from 'react';

import { useThresholdStorage } from './hooks';
import { sampleScene, baseThresholds } from './util';
import { Threshold } from './Buttons';
import Select from "./Select";

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
const sufferingOptions = [
	{ value: '0', label: 'No implication' },
	{ value: '1', label: 'Mild (eg. implication of)' },
	{ value: '2', label: 'Moderate' },
	{ value: '3', label: 'High' },
];
const needleOptions = [
	{ value: '0', label: 'No needles' },
	{ value: '3', label: 'Show use of needles' },
];

export default function ThresholdsTab({ sendReload, setError }) {
	const [sex, setSex] = useThresholdStorage('sex', '2');
	const [blood, setBlood] = useThresholdStorage('blood', '2');
	const [violence, setViolence] = useThresholdStorage('violence', '2');
	const [suffering, setSuffering] = useThresholdStorage('suffering', '2');
	const [suicide, setSuicide] = useThresholdStorage('suicide', '2');
	const [needle, setNeedle] = useThresholdStorage('needle', '0');

	useEffect(sendReload, [sex, blood, violence, suffering, suicide, needle]);

	const [sceneData, setSceneData] = useState(
		window.chrome.runtime.getURL ? { scenes: [] } : sampleScene
	);

	useEffect(() => {
		if (!window.chrome || !window.chrome.tabs) {
			return;
		}

		function onMessageExternal(message, sender, sendResponse) {
			if (message.sceneData) {
				setSceneData(message.sceneData);
			}
		}
		window.chrome.runtime.onMessageExternal.addListener(onMessageExternal);

		return () => {
			window.chrome.runtime.onMessageExternal.removeListener(
				onMessageExternal
			);
		};
	}, []);

	function ThresholdIndicator({ id, sceneData, value }) {
		const threshold = baseThresholds.find(
			(threshold) => threshold.id === id
		);
		const thresholdAmounts = sceneData.scenes
			.map((scene) => scene.thresholds[id])
			.filter((val) => val);
		if (thresholdAmounts.length === 0) {
			return null;
		}
		const min = Math.min(...thresholdAmounts);
		const max = Math.max(...thresholdAmounts);
		return (
			<>
				<Threshold
					value={min}
					icon={threshold.icon}
					label={threshold.label}
					className={`margin-left-auto margin-right-2 ${value < min && 'threshold-grey'}`}
				/>
				{max > min && (
					<Threshold
						value={max}
						icon={threshold.icon}
						label={threshold.label}
						className={`margin-right-2 ${value < max && 'threshold-grey'}`}
					/>
				)}
			</>
		);
	}

	return (
		<section>
			<h3>Content Thresholds</h3>
			<div className="option-container">
				<label htmlFor="sex-threshold">Sex + Nudity</label>
				<ThresholdIndicator
					id="sex"
					sceneData={sceneData}
					value={sex}
				/>
				<Select
					id="sex-threshold"
					options={sexOptions}
					value={sexOptions.find(({ value }) => value === sex)}
					onChange={({ value }) => setSex(value)}
				/>
			</div>
			<div className="option-container">
				<label htmlFor="blood-threshold">Blood</label>
				<ThresholdIndicator
					id="blood"
					sceneData={sceneData}
					value={blood}
				/>
				<Select
					id="blood-threshold"
					options={bloodOptions}
					value={bloodOptions.find(({ value }) => value === blood)}
					onChange={({ value }) => setBlood(value)}
				/>
			</div>
			<div className="option-container">
				<label htmlFor="violence-threshold">Violence</label>
				<ThresholdIndicator
					id="violence"
					sceneData={sceneData}
					value={violence}
				/>
				<Select
					id="violence-threshold"
					options={violenceOptions}
					value={violenceOptions.find(
						({ value }) => value === violence
					)}
					onChange={({ value }) => setViolence(value)}
				/>
			</div>
			<div className="option-container">
				<label htmlFor="suffering-threshold">Suffering</label>
				<ThresholdIndicator
					id="suffering"
					sceneData={sceneData}
					value={suffering}
				/>
				<Select
					id="suffering-threshold"
					options={sufferingOptions}
					value={sufferingOptions.find(
						({ value }) => value === suffering
					)}
					onChange={({ value }) => setSuffering(value)}
				/>
			</div>
			<div className="option-container">
				<label htmlFor="suicide-threshold">Suicide</label>
				<ThresholdIndicator
					id="suicide"
					sceneData={sceneData}
					value={suicide}
				/>
				<Select
					id="suicide-threshold"
					options={suicideOptions}
					value={suicideOptions.find(
						({ value }) => value === suicide
					)}
					onChange={({ value }) => setSuicide(value)}
				/>
			</div>
			<div className="option-container">
				<label htmlFor="needle-threshold">Needles</label>
				<ThresholdIndicator
					id="needle"
					sceneData={sceneData}
					value={needle}
				/>
				<Select
					id="needle-threshold"
					options={needleOptions}
					value={needleOptions.find(({ value }) => value === needle)}
					onChange={({ value }) => setNeedle(value)}
				/>
			</div>
		</section>
	);
}
