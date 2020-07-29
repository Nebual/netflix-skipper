export async function sleep(delay) {
	return new Promise((resolve) => setTimeout(resolve, delay));
}

export async function waitFor(test, frequency = 50) {
	return new Promise(async (resolve, reject) => {
		let result = test();
		while (!result) {
			await sleep(frequency);
			result = test();
		}
		resolve(result);
	});
}

export function downloadAsFile(str, filename) {
	const url = window.URL.createObjectURL(
		new Blob([str], {
			type: 'application/json',
		})
	);
	const a = document.createElement('a');
	a.style.display = 'none';
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	window.URL.revokeObjectURL(url);
	a.remove();
}

export const sampleScene = {
	id: 80025745,
	name: 'Sense8_S1E1',
	scenes: [
		{ time: 227000, next: 235400, needle: 2 },
		{ time: 395000, next: 400000, blood: 1, violence: 2, suicide: 3 },
		{ time: 571700, next: 573700, violence: 2, suicide: 2 },
		{ time: 1267000, next: 1348500, sex: 2 },
		{ time: 1271000, next: 1348500, sex: 3 },
		{ time: 2593000, next: 2597750, blood: 2 },
		{ time: 2929900, next: 2932900, blood: 2 },
		{ time: 3715000, next: 3811800, blood: 1, violence: 1 },
		{ time: 3715001, next: 3719500, blood: 1, violence: 2 },
		{ time: 3799670, next: 3811800, blood: 1, violence: 2 },
	],
};
