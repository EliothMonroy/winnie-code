Given a string `s`, return a new string with its characters sorted by frequency. Characters that appear more often come first, and every occurrence of a character is kept, grouped together.

When two characters have the same frequency, sort them alphabetically by character code (ascending). By character code, uppercase letters come before lowercase ones (`'A' < 'a'`), and digits, spaces and punctuation have their own codes too (`' ' < '1' < 'A' < 'a'`).

**Example 1:**

```
Input: s = "tree"
Output: "eert"
Explanation: 'e' appears twice, 'r' and 't' appear once each.
Result: "ee" + "rt" (ties sorted alphabetically).
```

**Example 2:**

```
Input: s = "cccaaa"
Output: "aaaccc"
Explanation: Both 'a' and 'c' appear 3 times.
Since 'a' < 'c' alphabetically, 'a' comes first.
```

**Example 3:**

```
Input: s = "Aabb"
Output: "bbAa"
Explanation: 'b' appears twice, 'A' and 'a' appear once each.
Result: "bb" + "Aa" (sorted by character code, and 'A' < 'a').
```

**Constraints:**

- `0 <= s.length`
- `s` consists of printable ASCII characters: letters, digits, spaces and punctuation
- Uppercase and lowercase letters are different characters
