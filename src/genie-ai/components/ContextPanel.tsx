type Props<Field extends string> = {
  contextDraft: Record<Field, string>;
  contextFields: Field[];
  disabled: boolean;
  isActive: boolean;
  labels: {
    continueWithoutContext: string;
    contextTitle: string;
    detectedContext: string;
    sendContext: string;
    sendingContext: string;
  };
  options: Record<Field, string[]>;
  getFieldLabel: (field: Field) => string;
  getOptionLabel: (option: string) => string;
  getQuestion: (field: Field) => string;
  onSelect: (field: Field, value: string) => void;
  onSubmit: (includeContext: boolean) => void;
};

export function ContextPanel<Field extends string>(props: Props<Field>) {
  const selectedFields = props.contextFields.filter((field) =>
    props.contextDraft[field].trim(),
  );
  const fieldsToAsk = props.contextFields.filter(
    (field) => !props.contextDraft[field].trim(),
  );

  return (
    <div className="grid gap-2 overflow-hidden rounded-2xl border border-[#D7E2EF] bg-white p-2.5 shadow-[0_12px_32px_-22px_rgba(10,31,58,.35)]">
      <h3 className="text-base font-semibold leading-5 text-[#0B2748]">
        {props.labels.contextTitle}
      </h3>
      {selectedFields.length > 0 ? (
        <div className="rounded-xl border border-[#E6D5A7] bg-[#FFF8E7] p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A6823]">
            {props.labels.detectedContext}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {selectedFields.map((field) => (
              <button
                key={field}
                type="button"
                disabled={!props.isActive || props.disabled}
                onClick={() => props.onSelect(field, props.contextDraft[field])}
                className="rounded-full border border-[#D6A936] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0B2748] shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {props.getFieldLabel(field)}:{" "}
                {props.getOptionLabel(props.contextDraft[field])}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {fieldsToAsk.length > 0 ? (
        <div className="grid gap-1.5">
          {fieldsToAsk.map((field) => (
            <fieldset
              key={field}
              aria-label={props.getQuestion(field)}
              className="rounded-lg border border-[#E4E1D8] bg-[#FAF7F1] px-2.5 py-1.5"
            >
              <div className="grid gap-1.5 sm:grid-cols-[20%_minmax(0,1fr)] sm:items-center sm:gap-2">
                <p className="text-xs font-semibold leading-4 text-[#0B2748]">
                  {props.getQuestion(field)}
                </p>
                <div className="flex flex-wrap gap-1">
                  {props.options[field].map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={false}
                      disabled={!props.isActive || props.disabled}
                      onClick={() => props.onSelect(field, option)}
                      className="rounded-full border border-[#D7E2EF] bg-white px-2.5 py-1 text-xs font-medium leading-4 text-[#31577F] transition hover:border-[#D6A936] hover:bg-[#FFF8E7] hover:text-[#0B2748] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {props.getOptionLabel(option)}
                    </button>
                  ))}
                </div>
              </div>
            </fieldset>
          ))}
        </div>
      ) : (
        <div />
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={
            !props.isActive || props.disabled || selectedFields.length === 0
          }
          onClick={() => props.onSubmit(true)}
          className="h-9 rounded-[10px] bg-[#D6A936] px-3 text-xs font-semibold text-[#071A30] shadow-sm transition hover:bg-[#C89B3C] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {props.disabled
            ? props.labels.sendingContext
            : props.labels.sendContext}
        </button>
        <button
          type="button"
          disabled={!props.isActive || props.disabled}
          onClick={() => props.onSubmit(false)}
          className="h-9 rounded-[10px] border border-[#D7E2EF] bg-white px-3 text-xs font-semibold text-[#31577F] transition hover:border-[#1E4D8C] hover:bg-[#F5F8FC] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {props.labels.continueWithoutContext}
        </button>
      </div>
    </div>
  );
}
