import { isString } from "@web-template/arktype-utilities";
import { type } from "arktype";

export const isFilePathInput = type({
	"+": "ignore",
	filePath: isString,
}).readonly();
