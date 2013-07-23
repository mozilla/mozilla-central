/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Test for bug 387403 crash when opening e-mail with broken vcard.
 */

function run_test() {
  // Before bug 387403 this would hang, eating up all the memory until it
  // crashed.
  MailServices.ab.escapedVCardToAbCard("begin:vcard\nfn;quoted-printable:Xxxx=C5=82xx  Xxx\nn;quoted-printable:Xxx;Xxxx=C5=82xx \nadr;quoted-printable;quoted-printable;dom:;;xx. Xxxxxxxxxxxx X;Xxxxxx=C3=3");
}
