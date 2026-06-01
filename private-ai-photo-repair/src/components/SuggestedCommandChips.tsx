import {
  SUGGESTED_COMMANDS_EN,
  SUGGESTED_COMMANDS_HR,
  type SuggestedCommand,
} from "../core/prompt/promptSuggestions";
import { useI18n } from "../i18n/i18n";

interface SuggestedCommandChipsProps {
  onSelect: (command: SuggestedCommand) => void;
  disabled?: boolean;
}

export function SuggestedCommandChips({ onSelect, disabled }: SuggestedCommandChipsProps): JSX.Element {
  const { t } = useI18n();
  return (
    <section className="card">
      <h2>{t("suggest.title")}</h2>
      <h3 style={{ marginTop: 8 }}>{t("suggest.hr")}</h3>
      <div className="chips">
        {SUGGESTED_COMMANDS_HR.map((cmd) => (
          <button
            key={`hr-${cmd.label}`}
            className="chip"
            disabled={disabled}
            onClick={() => onSelect(cmd)}
          >
            {cmd.label}
          </button>
        ))}
      </div>
      <h3 style={{ marginTop: 12 }}>{t("suggest.en")}</h3>
      <div className="chips">
        {SUGGESTED_COMMANDS_EN.map((cmd) => (
          <button
            key={`en-${cmd.label}`}
            className="chip"
            disabled={disabled}
            onClick={() => onSelect(cmd)}
          >
            {cmd.label}
          </button>
        ))}
      </div>
    </section>
  );
}
