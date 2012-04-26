/* public api for steve reid's public domain SHA-1 implementation */
/* this file is in the public domain */

#ifndef __SHA1_H
#define __SHA1_H

#ifdef __cplusplus
extern "C" {
#endif

typedef unsigned int uint32;
typedef unsigned char uint8;

typedef struct {
    uint32 state[5];
    uint32 count[2];
    uint8  buffer[64];
} SHA1_CTX;

#define SHA1_DIGEST_SIZE 20

void SHA1Init(SHA1_CTX* context);
void SHA1Update(SHA1_CTX* context, const uint8* data, const size_t len);
void SHA1Final(SHA1_CTX* context, uint8 digest[SHA1_DIGEST_SIZE]);

#ifdef __cplusplus
}
#endif

#endif /* __SHA1_H */
