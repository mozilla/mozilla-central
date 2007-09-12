/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Red Hat, Inc.
 *
 * The Initial Developer of the Original Code is
 * Red Hat, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Robert Relyea (rrelyea@redhat.com)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
/*
 * This file implements PKCS 11 on top of our existing security modules
 *
 * For more information about PKCS 11 See PKCS 11 Token Inteface Standard.
 *   This implementation has two slots:
 *	slot 1 is our generic crypto support. It does not require login.
 *   It supports Public Key ops, and all they bulk ciphers and hashes. 
 *   It can also support Private Key ops for imported Private keys. It does 
 *   not have any token storage.
 *	slot 2 is our private key support. It requires a login before use. It
 *   can store Private Keys and Certs as token objects. Currently only private
 *   keys and their associated Certificates are saved on the token.
 *
 *   In this implementation, session objects are only visible to the session
 *   that created or generated them.
 */

#include "sdb.h"
#include "pkcs11t.h"
#include "seccomon.h"
#include <sqlite3.h>
#include "prthread.h"
#include "prio.h"
#include "stdio.h"

#include "prlock.h"

#ifdef SQLITE_UNSAFE_THREADS
/*
 * SQLite can be compiled to be thread safe or not.
 * turn on SQLITE_UNSAFE_THREADS if the OS does not support
 * a thread safe version of sqlite.
 */
static PRLock *sqlite_lock = NULL;

#define LOCK_SQLITE()  PR_Lock(sqlite_lock);
#define UNLOCK_SQLITE()  PR_Unlock(sqlite_lock);
#else
#define LOCK_SQLITE()  
#define UNLOCK_SQLITE()  
#endif

typedef enum {
	SDB_CERT = 1,
	SDB_KEY = 2
} sdbDataType;

struct SDBPrivateStr {
    char *sqlDBName;		/* invarient, path to this database */
    sqlite3 *sqlXactDB;		/* protected by lock, current transaction db*/
    PRThread *sqlXactThread;	/* protected by lock,
			         * current transaiction thred*/
    sdbDataType type;		/* invariant, database type */
    char *table;	        /* invariant, SQL table which contains the db */
    PRLock *lock;		/* invariant, lock to protect sqlXact* fields*/
};

typedef struct SDBPrivateStr SDBPrivate;

/*
 * known attributes
 */
static const CK_ATTRIBUTE_TYPE known_attributes[] = {
    CKA_CLASS, CKA_TOKEN, CKA_PRIVATE, CKA_LABEL, CKA_APPLICATION,
    CKA_VALUE, CKA_OBJECT_ID, CKA_CERTIFICATE_TYPE, CKA_ISSUER,
    CKA_SERIAL_NUMBER, CKA_AC_ISSUER, CKA_OWNER, CKA_ATTR_TYPES, CKA_TRUSTED,
    CKA_CERTIFICATE_CATEGORY, CKA_JAVA_MIDP_SECURITY_DOMAIN, CKA_URL,
    CKA_HASH_OF_SUBJECT_PUBLIC_KEY, CKA_HASH_OF_ISSUER_PUBLIC_KEY,
    CKA_CHECK_VALUE, CKA_KEY_TYPE, CKA_SUBJECT, CKA_ID, CKA_SENSITIVE,
    CKA_ENCRYPT, CKA_DECRYPT, CKA_WRAP, CKA_UNWRAP, CKA_SIGN, CKA_SIGN_RECOVER,
    CKA_VERIFY, CKA_VERIFY_RECOVER, CKA_DERIVE, CKA_START_DATE, CKA_END_DATE,
    CKA_MODULUS, CKA_MODULUS_BITS, CKA_PUBLIC_EXPONENT, CKA_PRIVATE_EXPONENT,
    CKA_PRIME_1, CKA_PRIME_2, CKA_EXPONENT_1, CKA_EXPONENT_2, CKA_COEFFICIENT,
    CKA_PRIME, CKA_SUBPRIME, CKA_BASE, CKA_PRIME_BITS, 
    CKA_SUB_PRIME_BITS, CKA_VALUE_BITS, CKA_VALUE_LEN, CKA_EXTRACTABLE,
    CKA_LOCAL, CKA_NEVER_EXTRACTABLE, CKA_ALWAYS_SENSITIVE,
    CKA_KEY_GEN_MECHANISM, CKA_MODIFIABLE, CKA_EC_PARAMS,
    CKA_EC_POINT, CKA_SECONDARY_AUTH, CKA_AUTH_PIN_FLAGS,
    CKA_ALWAYS_AUTHENTICATE, CKA_WRAP_WITH_TRUSTED, CKA_WRAP_TEMPLATE,
    CKA_UNWRAP_TEMPLATE, CKA_HW_FEATURE_TYPE, CKA_RESET_ON_INIT,
    CKA_HAS_RESET, CKA_PIXEL_X, CKA_PIXEL_Y, CKA_RESOLUTION, CKA_CHAR_ROWS,
    CKA_CHAR_COLUMNS, CKA_COLOR, CKA_BITS_PER_PIXEL, CKA_CHAR_SETS,
    CKA_ENCODING_METHODS, CKA_MIME_TYPES, CKA_MECHANISM_TYPE,
    CKA_REQUIRED_CMS_ATTRIBUTES, CKA_DEFAULT_CMS_ATTRIBUTES,
    CKA_SUPPORTED_CMS_ATTRIBUTES, CKA_NETSCAPE_URL, CKA_NETSCAPE_EMAIL,
    CKA_NETSCAPE_SMIME_INFO, CKA_NETSCAPE_SMIME_TIMESTAMP,
    CKA_NETSCAPE_PKCS8_SALT, CKA_NETSCAPE_PASSWORD_CHECK, CKA_NETSCAPE_EXPIRES,
    CKA_NETSCAPE_KRL, CKA_NETSCAPE_PQG_COUNTER, CKA_NETSCAPE_PQG_SEED,
    CKA_NETSCAPE_PQG_H, CKA_NETSCAPE_PQG_SEED_BITS, CKA_NETSCAPE_MODULE_SPEC,
    CKA_TRUST_DIGITAL_SIGNATURE, CKA_TRUST_NON_REPUDIATION,
    CKA_TRUST_KEY_ENCIPHERMENT, CKA_TRUST_DATA_ENCIPHERMENT,
    CKA_TRUST_KEY_AGREEMENT, CKA_TRUST_KEY_CERT_SIGN, CKA_TRUST_CRL_SIGN,
    CKA_TRUST_SERVER_AUTH, CKA_TRUST_CLIENT_AUTH, CKA_TRUST_CODE_SIGNING,
    CKA_TRUST_EMAIL_PROTECTION, CKA_TRUST_IPSEC_END_SYSTEM,
    CKA_TRUST_IPSEC_TUNNEL, CKA_TRUST_IPSEC_USER, CKA_TRUST_TIME_STAMPING,
    CKA_TRUST_STEP_UP_APPROVED, CKA_CERT_SHA1_HASH, CKA_CERT_MD5_HASH,
    CKA_NETSCAPE_DB, CKA_NETSCAPE_TRUST, CKA_NSS_OVERRIDE_EXTENSIONS
};

static int known_attributes_size= sizeof(known_attributes)/
			   sizeof(known_attributes[0]);

/* Magic for an explicit NULL. NOTE: ideally this should be
 * out of band data. Since it's not completely out of band, pick
 * a value that has no meaning to any existing PKCS #11 attributes.
 * This value is 1) not a valid string (imbedded '\0'). 2) not a U_LONG
 * or a normal key (too short). 3) not a bool (too long). 4) not an RSA
 * public exponent (too many bits).
 */
const unsigned char SQLITE_EXPLICIT_NULL[] = { 0xa5, 0x0, 0x5a };
#define SQLITE_EXPLICIT_NULL_LEN 3

/*
 * determine when we've completed our tasks
 */
#define MAX_RETRIES 10
static int 
sdb_done(int err, int *count)
{
    /* allow as many rows as the database wants to give */
    if (err == SQLITE_ROW) {
	*count = 0;
	return 0;
    }
    if (err != SQLITE_BUSY) {
	return 1;
    }
    /* err == SQLITE_BUSY, Dont' retry forever in this case */
    if (++(*count) >= MAX_RETRIES) {
	return 1;
    }
    return 0;
}

/*
 * Map SQL_LITE errors to PKCS #11 errors as best we can.
 */
static int 
sdb_mapSQLError(sdbDataType type, int sqlerr)
{
    switch (sqlerr) {
    /* good matches */
    case SQLITE_OK:
    case SQLITE_DONE:
	return CKR_OK;
    case SQLITE_NOMEM:
	return CKR_HOST_MEMORY;
    case SQLITE_READONLY:
	return CKR_TOKEN_WRITE_PROTECTED;
    /* close matches */
    case SQLITE_AUTH:
    case SQLITE_PERM:
	/*return CKR_USER_NOT_LOGGED_IN; */
    case SQLITE_CANTOPEN:
    case SQLITE_NOTFOUND:
	/* NSS distiguishes between failure to open the cert and the key db */
	return type == SDB_CERT ? 
		CKR_NETSCAPE_CERTDB_FAILED : CKR_NETSCAPE_KEYDB_FAILED;
    case SQLITE_IOERR:
	return CKR_DEVICE_ERROR;
    default:
	break;
    }
    return CKR_GENERAL_ERROR;
}

/*
 *  sqlite3 cannot share handles across threads, in general. 
 *  PKCS #11 modules can be called thread, so we need to constantly open and 
 *  close the sqlite database.
 * 
 *  The one exception is transactions. When we are in a transaction, we must
 *  use the same database pointer for that entire transation. In this case
 *  we save the transaction database and use it for all accesses on the
 *  transaction thread. Other threads still get their own database.
 *
 *  There can only be once active transaction on the database at a time.
 */
static CK_RV 
sdb_openDBLocal(SDBPrivate *sdb_p, sqlite3 **sqlDB)
{
#ifdef SQLITE_THREAD_SHARE_DB
    *sqlDB = sdb_p->sqlXactDB;
    return CKR_OK;
#else
    
    int sqlerr = SQLITE_OK;
    CK_RV error = CKR_OK;

    char *dbname = sdb_p->sqlDBName;
    sdbDataType type = sdb_p->type;

    *sqlDB = NULL;

    PR_Lock(sdb_p->lock);

    /* We're in a transaction, use the transaction DB */
    if ((sdb_p->sqlXactDB) && (sdb_p->sqlXactThread == PR_GetCurrentThread())) {
	*sqlDB =sdb_p->sqlXactDB;
	/* only one thread can get here, safe to unlock */
        PR_Unlock(sdb_p->lock);
	return CKR_OK;
    }

    /* we're and independent operation, get our own db handle */
    PR_Unlock(sdb_p->lock);

    sqlerr = sqlite3_open(dbname, sqlDB);
    if (sqlerr != SQLITE_OK) {
	error = sdb_mapSQLError(type, sqlerr);
	goto loser;
    }

    sqlerr = sqlite3_busy_timeout(*sqlDB, 1000);
    if (sqlerr != CKR_OK) {
	error = sdb_mapSQLError(type, sqlerr); 
	goto loser;
    }
    return error;

loser:
    if (*sqlDB) {
	sqlite3_close(*sqlDB);
	*sqlDB = NULL;
    }
    return error;
#endif
}

/* down with the local database, free it if we allocated it, otherwise
 * free unlock our use the the transaction database */
static CK_RV 
sdb_closeDBLocal(SDBPrivate *sdb_p, sqlite3 *sqlDB) 
{
#ifndef SQLITE_THREAD_SHARE_DB
   if (sdb_p->sqlXactDB != sqlDB) {
	sqlite3_close(sqlDB);
   }
#endif
   return CKR_OK;
}

struct SDBFindStr {
    sqlite3 *sqlDB;
    sqlite3_stmt *findstmt;
};


static const char FIND_OBJECTS_CMD[] =  "SELECT ALL * FROM %s WHERE %s;";
static const char FIND_OBJECTS_ALL_CMD[] = "SELECT ALL * FROM %s;";
CK_RV
sdb_FindObjectsInit(SDB *sdb, const CK_ATTRIBUTE *template, CK_ULONG count, 
				SDBFind **find)
{
    SDBPrivate *sdb_p = sdb->private;
    sqlite3  *sqlDB = NULL;
    char *newStr, *findStr = NULL;
    sqlite3_stmt *findstmt = NULL;
    char *join="";
    int sqlerr = SQLITE_OK;
    CK_RV error = CKR_OK;
    int i;

    LOCK_SQLITE()
    *find = NULL;
    error = sdb_openDBLocal(sdb_p, &sqlDB);
    if (error != CKR_OK) {
	goto loser;
    }

    findStr = sqlite3_mprintf("");
    for (i=0; findStr && i < count; i++) {
	newStr = sqlite3_mprintf("%s%sa%x=$DATA%d", findStr, join,
				template[i].type, i);
        join=" AND ";
	sqlite3_free(findStr);
	findStr = newStr;
    }

    if (findStr == NULL) {
	error = CKR_HOST_MEMORY;
	goto loser;
    }

    if (count == 0) {
	newStr = sqlite3_mprintf(FIND_OBJECTS_ALL_CMD, sdb_p->table);
    } else {
	newStr = sqlite3_mprintf(FIND_OBJECTS_CMD, sdb_p->table, findStr);
    }
    sqlite3_free(findStr);
    if (newStr == NULL) {
	error = CKR_HOST_MEMORY;
	goto loser;
    }
    sqlerr = sqlite3_prepare(sqlDB, newStr, -1, &findstmt, NULL);
    sqlite3_free(newStr);
    for (i=0; sqlerr == SQLITE_OK && i < count; i++) {
	sqlerr = sqlite3_bind_blob(findstmt, i+1, template[i].pValue, 
				template[i].ulValueLen, SQLITE_TRANSIENT);
    }
    if (sqlerr == SQLITE_OK) {
	*find = PORT_New(SDBFind);
	if (*find == NULL) {
	    error = CKR_HOST_MEMORY;
	    goto loser;
	}
	(*find)->findstmt = findstmt;
	(*find)->sqlDB = sqlDB;
	UNLOCK_SQLITE()  
	return CKR_OK;
    } 
    error = sdb_mapSQLError(sdb_p->type, sqlerr);

loser: 
    if (findstmt) {
	sqlite3_finalize(findstmt);
    }
    if (sqlDB) {
	sdb_closeDBLocal(sdb_p, sqlDB) ;
    }
    UNLOCK_SQLITE()  
    return error;
}


CK_RV
sdb_FindObjects(SDB *sdb, SDBFind *sdbFind, CK_OBJECT_HANDLE *object, 
		CK_ULONG arraySize, CK_ULONG *count)
{
    SDBPrivate *sdb_p = sdb->private;
    sqlite3_stmt *stmt = sdbFind->findstmt;
    int sqlerr = SQLITE_OK;
    int retry = 0;

    *count = 0;

    if (arraySize == 0) {
	return CKR_OK;
    }
    LOCK_SQLITE()  

    do {
	sqlerr = sqlite3_step(stmt);
	if (sqlerr == SQLITE_BUSY) {
	    PR_Sleep(5);
	}
	if (sqlerr == SQLITE_ROW) {
	    /* only care about the id */
	    *object++= sqlite3_column_int(stmt, 0);
	    arraySize--;
	    (*count)++;
	}
    } while (!sdb_done(sqlerr,&retry) && (arraySize > 0));

    /* we only have some of the objects, there is probably more,
     * set the sqlerr to an OK value so we return CKR_OK */
    if (sqlerr == SQLITE_ROW && arraySize == 0) {
	sqlerr = SQLITE_DONE;
    }
    UNLOCK_SQLITE()  

    return sdb_mapSQLError(sdb_p->type, sqlerr);
}

CK_RV
sdb_FindObjectsFinal(SDB *sdb, SDBFind *sdbFind)
{
    SDBPrivate *sdb_p = sdb->private;
    sqlite3_stmt *stmt = sdbFind->findstmt;
    sqlite3 *sqlDB = sdbFind->sqlDB;
    int sqlerr = SQLITE_OK;

    LOCK_SQLITE()  
    if (stmt) {
	sqlite3_reset(stmt);
	sqlerr = sqlite3_finalize(stmt);
    }
    if (sqlDB) {
	sdb_closeDBLocal(sdb_p, sqlDB) ;
    }
    PORT_Free(sdbFind);

    UNLOCK_SQLITE()  
    return sdb_mapSQLError(sdb_p->type, sqlerr);
}

static const char GET_ATTRIBUTE_CMD[] = "SELECT ALL %s FROM %s WHERE id=$ID;";
CK_RV
sdb_GetAttributeValueNoLock(SDB *sdb, CK_OBJECT_HANDLE object_id, 
				CK_ATTRIBUTE *template, CK_ULONG count)
{
    SDBPrivate *sdb_p = sdb->private;
    sqlite3  *sqlDB = NULL;
    sqlite3_stmt *stmt = NULL;
    char *getStr = NULL;
    char *newStr = NULL;
    int sqlerr = SQLITE_OK;
    CK_RV error = CKR_OK;
    int found = 0;
    int retry = 0;
    int i;

    getStr = sqlite3_mprintf("");
    for (i=0; getStr && i < count; i++) {
	if (i==0) {
	    newStr = sqlite3_mprintf("a%x", template[i].type);
	} else {
	    newStr = sqlite3_mprintf("%s, a%x", getStr, template[i].type);
	}
	sqlite3_free(getStr);
	getStr = newStr;
    }

    if (getStr == NULL) {
	error = CKR_HOST_MEMORY;
	goto loser;
    }

    newStr = sqlite3_mprintf(GET_ATTRIBUTE_CMD, getStr, sdb_p->table);
    sqlite3_free(getStr);
    getStr = NULL;
    if (newStr == NULL) {
	error = CKR_HOST_MEMORY;
	goto loser;
    }
    /* open a new db if necessary */
    error = sdb_openDBLocal(sdb_p,&sqlDB);
    if (error != CKR_OK) {
	goto loser;
    }
    sqlerr = sqlite3_prepare(sqlDB, newStr, -1, &stmt, NULL);
    if (sqlerr != SQLITE_OK) { goto loser; }
    sqlerr = sqlite3_bind_int(stmt, 1, object_id);
    if (sqlerr != SQLITE_OK) { goto loser; }
    do {
	sqlerr = sqlite3_step(stmt);
	if (sqlerr == SQLITE_BUSY) {
	    PR_Sleep(5);
	}
	if (sqlerr == SQLITE_ROW) {
	    for (i=0; i < count; i++) {
		int column = i;
	    	int blobSize;
	    	const char *blobData;

	    	blobSize = sqlite3_column_bytes(stmt, column);
		blobData = sqlite3_column_blob(stmt, column);
		if (blobData == NULL) {
		    template[i].ulValueLen = -1;
		    error = CKR_ATTRIBUTE_TYPE_INVALID; 
		    continue;
		}
		/* If the blob equals our explicit NULL value, then the 
		 * attribute is a NULL. */
		if ((blobSize == SQLITE_EXPLICIT_NULL_LEN) &&
		   	(PORT_Memcmp(blobData, SQLITE_EXPLICIT_NULL, 
			      SQLITE_EXPLICIT_NULL_LEN) == 0)) {
		    blobSize = 0;
		}
		if (template[i].pValue) {
		    if (template[i].ulValueLen < blobSize) {
			template[i].ulValueLen = -1;
		    	error = CKR_BUFFER_TOO_SMALL;
			continue;
		    }
	    	    PORT_Memcpy(template[i].pValue, blobData, blobSize);
		}
		template[i].ulValueLen = blobSize;
	    }
	    found = 1;
	}
    } while (!sdb_done(sqlerr,&retry));

loser:
    /* fix up the error if necessary */
    if (error == CKR_OK) {
	error = sdb_mapSQLError(sdb_p->type, sqlerr);
	if (!found && error == CKR_OK) {
	    error = CKR_OBJECT_HANDLE_INVALID;
	}
    }
    if (newStr) {
	sqlite3_free(newStr);
    }

    if (stmt) {
	sqlite3_reset(stmt);
	sqlite3_finalize(stmt);
    }

    /* if we had to open a new database, free it now */
    if (sqlDB) {
	sdb_closeDBLocal(sdb_p, sqlDB) ;
    }
    return error;
}

CK_RV
sdb_GetAttributeValue(SDB *sdb, CK_OBJECT_HANDLE object_id, 
				CK_ATTRIBUTE *template, CK_ULONG count)
{
    CK_RV crv;

    if (count == 0) {
	return CKR_OK;
    }

    LOCK_SQLITE()  
    crv = sdb_GetAttributeValueNoLock(sdb, object_id, template, count);
    UNLOCK_SQLITE()  
    return crv;
}
   
static const char SET_ATTRIBUTE_CMD[] = "UPDATE %s SET %s WHERE id=$ID;";
CK_RV
sdb_SetAttributeValue(SDB *sdb, CK_OBJECT_HANDLE object_id, 
			const CK_ATTRIBUTE *template, CK_ULONG count)
{
    SDBPrivate *sdb_p = sdb->private;
    sqlite3  *sqlDB = NULL;
    sqlite3_stmt *stmt = NULL;
    char *setStr = NULL;
    char *newStr = NULL;
    int sqlerr = SQLITE_OK;
    int retry = 0;
    CK_RV error = CKR_OK;
    int i;

    if ((sdb->sdb_flags & SDB_RDONLY) != 0) {
	return CKR_TOKEN_WRITE_PROTECTED;
    }

    if (count == 0) {
	return CKR_OK;
    }

    LOCK_SQLITE()  
    setStr = sqlite3_mprintf("");
    for (i=0; setStr && i < count; i++) {
	if (i==0) {
	    sqlite3_free(setStr);
   	    setStr = sqlite3_mprintf("a%x=$VALUE%d", 
				template[i].type, i);
	    continue;
	}
	newStr = sqlite3_mprintf("%s,a%x=$VALUE%d", setStr, 
				template[i].type, i);
	sqlite3_free(setStr);
	setStr = newStr;
    }
    newStr = NULL;

    if (setStr == NULL) {
	return CKR_HOST_MEMORY;
    }
    newStr =  sqlite3_mprintf(SET_ATTRIBUTE_CMD, sdb_p->table, setStr);
    sqlite3_free(setStr);
    if (newStr == NULL) {
	UNLOCK_SQLITE()  
	return CKR_HOST_MEMORY;
    }
    error = sdb_openDBLocal(sdb_p, &sqlDB);
    if (error != CKR_OK) {
	goto loser;
    }
    sqlerr = sqlite3_prepare(sqlDB, newStr, -1, &stmt, NULL);
    if (sqlerr != SQLITE_OK) goto loser;
    for (i=0; i < count; i++) {
	if (template[i].ulValueLen != 0) {
	    sqlerr = sqlite3_bind_blob(stmt, i+1, template[i].pValue, 
				template[i].ulValueLen, SQLITE_STATIC);
	} else {
	    sqlerr = sqlite3_bind_blob(stmt, i+2, SQLITE_EXPLICIT_NULL, 
			SQLITE_EXPLICIT_NULL_LEN, SQLITE_STATIC);
	}
        if (sqlerr != SQLITE_OK) goto loser;
    }
    sqlerr = sqlite3_bind_int(stmt, i+1, object_id);
    if (sqlerr != SQLITE_OK) goto loser;

    do {
	sqlerr = sqlite3_step(stmt);
	if (sqlerr == SQLITE_BUSY) {
	    PR_Sleep(5);
	}
    } while (!sdb_done(sqlerr,&retry));

loser:
    if (newStr) {
	sqlite3_free(newStr);
    }
    if (error == CKR_OK) {
	error = sdb_mapSQLError(sdb_p->type, sqlerr);
    }

    if (stmt) {
	sqlite3_reset(stmt);
	sqlite3_finalize(stmt);
    }

    if (sqlDB) {
	sdb_closeDBLocal(sdb_p, sqlDB) ;
    }

    UNLOCK_SQLITE()  
    return error;
}

/*
 * check to see if a candidate object handle already exists.
 */
static PRBool
sdb_objectExists(SDB *sdb, CK_OBJECT_HANDLE candidate)
{
    CK_RV crv;
    CK_ATTRIBUTE template = { CKA_LABEL, NULL, 0 };

    crv = sdb_GetAttributeValueNoLock(sdb,candidate,&template, 1);
    if (crv == CKR_OBJECT_HANDLE_INVALID) {
	return PR_FALSE;
    }
    return PR_TRUE;
}

/*
 * if we're here, we are in a transaction, so it's safe
 * to examine the current state of the database
 */
static CK_OBJECT_HANDLE
sdb_getObjectId(SDB *sdb)
{
    CK_OBJECT_HANDLE candidate;
    static CK_OBJECT_HANDLE next_obj = CK_INVALID_HANDLE;
    int count;
    /*
     * get an initial object handle to use
     */
    if (next_obj == CK_INVALID_HANDLE) {
        PRTime time;
	time = PR_Now();

	next_obj = (CK_OBJECT_HANDLE)(time & 0x3fffffffL);
    }
    candidate = next_obj++;
    /* detect that we've looped through all the handles... */
    for (count = 0; count < 0x40000000; count++, candidate = next_obj++) {
	/* mask off excess bits */
	candidate &= 0x3fffffff;
	/* if we hit zero, go to the next entry */
	if (candidate == CK_INVALID_HANDLE) {
	    continue;
	}
	/* make sure we aren't already using */
	if (!sdb_objectExists(sdb, candidate)) {
	    /* this one is free */
	    return candidate;
	}
    }

    /* no handle is free, fail */
    return CK_INVALID_HANDLE;
}

static const char CREATE_CMD[] = "INSERT INTO %s (id%s) VALUES($ID%s);";
CK_RV
sdb_CreateObject(SDB *sdb, CK_OBJECT_HANDLE *object_id, 
		 const CK_ATTRIBUTE *template, CK_ULONG count)
{
    SDBPrivate *sdb_p = sdb->private;
    sqlite3  *sqlDB = NULL;
    sqlite3_stmt *stmt = NULL;
    char *columnStr = NULL;
    char *valueStr = NULL;
    char *newStr = NULL;
    int sqlerr = SQLITE_OK;
    CK_RV error = CKR_OK;
    CK_OBJECT_HANDLE this_object;
    int retry = 0;
    int i;

    if ((sdb->sdb_flags & SDB_RDONLY) != 0) {
	return CKR_TOKEN_WRITE_PROTECTED;
    }

    LOCK_SQLITE()  
    if ((*object_id != CK_INVALID_HANDLE) && 
		!sdb_objectExists(sdb, *object_id)) {
	this_object = *object_id;
    } else {
	this_object = sdb_getObjectId(sdb);
    }
    if (this_object == CK_INVALID_HANDLE) {
	UNLOCK_SQLITE();
	return CKR_HOST_MEMORY;
    }
    columnStr = sqlite3_mprintf("");
    valueStr = sqlite3_mprintf("");
    *object_id = this_object;
    for (i=0; columnStr && valueStr && i < count; i++) {
   	newStr = sqlite3_mprintf("%s,a%x", columnStr, template[i].type);
	sqlite3_free(columnStr);
	columnStr = newStr;
   	newStr = sqlite3_mprintf("%s,$VALUE%d", valueStr, i);
	sqlite3_free(valueStr);
	valueStr = newStr;
    }
    newStr = NULL;
    if ((columnStr == NULL) || (valueStr == NULL)) {
	if (columnStr) {
	    sqlite3_free(columnStr);
	}
	if (valueStr) {
	    sqlite3_free(valueStr);
	}
	UNLOCK_SQLITE()  
	return CKR_HOST_MEMORY;
    }
    newStr =  sqlite3_mprintf(CREATE_CMD, sdb_p->table, columnStr, valueStr);
    sqlite3_free(columnStr);
    sqlite3_free(valueStr);
    error = sdb_openDBLocal(sdb_p, &sqlDB);
    if (error != CKR_OK) {
	goto loser;
    }
    sqlerr = sqlite3_prepare(sqlDB, newStr, -1, &stmt, NULL);
    if (sqlerr != SQLITE_OK) goto loser;
    sqlerr = sqlite3_bind_int(stmt, 1, *object_id);
    if (sqlerr != SQLITE_OK) goto loser;
    for (i=0; i < count; i++) {
	if (template[i].ulValueLen) {
	    sqlerr = sqlite3_bind_blob(stmt, i+2, template[i].pValue, 
			template[i].ulValueLen, SQLITE_STATIC);
	} else {
	    sqlerr = sqlite3_bind_blob(stmt, i+2, SQLITE_EXPLICIT_NULL, 
			SQLITE_EXPLICIT_NULL_LEN, SQLITE_STATIC);
	}
        if (sqlerr != SQLITE_OK) goto loser;
    }

    do {
	sqlerr = sqlite3_step(stmt);
	if (sqlerr == SQLITE_BUSY) {
	    PR_Sleep(5);
	}
    } while (!sdb_done(sqlerr,&retry));

loser:
    if (newStr) {
	sqlite3_free(newStr);
    }
    if (error == CKR_OK) {
	error = sdb_mapSQLError(sdb_p->type, sqlerr);
    }

    if (stmt) {
	sqlite3_reset(stmt);
	sqlite3_finalize(stmt);
    }

    if (sqlDB) {
	sdb_closeDBLocal(sdb_p, sqlDB) ;
    }
    UNLOCK_SQLITE()  

    return error;
}

static const char DESTROY_CMD[] = "DELETE FROM %s WHERE (id=$ID);";
CK_RV
sdb_DestroyObject(SDB *sdb, CK_OBJECT_HANDLE object_id)
{
    SDBPrivate *sdb_p = sdb->private;
    sqlite3  *sqlDB = NULL;
    sqlite3_stmt *stmt = NULL;
    char *newStr = NULL;
    int sqlerr = SQLITE_OK;
    CK_RV error = CKR_OK;
    int retry = 0;

    if ((sdb->sdb_flags & SDB_RDONLY) != 0) {
	return CKR_TOKEN_WRITE_PROTECTED;
    }

    LOCK_SQLITE()  
    error = sdb_openDBLocal(sdb_p, &sqlDB);
    if (error != CKR_OK) {
	goto loser;
    }
    newStr =  sqlite3_mprintf(DESTROY_CMD, sdb_p->table);
    if (newStr == NULL) {
	error = CKR_HOST_MEMORY;
	goto loser;
    }
    sqlerr =sqlite3_prepare(sqlDB, newStr, -1, &stmt, NULL);
    sqlite3_free(newStr);
    if (sqlerr != SQLITE_OK) goto loser;
    sqlerr =sqlite3_bind_int(stmt, 1, object_id);
    if (sqlerr != SQLITE_OK) goto loser;

    do {
	sqlerr = sqlite3_step(stmt);
	if (sqlerr == SQLITE_BUSY) {
	    PR_Sleep(5);
	}
    } while (!sdb_done(sqlerr,&retry));

loser:
    if (error == CKR_OK) {
	error = sdb_mapSQLError(sdb_p->type, sqlerr);
    }

    if (stmt) {
	sqlite3_reset(stmt);
	sqlite3_finalize(stmt);
    }

    if (sqlDB) {
	sdb_closeDBLocal(sdb_p, sqlDB) ;
    }

    UNLOCK_SQLITE()  
    return error;
}
   
static const char BEGIN_CMD[] = "BEGIN IMMEDIATE TRANSACTION;";
/*
 * start a transaction.
 *
 * We need to open a new database, then store that new database into
 * the private data structure. We open the database first, then use locks
 * to protect storing the data to prevent deadlocks.
 */
CK_RV
sdb_Begin(SDB *sdb)
{
    SDBPrivate *sdb_p = sdb->private;
    sqlite3  *sqlDB = NULL;
    sqlite3_stmt *stmt = NULL;
    int sqlerr = SQLITE_OK;
    CK_RV error = CKR_OK;
    int retry = 0;


    if ((sdb->sdb_flags & SDB_RDONLY) != 0) {
	return CKR_TOKEN_WRITE_PROTECTED;
    }


    LOCK_SQLITE()  
#ifdef SQLITE_THREAD_SHARE_DB
    sqlDB = sdb_p->sqlXactDB;
#else
    /* get a new version that we will use for the entire transaction */
    sqlerr = sqlite3_open(sdb_p->sqlDBName, &sqlDB);
    if (sqlerr != SQLITE_OK) {
	goto loser;
    }
#endif

    sqlerr = sqlite3_busy_timeout(sqlDB, 1000);
    if (sqlerr != CKR_OK) {
	goto loser;
    }

    sqlerr =sqlite3_prepare(sqlDB, BEGIN_CMD, -1, &stmt, NULL);

    do {
	sqlerr = sqlite3_step(stmt);
	if (sqlerr == SQLITE_BUSY) {
	    PR_Sleep(5);
	}
    } while (!sdb_done(sqlerr,&retry));

    if (stmt) {
	sqlite3_reset(stmt);
	sqlite3_finalize(stmt);
    }

loser:
    error = sdb_mapSQLError(sdb_p->type, sqlerr);

#ifndef SQLITE_THREAD_SHARE_DB
    /* we are starting a new transaction, 
     * and if we succeeded, then save this database for the rest of
     * our transaction */
    if (error == CKR_OK) {
	/* we hold a 'BEGIN TRANSACTION' and a sdb_p->lock. At this point
	 * sdb_p->sqlXactDB MUST be null */
	PR_Lock(sdb_p->lock);
	PORT_Assert(sdb_p->sqlXactDB == NULL);
	sdb_p->sqlXactDB = sqlDB;
	sdb_p->sqlXactThread = PR_GetCurrentThread();
	PR_Unlock(sdb_p->lock);
    } else {
	/* we failed to start our transaction,
	 * free any databases we openned. */
	if (sqlDB) {
	    sqlite3_close(sqlDB);
	}
    }
#endif

    UNLOCK_SQLITE()  
    return error;
}

/*
 * Complete a transaction. Basically undo everything we did in begin.
 * There are 2 flavors Abort and Commit. Basically the only differerence between
 * these 2 are what the database will show. (no change in to former, change in
 * the latter).
 */
static CK_RV 
sdb_complete(SDB *sdb, const char *cmd)
{
    SDBPrivate *sdb_p = sdb->private;
    sqlite3  *sqlDB = NULL;
    sqlite3_stmt *stmt = NULL;
    int sqlerr = SQLITE_OK;
    CK_RV error = CKR_OK;
    int retry = 0;


    if ((sdb->sdb_flags & SDB_RDONLY) != 0) {
	return CKR_TOKEN_WRITE_PROTECTED;
    }


#ifndef SQLITE_THREAD_SHARE_DB
    /* We must have a transation database, or we shouldn't have arrived here */
    PR_Lock(sdb_p->lock);
    PORT_Assert(sdb_p->sqlXactDB);
    if (sdb_p->sqlXactDB == NULL) {
	PR_Unlock(sdb_p->lock);
	return CKR_GENERAL_ERROR; /* shouldn't happen */
    }
    PORT_Assert( sdb_p->sqlXactThread == PR_GetCurrentThread());
    if ( sdb_p->sqlXactThread != PR_GetCurrentThread()) {
	PR_Unlock(sdb_p->lock);
	return CKR_GENERAL_ERROR; /* shouldn't happen */
    }
    sqlDB = sdb_p->sqlXactDB;
    sdb_p->sqlXactDB = NULL; /* no one else can get to this DB, 
			      * safe to unlock */
    sdb_p->sqlXactThread = NULL; 
    PR_Unlock(sdb_p->lock);  
#else
    sqlDB = sdb_p->sqlXactDB;
#endif

    sqlerr =sqlite3_prepare(sqlDB, cmd, -1, &stmt, NULL);

    do {
	sqlerr = sqlite3_step(stmt);
	if (sqlerr == SQLITE_BUSY) {
	    PR_Sleep(5);
	}
    } while (!sdb_done(sqlerr,&retry));

    /* Pending BEGIN TRANSACTIONS Can move forward at this point. */

    if (stmt) {
	sqlite3_reset(stmt);
	sqlite3_finalize(stmt);
    }

    error = sdb_mapSQLError(sdb_p->type, sqlerr);

#ifndef SQLITE_THREAD_SHARE_DB
    /* We just finished a transaction.
     * Free the database, and remove it from the list */
    sqlite3_close(sqlDB);
#endif

    return error;
}

static const char COMMIT_CMD[] = "COMMIT TRANSACTION;";
CK_RV
sdb_Commit(SDB *sdb)
{
    CK_RV crv;
    LOCK_SQLITE()  
    crv = sdb_complete(sdb,COMMIT_CMD);
    UNLOCK_SQLITE()  
    return crv;
}

static const char ROLLBACK_CMD[] = "ROLLBACK TRANSACTION;";
CK_RV
sdb_Abort(SDB *sdb)
{
    CK_RV crv;
    LOCK_SQLITE()  
    crv = sdb_complete(sdb,ROLLBACK_CMD);
    UNLOCK_SQLITE()  
    return crv;
}

static int tableExists(sqlite3 *sqlDB, const char *tableName);

static const char GET_PW_CMD[] = "SELECT ALL * FROM metaData WHERE id=$ID;";
CK_RV
sdb_GetMetaData(SDB *sdb, const char *id, SECItem *item1, SECItem *item2)
{
    SDBPrivate *sdb_p = sdb->private;
    sqlite3  *sqlDB = sdb_p->sqlXactDB;
    sqlite3_stmt *stmt = NULL;
    int sqlerr = SQLITE_OK;
    CK_RV error = CKR_OK;
    int found = 0;
    int retry = 0;

    /* currently only Key databases have meta data entries */
    if (sdb_p->type != SDB_KEY) {
	return CKR_OBJECT_HANDLE_INVALID;
    }

    LOCK_SQLITE()  
    error = sdb_openDBLocal(sdb_p, &sqlDB);
    if (error != CKR_OK) {
	goto loser;
    }

    /* handle 'test' versions of the sqlite db */
    sqlerr = sqlite3_prepare(sqlDB, GET_PW_CMD, -1, &stmt, NULL);
    if (sqlerr != SQLITE_OK) goto loser;
    sqlerr = sqlite3_bind_text(stmt, 1, id, PORT_Strlen(id), SQLITE_STATIC);
    do {
	sqlerr = sqlite3_step(stmt);
	if (sqlerr == SQLITE_BUSY) {
	    PR_Sleep(5);
	}
	if (sqlerr == SQLITE_ROW) {
	    const char *blobData;
	    item1->len = sqlite3_column_bytes(stmt, 1);
	    if (item1->len > SDB_MAX_META_DATA_LEN) {
		error = CKR_BUFFER_TOO_SMALL;
		continue;
	    }
	    blobData = sqlite3_column_blob(stmt, 1);
	    PORT_Memcpy(item1->data,blobData, item1->len);
	    if (item2) {
		item2->len = sqlite3_column_bytes(stmt, 2);
		if (item2->len > SDB_MAX_META_DATA_LEN) {
		    error = CKR_BUFFER_TOO_SMALL;
		    continue;
		}
		blobData = sqlite3_column_blob(stmt, 2);
		PORT_Memcpy(item2->data,blobData, item2->len);
	    }
	    found = 1;
	}
    } while (!sdb_done(sqlerr,&retry));

loser:
    /* fix up the error if necessary */
    if (error == CKR_OK) {
	error = sdb_mapSQLError(sdb_p->type, sqlerr);
	if (!found && error == CKR_OK) {
	    error = CKR_OBJECT_HANDLE_INVALID;
	}
    }

    if (stmt) {
	sqlite3_reset(stmt);
	sqlite3_finalize(stmt);
    }

    if (sqlDB) {
	sdb_closeDBLocal(sdb_p, sqlDB) ;
    }
    UNLOCK_SQLITE()  

    return error;
}

static const char PW_CREATE_TABLE_CMD[] =
 "CREATE TABLE metaData (id PRIMARY KEY UNIQUE ON CONFLICT REPLACE, item1, item2);";
static const char PW_CREATE_CMD[] =
 "INSERT INTO metaData (id,item1,item2) VALUES($ID,$ITEM1,$ITEM2);";
static const char MD_CREATE_CMD[]  =
 "INSERT INTO metaData (id,item1) VALUES($ID,$ITEM1);";
CK_RV
sdb_PutMetaData(SDB *sdb, const char *id, const SECItem *item1, 
					   const SECItem *item2)
{
    SDBPrivate *sdb_p = sdb->private;
    sqlite3  *sqlDB = sdb_p->sqlXactDB;
    sqlite3_stmt *stmt = NULL;
    int sqlerr = SQLITE_OK;
    CK_RV error = CKR_OK;
    int retry = 0;
    const char *cmd = PW_CREATE_CMD;

    /* only Key databases have password entries */
    if (sdb_p->type != SDB_KEY) {
	return CKR_OBJECT_HANDLE_INVALID;
    }

    LOCK_SQLITE()  
    error = sdb_openDBLocal(sdb_p, &sqlDB);
    if (error != CKR_OK) {
	goto loser;
    }

    if (!tableExists(sqlDB, "metaData")) {
    	sqlerr = sqlite3_exec(sqlDB, PW_CREATE_TABLE_CMD, NULL, 0, NULL);
        if (sqlerr != SQLITE_OK) goto loser;
    }
    if (item2 == NULL) {
	cmd = MD_CREATE_CMD;
    }
    sqlerr = sqlite3_prepare(sqlDB, cmd, -1, &stmt, NULL);
    if (sqlerr != SQLITE_OK) goto loser;
    sqlerr = sqlite3_bind_text(stmt, 1, id, PORT_Strlen(id), SQLITE_STATIC);
    if (sqlerr != SQLITE_OK) goto loser;
    sqlerr = sqlite3_bind_blob(stmt, 2, item1->data, item1->len, SQLITE_STATIC);
    if (sqlerr != SQLITE_OK) goto loser;
    if (item2) {
    	sqlerr = sqlite3_bind_blob(stmt, 3, item2->data, 
				   item2->len, SQLITE_STATIC);
        if (sqlerr != SQLITE_OK) goto loser;
    }

    do {
	sqlerr = sqlite3_step(stmt);
	if (sqlerr == SQLITE_BUSY) {
	    PR_Sleep(5);
	}
    } while (!sdb_done(sqlerr,&retry));

loser:
    /* fix up the error if necessary */
    if (error == CKR_OK) {
	error = sdb_mapSQLError(sdb_p->type, sqlerr);
    }

    if (stmt) {
	sqlite3_reset(stmt);
	sqlite3_finalize(stmt);
    }

    if (sqlDB) {
	sdb_closeDBLocal(sdb_p, sqlDB) ;
    }
    UNLOCK_SQLITE()  

    return error;
}

static const char RESET_CMD[] = "DROP TABLE IF EXISTS %s;";
CK_RV
sdb_Reset(SDB *sdb)
{
    SDBPrivate *sdb_p = sdb->private;
    sqlite3  *sqlDB = NULL;
    char *newStr;
    int sqlerr = SQLITE_OK;
    CK_RV error = CKR_OK;

    /* only Key databases can be reset */
    if (sdb_p->type != SDB_KEY) {
	return CKR_OBJECT_HANDLE_INVALID;
    }

    LOCK_SQLITE()  
    error = sdb_openDBLocal(sdb_p, &sqlDB);
    if (error != CKR_OK) {
	goto loser;
    }

    /* delete the key table */
    newStr =  sqlite3_mprintf(RESET_CMD, sdb_p->table);
    if (newStr == NULL) {
	error = CKR_HOST_MEMORY;
	goto loser;
    }
    sqlerr = sqlite3_exec(sqlDB, newStr, NULL, 0, NULL);
    sqlite3_free(newStr);

    if (sqlerr != SQLITE_OK) goto loser;

    /* delete the password entry table */
    sqlerr = sqlite3_exec(sqlDB, "DROP TABLE IF EXISTS metaData;", 
                          NULL, 0, NULL);

loser:
    /* fix up the error if necessary */
    if (error == CKR_OK) {
	error = sdb_mapSQLError(sdb_p->type, sqlerr);
    }

    if (sqlDB) {
	sdb_closeDBLocal(sdb_p, sqlDB) ;
    }

    UNLOCK_SQLITE()  
    return error;
}


CK_RV 
sdb_Close(SDB *sdb) 
{
    SDBPrivate *sdb_p = sdb->private;
    int sqlerr = SQLITE_OK;
    sdbDataType type = sdb_p->type;

    /* sqlerr = sqlite3_close(sqlDB); */
    PORT_Free(sdb_p->sqlDBName);
    free(sdb_p);
    free(sdb);
    return sdb_mapSQLError(type, sqlerr);
}


/*
 * functions to support open
 */

static const char CHECK_TABLE_CMD[] = "SELECT ALL * FROM %s LIMIT 0;";
/* return 1 if sqlDB contains table 'tableName */
static int tableExists(sqlite3 *sqlDB, const char *tableName)
{
    char * cmd = sqlite3_mprintf(CHECK_TABLE_CMD, tableName);
    int sqlerr = SQLITE_OK;

    if (cmd == NULL) {
	return 0;
    }

    sqlerr = sqlite3_exec(sqlDB, cmd, NULL, 0, 0);
    sqlite3_free(cmd);

    return (sqlerr == SQLITE_OK) ? 1 : 0;
}

/*
 * initialize a single database
 */
static const char INIT_CMD[] =
 "CREATE TABLE %s (id PRIMARY KEY UNIQUE ON CONFLICT ABORT%s)";
static const char ALTER_CMD[] = 
 "ALTER TABLE %s ADD COLUMN a%x";

CK_RV 
sdb_init(char *dbname, char *table, sdbDataType type, int *inUpdate,
	 int *newInit, int flags, SDB **pSdb)
{
    int i;
    char *initStr = NULL;
    char *newStr;
    int inTransaction = 0;
    SDB *sdb = NULL;
    SDBPrivate *sdb_p = NULL;
    sqlite3 *sqlDB = NULL;
    int sqlerr = SQLITE_OK;
    CK_RV error = CKR_OK;

    *pSdb = NULL;
    *inUpdate = 0;

    /* sqlite3 doesn't have a flag to specify that we want to 
     * open the database read only. If the db doesn't exist,
     * sqlite3 will always create it.
     */
    LOCK_SQLITE();
    if ((flags == SDB_RDONLY) && PR_Access(dbname, PR_ACCESS_EXISTS)) {
	error = sdb_mapSQLError(type, SQLITE_CANTOPEN);
	goto loser;
    }
    sqlerr = sqlite3_open(dbname, &sqlDB);
    if (sqlerr != SQLITE_OK) {
	error = sdb_mapSQLError(type, sqlerr);
	goto loser;
    }

    sqlerr = sqlite3_busy_timeout(sqlDB, 1000);
    if (sqlerr != CKR_OK) {
	error = sdb_mapSQLError(type, sqlerr); 
	goto loser;
    }

    if (flags != SDB_RDONLY) {
	sqlerr = sqlite3_exec(sqlDB, BEGIN_CMD, NULL, 0, NULL);
	if (sqlerr != SQLITE_OK) {
	    error = sdb_mapSQLError(type, sqlerr);
	    goto loser;
	}
	inTransaction = 1;
    }
    if (!tableExists(sqlDB,table)) {
	*newInit = 1;
	if (flags != SDB_CREATE) {
	    error = sdb_mapSQLError(type, SQLITE_CANTOPEN);
	    goto loser;
	}
	initStr = sqlite3_mprintf("");
	for (i=0; initStr && i < known_attributes_size; i++) {
	    newStr = sqlite3_mprintf("%s, a%x",initStr, known_attributes[i]);
	    sqlite3_free(initStr);
	    initStr = newStr;
	}
	if (initStr == NULL) {
	    error = CKR_HOST_MEMORY;
	    goto loser;
	}
	newStr = sqlite3_mprintf(INIT_CMD, table, initStr);
	sqlite3_free(initStr);
	sqlerr = sqlite3_exec(sqlDB, newStr, NULL, 0, NULL);
	sqlite3_free(newStr);
	if (sqlerr != SQLITE_OK) {
            error = sdb_mapSQLError(type, sqlerr); 
	    goto loser;
	}
    }
    /*
     * detect the case where we have created the database, but have
     * not yet updated it.
     *
     * We only check the Key database because only the key database has
     * a metaData table. The metaData table is created when a password
     * is set, or in the case of update, when a password is supplied.
     * If no key database exists, then the update would have happened immediately
     * on noticing that the cert database didn't exist (see newInit set above).
     */
    if (type == SDB_KEY && !tableExists(sqlDB, "metaData")) {
	*newInit = 1;
    }
    sdb = (SDB *) malloc(sizeof(SDB));
    sdb_p = (SDBPrivate *) malloc(sizeof(SDBPrivate));
    /* invariant fields */
    sdb_p->sqlDBName = PORT_Strdup(dbname);
    sdb_p->type = type;
    sdb_p->table = table;
    sdb_p->lock = PR_NewLock();
    /* these fields are protected by the lock */
    sdb_p->sqlXactDB = NULL;
    sdb_p->sqlXactThread = NULL;
    sdb->private = sdb_p;
    sdb->sdb_type = SDB_SQL;
    sdb->sdb_flags = flags | SDB_HAS_META;
    sdb->sdb_FindObjectsInit = sdb_FindObjectsInit;
    sdb->sdb_FindObjects = sdb_FindObjects;
    sdb->sdb_FindObjectsFinal = sdb_FindObjectsFinal;
    sdb->sdb_GetAttributeValue = sdb_GetAttributeValue;
    sdb->sdb_SetAttributeValue = sdb_SetAttributeValue;
    sdb->sdb_CreateObject = sdb_CreateObject;
    sdb->sdb_DestroyObject = sdb_DestroyObject;
    sdb->sdb_GetMetaData = sdb_GetMetaData;
    sdb->sdb_PutMetaData = sdb_PutMetaData;
    sdb->sdb_Begin = sdb_Begin;
    sdb->sdb_Commit = sdb_Commit;
    sdb->sdb_Abort = sdb_Abort;
    sdb->sdb_Close = sdb_Close;

    if (inTransaction) {
	sqlerr = sqlite3_exec(sqlDB, COMMIT_CMD, NULL, 0, NULL);
	if (sqlerr != SQLITE_OK) {
	    error = sdb_mapSQLError(sdb_p->type, sqlerr);
	    goto loser;
	}
	inTransaction = 0;
    }
#ifdef SQLITE_THREAD_SHARE_DB
    sdb_p->sqlXactDB = sqlDB;
#else
    /* sqlite3 cannot share sqlDB references across threads, open the
     * db only when we need to read or update it (sigh) */
    sqlite3_close(sqlDB);
#endif

    *pSdb = sdb;
    UNLOCK_SQLITE();
    return CKR_OK;

loser:
    /* lots of stuff to do */
    if (inTransaction) {
	sqlite3_exec(sqlDB, ROLLBACK_CMD, NULL, 0, NULL);
    }
    if (sdb) {
	free(sdb);
    }
    if (sdb_p) {
	free(sdb_p);
    }
    if (sqlDB) {
	sqlite3_close(sqlDB);
    }
    UNLOCK_SQLITE();
    return error;

}

static char *sdb_BuildFileName(const char * directory, 
			const char *prefix, const char *type, 
			int version, int flags)
{
    char *dbname = NULL;
    /* build the full dbname */
    dbname = sqlite3_mprintf("%s/%s%s%d.db",directory, prefix, type, version);
    return dbname;
}

/* sdbopen */
CK_RV
s_open(const char *directory, const char *certPrefix, const char *keyPrefix,
	int cert_version, int key_version, int flags, 
	SDB **certdb, SDB **keydb, int *newInit)
{
    char *cert = sdb_BuildFileName(directory, certPrefix,
				   "cert", cert_version, flags);
    char *key = sdb_BuildFileName(directory, keyPrefix,
				   "key", key_version, flags);
    CK_RV error = CKR_OK;
    int inUpdate;

    *certdb = NULL;
    *keydb = NULL;
    *newInit = 0;

#ifdef SQLITE_UNSAFE_THREADS
    if (sqlite_lock == NULL) {
	sqlite_lock = PR_NewLock();
	if (sqlite_lock == NULL) {
	    error = CKR_HOST_MEMORY;
	    goto loser;
	}
    }
#endif

    /*
     * open the cert data base
     */
    if (certdb) {
	/* initialize Certificate database */
	error = sdb_init(cert, "nssPublic", SDB_CERT, &inUpdate,
			 newInit, flags, certdb);
	if (error != CKR_OK) {
	    goto loser;
	}
    }

    /*
     * open the key data base: 
     *  NOTE:is we want to implement a single database, we open
     *  the same database file as the certificate here.
     *
     *  cert an key db's have different tables, so they will not
     *  conflict.
     */
    if (keydb) {
	/* initialize the Key database */
	error = sdb_init(key, "nssPrivate", SDB_KEY, &inUpdate, 
			newInit, flags, keydb);
	if (error != CKR_OK) {
	    goto loser;
	} 
    }


loser:
    if (cert) {
	sqlite3_free(cert);
    }
    if (key) {
	sqlite3_free(key);
    }

    if (error != CKR_OK) {
	/* currently redundant, but could be necessary if more code is added
	 * just before loser */
	if (keydb && *keydb) {
	    sdb_Close(*keydb);
	}
	if (certdb && *certdb) {
	    sdb_Close(*certdb);
	}
    }

    return error;
}

CK_RV
s_shutdown()
{
#ifdef SQLITE_UNSAFE_THREADS
    if (sqlite_lock) {
	PR_DestroyLock(sqlite_lock);
	sqlite_lock = NULL;
    }
#endif
    return CKR_OK;
}
