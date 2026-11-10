import { askArchive, getDigest, searchArchive } from "./archive";
import { listAskedQuestions } from "./questions";
import { appendSegments, deleteSession, endSession, markQaStart, startSession } from "./recording";
import { getArchiveStats, getSession, listSessions } from "./sessions";

const router = {
	appendSegments,
	askArchive,
	deleteSession,
	endSession,
	getArchiveStats,
	getDigest,
	getSession,
	listAskedQuestions,
	listSessions,
	markQaStart,
	searchArchive,
	startSession,
};

export default router;
