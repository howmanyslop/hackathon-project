/** What a procedure knows about the request that called it. */
export interface RequestContext {
	/** The visitor's address, when the request came through Cloudflare. */
	readonly clientAddress?: string | undefined;
}
