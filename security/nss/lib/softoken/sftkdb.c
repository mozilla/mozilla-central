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
 * The Original Code is the Netscape security libraries.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1994-2000
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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
 *  The following code handles the storage of PKCS 11 modules used by the
 * NSS. For the rest of NSS, only one kind of database handle exists:
 *
 *     SFTKDBHandle
 *
 * There is one SFTKDBHandle for the each key database and one for each cert 
 * database. These databases are opened as associated pairs, one pair per
 * slot. SFTKDBHandles are reference counted objects.
 *
 * Each SFTKDBHandle points to a low level database handle (SDB). This handle
 * represents the underlying physical database. These objects are not 
 * reference counted, an are 'owned' by their respective SFTKDBHandles.
 *
 *  
 */
#include "sftkdb.h"
#include "pkcs11t.h"
#include "pkcs11i.h"
#include "sdb.h"
#include "prprf.h" 
#include "secmodt.h"
#include "sftkpars.h"
#include "pratom.h"
#include "blapi.h"
#include "secoid.h"
#include "sechash.h"
#include "lowpbe.h"
#include "secdert.h"
#include "prsystem.h"
#include "lgglue.h"
#include "secerr.h"

/*
 * private defines
 */
struct SFTKDBHandleStr {
    SDB   *db;
    PRInt32 ref;
    CK_OBJECT_HANDLE  type;
    SECItem passwordKey;
    SECItem *newKey;
    PZLock *passwordLock;
    SFTKDBHandle *peerDB;
    SDB   *update;
};

#define SFTK_KEYDB_TYPE 0x40000000
#define SFTK_CERTDB_TYPE 0x00000000
#define SFTK_OBJ_TYPE_MASK 0xc0000000
#define SFTK_OBJ_ID_MASK (~SFTK_OBJ_TYPE_MASK)
#define SFTK_TOKEN_TYPE 0x80000000

static SECStatus sftkdb_decryptAttribute(SECItem *passKey, SECItem *cipherText, 
                                SECItem **plainText);
static SECStatus sftkdb_encryptAttribute(PLArenaPool *arena, SECItem *passKey, 
                                SECItem *plainText, SECItem **cipherText);
static SECStatus sftkdb_signAttribute(PLArenaPool *arena, SECItem *passKey, 
				CK_OBJECT_HANDLE objectID,
				CK_ATTRIBUTE_TYPE attrType,
                                SECItem *plainText, SECItem **sigText);
static SECStatus sftkdb_verifyAttribute(SECItem *passKey,
				CK_OBJECT_HANDLE objectID,
				CK_ATTRIBUTE_TYPE attrType,
				SECItem *plainText, SECItem *sigText);


/*
 * We want all databases to have the same binary representation independent of
 * endianness or length of the host architecture. In general PKCS #11 attributes
 * are endian/length independent except those attributes that pass CK_ULONG.
 *
 * The following functions fixes up the CK_ULONG type attributes so that the data
 * base sees a machine independent view. CK_ULONGs are stored as 4 byte network
 * byte order values (big endian).
 */
#define DB_ULONG_SIZE 4
#define BBP 8

static PRBool
sftkdb_isULONGAttribute(CK_ATTRIBUTE_TYPE type) 
{
    switch(type) {
    case CKA_CLASS:
    case CKA_CERTIFICATE_TYPE:
    case CKA_CERTIFICATE_CATEGORY:
    case CKA_KEY_TYPE:
    case CKA_JAVA_MIDP_SECURITY_DOMAIN:

    case CKA_TRUST_DIGITAL_SIGNATURE:
    case CKA_TRUST_NON_REPUDIATION:
    case CKA_TRUST_KEY_ENCIPHERMENT:
    case CKA_TRUST_DATA_ENCIPHERMENT:
    case CKA_TRUST_KEY_AGREEMENT:
    case CKA_TRUST_KEY_CERT_SIGN:
    case CKA_TRUST_CRL_SIGN:

    case CKA_TRUST_SERVER_AUTH:
    case CKA_TRUST_CLIENT_AUTH:
    case CKA_TRUST_CODE_SIGNING:
    case CKA_TRUST_EMAIL_PROTECTION:
    case CKA_TRUST_IPSEC_END_SYSTEM:
    case CKA_TRUST_IPSEC_TUNNEL:
    case CKA_TRUST_IPSEC_USER:
    case CKA_TRUST_TIME_STAMPING:
    case CKA_TRUST_STEP_UP_APPROVED:
	return PR_TRUE;
    default:
	break;
    }
    return PR_FALSE;
    
}

/* are the attributes private? */
static PRBool
sftkdb_isPrivateAttribute(CK_ATTRIBUTE_TYPE type) 
{
    switch(type) {
    case CKA_VALUE:
    case CKA_PRIVATE_EXPONENT:
    case CKA_PRIME_1:
    case CKA_PRIME_2:
    case CKA_EXPONENT_1:
    case CKA_EXPONENT_2:
    case CKA_COEFFICIENT:
	return PR_TRUE;
    default:
	break;
    }
    return PR_FALSE;
}

/* These attributes must be authenticated with an hmac. */
static PRBool
sftkdb_isAuthenticatedAttribute(CK_ATTRIBUTE_TYPE type) 
{
    switch(type) {
    case CKA_MODULUS:
    case CKA_PUBLIC_EXPONENT:
    case CKA_CERT_SHA1_HASH:
    case CKA_CERT_MD5_HASH:
    case CKA_TRUST_SERVER_AUTH:
    case CKA_TRUST_CLIENT_AUTH:
    case CKA_TRUST_EMAIL_PROTECTION:
    case CKA_TRUST_CODE_SIGNING:
    case CKA_TRUST_STEP_UP_APPROVED:
    case CKA_NSS_OVERRIDE_EXTENSIONS:
	return PR_TRUE;
    default:
	break;
    }
    return PR_FALSE;
}

/*
 * convert a native ULONG to a database ulong. Database ulong's
 * are all 4 byte big endian values.
 */
static void
sftk_uLong2DBULong(unsigned char *data, CK_ULONG value)
{ 
    int i;

    for (i=0; i < DB_ULONG_SIZE; i++) {
	data[i] = (value >> (DB_ULONG_SIZE-1-i)*BBP) & 0xff;
    }
}

/*
 * fix up the input templates. Our fixed up ints are stored in data and must
 * be freed by the caller. The new template must also be freed. If there are no
 * CK_ULONG attributes, the orignal template is passed in as is.
 */
static CK_ATTRIBUTE *
sftkdb_fixupTemplateIn(const CK_ATTRIBUTE *template, int count, 
			unsigned char **dataOut)
{
    int i;
    int ulongCount = 0;
    unsigned char *data;
    CK_ATTRIBUTE *ntemplate;

    *dataOut = NULL;

    /* first count the number of CK_ULONG attributes */
    for (i=0; i < count; i++) {
	/* Don't 'fixup' NULL values */
	if (!template[i].pValue) {
	    continue;
	}
	if (template[i].ulValueLen == sizeof (CK_ULONG)) {
	    if ( sftkdb_isULONGAttribute(template[i].type)) {
		ulongCount++;
	    }
	}
    }
    /* no attributes to fixup, just call on through */
    if (ulongCount == 0) {
	return (CK_ATTRIBUTE *)template;
    }

    /* allocate space for new ULONGS */
    data = (unsigned char *)PORT_Alloc(DB_ULONG_SIZE*ulongCount);
    if (!data) {
	return NULL;
    }

    /* allocate new template */
    ntemplate = PORT_NewArray(CK_ATTRIBUTE,count);
    if (!ntemplate) {
	PORT_Free(data);
	return NULL;
    }
    *dataOut = data;
    /* copy the old template, fixup the actual ulongs */
    for (i=0; i < count; i++) {
	ntemplate[i] = template[i];
	/* Don't 'fixup' NULL values */
	if (!template[i].pValue) {
	    continue;
	}
	if (template[i].ulValueLen == sizeof (CK_ULONG)) {
	    if ( sftkdb_isULONGAttribute(template[i].type) ) {
		CK_ULONG value = *(CK_ULONG *) template[i].pValue;
		sftk_uLong2DBULong(data, value);
		ntemplate[i].pValue = data;
		ntemplate[i].ulValueLen = DB_ULONG_SIZE;
		data += DB_ULONG_SIZE;
	    }
	}
    }
    return ntemplate;
}

#define GET_SDB(handle) ((handle)->update ? (handle)->update : (handle)->db)

static const char SFTKDB_META_SIG_TEMPLATE[] = "sig_%s_%08x_%08x";

/*
 * Some attributes are signed with an Hmac and a pbe key generated from
 * the password. This signature is stored indexed by object handle and
 * attribute type in the meta data table in the key database.
 *
 * Signature entries are indexed by the string
 * sig_[cert/key]_{ObjectID}_{Attribute}
 *
 * This function fetches that pkcs5 signature. Caller supplies a SECItem
 * pre-allocated to the appropriate size if the SECItem is too small the
 * function will fail with CKR_BUFFER_TOO_SMALL.
 */
static CK_RV
sftkdb_getAttributeSignature(SFTKDBHandle *handle, SFTKDBHandle *keyHandle, 
		CK_OBJECT_HANDLE objectID, CK_ATTRIBUTE_TYPE type,
		SECItem *signText)
{
    SDB *db;
    char id[30];
    CK_RV crv;

    db = GET_SDB(keyHandle);

    sprintf(id, SFTKDB_META_SIG_TEMPLATE,
	handle->type == SFTK_KEYDB_TYPE ? "key":"cert",
	(unsigned int)objectID, (unsigned int)type);

    crv = (*db->sdb_GetMetaData)(db, id, signText, NULL);
    return crv;
}

/*
 * Some attributes are signed with an Hmac and a pbe key generated from
 * the password. This signature is stored indexed by object handle and
 * attribute type in the meta data table in the key database.
 *
 * Signature entries are indexed by the string
 * sig_[cert/key]_{ObjectID}_{Attribute}
 *
 * This function stores that pkcs5 signature.
 */
static CK_RV
sftkdb_putAttributeSignature(SFTKDBHandle *handle, SDB *keyTarget, 
		CK_OBJECT_HANDLE objectID, CK_ATTRIBUTE_TYPE type,
		SECItem *signText)
{
    char id[30];
    CK_RV crv;

    sprintf(id, SFTKDB_META_SIG_TEMPLATE,
	handle->type == SFTK_KEYDB_TYPE ? "key":"cert", 
	(unsigned int)objectID, (unsigned int)type);

    crv = (*keyTarget->sdb_PutMetaData)(keyTarget, id, signText, NULL);
    return crv;
}


/*
 * fix up returned data. NOTE: sftkdb_fixupTemplateIn has already allocated
 * separate data sections for the database ULONG values.
 */
static CK_RV
sftkdb_fixupTemplateOut(CK_ATTRIBUTE *template, CK_OBJECT_HANDLE objectID,
		CK_ATTRIBUTE *ntemplate, int count, SFTKDBHandle *handle)
{
    int i,j;
    CK_RV crv = CKR_OK;
    SFTKDBHandle *keyHandle;
    PRBool checkSig = PR_TRUE;
    PRBool checkEnc = PR_TRUE;

    PORT_Assert(handle);

    /* find the key handle */
    keyHandle = handle;
    if (handle->type != SFTK_KEYDB_TYPE) {
	checkEnc = PR_FALSE;
	keyHandle = handle->peerDB;
    }

    if ((keyHandle == NULL) || 
	((GET_SDB(keyHandle)->sdb_flags & SDB_HAS_META) == 0)  ||
	(keyHandle->passwordKey.data == NULL)) {
	checkSig = PR_FALSE;
    }

    for (i=0; i < count; i++) {
	CK_ULONG length = template[i].ulValueLen;
	template[i].ulValueLen = ntemplate[i].ulValueLen;
	/* fixup ulongs */
	if (ntemplate[i].ulValueLen == DB_ULONG_SIZE) {
	    if (sftkdb_isULONGAttribute(template[i].type)) {
		if (template[i].pValue) {
		    CK_ULONG value = 0;
		    unsigned char *data;

		    data = (unsigned char *)ntemplate[i].pValue;
		    for (j=0; j < DB_ULONG_SIZE; j++) {
			value |= (((CK_ULONG)data[j]) << (DB_ULONG_SIZE-1-j)*BBP);
		    }
		    if (length < sizeof(CK_ULONG)) {
			template[i].ulValueLen = -1;
			crv = CKR_BUFFER_TOO_SMALL;
			continue;
		    } 
		    PORT_Memcpy(template[i].pValue,&value,sizeof(CK_ULONG));
		}
		template[i].ulValueLen = sizeof(CK_ULONG);
	    }
	}

	/* if no data was retrieved, no need to process encrypted or signed
	 * attributes */
	if ((template[i].pValue == NULL) || (template[i].ulValueLen == -1)) {
	    continue;
	}

	/* fixup private attributes */
	if (checkEnc && sftkdb_isPrivateAttribute(ntemplate[i].type)) {
	    /* we have a private attribute */
	    /* This code depends on the fact that the cipherText is bigger
	     * than the plain text */
	    SECItem cipherText;
	    SECItem *plainText;
	    SECStatus rv;

	    cipherText.data = ntemplate[i].pValue;
	    cipherText.len = ntemplate[i].ulValueLen;
    	    PZ_Lock(handle->passwordLock);
	    if (handle->passwordKey.data == NULL) {
		PZ_Unlock(handle->passwordLock);
		template[i].ulValueLen = -1;
		crv = CKR_USER_NOT_LOGGED_IN;
		continue;
	    }
	    rv = sftkdb_decryptAttribute(&handle->passwordKey, 
					&cipherText, &plainText);
	    PZ_Unlock(handle->passwordLock);
	    if (rv != SECSuccess) {
		PORT_Memset(template[i].pValue, 0, template[i].ulValueLen);
		template[i].ulValueLen = -1;
		crv = CKR_GENERAL_ERROR;
		continue;
	    }
	    PORT_Assert(template[i].ulValueLen >= plainText->len);
	    if (template[i].ulValueLen < plainText->len) {
		SECITEM_FreeItem(plainText,PR_TRUE);
		PORT_Memset(template[i].pValue, 0, template[i].ulValueLen);
		template[i].ulValueLen = -1;
		crv = CKR_GENERAL_ERROR;
		continue;
	    }
		
	    /* copy the plain text back into the template */
	    PORT_Memcpy(template[i].pValue, plainText->data, plainText->len);
	    template[i].ulValueLen = plainText->len;
	    SECITEM_FreeItem(plainText,PR_TRUE);
	}
	/* make sure signed attributes are valid */
	if (checkSig && sftkdb_isAuthenticatedAttribute(ntemplate[i].type)) {
	    SECStatus rv;
	    SECItem signText;
	    SECItem plainText;
	    unsigned char signData[SDB_MAX_META_DATA_LEN];

	    signText.data = signData;
	    signText.len = sizeof(signData);

	    rv = sftkdb_getAttributeSignature(handle, keyHandle, 
				objectID, ntemplate[i].type, &signText);
	    if (rv != SECSuccess) {
		PORT_Memset(template[i].pValue, 0, template[i].ulValueLen);
		template[i].ulValueLen = -1;
		crv = CKR_DATA_INVALID; /* better error code? */
		continue;
	    }

	    plainText.data = ntemplate[i].pValue;
	    plainText.len = ntemplate[i].ulValueLen;

	    /*
	     * we do a second check holding the lock just in case the user
	     * loggout while we were trying to get the signature.
	     */
    	    PZ_Lock(keyHandle->passwordLock);
	    if (keyHandle->passwordKey.data == NULL) {
		/* if we are no longer logged in, no use checking the other
		 * Signatures either. */
		checkSig = PR_FALSE; 
		PZ_Unlock(keyHandle->passwordLock);
		continue;
	    }

	    rv = sftkdb_verifyAttribute(&keyHandle->passwordKey, 
				objectID, ntemplate[i].type,
				&plainText, &signText);
	    PZ_Unlock(keyHandle->passwordLock);
	    if (rv != SECSuccess) {
		PORT_Memset(template[i].pValue, 0, template[i].ulValueLen);
		template[i].ulValueLen = -1;
		crv = CKR_SIGNATURE_INVALID; /* better error code? */
	    }
	    /* This Attribute is fine */
	}
    }
    return crv;
}

/*
 * Some attributes are signed with an HMAC and a pbe key generated from
 * the password. This signature is stored indexed by object handle and
 *
 * Those attributes are:
 * 1) Trust object hashes and trust values.
 * 2) public key values.
 *
 * Certs themselves are considered properly authenticated by virtue of their
 * signature, or their matching hash with the trust object.
 *
 * These signature is only checked for objects coming from shared databases. 
 * Older dbm style databases have such no signature checks. HMACs are also 
 * only checked when the token is logged in, as it requires a pbe generated 
 * from the password.
 *
 * Tokens which have no key database (and therefore no master password) do not
 * have any stored signature values. Signature values are stored in the key
 * database, since the signature data is tightly coupled to the key database
 * password. 
 *
 * This function takes a template of attributes that were either created or
 * modified. These attributes are checked to see if the need to be signed.
 * If they do, then this function signs the attributes and writes them
 * to the meta data store.
 *
 * This function can fail if there are attributes that must be signed, but
 * the token is not logged in.
 *
 * The caller is expected to abort any transaction he was in in the
 * event of a failure of this function.
 */
static CK_RV
sftk_signTemplate(PLArenaPool *arena, SFTKDBHandle *handle, 
		  PRBool mayBeUpdateDB,
		  CK_OBJECT_HANDLE objectID, CK_ATTRIBUTE *template,
		  CK_ULONG count)
{
    int i;
    SFTKDBHandle *keyHandle = handle;
    SDB *keyTarget = NULL;

    PORT_Assert(handle);

    if (handle->type != SFTK_KEYDB_TYPE) {
	keyHandle = handle->peerDB;
    }

    /* no key DB defined? then no need to sign anything */
    if (keyHandle == NULL) {
	return CKR_OK;
    }

    /* When we are in a middle of an update, we have an update database set, 
     * but we want to write to the real database. The bool mayBeUpdateDB is
     * set to TRUE if it's possible that we want to write an update database
     * rather than a primary */
    keyTarget = (mayBeUpdateDB && keyHandle->update) ? 
		keyHandle->update : keyHandle->db;

    /* skip the the database does not support meta data */
    if ((keyTarget->sdb_flags & SDB_HAS_META) == 0) {
	return CKR_OK;
    }

    for (i=0; i < count; i ++) {
	if (sftkdb_isAuthenticatedAttribute(template[i].type)) {
	    SECStatus rv;
	    SECItem *signText;
	    SECItem plainText;

	    plainText.data = template[i].pValue;
	    plainText.len = template[i].ulValueLen;
	    PZ_Lock(keyHandle->passwordLock);
	    if (keyHandle->passwordKey.data == NULL) {
		PZ_Unlock(keyHandle->passwordLock);
		return CKR_USER_NOT_LOGGED_IN;
	    }
	    rv = sftkdb_signAttribute(arena, &keyHandle->passwordKey, 
				objectID, template[i].type,
				&plainText, &signText);
	    PZ_Unlock(keyHandle->passwordLock);
	    if (rv != SECSuccess) {
		return CKR_GENERAL_ERROR; /* better error code here? */
	    }
	    rv = sftkdb_putAttributeSignature(handle, keyTarget, 
				objectID, template[i].type, signText);
	    if (rv != SECSuccess) {
		return CKR_GENERAL_ERROR; /* better error code here? */
	    }
	}
    }
    return CKR_OK;
}

static CK_RV
sftkdb_CreateObject(PRArenaPool *arena, SFTKDBHandle *handle, 
	SDB *db, CK_OBJECT_HANDLE *objectID,
        CK_ATTRIBUTE *template, CK_ULONG count)
{
    PRBool inTransaction = PR_FALSE;
    CK_RV crv;

    crv = (*db->sdb_Begin)(db);
    if (crv != CKR_OK) {
	goto loser;
    }
    inTransaction = PR_TRUE;
    crv = (*db->sdb_CreateObject)(db, objectID, template, count);
    if (crv != CKR_OK) {
	goto loser;
    }
    crv = sftk_signTemplate(arena, handle, (db == handle->update),
					*objectID, template, count);
    if (crv != CKR_OK) {
	goto loser;
    }
    crv = (*db->sdb_Commit)(db);
    inTransaction = PR_FALSE;

loser:
    if (inTransaction) {
	(*handle->db->sdb_Abort)(handle->db);
	/* It is trivial to show the following code cannot
	 * happen unless something is horribly wrong with our compilier or
	 * hardware */
	PORT_Assert(crv != CKR_OK);
	if (crv == CKR_OK) crv = CKR_GENERAL_ERROR;
    }
    return crv;
}


CK_ATTRIBUTE * 
sftk_ExtractTemplate(PLArenaPool *arena, SFTKObject *object, 
		     SFTKDBHandle *handle,CK_ULONG *pcount, 
		     CK_RV *crv)
{
    int count;
    CK_ATTRIBUTE *template;
    int i, templateIndex;
    SFTKSessionObject *sessObject = sftk_narrowToSessionObject(object);
    PRBool doEnc = PR_TRUE;

    *crv = CKR_OK;

    if (sessObject == NULL) {
	*crv = CKR_GENERAL_ERROR; /* internal programming error */
	return NULL;
    }

    PORT_Assert(handle);
    /* find the key handle */
    if (handle->type != SFTK_KEYDB_TYPE) {
	doEnc = PR_FALSE;
    }

    PZ_Lock(sessObject->attributeLock);
    count = 0;
    for (i=0; i < sessObject->hashSize; i++) {
	SFTKAttribute *attr;
   	for (attr=sessObject->head[i]; attr; attr=attr->next) {
	    count++;
	}
    }
    template = PORT_ArenaNewArray(arena, CK_ATTRIBUTE, count);
    if (template == NULL) {
        PZ_Unlock(sessObject->attributeLock);
	*crv = CKR_HOST_MEMORY;
	return NULL;
    }
    templateIndex = 0;
    for (i=0; i < sessObject->hashSize; i++) {
	SFTKAttribute *attr;
   	for (attr=sessObject->head[i]; attr; attr=attr->next) {
	    CK_ATTRIBUTE *tp = &template[templateIndex++];
	    /* copy the attribute */
	    *tp = attr->attrib;

	    /* fixup  ULONG s */
	    if ((tp->ulValueLen == sizeof (CK_ULONG)) &&
		(sftkdb_isULONGAttribute(tp->type)) ) {
		CK_ULONG value = *(CK_ULONG *) tp->pValue;
		unsigned char *data;
		int j;

		tp->pValue = PORT_ArenaAlloc(arena, DB_ULONG_SIZE);
		data = (unsigned char *)tp->pValue;
		if (data == NULL) {
		    *crv = CKR_HOST_MEMORY;
		    break;
		}
		for (j=0; j < DB_ULONG_SIZE; j++) {
		    data[j] = (value >> (DB_ULONG_SIZE-1-j)*BBP) & 0xff;
		}
		tp->ulValueLen = DB_ULONG_SIZE;
	    }

	    /* encrypt private attributes */
	    if (doEnc && sftkdb_isPrivateAttribute(tp->type)) {

		/* we have a private attribute */
		SECItem *cipherText;
		SECItem plainText;
		SECStatus rv;

		plainText.data = tp->pValue;
		plainText.len = tp->ulValueLen;
		PZ_Lock(handle->passwordLock);
		if (handle->passwordKey.data == NULL) {
		    PZ_Unlock(handle->passwordLock);
		    *crv = CKR_USER_NOT_LOGGED_IN;
		    break;
		}
		rv = sftkdb_encryptAttribute(arena, &handle->passwordKey, 
						&plainText, &cipherText);
		PZ_Unlock(handle->passwordLock);
		if (rv == SECSuccess) {
		    tp->pValue = cipherText->data;
		    tp->ulValueLen = cipherText->len;
		} else {
		    *crv = CKR_GENERAL_ERROR; /* better error code here? */
		    break;
		}
		PORT_Memset(plainText.data, 0, plainText.len);
	    }
	}
    }
    PORT_Assert(templateIndex <= count);
    PZ_Unlock(sessObject->attributeLock);

    if (*crv != CKR_OK) {
	return NULL;
    }
    if (pcount) {
	*pcount = count;
    }
    return template;

}

CK_RV
sftkdb_write(SFTKDBHandle *handle, SFTKObject *object, 
	     CK_OBJECT_HANDLE *objectID)
{
    CK_ATTRIBUTE *template;
    PLArenaPool *arena;
    CK_ULONG count;
    CK_RV crv;
    SDB *db;

    *objectID = CK_INVALID_HANDLE;

    if (handle == NULL) {
	return  CKR_TOKEN_WRITE_PROTECTED;
    }
    db = GET_SDB(handle);

    arena = PORT_NewArena(256);
    if (arena ==  NULL) {
	return CKR_HOST_MEMORY;
    }

    template = sftk_ExtractTemplate(arena, object, handle, &count, &crv);
    if (!template) {
	goto loser;
    }

    crv = sftkdb_CreateObject(arena, handle, db, objectID, template, count);

loser:
    if (arena) {
	PORT_FreeArena(arena,PR_FALSE);
    }
    if (crv == CKR_OK) {
	*objectID |= (handle->type | SFTK_TOKEN_TYPE);
    } 
    return crv;
}




CK_RV 
sftkdb_FindObjectsInit(SFTKDBHandle *handle, const CK_ATTRIBUTE *template,
				 CK_ULONG count, SDBFind **find) 
{
    unsigned char *data = NULL;
    CK_ATTRIBUTE *ntemplate = NULL;
    CK_RV crv;
    SDB *db;

    if (handle == NULL) {
	return CKR_OK;
    }
    db = GET_SDB(handle);

    if (count !=  0) {
	ntemplate = sftkdb_fixupTemplateIn(template, count, &data);
	if (ntemplate == NULL) {
	    return CKR_HOST_MEMORY;
	}
    }
	
    crv = (*db->sdb_FindObjectsInit)(db, ntemplate, 
					     count, find);
    if (data) {
	PORT_Free(ntemplate);
	PORT_Free(data);
    }
    return crv;
}

CK_RV 
sftkdb_FindObjects(SFTKDBHandle *handle, SDBFind *find, 
			CK_OBJECT_HANDLE *ids, int arraySize, CK_ULONG *count)
{
    CK_RV crv;
    SDB *db;

    if (handle == NULL) {
	*count = 0;
	return CKR_OK;
    }
    db = GET_SDB(handle);

    crv = (*db->sdb_FindObjects)(db, find, ids, 
					    arraySize, count);
    if (crv == CKR_OK) {
	int i;
	for (i=0; i < *count; i++) {
	    ids[i] |= (handle->type | SFTK_TOKEN_TYPE);
	}
    }
    return crv;
}

CK_RV sftkdb_FindObjectsFinal(SFTKDBHandle *handle, SDBFind *find)
{
    SDB *db;
    if (handle == NULL) {
	return CKR_OK;
    }
    db = GET_SDB(handle);
    return (*db->sdb_FindObjectsFinal)(db, find);
}

CK_RV
sftkdb_GetAttributeValue(SFTKDBHandle *handle, CK_OBJECT_HANDLE objectID,
                                CK_ATTRIBUTE *template, CK_ULONG count)
{
    CK_RV crv,crv2;
    CK_ATTRIBUTE *ntemplate;
    unsigned char *data = NULL;
    SDB *db;

    if (handle == NULL) {
	return CKR_GENERAL_ERROR;
    }

    /* short circuit common attributes */
    if (count == 1 && 
	  (template[0].type == CKA_TOKEN || 
	   template[0].type == CKA_PRIVATE ||
	   template[0].type == CKA_SENSITIVE)) {
	CK_BBOOL boolVal = CK_TRUE;

	if (template[0].pValue == NULL) {
	    template[0].ulValueLen = sizeof(CK_BBOOL);
	    return CKR_OK;
	}
	if (template[0].ulValueLen < sizeof(CK_BBOOL)) {
	    template[0].ulValueLen = -1;
	    return CKR_BUFFER_TOO_SMALL;
	}

	if ((template[0].type == CKA_PRIVATE) &&
    				(handle->type != SFTK_KEYDB_TYPE)) {
	    boolVal = CK_FALSE;
	}
	if ((template[0].type == CKA_SENSITIVE) &&
    				(handle->type != SFTK_KEYDB_TYPE)) {
	    boolVal = CK_FALSE;
	}
	*(CK_BBOOL *)template[0].pValue = boolVal;
	template[0].ulValueLen = sizeof(CK_BBOOL);
	return CKR_OK;
    }

    db = GET_SDB(handle);
    /* nothing to do */
    if (count == 0) {
	return CKR_OK;
    }
    ntemplate = sftkdb_fixupTemplateIn(template, count, &data);
    if (ntemplate == NULL) {
	return CKR_HOST_MEMORY;
    }
    objectID &= SFTK_OBJ_ID_MASK;
    crv = (*db->sdb_GetAttributeValue)(db, objectID, 
						ntemplate, count);
    crv2 = sftkdb_fixupTemplateOut(template, objectID, ntemplate, 
						count, handle);
    if (crv == CKR_OK) crv = crv2;
    if (data) {
	PORT_Free(ntemplate);
	PORT_Free(data);
    }
    return crv;

}

CK_RV
sftkdb_SetAttributeValue(SFTKDBHandle *handle, CK_OBJECT_HANDLE objectID,
                                const CK_ATTRIBUTE *template, CK_ULONG count)
{
    CK_RV crv = CKR_OK;
    CK_ATTRIBUTE *ntemplate;
    unsigned char *data = NULL;
    PLArenaPool *arena = NULL;
    SDB *db;

    if (handle == NULL) {
	return CKR_TOKEN_WRITE_PROTECTED;
    }

    db = GET_SDB(handle);
    /* nothing to do */
    if (count == 0) {
	return CKR_OK;
    }

    ntemplate = sftkdb_fixupTemplateIn(template, count, &data);
    if (ntemplate == NULL) {
	return CKR_HOST_MEMORY;
    }

    arena = PORT_NewArena(256);
    if (arena ==  NULL) {
	return CKR_HOST_MEMORY;
    }

    objectID &= SFTK_OBJ_ID_MASK;
    crv = (*db->sdb_Begin)(db);
    if (crv != CKR_OK) {
	goto loser;
    }
    crv = (*db->sdb_SetAttributeValue)(db, objectID, ntemplate, count);
    if (crv != CKR_OK) {
	goto loser;
    }
    crv = sftk_signTemplate(arena, handle, PR_TRUE, objectID, ntemplate, count);
    if (crv != CKR_OK) {
	goto loser;
    }
    crv = (*db->sdb_Commit)(db);
loser:
    if (crv != CKR_OK) {
	(*db->sdb_Abort)(db);
    }
    if (data) {
	PORT_Free(ntemplate);
	PORT_Free(data);
    }
    PORT_FreeArena(arena, PR_FALSE);
    return crv;
}

CK_RV
sftkdb_DestroyObject(SFTKDBHandle *handle, CK_OBJECT_HANDLE objectID)
{
    CK_RV crv = CKR_OK;
    SDB *db;

    if (handle == NULL) {
	return CKR_TOKEN_WRITE_PROTECTED;
    }
    db = GET_SDB(handle);
    objectID &= SFTK_OBJ_ID_MASK;
    crv = (*db->sdb_Begin)(db);
    if (crv != CKR_OK) {
	goto loser;
    }
    crv = (*db->sdb_DestroyObject)(db, objectID);
    if (crv != CKR_OK) {
	goto loser;
    }
    crv = (*db->sdb_Commit)(db);
loser:
    if (crv != CKR_OK) {
	(*db->sdb_Abort)(db);
    }
    return crv;
}

CK_RV
sftkdb_CloseDB(SFTKDBHandle *handle)
{
    if (handle == NULL) {
	return CKR_OK;
    }
    if (handle->update) {
	(*handle->update->sdb_Close)(handle->update);
    }
    if (handle->db) {
	(*handle->db->sdb_Close)(handle->db);
    }
    if (handle->passwordLock) {
	PZ_DestroyLock(handle->passwordLock);
    }
    PORT_Free(handle);
    return CKR_OK;
}

/*
 * reset a database to it's uninitialized state. 
 */
static CK_RV
sftkdb_ResetDB(SFTKDBHandle *handle)
{
    CK_RV crv = CKR_OK;
    SDB *db;
    if (handle == NULL) {
	return CKR_TOKEN_WRITE_PROTECTED;
    }
    db = GET_SDB(handle);
    crv = (*db->sdb_Begin)(db);
    if (crv != CKR_OK) {
	goto loser;
    }
    crv = (*db->sdb_Reset)(db);
    if (crv != CKR_OK) {
	goto loser;
    }
    crv = (*db->sdb_Commit)(db);
loser:
    if (crv != CKR_OK) {
	(*db->sdb_Abort)(db);
    }
    return crv;
}


CK_RV
sftkdb_Begin(SFTKDBHandle *handle)
{
    CK_RV crv = CKR_OK;
    SDB *db;

    if (handle == NULL) {
	return CKR_OK;
    }
    db = GET_SDB(handle);
    if (db) {
	crv = (*db->sdb_Begin)(db);
    }
    return crv;
}

CK_RV
sftkdb_Commit(SFTKDBHandle *handle)
{
    CK_RV crv = CKR_OK;
    SDB *db;

    if (handle == NULL) {
	return CKR_OK;
    }
    db = GET_SDB(handle);
    if (db) {
	(*db->sdb_Commit)(db);
    }
    return crv;
}

CK_RV
sftkdb_Abort(SFTKDBHandle *handle)
{
    CK_RV crv = CKR_OK;
    SDB *db;

    if (handle == NULL) {
	return CKR_OK;
    }
    db = GET_SDB(handle);
    if (db) {
	crv = (db->sdb_Abort)(db);
    }
    return crv;
}


/****************************************************************
 *
 * Secmod database.
 *
 * The new secmod database is simply a text file with each of the module
 * entries. in the following form:
 *
 * #
 * # This is a comment The next line is the library to load
 * library=libmypkcs11.so
 * name="My PKCS#11 module"
 * params="my library's param string"
 * nss="NSS parameters"
 * other="parameters for other libraries and applications"
 * 
 * library=libmynextpk11.so
 * name="My other PKCS#11 module"
 */

static char *
sftkdb_quote(const char *string, char quote)
{
    char *newString = 0;
    int escapes = 0, size = 0;
    const char *src;
    char *dest;

    size=2;
    for (src=string; *src ; src++) {
	if ((*src == quote) || (*src == '\\')) escapes++;
	size++;
    }

    dest = newString = PORT_ZAlloc(escapes+size+1); 
    if (newString == NULL) {
	return NULL;
    }

    *dest++=quote;
    for (src=string; *src; src++,dest++) {
	if ((*src == '\\') || (*src == quote)) {
	    *dest++ = '\\';
	}
	*dest = *src;
    }
    *dest=quote;

    return newString;
}

/*
 * Smart string cat functions. Automatically manage the memory.
 * The first parameter is the source string. If it's null, we 
 * allocate memory for it. If it's not, we reallocate memory
 * so the the concanenated string fits.
 */
static char *
sftkdb_DupnCat(char *baseString, const char *str, int str_len)
{
    int len = (baseString ? PORT_Strlen(baseString) : 0) + 1;
    char *newString;

    len += str_len;
    newString = (char *) PORT_Realloc(baseString,len);
    if (newString == NULL) {
	PORT_Free(baseString);
	return NULL;
    }
    if (baseString == NULL) *newString = 0;
    return PORT_Strncat(newString,str, str_len);
}

/* Same as sftkdb_DupnCat except it concatenates the full string, not a
 * partial one */
static char *
sftkdb_DupCat(char *baseString, const char *str)
{
    return sftkdb_DupnCat(baseString, str, PORT_Strlen(str));
}

/* function to free up all the memory associated with a null terminated
 * array of module specs */
static SECStatus
sftkdb_releaseSpecList(char **moduleSpecList)
{
    if (moduleSpecList) {
	char **index;
	for(index = moduleSpecList; *index; index++) {
	    PORT_Free(*index);
	}
	PORT_Free(moduleSpecList);
    }
    return SECSuccess;
}

#define SECMOD_STEP 10
static SECStatus
sftkdb_growList(char ***pModuleList, int *useCount, int last)
{
    char **newModuleList;

    *useCount += SECMOD_STEP;
    newModuleList = (char **)PORT_Realloc(*pModuleList,
					  *useCount*sizeof(char *));
    if (newModuleList == NULL) {
	return SECFailure;
    }
    PORT_Memset(&newModuleList[last],0, sizeof(char *)*SECMOD_STEP);
    *pModuleList = newModuleList;
    return SECSuccess;
}

static 
char *sftk_getOldSecmodName(const char *dbname,const char *filename)
{
    char *file = NULL;
    char *dirPath = PORT_Strdup(dbname);
    char *sep;

    sep = PORT_Strrchr(dirPath,*PATH_SEPARATOR);
#ifdef WINDOWS
    if (!sep) {
	sep = PORT_Strrchr(dirPath,'/');
    }
#endif
    if (sep) {
	*(sep)=0;
    }
    file= PR_smprintf("%s"PATH_SEPARATOR"%s", dirPath, filename);
    PORT_Free(dirPath);
    return file;
}

#define MAX_LINE_LENGTH 2048
#define SFTK_DEFAULT_INTERNAL_INIT1 "library= name=\"NSS Internal PKCS #11 Module\" parameters="
#define SFTK_DEFAULT_INTERNAL_INIT2 " NSS=\"Flags=internal,critical trustOrder=75 cipherOrder=100 slotParams=(1={"
#define SFTK_DEFAULT_INTERNAL_INIT3 " askpw=any timeout=30})\""

#ifdef XP_UNIX
#include <unistd.h>
#endif
/*
 * Read all the existing modules in out of the file.
 */
char **
sftkdb_ReadSecmodDB(SDBType dbType, const char *appName, 
		    const char *filename, const char *dbname, 
		    char *params, PRBool rw)
{
    FILE *fd = NULL;
    char **moduleList = NULL;
    int moduleCount = 1;
    int useCount = SECMOD_STEP;
    char line[MAX_LINE_LENGTH];
    PRBool internal = PR_FALSE;
    PRBool skipParams = PR_FALSE;
    char *moduleString = NULL;
    char *paramsValue=NULL;
    PRBool failed = PR_TRUE;

    if ((dbType == SDB_LEGACY) || (dbType == SDB_MULTIACCESS)) {
	return sftkdbCall_ReadSecmodDB(appName, filename, dbname, params, rw);
    }

    moduleList = (char **) PORT_ZAlloc(useCount*sizeof(char **));
    if (moduleList == NULL) return NULL;

    /* do we really want to use streams here */
    fd = fopen(dbname, "r");
    if (fd == NULL) goto done;

    /*
     * the following loop takes line separated config lines and colapses
     * the lines to a single string, escaping and quoting as necessary.
     */
    /* loop state variables */
    moduleString = NULL;  /* current concatenated string */
    internal = PR_FALSE;	     /* is this an internal module */
    skipParams = PR_FALSE;	   /* did we find an override parameter block*/
    paramsValue = NULL;		   /* the current parameter block value */
    while (fgets(line, sizeof(line), fd) != NULL) { 
	int len = PORT_Strlen(line);

	/* remove the ending newline */
	if (len && line[len-1] == '\n') {
	    len--;
	    line[len] = 0;
	}
	if (*line == '#') {
	    continue;
	}
	if (*line != 0) {
	    /*
	     * The PKCS #11 group standard assumes blocks of strings
	     * separated by new lines, clumped by new lines. Internally
	     * we take strings separated by spaces, so we may need to escape
	     * certain spaces.
	     */
	    char *value = PORT_Strchr(line,'=');

	    /* there is no value, write out the stanza as is */
	    if (value == NULL || value[1] == 0) {
		if (moduleString) {
		    moduleString = sftkdb_DupnCat(moduleString," ", 1);
		    if (moduleString == NULL) goto loser;
		}
	        moduleString = sftkdb_DupCat(moduleString, line);
		if (moduleString == NULL) goto loser;
	    /* value is already quoted, just write it out */
	    } else if (value[1] == '"') {
		if (moduleString) {
		    moduleString = sftkdb_DupnCat(moduleString," ", 1);
		    if (moduleString == NULL) goto loser;
		}
	        moduleString = sftkdb_DupCat(moduleString, line);
		if (moduleString == NULL) goto loser;
		/* we have an override parameter section, remember that
		 * we found this (see following comment about why this
		 * is necessary). */
	        if (PORT_Strncasecmp(line, "parameters", 10) == 0) {
			skipParams = PR_TRUE;
		}
	    /*
	     * The internal token always overrides it's parameter block
	     * from the passed in parameters, so wait until then end
	     * before we include the parameter block in case we need to 
	     * override it. NOTE: if the parameter block is quoted with ("),
	     * this override does not happen. This allows you to override
	     * the application's parameter configuration.
	     *
	     * parameter block state is controlled by the following variables:
	     *  skipParams - Bool : set to true of we have an override param
	     *    block (all other blocks, either implicit or explicit are
	     *    ignored).
	     *  paramsValue - char * : pointer to the current param block. In
	     *    the absence of overrides, paramsValue is set to the first
	     *    parameter block we find. All subsequent blocks are ignored.
	     *    When we find an internal token, the application passed
	     *    parameters take precident.
	     */
	    } else if (PORT_Strncasecmp(line, "parameters", 10) == 0) {
		/* already have parameters */
		if (paramsValue) {
			continue;
		}
		paramsValue = sftkdb_quote(&value[1], '"');
		if (paramsValue == NULL) goto loser;
		continue;
	    } else {
	    /* may need to quote */
	        char *newLine;
		if (moduleString) {
		    moduleString = sftkdb_DupnCat(moduleString," ", 1);
		    if (moduleString == NULL) goto loser;
		}
		moduleString = sftkdb_DupnCat(moduleString,line,value-line+1);
		if (moduleString == NULL)  goto loser;
	        newLine = sftkdb_quote(&value[1],'"');
		if (newLine == NULL) goto loser;
		moduleString = sftkdb_DupCat(moduleString,newLine);
	        PORT_Free(newLine);
		if (moduleString == NULL) goto loser;
	    }

	    /* check to see if it's internal? */
	    if (PORT_Strncasecmp(line, "NSS=", 4) == 0) {
		/* This should be case insensitive! reviewers make
		 * me fix it if it's not */
		if (PORT_Strstr(line,"internal")) {
		    internal = PR_TRUE;
		    /* override the parameters */
		    if (paramsValue) {
			PORT_Free(paramsValue);
		    }
		    paramsValue = sftkdb_quote(params, '"');
		}
	    }
	    continue;
	}
	if ((moduleString == NULL) || (*moduleString == 0)) {
	    continue;
	}

	/* 
	 * if we are here, we have found a complete stanza. Now write out
	 * any param section we may have found.
	 */
	if (paramsValue) {
	    /* we had an override */
	    if (!skipParams) {
		moduleString = sftkdb_DupnCat(moduleString," parameters=", 12);
		if (moduleString == NULL) goto loser;
		moduleString = sftkdb_DupCat(moduleString, paramsValue);
		if (moduleString == NULL) goto loser;
	    }
	    PORT_Free(paramsValue);
	    paramsValue = NULL;
	}

	if ((moduleCount+1) >= useCount) {
	    SECStatus rv;
	    rv = sftkdb_growList(&moduleList, &useCount,  moduleCount+1);
	    if (rv != SECSuccess) {
		goto loser;
	    }
	}

	if (internal) {
	    moduleList[0] = moduleString;
	} else {
	    moduleList[moduleCount] = moduleString;
	    moduleCount++;
	}
	moduleString = NULL;
	internal = PR_FALSE;
	skipParams = PR_FALSE;
    } 

    if (moduleString) {
	PORT_Free(moduleString);
	moduleString = NULL;
    }
done:
    /* if we couldn't open a pkcs11 database, look for the old one */
    if (fd == NULL) {
	char *olddbname = sftk_getOldSecmodName(dbname,filename);
	PRStatus status;
	char **oldModuleList;
	int i;

	/* couldn't get the old name */
	if (!olddbname) {
	    goto bail;
	}

	/* old one doesn't exist */
	status = PR_Access(olddbname, PR_ACCESS_EXISTS);
	if (status != PR_SUCCESS) {
	    goto bail;
	}

	oldModuleList = sftkdbCall_ReadSecmodDB(appName, filename, 
					olddbname, params, rw);
	/* old one had no modules */
	if (!oldModuleList) {
	    goto bail;
	}

	/* count the modules */
	for (i=0; oldModuleList[i]; i++) { }

	/* grow the moduleList if necessary */
	if (i >= useCount) {
	    SECStatus rv;
	    rv = sftkdb_growList(&moduleList,&useCount,moduleCount+1);
	    if (rv != SECSuccess) {
		goto loser;
	    }
	}
	
	/* write each module out, and copy it */
	for (i=0; oldModuleList[i]; i++) {
	    if (rw) {
		sftkdb_AddSecmodDB(dbType,appName,filename,dbname,
				oldModuleList[i],rw);
	    }
	    if (moduleList[i]) {
		PORT_Free(moduleList[i]);
	    }
	    moduleList[i] = PORT_Strdup(oldModuleList[i]);
	}

	/* done with the old module list */
	sftkdbCall_ReleaseSecmodDBData(appName, filename, olddbname, 
				  oldModuleList, rw);
    }
bail:
	
    if (!moduleList[0]) {
	char * newParams;
	moduleString = PORT_Strdup(SFTK_DEFAULT_INTERNAL_INIT1);
	newParams = sftkdb_quote(params,'"');
	if (newParams == NULL) goto loser;
	moduleString = sftkdb_DupCat(moduleString, newParams);
	PORT_Free(newParams);
	if (moduleString == NULL) goto loser;
	moduleString = sftkdb_DupCat(moduleString, SFTK_DEFAULT_INTERNAL_INIT2);
	if (moduleString == NULL) goto loser;
	moduleString = sftkdb_DupCat(moduleString, SECMOD_SLOT_FLAGS);
	if (moduleString == NULL) goto loser;
	moduleString = sftkdb_DupCat(moduleString, SFTK_DEFAULT_INTERNAL_INIT3);
	if (moduleString == NULL) goto loser;
	moduleList[0] = moduleString;
	moduleString = NULL;
    }
    failed = PR_FALSE;

loser:
    /*
     * cleanup
     */
    /* deal with trust cert db here */
    if (moduleString) {
	PORT_Free(moduleString);
	moduleString = NULL;
    }
    if (paramsValue) {
	PORT_Free(paramsValue);
	paramsValue = NULL;
    }
    if (failed || (moduleList[0] == NULL)) {
	/* This is wrong! FIXME */
	sftkdb_releaseSpecList(moduleList);
	moduleList = NULL;
	failed = PR_TRUE;
    }
    if (fd != NULL) {
	fclose(fd);
    } else if (!failed && rw) {
	/* update our internal module */
	sftkdb_AddSecmodDB(dbType,appName,filename,dbname,moduleList[0],rw);
    }
    return moduleList;
}

SECStatus
sftkdb_ReleaseSecmodDBData(SDBType dbType, const char *appName, 
			const char *filename, const char *dbname, 
			char **moduleSpecList, PRBool rw)
{
    if ((dbType == SDB_LEGACY) || (dbType == SDB_MULTIACCESS)) {
	return sftkdbCall_ReleaseSecmodDBData(appName, filename, dbname, 
					  moduleSpecList, rw);
    }
    if (moduleSpecList) {
	sftkdb_releaseSpecList(moduleSpecList);
    }
    return SECSuccess;
}


/*
 * Delete a module from the Data Base
 */
SECStatus
sftkdb_DeleteSecmodDB(SDBType dbType, const char *appName, 
		      const char *filename, const char *dbname, 
		      char *args, PRBool rw)
{
    /* SHDB_FIXME implement */
    FILE *fd = NULL;
    FILE *fd2 = NULL;
    char line[MAX_LINE_LENGTH];
    char *dbname2 = NULL;
    char *block = NULL;
    char *name = NULL;
    char *lib = NULL;
    int name_len, lib_len;
    PRBool skip = PR_FALSE;
    PRBool found = PR_FALSE;

    if ((dbType == SDB_LEGACY) || (dbType == SDB_MULTIACCESS)) {
	return sftkdbCall_DeleteSecmodDB(appName, filename, dbname, args, rw);
    }

    if (!rw) {
	return SECFailure;
    }

    dbname2 = strdup(dbname);
    if (dbname2 == NULL) goto loser;
    dbname2[strlen(dbname)-1]++;

    /* do we really want to use streams here */
    fd = fopen(dbname, "r");
    if (fd == NULL) goto loser;
    fd2 = fopen(dbname2, "w+");
    if (fd2 == NULL) goto loser;

    name = sftk_argGetParamValue("name",args);
    if (name) {
	name_len = PORT_Strlen(name);
    }
    lib = sftk_argGetParamValue("library",args);
    if (lib) {
	lib_len = PORT_Strlen(lib);
    }


    /*
     * the following loop takes line separated config files and colapses
     * the lines to a single string, escaping and quoting as necessary.
     */
    /* loop state variables */
    block = NULL;
    skip = PR_FALSE;
    while (fgets(line, sizeof(line), fd) != NULL) { 
	/* If we are processing a block (we haven't hit a blank line yet */
	if (*line != '\n') {
	    /* skip means we are in the middle of a block we are deleting */
	    if (skip) {
		continue;
	    }
	    /* if we haven't found the block yet, check to see if this block
	     * matches our requirements */
	    if (!found && ((name && (PORT_Strncasecmp(line,"name=",5) == 0) &&
		 (PORT_Strncmp(line+5,name,name_len) == 0))  ||
	        (lib && (PORT_Strncasecmp(line,"library=",8) == 0) &&
		 (PORT_Strncmp(line+8,lib,lib_len) == 0)))) {

		/* yup, we don't need to save any more data, */
		PORT_Free(block);
		block=NULL;
		/* we don't need to collect more of this block */
		skip = PR_TRUE;
		/* we don't need to continue searching for the block */
		found =PR_TRUE;
		continue;
	    }
	    /* not our match, continue to collect data in this block */
	    block = sftkdb_DupCat(block,line);
	    continue;
	}
	/* we've collected a block of data that wasn't the module we were
	 * looking for, write it out */
	if (block) {
	    fwrite(block, PORT_Strlen(block), 1, fd2);
	    PORT_Free(block);
	    block = NULL;
	}
	/* If we didn't just delete the this block, keep the blank line */
	if (!skip) {
	    fputs(line,fd2);
	}
	/* we are definately not in a deleted block anymore */
	skip = PR_FALSE;
    } 
    fclose(fd);
    fclose(fd2);
    /* rename dbname2 to dbname */
    if (found) {
	PR_Delete(dbname);
	PR_Rename(dbname2,dbname);
    }
    PORT_Free(dbname2);
    return SECSuccess;

loser:
    if (fd != NULL) {
	fclose(fd);
    }
    if (fd2 != NULL) {
	fclose(fd2);
    }
    if (dbname2) {
	PR_Delete(dbname2);
	PORT_Free(dbname2);
    }
    return SECFailure;
}

/*
 * Add a module to the Data base 
 */
SECStatus
sftkdb_AddSecmodDB(SDBType dbType, const char *appName, 
		   const char *filename, const char *dbname, 
		   char *module, PRBool rw)
{
    FILE *fd = NULL;
    char *block = NULL;
    PRBool libFound = PR_FALSE;

    if ((dbType == SDB_LEGACY) || (dbType == SDB_MULTIACCESS)) {
	return sftkdbCall_AddSecmodDB(appName, filename, dbname, module, rw);
    }

    /* can't write to a read only module */
    if (!rw) {
	return SECFailure;
    }

    /* remove the previous version if it exists */
    (void) sftkdb_DeleteSecmodDB(dbType, appName, filename, dbname, module, rw);

    /* do we really want to use streams here */
    fd = fopen(dbname, "a+");
    if (fd == NULL) {
	return SECFailure;
    }
    module = sftk_argStrip(module);
    while (*module) {
	int count;
	char *keyEnd = PORT_Strchr(module,'=');
	char *value;

	if (PORT_Strncmp(module, "library=", 8) == 0) {
	   libFound=PR_TRUE;
	}
	if (keyEnd == NULL) {
	    block = sftkdb_DupCat(block, module);
	    break;
	}
	value = sftk_argFetchValue(&keyEnd[1], &count);
	block = sftkdb_DupnCat(block, module, keyEnd-module+1);
	if (block == NULL) { goto loser; }
	if (value) {
	    block = sftkdb_DupCat(block, sftk_argStrip(value));
	    PORT_Free(value);
	}
	if (block == NULL) { goto loser; }
	block = sftkdb_DupnCat(block, "\n", 1);
	module = keyEnd + 1 + count;
	module = sftk_argStrip(module);
    }
    if (block) {
	if (!libFound) {
	    fprintf(fd,"library=\n");
	}
	fwrite(block, PORT_Strlen(block), 1, fd);
	fprintf(fd,"\n");
	PORT_Free(block);
	block = NULL;
    }
    fclose(fd);
    return SECSuccess;

loser:
    PORT_Free(block);
    fclose(fd);
    return SECFailure;
}
  
/******************************************************************
 * 
 * Key DB password handling functions
 *
 * These functions manage the key db password (set, reset, initialize, use).
 *
 * The key is managed on 'this side' of the database. All private data is
 * encrypted before it is sent to the database itself. Besides PBE's, the
 * database management code can also mix in various fixed keys so the data
 * in the database is no longer considered 'plain text'.
 */


/* take string password and turn it into a key. The key is dependent
 * on a global salt entry acquired from the database. This salted
 * value will be based to a pkcs5 pbe function before it is used
 * in an actual encryption */
static SECStatus
sftkdb_passwordToKey(SFTKDBHandle *keydb, SECItem *salt,
			const char *pw, SECItem *key)
{
    SHA1Context *cx = NULL;
    SECStatus rv = SECFailure;

    key->data = PORT_Alloc(SHA1_LENGTH);
    if (key->data == NULL) {
	goto loser;
    }
    key->len = SHA1_LENGTH;

    cx = SHA1_NewContext();
    if ( cx == NULL) {
	goto loser;
    }
    SHA1_Begin(cx);
    if (salt  && salt->data ) {
	SHA1_Update(cx, salt->data, salt->len);
    }
    SHA1_Update(cx, (unsigned char *)pw, PORT_Strlen(pw));
    SHA1_End(cx, key->data, &key->len, key->len);
    rv = SECSuccess;
    
loser:
    if (cx) {
	SHA1_DestroyContext(cx, PR_TRUE);
    }
    if (rv != SECSuccess) {
	if (key->data != NULL) {
	    PORT_ZFree(key->data,key->len);
	}
	key->data = NULL;
    }
    return rv;
}

/*
 * Cipher text stored in the database contains 3 elements:
 * 1) an identifier describing the encryption algorithm.
 * 2) an entry specific salt value.
 * 3) the encrypted value.
 *
 * The following data structure represents the encrypted data in a decoded
 * (but still encrypted) form.
 */
typedef struct sftkCipherValueStr sftkCipherValue;
struct sftkCipherValueStr {
    PLArenaPool *arena;
    SECOidTag  alg;
    NSSPKCS5PBEParameter *param;
    SECItem    salt;
    SECItem    value;
};

#define SFTK_CIPHERTEXT_VERSION 3

struct SFTKDBEncryptedDataInfoStr {
    SECAlgorithmID algorithm;
    SECItem encryptedData;
};
typedef struct SFTKDBEncryptedDataInfoStr SFTKDBEncryptedDataInfo;

const SEC_ASN1Template sftkdb_EncryptedDataInfoTemplate[] = {
    { SEC_ASN1_SEQUENCE,
        0, NULL, sizeof(SFTKDBEncryptedDataInfo) },
    { SEC_ASN1_INLINE,
        offsetof(SFTKDBEncryptedDataInfo,algorithm),
        SECOID_AlgorithmIDTemplate },
    { SEC_ASN1_OCTET_STRING,
        offsetof(SFTKDBEncryptedDataInfo,encryptedData) },
    { 0 }
};

/*
 * This parses the cipherText into cipher value. NOTE: cipherValue will point
 * to data in cipherText, if cipherText is freed, cipherValue will be invalid.
 *
 * Use existing NSS data record: (sizes and offsets in bytes)
 *
 *   offset     size  label         Description
 *     0         1    version       Data base version number must be 3
 *     1         1    slen          Length of Salt
 *     2         1    nlen          Length of optional nickname
 *     3        slen  sdata         Salt data
 *   3+slen     nlen  ndata         Optional nickname data
 * 3+nlen+slen   1    olen          Length of algorithm OID
 * 4+nlen+slen  olen  odata         Algorithm OID data.
 * 4+nlen+slen+
 *    olen      rest  vdata         Encrypted data.
 *
 * rest is the rest of the block passed into us.
 */
static SECStatus
sftkdb_decodeCipherText(SECItem *cipherText, sftkCipherValue *cipherValue)
{
    PLArenaPool *arena = NULL;
    SFTKDBEncryptedDataInfo edi;
    SECStatus rv;

    arena = PORT_NewArena(DER_DEFAULT_CHUNKSIZE);
    if (arena == NULL) {
	return SECFailure;
    }
    cipherValue->arena = NULL;
    cipherValue->param = NULL;

    rv = SEC_QuickDERDecodeItem(arena, &edi, sftkdb_EncryptedDataInfoTemplate,
                            cipherText);
    if (rv != SECSuccess) {
	goto loser;
    }
    cipherValue->alg = SECOID_GetAlgorithmTag(&edi.algorithm);
    cipherValue->param = nsspkcs5_AlgidToParam(&edi.algorithm);
    if (cipherValue->param == NULL) {
	goto loser;
    }
    cipherValue->value = edi.encryptedData;
    cipherValue->arena = arena;

    return SECSuccess;
loser:
    if (cipherValue->param) {
	nsspkcs5_DestroyPBEParameter(cipherValue->param);
	cipherValue->param = NULL;
    }
    if (arena) {
	PORT_FreeArena(arena,PR_FALSE);
    }
    return SECFailure;
}



/* 
 * unlike decode, Encode actually allocates a SECItem the caller must free
 * The caller can pass an optional arena to to indicate where to place
 * the resultant cipherText.
 */
static SECStatus
sftkdb_encodeCipherText(PLArenaPool *arena, sftkCipherValue *cipherValue, 
                        SECItem **cipherText)
{
    SFTKDBEncryptedDataInfo edi;
    SECAlgorithmID *algid;
    SECStatus rv;
    PLArenaPool *localArena = NULL;


    localArena = PORT_NewArena(DER_DEFAULT_CHUNKSIZE);
    if (localArena == NULL) {
	return SECFailure;
    }

    algid = nsspkcs5_CreateAlgorithmID(localArena, cipherValue->alg, 
					cipherValue->param);
    if (algid == NULL) {
	rv = SECFailure;
	goto loser;
    }
    rv = SECOID_CopyAlgorithmID(localArena, &edi.algorithm, algid);
    SECOID_DestroyAlgorithmID(algid, PR_TRUE);
    if (rv != SECSuccess) {
	goto loser;
    }
    edi.encryptedData = cipherValue->value;

    *cipherText = SEC_ASN1EncodeItem(arena, NULL, &edi, 
				    sftkdb_EncryptedDataInfoTemplate);
    if (*cipherText == NULL) {
	rv = SECFailure;
    }

loser:
    if (localArena) {
	PORT_FreeArena(localArena,PR_FALSE);
    }

    return rv;
}


/*
 * Use our key to decode a cipherText block from the database.
 *
 * plain text is allocated by nsspkcs5_CipherData and must be freed
 * with SECITEM_FreeItem by the caller.
 */
static SECStatus
sftkdb_decryptAttribute(SECItem *passKey, SECItem *cipherText, SECItem **plain) 
{
    SECStatus rv;
    sftkCipherValue cipherValue;

    /* First get the cipher type */
    rv = sftkdb_decodeCipherText(cipherText, &cipherValue);
    if (rv != SECSuccess) {
	goto loser;
    }

    *plain = nsspkcs5_CipherData(cipherValue.param, passKey, &cipherValue.value, 
				    PR_FALSE, NULL);
    if (*plain == NULL) {
	rv = SECFailure;
	goto loser;
    } 

loser:
    if (cipherValue.param) {
	nsspkcs5_DestroyPBEParameter(cipherValue.param);
    }
    if (cipherValue.arena) {
	PORT_FreeArena(cipherValue.arena,PR_FALSE);
    }
    return rv;
}

#define SALT_LENGTH 20

/*
 * encrypt a block. This function returned the encrypted ciphertext which
 * the caller must free. If the caller provides an arena, cipherText will
 * be allocated out of that arena. This also generated the per entry
 * salt automatically.
 */
static SECStatus
sftkdb_encryptAttribute(PLArenaPool *arena, SECItem *passKey, 
		SECItem *plainText, SECItem **cipherText) 
{
    SECStatus rv;
    sftkCipherValue cipherValue;
    SECItem *cipher = NULL;
    NSSPKCS5PBEParameter *param = NULL;
    unsigned char saltData[SALT_LENGTH];

    cipherValue.alg = SEC_OID_PKCS12_PBE_WITH_SHA1_AND_TRIPLE_DES_CBC;
    cipherValue.salt.len = SALT_LENGTH;
    cipherValue.salt.data = saltData;
    RNG_GenerateGlobalRandomBytes(saltData,SALT_LENGTH);

    param = nsspkcs5_NewParam(cipherValue.alg, &cipherValue.salt, 1);
    if (param == NULL) {
	rv = SECFailure;
	goto loser;
    }
    cipher = nsspkcs5_CipherData(param, passKey, plainText, PR_TRUE, NULL);
    if (cipher == NULL) {
	rv = SECFailure;
	goto loser;
    } 
    cipherValue.value = *cipher;
    cipherValue.param = param;

    rv = sftkdb_encodeCipherText(arena, &cipherValue, cipherText);
    if (rv != SECSuccess) {
	goto loser;
    }

loser:
    if (cipher) {
	SECITEM_FreeItem(cipher, PR_TRUE);
    }
    if (param) {
	nsspkcs5_DestroyPBEParameter(param);
    }
    return rv;
}

/*
 * use the password and the pbe parameters to generate an HMAC for the
 * given plain text data. This is used by sftkdb_verifyAttribute and
 * sftkdb_signAttribute. Signature is returned in signData. The caller
 * must preallocate the space in the secitem.
 */
static SECStatus
sftkdb_pbehash(SECOidTag sigOid, SECItem *passKey, 
	       NSSPKCS5PBEParameter *param,
	       CK_OBJECT_HANDLE objectID, CK_ATTRIBUTE_TYPE attrType,
	       SECItem *plainText, SECItem *signData)
{
    SECStatus rv = SECFailure;
    SECItem *key = NULL;
    HMACContext *hashCx = NULL;
    HASH_HashType hashType	= HASH_AlgNULL;
    const SECHashObject *hashObj;
    unsigned char addressData[DB_ULONG_SIZE];

    hashType = HASH_FromHMACOid(param->encAlg);
    if (hashType == HASH_AlgNULL) {
	PORT_SetError(SEC_ERROR_INVALID_ALGORITHM);
	return SECFailure;
    }

    hashObj = HASH_GetRawHashObject(hashType);
    if (hashObj == NULL) {
	goto loser;
    }

    key = nsspkcs5_ComputeKeyAndIV(param, passKey, NULL, PR_FALSE);
    if (!key) {
	goto loser;
    }

    hashCx = HMAC_Create(hashObj, key->data, key->len, PR_TRUE);
    if (!hashCx) {
	goto loser;
    }
    HMAC_Begin(hashCx);
    /* Tie this value to a particular object. This is most important for
     * the trust attributes, where and attacker could copy a value for
     * 'validCA' from another cert in the database */
    sftk_uLong2DBULong(addressData, objectID);
    HMAC_Update(hashCx, addressData, DB_ULONG_SIZE);
    sftk_uLong2DBULong(addressData, attrType);
    HMAC_Update(hashCx, addressData, DB_ULONG_SIZE);

    HMAC_Update(hashCx, plainText->data, plainText->len);
    rv = HMAC_Finish(hashCx, signData->data, &signData->len, signData->len);

loser:
    if (hashCx) {
	HMAC_Destroy(hashCx, PR_TRUE);
    }
    if (key) {
	SECITEM_FreeItem(key,PR_TRUE);
    }
    return rv;
}

/*
 * Use our key to verify a signText block from the database matches
 * the plainText from the database. The signText is a PKCS 5 v2 pbe.
 * plainText is the plainText of the attribute.
 */
static SECStatus
sftkdb_verifyAttribute(SECItem *passKey, CK_OBJECT_HANDLE objectID, 
	     CK_ATTRIBUTE_TYPE attrType, 
	     SECItem *plainText, SECItem *signText) 
{
    SECStatus rv;
    sftkCipherValue signValue;
    SECItem signature;
    unsigned char signData[HASH_LENGTH_MAX];
    

    /* First get the cipher type */
    rv = sftkdb_decodeCipherText(signText, &signValue);
    if (rv != SECSuccess) {
	goto loser;
    }
    signature.data = signData;
    signature.len = sizeof(signData);

    rv = sftkdb_pbehash(signValue.alg, passKey, signValue.param, 
			objectID, attrType, plainText, &signature);
    if (rv != SECSuccess) {
	goto loser;
    }
    if (SECITEM_CompareItem(&signValue.value,&signature) != 0) {
	PORT_SetError(SEC_ERROR_BAD_SIGNATURE);
	rv = SECFailure;
    }

loser:
    if (signValue.param) {
	nsspkcs5_DestroyPBEParameter(signValue.param);
    }
    if (signValue.arena) {
	PORT_FreeArena(signValue.arena,PR_FALSE);
    }
    return rv;
}

/*
 * Use our key to create a signText block the plain text of an
 * attribute. The signText is a PKCS 5 v2 pbe.
 */
static SECStatus
sftkdb_signAttribute(PLArenaPool *arena, SECItem *passKey, 
	 CK_OBJECT_HANDLE objectID, CK_ATTRIBUTE_TYPE attrType, 
	 SECItem *plainText, SECItem **signature) 
{
    SECStatus rv;
    sftkCipherValue signValue;
    NSSPKCS5PBEParameter *param = NULL;
    unsigned char saltData[HASH_LENGTH_MAX];
    unsigned char signData[HASH_LENGTH_MAX];
    SECOidTag hmacAlg = SEC_OID_HMAC_SHA256; /* hash for authentication */
    SECOidTag prfAlg = SEC_OID_HMAC_SHA256;  /* hash for pb key generation */
    HASH_HashType prfType;
    unsigned int hmacLength;
    unsigned int prfLength;

    /* this code allows us to fetch the lengths and hashes on the fly
     * by simply changing the OID above */
    prfType = HASH_FromHMACOid(prfAlg);
    PORT_Assert(prfType != HASH_AlgNULL);
    prfLength = HASH_GetRawHashObject(prfType)->length;
    PORT_Assert(prfLength <= HASH_LENGTH_MAX);

    hmacLength = HASH_GetRawHashObject(HASH_FromHMACOid(hmacAlg))->length;
    PORT_Assert(hmacLength <= HASH_LENGTH_MAX);

    /* initialize our CipherValue structure */
    signValue.alg = SEC_OID_PKCS5_PBMAC1;
    signValue.salt.len = prfLength;
    signValue.salt.data = saltData;
    signValue.value.data = signData;
    signValue.value.len = hmacLength;
    RNG_GenerateGlobalRandomBytes(saltData,prfLength);

    /* initialize our pkcs5 paramter */
    param = nsspkcs5_NewParam(signValue.alg, &signValue.salt, 1);
    if (param == NULL) {
	rv = SECFailure;
	goto loser;
    }
    param->keyID = pbeBitGenIntegrityKey;
    /* set the PKCS 5 v2 parameters, not extractable from the
     * data passed into nsspkcs5_NewParam */
    param->encAlg = hmacAlg;
    param->hashType = prfType;
    param->keyLen = hmacLength;
    rv = SECOID_SetAlgorithmID(param->poolp, &param->prfAlg, prfAlg, NULL);
    if (rv != SECSuccess) {
	goto loser;
    }


    /* calculate the mac */
    rv = sftkdb_pbehash(signValue.alg, passKey, param, objectID, attrType,
			plainText, &signValue.value);
    if (rv != SECSuccess) {
	goto loser;
    }
    signValue.param = param;

    /* write it out */
    rv = sftkdb_encodeCipherText(arena, &signValue, signature);
    if (rv != SECSuccess) {
	goto loser;
    }

loser:
    if (param) {
	nsspkcs5_DestroyPBEParameter(param);
    }
    return rv;
}


/*
 * stub files for legacy db's to be able to encrypt and decrypt
 * various keys and attributes.
 */
SECStatus
sftkdb_encrypt_stub(PRArenaPool *arena, SDB *sdb, SECItem *plainText,
		    SECItem **cipherText)
{
    SFTKDBHandle *handle = sdb->app_private;
    SECStatus rv;

    if (handle == NULL) {
	return SECFailure;
    }

    /* if we aren't th handle, try the other handle */
    if (handle->type != SFTK_KEYDB_TYPE) {
	handle = handle->peerDB;
    }

    /* not a key handle */
    if (handle == NULL || handle->passwordLock == NULL) {
	return SECFailure;
    }

    PZ_Lock(handle->passwordLock);
    if (handle->passwordKey.data == NULL) {
	PZ_Unlock(handle->passwordLock);
	/* PORT_SetError */
	return SECFailure;
    }

    rv = sftkdb_encryptAttribute(arena, 
	handle->newKey?handle->newKey:&handle->passwordKey, 
	plainText, cipherText);
    PZ_Unlock(handle->passwordLock);

    return rv;
}

/*
 * stub files for legacy db's to be able to encrypt and decrypt
 * various keys and attributes.
 */
SECStatus
sftkdb_decrypt_stub(SDB *sdb, SECItem *cipherText, SECItem **plainText) 
{
    SFTKDBHandle *handle = sdb->app_private;
    SECStatus rv;

    if (handle == NULL) {
	return SECFailure;
    }

    /* if we aren't th handle, try the other handle */
    if (handle->type != SFTK_KEYDB_TYPE) {
	handle = handle->peerDB;
    }

    /* not a key handle */
    if (handle == NULL || handle->passwordLock == NULL) {
	return SECFailure;
    }

    PZ_Lock(handle->passwordLock);
    if (handle->passwordKey.data == NULL) {
	PZ_Unlock(handle->passwordLock);
	/* PORT_SetError */
	return SECFailure;
    }
    rv = sftkdb_decryptAttribute(&handle->passwordKey, cipherText, plainText);
    PZ_Unlock(handle->passwordLock);

    return rv;
}
  
/*
 * safely swith the passed in key for the one caches in the keydb handle
 * 
 * A key attached to the handle tells us the the token is logged in.
 * We can used the key attached to the handle in sftkdb_encryptAttribute 
 *  and sftkdb_decryptAttribute calls.
 */  
static void 
sftkdb_switchKeys(SFTKDBHandle *keydb, SECItem *passKey)
{
    unsigned char *data;
    int len;

    if (keydb->passwordLock == NULL) {
	PORT_Assert(keydb->type != SFTK_KEYDB_TYPE);
	return;
    }

    /* an atomic pointer set would be nice */
    PZ_Lock(keydb->passwordLock);
    data = keydb->passwordKey.data;
    len = keydb->passwordKey.len;
    keydb->passwordKey.data = passKey->data;
    keydb->passwordKey.len = passKey->len;
    passKey->data = data;
    passKey->len = len;
    PZ_Unlock(keydb->passwordLock);
}
 
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
    CKA_SUPPORTED_CMS_ATTRIBUTES, CKA_NSS_URL, CKA_NSS_EMAIL,
    CKA_NSS_SMIME_INFO, CKA_NSS_SMIME_TIMESTAMP,
    CKA_NSS_PKCS8_SALT, CKA_NSS_PASSWORD_CHECK, CKA_NSS_EXPIRES,
    CKA_NSS_KRL, CKA_NSS_PQG_COUNTER, CKA_NSS_PQG_SEED,
    CKA_NSS_PQG_H, CKA_NSS_PQG_SEED_BITS, CKA_NSS_MODULE_SPEC,
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

static CK_RV
sftkdb_GetObjectTemplate(SDB *source, CK_OBJECT_HANDLE id,
		CK_ATTRIBUTE *ptemplate, CK_ULONG *max)
{
    int i,j;
    CK_RV crv;

    if (*max < known_attributes_size) {
	*max = known_attributes_size;
	return CKR_BUFFER_TOO_SMALL;
    }
    for (i=0; i < known_attributes_size; i++) {
	ptemplate[i].type = known_attributes[i];
	ptemplate[i].pValue = NULL;
	ptemplate[i].ulValueLen = 0;
    }

    crv = (*source->sdb_GetAttributeValue)(source, id, 
					ptemplate, known_attributes_size);

    if ((crv != CKR_OK) && (crv != CKR_ATTRIBUTE_TYPE_INVALID)) {
	return crv;
    }

    for (i=0, j=0; i < known_attributes_size; i++, j++) {
	while (i < known_attributes_size && (ptemplate[i].ulValueLen == -1)) {
	    i++;
	}
	if (i >= known_attributes_size) {
	    break;
	}
	/* cheap optimization */
	if (i == j) {
	   continue;
	}
	ptemplate[j] = ptemplate[i];
    }
    *max = j;
    return CKR_OK;
}

#ifdef notdef
static void
dump_attribute(CK_ATTRIBUTE *attr)
{
  unsigned char *buf = attr->pValue;
  int count,i;

  printf("%08x: (%d) ",attr->type, attr->ulValueLen);
  count = attr->ulValueLen;
  if (count > 10) count = 10;
  for (i=0; i < count; i++) {
	printf("%02x",buf[i]);
  }
  printf("\n");
}
#endif


#define MAX_ATTRIBUTES 500
static CK_RV
sftkdb_copyObject(SFTKDBHandle *handle, CK_OBJECT_HANDLE id, SECItem *key)
{
    CK_ATTRIBUTE template[MAX_ATTRIBUTES];
    CK_ATTRIBUTE *ptemplate;
    CK_ULONG max_attributes = MAX_ATTRIBUTES;
    SDB *source = handle->update;
    SDB *target = handle->db;
    int i;
    CK_RV crv;
    PLArenaPool *arena = NULL;

    arena = PORT_NewArena(256);
    if (arena ==  NULL) {
	return CKR_HOST_MEMORY;
    }

    ptemplate = &template[0];
    id &= SFTK_OBJ_ID_MASK;
    crv = sftkdb_GetObjectTemplate(source, id, ptemplate, &max_attributes);
    if (crv == CKR_BUFFER_TOO_SMALL) {
	ptemplate = PORT_ArenaNewArray(arena, CK_ATTRIBUTE, max_attributes);
	if (ptemplate == NULL) {
	    crv = CKR_HOST_MEMORY;
	} else {
            crv = sftkdb_GetObjectTemplate(source, id, 
					   ptemplate, &max_attributes);
	}
    }
    if (crv != CKR_OK) {
	goto loser;
    }

    for (i=0; i < max_attributes; i++) {
	ptemplate[i].pValue = PORT_ArenaAlloc(arena,ptemplate[i].ulValueLen);
	if (ptemplate[i].pValue == NULL) {
	    crv = CKR_HOST_MEMORY;
	    goto loser;
	}
    }
    crv = (*source->sdb_GetAttributeValue)(source, id, 
					   ptemplate, max_attributes);
    if (crv != CKR_OK) {
	goto loser;
    }

    crv = sftkdb_CreateObject(arena, handle, target, &id, 
				ptemplate, max_attributes);

loser:
    if (arena) {
	PORT_FreeArena(arena,PR_TRUE);
    }
    return crv;
}
	

#define MAX_IDS 10
/*
 * update a new database from an old one, now that we have the key
 */
static CK_RV
sftkdb_update(SFTKDBHandle *handle, SECItem *key)
{
    SDBFind *find = NULL;
    CK_ULONG idCount = MAX_IDS;
    CK_OBJECT_HANDLE ids[MAX_IDS];
    CK_RV crv, crv2;
    PRBool inTransaction = PR_FALSE;
    int i;

    if (handle == NULL) {
	return CKR_OK;
    }
    if (handle->update == NULL) {
	return CKR_OK;
    }
    
    /* find all the objects */
    crv = sftkdb_FindObjectsInit(handle, NULL, 0, &find);

    if (crv != CKR_OK) {
	goto loser;
    }
    while ((crv == CKR_OK) && (idCount == MAX_IDS)) {
	crv = sftkdb_FindObjects(handle, find, ids, MAX_IDS, &idCount);
	for (i=0; (crv == CKR_OK) && (i < idCount); i++) {
	    crv = sftkdb_copyObject(handle, ids[i], key);
	}
    }
    crv2 = sftkdb_FindObjectsFinal(handle, find);
    if (crv == CKR_OK) crv = crv2;

loser:
    /* update Meta data - even if we didn't update objects */
    if (handle->type == SFTK_KEYDB_TYPE) {
	SECItem item1, item2;
	unsigned char data1[SDB_MAX_META_DATA_LEN];
	unsigned char data2[SDB_MAX_META_DATA_LEN];

	crv = (*handle->db->sdb_Begin)(handle->db);
	if (crv != CKR_OK) {
	    goto loser2;
	}
	inTransaction = PR_TRUE;
	item1.data = data1;
	item2.data = data2;
	crv = (*handle->update->sdb_GetMetaData)(handle->update, "password",
			&item1, &item2);
	if (crv != CKR_OK) {
	    goto loser2;
	}
	crv = (*handle->db->sdb_PutMetaData)(handle->db, "password", &item1,
						&item2);
	if (crv != CKR_OK) {
	    goto loser2;
	}
	crv = (*handle->db->sdb_Commit)(handle->db);
	inTransaction = PR_FALSE;
    }
loser2:
    if (inTransaction) {
	(*handle->db->sdb_Abort)(handle->db);
    }
    if (handle->update) {
	(*handle->update->sdb_Close)(handle->update);
	handle->update = NULL;
    }
    return crv;
}

/*
 * return success if we have a valid password entry.
 * This is will show up outside of PKCS #11 as CKF_USER_PIN_INIT
 * in the token flags.
 */
SECStatus 
sftkdb_HasPasswordSet(SFTKDBHandle *keydb)
{
    SECItem item1, item2;
    unsigned char data1[SDB_MAX_META_DATA_LEN];
    unsigned char data2[SDB_MAX_META_DATA_LEN];
    CK_RV crv;
    SDB *db;

    if (keydb == NULL) {
	return SECFailure;
    }

    db = GET_SDB(keydb);
    if (db == NULL) {
	return SECFailure;
    }

    item1.data = data1;
    item2.data = data2;
    crv = (*db->sdb_GetMetaData)(db, "password", &item1, &item2);
    return (crv == CKR_OK) ? SECSuccess : SECFailure;
}

#define SFTK_PW_CHECK_STRING "password-check"
#define SFTK_PW_CHECK_LEN 14

/*
 * check if the supplied password is valid
 */
SECStatus  
sftkdb_CheckPassword(SFTKDBHandle *keydb, const char *pw)
{
    SECStatus rv;
    SECItem salt, value;
    unsigned char data1[SDB_MAX_META_DATA_LEN];
    unsigned char data2[SDB_MAX_META_DATA_LEN];
    SECItem key;
    SECItem *result = NULL;
    SDB *db;
    CK_RV crv;

    if (keydb == NULL) {
	return SECFailure;
    }

    db = GET_SDB(keydb);
    if (db == NULL) {
	return SECFailure;
    }

    key.data = NULL;
    key.len = 0;

    if (pw == NULL) pw="";

    /* get the entry from the database */
    salt.data = data1;
    value.data = data2;
    crv = (*db->sdb_GetMetaData)(db, "password", &salt, &value);
    if (crv != CKR_OK) {
	rv = SECFailure;
	goto loser;
    }

    /* get our intermediate key based on the entry salt value */
    rv = sftkdb_passwordToKey(keydb, &salt, pw, &key);
    if (rv != SECSuccess) {
	goto loser;
    }

    /* decrypt the entry value */
    rv = sftkdb_decryptAttribute(&key, &value, &result);
    if (rv != SECSuccess) {
	goto loser;
    }

    /* if it's what we expect, update our key in the database handle and
     * return Success */
    if ((result->len == SFTK_PW_CHECK_LEN) &&
      PORT_Memcmp(result->data, SFTK_PW_CHECK_STRING, SFTK_PW_CHECK_LEN) == 0){
	/* load the keys, so the keydb can parse it's key set */
	sftkdb_switchKeys(keydb, &key);
	if (keydb->update) {
	    /* update the peer certdb if it exists */
	    if (keydb->peerDB) {
		sftkdb_update(keydb->peerDB, &key);
	    }
	    sftkdb_update(keydb, &key);
	}
    } else {
        rv = SECFailure;
	/*PORT_SetError( bad password); */
    }

loser:
    if (key.data) {
	PORT_ZFree(key.data,key.len);
    }
    if (result) {
	SECITEM_FreeItem(result,PR_TRUE);
    }
    return rv;
}

/*
 * return Success if the there is a cached password key.
 */
SECStatus
sftkdb_PWCached(SFTKDBHandle *keydb)
{
    return keydb->passwordKey.data ? SECSuccess : SECFailure;
}

static SECStatus
sftk_convertPrivateAttributes(SFTKDBHandle *keydb, CK_OBJECT_HANDLE id, 
	                      SECItem *newKey)
{
    CK_RV crv = CKR_OK;
    CK_RV crv2;
    CK_ATTRIBUTE *first, *last;
    CK_ATTRIBUTE privAttrs[] = {
	{CKA_VALUE, NULL, 0},
	{CKA_PRIVATE_EXPONENT, NULL, 0},
	{CKA_PRIME_1, NULL, 0},
	{CKA_PRIME_2, NULL, 0},
	{CKA_EXPONENT_1, NULL, 0},
	{CKA_EXPONENT_2, NULL, 0},
	{CKA_COEFFICIENT, NULL, 0} };
    CK_ULONG privAttrCount = sizeof(privAttrs)/sizeof(CK_ATTRIBUTE);
    PLArenaPool *arena = NULL;
    int i, count;


    /* get a new arena to simplify cleanup */
    arena = PORT_NewArena(1024);
    if (!arena) {
	return SECFailure;
    }

    /*
     * STEP 1. Read the old attributes in the clear.
     */

    /* Get the attribute sizes.
     *  ignore the error code, we will have unknown attributes here */
    crv2 = sftkdb_GetAttributeValue(keydb, id, privAttrs, privAttrCount);

    /*
     * find the valid block of attributes and fill allocate space for
     * their data */
    first = last = NULL;
    for (i=0; i < privAttrCount; i++) {
         /* find the block of attributes that are appropriate for this 
          * objects. There should only be once contiguous block, if not 
          * there's an error.
          *
          * find the first and last good entry.
          */
	if ((privAttrs[i].ulValueLen == -1) || (privAttrs[i].ulValueLen == 0)){
	    if (!first) continue;
	    if (!last) {
		/* previous entry was last good entry */
		last= &privAttrs[i-1];
	    }
	    continue;
	}
	if (!first) {
	    first = &privAttrs[i];
	}
	if (last) {
	   /* OOPS, we've found another good entry beyond the end of the
	    * last good entry, we need to fail here. */
	   crv = CKR_GENERAL_ERROR;
	   break;
	}
        privAttrs[i].pValue = PORT_ArenaAlloc(arena,privAttrs[i].ulValueLen);
	if (privAttrs[i].pValue == NULL) {
	    crv = CKR_HOST_MEMORY;
	    break;
	}
    }
    if (first == NULL) {
	/* no valid entries found, return error based on crv2 */
	/* set error */
	goto loser;
    }
    if (last == NULL) {
	last = &privAttrs[privAttrCount-1];
    }
    if (crv != CKR_OK) {
        /* set error */
	goto loser;
    }
    /* read the attributes */
    count = (last-first)+1;
    crv = sftkdb_GetAttributeValue(keydb, id, first, count);
    if (crv != CKR_OK) {
        /* set error */
	goto loser;
    }


    /*
     * STEP 2: read the encrypt the attributes with the new key.
     */
    for (i=0; i < count; i++) {
	SECItem plainText;
	SECItem *result;
	SECStatus rv;

	plainText.data = first[i].pValue;
	plainText.len = first[i].ulValueLen;
    	rv = sftkdb_encryptAttribute(arena, newKey, &plainText, &result);
	if (rv != SECSuccess) {
	   goto loser;
	}
	first[i].pValue = result->data;
	first[i].ulValueLen = result->len;
	/* clear our sensitive data out */
	PORT_Memset(plainText.data, 0, plainText.len);
    }


    /*
     * STEP 3: write the newly encrypted attributes out directly
     */
    id &= SFTK_OBJ_ID_MASK;
    keydb->newKey = newKey;
    crv = (*keydb->db->sdb_SetAttributeValue)(keydb->db, id, first, count);
    keydb->newKey = NULL;
    if (crv != CKR_OK) {
        /* set error */
	goto loser;
    }

    /* free up our mess */
    /* NOTE: at this point we know we've cleared out any unencrypted data */
    PORT_FreeArena(arena, PR_FALSE);
    return SECSuccess;

loser:
    /* there may be unencrypted data, clear it out down */
    PORT_FreeArena(arena, PR_TRUE);
    return SECFailure;
}


/*
 * must be called with the old key active.
 */
SECStatus 
sftkdb_convertPrivateObjects(SFTKDBHandle *keydb, SECItem *newKey)
{
    SDBFind *find = NULL;
    CK_ULONG idCount = MAX_IDS;
    CK_OBJECT_HANDLE ids[MAX_IDS];
    CK_RV crv, crv2;
    int i;

    /* find all the private objects */
    crv = sftkdb_FindObjectsInit(keydb, NULL, 0, &find);

    if (crv != CKR_OK) {
	/* set error */
	return SECFailure;
    }
    while ((crv == CKR_OK) && (idCount == MAX_IDS)) {
	crv = sftkdb_FindObjects(keydb, find, ids, MAX_IDS, &idCount);
	for (i=0; (crv == CKR_OK) && (i < idCount); i++) {
	    SECStatus rv;
	    rv = sftk_convertPrivateAttributes(keydb, ids[i], newKey);
	    if (rv != SECSuccess) {
		crv = CKR_GENERAL_ERROR;
		/* error should be already set here */
	    }
	}
    }
    crv2 = sftkdb_FindObjectsFinal(keydb, find);
    if (crv == CKR_OK) crv = crv2;
    if (crv != CKR_OK) {
	/* set error */
	return SECFailure;
    }
    return SECSuccess;
}


/*
 * change the database password.
 */
SECStatus
sftkdb_ChangePassword(SFTKDBHandle *keydb, char *oldPin, char *newPin)
{
    SECStatus rv = SECSuccess;
    SECItem plainText;
    SECItem newKey;
    SECItem *result = NULL;
    SECItem salt, value;
    unsigned char data1[SDB_MAX_META_DATA_LEN];
    unsigned char data2[SDB_MAX_META_DATA_LEN];
    CK_RV crv;
    SDB *db;

    if (keydb == NULL) {
	return SECFailure;
    }

    db = GET_SDB(keydb);
    if (db == NULL) {
	return SECFailure;
    }

    newKey.data = NULL;

    /* make sure we have a valid old pin */
    crv = (*keydb->db->sdb_Begin)(keydb->db);
    if (crv != CKR_OK) {
	rv = SECFailure;
	goto loser;
    }
    salt.data = data1;
    value.data = data2;
    crv = (*db->sdb_GetMetaData)(db, "password", &salt, &value);
    if (crv == CKR_OK) {
	rv = sftkdb_CheckPassword(keydb, oldPin);
	if (rv == SECFailure) {
	    goto loser;
	}
    } else {
	salt.len = SALT_LENGTH;
    	RNG_GenerateGlobalRandomBytes(salt.data,salt.len);
    }

    rv = sftkdb_passwordToKey(keydb, &salt, newPin, &newKey);
    if (rv != SECSuccess) {
	goto loser;
    }


    /*
     * convert encrypted entries here.
     */
    rv = sftkdb_convertPrivateObjects(keydb, &newKey);
    if (rv != SECSuccess) {
	goto loser;
    }


    plainText.data = (unsigned char *)SFTK_PW_CHECK_STRING;
    plainText.len = SFTK_PW_CHECK_LEN;

    rv = sftkdb_encryptAttribute(NULL, &newKey, &plainText, &result);
    if (rv != SECSuccess) {
	goto loser;
    }
    value.data = result->data;
    value.len = result->len;
    crv = (*keydb->db->sdb_PutMetaData)(keydb->db, "password", &salt, &value);
    if (crv != CKR_OK) {
	rv = SECFailure;
	goto loser;
    }
    crv = (*keydb->db->sdb_Commit)(keydb->db);
    if (crv != CKR_OK) {
	rv = SECFailure;
	goto loser;
    }

    keydb->newKey = NULL;

    sftkdb_switchKeys(keydb, &newKey);

loser:
    if (newKey.data) {
	PORT_ZFree(newKey.data,newKey.len);
    }
    if (result) {
	SECITEM_FreeItem(result, PR_FALSE);
    }
    if (rv != SECSuccess) {
        (*keydb->db->sdb_Abort)(keydb->db);
    }
    
    return rv;
}

/*
 * loose our cached password
 */
SECStatus
sftkdb_ClearPassword(SFTKDBHandle *keydb)
{
    SECItem oldKey;
    oldKey.data = NULL;
    oldKey.len = 0;
    sftkdb_switchKeys(keydb, &oldKey);
    if (oldKey.data) {
	PORT_ZFree(oldKey.data, oldKey.len);
    }
    return SECSuccess;
}

/******************************************************************
 * DB handle managing functions.
 * 
 * These functions are called by softoken to initialize, acquire,
 * and release database handles.
 */

/* release a database handle */
void
sftk_freeDB(SFTKDBHandle *handle)
{
    PRInt32 ref;

    if (!handle) return;
    ref = PR_AtomicDecrement(&handle->ref);
    if (ref == 0) {
	sftkdb_CloseDB(handle);
    }
    return;
}


/*
 * acquire a database handle for a certificate db  
 * (database for public objects) 
 */
SFTKDBHandle *
sftk_getCertDB(SFTKSlot *slot)
{
    SFTKDBHandle *dbHandle;

    PZ_Lock(slot->slotLock);
    dbHandle = slot->certDB;
    if (dbHandle) {
        PR_AtomicIncrement(&dbHandle->ref);
    }
    PZ_Unlock(slot->slotLock);
    return dbHandle;
}

/*
 * acquire a database handle for a key database 
 * (database for private objects)
 */
SFTKDBHandle *
sftk_getKeyDB(SFTKSlot *slot)
{
    SFTKDBHandle *dbHandle;

    PZ_Lock(slot->slotLock);
    dbHandle = slot->keyDB;
    if (dbHandle) {
        PR_AtomicIncrement(&dbHandle->ref);
    }
    PZ_Unlock(slot->slotLock);
    return dbHandle;
}

/*
 * acquire the database for a specific object. NOTE: objectID must point
 * to a Token object!
 */
SFTKDBHandle *
sftk_getDBForTokenObject(SFTKSlot *slot, CK_OBJECT_HANDLE objectID)
{
    SFTKDBHandle *dbHandle;

    PZ_Lock(slot->slotLock);
    dbHandle = objectID & SFTK_KEYDB_TYPE ? slot->keyDB : slot->certDB;
    if (dbHandle) {
        PR_AtomicIncrement(&dbHandle->ref);
    }
    PZ_Unlock(slot->slotLock);
    return dbHandle;
}

/*
 * initialize a new database handle
 */
static SFTKDBHandle *
sftk_NewDBHandle(SDB *sdb, int type)
{
   SFTKDBHandle *handle = PORT_New(SFTKDBHandle);
   handle->ref = 1;
   handle->db = sdb;
   handle->update = NULL;
   handle->peerDB = NULL;
   handle->newKey = NULL;
   handle->type = type;
   handle->passwordKey.data = NULL;
   handle->passwordKey.len = 0;
   handle->passwordLock = NULL;
   if (type == SFTK_KEYDB_TYPE) {
	handle->passwordLock = PZ_NewLock();
   }
   sdb->app_private = handle;
   return handle;
}

/*
 * reset the key database to it's uninitialized state. This call
 * will clear all the key entried.
 */
SECStatus
sftkdb_ResetKeyDB(SFTKDBHandle *handle)
{
    CK_RV crv;

    /* only rest the key db */
    if (handle->type != SFTK_KEYDB_TYPE) {
	return SECFailure;
    }
    crv = sftkdb_ResetDB(handle);
    if (crv != CKR_OK) {
	/* set error */
	return SECFailure;
    }
    return SECSuccess;
}

static PRBool
sftk_oldVersionExists(const char *dir, int version)
{
    int i;
    PRStatus exists = PR_FAILURE;
    char *file = NULL;

    for (i=version; i > 1 ; i--) {
	file = PR_smprintf("%s%d.db",dir,i);
	if (file == NULL) {
	    continue;
	}
	exists = PR_Access(file, PR_ACCESS_EXISTS);
	PR_smprintf_free(file);
	if (exists == PR_SUCCESS) {
	    return PR_TRUE;
	}
    }
    return PR_FALSE;
}

static PRBool
sftk_hasLegacyDB(const char *confdir, const char *certPrefix, 
		 const char *keyPrefix, int certVersion, int keyVersion)
{
    char *dir;
    PRBool exists;

    dir= PR_smprintf("%s/%scert", confdir, certPrefix);
    if (dir == NULL) {
	return PR_FALSE;
    }

    exists = sftk_oldVersionExists(dir, certVersion);
    PR_smprintf_free(dir);
    if (exists) {
	return PR_TRUE;
    }

    dir= PR_smprintf("%s/%skey", confdir, keyPrefix);
    if (dir == NULL) {
	return PR_FALSE;
    }

    exists = sftk_oldVersionExists(dir, keyVersion);
    PR_smprintf_free(dir);
    return exists;
}

/*
 * initialize certificate and key database handles as a pair.
 *
 * This function figures out what type of database we are opening and
 * calls the appropriate low level function to open the database.
 * It also figures out whether or not to setup up automatic update.
 */
CK_RV 
sftk_DBInit(const char *configdir, const char *certPrefix,
                const char *keyPrefix, PRBool readOnly, PRBool noCertDB,
                PRBool noKeyDB, PRBool forceOpen,
                SFTKDBHandle **certDB, SFTKDBHandle **keyDB)
{
    const char *confdir;
    SDBType dbType;
    char *appName = NULL;
    SDB *keySDB, *certSDB;
    CK_RV crv = CKR_OK;
    int flags = SDB_RDONLY;
    PRBool newInit = PR_FALSE;
    PRBool needUpdate = PR_FALSE;

    if (!readOnly) {
	flags = SDB_CREATE;
    }

    *certDB = NULL;
    *keyDB = NULL;

    if (noKeyDB && noCertDB) {
	return CKR_OK;
    }
    confdir = sftk_EvaluateConfigDir(configdir, &dbType, &appName);

    /*
     * now initialize the appropriate database
     */
    switch (dbType) {
    case SDB_LEGACY:
	crv = sftkdbCall_open(confdir, certPrefix, keyPrefix, 8, 3, flags,
		noCertDB? NULL : &certSDB, noKeyDB ? NULL: &keySDB);
	break;
    case SDB_MULTIACCESS:
	crv = sftkdbCall_open(configdir, certPrefix, keyPrefix, 8, 3, flags,
		noCertDB? NULL : &certSDB, noKeyDB ? NULL: &keySDB);
	break;
    case SDB_SQL:
    case SDB_EXTERN: /* SHOULD open a loadable db */
	crv = s_open(confdir, certPrefix, keyPrefix, 9, 4, flags, 
		noCertDB? NULL : &certSDB, noKeyDB ? NULL : &keySDB, &newInit);

        /*
	 * if we failed to open the DB's read only, use the old ones if
	 * the exists.
	 */
	if (crv != CKR_OK && (flags == SDB_RDONLY)) {
	    if (sftk_hasLegacyDB(confdir, certPrefix, keyPrefix, 8, 3)) {
	    /* we have legacy databases, if we failed to open the new format 
	     * DB's read only, just use the legacy ones */
		crv = sftkdbCall_open(confdir, certPrefix, 
			keyPrefix, 8, 3, flags, noCertDB? NULL : &certSDB,
			noKeyDB ? NULL : &keySDB);
	    }
	} else if (newInit && crv == CKR_OK) {
	    /* if the new format DB was also a newly created DB, and we
	     * succeeded, then need to update that new database with data
	     * from the existing legacy DB */
	    if (sftk_hasLegacyDB(confdir, certPrefix, keyPrefix, 8, 3)) {
		needUpdate = 1;
	    }
	}
	break;
    default:
	crv = CKR_GENERAL_ERROR; /* can't happen, EvaluationConfigDir MUST 
				  * return one of the types we already 
				  * specified. */
    }
    if (crv != CKR_OK) {
	goto loser;
    }
    if (!noCertDB) {
	*certDB = sftk_NewDBHandle(certSDB, SFTK_CERTDB_TYPE);
    } else {
	*certDB = NULL;
    }
    if (!noKeyDB) {
	*keyDB = sftk_NewDBHandle(keySDB, SFTK_KEYDB_TYPE);
    } else {
	*keyDB = NULL;
    }

    /* link them together */
    if (*certDB) {
	(*certDB)->peerDB = *keyDB;
    }
    if (*keyDB) {
	(*keyDB)->peerDB = *certDB;
    }

    if (needUpdate) {
	SDB *updateCert = NULL;
	SDB *updateKey = NULL;
	CK_RV crv2;

	crv2 = sftkdbCall_open(confdir, certPrefix, keyPrefix, 8, 3, flags,
		noCertDB ? NULL : &updateCert, noKeyDB ? NULL : &updateKey);
	if (crv2 == CKR_OK) {
	    if (*certDB) {
		(*certDB)->update = updateCert;
		updateCert->app_private = (*certDB);
	    }
	    if (*keyDB) {
		(*keyDB)->update = updateKey;
		updateKey->app_private = (*keyDB);
	    } else {
		/* we don't have a key DB, update the certificate DB now */
		sftkdb_update(*certDB, NULL);
	    }
	}
    }
loser:
    if (appName) {
	PORT_Free(appName);
    }
   return forceOpen ? CKR_OK : crv;
}

CK_RV 
sftkdb_Shutdown(void)
{
  s_shutdown();
  sftkdbCall_Shutdown();
  return CKR_OK;
}

