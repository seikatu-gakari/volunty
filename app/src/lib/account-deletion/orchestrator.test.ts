import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUpsert = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateMany = vi.fn();
const mockDeleteManyRequest = vi.fn();
const mockDeleteManyUser = vi.fn();
const mockTransaction = vi.fn();
const mockGetUserById = vi.fn();
const mockDeleteUser = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    accountDeletionRequest: {
      upsert: mockUpsert,
      update: mockUpdate,
      updateMany: mockUpdateMany,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: { getUserById: mockGetUserById, deleteUser: mockDeleteUser },
    },
  }),
}));

const { processAccountDeletion } = await import("./orchestrator");
const notFound = { data: { user: null }, error: { status: 404 } };

describe("processAccountDeletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockUpsert.mockResolvedValue({ id: "request-1", authDeletedAt: null });
    mockUpdate.mockResolvedValue({});
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockDeleteManyUser.mockResolvedValue({ count: 1 });
    mockDeleteManyRequest.mockResolvedValue({ count: 1 });
    mockTransaction.mockImplementation(async (callback) =>
      callback({
        user: { deleteMany: mockDeleteManyUser },
        accountDeletionRequest: { deleteMany: mockDeleteManyRequest },
      })
    );
  });

  it("台帳作成に失敗した場合は外部削除も DB cleanup も開始しない", async () => {
    mockUpsert.mockRejectedValue(new Error("ledger unavailable"));

    await expect(processAccountDeletion("user-1")).rejects.toThrow();

    expect(mockGetUserById).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("Auth 削除失敗後もユーザーが存在する場合は業務データを維持する", async () => {
    mockGetUserById.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mockDeleteUser.mockResolvedValue({ data: null, error: { status: 500 } });

    await expect(processAccountDeletion("user-1")).resolves.toEqual({ status: "auth_failed" });

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { lastErrorCode: "auth_delete_failed" },
    }));
  });

  it("Auth 削除エラーでも再照会で不存在なら cleanup する", async () => {
    mockGetUserById
      .mockResolvedValueOnce({ data: { user: { id: "user-1" } }, error: null })
      .mockResolvedValueOnce(notFound);
    mockDeleteUser.mockResolvedValue({ data: null, error: { status: 504 } });

    await expect(processAccountDeletion("user-1")).resolves.toEqual({ status: "completed" });
    expect(mockDeleteManyUser).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(mockDeleteManyRequest).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });

  it("DB cleanup 失敗時は処理保留として台帳に記録する", async () => {
    mockGetUserById.mockResolvedValue(notFound);
    mockTransaction.mockRejectedValue(new Error("DB error"));

    await expect(processAccountDeletion("user-1")).resolves.toEqual({ status: "cleanup_pending" });
    expect(mockUpdateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: { lastErrorCode: "data_cleanup_failed" },
    }));
  });

  it("Auth 削除確認済みの再処理では Auth API を呼ばず count 0 も成功にする", async () => {
    mockUpsert.mockResolvedValue({ id: "request-1", authDeletedAt: new Date() });
    mockDeleteManyUser.mockResolvedValue({ count: 0 });

    await expect(processAccountDeletion("user-1")).resolves.toEqual({ status: "completed" });
    expect(mockGetUserById).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("並行処理が台帳を削除済みなら冪等な成功として扱う", async () => {
    mockGetUserById.mockResolvedValue(notFound);
    mockUpdateMany.mockResolvedValue({ count: 0 });

    await expect(processAccountDeletion("user-1")).resolves.toEqual({ status: "completed" });
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
