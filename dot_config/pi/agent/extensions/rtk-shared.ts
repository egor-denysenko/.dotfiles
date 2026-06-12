// Shared RTK find-syntax guard.
// Used by both the OpenCode plugin (rtk.ts) and the Pi extension (private_rtk.ts).

const UNSUPPORTED_RTK_FIND_SYNTAX = [
  /(^|[ \t])\\?!(?=$|[ \t])/,
  /(^|[ \t])-(?:not|o|or|a|and|exec|execdir|ok|okdir)(?=$|[ \t])/,
  /(^|[ \t])\\?[()](?=$|[ \t])/,
]

export function hasUnsupportedFindSyntax(command: string, rewritten: string): boolean {
  const trimmed = command.trimStart()
  if (!trimmed.startsWith("find ")) return false
  if (!rewritten.startsWith("rtk find ")) return false
  return UNSUPPORTED_RTK_FIND_SYNTAX.some((pattern) => pattern.test(command))
}
