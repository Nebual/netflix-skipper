import React, { useEffect, useState } from 'react';

export default function TextInput({
	value,
	setValue,
	isNumeric,
	validator,
	...props
}) {
	if (!validator && isNumeric) {
		validator = (value) => '' + value === '' + value * 1;
	}
	const [state, setState] = useState(undefined);
	useEffect(() => setState(undefined), [value]);
	return (
		<input
			type="text"
			value={state !== undefined ? state : value}
			onChange={(event) => {
				setState(event.target.value);
				if (validator && validator(event.target.value)) {
					setValue(event.target.value);
				}
			}}
			onBlur={() => setState(undefined)}
			{...props}
		/>
	);
}
