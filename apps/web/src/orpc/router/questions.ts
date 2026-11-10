/**
 * What attendees asked the archive, for presenters. Strangers type these into
 * a public box, so reading them needs the presenter code.
 */

import { ORPCError, os } from "@orpc/server";
import { isUndefined } from "@web-template/arktype-utilities";
import { type } from "arktype";

import { isPresenterCode } from "$archive/presenter-code";
import { listAskedQuestionsAsync } from "$archive/question-log";

import type { AskedQuestion } from "$archive/contract";

export const listAskedQuestions = os
	.input(
		type({
			"presenterCode?": type("string <= 200").or(isUndefined),
		}).readonly(),
	)
	.handler(async function listAskedQuestionsHandler({ input }): Promise<ReadonlyArray<AskedQuestion>> {
		if (!isPresenterCode(input.presenterCode)) {
			throw new ORPCError("UNAUTHORIZED", { message: "That presenter code isn't right." });
		}

		return listAskedQuestionsAsync();
	});
