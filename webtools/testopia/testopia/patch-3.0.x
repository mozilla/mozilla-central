### Eclipse Workspace Patch 1.0
#P bmo-3.0.3-testopia-mysql
Index: Bugzilla/User.pm
===================================================================
RCS file: /cvsroot/mozilla/webtools/bugzilla/Bugzilla/User.pm,v
retrieving revision 1.148.2.6
diff -u -r1.148.2.6 User.pm
--- Bugzilla/User.pm	28 Nov 2007 19:33:34 -0000	1.148.2.6
+++ Bugzilla/User.pm	29 Feb 2008 23:19:44 -0000
@@ -330,6 +330,16 @@
     return $self->{queries_available};
 }
 
+sub testopia_queries {
+    my $self = shift;
+    my $dbh = Bugzilla->dbh;
+    my $ref = $dbh->selectall_arrayref(
+        "SELECT name, query FROM test_named_queries
+         WHERE userid = ? AND isvisible = 1",
+         {'Slice' =>{}}, $self->id);
+    return $ref;
+}
+
 sub settings {
     my ($self) = @_;
 
@@ -627,7 +637,7 @@
     my $class_restricted = Bugzilla->params->{'useclassification'} && $class_id;
 
     if (!defined $self->{selectable_products}) {
-        my $query = "SELECT id " .
+        my $query = "(SELECT id, name AS pname " .
                     "  FROM products " .
                  "LEFT JOIN group_control_map " .
                     "    ON group_control_map.product_id = products.id ";
@@ -637,10 +647,17 @@
             $query .= " AND group_control_map.membercontrol = " . CONTROLMAPMANDATORY;
         }
         $query .= "     AND group_id NOT IN(" . $self->groups_as_string . ") " .
-                  "   WHERE group_id IS NULL " .
-                  "ORDER BY name";
+                  "   WHERE group_id IS NULL) " ;
+                  
 
-        my $prod_ids = Bugzilla->dbh->selectcol_arrayref($query);
+        $query .= "UNION (SELECT id, tr_products.name AS pname FROM products AS tr_products ".
+                  "INNER JOIN test_plans ON tr_products.id = test_plans.product_id ".
+                  "INNER JOIN test_plan_permissions ON test_plan_permissions.plan_id = test_plans.plan_id ".
+                  "WHERE test_plan_permissions.userid = ?)";
+        
+        $query .= "ORDER BY pname ";    
+
+        my $prod_ids = Bugzilla->dbh->selectcol_arrayref($query,undef,$self->id);
         $self->{selectable_products} = Bugzilla::Product->new_from_list($prod_ids);
     }
 
@@ -903,6 +920,33 @@
             $group_delete->execute($id, $group, GRANT_REGEXP) if $present;
         }
     }
+    # Now do the same for Testopia test plans.
+    $sth = $dbh->prepare("SELECT test_plan_permissions_regexp.plan_id, 
+                                 user_regexp, test_plan_permissions_regexp.permissions, 
+                                 test_plan_permissions.plan_id
+                          FROM test_plan_permissions_regexp
+                     LEFT JOIN test_plan_permissions 
+                            ON test_plan_permissions_regexp.plan_id = test_plan_permissions.plan_id
+                           AND test_plan_permissions.userid = ?
+                           AND test_plan_permissions.grant_type = ?");
+    
+    $sth->execute($id, GRANT_REGEXP);
+    my $plan_insert = $dbh->prepare(q{INSERT INTO test_plan_permissions
+                                       (userid, plan_id, permissions, grant_type)
+                                       VALUES (?, ?, ?, ?)});
+    my $plan_delete = $dbh->prepare(q{DELETE FROM test_plan_permissions
+                                       WHERE userid = ?
+                                         AND plan_id = ?
+                                         AND grant_type = ?});
+    
+    while (my ($planid, $regexp, $perms, $present) = $sth->fetchrow_array()) {
+        if (($regexp ne '') && ($self->{login} =~ m/$regexp/i)) {
+            $plan_insert->execute($id, $planid, $perms, GRANT_REGEXP) unless $present;
+        } else {
+            $plan_delete->execute($id, $planid, GRANT_REGEXP) if $present;
+        }
+    }
+    
 }
 
 sub product_responsibilities {
@@ -1547,7 +1591,8 @@
 
     $dbh->bz_lock_tables('profiles WRITE', 'profiles_activity WRITE',
         'user_group_map WRITE', 'email_setting WRITE', 'groups READ', 
-        'tokens READ', 'fielddefs READ');
+        'tokens READ', 'fielddefs READ', 'test_plan_permissions_regexp READ',
+        'test_plan_permissions READ');
 
     my $user = $class->SUPER::create(@_);
 
Index: Bugzilla/Error.pm
===================================================================
RCS file: /cvsroot/mozilla/webtools/bugzilla/Bugzilla/Error.pm,v
retrieving revision 1.19.2.3
diff -u -r1.19.2.3 Error.pm
--- Bugzilla/Error.pm	16 Aug 2007 20:37:43 -0000	1.19.2.3
+++ Bugzilla/Error.pm	29 Feb 2008 23:19:44 -0000
@@ -32,6 +32,7 @@
 use Bugzilla::WebService::Constants;
 use Bugzilla::Util;
 use Date::Format;
+use JSON;
 
 # We cannot use $^S to detect if we are in an eval(), because mod_perl
 # already eval'uates everything, so $^S = 1 in all cases under mod_perl!
@@ -110,6 +111,16 @@
             }
             die SOAP::Fault->faultcode($code)->faultstring($message);
         }
+        elsif (Bugzilla->error_mode == ERROR_MODE_AJAX) {
+            # JSON can't handle strings across lines. 
+            $message =~ s/\n/ /gm;
+            my $err;
+            $err->{'success'} = 'false';
+            $err->{'error'} = $error;
+            $err->{'message'} = $message;
+            my $json = new JSON;
+            print $json->objToJson($err);
+        }
     }
     exit;
 }
Index: Bugzilla/Constants.pm
===================================================================
RCS file: /cvsroot/mozilla/webtools/bugzilla/Bugzilla/Constants.pm,v
retrieving revision 1.68.2.11
diff -u -r1.68.2.11 Constants.pm
--- Bugzilla/Constants.pm	9 Jan 2008 07:16:16 -0000	1.68.2.11
+++ Bugzilla/Constants.pm	29 Feb 2008 23:19:44 -0000
@@ -126,6 +126,7 @@
     ERROR_MODE_WEBPAGE
     ERROR_MODE_DIE
     ERROR_MODE_DIE_SOAP_FAULT
+    ERROR_MODE_AJAX
 
     INSTALLATION_MODE_INTERACTIVE
     INSTALLATION_MODE_NON_INTERACTIVE
@@ -351,6 +352,7 @@
 use constant ERROR_MODE_WEBPAGE        => 0;
 use constant ERROR_MODE_DIE            => 1;
 use constant ERROR_MODE_DIE_SOAP_FAULT => 2;
+use constant ERROR_MODE_AJAX           => 3;
 
 # The various modes that checksetup.pl can run in.
 use constant INSTALLATION_MODE_INTERACTIVE => 0;
Index: template/en/default/global/header.html.tmpl
===================================================================
RCS file: /cvsroot/mozilla/webtools/bugzilla/template/en/default/global/header.html.tmpl,v
retrieving revision 1.49.2.1
diff -u -r1.49.2.1 header.html.tmpl
--- template/en/default/global/header.html.tmpl	29 Jul 2007 19:24:04 -0000	1.49.2.1
+++ template/en/default/global/header.html.tmpl	29 Feb 2008 23:19:45 -0000
@@ -96,6 +96,7 @@
     [% IF user.settings.skin.value != 'standard' %]
       [% user_skin = user.settings.skin.value %]
     [% END %]
+    [% style_urls.unshift('skins/standard/testopia.css') %]
     [% style_urls.unshift('skins/standard/global.css') %]
 
     [%# CSS cascade, part 1: Standard Bugzilla stylesheet set (persistent).
Index: template/en/default/global/common-links.html.tmpl
===================================================================
RCS file: /cvsroot/mozilla/webtools/bugzilla/template/en/default/global/common-links.html.tmpl,v
retrieving revision 1.7
diff -u -r1.7 common-links.html.tmpl
--- template/en/default/global/common-links.html.tmpl	28 Dec 2006 16:48:06 -0000	1.7
+++ template/en/default/global/common-links.html.tmpl	29 Feb 2008 23:19:45 -0000
@@ -103,3 +103,4 @@
     [% END %]
   [% END %]
 </ul>
+[% Hook.process("links") %]
\ No newline at end of file
Index: editusers.cgi
===================================================================
RCS file: /cvsroot/mozilla/webtools/bugzilla/editusers.cgi,v
retrieving revision 1.141.2.1
diff -u -r1.141.2.1 editusers.cgi
--- editusers.cgi	19 Nov 2007 12:45:31 -0000	1.141.2.1
+++ editusers.cgi	29 Feb 2008 23:19:44 -0000
@@ -229,6 +229,8 @@
     # Lock tables during the check+update session.
     $dbh->bz_lock_tables('profiles WRITE',
                          'profiles_activity WRITE',
+                         'test_plan_permissions WRITE',
+                         'test_plan_permissions_regexp READ',
                          'fielddefs READ',
                          'tokens WRITE',
                          'logincookies WRITE',
Index: votes.cgi
===================================================================
RCS file: /cvsroot/mozilla/webtools/bugzilla/votes.cgi,v
retrieving revision 1.50.2.1
diff -u -r1.50.2.1 votes.cgi
--- votes.cgi	10 Jun 2007 10:20:52 -0000	1.50.2.1
+++ votes.cgi	29 Feb 2008 23:19:44 -0000
@@ -130,8 +130,8 @@
 
     my $canedit = (Bugzilla->params->{'usevotes'} && $userid == $who) ? 1 : 0;
 
-    $dbh->bz_lock_tables('bugs READ', 'products READ', 'votes WRITE',
-             'cc READ', 'bug_group_map READ', 'user_group_map READ',
+    $dbh->bz_lock_tables('bugs READ', 'products READ', 'products AS tr_products READ', 'votes WRITE',
+             'cc READ', 'bug_group_map READ', 'user_group_map READ', 'test_plans READ', 'test_plan_permissions READ', 
              'group_group_map READ', 'groups READ', 'group_control_map READ');
 
     if ($canedit && $bug_id) {
Index: Bugzilla/WebService/User.pm
===================================================================
RCS file: /cvsroot/mozilla/webtools/bugzilla/Bugzilla/WebService/User.pm,v
retrieving revision 1.4.2.1
diff -u -r1.4.2.1 User.pm
--- Bugzilla/WebService/User.pm	18 Sep 2007 23:30:20 -0000	1.4.2.1
+++ Bugzilla/WebService/User.pm	29 Feb 2008 23:19:45 -0000
@@ -110,6 +110,40 @@
     return { id => type('int')->value($user->id) };
 }
 
+#################
+# User Lookup   #
+#################
+
+sub lookup_login_by_id {
+  my $self = shift;
+  my ($author_id) = @_;
+
+  $self->SUPER::login;
+  
+  my $user = new Bugzilla::User($author_id);
+
+  my $result = defined $user ? $user->login : '';
+  
+  $self->SUPER::logout;
+  
+  # Result is user login string or empty string if failed
+  return $result;
+}
+
+sub lookup_id_by_login {
+  my $self = shift;
+  my ($author) = @_;
+
+  $self->SUPER::login;
+
+  my $result = Bugzilla::User::login_to_id($author);
+  
+  $self->SUPER::logout;
+  
+  # Result is user id or 0 if failed
+  return $result;
+}
+
 1;
 
 __END__
Index: Bugzilla/Install/Filesystem.pm
===================================================================
RCS file: /cvsroot/mozilla/webtools/bugzilla/Bugzilla/Install/Filesystem.pm,v
retrieving revision 1.18.2.2
diff -u -r1.18.2.2 Filesystem.pm
--- Bugzilla/Install/Filesystem.pm	17 Aug 2007 21:13:29 -0000	1.18.2.2
+++ Bugzilla/Install/Filesystem.pm	29 Feb 2008 23:19:45 -0000
@@ -110,6 +110,8 @@
         'runtests.pl'     => { perms => $owner_executable },
         'testserver.pl'   => { perms => $ws_executable },
         'whine.pl'        => { perms => $ws_executable },
+        'tr_csv2xml.pl'   => { perms => $ws_executable },
+        'tr_importxml.pl' => { perms => $ws_executable },
         'customfield.pl'  => { perms => $owner_executable },
         'email_in.pl'     => { perms => $ws_executable },
 
@@ -151,6 +153,8 @@
                                      dirs => $ws_dir_readable },
          "$libdir/Bugzilla"    => { files => $ws_readable,
                                      dirs => $ws_dir_readable },
+         "$libdir/testopia"    => { files => $ws_readable,
+                                     dirs => $ws_dir_readable },
          $templatedir          => { files => $ws_readable,
                                      dirs => $ws_dir_readable },
          images                => { files => $ws_readable,
Index: Bugzilla/DB/Mysql.pm
===================================================================
RCS file: /cvsroot/mozilla/webtools/bugzilla/Bugzilla/DB/Mysql.pm,v
retrieving revision 1.49
diff -u -r1.49 Mysql.pm
--- Bugzilla/DB/Mysql.pm	4 Feb 2007 16:59:30 -0000	1.49
+++ Bugzilla/DB/Mysql.pm	29 Feb 2008 23:19:44 -0000
@@ -613,6 +613,9 @@
                     if ($table eq 'bugs' && $name eq 'short_desc') {
                         $self->bz_drop_index('bugs', 'bugs_short_desc_idx');
                     }
+                    if ($table eq 'test_runs' && $name eq 'summary') {
+                        $self->bz_drop_index('test_runs', 'test_runs_summary_idx');
+                    }
 
                     print "Converting $table.$name to be stored as UTF-8...\n";
                     my $col_info = 
Index: Bugzilla/Bug.pm
===================================================================
RCS file: /cvsroot/mozilla/webtools/bugzilla/Bugzilla/Bug.pm,v
retrieving revision 1.171.2.2
diff -u -r1.171.2.2 Bug.pm
--- Bugzilla/Bug.pm	17 Oct 2007 22:50:22 -0000	1.171.2.2
+++ Bugzilla/Bug.pm	27 Mar 2008 22:03:25 -0000
@@ -1314,6 +1314,14 @@
         "SELECT bug_id FROM bugs WHERE alias = ?", undef, $alias);
 }
 
+sub get_test_case_count {
+      my $self = shift;
+      my $dbh = Bugzilla->dbh;
+      my $row_count = $dbh->selectall_arrayref(
+              "SELECT DISTINCT case_id FROM test_case_bugs WHERE bug_id = ?",
+              undef, $self->bug_id);
+      return scalar @$row_count;
+}
 #####################################################################
 # Subroutines
 #####################################################################
                     