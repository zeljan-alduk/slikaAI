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
  const { t, lang } = useI18n();
  // Show only the chip group for the chosen UI language.
  const commands = lang === "hr" ? SUGGESTED_COMMANDS_HR : SUGGESTED_COMMANDS_EN;

  return (
    <section className="card">
      <h3 style={{ marginBottom: 8 }}>{t("suggest.title")}</h3>
      <div className="chips">
        {commands.map((cmd) => (
          <button
            key={cmd.label}
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
