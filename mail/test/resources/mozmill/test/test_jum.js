var jum = {}; Components.utils.import('resource://mozmill/modules/jum.js', jum);

var testFails = function() {
 jum.assert(false, "failed");
 jum.assertTrue(false, "failed");
 jum.assertFalse(true, "failed");
 jum.assertEquals(2, 3, "failed");
 jum.assertNotEquals(3, 3, "failed");
 jum.assertNull(true, "failed");
 jum.assertNotNull(null, "failed");
 jum.assertUndefined(true, "failed");
 jum.assertNotUndefined(undefined, "failed");
 jum.assertNaN(3, "failed");
 jum.assertNotNaN(NaN, "failed");
 jum.fail("failed");
}

var testPass = function() {
 jum.assert(true, "shouldn't fail");
 jum.assertTrue(true, "shouldn't fail");
 jum.assertFalse(false, "shouldn't fail");
 jum.assertEquals(3, 3, "shouldn't fail");
 jum.assertNotEquals(2, 3, "shouldn't fail");
 jum.assertNull(null, "shouldn't fail");
 jum.assertNotNull(true, "shouldn't fail");
 jum.assertUndefined(undefined, "shouldn't fail");
 jum.assertNotUndefined(true, "shouldn't fail");
 jum.assertNaN(NaN, "shouldn't fail");
 jum.assertNotNaN(true, "shouldn't fail");
 jum.pass("shouldn't fail");
}