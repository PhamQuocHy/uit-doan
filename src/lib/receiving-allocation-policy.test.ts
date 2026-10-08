import test from 'node:test';
import assert from 'node:assert/strict';
import { AllocationConflict, validateAllocationChange } from './receiving-allocation-policy';

const initial = { amount: 5, expectedAmount: null, currentAmount: null, parentAmount: 10, allocatedToOthers: 5, filled: 0 };

test('First allocation and an explicit edit can use the remaining quota', () => {
  assert.doesNotThrow(() => validateAllocationChange(initial));
  assert.doesNotThrow(() => validateAllocationChange({ ...initial, expectedAmount: 4, currentAmount: 4, filled: 3 }));
  assert.doesNotThrow(() => validateAllocationChange({ ...initial, amount: 0, parentAmount: 0, allocatedToOthers: 0 }));
});

test('Repeated create, unchanged save and stale edits cannot overwrite a saved quota', () => {
  assert.throws(() => validateAllocationChange({ ...initial, currentAmount: 5 }), AllocationConflict);
  assert.throws(() => validateAllocationChange({ ...initial, expectedAmount: 5, currentAmount: 5 }), AllocationConflict);
  assert.throws(() => validateAllocationChange({ ...initial, amount: 4, expectedAmount: 3, currentAmount: 5 }), AllocationConflict);
  assert.throws(() => validateAllocationChange({ ...initial, expectedAmount: undefined }), AllocationConflict);
});

test('Quota changes respect assigned soldiers, regional total and integer limits', () => {
  assert.throws(() => validateAllocationChange({ ...initial, filled: 6 }), AllocationConflict);
  assert.throws(() => validateAllocationChange({ ...initial, allocatedToOthers: 6 }), AllocationConflict);
  assert.throws(() => validateAllocationChange({ ...initial, parentAmount: 0, allocatedToOthers: 0 }), AllocationConflict);
  for (const amount of [-1, 1.5, NaN, Infinity, 2147483648]) {
    assert.throws(() => validateAllocationChange({ ...initial, amount }), AllocationConflict);
  }
});
