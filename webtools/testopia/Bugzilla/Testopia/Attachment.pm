# -*- Mode: perl; indent-tabs-mode: nil -*-
#
# The contents of this file are subject to the Mozilla Public
# License Version 1.1 (the "License"); you may not use this file
# except in compliance with the License. You may obtain a copy of
# the License at http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS
# IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
# implied. See the License for the specific language governing
# rights and limitations under the License.
#
# The Original Code is the Bugzilla Test Runner System.
#
# The Initial Developer of the Original Code is Maciej Maczynski.
# Portions created by Maciej Maczynski are Copyright (C) 2001
# Maciej Maczynski. All Rights Reserved.
#
# Large portions lifted uncerimoniously from Bugzilla::Attachment.pm
# and bugzilla's attachment.cgi
#
# Contributor(s): Greg Hendricks <ghendricks@novell.com>

package Bugzilla::Testopia::Attachment;

use strict;

use Bugzilla::Util;
use Bugzilla::Config;
use Bugzilla::Error;

use base qw(Exporter Bugzilla::Object);

###############################
####    Initialization     ####
###############################
use constant DB_TABLE   => "test_attachments";
use constant NAME_FIELD => "description";
use constant ID_FIELD   => "attachment_id";
use constant DB_COLUMNS => qw(
    attachment_id
    submitter_id
    description
    filename
    creation_ts
    mime_type
);

use constant REQUIRED_CREATE_FIELDS => qw(submitter_id description filename mime_type);
use constant UPDATE_COLUMNS         => qw(description filename mime_type);

use constant VALIDATORS => {
    plan_id  => \&_check_plan,
    case_id  => \&_check_case,
    filename => \&_check_filename,
};

###############################
####       Validators      ####
###############################
sub _validate_data {
    my $data = shift;
    my $maxsize = Bugzilla->params->{"maxattachmentsize"};
    $maxsize *= 1024; # Convert from K
        
    # Make sure the attachment does not exceed the maximum permitted size
    my $len = $data ? length($data) : 0;
    if ($maxsize && $len > $maxsize) {
        my $vars = { filesize => sprintf("%.0f", $len/1024) };
        ThrowUserError("file_too_large", $vars);
    }
    trick_taint($data);
    return $data;
}

sub _check_plan {
    my ($invocant, $plan_id) = @_;
    Bugzilla::Testopia::Util::validate_test_id($plan_id, 'plan');
    trick_taint($plan_id);
    return $plan_id;
}

sub _check_case {
    my ($invocant, $case_id) = @_;
    Bugzilla::Testopia::Util::validate_test_id($case_id, 'case');
    trick_taint($case_id);
    return $case_id;
}

sub _check_filename {
    my ($invocant, $filename) = @_;
    # Remove path info (if any) from the file name.  The browser should do this
    # for us, but some are buggy.  This may not work on Mac file names and could
    # mess up file names with slashes in them, but them's the breaks.  We only
    # use this as a hint to users downloading attachments anyway, so it's not 
    # a big deal if it munges incorrectly occasionally.
    $filename =~ s/^.*[\/\\]//;

    # Truncate the filename to 100 characters, counting from the end of the string
    # to make sure we keep the filename extension.
    $filename = substr($filename, -100, 100);

    trick_taint($filename);
    return $filename;    
    
}

###############################
####       Mutators        ####
###############################
sub set_description { $_[0]->set('description', $_[1]); }
sub set_mime_type   { $_[0]->set('mime_type', $_[1]); }
sub set_filename    { $_[0]->set('filename', $_[1]); }

sub new {
    my $invocant = shift;
    my $class = ref($invocant) || $invocant;
    my $param = shift;
    
    # We want to be able to supply an empty object to the templates for numerous
    # lists etc. This is much cleaner than exporting a bunch of subroutines and
    # adding them to $vars one by one. Probably just Laziness shining through.
    if (ref $param eq 'HASH'){
        if (!keys %$param || $param->{PREVALIDATED}){
            bless($param, $class);
            return $param;
        }
    }
    
    unshift @_, $param;
    my $self = $class->SUPER::new(@_);
    
    return $self; 
}

sub create {
    my ($class, $params) = @_;
    my $dbh = Bugzilla->dbh;
    
    $class->SUPER::check_required_create_fields($params);
    
    # This is an either/or operation. We need either a plan or a case
    # to attach this to.
    if (!$params->{'case_id'} && !$params->{'plan_id'}){
        ThrowCodeError("testopia-missing-attachment-key");
    }
    
    my $field_values = $class->run_create_validators($params);
    
    # Windows screenshots are usually uncompressed BMP files which
    # makes for a quick way to eat up disk space. Let's compress them. 
    # We do this before we check the size since the uncompressed version
    # could easily be greater than maxattachmentsize.
    if (Bugzilla->params->{'convert_uncompressed_images'} 
          && $field_values->{'mime_type'} eq 'image/bmp'){
      require Image::Magick; 
      my $img = Image::Magick->new(magick=>'bmp');
      $img->BlobToImage($field_values->{'contents'});
      $img->set(magick=>'png');
      my $imgdata = $img->ImageToBlob();
      $field_values->{'contents'} = $imgdata;
      $field_values->{'mime_type'} = 'image/png';
    }
    
    $field_values->{contents} = _validate_data($field_values->{contents});
    $field_values->{creation_ts} = Bugzilla::Testopia::Util::get_time_stamp();
    
    my $contents   = $field_values->{contents};
    my $case_id    = $field_values->{case_id};
    my $plan_id    = $field_values->{plan_id};
    my $caserun_id = $field_values->{caserun_id};
    
    delete $field_values->{contents};
    delete $field_values->{case_id};
    delete $field_values->{plan_id};
    delete $field_values->{caserun_id};
    
    my $self = $class->SUPER::insert_create_data($field_values);
    
    # Store the data
    $dbh->do("INSERT INTO test_attachment_data (attachment_id, contents) VALUES(?,?)",
              undef, $self->id, $contents);
    
    # Link it to the case or plan
    if ($case_id){
        $dbh->do("INSERT INTO test_case_attachments (attachment_id, case_id, case_run_id)
                  VALUES (?,?,?)",
                  undef, ($self->id, $case_id, $caserun_id));
    }
    elsif ($plan_id){
        $dbh->do("INSERT INTO test_plan_attachments (attachment_id, plan_id)
                  VALUES (?,?)",
                  undef, ($self->id, $plan_id));
    }
    
    return $self;
}

###############################
####       Methods         ####
###############################
sub store {
    my ($self) = @_;
    # Exclude the auto-incremented field from the column list.
    my $columns = join(", ", grep {$_ ne 'attachment_id'} DB_COLUMNS);

    if (!$self->{'case_id'} && !$self->{'plan_id'}){
        ThrowUserError("testopia-missing-attachment-key");
    }
    $self->_validate_data;
    $self->{'filename'} = $self->strip_path($self->{'filename'});
    my $dbh = Bugzilla->dbh;
    my ($timestamp) = Bugzilla::Testopia::Util::get_time_stamp();

    $dbh->do("INSERT INTO test_attachments ($columns) VALUES (?,?,?,?,?)",
              undef, ($self->{'submitter_id'}, $self->{'description'},
              $self->{'filename'}, $timestamp, $self->{'mime_type'}));
 
    my $key = $dbh->bz_last_key( 'test_attachments', 'attachment_id' );
    $dbh->do("INSERT INTO test_attachment_data (attachment_id, contents) VALUES(?,?)",
              undef, $key, $self->{'contents'});

    if ($self->{'case_id'}){

        $dbh->do("INSERT INTO test_case_attachments (attachment_id, case_id, case_run_id)
                  VALUES (?,?,?)",
                  undef, ($key, $self->{'case_id'}, $self->{'case_run_id'}));
    }
    elsif ($self->{'plan_id'}){
        $dbh->do("INSERT INTO test_plan_attachments (attachment_id, plan_id)
                  VALUES (?,?)",
                  undef, ($key, $self->{'plan_id'}));
    }

    return $key;    
}

# Returns 1 if the parameter is a content-type viewable in this browser
# Note that we don't use $cgi->Accept()'s ability to check if a content-type
# matches, because this will return a value even if it's matched by the generic
# */* which most browsers add to the end of their Accept: headers.

sub is_browser_safe {
  my $self = shift;
  my $cgi = shift;
  my $contenttype = $self->mime_type;
    
  # We assume we can view all text and image types  
  if ($contenttype =~ /^(text|image)\//) {
    return 1;
  }
  
  # Mozilla can view XUL. Note the trailing slash on the Gecko detection to
  # avoid sending XUL to Safari.
  if (($contenttype =~ /^application\/vnd\.mozilla\./) &&
      ($cgi->user_agent() =~ /Gecko\//))
  {
    return 1;
  }

  # If it's not one of the above types, we check the Accept: header for any 
  # types mentioned explicitly.
  my $accept = join(",", $cgi->Accept());
  
  if ($accept =~ /^(.*,)?\Q$contenttype\E(,.*)?$/) {
    return 1;
  }
  
  return 0;
}

sub obliterate {
    my $self = shift;
    return 0 unless $self->candelete;
    my $dbh = Bugzilla->dbh;
    
    $dbh->do("DELETE FROM test_attachment_data 
              WHERE attachment_id = ?", undef, $self->{'attachment_id'});
    $dbh->do("DELETE FROM test_case_attachments 
              WHERE attachment_id = ?", undef, $self->{'attachment_id'});
    $dbh->do("DELETE FROM test_plan_attachments 
              WHERE attachment_id = ?", undef, $self->{'attachment_id'});
    $dbh->do("DELETE FROM test_attachments 
              WHERE attachment_id = ?", undef, $self->{'attachment_id'});
    return 1;
}

sub link_plan {
    my $self = shift;
    my ($plan_id) = @_;
    my $dbh = Bugzilla->dbh;

    $dbh->bz_lock_tables('test_plan_attachments WRITE');
    my ($is) = $dbh->selectrow_array(
            "SELECT 1 
               FROM test_plan_attachments
              WHERE attachment_id = ?
                AND plan_id = ?",
               undef, ($self->id, $plan_id));
    if ($is) {
        $dbh->bz_unlock_tables();
        return;
    }

    $dbh->do("INSERT INTO test_plan_attachments (attachment_id, plan_id)
              VALUES (?,?)",
              undef, ($self->id, $plan_id));
    $dbh->bz_unlock_tables(); 
}

sub link_case {
    my $self = shift;
    my ($case_id) = @_;
    my $dbh = Bugzilla->dbh;

    $dbh->bz_lock_tables('test_case_attachments WRITE');
    my ($is) = $dbh->selectrow_array(
            "SELECT 1 
               FROM test_case_attachments
              WHERE attachment_id = ?
                AND case_id = ?",
               undef, ($self->id, $case_id));
    if ($is) {
        $dbh->bz_unlock_tables();
        return;
    }

    $dbh->do("INSERT INTO test_case_attachments (attachment_id, case_id)
              VALUES (?,?)",
              undef, ($self->id, $case_id));
    $dbh->bz_unlock_tables();
}
    
sub unlink_plan {
    my $self = shift;
    my ($plan_id) = @_;
    my $dbh = Bugzilla->dbh;
    my ($refcount) = $dbh->selectrow_array(
        "SELECT COUNT(*) 
           FROM test_plan_attachments 
          WHERE attachment_id = ?", undef, $self->id);
    if ($refcount > 1){
        $dbh->do("DELETE FROM test_plan_attachments 
                  WHERE plan_id = ? AND attachment_id = ?",
                  undef, ($plan_id, $self->id));
    }
    else {
        $self->obliterate;
    }
}

sub unlink_case {
    my $self = shift;
    my ($case_id) = @_;
    my $dbh = Bugzilla->dbh;
    
    my ($refcount) = $dbh->selectrow_array(
        "SELECT COUNT(*) 
           FROM test_case_attachments 
          WHERE attachment_id = ?", undef, $self->id);
    if ($refcount > 1){
        $dbh->do("DELETE FROM test_case_attachments 
                  WHERE case_id = ? AND attachment_id = ?",
                  undef, ($case_id, $self->id));
    }
    else {
        $self->obliterate;
    }
}

sub canview {
    my $self = shift;
    return 1 if Bugzilla->user->in_group('Testers');
    foreach my $i (@{$self->cases}){
        return 0 unless $i->canview;
    }
    foreach my $i (@{$self->plans}){
        return 0 unless $i->canview;
    }
    return 1;
}

sub canedit {
    my $self = shift;
    return 1 if Bugzilla->user->in_group('Testers');
    foreach my $i (@{$self->cases}){
        return 0 unless $i->canedit;
    }
    foreach my $i (@{$self->plans}){
        return 0 unless $i->canedit;
    }
    return 1;
}

sub candelete {
    my $self = shift;
    return 1 if Bugzilla->user->in_group("admin");
    return 0 unless $self->canedit && Bugzilla->params->{"allow-test-deletion"};
    return 1 if Bugzilla->user->id == $self->submitter->id;
    foreach my $i (@{$self->cases}){
        return 0 unless $i->canedit;
    }
    foreach my $i (@{$self->plans}){
        return 0 unless $i->canedit;
    }
    return 1;
}

###############################
####      Accessors        ####
###############################

sub id             { return $_[0]->{'attachment_id'};    }
sub submitter      { return Bugzilla::User->new($_[0]->{'submitter_id'});      }
sub description    { return $_[0]->{'description'};      }
sub filename       { return $_[0]->{'filename'};         }
sub creation_ts    { return $_[0]->{'creation_ts'};      }
sub mime_type      { return $_[0]->{'mime_type'};        }

sub contents {
    my ($self) = @_;
    my $dbh = Bugzilla->dbh;
    return $self->{'contents'} if exists $self->{'contents'};
    my ($contents) = $dbh->selectrow_array("SELECT contents 
                                           FROM test_attachment_data
                                           WHERE attachment_id = ?",
                                           undef, $self->{'attachment_id'});

    $self->{'contents'} = $contents;
    return $self->{'contents'};
}

sub datasize {
    my ($self) = @_;
    my $dbh = Bugzilla->dbh;
    return $self->{'datasize'} if exists $self->{'datasize'};
    my ($datasize) = $dbh->selectrow_array("SELECT LENGTH(contents) 
                                           FROM test_attachment_data
                                           WHERE attachment_id = ?",
                                           undef, $self->{'attachment_id'});
    $self->{'datasize'} = $datasize;
    return $self->{'datasize'};
}

sub cases {
    my ($self) = @_;
    my $dbh = Bugzilla->dbh;
    return $self->{'cases'} if exists $self->{'cases'};
    my $caseids = $dbh->selectcol_arrayref(
            "SELECT case_id FROM test_case_attachments
              WHERE attachment_id = ?", 
             undef, $self->id);
    my @cases;
    foreach my $id (@{$caseids}){
        push @cases, Bugzilla::Testopia::TestCase->new($id);
    }

    $self->{'cases'} = \@cases;
    return $self->{'cases'};
}

sub plans {
    my ($self) = @_;
    my $dbh = Bugzilla->dbh;
    return $self->{'plans'} if exists $self->{'plans'};
    my $planids = $dbh->selectcol_arrayref(
            "SELECT plan_id FROM test_plan_attachments
              WHERE attachment_id = ?", 
             undef, $self->id);
    my @plans;
    foreach my $id (@{$planids}){
        push @plans, Bugzilla::Testopia::TestPlan->new($id);
    }

    $self->{'plans'} = \@plans;
    return $self->{'plans'};
}

sub type {
    my $self = shift;
    $self->{'type'} = 'attachment';
    return $self->{'type'};
}

1;

__END__

=head1 NAME

Bugzilla::Testopia::Attachment - Attachment object for Testopia

=head1 EXTENDS

Bugzilla::Object

=head1 DESCRIPTION

This module provides support for attachments to Test Cases, Test
Plans and Test Case Runs in Testopia. Attachments can be linked
to multiple cases or plans. If linked to a test case, there is
an optional id for the case_run in which it was linked.

=head1 SYNOPSIS

=head2 Creating
 
 $attachment = Bugzilla::Testopia::Attachment->new($attachment_id);
 $attachment = Bugzilla::Testopia::Build->new({name => $name});
  
 $new_attachment = Bugzilla::Testopia::Build->create({name => $name, 
                                                 description => $desc
                                                 ... });

=head3 Deprecated

 $attachment = Bugzilla::Testopia::Build->new({name => $name,
                                          description => $desc,
                                          ...
                                          PREVALIDATED => 1});
 my $id = $attachment->store();
 
=head2 Updating
 
 $attachment->set_filename($name);
 $attachment->set_description($desc);
 $attachment->set_mime_type($mime_type);
 
 $attachment->update();
 
=head2 Accessors

 my $id            = $attachment->id;
 my $fname         = $attachment->filename;
 my $desc          = $attachment->description;
 my $size          = $attachment->datasize;
 my $contents      = $attachment->contents;
 my $created       = $attachment->creation_ts;
 my $submitter     = $attachment->submitter;

=head1 FIELDS

=over

=item C<attachment_id> 

The unique id of this attachment in the database. 

=item C<creation_ts>

Timestamp - when this attachment was created
 
=item C<description>

A description of this attachment. Becomes the link on the plan and case pages. 

=item C<filename>

The file name from the users harddrive before uploading with its path removed.

=item C<mime_type>

The MIME type associated with this attachment. This is used to determine if the 
attachment if viewable in a browser.

=item C<milestone>

The value from the Bugzilla product milestone table this build is associated with.

=item C<isactive>

Boolean - determines whether to show this build in lists for selection.  

=item C<test_attachment_data.contents>

The actual attachment data. This is stored in a separate table to reduce lookup times.

=back

=head1 METHODS

=over

=item C<new($param)>

 Description: Used to load an existing attachment from the database.
 
 Params:      $param - An integer representing the ID in the database
                       or a hash with the "name" key representing the named
                       attachment in the database.
                       
 Returns:     A blessed Bugzilla::Testopia::Build object
 
=item C<candelete()>
 
 Description: Check that the current attachment can be safely deleted and that 
              the current user has rights to do so.
              
 Params:      none.
 
 Returns:     0 if the user does not have rights to delete this attachment.
              1 if the user does have rights.

=item C<canedit()>
 
 Description: Check that the current user has rights to edit this attachment.
              
 Params:      none.
 
 Returns:     0 if the user does not have rights.
              1 if the user does have rights.
 
=item C<canview()>
 
 Description: Chec that the current user has righte to view this attachment.
              
 Params:      none.
 
 Returns:     0 if the user does not have rights.
              1 if the user does have rights.
 
=item C<create()>
 
 Description: Creates a new attachment object and stores it in the database.
              Also links the associated plans or cases to the object. 
              
 Params:      A hash with keys and values matching the fields of the attachment to 
              be created.
 
 Returns:     The newly created object.
 
=item C<is_browser_safe()>
 
 Description: Checks that the attachment is viewable in the browser based on
              its mime_type.
              
 Params:      CGI - a Bugzilla::CGI object.
 
 Returns:     1 if this attachment can be viewed inline in the browser.
              0 if the attachment must be downloaded for viewing in an external
                application.
 
=item C<link_case()>
 
 Description: Links this attachment to the specified case.
              
 Params:      case_id - id of the case to link to.
 
 Returns:     nothing.
 
=item C<link_plan()>
 
 Description: Links this attachment to the specified plan.
              
 Params:      plan_id - id of the plan to link to.
 
 Returns:     nothing.
 
=item C<obliterate()>
 
 Description: Completely removes this attachment from the database and clears
              references to it.
              
 Params:      none.
 
 Returns:     nothing.
 
=item C<set_description()>
 
 Description: Replaces the current attachment's description. Must call update to 
              store the change in the database.
              
 Params:      text - the new description.
 
 Returns:     nothing.
 
=item C<set_filename()>
 
 Description: Sets the isactive field. 
              
 Params:      string - the new filename
 
 Returns:     nothing.
 
=item C<set_mime_type()>
 
 Description: Changes the assigned mime_type
              
 Params:      string - the new mime_type
 
 Returns:     nothing.

=item C<store()> DEPRECATED
 
 Description: Similar to create except validation is not performed during store. 
              
 Params:      none.
 
 Returns:     The id of the newly stored attachment.

=item C<unlink_case()>
 
 Description: Unlinks the this attachment from the specified test case. If only
              attached to a single case, delete the attachment instead.
              
 Params:      case_id - id of the case to unlink.
 
 Returns:     nothing.
 
=item C<unlink_plan()>
 
 Description: Unlinks the this attachment from the specified test plan. If only
              attached to a single plan, delete the attachment instead.
              
 Params:      plan_id - id of the plan to unlink.
 
 Returns:     nothing.
 
=back

=head1 ACCESSORS

=over

=item C<cases()>

 Returns a list of TestCase objects that this attachment is associated with.
  
=item C<contents()>

 Returns the content data of this attachment.

=item C<creation_ts()>

 Returns the timestamp when this attachment was created.

=item C<datasize()>

 Returns the size in byts of the contents of this attachment.

=item C<description()>
  
 Returns the description of this attachment.
 
=item C<filename()>

 Returns the filename from the users harddrive that was uploaded when the 
 attachemnt was created with any path information stripped off.

=item C<id()>
  
 Returns the id of the attachment.
 
=item C<mime_type()>

 Returns the MIME type of this attachment.

=item C<plans()>

 Returns a list of TestPlan objects associated with this attachment.

=item C<submitter()>

 Returns the login name of the person who submitted this attachment.

=item C<type()>

 Returns "attachment". For use in internal code.

=back

=head1 SEE ALSO

=over

L<Bugzilla::Testopia::TestCase>

L<Bugzilla::Testopia::TestPlan> 

L<Bugzilla::Object> 

=back

=head1 AUTHOR

Greg Hendricks <ghendricks@novell.com>
