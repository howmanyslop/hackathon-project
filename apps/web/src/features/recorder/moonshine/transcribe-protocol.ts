/** What the main thread sends the speech model worker. */
export type ModelRequest =
	| { readonly id: number; readonly kind: "load" }
	| {
			readonly id: number;
			readonly kind: "transcribe";
			/** 16 kHz mono audio, transferred. */
			readonly samples: Float32Array<ArrayBuffer>;
	  };

/** What the speech model worker sends back, matched by `id`. */
export type ModelReply =
	| { readonly fraction: number; readonly id: number; readonly kind: "progress" }
	| { readonly id: number; readonly kind: "failed"; readonly message: string }
	| { readonly id: number; readonly kind: "ready" }
	| { readonly id: number; readonly kind: "text"; readonly text: string };
