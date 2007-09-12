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
 * Portions created by the Initial Developer are Copyright (C) 1994-2007
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
#include "sftkdbti.h"
#include "pkcs11t.h"
#include "pkcs11i.h"
#include "sdb.h"
#include "prprf.h" 
#include "secmodt.h"
#include "pratom.h"
#include "lgglue.h"
#include "sftkpars.h"
#include "secerr.h"

/*
 * We want all databases to have the same binary representation independent of
 * endianness or length of the host architecture. In general PKCS #11 attributes
 * are endian/length independent except those attributes that pass CK_ULONG.
 *
 * The following functions fixes up the CK_ULONG type attributes so that the data
 * base sees a machine independent view. CK_ULONGs are stored as 4 byte network
 * byte order values (big endian).
 */
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
void
sftk_ULong2SDBULong(unsigned char *data, CK_ULONG value)
{ 
    int i;

    for (i=0; i < SDB_ULONG_SIZE; i++) {
	data[i] = (value >> (SDB_ULONG_SIZE-1-i)*BBP) & 0xff;
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
    data = (unsigned char *)PORT_Alloc(SDB_ULONG_SIZE*ulongCount);
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
		sftk_ULong2SDBULong(data, value);
		ntemplate[i].pValue = data;
		ntemplate[i].ulValueLen = SDB_ULONG_SIZE;
		data += SDB_ULONG_SIZE;
	    }
	}
    }
    return ntemplate;
}


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

    db = SFTK_GET_SDB(keyHandle);

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
CK_RV
sftkdb_PutAttributeSignature(SFTKDBHandle *handle, SDB *keyTarget, 
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
	((SFTK_GET_SDB(keyHandle)->sdb_flags & SDB_HAS_META) == 0)  ||
	(keyHandle->passwordKey.data == NULL)) {
	checkSig = PR_FALSE;
    }

    for (i=0; i < count; i++) {
	CK_ULONG length = template[i].ulValueLen;
	template[i].ulValueLen = ntemplate[i].ulValueLen;
	/* fixup ulongs */
	if (ntemplate[i].ulValueLen == SDB_ULONG_SIZE) {
	    if (sftkdb_isULONGAttribute(template[i].type)) {
		if (template[i].pValue) {
		    CK_ULONG value = 0;
		    unsigned char *data;

		    data = (unsigned char *)ntemplate[i].pValue;
		    for (j=0; j < SDB_ULONG_SIZE; j++) {
			value |= (((CK_ULONG)data[j]) << (SDB_ULONG_SIZE-1-j)*BBP);
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
	    rv = sftkdb_DecryptAttribute(&handle->passwordKey, 
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

	    rv = sftkdb_VerifyAttribute(&keyHandle->passwordKey, 
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
	    rv = sftkdb_SignAttribute(arena, &keyHandle->passwordKey, 
				objectID, template[i].type,
				&plainText, &signText);
	    PZ_Unlock(keyHandle->passwordLock);
	    if (rv != SECSuccess) {
		return CKR_GENERAL_ERROR; /* better error code here? */
	    }
	    rv = sftkdb_PutAttributeSignature(handle, keyTarget, 
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

		tp->pValue = PORT_ArenaAlloc(arena, SDB_ULONG_SIZE);
		data = (unsigned char *)tp->pValue;
		if (data == NULL) {
		    *crv = CKR_HOST_MEMORY;
		    break;
		}
		sftk_ULong2SDBULong(data, value);
		tp->ulValueLen = SDB_ULONG_SIZE;
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
		rv = sftkdb_EncryptAttribute(arena, &handle->passwordKey, 
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
    db = SFTK_GET_SDB(handle);

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
    db = SFTK_GET_SDB(handle);

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
    db = SFTK_GET_SDB(handle);

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
    db = SFTK_GET_SDB(handle);
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

    db = SFTK_GET_SDB(handle);
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

    db = SFTK_GET_SDB(handle);
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
    db = SFTK_GET_SDB(handle);
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
    db = SFTK_GET_SDB(handle);
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
    db = SFTK_GET_SDB(handle);
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
    db = SFTK_GET_SDB(handle);
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
    db = SFTK_GET_SDB(handle);
    if (db) {
	crv = (db->sdb_Abort)(db);
    }
    return crv;
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
CK_RV
sftkdb_Update(SFTKDBHandle *handle, SECItem *key)
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
		sftkdb_Update(*certDB, NULL);
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

