package com.example.messaging.util;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

class StudentEmailPolicyTest {

    @Test
    void acceptsStudentEmailsCaseInsensitivelyAndTrimmed() {
        assertTrue(StudentEmailPolicy.isValid("sv001@st.cmcu.edu.vn"));
        assertTrue(StudentEmailPolicy.isValid("SV.001@ST.CMCU.EDU.VN"));
        assertTrue(StudentEmailPolicy.isValid("  a_b+c@st.cmcu.edu.vn  "));
    }

    @Test
    void rejectsOtherDomainsAndLookalikes() {
        assertFalse(StudentEmailPolicy.isValid(null));
        assertFalse(StudentEmailPolicy.isValid(""));
        assertFalse(StudentEmailPolicy.isValid("a@gmail.com"));
        assertFalse(StudentEmailPolicy.isValid("a@cmcu.edu.vn"));
        assertFalse(StudentEmailPolicy.isValid("a@xst.cmcu.edu.vn"));
        assertFalse(StudentEmailPolicy.isValid("a@st.cmcu.edu.vn.evil.com"));
        assertFalse(StudentEmailPolicy.isValid("@st.cmcu.edu.vn"));
        assertFalse(StudentEmailPolicy.isValid("a b@st.cmcu.edu.vn"));
    }

    @Test
    void dtoRegexRejectsWhitespaceAroundEmail() {
        assertTrue(Pattern.matches(StudentEmailPolicy.REGEX, "x@st.cmcu.edu.vn"));
        assertFalse(Pattern.matches(StudentEmailPolicy.REGEX, " x@st.cmcu.edu.vn"));
        assertFalse(Pattern.matches(StudentEmailPolicy.REGEX, "x@st.cmcu.edu.vn\n"));
    }
}
