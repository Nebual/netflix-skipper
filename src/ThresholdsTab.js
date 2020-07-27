import React, { useState, useEffect } from 'react';
import Select from 'react-select';

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

export default function ThresholdsTab({ sendReload, setError }) {
	const [sex, setSex] = useExtensionStorage('sexThreshold', '2');
	const [blood, setBlood] = useExtensionStorage('bloodThreshold', '2');
	const [violence, setViolence] = useExtensionStorage(
		'violenceThreshold',
		'2'
	);
	const [suicide, setSuicide] = useExtensionStorage('suicideThreshold', '2');
	const [needle, setNeedle] = useExtensionStorage('needleThreshold', '0');

	useEffect(sendReload, [sex, blood, violence, suicide, needle]);

	return (
		<section>
			<h3>Content Thresholds</h3>
			<div className="option-container">
				<label htmlFor="sex-threshold">Sex + Nudity</label>
				<Select
					id="sex-threshold"
					className="select"
					options={sexOptions}
					value={sexOptions.find(({ value }) => value === sex)}
					onChange={({ value }) => setSex(value)}
				/>
			</div>
			<div className="option-container">
				<label htmlFor="blood-threshold">Blood</label>
				<Select
					id="blood-threshold"
					className="select"
					options={bloodOptions}
					value={bloodOptions.find(({ value }) => value === blood)}
					onChange={({ value }) => setBlood(value)}
				/>
			</div>
			<div className="option-container">
				<label htmlFor="violence-threshold">Violence</label>
				<Select
					id="violence-threshold"
					className="select"
					options={violenceOptions}
					value={violenceOptions.find(
						({ value }) => value === violence
					)}
					onChange={({ value }) => setViolence(value)}
				/>
			</div>
			<div className="option-container">
				<label htmlFor="suicide-threshold">Suicide</label>
				<Select
					id="suicide-threshold"
					className="select"
					options={suicideOptions}
					value={suicideOptions.find(
						({ value }) => value === suicide
					)}
					onChange={({ value }) => setSuicide(value)}
				/>
			</div>
			<div className="option-container">
				<label htmlFor="needle-threshold">Needles</label>
				<Select
					id="needle-threshold"
					className="select"
					options={needleOptions}
					value={needleOptions.find(({ value }) => value === needle)}
					onChange={({ value }) => setNeedle(value)}
				/>
			</div>
		</section>
	);
}
