import { describe, expect, it } from "vite-plus/test";

import {
	isArrayOfNumbers,
	isArrayOfStrings,
	isBoolean,
	isDictionaryOfStrings,
	isDictionaryOfUnknowns,
	isFalse,
	isInteger,
	isIsoDateString,
	isMaybeInteger,
	isMaybeNonNegativeInteger,
	isMaybeNull,
	isMaybeNumber,
	isMaybeReadonlyArrayOfStrings,
	isMaybeReadonlyDictionaryOfStrings,
	isMaybeString,
	isNonEmptyString,
	isNonNegativeInteger,
	isNonNegativeNumber,
	isNull,
	isNullableString,
	isNumber,
	isPositiveInteger,
	isPositiveNumber,
	isReadonlyArrayOfNumbers,
	isReadonlyArrayOfStrings,
	isReadonlyDictionaryOfStrings,
	isReadonlyDictionaryOfUnknowns,
	isString,
	isTrue,
	isUndefined,
	isUnknown,
	isUrlString,
} from "./index.ts";

describe("primitive validators", () => {
	it("isBoolean accepts booleans and rejects strings", () => {
		expect.assertions(2);

		expect(isBoolean.allows(true)).toBe(true);
		expect(isBoolean.allows("true")).toBe(false);
	});

	it("isTrue accepts true and rejects everything else", () => {
		expect.assertions(3);

		expect(isTrue.allows(true)).toBe(true);
		expect(isTrue.allows(false)).toBe(false);
		expect(isTrue.allows("true")).toBe(false);
	});

	it("isFalse accepts false and rejects everything else", () => {
		expect.assertions(3);

		expect(isFalse.allows(false)).toBe(true);
		expect(isFalse.allows(true)).toBe(false);
		expect(isFalse.allows("false")).toBe(false);
	});

	it("isNumber accepts numbers and rejects strings", () => {
		expect.assertions(2);

		expect(isNumber.allows(1)).toBe(true);
		expect(isNumber.allows("1")).toBe(false);
	});

	it("isString accepts strings and rejects numbers", () => {
		expect.assertions(2);

		expect(isString.allows("hi")).toBe(true);
		expect(isString.allows(1)).toBe(false);
	});

	it("isNonEmptyString accepts non-empty strings and rejects empty strings", () => {
		expect.assertions(3);

		expect(isNonEmptyString.allows("hi")).toBe(true);
		expect(isNonEmptyString.allows("")).toBe(false);
		expect(isNonEmptyString.allows(undefined)).toBe(false);
	});

	it("isUndefined accepts undefined and rejects null", () => {
		expect.assertions(2);

		expect(isUndefined.allows(undefined)).toBe(true);
		expect(isUndefined.allows(null)).toBe(false);
	});

	it("isNull accepts null and rejects undefined", () => {
		expect.assertions(2);

		expect(isNull.allows(null)).toBe(true);
		expect(isNull.allows(undefined)).toBe(false);
	});

	it("isUnknown accepts any value", () => {
		expect.assertions(3);

		expect(isUnknown.allows(1)).toBe(true);
		expect(isUnknown.allows(undefined)).toBe(true);
		expect(isUnknown.allows(null)).toBe(true);
	});
});

describe("optional and nullable validators", () => {
	it("isMaybeString accepts a string or undefined", () => {
		expect.assertions(3);

		expect(isMaybeString.allows("a")).toBe(true);
		expect(isMaybeString.allows(undefined)).toBe(true);
		expect(isMaybeString.allows(null)).toBe(false);
	});

	it("isNullableString accepts a string or null", () => {
		expect.assertions(3);

		expect(isNullableString.allows("a")).toBe(true);
		expect(isNullableString.allows(null)).toBe(true);
		expect(isNullableString.allows(undefined)).toBe(false);
	});

	it("isMaybeNumber accepts a number or undefined", () => {
		expect.assertions(2);

		expect(isMaybeNumber.allows(1)).toBe(true);
		expect(isMaybeNumber.allows(undefined)).toBe(true);
	});

	it("isMaybeNull accepts null or undefined", () => {
		expect.assertions(2);

		expect(isMaybeNull.allows(null)).toBe(true);
		expect(isMaybeNull.allows(undefined)).toBe(true);
	});

	it("isMaybeReadonlyDictionaryOfStrings accepts accepts string records and rejects non-string records or undefined", () => {
		expect.assertions(4);

		expect(isMaybeReadonlyDictionaryOfStrings.allows({ a: "b" })).toBe(true);
		expect(isMaybeReadonlyDictionaryOfStrings.allows({ a: 1 })).toBe(false);
		expect(isMaybeReadonlyDictionaryOfStrings.allows(undefined)).toBe(true);
		expect(isMaybeReadonlyDictionaryOfStrings.allows(null)).toBe(false);
	});
});

describe("array validators", () => {
	it("isArrayOfStrings accepts string arrays and rejects number arrays", () => {
		expect.assertions(2);

		expect(isArrayOfStrings.allows(["a"])).toBe(true);
		expect(isArrayOfStrings.allows([1])).toBe(false);
	});

	it("isReadonlyArrayOfStrings accepts string arrays and rejects number arrays", () => {
		expect.assertions(2);

		expect(isReadonlyArrayOfStrings.allows(["a"])).toBe(true);
		expect(isReadonlyArrayOfStrings.allows([1])).toBe(false);
	});

	it("isArrayOfNumbers accepts number arrays and rejects string arrays", () => {
		expect.assertions(2);

		expect(isArrayOfNumbers.allows([1])).toBe(true);
		expect(isArrayOfNumbers.allows(["a"])).toBe(false);
	});

	it("isReadonlyArrayOfNumbers accepts number arrays and rejects string arrays", () => {
		expect.assertions(2);

		expect(isReadonlyArrayOfNumbers.allows([1])).toBe(true);
		expect(isReadonlyArrayOfNumbers.allows(["a"])).toBe(false);
	});

	it("isMaybeReadonlyArrayOfStrings accepts a string array or undefined", () => {
		expect.assertions(3);

		expect(isMaybeReadonlyArrayOfStrings.allows(["a"])).toBe(true);
		expect(isMaybeReadonlyArrayOfStrings.allows(undefined)).toBe(true);
		expect(isMaybeReadonlyArrayOfStrings.allows([1])).toBe(false);
	});
});

describe("dictionary validators", () => {
	it("isDictionaryOfUnknowns accepts any record", () => {
		expect.assertions(1);

		expect(isDictionaryOfUnknowns.allows({ a: 1 })).toBe(true);
	});

	it("isReadonlyDictionaryOfUnknowns accepts any record", () => {
		expect.assertions(1);

		expect(isReadonlyDictionaryOfUnknowns.allows({ a: 1 })).toBe(true);
	});

	it("isDictionaryOfStrings accepts string records and rejects non-string records", () => {
		expect.assertions(2);

		expect(isDictionaryOfStrings.allows({ a: "b" })).toBe(true);
		expect(isDictionaryOfStrings.allows({ a: 1 })).toBe(false);
	});

	it("isReadonlyDictionaryOfStrings accepts string records and rejects non-string records", () => {
		expect.assertions(2);

		expect(isReadonlyDictionaryOfStrings.allows({ a: "b" })).toBe(true);
		expect(isReadonlyDictionaryOfStrings.allows({ a: 1 })).toBe(false);
	});
});

describe("url and date validators", () => {
	it("isUrlString accepts absolute URLs and rejects other strings", () => {
		expect.assertions(3);

		expect(isUrlString.allows("https://example.com/work")).toBe(true);
		expect(isUrlString.allows("not a url")).toBe(false);
		expect(isUrlString.allows(42)).toBe(false);
	});

	it("isIsoDateString accepts ISO dates and rejects other strings", () => {
		expect.assertions(3);

		expect(isIsoDateString.allows("2026-07-07")).toBe(true);
		expect(isIsoDateString.allows("July 7th")).toBe(false);
		expect(isIsoDateString.allows(20_260_707)).toBe(false);
	});
});

describe("optional integer validators", () => {
	it("isMaybeInteger accepts integers or undefined", () => {
		expect.assertions(4);

		expect(isMaybeInteger.allows(-3)).toBe(true);
		expect(isMaybeInteger.allows(undefined)).toBe(true);
		expect(isMaybeInteger.allows(1.5)).toBe(false);
		expect(isMaybeInteger.allows(null)).toBe(false);
	});

	it("isMaybeNonNegativeInteger accepts non-negative integers or undefined", () => {
		expect.assertions(5);

		expect(isMaybeNonNegativeInteger.allows(0)).toBe(true);
		expect(isMaybeNonNegativeInteger.allows(7)).toBe(true);
		expect(isMaybeNonNegativeInteger.allows(undefined)).toBe(true);
		expect(isMaybeNonNegativeInteger.allows(-1)).toBe(false);
		expect(isMaybeNonNegativeInteger.allows(1.5)).toBe(false);
	});
});

describe("number range validators", () => {
	it("isNonNegativeNumber accepts zero and above", () => {
		expect.assertions(3);

		expect(isNonNegativeNumber.allows(0)).toBe(true);
		expect(isNonNegativeNumber.allows(0.5)).toBe(true);
		expect(isNonNegativeNumber.allows(-0.5)).toBe(false);
	});

	it("isPositiveNumber rejects zero", () => {
		expect.assertions(3);

		expect(isPositiveNumber.allows(0.5)).toBe(true);
		expect(isPositiveNumber.allows(0)).toBe(false);
		expect(isPositiveNumber.allows(-1)).toBe(false);
	});
});

// ArkType reads "number % 1 > 0" as an integer that is also above zero, not
// as a remainder above zero. These pin that reading.
describe("integer validators", () => {
	it("isInteger accepts whole numbers of any sign", () => {
		expect.assertions(3);

		expect(isInteger.allows(-3)).toBe(true);
		expect(isInteger.allows(0)).toBe(true);
		expect(isInteger.allows(1.5)).toBe(false);
	});

	it("isNonNegativeInteger accepts zero and positive whole numbers", () => {
		expect.assertions(4);

		expect(isNonNegativeInteger.allows(0)).toBe(true);
		expect(isNonNegativeInteger.allows(2)).toBe(true);
		expect(isNonNegativeInteger.allows(-1)).toBe(false);
		expect(isNonNegativeInteger.allows(1.5)).toBe(false);
	});

	it("isPositiveInteger accepts whole numbers above zero", () => {
		expect.assertions(5);

		expect(isPositiveInteger.allows(1)).toBe(true);
		expect(isPositiveInteger.allows(2)).toBe(true);
		expect(isPositiveInteger.allows(0)).toBe(false);
		expect(isPositiveInteger.allows(-1)).toBe(false);
		expect(isPositiveInteger.allows(1.5)).toBe(false);
	});
});
