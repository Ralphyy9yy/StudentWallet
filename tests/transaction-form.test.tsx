import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";
import { TransactionForm } from "@/features/transactions/TransactionForm";
import { saveTransaction } from "@/db/database";
import { useWallet } from "@/features/wallet/WalletContext";
import { router } from "expo-router";
jest.mock("@/db/database", () => ({ saveTransaction: jest.fn() }));
jest.mock("@/features/wallet/WalletContext", () => ({ useWallet: jest.fn() }));
jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));
jest.mock("expo-crypto", () => ({
  randomUUID: () => "11111111-1111-4111-8111-111111111111",
}));
jest.mock("@/ui/confirmation", () => ({
  withDeficitConfirmation: async (fn: () => Promise<void>) => {
    await fn();
    return true;
  },
}));
jest.mock("@/ui/DateField", () => ({ DateField: () => null }));
jest.mock("@/ui/components", () => {
  const real = jest.requireActual("@/ui/components");
  return {
    ...real,
    Screen: ({ children }: any) =>
      require("react").createElement(
        require("react-native").View,
        null,
        children,
      ),
  };
});
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  jest.mocked(useWallet).mockReturnValue({
    period: { id: "p" },
    categories: [{ id: "food", name: "Food" }],
    reserves: [],
    refresh: jest.fn().mockResolvedValue(undefined),
  } as any);
});
test("repeated Save taps produce one write and navigation waits for commit", async () => {
  let commit!: () => void;
  jest.mocked(saveTransaction).mockImplementation(
    () =>
      new Promise((resolve) => {
        commit = resolve;
      }),
  );
  const screen = await render(<TransactionForm />);
  await fireEvent.changeText(screen.getByLabelText("Amount (PHP)"), "50.00");
  const save = screen.getByRole("button", { name: "Save transaction" });
  const savingEvent = fireEvent.press(save);
  await waitFor(() => expect(saveTransaction).toHaveBeenCalledTimes(1));
  await fireEvent.press(screen.getByText("Saving..."));
  expect(saveTransaction).toHaveBeenCalledTimes(1);
  expect(router.back).not.toHaveBeenCalled();
  await act(async () => {
    commit();
  });
  await savingEvent;
  expect(router.back).toHaveBeenCalledTimes(1);
});
test("failed save preserves fields and retry reuses the command ID", async () => {
  jest
    .mocked(saveTransaction)
    .mockRejectedValueOnce(new Error("Storage full"))
    .mockResolvedValueOnce(undefined);
  const screen = await render(<TransactionForm />);
  await fireEvent.changeText(screen.getByLabelText("Amount (PHP)"), "50.00");
  await fireEvent.press(screen.getByText("Save transaction"));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
  expect(screen.getByLabelText("Amount (PHP)").props.value).toBe("50.00");
  expect(router.back).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("Save transaction"));
  await waitFor(() => expect(router.back).toHaveBeenCalled());
  expect(jest.mocked(saveTransaction).mock.calls[0][0].commandId).toBe(
    jest.mocked(saveTransaction).mock.calls[1][0].commandId,
  );
});
