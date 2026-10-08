You are managing a printer queue where print jobs are processed in FIFO (First In, First Out) order. Each job takes a certain number of pages to print, and printing one page takes one unit of time.

Given a list `jobs` with the page count of each job, calculate the completion time for each job: the cumulative time at which that job finishes.

Return a list with one completion time per job, in the same order as `jobs`.

**Example 1:**

```
Input: jobs = [5,3,8,2]
Output: [5,8,16,18]
Explanation:
Job 1 (5 pages): finishes at time 5
Job 2 (3 pages): finishes at time 5 + 3 = 8
Job 3 (8 pages): finishes at time 8 + 8 = 16
Job 4 (2 pages): finishes at time 16 + 2 = 18
```

**Example 2:**

```
Input: jobs = [10]
Output: [10]
Explanation: Job 1 (10 pages) finishes at time 10.
```

**Example 3:**

```
Input: jobs = [1,1,1,1]
Output: [1,2,3,4]
Explanation: Each job takes 1 unit, so they finish at times 1, 2, 3 and 4.
```

**Constraints:**

- `0 <= jobs.length`
- `1 <= jobs[i]`
- The total number of pages fits in a Kotlin `Int` (at most `2147483647`)
