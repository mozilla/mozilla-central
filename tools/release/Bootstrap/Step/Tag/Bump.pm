#
# Tag::Bump substep. Bumps version files for Mozilla appropriately.
# 
package Bootstrap::Step::Tag::Bump;

use strict;

use File::Copy qw(move);

use MozBuild::Util qw(MkdirWithPath);

use Bootstrap::Util qw(CvsCatfile);
use Bootstrap::Step;
use Bootstrap::Config;
use Bootstrap::Step::Tag;

our @ISA = ("Bootstrap::Step::Tag");

sub Execute {
    my $this = shift;

    my $config = new Bootstrap::Config();
    my $product = $config->Get(var => 'product');
    my $productTag = $config->Get(var => 'productTag');
    my $branchTag = $config->Get(var => 'branchTag');
    my $pullDate = $config->Get(var => 'pullDate');
    my $version = $config->GetVersion(longName => 0);
    my $appVersion = $config->GetAppVersion();
    my $build = int($config->Get(var => 'build'));
    my $milestone = $config->Get(var => 'milestone');
    my $appName = $config->Get(var => 'appName');
    my $logDir = $config->Get(sysvar => 'logDir');
    my $mozillaCvsroot = $config->Get(var => 'mozillaCvsroot');
    my $hgToolsRepo = $config->Get(var => 'hgToolsRepo');
    my $tagDir = $config->Get(var => 'tagDir');
    my $geckoBranchTag = $config->Get(var => 'geckoBranchTag');

    my $releaseTag = $productTag . '_RELEASE';
    my $buildTag = $productTag . '_BUILD' . $build;

    my $buildTagDir = catfile($tagDir, $buildTag);
    my $cvsrootTagDir = catfile($buildTagDir, 'cvsroot');
 
    ## TODO - we need to handle the case here where we're in security firedrill
    ## mode, and we need to bump versions on the GECKO_ branch, but they
    ## won't have "pre" in them. :-o
    #
    # We only do the bump step for build1

    if ($build > 1) {
        $this->Log(msg => "Skipping Tag::Bump::Execute substep for build $build.");
        return;
    }

    # pull version files
    my $moduleVer = CvsCatfile($appName, 'app', 'module.ver');
    my $versionTxt = CvsCatfile($appName, 'config', 'version.txt');
    my $milestoneTxt = CvsCatfile('config', 'milestone.txt');

    my @bumpFiles = ('client.mk', $moduleVer, $versionTxt);

    # milestone changes only occur with Firefox releases
    if ($product eq 'firefox') {
        @bumpFiles = (@bumpFiles, $milestoneTxt);
    }

    # Check out Mozilla from the branch you want to tag.
    # TODO this should support running without branch tag or pull date.
    $this->CvsCo(
      cvsroot => $mozillaCvsroot,
      tag => $geckoBranchTag,
      modules => [CvsCatfile('mozilla', 'client.mk'),
                  CvsCatfile('mozilla', $appName, 'app', 'module.ver'),
                  CvsCatfile('mozilla', $appName, 'config', 'version.txt'),
                  CvsCatfile('mozilla', 'config', 'milestone.txt')],
      workDir => $cvsrootTagDir,
      logFile => catfile($logDir, 'tag-bump_checkout.log')
    );

    ### Perform version bump

    # bug 449208 moved this logic to an external script to more easily
    # support both CVS and Mercurial based releases
    $this->Shell(
      cmd => 'hg',
      cmdArgs => ['clone', $hgToolsRepo],
      dir => catfile($buildTagDir)
    );
    $this->Shell(
      cmd => 'perl',
      cmdArgs => [catfile($buildTagDir, 'tools', 'release', 'version-bump.pl'),
                  '-w', catfile($cvsrootTagDir, 'mozilla'),
                  '-t', $releaseTag,
                  '-a', $appName,
                  '-v', $appVersion,
                  '-m', $milestone,
                  @bumpFiles],
      logFile => catfile($logDir, 'tag-bump_files.log'),
    );

    my $bumpCiMsg = 'Automated checkin: version bump, remove pre tag for ' 
                        . $product . ' ' . $version . ' release on ' 
                        . $geckoBranchTag;
    $this->Shell(
      cmd => 'cvs',
      cmdArgs => ['commit', '-m', $bumpCiMsg, 
                  @bumpFiles,
                 ],
      dir => catfile($buildTagDir, 'cvsroot', 'mozilla'),
      logFile => catfile($logDir, 'tag-bump_checkin.log'),
    );
}

sub Verify {
    my $this = shift;

    my $config = new Bootstrap::Config();
    my $logDir = $config->Get(sysvar => 'logDir');
    my $appName = $config->Get(var => 'appName');
    my $product = $config->Get(var => 'product');
    my $milestone = $config->Exists(var => 'milestone') ? 
     $config->Get(var => 'milestone') : undef;
    my $build = $config->Get(var => 'build');

    if ($build > 1) {
        $this->Log(msg => "Skipping Tag::Bump::Verify substep for build $build.");
        return;
    }

    my $moduleVer = catfile($appName, 'app', 'module.ver');
    my $versionTxt = catfile($appName, 'config', 'version.txt');
    my $milestoneTxt = catfile('config', 'milestone.txt');
    my @bumpFiles = ('client.mk', $moduleVer, $versionTxt);

    # milestone changes only occur with Firefox releases
    if ($product eq 'firefox') {
        @bumpFiles = (@bumpFiles, $milestoneTxt);
    }

    foreach my $file (@bumpFiles) {
        $this->CheckLog(
          log => catfile($logDir, 'tag-bump_checkin.log'),
          checkFor => $file,
        );
    }
}

1;
