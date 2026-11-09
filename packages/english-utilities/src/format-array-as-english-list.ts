import { isArrayOfSizeOne, isArrayOfSizeTwo, isEmptyArray } from "./array-size-utilities";

import type { LiteralUnion } from "type-fest";

export type LogicalOperator = LiteralUnion<"and" | "or", string>;

export function formatArrayAsEnglishList(
	array: ReadonlyArray<string>,
	logicalOperator: LogicalOperator = "and",
): string {
	if (isEmptyArray(array)) return "";
	if (isArrayOfSizeOne(array)) return array[0];
	if (isArrayOfSizeTwo(array)) return `${array[0]} ${logicalOperator} ${array[1]}`;
	return `${array.slice(0, -1).join(", ")}, ${logicalOperator} ${array.at(-1)}`;
}
