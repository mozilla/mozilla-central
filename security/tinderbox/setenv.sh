HOSTNAME=`hostname`

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
	export PATH=".:/bin:/usr/bin:/usr/sfw/bin:/usr/dist/pkgs/sunstudio_sparc,v10.0/SUNWspro/prod/bin:/usr/ucb:/usr/ccs/bin"
elif [ $HOSTNAME = "ciotat" ]
then
	export PATH=".:/bin:/usr/bin:/opt/sfw/bin:/usr/dist/pkgs/sunstudio_sparc,v10.0/SUNWspro/prod/bin:/usr/ucb:/usr/ccs/bin"
elif [ $HOSTNAME = "aygulf" ]
then
	export PATH=".:/bin:/usr/bin:/opt/sfw/bin:/usr/dist/pkgs/sunstudio_sparc,v10.0/SUNWspro/prod/bin:/usr/ucb:/usr/ccs/bin"
elif [ $HOSTNAME = "makemoney" ]
then
	export PATH=".:/bin:/usr/bin:/usr/sfw/bin:/usr/dist/pkgs/sunstudio_sparc,v10.0/SUNWspro/prod/bin:/usr/ucb:/usr/ccs/bin"
fi

export NSS_ENABLE_ECC=1
export NSS_ECC_MORE_THAN_SUITE_B=1
export CVSROOT=:pserver:anonymous@cvs-mirror.mozilla.org:/cvsroot
export USER=svbld
export DOMSUF=red.iplanet.com
