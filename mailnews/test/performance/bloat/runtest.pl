#!/usr/bin/env perl
use strict;
use File::Spec;
use File::Path qw(rmtree mkpath);
use FindBin qw($Bin);
use Cwd qw(getcwd);
use constant IS_MAC => $^O eq 'darwin';

if (1 != @ARGV) {
  die "Usage: $0 objdir";
}

#Locate various things with full paths
my $cwd        = File::Spec->rel2abs(getcwd);
my $objdir     = File::Spec->rel2abs(shift @ARGV);
my $bindir     = File::Spec->catfile($objdir, 'mozilla', 'dist', 'bin');
my $executable = IS_MAC ? 'thunderbird-bin' : 'thunderbird';
my $bin        = File::Spec->catfile($bindir, $executable);
my $profile    = File::Spec->catfile($objdir, qw(mozilla _leaktest leakprofile));

#Wipe the profile
rmtree($profile);
mkpath($profile);

#Global defaults for all commands
my $defaults = {
env  => {
         'NO_EM_RESTART'     => 1,
         'XPCOM_DEBUG_BREAK' => 'warn',
         },
bin  => $bin,
args => ['-no-remote', IS_MAC ? qw(-foreground) : (),],
cwd  => $cwd,
};

#Specific commands that needs running to perform the tests
my @cmds = (
  {
   name => 'register',
   args => ['-register'],
  },
  {
   name => 'createProfile',
   args => ['-CreateProfile', "bloat $profile"],
  },
  {
   name => 'setupTests',
   bin  => 'python',
   args => [
            'setUpBloatTest.py',
            "--profile-dir=$profile",
            "--binary-dir=$bindir"
           ],
   cwd => $Bin,
  },
  {
   name => 'bloatTests',
   args => ['-profile', $profile],
   env  => {'XPCOM_MEM_BLOAT_LOG' => 'bloat.log'},
  },
  {
   name => 'leakTests',
   args => [
            '-profile',         $profile,
            '--trace-malloc',   'malloc.log',
            '--shutdown-leaks', 'sdleak.log',
           ],
   env => {'XPCOM_MEM_BLOAT_LOG' => 'trace-bloat.log'},
  },
);

foreach my $cmd (@cmds) {
  $cmd->{env} ||= {};

  # Some scripts rely on the cwd
  my $cwd = $cmd->{cwd} || $defaults->{cwd};
  chdir $cwd;

  #Environment settings
  my %env = (%{$defaults->{env}}, %{$cmd->{env}});

  # Setup environment
  local %ENV = (%ENV, %env);

  # Build the command
  my $bin = $defaults->{bin};
  my @args = (@{$defaults->{args}}, @{$cmd->{args}});

  # Different binary implies no default args
  if (exists $cmd->{bin}) {
    $bin  = $cmd->{bin};
    @args = @{$cmd->{args}};
  }

  my @cmd = ($bin, @args);

  print STDERR "Running $cmd->{name} in $cwd : ";
  print STDERR "@cmd ";
  print STDERR "Env: ";
  print join ' ', map { "$_='$env{$_}'" } sort keys %env;
  print "\n";
  system(@cmd);

  chdir($defaults->{cwd});
}
