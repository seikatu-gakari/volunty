/** migration 適用確認後にだけアカウント削除を有効化する。 */
export function isAccountDeletionEnabled() {
  return process.env.ACCOUNT_DELETION_ENABLED === "true";
}
