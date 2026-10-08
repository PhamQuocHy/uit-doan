export class AllocationConflict extends Error {}

export function validateAllocationChange(input: {
  amount: number;
  expectedAmount: number | null | undefined;
  currentAmount: number | null;
  parentAmount: number;
  allocatedToOthers: number;
  filled: number;
}) {
  if (!Number.isSafeInteger(input.amount) || input.amount < 0 || input.amount > 2147483647) {
    throw new AllocationConflict('Chỉ tiêu phải là số nguyên không âm hợp lệ.');
  }
  if (input.expectedAmount !== input.currentAmount) {
    throw new AllocationConflict('Chỉ tiêu đã được giao hoặc thay đổi. Vui lòng tải lại và bấm Sửa.');
  }
  if (input.currentAmount === input.amount) {
    throw new AllocationConflict('Chỉ tiêu không thay đổi, không cần lưu lại.');
  }
  if (input.amount < input.filled) {
    throw new AllocationConflict(`Không thể giảm chỉ tiêu dưới ${input.filled} quân đã phân.`);
  }
  if (input.allocatedToOthers + input.amount > input.parentAmount) {
    throw new AllocationConflict(`Tổng giao không được vượt ${input.parentAmount} chỉ tiêu Bộ giao. Đã giao đơn vị khác: ${input.allocatedToOthers}.`);
  }
}
