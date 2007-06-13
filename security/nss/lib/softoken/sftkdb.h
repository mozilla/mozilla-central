/*
 * license
 */

#include "sftkdbt.h"
#include "sdb.h"
#include "pkcs11i.h"
#include "pkcs11t.h"

/* raw database stuff */
CK_RV sftkdb_write(SFTKDBHandle *handle, SFTKObject *,CK_OBJECT_HANDLE *);
CK_RV sftkdb_FindObjectsInit(SFTKDBHandle *sdb, const CK_ATTRIBUTE *template,
				 CK_ULONG count, SDBFind **find);
CK_RV sftkdb_FindObjects(SFTKDBHandle *sdb, SDBFind *find, 
			CK_OBJECT_HANDLE *ids, int arraySize, CK_ULONG *count);
CK_RV sftkdb_FindObjectsFinal(SFTKDBHandle *sdb, SDBFind *find);
CK_RV sftkdb_GetAttributeValue(SFTKDBHandle *handle,
	 CK_OBJECT_HANDLE object_id, CK_ATTRIBUTE *template, CK_ULONG count);
CK_RV sftkdb_SetAttributeValue(SFTKDBHandle *handle, 
	 CK_OBJECT_HANDLE object_id, const CK_ATTRIBUTE *template, 
	 CK_ULONG count);
CK_RV sftkdb_DestroyObject(SFTKDBHandle *handle, CK_OBJECT_HANDLE object_id);
CK_RV sftkdb_closeDB(SFTKDBHandle *handle);


/* secmod.db functions */
char ** sftkdb_ReadSecmodDB(SDBType dbType, const char *appName, 
			    const char *filename, const char *dbname, 
			    char *params, PRBool rw);
SECStatus sftkdb_ReleaseSecmodDBData(SDBType dbType, const char *appName, 
				     const char *filename, const char *dbname, 
				     char **moduleSpecList, PRBool rw);
SECStatus sftkdb_DeleteSecmodDB(SDBType dbType, const char *appName, 
				const char *filename, const char *dbname, 
				char *args, PRBool rw);
SECStatus sftkdb_AddSecmodDB(SDBType dbType, const char *appName, 
			     const char *filename, const char *dbname, 
			     char *module, PRBool rw);

/* keydb functions */

SECStatus sftkdb_PWIsInitialized(SFTKDBHandle *keydb);
SECStatus sftkdb_CheckPassword(SFTKDBHandle *keydb, const char *pw);
SECStatus sftkdb_PWCached(SFTKDBHandle *keydb);
SECStatus sftkdb_HasPasswordSet(SFTKDBHandle *keydb);
SECStatus sftkdb_ResetKeyDB(SFTKDBHandle *keydb);
SECStatus sftkdb_ChangePassword(SFTKDBHandle *keydb, char *oldPin, char *newPin);
SECStatus sftkdb_ClearPassword(SFTKDBHandle *keydb);

/* Utility functions */
/*
 * OK there are now lots of options here, lets go through them all:
 *
 * configdir - base directory where all the cert, key, and module datbases live.
 * certPrefix - prefix added to the beginning of the cert database example: "
 *                      "https-server1-"
 * keyPrefix - prefix added to the beginning of the key database example: "
 *                      "https-server1-"
 * secmodName - name of the security module database (usually "secmod.db").
 * readOnly - Boolean: true if the databases are to be openned read only.
 * nocertdb - Don't open the cert DB and key DB's, just initialize the
 *                      Volatile certdb.
 * nomoddb - Don't open the security module DB, just initialize the
 *                      PKCS #11 module.
 * forceOpen - Continue to force initializations even if the databases cannot
 *                      be opened.
 */
CK_RV sftk_DBInit(const char *configdir, const char *certPrefix,
	 	const char *keyPrefix, PRBool readOnly, PRBool noCertDB, 
		PRBool noKeyDB, PRBool forceOpen, 
		SFTKDBHandle **certDB, SFTKDBHandle **keyDB);
CK_RV sftkdb_Shutdown(void);

SFTKDBHandle *sftk_getCertDB(SFTKSlot *slot);
SFTKDBHandle *sftk_getKeyDB(SFTKSlot *slot);
SFTKDBHandle *sftk_getDBForTokenObject(SFTKSlot *slot, 
                                       CK_OBJECT_HANDLE objectID);
void sftk_freeDB(SFTKDBHandle *certHandle);

/*
 * for lgglue, stubs to encrypt and decrypt password entries
 */
SECStatus sftkdb_encrypt_stub(PRArenaPool *arena, SDB *sdb, SECItem *plainText,
                    SECItem **cipherText);
SECStatus sftkdb_decrypt_stub(SDB *sdb, SECItem *cipherText, 
		    SECItem **plainText);




