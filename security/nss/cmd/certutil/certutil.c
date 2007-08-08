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
 *   Dr Vipul Gupta <vipul.gupta@sun.com>, Sun Microsystems Laboratories
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
** certutil.c
**
** utility for managing certificates and the cert database
**
*/
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#if defined(WIN32)
#include "fcntl.h"
#include "io.h"
#endif

#include "secutil.h"

#if defined(XP_UNIX)
#include <unistd.h>
#endif

#include "nspr.h"
#include "prtypes.h"
#include "prtime.h"
#include "prlong.h"

#include "pk11func.h"
#include "secasn1.h"
#include "cert.h"
#include "cryptohi.h"
#include "secoid.h"
#include "certdb.h"
#include "nss.h"

#define MIN_KEY_BITS		512
/* MAX_KEY_BITS should agree with MAX_RSA_MODULUS in freebl */
#define MAX_KEY_BITS		8192
#define DEFAULT_KEY_BITS	1024

#define GEN_BREAK(e) rv=e; break;


extern SECKEYPrivateKey *CERTUTIL_GeneratePrivateKey(KeyType keytype,
						     PK11SlotInfo *slot, 
                                                     int rsasize,
						     int publicExponent,
						     char *noise,
						     SECKEYPublicKey **pubkeyp,
						     char *pqgFile,
                                                     secuPWData *pwdata);

char *progName;

extern SECStatus
AddExtensions(void *, const char *, const char *, PRBool, PRBool,
              PRBool, PRBool, PRBool, PRBool);

static CERTCertificateRequest *
GetCertRequest(PRFileDesc *inFile, PRBool ascii)
{
    CERTCertificateRequest *certReq = NULL;
    CERTSignedData signedData;
    PRArenaPool *arena = NULL;
    SECItem reqDER;
    SECStatus rv;

    reqDER.data = NULL;
    do {
	arena = PORT_NewArena(DER_DEFAULT_CHUNKSIZE);
	if (arena == NULL) {
	    GEN_BREAK (SECFailure);
	}
	
 	rv = SECU_ReadDERFromFile(&reqDER, inFile, ascii);
	if (rv) {
	    break;
	}
        certReq = (CERTCertificateRequest*) PORT_ArenaZAlloc
		  (arena, sizeof(CERTCertificateRequest));
        if (!certReq) { 
	    GEN_BREAK(SECFailure);
	}
	certReq->arena = arena;

	/* Since cert request is a signed data, must decode to get the inner
	   data
	 */
	PORT_Memset(&signedData, 0, sizeof(signedData));
	rv = SEC_ASN1DecodeItem(arena, &signedData, 
		SEC_ASN1_GET(CERT_SignedDataTemplate), &reqDER);
	if (rv) {
	    break;
	}
	rv = SEC_ASN1DecodeItem(arena, certReq, 
		SEC_ASN1_GET(CERT_CertificateRequestTemplate), &signedData.data);
	if (rv) {
	    break;
	}
   	rv = CERT_VerifySignedDataWithPublicKeyInfo(&signedData, 
		&certReq->subjectPublicKeyInfo, NULL /* wincx */);
   } while (0);

   if (reqDER.data) {
   	SECITEM_FreeItem(&reqDER, PR_FALSE);
   }

   if (rv) {
   	SECU_PrintError(progName, "bad certificate request\n");
   	if (arena) {
   	    PORT_FreeArena(arena, PR_FALSE);
   	}
   	certReq = NULL;
   }

   return certReq;
}

static SECStatus
AddCert(PK11SlotInfo *slot, CERTCertDBHandle *handle, char *name, char *trusts, 
        PRFileDesc *inFile, PRBool ascii, PRBool emailcert, void *pwdata)
{
    CERTCertTrust *trust = NULL;
    CERTCertificate *cert = NULL;
    SECItem certDER;
    SECStatus rv;

    certDER.data = NULL;
    do {
	/* Read in the entire file specified with the -i argument */
	rv = SECU_ReadDERFromFile(&certDER, inFile, ascii);
	if (rv != SECSuccess) {
	    SECU_PrintError(progName, "unable to read input file");
	    break;
	}

	/* Read in an ASCII cert and return a CERTCertificate */
	cert = CERT_DecodeCertFromPackage((char *)certDER.data, certDER.len);
	if (!cert) {
	    SECU_PrintError(progName, "could not obtain certificate from file"); 
	    GEN_BREAK(SECFailure);
	}

	/* Create a cert trust to pass to SEC_AddPermCertificate */
	trust = (CERTCertTrust *)PORT_ZAlloc(sizeof(CERTCertTrust));
	if (!trust) {
	    SECU_PrintError(progName, "unable to allocate cert trust");
	    GEN_BREAK(SECFailure);
	}

	rv = CERT_DecodeTrustString(trust, trusts);
	if (rv) {
	    SECU_PrintError(progName, "unable to decode trust string");
	    GEN_BREAK(SECFailure);
	}

	if (!PK11_IsFriendly(slot)) {
	    rv = PK11_Authenticate(slot, PR_TRUE, pwdata);
	    if (rv != SECSuccess) {
		SECU_PrintError(progName, "could not authenticate to token or database");
		GEN_BREAK(SECFailure);
	    }
	}

	rv =  PK11_ImportCert(slot, cert, CK_INVALID_HANDLE, name, PR_FALSE);
	if (rv != SECSuccess) {
	    SECU_PrintError(progName, "could not add certificate to token or database");
	    GEN_BREAK(SECFailure);
	}

	rv = CERT_ChangeCertTrust(handle, cert, trust);
	if (rv != SECSuccess) {
	    SECU_PrintError(progName, "could not change trust on certificate");
	    GEN_BREAK(SECFailure);
	}

	if ( emailcert ) {
	    CERT_SaveSMimeProfile(cert, NULL, pwdata);
	}

    } while (0);

    CERT_DestroyCertificate (cert);
    PORT_Free(trust);
    PORT_Free(certDER.data);

    return rv;
}

static SECStatus
CertReq(SECKEYPrivateKey *privk, SECKEYPublicKey *pubk, KeyType keyType,
        SECOidTag hashAlgTag, CERTName *subject, char *phone, int ascii, 
	const char *emailAddrs, const char *dnsNames,
        PRBool	keyUsage, 
	PRBool  extKeyUsage,
	PRBool  basicConstraint, 
	PRBool  authKeyID,
	PRBool  crlDistPoints, 
	PRBool  nscpCertType,
        PRFileDesc *outFile)
{
    CERTSubjectPublicKeyInfo *spki;
    CERTCertificateRequest *cr;
    SECItem *encoding;
    SECOidTag signAlgTag;
    SECItem result;
    SECStatus rv;
    PRArenaPool *arena;
    PRInt32 numBytes;
    void *extHandle;

    /* Create info about public key */
    spki = SECKEY_CreateSubjectPublicKeyInfo(pubk);
    if (!spki) {
	SECU_PrintError(progName, "unable to create subject public key");
	return SECFailure;
    }
    
    /* Generate certificate request */
    cr = CERT_CreateCertificateRequest(subject, spki, NULL);
    if (!cr) {
	SECU_PrintError(progName, "unable to make certificate request");
	return SECFailure;
    }

    arena = PORT_NewArena(DER_DEFAULT_CHUNKSIZE);
    if ( !arena ) {
	SECU_PrintError(progName, "out of memory");
	return SECFailure;
    }
    
    extHandle = CERT_StartCertificateRequestAttributes(cr);
    if (extHandle == NULL) {
        PORT_FreeArena (arena, PR_FALSE);
	return SECFailure;
    }
    if (AddExtensions(extHandle, emailAddrs, dnsNames, keyUsage, extKeyUsage,
                      basicConstraint, authKeyID, crlDistPoints, nscpCertType)
                  != SECSuccess) {
        PORT_FreeArena (arena, PR_FALSE);
        return SECFailure;
    }
    CERT_FinishExtensions(extHandle);
    CERT_FinishCertificateRequestAttributes(cr);

    /* Der encode the request */
    encoding = SEC_ASN1EncodeItem(arena, NULL, cr,
		  SEC_ASN1_GET(CERT_CertificateRequestTemplate));
    if (encoding == NULL) {
	SECU_PrintError(progName, "der encoding of request failed");
	return SECFailure;
    }

    /* Sign the request */
    signAlgTag = SEC_GetSignatureAlgorithmOidTag(keyType, hashAlgTag);
    if (signAlgTag == SEC_OID_UNKNOWN) {
	SECU_PrintError(progName, "unknown Key or Hash type");
	return SECFailure;
    }
    rv = SEC_DerSignData(arena, &result, encoding->data, encoding->len, 
			 privk, signAlgTag);
    if (rv) {
	SECU_PrintError(progName, "signing of data failed");
	return SECFailure;
    }

    /* Encode request in specified format */
    if (ascii) {
	char *obuf;
	char *name, *email, *org, *state, *country;
	SECItem *it;
	int total;

	it = &result;

	obuf = BTOA_ConvertItemToAscii(it);
	total = PL_strlen(obuf);

	name = CERT_GetCommonName(subject);
	if (!name) {
	    name = strdup("(not specified)");
	}

	if (!phone)
	    phone = strdup("(not specified)");

	email = CERT_GetCertEmailAddress(subject);
	if (!email)
	    email = strdup("(not specified)");

	org = CERT_GetOrgName(subject);
	if (!org)
	    org = strdup("(not specified)");

	state = CERT_GetStateName(subject);
	if (!state)
	    state = strdup("(not specified)");

	country = CERT_GetCountryName(subject);
	if (!country)
	    country = strdup("(not specified)");

	PR_fprintf(outFile, 
	           "\nCertificate request generated by Netscape certutil\n");
	PR_fprintf(outFile, "Phone: %s\n\n", phone);
	PR_fprintf(outFile, "Common Name: %s\n", name);
	PR_fprintf(outFile, "Email: %s\n", email);
	PR_fprintf(outFile, "Organization: %s\n", org);
	PR_fprintf(outFile, "State: %s\n", state);
	PR_fprintf(outFile, "Country: %s\n\n", country);

	PR_fprintf(outFile, "%s\n", NS_CERTREQ_HEADER);
	numBytes = PR_Write(outFile, obuf, total);
	if (numBytes != total) {
	    SECU_PrintSystemError(progName, "write error");
	    return SECFailure;
	}
	PR_fprintf(outFile, "\n%s\n", NS_CERTREQ_TRAILER);
    } else {
	numBytes = PR_Write(outFile, result.data, result.len);
	if (numBytes != (int)result.len) {
	    SECU_PrintSystemError(progName, "write error");
	    return SECFailure;
	}
    }
    return SECSuccess;
}

static SECStatus 
ChangeTrustAttributes(CERTCertDBHandle *handle, char *name, char *trusts)
{
    SECStatus rv;
    CERTCertificate *cert;
    CERTCertTrust *trust;
    
    cert = CERT_FindCertByNicknameOrEmailAddr(handle, name);
    if (!cert) {
	SECU_PrintError(progName, "could not find certificate named \"%s\"",
			name);
	return SECFailure;
    }

    trust = (CERTCertTrust *)PORT_ZAlloc(sizeof(CERTCertTrust));
    if (!trust) {
	SECU_PrintError(progName, "unable to allocate cert trust");
	return SECFailure;
    }

    /* This function only decodes these characters: pPwcTCu, */
    rv = CERT_DecodeTrustString(trust, trusts);
    if (rv) {
	SECU_PrintError(progName, "unable to decode trust string");
	return SECFailure;
    }

    rv = CERT_ChangeCertTrust(handle, cert, trust);
    if (rv) {
	SECU_PrintError(progName, "unable to modify trust attributes");
	return SECFailure;
    }
    CERT_DestroyCertificate(cert);

    return SECSuccess;
}

static SECStatus
printCertCB(CERTCertificate *cert, void *arg)
{
    SECStatus rv;
    SECItem data;
    CERTCertTrust *trust = (CERTCertTrust *)arg;
    
    data.data = cert->derCert.data;
    data.len = cert->derCert.len;

    rv = SECU_PrintSignedData(stdout, &data, "Certificate", 0,
			      SECU_PrintCertificate);
    if (rv) {
	SECU_PrintError(progName, "problem printing certificate");
	return(SECFailure);
    }
    if (trust) {
	SECU_PrintTrustFlags(stdout, trust,
	                     "Certificate Trust Flags", 1);
    } else if (cert->trust) {
	SECU_PrintTrustFlags(stdout, cert->trust,
	                     "Certificate Trust Flags", 1);
    }

    printf("\n");

    return(SECSuccess);
}

static SECStatus
DumpChain(CERTCertDBHandle *handle, char *name)
{
    CERTCertificate *the_cert;
    CERTCertificateList *chain;
    int i, j;
    the_cert = PK11_FindCertFromNickname(name, NULL);
    if (!the_cert) {
	SECU_PrintError(progName, "Could not find: %s\n", name);
	return SECFailure;
    }
    chain = CERT_CertChainFromCert(the_cert, 0, PR_TRUE);
    CERT_DestroyCertificate(the_cert);
    if (!chain) {
	SECU_PrintError(progName, "Could not obtain chain for: %s\n", name);
	return SECFailure;
    }
    for (i=chain->len-1; i>=0; i--) {
	CERTCertificate *c;
	c = CERT_FindCertByDERCert(handle, &chain->certs[i]);
	for (j=i; j<chain->len-1; j++) printf("  ");
	printf("\"%s\" [%s]\n\n", c->nickname, c->subjectName);
	CERT_DestroyCertificate(c);
    }
    CERT_DestroyCertificateList(chain);
    return SECSuccess;
}

static SECStatus
listCerts(CERTCertDBHandle *handle, char *name, PK11SlotInfo *slot,
          PRBool raw, PRBool ascii, PRFileDesc *outfile, void *pwarg)
{
    SECItem data;
    PRInt32 numBytes;
    SECStatus rv = SECFailure;
    CERTCertList *certs;
    CERTCertListNode *node;

    /* List certs on a non-internal slot. */
    if (!PK11_IsFriendly(slot) && PK11_NeedLogin(slot))
	    PK11_Authenticate(slot, PR_TRUE, pwarg);
    if (name) {
	CERTCertificate *the_cert;
	the_cert = CERT_FindCertByNicknameOrEmailAddr(handle, name);
	if (!the_cert) {
	    the_cert = PK11_FindCertFromNickname(name, NULL);
	    if (!the_cert) {
		SECU_PrintError(progName, "Could not find: %s\n", name);
		return SECFailure;
	    }
	}
	certs = CERT_CreateSubjectCertList(NULL, handle, &the_cert->derSubject,
		PR_Now(), PR_FALSE);
	CERT_DestroyCertificate(the_cert);

	for (node = CERT_LIST_HEAD(certs); !CERT_LIST_END(node,certs);
						node = CERT_LIST_NEXT(node)) {
	    the_cert = node->cert;
	    /* now get the subjectList that matches this cert */
	    data.data = the_cert->derCert.data;
	    data.len = the_cert->derCert.len;
	    if (ascii) {
		PR_fprintf(outfile, "%s\n%s\n%s\n", NS_CERT_HEADER, 
		        BTOA_DataToAscii(data.data, data.len), NS_CERT_TRAILER);
		rv = SECSuccess;
	    } else if (raw) {
		numBytes = PR_Write(outfile, data.data, data.len);
		if (numBytes != (PRInt32) data.len) {
		   SECU_PrintSystemError(progName, "error writing raw cert");
		    rv = SECFailure;
		}
		rv = SECSuccess;
	    } else {
		rv = printCertCB(the_cert, the_cert->trust);
	    }
	    if (rv != SECSuccess) {
		break;
	    }
	}
    } else {

	certs = PK11_ListCertsInSlot(slot);
	if (certs) {
	    for (node = CERT_LIST_HEAD(certs); !CERT_LIST_END(node,certs);
						node = CERT_LIST_NEXT(node)) {
		SECU_PrintCertNickname(node,stdout);
	    }
	    rv = SECSuccess;
	}
    }
    if (certs) {
        CERT_DestroyCertList(certs);
    }
    if (rv) {
	SECU_PrintError(progName, "problem printing certificate nicknames");
	return SECFailure;
    }

    return SECSuccess;	/* not rv ?? */
}

static SECStatus
ListCerts(CERTCertDBHandle *handle, char *name, PK11SlotInfo *slot,
          PRBool raw, PRBool ascii, PRFileDesc *outfile, secuPWData *pwdata)
{
    SECStatus rv;

    if (slot == NULL) {
	CERTCertList *list;
	CERTCertListNode *node;

	list = PK11_ListCerts(PK11CertListAll, pwdata);
	for (node = CERT_LIST_HEAD(list); !CERT_LIST_END(node, list);
	     node = CERT_LIST_NEXT(node)) 
	{
	    SECU_PrintCertNickname(node, stdout);
	}
	CERT_DestroyCertList(list);
	return SECSuccess;
    } else {
	rv = listCerts(handle,name,slot,raw,ascii,outfile,pwdata);
    }
    return rv;
}

static SECStatus 
DeleteCert(CERTCertDBHandle *handle, char *name)
{
    SECStatus rv;
    CERTCertificate *cert;

    cert = CERT_FindCertByNicknameOrEmailAddr(handle, name);
    if (!cert) {
	SECU_PrintError(progName, "could not find certificate named \"%s\"",
			name);
	return SECFailure;
    }

    rv = SEC_DeletePermCertificate(cert);
    CERT_DestroyCertificate(cert);
    if (rv) {
	SECU_PrintError(progName, "unable to delete certificate");
	return SECFailure;
    }

    return SECSuccess;
}

static SECStatus
ValidateCert(CERTCertDBHandle *handle, char *name, char *date,
	     char *certUsage, PRBool checkSig, PRBool logit, secuPWData *pwdata)
{
    SECStatus rv;
    CERTCertificate *cert = NULL;
    int64 timeBoundary;
    SECCertificateUsage usage;
    CERTVerifyLog reallog;
    CERTVerifyLog *log = NULL;

    if (!certUsage) {
	    PORT_SetError (SEC_ERROR_INVALID_ARGS);
	    return (SECFailure);
    }
    
    switch (*certUsage) {
	case 'O':
	    usage = certificateUsageStatusResponder;
	    break;
	case 'C':
	    usage = certificateUsageSSLClient;
	    break;
	case 'V':
	    usage = certificateUsageSSLServer;
	    break;
	case 'S':
	    usage = certificateUsageEmailSigner;
	    break;
	case 'R':
	    usage = certificateUsageEmailRecipient;
	    break;
	case 'J':
	    usage = certificateUsageObjectSigner;
	    break;
	default:
	    PORT_SetError (SEC_ERROR_INVALID_ARGS);
	    return (SECFailure);
    }
    do {
	cert = CERT_FindCertByNicknameOrEmailAddr(handle, name);
	if (!cert) {
	    SECU_PrintError(progName, "could not find certificate named \"%s\"",
			    name);
	    GEN_BREAK (SECFailure)
	}

	if (date != NULL) {
	    rv = DER_AsciiToTime(&timeBoundary, date);
	    if (rv) {
		SECU_PrintError(progName, "invalid input date");
		GEN_BREAK (SECFailure)
	    }
	} else {
	    timeBoundary = PR_Now();
	}

	if ( logit ) {
	    log = &reallog;
	    
	    log->count = 0;
	    log->head = NULL;
	    log->tail = NULL;
	    log->arena = PORT_NewArena(DER_DEFAULT_CHUNKSIZE);
	    if ( log->arena == NULL ) {
		SECU_PrintError(progName, "out of memory");
		GEN_BREAK (SECFailure)
	    }
	}
 
	rv = CERT_VerifyCertificate(handle, cert, checkSig, usage,
			     timeBoundary, pwdata, log, &usage);
	if ( log ) {
	    if ( log->head == NULL ) {
		fprintf(stdout, "%s: certificate is valid\n", progName);
		GEN_BREAK (SECSuccess)
	    } else {
		char *name;
		CERTVerifyLogNode *node;
		
		node = log->head;
		while ( node ) {
		    if ( node->cert->nickname != NULL ) {
			name = node->cert->nickname;
		    } else {
			name = node->cert->subjectName;
		    }
		    fprintf(stderr, "%s : %s\n", name, 
		    	SECU_Strerror(node->error));
		    CERT_DestroyCertificate(node->cert);
		    node = node->next;
		}
	    }
	} else {
	    if (rv != SECSuccess) {
		PRErrorCode perr = PORT_GetError();
		fprintf(stdout, "%s: certificate is invalid: %s\n",
			progName, SECU_Strerror(perr));
		GEN_BREAK (SECFailure)
	    }
	    fprintf(stdout, "%s: certificate is valid\n", progName);
	    GEN_BREAK (SECSuccess)
	}
    } while (0);

    if (cert) {
        CERT_DestroyCertificate(cert);
    }

    return (rv);
}


static SECStatus
printKeyCB(SECKEYPublicKey *key, SECItem *data, void *arg)
{
    if (key->keyType == rsaKey) {
	fprintf(stdout, "RSA Public-Key:\n");
	SECU_PrintInteger(stdout, &key->u.rsa.modulus, "modulus", 1);
    } else {
	fprintf(stdout, "DSA Public-Key:\n");
	SECU_PrintInteger(stdout, &key->u.dsa.publicValue, "publicValue", 1);
    }
    return SECSuccess;
}

/* callback for listing certs through pkcs11 */
static SECStatus
secu_PrintKey(FILE *out, int count, SECKEYPrivateKey *key)
{
    char *name;

    name = PK11_GetPrivateKeyNickname(key);
    if (name == NULL) {
	/* should look up associated cert */
	name = PORT_Strdup("< orphaned >");
    }
    fprintf(out, "<%d> %s\n", count, name);
    PORT_Free(name);

    return SECSuccess;
}

static SECStatus
listKeys(PK11SlotInfo *slot, KeyType keyType, void *pwarg)
{
    SECKEYPrivateKeyList *list;
    SECKEYPrivateKeyListNode *node;
    int count;

    if (PK11_NeedLogin(slot))
	    PK11_Authenticate(slot, PR_TRUE, pwarg);

    list = PK11_ListPrivateKeysInSlot(slot);
    if (list == NULL) {
	SECU_PrintError(progName, "problem listing keys");
	return SECFailure;
    }
    for (count=0, node=PRIVKEY_LIST_HEAD(list) ; !PRIVKEY_LIST_END(node,list);
			  node= PRIVKEY_LIST_NEXT(node),count++) {
	secu_PrintKey(stdout, count, node->key);
    }
    SECKEY_DestroyPrivateKeyList(list);

    if (count == 0) {
	fprintf(stderr, "%s: no keys found\n", progName);
	return SECFailure;
    }
    return SECSuccess;
}

static SECStatus
ListKeys(PK11SlotInfo *slot, char *keyname, int index, 
         KeyType keyType, PRBool dopriv, secuPWData *pwdata)
{
    SECStatus rv = SECSuccess;

    if (slot == NULL) {
	PK11SlotList *list;
	PK11SlotListElement *le;

	list= PK11_GetAllTokens(CKM_INVALID_MECHANISM,PR_FALSE,PR_FALSE,pwdata);
	if (list) for (le = list->head; le; le = le->next) {
	    rv = listKeys(le->slot,keyType,pwdata);
	}
    } else {
	rv = listKeys(slot,keyType,pwdata);
    }
    return rv;
}

static SECStatus
DeleteKey(char *nickname, secuPWData *pwdata)
{
    SECStatus rv;
    CERTCertificate *cert;
    PK11SlotInfo *slot;

    slot = PK11_GetInternalKeySlot();
    if (PK11_NeedLogin(slot))
	PK11_Authenticate(slot, PR_TRUE, pwdata);
    cert = PK11_FindCertFromNickname(nickname, pwdata);
    if (!cert) {
	PK11_FreeSlot(slot);
	return SECFailure;
    }
    rv = PK11_DeleteTokenCertAndKey(cert, pwdata);
    if (rv != SECSuccess) {
	SECU_PrintError("problem deleting private key \"%s\"\n", nickname);
    }
    CERT_DestroyCertificate(cert);
    PK11_FreeSlot(slot);
    return rv;
}


/*
 *  L i s t M o d u l e s
 *
 *  Print a list of the PKCS11 modules that are
 *  available. This is useful for smartcard people to
 *  make sure they have the drivers loaded.
 *
 */
static SECStatus
ListModules(void)
{
    PK11SlotList *list;
    PK11SlotListElement *le;

    /* get them all! */
    list = PK11_GetAllTokens(CKM_INVALID_MECHANISM,PR_FALSE,PR_FALSE,NULL);
    if (list == NULL) return SECFailure;

    /* look at each slot*/
    for (le = list->head ; le; le = le->next) {
      printf ("\n");
      printf ("    slot: %s\n", PK11_GetSlotName(le->slot));
      printf ("   token: %s\n", PK11_GetTokenName(le->slot));
    }
    PK11_FreeSlotList(list);

    return SECSuccess;
}

static void 
Usage(char *progName)
{
#define FPS fprintf(stderr, 
    FPS "Type %s -H for more detailed descriptions\n", progName);
    FPS "Usage:  %s -N [-d certdir] [-P dbprefix] [-f pwfile]\n", progName);
    FPS "Usage:  %s -T [-d certdir] [-P dbprefix] [-h token-name] [-f pwfile]\n", progName);
    FPS "\t%s -A -n cert-name -t trustargs [-d certdir] [-P dbprefix] [-a] [-i input]\n", 
    	progName);
    FPS "\t%s -B -i batch-file\n", progName);
    FPS "\t%s -C [-c issuer-name | -x] -i cert-request-file -o cert-file\n"
	"\t\t [-m serial-number] [-w warp-months] [-v months-valid]\n"
        "\t\t [-f pwfile] [-d certdir] [-P dbprefix] [-1] [-2] [-3] [-4] [-5]\n"
	"\t\t [-6] [-7 emailAddrs] [-8 dns-names] [-a]\n",
	progName);
    FPS "\t%s -D -n cert-name [-d certdir] [-P dbprefix]\n", progName);
    FPS "\t%s -E -n cert-name -t trustargs [-d certdir] [-P dbprefix] [-a] [-i input]\n", 
	progName);
    FPS "\t%s -G -n key-name [-h token-name] [-k rsa] [-g key-size] [-y exp]\n" 
	"\t\t [-f pwfile] [-z noisefile] [-d certdir] [-P dbprefix]\n", progName);
    FPS "\t%s -G [-h token-name] -k dsa [-q pqgfile -g key-size] [-f pwfile]\n"
	"\t\t [-z noisefile] [-d certdir] [-P dbprefix]\n", progName);
#ifdef NSS_ENABLE_ECC
    FPS "\t%s -G [-h token-name] -k ec -q curve [-f pwfile]\n"
	"\t\t [-z noisefile] [-d certdir] [-P dbprefix]\n", progName);
    FPS "\t%s -K [-n key-name] [-h token-name] [-k dsa|ec|rsa|all]\n", 
	progName);
#else
    FPS "\t%s -K [-n key-name] [-h token-name] [-k dsa|rsa|all]\n", 
	progName);
#endif /* NSS_ENABLE_ECC */
    FPS "\t\t [-f pwfile] [-X] [-d certdir] [-P dbprefix]\n");
    FPS "\t%s -L [-n cert-name] [-X] [-d certdir] [-P dbprefix] [-r] [-a]\n", progName);
    FPS "\t%s -M -n cert-name -t trustargs [-d certdir] [-P dbprefix]\n",
	progName);
    FPS "\t%s -O -n cert-name [-X] [-d certdir] [-P dbprefix]\n", progName);
    FPS "\t%s -R -s subj -o cert-request-file [-d certdir] [-P dbprefix] [-p phone] [-a]\n"
	"\t\t [-y emailAddrs] [-k key-type-or-id] [-h token-name] [-f pwfile] [-g key-size]\n",
	progName);
    FPS "\t%s -V -n cert-name -u usage [-b time] [-e] \n"
	"\t\t[-X] [-d certdir] [-P dbprefix]\n",
	progName);
    FPS "\t%s -S -n cert-name -s subj [-c issuer-name | -x]  -t trustargs\n"
	"\t\t [-k key-type-or-id] [-q key-params] [-h token-name] [-g key-size]\n"
        "\t\t [-m serial-number] [-w warp-months] [-v months-valid]\n"
	"\t\t [-f pwfile] [-d certdir] [-P dbprefix]\n"
        "\t\t [-p phone] [-1] [-2] [-3] [-4] [-5] [-6] [-7 emailAddrs]\n"
        "\t\t [-8 dns-names]\n",
	progName);
    FPS "\t%s -U [-X] [-d certdir] [-P dbprefix]\n", progName);
    exit(1);
}

static void LongUsage(char *progName)
{

    FPS "%-15s Add a certificate to the database        (create if needed)\n",
	"-A");
    FPS "%-20s\n", "   All options under -E apply");
    FPS "%-15s Run a series of certutil commands from a batch file\n", "-B");
    FPS "%-20s Specify the batch file\n", "   -i batch-file");
    FPS "%-15s Add an Email certificate to the database (create if needed)\n",
	"-E");
    FPS "%-20s Specify the nickname of the certificate to add\n",
	"   -n cert-name");
    FPS "%-20s Set the certificate trust attributes:\n",
	"   -t trustargs");
    FPS "%-25s p \t valid peer\n", "");
    FPS "%-25s P \t trusted peer (implies p)\n", "");
    FPS "%-25s c \t valid CA\n", "");
    FPS "%-25s T \t trusted CA to issue client certs (implies c)\n", "");
    FPS "%-25s C \t trusted CA to issue server certs (implies c)\n", "");
    FPS "%-25s u \t user cert\n", "");
    FPS "%-25s w \t send warning\n", "");
    FPS "%-25s g \t make step-up cert\n", "");
    FPS "%-20s Specify the password file\n",
	"   -f pwfile");
    FPS "%-20s Cert database directory (default is ~/.netscape)\n",
	"   -d certdir");
    FPS "%-20s Cert & Key database prefix\n",
	"   -P dbprefix");
    FPS "%-20s The input certificate is encoded in ASCII (RFC1113)\n",
	"   -a");
    FPS "%-20s Specify the certificate file (default is stdin)\n",
	"   -i input");
    FPS "\n");

    FPS "%-15s Create a new binary certificate from a BINARY cert request\n",
	"-C");
    FPS "%-20s The nickname of the issuer cert\n",
	"   -c issuer-name");
    FPS "%-20s The BINARY certificate request file\n",
	"   -i cert-request ");
    FPS "%-20s Output binary cert to this file (default is stdout)\n",
	"   -o output-cert");
    FPS "%-20s Self sign\n",
	"   -x");
    FPS "%-20s Cert serial number\n",
	"   -m serial-number");
    FPS "%-20s Time Warp\n",
	"   -w warp-months");
    FPS "%-20s Months valid (default is 3)\n",
        "   -v months-valid");
    FPS "%-20s Specify the password file\n",
	"   -f pwfile");
    FPS "%-20s Cert database directory (default is ~/.netscape)\n",
	"   -d certdir");
    FPS "%-20s Cert & Key database prefix\n",
	"   -P dbprefix");
    FPS "%-20s Create key usage extension\n",
	"   -1 ");
    FPS "%-20s Create basic constraint extension\n",
	"   -2 ");
    FPS "%-20s Create authority key ID extension\n",
	"   -3 ");
    FPS "%-20s Create crl distribution point extension\n",
	"   -4 ");
    FPS "%-20s Create netscape cert type extension\n",
	"   -5 ");
    FPS "%-20s Create extended key usage extension\n",
	"   -6 ");
    FPS "%-20s Create an email subject alt name extension\n",
	"   -7 ");
    FPS "%-20s Create an dns subject alt name extension\n",
	"   -8 ");
    FPS "%-20s The input certificate request is encoded in ASCII (RFC1113)\n",
	"   -a");
    FPS "\n");

    FPS "%-15s Generate a new key pair\n",
	"-G");
    FPS "%-20s Name of token in which to generate key (default is internal)\n",
	"   -h token-name");
#ifdef NSS_ENABLE_ECC
    FPS "%-20s Type of key pair to generate (\"dsa\", \"ec\", \"rsa\" (default))\n",
	"   -k key-type");
    FPS "%-20s Key size in bits, (min %d, max %d, default %d) (not for ec)\n",
	"   -g key-size", MIN_KEY_BITS, MAX_KEY_BITS, DEFAULT_KEY_BITS);
#else
    FPS "%-20s Type of key pair to generate (\"dsa\", \"rsa\" (default))\n",
	"   -k key-type");
    FPS "%-20s Key size in bits, (min %d, max %d, default %d)\n",
	"   -g key-size", MIN_KEY_BITS, MAX_KEY_BITS, DEFAULT_KEY_BITS);
#endif /* NSS_ENABLE_ECC */
    FPS "%-20s Set the public exponent value (3, 17, 65537) (rsa only)\n",
	"   -y exp");
    FPS "%-20s Specify the password file\n",
        "   -f password-file");
    FPS "%-20s Specify the noise file to be used\n",
	"   -z noisefile");
    FPS "%-20s read PQG value from pqgfile (dsa only)\n",
	"   -q pqgfile");
#ifdef NSS_ENABLE_ECC
    FPS "%-20s Elliptic curve name (ec only)\n",
	"   -q curve-name");
    FPS "%-20s One of nistp256, nistp384, nistp521\n", "");
#ifdef NSS_ECC_MORE_THAN_SUITE_B
    FPS "%-20s sect163k1, nistk163, sect163r1, sect163r2,\n", "");
    FPS "%-20s nistb163, sect193r1, sect193r2, sect233k1, nistk233,\n", "");
    FPS "%-20s sect233r1, nistb233, sect239k1, sect283k1, nistk283,\n", "");
    FPS "%-20s sect283r1, nistb283, sect409k1, nistk409, sect409r1,\n", "");
    FPS "%-20s nistb409, sect571k1, nistk571, sect571r1, nistb571,\n", "");
    FPS "%-20s secp160k1, secp160r1, secp160r2, secp192k1, secp192r1,\n", "");
    FPS "%-20s nistp192, secp224k1, secp224r1, nistp224, secp256k1,\n", "");
    FPS "%-20s secp256r1, secp384r1, secp521r1,\n", "");
    FPS "%-20s prime192v1, prime192v2, prime192v3, \n", "");
    FPS "%-20s prime239v1, prime239v2, prime239v3, c2pnb163v1, \n", "");
    FPS "%-20s c2pnb163v2, c2pnb163v3, c2pnb176v1, c2tnb191v1, \n", "");
    FPS "%-20s c2tnb191v2, c2tnb191v3,  \n", "");
    FPS "%-20s c2pnb208w1, c2tnb239v1, c2tnb239v2, c2tnb239v3, \n", "");
    FPS "%-20s c2pnb272w1, c2pnb304w1, \n", "");
    FPS "%-20s c2tnb359w1, c2pnb368w1, c2tnb431r1, secp112r1, \n", "");
    FPS "%-20s secp112r2, secp128r1, secp128r2, sect113r1, sect113r2\n", "");
    FPS "%-20s sect131r1, sect131r2\n", "");
#endif /* NSS_ECC_MORE_THAN_SUITE_B */
#endif
    FPS "%-20s Key database directory (default is ~/.netscape)\n",
	"   -d keydir");
    FPS "%-20s Cert & Key database prefix\n",
	"   -P dbprefix");
    FPS "\n");

    FPS "%-15s Delete a certificate from the database\n",
	"-D");
    FPS "%-20s The nickname of the cert to delete\n",
	"   -n cert-name");
    FPS "%-20s Cert database directory (default is ~/.netscape)\n",
	"   -d certdir");
    FPS "%-20s Cert & Key database prefix\n",
	"   -P dbprefix");
    FPS "\n");

    FPS "%-15s List all modules\n", /*, or print out a single named module\n",*/
        "-U");
    FPS "%-20s Module database directory (default is '~/.netscape')\n",
        "   -d moddir");
    FPS "%-20s Cert & Key database prefix\n",
	"   -P dbprefix");
    FPS "%-20s force the database to open R/W\n",
	"   -X");
    FPS "\n");

    FPS "%-15s List all keys\n", /*, or print out a single named key\n",*/
        "-K");
    FPS "%-20s Name of token in which to look for keys (default is internal,"
	" use \"all\" to list keys on all tokens)\n",
	"   -h token-name ");
#ifdef NSS_ENABLE_ECC
    FPS "%-20s Type of key pair to list (\"all\", \"dsa\", \"ec\", \"rsa\" (default))\n",
	"   -k key-type");
#else
    FPS "%-20s Type of key pair to list (\"all\", \"dsa\", \"rsa\" (default))\n",
	"   -k key-type");
#endif
    FPS "%-20s Specify the password file\n",
        "   -f password-file");
    FPS "%-20s Key database directory (default is ~/.netscape)\n",
	"   -d keydir");
    FPS "%-20s Cert & Key database prefix\n",
	"   -P dbprefix");
    FPS "%-20s force the database to open R/W\n",
	"   -X");
    FPS "\n");

    FPS "%-15s List all certs, or print out a single named cert\n",
	"-L");
    FPS "%-20s Pretty print named cert (list all if unspecified)\n",
	"   -n cert-name");
    FPS "%-20s Cert database directory (default is ~/.netscape)\n",
	"   -d certdir");
    FPS "%-20s Cert & Key database prefix\n",
	"   -P dbprefix");
    FPS "%-20s force the database to open R/W\n",
	"   -X");
    FPS "%-20s For single cert, print binary DER encoding\n",
	"   -r");
    FPS "%-20s For single cert, print ASCII encoding (RFC1113)\n",
	"   -a");
    FPS "\n");

    FPS "%-15s Modify trust attributes of certificate\n",
	"-M");
    FPS "%-20s The nickname of the cert to modify\n",
	"   -n cert-name");
    FPS "%-20s Set the certificate trust attributes (see -A above)\n",
	"   -t trustargs");
    FPS "%-20s Cert database directory (default is ~/.netscape)\n",
	"   -d certdir");
    FPS "%-20s Cert & Key database prefix\n",
	"   -P dbprefix");
    FPS "\n");

    FPS "%-15s Create a new certificate database\n",
	"-N");
    FPS "%-20s Cert database directory (default is ~/.netscape)\n",
	"   -d certdir");
    FPS "%-20s Cert & Key database prefix\n",
	"   -P dbprefix");
    FPS "\n");
    FPS "%-15s Reset the Key database or token\n",
	"-T");
    FPS "%-20s Cert database directory (default is ~/.netscape)\n",
	"   -d certdir");
    FPS "%-20s Cert & Key database prefix\n",
	"   -P dbprefix");
    FPS "%-20s Token to reset (default is internal)\n",
	"   -h token-name");
    FPS "\n");

    FPS "\n");
    FPS "%-15s Print the chain of a certificate\n",
	"-O");
    FPS "%-20s The nickname of the cert to modify\n",
	"   -n cert-name");
    FPS "%-20s Cert database directory (default is ~/.netscape)\n",
	"   -d certdir");
    FPS "%-20s Cert & Key database prefix\n",
	"   -P dbprefix");
    FPS "%-20s force the database to open R/W\n",
	"   -X");
    FPS "\n");

    FPS "%-15s Generate a certificate request (stdout)\n",
	"-R");
    FPS "%-20s Specify the subject name (using RFC1485)\n",
	"   -s subject");
    FPS "%-20s Output the cert request to this file\n",
	"   -o output-req");
#ifdef NSS_ENABLE_ECC
    FPS "%-20s Type of key pair to generate (\"dsa\", \"ec\", \"rsa\" (default))\n",
#else
    FPS "%-20s Type of key pair to generate (\"dsa\", \"rsa\" (default))\n",
#endif /* NSS_ENABLE_ECC */
	"   -k key-type-or-id");
    FPS "%-20s or nickname of the cert key to use \n",
	"");
    FPS "%-20s Name of token in which to generate key (default is internal)\n",
	"   -h token-name");
    FPS "%-20s Key size in bits, RSA keys only (min %d, max %d, default %d)\n",
	"   -g key-size", MIN_KEY_BITS, MAX_KEY_BITS, DEFAULT_KEY_BITS);
    FPS "%-20s Name of file containing PQG parameters (dsa only)\n",
	"   -q pqgfile");
#ifdef NSS_ENABLE_ECC
    FPS "%-20s Elliptic curve name (ec only)\n",
	"   -q curve-name");
    FPS "%-20s See the \"-G\" option for a full list of supported names.\n",
	"");
#endif /* NSS_ENABLE_ECC */
    FPS "%-20s Specify the password file\n",
	"   -f pwfile");
    FPS "%-20s Key database directory (default is ~/.netscape)\n",
	"   -d keydir");
    FPS "%-20s Cert & Key database prefix\n",
	"   -P dbprefix");
    FPS "%-20s Specify the contact phone number (\"123-456-7890\")\n",
	"   -p phone");
    FPS "%-20s Output the cert request in ASCII (RFC1113); default is binary\n",
	"   -a");
    FPS "%-20s \n",
	"   See -S for available extension options");
    FPS "\n");

    FPS "%-15s Validate a certificate\n",
	"-V");
    FPS "%-20s The nickname of the cert to Validate\n",
	"   -n cert-name");
    FPS "%-20s validity time (\"YYMMDDHHMMSS[+HHMM|-HHMM|Z]\")\n",
	"   -b time");
    FPS "%-20s Check certificate signature \n",
	"   -e ");   
    FPS "%-20s Specify certificate usage:\n", "   -u certusage");
    FPS "%-25s C \t SSL Client\n", "");
    FPS "%-25s V \t SSL Server\n", "");
    FPS "%-25s S \t Email signer\n", "");
    FPS "%-25s R \t Email Recipient\n", "");   
    FPS "%-25s O \t OCSP status responder\n", "");   
    FPS "%-25s J \t Object signer\n", "");   
    FPS "%-20s Cert database directory (default is ~/.netscape)\n",
	"   -d certdir");
    FPS "%-20s Cert & Key database prefix\n",
	"   -P dbprefix");
    FPS "%-20s force the database to open R/W\n",
	"   -X");
    FPS "\n");

    FPS "%-15s Make a certificate and add to database\n",
        "-S");
    FPS "%-20s Specify the nickname of the cert\n",
        "   -n key-name");
    FPS "%-20s Specify the subject name (using RFC1485)\n",
        "   -s subject");
    FPS "%-20s The nickname of the issuer cert\n",
	"   -c issuer-name");
    FPS "%-20s Set the certificate trust attributes (see -A above)\n",
	"   -t trustargs");
#ifdef NSS_ENABLE_ECC
    FPS "%-20s Type of key pair to generate (\"dsa\", \"ec\", \"rsa\" (default))\n",
#else
    FPS "%-20s Type of key pair to generate (\"dsa\", \"rsa\" (default))\n",
#endif /* NSS_ENABLE_ECC */
	"   -k key-type-or-id");
    FPS "%-20s Name of token in which to generate key (default is internal)\n",
	"   -h token-name");
    FPS "%-20s Key size in bits, RSA keys only (min %d, max %d, default %d)\n",
	"   -g key-size", MIN_KEY_BITS, MAX_KEY_BITS, DEFAULT_KEY_BITS);
    FPS "%-20s Name of file containing PQG parameters (dsa only)\n",
	"   -q pqgfile");
#ifdef NSS_ENABLE_ECC
    FPS "%-20s Elliptic curve name (ec only)\n",
	"   -q curve-name");
    FPS "%-20s See the \"-G\" option for a full list of supported names.\n",
	"");
#endif /* NSS_ENABLE_ECC */
    FPS "%-20s Self sign\n",
	"   -x");
    FPS "%-20s Cert serial number\n",
	"   -m serial-number");
    FPS "%-20s Time Warp\n",
	"   -w warp-months");
    FPS "%-20s Months valid (default is 3)\n",
        "   -v months-valid");
    FPS "%-20s Specify the password file\n",
	"   -f pwfile");
    FPS "%-20s Cert database directory (default is ~/.netscape)\n",
	"   -d certdir");
    FPS "%-20s Cert & Key database prefix\n",
	"   -P dbprefix");
    FPS "%-20s Specify the contact phone number (\"123-456-7890\")\n",
	"   -p phone");
    FPS "%-20s Create key usage extension\n",
	"   -1 ");
    FPS "%-20s Create basic constraint extension\n",
	"   -2 ");
    FPS "%-20s Create authority key ID extension\n",
	"   -3 ");
    FPS "%-20s Create crl distribution point extension\n",
	"   -4 ");
    FPS "%-20s Create netscape cert type extension\n",
	"   -5 ");
    FPS "%-20s Create extended key usage extension\n",
	"   -6 ");
    FPS "%-20s Create an email subject alt name extension\n",
	"   -7 ");
    FPS "%-20s Create an dns subject alt name extension\n",
	"   -8 ");
    FPS "\n");

    exit(1);
#undef FPS
}


static CERTCertificate *
MakeV1Cert(	CERTCertDBHandle *	handle, 
		CERTCertificateRequest *req,
	    	char *			issuerNickName, 
		PRBool 			selfsign, 
		unsigned int 		serialNumber,
		int 			warpmonths,
                int                     validityMonths)
{
    CERTCertificate *issuerCert = NULL;
    CERTValidity *validity;
    CERTCertificate *cert = NULL;
    PRExplodedTime printableTime;
    PRTime now, after;

    if ( !selfsign ) {
	issuerCert = CERT_FindCertByNicknameOrEmailAddr(handle, issuerNickName);
	if (!issuerCert) {
	    SECU_PrintError(progName, "could not find certificate named \"%s\"",
			    issuerNickName);
	    return NULL;
	}
    }

    now = PR_Now();
    PR_ExplodeTime (now, PR_GMTParameters, &printableTime);
    if ( warpmonths ) {
	printableTime.tm_month += warpmonths;
	now = PR_ImplodeTime (&printableTime);
	PR_ExplodeTime (now, PR_GMTParameters, &printableTime);
    }
    printableTime.tm_month += validityMonths;
    after = PR_ImplodeTime (&printableTime);

    /* note that the time is now in micro-second unit */
    validity = CERT_CreateValidity (now, after);
    if (validity) {
        cert = CERT_CreateCertificate(serialNumber, 
				      (selfsign ? &req->subject 
				                : &issuerCert->subject), 
	                              validity, req);
    
        CERT_DestroyValidity(validity);
    }
    if ( issuerCert ) {
	CERT_DestroyCertificate (issuerCert);
    }
    
    return(cert);
}

static SECItem *
SignCert(CERTCertDBHandle *handle, CERTCertificate *cert, PRBool selfsign, 
         SECOidTag hashAlgTag,
         SECKEYPrivateKey *privKey, char *issuerNickName, void *pwarg)
{
    SECItem der;
    SECItem *result = NULL;
    SECKEYPrivateKey *caPrivateKey = NULL;    
    SECStatus rv;
    PRArenaPool *arena;
    SECOidTag algID;
    void *dummy;

    if( !selfsign ) {
      CERTCertificate *issuer = PK11_FindCertFromNickname(issuerNickName, pwarg);
      if( (CERTCertificate *)NULL == issuer ) {
        SECU_PrintError(progName, "unable to find issuer with nickname %s", 
	                issuerNickName);
        return (SECItem *)NULL;
      }

      privKey = caPrivateKey = PK11_FindKeyByAnyCert(issuer, pwarg);
      CERT_DestroyCertificate(issuer);
      if (caPrivateKey == NULL) {
	SECU_PrintError(progName, "unable to retrieve key %s", issuerNickName);
	return NULL;
      }
    }
	
    arena = cert->arena;

    algID = SEC_GetSignatureAlgorithmOidTag(privKey->keyType, hashAlgTag);
    if (algID == SEC_OID_UNKNOWN) {
	fprintf(stderr, "Unknown key or hash type for issuer.");
	goto done;
    }

    rv = SECOID_SetAlgorithmID(arena, &cert->signature, algID, 0);
    if (rv != SECSuccess) {
	fprintf(stderr, "Could not set signature algorithm id.");
	goto done;
    }

    /* we only deal with cert v3 here */
    *(cert->version.data) = 2;
    cert->version.len = 1;

    der.len = 0;
    der.data = NULL;
    dummy = SEC_ASN1EncodeItem (arena, &der, cert,
			 	SEC_ASN1_GET(CERT_CertificateTemplate));
    if (!dummy) {
	fprintf (stderr, "Could not encode certificate.\n");
	goto done;
    }

    result = (SECItem *) PORT_ArenaZAlloc (arena, sizeof (SECItem));
    if (result == NULL) {
	fprintf (stderr, "Could not allocate item for certificate data.\n");
	goto done;
    }

    rv = SEC_DerSignData(arena, result, der.data, der.len, privKey, algID);
    if (rv != SECSuccess) {
	fprintf (stderr, "Could not sign encoded certificate data.\n");
	PORT_Free(result);
	result = NULL;
	goto done;
    }
    cert->derCert = *result;
done:
    if (caPrivateKey) {
	SECKEY_DestroyPrivateKey(caPrivateKey);
    }
    return result;
}

static SECStatus
CreateCert(
	CERTCertDBHandle *handle, 
	char *  issuerNickName, 
	PRFileDesc *inFile,
	PRFileDesc *outFile, 
	SECKEYPrivateKey *selfsignprivkey,
	void 	*pwarg,
	SECOidTag hashAlgTag,
	unsigned int serialNumber, 
	int     warpmonths,
	int     validityMonths,
	const char *emailAddrs,
	const char *dnsNames,
	PRBool  ascii,
	PRBool  selfsign,
	PRBool	keyUsage, 
	PRBool  extKeyUsage,
	PRBool  basicConstraint, 
	PRBool  authKeyID,
	PRBool  crlDistPoints, 
	PRBool  nscpCertType)
{
    void *	extHandle;
    SECItem *	certDER;
    PRArenaPool *arena			= NULL;
    CERTCertificate *subjectCert 	= NULL;
    CERTCertificateRequest *certReq	= NULL;
    SECStatus 	rv 			= SECSuccess;
    SECItem 	reqDER;
    CERTCertExtension **CRexts;

    reqDER.data = NULL;
    do {
	arena = PORT_NewArena(DER_DEFAULT_CHUNKSIZE);
	if (!arena) {
	    GEN_BREAK (SECFailure);
	}
	
	/* Create a certrequest object from the input cert request der */
	certReq = GetCertRequest(inFile, ascii);
	if (certReq == NULL) {
	    GEN_BREAK (SECFailure)
	}

	subjectCert = MakeV1Cert (handle, certReq, issuerNickName, selfsign,
				  serialNumber, warpmonths, validityMonths);
	if (subjectCert == NULL) {
	    GEN_BREAK (SECFailure)
	}
        
        
	extHandle = CERT_StartCertExtensions (subjectCert);
	if (extHandle == NULL) {
	    GEN_BREAK (SECFailure)
	}
        
        rv = AddExtensions(extHandle, emailAddrs, dnsNames, keyUsage, extKeyUsage,
                          basicConstraint, authKeyID, crlDistPoints, nscpCertType);
        if (rv != SECSuccess) {
	    GEN_BREAK (SECFailure)
	}
        
        if (certReq->attributes != NULL &&
	    certReq->attributes[0] != NULL &&
	    certReq->attributes[0]->attrType.data != NULL &&
	    certReq->attributes[0]->attrType.len   > 0    &&
            SECOID_FindOIDTag(&certReq->attributes[0]->attrType)
                == SEC_OID_PKCS9_EXTENSION_REQUEST) {
            rv = CERT_GetCertificateRequestExtensions(certReq, &CRexts);
            if (rv != SECSuccess)
                break;
            rv = CERT_MergeExtensions(extHandle, CRexts);
            if (rv != SECSuccess)
                break;
        }

	CERT_FinishExtensions(extHandle);

	certDER = SignCert(handle, subjectCert, selfsign, hashAlgTag,
	                   selfsignprivkey, issuerNickName,pwarg);

	if (certDER) {
	   if (ascii) {
		PR_fprintf(outFile, "%s\n%s\n%s\n", NS_CERT_HEADER, 
		           BTOA_DataToAscii(certDER->data, certDER->len), 
			   NS_CERT_TRAILER);
	   } else {
		PR_Write(outFile, certDER->data, certDER->len);
	   }
	}

    } while (0);
    CERT_DestroyCertificateRequest (certReq);
    CERT_DestroyCertificate (subjectCert);
    PORT_FreeArena (arena, PR_FALSE);
    if (rv != SECSuccess) {
	PRErrorCode  perr = PR_GetError();
        fprintf(stderr, "%s: unable to create cert (%s)\n", progName,
               SECU_Strerror(perr));
    }
    return (rv);
}

/*  Certutil commands  */
enum {
    cmd_AddCert = 0,
    cmd_CreateNewCert,
    cmd_DeleteCert,
    cmd_AddEmailCert,
    cmd_DeleteKey,
    cmd_GenKeyPair,
    cmd_PrintHelp,
    cmd_ListKeys,
    cmd_ListCerts,
    cmd_ModifyCertTrust,
    cmd_NewDBs,
    cmd_DumpChain,
    cmd_CertReq,
    cmd_CreateAndAddCert,
    cmd_TokenReset,
    cmd_ListModules,
    cmd_CheckCertValidity,
    cmd_ChangePassword,
    cmd_Version,
    cmd_Batch
};

/*  Certutil options */
enum {
    opt_SSOPass = 0,
    opt_AddKeyUsageExt,
    opt_AddBasicConstraintExt,
    opt_AddAuthorityKeyIDExt,
    opt_AddCRLDistPtsExt,
    opt_AddNSCertTypeExt,
    opt_AddExtKeyUsageExt,
    opt_ExtendedEmailAddrs,
    opt_ExtendedDNSNames,
    opt_ASCIIForIO,
    opt_ValidityTime,
    opt_IssuerName,
    opt_CertDir,
    opt_VerifySig,
    opt_PasswordFile,
    opt_KeySize,
    opt_TokenName,
    opt_InputFile,
    opt_KeyIndex,
    opt_KeyType,
    opt_DetailedInfo,
    opt_SerialNumber,
    opt_Nickname,
    opt_OutputFile,
    opt_PhoneNumber,
    opt_DBPrefix,
    opt_PQGFile,
    opt_BinaryDER,
    opt_Subject,
    opt_Trust,
    opt_Usage,
    opt_Validity,
    opt_OffsetMonths,
    opt_SelfSign,
    opt_RW,
    opt_Exponent,
    opt_NoiseFile,
    opt_Hash,
    opt_NewPasswordFile
};

static int 
certutil_main(int argc, char **argv, PRBool initialize)
{
    CERTCertDBHandle *certHandle;
    PK11SlotInfo *slot = NULL;
    CERTName *  subject         = 0;
    PRFileDesc *inFile          = PR_STDIN;
    PRFileDesc *outFile         = NULL;
    char *      certfile        = "tempcert";
    char *      certreqfile     = "tempcertreq";
    char *      slotname        = "internal";
    char *      certPrefix      = "";
    KeyType     keytype         = rsaKey;
    char *      name            = NULL;
    char *	keysource	= NULL;
    SECOidTag   hashAlgTag      = SEC_OID_UNKNOWN;
    int	        keysize	        = DEFAULT_KEY_BITS;
    int         publicExponent  = 0x010001;
    unsigned int serialNumber   = 0;
    int         warpmonths      = 0;
    int         validityMonths  = 3;
    int         commandsEntered = 0;
    char        commandToRun    = '\0';
    secuPWData  pwdata          = { PW_NONE, 0 };
    PRBool 	readOnly	= PR_FALSE;
    PRBool      initialized     = PR_FALSE;

    SECKEYPrivateKey *privkey = NULL;
    SECKEYPublicKey *pubkey = NULL;

    int i;
    SECStatus rv;

    secuCommand certutil;

secuCommandFlag certutil_commands[] =
{
	{ /* cmd_AddCert             */  'A', PR_FALSE, 0, PR_FALSE },
	{ /* cmd_CreateNewCert       */  'C', PR_FALSE, 0, PR_FALSE },
	{ /* cmd_DeleteCert          */  'D', PR_FALSE, 0, PR_FALSE },
	{ /* cmd_AddEmailCert        */  'E', PR_FALSE, 0, PR_FALSE },
	{ /* cmd_DeleteKey           */  'F', PR_FALSE, 0, PR_FALSE },
	{ /* cmd_GenKeyPair          */  'G', PR_FALSE, 0, PR_FALSE },
	{ /* cmd_PrintHelp           */  'H', PR_FALSE, 0, PR_FALSE },
	{ /* cmd_ListKeys            */  'K', PR_FALSE, 0, PR_FALSE },
	{ /* cmd_ListCerts           */  'L', PR_FALSE, 0, PR_FALSE },
	{ /* cmd_ModifyCertTrust     */  'M', PR_FALSE, 0, PR_FALSE },
	{ /* cmd_NewDBs              */  'N', PR_FALSE, 0, PR_FALSE },
	{ /* cmd_DumpChain           */  'O', PR_FALSE, 0, PR_FALSE },
	{ /* cmd_CertReq             */  'R', PR_FALSE, 0, PR_FALSE },
	{ /* cmd_CreateAndAddCert    */  'S', PR_FALSE, 0, PR_FALSE },
	{ /* cmd_TokenReset          */  'T', PR_FALSE, 0, PR_FALSE },
	{ /* cmd_ListModules         */  'U', PR_FALSE, 0, PR_FALSE },
	{ /* cmd_CheckCertValidity   */  'V', PR_FALSE, 0, PR_FALSE },
	{ /* cmd_ChangePassword      */  'W', PR_FALSE, 0, PR_FALSE },
	{ /* cmd_Version             */  'Y', PR_FALSE, 0, PR_FALSE },
	{ /* cmd_Batch               */  'B', PR_FALSE, 0, PR_FALSE }
};

secuCommandFlag certutil_options[] =
{
	{ /* opt_SSOPass             */  '0', PR_TRUE,  0, PR_FALSE },
	{ /* opt_AddKeyUsageExt      */  '1', PR_FALSE, 0, PR_FALSE },
	{ /* opt_AddBasicConstraintExt*/ '2', PR_FALSE, 0, PR_FALSE },
	{ /* opt_AddAuthorityKeyIDExt*/  '3', PR_FALSE, 0, PR_FALSE },
	{ /* opt_AddCRLDistPtsExt    */  '4', PR_FALSE, 0, PR_FALSE },
	{ /* opt_AddNSCertTypeExt    */  '5', PR_FALSE, 0, PR_FALSE },
	{ /* opt_AddExtKeyUsageExt   */  '6', PR_FALSE, 0, PR_FALSE },
	{ /* opt_ExtendedEmailAddrs  */  '7', PR_TRUE,  0, PR_FALSE },
	{ /* opt_ExtendedDNSNames    */  '8', PR_TRUE,  0, PR_FALSE },
	{ /* opt_ASCIIForIO          */  'a', PR_FALSE, 0, PR_FALSE },
	{ /* opt_ValidityTime        */  'b', PR_TRUE,  0, PR_FALSE },
	{ /* opt_IssuerName          */  'c', PR_TRUE,  0, PR_FALSE },
	{ /* opt_CertDir             */  'd', PR_TRUE,  0, PR_FALSE },
	{ /* opt_VerifySig           */  'e', PR_FALSE, 0, PR_FALSE },
	{ /* opt_PasswordFile        */  'f', PR_TRUE,  0, PR_FALSE },
	{ /* opt_KeySize             */  'g', PR_TRUE,  0, PR_FALSE },
	{ /* opt_TokenName           */  'h', PR_TRUE,  0, PR_FALSE },
	{ /* opt_InputFile           */  'i', PR_TRUE,  0, PR_FALSE },
	{ /* opt_KeyIndex            */  'j', PR_TRUE,  0, PR_FALSE },
	{ /* opt_KeyType             */  'k', PR_TRUE,  0, PR_FALSE },
	{ /* opt_DetailedInfo        */  'l', PR_FALSE, 0, PR_FALSE },
	{ /* opt_SerialNumber        */  'm', PR_TRUE,  0, PR_FALSE },
	{ /* opt_Nickname            */  'n', PR_TRUE,  0, PR_FALSE },
	{ /* opt_OutputFile          */  'o', PR_TRUE,  0, PR_FALSE },
	{ /* opt_PhoneNumber         */  'p', PR_TRUE,  0, PR_FALSE },
	{ /* opt_DBPrefix            */  'P', PR_TRUE,  0, PR_FALSE },
	{ /* opt_PQGFile             */  'q', PR_TRUE,  0, PR_FALSE },
	{ /* opt_BinaryDER           */  'r', PR_FALSE, 0, PR_FALSE },
	{ /* opt_Subject             */  's', PR_TRUE,  0, PR_FALSE },
	{ /* opt_Trust               */  't', PR_TRUE,  0, PR_FALSE },
	{ /* opt_Usage               */  'u', PR_TRUE,  0, PR_FALSE },
	{ /* opt_Validity            */  'v', PR_TRUE,  0, PR_FALSE },
	{ /* opt_OffsetMonths        */  'w', PR_TRUE,  0, PR_FALSE },
	{ /* opt_SelfSign            */  'x', PR_FALSE, 0, PR_FALSE },
	{ /* opt_RW                  */  'X', PR_FALSE, 0, PR_FALSE },
	{ /* opt_Exponent            */  'y', PR_TRUE,  0, PR_FALSE },
	{ /* opt_NoiseFile           */  'z', PR_TRUE,  0, PR_FALSE },
	{ /* opt_Hash                */  'Z', PR_TRUE,  0, PR_FALSE },
	{ /* opt_NewPasswordFile     */  '@', PR_TRUE,  0, PR_FALSE }
};


    certutil.numCommands = sizeof(certutil_commands) / sizeof(secuCommandFlag);
    certutil.numOptions = sizeof(certutil_options) / sizeof(secuCommandFlag);
    certutil.commands = certutil_commands;
    certutil.options = certutil_options;

    progName = PORT_Strrchr(argv[0], '/');
    progName = progName ? progName+1 : argv[0];

    rv = SECU_ParseCommandLine(argc, argv, progName, &certutil);

    if (rv != SECSuccess)
	Usage(progName);

    if (certutil.commands[cmd_PrintHelp].activated)
	LongUsage(progName);

    if (certutil.options[opt_PasswordFile].arg) {
	pwdata.source = PW_FROMFILE;
	pwdata.data = certutil.options[opt_PasswordFile].arg;
    }

    if (certutil.options[opt_CertDir].activated)
	SECU_ConfigDirectory(certutil.options[opt_CertDir].arg);

    if (certutil.options[opt_KeySize].activated) {
	keysize = PORT_Atoi(certutil.options[opt_KeySize].arg);
	if ((keysize < MIN_KEY_BITS) || (keysize > MAX_KEY_BITS)) {
	    PR_fprintf(PR_STDERR, 
                       "%s -g:  Keysize must be between %d and %d.\n",
		       progName, MIN_KEY_BITS, MAX_KEY_BITS);
	    return 255;
	}
#ifdef NSS_ENABLE_ECC
	if (keytype == ecKey) {
	    PR_fprintf(PR_STDERR, "%s -g:  Not for ec keys.\n", progName);
	    return 255;
	}
#endif /* NSS_ENABLE_ECC */

    }

    /*  -h specify token name  */
    if (certutil.options[opt_TokenName].activated) {
	if (PL_strcmp(certutil.options[opt_TokenName].arg, "all") == 0)
	    slotname = NULL;
	else
	    slotname = PL_strdup(certutil.options[opt_TokenName].arg);
    }

    /*  -Z hash type  */
    if (certutil.options[opt_Hash].activated) {
	char * arg = certutil.options[opt_Hash].arg;
        hashAlgTag = SECU_StringToSignatureAlgTag(arg);
        if (hashAlgTag == SEC_OID_UNKNOWN) {
	    PR_fprintf(PR_STDERR, "%s -Z:  %s is not a recognized type.\n",
	               progName, arg);
	    return 255;
	}
    }

    /*  -k key type  */
    if (certutil.options[opt_KeyType].activated) {
	char * arg = certutil.options[opt_KeyType].arg;
	if (PL_strcmp(arg, "rsa") == 0) {
	    keytype = rsaKey;
	} else if (PL_strcmp(arg, "dsa") == 0) {
	    keytype = dsaKey;
#ifdef NSS_ENABLE_ECC
	} else if (PL_strcmp(arg, "ec") == 0) {
	    keytype = ecKey;
#endif /* NSS_ENABLE_ECC */
	} else if (PL_strcmp(arg, "all") == 0) {
	    keytype = nullKey;
	} else {
	    /* use an existing private/public key pair */
	    keysource = arg;
	}
    }

    /*  -m serial number */
    if (certutil.options[opt_SerialNumber].activated) {
	int sn = PORT_Atoi(certutil.options[opt_SerialNumber].arg);
	if (sn < 0) {
	    PR_fprintf(PR_STDERR, "%s -m:  %s is not a valid serial number.\n",
	               progName, certutil.options[opt_SerialNumber].arg);
	    return 255;
	}
	serialNumber = sn;
    }

    /*  -P certdb name prefix */
    if (certutil.options[opt_DBPrefix].activated) {
        if (certutil.options[opt_DBPrefix].arg) {
            certPrefix = strdup(certutil.options[opt_DBPrefix].arg);
        } else {
            Usage(progName);
        }
    }

    /*  -q PQG file or curve name */
    if (certutil.options[opt_PQGFile].activated) {
#ifdef NSS_ENABLE_ECC
	if ((keytype != dsaKey) && (keytype != ecKey)) {
	    PR_fprintf(PR_STDERR, "%s -q: specifies a PQG file for DSA keys" \
		       " (-k dsa) or a named curve for EC keys (-k ec)\n)",
	               progName);
#else
	if (keytype != dsaKey) {
	    PR_fprintf(PR_STDERR, "%s -q: PQG file is for DSA key (-k dsa).\n)",
	               progName);
#endif /* NSS_ENABLE_ECC */
	    return 255;
	}
    }

    /*  -s subject name  */
    if (certutil.options[opt_Subject].activated) {
	subject = CERT_AsciiToName(certutil.options[opt_Subject].arg);
	if (!subject) {
	    PR_fprintf(PR_STDERR, "%s -s: improperly formatted name: \"%s\"\n",
	               progName, certutil.options[opt_Subject].arg);
	    return 255;
	}
    }

    /*  -v validity period  */
    if (certutil.options[opt_Validity].activated) {
	validityMonths = PORT_Atoi(certutil.options[opt_Validity].arg);
	if (validityMonths < 0) {
	    PR_fprintf(PR_STDERR, "%s -v: incorrect validity period: \"%s\"\n",
	               progName, certutil.options[opt_Validity].arg);
	    return 255;
	}
    }

    /*  -w warp months  */
    if (certutil.options[opt_OffsetMonths].activated)
	warpmonths = PORT_Atoi(certutil.options[opt_OffsetMonths].arg);

    /*  -y public exponent (for RSA)  */
    if (certutil.options[opt_Exponent].activated) {
	publicExponent = PORT_Atoi(certutil.options[opt_Exponent].arg);
	if ((publicExponent != 3) &&
	    (publicExponent != 17) &&
	    (publicExponent != 65537)) {
	    PR_fprintf(PR_STDERR, "%s -y: incorrect public exponent %d.", 
	                           progName, publicExponent);
	    PR_fprintf(PR_STDERR, "Must be 3, 17, or 65537.\n");
	    return 255;
	}
    }

    /*  Check number of commands entered.  */
    commandsEntered = 0;
    for (i=0; i< certutil.numCommands; i++) {
	if (certutil.commands[i].activated) {
	    commandToRun = certutil.commands[i].flag;
	    commandsEntered++;
	}
	if (commandsEntered > 1)
	    break;
    }
    if (commandsEntered > 1) {
	PR_fprintf(PR_STDERR, "%s: only one command at a time!\n", progName);
	PR_fprintf(PR_STDERR, "You entered: ");
	for (i=0; i< certutil.numCommands; i++) {
	    if (certutil.commands[i].activated)
		PR_fprintf(PR_STDERR, " -%c", certutil.commands[i].flag);
	}
	PR_fprintf(PR_STDERR, "\n");
	return 255;
    }
    if (commandsEntered == 0) {
	PR_fprintf(PR_STDERR, "%s: you must enter a command!\n", progName);
	Usage(progName);
    }

    if (certutil.commands[cmd_ListCerts].activated ||
         certutil.commands[cmd_PrintHelp].activated ||
         certutil.commands[cmd_ListKeys].activated ||
         certutil.commands[cmd_ListModules].activated ||
         certutil.commands[cmd_CheckCertValidity].activated ||
         certutil.commands[cmd_Version].activated ) {
	readOnly = !certutil.options[opt_RW].activated;
    }

    /*  -A, -D, -F, -M, -S, -V, and all require -n  */
    if ((certutil.commands[cmd_AddCert].activated ||
         certutil.commands[cmd_DeleteCert].activated ||
         certutil.commands[cmd_DeleteKey].activated ||
	 certutil.commands[cmd_DumpChain].activated ||
         certutil.commands[cmd_ModifyCertTrust].activated ||
         certutil.commands[cmd_CreateAndAddCert].activated ||
         certutil.commands[cmd_CheckCertValidity].activated) &&
        !certutil.options[opt_Nickname].activated) {
	PR_fprintf(PR_STDERR, 
	          "%s -%c: nickname is required for this command (-n).\n",
	           progName, commandToRun);
	return 255;
    }

    /*  -A, -E, -M, -S require trust  */
    if ((certutil.commands[cmd_AddCert].activated ||
         certutil.commands[cmd_AddEmailCert].activated ||
         certutil.commands[cmd_ModifyCertTrust].activated ||
         certutil.commands[cmd_CreateAndAddCert].activated) &&
        !certutil.options[opt_Trust].activated) {
	PR_fprintf(PR_STDERR, 
	          "%s -%c: trust is required for this command (-t).\n",
	           progName, commandToRun);
	return 255;
    }

    /*  if -L is given raw or ascii mode, it must be for only one cert.  */
    if (certutil.commands[cmd_ListCerts].activated &&
        (certutil.options[opt_ASCIIForIO].activated ||
         certutil.options[opt_BinaryDER].activated) &&
        !certutil.options[opt_Nickname].activated) {
	PR_fprintf(PR_STDERR, 
	        "%s: nickname is required to dump cert in raw or ascii mode.\n",
	           progName);
	return 255;
    }
    
    /*  -L can only be in (raw || ascii).  */
    if (certutil.commands[cmd_ListCerts].activated &&
        certutil.options[opt_ASCIIForIO].activated &&
        certutil.options[opt_BinaryDER].activated) {
	PR_fprintf(PR_STDERR, 
	           "%s: cannot specify both -r and -a when dumping cert.\n",
	           progName);
	return 255;
    }

    /*  For now, deny -C -x combination */
    if (certutil.commands[cmd_CreateNewCert].activated &&
        certutil.options[opt_SelfSign].activated) {
	PR_fprintf(PR_STDERR,
	           "%s: self-signing a cert request is not supported.\n",
	           progName);
	return 255;
    }

    /*  If making a cert request, need a subject.  */
    if ((certutil.commands[cmd_CertReq].activated ||
         certutil.commands[cmd_CreateAndAddCert].activated) &&
        !certutil.options[opt_Subject].activated) {
	PR_fprintf(PR_STDERR, 
	           "%s -%c: subject is required to create a cert request.\n",
	           progName, commandToRun);
	return 255;
    }

    /*  If making a cert, need a serial number.  */
    if ((certutil.commands[cmd_CreateNewCert].activated ||
         certutil.commands[cmd_CreateAndAddCert].activated) &&
         !certutil.options[opt_SerialNumber].activated) {
	/*  Make a default serial number from the current time.  */
	PRTime now = PR_Now();
	LL_USHR(now, now, 19);
	LL_L2UI(serialNumber, now);
    }

    /*  Validation needs the usage to validate for.  */
    if (certutil.commands[cmd_CheckCertValidity].activated &&
        !certutil.options[opt_Usage].activated) {
	PR_fprintf(PR_STDERR, 
	           "%s -V: specify a usage to validate the cert for (-u).\n",
	           progName);
	return 255;
    }
    
    /*  To make a cert, need either a issuer or to self-sign it.  */
    if (certutil.commands[cmd_CreateAndAddCert].activated &&
	!(certutil.options[opt_IssuerName].activated ||
          certutil.options[opt_SelfSign].activated)) {
	PR_fprintf(PR_STDERR,
	           "%s -S: must specify issuer (-c) or self-sign (-x).\n",
	           progName);
	return 255;
    }

    /*  Using slotname == NULL for listing keys and certs on all slots, 
     *  but only that. */
    if (!(certutil.commands[cmd_ListKeys].activated ||
	  certutil.commands[cmd_DumpChain].activated ||
    	  certutil.commands[cmd_ListCerts].activated) && slotname == NULL) {
	PR_fprintf(PR_STDERR,
	           "%s -%c: cannot use \"-h all\" for this command.\n",
	           progName, commandToRun);
	return 255;
    }

    /*  Using keytype == nullKey for list all key types, but only that.  */
    if (!certutil.commands[cmd_ListKeys].activated && keytype == nullKey) {
	PR_fprintf(PR_STDERR,
	           "%s -%c: cannot use \"-k all\" for this command.\n",
	           progName, commandToRun);
	return 255;
    }

    /*  -S  open outFile, temporary file for cert request.  */
    if (certutil.commands[cmd_CreateAndAddCert].activated) {
	outFile = PR_Open(certreqfile, PR_RDWR | PR_CREATE_FILE, 00660);
	if (!outFile) {
	    PR_fprintf(PR_STDERR, 
		       "%s -o: unable to open \"%s\" for writing (%ld, %ld)\n",
		       progName, certreqfile,
		       PR_GetError(), PR_GetOSError());
	    return 255;
	}
    }

    /*  Open the input file.  */
    if (certutil.options[opt_InputFile].activated) {
	inFile = PR_Open(certutil.options[opt_InputFile].arg, PR_RDONLY, 0);
	if (!inFile) {
	    PR_fprintf(PR_STDERR,
	               "%s:  unable to open \"%s\" for reading (%ld, %ld).\n",
	               progName, certutil.options[opt_InputFile].arg,
	               PR_GetError(), PR_GetOSError());
	    return 255;
	}
    }

    /*  Open the output file.  */
    if (certutil.options[opt_OutputFile].activated && !outFile) {
	outFile = PR_Open(certutil.options[opt_OutputFile].arg, 
                          PR_CREATE_FILE | PR_RDWR, 00660);
	if (!outFile) {
	    PR_fprintf(PR_STDERR,
	               "%s:  unable to open \"%s\" for writing (%ld, %ld).\n",
	               progName, certutil.options[opt_OutputFile].arg,
	               PR_GetError(), PR_GetOSError());
	    return 255;
	}
    }

    name = SECU_GetOptionArg(&certutil, opt_Nickname);

    PK11_SetPasswordFunc(SECU_GetModulePassword);

    if (PR_TRUE == initialize) {
        /*  Initialize NSPR and NSS.  */
        PR_Init(PR_SYSTEM_THREAD, PR_PRIORITY_NORMAL, 1);
        rv = NSS_Initialize(SECU_ConfigDirectory(NULL), certPrefix, certPrefix,
                            "secmod.db", readOnly ? NSS_INIT_READONLY: 0);
        if (rv != SECSuccess) {
	    SECU_PrintPRandOSError(progName);
	    rv = SECFailure;
	    goto shutdown;
        }
        initialized = PR_TRUE;
    	SECU_RegisterDynamicOids();
    }
    certHandle = CERT_GetDefaultCertDB();

    if (certutil.commands[cmd_Version].activated) {
	printf("Certificate database content version: command not implemented.\n");
    }

    if (PL_strcmp(slotname, "internal") == 0)
	slot = PK11_GetInternalKeySlot();
    else if (slotname != NULL)
	slot = PK11_FindSlotByName(slotname);

   
    if ( !slot && (certutil.commands[cmd_NewDBs].activated ||
         certutil.commands[cmd_ModifyCertTrust].activated  || 
         certutil.commands[cmd_ChangePassword].activated   ||
         certutil.commands[cmd_TokenReset].activated       ||
         certutil.commands[cmd_CreateAndAddCert].activated ||
         certutil.commands[cmd_AddCert].activated          ||
         certutil.commands[cmd_AddEmailCert].activated)) {
      
         SECU_PrintError(progName, "could not find the slot %s",slotname);
         rv = SECFailure;
         goto shutdown;
    }

    /*  If creating new database, initialize the password.  */
    if (certutil.commands[cmd_NewDBs].activated) {
	SECU_ChangePW2(slot, 0, 0, certutil.options[opt_PasswordFile].arg,
				certutil.options[opt_NewPasswordFile].arg);
    }

    /* The following 8 options are mutually exclusive with all others. */

    /*  List certs (-L)  */
    if (certutil.commands[cmd_ListCerts].activated) {
	rv = ListCerts(certHandle, name, slot,
	               certutil.options[opt_BinaryDER].activated,
	               certutil.options[opt_ASCIIForIO].activated, 
                       (outFile) ? outFile : PR_STDOUT, &pwdata);
	goto shutdown;
    }
    if (certutil.commands[cmd_DumpChain].activated) {
	rv = DumpChain(certHandle, name);
	goto shutdown;
    }
    /*  XXX needs work  */
    /*  List keys (-K)  */
    if (certutil.commands[cmd_ListKeys].activated) {
	rv = ListKeys(slot, name, 0 /*keyindex*/, keytype, PR_FALSE /*dopriv*/,
	              &pwdata);
	goto shutdown;
    }
    /*  List modules (-U)  */
    if (certutil.commands[cmd_ListModules].activated) {
	rv = ListModules();
	goto shutdown;
    }
    /*  Delete cert (-D)  */
    if (certutil.commands[cmd_DeleteCert].activated) {
	rv = DeleteCert(certHandle, name);
	goto shutdown;
    }
    /*  Delete key (-F)  */
    if (certutil.commands[cmd_DeleteKey].activated) {
	rv = DeleteKey(name, &pwdata);
	goto shutdown;
    }
    /*  Modify trust attribute for cert (-M)  */
    if (certutil.commands[cmd_ModifyCertTrust].activated) {
	if (PK11_IsFIPS() || !PK11_IsFriendly(slot)) {
	    rv = PK11_Authenticate(slot, PR_TRUE, &pwdata);
	    if (rv != SECSuccess) {
		SECU_PrintError(progName, "could not authenticate to token or database");
		goto shutdown;
	    }
	}
	rv = ChangeTrustAttributes(certHandle, name, 
	                           certutil.options[opt_Trust].arg);
	goto shutdown;
    }
    /*  Change key db password (-W) (future - change pw to slot?)  */
    if (certutil.commands[cmd_ChangePassword].activated) {
	rv = SECU_ChangePW2(slot, 0, 0, certutil.options[opt_PasswordFile].arg,
				certutil.options[opt_NewPasswordFile].arg);
	goto shutdown;
    }
    /*  Reset the a token */
    if (certutil.commands[cmd_TokenReset].activated) {
	char *sso_pass = "";

	if (certutil.options[opt_SSOPass].activated) {
	    sso_pass = certutil.options[opt_SSOPass].arg;
 	}
	rv = PK11_ResetToken(slot,sso_pass);

	goto shutdown;
    }
    /*  Check cert validity against current time (-V)  */
    if (certutil.commands[cmd_CheckCertValidity].activated) {
	/* XXX temporary hack for fips - must log in to get priv key */
	if (certutil.options[opt_VerifySig].activated) {
	    if (slot && PK11_NeedLogin(slot))
		PK11_Authenticate(slot, PR_TRUE, &pwdata);
	}
	rv = ValidateCert(certHandle, name, 
	                  certutil.options[opt_ValidityTime].arg,
			  certutil.options[opt_Usage].arg,
			  certutil.options[opt_VerifySig].activated,
			  certutil.options[opt_DetailedInfo].activated,
	                  &pwdata);
	if (rv != SECSuccess && PR_GetError() == SEC_ERROR_INVALID_ARGS)
            SECU_PrintError(progName, "validation failed");
	goto shutdown;
    }

    /*
     *  Key generation
     */

    /*  These commands may require keygen.  */
    if (certutil.commands[cmd_CertReq].activated ||
        certutil.commands[cmd_CreateAndAddCert].activated ||
	certutil.commands[cmd_GenKeyPair].activated) {
	if (keysource) {
	    CERTCertificate *keycert;
	    keycert = CERT_FindCertByNicknameOrEmailAddr(certHandle, keysource);
	    if (!keycert) {
		keycert = PK11_FindCertFromNickname(keysource, NULL);
		if (!keycert) {
		    SECU_PrintError(progName,
			    "%s is neither a key-type nor a nickname", keysource);
		    return SECFailure;
		}
	    }
	    privkey = PK11_FindKeyByDERCert(slot, keycert, &pwdata);
	    if (privkey)
		pubkey = CERT_ExtractPublicKey(keycert);
	    CERT_DestroyCertificate(keycert);
	    if (!pubkey) {
		SECU_PrintError(progName,
				"Could not get keys from cert %s", keysource);
		rv = SECFailure;
		goto shutdown;
	    }
	    keytype = privkey->keyType;
	} else {
	    privkey = 
		CERTUTIL_GeneratePrivateKey(keytype, slot, keysize,
					    publicExponent, 
					    certutil.options[opt_NoiseFile].arg,
					    &pubkey, 
					    certutil.options[opt_PQGFile].arg,
					    &pwdata);
	    if (privkey == NULL) {
		SECU_PrintError(progName, "unable to generate key(s)\n");
		rv = SECFailure;
		goto shutdown;
	    }
	}
	privkey->wincx = &pwdata;
	PORT_Assert(pubkey != NULL);

	/*  If all that was needed was keygen, exit.  */
	if (certutil.commands[cmd_GenKeyPair].activated) {
	    rv = SECSuccess;
	    goto shutdown;
	}
    }

    /*
     *  Certificate request
     */

    /*  Make a cert request (-R).  */
    if (certutil.commands[cmd_CertReq].activated) {
	rv = CertReq(privkey, pubkey, keytype, hashAlgTag, subject,
	             certutil.options[opt_PhoneNumber].arg,
	             certutil.options[opt_ASCIIForIO].activated,
		     certutil.options[opt_ExtendedEmailAddrs].arg,
		     certutil.options[opt_ExtendedDNSNames].arg,
                     certutil.options[opt_AddKeyUsageExt].activated,
                     certutil.options[opt_AddExtKeyUsageExt].activated,
                     certutil.options[opt_AddBasicConstraintExt].activated,
                     certutil.options[opt_AddAuthorityKeyIDExt].activated,
                     certutil.options[opt_AddCRLDistPtsExt].activated,
                     certutil.options[opt_AddNSCertTypeExt].activated,
                     outFile ? outFile : PR_STDOUT);
	if (rv) 
	    goto shutdown;
	privkey->wincx = &pwdata;
    }

    /*
     *  Certificate creation
     */

    /*  If making and adding a cert, create a cert request file first without
     *  any extensions, then load it with the command line extensions
     *  and output the cert to another file.
     */
    if (certutil.commands[cmd_CreateAndAddCert].activated) {
	rv = CertReq(privkey, pubkey, keytype, hashAlgTag, subject,
	             certutil.options[opt_PhoneNumber].arg,
	             certutil.options[opt_ASCIIForIO].activated,
		     NULL,
		     NULL,
                     PR_FALSE,
                     PR_FALSE,
                     PR_FALSE,
                     PR_FALSE,
                     PR_FALSE,
                     PR_FALSE,
                     outFile ? outFile : PR_STDOUT);
	if (rv) 
	    goto shutdown;
	privkey->wincx = &pwdata;
	PR_Close(outFile);
	inFile  = PR_Open(certreqfile, PR_RDONLY, 0);
	if (!inFile) {
	    PR_fprintf(PR_STDERR, "Failed to open file \"%s\" (%ld, %ld).\n",
                       certreqfile, PR_GetError(), PR_GetOSError());
	    rv = SECFailure;
	    goto shutdown;
	}
	outFile = PR_Open(certfile, PR_RDWR | PR_CREATE_FILE, 00660);
	if (!outFile) {
	    PR_fprintf(PR_STDERR, "Failed to open file \"%s\" (%ld, %ld).\n",
                       certfile, PR_GetError(), PR_GetOSError());
	    rv = SECFailure;
	    goto shutdown;
	}
    }

    /*  Create a certificate (-C or -S).  */
    if (certutil.commands[cmd_CreateAndAddCert].activated ||
         certutil.commands[cmd_CreateNewCert].activated) {
	rv = CreateCert(certHandle, 
	                certutil.options[opt_IssuerName].arg,
	                inFile, outFile, privkey, &pwdata, hashAlgTag,
	                serialNumber, warpmonths, validityMonths,
		        certutil.options[opt_ExtendedEmailAddrs].arg,
		        certutil.options[opt_ExtendedDNSNames].arg,
	                certutil.options[opt_ASCIIForIO].activated,
	                certutil.options[opt_SelfSign].activated,
	                certutil.options[opt_AddKeyUsageExt].activated,
	                certutil.options[opt_AddExtKeyUsageExt].activated,
	                certutil.options[opt_AddBasicConstraintExt].activated,
	                certutil.options[opt_AddAuthorityKeyIDExt].activated,
	                certutil.options[opt_AddCRLDistPtsExt].activated,
	                certutil.options[opt_AddNSCertTypeExt].activated);
	if (rv) 
	    goto shutdown;
    }

    /* 
     * Adding a cert to the database (or slot)
     */
 
    if (certutil.commands[cmd_CreateAndAddCert].activated) { 
	PORT_Assert(inFile != PR_STDIN);
	PR_Close(inFile);
	PR_Close(outFile);
	inFile = PR_Open(certfile, PR_RDONLY, 0);
	if (!inFile) {
	    PR_fprintf(PR_STDERR, "Failed to open file \"%s\" (%ld, %ld).\n",
                       certfile, PR_GetError(), PR_GetOSError());
	    rv = SECFailure;
	    goto shutdown;
	}
    }

    /* -A -E or -S    Add the cert to the DB */
    if (certutil.commands[cmd_CreateAndAddCert].activated ||
         certutil.commands[cmd_AddCert].activated ||
	 certutil.commands[cmd_AddEmailCert].activated) {
	rv = AddCert(slot, certHandle, name, 
	             certutil.options[opt_Trust].arg,
	             inFile, 
	             certutil.options[opt_ASCIIForIO].activated,
	             certutil.commands[cmd_AddEmailCert].activated,&pwdata);
	if (rv) 
	    goto shutdown;
    }

    if (certutil.commands[cmd_CreateAndAddCert].activated) {
	PORT_Assert(inFile != PR_STDIN);
	PR_Close(inFile);
	PR_Delete(certfile);
	PR_Delete(certreqfile);
    }

shutdown:
    if (slot) {
	PK11_FreeSlot(slot);
    }
    if (privkey) {
	SECKEY_DestroyPrivateKey(privkey);
    }
    if (pubkey) {
	SECKEY_DestroyPublicKey(pubkey);
    }

    /* Open the batch command file.
     *
     * - If -B <command line> option is specified, the contents in the
     * command file will be interpreted as subsequent certutil
     * commands to be executed in the current certutil process
     * context after the current certutil command has been executed.
     * - Each line in the command file consists of the command
     * line arguments for certutil.
     * - The -d <configdir> option will be ignored if specified in the
     * command file.
     * - Quoting with double quote characters ("...") is supported
     * to allow white space in a command line argument.  The
     * double quote character cannot be escaped and quoting cannot
     * be nested in this version.
     * - each line in the batch file is limited to 512 characters
    */

    if ((SECSuccess == rv) && certutil.commands[cmd_Batch].activated) {
	FILE* batchFile = NULL;
        char nextcommand[512];
        if (!certutil.options[opt_InputFile].activated ||
            !certutil.options[opt_InputFile].arg) {
	    PR_fprintf(PR_STDERR,
	               "%s:  no batch input file specified.\n",
	               progName);
	    return 255;
        }
        batchFile = fopen(certutil.options[opt_InputFile].arg, "r");
        if (!batchFile) {
	    PR_fprintf(PR_STDERR,
	               "%s:  unable to open \"%s\" for reading (%ld, %ld).\n",
	               progName, certutil.options[opt_InputFile].arg,
	               PR_GetError(), PR_GetOSError());
	    return 255;
        }
        /* read and execute command-lines in a loop */
        while ( (SECSuccess == rv ) &&
                fgets(nextcommand, sizeof(nextcommand), batchFile)) {
            /* we now need to split the command into argc / argv format */
            char* commandline = PORT_Strdup(nextcommand);
            PRBool invalid = PR_FALSE;
            int newargc = 2;
            char* space = NULL;
            char* nextarg = NULL;
            char** newargv = NULL;
            char* crlf = PORT_Strrchr(commandline, '\n');
            if (crlf) {
                *crlf = '\0';
            }

            newargv = PORT_Alloc(sizeof(char*)*(newargc+1));
            newargv[0] = progName;
            newargv[1] = commandline;
            nextarg = commandline;
            while ((space = PORT_Strpbrk(nextarg, " \f\n\r\t\v")) ) {
                while (isspace(*space) ) {
                    *space = '\0';
                    space ++;
                }
                if (*space == '\0') {
                    break;
                } else if (*space != '\"') {
                    nextarg = space;
                } else {
                    char* closingquote = strchr(space+1, '\"');
                    if (closingquote) {
                        *closingquote = '\0';
                        space++;
                        nextarg = closingquote+1;
                    } else {
                        invalid = PR_TRUE;
                        nextarg = space;
                    }
                }
                newargc++;
                newargv = PORT_Realloc(newargv, sizeof(char*)*(newargc+1));
                newargv[newargc-1] = space;
            }
            newargv[newargc] = NULL;
            
            /* invoke next command */
            if (PR_TRUE == invalid) {
                PR_fprintf(PR_STDERR, "Missing closing quote in batch command :\n%s\nNot executed.\n",
                           nextcommand);
                rv = SECFailure;
            } else {
                if (0 != certutil_main(newargc, newargv, PR_FALSE) )
                    rv = SECFailure;
            }
            PORT_Free(newargv);
            PORT_Free(commandline);
        }
        fclose(batchFile);
    }

    if ((initialized == PR_TRUE) && NSS_Shutdown() != SECSuccess) {
        exit(1);
    }

    if (rv == SECSuccess) {
	return 0;
    } else {
	return 255;
    }
}

int
main(int argc, char **argv)
{
    return certutil_main(argc, argv, PR_TRUE);
}
