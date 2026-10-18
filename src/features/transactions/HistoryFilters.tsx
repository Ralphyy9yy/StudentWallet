import { useState } from "react";
import { View } from "react-native";
import type { AllowancePeriod, Category } from "@/domain/models";
import { Sheet } from "@/ui/Sheet";
import { ChoiceChip } from "@/ui/ChoiceChip";
import { AppText, Button } from "@/ui/components";
export type HistoryFilter = {
  type: "all" | "expense" | "top_up";
  periodId?: string;
  categoryId?: string;
};
export function HistoryFilters({
  initial,
  periods,
  categories,
  onApply,
  onClose,
}: {
  initial: HistoryFilter;
  periods: AllowancePeriod[];
  categories: Category[];
  onApply: (filter: HistoryFilter) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <Sheet
      title="Filter transactions"
      onClose={onClose}
      footer={
        <>
          <Button title="Apply filters" onPress={() => onApply(draft)} />
          <Button
            title="Reset filters"
            variant="ghost"
            onPress={() => setDraft({ type: "all" })}
          />
        </>
      }
    >
      <AppText variant="label">Transaction type</AppText>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Transaction type"
        style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
      >
        {(["all", "expense", "top_up"] as const).map((t) => (
          <ChoiceChip
            key={t}
            label={
              t === "all"
                ? "All activity"
                : t === "expense"
                  ? "Expenses"
                  : "Top-ups"
            }
            selected={draft.type === t}
            onPress={() => setDraft({ ...draft, type: t })}
          />
        ))}
      </View>
      <AppText variant="label">Allowance period</AppText>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Allowance period"
        style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
      >
        <ChoiceChip
          label="All periods"
          selected={!draft.periodId}
          onPress={() => setDraft({ ...draft, periodId: undefined })}
        />
        {periods.map((p) => (
          <ChoiceChip
            key={p.id}
            label={`${p.name} · ${p.startDate}`}
            selected={draft.periodId === p.id}
            onPress={() => setDraft({ ...draft, periodId: p.id })}
          />
        ))}
      </View>
      <AppText variant="label">Category</AppText>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Category filter"
        style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
      >
        <ChoiceChip
          label="All categories"
          selected={!draft.categoryId}
          onPress={() => setDraft({ ...draft, categoryId: undefined })}
        />
        {categories.map((c) => (
          <ChoiceChip
            key={c.id}
            label={c.name}
            selected={draft.categoryId === c.id}
            onPress={() => setDraft({ ...draft, categoryId: c.id })}
          />
        ))}
      </View>
    </Sheet>
  );
}
