import type { ReactNode, RefObject } from "react";
import { GenieMark, V3Icon } from "./Icon";
import type { GenieChatMessage } from "./types";

type Props = {
  activityMessage: string;
  chatRef: RefObject<HTMLDivElement | null>;
  contextPanel: (active: boolean) => ReactNode;
  contentOverride?: ReactNode;
  conversationStage: string;
  isSending: boolean;
  isSpeaking: boolean;
  language: string;
  latestAssistantIndex: number;
  messages: GenieChatMessage[];
  footer?: ReactNode;
  onLanguageEnglish: () => void;
  onRetry: (message: GenieChatMessage) => void;
  onSpeak: (content: string) => void;
  onStopSpeaking: () => void;
  readAloudTitle: string;
  renderMessage: (content: string) => ReactNode;
  switchEnglishLabel: string;
  tryAgainLabel: string;
};

export function ChatThread({ activityMessage, chatRef, contextPanel, contentOverride, conversationStage, isSending, isSpeaking, language, latestAssistantIndex, messages, footer, onLanguageEnglish, onRetry, onSpeak, onStopSpeaking, readAloudTitle, renderMessage, switchEnglishLabel, tryAgainLabel }: Props) {
  return (
    <div ref={chatRef} className="relative h-full overflow-y-auto px-4 py-4 sm:px-7 sm:py-5">
      <div className="relative">
        {contentOverride ? contentOverride : <>
        <div className="relative space-y-5">
        <div className="pointer-events-none absolute bottom-5 left-[19px] top-5 hidden w-px bg-[linear-gradient(#C89B3C,#E4E1D8_85%)] opacity-70 md:block" aria-hidden="true" />
        <div className="pointer-events-none absolute bottom-5 right-[17px] top-5 hidden w-px bg-[linear-gradient(#3D74B8,#D7E2EF_85%)] opacity-65 md:block" aria-hidden="true" />
        {messages.map((message, index) => {
          const user = message.role === "user";
          const isContext = message.variant === "context-panel";
          const latestAssistant = message.role === "assistant" && index === latestAssistantIndex;
          return (
            <article data-chat-message="true" key={`${message.role}-${index}`} className={user ? "flex items-end justify-end gap-2 pl-6 md:pl-10" : "grid grid-cols-1 gap-3.5 md:grid-cols-[40px_minmax(0,1fr)]"}>
              {!user ? <GenieMark className="relative z-10 hidden h-10 w-10 rounded-full border-2 border-[#C89B3C] bg-white text-[#1E4D8C] md:grid" /> : null}
              <div className={`min-w-0 items-end gap-2 ${user ? "order-first max-w-[min(80%,520px)]" : `flex w-full ${isContext ? "md:pr-12" : ""}`}`}>
                <div className={`${isContext ? "w-full" : user ? "w-fit max-w-[min(100%,680px)]" : "w-[85%] max-w-[680px]"} rounded-[12px] border px-4 py-3 text-sm leading-6 shadow-[0_8px_24px_-12px_rgba(10,31,58,.18)] ${user ? "border-[#0A1F3A] bg-[#0A1F3A] text-white" : "border-[#E4E1D8] bg-white text-[#3E4A56]"}`}>
                  {isContext ? contextPanel(conversationStage === "collecting-context") : renderMessage(message.content)}
                  {message.retryReason === "timeout" && message.retryText ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" disabled={isSending} onClick={() => onRetry(message)} className="rounded-lg border border-[#1E4D8C] px-3 py-2 text-xs font-bold text-[#1E4D8C] disabled:opacity-50">{tryAgainLabel}</button>
                      {language !== "English" ? <button type="button" disabled={isSending} onClick={onLanguageEnglish} className="rounded-lg border border-[#1E4D8C] px-3 py-2 text-xs font-bold text-[#1E4D8C] disabled:opacity-50">{switchEnglishLabel}</button> : null}
                    </div>
                  ) : null}
                </div>
                {latestAssistant && !isContext && language === "English" ? isSpeaking ? <button type="button" onClick={onStopSpeaking} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#B25A2E] bg-[#F7E9DF] text-[#B25A2E] shadow-sm" title="Stop reading" aria-label="Stop reading"><V3Icon name="x" className="h-4 w-4" /></button> : <button type="button" onClick={() => onSpeak(message.content)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#E4E1D8] bg-white text-[#1E4D8C] shadow-sm" title={readAloudTitle} aria-label={readAloudTitle}><V3Icon name="speaker" className="h-4 w-4" /></button> : null}
              </div>
              {user ? <span className="relative z-10 hidden h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-[#3D74B8] bg-[#E7EEF7] text-[#1E4D8C] md:grid"><V3Icon name="person" className="h-4 w-4" /></span> : null}
            </article>
          );
        })}
        {activityMessage ? <article className="grid grid-cols-1 gap-3.5 md:grid-cols-[40px_minmax(0,1fr)]"><GenieMark className="relative z-10 hidden h-10 w-10 rounded-full border-2 border-[#C89B3C] bg-white md:grid" /><div className="w-fit rounded-xl border border-[#E4E1D8] bg-white px-4 py-3 text-sm font-semibold text-[#5B6B7A] shadow-sm"><span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-[#1E4D8C]" />{activityMessage}</div></article> : null}
        </div>
        {footer}
        </>}
      </div>
    </div>
  );
}
