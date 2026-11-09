export function isEmptyArray(array: ReadonlyArray<unknown>): array is readonly [] {
	return array.length === 0;
}

export function isArrayOfSizeOne<TValue>(array: ReadonlyArray<TValue>): array is readonly [TValue] {
	return array.length === 1;
}

export function isArrayOfSizeTwo<TValue>(array: ReadonlyArray<TValue>): array is readonly [TValue, TValue] {
	return array.length === 2;
}
