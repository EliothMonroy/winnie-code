Write a function that rotates an array of integers `nums` by `k` positions to the right, returning a new array.

**Example 1:**

```
Input: nums = [1,2,3,4,5], k = 2
Output: [4,5,1,2,3]
```

**Example 2:**

```
Input: nums = [1,2,3], k = 4
Output: [3,1,2]
Explanation: k is larger than the array length, so the rotation wraps around.
```

**Example 3:**

```
Input: nums = [1,2,3,4], k = 0
Output: [1,2,3,4]
Explanation: No rotation.
```

**Constraints:**

- `0 <= nums.length`
- `0 <= k <= 2147483647`
- Every `nums[i]` fits in a Kotlin `Int`
