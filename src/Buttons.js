import React from 'react';

export function SeekButton({ seekDelta, amount, label }) {
	return (
		<button type="button" onClick={() => seekDelta(amount)}>
			{label}
		</button>
	);
}

export function NowButton({ onClick }) {
	return (
		<span
			className="IconButton IconButton--setNow"
			title="Set to Current Play Time"
			aria-label="Set to Current Play Time"
			onClick={onClick}
			role="img"
		>
			<span className="non-hover">&#128347;</span>
			<span className="hover">&#9997;</span>
		</span>
	);
}

export function JumpButton({ onClick, icon }) {
	return (
		<span
			className="IconButton"
			title="Seek to Time"
			aria-label="Seek to Time"
			onClick={onClick}
			role="img"
		>
			{icon}
		</span>
	);
}

export function Threshold({ value, setValue, icon, label, max = 3 }) {
	value = value || 0;
	return (
		<span
			className={`IconButton IconButton--threshold-${value}`}
			title={`${label} ${value}/${max}`}
			aria-label={label}
			onClick={(e) => {
				setValue(value < max ? value + 1 : 0);
			}}
			role="img"
		>
			{icon}
		</span>
	);
}
