/*
 * license
 */


#ifndef SFTKDBT_H
#define SFTKDBT_H 1
typedef struct SFTKDBHandleStr SFTKDBHandle;

#define SDB_MAX_META_DATA_LEN	256

typedef enum {
   SDB_SQL,
   SDB_EXTERN,
   SDB_LEGACY,
   SDB_MULTIACCESS
} SDBType;

#endif
