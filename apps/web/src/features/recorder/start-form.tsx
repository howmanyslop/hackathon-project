import { Button } from "$components/ui/button";

import { NOTICE_BEFORE_RECORDING } from "./recording-notice";

import type { ReactNode, SubmitEvent } from "react";

import type { Recorder } from "./use-recorder";

export interface StartFormProperties {
	recorder: Recorder;
}

/**
 * Step one on the phone: the presenter code, the talk, and an optional link
 * to a video of it.
 *
 * @param properties - The recorder to start.
 * @returns Four labeled fields and the Start recording button.
 */
export function StartForm({ recorder }: Readonly<StartFormProperties>): ReactNode {
	const { details } = recorder;

	function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
		event.preventDefault();
		recorder.start();
	}

	const isReady =
		recorder.presenterCode.length > 0 && details.title.trim().length > 0 && details.speaker.trim().length > 0;

	return (
		<form className="grid max-w-xl gap-4" onSubmit={handleSubmit}>
			<label className="field">
				<span className="field-label">{"Presenter code"}</span>
				<input
					autoComplete="off"
					className="text-field"
					name="presenterCode"
					type="password"
					value={recorder.presenterCode}
					onChange={(event) => {
						recorder.changePresenterCode(event.target.value);
					}}
				/>
			</label>
			<label className="field">
				<span className="field-label">{"Talk title"}</span>
				<input
					className="text-field"
					name="title"
					type="text"
					value={details.title}
					onChange={(event) => {
						recorder.changeDetails({ ...details, title: event.target.value });
					}}
				/>
			</label>
			<label className="field">
				<span className="field-label">{"Speaker"}</span>
				<input
					autoComplete="name"
					className="text-field"
					name="speaker"
					type="text"
					value={details.speaker}
					onChange={(event) => {
						recorder.changeDetails({ ...details, speaker: event.target.value });
					}}
				/>
			</label>
			<label className="field">
				<span className="field-label">{"Recording link (optional)"}</span>
				<input
					className="text-field"
					name="recordingUrl"
					pattern="https://.+"
					placeholder="https://www.youtube.com/watch?v=…"
					title="A link that starts with https://"
					type="url"
					value={details.recordingUrl}
					onChange={(event) => {
						recorder.changeDetails({ ...details, recordingUrl: event.target.value });
					}}
				/>
			</label>
			<Button className="primary-button justify-self-start" disabled={!isReady} type="submit">
				{"Start recording"}
			</Button>
			<p className="notice">{NOTICE_BEFORE_RECORDING}</p>
		</form>
	);
}
