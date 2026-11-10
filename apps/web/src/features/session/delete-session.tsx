import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { Button } from "$components/ui/button";
import { orpc } from "$orpc/client";

import type { ReactNode, SubmitEvent } from "react";

export interface DeleteSessionProperties {
	sessionId: number;
}

/**
 * A quiet control for the presenter: deleting a session needs the presenter
 * code, and removes the talk, its transcript, and its questions.
 *
 * @param properties - The session to delete.
 * @returns The control.
 */
export function DeleteSession({ sessionId }: Readonly<DeleteSessionProperties>): ReactNode {
	const [isOpen, setIsOpen] = useState(false);
	const [presenterCode, setPresenterCode] = useState("");
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const deleteSession = useMutation(orpc.deleteSession.mutationOptions());

	function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
		event.preventDefault();
		deleteSession.mutate(
			{ presenterCode, sessionId },
			{
				onSuccess() {
					queryClient.invalidateQueries().catch(() => undefined);
					navigate({ to: "/sessions" }).catch(() => undefined);
				},
			},
		);
	}

	if (!isOpen) {
		return (
			<button
				className="quiet-button"
				type="button"
				onClick={() => {
					setIsOpen(true);
				}}
			>
				{"Delete this session"}
			</button>
		);
	}

	return (
		<form className="grid gap-3" onSubmit={handleSubmit}>
			<p className="fig-note">
				{"This removes the talk, its transcript, and its questions for everyone. It cannot be undone."}
			</p>
			<label className="field">
				<span className="field-label">{"Presenter code"}</span>
				<input
					autoComplete="off"
					className="text-field"
					name="presenterCode"
					type="password"
					value={presenterCode}
					onChange={(event) => {
						setPresenterCode(event.target.value);
					}}
				/>
			</label>
			{deleteSession.isError ? (
				<p className="fig-note" role="alert">
					{"That did not work. Check the presenter code and try again."}
				</p>
			) : null}
			<div className="action-row">
				<Button
					className="primary-button"
					disabled={presenterCode.length === 0 || deleteSession.isPending}
					type="submit"
				>
					{"Delete for good"}
				</Button>
				<button
					className="quiet-button"
					type="button"
					onClick={() => {
						setIsOpen(false);
					}}
				>
					{"Keep it"}
				</button>
			</div>
		</form>
	);
}
