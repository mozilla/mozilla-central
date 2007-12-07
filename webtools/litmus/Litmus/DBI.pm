# -*- mode: cperl; c-basic-offset: 8; indent-tabs-mode: nil; -*-

=head1 COPYRIGHT

 # ***** BEGIN LICENSE BLOCK *****
 # Version: MPL 1.1
 #
 # The contents of this file are subject to the Mozilla Public License
 # Version 1.1 (the "License"); you may not use this file except in
 # compliance with the License. You may obtain a copy of the License
 # at http://www.mozilla.org/MPL/
 #
 # Software distributed under the License is distributed on an "AS IS"
 # basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See
 # the License for the specific language governing rights and
 # limitations under the License.
 #
 # The Original Code is Litmus.
 #
 # The Initial Developer of the Original Code is
 # the Mozilla Corporation.
 # Portions created by the Initial Developer are Copyright (C) 2006
 # the Initial Developer. All Rights Reserved.
 #
 # Contributor(s):
 #   Chris Cooper <ccooper@deadsquid.com>
 #   Zach Lipton <zach@zachlipton.com>
 #
 # ***** END LICENSE BLOCK *****

=cut

#########################################################################
# We're overiding at the base level so we can subclass some functions to grab
# auditing information automatically.
package AuditDBI;
use strict;
use base 'DBIx::ContextualFetch';

#########################################################################
package AuditDBI::db;
use base 'DBIx::ContextualFetch::db';
use Litmus::Config;

sub do {
    my ($dbh) = shift;
    my ($sql) =  shift;
    my ($attr) = shift;
    my @bind_values = @_;
    
    my $rv = $dbh->SUPER::do($sql,$attr,@bind_values);
    
    if ($rv and $Litmus::Config::AUDIT_TRAIL) {
        my $audit_rv = $dbh->_audit_action($sql,@bind_values);  
    }    
    return $rv;
}

sub _audit_action {
    my ($dbh) = shift;
    my ($sql) = shift;
    my @bind_values = @_;

    my ($action_type) = ($sql =~ /^(INSERT|UPDATE|DELETE)/i);
    $action_type = uc($action_type);
    if (&_ignore_this_action($action_type,$sql)) {
        return 1;
    }

    my $user = Litmus::Auth::getCurrentUser();
    if (!$user or
        !$user->isInAdminGroup()) {
        return 1;
    }
    
    my $bind_values_string = &_bind_values_to_string(@bind_values);
    
    my $audit_sql = "INSERT INTO audit_trail (user_id,action_timestamp,action_type,sql_log,bind_values) VALUES (?,NOW(),?,?,?)";
    my $rv = $dbh->SUPER::do($audit_sql,
                             undef,
                             $user->{'user_id'},
                             $action_type,
                             $sql,
                             $bind_values_string
                            );

    return $rv;
}

sub _bind_values_to_string {
    my $bind_values_string = "";
    
    foreach my $bind_value (@_) {
        if ($bind_values_string ne "") {
            $bind_values_string .= ",";
        }
        next if (!$bind_value);
        if ($bind_value =~ /^\d+$/) {
            $bind_values_string .= $bind_value;
        } else {
            $bind_values_string .= "'" . $bind_value . "'";
        }
    }
    
    return $bind_values_string;
}

sub _ignore_this_action {
    my ($action_type,$sql) = @_;

    if (%Litmus::Config::AUDIT_ACTIONS_TO_IGNORE) {
        if ($Litmus::Config::AUDIT_ACTIONS_TO_IGNORE{$action_type} and
            scalar $Litmus::Config::AUDIT_ACTIONS_TO_IGNORE{$action_type} > 0) {
            foreach my $table_name (@{$Litmus::Config::AUDIT_ACTIONS_TO_IGNORE{$action_type}}) {
                if ($sql =~ /^$action_type\s+(INTO|FROM|)\s*$table_name/i) {
                    return 1;
                }
            }
        }
    }

    return 0;
}

#########################################################################
package AuditDBI::st;
use base 'DBIx::ContextualFetch::st';
use Litmus::Config;

sub execute {
    my ($sth) = shift;
    my @bind_values = @_;
    
    if ($sth->{Statement} =~ /^(INSERT|UPDATE|DELETE)/i) {
        my $rv = $sth->SUPER::execute(@bind_values);    
        if ($rv and $Litmus::Config::AUDIT_TRAIL) {
          my $dbh = $sth->{Database};
          my $audit_rv = $dbh->_audit_action($sth->{Statement},@bind_values);
        }
        return $rv;
    }

    return $sth->SUPER::execute(@bind_values);
}

######################################################################### 
package Litmus::DBI;

require Apache::DBI;
use strict;
use warnings;
use Class::DBI;
use DBI;
use Encode qw( encode_utf8 decode_utf8 );
use Litmus::Config;
use Litmus::Memoize;
use utf8;

use base qw( Exporter Class::Data::Inheritable Class::DBI::mysql );
use Class::DBI::Plugin::RetrieveAll;

use constant MP2 => ( exists $ENV{MOD_PERL_API_VERSION} and 
                        $ENV{MOD_PERL_API_VERSION} >= 2 ); 
use constant MP1 => ( exists $ENV{MOD_PERL} and 
                        ! exists $ENV{MOD_PERL_API_VERSION});  

# export the following functions..
our @EXPORT = (qw(  utf8_all_columns utf8_columns ));

our $dsn = "dbi:mysql(RootClass=AuditDBI):database=$Litmus::Config::db_name;host=$Litmus::Config::db_host;port=$Litmus::Config::db_port";
Litmus::DBI->connection($dsn,
                        $Litmus::Config::db_user,
                        $Litmus::Config::db_pass,
                        {mysql_enable_utf8 => 1,
                         wait_timeout => 60*60*8}
);

our $readonly_dbh;

our %column_aliases;

Litmus::DBI->autoupdate(0);

# add an accessor to store which columns are utf8-enabled
Class::DBI->mk_classdata('_utf8_columns');

# In some cases, we have column names that make sense from a database perspective
# (i.e. subgroup_id), but that don't make sense from a class/object perspective 
# (where subgroup would be more appropriate). To handle this, we allow for 
# Litmus::DBI's subclasses to set column aliases with the column_alias() sub. 
# Takes the database column name and the alias name.
sub column_alias {
    my ($self, $db_name, $alias_name) = @_;

    $column_aliases{$alias_name} = $db_name;
}

# here's where the actual work happens. We consult our alias list 
# (as created by calls to column_alias()) and substitute the 
# database column if we find a match
memoize('find_column', persist=>1);
sub find_column {
    my $self = shift;
    my $wanted = shift;

    if (ref $self) {
        $wanted =~ s/^.*::(\w+)$/$1/;
    }
    if ($column_aliases{$wanted}) {
        return $column_aliases{$wanted};
    } else {
        # not an alias, so we use the normal 
        # find_column() from Class::DBI
        $self->SUPER::find_column($wanted);
    }
}

sub AUTOLOAD {
    my $self = shift;
    my @args = @_;
    my $name = our $AUTOLOAD;
    
    my $col = $self->find_column($name);
    if (!$col) {
        lastDitchError("tried to call Litmus::DBI method $name which does not exist");
    }
    
    return $self->$col(@args);
}

sub _log {
    my ($self, $message, %info) = @_;
    binmode(STDERR,':utf8');
    print STDERR "$message";
    return;
}

# DBI error handler for SQL errors:        
sub _croak {
	my ($self, $message, %info) = @_;
	lastDitchError($message);
	return;
}

sub lastDitchError($) {
    my $message = shift;
    print "Error - Litmus has suffered a serious fatal internal error - $message";
    exit;
}

# hack around a bug where auto_increment columns don't work properly unless 
# the auto_increment key is explicitly set to null in insert statements:
sub _auto_increment_value {
	my $self = shift;
	my $dbh  = $self->db_Main;
	my $id;
	eval { 
		my $sth = $dbh->prepare("SELECT LAST_INSERT_ID()");
		$sth->execute();
		my @data = $sth->fetchrow_array();
		$id = $data[0];
	} or return $self->SUPER::_auto_increment_value();
	if (! defined $id) { return $self->SUPER::_auto_increment_value() }
	return $id;
}

sub db_ReadOnly() {
    my $class = shift;    

    if (defined $Litmus::Config::db_host_ro) {
      if (!$readonly_dbh or
          !$readonly_dbh->ping()) {
        my $readonly_dsn = "dbi:mysql:database=$Litmus::Config::db_name_ro;host=$Litmus::Config::db_host_ro;port=$Litmus::Config::db_port_ro";
        $readonly_dbh = DBI->connect($readonly_dsn,
                                     $Litmus::Config::db_user_ro,
                                     $Litmus::Config::db_pass_ro,
                                     {ReadOnly => 1}
                                    );
      }
    }
    return $readonly_dbh if ($readonly_dbh);

    return $class->db_Main();
}

sub utf8_all_columns {
  my $class = shift;
  $class->utf8_columns( $class->columns('All') );
}

sub utf8_columns {
  my $class = shift;
  # the default
  $class->_utf8_columns([]) unless $class->_utf8_columns;

  # a getter?
  return @{ $class->_utf8_columns } unless @_;

  my @columns = @_;
  push @{ $class->_utf8_columns }, @columns;

  $class->add_trigger($_ => sub { 
    my ($self) = @_;
    for (@columns) {
      next if ref($self->{$_});
      utf8::upgrade( $self->{$_} ) if defined($self->{$_});
    }

  }) for qw( before_create before_update );

  $class->add_trigger(select => sub { 
    my ($self) = @_;

    for (@columns) {
      next if ref($self->{$_});

      if (defined($self->{$_})) {
        # flip the bit..
        Encode::_utf8_on($self->{$_});
        utf8::decode($self->{$_});
        # ..sanity check
        if (!utf8::valid($self->{$_})) {
          # if we're in an eval, let's at least not _completely_ stuff
          # the process. Turn the bit off again.
          Encode::_utf8_off($self->{$_});
          # ..and die
          $self->_log("Invalid UTF8 from database in column '$_': " . $self->{$_});
        }
      }
    }
  });

}

sub import {
  my $class = shift;
  local $Exporter::ExportLevel = 1;
  if ($_[0] && $_[0] eq "-nosearch") {
    shift; # ignore option
    return $class->SUPER::import(@_);
  }
  if (caller(0)->isa('Class::DBI')) {
    caller(0)->add_searcher(search => "Litmus::DBI::utf8Search");
  }
  $class->SUPER::import(@_);
}

#########################################################################
package Litmus::DBI::utf8Search;
use base 'Class::DBI::Search::Basic';

sub bind {
  my $self = shift;

  # for fast lookup of which cols are utf8
  my %hash = map { $_ => 1 } $self->class->utf8_columns;

  # get name => values of columns to search for
  my $search_for = $self->_search_for();
  
  # make an array that says whether the value at that position should be 
  # upgraded to utf8. This relies on ->bind() sorting the keys from _search_for()
  # in the same way.
  my @utf8cols = map { $hash{$_} && defined($search_for->{$_}) } sort keys %$search_for;
  
  # take copy of array to avoid upgrading the original values; we only want to
  # upgrade the values for the search.
  my @bind = @{ $self->SUPER::bind(@_) };

  my $i = 0;
  for (@bind) {   
    if (shift @utf8cols) {
      my $copy = $_;
      utf8::upgrade($copy);
      $bind[$i] = $copy;
    }
    $i++;
  }
  \@bind;
}

1;
