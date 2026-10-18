import { render, fireEvent } from "@testing-library/react-native";
import { HistoryFilters } from "@/features/transactions/HistoryFilters";
import { CategoryPicker } from "@/ui/CategoryPicker";
jest.mock("@expo/vector-icons/Ionicons", () => () => null);
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const categories = [
  { id: "food", name: "Food", iconKey: "restaurant", archived: false },
  { id: "transport", name: "Transport", iconKey: "bus", archived: false },
];
test("category chips expose selection without adding Selected to visible text", async () => {
  const change = jest.fn();
  const screen = await render(
    <CategoryPicker categories={categories} value="food" onChange={change} />,
  );
  expect(
    screen.getByRole("radio", { name: "Food" }).props.accessibilityState
      .checked,
  ).toBe(true);
  await fireEvent.press(screen.getByRole("radio", { name: "Transport" }));
  expect(change).toHaveBeenCalledWith("transport");
});
test("history choices remain a draft until Apply filters is pressed", async () => {
  const apply = jest.fn();
  const screen = await render(
    <HistoryFilters
      initial={{ type: "all" }}
      periods={[]}
      categories={categories}
      onApply={apply}
      onClose={jest.fn()}
    />,
  );
  await fireEvent.press(screen.getByRole("radio", { name: "Expenses" }));
  await fireEvent.press(screen.getByRole("radio", { name: "Food" }));
  expect(apply).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("Apply filters"));
  expect(apply).toHaveBeenCalledWith({ type: "expense", categoryId: "food" });
});
test("closing the filter sheet discards its draft", async () => {
  const close = jest.fn(),
    apply = jest.fn();
  const screen = await render(
    <HistoryFilters
      initial={{ type: "all" }}
      periods={[]}
      categories={categories}
      onApply={apply}
      onClose={close}
    />,
  );
  await fireEvent.press(screen.getByRole("radio", { name: "Food" }));
  await fireEvent.press(screen.getByRole("button", { name: "Close" }));
  expect(close).toHaveBeenCalled();
  expect(apply).not.toHaveBeenCalled();
});
