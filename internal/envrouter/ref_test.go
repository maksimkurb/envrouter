package envrouter

import "testing"

func TestSanitizeRef(t *testing.T) {
	valid := []string{"master", "feature/new-ui", "v1.2.3", "release_2024", "a1b2c3d4e5f6", "  main  "}
	for _, in := range valid {
		if _, err := sanitizeRef(in); err != nil {
			t.Errorf("sanitizeRef(%q) rejected valid ref: %v", in, err)
		}
	}
	// injection / traversal / malformed must all be rejected
	invalid := []string{
		"", "   ",
		"master&variables[X]=y", // webhook query injection
		"main ref",              // space
		"a/../b",                // traversal
		"/leading", "trailing/",
		"has\ttab", "semi;colon", "back\\slash",
	}
	for _, in := range invalid {
		if _, err := sanitizeRef(in); err == nil {
			t.Errorf("sanitizeRef(%q) accepted invalid ref", in)
		}
	}
}
