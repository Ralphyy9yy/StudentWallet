import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import { router } from "expo-router";
import SettingsScreen from "@/features/settings/SettingsScreen";
import ProfileScreen from "@/features/settings/ProfileScreen";
import HelpScreen from "@/features/settings/HelpScreen";
import { useWallet } from "@/features/wallet/WalletContext";
import { updateDisplayName } from "@/db/database";
import { APP_VERSION, GITHUB_URL } from "@/domain/app";
jest.mock("@/features/wallet/WalletContext", () => ({ useWallet: jest.fn() }));
jest.mock("@/db/database", () => ({
  updateDisplayName: jest.fn(),
  resetAll: jest.fn(),
}));
jest.mock("@/features/backup/backup", () => ({
  prepareBackup: jest.fn(),
  pickAndValidate: jest.fn(),
  restoreBackup: jest.fn(),
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));
jest.mock("@/ui/components", () => {
  const real = jest.requireActual("@/ui/components");
  return {
    ...real,
    Screen: ({ children, footer }: any) =>
      require("react").createElement(
        require("react-native").View,
        null,
        children,
        footer,
      ),
  };
});
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(useWallet)
    .mockReturnValue({
      displayName: "Alex",
      lastBackupExportAt: null,
      refresh: jest.fn().mockResolvedValue(undefined),
    } as any);
});
test("Settings explains missing backups, shows saved name and current version", async () => {
  const screen = await render(<SettingsScreen />);
  expect(screen.getByText("No backup saved yet")).toBeTruthy();
  expect(screen.getByText("Alex")).toBeTruthy();
  expect(screen.getByText(`Version ${APP_VERSION}`)).toBeTruthy();
  await fireEvent.press(screen.getByText("Edit display name"));
  expect(router.push).toHaveBeenCalledWith("/settings/profile");
  await fireEvent.press(screen.getByText("How it works"));
  expect(router.push).toHaveBeenCalledWith("/settings/help");
});
test("saved backup hides the never-saved reminder", async () => {
  jest
    .mocked(useWallet)
    .mockReturnValue({
      displayName: null,
      lastBackupExportAt: "2026-10-18T00:00:00.000Z",
      refresh: jest.fn(),
    } as any);
  const screen = await render(<SettingsScreen />);
  expect(screen.queryByText("No backup saved yet")).toBeNull();
});
test("GitHub is opened only after an explicit tap", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  const screen = await render(<SettingsScreen />);
  expect(open).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("View source on GitHub"));
  expect(open).toHaveBeenCalledWith(GITHUB_URL);
});
test("failed display-name save preserves input and can retry", async () => {
  jest
    .mocked(updateDisplayName)
    .mockRejectedValueOnce(new Error("Disk full"))
    .mockResolvedValueOnce(undefined);
  const screen = await render(<ProfileScreen />);
  await fireEvent.changeText(screen.getByLabelText("Display name"), "Jordan");
  await fireEvent.press(screen.getByText("Save name"));
  expect(screen.getByLabelText("Display name").props.value).toBe("Jordan");
  expect(router.back).not.toHaveBeenCalled();
  expect(screen.getByText(/Your name was not saved/)).toBeTruthy();
  await fireEvent.press(screen.getByText("Save name"));
  await waitFor(() => expect(router.back).toHaveBeenCalled());
  expect(updateDisplayName).toHaveBeenLastCalledWith("Jordan");
});
test("display-name form rejects overlong names before writing", async () => {
  const screen = await render(<ProfileScreen />);
  await fireEvent.changeText(
    screen.getByLabelText("Display name"),
    "x".repeat(61),
  );
  await fireEvent.press(screen.getByText("Save name"));
  expect(screen.getByText("Use 60 characters or fewer.")).toBeTruthy();
  expect(updateDisplayName).not.toHaveBeenCalled();
});
test("the guide explains the adjusting amount, reserves, and replacement restore", async () => {
  const screen = await render(<HelpScreen />);
  expect(screen.getByText("3. Use the daily spending guide")).toBeTruthy();
  expect(screen.getByText(/it is not a fixed daily limit/)).toBeTruthy();
  expect(
    screen.getByText(/both your balance and that reserve go down once/),
  ).toBeTruthy();
  expect(screen.getByText(/before replacing all current records/)).toBeTruthy();
});
