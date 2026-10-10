"""Extended, deterministic coding-practice catalog for AI StudyMate.

The catalog is intentionally language-neutral for C, Python and Java so the
same algorithm challenges can be solved in the selected course language.
SQL exercises use a separate in-memory fixture and SQL reference queries.
"""
from functools import lru_cache
import sqlite3

# id, title, difficulty, topic, task statement, sample input, sample output
# Every item has a deterministic test case. Existing language banks supply
# additional test cases for foundational questions.
_COMMON_ROWS = [
("difference-two-numbers","Difference of Two Numbers","Easy","Arithmetic","Read two integers a and b. Print a minus b.","12 5","7"),
("product-two-numbers","Product of Two Numbers","Easy","Arithmetic","Read two integers and print their product.","7 -3","-21"),
("quotient-remainder","Quotient and Remainder","Easy","Arithmetic","Read positive integers a and b (b > 0). Print integer quotient and remainder separated by one space.","17 5","3 2"),
("maximum-two","Maximum of Two Numbers","Easy","Conditions","Read two integers and print the larger value.","-4 -9","-4"),
("minimum-three","Minimum of Three Numbers","Easy","Conditions","Read three integers and print the smallest.","8 -2 5","-2"),
("number-sign","Classify a Number","Easy","Conditions","Print Positive, Negative or Zero for the supplied integer.","0","Zero"),
("divisible-by-k","Divisible by K","Easy","Conditions","Read n and k. Print Yes if n is divisible by k, otherwise No.","35 7","Yes"),
("leap-year","Leap Year","Easy","Conditions","Print Leap Year if the supplied Gregorian year is a leap year; otherwise print Not Leap Year.","1900","Not Leap Year"),
("sum-natural","Sum of First N Natural Numbers","Easy","Loops","Read n (n >= 0) and print 1 + 2 + ... + n.","10","55"),
("sum-squares","Sum of Squares","Medium","Loops","Read n and print 1² + 2² + ... + n².","4","30"),
("integer-power","Integer Power","Easy","Math","Read non-negative integers a and b. Print a raised to power b.","3 4","81"),
("count-digits","Count Digits","Easy","Numbers","Read an integer and print the number of digits in its absolute value. Treat zero as one digit.","-5021","4"),
("sum-digits","Sum of Digits","Easy","Numbers","Read an integer and print the sum of its decimal digits, ignoring a minus sign.","-472","13"),
("product-digits","Product of Digits","Medium","Numbers","Read a non-negative integer and print the product of its digits.","234","24"),
("reverse-number-extra","Reverse Number","Easy","Numbers","Read a non-negative integer and print its digits reversed; reversed leading zeroes are omitted.","12040","4021"),
("number-palindrome-extra","Number Palindrome","Easy","Numbers","Print Yes if the non-negative integer reads the same forwards and backwards; otherwise No.","12321","Yes"),
("count-even-digits","Count Even Digits","Medium","Numbers","Read a non-negative integer and count its even decimal digits (0 is even).","204681","6"),
("prime-check-extra","Prime Check","Easy","Number Theory","Print Prime or Not Prime for the supplied integer. Integers below 2 are not prime.","29","Prime"),
("primes-up-to-n","Primes Up To N","Medium","Number Theory","Read n and print all prime numbers from 2 through n in ascending order, separated by spaces.","15","2 3 5 7 11 13"),
("count-divisors","Count Divisors","Medium","Number Theory","Read a positive integer n and print how many positive divisors it has.","12","6"),
("gcd-two","Greatest Common Divisor","Easy","Number Theory","Read two non-negative integers and print their greatest common divisor.","48 18","6"),
("lcm-two","Least Common Multiple","Easy","Number Theory","Read two positive integers and print their least common multiple.","12 18","36"),
("fibonacci-nth-extra","Nth Fibonacci Number","Medium","Recursion / DP","Read n (0-based; F(0)=0, F(1)=1) and print F(n).","10","55"),
("fibonacci-sequence","Fibonacci Sequence","Easy","Loops","Read n and print the first n Fibonacci numbers beginning with 0 1, separated by spaces.","7","0 1 1 2 3 5 8"),
("armstrong-number","Armstrong Number","Medium","Number Theory","Print Yes if the non-negative number equals the sum of its digits raised to the number of digits; otherwise No.","153","Yes"),
("perfect-number","Perfect Number","Medium","Number Theory","Print Yes if n equals the sum of its positive proper divisors; otherwise No.","28","Yes"),
("decimal-to-binary","Decimal To Binary","Medium","Bit Manipulation","Read a non-negative integer and print its binary representation without leading zeroes (zero prints 0).","13","1101"),
("binary-to-decimal","Binary To Decimal","Easy","Bit Manipulation","Read a string containing only 0 and 1 and print its decimal value.","101101","45"),
("count-set-bits","Count Set Bits","Medium","Bit Manipulation","Read a non-negative integer and print the number of 1 bits in its binary representation.","29","4"),
("integer-square-root","Integer Square Root","Medium","Binary Search","Read non-negative n and print floor(sqrt(n)) without using a floating-point square-root function.","27","5"),
("array-sum-extra","Array Sum","Easy","Arrays","Read n followed by n integers. Print their sum.","5\n2 -1 4 8 3","16"),
("array-min-max","Array Minimum And Maximum","Easy","Arrays","Read n followed by n integers. Print the minimum and maximum separated by a space.","5\n4 -2 9 1 6","-2 9"),
("reverse-array-extra","Reverse Array","Easy","Arrays","Read n and n integers. Print them in reverse order separated by spaces.","5\n1 2 3 4 5","5 4 3 2 1"),
("count-positive-array","Count Positive Values","Easy","Arrays","Read n and n integers. Print how many are strictly positive.","6\n-1 0 5 2 -4 7","3"),
("count-target-array","Count Target Occurrences","Easy","Arrays","Read n, n integers, then target x. Print how many array elements equal x.","6\n2 1 2 3 2 4\n2","3"),
("linear-search-extra","Linear Search","Easy","Searching","Read n, n integers, then target. Print the first zero-based index or -1 if absent.","5\n9 4 7 4 2\n4","1"),
("binary-search-extra","Binary Search","Medium","Searching","Read n, a sorted ascending array, then target. Print its zero-based index or -1 if absent.","6\n1 3 5 7 9 11\n7","3"),
("second-largest","Second Largest Distinct","Medium","Arrays","Read n and n integers. Print the second-largest distinct value. Assume at least two distinct values.","6\n5 1 9 9 7 3","7"),
("move-zeros","Move Zeros To End","Medium","Arrays","Read n and n integers. Preserve the order of non-zero values, then append all zeroes.","6\n0 1 0 3 12 0","1 3 12 0 0 0"),
("rotate-array-right","Rotate Array Right","Medium","Arrays","Read n, n integers and k. Rotate the array right by k positions and print it.","5\n1 2 3 4 5\n2","4 5 1 2 3"),
("missing-number","Missing Number 1 To N","Medium","Arrays","Read n, followed by n-1 distinct integers from 1 through n. Print the missing number.","5\n1 2 4 5","3"),
("merge-sorted-arrays","Merge Sorted Arrays","Medium","Sorting","Read n, n sorted integers, m, then m sorted integers. Print the merged sorted sequence.","3\n1 4 7\n4\n2 3 5 6","1 2 3 4 5 6 7"),
("sort-ascending","Sort Ascending","Easy","Sorting","Read n and n integers. Print them in ascending order separated by spaces.","5\n4 1 3 2 5","1 2 3 4 5"),
("prefix-sums","Prefix Sums","Medium","Arrays","Read n and n integers. Print the running prefix sum after each element.","5\n2 1 3 4 5","2 3 6 10 15"),
("maximum-subarray","Maximum Subarray Sum","Hard","Dynamic Programming","Read n and n integers. Print the largest sum over any non-empty contiguous subarray.","8\n-2 1 -3 4 -1 2 1 -5","6"),
("longest-increasing-run","Longest Increasing Contiguous Run","Medium","Arrays","Read n and n integers. Print the length of the longest strictly increasing contiguous run.","7\n1 2 2 3 4 1 5","3"),
("pair-sum-exists","Pair Sum Exists","Medium","Arrays / Hashing","Read n, n integers and target. Print Yes if two distinct elements sum to target, otherwise No.","5\n2 7 11 15 1\n9","Yes"),
("matrix-diagonal-sum","Matrix Diagonal Sum","Medium","Matrices","Read n and an n by n integer matrix. Print the sum of the main diagonal.","3\n1 2 3\n4 5 6\n7 8 9","15"),
("matrix-transpose","Matrix Transpose","Medium","Matrices","Read r and c followed by an r by c matrix. Print the transpose, one row per line.","2 3\n1 2 3\n4 5 6","1 4\n2 5\n3 6"),
("matrix-row-sums","Matrix Row Sums","Easy","Matrices","Read r and c and an r by c matrix. Print each row's sum on one line separated by spaces.","2 3\n1 2 3\n4 5 6","6 15"),
("string-length","String Length","Easy","Strings","Read one line of text and print its character count, excluding the newline.","StudyMate","9"),
("reverse-string-extra","Reverse String","Easy","Strings","Read one line and print its characters in reverse order.","hello","olleh"),
("palindrome-string","Palindrome String","Easy","Strings","Read a word and print Yes if it is a palindrome (case-sensitive), otherwise No.","level","Yes"),
("count-vowels","Count Vowels","Easy","Strings","Read one line and count English vowels a, e, i, o, u in either case.","AI StudyMate","5"),
("count-words","Count Words","Easy","Strings","Read a line and print the number of whitespace-separated words.","learn code every day","4"),
("remove-spaces","Remove Spaces","Easy","Strings","Read a line and print it with all ordinary space characters removed.","a b c 12","abc12"),
("character-frequency","Character Frequency","Medium","Strings","Read a line, then a character on the next line. Print how many times that character occurs in the line.","banana\na","3"),
("first-nonrepeat","First Non-Repeating Character","Medium","Strings / Hashing","Read a string and print its first non-repeating character; print -1 if every character repeats.","swiss","w"),
("anagram-check","Anagram Check","Medium","Strings / Sorting","Read two lowercase words on separate lines. Print Yes if they contain the same letters with the same counts; otherwise No.","listen\nsilent","Yes"),
("balanced-parentheses","Balanced Parentheses","Medium","Stacks","Read a string containing parentheses only. Print Yes if they are balanced, otherwise No.","(()())","Yes"),
("longest-common-prefix","Longest Common Prefix","Medium","Strings","Read n followed by n words. Print their longest common prefix; print - if there is none.","3\nflower flow flight","fl"),
("stack-operations","Stack Operations","Medium","Stacks","Read q operations. Each operation is 'push x' or 'pop'. Print the value for each pop; print EMPTY if the stack is empty.","5\npush 4\npush 9\npop\npush 2\npop","9\n2"),
("queue-operations","Queue Operations","Medium","Queues","Read q operations. Each is 'push x' or 'pop'. Print the value for each pop; print EMPTY if empty.","5\npush 4\npush 9\npop\npush 2\npop","4\n9"),
("sort-zero-one-two","Sort Zero One Two","Medium","Sorting","Read n values containing only 0, 1 and 2. Print them sorted in ascending order.","7\n2 0 2 1 1 0 2","0 0 1 1 2 2 2"),
("majority-element","Majority Element","Medium","Arrays / Hashing","Read n integers. Print the value occurring more than n/2 times. Assume a majority element exists.","7\n2 2 1 2 3 2 2","2"),
("two-sum-indices","Two Sum Indices","Medium","Arrays / Hashing","Read n, n integers, and target. Print the zero-based indices of the first pair with the target sum, in ascending order, or -1 -1.","4\n2 7 11 15\n9","0 1"),
("stock-profit","Best Stock Profit","Medium","Greedy","Read n daily prices. Print the maximum profit from one buy followed by one later sell; print 0 if no profit exists.","6\n7 1 5 3 6 4","5"),
("longest-unique-substring","Longest Unique Substring","Hard","Sliding Window","Read a string and print the length of its longest substring with no repeated characters.","abcabcbb","3"),
("climbing-stairs","Climbing Stairs","Medium","Dynamic Programming","There are n stairs and you can climb 1 or 2 at a time. Print the number of distinct ways to reach the top; n >= 1.","5","8"),
("coin-change-min","Minimum Coins","Hard","Dynamic Programming","Read n coin denominations, then target amount. Print the minimum number of coins needed for an unbounded coin system, or -1 if impossible.","3\n1 3 4\n6","2"),
("knapsack-01","0/1 Knapsack","Hard","Dynamic Programming","Read n and capacity W, then n weights, then n values. Print the maximum value without exceeding W.","3 5\n2 3 4\n3 4 5","7"),
("lis-length","Longest Increasing Subsequence","Hard","Dynamic Programming","Read n and n integers. Print the length of the longest strictly increasing subsequence (not necessarily contiguous).","8\n10 9 2 5 3 7 101 18","4"),
("lcs-length","Longest Common Subsequence","Hard","Dynamic Programming","Read two strings on separate lines. Print the length of their longest common subsequence.","abcde\nace","3"),
("edit-distance","Edit Distance","Hard","Dynamic Programming","Read two strings on separate lines. Print the minimum insertions, deletions and substitutions needed to change the first into the second.","kitten\nsitting","3"),
("number-islands","Number Of Islands","Hard","Graphs / Grids","Read rows and columns followed by a grid of 0/1 characters. Count groups of 1s connected horizontally or vertically.","3 4\n1100\n0101\n0011","2"),
("bfs-traversal","Breadth First Search","Hard","Graphs","Read n m, then m undirected 1-based edges, then a start vertex. Print BFS visit order, visiting neighbors in ascending order.","5 5\n1 2\n1 3\n2 4\n3 5\n4 5\n1","1 2 3 4 5"),
("dfs-traversal","Depth First Search","Hard","Graphs","Read n m, then m undirected 1-based edges, then a start vertex. Print DFS visit order, exploring neighbors in ascending order.","5 5\n1 2\n1 3\n2 4\n3 5\n4 5\n1","1 2 4 5 3"),
("dijkstra-shortest-path","Shortest Path","Hard","Graphs / Dijkstra","Read n m, then m edges u v w of an undirected weighted graph, then source and target. Print the shortest distance, or -1 if unreachable.","4 4\n1 2 1\n2 3 2\n1 3 8\n3 4 1\n1 4","4"),
("topological-sort","Topological Ordering","Hard","Graphs","Read n m then m directed edges u v (1-based). Print a valid topological ordering. The input graph is a DAG; smallest available vertex first.","4 3\n1 2\n1 3\n3 4","1 2 3 4"),
("merge-intervals","Merge Intervals","Medium","Sorting / Intervals","Read n intervals, one start-end pair per line. Merge overlapping intervals and print each merged pair on its own line.","4\n1 3\n2 6\n8 10\n9 12","1 6\n8 12"),
("sliding-window-maximum","Sliding Window Maximum","Hard","Sliding Window","Read n, n integers and window length k. Print each window's maximum separated by spaces.","8\n1 3 -1 -3 5 3 6 7\n3","3 3 5 5 6 7"),
("matrix-spiral","Spiral Matrix","Hard","Matrices","Read r c and an r by c matrix. Print its elements in clockwise spiral order.","3 3\n1 2 3\n4 5 6\n7 8 9","1 2 3 6 9 8 7 4 5"),
("rotate-matrix","Rotate Matrix 90 Degrees","Hard","Matrices","Read n and an n by n matrix. Rotate it clockwise 90 degrees and print the resulting rows.","2\n1 2\n3 4","3 1\n4 2"),
("bst-search","Binary Search Tree Search","Medium","Trees","Read n, n distinct integers to insert into a BST, then target. Print Yes if target exists in the BST, otherwise No.","5\n8 3 10 1 6\n6","Yes"),
("tree-height","Binary Tree Height","Medium","Trees","Read n nodes of a binary tree in level-order using -1 for missing nodes. Print its height in nodes; an empty tree has height 0.","7\n1 2 3 4 5 -1 7","3"),
("connected-components","Connected Components","Hard","Graphs","Read n m and m undirected 1-based edges. Print the number of connected components.","6 3\n1 2\n2 3\n5 6","3"),
("ncr","Binomial Coefficient","Medium","Combinatorics","Read n and r (0 <= r <= n). Print n choose r as an integer.","5 2","10"),
("pascal-row","Pascal Triangle Row","Medium","Combinatorics","Read row index n starting at zero. Print row n of Pascal's triangle separated by spaces.","4","1 4 6 4 1"),
("hex-to-decimal","Hexadecimal To Decimal","Easy","Number Systems","Read a hexadecimal number without a 0x prefix and print its decimal value.","1A3","419"),
("decimal-to-hex","Decimal To Hexadecimal","Easy","Number Systems","Read a non-negative integer and print its uppercase hexadecimal representation.","419","1A3"),
("selection-sort","Selection Sort","Medium","Sorting","Read n integers and print them sorted ascending using the selection-sort approach.","5\n29 10 14 37 13","10 13 14 29 37"),
("insertion-sort","Insertion Sort","Medium","Sorting","Read n integers and print them sorted ascending using the insertion-sort approach.","5\n5 2 4 6 1","1 2 4 5 6"),
("bubble-sort-swaps","Bubble Sort Swap Count","Medium","Sorting","Read n distinct integers. Print the number of swaps performed by bubble sort, which equals the inversion count.","4\n4 3 2 1","6"),
("count-unique","Count Unique Values","Easy","Arrays / Sets","Read n integers and print how many distinct values appear.","7\n1 1 2 3 3 3 4","4"),
("frequency-table","Frequency Table","Medium","Hashing","Read n integers. Print each distinct value and its frequency in ascending value order, one pair per line.","6\n3 1 3 2 1 3","1 2\n2 1\n3 3"),
("sum-multiples","Sum Multiples","Easy","Loops","Read n and k. Print the sum of positive multiples of k that are <= n.","20 6","36"),
("digital-root","Digital Root","Easy","Numbers","Read a non-negative integer and repeatedly sum digits until one digit remains.","9875","2"),
("binary-parity","Parity Of Set Bits","Easy","Bit Manipulation","Read a non-negative integer. Print Even if its binary representation has an even number of set bits; otherwise Odd.","7","Odd"),
("array-equilibrium-index","Equilibrium Index","Medium","Arrays","Read n integers. Print the first zero-based index where the sum to its left equals the sum to its right, or -1.","5\n1 3 5 2 2","2"),
("product-except-self","Product Except Self","Medium","Arrays","Read n integers. Print the product of all other elements for each index, separated by spaces. Do not use division.","4\n1 2 3 4","24 12 8 6"),
("intersection-sorted-arrays","Intersection Of Arrays","Medium","Arrays / Sorting","Read n, n integers, m, then m integers. Print common distinct values in ascending order.","5\n1 2 2 3 5\n4\n2 2 4 5","2 5"),
("valid-brackets","Valid Brackets","Medium","Stacks","Read a string containing (), [] and {}. Print Yes if all brackets are correctly nested, otherwise No.","{[()]}","Yes"),
("next-greater-element","Next Greater Element","Medium","Stacks","Read n integers. For each element print the nearest greater value to its right, or -1 if none.","4\n4 5 2 25","5 25 25 -1"),
("minimum-path-grid","Minimum Grid Path","Hard","Dynamic Programming","Read r c and a matrix of non-negative costs. Moving only right or down from top-left to bottom-right, print the minimum path sum.","3 3\n1 3 1\n1 5 1\n4 2 1","7"),
("unique-paths-grid","Unique Grid Paths","Medium","Dynamic Programming","Read m n. Count paths from top-left to bottom-right in an m by n grid when only right and down moves are allowed.","3 7","28"),
("word-frequency","Word Frequency","Medium","Hashing / Strings","Read a line of lowercase words separated by spaces. Print the most frequent word; break ties alphabetically.","red blue red green blue red","red"),
("rotate-string","Rotate String","Easy","Strings","Read a string and k. Rotate the string right by k positions and print the result.","abcdef 2","efabcd"),
("remove-duplicate-chars","Remove Duplicate Characters","Easy","Strings","Read a string and retain only the first occurrence of each character, preserving order.","programming","progamin"),
("longest-palindrome-length","Longest Palindrome Length","Medium","Strings / Hashing","Read a string. Print the maximum length of a palindrome that can be built from its characters.","abccccdd","7"),
("roman-to-integer","Roman To Integer","Medium","Strings","Read a valid uppercase Roman numeral and print its integer value.","MCMXCIV","1994"),
("run-length-encode","Run Length Encoding","Medium","Strings","Read a string and encode consecutive character runs as character followed by count.","aaabbc","a3b2c1"),
("matrix-border-sum","Matrix Border Sum","Medium","Matrices","Read r c and a matrix. Print the sum of boundary cells without counting corners twice.","3 3\n1 2 3\n4 5 6\n7 8 9","40"),
("diagonal-matrix-check","Diagonal Matrix Check","Easy","Matrices","Read n and an n by n matrix. Print Yes if every off-diagonal element is zero, otherwise No.","3\n1 0 0\n0 5 0\n0 0 9","Yes"),
("range-sum-queries","Range Sum Queries","Medium","Prefix Sums","Read n, an array, q, then q 1-based inclusive ranges l r. Print each range sum on its own line.","5\n2 4 1 7 3\n3\n1 3\n2 5\n4 4","7\n15\n7"),
("max-product-subarray","Maximum Product Subarray","Hard","Arrays / Dynamic Programming","Read n integers and print the largest product of a non-empty contiguous subarray.","5\n2 3 -2 4 -1","48"),
("minimum-platforms","Minimum Platforms","Hard","Greedy / Sorting","Read n arrival times on one line and n departure times on the next (HHMM integers). Print the minimum platforms needed.","6\n900 940 950 1100 1500 1800\n910 1200 1120 1130 1900 2000","3"),
("activity-selection","Activity Selection","Medium","Greedy","Read n start times then n finish times. Select the maximum number of non-overlapping activities and print the count.","6\n1 3 0 5 8 5\n2 4 6 7 9 9","4"),
("minimum-jumps","Minimum Jumps","Hard","Greedy / Arrays","Read n and n non-negative jump lengths. Print the minimum jumps from index 0 to the last index, or -1 if impossible.","5\n2 3 1 1 4","2"),
("gas-station","Gas Station Circuit","Medium","Greedy","Read n gas values followed by n cost values. Print the first zero-based start index that completes the circuit, or -1.","5\n1 2 3 4 5\n3 4 5 1 2","3"),
("find-duplicate","Find Duplicate Number","Medium","Arrays","Read n+1 integers, each from 1 to n, with exactly one repeated value. Print the duplicate.","5\n1 3 4 2 2","2"),
("kth-largest","Kth Largest Element","Medium","Sorting / Heap","Read n, n integers, and k. Print the kth-largest value, counting duplicates.","6\n3 2 1 5 6 4\n2","5"),
("median-two-sorted","Median Of Two Sorted Arrays","Hard","Binary Search","Read n, a sorted array, m, and another sorted array. Print the median of their combined values (integer if whole, otherwise one decimal place).","2\n1 3\n2\n2 4","2.5"),
("prefix-expression-evaluate","Evaluate Postfix Expression","Medium","Stacks","Read a space-separated postfix expression with single-digit numbers and + - * /. Print its integer result; division truncates toward zero.","2 3 1 * + 9 -","-4"),
("infix-parentheses-depth","Maximum Parenthesis Depth","Easy","Stacks","Read a string containing parentheses. Print the maximum nesting depth, or -1 if the parentheses are unbalanced.","(1+(2*3)+((8)/4))+1","3"),
("first-missing-positive","First Missing Positive","Hard","Arrays","Read n integers and print the smallest positive integer missing from the array.","5\n3 4 -1 1 2","5"),
("longest-consecutive-sequence","Longest Consecutive Sequence","Hard","Arrays / Hashing","Read n integers and print the length of the longest sequence of consecutive integer values.","6\n100 4 200 1 3 2","4"),
("count-subarrays-sum-k","Subarrays Sum K","Hard","Prefix Sums / Hashing","Read n, n integers and k. Print how many contiguous subarrays sum to k.","5\n1 1 1 2 1\n3","3"),
("minimum-window-size","Minimum Subarray Length","Hard","Sliding Window","Read n, positive target S, then n positive integers. Print the minimum length of a contiguous subarray with sum >= S, or 0 if none.","6 7\n2 3 1 2 4 3","2"),
("coin-change-ways","Coin Change Ways","Medium","Dynamic Programming","Read n denominations, then amount. Print the number of combinations to make the amount with unlimited coins (order does not matter).","3\n1 2 5\n5","4"),
("house-robber","House Robber","Medium","Dynamic Programming","Read n non-negative house values. Print the maximum sum without choosing adjacent values.","5\n2 7 9 3 1","12"),
("decode-ways","Decode Ways","Hard","Dynamic Programming","Read a digit string where 1-26 map to A-Z. Print the number of valid decodings; a leading zero makes it invalid.","226","3"),
("subset-sum","Subset Sum","Medium","Dynamic Programming","Read n integers and target S. Print Yes if some subset sums to S, otherwise No.","5 9\n2 3 7 8 10","Yes"),
("word-break","Word Break","Hard","Dynamic Programming / Strings","Read a string, then n dictionary words. Print Yes if the string can be segmented into dictionary words, otherwise No.","leetcode\n2\nleet code","Yes"),
("min-number-arrows","Minimum Arrows","Medium","Greedy / Intervals","Read n balloon intervals start-end. Print the minimum arrows needed to burst all intervals.","4\n10 16\n2 8\n1 6\n7 12","2"),
("search-rotated-array","Search Rotated Array","Medium","Binary Search","Read n values of an ascending array rotated at an unknown pivot, then target. Print its index or -1.","7\n4 5 6 7 0 1 2\n0","4"),
("minimum-window-distinct","Longest Distinct Window","Medium","Sliding Window","Read a string and print the length of the longest substring with all distinct characters.","pwwkew","3"),
]


def _common_problem_count_target():
    return 100


def _starter(language, title, description):
    comment = f"Problem: {title}\n{description}"
    if language == "python":
        return "import sys\n\ndata = sys.stdin.read().split()\n# " + comment.replace("\n", "\n# ") + "\n# Parse the input and print the required output.\n"
    if language == "java":
        return ("import java.util.*;\n\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    // " + comment.replace("\n", "\n    // ") + "\n    // Parse the input and print the required output.\n  }\n}\n")
    return "#include <stdio.h>\n\nint main(void) {\n    /* " + comment.replace("\n", "\n       ") + " */\n    /* Read input, solve the problem, and print the required output. */\n    return 0;\n}\n"


def _common_bank(language):
    prefix = {"c": "c-ext", "python": "py-ext", "java": "java-ext"}.get(language, "c-ext")
    bank = []
    for slug, title, difficulty, topic, description, sample_in, sample_out in _COMMON_ROWS:
        bank.append({
            "id": f"{prefix}-{slug}",
            "title": title,
            "difficulty": difficulty,
            "description": description,
            "examples": [{"input": sample_in, "output": sample_out}],
            "constraints": ["Read input exactly in the format described.", "Print only the required output; do not print prompts or labels."],
            "starter_code": _starter(language, title, description),
            "tags": [topic, "Practice"],
            "tests": [{"stdin": sample_in + ("\n" if not sample_in.endswith("\n") else ""), "expected": sample_out}],
            "track": "dsa" if any(word in topic.lower() for word in ("graph", "dynamic", "greedy", "search", "sorting", "stack", "queue", "hash", "sliding", "tree", "heap", "prefix", "interval", "arrays")) else "basics",
        })
    return bank


_SQL_SETUP = """
CREATE TABLE employees(id INTEGER, name TEXT, department TEXT, salary INTEGER, city TEXT, years INTEGER);
INSERT INTO employees VALUES
 (1,'Asha','IT',65000,'Chennai',2),(2,'Bala','HR',45000,'Bengaluru',5),
 (3,'Charan','IT',80000,'Hyderabad',7),(4,'Divya','Sales',55000,'Chennai',3),
 (5,'Eshan','Finance',72000,'Bengaluru',6),(6,'Farah','HR',52000,'Chennai',1),
 (7,'Gita','Sales',61000,'Hyderabad',4),(8,'Hari','Engineering',90000,'Chennai',8),
 (9,'Isha','IT',76000,'Bengaluru',3),(10,'Jai','Engineering',68000,'Pune',2),
 (11,'Kiran','Marketing',58000,'Chennai',4),(12,'Latha','Finance',84000,'Hyderabad',9);
CREATE TABLE students(id INTEGER, name TEXT, marks INTEGER, branch TEXT);
INSERT INTO students VALUES
 (1,'Anu',91,'CSE'),(2,'Bharat',76,'ECE'),(3,'Chitra',88,'CSE'),(4,'Deepak',64,'EEE'),
 (5,'Esha',95,'CSE'),(6,'Farid',72,'ECE'),(7,'Gopal',55,'EEE'),(8,'Hema',83,'ECE'),
 (9,'Irfan',68,'CSE'),(10,'Jaya',79,'EEE');
CREATE TABLE products(id INTEGER, name TEXT, category TEXT, price INTEGER, stock INTEGER);
INSERT INTO products VALUES
 (1,'Keyboard','Accessories',1200,25),(2,'Mouse','Accessories',600,50),(3,'Laptop','Computers',65000,8),
 (4,'Monitor','Computers',12000,12),(5,'Cable','Accessories',250,100),(6,'Tablet','Computers',18000,15),
 (7,'Chair','Furniture',4500,6),(8,'Desk','Furniture',9000,4),(9,'Headphones','Audio',2200,20),(10,'Speaker','Audio',3500,11);
CREATE TABLE orders(id INTEGER, customer TEXT, status TEXT, amount INTEGER, city TEXT);
INSERT INTO orders VALUES
 (101,'Asha','Delivered',1500,'Chennai'),(102,'Bala','Pending',800,'Bengaluru'),(103,'Asha','Delivered',2500,'Chennai'),
 (104,'Charan','Cancelled',900,'Hyderabad'),(105,'Divya','Shipped',1200,'Chennai'),(106,'Bala','Delivered',3200,'Bengaluru'),
 (107,'Esha','Pending',600,'Pune'),(108,'Charan','Delivered',4100,'Hyderabad'),(109,'Esha','Shipped',1800,'Pune'),(110,'Gita','Delivered',2200,'Hyderabad');
CREATE TABLE sales(id INTEGER, employee_id INTEGER, product_id INTEGER, quantity INTEGER, amount INTEGER);
INSERT INTO sales VALUES
 (1,1,3,1,65000),(2,3,4,2,24000),(3,4,1,3,3600),(4,7,2,5,3000),
 (5,8,6,1,18000),(6,9,9,2,4400),(7,12,7,1,4500),(8,2,5,10,2500);
"""


def _sql_reference_output(query):
    db = sqlite3.connect(":memory:")
    try:
        db.executescript(_SQL_SETUP)
        rows = db.execute(query).fetchall()
        return "\n".join(" | ".join("NULL" if value is None else str(value) for value in row) for row in rows)
    finally:
        db.close()


@lru_cache(maxsize=1)
def _sql_extended_bank():
    rows = []
    seen = set()

    def add(slug, title, difficulty, topic, description, query):
        if len(rows) >= 94 or slug in seen:
            return
        seen.add(slug)
        try:
            expected = _sql_reference_output(query)
        except sqlite3.Error:
            return
        rows.append({
            "id": "sql-ext-" + slug,
            "title": title,
            "difficulty": difficulty,
            "description": description,
            "examples": [{"input": "Use the provided sample tables", "output": expected or "(no rows)"}],
            "constraints": ["Use a read-only SELECT or WITH query.", "Column aliases and output order must match the requested result."],
            "starter_code": "SELECT\n  -- choose the required columns\nFROM " + (query.split("FROM", 1)[1].strip().split()[0].lower() if "FROM" in query else "employees") + ";",
            "tags": [topic, "SQL"],
            "tests": [{"stdin": _SQL_SETUP, "expected": expected}],
            "track": "basics" if difficulty == "Easy" else "dsa",
        })

    departments = ["IT", "HR", "Sales", "Finance", "Engineering", "Marketing"]
    for dept in departments:
        safe = dept.replace("'", "''")
        add("employees-dept-" + dept.lower(), f"Employees in {dept}", "Easy", "WHERE", f"Select employee names in the {dept} department, sorted alphabetically.", f"SELECT name FROM employees WHERE department = '{safe}' ORDER BY name;")
        add("employees-dept-count-" + dept.lower(), f"Count employees in {dept}", "Medium", "COUNT / WHERE", f"Count employees belonging to the {dept} department.", f"SELECT COUNT(*) FROM employees WHERE department = '{safe}';")
    for threshold in [45000, 55000, 65000, 75000]:
        add(f"salary-above-{threshold}", f"Employees Above {threshold}", "Easy", "WHERE", f"List the names of employees whose salary is greater than {threshold}, ordered by salary ascending.", f"SELECT name FROM employees WHERE salary > {threshold} ORDER BY salary, name;")
        add(f"salary-count-above-{threshold}", f"Count Salaries Above {threshold}", "Medium", "COUNT / WHERE", f"Count employees whose salary is greater than {threshold}.", f"SELECT COUNT(*) FROM employees WHERE salary > {threshold};")
    for city in ["Chennai", "Bengaluru", "Hyderabad", "Pune"]:
        safe = city.replace("'", "''")
        add("employees-city-" + city.lower(), f"Employees in {city}", "Easy", "WHERE", f"List employee names whose city is {city}, alphabetically.", f"SELECT name FROM employees WHERE city = '{safe}' ORDER BY name;")
        add("employee-salary-city-" + city.lower(), f"Average Salary in {city}", "Medium", "AVG / GROUP BY", f"Return the average salary for employees in {city}, rounded to the nearest integer.", f"SELECT ROUND(AVG(salary)) FROM employees WHERE city = '{safe}';")
    for marks in [60, 75, 85, 90]:
        add(f"students-marks-above-{marks}", f"Students Scoring Above {marks}", "Easy", "WHERE", f"List student names and marks for students scoring above {marks}, highest marks first.", f"SELECT name, marks FROM students WHERE marks > {marks} ORDER BY marks DESC, name;")
        add(f"students-count-above-{marks}", f"Count Students Above {marks}", "Medium", "COUNT / WHERE", f"Count students whose marks exceed {marks}.", f"SELECT COUNT(*) FROM students WHERE marks > {marks};")
    for branch in ["CSE", "ECE", "EEE"]:
        add("students-branch-" + branch.lower(), f"Students in {branch}", "Easy", "WHERE", f"List names of students in branch {branch}, alphabetically.", f"SELECT name FROM students WHERE branch = '{branch}' ORDER BY name;")
        add("students-average-" + branch.lower(), f"Average Marks in {branch}", "Medium", "AVG / GROUP BY", f"Show rounded average marks for branch {branch}.", f"SELECT ROUND(AVG(marks)) FROM students WHERE branch = '{branch}';")
    for category in ["Accessories", "Computers", "Furniture", "Audio"]:
        add("products-category-" + category.lower(), f"Products in {category}", "Easy", "WHERE", f"List product names and prices in category {category}, ordered by price ascending.", f"SELECT name, price FROM products WHERE category = '{category}' ORDER BY price, name;")
        add("products-count-" + category.lower(), f"Count {category} Products", "Medium", "COUNT / WHERE", f"Count products in category {category}.", f"SELECT COUNT(*) FROM products WHERE category = '{category}';")
    for threshold in [1000, 5000, 20000, 50000]:
        add(f"products-under-{threshold}", f"Products Priced Below {threshold}", "Easy", "WHERE", f"List product names with price below {threshold}, lowest price first.", f"SELECT name FROM products WHERE price < {threshold} ORDER BY price, name;")
        add(f"products-stock-under-{threshold}", f"Low Stock Value at {threshold}", "Medium", "WHERE / AGGREGATE", f"Count products priced below {threshold} that have fewer than 20 units in stock.", f"SELECT COUNT(*) FROM products WHERE price < {threshold} AND stock < 20;")
    for status in ["Delivered", "Pending", "Shipped", "Cancelled"]:
        add("orders-status-" + status.lower(), f"Orders: {status}", "Easy", "WHERE", f"List order IDs and amounts for orders with status {status}, sorted by ID.", f"SELECT id, amount FROM orders WHERE status = '{status}' ORDER BY id;")
        add("orders-total-" + status.lower(), f"Total Amount: {status} Orders", "Medium", "SUM / WHERE", f"Calculate the total amount of orders with status {status}.", f"SELECT COALESCE(SUM(amount), 0) FROM orders WHERE status = '{status}';")
    aggregate_queries = [
        ("department-headcount","Employee Count By Department","Medium","GROUP BY","Show each department and its employee count, alphabetically by department.","SELECT department, COUNT(*) FROM employees GROUP BY department ORDER BY department;"),
        ("department-average-salary","Average Salary By Department","Medium","GROUP BY / AVG","Show each department's average salary rounded to an integer, ordered by department.","SELECT department, ROUND(AVG(salary)) FROM employees GROUP BY department ORDER BY department;"),
        ("department-max-salary","Maximum Salary By Department","Medium","GROUP BY / MAX","Show each department and its maximum salary.","SELECT department, MAX(salary) FROM employees GROUP BY department ORDER BY department;"),
        ("department-salary-total","Salary Total By Department","Medium","GROUP BY / SUM","Show each department's total salary, highest total first.","SELECT department, SUM(salary) FROM employees GROUP BY department ORDER BY SUM(salary) DESC, department;"),
        ("branch-top-marks","Top Marks By Branch","Medium","GROUP BY / MAX","Show each student branch and its highest mark, ordered by branch.","SELECT branch, MAX(marks) FROM students GROUP BY branch ORDER BY branch;"),
        ("customer-order-count","Orders Per Customer","Medium","GROUP BY / COUNT","Show each customer and number of orders, alphabetically.","SELECT customer, COUNT(*) FROM orders GROUP BY customer ORDER BY customer;"),
        ("customer-order-spend","Customer Spend","Medium","GROUP BY / SUM","Show customer total spend, highest total first.","SELECT customer, SUM(amount) FROM orders GROUP BY customer ORDER BY SUM(amount) DESC, customer;"),
        ("category-stock-total","Stock By Category","Medium","GROUP BY / SUM","Show each product category and total stock, alphabetically.","SELECT category, SUM(stock) FROM products GROUP BY category ORDER BY category;"),
        ("products-average-price","Average Price By Category","Medium","GROUP BY / AVG","Show each category and its rounded average price.","SELECT category, ROUND(AVG(price)) FROM products GROUP BY category ORDER BY category;"),
        ("salary-having-dept","Departments With Average Salary Above 65000","Hard","HAVING","Return departments with average salary above 65000 and their rounded average salary.","SELECT department, ROUND(AVG(salary)) FROM employees GROUP BY department HAVING AVG(salary) > 65000 ORDER BY department;"),
        ("student-having-branch","Branches With At Least 3 Students","Hard","HAVING","Return branches with at least three students and their counts.","SELECT branch, COUNT(*) FROM students GROUP BY branch HAVING COUNT(*) >= 3 ORDER BY branch;"),
        ("third-highest-salary","Third Highest Distinct Salary","Hard","Subquery","Find the third-highest distinct employee salary.","SELECT DISTINCT salary FROM employees ORDER BY salary DESC LIMIT 1 OFFSET 2;"),
        ("second-highest-marks","Second Highest Marks","Medium","Subquery","Find the second-highest distinct mark among students.","SELECT DISTINCT marks FROM students ORDER BY marks DESC LIMIT 1 OFFSET 1;"),
        ("employee-sales-join","Employee Sales Totals","Hard","JOIN / GROUP BY","Show employee names and total sales amount for employees with sales, highest total first.","SELECT e.name, SUM(s.amount) FROM employees e JOIN sales s ON s.employee_id=e.id GROUP BY e.id, e.name ORDER BY SUM(s.amount) DESC, e.name;"),
        ("products-sold-join","Products Sold","Hard","JOIN / GROUP BY","Show product names and total quantities sold, highest quantity first.","SELECT p.name, SUM(s.quantity) FROM products p JOIN sales s ON s.product_id=p.id GROUP BY p.id, p.name ORDER BY SUM(s.quantity) DESC, p.name;"),
        ("sales-by-department","Sales By Department","Hard","JOIN / GROUP BY","Show total sales amount per employee department, descending total.","SELECT e.department, SUM(s.amount) FROM employees e JOIN sales s ON s.employee_id=e.id GROUP BY e.department ORDER BY SUM(s.amount) DESC, e.department;"),
        ("employee-without-sales","Employees Without Sales","Hard","LEFT JOIN","List employees with no recorded sales, alphabetically.","SELECT e.name FROM employees e LEFT JOIN sales s ON s.employee_id=e.id WHERE s.id IS NULL ORDER BY e.name;"),
        ("orders-city-summary","Order Summary By City","Medium","GROUP BY","Show each city, number of orders and total amount, ordered by city.","SELECT city, COUNT(*), SUM(amount) FROM orders GROUP BY city ORDER BY city;"),
        ("top-two-products","Top Two Most Expensive Products","Easy","ORDER BY / LIMIT","Return the two most expensive product names and prices.","SELECT name, price FROM products ORDER BY price DESC, name LIMIT 2;"),
        ("employees-second-longest-service","Experienced Employees","Medium","WHERE / ORDER BY","List employees with at least five years of service, most experienced first.","SELECT name, years FROM employees WHERE years >= 5 ORDER BY years DESC, name;"),
    ]
    for item in aggregate_queries:
        add(*item)

    # Add additional non-duplicate, meaningful combinations until the SQL course has 94 new tasks.
    if len(rows) < 94:
        for dept in departments:
            safe = dept.replace("'", "''")
            for years in [2, 4, 6, 8]:
                add(f"{dept.lower()}-years-{years}", f"{dept} Employees With {years}+ Years", "Medium", "WHERE / ORDER BY", f"List names and years for employees in {dept} with at least {years} years' service, ordered by years then name.", f"SELECT name, years FROM employees WHERE department='{safe}' AND years >= {years} ORDER BY years, name;")
                if len(rows) >= 94: break
            if len(rows) >= 94: break
    if len(rows) < 94:
        for amount in [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000]:
            add(f"orders-amount-above-{amount}", f"Orders Above {amount}", "Easy", "WHERE", f"List order IDs and amounts where amount is greater than {amount}.", f"SELECT id, amount FROM orders WHERE amount > {amount} ORDER BY amount DESC, id;")
            if len(rows) >= 94: break
    if len(rows) < 94:
        for threshold in [10, 15, 20, 30, 40, 60, 80, 90]:
            add(f"stock-below-{threshold}", f"Products With Stock Below {threshold}", "Easy", "WHERE", f"List product names and stock for products with stock less than {threshold}.", f"SELECT name, stock FROM products WHERE stock < {threshold} ORDER BY stock, name;")
            if len(rows) >= 94: break
    return rows[:94]


def extended_problem_bank(language, existing_bank, target=100):
    """Merge the established exercises with enough extra topics to reach target."""
    if language == "sql":
        extra = _sql_extended_bank()
    else:
        extra = _common_bank(language)
    result = []
    seen = set()
    for problem in list(existing_bank) + list(extra):
        pid = str(problem.get("id", ""))
        if pid and pid in seen:
            continue
        if not pid:
            continue
        seen.add(pid)
        result.append(problem)
    # Interleave extra difficulties naturally so the first 100 don't contain only Easy tasks.
    if len(result) > target:
        base = list(existing_bank)
        extras = [p for p in result if p not in base]
        queues = {level: [p for p in extras if p.get("difficulty") == level] for level in ("Easy", "Medium", "Hard")}
        interleaved = []
        while any(queues.values()):
            for level in ("Easy", "Medium", "Hard"):
                if queues[level]:
                    interleaved.append(queues[level].pop(0))
        result = (base + interleaved)[:target]
    return result
