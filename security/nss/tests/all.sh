#!/bin/sh
#
# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is the Netscape security libraries.
#
# The Initial Developer of the Original Code is
# Netscape Communications Corporation.
# Portions created by the Initial Developer are Copyright (C) 1994-2000
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

########################################################################
#
# mozilla/security/nss/tests/all.sh
#
# Script to start all available NSS QA suites on one machine
# this script is called or sourced by nssqa which runs on all required 
# platforms
#
# needs to work on all Unix and Windows platforms
#
# currently available NSS QA suites:
# --------------------------------------------------
#   cert.sh   - exercises certutil and creates certs necessary for all 
#               other tests
#   ssl.sh    - tests SSL V2 SSL V3 and TLS
#   smime.sh  - S/MIME testing
#   crmf.sh   - CRMF/CMMF testing
#   sdr.sh    - test NSS SDR
#   cipher.sh - test NSS ciphers
#   perf.sh   - Nightly performance measurments
#   tools.sh  - Tests the majority of the NSS tools
#   fips.sh   - Tests basic functionallity of NSS in FIPS-compliant mode
#
# special strings
# ---------------
#   FIXME ... known problems, search for this string
#   NOTE .... unexpected behavior
#
# NOTE:
# -----
#    Unlike the old QA this is based on files sourcing each other
#    This is done to save time, since a great portion of time is lost
#    in calling and sourcing the same things multiple times over the
#    network. Also, this way all scripts have all shell function  available
#    and a completely common environment
#
# file tells the test suite that the output is going to a log, so any
#  forked() children need to redirect their output to prevent them from
#  being over written.
#
########################################################################

run_tests()
{
  for i in ${TESTS}
    do
      SCRIPTNAME=${i}.sh
      if [ "$O_CRON" = "ON" ]
      then
        echo "Running tests for $i" >> ${LOGFILE}
        echo "TIMESTAMP $i BEGIN: `date`" >> ${LOGFILE}
        (cd ${QADIR}/$i ; . ./$SCRIPTNAME all file >> ${LOGFILE} 2>&1)
        echo "TIMESTAMP $i END: `date`" >> ${LOGFILE}
      else
        echo "Running tests for $i" | tee -a ${LOGFILE}
        echo "TIMESTAMP $i BEGIN: `date`" | tee -a ${LOGFILE}
        (cd ${QADIR}/$i ; . ./$SCRIPTNAME all file 2>&1 | tee -a ${LOGFILE})
        echo "TIMESTAMP $i END: `date`" | tee -a ${LOGFILE}
      fi
    done
}

LIBPKIX=
NSS_DEFAULT_DB_TYPE="dbm"
if [ -n "$BUILD_LIBPKIX_TESTS" ] ; then
    LIBPKIX=libpkix
fi

tests="cipher perf ${LIBPKIX} cert dbtests tools fips sdr crmf smime ssl ocsp"
TESTS=${TESTS:-$tests}
SCRIPTNAME=all.sh
CLEANUP="${SCRIPTNAME}"
cd `dirname $0`	# will cause problems if sourced 

#all.sh should be the first one to try to source the init 
if [ -z "${INIT_SOURCED}" -o "${INIT_SOURCED}" != "TRUE" ]; then
    cd common
    . ./init.sh
fi

OLD_HOSTDIR="${HOSTDIR}"
OLD_TESTS="${TESTS}"
OLD_NSS_TEST_SERVER_CLIENT_BYPASS="${NSS_TEST_SERVER_CLIENT_BYPASS}"
OLD_NSS_TEST_DISABLE_FIPS="${NSS_TEST_DISABLE_FIPS}"

# test the old DATABASE
run_tests

if [ -z "$NSS_TEST_DISABLE_PKIX" ] ; then
    NSS_ENABLE_PKIX_VERIFY="1"
    export NSS_ENABLE_PKIX_VERIFY

    TABLE_ARGS="bgcolor=cyan"
    TESTS=`echo "${OLD_TESTS}" | sed -e "s/cipher//" -e "s/libpkix//"`
    NSS_TEST_SERVER_CLIENT_BYPASS="1"
    NSS_TEST_DISABLE_FIPS="1"

    HOSTDIR="${HOSTDIR}/pkix"
    mkdir -p "${HOSTDIR}"
    init_directories

    run_tests
    
    unset NSS_ENABLE_PKIX_VERIFY

    TABLE_ARGS=
    NSS_TEST_SERVER_CLIENT_BYPASS="${OLD_NSS_TEST_SERVER_CLIENT_BYPASS}"
    NSS_TEST_DISABLE_FIPS="${OLD_NSS_TEST_DISABLE_FIPS}"
    HOSTDIR="${OLD_HOSTDIR}"
fi

# 'reset' the databases to initial values
echo "Reset databases to their initial values:" | tee -a ${LOGFILE}
cd ${HOSTDIR}
certutil -D -n objsigner -d alicedir 2>&1 | tee -a ${LOGFILE} 
certutil -M -n FIPS_PUB_140_Test_Certificate -t "C,C,C" -d fips -f ${FIPSPWFILE} 2>&1 | tee -a ${LOGFILE} 
certutil -L -d fips 2>&1 | tee -a ${LOGFILE} 
rm -f smime/alicehello.env

# test upgrade to the new database
echo "nss" > ${PWFILE}
TABLE_ARGS="bgcolor=pink"
html_head "Legacy to shared Library update"
dirs="alicedir bobdir CA cert_extensions client clientCA dave eccurves eve ext_client ext_server SDR server serverCA tools/copydir"
for i in $dirs
do
   echo $i
   if [ -d $i ]; then
	echo "upgrading db $i"  | tee -a ${LOGFILE}
	certutil -G -g 512 -d sql:$i -f ${PWFILE} -z ${NOISE_FILE} 2>&1 | tee -a ${LOGFILE} 
	html_msg $? 0 "Upgrading $i"
   else
	echo "skipping db $i" | tee -a ${LOGFILE}
	html_msg 0 0 "No directory $i"
   fi
done

if [ -d fips ]; then
   echo "upgrading db fips" | tee -a ${LOGFILE}
   certutil -S -g 512 -n tmprsa -t "u,u,u" -s "CN=tmprsa, C=US" -x -d sql:fips -f ${FIPSPWFILE} -z ${NOISE_FILE} 2>&1 | tee -a ${LOGFILE}
   html_msg $? 0 "Upgrading fips"
   # remove our temp certificate we created in the fist token
   certutil -F -n tmprsa -d sql:fips -f ${FIPSPWFILE} 2>&1 | tee -a ${LOGFILE}
   certutil -L -d sql:fips 2>&1 | tee -a ${LOGFILE}
fi

html "</TABLE><BR>"

if [ -n "$RUN_SHARED_DB_TESTS" ] ; then
NSS_DEFAULT_DB_TYPE="sql"
export NSS_DEFAULT_DB_TYPE

# run run the subset of tests with the upgraded database
TESTS="tools fips sdr crmf smime ssl ocsp"
run_tests


# test the new DATABASE
TESTS=${OLD_TESTS}
#force IOPR tests off for now...
unset IOPR_HOSTADDR_LIST
mkdir -p ${HOSTDIR}/sharedb
saveHostDIR=${HOSTDIR}

# need a function in init.sh to rebase the directories!
HOSTDIR=${HOSTDIR}/sharedb

TMP=${HOSTDIR}
TEMP=${TMP}
TMPDIR=${TMP}

CADIR=${HOSTDIR}/CA
SERVERDIR=${HOSTDIR}/server
CLIENTDIR=${HOSTDIR}/client
ALICEDIR=${HOSTDIR}/alicedir
BOBDIR=${HOSTDIR}/bobdir
DAVEDIR=${HOSTDIR}/dave
EVEDIR=${HOSTDIR}/eve
FIPSDIR=${HOSTDIR}/fips
DBPASSDIR=${HOSTDIR}/dbpass
ECCURVES_DIR=${HOSTDIR}/eccurves

SERVER_CADIR=${HOSTDIR}/serverCA
CLIENT_CADIR=${HOSTDIR}/clientCA
EXT_SERVERDIR=${HOSTDIR}/ext_server
EXT_CLIENTDIR=${HOSTDIR}/ext_client

IOPR_CADIR=${HOSTDIR}/CA_iopr
IOPR_SERVERDIR=${HOSTDIR}/server_iopr
IOPR_CLIENTDIR=${HOSTDIR}/client_iopr

P_SERVER_CADIR=${SERVER_CADIR}
P_CLIENT_CADIR=${CLIENT_CADIR}

CERT_EXTENSIONS_DIR=${HOSTDIR}/cert_extensions

PWFILE=${TMP}/tests.pw.$$
NOISE_FILE=${TMP}/tests_noise.$$
CORELIST_FILE=${TMP}/clist.$$

FIPSPWFILE=${TMP}/tests.fipspw.$$
FIPSBADPWFILE=${TMP}/tests.fipsbadpw.$$
FIPSP12PWFILE=${TMP}/tests.fipsp12pw.$$

echo "fIps140" > ${FIPSPWFILE}
echo "fips104" > ${FIPSBADPWFILE}
echo "pKcs12fips140" > ${FIPSP12PWFILE}


# run the tests for native sharedb support
TABLE_ARGS="bgcolor=yellow"
html_head "Testing with shared Library"
html "</TABLE><BR>"
run_tests
fi


SCRIPTNAME=all.sh

. ${QADIR}/common/cleanup.sh
