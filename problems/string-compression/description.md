Write a function that compresses a string `s` by replacing each run of consecutive identical characters with the character followed by the number of times it repeats.

Every character is followed by its count, even when the count is `1`. Characters are case-sensitive, so `a` and `A` are different.

**Example 1:**

```
Input: s = "aaabbc"
Output: "a3b2c1"
```

**Example 2:**

```
Input: s = "aabbccdd"
Output: "a2b2c2d2"
```

**Example 3:**

```
Input: s = "abc"
Output: "a1b1c1"
```

**Constraints:**

- `0 <= s.length`
- `s` consists of English letters only (uppercase and lowercase)
