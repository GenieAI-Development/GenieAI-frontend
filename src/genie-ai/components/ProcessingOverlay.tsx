type Props = {
  isImageProcessing: boolean;
  isRecording: boolean;
  isRecordingPaused: boolean;
  isVoiceProcessing: boolean;
  labels: {
    pause: string;
    recording: string;
    resume: string;
    send: string;
    stop: string;
    transcribing: string;
    uploading: string;
  };
  onDiscard: () => void;
  onPause: () => void;
  onSend: () => void;
};

export function ProcessingOverlay(props: Props) {
  if (
    !props.isRecording &&
    !props.isVoiceProcessing &&
    !props.isImageProcessing
  )
    return null;
  return (
    <div className="absolute bottom-[78px] left-1/2 z-30 w-[min(92%,520px)] -translate-x-1/2 rounded-[14px] border border-[#E4E1D8] bg-white/95 p-3 text-xs font-semibold text-[#123661] shadow-[0_16px_40px_-16px_rgba(10,31,58,.35)] backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`h-2.5 w-2.5 animate-pulse rounded-full ${props.isRecording ? "bg-[#B25A2E]" : "bg-[#1E4D8C]"}`}
        />
        <span>
          {props.isRecording
            ? props.labels.recording
            : props.isVoiceProcessing
              ? props.labels.transcribing
              : props.labels.uploading}
        </span>
        {props.isRecording ? (
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={props.onPause}
              className="rounded-lg border border-[#E4E1D8] px-3 py-2"
            >
              {props.isRecordingPaused
                ? props.labels.resume
                : props.labels.pause}
            </button>
            <button
              type="button"
              onClick={props.onDiscard}
              className="rounded-lg border border-[#E4E1D8] px-3 py-2"
            >
              {props.labels.stop}
            </button>
            <button
              type="button"
              onClick={props.onSend}
              className="rounded-lg bg-[#C89B3C] px-3 py-2 text-[#0A1F3A]"
            >
              {props.labels.send}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
