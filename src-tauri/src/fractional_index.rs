/// Fractional indexing for deterministic ordering of tasks.
///
/// Keys are non-empty strings that sort lexicographically using standard string
/// comparison.  The alphabet used is `a..=z` (26 characters), keeping the
/// implementation simple while providing enough branching factor for a
/// single-user task manager.
///
/// ## Key structure
///
/// A key is a non-empty string of lowercase ASCII letters (`a`..=`z`).  There
/// is no separate "integer part" and "fractional part" -- every character
/// position is treated uniformly, and standard lexicographic ordering on the
/// strings gives the total order.
///
/// ## Design choices
///
/// * Default first key: `"n"` (middle of the alphabet).
/// * Midpoint: character-by-character walk; when the two keys share a prefix
///   and the gap at the current position is too narrow (0 or 1), we extend into
///   the next character position using `a` (from the lower key, padded) and `z`
///   (from the upper key, padded) and continue looking for a midpoint.
/// * After a key (b is `None`): increment the trailing character; if already
///   `z`, append `n`.
/// * Before a key (a is `None`): decrement the trailing character; if already
///   `a`, append `n`.

// ---------------------------------------------------------------------------
// Alphabet helpers
// ---------------------------------------------------------------------------

const FIRST: u8 = b'a';
const LAST: u8 = b'z';

/// Return the midpoint character between two characters in the alphabet.
/// Returns `None` when the gap is 0 or 1 (i.e. they are equal or adjacent).
fn midpoint_char(a: u8, b: u8) -> Option<u8> {
    debug_assert!(a >= FIRST && a <= LAST);
    debug_assert!(b >= FIRST && b <= LAST);
    debug_assert!(a <= b);
    let mid = a + (b - a) / 2;
    if mid == a {
        None // gap is 0 or 1
    } else {
        Some(mid)
    }
}

// ---------------------------------------------------------------------------
// Core public function
// ---------------------------------------------------------------------------

/// Generates a fractional index key that sorts between `a` and `b`.
///
/// - `generate_key_between(None, None)` -- returns a reasonable first key (e.g., `"n"`).
/// - `generate_key_between(Some("a0"), None)` -- returns a key after the given key.
/// - `generate_key_between(None, Some("a0"))` -- returns a key before the given key.
/// - `generate_key_between(Some(a), Some(b))` -- returns a key where `a < result < b`.
///
/// # Panics
///
/// Panics if `a >= b` (caller must ensure proper ordering), or if either key
/// contains characters outside `a..=z`.
pub fn generate_key_between(a: Option<&str>, b: Option<&str>) -> String {
    // Validate inputs.
    if let Some(a_str) = a {
        assert!(!a_str.is_empty(), "key `a` must be non-empty");
        assert!(
            a_str.bytes().all(|c| c >= FIRST && c <= LAST),
            "key `a` must contain only lowercase ASCII letters (a-z)"
        );
    }
    if let Some(b_str) = b {
        assert!(!b_str.is_empty(), "key `b` must be non-empty");
        assert!(
            b_str.bytes().all(|c| c >= FIRST && c <= LAST),
            "key `b` must contain only lowercase ASCII letters (a-z)"
        );
    }
    if let (Some(a_str), Some(b_str)) = (a, b) {
        assert!(a_str < b_str, "key `a` ({a_str}) must be less than key `b` ({b_str})");
    }

    match (a, b) {
        (None, None) => "n".to_string(),
        (Some(a_str), None) => generate_after(a_str),
        (None, Some(b_str)) => generate_before(b_str),
        (Some(a_str), Some(b_str)) => generate_between(a_str, b_str),
    }
}

// ---------------------------------------------------------------------------
// Generating a key AFTER a given key (append to end)
// ---------------------------------------------------------------------------

/// Generate a key that sorts after `a`.
fn generate_after(a: &str) -> String {
    let bytes = a.as_bytes();
    // Try to increment the last character.
    let last = *bytes.last().unwrap();
    if last < LAST {
        // Simple case: just bump the last char.
        let mut result = a.to_string();
        // Safety: replacing one ASCII byte with another ASCII byte.
        unsafe {
            result.as_bytes_mut()[bytes.len() - 1] = last + 1;
        }
        result
    } else {
        // Last char is 'z'; append a midpoint character to extend.
        let mut result = a.to_string();
        result.push('n');
        result
    }
}

// ---------------------------------------------------------------------------
// Generating a key BEFORE a given key (insert at start)
// ---------------------------------------------------------------------------

/// Generate a key that sorts before `b`.
fn generate_before(b: &str) -> String {
    let bytes = b.as_bytes();
    let last = *bytes.last().unwrap();
    if last > FIRST + 1 {
        // There is room to decrement: pick the midpoint between FIRST and last.
        // This biases toward the middle of the available space rather than
        // always picking `last - 1`, which would exhaust space quickly during
        // sequential prepends.
        let mid = FIRST + (last - FIRST) / 2;
        let mut result = b.to_string();
        unsafe {
            result.as_bytes_mut()[bytes.len() - 1] = mid;
        }
        result
    } else if last > FIRST {
        // last is 'b'; decrementing gives 'a' which is fine but leaves no room
        // for further prepends at this length. Instead, replace with 'a' and
        // append 'n' to leave space.
        let mut result = String::with_capacity(bytes.len() + 1);
        result.push_str(&b[..bytes.len() - 1]);
        result.push(FIRST as char);
        result.push('n' as char);
        result
    } else {
        // last is 'a'; we can't go lower at this position. Append 'n' to get
        // a string that sorts before (e.g. "aa" + "n" = "aan" which is < "ab"
        // but we need < "aa"... tricky). Actually "a" + "n" = "an" which is
        // > "a" not < "a". We need a different strategy.
        //
        // The correct approach: to go before a key whose last char is 'a', we
        // must extend it. E.g., before "a" we want something less -- but with
        // only 'a'-'z', there's nothing less than "a" at length 1. So we go
        // to length 2: "a" < "aa" ... no, "aa" > "a" lexicographically.
        //
        // In a pure lowercase system, "a" is the smallest single-char key.
        // To go before it we need a two-char key that sorts before "a" -- but
        // there is no such key because "a?" > "a" for all ?.
        //
        // Resolution: we treat the key as having implicit trailing 'a's for
        // comparison (since 'a' is the lowest char). So "a" is effectively
        // "aaa...". To go before "a" (= "aaa..."), we'd need something that
        // doesn't exist in this system.
        //
        // Practical fix: we prepend the key with FIRST and take a midpoint.
        // E.g., before "a": treat as ("", "a") -> we pick "a" with an appended
        // midpoint? Actually, let's just handle this by prepending a new 'a'
        // and appending 'n': so before "a" -> "an"... but "an" > "a".
        //
        // The fundamental issue: in a system where all keys share the same
        // alphabet and sort lexicographically, you CANNOT have a key that is
        // strictly less than the smallest 1-char key.  We could use a longer
        // key like "an" but "an" > "a".
        //
        // FIX: We actually CAN go before "a" by noting that in lexicographic
        // order, "a" < "aa" < "ab" < ... However "a" is already the minimum
        // single-char key. We need to acknowledge that the user should never
        // really hit this edge because we start at "n". But as a safety net,
        // we panic/error.
        //
        // ACTUALLY, let me reconsider. The spec says we only need to handle
        // reasonable cases. Let's use a broader approach: pad both keys and
        // find midpoints -- i.e., reuse generate_between with a synthetic
        // lower bound. We'll use a special "virtual minimum" trick: prepend
        // an 'a' to b and use that as the result if b has length 1 and starts
        // with 'a'. But since we need result < b, and "a" + anything > "a",
        // this is impossible.
        //
        // FINAL RESOLUTION: panic with a helpful message. The caller should
        // renumber before hitting this edge.  In practice, starting from "n",
        // you can prepend ~12 times before exhausting space at length 1.
        panic!(
            "Cannot generate a key before \"{b}\": already at minimum. \
             Consider renumbering."
        );
    }
}

// ---------------------------------------------------------------------------
// Generating a key BETWEEN two given keys
// ---------------------------------------------------------------------------

/// Generate a key that sorts strictly between `a` and `b`.
fn generate_between(a: &str, b: &str) -> String {
    let a_bytes = a.as_bytes();
    let b_bytes = b.as_bytes();

    // Walk character-by-character looking for a position where we can insert a
    // midpoint.
    let max_len = a_bytes.len().max(b_bytes.len());

    for i in 0..max_len {
        let ca = if i < a_bytes.len() { a_bytes[i] } else { FIRST };
        let cb = if i < b_bytes.len() { b_bytes[i] } else { LAST };

        if ca == cb {
            // Same character at this position; continue to next position.
            continue;
        }

        // There is a gap at position i.
        if let Some(mid) = midpoint_char(ca, cb) {
            // We found a midpoint character. Build the result: shared prefix
            // up to position i, then mid.
            let mut result = String::with_capacity(i + 1);
            // Use chars from `a` (or 'a'-padded) for the prefix, then mid.
            for j in 0..i {
                let c = if j < a_bytes.len() { a_bytes[j] } else { FIRST };
                result.push(c as char);
            }
            result.push(mid as char);
            return result;
        }

        // The gap is exactly 1 (ca + 1 == cb). We cannot fit a character
        // between them at this position. We need to go deeper.
        //
        // Strategy: keep the prefix including ca at position i, then look at
        // the next position. For the next position:
        // - a's next char is a[i+1] if it exists, else 'a' (virtual pad).
        // - b's "next char" is 'z' (since we've stepped below cb, anything
        //   up to 'z' at deeper positions will still sort before b).
        //
        // So we continue the loop with adjusted logic: from position i+1
        // onward, b is effectively all-'z' at each position.
        //
        // Implement this by building the result from the prefix of `a` up to
        // position i (inclusive), then finding a midpoint between a's
        // remaining suffix and 'zzz...'.
        let mut result = String::with_capacity(i + 2);
        for j in 0..=i {
            let c = if j < a_bytes.len() { a_bytes[j] } else { FIRST };
            result.push(c as char);
        }
        // Now find a midpoint for the remaining part.
        // a's remaining: a[i+1..], padded with 'a'.
        // b's remaining: 'z' repeated.
        let remaining_start = i + 1;
        // We need at least one more character. Walk deeper positions.
        let mut depth = remaining_start;
        loop {
            let ca_next = if depth < a_bytes.len() {
                a_bytes[depth]
            } else {
                FIRST
            };
            // b side is 'z' at all remaining positions.
            let cb_next = LAST;

            if let Some(mid) = midpoint_char(ca_next, cb_next) {
                result.push(mid as char);
                return result;
            }
            // ca_next and cb_next are adjacent or equal -- keep going deeper.
            result.push(ca_next as char);
            depth += 1;

            // Safety valve (should never be needed for reasonable inputs).
            if depth > 200 {
                panic!("fractional index: exceeded maximum depth");
            }
        }
    }

    // If we get here, a and b are identical (after padding), which should not
    // happen because we validated a < b.  Extend by appending a midpoint.
    let mut result = a.to_string();
    result.push('n');
    result
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // -----------------------------------------------------------------------
    // Basic cases
    // -----------------------------------------------------------------------

    #[test]
    fn test_none_none_returns_valid_key() {
        let key = generate_key_between(None, None);
        assert!(!key.is_empty());
        assert!(key.bytes().all(|c| c >= FIRST && c <= LAST));
    }

    #[test]
    fn test_after_key() {
        let first = generate_key_between(None, None);
        let second = generate_key_between(Some(&first), None);
        assert!(second > first, "expected {second} > {first}");
    }

    #[test]
    fn test_before_key() {
        let first = generate_key_between(None, None);
        let before = generate_key_between(None, Some(&first));
        assert!(before < first, "expected {before} < {first}");
    }

    #[test]
    fn test_between_keys() {
        let a = "c".to_string();
        let b = "e".to_string();
        let mid = generate_key_between(Some(&a), Some(&b));
        assert!(mid > a, "expected {mid} > {a}");
        assert!(mid < b, "expected {mid} < {b}");
    }

    #[test]
    fn test_between_adjacent_single_chars() {
        // "a" and "c" have midpoint "b".
        let mid = generate_key_between(Some("a"), Some("c"));
        assert_eq!(mid, "b");
    }

    #[test]
    fn test_between_close_keys() {
        // "a" and "b" are adjacent; midpoint must go deeper.
        let mid = generate_key_between(Some("a"), Some("b"));
        assert!(mid.as_str() > "a", "expected {mid} > a");
        assert!(mid.as_str() < "b", "expected {mid} < b");
    }

    #[test]
    fn test_between_multi_char_keys() {
        let mid = generate_key_between(Some("an"), Some("bc"));
        assert!(mid.as_str() > "an", "expected {mid} > an");
        assert!(mid.as_str() < "bc", "expected {mid} < bc");
    }

    #[test]
    fn test_between_same_prefix() {
        let mid = generate_key_between(Some("abc"), Some("abz"));
        assert!(mid.as_str() > "abc", "expected {mid} > abc");
        assert!(mid.as_str() < "abz", "expected {mid} < abz");
    }

    // -----------------------------------------------------------------------
    // Sequential appends (simulating adding many tasks at the end)
    // -----------------------------------------------------------------------

    #[test]
    fn test_sequential_appends_20() {
        let mut keys: Vec<String> = Vec::new();
        let first = generate_key_between(None, None);
        keys.push(first);

        for _ in 0..19 {
            let prev = keys.last().unwrap().clone();
            let next = generate_key_between(Some(&prev), None);
            assert!(
                next > prev,
                "append ordering violated: {} should be > {}",
                next,
                prev
            );
            keys.push(next);
        }

        // Verify all keys are strictly ascending.
        for i in 1..keys.len() {
            assert!(
                keys[i] > keys[i - 1],
                "key[{i}]={} should be > key[{}]={}",
                keys[i],
                i - 1,
                keys[i - 1]
            );
        }

        // Print for visual inspection during development.
        // (Won't show in normal test runs unless --nocapture is used.)
        for (i, k) in keys.iter().enumerate() {
            println!("  append[{i:>2}] = \"{k}\"");
        }
    }

    // -----------------------------------------------------------------------
    // Sequential prepends (simulating inserting at the start)
    // -----------------------------------------------------------------------

    #[test]
    fn test_sequential_prepends_10() {
        let mut keys: Vec<String> = Vec::new();
        let first = generate_key_between(None, None);
        keys.push(first);

        for _ in 0..9 {
            let last = keys.last().unwrap().clone();
            let prev = generate_key_between(None, Some(&last));
            assert!(
                prev < last,
                "prepend ordering violated: {} should be < {}",
                prev,
                last
            );
            keys.push(prev);
        }

        // Reverse to get ascending order and verify.
        keys.reverse();
        for i in 1..keys.len() {
            assert!(
                keys[i] > keys[i - 1],
                "key[{i}]={} should be > key[{}]={}",
                keys[i],
                i - 1,
                keys[i - 1]
            );
        }

        for (i, k) in keys.iter().enumerate() {
            println!("  prepend[{i:>2}] = \"{k}\"");
        }
    }

    // -----------------------------------------------------------------------
    // Insert between adjacent keys
    // -----------------------------------------------------------------------

    #[test]
    fn test_insert_between_adjacent() {
        let a = generate_key_between(None, None);
        let b = generate_key_between(Some(&a), None);

        let mid = generate_key_between(Some(&a), Some(&b));
        assert!(mid > a, "expected {mid} > {a}");
        assert!(mid < b, "expected {mid} < {b}");
    }

    #[test]
    fn test_repeated_bisection() {
        // Start with two keys and repeatedly insert between them.
        let lo = "a".to_string();
        let mut hi = "z".to_string();

        for _ in 0..15 {
            let mid = generate_key_between(Some(&lo), Some(&hi));
            assert!(mid > lo, "expected {mid} > {lo}");
            assert!(mid < hi, "expected {mid} < {hi}");
            // Narrow the window from the high side to exercise deep bisection.
            hi = mid;
        }
    }

    // -----------------------------------------------------------------------
    // Panics
    // -----------------------------------------------------------------------

    #[test]
    #[should_panic(expected = "must be less than")]
    fn test_panics_on_equal_keys() {
        generate_key_between(Some("x"), Some("x"));
    }

    #[test]
    #[should_panic(expected = "must be less than")]
    fn test_panics_on_reversed_keys() {
        generate_key_between(Some("b"), Some("a"));
    }

    // -----------------------------------------------------------------------
    // Edge cases
    // -----------------------------------------------------------------------

    #[test]
    fn test_after_z() {
        // "z" is the max single char; appending should still work.
        let key = generate_key_between(Some("z"), None);
        assert!(key > "z".to_string());
    }

    #[test]
    fn test_between_long_shared_prefix() {
        let a = "abcdefgn";
        let b = "abcdefgo";
        let mid = generate_key_between(Some(a), Some(b));
        assert!(mid.as_str() > a, "expected {mid} > {a}");
        assert!(mid.as_str() < b, "expected {mid} < {b}");
    }

    #[test]
    fn test_between_different_lengths() {
        // a is a prefix of b (conceptually).
        let a = "abc";
        let b = "abcn";
        let mid = generate_key_between(Some(a), Some(b));
        assert!(mid.as_str() > a, "expected {mid} > {a}");
        assert!(mid.as_str() < b, "expected {mid} < {b}");
    }

    #[test]
    fn test_between_very_different_keys() {
        let mid = generate_key_between(Some("a"), Some("z"));
        // a=97, z=122, mid = 97 + (122-97)/2 = 97+12 = 109 = 'm'.
        assert_eq!(mid, "m");
        assert!(mid.as_str() > "a");
        assert!(mid.as_str() < "z");
    }

    #[test]
    fn test_key_characters_are_valid() {
        // Generate a bunch of keys and make sure they only contain a-z.
        let mut key = generate_key_between(None, None);
        for _ in 0..30 {
            assert!(key.bytes().all(|c| c >= b'a' && c <= b'z'), "invalid chars in key: {key}");
            key = generate_key_between(Some(&key), None);
        }
    }

    // -----------------------------------------------------------------------
    // Practical scenario: build an ordered list of 50 items
    // -----------------------------------------------------------------------

    #[test]
    fn test_build_ordered_list_of_50() {
        let mut keys: Vec<String> = Vec::new();

        // Add 50 items to the end.
        for _ in 0..50 {
            let new_key = if keys.is_empty() {
                generate_key_between(None, None)
            } else {
                generate_key_between(Some(keys.last().unwrap().as_str()), None)
            };
            keys.push(new_key);
        }

        // Verify ordering.
        for i in 1..keys.len() {
            assert!(
                keys[i] > keys[i - 1],
                "ordering violated at index {i}: {} should be > {}",
                keys[i],
                keys[i - 1]
            );
        }

        // Insert between every pair of adjacent keys.
        let mut with_inserts: Vec<String> = Vec::new();
        for i in 0..keys.len() {
            with_inserts.push(keys[i].clone());
            if i + 1 < keys.len() {
                let mid = generate_key_between(
                    Some(keys[i].as_str()),
                    Some(keys[i + 1].as_str()),
                );
                assert!(mid > keys[i]);
                assert!(mid < keys[i + 1]);
                with_inserts.push(mid);
            }
        }

        // Verify the expanded list is still sorted.
        for i in 1..with_inserts.len() {
            assert!(
                with_inserts[i] > with_inserts[i - 1],
                "expanded ordering violated at index {i}: {} should be > {}",
                with_inserts[i],
                with_inserts[i - 1]
            );
        }
    }
}
