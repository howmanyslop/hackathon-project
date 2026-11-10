import { isPositiveInteger } from "@web-template/arktype-utilities";
import { type } from "arktype";

// Tool inputs. The adapter turns these into JSON Schema with ArkType's
// toJsonSchema(), so they stick to what JSON Schema can express: no narrow
// and no morph. Descriptions double as ArkType's "must be …" errors, so they
// read as noun phrases.

export const isSearchArchiveInput = type({
	"limit?": type("1 <= number % 1 <= 50").describe("the most results of each kind, from 1 to 50"),
	query: type("1 <= string <= 500").describe("what to look for, in plain language"),
}).readonly();

export const isGetSessionInput = type({
	id: isPositiveInteger.describe("a session id, from list_sessions or a search result"),
}).readonly();
