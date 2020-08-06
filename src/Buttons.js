import React from 'react';

export function SeekButton({ seekDelta, amount, label }) {
	return (
		<button type="button" onClick={() => seekDelta(amount)}>
			{label}
		</button>
	);
}

export function NowButton({ onClick, next }) {
	return (
		<span
			className="IconButton IconButton--setNow"
			title="Set to Current Play Time"
			aria-label="Set to Current Play Time"
			onClick={onClick}
			role="img"
		>
			<span className="non-hover">
				{next ? <>&#128340;</> : <>&#128344;</>}
			</span>
			<span className="hover">&#9997;</span>
		</span>
	);
}

export function IconButton({ onClick, icon, label, style }) {
	return (
		<span
			className="IconButton"
			title={label}
			aria-label={label}
			onClick={onClick}
			role="img"
			style={style}
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
