const MONEY = /^(\d+)(?:\.(\d{1,2}))?$/;
export function parseMoney(value: string): number {
  const match = MONEY.exec(value.trim());
  if (!match)
    throw new Error("Enter a positive amount with up to 2 decimal places.");
  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? "").padEnd(2, "0"));
  const result = whole * 100n + fraction;
  if (result > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Amount is too large.");
  if (result <= 0n) throw new Error("Amount must be greater than zero.");
  return Number(result);
}
export function formatMoney(centavos: number): string {
  if (!Number.isSafeInteger(centavos))
    throw new Error("Unsafe monetary amount.");
  const absolute = BigInt(Math.abs(centavos));
  const whole = (absolute / 100n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${centavos < 0 ? "-" : ""}₱${whole}.${(absolute % 100n).toString().padStart(2, "0")}`;
}
export function moneyInput(centavos: number): string {
  const value = BigInt(centavos);
  return `${value / 100n}.${(value % 100n).toString().padStart(2, "0")}`;
}
