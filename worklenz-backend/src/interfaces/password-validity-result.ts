export interface IPasswordValidityResult {
  contains: ("lowercase" | "uppercase" | "number" | "symbol")[];
  length: number;
  value: number;
  text: "Too Weak" | "Weak" | "Strong" | "Excellent";
}
