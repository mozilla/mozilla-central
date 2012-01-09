/*
 * libjingle
 * Copyright 2011, Google Inc.
 * Portions Copyright 2011, RTFM, Inc.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 *  1. Redistributions of source code must retain the above copyright notice,
 *     this list of conditions and the following disclaimer.
 *  2. Redistributions in binary form must reproduce the above copyright notice,
 *     this list of conditions and the following disclaimer in the documentation
 *     and/or other materials provided with the distribution.
 *  3. The name of the author may not be used to endorse or promote products
 *     derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR IMPLIED
 * WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO
 * EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
 * OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
 * ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

#include <string>

#include "talk/base/gunit.h"
#include "talk/base/sslidentity.h"

const char kTestCertificate[] = "-----BEGIN CERTIFICATE-----\n"
    "MIIB6TCCAVICAQYwDQYJKoZIhvcNAQEEBQAwWzELMAkGA1UEBhMCQVUxEzARBgNV\n"
    "BAgTClF1ZWVuc2xhbmQxGjAYBgNVBAoTEUNyeXB0U29mdCBQdHkgTHRkMRswGQYD\n"
    "VQQDExJUZXN0IENBICgxMDI0IGJpdCkwHhcNMDAxMDE2MjIzMTAzWhcNMDMwMTE0\n"
    "MjIzMTAzWjBjMQswCQYDVQQGEwJBVTETMBEGA1UECBMKUXVlZW5zbGFuZDEaMBgG\n"
    "A1UEChMRQ3J5cHRTb2Z0IFB0eSBMdGQxIzAhBgNVBAMTGlNlcnZlciB0ZXN0IGNl\n"
    "cnQgKDUxMiBiaXQpMFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAJ+zw4Qnlf8SMVIP\n"
    "Fe9GEcStgOY2Ww/dgNdhjeD8ckUJNP5VZkVDTGiXav6ooKXfX3j/7tdkuD8Ey2//\n"
    "Kv7+ue0CAwEAATANBgkqhkiG9w0BAQQFAAOBgQCT0grFQeZaqYb5EYfk20XixZV4\n"
    "GmyAbXMftG1Eo7qGiMhYzRwGNWxEYojf5PZkYZXvSqZ/ZXHXa4g59jK/rJNnaVGM\n"
    "k+xIX8mxQvlV0n5O9PIha5BX5teZnkHKgL8aKKLKW1BK7YTngsfSzzaeame5iKfz\n"
    "itAE+OjGF+PFKbwX8Q==\n"
    "-----END CERTIFICATE-----\n";

const unsigned char kTestCertSha1[] = {0xA6, 0xC8, 0x59, 0xEA,
                                       0xC3, 0x7E, 0x6D, 0x33,
                                       0xCF, 0xE2, 0x69, 0x9D,
                                       0x74, 0xE6, 0xF6, 0x8A,
                                       0x9E, 0x47, 0xA7, 0xCA};

class SSLIdentityTest : public testing::Test {
 public:
  SSLIdentityTest() :
      identity1_(NULL), identity2_(NULL) {
  }

  ~SSLIdentityTest() {
  }

  virtual void SetUp() {
    identity1_.reset(talk_base::SSLIdentity::Generate("test1"));
    identity2_.reset(talk_base::SSLIdentity::Generate("test2"));

    ASSERT_TRUE(identity1_.get() != NULL);
    ASSERT_TRUE(identity2_.get() != NULL);

    test_cert_.reset(
        talk_base::SSLCertificate::FromPEMString(kTestCertificate, 0));
    ASSERT_TRUE(test_cert_.get() != NULL);
  }

  void TestDigest(const std::string &algorithm, size_t expected_len,
                  const unsigned char *expected_digest = NULL) {
    unsigned char digest1[64];
    unsigned char digest1b[64];
    unsigned char digest2[64];
    size_t digest1_len;
    size_t digest1b_len;
    size_t digest2_len;
    bool rv;

    rv = identity1_->certificate().ComputeDigest(algorithm,
                                                 digest1, sizeof(digest1),
                                                 &digest1_len);
    EXPECT_TRUE(rv);
    EXPECT_EQ(expected_len, digest1_len);

    rv = identity1_->certificate().ComputeDigest(algorithm,
                                                 digest1b, sizeof(digest1b),
                                                 &digest1b_len);
    EXPECT_TRUE(rv);
    EXPECT_EQ(expected_len, digest1b_len);
    EXPECT_EQ(0, memcmp(digest1, digest1b, expected_len));


    rv = identity2_->certificate().ComputeDigest(algorithm,
                                                 digest2, sizeof(digest2),
                                                 &digest2_len);
    EXPECT_TRUE(rv);
    EXPECT_EQ(expected_len, digest2_len);
    EXPECT_NE(0, memcmp(digest1, digest2, expected_len));

    // If we have an expected hash for the test cert, check it.
    if (expected_digest != NULL) {
      unsigned char digest3[64];
      size_t digest3_len;

      rv = test_cert_->ComputeDigest(algorithm, digest3, sizeof(digest3),
                                    &digest3_len);
      EXPECT_TRUE(rv);
      EXPECT_EQ(expected_len, digest3_len);
      EXPECT_EQ(0, memcmp(digest3, expected_digest, expected_len));
    }
  }

 private:
  talk_base::scoped_ptr<talk_base::SSLIdentity> identity1_;
  talk_base::scoped_ptr<talk_base::SSLIdentity> identity2_;
  talk_base::scoped_ptr<talk_base::SSLCertificate> test_cert_;
};

TEST_F(SSLIdentityTest, DigestSHA1) {
  TestDigest(talk_base::DIGEST_SHA_1, 20, kTestCertSha1);
}

TEST_F(SSLIdentityTest, DigestSHA224) {
  TestDigest(talk_base::DIGEST_SHA_224, 28);
}

TEST_F(SSLIdentityTest, DigestSHA256) {
  TestDigest(talk_base::DIGEST_SHA_256, 32);
}

TEST_F(SSLIdentityTest, DigestSHA384) {
  TestDigest(talk_base::DIGEST_SHA_384, 48);
}

TEST_F(SSLIdentityTest, DigestSHA512) {
  TestDigest(talk_base::DIGEST_SHA_512, 64);
}
