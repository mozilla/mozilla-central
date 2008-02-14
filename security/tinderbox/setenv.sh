HOSTNAME=`hostname`

export NSS_ENABLE_ECC=1
export NSS_ECC_MORE_THAN_SUITE_B=1
export CVSROOT=:pserver:anonymous@cvs-mirror.mozilla.org:/cvsroot
export USER=svbld
export DOMSUF=red.iplanet.com

if [ $HOSTNAME = "attic" ]
then
	export PATH=".:/bin:/usr/bin"
elif [ $HOSTNAME = "dopushups" ]
then
	export PATH=".:/bin:/usr/bin"
elif [ $HOSTNAME = "touquet" ]
then
	export PATH=".:/bin:/usr/bin"
elif [ $HOSTNAME = "doyoga" ]
then
	export PATH=".:/bin:/usr/bin"
elif [ $HOSTNAME = "dositups" ]
then
	export PATH=".:/bin:/usr/bin:/usr/sfw/bin:/usr/dist/pkgs/sunstudio_i386,v11.0/SUNWspro/prod/bin:/usr/ucb:/usr/ccs/bin"
elif [ $HOSTNAME = "aquash" ]
then
	export PATH=".:/bin:/usr/bin:/opt/sfw/bin:/usr/dist/pkgs/sunstudio_i386,v11.0/SUNWspro/prod/bin:/usr/ucb:/usr/ccs/bin"
elif [ $HOSTNAME = "boy" ]
then
	export PATH=".:/bin:/usr/bin:/usr/sfw/bin:/usr/dist/pkgs/sunstudio_i386,v11.0/SUNWspro/prod/bin:/usr/ucb:/usr/ccs/bin"
elif [ $HOSTNAME = "malcolmx" ]
then
	export PATH=".:/bin:/usr/bin:/opt/sfw/bin:/usr/dist/pkgs/sunstudio_i386,v11.0/SUNWspro/prod/bin:/usr/ucb:/usr/ccs/bin"
elif [ $HOSTNAME = "harpsichord" ]
then
	export PATH=".:/bin:/usr/bin:/usr/sfw/bin:/usr/dist/pkgs/sunstudio_sparc,v12.0/SUNWspro/prod/bin:/usr/ucb:/usr/ccs/bin"
elif [ $HOSTNAME = "ciotat" ]
then
	export PATH=".:/bin:/usr/bin:/opt/sfw/bin:/usr/dist/pkgs/sunstudio_sparc,v12.0/SUNWspro/prod/bin:/usr/ucb:/usr/ccs/bin"
elif [ $HOSTNAME = "aygulf" ]
then
	export PATH=".:/bin:/usr/bin:/opt/sfw/bin:/usr/dist/pkgs/sunstudio_sparc,v12.0/SUNWspro/prod/bin:/usr/ucb:/usr/ccs/bin"
elif [ $HOSTNAME = "makemoney" ]
then
	export PATH=".:/bin:/usr/bin:/usr/sfw/bin:/usr/dist/pkgs/sunstudio_sparc,v12.0/SUNWspro/prod/bin:/usr/ucb:/usr/ccs/bin"
elif [ $HOSTNAME = "jesma51" ]
then
	export HOST=jesma51
	export DOMSUF=france.sun.com
	export VC_DIR="C:\\Program Files (x86)\\Microsoft Visual Studio 9.0";
	export SDK_DIR="C:\\Program Files\\Microsoft SDKs\\Windows\\v6.0A";
	export NET_DIR="C:\\WINDOWS\\Microsoft.NET\\Framework64";
	export VC_PATH="/c/Program Files (x86)/Microsoft Visual Studio 9.0"
	export VC_BIN="$VC_PATH/VC/bin/amd64:$VC_PATH/VCPackages:$VC_PATH/Common7/IDE:$VC_PATH/Common7/Tools:$VC_PATH/Common7/Tools/bin:$SDK_PATH/bin/x64:$SDK_PATH/bin/win64/x64:$SDK_PATH/bin:$NET_PATH/v3.5:$NET_PATH/v3.5/Microsoft .NET Framework 3.5 (Pre-Release Version):$NET_PATH/v2.0.50727";
	export VC_LIB="$VC_DIR\\VC\\ATLMFC\\lib\\amd64;$VC_DIR\\VC\\lib\\amd64;$SDK_DIR\\lib\\x64";
	export VC_INC="$VC_DIR\\VC\\ATLMFC\\include;$VC_DIR\\VC\\include;$SDK_DIR\\include";
	export INCLUDE=$VC_INC
	export LIB=$VC_LIB
	export PATH=".:/bin:/usr/local/bin:/mingw/bin:/c/windows/system32:/c/windows/system32/wbem:$VC_BIN:$SDK_DIR/bin:/c/moztools/bin"
fi

