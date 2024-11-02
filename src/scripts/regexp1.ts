export function myfunc(input: string): string[] {
  const regex = /^(株式会社|合同会社).+/;
  const match = input.match(regex);
  return match ? [match[0]] : [];
}
