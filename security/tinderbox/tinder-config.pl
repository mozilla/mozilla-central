$BuildAdministrator = 'slavomir.katuscak@sun.com';

$Tinderbox_server   = 'tinderbox-daemon@tinderbox.mozilla.org';
#$Tinderbox_server   = 'slavomir.katuscak@sun.com';

$mail               = 'rsh mace.red.iplanet.com -l svbld /bin/mail';
$CVS                = 'cvs -d :pserver:anonymous@63.245.209.14:/cvsroot';

if ($hostname eq 'attic') {
    $DbgObjDir64 = 'Linux2.4_x86_64_glibc_PTH_64_DBG.OBJ';
    $OptObjDir64 = 'Linux2.4_x86_64_glibc_PTH_64_OPT.OBJ';
    $DbgObjDir32 = 'Linux2.4_x86_glibc_PTH_DBG.OBJ';
    $OptObjDir32 = 'Linux2.4_x86_glibc_PTH_OPT.OBJ';
    $JavaHome64  = '/opt/jdk/1.6.0_01/Linux-amd64';
    $JavaHome32  = '/opt/jdk/1.6.0_01/Linux';
    $BuildBits   = 'both'; 
    $Branch      = 'securitytip';
    $BuildSleep  = 30;
}

if ($hostname eq 'dopushups') {
    $DbgObjDir32 = 'Linux2.4_x86_glibc_PTH_DBG.OBJ';
    $OptObjDir32 = 'Linux2.4_x86_glibc_PTH_OPT.OBJ';
    $BuildBits   = '32'; 
    $Branch      = 'securitytip';
    $NSSTests    = 'memleak';
    $SkipJSS     = '1';
}

if ($hostname eq 'touquet') {
    $DbgObjDir64 = 'Linux2.6_x86_64_glibc_PTH_64_DBG.OBJ';
    $OptObjDir64 = 'Linux2.6_x86_64_glibc_PTH_64_OPT.OBJ';
    $DbgObjDir32 = 'Linux2.6_x86_glibc_PTH_DBG.OBJ';
    $OptObjDir32 = 'Linux2.6_x86_glibc_PTH_OPT.OBJ';
    $JavaHome64  = '/opt/jdk/1.6.0_01/Linux-amd64';
    $JavaHome32  = '/opt/jdk/1.6.0_01/Linux';
    $BuildBits   = 'both'; 
    $Branch      = 'securityjes5';
}

if ($hostname eq 'doyoga') {
    $DbgObjDir32 = 'Linux2.4_x86_glibc_PTH_DBG.OBJ';
    $OptObjDir32 = 'Linux2.4_x86_glibc_PTH_OPT.OBJ';
    $BuildBits   = '32'; 
    $Branch      = 'securityjes5';
    $NSSTests    = 'memleak';
    $SkipJSS     = '1';
}

if ($hostname eq 'dositups') {
    $DbgObjDir64 = 'SunOS5.10_i86pc_64_DBG.OBJ';
    $OptObjDir64 = 'SunOS5.10_i86pc_64_OPT.OBJ';
    $DbgObjDir32 = 'SunOS5.10_i86pc_DBG.OBJ';
    $OptObjDir32 = 'SunOS5.10_i86pc_OPT.OBJ';
    $JavaHome64  = '/opt/jdk/1.6.0_01/SunOS_amd64';
    $JavaHome32  = '/opt/jdk/1.6.0_01/SunOS_x86';
    $BuildBits   = 'both';
    $Branch      = 'securitytip';
    $BuildSleep  = 30;
}

if ($hostname eq 'aquash') {
    $DbgObjDir32 = 'SunOS5.9_i86pc_DBG.OBJ';
    $OptObjDir32 = 'SunOS5.9_i86pc_OPT.OBJ';
    $BuildBits   = '32'; 
    $Branch      = 'securitytip';
    $NSSTests    = 'memleak';
    $SkipJSS     = '1';
    $BuildSleep  = 30;
}

if ($hostname eq 'boy') {
    $DbgObjDir64 = 'SunOS5.10_i86pc_64_DBG.OBJ';
    $OptObjDir64 = 'SunOS5.10_i86pc_64_OPT.OBJ';
    $DbgObjDir32 = 'SunOS5.10_i86pc_DBG.OBJ';
    $OptObjDir32 = 'SunOS5.10_i86pc_OPT.OBJ';
    $JavaHome64  = '/opt/jdk/1.6.0_01/SunOS_amd64';
    $JavaHome32  = '/opt/jdk/1.6.0_01/SunOS_x86';
    $BuildBits   = 'both'; 
    $Branch      = 'securityjes5';
}

if ($hostname eq 'malcolmx') {
    $DbgObjDir32 = 'SunOS5.9_i86pc_DBG.OBJ';
    $OptObjDir32 = 'SunOS5.9_i86pc_OPT.OBJ';
    $BuildBits   = '32';
    $Branch      = 'securityjes5';
    $NSSTests    = 'memleak';
    $SkipJSS     = '1';
}

if ($hostname eq 'harpsichord') {
    $DbgObjDir64 = 'SunOS5.10_64_DBG.OBJ';
    $OptObjDir64 = 'SunOS5.10_64_OPT.OBJ';
    $DbgObjDir32 = 'SunOS5.10_DBG.OBJ';
    $OptObjDir32 = 'SunOS5.10_OPT.OBJ';
    $JavaHome64  = '/opt/jdk/1.6.0_01/SunOS64';
    $JavaHome32  = '/opt/jdk/1.6.0_01/SunOS';
    $BuildBits   = 'both'; 
    $Branch      = 'securitytip';
}

if ($hostname eq 'ciotat') {
    $DbgObjDir64 = 'SunOS5.9_64_DBG.OBJ';
    $OptObjDir64 = 'SunOS5.9_64_OPT.OBJ';
    $DbgObjDir32 = 'SunOS5.9_DBG.OBJ';
    $OptObjDir32 = 'SunOS5.9_OPT.OBJ';
    $BuildBits   = 'both'; 
    $Branch      = 'securitytip';
    $NSSTests    = 'memleak';
    $SkipJSS     = '1';
}

if ($hostname eq 'aygulf') {
    $DbgObjDir64 = 'SunOS5.9_64_DBG.OBJ';
    $OptObjDir64 = 'SunOS5.9_64_OPT.OBJ';
    $DbgObjDir32 = 'SunOS5.9_DBG.OBJ';
    $OptObjDir32 = 'SunOS5.9_OPT.OBJ';
    $JavaHome64  = '/opt/jdk/1.6.0_01/SunOS64';
    $JavaHome32  = '/opt/jdk/1.6.0_01/SunOS';
    $BuildBits   = 'both'; 
    $Branch      = 'securityjes5';
}

if ($hostname eq 'makemoney') {
    $DbgObjDir64 = 'SunOS5.10_64_DBG.OBJ';
    $OptObjDir64 = 'SunOS5.10_64_OPT.OBJ';
    $DbgObjDir32 = 'SunOS5.10_DBG.OBJ';
    $OptObjDir32 = 'SunOS5.10_OPT.OBJ';
    $BuildBits   = 'both'; 
    $Branch      = 'securityjes5';
    $NSSTests    = 'memleak';
    $SkipJSS     = '1';
}

if ($hostname eq 'GORIDE') {
    $DbgObjDir32 = 'WINNT5.2_DBG.OBJ';
    $OptObjDir32 = 'WINNT5.2_OPT.OBJ';
    $JavaHome32  = 'C:/Progra~1/Java/jdk1.6.0_01';
    $BuildBits   = '32';
    $Branch      = 'securitytip';
}

if ($hostname eq 'NSS-W2KP') {
    $DbgObjDir32 = 'WINNT5.1_DBG.OBJ';
    $OptObjDir32 = 'WINNT5.1_OPT.OBJ';
    $JavaHome32  = 'C:/Progra~1/Java/jdk1.6.0_01';
    $BuildBits   = '32';
    $Branch      = 'securityjes5';
}

if ($hostname eq 'JESMA51') {
    $DbgObjDir64 = 'WINNT5.2_64_DBG.OBJ';
    $OptObjDir64 = 'WINNT5.2_64_OPT.OBJ';
    $JavaHome64  = "/c/Progra~1/Java/jdk1.6.0_04";
    $BuildBits   = '64';
    $Branch      = 'securitytip';
}
