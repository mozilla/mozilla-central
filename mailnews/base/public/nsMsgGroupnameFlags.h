/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _msgGroupnameFlags_h_
#define _msgGroupnameFlags_h_


/* Flags in the subscribe pane (used inside of MSG_GroupNameLine).  Where
   the flags overlap with the nsMsgFolderFlags flags, it has the same value,
   to reduce the chance of someone using the wrong constant. */

#define MSG_GROUPNAME_FLAG_ELIDED		0x0010  /* Whether the children of this
												   group are currently hidden
												   in the listing.  This will
												   only be present if it has
												   any children. */

#define MSG_GROUPNAME_FLAG_MODERATED	0x0020  /* Whether this folder
												   represents a moderated
												   newsgroup. */
#define MSG_GROUPNAME_FLAG_SUBSCRIBED	0x0040  /* Whether this folder
												   represents a subscribed
												   newsgroup. */
#define MSG_GROUPNAME_FLAG_NEW_GROUP	0x0080  /* A newsgroup which has just
												   been added by the `Check
												   New Groups' command. */
#define MSG_GROUPNAME_FLAG_HASCHILDREN	0x40000 /* Whether there are children
												  of this group.  Whether those
												  chilren are visible in this
												  list is determined by the
												  above "ELIDED" flag. 
												  Setting this to the same value
												  as an nsMsgFolderFlags IMAP server,
												  since an IMAP _server_ will never
												  appear in the subscribe pane.  */
#define MSG_GROUPNAME_FLAG_IMAP_PERSONAL	0x80000		/* folder is an IMAP personal folder */

#define MSG_GROUPNAME_FLAG_IMAP_PUBLIC		0x100000		/* folder is an IMAP public folder */

#define MSG_GROUPNAME_FLAG_IMAP_OTHER_USER	0x200000		/* folder is another user's IMAP folder */

#define MSG_GROUPNAME_FLAG_IMAP_NOSELECT	0x400000		/* A \NoSelect IMAP folder */

#define MSG_GROUPNAME_FLAG_PERSONAL_SHARED	0x800000	/* whether or not this folder is one of your personal folders that
								`					       is shared with other users */

#endif
