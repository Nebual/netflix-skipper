import React from 'react';
import ReactSelect from 'react-select';

export default function Select({ height = 30, ...props }) {
	const styles = {
		control: (base) => ({
			...base,
			minHeight: 'initial',
			width: 275,
			fontSize: 12,
		}),
		valueContainer: (base) => ({
			...base,
			height: `${height - 1 - 1}px`,
			padding: '0 8px',
		}),
		clearIndicator: (base) => ({
			...base,
			padding: `${(height - 20 - 1 - 1) / 2}px`,
		}),
		dropdownIndicator: (base) => ({
			...base,
			padding: `${(height - 20 - 1 - 1) / 2}px`,
		}),
	};
	return <ReactSelect styles={styles} {...props} />;
}
